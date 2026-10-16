---
phase: 01-contracts-ingest-slice
plan: 01
subsystem: monorepo
tags: [walking-skeleton, contracts, ingest, compose, e2e]
dependency_graph:
  requires: []
  provides: [CA-01-contract, ingest-chain, compose-stack, size-gate, e2e-suite, drizzle-schema]
  affects: [01-02, 01-03, 01-04]
tech_stack:
  added: ["@types/node 24.19.2 (A-13)", "@types/react 19.3.0", "@types/react-dom 19.3.0", "@types/pg 8.23.1", "@types/sanitize-html 2.16.2"]
  patterns: ["npm-workspaces monorepo", "esbuild one-format-per-call dual builds", "zero-dep structural image harden", "DB-enforced idempotency"]
key_files:
  created:
    - packages/contracts/src/{constants,schema,types}.ts
    - schema/report.schema.json
    - packages/sdk/scripts/build.mjs
    - apps/api/src/routes/incidents.ts
    - apps/api/src/ingest/{validate-meta,sniff,guard,harden,sanitize}.ts
    - apps/api/src/storage/fs-storage.ts
    - apps/api/drizzle/0000_grey_the_santerians.sql
    - apps/panel/src/{App.tsx,api.ts,tokens.css}
    - scripts/{check-size,check-compose}.mjs
    - e2e/{deploy,ingest}.spec.ts
    - SKELETON.md
  modified:
    - docker-compose.yml
    - .env.example
    - apps/api/src/{app,index,config}.ts
    - apps/panel/nginx.conf
    - package.json
decisions:
  - "A-13: five type-only @types/* devDependencies owner-approved to make npm run lint pass (question gate; recorded in resolution-record.md)"
  - "Q-08 tooling gate PASS under typescript 7.0.2 — the documented 6.x fallback was not taken"
  - "rate-limit and cors plugins deferred to plan 01-03 per the plan's own artifact table (ING-05 is 01-03's requirement)"
  - "hardening backend for 01-01 is the zero-dep structural strip/rebuild (P1-D-10 fallback); sharp stays 01-02's checkpoint"
  - "Storage.put(bytes, ext, projectId) — the on-disk layout mandates the projectId segment (deviation vs research sketch put(bytes, ext))"
actuals:
  tokens: 71775
  tasks: 3
  commits: 16
  plan_head_before: d2dd6c240d4235f3bd3976a1d763107eaf19317e
  plan_head_after: 3757285a1c6717a29376023b4a7be88ea496204f
metrics:
  duration: 01:45:00
  completed: 2026-10-12
status: complete
---

# Phase 1 Plan 1: Walking Skeleton Summary

**Walking Skeleton landed in 16 commits:** one `docker compose up` brings up
db + api + panel, a multipart report crosses the wire into schema-validated
PostgreSQL with its image hardened and stored under a server-generated key on
the api-only volume, replays idempotently, and renders in the two-column panel —
proven by the single Playwright suite **39/39 green on chromium + firefox +
webkit**, plus `check:size`, `check:compose`, `npm run build` and `npm run lint`
all passing.

## What was built

- **Contracts (CA-01 single source):** `constants.ts` carries the full A-06 set
  with zero Zod import (SDK-safe), `schema.ts` a `z.strictObject` reportSchema,
  and `scripts/emit-schema.mjs` emits the committed `schema/report.schema.json`
  via native `z.toJSONSchema` (the deprecated `zod-to-json-schema` never added).
- **SDK shell:** 6 esbuild artifacts (IIFE + ESM × core / lazy-editor /
  optional-adapter), `SHADOW_MODE: 'closed'` define, zero runtime deps.
- **Compose stack:** exactly three pinned services, loopback-only published
  ports, nginx same-origin proxy (A-10), api-only attachments volume, api boots
  by applying the committed migration first (clean `docker compose up` has
  schema with no manual step).
- **API:** fail-fast `config.ts` (missing/empty/placeholder/malformed project
  key all exit non-zero naming the variable and `.env`), boot-time idempotent
  project seed, the five ordered ingest stages, `FsStorage` (server-generated
  keys, tmp → fsync → rename, path-containment asserted twice), the CA-01
  routes with DB-enforced idempotency and the hardened image header set.
- **Panel:** light/dark design tokens (no hardcoded colours), two-column
  list/detail, text-node-only rendering, same-origin `fetch`.
- **Gates + suite (R-12):** `check:size` (three lanes + the A-12 worst-case
  45+25+14 = 84 > 80 KB printed every run), `check:compose`, and the one
  Playwright suite covering DEP-01/DEP-02/ING-01/ING-03/ENR-06 including the
  fail-fast boot contracts, artifact-level byte sniffs, and both SEC-05 passes.

## Verification results

| Gate | Result |
|---|---|
| `npm run build` | PASS (4 workspaces) |
| `npm run check:size` | PASS — worst-case 84>80 KB printed (A-12) |
| `npm run check:compose` | PASS — 3 services, volume api-only |
| `npm run verify` | **PASS 39/39** (chromium, firefox, webkit) |
| `npm run lint` | PASS (after A-13 type packages) |
| `db:generate` drift check | PASS — "No schema changes" |
| Live chain smoke (pre-e2e) | PASS 14/14 assertions incl. concurrent race |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Compose db volume layout rejected by Postgres 18**
- **Found during:** Task 2, first `docker compose up db`
- **Issue:** the volume mounted at `/var/lib/postgresql/data`; the postgres:18
  image rejects that layout on restart (it wants the single parent mount).
  Also `127.0.0.1:5432` collided with a host Postgres already listening.
- **Fix:** volume → `/var/lib/postgresql`; db port → `127.0.0.1:5433`
  (the plan only mandates loopback ports for panel and api; the db publish is
  host-tooling convenience). `.env.example` updated.
- **Files modified:** `docker-compose.yml`, `.env.example`
- **Commit:** `eb432a5`

**2. [Rule 1 - Bug] API bound loopback inside the container → nginx 502**
- **Found during:** Task 2 Step 6 stack bring-up
- **Issue:** `index.ts` listened on `127.0.0.1`; the panel nginx proxies to
  `api:3000` over the container network, so every proxied request 502'd.
- **Fix:** new documented `WATCHBUG_HOST` setting (default `127.0.0.1` for
  host dev; compose api sets `0.0.0.0`). Registered in `.env.example` and
  covered by the deploy spec's env-documentation test.
- **Files modified:** `apps/api/src/config.ts`, `apps/api/src/index.ts`,
  `docker-compose.yml`, `.env.example`
- **Commit:** `21d4511`

**3. [Rule 1 - Bug] Duplicated `X-Content-Type-Options` at two layers**
- **Found during:** e2e run
- **Issue:** the API's own `nosniff` plus the server-level nginx `add_header`
  produced `nosniff, nosniff`; the blob route would also double it with
  helmet's global pass.
- **Fix:** `proxy_hide_header X-Content-Type-Options` in the nginx `/api/`
  location (the API already sets it), and `config: { helmet: false }` on the
  image route whose explicit hardened header set the plan specifies.
- **Files modified:** `apps/panel/nginx.conf`, `apps/api/src/routes/incidents.ts`
- **Commit:** `21d4511`

**4. [Rule 2 - Scope] rate-limit and cors plugins landed early, then removed**
- **Found during:** e2e run (429s broke the suite) against the plan's own
  artifact table, which assigns `rate-limit`/`cors` to plan **01-03** (ING-05).
- **Fix:** removed both registrations from `app.ts` and the route-level
  per-key limiter; the structured error mapper keeps mapping 429 so 01-03's
  landing is additive. `@fastify/rate-limit`/`@fastify/cors` remain installed
  pins (Task-1 approved set) awaiting 01-03.
- **Files modified:** `apps/api/src/app.ts`, `apps/api/src/routes/incidents.ts`
- **Commit:** `21d4511`

### Scope additions (outside `files_modified`, documented here)

- **`SKELETON.md`** — named in the plan's Output line but assigned to no task;
  written at close-out as the skeleton's run/layout/chain reference.
- **`packages/sdk/scripts/build.mjs`** — the plan lists only the 3 SDK source
  files, but Step 2 explicitly requires a build script (esbuild is a CLI dep;
  the build needed a driver). Committed in `543e960`.
- **`package-lock.json`** — regenerated by `npm install`/`npm ci` runs
  (committed with Step 0 and the A-13 type packages).
- **`apps/panel/src/vite-env.d.ts`** — one-line `vite/client` types reference
  so the `tokens.css` side-effect import typechecks.
- **`e2e/make-fixtures.mjs`** — the one-shot generator used to produce the two
  committed fixtures with chromium's own encoders (provenance: WebP fixture is
  `canvas.toBlob('image/webp')`, which the webkit project then exercises
  against its runtime fallback path).
- **`documentation/resolution-record.md`** — A-13 amendment recording the
  owner-approved type-only devDependencies (owner explicitly requested the
  decision be registered).

### Design notes vs research sketches

- **`Storage.put(bytes, ext, projectId)`** takes `projectId` — the mandated
  on-disk layout `blobs/<projectId>/<xx>/<uuid>.<ext>` needs the segment (the
  research sketch was `put(bytes, ext)`); documented in `ports.ts`.
- **multipart `fieldSize: 4096` vs `MAX_META_BYTES` 65536** — the plan's
  T-01-05 limit values cap the `meta` field part at 4 KB while the contract
  allows 64 KB. Kept the plan's explicit values (Phase-1 synthetic meta is
  tiny; a >4 KB meta returns a clean multipart 413 rather than a schema 400).
  **Flagged for 01-02:** raise `fieldSize` to `MAX_META_BYTES` or document the
  narrower wire cap.
- **`main()` wrapper in `index.ts`** — top-level `await` collided with
  esbuild's `--target=es2020` (Rule 1 fix, commit `9c9aa68` era).
- **Fail-fast before listen** — `loadConfig()` runs before `buildApp()`, so a
  bad key never even seeds the DB (stronger than the plan's "exits at boot").

## Package gate (Task 1)

The `blocking-human` legitimacy gate approved exactly the 17 npm pins + 3
image tags; approval recorded in `78396dc`. One **additional** install
happened later — the five type-only `@types/*` packages — via an explicit
`question` gate answered by the owner ("Selecciona la opción 1 … deja
constancia"), recorded as **A-13** in `documentation/resolution-record.md`
and committed in `d9ba7a7`. No other package was added; `sharp` remains
01-02's own checkpoint.

## Known Stubs

None. (The rate-limit and CORS registrations are **plan-split**, not stubs —
they belong to 01-03 by the plan's own artifact table; the config values they
will read are already loaded and documented.)

## Deferred items

- **`fieldSize` 4096 vs `MAX_META_BYTES` 65536** inconsistency — resolve in 01-02.
- **Rate limiting + CORS** — plan 01-03 (ING-05).
- **Node 24 maintenance re-pin** (A-13 predecessor A-09 note): Node 24 enters
  maintenance 2026-10-20; schedule the `node:24.x` image re-pin.
- **Package-lock** drift is maintained by hand edits only — no Dependabot.

## Self-Check: PASSED

- FOUND: packages/contracts/src/constants.ts, schema/report.schema.json,
  apps/api/src/routes/incidents.ts, apps/api/drizzle/0000_grey_the_santerians.sql,
  scripts/check-size.mjs, scripts/check-compose.mjs, e2e/deploy.spec.ts,
  e2e/ingest.spec.ts, SKELETON.md
- FOUND: all 16 commit hashes present in `git log` (78396dc…3757285)
- Ledger measured: `commits: 16`, `plan_head_before: d2dd6c2…`, `plan_head_after: 3757285…`
