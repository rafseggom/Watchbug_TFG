import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { MAX_ENCODED_IMAGE_BYTES } from '@watchbug/contracts/constants';
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
 */

const DAY_MS = 86_400_000;
const MAX_IDEMPOTENCY_KEY_CHARS = 256;

/** Server-side ext→MIME allowlist — the stored value never decides its own response headers. */
const CONTENT_TYPE_BY_EXT: Record<string, string> = { png: 'image/png', webp: 'image/webp' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface RouteDeps {
  config: AppConfig;
  db: AppDb;
  storage: Storage;
  /**
   * The composed ING-05 preHandler (`plugins/rate-limit.ts`). It runs as the
   * route's **first** preHandler — before the project-key gate, so a
   * rejected key still consumes quota (limits → key → handler).
   */
  ingestRateLimit: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  /**
   * The ING-08 origin allowlist enforcement (`plugins/cors.ts`) — second
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

    const counter = new BodyByteCounter();
    let metaRaw: string | undefined;
    let imageBytes: Uint8Array | undefined;
    let clientFilename: string | undefined;

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
          metaRaw = typeof part.value === 'string' ? part.value : JSON.stringify(part.value);
          counter.add(Buffer.byteLength(metaRaw, 'utf8'));
        } else if (part.type === 'file' && part.fieldname === 'image') {
          // Streams to a server-named tmp file while counting the bytes;
          // the tmp file is unlinked here whatever happens next (ING-06,
          // Pitfall 2 — a cut-off part is rejected, never stored).
          const received = await receiveImagePart(part, counter);
          clientFilename = received.filename;
          imageBytes = received.bytes;
        }
      }
    } catch (err) {
      const mapped = mapMultipartError(err);
      if (mapped === null) throw err;
      if (err instanceof BodyCapExceeded) req.raw.destroy();
      return reply.code(mapped.statusCode).send(mapped);
    }

    // C-4 — the client filename is metadata only. Names shaped like an attack
    // are rejected before anything else looks at the payload.
    if (clientFilename !== undefined) {
      const filenameFailure = validateClientFilename(clientFilename);
      if (filenameFailure !== null) {
        return reply.code(filenameFailure.statusCode).send(filenameFailure);
      }
    }

    const meta = validateMeta(metaRaw);
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

    if (imageBytes === undefined) return badRequest(reply, 'the "image" part is missing');

    // A-06 semantic cap — checked on the bytes actually read, before any
    // codec work (the 4 MB multipart limit above it is only the parser guard).
    if (imageBytes.length > MAX_ENCODED_IMAGE_BYTES) {
      return reply.code(413).send(
        failure(
          413,
          `image is ${imageBytes.length} bytes; the contract allows at most ${MAX_ENCODED_IMAGE_BYTES} (MAX_ENCODED_IMAGE_BYTES)`,
        ),
      );
    }

    // Stage 2 — magic bytes only, never the client-declared Content-Type.
    const sniffed = sniffImage(imageBytes);
    if (sniffed === null) {
      return badRequest(
        reply,
        'image is neither PNG nor WebP (magic bytes); SVG, GIF and HTML are never accepted',
      );
    }

    // Stage 3 — container structure: chunk allowlists, no animation, no
    // trailing data; metadata chunks are dropped here (C-3, P1-D-11).
    const structure = validateStructure(imageBytes, sniffed);
    if (!structure.ok) return badRequest(reply, structure.message);

    // Stage 4 — dimensions from the header, before any pixel work.
    const guard = assertDecodeSafe(structure.bytes, sniffed);
    if (!guard.ok) return reply.code(guard.statusCode).send({
      statusCode: guard.statusCode,
      error: 'Bad Request',
      message: guard.message,
    });

    // Stage 5 — P1-D-10 root re-encode (sharp): decode → re-encode in the same
    // format (P1-D-12), metadata stripped, processing-time guarded. The bytes
    // that reach storage are libvips' output, not the submitted container.
    const hardened = await hardenImage(structure.bytes);
    if (!hardened.ok) {
      return reply.code(hardened.statusCode).send({
        statusCode: hardened.statusCode,
        error: 'Bad Request',
        message: hardened.message,
      });
    }

    // A-06's 2 MB cap is a cap on the STORED artifact, not only on the input:
    // a low-quality noisy input well under the cap can re-encode to far more
    // (WR-02), and nothing downstream re-checks it — the blob route would
    // stream whatever size landed. Re-cap the hardened bytes with the same
    // contract constant and the same structured 413 body as the input cap.
    if (hardened.bytes.length > MAX_ENCODED_IMAGE_BYTES) {
      return reply.code(413).send(
        failure(
          413,
          `re-encoded image is ${hardened.bytes.length} bytes; the contract allows at most ${MAX_ENCODED_IMAGE_BYTES} (MAX_ENCODED_IMAGE_BYTES)`,
        ),
      );
    }

    // Stage 6 — plain-text sanitization, then re-validate the contract so
    // whatever reaches storage is guaranteed to validate (ENR-06).
    const cleanMeta = sanitizeAndValidate(meta.meta);
    if (cleanMeta === null) {
      return badRequest(reply, 'meta no longer validates after sanitization (e.g. a markup-only title)');
    }

    const { key } = await storage.put(hardened.bytes, hardened.ext, projectId);

    const now = Date.now();
    const inserted = await db
      .insert(incidents)
      .values({
        projectId,
        idempotencyKey,
        type: cleanMeta.type,
        title: cleanMeta.title,
        note: cleanMeta.note ?? null,
        url: cleanMeta.url ?? null,
        userId: cleanMeta.user?.id ?? null,
        userName: cleanMeta.user?.name ?? null,
        userEmail: cleanMeta.user?.email ?? null,
        identityPurgeAt: new Date(now + config.ttlIdentityDays * DAY_MS),
        artifactPurgeAt: new Date(now + config.ttlArtifactDays * DAY_MS),
        storageKey: key,
        contentType: hardened.ext === 'png' ? 'image/png' : 'image/webp',
      })
      .onConflictDoNothing({ target: [incidents.projectId, incidents.idempotencyKey] })
      .returning({ id: incidents.id });

    if (inserted.length === 0) {
      // Replay: the uniqueness index won the race. The blob written for this
      // attempt is unreferenced — delete it, then serve the original id.
      await storage.delete(key);
      // WR-01: the conflict is detected on `(project_id, idempotency_key)`,
      // so the replay lookup MUST be scoped to the same pair — an unscoped
      // lookup could return a DIFFERENT project's incident with the same
      // client-chosen key once project CRUD lands (Phase 5): a wrong replay
      // id and a cross-tenant disclosure.
      const existing = await db
        .select({ id: incidents.id })
        .from(incidents)
        .where(and(eq(incidents.projectId, projectId), eq(incidents.idempotencyKey, idempotencyKey)))
        .limit(1);
      const id = existing[0]?.id;
      if (id === undefined) {
        // The winner committed the unique row but vanished before we could
        // read it (impossible under READ COMMITTED, but never guess an id).
        return badRequest(reply, 'idempotent replay raced an in-flight insert; retry with the same key');
      }
      return reply.code(200).send({ id, replayed: true });
    }

    return reply.code(201).send({ id: inserted[0].id });
  });

  app.get('/api/incidents', async (_req, reply) => {
    // H-7 / DEP-03: the project key is WRITE-ONLY — it authenticates ingest
    // and is never consulted by a read endpoint (Phase 5's AuthProvider gates
    // reads; until then the read surface is deliberately ungated and the
    // deployment is loopback-bound — recorded DEP-03 seam).
    const rows = await db.select().from(incidents).orderBy(desc(incidents.createdAt));
    return reply.send(rows.map(toListRow));
  });

  app.get('/api/incidents/:id/image', {
    // This route declares its own hardened header set (plan Step 4); helmet's
    // global pass would *duplicate* X-Content-Type-Options ("nosniff, nosniff").
    config: { helmet: false },
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

    // DB-lookup-only key resolution: the key in the row was server-generated
    // at insert; the request never contributed a path segment (R-04, C-4).
    // The path safety itself is delegated to `FsStorage.stream`, which applies
    // `STORAGE_KEY_REGEX` and then `path.resolve` + a volume-root prefix
    // assertion before any file access — belt and braces on top of the key
    // being server-generated.
    const stream = await storage.stream(row.storageKey);

    const ext = row.contentType === 'image/webp' ? 'webp' : row.contentType === 'image/png' ? 'png' : null;
    const mime = ext === null ? null : CONTENT_TYPE_BY_EXT[ext];
    if (mime === null || ext === null) {
      // The CHECK constraint makes this unreachable; if it ever fires the row
      // is corrupt — refuse rather than guess a content type.
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'stored content type is not on the server-side allowlist',
      });
    }

    return reply
      .header('Content-Type', mime)
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
