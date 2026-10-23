---
gsd_state_version: "1.0"
current_phase: 02
current_phase_name: "SDK Tracer Bullet: Widget, Capture & Auto-Redaction"
status: executing
stopped_at: Completed 02-01-PLAN.md
last_updated: "2026-10-23T20:37:30.754Z"
last_activity: 2026-10-23
last_activity_desc: Phase 02 execution started
state_head: b00fe112f19ead1cd19080c57edc9c22d55b807e
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 9
  completed_plans: 5
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-13)

**Core value:** When a bug report lands, the developer can reproduce the bug from it — and neither the report nor its screenshot ever leaves the developer's own infrastructure.
**Current focus:** Phase 02 — SDK Tracer Bullet: Widget, Capture & Auto-Redaction

## Current Position

Phase: 02 (SDK Tracer Bullet: Widget, Capture & Auto-Redaction) — EXECUTING
Plan: 2 of 5
Status: Ready to execute
Last activity: 2026-10-23 — Phase 02 execution started

Progress: [█░░░░░░░░░] 14%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: n/a

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 01:45:00 | 3 tasks | 57 files |
| Phase 01 P02 | 40min | 3 tasks | 16 files |
| Phase 01 P03 | 37min | 3 tasks | 10 files |
| Phase 01 P04 | 45min | 3 tasks | 15 files |
| Phase 02 P01 | 45min | 3 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (R-01…R-17) and `documentation/resolution-record.md` §5 amendments (A-01…A-12 — §5 governs on conflict).
Recent decisions affecting current work:

- [Roadmap] PROJECT_MODE = mvp: every phase emits `**Mode:** mvp` and delivers an end-to-end demonstrable capability. Research build order compressed to 7 phases: contracts+skeleton merged into the ingest tracer; auth/projects split from triage/retention; edge-hardening merged into the release closeout.
- [Roadmap] Hard sequencing locked: `WidgetHost` isolation strategy and redaction ordering **T1** are fixed in Phase 2 (first build of the widget); **T2/T3** + the C-2 `Annotator` contract (one flattened bitmap, non-undoable masks, single `toBlob` sink) in Phase 3. R-12: verification is one Playwright suite (CA-01…CA-05) + `check:size` — no unit tests, ever.
- [Phase 1] Scope note: the hardened blob route ships here (C-3/C-4) but DEP-03's "served only through the authenticated API" completes in Phase 5 when auth exists. TTL columns land in the initial migration (M-1/A-02) to avoid schema retrofits.
- [Phase 4] INT-03's `custom` = init-scoped context riding every report (v1); distinct from ANN-V2-03 per-report custom fields (v2).
- [Phase 1 · OVERRIDE 2026-10-11 · decision-coverage gate] The `check.decision-coverage-plan` gate returned `passed: false, reason: could-not-parse` because CONTEXT.md's local decision IDs use the `P1-D-NN` grammar, which the parser does not support (it accepts `D-NN`, `D4-NN`, `D-NN — title`). Developer chose "Proceed — parser false positive": the gate's intent is already satisfied — the plan-checker's dimension-7 audit verified all 12 `P1-D-01…P1-D-12` decisions map to plan tasks with no deferred idea implemented and no scope reduction. No plan or CONTEXT.md change was made. **verify-phase must re-surface this:** if its decision-coverage counterpart reports the same `could-not-parse` on `P1-D-NN`, treat it as this same recorded false positive, not as a dropped decision.
- [Phase 2 · OVERRIDE 2026-10-18 · decision-coverage gate] Same gate, same verdict: `passed: false, reason: could-not-parse` on the `P2-D-NN` grammar (02-CONTEXT.md uses `P2-D-01…P2-D-12`, outside the parser's `D-NN` / `D4-NN` / `D-NN — title` forms). Resolved per the Phase 1 precedent above ("Proceed — parser false positive"): the plan-checker's dimension-7 audit verified all 12 `P2-D-01…P2-D-12` decisions map to plan tasks across 02-01…02-05 with no contradiction, no deferred idea implemented, and no scope reduction (P2-D-05's `selfBrowserSurface` ban explicitly honored; P2-D-01 `type:'bug'` shortcut and P2-D-04 no-locale strings map are the locked decisions themselves). No plan or CONTEXT.md change made. **verify-phase must re-surface this:** if its decision-coverage counterpart reports `could-not-parse` on `P2-D-NN`, treat it as this same recorded false positive, not as a dropped decision.
- [Phase 01]: A-13: five type-only @types/* devDependencies owner-approved to make npm run lint pass (question gate; recorded in documentation/resolution-record.md A-13)
- [Phase 01]: Q-08 tooling gate PASS under typescript 7.0.2 - the documented 6.x fallback was not taken
- [Phase 01]: rate-limit and cors plugins deferred to plan 01-03 per the plan's own artifact table (ING-05 is 01-03's requirement); installing them in 01-01 caused 429s that broke the e2e suite
- [Phase 01]: Hardening backend for 01-01 is the zero-dep structural strip/rebuild (P1-D-10 fallback); sharp stays 01-02's checkpoint
- [Phase 01]: Storage.put(bytes, ext, projectId) - the on-disk layout mandates the projectId segment (deviation vs research sketch put(bytes, ext))
- [Phase 01]: P1-D-10 backend decided at plan 01-02 Task 1: sharp@0.35.5 (owner sign-off) - root re-encode is the hardening control; the zero-dep structural strip moved to structure.ts as a pre-codec guard that no longer claims to be one
- [Phase 01]: multipart fieldSize raised from the researchs 4 KB to MAX_META_BYTES (64 KB): busboy truncates fields silently, so a contract-sized meta (note up to 5000 chars) could never parse at 4 KB
- [Phase 01]: busboy runs with preservePath: true - its default basename() rewrote ../../../etc/passwd.png to passwd.png before the C-4 rule could reject it
- [Phase 01]: 01-03: e2e rate-limit maxima 1200/600/2000 (local .env) - byKey and byDay share one bucket identity, so D>K is required to prove the per-key boundary and D<2K keeps the daily row to one 65s window wait; production defaults 10/30/2000 unchanged
- [Phase 01]: 01-03: ingest preHandler chain locked as bodyCaps(onRequest) -> ingestRateLimit -> originGate -> projectKeyGate -> handler (limits before CORS before key before any write); origin enforcement is route-level, @fastify/cors is app-level for headers/preflight
- [Phase 01]: 01-03: all three limiters increment before any 429 decision (rejected requests consume every quota); GET list no longer consults X-Project-Key - write-only key per H-7/DEP-03
- [Phase 01]: 01-04: toPlainText decodes sanitize-html's re-escapes only when the decoded value cannot re-open a tag (2 < 3 & 4 > 1 round-trips literally; entity-encoded payloads and <title> RCDATA stay escaped so no markup-shaped text reaches storage)
- [Phase 01]: 01-04: text caps count Unicode code points, not UTF-16 units - Zod 4.6.5 maxLength semantics (probe-verified), matching the published JSON Schema; the plan's code-units premise was corrected in the e2e rows, not in the contract
- [Phase 01]: 01-04: ingest order kept validate -> sanitise -> re-validate: post-sanitise re-validation guarantees a stored value never exceeds the cap it validated against (200 '&' stores as 200 chars)
- [Phase 01]: 01-04: empty-state e2e rows intercept GET /api/incidents with [] (shared stack is never empty); /api/setup, the EmptyState component and the emitted curl stay real, and one row spawns the emitted snippet verbatim (201 -> visible after reload)
- [Phase 01]: 01-04: meta JSON content-type defect closed - the multipart loop re-stringifies an object field back to JSON text (curl -F shape ingests 201); CA-01 schema untouched; deferred-items entry 1 marked RESOLVED
- [Phase 02]: Host element is an unregistered <watchbug-host>: customElements.define would mutate the page's global registry (pre-emptable by a hostile page) and WDG-03/04 forbid host-visible state; attachShadow works unregistered
- [Phase 02]: endpoint defaults from document.currentScript.src captured at module evaluation, falling back to document.baseURI origin - import.meta.url cannot survive the IIFE lane
- [Phase 02]: Open-mode e2e artifacts (watchbug.e2e.js/.mjs) are emitted by every npm run build as two extra core calls rather than an argv flag; check:size budgets by filename so the variant is outside the gate
- [Phase 02]: The shadow-root registry is populated only when SHADOW_MODE === 'open'; Playwright pierces via host.shadowRoot, so no second global exists even in the test build

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- ⚠ **Q-07 (Phase 5 planning must resolve — NOT execution):** key rotation semantics for PRJ-04 — grace period vs instant cut-off for a `public_key` embedded in already-shipped host script initialisations. Security-sensitive; decide at `/gsd-plan-phase 5`.
- **Q-05 (release gate):** degree-awarding institution's IP policy must be confirmed before the repo is public (R-07 Apache-2.0 + NOTICE).
- **UNVERIFIED at first build:** ~~`@fastify/multipart` ↔ Fastify 5 mapping~~ ✓ Phase 1 (e2e 132/132 green); ~~TS 7.x tooling ecosystem~~ ✓ Phase 1 (Q-08 gate PASS under typescript 7.0.2, no 6.x fallback); `preferCurrentTab` Firefox/Safari — still treat Chromium-only, resolves in Phase 2 capture work; `@node-rs/argon2` option names — resolves in Phase 5 (auth).
- **A-12/M-2 size arithmetic:** worst case 45+25+14 = 84 KB > 80 KB — multi-artifact `check:size` scenario lives in Phase 1; resolve against real numbers in Phase 7 (v1 ships core+editor = ≤70 KB; DOM-serialize adapter is v2).
- **Node 24 → 26 re-pin** scheduled after 2026-10-28 (one re-pin).
- **GDPR claims (M-1)** need legal/supervisor review before any public compliance statement.
- ⚠ **[Phase 1 deferred]** `npm audit`: 4 **moderate**, dev-only advisories in `drizzle-kit`'s `esbuild` chain (GHSA-67mh-4wv8-2f99). Runtime packages and shipped images unaffected. Only fix offered is `npm audit fix --force`, which downgrades `drizzle-kit` to 0.18.1 — needs an owner decision; schedule a dependency-upgrade run that re-verifies `drizzle-kit` against STACK.md first.
- **[Phase 1 context note]** `@fastify/busboy` basenames filenames by default — `preservePath: true` in `apps/api/.../caps.ts` is what makes the C-4 traversal-name rejection observable. Whoever touches multipart registration later must keep that option or the rule silently becomes a no-op.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261007-pm7 | Add reuse-first coding rule (R-18) and 4 Gemini review entries: CSP risk, IndexedDB fallback, orphan blob reconciliation, TS 6-vs-7 gate | 2026-10-07 | 8eafa1b | [261007-pm7-add-reuse-first-coding-rule-r-18-and-4-g](./quick/261007-pm7-add-reuse-first-coding-rule-r-18-and-4-g/) |
| 2 | Record phase 1 real start date (2026-10-11, delta +1 day) in Gantt variance tracker continuity-pack 7.1 | 2026-10-11 | 0e0af4d | — |
| 261014-m3v | S-2 â€” Add a scheduled TTL purge job so retention stops being decorative: at boot and on an interval, null out the user_* identity columns where identity_purge_at is due, and delete the row plus its Storage blob where artifact_purge_at is due, logging what was purged. Enforces R-09/R-10/RET-01-02. Files: new module apps/api/src/purge.ts, apps/api/src/app.ts, apps/api/src/db/schema.ts, docker-compose.yml, .env.example. | 2026-10-14 | 9f5ae66ed0da7169d264217132d53c87b6f024db | .planning/quick-batches/261014-m3u/items/261014-m3v-s-2-add-a-scheduled-ttl-purge-job-so-retention-stops-being-d |
| 261014-m3w | S-3 + S-6 server: per-IP read rate limit and keyset pagination for the read surface | 2026-10-14 | 35fc1bc | — |
| 261014-m3x | L-1 client + S-6 client: fix panel-side stopthatslop findings and harden the list read surface | 2026-10-15 | 338d84f | — |
| 261014-m3y | S-4 + S-5: CSP on the panel and R-08 path-only URLs in the contract | 2026-10-15 | abe0e9c | — |
| 261014-m3z | L-1 server: fix the server-side stopthatslop findings (abortable fetches, lazy sharp) | 2026-10-15 | a4b7396 | — |
| 261016-nnx | Fix api read rate-limit typecheck error: gate on isExceeded via discriminant narrowing | 2026-10-16 | f12e36d | [261016-nnx-fix-api-read-rate-limit-typecheck-error-](./quick/261016-nnx-fix-api-read-rate-limit-typecheck-error-/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| v2 scope | 15 v2 requirements (CAP-V2, ANN-V2, ENR-V2, TRI-V2, DEP-V2) + DOM-serialize capture adapter | Tracked in REQUIREMENTS.md | 2026-10-05 | v1 |
| Excluded | 13 explicit non-goals (integrations, replay, AI, SaaS, OAuth/SSO, multi-user, unit tests, …) | Hard-excluded | 2026-10-05 | — |

## Session Continuity

Last session: 2026-10-23T20:37:30.636Z
Stopped at: Completed 02-01-PLAN.md
Resume file: None
