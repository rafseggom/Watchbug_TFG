/**
 * `runCaptureFlow` — the strictly ordered orchestration behind one gesture
 * (CAP-01, CAP-04/05, P2-D-02/05/06/12, A-05, SEC-02).
 *
 * The order is the security property, not an implementation detail:
 *
 *   hide host → capture (getDisplayMedia in the gesture's own task)
 *     → assert hidden immediately before the pixel read
 *     → restore host → blank probe → **destructive redaction** → encode → send
 *
 * No encoded byte exists before `Redactor.redact()` runs: the capture seam only
 * yields `ImageData` (A-05) and `encodeLadder` is the single encode sink.
 *
 * Every failure path is a **visible terminal state** (M-6): a silently blank
 * image is never sent, and a capture that never produced a frame becomes a loud
 * `Capture` failure rather than a panel stuck on `Capturing…`.
 */
import { MAX_IMAGE_PIXELS } from '@watchbug/contracts/constants';
import { createDisplayMediaCapture, type CaptureSource } from './capture-source.ts';
import { encodeLadder, type EncodedImage } from '../image/encode.ts';
import { createDomRedactor, type Redactor } from '../redact/redactor.ts';
import type { RectLike } from '../redact/geometry.ts';
import {
  buildMeta,
  filenameFor,
  sendReport,
  SendError,
  type ReportMeta,
  type SendResult,
} from '../transport/lane1.ts';
import type { StatusView } from '../widget/status-panel.ts';
import type { Launcher } from '../widget/launcher.ts';
import type { WatchbugHost } from '../widget/host.ts';

/** Grid side for the 9-sample blank probe (3×3 = 9 distributed pixels). */
export const BLANK_PROBE_GRID = 3;

/** Thrown by the pipeline's own invariant hook; never swallowed. */
export class PipelineInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PipelineInvariantError';
  }
}

export interface BlankProbeResult {
  blank: boolean;
  reason?: 'uniform' | 'oversize' | 'empty';
}

/**
 * P2-D-12: 9 distributed samples across the frame. A frame whose samples are
 * all byte-identical carries no content, and sending it would produce a report
 * the developer cannot reproduce from. A frame beyond the supported canvas cap
 * is refused for the same reason — loudly, never silently.
 */
export function blankProbe(image: ImageData): BlankProbeResult {
  const area = image.width * image.height;
  if (area === 0) return { blank: true, reason: 'empty' };
  if (area > MAX_IMAGE_PIXELS) return { blank: true, reason: 'oversize' };

  const { data } = image;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let step = 1; step <= BLANK_PROBE_GRID; step += 1) {
    xs.push(Math.min(image.width - 1, Math.floor((image.width * step) / (BLANK_PROBE_GRID + 1))));
    ys.push(Math.min(image.height - 1, Math.floor((image.height * step) / (BLANK_PROBE_GRID + 1))));
  }

  const first = (ys[0] * image.width + xs[0]) * 4;
  const reference = [data[first], data[first + 1], data[first + 2], data[first + 3]];

  for (const y of ys) {
    for (const x of xs) {
      const at = (y * image.width + x) * 4;
      if (
        data[at] !== reference[0] ||
        data[at + 1] !== reference[1] ||
        data[at + 2] !== reference[2] ||
        data[at + 3] !== reference[3]
      ) {
        return { blank: false };
      }
    }
  }

  return { blank: true, reason: 'uniform' };
}

export interface CaptureFlowConfig {
  projectKey: string;
  endpoint: string;
}

export interface CaptureFlowDeps {
  host: WatchbugHost;
  launcher: Launcher;
  config: CaptureFlowConfig;
  /** Single sink for every state the panel renders. */
  onView: (view: StatusView) => void;
  /** Injection points for the flow's collaborators (e2e seam / future sources). */
  capture?: CaptureSource;
  redactor?: Redactor;
  encode?: (image: ImageData) => Promise<EncodedImage>;
  send?: (payload: {
    blob: Blob;
    filename: string;
    meta: ReportMeta;
    idempotencyKey: string;
  }) => Promise<SendResult>;
}

/** The gesture-facing surface: both methods are safe to call synchronously. */
export interface CaptureFlow {
  /** Start a fresh report (mints a fresh idempotency key). */
  start(): void;
  /** `Try again`: resend the failed payload, or restart the gesture. */
  retry(): void;
}

interface PendingSend {
  blob: Blob;
  filename: string;
  meta: ReportMeta;
  idempotencyKey: string;
}

/**
 * Idempotency key (P2-D-03). Every key comes from a CSPRNG: `randomUUID` where
 * it exists, otherwise a v4 UUID assembled from `getRandomValues` -- which is
 * NOT secure-context-gated, so plain-HTTP self-hosting (a primary deployment
 * shape) still mints a real key instead of `Date.now()` + `Math.random()` (WR-03,
 * I-2). With no CSPRNG at all this throws rather than mint a guessable key
 * behind `UNIQUE (project_id, idempotency_key)`: a collision would silently
 * replay another session's response over a real submission (M-6).
 */
function newIdempotencyKey(): string {
  const source = typeof crypto === 'undefined' ? undefined : crypto;
  if (source !== undefined && typeof source.randomUUID === 'function') {
    return source.randomUUID();
  }
  if (source === undefined || typeof source.getRandomValues !== 'function') {
    throw new Error('no CSPRNG available for the idempotency key');
  }
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Build the flow around one mounted widget. `start()` runs the capture call in
 * the caller's task, so the launcher's click transient activation survives to
 * `getDisplayMedia` (P2-D-02/05) — do not introduce an `await` before
 * `capture.capture()`.
 */
export function createCaptureFlow(deps: CaptureFlowDeps): CaptureFlow {
  const { host, launcher, config, onView } = deps;
  const capture = deps.capture ?? createDisplayMediaCapture(host.element);
  const redactor = deps.redactor ?? createDomRedactor(document, window);
  const encode = deps.encode ?? encodeLadder;
  const send =
    deps.send ??
    ((payload: PendingSend): Promise<SendResult> =>
      sendReport({
        ...payload,
        apiBase: config.endpoint,
        projectKey: config.projectKey,
        onRetry: (attempt) => onView({ kind: 'retrying', attempt }),
      }));

  let running = false;
  let pendingSend: PendingSend | null = null;

  /** Send a fully prepared payload; classifies the terminal state. */
  async function deliver(pending: PendingSend): Promise<void> {
    onView({ kind: 'sending' });
    try {
      await send(pending);
      pendingSend = null;
      onView({ kind: 'sent' });
    } catch (error) {
      if (error instanceof SendError && error.kind === 'rejected') {
        // A contract 4xx is not retryable: surface the server's reason and let
        // the next gesture start clean with a fresh key (A-2).
        pendingSend = null;
        onView({ kind: 'failed', failure: 'rejected', reason: error.reason });
        return;
      }
      // Exhausted transients keep the exact payload + key for a manual retry.
      pendingSend = pending;
      onView({ kind: 'failed', failure: 'network' });
    }
  }

  async function runFromGesture(): Promise<void> {
    try {
      // P2-D-05: hidden before the capture call (the launcher already did this
      // in its handler; this keeps the invariant true for a retry path too).
      host.hideSync();
      launcher.setDisabled(true);
      pendingSend = null;
      onView({ kind: 'capturing' });

      // WR-03 / I-2: minted BEFORE the capture, so a missing CSPRNG is a loud
      // visible failure here and never a request carrying a guessable key.
      // The launcher already hid the host in its own click handler, so this
      // exit MUST put it back: a failure panel rendered into a `display:none`
      // host is not the visible terminal state M-6 requires (FX-01).
      let idempotencyKey: string;
      try {
        idempotencyKey = newIdempotencyKey();
      } catch {
        host.restore();
        onView({ kind: 'failed', failure: 'capture' });
        return;
      }

      // WR-01: the mask rects are measured inside `beforeRead`, the same instant
      // the pixels are read, so a layout shift in between cannot move a secret
      // out from under its mask. The host is `display:none` at that instant, so
      // the widget itself cannot contribute a rect.
      const measured: { rects: RectLike[] | null } = { rects: null };
      let image: ImageData | null = null;
      try {
        // P2-D-06: the assertion runs inside the adapter, immediately before
        // the pixel read — it throws rather than producing a frame with the
        // widget in it.
        image = await capture.capture({
          beforeRead: () => {
            if (!host.isHidden()) {
              throw new PipelineInvariantError('the widget host was visible at pixel-read time');
            }
            measured.rects = redactor.collect();
          },
        });
      } catch {
        onView({ kind: 'failed', failure: 'capture' });
      } finally {
        // The host is restored as soon as the raw frame exists (P2-D-05).
        host.restore();
      }

      if (image === null) return;

      const probe = blankProbe(image);
      if (probe.blank) {
        onView({ kind: 'failed', failure: 'blank' });
        return;
      }

      // SEC-02/T-02-03: destructive fill on the raw pixels, before any encode.
      // FAIL CLOSED (T-02-10): a redaction error — DOM scan failure, geometry
      // mapping failure — must never fall open to unredacted bytes. It
      // short-circuits HERE, before the encode and send steps, into the loud
      // terminal failure state (M-6): nothing is encoded, nothing is sent,
      // and the panel tells the user. The locked UI-SPEC copy set has no
      // dedicated redaction headline, so the capture-failure state carries it
      // (its load-bearing sentence is "Nothing was sent." — dedicated copy,
      // if wanted, belongs with the Phase 3 composer).
      try {
        // `measured.rects` is set by every `CaptureSource` that honours
        // `beforeRead`; the fallback re-measures so a misbehaving seam degrades
        // to a later measurement, never to unredacted bytes (T-02-10).
        redactor.redact(image, measured.rects ?? undefined);
      } catch {
        onView({ kind: 'failed', failure: 'capture' });
        return;
      }

      let encoded: EncodedImage;
      try {
        encoded = await encode(image);
      } catch {
        // No sendable artifact — the capture state is the honest one (there is
        // no separate "encode failed" state in the approved UI contract).
        onView({ kind: 'failed', failure: 'capture' });
        return;
      }

      await deliver({
        blob: encoded.blob,
        filename: filenameFor(encoded.mimeType),
        meta: buildMeta(document, location),
        idempotencyKey,
      });
    } finally {
      running = false;
    }
  }

  function start(): void {
    if (running) return;
    running = true;
    void runFromGesture();
  }

  function retry(): void {
    if (running) return;
    const pending = pendingSend;
    if (pending !== null) {
      running = true;
      void deliver(pending).finally(() => {
        running = false;
      });
      return;
    }
    // Capture-side failures (and contract 4xx) restart the gesture, in the
    // click's own task, so a new capture still has transient activation.
    start();
  }

  return { start, retry };
}
