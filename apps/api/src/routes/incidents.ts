import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { MAX_BODY_BYTES, MAX_ENCODED_IMAGE_BYTES } from '@watchbug/contracts/constants';
import type { ImageExt, ReportMeta } from '@watchbug/contracts/types';
import { PROJECT_KEY_PATTERN, type AppConfig } from '../config';
import type { AppDb } from '../db/client';
import { incidents, projects } from '../db/schema';
import { validateMeta } from '../ingest/validate-meta';
import { sniffImage } from '../ingest/sniff';
import { assertDecodeSafe } from '../ingest/guard';
import { validateStructure } from '../ingest/structure';
import { hardenImage } from '../ingest/harden';
import { sanitizeAndValidate } from '../ingest/sanitize';
import {
  BodyByteCounter,
  BodyCapExceeded,
  bodyCaps,
  failure,
  isBodyAbort,
  mapMultipartError,
  receiveImagePart,
  validateClientFilename,
} from '../ingest/caps';
import type { Storage } from '../ports';

/**
 * CA-01 route surface (Task 2 Step 4).
 *
 * `POST /api/incidents` runs the ordered ingest chain — body caps (onRequest)
 * → rate limits → origin allowlist → project-key gate (preHandlers, in that
 * order) → multipart parse → client-filename rule → meta validate → semantic
 * size cap → sniff → structure → guard → re-encode → sanitize → `Storage.put`
 * → idempotent insert. Cheap guards first, the codec last: no hostile byte
 * ever reaches libvips without having passed the container and dimension
 * checks. The idempotency guarantee is the **database** unique index
 * `(project_id, idempotency_key)`, never an application-level
 * check-then-insert (ING-03, Pattern 4).
 *
 * ING-04 (T-01-14): the project-key gate is a **preHandler** — it runs after
 * the abuse limits but before any meta/image work and before any
 * `Storage.put`, so a rejected submission writes nothing. Missing, malformed
 * and unknown keys all produce the *same* structured 401 (no existence
 * oracle). The key is **write-only**: `GET` routes never consult it (H-7,
 * DEP-03 completes in Phase 5).
 *
 * `GET /api/incidents/:id/image` resolves the blob key **from the database
 * row only** — a request never names a file (R-04, C-4).
 *
 * CAP-03 (this phase): a submission that carries **no `image` part** is a
 * text-only report. The image pipeline (size cap → sniff → structure → guard
 * → harden) is skipped entirely and the row is stored with `storage_key` /
 * `content_type` NULL; the meta pipeline (validate → sanitise → re-validate),
 * the project-key gate and the idempotency conflict handling run exactly as
 * for an image-bearing report — an optional image never makes the ingest
 * pipeline optional (T-03-06). The blob route answers the same structured 404
 * shape it uses for "incident not found" and never hands a null key to the
 * `Storage` seam.
 */

const DAY_MS = 86_400_000;
const MAX_IDEMPOTENCY_KEY_CHARS = 256;

/** Server-side ext→MIME allowlist — the stored value never decides its own response headers. */
const CONTENT_TYPE_BY_EXT: Record<ImageExt, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
};

/**
 * The **one** inverse of `CONTENT_TYPE_BY_EXT`, derived from it at module
 * scope so the two mappings can never drift (Pitfall 8 — the binary-ternary
 * class that would store a JPEG as `image/webp`). The blob route reads `ext`
 * from here; with the P3-D-14 JPEG lane both directions carry `image/jpeg`,
 * and an unknown value still answers the structured 500 — never a guessed
 * MIME (T-03-09).
 */
const EXT_BY_CONTENT_TYPE: ReadonlyMap<string, ImageExt> = new Map(
  (Object.entries(CONTENT_TYPE_BY_EXT) as [ImageExt, string][]).map(([ext, mime]) => [mime, ext]),
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const MAX_LIST_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 100;

export interface RouteDeps {
  config: AppConfig;
  db: AppDb;
  storage: Storage;
  /**
   * The composed ING-05 preHandler (`plugins/rate-limit.ts`). It runs as the
   * route's **first** preHandler → before the project-key gate, so a
   * rejected key still consumes quota (limits → key → handler).
   */
  ingestRateLimit: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  readRateLimit?: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  /**
   * The ING-08 origin allowlist enforcement (`plugins/cors.ts`) → second
   * preHandler: abuse limits → CORS → key lookup → handler.
   */
  originGate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

interface ProjectRow {
  id: string;
}

/** Project row → id, or null (missing header and unknown key look identical from outside). */
async function findProject(db: AppDb, publicKey: string | undefined): Promise<ProjectRow | null> {
  if (publicKey === undefined || publicKey.trim() === '') return null;
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.publicKey, publicKey.trim()))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * The **one** 401 body any key failure produces (ING-04, T-01-14): missing,
 * malformed and unknown keys are indistinguishable byte-for-byte — the
 * response never reveals whether a key exists.
 */
function unauthorized(reply: FastifyReply): FastifyReply {
  return reply.code(401).send({
    statusCode: 401,
    error: 'Unauthorized',
    message: 'invalid or missing project key',
  });
}

/** Stash of the gate-resolved project id on the request (set only by `projectKeyGate`). */
const PROJECT_ID = Symbol('watchbug.projectId');
type GatedRequest = FastifyRequest & { [PROJECT_ID]?: string };

function badRequest(reply: FastifyReply, message: string): FastifyReply {
  return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message });
}

interface MultipartPayload {
  metaRaw?: string;
  imageBytes?: Uint8Array;
  clientFilename?: string;
}

/**
 * Stage 1–2: stream the multipart body, counting bytes and surfacing every
 * parser cap as the structured failure it already is. A reply that was
 * already sent (the streaming-413 watcher) is never followed by a second one.
 */
async function readMultipart(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<{ ok: true; payload: MultipartPayload } | { ok: false }> {
  const counter = new BodyByteCounter();
  const payload: MultipartPayload = {};

  try {
    for await (const part of req.parts()) {
      if (part.type === 'field' && part.fieldname === 'meta') {
        // `@fastify/multipart` JSON-parses any field whose Content-Type
        // starts with `application/json` — which is exactly what
        // `curl -F 'meta={...}'` (P1-D-07's onboarding snippet) sends — so
        // the value can arrive as an object. Re-stringify it here so
        // `validateMeta` always receives the raw JSON text; the previous
        // `String(part.value)` turned objects into `"[object Object]"` and
        // 400'd every JSON-typed meta part (deferred by 01-02, expires with
        // this plan's onboarding curl).
        payload.metaRaw = typeof part.value === 'string' ? part.value : JSON.stringify(part.value);
        counter.add(Buffer.byteLength(payload.metaRaw, 'utf8'));
      } else if (part.type === 'file' && part.fieldname === 'image') {
        // Streams to a server-named tmp file while counting the bytes;
        // the tmp file is unlinked here whatever happens next (ING-06,
        // Pitfall 2 — a cut-off part is rejected, never stored).
        const received = await receiveImagePart(part, counter);
        payload.clientFilename = received.filename;
        payload.imageBytes = received.bytes;
      }
    }
  } catch (err) {
    // WR-05 — the streaming-413 watcher owns the cap answer: if it already
    // replied (its structured 413, socket destroyed 250 ms after the
    // flush), the in-flight multipart iteration unwinds with a stream
    // abort in the reply's wake. Return WITHOUT a second send, and never
    // let such an abort reach the error handler's 500 branch.
    if (reply.sent) return { ok: false };
    const mapped = mapMultipartError(err);
    if (mapped === null) {
      if (isBodyAbort(err)) {
        reply
          .code(413)
          .send(failure(413, `request body aborted at MAX_BODY_BYTES (${MAX_BODY_BYTES} bytes); nothing was stored`));
        return { ok: false };
      }
      throw err;
    }
    if (err instanceof BodyCapExceeded) req.raw.destroy();
    reply.code(mapped.statusCode).send(mapped);
    return { ok: false };
  }

  return { ok: true, payload };
}

type ImageChainResult =
  | { ok: true; image: { bytes: Uint8Array; ext: ImageExt } | null }
  | { ok: false; statusCode: number; message: string };

/**
 * Stages 3–6 of the image lane, in the order the cheap guards demand:
 * semantic size cap → magic bytes → container structure → header dimensions →
 * root re-encode → post-encode size cap. No hostile byte reaches libvips
 * without the container and dimension checks, and the stored artifact is
 * re-capped with the same contract constant as the input (WR-02).
 */
async function hardenImageChain(imageBytes: Uint8Array | undefined): Promise<ImageChainResult> {
  if (imageBytes === undefined) return { ok: true, image: null };

  // A-06 semantic cap — checked on the bytes actually read, before any codec
  // work (the 4 MB multipart limit above it is only the parser guard).
  if (imageBytes.length > MAX_ENCODED_IMAGE_BYTES) {
    return {
      ok: false,
      statusCode: 413,
      message: `image is ${imageBytes.length} bytes; the contract allows at most ${MAX_ENCODED_IMAGE_BYTES} (MAX_ENCODED_IMAGE_BYTES)`,
    };
  }

  // Stage 2 — magic bytes only, never the client-declared Content-Type.
  const sniffed = sniffImage(imageBytes);
  if (sniffed === null) {
    return {
      ok: false,
      statusCode: 400,
      message: 'image is neither PNG, WebP nor JPEG (magic bytes); SVG, GIF and HTML are never accepted',
    };
  }

  // Stage 3 — container structure: chunk allowlists, no animation, no
  // trailing data; metadata chunks are dropped here (C-3, P1-D-11).
  const structure = validateStructure(imageBytes, sniffed);
  if (!structure.ok) return { ok: false, statusCode: 400, message: structure.message };

  // Stage 4 — dimensions from the header, before any pixel work.
  const guard = assertDecodeSafe(structure.bytes, sniffed);
  if (!guard.ok) return { ok: false, statusCode: guard.statusCode, message: guard.message };

  // Stage 5 — P1-D-10 root re-encode (sharp): decode → re-encode in the same
  // format (P1-D-12), metadata stripped, processing-time guarded. The bytes
  // that reach storage are libvips' output, not the submitted container.
  const hardened = await hardenImage(structure.bytes);
  if (!hardened.ok) return { ok: false, statusCode: hardened.statusCode, message: hardened.message };

  // A-06's 2 MB cap is a cap on the STORED artifact, not only on the input:
  // a low-quality noisy input well under the cap can re-encode to far more
  // (WR-02), and nothing downstream re-checks it — the blob route would
  // stream whatever size landed. Re-cap the hardened bytes with the same
  // contract constant and the same structured 413 body as the input cap.
  if (hardened.bytes.length > MAX_ENCODED_IMAGE_BYTES) {
    return {
      ok: false,
      statusCode: 413,
      message: `re-encoded image is ${hardened.bytes.length} bytes; the contract allows at most ${MAX_ENCODED_IMAGE_BYTES} (MAX_ENCODED_IMAGE_BYTES)`,
    };
  }

  return { ok: true, image: { bytes: hardened.bytes, ext: hardened.ext } };
}

interface PersistInput {
  projectId: string;
  idempotencyKey: string;
  meta: ReportMeta;
  storageKey: string | null;
  contentType: string | null;
  now: number;
  ttlIdentityDays: number;
  ttlArtifactDays: number;
}

type PersistResult =
  | { kind: 'created'; id: string }
  | { kind: 'replayed'; id: string }
  | { kind: 'race' };

/**
 * The idempotent insert, with the blob lifecycle WR-03 requires: the blob is
 * written before the row, so every conflict or insert failure deletes its own
 * unreferenced copy. The replay lookup is scoped to `(project_id,
 * idempotency_key)` — an unscoped lookup could return another project's row
 * once project CRUD lands (WR-01).
 */
async function persistIncident(db: AppDb, storage: Storage, input: PersistInput): Promise<PersistResult> {
  const { projectId, idempotencyKey, meta, storageKey, contentType, now } = input;
  const deleteOwnBlob = async (reason: string): Promise<void> => {
    if (storageKey === null) return;
    await storage.delete(storageKey).catch((cleanupErr) => {
      console.error(`[watchbug] ${reason} blob delete failed (WR-03):`, cleanupErr);
    });
  };

  let inserted: { id: string }[];
  try {
    inserted = await db
      .insert(incidents)
      .values({
        projectId,
        idempotencyKey,
        type: meta.type,
        title: meta.title,
        note: meta.note ?? null,
        url: meta.url ?? null,
        userId: meta.user?.id ?? null,
        userName: meta.user?.name ?? null,
        userEmail: meta.user?.email ?? null,
        identityPurgeAt: new Date(now + input.ttlIdentityDays * DAY_MS),
        artifactPurgeAt: new Date(now + input.ttlArtifactDays * DAY_MS),
        storageKey,
        contentType,
      })
      .onConflictDoNothing({ target: [incidents.projectId, incidents.idempotencyKey] })
      .returning({ id: incidents.id });
  } catch (err) {
    await deleteOwnBlob('orphaned');
    throw err;
  }

  if (inserted.length > 0) return { kind: 'created', id: inserted[0].id };

  // Replay: the uniqueness index won the race. The blob written for this
  // attempt (image-bearing submissions only — a meta-only replay wrote
  // nothing, CAP-03) is unreferenced. Best-effort cleanup (WR-03): a failed
  // delete must not fail the replay (a 500 + retry would only leak another
  // blob); it is logged for ops.
  await deleteOwnBlob('replay');
  const existing = await db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(eq(incidents.projectId, projectId), eq(incidents.idempotencyKey, idempotencyKey)))
    .limit(1);
  const id = existing[0]?.id;
  // The winner committed the unique row but vanished before we could read it
  // (impossible under READ COMMITTED, but never guess an id).
  return id === undefined ? { kind: 'race' } : { kind: 'replayed', id };
}

export async function registerIncidentsRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { db, storage, config } = deps;

  /**
   * ING-04 — the first write-side gate after the abuse limits: format check
   * against P1-D-03's own `PROJECT_KEY_PATTERN` (never a duplicated regex),
   * then a **parameterised** lookup of `projects.public_key` (never
   * string-built SQL). All three failure shapes — missing header, malformed
   * key, unknown key — fall through to the same `unauthorized()` body, so the
   * 401 doubles as no key-existence oracle. The resolved project id is
   * stashed on the request for the insert; the read endpoints never receive
   * it (the key authenticates ingest only — H-7, DEP-03).
   */
  const projectKeyGate = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const raw = req.headers['x-project-key'];
    const key = typeof raw === 'string' ? raw.trim() : '';
    if (key === '' || !PROJECT_KEY_PATTERN.test(key)) {
      unauthorized(reply);
      return;
    }
    const project = await findProject(db, key);
    if (project === null) {
      unauthorized(reply);
      return;
    }
    (req as GatedRequest)[PROJECT_ID] = project.id;
  };

  app.post(
    '/api/incidents',
    { onRequest: [bodyCaps], preHandler: [deps.ingestRateLimit, deps.originGate, projectKeyGate] },
    async (req, reply) => {
      const idempotencyKey = req.headers['idempotency-key'];
      if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
        return badRequest(
          reply,
          'Idempotency-Key header is required; retried submissions must reuse the same value (ING-03)',
        );
      }
      if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_CHARS) {
        return badRequest(reply, `Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_CHARS} characters`);
      }

      const parsed = await readMultipart(req, reply);
      if (!parsed.ok) return;

      // C-4 — the client filename is metadata only. Names shaped like an attack
      // are rejected before anything else looks at the payload.
      if (parsed.payload.clientFilename !== undefined) {
        const filenameFailure = validateClientFilename(parsed.payload.clientFilename);
        if (filenameFailure !== null) {
          return reply.code(filenameFailure.statusCode).send(filenameFailure);
        }
      }

      const meta = validateMeta(parsed.payload.metaRaw);
      if (!meta.ok) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'meta failed validation',
          issues: meta.issues,
        });
      }

      // ING-04's gate already ran (preHandler): the request carries the
      // project id it resolved with a parameterised lookup — nothing below
      // ever re-reads or re-checks the key.
      const projectId = (req as GatedRequest)[PROJECT_ID]!;

      // CAP-03 — no `image` part means a text-only report: the image chain
      // (semantic cap → sniff → structure → guard → harden → re-cap) is
      // skipped entirely and the row stores NULL storage/content-type.
      const chain = await hardenImageChain(parsed.payload.imageBytes);
      if (!chain.ok) {
        return reply.code(chain.statusCode).send(failure(chain.statusCode, chain.message));
      }

      // Stage 6 — plain-text sanitization, then re-validate the contract so
      // whatever reaches storage is guaranteed to validate (ENR-06).
      const cleanMeta = sanitizeAndValidate(meta.meta);
      if (cleanMeta === null) {
        return badRequest(reply, 'meta no longer validates after sanitization (e.g. a markup-only title)');
      }

      // The blob is written before the insert ONLY when there is an image to
      // write (CAP-03): a text-only report never touches the Storage seam.
      const storageKey =
        chain.image === null ? null : (await storage.put(chain.image.bytes, chain.image.ext, projectId)).key;

      const now = Date.now();
      const persisted = await persistIncident(db, storage, {
        projectId,
        idempotencyKey,
        meta: cleanMeta,
        storageKey,
        contentType: chain.image === null ? null : CONTENT_TYPE_BY_EXT[chain.image.ext],
        now,
        ttlIdentityDays: config.ttlIdentityDays,
        ttlArtifactDays: config.ttlArtifactDays,
      });

      if (persisted.kind === 'race') {
        return badRequest(reply, 'idempotent replay raced an in-flight insert; retry with the same key');
      }
      if (persisted.kind === 'replayed') {
        return reply.code(200).send({ id: persisted.id, replayed: true });
      }
      return reply.code(201).send({ id: persisted.id });
    },
  );

  const decodeCursor = (value: unknown): { id: string; createdAt: number } | null => {
    if (typeof value !== 'string' || value.length === 0) return null;
    try {
      const decoded = Buffer.from(value, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as { id?: unknown; createdAt?: unknown };
      if (typeof parsed.id !== 'string' || parsed.id.length === 0) return null;
      if (typeof parsed.createdAt !== 'number' || !Number.isInteger(parsed.createdAt) || parsed.createdAt <= 0) return null;
      return { id: parsed.id, createdAt: parsed.createdAt };
    } catch {
      return null;
    }
  };

  const encodeCursor = (id: string, createdAt: Date): string =>
    Buffer.from(JSON.stringify({ id, createdAt: createdAt.getTime() }), 'utf8').toString('base64url');

  app.get(
    '/api/incidents',
    { preHandler: deps.readRateLimit ? [deps.readRateLimit] : undefined },
    async (req, reply) => {
      // H-7 / DEP-03: the project key is WRITE-ONLY — it authenticates ingest
      // and is never consulted by a read endpoint (Phase 5's AuthProvider gates
      // reads; until then the read surface is deliberately ungated and the
      // deployment is loopback-bound — recorded DEP-03 seam).

      const query = req.query as { limit?: string; cursor?: string };
      let limit = DEFAULT_LIST_LIMIT;
      if (typeof query.limit === 'string') {
        const parsed = Number.parseInt(query.limit, 10);
        if (Number.isNaN(parsed) || parsed < 1) {
          return badRequest(reply, 'limit must be a positive integer');
        }
        if (parsed > MAX_LIST_LIMIT) {
          return badRequest(reply, `limit must be <= ${MAX_LIST_LIMIT}`);
        }
        limit = parsed;
      }

      const cursor = decodeCursor(query.cursor);
      if (typeof query.cursor === 'string' && cursor === null) {
        return badRequest(reply, 'cursor is malformed');
      }

      const candidateRows = cursor
        ? await db
            .select()
            .from(incidents)
            .where(
              or(
                lt(incidents.createdAt, new Date(cursor.createdAt)),
                and(
                  eq(incidents.createdAt, new Date(cursor.createdAt)),
                  lt(incidents.id, cursor.id),
                ),
              ),
            )
            .orderBy(desc(incidents.createdAt), desc(incidents.id))
            .limit(limit + 1)
        : await db
            .select()
            .from(incidents)
            .orderBy(desc(incidents.createdAt), desc(incidents.id))
            .limit(limit + 1);

      const data = candidateRows.slice(0, limit).map(toListRow);
      const next = candidateRows.length > limit ? encodeCursor(candidateRows[limit].id, candidateRows[limit].createdAt) : null;
      if (next !== null) {
        reply.header('x-next-cursor', next);
      }
      return reply.send(data);
    },
  );

  app.get('/api/incidents/:id/image', {
    preHandler: deps.readRateLimit ? [deps.readRateLimit] : undefined,
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'incident not found',
    });

    const rows = await db
      .select({ storageKey: incidents.storageKey, contentType: incidents.contentType })
      .from(incidents)
      .where(eq(incidents.id, id))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'incident not found' });
    }

    // CAP-03: a text-only row has no screenshot. Answer the same structured
    // 404 shape this route already uses for "incident not found" — never 500,
    // never an empty 200 stream — and never hand a null key to the Storage
    // seam (the one invariant, `storageKey === null`, read here and by the
    // skip guard in purge.ts).
    if (row.storageKey === null) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'incident has no stored screenshot',
      });
    }

    // One allowlist, read in both directions (Pitfall 8): ext is derived from
    // the stored content type through the SAME map the insert used, never a
    // second ternary. An unknown (or null-beside-a-key — corruption) value
    // answers the structured 500 BEFORE any file access (T-03-09).
    const ext = row.contentType === null ? undefined : EXT_BY_CONTENT_TYPE.get(row.contentType);
    if (ext === undefined) {
      // The CHECK constraint makes this unreachable; if it ever fires the row
      // is corrupt — refuse rather than guess a content type.
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'stored content type is not on the server-side allowlist',
      });
    }

    // DB-lookup-only key resolution: the key in the row was server-generated
    // at insert; the request never contributed a path segment (R-04, C-4).
    // The path safety itself is delegated to `FsStorage.stream`, which applies
    // `STORAGE_KEY_REGEX` and then `path.resolve` + a volume-root prefix
    // assertion before any file access — belt and braces on top of the key
    // being server-generated.
    const stream = await storage.stream(row.storageKey);

    return reply
      .header('Content-Type', CONTENT_TYPE_BY_EXT[ext])
      .header('X-Content-Type-Options', 'nosniff')
      // Fixed ASCII name: header injection through a stored filename is not possible.
      .header('Content-Disposition', `attachment; filename="screenshot.${ext}"`)
      .header('Content-Security-Policy', "default-src 'none'; sandbox")
      .header('Cross-Origin-Resource-Policy', 'same-origin')
      .header('Cache-Control', 'private, max-age=3600')
      .send(stream);
  });
}

/** List projection: the storage key, project and idempotency internals never leave the server. */
function toListRow(row: typeof incidents.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    note: row.note,
    url: row.url,
    user:
      row.userId === null && row.userName === null && row.userEmail === null
        ? null
        : { id: row.userId, name: row.userName, email: row.userEmail },
    status: row.status,
    contentType: row.contentType,
    createdAt: row.createdAt.toISOString(),
  };
}
