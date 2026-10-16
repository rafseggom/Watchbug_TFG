import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config';

/**
 * P1-D-07 onboarding support — `GET /api/setup` returns `{ projectKey }` so
 * the panel's empty state can pre-fill its copy-paste `curl` with the
 * instance's real key.
 *
 * T-01-16 (mitigated): the key returned here is the **public, write-only**
 * capability by H-7/DEP-03 semantics — it gates ingest writes and never reads,
 * and an ingest attempt already reveals it to anyone who can reach the
 * endpoint's callers. This route returns exactly that one field and nothing
 * else (no config, no database rows); the deployment is loopback-bound in
 * this phase, and Phase 5 replaces onboarding with real auth.
 *
 * Deliberately no rate limiter of its own: the response is a constant string
 * derived from config — there is no per-request work to throttle, and ING-05's
 * limiters are scoped to the ingest route they protect.
 */
export function registerSetupRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/setup', async (_req, reply) => reply.send({ projectKey: config.projectKey }));
}
