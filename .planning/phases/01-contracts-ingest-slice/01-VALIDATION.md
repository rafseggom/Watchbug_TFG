---
phase: "1"
slug: "contracts-ingest-slice"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-11"
validated: "2026-10-12"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Project verification policy R-12 (owner policy, stated twice):** "DONT MAKE A BUNCH OF
> TESTS. Only make e2e as necessary, not unit tests." There is NO unit-test suite, no
> per-function tests and no coverage thresholds in this project. The two artefacts below are
> the entire verification surface — `npm run check:size` (RNF-01/CA-03 size gate) and ONE
> Playwright e2e suite (`npm run verify`, CA-01..CA-05 on chromium + firefox + webkit).
> Task-level rows map to these two commands only; a task that cannot be proven by one of
> them needs a source-level `<acceptance_criteria>` assertion, not a new test framework.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@playwright/test` 1.63.0 (e2e only — R-12 forbids unit tests) |
| **Config file** | `playwright.config.ts` — three projects: chromium + firefox + webkit |
| **Quick run command** | `npm run check:size` |
| **Full suite command** | `npm run verify` |
| **Observed runtime** | ~4.5 minutes (123 tests × 3 browser projects; includes the 65 s ING-05 daily-quota window wait) |

---

## Sampling Rate

- **After every task commit:** Run `npm run check:size`
- **After every plan wave:** Run `npm run verify`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; the requirement rows below are the binding coverage map.
Every PLAN.md task inherits exactly one of these two commands plus source assertions.

> **Status refresh 2026-10-12 (validate-phase §6, State A).** The seed left planner task IDs
> `TBD-*`, `File Exists ❌ W0` and `Status ⬜ pending` because it was written before execution.
> The planner never assigned numeric task ids, so rows are keyed `W0-<REQ>` (the Wave 0
> verification artefact that proves each requirement) and the owning plan/wave is recorded in
> the Plan and Wave columns. Every status below is asserted by a **currently green** row of
> `npm run verify` — 123/123 across chromium + firefox + webkit on 2026-10-12.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| W0-DEP-01 | 01-01 | 1 | DEP-01 | — | N/A | e2e | `npm run verify -- e2e/deploy.spec.ts` (2 rows) | ✅ | ✅ green |
| W0-DEP-02 | 01-01 | 1 | DEP-02 | — | N/A | e2e | `npm run verify -- e2e/deploy.spec.ts` (4 rows) | ✅ | ✅ green |
| W0-ENR-06 | 01-01 | 1 | ENR-06 | T-01-SC | Payload must validate against `schema/report.schema.json` before insert | e2e | `npm run verify -- e2e/ingest.spec.ts` (row 85/92) | ✅ | ✅ green |
| W0-ING-01 | 01-01 | 1 | ING-01 | — | Transport carries only the public write-only `project_key` (SEC-03) | e2e | `npm run verify -- e2e/ingest.spec.ts` | ✅ | ✅ green |
| W0-ING-03 | 01-01 | 1 | ING-03 | T-01-SC | Idempotency key uniqueness enforced at the DB, not in app memory | e2e | `npm run verify -- e2e/ingest.spec.ts` (3 rows) | ✅ | ✅ green |
| W0-ING-04 | 01-03 | 3 | ING-04 | T-01-SC | Missing/invalid project key → structured 401, nothing stored | e2e | `npm run verify -- e2e/hostile.spec.ts` (2 rows) | ✅ | ✅ green |
| W0-ING-05 | 01-03 | 3 | ING-05 | T-01-SC | 429 + `Retry-After` per project key and per IP; daily per-project quota | e2e | `npm run verify -- e2e/hostile.spec.ts` (3 rows) | ✅ | ✅ green |
| W0-ING-06 | 01-02 | 2 | ING-06 | T-01-SC | Oversized body/image → 413; streaming counter, not `bodyLimit` alone | e2e | `npm run verify -- e2e/hostile.spec.ts` (5 layered rows) | ✅ | ✅ green |
| W0-ING-07 | 01-04 | 4 | ING-07 | T-01-SC | Stored text is sanitised and renders inert in the panel (no `dangerouslySetInnerHTML`) | e2e | `npm run verify -- e2e/hostile.spec.ts` (7 rows: pass 1 ×5, pass 2 DOM inertness, sink gate) | ✅ | ✅ green |
| W0-ING-08 | 01-03 | 3 | ING-08 | T-01-SC | Non-allowlisted origin rejected; CORS scoped to configured origins | e2e | `npm run verify -- e2e/hostile.spec.ts` (2 rows) | ✅ | ✅ green |
| W0-SIZE | 01-01 | 1 | RNF-01 / CA-03 | — | N/A | gate | `npm run check:size` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `playwright.config.ts` — three projects: chromium + firefox + webkit (webkit exercises the silent WebP→PNG fallback; firefox the no-`ImageCapture` path)
- [x] `e2e/deploy.spec.ts` — DEP-01, DEP-02 (compose up + `.env.example` completeness)
- [x] `e2e/ingest.spec.ts` — ENR-06, ING-01, ING-03 (happy-path tracer: fixture upload → row → image on volume → panel render)
- [x] `e2e/hostile.spec.ts` — ING-04, ING-05, ING-06, ING-07, ING-08 (hostile submissions)
- [x] `scripts/check-size.mjs` — RNF-01 tier gate on `node:zlib`, multi-artifact scenario (45 + 25 + 14 KB lanes)
- [x] `@playwright/test@1.63.0` + browsers install — `npx playwright install chromium firefox webkit`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docker-compose up` boots api + panel + db from a clean checkout with only `.env` copied from `.env.example` | DEP-01, DEP-02 | Container bootstrap on a dev machine is environment-dependent; the e2e suite asserts the running stack, not the first-boot ergonomics | `cp .env.example .env && docker-compose up -d` then open the panel URL |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s (per-task sampling path `npm run check:size` runs in seconds)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated — 2026-10-12

---

## Validation Audit 2026-10-12

Run by `/gsd-validate-phase 1` from `execute-phase` `verify:post`, State A (seed existed, `status: draft`).

| Metric | Count |
|--------|-------|
| Requirements in map | 11 |
| Gaps found (MISSING + PARTIAL) | **0** |
| Resolved | 0 (nothing to fill) |
| Escalated to manual-only | 0 new — the pre-existing `docker-compose up` first-boot row stands unchanged |
| Rows verified green | 11 / 11 |

**Why no auditor was spawned and no tests were generated:** Step 3 found zero gaps — each
requirement already has a real, currently-green automated artefact (evidence per row in the map
above). R-12 forbids adding tests beyond the one e2e suite, so "fill the gap" would have meant
creating a test framework this project has explicitly rejected twice.

**Observed vs seeded estimate:** the full suite now runs ~4.5 minutes, not the seeded ~120 s.
The delta is dominated by the ING-05 daily-quota row's deliberate 65 s window wait plus 123
tests × 3 browser projects. Not flaky, not watch-mode; recorded here so the Sampling Rate
section's 120 s figure is read as the per-task budget it was written as.

**Manual-only carried forward (unchanged, pre-existing):** clean-checkout first boot
(`cp .env.example .env && docker-compose up -d`) — environment-dependent ergonomics, outside
the two-artefact verification surface. The DEP-01/DEP-02 *requirement* rows themselves are
covered by `e2e/deploy.spec.ts` and remain green.
