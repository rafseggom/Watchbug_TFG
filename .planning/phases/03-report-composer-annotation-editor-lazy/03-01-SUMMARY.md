---
phase: 03-report-composer-annotation-editor-lazy
plan: 01
subsystem: api
tags: [drizzle, postgres, migration, fastify, cap-03, ingest]
status: in-progress
---

# Phase 03 Plan 01: Imageless Ingest + Single Schema Migration — Task 1 Decision Record

## Task 1: checkpoint:decision — RESOLVED BY OWNER

**Selected option id:** `approve` (exactly one, per acceptance criteria)
**Recorded:** 2026-10-28, owner-selected via the execute-phase orchestrator after the
`checkpoint:decision` (gate="blocking") was presented. This record is written to the plan
SUMMARY **before Task 2 runs**, as the task's acceptance requires.

**Decision text (verbatim from 03-01-PLAN.md):**
"Approve the content of migration `0001`: `incidents.storage_key` and `incidents.content_type`
become nullable (so CAP-03's text-only report is storable) and `incidents_content_type_check`
gains `'image/jpeg'` (P3-D-14), in ONE drizzle-kit-generated artifact."

**Option selected — `approve`:** "Approve -- one migration: nullable screenshot + CHECK admits
image/jpeg". Proceed path: "Task 2 generates `0001`, applies it with `db:migrate`, and proves
meta-only 201 and imageless 404 at the artifact level."

**Not selected:** `split` (two migrations; would have narrowed Task 2 to the two DROP NOT NULL
statements and moved the CHECK widening into 03-02) — not applicable. `stop` — not applicable.

**Consequence for downstream tasks:** Task 2 implements the full approved scope: nullable
`storageKey`/`contentType` plus `'image/jpeg'` in the CHECK, in ONE drizzle-kit-generated
migration artifact (`0001_*.sql` + `meta/0001_snapshot.json` + `meta/_journal.json`), never
hand-written, widening-only.

_(SUMMARY in progress — Tasks 2–3 pending; final content appended on plan completion.)_
