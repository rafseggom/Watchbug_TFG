import cors from '@fastify/cors';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config';

/**
 * ING-08 (T-01-13, A-11) — the `WATCHBUG_CORS_ORIGINS` origin allowlist with
 * the Origin-present rule (Pitfall 9).
 *
 * Two cooperating pieces:
 *
 *  1. `@fastify/cors` registration — the allowlist (parsed from
 *     `WATCHBUG_CORS_ORIGINS` into `config.corsOrigins` by `config.ts`)
 *     decides which origins get the CORS allow headers echoed back. A
 *     non-matching origin simply receives no `Access-Control-Allow-Origin`,
 *     which is what makes the *browser* refuse the response. An empty
 *     allowlist trusts **no** browser origin — it does not mean "all
 *     origins".
 *  2. `createOriginGate` — the enforcement preHandler: a **present** but
 *     non-allowlisted `Origin` gets a structured 403 before any meta/image
 *     work and before any `Storage.put` (nothing is stored). Requests with
 *     **no** `Origin` header — curl, server-side senders, P1-D-07's
 *     onboarding flow — are outside the browser CORS model and always pass.
 *
 * Chain position: registered in `app.ts` before the routes, and wired as the
 * route's second preHandler (`ingestRateLimit → originGate →
 * projectKeyGate`) — abuse limits first, then CORS, then the key lookup
 * (ordered ingest chain).
 */

/**
 * The Origin-present decision (Pitfall 9 / A-11): header-less clients always
 * pass; a browser origin must match `WATCHBUG_CORS_ORIGINS` exactly.
 */
export function originAllowlist(origin: string | undefined, allowlist: string[]): boolean {
  if (origin === undefined || origin === '') return true; // no Origin header → accepted by design
  return allowlist.includes(origin);
}

/**
 * Registers `@fastify/cors` with the env allowlist from config. Static
 * array origin → the plugin echoes only matching origins in
 * `Access-Control-Allow-Origin` and handles the OPTIONS preflight itself.
 */
export async function registerCors(app: FastifyInstance, config: AppConfig): Promise<void> {
  await app.register(cors, { origin: config.corsOrigins });
}

/**
 * The ING-08 enforcement rule as a preHandler. The presence check wraps the
 * allowlist comparison: only a request that *presents* an Origin can be
 * rejected, and rejection is the same structured 403 for every disallowed
 * origin (no echoing, no stored work).
 */
export function createOriginGate(
  config: AppConfig,
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const allowlist = config.corsOrigins; // config.ts parses WATCHBUG_CORS_ORIGINS (comma-separated)
  return async function originGate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const origin = req.headers.origin;
    if (origin !== undefined && !originAllowlist(origin, allowlist)) {
      reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'origin is not allowed by WATCHBUG_CORS_ORIGINS',
      });
      return;
    }
  };
}
