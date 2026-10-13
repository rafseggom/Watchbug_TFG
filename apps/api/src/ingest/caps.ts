import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  MAX_BODY_BYTES,
  MAX_IMAGE_PART_BYTES,
  MAX_META_BYTES,
} from '@watchbug/contracts/constants';

/**
 * Stage 1 of the ingest edge: the **layered size caps** (ING-06, Pitfall 1).
 *
 * `@fastify/multipart` parses with its own streaming parser and does *not*
 * go through Fastify's `bodyLimit`, so one option can never bound a multipart
 * body. This module composes the three layers the research prescribes:
 *
 *  1. **`Content-Length` pre-read** — a body that *declares* more than
 *     `MAX_BODY_BYTES` is refused 413 before a single byte is read.
 *  2. **Streaming byte counter** — an absent or lying declaration is caught by
 *     watching the live socket position and destroying the stream at the cap.
 *     Inside a part, {@link BodyByteCounter} counts the bytes actually flowing
 *     and aborts the pipeline at the same cap.
 *  3. **multipart `limits`** — per-part ceilings whose product stays under the
 *     body cap, with `throwFileSizeLimit` so a cut-off image is an error, never
 *     a stored half file.
 *
 * It also owns the two request-shape rules that keep hostile input out of the
 * rest of the chain: the client filename rule (C-4) and the mapping of every
 * parser failure onto a structured `{ statusCode, error, message }` body.
 */

/**
 * The multipart receive limits — the parser layer of the layered caps.
 *
 * `fieldSize` is `MAX_META_BYTES` (A-06, 64 KB) rather than the 4 KB figure a
 * research note carried: a `note` alone is contract-allowed up to 5,000
 * characters, so a 4 KB parser ceiling would silently truncate every large
 * legitimate report before the contract ever saw it (busboy truncates fields
 * without raising, and a truncated JSON field can never parse).
 */
export const MULTIPART_LIMITS = {
  files: 1,
  fileSize: MAX_IMAGE_PART_BYTES,
  fields: 8,
  fieldSize: MAX_META_BYTES,
  headerPairs: 1024,
  parts: 16,
} as const;

/**
 * The multipart receive policy — the composition root registers exactly this
 * object, so the parser ceilings and the filename handling cannot drift from
 * the caps module.
 *
 * `preservePath` matters for C-4: busboy defaults to `basename()`-ing the
 * filename, which would silently turn `../../../etc/passwd.png` into
 * `passwd.png` — the traversal attempt would disappear instead of being
 * rejected by {@link validateClientFilename}. The rule has to see what the
 * client actually sent; the stored path is server-generated either way.
 */
export const MULTIPART_RECEIVE_OPTIONS = {
  limits: MULTIPART_LIMITS,
  throwFileSizeLimit: true,
  preservePath: true,
} as const;

/** The structured failure body every hostile-input path returns. */
export interface CapsFailure {
  statusCode: number;
  error: string;
  message: string;
}

function errorLabel(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 404:
      return 'Not Found';
    case 406:
      return 'Not Acceptable';
    case 413:
      return 'Payload Too Large';
    case 429:
      return 'Too Many Requests';
    default:
      return 'Error';
  }
}

export function failure(statusCode: number, message: string): CapsFailure {
  return { statusCode, error: errorLabel(statusCode), message };
}

function sendFailure(reply: FastifyReply, f: CapsFailure): FastifyReply {
  return reply.code(f.statusCode).send(f);
}

// ─── Layer 1: Content-Length pre-read ────────────────────────────────────────

/** How often the streaming counter samples the socket's byte position. */
const BODY_CAP_POLL_MS = 100;
/** Grace period after the structured 413 so the client can read it before the reset. */
const POST_FAILURE_DESTROY_MS = 250;

/**
 * Route-level `onRequest` hook: refuse an over-declared body before reading,
 * then watch the live stream for a body that lied (or stated no
 * `Content-Length` at all) and destroy it at `MAX_BODY_BYTES`.
 *
 * Replying here stops the Fastify lifecycle (`reply.sent` is checked before
 * parsing and again before the handler), so the handler never runs for a
 * rejected body.
 *
 * The hook **must be `async`**: Fastify's hook runner only advances the
 * chain when the hook returns a thenable — a synchronous hook that returns
 * `undefined` stalls every request at the gate instead of failing it.
 */
/**
 * Reject-then-linger for the Content-Length pre-read.
 *
 * Rejecting before the body is read is correct, but *closing* before the client
 * has received that rejection is not: `close()` on a socket with unread
 * inbound data makes the kernel answer RST instead of FIN, and on loopback the
 * RST routinely outruns the 413 already sitting in the client's receive buffer
 * — the client sees `ECONNRESET`/`ECONNABORTED` and never learns why it was
 * rejected. Measured against the live stack: a full over-cap body in flight
 * lost the answer on **every** attempt across both transports (Playwright's
 * request API and a raw socket), so this is a product defect for any real
 * client, not merely an e2e artefact.
 *
 * The fix is to linger: consume and discard what the client is still sending
 * so the socket has nothing unread when we finally close, and only close once
 * the response has flushed AND (the upload has drained, or the linger window
 * expired). Cost is bounded twice — by time (`POST_FAILURE_DESTROY_MS`) and by
 * bytes (four times the cap) — so a hostile 10 GB declaration cannot make this
 * path read 10 GB; past either bound it stops reading and closes exactly as it
 * did before.
 *
 * The *decision* is still made purely from the declared header, before a single
 * byte is parsed — the pre-read's message and its guarantee are unchanged.
 */
function lingerBeforeClose(req: FastifyRequest, reply: FastifyReply, declared: number): void {
  const socket = req.raw.socket;
  const stream = req.raw;
  if (socket === null || socket === undefined) return;

  const byteLimit = MAX_BODY_BYTES * 4;
  let drained = 0;
  let flushed = false;
  let closed = false;
  let reading = true;

  const close = (): void => {
    if (closed || !flushed) return; // never close before the answer left the building
    closed = true;
    clearTimeout(timer);
    if (reading) stream.pause();
    if (!socket.destroyed) socket.destroy();
  };

  const timer = setTimeout(close, POST_FAILURE_DESTROY_MS);
  if (typeof timer.unref === 'function') timer.unref();

  reply.raw.on('finish', () => {
    flushed = true;
    close();
  });

  stream.on('data', (chunk: Buffer) => {
    if (!reading) return;
    drained += chunk.length;
    if (drained >= Math.min(declared, byteLimit)) {
      reading = false;
      stream.pause(); // bound reached — stop consuming, let the window close us
    }
  });
  stream.on('end', () => close()); // upload fully drained — safe to close
  stream.on('error', () => close());
  stream.on('close', () => close());
  stream.resume(); // discard, discard, discard — this is what makes close() a FIN
}

export async function bodyCaps(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const declared = req.raw.headers['content-length'];
  if (declared !== undefined) {
    const bytes = Number(declared);
    if (!Number.isFinite(bytes) || bytes > MAX_BODY_BYTES) {
      reply.header('connection', 'close');
      lingerBeforeClose(req, reply, bytes);
      sendFailure(
        reply,
        failure(
          413,
          `request body exceeds MAX_BODY_BYTES (${MAX_BODY_BYTES} bytes); rejected from the Content-Length pre-read before the body was read`,
        ),
      );
      return;
    }
  }
  watchStreamBytes(req, reply);
}

/**
 * Layer 2 — the streaming counter. `socket.bytesRead` is the connection's
 * running position, so the delta measured at this request counts exactly this
 * request's body (a keep-alive socket carries earlier exchanges too). The
 * interval is polled rather than fed by a `data` listener: attaching one to
 * the request stream would resume it before the multipart parser pipes it,
 * dropping bytes that arrive in between.
 */
function watchStreamBytes(req: FastifyRequest, reply: FastifyReply): void {
  const socket = req.raw.socket;
  if (socket === null || socket === undefined) return;
  const start = socket.bytesRead;

  const timer = setInterval(() => {
    // WR-05: `reply.sent` joins the guard — if the route (or a previous tick)
    // already answered, the watcher must never send a second reply.
    if (reply.sent || reply.raw.writableEnded || socket.destroyed) {
      clearInterval(timer);
      return;
    }
    if (socket.bytesRead - start <= MAX_BODY_BYTES) return;

    clearInterval(timer);
    reply.header('connection', 'close');
    sendFailure(
      reply,
      failure(
        413,
        `request body exceeds MAX_BODY_BYTES (${MAX_BODY_BYTES} bytes); the streaming counter destroyed the stream`,
      ),
    );
    // Stop reading the rest of the upload once the answer has been flushed —
    // but not before, or a reset could discard the 413 the client needs.
    reply.raw.on('finish', () => {
      setTimeout(() => {
        if (!socket.destroyed) socket.destroy();
      }, POST_FAILURE_DESTROY_MS).unref();
    });
  }, BODY_CAP_POLL_MS);

  timer.unref();
  reply.raw.on('close', () => clearInterval(timer));
}

// ─── Layer 2 (in-part): the byte counter over the part stream ───────────────

/** Raised by {@link BodyByteCounter} when the flowing bytes pass the body cap. */
export class BodyCapExceeded extends Error {
  constructor() {
    super(`request body exceeds MAX_BODY_BYTES (${MAX_BODY_BYTES} bytes)`);
    this.name = 'BodyCapExceeded';
  }
}

/** Raised locally when a part is cut off at the parser's file-size limit. */
export class RequestPartTooLargeError extends Error {
  constructor() {
    super(`image part exceeds MAX_IMAGE_PART_BYTES (${MAX_IMAGE_PART_BYTES} bytes)`);
    this.name = 'RequestPartTooLargeError';
  }
}

export class BodyByteCounter {
  private seen = 0;

  add(bytes: number): void {
    this.seen += bytes;
  }

  get bytes(): number {
    return this.seen;
  }

  get exceeded(): boolean {
    return this.seen > MAX_BODY_BYTES;
  }

  /**
   * A counting stage for `pipeline()`: every byte it forwards is counted and
   * the pipeline is aborted with {@link BodyCapExceeded} the moment the total
   * passes `MAX_BODY_BYTES` — the stream is torn down mid-flight, not after.
   */
  counting(): Transform {
    const counter = this;
    return new Transform({
      transform(chunk, _encoding, callback) {
        counter.add(chunk.length);
        if (counter.exceeded) callback(new BodyCapExceeded());
        else callback(null, chunk);
      },
    });
  }
}

// ─── Receiving the image part (stream → tmp → unlink) ───────────────────────

/** Structural shape of a multipart file part (avoids coupling to the plugin's types). */
export interface UploadPart {
  filename?: string;
  file: Readable & { truncated?: boolean };
}

export interface ReceivedImage {
  filename: string;
  bytes: Uint8Array;
}

/**
 * Stream one file part to a server-named tmp file while counting its bytes,
 * then read it back for the guards and **always unlink it** — on success, on a
 * parser rejection, and on a mid-stream body-cap abort. The name is
 * `randomUUID()`-generated, so no client value ever reaches a path (C-4).
 */
export async function receiveImagePart(
  part: UploadPart,
  counter: BodyByteCounter,
): Promise<ReceivedImage> {
  const tmpPath = join(tmpdir(), `watchbug-upload-${randomUUID()}.part`);
  try {
    await pipeline(part.file, counter.counting(), createWriteStream(tmpPath));
    // Pitfall 2: a cut-off image must never become a stored half file.
    if (part.file.truncated === true) throw new RequestPartTooLargeError();
    const bytes = await readFile(tmpPath);
    return { filename: part.filename ?? '', bytes };
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

// ─── Client filename rule (C-4) ─────────────────────────────────────────────

const TRAVERSAL_SEGMENT = /(^|[/\\])\.\.([/\\]|$)/;

/**
 * A client filename is metadata only: it never reaches a path, a header or a
 * stored key. Names that are *shaped* like an attack are rejected outright so
 * the attempt is visible instead of silently normalised away.
 */
export function validateClientFilename(filename: string): CapsFailure | null {
  const hostile =
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0') ||
    TRAVERSAL_SEGMENT.test(filename);
  if (!hostile) return null;
  return failure(
    400,
    `client filename ${JSON.stringify(filename)} is rejected: path separators, ".." segments and NUL bytes are never accepted (C-4) — the request never names a stored file`,
  );
}

// ─── Layer 3: multipart parser failures → structured bodies ─────────────────

function errorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
}

function errorStatus(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const status = (err as { statusCode?: unknown }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) return status;
  }
  return null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'request failed';
}

/**
 * Map a failure raised while receiving the multipart body onto the
 * structured body the e2e rows assert on. Returns `null` for anything that is
 * not a client-shaped caps failure, so the caller can rethrow it into the
 * application error handler (a 500 must stay a 500 server-side).
 */
export function mapMultipartError(err: unknown): CapsFailure | null {
  if (err instanceof BodyCapExceeded) return failure(413, err.message);
  if (err instanceof RequestPartTooLargeError) return failure(413, err.message);

  switch (errorCode(err)) {
    case 'FST_REQ_FILE_TOO_LARGE':
      return failure(
        413,
        `image part exceeds MAX_IMAGE_PART_BYTES (${MAX_IMAGE_PART_BYTES} bytes) at the multipart parser; nothing was stored`,
      );
    case 'FST_PARTS_LIMIT':
    case 'FST_FILES_LIMIT':
    case 'FST_FIELDS_LIMIT':
      return failure(
        413,
        `multipart limits exceeded (${MULTIPART_LIMITS.parts} parts, ${MULTIPART_LIMITS.files} file, ${MULTIPART_LIMITS.fields} fields); nothing was stored`,
      );
    default:
      break;
  }

  const status = errorStatus(err);
  if (status === null) return null;
  return failure(status, errorMessage(err));
}

/**
 * WR-05 — a stream aborted mid-body is a CLIENT-shaped failure, never an
 * unhandled 500: the streaming-413 watcher (or a dead socket) tears the
 * multipart iteration down with a premature-close/abort rejection. Used by
 * the route catch so such rejections are answered with the structured 413
 * naming `MAX_BODY_BYTES` instead of falling into `app.setErrorHandler`'s
 * 500 branch (false "unhandled error" logs + a second `reply.send`).
 */
export function isBodyAbort(err: unknown): boolean {
  switch (errorCode(err)) {
    case 'ERR_STREAM_PREMATURE_CLOSE':
    case 'ABORT_ERR':
    case 'ECONNRESET':
      return true;
    default:
      break;
  }
  const message = errorMessage(err).toLowerCase();
  return message.includes('aborted') || message.includes('premature close');
}
