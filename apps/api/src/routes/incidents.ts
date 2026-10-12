import type { FastifyInstance, FastifyReply } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import type { AppConfig } from '../config';
import type { AppDb } from '../db/client';
import { incidents, projects } from '../db/schema';
import { validateMeta } from '../ingest/validate-meta';
import { sniffImage } from '../ingest/sniff';
import { assertDecodeSafe } from '../ingest/guard';
import { hardenImage } from '../ingest/harden';
import { sanitizeAndValidate } from '../ingest/sanitize';
import type { Storage } from '../ports';

/**
 * CA-01 route surface (Task 2 Step 4).
 *
 * `POST /api/incidents` runs the ordered ingest chain — multipart parse → meta
 * validate → project-key lookup → sniff → guard → harden → sanitize →
 * `Storage.put` → idempotent insert — cheap guards first, codecs never (the
 * structural harden backend does not decode). The idempotency guarantee is the
 * **database** unique index `(project_id, idempotency_key)`, never an
 * application-level check-then-insert (ING-03, Pattern 4).
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
}

interface ProjectRow {
  id: string;
}

/** Project key → row, or null (missing header and unknown key look identical from outside). */
async function findProject(db: AppDb, publicKey: string | undefined): Promise<ProjectRow | null> {
  if (publicKey === undefined || publicKey.trim() === '') return null;
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.publicKey, publicKey.trim()))
    .limit(1);
  return rows[0] ?? null;
}

function unauthorized(reply: FastifyReply): FastifyReply {
  return reply.code(401).send({
    statusCode: 401,
    error: 'Unauthorized',
    message: 'X-Project-Key is missing or does not match a known project',
  });
}

function badRequest(reply: FastifyReply, message: string): FastifyReply {
  return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message });
}

export async function registerIncidentsRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { db, storage, config } = deps;

  app.post('/api/incidents', async (req, reply) => {
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

    let metaRaw: string | undefined;
    let imageBytes: Uint8Array | undefined;

    for await (const part of req.parts()) {
      if (part.type === 'field' && part.fieldname === 'meta') {
        metaRaw = String(part.value);
      } else if (part.type === 'file' && part.fieldname === 'image') {
        // Bounded by the multipart `fileSize` limit (413 via throwFileSizeLimit).
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk as Buffer);
        imageBytes = Buffer.concat(chunks);
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

    const project = await findProject(db, req.headers['x-project-key'] as string | undefined);
    if (project === null) return unauthorized(reply);

    if (imageBytes === undefined) return badRequest(reply, 'the "image" part is missing');

    // Stage 2 — magic bytes only, never the client-declared Content-Type.
    const sniffed = sniffImage(imageBytes);
    if (sniffed === null) {
      return badRequest(
        reply,
        'image is neither PNG nor WebP (magic bytes); SVG, GIF and HTML are never accepted',
      );
    }

    // Stage 3 — dimensions from the header, before any pixel work.
    const guard = assertDecodeSafe(imageBytes, sniffed);
    if (!guard.ok) return reply.code(guard.statusCode).send({
      statusCode: guard.statusCode,
      error: 'Bad Request',
      message: guard.message,
    });

    // Stage 4 — structural strip/rebuild: metadata chunks dropped, CRCs verified.
    const hardened = hardenImage(imageBytes);
    if (!hardened.ok) {
      return reply.code(hardened.statusCode).send({
        statusCode: hardened.statusCode,
        error: 'Bad Request',
        message: hardened.message,
      });
    }

    // Stage 5 — plain-text sanitization, then re-validate the contract so
    // whatever reaches storage is guaranteed to validate (ENR-06).
    const cleanMeta = sanitizeAndValidate(meta.meta);
    if (cleanMeta === null) {
      return badRequest(reply, 'meta no longer validates after sanitization (e.g. a markup-only title)');
    }

    const { key } = await storage.put(hardened.bytes, hardened.ext, project.id);

    const now = Date.now();
    const inserted = await db
      .insert(incidents)
      .values({
        projectId: project.id,
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
      const existing = await db
        .select({ id: incidents.id })
        .from(incidents)
        .where(eq(incidents.idempotencyKey, idempotencyKey))
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

  app.get('/api/incidents', async (req, reply) => {
    // The panel (same-origin, Phase-5 auth later) may list without a key on a
    // single-project instance; a *wrong* key is still rejected loudly.
    const rawKey = req.headers['x-project-key'];
    if (rawKey !== undefined) {
      const project = await findProject(db, rawKey as string);
      if (project === null) return unauthorized(reply);
      const rows = await db
        .select()
        .from(incidents)
        .where(eq(incidents.projectId, project.id))
        .orderBy(desc(incidents.createdAt));
      return reply.send(rows.map(toListRow));
    }
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
