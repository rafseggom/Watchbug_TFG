import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import type { AppConfig } from './config';
import type { AppDb } from './db/client';
import { seedProject } from './boot/seed';
import { MULTIPART_RECEIVE_OPTIONS } from './ingest/caps';
import type { Storage } from './ports';
import { registerIncidentsRoutes } from './routes/incidents';

/**
 * Composition root (R-02: one per process).
 *
 * Registers the plugin stack in defence order — helmet, the multipart parser
 * with the explicit A-06 receive limits — then the CA-01 routes and the
 * structured JSON error mapper. `trustProxy` stays at its configured default
 * (false) and must only ever be set explicitly — Pitfall 5.
 *
 * The `@fastify/rate-limit` and `@fastify/cors` plugins are registered by
 * plan **01-03** (ING-05 layered limiters, CORS origins); the error mapper
 * already maps their 429/400 shapes so that landing is a pure addition.
 *
 * The multipart limits themselves live in `ingest/caps.ts` (plan 01-02): that
 * module owns every layered size cap, so the parser ceiling and the
 * `Content-Length`/streaming-counter gates cannot drift apart (T-01-05,
 * Pitfall 1 — `bodyLimit` alone does not bound a multipart body).
 */

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
  await app.register(multipart, MULTIPART_RECEIVE_OPTIONS);

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
  app.setErrorHandler((err: unknown, _req, reply) => {
    const candidate = typeof err === 'object' && err !== null && 'statusCode' in err ? err.statusCode : undefined;
    const statusCode = typeof candidate === 'number' && candidate >= 400 && candidate < 500 ? candidate : 500;

    if (statusCode === 500) {
      // Log the real cause server-side; the client gets a generic body.
      console.error('[watchbug] unhandled error:', err);
      return reply.code(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'internal server error' });
    }

    const error = statusCode === 400 ? 'Bad Request' : statusCode === 401 ? 'Unauthorized'
      : statusCode === 404 ? 'Not Found' : statusCode === 413 ? 'Payload Too Large'
      : statusCode === 429 ? 'Too Many Requests' : 'Error';
    const message = err instanceof Error ? err.message : 'request failed';
    return reply.code(statusCode).send({ statusCode, error, message });
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'route not found' }),
  );

  return app;
}
