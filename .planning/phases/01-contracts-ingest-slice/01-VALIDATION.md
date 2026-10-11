---
phase: "1"
slug: "contracts-ingest-slice"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-11"
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
| **Config file** | `playwright.config.ts` — none yet; Wave 0 creates it (chromium + firefox + webkit projects) |
| **Quick run command** | `npm run check:size` |
| **Full suite command** | `npm run verify` |
| **Estimated runtime** | ~120 seconds (3 browser projects) |

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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-DEP-01 | TBD | 1 | DEP-01 | — | N/A | e2e | `npm run verify -- e2e/deploy.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-DEP-02 | TBD | 1 | DEP-02 | — | N/A | e2e | `npm run verify -- e2e/deploy.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-ENR-06 | TBD | 1 | ENR-06 | T-01-SC | Payload must validate against `schema/report.schema.json` before insert | e2e | `npm run verify -- e2e/ingest.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-ING-01 | TBD | 1 | ING-01 | — | Transport carries only the public write-only `project_key` (SEC-03) | e2e | `npm run verify -- e2e/ingest.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-ING-03 | TBD | 1 | ING-03 | T-01-SC | Idempotency key uniqueness enforced at the DB, not in app memory | e2e | `npm run verify -- e2e/ingest.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-ING-04 | TBD | 1 | ING-04 | T-01-SC | Missing/invalid project key → structured 401, nothing stored | e2e | `npm run verify -- e2e/hostile.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-ING-05 | TBD | 1 | ING-05 | T-01-SC | 429 + `Retry-After` per project key and per IP; daily per-project quota | e2e | `npm run verify -- e2e/hostile.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-ING-06 | TBD | 1 | ING-06 | T-01-SC | Oversized body/image → 413; streaming counter, not `bodyLimit` alone | e2e | `npm run verify -- e2e/hostile.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-ING-07 | TBD | 1 | ING-07 | T-01-SC | Stored text is sanitised and renders inert in the panel (no `dangerouslySetInnerHTML`) | e2e | `npm run verify -- e2e/hostile.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-ING-08 | TBD | 1 | ING-08 | T-01-SC | Non-allowlisted origin rejected; CORS scoped to configured origins | e2e | `npm run verify -- e2e/hostile.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-SIZE | TBD | 1 | RNF-01 / CA-03 | — | N/A | gate | `npm run check:size` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — three projects: chromium + firefox + webkit (webkit exercises the silent WebP→PNG fallback; firefox the no-`ImageCapture` path)
- [ ] `e2e/deploy.spec.ts` — DEP-01, DEP-02 (compose up + `.env.example` completeness)
- [ ] `e2e/ingest.spec.ts` — ENR-06, ING-01, ING-03 (happy-path tracer: fixture upload → row → image on volume → panel render)
- [ ] `e2e/hostile.spec.ts` — ING-04, ING-05, ING-06, ING-07, ING-08 (hostile submissions)
- [ ] `scripts/check-size.mjs` — RNF-01 tier gate on `node:zlib`, multi-artifact scenario (45 + 25 + 14 KB lanes)
- [ ] `@playwright/test@1.63.0` + browsers install — `npx playwright install chromium firefox webkit`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docker-compose up` boots api + panel + db from a clean checkout with only `.env` copied from `.env.example` | DEP-01, DEP-02 | Container bootstrap on a dev machine is environment-dependent; the e2e suite asserts the running stack, not the first-boot ergonomics | `cp .env.example .env && docker-compose up -d` then open the panel URL |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
