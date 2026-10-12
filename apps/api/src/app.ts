import Fastify, { type FastifyInstance } from 'fastify';

/**
 * Composition root (R-02: one per process).
 *
 * Phase-1 Step 0 (Q-08 tooling gate) ships the minimal Fastify 5 boot with the
 * health route so the pinned `fastify@5.12.5` + `tsx@4.23.15` toolchain is
 * proven before any ingest code exists. Steps 3-4 register the plugin stack
 * (multipart / helmet / cors / rate-limit), the DB client and the routes here.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    // trustProxy is deliberately left at its default (false) and must only ever
    // be set explicitly and documented — see Pitfall 5 (spoofable X-Forwarded-For).
    trustProxy: false,
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  return app;
}
