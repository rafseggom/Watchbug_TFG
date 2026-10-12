import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { MAX_IMAGE_PART_BYTES } from '@watchbug/contracts/constants';

/**
 * Composition root (R-02: one per process).
 *
 * Step 0 (P1-D-09 multipart smoke) registers `@fastify/multipart` 10.1.2 with
 * the explicit A-06 receive limits and proves a `meta` + `image` FormData parses
 * before any ingest endpoint exists (T-01-05). Steps 3-4 add the rest of the
 * plugin stack, the DB client and the real routes.
 */

/**
 * The T-01-05 mitigation: multipart limits are declared explicitly because
 * `bodyLimit` alone does not bound a multipart body (Pitfall 1) — each part type
 * gets its own ceiling and `throwFileSizeLimit` aborts the oversized upload.
 */
export const MULTIPART_LIMITS = {
  files: 1,
  fileSize: MAX_IMAGE_PART_BYTES,
  fields: 8,
  fieldSize: 4096,
  headerPairs: 1024,
  parts: 16,
} as const;

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    // trustProxy is deliberately left at its default (false) and must only ever
    // be set explicitly and documented — see Pitfall 5 (spoofable X-Forwarded-For).
    trustProxy: false,
  });

  await app.register(multipart, {
    limits: MULTIPART_LIMITS,
    throwFileSizeLimit: true,
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  // Registered only for the Step-0 smoke run (WATCHBUG_SMOKE=1) so the shipped
  // route surface is exactly the CA-01 endpoints from Step 4 — no probe route
  // survives into the committed skeleton.
  if (process.env.WATCHBUG_SMOKE === '1') {
    app.post('/api/_smoke/multipart', async (req, reply) => {
      let meta: string | undefined;
      let imageBytes = 0;
      let imageMime = '';

      for await (const part of req.parts()) {
        if (part.type === 'field') {
          if (part.fieldname === 'meta') meta = String(part.value);
        } else if (part.fieldname === 'image') {
          imageMime = part.mimetype;
          // Buffering is bounded by `fileSize` — @fastify/multipart aborts with
          // 413 as soon as the limit is crossed (throwFileSizeLimit).
          for await (const chunk of part.file) imageBytes += (chunk as Buffer).length;
        }
      }

      if (meta === undefined) return reply.code(400).send({ error: 'meta part missing' });
      return { meta, imageBytes, imageMime };
    });
  }

  return app;
}
