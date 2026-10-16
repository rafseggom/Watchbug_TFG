---
phase: quick-batch-261014-m3u
plan: 261014-m3x
subsystem: ui
tags: [react, fetch, abortsignal, pagination, i18n, sec-05, stopthatslop]

# Dependency graph
requires:
  - phase: 261014-m3w
    provides: "GET /api/incidents read contract — ?limit=<1..200> (absent → 100, max 200), ?cursor=<opaque>, bare-array response, x-next-cursor response header when a further page exists"
provides:
  - "Panel fetch layer with a coded ApiError (network/timeout/http/invalid-json), AbortSignal.timeout(10_000) and a guarded body parse"
  - "fetchIncidents(opts { limit, cursor }) → IncidentPage { rows, nextCursor } with tolerant bare-array / { rows } normalization"
  - "Bounded rendered list: one PAGE_SIZE page on mount, further rows only through an explicit Load-more control (dedup by id, self-healing to hidden)"
  - "Five new en/es i18n keys (errServer/errTimeout/errInvalidJson/errNetwork/loadMore) with the Record<StringKey,string> twin enforced at compile time"
  - "Query-string-tolerant Playwright matcher (shared INCIDENTS_LIST_RE) for the two P1-D-07 mock rows"
affects: [261014-m3z, 261014-m3y, 261014-m40, panel-qa, verify-work]

actuals:
  tokens: 3958
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Coded error currency: a closed ApiErrorCode enum mapped through a Record<ApiErrorCode, StringKey> so raw exception messages never reach the DOM (T-m3x-02)"
    - "Opaque cursor treated as an opaque token — encodeURIComponent on append, never parsed/rendered/interpolated (T-m3x-01)"
    - "Shared Playwright regex const for a route that page.unroute must unregister (identity/source+flags equality)"

key-files:
  created: []
  modified:
    - apps/panel/src/api.ts
    - apps/panel/src/App.tsx
    - apps/panel/src/components/ReportList.tsx
    - apps/panel/src/i18n.ts
    - e2e/ingest.spec.ts

key-decisions:
  - "Consumed 261014-m3w's declared contract verbatim: ?limit / ?cursor / bare-array response + x-next-cursor header; the panel's PAGE_SIZE=50 stays under the server ceiling of 200"
  - "fetchIncidents normalizes both a bare array and a { rows } object and reads the cursor from the header first, then body.nextCursor/body.cursor — so the '[]' e2e mocks keep working regardless of the eventual response shape"
  - "App error state changed from a raw string to { code: ApiErrorCode }; the localized reason is rendered, the raw message is dropped"
  - "Load-more dedups by id and hides itself when a page yields nothing new (cursor-less fallback re-request cannot become a stuck button)"
  - "AbortSignal.timeout(10_000) chosen over a manual AbortController — available in every browser the e2e suite runs (chromium/firefox/webkit)"

patterns-established:
  - "Coded API errors → closed i18n Record; no raw exception text in the UI"
  - "Bounded list rendering via explicit pagination controls, not a single full-table render"

requirements-completed: []

coverage:
  - id: D1
    description: "Panel fetch layer hardened — AbortSignal.timeout + guarded JSON parse + coded ApiError; stopthatslop findings 4 and 5 closed for apps/panel/src/api.ts"
    verification:
      - kind: other
        ref: "python -m stopthatslop_cli check --repo-root . --pack ts (apps/panel/src/api.ts absent from gate findings)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bounded first page + Load-more control appends the next page (dedup by id, self-healing to hidden when a page yields nothing new)"
    verification:
      - kind: other
        ref: "npm run typecheck -w @watchbug/panel (pass) — runtime behaviour requires e2e/ingest.spec.ts"
        status: unknown
    human_judgment: true
    rationale: "Playwright e2e could not run in the worktree (Docker daemon unavailable; the suite needs the shared single-instance compose stack). Deferred to the orchestrator post-merge — see Deferred Verification."
  - id: D3
    description: "Localized error paragraph for HTTP 500 / timeout / invalid-JSON / network failure in both en and es, with no unhandled rejection"
    verification:
      - kind: other
        ref: "npm run typecheck -w @watchbug/panel enforces the es Record<StringKey,string> twin for the four reason keys (pass)"
        status: unknown
    human_judgment: true
    rationale: "The runtime error path is asserted by e2e rows that require the live stack; deferred to the orchestrator."
  - id: D4
    description: "Empty list still renders EmptyState (P1-D-07 onboarding curl); the two P1-D-07 mock rows still match the new query-string request"
    verification:
      - kind: e2e
        ref: "npm run verify -- e2e/ingest.spec.ts -g \"P1-D-07\" (query-string matcher change)"
        status: unknown
    human_judgment: true
    rationale: "e2e deferred to the orchestrator (no Docker/browsers in the worktree)."

duration: 10min
completed: 2026-10-15
status: complete
plan_head_before: 62195bbc4f354e243951915e21dcd1845e3304ca
plan_head_after: a5675b94e9c712545b2a7efff54a8bfd67b7a1db
---

# Quick-batch 261014-m3u item 261014-m3x: Panel fetch hardening + bounded list Summary

**Panel read path hardened with `AbortSignal.timeout(10_000)`, guarded JSON parsing and coded `ApiError`s, and the incident list bounded to one `PAGE_SIZE` page with an explicit Load-more control — closing stopthatslop findings 4+5 and the S-6 client half.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-10-15T13:29:56Z
- **Completed:** 2026-10-15T13:40:11Z
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments
- `getJson`/`requestJson` in `apps/panel/src/api.ts` now fetch with `AbortSignal.timeout(10_000)`, parse the body inside a try/catch, and always surface either data or a coded `ApiError` (`network` | `timeout` | `http` | `invalid-json`) — the stopthatslop findings 4 and 5 for that file are closed (confirmed: `apps/panel/src/api.ts` no longer appears in the checker's gate findings).
- `fetchIncidents(opts)` requests `?limit=PAGE_SIZE` (50) and appends `&cursor=` only for a non-empty opaque token, normalizes both a bare array and a `{ rows }` body, and returns `IncidentPage { rows, nextCursor }` read from the `x-next-cursor` header first.
- The list is bounded: `App` loads one page on mount; a `loadMore` handler appends deduplicated rows and hides the control when a page yields nothing new. Failures render a localized reason (`loadError` + a mapped `ERROR_KEY`) instead of a raw exception message.
- Five new en/es i18n keys (`errServer`, `errTimeout`, `errInvalidJson`, `errNetwork`, `loadMore`); the `es: Record<StringKey, string>` type keeps a missing Spanish twin a compile error.
- The two P1-D-07 e2e mock rows now share one `INCIDENTS_LIST_RE` matcher tolerant of the query string, at all three route/unroute sites.

## Task Commits

Each task was committed atomically (worktree branch `worktree-agent-qb-261014-m3x`):

1. **Task 1: Harden the panel fetch layer** - `acfdc15` (fix)
2. **Task 2: Bound the rendered list — paging state + Load-more** - `a5675b9` (feat)

**Plan metadata:** not committed by this executor — the orchestrator owns the SUMMARY/PLAN commit (ADR-1239 single-writer).

## Files Created/Modified
- `apps/panel/src/api.ts` - `ApiError`/`ApiErrorCode`, `requestJson` (AbortSignal + guarded parse + cursor header), `fetchIncidents`/`IncidentPage`/`PAGE_SIZE`, tolerant body normalization.
- `apps/panel/src/App.tsx` - paging state (`cursor`/`hasMore`/`loadingMore`), `loadMore` handler with dedup, `error: { code }` + `ERROR_KEY` mapping; minimal consumer adaptation to `IncidentPage` (Task 1).
- `apps/panel/src/components/ReportList.tsx` - `hasMore`/`loadingMore`/`onLoadMore` props and the trailing full-width Load-more button (disabled while loading).
- `apps/panel/src/i18n.ts` - four error-reason keys + `loadMore`, in both en and es.
- `e2e/ingest.spec.ts` - module-level `INCIDENTS_LIST_RE` used at the two `page.route` sites and the `page.unroute` site.

## Decisions Made
- Consumed 261014-m3w's contract verbatim (`?limit` / `?cursor` / bare array + `x-next-cursor`); panel `PAGE_SIZE=50` stays under the server's 200 ceiling.
- Kept `fetchSetup()` and `incidentImageUrl()` byte-identical (thin `getJson` body-only wrapper retained).
- `AbortSignal.timeout` over a hand-rolled `AbortController` (available in every target browser).
- No new dependencies; no router/state/query library (STACK rejection list / INV-03).
- Used ONE shared regex const for the list route rather than a predicate function, because `page.unroute` unregisters regexes by source+flags equality.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Minimal `App.tsx` adaptation in Task 1 so the tree typechecks**
- **Found during:** Task 1 (after changing `fetchIncidents` to return `IncidentPage`).
- **Issue:** Task 1's done criteria require `npm run lint` green, but `fetchIncidents` now returns `IncidentPage`, and its only consumer (`App.tsx`) was typed for `Incident[]`; the panel workspace therefore failed `tsc`. `App.tsx` is listed in the plan's `files_modified`, but the plan assigned its pagination work to Task 2.
- **Fix:** Minimal consumption change in Task 1 (`page.rows` / `page.rows[0]?.id`); the full paging state landed in Task 2 as planned.
- **Files modified:** `apps/panel/src/App.tsx`
- **Verification:** `npm run typecheck -w @watchbug/panel` passes.
- **Committed in:** acfdc15 (Task 1 commit).

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** No scope creep — the adaptation is the minimum needed for the new return type; Task 2 then built the full paging state on top.

## Issues Encountered

- **`npm run lint` (repo root) cannot go green from inside this worktree** because of a **pre-existing type error in the merged base**, not caused by this plan:
  `apps/api/src/plugins/rate-limit.ts(94,19)` and `(95,67)` — `Property 'isExceeded'/'ttlInSeconds' does not exist` on the union returned by the read limiter, introduced by the base commit `62195bb` ("read limiter must gate on isExceeded, not isAllowed"). `apps/api` is untouched by this item and outside its file envelope (owned by the server items m3w/m3z).
  - **Verified for this item instead:** `npm run typecheck -w @watchbug/panel` passes, so the panel-side change is type-clean.
  - **Deferred (out of scope):** the apps/api fix belongs to a server item.
- `check:size` initially reported "artifact missing" before a build; after `npm run build` it PASSED.

## Deferred Verification

The worktree has no Docker daemon (`docker ps` → cannot connect to the pipe) and the Playwright suite needs the shared single-instance compose stack (INV-03), so the runtime checks were **not run here** — they are the orchestrator's, post-merge. The exact commands to run in the main checkout:

- `npm run lint` — **expected to still fail on the pre-existing `apps/api/src/plugins/rate-limit.ts` union-type error** (base commit `62195bb`), independent of this item. Re-confirm after the server items land.
- `npm run verify -- e2e/ingest.spec.ts -g "P1-D-07"` — the two mock rows must stay green against the query-string request (proves the matcher change).
- `npm run verify -- e2e/ingest.spec.ts` — includes the render-probe row (`toHaveCount(2)` in list + detail) and the locale-switch rows.
- `npm run verify` — full suite (chromium/firefox/webkit).
- `npm run gate`, `node scripts/check-compose.mjs` — **already run here and green** (see below).

### Static checks actually run in this worktree
- `npm run typecheck -w @watchbug/panel` — PASS.
- `npm run build -w @watchbug/panel` — PASS (22 modules, dist emitted).
- `npm run build` (all workspaces) — PASS.
- `node scripts/gate.mjs` — PASSED (2 passed, 0 failed, 1 skipped).
- `node scripts/check-compose.mjs` — PASSED (exactly three services).
- `node scripts/check-size.mjs` — PASSED (after build).
- `python -m stopthatslop_cli check --repo-root . --pack ts` — `apps/panel/src/api.ts` **absent** from gate findings (findings 4+5 closed). The 3 remaining gate findings are all server-side (`apps/api/src/index.ts` fetch-without-abort ×2, `apps/api/src/ingest/harden.ts` eager `sharp` import) — outside this item's scope.
- HTML-sink grep over `apps/panel/src` (`dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|outerHTML`) — 0 matches (SEC-05 pass 2 holds).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The panel now consumes 261014-m3w's `?limit`/`?cursor`/`x-next-cursor` contract; no server-side follow-up is needed.
- Outstanding for the orchestrator: run the e2e suite against the rebuilt stack; confirm the apps/api base type error is resolved by the server items.

---

## Self-Check: PASSED

- `apps/panel/src/api.ts` — FOUND (modified in acfdc15)
- `apps/panel/src/App.tsx` — FOUND (modified in acfdc15 + a5675b9)
- `apps/panel/src/components/ReportList.tsx` — FOUND (modified in a5675b9)
- `apps/panel/src/i18n.ts` — FOUND (modified in acfdc15 + a5675b9)
- `e2e/ingest.spec.ts` — FOUND (modified in acfdc15)
- Commit `acfdc15` — FOUND; commit `a5675b9` — FOUND
- Commits measured from ledger `gsd-plan-head-before-261014-m3u-1` (`62195bb…`): `git rev-list --count` = 2; code changes present and committed (not narrated).

*Phase: quick-batch-261014-m3u*
*Completed: 2026-10-15*
