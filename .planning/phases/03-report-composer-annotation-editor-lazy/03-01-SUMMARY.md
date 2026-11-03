---
phase: 03-report-composer-annotation-editor-lazy
plan: 01
subsystem: api
tags: [drizzle, postgres, migration, fastify, ingest, cap-03, playwright]

requires:
  - phase: 01-foundation
    provides: the CA-01 ingest chain, the `0000` migration, the compose stack and the e2e `postIncident` harness
provides:
  - "nullable incidents.storage_key/content_type + CHECK admitting image/jpeg in one committed migration 0001"
  - "meta-only (screenshot-less) POST /api/incidents -> 201 through the full meta pipeline"
  - "imageless blob-route 404, purge null-key guard, panel imageless tolerance"
  - "postIncident helper contract: bytes === undefined omits the image part (8 existing callers pinned)"
affects: [03-02-jpeg-lane, 03-04-text-only-composer, 06-triage-retention]

actuals:
  tokens: 10432   # chars/4 over the realized apps+e2e diff (measured from the plan commit range)
  tasks: 3
  commits: 3      # MEASURED via git rev-list ${plan_head_before}..HEAD at authoring time

plan_head_before: 270c576329c48c7d7abf52084d3926e9599e2c6c
plan_head_after: 4a7b8b01dfd0ce75f91a4b42c6476550093d72a5

tech-stack:
  added: []
  patterns:
    - "one ext->MIME allowlist read in both directions (derived EXT_BY_CONTENT_TYPE inverse map, no ternaries)"
    - "artifact-level volume assertions from e2e via `docker compose exec` file counts (R-12 style)"

key-files:
  created:
    - apps/api/drizzle/0001_messy_unicorn.sql
    - apps/api/drizzle/meta/0001_snapshot.json
  modified:
    - apps/api/drizzle/meta/_journal.json
    - apps/api/src/db/schema.ts
    - apps/api/src/routes/incidents.ts
    - apps/api/src/purge.ts
    - apps/panel/src/api.ts
    - apps/panel/src/components/ReportDetail.tsx
    - e2e/ingest.spec.ts

key-decisions:
  - "Owner-approved (checkpoint:decision 'approve', 2026-10-28): ONE migration 0001 carries both the nullable screenshot columns and the image/jpeg CHECK widening (P3-D-14)"
  - "postIncident bytes===undefined now means 'omit the image part'; the 8 pre-existing callers pass bytes: png so no existing row silently became meta-only"
  - "Blob route answers the structured 404 on storageKey === null BEFORE any Storage call; ext resolves through the derived inverse map, unknown -> structured 500 (T-03-09)"

requirements-completed: [CAP-03]  # server half; shared-ID gate #2388: CAP-03 stays unmarked in REQUIREMENTS.md until sibling 03-04 (client half) also finishes

coverage:
  - id: D1
    description: "Committed drizzle-kit migration 0001: storage_key/content_type DROP NOT NULL + incidents_content_type_check admits image/webp|image/png|image/jpeg; applied to the compose DB"
    requirement: CAP-03
    verification:
      - kind: integration
        ref: "command: npm --prefix apps/api run db:migrate -> 'migrations applied successfully'; psql is_nullable=YES (both columns); pg_get_constraintdef lists the three MIME values"
        status: pass
    human_judgment: false   # the artifact's SEMANTICS were human-approved at the Task 1 checkpoint ('approve', 2026-10-28)
  - id: D2
    description: "Meta-only POST stores one row with null screenshot columns: 201, contentType null in the list projection, no blob written to the attachments volume, no fabricated screenshot anywhere"
    requirement: CAP-03
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#CAP-03 text-only: a meta-only submission stores a row with no screenshot"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two concurrent meta-only posts with one Idempotency-Key yield exactly one row, a null content type and zero blobs (uniqueness index, not application code)"
    requirement: CAP-03
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#CAP-03 text-only concurrent: one idempotency key, one row, no blob"
        status: pass
    human_judgment: false
  - id: D4
    description: "Panel tolerance: an imageless report lists and renders with its title and NO screenshot element (no broken image); pre-existing image-bearing panel row still asserts naturalWidth 64"
    requirement: CAP-03
    verification:
      - kind: automated_ui
        ref: "e2e/ingest.spec.ts#CAP-03 text-only: the panel lists it"
        status: pass
      - kind: automated_ui
        ref: "e2e/ingest.spec.ts#panel renders the row and its screenshot (P1-D-04, SEC-05 pass 2)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Imageless submissions pass the same request-level guards: missing X-Project-Key yields byte-for-byte the same structured 401 as an image-bearing key failure; blob route answers 404 JSON, never 500, never an image/* header"
    requirement: CAP-03
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#CAP-03 text-only: a meta-only post without X-Project-Key gets the same structured 401"
        status: pass
      - kind: e2e
        ref: "e2e/ingest.spec.ts#CAP-03 text-only: the blob route never 500s"
        status: pass
    human_judgment: false
  - id: D6
    description: "TTL purge sweep deletes imageless rows without ever handing a null key to Storage.delete"
    requirement: CAP-03
    verification:
      - kind: other
        ref: "apps/api/src/purge.ts null-key guard; npm run lint (tsc) passes with the nullable column types"
        status: pass
    human_judgment: true
    rationale: "No e2e row fires a real TTL sweep on the shared stack (interval-bound); the guard is a static both-readers-of-one-invariant control. Phase 6 triage/retention verification rows exercise the runtime sweep — verifier should confirm behavior on mixed rows there."

duration: 25min
completed: 2026-10-28
status: complete
---

# Phase 03 Plan 01: Imageless Ingest + Single Schema Migration Summary

**CAP-03's server half: a `meta`-only multipart submission now files a real 201 — stored with NULL `storage_key`/`content_type` through the unchanged meta pipeline, listed with `contentType: null`, answered by a structured 404 on the blob route — inside the phase's ONE owner-approved drizzle migration that also admits `image/jpeg` to the CHECK constraint.**

## Performance

- **Duration:** ~25 min (context load 15:40ish → task commits 15:56–16:12 local +01:00)
- **Started:** 2026-10-28T14:56:38Z (first task commit; cold context load before)
- **Completed:** 2026-10-28T15:12:30Z (metadata commit shortly after)
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified) + this SUMMARY

## Accomplishments
- Owner decision `approve` recorded in this SUMMARY **before Task 2 ran** (Task 1's acceptance criterion) — one migration artifact, not two.
- `0001_messy_unicorn.sql` generated by drizzle-kit (never hand-written), committed with `meta/0001_snapshot.json` + journal entry, and applied to the running compose DB — verified live: both columns `is_nullable = YES`, `incidents_content_type_check` = `('image/webp','image/png','image/jpeg')`. Widening-only, exactly the approved scope.
- Tracer slice end-to-end: meta-only POST → 201 + `storageKey: null` insert, blob route 404 (structured body, no `storage.stream(null)`), purge sweep guards the null key, panel types/renders the row without a broken image. The `:321` and `:463` binary ternaries (Pitfall 8 class) are gone: `CONTENT_TYPE_BY_EXT: Record<ImageExt, string>` and its derived inverse `EXT_BY_CONTENT_TYPE` are now one mapping.
- e2e: `postIncident` omits the `image` part when `bytes === undefined`; all 8 prior omission callers pinned with `bytes: png` (requests byte-identical to before); 5 new `CAP-03 text-only` rows including artifact-level "no blob written" volume-count assertions (docker compose exec file count, workers=1) and the imageless/ image-bearing 401-body equality proof.
- Full chromium ingest suite green after each task: 13/13 at Task 2, 17/17 at Task 3.

## Task Commits

Each task was committed atomically:

1. **Task 1: Approve the Phase 3 schema migration (checkpoint:decision)** — `aa46faf` (docs: owner decision `approve` recorded in SUMMARY before Task 2)
2. **Task 2: End-to-end "a report with no screenshot" (tracer)** — `e00824d` (feat: schema + migration + route/purge/panel/e2e imageless path)
3. **Task 3: Imageless rows safe under concurrency, read surface and guards** — `4a7b8b0` (test: 4 additional CAP-03 rows)

**Plan metadata:** final docs commit this session (SUMMARY + STATE + ROADMAP).

## Files Created/Modified
- `apps/api/drizzle/0001_messy_unicorn.sql` — the approved phase migration: 2x DROP NOT NULL, CHECK drop+recreate with the three MIME values
- `apps/api/drizzle/meta/0001_snapshot.json` + `apps/api/drizzle/meta/_journal.json` — artifact bookkeeping (journal entry tag matches the committed filename)
- `apps/api/src/db/schema.ts` — `storageKey`/`contentType` nullable; CHECK gains `'image/jpeg'`
- `apps/api/src/routes/incidents.ts` — imageless branch (stages 2–5 skipped, meta pipeline unchanged), conditional `storage.put`, null-safe WR-03 cleanup paths, blob-route 404 before any storage call, single typed allowlist + derived inverse
- `apps/api/src/purge.ts` — null-key guard in the artifact sweep (row still deleted and counted)
- `apps/panel/src/api.ts` — `Incident.contentType: string | null`
- `apps/panel/src/components/ReportDetail.tsx` — screenshot element renders only when `contentType !== null`
- `e2e/ingest.spec.ts` — conditional multipart helper, 8 pinned call sites, `blobCount()`, 5 CAP-03 rows

## Decisions Made
- Task 1's `approve` decision was executed exactly as selected: single `0001` artifact; no schema change was re-opened.
- `bytes === undefined` → "omit the image part" (the plan's helper contract change); webp/svg rows and the raw multipart builder untouched; no pre-existing assertion edited.
- Blob-route ext resolution moved BEFORE `storage.stream` so a corrupt row never opens a volume handle; unknown/null-beside-key still answers the structured 500 (T-03-09 unchanged).
- Volume-write absence asserted at the artifact level via `docker compose exec -T api` file counts — consistent with the suite's existing docker-stack prerequisite (global-setup) and R-12's artifact-level assertion style; no host secret is read (the container resolves its own `WATCHBUG_DATA_DIR`).

## Deviations from Plan

None — plan executed exactly as written. (Two verification notes, not deviations: `db:generate` was run ONCE after the schema edit and produced `0001_messy_unicorn.sql` — its output was the migration creation, satisfying the fails_when "no schema changes"; the "imageless meta still sanitised/re-validated" must-have holds because `sanitizeAndValidate` is a single unconditional call site shared by both branches — the plan's own mitigation text names exactly the three rows that evidence it, all green.)

## Authentication Gates
None occurred.

## Issues Encountered
- Docker Desktop was not running at dispatch start; it was launched and its compose stack came up healthy before any DB assertion. Environment kept running (shared e2e stack) — consistent with the suite's assumption that the compose stack is up.
- Shared-ID requirement gate (#2388): CAP-03 is also declared by sibling plan 03-04 (client half), so `requirements.mark-complete` was intentionally skipped; the traceability row flips when 03-04's SUMMARY exists.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- 03-02 (JPEG lane) can add the `jpeg` arm to `CONTENT_TYPE_BY_EXT` and the client-facing sniff copy — the CHECK already admits `image/jpeg` and `EXT_BY_CONTENT_TYPE` inverts automatically; `STORAGE_KEY_REGEX` (`(webp|png)` tail) is 03-02's known remaining call-site.
- 03-04's degraded composer "Continue with text only" now lands a real 201 instead of a 400.
- No stubs, no placeholders, no known broken windows from this plan.

## Self-Check: PASSED
- All 8 key files + SUMMARY exist on disk (verified this session).
- All 3 task commits (`aa46faf`, `e00824d`, `4a7b8b0`) are ancestors of HEAD.
- `commits: 3` measured from the on-disk ledger `270c5763..HEAD`.

---
*Phase: 03-report-composer-annotation-editor-lazy*
*Completed: 2026-10-28*
