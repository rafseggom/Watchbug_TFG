---
phase: 261014-m3v
plan: 1
subsystem: api
tags: [ttl, retention, purge, retention-job, postgres, drizzle, storage, inv-03, ret-01, ret-02]

# Dependency graph
requires:
  - phase: 01
    provides: incidents schema with identity_purge_at/artifact_purge_at, Storage seam, config readInt, setInterval/unref pattern
provides:
  - "In-process TTL purge job (RET-01, RET-02): boot sweep + unref'd interval, identity null-strip and blob-then-row artifact deletion"
  - "config.purgeIntervalMinutes (WATCHBUG_PURGE_INTERVAL_MINUTES, default 60)"
  - "Deployment surface declaration of the purge cadence (.env.example, docker-compose.yml)"
affects: [retention, ops, phase-5-auth]

actuals:
  tokens: 2376
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Scheduled background work in-process via plain setInterval + timer.unref() + clearInterval on Fastify onClose (no scheduler lib, no cron sidecar — INV-03)"
    - "Reversible-is-bad ordering: delete the external artifact (blob) before the row that points at it"

key-files:
  created:
    - apps/api/src/purge.ts
  modified:
    - apps/api/src/config.ts
    - apps/api/src/app.ts
    - .env.example
    - docker-compose.yml

key-decisions:
  - "Purge runs inside the api process (plain setInterval), never a cron sidecar — INV-03 permits exactly three services"
  - "Artifact sweep deletes blob first, row second; a blob failure keeps the row as a retry pointer (row-first would leak a rowless blob forever — WR-03)"
  - "No schema change and no purge-scan index — the columns already exist (a schema edit is a migration/consultation trigger) and the retention bound keeps the scan small"
  - "Logs carry counts, config and incident uuids only — never the user_* PII the job destroys"

patterns-established:
  - "A retention job is fail-soft: boot sweep is fire-and-forget, every failure path is caught+logged, and a dead DB can never reject buildApp/listen"

requirements-completed: []

coverage:
  - id: D1
    description: "A due identity row keeps its incident but has user_id/user_name/user_email NULL after one sweep"
    verification:
      - kind: e2e
        ref: "scripted purge proof (deferred — see Deferred Verification); npm run lint"
        status: unknown
    human_judgment: false
  - id: D2
    description: "A due artifact row is gone from the incidents table and its blob is gone from the attachments volume after one sweep"
    verification:
      - kind: e2e
        ref: "scripted purge proof (deferred — see Deferred Verification)"
        status: unknown
    human_judgment: false
  - id: D3
    description: "Every non-empty sweep writes a [watchbug] purge: log line with counts; a sweep failure is logged and the API keeps serving"
    verification:
      - kind: e2e
        ref: "scripted purge proof (deferred — see Deferred Verification)"
        status: unknown
    human_judgment: false
  - id: D4
    description: "Purge cadence configurable via WATCHBUG_PURGE_INTERVAL_MINUTES, documented in .env.example and declared in docker-compose.yml; still exactly three services"
    verification:
      - kind: other
        ref: "npm run check:compose (PASSED); grep assertions on .env.example / docker-compose.yml (PASSED)"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-10-14
status: complete
---

# Quick item 261014-m3v / Plan 1: Scheduled TTL purge job Summary

**In-process TTL purge job wired end-to-end — boot sweep plus unref'd interval that nulls due identity fields and deletes due incidents (blob before row) through the Storage seam — closing the "TTL retention is decorative" finding.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-14T15:20:00Z
- **Completed:** 2026-10-14T15:38:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `apps/api/src/purge.ts`: `startPurge(deps)` fires one caught fire-and-forget boot sweep, then `setInterval` at `intervalMinutes * 60_000` with `timer.unref()`; a closure `running` flag skips overlapping ticks; `stop()` → `clearInterval`.
- Identity sweep (RET-01 / R-09): one set-based `UPDATE … SET user_id/user_name/user_email = NULL WHERE identity_purge_at <= now AND (… IS NOT NULL)`, guarded by the `or(isNotNull…)` idempotency mechanism.
- Artifact sweep (RET-02 / R-10): `SELECT … WHERE artifact_purge_at <= now LIMIT 100`, then per row `storage.delete(storageKey)` **before** the row delete; a blob failure logs the uuid, keeps the row for retry, and continues.
- `config.purgeIntervalMinutes` read through the existing fail-fast `readInt` (`WATCHBUG_PURGE_INTERVAL_MINUTES`, default 60) — a `0`/garbage value exits at boot naming the variable.
- Composition root (`app.ts`) registers `startPurge` after `registerIncidentsRoutes` and clears the timer via `app.addHook('onClose', …)`.
- Deployment surface: `WATCHBUG_PURGE_INTERVAL_MINUTES=60` documented in `.env.example` and declared as an `api` environment entry in `docker-compose.yml` — still exactly three services.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the TTL purge sweep end-to-end — module, config knob, boot registration** - `c5eb298` (feat)
2. **Task 2: Declare the purge cadence on the deployment surface** - `41701fd` (chore)

**Plan metadata:** committed by the orchestrator (this worktree does not write shared artifacts).

## Files Created/Modified

- `apps/api/src/purge.ts` - New purge module: `startPurge(deps)`, `runPurge(deps)`, boot sweep + unref'd interval, blob-then-row artifact deletion.
- `apps/api/src/config.ts` - Added `AppConfig.purgeIntervalMinutes` read via `readInt(env, 'WATCHBUG_PURGE_INTERVAL_MINUTES', 60)`.
- `apps/api/src/app.ts` - Imported and registered `startPurge`; `onClose` hook calls `purge.stop()`.
- `.env.example` - New "Retention purge job (S-2 / RET-01, RET-02)" section.
- `docker-compose.yml` - `WATCHBUG_PURGE_INTERVAL_MINUTES: ${WATCHBUG_PURGE_INTERVAL_MINUTES:-60}` in the `api` environment block.

## Decisions Made

- Purge runs INSIDE the api process with a plain `setInterval` — INV-03 permits exactly three services (no cron sidecar) and the plan forbids scheduler libraries / new dependencies.
- Blob-before-row deletion ordering: the row-first failure mode leaves a rowless blob this by-row job can never see again (WR-03, incidents.ts), an unrecoverable volume leak; the chosen order self-heals because `FsStorage.delete` is `rm(…, { force: true })` and the row delete is retried.
- No schema edit and no purge-scan index: the purge columns already exist (any schema edit is a Drizzle migration and an AGENTS.md consultation trigger), and the retention bound keeps the table small.
- Purge logs contain counts and incident uuids only — never the `user_*` PII the job exists to destroy.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Deferred Verification

The orchestrator-owned VERIFICATION ENVELOPE forbids running the shared stack or the e2e suite from this worktree (single-instance stack, INV-03 port collisions). The following stack-dependent checks from the plan's `<verify>` are deferred to the orchestrator's post-merge run; the implementation and all static checks are in place.

| Deferred check | Exact command | Why deferred |
|----------------|---------------|--------------|
| Scripted purge proof (identity-null, row+blob deletion, log line) | POST two probes, backdate `identity_purge_at`/`artifact_purge_at` via `docker compose exec db psql -U watchbug -d watchbug`, `docker compose up -d --build api`, poll `/api/health`, assert, then clean up | Needs the running compose stack (`docker compose …`) |
| Full R-12 regression | `npm run verify` (Playwright CA-01..CA-05, chromium + firefox + webkit) | Needs the shared Playwright browsers / running stack |
| Three-service shape via the compose CLI | `docker compose config --services` → exactly `api`, `panel`, `db` | `docker compose` command (envelope-forbidden) |

Checks that PASSED in this worktree:

- `npm run lint` — all four workspaces typecheck clean.
- `npm run check:compose` — exactly three services; attachments volume mounted only in `api`.
- `grep -v '^#' .env.example | grep -c '^WATCHBUG_PURGE_INTERVAL_MINUTES=60$'` → 1.
- `grep -c 'WATCHBUG_PURGE_INTERVAL_MINUTES: ${WATCHBUG' docker-compose.yml` → 1.

## User Setup Required

None - no external service configuration required. Operators may tune `WATCHBUG_PURGE_INTERVAL_MINUTES` (default 60) in `.env`.

## Next Phase Readiness

- Retentions are enforced end-to-end pending the deferred stack proof; no schema migration, no new dependency, INV-03 intact.
- The orchestrator should run `docker compose up -d --build`, the scripted purge proof, and `npm run verify` in the main checkout after merge.

---
*Quick item: 261014-m3v / Plan 1*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: apps/api/src/purge.ts, apps/api/src/config.ts, apps/api/src/app.ts, .env.example, docker-compose.yml
- FOUND: commits c5eb298, 41701fd
- FOUND: 261014-m3v-SUMMARY.md
