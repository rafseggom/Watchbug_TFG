import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { MAX_IMAGE_PART_BYTES } from '@watchbug/contracts/constants';
import type { AppConfig } from './config';
import type { AppDb } from './db/client';
import { seedProject } from './boot/seed';
import type { Storage } from './ports';
import { registerIncidentsRoutes } from './routes/incidents';

/**
 * Composition root (R-02: one per process).
 *
 * Registers the plugin stack in defence order — helmet, CORS (scoped to the
 * configured origins), the multipart parser with the explicit A-06 receive
 * limits, rate limiting (SEC-05) — then the CA-01 routes and the structured
 * JSON error mapper. `trustProxy` is deliberately left at its configured
 * default (false) and must only ever be set explicitly — Pitfall 5.
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

export interface AppDeps {
  config: AppConfig;
  db: AppDb;
  /** Ping used by `GET /api/health`; the e2e global-setup relies on it. */
  pingDb(): Promise<void>;
  storage: Storage;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, db, pingDb, storage } = deps;

  const app = Fastify({
    logger: false,
    trustProxy: config.trustProxy,
  });

  await app.register(helmet);
  // Same-origin in the shipped compose topology (A-10); explicit origins are
  // CORS defence-in-depth for out-of-compose dev only (SEC-05).
  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
  });
  await app.register(multipart, {
    limits: MULTIPART_LIMITS,
    throwFileSizeLimit: true,
  });
  await app.register(rateLimit, {
    global: true,
    max: config.rateLimitPerIpPerMin,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
    // A rate-limit breach is a structured client error, not a 500.
    errorResponseBuilder: (req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `rate limit exceeded; retry in ${context.after}`,
    }),
  });

  app.get('/api/health', async (_req, reply) => {
    try {
      await pingDb();
    } catch {
      return reply.code(503).send({ statusCode: 503, error: 'Service Unavailable', message: 'database is unreachable' });
    }
    return { status: 'ok' };
  });

  // Idempotent boot-time project seed (P1-D-01) — safe to run on every boot.
  await seedProject(db, config.projectKey);

  await registerIncidentsRoutes(app, { config, db, storage });

  /**
   * Structured error mapper: every client-visible failure is
   * `{ statusCode, error, message }` JSON — no stack traces, no internal
   * messages from foreign errors leaking to the client.
   */
  app.setErrorHandler((err, _req, reply) => {
    const statusCode =
      typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500
        ? err.statusCode
        : 500;

    if (statusCode === 500) {
      // Log the real cause server-side; the client gets a generic body.
      console.error('[watchbug] unhandled error:', err);
      return reply.code(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'internal server error' });
    }

    const error = statusCode === 400 ? 'Bad Request' : statusCode === 401 ? 'Unauthorized'
      : statusCode === 404 ? 'Not Found' : statusCode === 413 ? 'Payload Too Large'
      : statusCode === 429 ? 'Too Many Requests' : 'Error';
    return reply.code(statusCode).send({ statusCode, error, message: err.message });
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'route not found' }),
  );

  return app;
}
