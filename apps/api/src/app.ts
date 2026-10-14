import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import type { AppConfig } from './config';
import type { AppDb } from './db/client';
import { seedProject } from './boot/seed';
import { MULTIPART_RECEIVE_OPTIONS } from './ingest/caps';
import { createOriginGate, registerCors } from './plugins/cors';
import { createIngestRateLimit, createReadRateLimit, resolveIngestRateLimits } from './plugins/rate-limit';
import type { Storage } from './ports';
import { startPurge } from './purge';
import { registerIncidentsRoutes } from './routes/incidents';
import { registerSetupRoutes } from './routes/setup';

/**
 * Composition root (R-02: one per process).
 *
 * Registers the plugin stack in defence order — helmet, the multipart parser
 * with the explicit A-06 receive limits (the caps layer), then
 * `@fastify/rate-limit` with `global: false` (ING-05: no route is limited
 * implicitly — only the three manual ingest limiters built below), then the
 * CA-01 routes whose preHandler chain is `ingestRateLimit → origin allowlist
 * → project-key gate → handler`, and the structured JSON error mapper.
 * `trustProxy` stays at its configured default (false) and must only ever be
 * set explicitly — Pitfall 5. CR-02: the secure explicit value is a TRUST
 * LIST (the compose nginx edge + the local loopback entry), never blanket
 * `true`; with a list, `req.ip` (the per-IP limiter's key) is the first
 * UNTRUSTED `X-Forwarded-For` entry, so a client-forged entry can never own
 * the bucket — blanket `true` would take the attacker-controlled leftmost.
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
  // ING-05 (T-01-12): manual limiters only — `global: false` means no route
  // is rate-limited implicitly; the ingest route wires its own composed
  // `ingestRateLimit` preHandler below (registered before the routes, so the
  // `createRateLimit` decorator exists at build time — caps → rate limits →
  // CORS → route handlers).
  await app.register(rateLimit, { global: false });
  // ING-08 (T-01-13): `@fastify/cors` with the WATCHBUG_CORS_ORIGINS
  // allowlist from config — registered before the routes (chain position:
  // caps → rate limits → CORS → route handlers).
  await registerCors(app, config);

  app.get('/api/health', async (_req, reply) => {
    try {
      await pingDb();
    } catch {
      return reply.code(503).send({ statusCode: 503, error: 'Service Unavailable', message: 'database is unreachable' });
    }
    return { status: 'ok' };
  });

  // P1-D-07 onboarding: the panel's empty state pre-fills its copy-paste curl
  // with this instance's public write-only project key (T-01-16: one field,
  // derived from config, nothing else).
  registerSetupRoutes(app, config);

  // Idempotent boot-time project seed (P1-D-01) — safe to run on every boot.
  await seedProject(db, config.projectKey);

  // Three composed limiters (per key / per IP / per project per day), maxima
  // from config — empty env values fall back to the contracts constants.
  const ingestRateLimit = createIngestRateLimit(
    app,
    resolveIngestRateLimits({
      perKeyPerMin: config.rateLimitPerKeyPerMin,
      perIpPerMin: config.rateLimitPerIpPerMin,
      perProjectPerDay: config.rateLimitPerProjectPerDay,
    }),
  );

  const readRateLimit = createReadRateLimit(
    app,
    config.rateLimitPerIpPerMin,
  );

  await registerIncidentsRoutes(app, {
    config,
    db,
    storage,
    ingestRateLimit,
    readRateLimit,
    originGate: createOriginGate(config),
  });

  // S-2: TTL purge job (RET-01, RET-02) — in-process, no cron sidecar
  // (INV-03). Boot sweep is fire-and-forget; the timer is `unref()`-ed and
  // cleared on close so it never keeps the process (or a test) alive.
  const purge = startPurge({
    db,
    storage,
    intervalMinutes: config.purgeIntervalMinutes,
  });
  app.addHook('onClose', async () => {
    purge.stop();
  });

  /**
   * Structured error mapper: every client-visible failure is
   * `{ statusCode, error, message }` JSON — no stack traces, no internal
   * messages from foreign errors leaking to the client.
   */
  app.setErrorHandler((err: unknown, _req, reply) => {
    // WR-05: if a reply was already sent (the streaming-413 watcher answers
    // independently of the route lifecycle), this is the in-flight request
    // unwinding in the reply's wake — never log it as an unhandled error and
    // never attempt a second `reply.send` on the sent reply.
    if (reply.sent) return;

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
