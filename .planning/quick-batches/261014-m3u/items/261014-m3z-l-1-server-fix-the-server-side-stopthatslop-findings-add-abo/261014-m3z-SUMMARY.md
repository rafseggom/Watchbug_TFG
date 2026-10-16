---
phase: 261014-m3z
plan: 1
subsystem: api
tags: [sharp, lazy-import, abort-signal-timeout, stopthatslop, fastify, esbuild, ingest-harden]

# Dependency graph
requires:
  - phase: 01-contracts-ingest-slice
    provides: hardenImage root re-encode stage (P1-D-10) and the runnable multipart smoke (P1-D-09)
provides:
  - sharp (the heaviest native dependency in the repo) is loaded lazily on the first ingest, never at module-eval / boot time
  - both smoke-path fetch() calls carry AbortSignal.timeout(5s) and report a deadline hit as an intelligible SMOKE FAIL with a non-zero exit
affects: [stopthatslop gate (server side now clean), api boot path, ingest/harden seam, smoke harness (WATCHBUG_SMOKE=1)]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 1208
  tasks: 2
  commits: 2

plan_head_before: 6f0b55fe60701fdc503a69b2e33e7eecc3cb29ce
plan_head_after: 692551e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Memoized lazy loader for a heavy native dependency (shared in-flight promise, slot cleared on rejection so the next call can retry)"
    - "Single fetch wrapper that always attaches AbortSignal.timeout and converts a deadline hit into one intelligible operational failure"

key-files:
  created: []
  modified:
    - apps/api/src/ingest/harden.ts
    - apps/api/src/index.ts

key-decisions:
  - "Keep the sharp backend decision (P1-D-10) and hardenImage's contract byte-for-byte; move only the *import eagerness* off the critical path"
  - "Load sharp outside the codec try/catch so a broken install surfaces as a logged generic 500 (operational failure), never a 400 that blames the client and never an install path in a client-visible body"
  - "Clear the memoized slot on a rejected import so one transient load failure cannot poison every later ingest"
  - "Bound the smoke fetches at 5 s (SMOKE_FETCH_TIMEOUT_MS) via a local smokeFetch() helper rather than duplicating signal + try/catch at both call sites"
  - "Do NOT fix the pre-existing TS2339 errors in apps/api/src/plugins/rate-limit.ts (reproduced identically on pristine main HEAD): scope boundary — record and defer"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "sharp is imported dynamically and memoized; no static sharp import remains anywhere in the repo, and the built bundle references it only as import(\"sharp\")"
    verification:
      - kind: other
        ref: "python -m stopthatslop_cli check --repo-root <worktree> --pack ts → 0 findings (typescript.performance.no-eager-heavy-dependency-import cleared)"
        status: pass
      - kind: other
        ref: "node check-sharp.mjs apps/api/dist/index.mjs → 'OK: static=0 dynamic=1'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both smoke fetch() calls are bounded by AbortSignal.timeout(5s) with intelligible timeout reporting; WATCHBUG_SMOKE=1 still prints SMOKE OK and exits 0"
    verification:
      - kind: integration
        ref: "WATCHBUG_SMOKE=1 node apps/api/dist/index.mjs → 'SMOKE OK' + SMOKE_EXIT=0"
        status: pass
      - kind: other
        ref: "python -m stopthatslop_cli check --repo-root <worktree> --pack ts → 0 findings (typescript.http.no-fetch-without-abort-timeout cleared)"
        status: pass
    human_judgment: false
  - id: D3
    description: "E2E / gate / compose verification of the merged result (npm run verify, node scripts/gate.mjs, docker compose) — orchestrator-owned, not runnable inside this executor envelope"
    verification: []
    human_judgment: true
    rationale: "The verification envelope forbids npm run verify, npx playwright, docker compose and node scripts/gate.mjs inside the executor worktree; the orchestrator runs them after merge (see ## Deferred Verification)."

# Metrics
duration: 21min
completed: 2026-10-15
status: complete
---

# Quick-batch item 261014-m3z (batch 261014-m3u, item 1/server): Summary

**sharp now loads lazily on the first ingest instead of at boot, and the multipart smoke's two fetches are bounded by `AbortSignal.timeout(5s)` with an intelligible timeout failure — the server side of the stopthatslop gate is at zero findings.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-10-15T13:17:04Z (worker spawn, per `.claude/worktrees/agent-qb-261014-m3z.worker.json`)
- **Completed:** 2026-10-15T13:38:29Z
- **Tasks:** 2
- **Files modified:** 2 (`apps/api/src/ingest/harden.ts`, `apps/api/src/index.ts`; +58/−3)

## Accomplishments
- `apps/api/src/ingest/harden.ts` — removed the static `import sharp from 'sharp'`; added a memoized `loadSharp()` that dynamically imports sharp on the first ingest. Concurrent first ingests share one in-flight import (no import storm); a rejected load clears the slot so the next ingest retries instead of inheriting a poisoned promise. `hardenImage` awaits `loadSharp()` **outside** the codec try/catch, so an operational load failure escalates as a logged generic 500 while decode failures stay the existing client-facing 400 with `codecMessage()` intact.
- `apps/api/src/index.ts` — added `SMOKE_FETCH_TIMEOUT_MS = 5_000` and a local `smokeFetch()` helper that always attaches `AbortSignal.timeout(...)`; both smoke requests (valid-part 200 and oversized-part 413) now go through it. A deadline hit prints one intelligible line naming the URL and the deadline and exits 1, instead of hanging with no output.
- Server side of the stopthatslop `ts` gate is clean: the `no-eager-heavy-dependency-import` finding in `harden.ts` and both `no-fetch-without-abort-timeout` findings in `index.ts` are gone (worktree check: 0 findings, exit 0).
- The boot path no longer resolves the native sharp binary: the built bundle (`apps/api/dist/index.mjs`, `--packages=external`) contains exactly one reference to sharp, and it is `import("sharp")`.

## Task Commits

Each task was committed atomically (code only):

1. **Task 1: lazy memoized sharp loader** — `7819c2b` (fix) — `apps/api/src/ingest/harden.ts` (1 file, +33/−1)
2. **Task 2: bounded smoke fetches** — `692551e` (fix) — `apps/api/src/index.ts` (1 file, +25/−2)

**Plan metadata:** not committed by this executor — the orchestrator owns `.planning/` (SUMMARY/PLAN) commits.

`commits: 2` is **measured** from the persisted ledger (`$(git rev-parse --git-dir)/gsd-plan-head-before-quick-batch-261014-m3u-01` = `6f0b55fe60701fdc503a69b2e33e7eecc3cb29ce`) via `git rev-list --count <ledger>..HEAD`, not narrated.

## Files Created/Modified
- `apps/api/src/ingest/harden.ts` — static sharp import removed; added `loadSharpModule()` + memoized `loadSharp()`; Stage 5 doc block extended to state the lazy-loading contract; `hardenImage` awaits the loader before the codec try.
- `apps/api/src/index.ts` — added `SMOKE_FETCH_TIMEOUT_MS` and `smokeFetch()`; both smoke `fetch()` call sites switched to `smokeFetch()`.

## Verification Evidence (run in-session)

| Check | Command | Result |
|---|---|---|
| Baseline stopthatslop (worktree root, before edits) | `python -m stopthatslop_cli check --repo-root <worktree> --pack ts` | 3 findings, EXIT=1 (2 × `no-fetch-without-abort-timeout` `index.ts`, 1 × `no-eager-heavy-dependency-import` `harden.ts`) |
| Task 1 stopthatslop | same, after `harden.ts` edit | 2 findings (both `index.ts`), EXIT=1 — sharp finding cleared |
| Task 2 stopthatslop (final) | same, after `index.ts` edit | **0 findings, EXIT=0** |
| Detector-alive probe (false-green investigation) | same tool, `--repo-root "E:\Proyectos Github\Watchbug_TFG"` (main checkout, still unfixed at HEAD) | 3 findings with `[checker]` tags, EXIT=1 — the same detectors that report 0 in the worktree still fire on unfixed copies |
| API build | `npm run build -w @watchbug/api` | `dist/index.mjs` 29.9 kB, BUILD_EXIT=0 |
| No static heavy import in bundle | `node check-sharp.mjs apps/api/dist/index.mjs` | `matches: ["import(\"sharp\""]`, `OK: static=0 dynamic=1`, EXIT=0 |
| Smoke | `WATCHBUG_SMOKE=1 node apps/api/dist/index.mjs` | `SMOKE 1/2 PASS`, `SMOKE 2/2 PASS`, `SMOKE OK`, SMOKE_EXIT=0 |
| Fast gate | `npm run lint` | EXIT=1 — **only** the two pre-existing `rate-limit.ts` TS2339 errors (see Issues Encountered); zero new errors from this item's files (identical tsc output before and after the edits) |

## Decisions Made
- **hardenImage contract unchanged** — same signature, same `HardenResult` union, same format-preserving PNG→PNG / WebP→WebP re-encode, same metadata-strip default, same `limitInputPixels` + `timeout({ seconds })` process guard. Only the import eagerness moved.
- **Lazy loader semantics** — `loadSharpModule()` keeps the inferred return type (no `import('sharp')` type-position expression in a signature); the module-level slot holds the in-flight/resolved promise; the `.catch` re-clears the slot before rethrowing.
- **Load outside the try** — an install/load failure is an operational error and must not be reported as a client 400 or leak an absolute install path into a response body.
- **One helper instead of two inline blocks** — `smokeFetch()` keeps the `AbortSignal.timeout` at the single `fetch()` call site, so the checker's requirement is structural rather than duplicated.
- **Pre-existing lint failure deferred, not fixed** — scope boundary (see below).

## Deviations from Plan

### Deviation 1: stopthatslop baseline run against the worktree root, not the plan's `--repo-root`

- **Found during:** Step 0c (baseline) / final verification
- **Plan says:** `python -m stopthatslop_cli check --repo-root "E:\Proyectos Github\Watchbug_TFG" --pack ts` (the planner's cwd — the main checkout).
- **Issue:** the executor runs in `.claude\worktrees\agent-qb-261014-m3z`; pointing the tool at the main checkout measures the wrong tree (it also double-reports through the nested worktree directory, and the worktree's own edits would be invisible/misattributed).
- **Fix:** ran the tool with `--repo-root <this worktree>` for baseline/after-edit/final, and used a main-root run only as the detector-alive probe. Documented here rather than silently.
- **Impact on plan:** none — the plan's intent (baseline → 0 server findings) is satisfied on the tree that actually holds the changes.

### Deviation 2: `must_haves` #1 is stale — the post-fix count is 0 findings, not "exactly 2 in `apps/panel/src/api.ts`"

- **Found during:** baseline run (3 findings, not the documented 5)
- **Cause:** sibling quick-batch item **261014-m3x** ("harden the panel fetch layer with AbortSignal, guarded JSON and a bounded fetchIncidents", `acfdc15`) was **merged into this item's base** (`338d84f`, base HEAD `6f0b55f`) before this worktree was created. Its two panel findings were therefore already fixed at my baseline; `apps/panel/src/api.ts:59` is already `fetch(path, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })`.
- **Consequence:** after this plan the worktree reports **0** findings. The must-have language ("0 findings = false green, investigate") was honoured rather than assumed satisfied: the same tool in the same session reports 3 findings (with `[checker]` tags, exit 1) on the still-unfixed main-checkout copies, which proves the detectors are alive and the worktree's 0 is a true green. Post-merge, the orchestrator's gate will legitimately see 0 findings project-wide.

### Deviation 3: `npm run lint` is red at baseline (pre-existing, out of scope)

- **Found during:** Task 1 fast gate
- **Detail:** `apps/api/src/plugins/rate-limit.ts(94,19)` and `(95,67)` — `TS2339: Property 'isExceeded' / 'ttlInSeconds' does not exist` on the union returned by `byIp(req)` (the `isAllowed: true` branch has neither). Reproduced identically on **pristine main HEAD** (`npx tsc -p apps/api/tsconfig.json --noEmit` in the main checkout, before/independently of this item) — so it predates and is unrelated to this work.
- **Action:** not fixed (scope boundary: only issues caused by this task's changes). No new errors were introduced — the tsc error set is byte-identical before and after both commits. Needs its own item (likely a narrowing guard on the `isAllowed` branch), see Deferred/Out-of-Scope below.

## Issues Encountered
- PowerShell 5.1 only: the ledger/sentinel and count commands had to be re-written in PS syntax after bash-isms and `node -e '...'` quoting failed (PS strips embedded double quotes for native commands) — the bundle check was moved to a throwaway script at `C:\Users\Dekker\AppData\Local\Temp\opencode\check-sharp.mjs`.
- `npm run lint` exit code is 1 because of the two pre-existing `rate-limit.ts` errors; per-task fast-gate acceptance was therefore read as "no NEW errors", proven by identical tsc output vs the pristine-main baseline.

## Deferred Verification

Owned by the orchestrator, not runnable inside this executor's verification envelope:

- `npm run verify` — the R-12 e2e suite (CA-01…CA-05, chromium + firefox + webkit). **Forbidden in this worktree** (Playwright / shared stack).
- `node scripts/gate.mjs` — the phase gate. **Forbidden here**; orchestrator runs it post-merge in the main checkout.
- `docker compose` / `docker-compose up` — **forbidden**; the persistence/retention and boot-path checks that need Postgres/nginx remain orchestrator-side.
- `npm run check:size` — not touched by this plan (no SDK bundle surface changed); the API bundle grew 29.6 → 29.9 kB, well inside any server-side concern and outside RNF-01's client tiers.

## Out-of-Scope Findings (recorded, not fixed)

1. **`apps/api/src/plugins/rate-limit.ts` TS2339 ×2** (lines 94–95) — pre-existing on main HEAD, breaks `npm run lint` and therefore likely the gate; needs a sibling item to narrow the `applyRateLimit()` union before reading `isExceeded` / `ttlInSeconds`.
2. **Stale must-have wording** in `261014-m3z-PLAN.md` (`must_haves` #1 expects 2 panel findings) — superseded by the m3x merge into this item's base. Flagged for the orchestrator's convergence step.

## Known Stubs
None — no stubbed/placeholder code, no skipped tests, no unwired data paths were introduced. Nothing was appended to `.planning/WINDOWS.md` (no stub, no skipped test, no unrun in-scope `<verify>`; the deferred suite runs are orchestrator-owned by envelope design, not defects).

## Threat Surface Scan
No new surface. `harden.ts` keeps the same exported contract and the same T-01-08 decode guards; the lazy load changes *when* sharp is resolved, not *what* it does. `smokeFetch()` only applies to the `WATCHBUG_SMOKE=1` development harness, adds no endpoint and no network destination, and its failure line contains the local `http://127.0.0.1:<port>` URL and the fixed deadline — no secrets, no user data.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server-side stopthatslop debt is closed; the ingest harden seam behaves identically for callers.
- Blocker for the batch's convergence: the pre-existing `rate-limit.ts` type error will fail `npm run lint` / `gate.mjs` regardless of this item — needs its own small fix item.

---

## Self-Check: PASSED

- [x] `apps/api/src/ingest/harden.ts` and `apps/api/src/index.ts` modified exactly as scoped; no other production file touched (`git status --short` shows only the two task commits and the expected untracked `.planning/quick-batches/`).
- [x] Two atomic code commits: `7819c2b`, `692551e`; `commits: 2` measured from the ledger `6f0b55f..692551e`.
- [x] stopthatslop (`--pack ts`) on the worktree: 0 findings, exit 0; false-green investigation documented with detector-alive evidence.
- [x] `npm run build -w @watchbug/api` OK; bundle has no static sharp reference (`static=0 dynamic=1`).
- [x] `WATCHBUG_SMOKE=1 node apps/api/dist/index.mjs` → `SMOKE OK`, exit 0.
- [x] `npm run lint`: no NEW errors (only the two pre-existing, main-reproducible `rate-limit.ts` TS2339 errors).
- [x] SUMMARY written; **not** committed (orchestrator owns `.planning/`); `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` untouched.

*Item: 261014-m3z (batch 261014-m3u, server)*
*Completed: 2026-10-15*
