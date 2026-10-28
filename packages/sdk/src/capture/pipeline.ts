/**
 * The gesture stage and delivery classification behind one report
 * (CAP-01, CAP-04/05, P2-D-02/05/06/12, A-05, SEC-02, PRV-07).
 *
 * Phase 3 splits the Phase-2 linear flow at the pixel boundary: `runCapture
 * Stage()` ends at the already-redacted frame and resolves it to a human (the
 * composer), and `encodeFinal` (re-exported below, defined in
 * `image/encode.ts`) is the only path from a draft to sendable bytes. The
 * security ordering is unchanged:
 *
 *   hide host → capture (getDisplayMedia in the gesture's own task)
 *     → assert hidden immediately before the pixel read
 *     → restore host → blank probe → **destructive T1 redaction**
 *
 * No encoded byte exists before the redaction lands: the capture seam only
 * yields `ImageData` (A-05) and the encode ladder stays the single sink. The
 * encode and the send now happen at Review and at Send report respectively —
 * with the review screen showing the exact artifact in between (T-03-17).
 *
 * Every failure path is a **visible terminal state** (M-6): a silently blank
 * image is never sent, and a capture that never produced a frame becomes a
 * loud failure the panel (later: the degraded composer) announces.
 */
import { MASK_ALPHA_OPAQUE, MAX_IMAGE_PIXELS } from '@watchbug/contracts/constants';
import { createDisplayMediaCapture, type CaptureSource } from './capture-source.ts';
import { encodeLadder, type EncodedImage } from '../image/encode.ts';
import { createDomRedactor, fillBitmapRects, MASK_RGB, type Redactor } from '../redact/redactor.ts';
import { toBitmapRect, transformFor, type BitmapRect, type RectLike } from '../redact/geometry.ts';
import type { MaskPatch } from '../redact/masks.ts';
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

/** The compose-time encode entry — one name, one place, one sink behind it. */
export { encodeFinal } from '../image/encode.ts';

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
 * P2-D-12: a frame carries no content when **every pixel is byte-identical**.
 * Sending such a frame would produce a report the developer cannot reproduce
 * from, so it is refused — loudly, never silently. A frame beyond the supported
 * canvas cap is refused for the same reason.
 *
 * The check is dense on purpose. An earlier version sampled a fixed 3×3 grid at
 * 25/50/75 % and called the frame blank when those nine samples matched, which
 * refused legitimate sparse pages: the manual UAT fixture (a white page with a
 * single heading in the top-left corner) was rejected as `blank` because none
 * of the nine points landed on the heading. A real page differs from its first
 * pixel somewhere — a glyph, a border, a band — so the dense scan only trips on
 * a genuinely uniform bitmap (the failed-canvas / blank-capture case). The
 * worst-case cost is one linear pass over the frame, paid once per capture,
 * and it is dwarfed by the encode that follows.
 */
export function blankProbe(image: ImageData): BlankProbeResult {
  const area = image.width * image.height;
  if (area === 0) return { blank: true, reason: 'empty' };
  if (area > MAX_IMAGE_PIXELS) return { blank: true, reason: 'oversize' };

  const { data } = image;
  const red = data[0];
  const green = data[1];
  const blue = data[2];
  const alpha = data[3];

  for (let at = 4; at < data.length; at += 4) {
    if (data[at] !== red || data[at + 1] !== green || data[at + 2] !== blue || data[at + 3] !== alpha) {
      return { blank: false };
    }
  }

  return { blank: true, reason: 'uniform' };
}

export interface CaptureFlowConfig {
  projectKey: string;
  endpoint: string;
}

/**
 * Why there is no working image. The four values choose the degraded composer's
 * notice copy when 03-04 mounts it (research F6 keeps the existing `status.*`
 * diagnostics as the hint source); today the flow maps them onto the loud
 * `status.failed` states exactly as Phase 2 did.
 *  - `denied`   — the picker was dismissed, a refused surface, or the redaction
 *    scan itself failed (fail-closed: never an unredacted frame, T-02-10).
 *  - `no-api`   — this browser does not expose tab capture at all.
 *  - `blank`    — the uniform-frame refusal (P2-D-12).
 *  - `oversize` — the beyond-cap frame refusal (P2-D-12, same bucket).
 */
export type CaptureNote = 'denied' | 'no-api' | 'blank' | 'oversize';

/** What the capture stage resolves to: a redacted frame, or a loud reason. */
export type CaptureOutcome =
  | { ok: true; image: ImageData; t1: BitmapRect[] }
  | { ok: false; captureNote: CaptureNote };

/**
 * The composed report between capture and send (C-2 contract).
 *
 * `image` is the ONE flattened working bitmap (already T1-redacted; the editor
 * mutates it in place), `t1` are the auto-redaction rects **in bitmap space,
 * measured at the pixel-read instant** (WR-01 / H-1 — never re-derived from
 * the live viewport at export), and `masks` are post-mask patches in creation
 * order (T2: only destroyed pixels exist here; they survive editor
 * round-trips). `encoded` is the single artifact `encodeFinal` produced at
 * Review entry — the exact bytes `Send report` transmits (T-03-17).
 */
export interface Draft {
  type: ReportMeta['type'];
  title: string;
  note: string;
  image: ImageData | null;
  readonly t1: readonly BitmapRect[];
  masks: MaskPatch[];
  encoded: EncodedImage | null;
  captureNote: CaptureNote | null;
  idempotencyKey: string;
}

export interface CaptureStageDeps {
  host: WatchbugHost;
  launcher: Launcher;
  /** The in-flight `Capturing…` state stays the panel's (P3-D-04). */
  onView: (view: StatusView) => void;
  capture: CaptureSource;
  redactor: Redactor;
  /** The viewport the frame is registered against (H-1 mapping input). */
  view: Window;
}

/**
 * True when this browser cannot expose tab capture at all — the classification
 * between `no-api` and `denied` after a capture throw. Reads the same global
 * the production adapter guards on (`capture-source.ts`); on the e2e seam tier
 * the adapter short-circuits before touching it, and a seam that throws still
 * lands in `denied` — the loud capture-failed state either way.
 */
function lacksDisplayMediaApi(): boolean {
  const media = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  return media === undefined || typeof media.getDisplayMedia !== 'function';
}

/**
 * Everything one gesture does up to (and including) the destructive T1
 * redaction — the exact Phase-2 ordering, stopped at the pixel boundary so a
 * human sits between the frame and the encode.
 *
 * `t1` is computed AT THE READ INSTANT: the rects `beforeRead` collected are
 * mapped through `transformFor(image.width, image.height, view.innerWidth,
 * view.innerHeight)` and `toBitmapRect` against the frame that was just read,
 * so a layout shift, zoom or resize between capture and export can never move
 * a mask out from under its secret (WR-01 / H-1).
 *
 * FAIL CLOSED (T-02-10): a capture or redaction error resolves to a note —
 * never to an unredacted or partially redacted frame. The caller renders the
 * loud terminal state; nothing is encoded, nothing is sent.
 */
export async function runCaptureStage(deps: CaptureStageDeps): Promise<CaptureOutcome> {
  const { host, launcher, onView, capture, redactor, view } = deps;
  // P2-D-05: hidden before the capture call (the launcher already did this in
  // its handler; this keeps the invariant true for every entry path).
  host.hideSync();
  launcher.setDisabled(true);
  onView({ kind: 'capturing' });

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
    return { ok: false, captureNote: lacksDisplayMediaApi() ? 'no-api' : 'denied' };
  } finally {
    // The host is restored as soon as the raw frame exists (P2-D-05) — and on
    // EVERY exit, because a failure surface rendered into a `display:none`
    // host is not the visible terminal state M-6 requires (FX-01, Pitfall 12).
    host.restore();
  }

  if (image === null) return { ok: false, captureNote: 'denied' };

  const probe = blankProbe(image);
  if (probe.blank) {
    return { ok: false, captureNote: probe.reason === 'oversize' ? 'oversize' : 'blank' };
  }

  // SEC-02/T-02-03: destructive fill on the raw pixels, before any encode can
  // exist. `measured.rects` is set by every `CaptureSource` that honours
  // `beforeRead`; the fallback re-measures so a misbehaving seam degrades to a
  // later measurement, never to unredacted bytes (T-02-10).
  try {
    const rects = measured.rects ?? redactor.collect();
    const transform = transformFor(image.width, image.height, view.innerWidth, view.innerHeight);
    const t1: BitmapRect[] = [];
    for (const rect of rects) {
      const target = toBitmapRect(rect, transform, image.width, image.height);
      if (target !== null) t1.push(target);
    }
    fillBitmapRects(image, t1, MASK_RGB, MASK_ALPHA_OPAQUE);
    return { ok: true, image, t1 };
  } catch {
    return { ok: false, captureNote: 'denied' };
  }
}

export interface CaptureFlowDeps {
  host: WatchbugHost;
  launcher: Launcher;
  config: CaptureFlowConfig;
  /** Single sink for every state the panel renders (in-flight / terminal). */
  onView: (view: StatusView) => void;
  /** A successfully captured, T1-redacted frame becomes a draft (composer). */
  onDraft: (draft: Draft) => void;
  /** Injection points for the flow's collaborators (e2e seam / future sources). */
  capture?: CaptureSource;
  redactor?: Redactor;
  send?: (payload: {
    blob: Blob;
    filename: string;
    meta: ReportMeta;
    idempotencyKey: string;
  }) => Promise<SendResult>;
}

/** The gesture-facing surface: `start()` is safe to call synchronously. */
export interface CaptureFlow {
  /** Start a fresh report (mints a fresh idempotency key). */
  start(): void;
  /** Transmit the draft's already-encoded artifact — the review's exact bytes. */
  send(draft: Draft): Promise<void>;
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
  const { host, launcher, config, onView, onDraft } = deps;
  const capture = deps.capture ?? createDisplayMediaCapture(host.element);
  const redactor = deps.redactor ?? createDomRedactor(document, window);
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

  /** The prepared multipart payload for one draft's encoded artifact. */
  function pendingFor(draft: Draft): PendingSend {
    const encoded = draft.encoded;
    if (encoded === null) {
      throw new PipelineInvariantError('send called before encodeFinal produced the artifact');
    }
    return {
      blob: encoded.blob,
      filename: filenameFor(encoded.mimeType),
      meta: {
        type: draft.type,
        title: draft.title,
        // The note rides the wire only when non-empty (the contract's `note`
        // is optional; an absent field keeps empty-note reports byte-stable).
        note: draft.note.length > 0 ? draft.note : undefined,
        // R-08: path only, measured at send as in Phase 2.
        url: buildMeta(document, location).url,
      },
      idempotencyKey: draft.idempotencyKey,
    };
  }

  async function runGesture(): Promise<void> {
    try {
      launcher.setDisabled(true);

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

      const stage = await runCaptureStage({
        host,
        launcher,
        onView,
        capture,
        redactor,
        view: window,
      });

      if (!stage.ok) {
        pendingSend = null;
        // Until the degraded composer mounts (03-04), the capture failures keep
        // the Phase-2 loud states: `blank` and `oversize` share the blank
        // bucket, everything else the capture bucket (research F6).
        onView({
          kind: 'failed',
          failure:
            stage.captureNote === 'blank' || stage.captureNote === 'oversize' ? 'blank' : 'capture',
        });
        return;
      }

      pendingSend = null;
      onDraft({
        // P3-D-03: the composer's segmented control starts at `bug`, matching
        // the launcher label; P3-D-02: the title prefills, editable.
        type: 'bug',
        title: buildMeta(document, location).title,
        note: '',
        image: stage.image,
        t1: stage.t1,
        masks: [],
        encoded: null,
        captureNote: null,
        idempotencyKey,
      });
    } finally {
      running = false;
    }
  }

  function start(): void {
    if (running) return;
    running = true;
    void runGesture();
  }

  async function sendDraft(draft: Draft): Promise<void> {
    await deliver(pendingFor(draft));
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

  return { start, send: sendDraft, retry };
}
