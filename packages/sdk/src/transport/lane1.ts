/**
 * Lane-1 transport: one multipart report over `fetch` (ING-01/ING-03, P2-D-03).
 *
 * The wire shape is fixed by CA-01: two parts, `meta` (JSON text) and `image`
 * (the encoded blob), plus `X-Project-Key` and `Idempotency-Key`. The key is
 * minted **once per report**, outside the attempt loop, so a retry is the same
 * logical submission and the database's `(project_id, idempotency_key)` unique
 * index makes delivery exactly-once (server dedupe, not client bookkeeping).
 *
 * Classification (P2-D-03):
 *  - transient → network failure, timeout, 5xx, 429. Retried up to
 *    `MAX_RETRIES` times after the initial send, with waits of 1 s / 4 s /
 *    10 s ±25 % jitter before each retry.
 *  - contract 4xx → 400/401/403/413 (and any other 4xx). No retry; the
 *    structured body's `message` is surfaced to the panel as text.
 *
 * `credentials: 'omit'` is not decoration: without it a same-origin POST would
 * carry the host page's cookies, which SEC-03 forbids the SDK ever sending.
 * Lane 2 (unload-survival) is Phase 7 — this module must never reach for
 * `keepalive`/`sendBeacon` (H-9: the 64 KiB cap rejects a real screenshot).
 */
import { MAX_TITLE_CHARS, MAX_URL_PATH_CHARS } from '@watchbug/contracts/constants';

/** Waits before retry 1, 2 and 3 (P2-D-03's locked 1/4/10 s schedule). */
export const RETRY_DELAYS_MS = [1_000, 4_000, 10_000] as const;
/** Three retries *after* the initial send — the `(n of 3)` copy matches exactly. */
export const MAX_RETRIES = RETRY_DELAYS_MS.length;
/** ±25 % jitter, applied per wait so parallel clients do not resynchronise. */
export const RETRY_JITTER_RATIO = 0.25;
/** One attempt's deadline. */
export const SEND_TIMEOUT_MS = 15_000;

/** The CA-01 `meta` shape the SDK sends — explicit fields only, never a spread. */
export interface ReportMeta {
  type: 'bug';
  title: string;
  url: string;
}

export interface SendPayload {
  blob: Blob;
  /** Filename for the multipart part; derived from the sniffed type. */
  filename: string;
  meta: ReportMeta;
  idempotencyKey: string;
}

export interface SendOptions extends SendPayload {
  apiBase: string;
  projectKey: string;
  /** Called with the 1-based retry number right before each wait. */
  onRetry?: (attempt: number) => void;
}

export interface SendResult {
  id: string | null;
}

/** A failure the panel renders as `failedNetwork` or `failedRejected`. */
export class SendError extends Error {
  readonly kind: 'network' | 'rejected';
  readonly reason: string | undefined;

  constructor(kind: 'network' | 'rejected', reason?: string) {
    super(reason ?? kind);
    this.name = 'SendError';
    this.kind = kind;
    this.reason = reason;
  }
}

interface AttemptOutcome {
  ok: boolean;
  transient: boolean;
  id: string | null;
  reason?: string;
}

/**
 * Build the meta part (P2-D-01/PRV-06). `document.title` is host-controlled and
 * untrusted, so it is clamped here and again by the server; `location.pathname`
 * is used rather than `href` so a query string (`?token=…`) can never ride
 * along (R-08).
 */
export function buildMeta(doc: Document, loc: Location): ReportMeta {
  const rawTitle = (doc.title ?? '').trim();
  const title = rawTitle.length > 0 ? rawTitle : 'Untitled page';
  return {
    type: 'bug',
    title: title.slice(0, MAX_TITLE_CHARS),
    url: loc.pathname.slice(0, MAX_URL_PATH_CHARS),
  };
}

/** The multipart filename matching the bytes the engine actually produced. */
export function filenameFor(mimeType: string): string {
  return mimeType === 'image/webp' ? 'screenshot.webp' : 'screenshot.png';
}

async function readServerMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim().length > 0) return message;
    }
  } catch {
    // Non-JSON bodies fall through to the status line.
  }
  return `HTTP ${response.status}`;
}

async function readCreatedId(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'id' in body) {
      const id = (body as { id?: unknown }).id;
      if (typeof id === 'string') return id;
    }
  } catch {
    // A 201 without a JSON body is still a success.
  }
  return null;
}

/** One attempt. Never throws for an HTTP outcome — only `sendReport` decides. */
async function postOnce(options: SendOptions): Promise<AttemptOutcome> {
  const form = new FormData();
  form.append('meta', JSON.stringify(options.meta));
  form.append('image', options.blob, options.filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${options.apiBase}/api/incidents`, {
      method: 'POST',
      headers: {
        'X-Project-Key': options.projectKey,
        'Idempotency-Key': options.idempotencyKey,
      },
      body: form,
      credentials: 'omit',
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = controller.signal.aborted;
    return {
      ok: false,
      transient: true,
      id: null,
      reason: timedOut ? 'the request timed out' : error instanceof Error ? error.message : 'network error',
    };
  } finally {
    clearTimeout(timer);
  }

  if (response.ok) {
    return { ok: true, transient: false, id: await readCreatedId(response) };
  }

  const transient = response.status === 429 || response.status >= 500;
  return {
    ok: false,
    transient,
    id: null,
    reason: await readServerMessage(response),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Delay for retry `attempt` (1-based), jittered by ±`RETRY_JITTER_RATIO`. */
export function retryDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt - 1, 0), RETRY_DELAYS_MS.length - 1);
  const base = RETRY_DELAYS_MS[index];
  const jitter = 1 + (Math.random() * 2 - 1) * RETRY_JITTER_RATIO;
  return Math.round(base * jitter);
}

/**
 * Send one report, retrying transient failures on the locked schedule. The
 * same `blob`, `meta` and `idempotencyKey` object is reused on every attempt —
 * no re-encode, no new key.
 */
export async function sendReport(options: SendOptions): Promise<SendResult> {
  for (let attempt = 0; ; attempt += 1) {
    const outcome = await postOnce(options);
    if (outcome.ok) return { id: outcome.id };
    if (!outcome.transient) throw new SendError('rejected', outcome.reason);
    if (attempt >= MAX_RETRIES) throw new SendError('network', outcome.reason);

    const retryNumber = attempt + 1;
    options.onRetry?.(retryNumber);
    await wait(retryDelayMs(retryNumber));
  }
}
