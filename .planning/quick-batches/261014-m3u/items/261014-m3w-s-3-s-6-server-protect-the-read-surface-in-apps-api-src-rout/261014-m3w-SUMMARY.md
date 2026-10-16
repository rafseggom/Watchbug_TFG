---
phase: 261014-m3u
plan: 1
type: execute
wave: 2
status: complete
tags:
  - rate-limit
  - pagination
  - read-surface
  - e2e
key-files:
  created:
    - e2e/read-surface.spec.ts
  modified:
    - apps/api/src/plugins/rate-limit.ts
    - apps/api/src/app.ts
    - apps/api/src/routes/incidents.ts
    - e2e/ingest.spec.ts
metrics:
  duration: 0
  completed: 2026-10-14T00:00:00Z
actuals:
  tokens: 0
  tasks: 1
  commits: 1
plan_head_before: e60d55f4b67acb5e83b41e925f50f27cfe58a455
plan_head_after: b1799e7f394dde73fe93d713660b28008d3a72b5
---

# Phase 261014-m3u Plan 1: Protect read surface in apps/api/src/routes

**One-liner:** Per-IP read rate limit + bounded keyset pagination; read GET routes now throttled and list bounded.

## What Changed

- **apps/api/src/plugins/rate-limit.ts**: added `createReadRateLimit` returning per-IP limiter (separate bucket from ingest). Uses existing retry-after helper.
- **apps/api/src/app.ts**: wire `readRateLimit` via `createReadRateLimit(app, config.rateLimitPerIpPerMin)` and pass to routes.
- **apps/api/src/routes/incidents.ts**: add `readRateLimit` preHandler to both `GET /api/incidents` and `GET /api/incidents/:id/image`. Paginate `GET /api/incidents` with `limit` (default 100, max 200), keyset cursor (`?cursor`) encoded base64url `{id,createdAt}`, return `x-next-cursor` on next page. Import `lt,or` from drizzle-orm. Keep reads unauthenticated per plan.
- **e2e/read-surface.spec.ts** (new): tests read 429 with integer Retry-After; bounded list with x-next-cursor; malformed limit/cursor return 400.
- **e2e/ingest.spec.ts**: eviction-proofed the final assertion to check id presence instead of global count.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run lint`: passed (typecheck across workspaces).
- Tests added/adjusted per plan. No unit tests introduced (R-12).

## Self-Check: PASSED

- Created `e2e/read-surface.spec.ts` exists.
- Modified files typechecked cleanly.
- Commit `b1799e7` exists.
