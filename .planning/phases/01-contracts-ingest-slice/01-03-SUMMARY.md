---
phase: 01-contracts-ingest-slice
plan: 03
subsystem: api
tags: [ingest-gatekeeping, project-key-authz, rate-limiting, cors-origin-allowlist, fastify-plugins, e2e, tdd]

# Dependency graph
requires:
  - phase: 01-02
    provides: ordered ingest chain (caps → multipart → validate → key → guards → re-encode → Storage), hostile.spec.ts group, structured error mapper that already understands 429
provides:
  - "ING-04 project-key gate: uniform byte-identical structured 401 for missing/malformed/unknown keys, zero writes, read surface untouched (write-only key, DEP-03 seam)"
  - "ING-05 three composed rate limiters (per key 1/min, per IP 1/min, per project 1/day) with inclusive boundaries and integer Retry-After ≥ 1"
  - "ING-08 WATCHBUG_CORS_ORIGINS allowlist with the Origin-present rule (403 for browser origins off the list, no-Origin clients accepted)"
  - "apps/api/src/plugins/{rate-limit,cors}.ts — reusable limiter/origin modules + `.env.example` knob documentation with the Pitfall 5 caveats"
affects: [01-04, 01-05, 01-06]

# Actuals (#2632) — pairs with the plan's `estimate`
actuals:
  tokens: 16227
  tasks: 3
  commits: 6
  plan_head_before: 773e940fe6ac9fa0a4038c4ba004328dce412532
  plan_head_after: 800fa0aa149aefe67de071e5155f35aac9642836

# Tech tracking
tech-stack:
  added: ["@fastify/rate-limit 11.2.0 wired (global: false + three createRateLimit() manual limiters)", "@fastify/cors 11.3.0 wired (static array origin from config)"]
  patterns:
    - "preHandler chain on the ingest route: bodyCaps (onRequest) → ingestRateLimit → originGate → projectKeyGate → handler — limits before CORS before key before any write"
    - "manual limiters increment ALL dimensions before deciding, so a rejected request consumes every quota"
    - "one uniform error body per failure class (no existence oracle): 401 'invalid or missing project key'"
    - "e2e boundary rows derive their maxima from the same `.env` the api reads and isolate one limiter per row (fresh keys / fresh forwarded IPs)"

key-files:
  created:
    - apps/api/src/plugins/rate-limit.ts
    - apps/api/src/plugins/cors.ts
    - .planning/phases/01-contracts-ingest-slice/01-03-red-evidence-task{1,2,3}.json
  modified:
    - apps/api/src/routes/incidents.ts
    - apps/api/src/app.ts
    - .env.example
    - e2e/hostile.spec.ts

key-decisions:
  - "e2e rate-limit maxima are 1200/min per key, 600/min per IP, 2000/day (local .env only): byKey and byDay share one bucket identity, so a single-key burst trips min(K,D) — D > K keeps the per-key boundary provable, D < 2K keeps the daily row to a single 65s window wait. Production defaults (10/30/2000) stay in config/.env.example."
  - "the daily-quota e2e row batches exactly perKeyPerMin requests per minute-window with a 65s pause between batches (the only honest way to reach D+1 while the per-key window stays legal); sanity-throw helpers fail loud if a future .env edit inverts the ordering"
  - "all three limiters increment before any 429 decision (the research sketch early-returns): a request rejected by one dimension still consumes the other two quotas"
  - "the origin allowlist is enforced as the route's second preHandler (limits → CORS → key), while @fastify/cors itself is registered app-level for headers + OPTIONS preflight — matches PATTERNS' `preHandler: [contentLengthGate, ingestRateLimit, corsAllowlist]` skeleton"
  - "GET /api/incidents no longer consults X-Project-Key at all (plan task 1: the key authenticates ingest only; wrong-key-on-read 401 was removed, recorded DEP-03 seam until Phase 5)"

requirements-completed: [ING-04, ING-05, ING-08]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "ING-04 project-key gate — uniform structured 401 for missing/unknown/malformed keys, parameterised lookup, zero writes, parallel-burst edge"
    requirement: ING-04
    verification:
      - kind: e2e
        ref: "e2e/hostile.spec.ts#ING-04 trio + ING-04 concurrency (3 browsers, 48/48 hostile group)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ING-05 three composed limiters with inclusive boundaries, integer Retry-After ≥ 1, env-configurable maxima and documented trust-proxy/NAT/restart caveats"
    requirement: ING-05
    verification:
      - kind: e2e
        ref: "e2e/hostile.spec.ts#ING-05 per key / per IP / per day (3 browsers)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ING-08 origin allowlist — disallowed Origin 403 + nothing stored, allowlisted Origin 201 + ACAO echo, no-Origin accepted, mixed parallel burst independence"
    requirement: ING-08
    verification:
      - kind: e2e
        ref: "e2e/hostile.spec.ts#ING-08 trio + ING-08 concurrency (3 browsers)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`.env.example` documents WATCHBUG_RATE_LIMIT_* / WATCHBUG_TRUST_PROXY / WATCHBUG_CORS_ORIGINS with loopback defaults and the spoofing/NAT/best-effort caveats"
    requirement: ING-05
    verification:
      - kind: e2e
        ref: "e2e/deploy.spec.ts#every env var read by apps/api/src/config.ts is documented in .env.example (in the 87/87 full-suite run) + grep of the four knobs"
        status: pass
    human_judgment: false
  - id: D5
    description: "plugin/preHandler wiring — rate-limit registered with global: false before the routes, chain order limits → CORS → key → handler"
    verification:
      - kind: other
        ref: "grep: 'register(rateLimit, { global: false })' app.ts:55, 'preHandler: [deps.ingestRateLimit, deps.originGate, projectKeyGate]' incidents.ts:139 + full suite 87/87"
        status: pass
    human_judgment: false

metrics:
  duration: 37min
  completed: 2026-10-12
status: complete
---

# Phase 1 Plan 3: Ingest Gatekeeping Summary

**The ingest endpoint now rejects keyless/invalid-key submissions with one byte-identical
structured 401, throttles per project key / per IP / per project per day with
429 + integer `Retry-After` (inclusive boundaries, all env-tunable), and accepts
browser submissions only from `WATCHBUG_CORS_ORIGINS` — while header-less curl
clients keep working.** The hostile group grew from 9 to 16 rows × 3 browsers and
the full suite went **66/66 → 87/87**, with `check:size`, `check:compose`,
`npm run build` and `npm run lint` all green.

## Performance

- **Duration:** 37 min
- **Started:** 2026-10-12T19:34:42Z
- **Completed:** 2026-10-12T20:12Z
- **Tasks:** 3 (all `tdd="true"`, full RED → GREEN each)
- **Files modified:** 10 (9 in the plan diff + this SUMMARY)

## Accomplishments

- **Task 1 (RED → GREEN):** `projectKeyGate` preHandler — P1-D-03's own
  `PROJECT_KEY_PATTERN` for the malformed check (no duplicated regex), a
  parameterised `projects.public_key` lookup, and one uniform 401 body
  (`{401, Unauthorized, 'invalid or missing project key'}`) for missing,
  malformed and unknown keys alike. The gate runs before any meta/image work
  and before `Storage.put`, so a rejected request writes nothing; the GET list
  no longer consults the key at all (write-only key, DEP-03).
- **Task 2 (RED → GREEN):** `plugins/rate-limit.ts` — `@fastify/rate-limit`
  registered with `global: false`, three `createIngestRateLimit()` manual
  limiters (`byKey` 1 min, `byIp` 1 min, `byDay` 1 day) composed into the
  route's **first** preHandler; `retryAfterSeconds()` = whole-second ceiling,
  minimum 1. Maxima default to the contracts constants and are overridden by
  `WATCHBUG_RATE_LIMIT_*`; `WATCHBUG_TRUST_PROXY` and the NAT / in-memory
  restart caveats are documented in `.env.example`.
- **Task 3 (RED → GREEN):** `plugins/cors.ts` — `originAllowlist()` decision
  helper (no-`Origin` always passes, Pitfall 9), `@fastify/cors` registered
  with the `config.corsOrigins` array (ACAO echoed only for matches), and
  `originGate` as the route's second preHandler returning a structured 403
  for present-but-disallowed origins — nothing stored.

## Task Commits

Each task was committed atomically (TDD: RED → GREEN; REFACTOR not needed):

1. **Task 1 (RED): uniform project-key 401 rows** - `f73fe77` (test)
2. **Task 1 (GREEN): project-key gate preHandler** - `128d314` (feat)
3. **Task 2 (RED): three rate-limit boundary rows** - `6694422` (test)
4. **Task 2 (GREEN): three composed limiters + Retry-After** - `6d576ed` (feat)
5. **Task 3 (RED): origin trio + mixed-burst rows** - `861a875` (test)
6. **Task 3 (GREEN): origin allowlist + originGate** - `800fa0a` (feat)

**Plan metadata:** *(this commit)*

## Files Created/Modified

- `apps/api/src/plugins/rate-limit.ts` — **new**: `resolveIngestRateLimits`
  (config → contracts-constant fallbacks), `retryAfterSeconds`, and
  `createIngestRateLimit` composing `byKey`/`byIp`/`byDay` into one preHandler
  that increments all three, then answers with the first exceeded dimension's
  structured 429 + `retry-after`.
- `apps/api/src/plugins/cors.ts` — **new**: `originAllowlist` (Origin-present
  rule), `registerCors` (`@fastify/cors` with `config.corsOrigins`),
  `createOriginGate` (structured 403 preHandler).
- `apps/api/src/routes/incidents.ts` — `projectKeyGate` + uniform 401;
  preHandler chain `[ingestRateLimit, originGate, projectKeyGate]`; key lookup
  removed from the handler and from `GET /api/incidents`.
- `apps/api/src/app.ts` — registers `@fastify/rate-limit` (`global: false`)
  then `registerCors`, builds both gates from config, passes them to the
  routes (order: caps → rate limits → CORS → route handlers).
- `.env.example` — `WATCHBUG_CORS_ORIGINS` set to the compose loopback
  defaults with the Origin-present rule explained; rate-limit block gains the
  in-memory-restart and NAT caveats; `WATCHBUG_TRUST_PROXY` gains the
  "compose sets true, nginx is the only edge" rationale.
- `e2e/hostile.spec.ts` — +7 rows (ING-04 trio + concurrency burst, ING-05 ×3
  boundary rows, ING-08 trio + mixed burst) with `.env`-derived boundaries and
  one-limiter-per-row isolation.
- `.planning/phases/01-contracts-ingest-slice/01-03-red-evidence-task{1,2,3}.json`
  — persisted RED records, each verdict `RED_EVIDENCE_OK`.

## Decisions Made

- **e2e maxima 1200/600/2000 and a batched daily row.** `byKey` and `byDay`
  are keyed on the same header value, so a single-key burst always trips
  `min(per-key, per-day)` — the plan's example values (50/200/200) can prove
  the per-key and per-IP boundaries but can never isolate the daily dimension
  inside one minute window. Ordering `per-day > per-key` keeps the per-key
  boundary row honest, and `per-day < 2 × per-key` keeps the daily row to
  exactly one 65 s window wait (batches of `per-key` requests, pause, then the
  `D+1` probe). Sanity-throw helpers in the spec fail loud if a future `.env`
  edit inverts the ordering. Production defaults are untouched.
- **Increment-then-decide.** All three limiters run for every request before
  any 429 is composed (the research sketch early-returns) — a request
  rejected by one dimension still consumes the other two quotas, which is the
  literal "counters are incremented before the handler runs" guarantee.
- **CORS as a route preHandler, `@fastify/cors` app-level.** The ordered
  chain (limits → CORS → key) and "limits as the route's first preHandler"
  are both satisfied by wiring `originGate` between them; the plugin itself
  only provides the allow-header/preflight behavior at the composition root.
- **GET list is fully ungated.** Task 1's action text ("the key must never be
  consulted by the read endpoints") removed the previous wrong-key 401 on
  `GET /api/incidents`; no suite row depended on it (verified by grep).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's example e2e values cannot prove all three rate-limit dimensions**
- **Found during:** Task 2 (designing the per-day boundary row against the
  plan's `byKey`/`byDay` keyGenerators — both keyed on `x-project-key`).
- **Issue:** on one bucket identity a burst trips `min(per-key, per-day)`:
  with `per-day > per-key` the daily dimension is unreachable in a fast burst,
  with `per-day ≤ per-key` the per-key dimension is unreachable — yet the
  acceptance criteria require each dimension to produce **its own** 429.
  The plan's example (50/200/200) sits on the wrong side for the daily row.
- **Fix:** e2e `.env` maxima ordered `per-key (1200) < per-day (2000) < 2 ×
  per-key`, so the per-key row fires 1201 sequential requests (boundary) and
  the daily row batches 1200 → one 65 s window wait → 800 → the `2001`st probe
  trips `RATE_LIMIT_PER_PROJECT_PER_DAY`; the per-IP row uses one shared
  forwarded IP with a fresh key (601 requests, under both other maxima).
  `.env.example`/config defaults (10/30/2000) are unchanged.
- **Files modified:** `.env` (local, untracked — e2e-tuned as the plan's
  action instructs), `e2e/hostile.spec.ts` (sanity-throw helpers document the
  required ordering).
- **Verification:** hostile group **48/48** on chromium + firefox + webkit;
  each row's 429 carries the message naming exactly its own dimension.
- **Committed in:** `6694422` (rows) / `6d576ed` (implementation).

### Scope additions (outside `files_modified`, documented here)

- **`.planning/phases/01-contracts-ingest-slice/01-03-red-evidence-task{1,2,3}.json`**
  — the persisted RED records for `gsd_run check tdd-red-evidence` (TDD
  protocol), verdict `RED_EVIDENCE_OK` ×3.
- **`.env` (local, git-ignored, not committed)** — set to the e2e values the
  plan's action calls for: `WATCHBUG_RATE_LIMIT_PER_KEY_PER_MIN=1200`,
  `..._PER_IP_PER_MIN=600`, `..._PER_PROJECT_PER_DAY=2000`,
  `WATCHBUG_TRUST_PROXY=true` (required for the forwarded-IP rows), and
  `WATCHBUG_CORS_ORIGINS=http://127.0.0.1:8080,http://localhost:8080`.

---

**Total deviations:** 1 auto-fixed (blocking) + 2 documented scope additions
**Impact on plan:** the auto-fix changed only the *test-configuration* values
and the daily row's firing pattern — implementation, semantics and production
defaults follow the plan exactly; no scope creep, no new packages
(`@fastify/rate-limit`/`@fastify/cors` were already approved/installed).

## TDD Gate Compliance (all three tasks, `tdd="true"`)

- **RED ×3:** `npx playwright test e2e/hostile.spec.ts --project=chromium
  --reporter=junit` → exit 1 each time with the target rows failing on their
  planned-behavior assertions (uniform 401 body → 429 assertions → 403/ACAO
  assertions). Records: `01-03-red-evidence-task{1,2,3}.json`, verdicts
  **`RED_EVIDENCE_OK`** (`target_test_failed`) — GREEN authorized each time.
- **GREEN ×3:** `feat(01-03)` `128d314`, `6d576ed`, `800fa0a` — hostile group
  green on all three browsers after each implementation.
- **REFACTOR:** none needed; no `refactor(01-03)` commit (allowed — optional).
- Commit sequence present: `test(01-03)` → `feat(01-03)` ×3 ✓ (gate grep
  returns exactly 3 RED + 3 GREEN).

## Verification Results

| Check | Command | Result |
| --- | --- | --- |
| hostile group (key/rate/origin rows), 3 browsers | `npm run verify -- e2e/hostile.spec.ts` | **48/48 passed** |
| full suite (66 baseline + 21 new) | `npm run verify` | **87/87 passed** |
| size gate (SDK lanes) | `npm run check:size` | PASSED |
| compose gate (INV-03 / C-4 volume) | `npm run check:compose` | PASSED |
| build | `npm run build` | PASSED |
| typecheck | `npm run lint` | PASSED |

Acceptance criteria re-checked per task (greps + suite): uniform 401 rows with
identical bodies and unchanged list; parameterised `where(eq(projects.publicKey…))`
lookup with `preHandler: [… projectKeyGate]` before `storage.put`;
all three dimensions asserting integer `Retry-After ≥ 1` with inclusive
`max`/`max+1` boundaries; `RATE_LIMIT_*` constants referenced in
`rate-limit.ts`; the four knobs present in `.env.example`;
`register(rateLimit, { global: false })` in `app.ts`; cors.ts reading the
allowlist from config with the `origin !== undefined` presence gate; loopback
`WATCHBUG_CORS_ORIGINS` documented.

## Issues Encountered

- The Task 3 RED record initially verified as `INVALID_RED` because its
  `targetTest` used `->` instead of the row's actual `→` — the failing test
  was correct, the name match was not. Re-recorded with the exact test name →
  `RED_EVIDENCE_OK`. No code involved.
- **Deferred items carried forward unchanged** (see
  [`deferred-items.md`](./deferred-items.md)): the `meta` +
  `Content-Type: application/json` → `"[object Object]"` 400 (01-04's
  onboarding-curl problem) and the 4 dev-only `drizzle-kit` audit advisories.
  This plan did not touch the meta parse path.

## Known Stubs

None — no placeholder values, no data-less components, no skipped or `todo`
tests (stub scan over the whole plan diff is clean).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **01-04 (panel)** inherits the full gate stack: the panel's own same-origin
  fetches are unaffected (no `Origin` on GET navigation/fetch; the loopback
  origin is allowlisted anyway), and P1-D-07's onboarding `curl` keeps working
  (no-`Origin` acceptance proven by e2e). **Open item:** the deferred `meta`
  JSON-content-type bug must be fixed before that curl goes into the empty
  state.
- Phase PR should record the DEP-03 seam (read surface unauthenticated by
  explicit scope) and the e2e-tuned `.env` values.

## Self-Check: PASSED

- Created/modified files all exist on disk (9/9: `plugins/rate-limit.ts`,
  `plugins/cors.ts`, `incidents.ts`, `app.ts`, `.env.example`,
  `hostile.spec.ts`, 3 RED-evidence records, this SUMMARY).
- All six plan commits exist in the repository: `f73fe77`, `128d314`,
  `6694422`, `6d576ed`, `861a875`, `800fa0a`.
- Every `<acceptance_criteria>` re-checked (see Verification Results).
- Plan `<verification>` re-run: `npm run verify` **87/87**,
  `check:size` PASSED, `check:compose` PASSED.
- `commits: 6` measured from the ledger (`773e940..HEAD`), not narrated.

---
*Phase: 01-contracts-ingest-slice*
*Completed: 2026-10-12*
