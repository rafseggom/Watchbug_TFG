import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  RATE_LIMIT_PER_KEY_PER_MIN,
  RATE_LIMIT_PER_IP_PER_MIN,
  RATE_LIMIT_PER_PROJECT_PER_DAY,
} from '@watchbug/contracts/constants';
import { PROJECT_KEY_PATTERN } from '../config';

/**
 * ING-05 / SEC-05 (T-01-12) — the three composed ingest limiters.
 *
 * `@fastify/rate-limit` is registered with `global: false` in `app.ts`
 * (nothing is limited implicitly); this module builds the three **manual**
 * limiters via `fastify.createRateLimit()` and composes them into one
 * `preHandler` that runs as the route's first preHandler — before the
 * project-key gate, so a rejected key still consumes quota (RESEARCH
 * Pattern 6, ordered chain `rate limits → CORS → key lookup → … → write`).
 *
 * Dimensions (each env-configurable, defaults from
 * `packages/contracts/src/constants.ts` — R-18 single source, no literals):
 *
 *   - `RATE_LIMIT_PER_KEY_PER_MIN`  — per `x-project-key` value, per minute
 *   - `RATE_LIMIT_PER_IP_PER_MIN`   — per resolved client IP, per minute
 *   - `RATE_LIMIT_PER_PROJECT_PER_DAY` — per `x-project-key` value, per day
 *
 * Store: the plugin's in-memory store — the only option under INV-03 (a
 * Redis store would be a fourth container; STACK.md's rejected list). The
 * documented caveat: counters are process-local, so the daily quota is
 * **best-effort across restarts** (single-node self-hosting — Pitfall 5).
 *
 * IP identity comes from `req.ip`, which honours `X-Forwarded-For` only for
 * TRUSTED hops: `WATCHBUG_TRUST_PROXY` is a TRUST LIST (CR-02 — the compose
 * nginx edge, which OVERWRITES the header with `$remote_addr`, plus the
 * local loopback entry the verify suite needs), never blanket `true`:
 * blanket trust would resolve `req.ip` from the attacker-controlled
 * LEFTMOST entry and make this limiter spoofable. Behind a NAT every user
 * behind the shared egress IP still shares one bucket; both caveats are
 * documented in `.env.example`.
 */

export interface IngestRateLimits {
  perKeyPerMin: number;
  perIpPerMin: number;
  perProjectPerDay: number;
}

/**
 * Effective maxima: the configured value, falling back to the binding
 * contract constant. `config.ts` applies the same constants as its
 * empty-value defaults, so an unset `WATCHBUG_RATE_LIMIT_*` lands on
 * exactly `RATE_LIMIT_PER_KEY_PER_MIN` / `RATE_LIMIT_PER_IP_PER_MIN` /
 * `RATE_LIMIT_PER_PROJECT_PER_DAY` from `@watchbug/contracts/constants`.
 */
export function resolveIngestRateLimits(configured?: Partial<IngestRateLimits>): IngestRateLimits {
  return {
    perKeyPerMin: configured?.perKeyPerMin ?? RATE_LIMIT_PER_KEY_PER_MIN,
    perIpPerMin: configured?.perIpPerMin ?? RATE_LIMIT_PER_IP_PER_MIN,
    perProjectPerDay: configured?.perProjectPerDay ?? RATE_LIMIT_PER_PROJECT_PER_DAY,
  };
}

/**
 * `Retry-After`: an integer count of **whole seconds**, the ceiling of the
 * remaining window with a minimum of 1 — never 0 (that would tell the
 * client to retry instantly) and never fractional.
 */
export function retryAfterSeconds(ttlInSeconds: number): number {
  return Math.max(1, Math.ceil(ttlInSeconds));
}

/**
 * Per-IP rate limiter for unauthenticated read endpoints (GET routes).
 * Uses the same in-memory store per factory call; shared bucket across
 * routes that use the same limiter instance.
 */
export function createReadRateLimit(
  app: FastifyInstance,
  maxPerMinute: number,
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const byIp = app.createRateLimit({
    max: maxPerMinute,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  return async function readRateLimit(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const ipStatus = await byIp(req);
    if (ipStatus.isAllowed) return;
    reply.header('retry-after', String(retryAfterSeconds(ipStatus.ttlInSeconds)));
    reply
      .code(429)
      .send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `rate limit exceeded: RATE_LIMIT_PER_IP_PER_MIN (${maxPerMinute} per IP per minute)`,
      });
  };
}

/**
 * Builds the composed `preHandler`. Every request increments **all three**
 * counters before the handler can run (the concurrency guarantee: at most
 * `max` requests pass a window even under a parallel burst); if one or more
 * dimensions are exceeded, the first in the documented order answers with a
 * structured 429 + `retry-after`.
 */
export function createIngestRateLimit(
  app: FastifyInstance,
  limits: IngestRateLimits,
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  /**
   * CR-01 — the bucket key must be normalized EXACTLY like the ING-04 gate
   * normalizes it (`raw.trim()` + `PROJECT_KEY_PATTERN`), or whitespace
   * padding (e.g. an NBSP byte the HTTP parser keeps) is accepted by the gate
   * as the same project while minting a fresh bucket per padding — unlimited
   * per-key/per-day quota from one public key. Anything that cannot be a real
   * project key shares ONE bucket, so garbage keys never get free quota either.
   */
  const projectKeyOf = (req: FastifyRequest): string => {
    const raw = req.headers['x-project-key'];
    const key = (typeof raw === 'string' ? raw : '').trim();
    return PROJECT_KEY_PATTERN.test(key) ? key : '';
  };

  const byKey = app.createRateLimit({
    max: limits.perKeyPerMin,
    timeWindow: '1 minute',
    keyGenerator: projectKeyOf,
  });
  const byIp = app.createRateLimit({
    max: limits.perIpPerMin,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });
  const byDay = app.createRateLimit({
    max: limits.perProjectPerDay,
    timeWindow: '1 day',
    keyGenerator: projectKeyOf,
  });

  return async function ingestRateLimit(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Increment all three first, then decide — a request rejected by one
    // dimension still consumes quota in the other two.
    const keyStatus = await byKey(req);
    const ipStatus = await byIp(req);
    const dayStatus = await byDay(req);

    const exceeded =
      !keyStatus.isAllowed && keyStatus.isExceeded
        ? { status: keyStatus, name: 'RATE_LIMIT_PER_KEY_PER_MIN', max: limits.perKeyPerMin, scope: 'per project key per minute' }
        : !ipStatus.isAllowed && ipStatus.isExceeded
          ? { status: ipStatus, name: 'RATE_LIMIT_PER_IP_PER_MIN', max: limits.perIpPerMin, scope: 'per IP per minute' }
          : !dayStatus.isAllowed && dayStatus.isExceeded
            ? { status: dayStatus, name: 'RATE_LIMIT_PER_PROJECT_PER_DAY', max: limits.perProjectPerDay, scope: 'per project per day' }
            : null;
    if (exceeded === null) return;

    reply.header('retry-after', String(retryAfterSeconds(exceeded.status.ttlInSeconds)));
    reply
      .code(429)
      .send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `rate limit exceeded: ${exceeded.name} (${exceeded.max} ${exceeded.scope})`,
      });
  };
}
