---
phase: 03-report-composer-annotation-editor-lazy
plan: 08
subsystem: testing
tags: [r-19, test-taxonomy, vitest, playwright, vrt, contract-testing, packaging-gate, conversion-ledger, coverage-audit]

# Dependency graph
requires:
  - phase: 03-report-composer-annotation-editor-lazy
    provides: the 152-declaration e2e suite this plan refactored (J-01..J-14 rows, composer, editor, transport)
  - phase: 01-contracts-ingest-slice
    provides: packages/contracts (Zod 4 schema + emitted schema/report.schema.json), check:size, check:compose, gate.mjs
  - phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
    provides: the capture/redaction rows and the hostile host fixture that J-14 and the VRT baseline reuse

provides:
  - a six-type test taxonomy, every type runnable today with a command and at least one real test
  - e2e suite structurally capped at ≤20 core journeys (14 in use), enforced by a failing test
  - a conversion ledger accounting for all 148 baseline declarations with one disposition each
  - R-19 recorded and consistently stated across every document that previously stated the R-12 absolute
  - a doc-consistency gate that turns the policy grep into a test
  - committed VRT baselines for the J-14 hostile-CSS widget surface

affects: [04, 05, 06, 07, any plan adding tests, release-gate configuration, CI matrix]

actuals:
  tokens: 200000
  tasks: 5
  commits: 14
  plan_head_before: 12db498
  plan_head_after: a7abdfb
  closeout_commits: 1

tech-stack:
  added:
    - "vitest 5.0.5 (single pinned devDependency; zero SDK runtime dependencies added)"
    - "playwright.vrt.config.ts — a second Playwright config, deliberately separate from verify"
  patterns:
    - "place each test in the cheapest layer that can still fail for the right reason"
    - "the e2e suite is a set of named journeys (test.describe 'J-NN — …'), capped structurally, not conventionally"
    - "policy documents are gated, not just grepped: an unqualified retired absolute fails the build"
    - "VRT baselines are text-free so one baseline serves every platform (no {platform} token)"
    - "a JSON-Schema-subset interpreter over the published artifact rather than a validator dependency"

key-files:
  created:
    - tests/vrt/j14-hostile-widget.spec.ts
    - tests/vrt/__screenshots__/chromium/launcher-display.png
    - tests/vrt/__screenshots__/chromium/launcher-zindex.png
    - playwright.vrt.config.ts
    - tests/contract/report-schema-agreement.test.ts
    - tests/packaging/doc-policy-consistency.test.ts
    - tests/packaging/journey-cap.test.ts
    - tests/packaging/deploy-contract.test.ts
    - tests/packaging/no-dangerouslySetInnerHTML.test.ts
    - tests/unit/{redaction-patterns,i18n-resolver,mask-geometry,sdk-meta,status-truncate,url-path,composer-text-clamp}.test.ts
    - tests/integration/{ingest-schema-validation,ingest-idempotency,ingest-auth-project-key,ingest-text-only,ingest-onboarding,hostile-size-caps,hostile-auth-rate-limit,hostile-sanitisation,read-surface-rate-limit,transport-retry,url-stripping}.test.ts
    - tests/contract/hostile-payload-control.test.ts
    - .planning/phases/03-report-composer-annotation-editor-lazy/03-08-CONVERSION-LEDGER.md
  modified:
    - e2e/sdk.spec.ts
    - e2e/hostile.spec.ts
    - e2e/ingest.spec.ts
    - package.json
    - vitest.config.mjs
    - playwright.config.ts
    - AGENTS.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md
    - .planning/STATE.md
    - documentation/resolution-record.md
    - documentation/continuity-pack.md
    - scripts/gate.mjs

key-decisions:
  - "R-19 amends R-12 rather than deleting it: the artifact-level security rule (CA-02 proven on the encoded bytes) and the no-coverage-vanity rule survive; only the 'never unit tests' absolute is replaced by six types with defined scopes and runners."
  - "e2e is capped structurally, not by convention: tests/packaging/journey-cap.test.ts fails if more than 14 widget journeys exist or if any e2e row lives outside a J-NN describe. 20 stays the hard maximum, J-15..J-20 reserved for Phases 4–7."
  - "VRT gets its own Playwright config so a pixel diff can never red a functional verify run. Baselines are the launcher control only (inline SVG, no text) so a single baseline serves Windows and Linux; {platform} is deliberately omitted."
  - "The contract test validates against the committed JSON artifact with a 60-line draft-2020-12 subset interpreter instead of adding ajv, and fails loudly on any keyword it cannot interpret rather than under-validating."
  - "Contract coverage is proven in both directions: every payload the artifact accepts, Zod accepts; every payload the artifact rejects, Zod rejects. Plus a re-emit deep-equal so the committed file cannot drift from the Zod schema."
  - "The ledger's five Task-1 rows (ids 1–5) are tracer-phase re-listings of rows 14/15/16/18 and 56, not extra coverage; 153 row ids therefore carry 148 distinct dispositions. Documented as a reconciliation table in the ledger rather than silently renumbered."
  - "Doc consistency is enforced by a test (tests/packaging/doc-policy-consistency.test.ts), not a remembered grep. Historical artifacts keep their original text and gain a supersession banner above it; the three quotes inside YAML frontmatter are reworded, because no banner can precede frontmatter without breaking it."
  - "test:packaging runs check:size + check:compose + the packaging suite but not a build: check:size already fails loudly when an artifact is missing, so a build would add ~10 s to every test:all run to re-prove something the gate already asserts."

patterns-established:
  - "Journey naming: every e2e block is test.describe('J-NN — <journey>'), one block per journey, no loose rows."
  - "Conversion discipline: a row leaves e2e only with a ledger entry naming its target file, and the target must import real production code."
  - "Policy text in prose gets a machine gate; a policy nobody verifies is a comment."
  - "Baseline portability: text-free VRT clips, no platform token, tolerant only where rasterisation actually differs."

requirements-completed: []

coverage:
  - id: D1
    description: "All six test types are runnable today, each with a command and at least one real non-vacuous test"
    verification:
      - kind: unit
        ref: "npm run test:unit — 59 passed"
        status: pass
      - kind: integration
        ref: "npm run test:integration — 65 passed"
        status: pass
      - kind: integration
        ref: "npm run test:contract — 26 passed"
        status: pass
      - kind: e2e
        ref: "npm run test:vrt — 2 passed"
        status: pass
      - kind: other
        ref: "npm run test:packaging — check:size + check:compose + 18 vitest"
        status: pass
      - kind: e2e
        ref: "npm run verify — 279 passed on chromium + firefox + webkit"
        status: pass
    human_judgment: false
  - id: D2
    description: "e2e reduced from 148 declarations to 14 named core journeys (93 instances per engine), with the ≤20 cap enforced structurally"
    verification:
      - kind: unit
        ref: "tests/packaging/journey-cap.test.ts#the widget subset is exactly J-01..J-14 — no duplicates, never more than 14"
        status: pass
      - kind: e2e
        ref: "npm run verify — 279 passed, 0 skipped"
        status: pass
    human_judgment: false
  - id: D3
    description: "VRT baseline committed for the J-14 hostile-CSS widget surface (display and zindex variants) and green on re-run"
    verification:
      - kind: e2e
        ref: "tests/vrt/j14-hostile-widget.spec.ts#J-14 hostile-CSS launcher surface — display variant"
        status: pass
      - kind: e2e
        ref: "tests/vrt/j14-hostile-widget.spec.ts#J-14 hostile-CSS launcher surface — zindex variant"
        status: pass
    human_judgment: false
  - id: D4
    description: "Contract test proves the Zod schema and the emitted JSON Schema agree and rejects a deliberately-invalid payload"
    verification:
      - kind: integration
        ref: "tests/contract/report-schema-agreement.test.ts — 20 tests, incl. re-emit deep-equal and 9 rejections"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run test:packaging runs the existing gates and still fails when a size tier is breached (45/25/80 unchanged)"
    verification:
      - kind: other
        ref: "npm run test:packaging — PASS; with core artificially at 5 KB it exits 1 before vitest runs"
        status: pass
    human_judgment: false
  - id: D6
    description: "No document states the retired R-12 absolute without an R-19 marker; AGENTS.md, ROADMAP, REQUIREMENTS, PROJECT and the resolution record tell one story"
    verification:
      - kind: other
        ref: "tests/packaging/doc-policy-consistency.test.ts — 63 quotes across 28 files, 0 unqualified"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every one of the 148 baseline e2e declarations has exactly one disposition in the conversion ledger"
    verification:
      - kind: other
        ref: "ledger row audit: ids 1..153 contiguous, 0 missing, 0 duplicate ids, 0 without a disposition; 153 - 5 tracer re-listings = 148 = 57 converted + 90 kept + 1 justified-redundant"
        status: pass
    human_judgment: true
    rationale: "The Task-3a section of the ledger paraphrases sdk.spec.ts titles by requirement code rather than quoting them verbatim, so a string-matching audit confirms 116/146 by title and cannot mechanically confirm the rest. The id-level audit is complete and every row carries a disposition plus a target, but a human should spot-read the sdk section before treating the coverage claim as final."

duration: 3h 52m
completed: 2026-10-29
status: complete
---

# Phase 3 Plan 8: Test-Suite Refactor to a Six-Type Taxonomy Summary

**The 453-instance e2e monolith became 14 named core journeys (279 instances) with 143–168 fast vitest tests behind it, R-19 amending R-12 across every document that stated the old absolute — and every disposition of the 148 baseline tests recorded in a ledger.**

## Performance

- **Duration:** 3h 52m (`792ab96` 14:21 → `a7abdfb` 18:13, across two sessions)
- **Tasks:** 5 of 5
- **Commits:** 13 during execution + 1 closeout docs commit
- **Files changed:** 72 (`git diff --shortstat 12db498..HEAD`)

## Before / After

| Metric | Before | After |
|---|---|---|
| e2e source declarations | 148 | 14 journeys (J-01..J-14) |
| e2e instances (3 engines) | 453 | 279 (93 per engine) |
| e2e wall clock | — | 4.0 min |
| vitest tests | 0 | 168 (unit 59 · integration 65 · contract 26 · packaging 18) |
| VRT baselines | 0 | 2 (chromium, J-14 launcher) |
| `test:*` commands | 2 | 6 (+ `test:all`) |
| Structural cap | none | `≤20` journeys, enforced by a failing test |

At the end of Task 3 (the conversion waves) vitest stood at 143; Task 4 added the 20 contract-agreement and 5 doc-consistency tests that brought it to 168.

## Conversion Ledger

`57 converted + 90 kept-in-journey + 1 justified-redundant = 148` baseline declarations.

- **Converted (57)** — re-homed to `tests/integration/` (ingest, hostile, read-surface, transport), `tests/unit/` (redaction, i18n, mask geometry, sdk-meta, status clamp, url path), `tests/contract/`, and `tests/packaging/` (the deploy contract).
- **Kept (90)** — remain as rows inside J-01..J-14 because they genuinely need a browser: shadow-DOM isolation, canvas pixels read out of the decoded image, capture API behaviour, hostile-CSS geometry, i18n rendering.
- **Justified-redundant (1)** — the ingest i18n default, covered by J-12.

The disposition tables carry 153 numbered ids; ids 1–5 are Task-1 tracer rows re-listed by Batch 2a/2b, and the ledger now names each re-listing explicitly so `153 − 5 = 148` is checkable rather than asserted.

## The Six Types, As Runnable Commands

| # | Type | Command | Count |
|---|---|---|---|
| 1 | Unit | `npm run test:unit` | 59 |
| 2 | Integration | `npm run test:integration` | 65 |
| 3 | E2E (≤20 journeys) | `npm run verify` | 279 instances / 3 engines |
| 4 | VRT | `npm run test:vrt` | 2 baselines |
| 5 | Contract | `npm run test:contract` | 26 |
| 6 | Packaging / environment | `npm run test:packaging` | 13 gate tests + 5 doc-policy |
| — | all of them | `npm run test:all` | 168 + 2 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] The doc-consistency grep was a remembered command, not a gate**
- **Found during:** Task 5
- **Issue:** The plan specified a grep as the consistency check. A grep nobody runs on the next change is exactly the failure mode the plan's own threat register (T-03-34) names, and the earlier case-sensitive grep had already missed capitalised variants ("NO unit tests", "No unit tests introduced") in three quick-batch plans.
- **Fix:** Added `tests/packaging/doc-policy-consistency.test.ts` — scans AGENTS.md, `documentation/`, `scripts/` and `.planning/` (63 quotes across 28 files), requires a supersession marker before every quote (or on the same line), asserts each exemption carries a substantive reason, and asserts the four governing documents agree.
- **Files modified:** `tests/packaging/doc-policy-consistency.test.ts` (new)
- **Verification:** 5 tests pass; the case-insensitive gate caught 10 files the case-sensitive grep missed.
- **Committed in:** `a7abdfb`

**2. [Rule 1 — Bug] The plan's grep scope missed a fifth location**
- **Found during:** Task 5 (flagged in the dispatch brief)
- **Issue:** `scripts/gate.mjs` lines 5–6 stated "R-12 abolishes unit tests and coverage thresholds" — outside the plan's `AGENTS.md .planning documentation` scope. Two more live documents had the same problem: `playwright.config.ts` line 5 ("R-12: one Playwright suite, no unit tests") and `documentation/continuity-pack.md:144`, plus `.planning/PROJECT.md:75` which is the source of the AGENTS.md project block.
- **Fix:** All four rewritten to state R-19 and what R-12 still contributes.
- **Files modified:** `scripts/gate.mjs`, `playwright.config.ts`, `documentation/continuity-pack.md`, `.planning/PROJECT.md`
- **Verification:** doc-policy gate green; the four governing documents each match `R-19` plus an amendment phrase.
- **Committed in:** `a7abdfb`

**3. [Rule 1 — Bug] Historical banners could not precede three frontmatter quotes**
- **Found during:** Task 5
- **Issue:** `02-03-SUMMARY.md:38`, `02-04-SUMMARY.md:38`, `03-02-SUMMARY.md:53` and `261016-nnx-PLAN.md:18` quote the absolute inside YAML frontmatter (`key-decisions`). A banner inserted at the top of the body lands *after* the quote, and one before the frontmatter breaks YAML parsing.
- **Fix:** Reworded those four frontmatter values to record the policy as time-bound ("existed then … amended by R-19") instead of absolute.
- **Files modified:** the four files above
- **Verification:** a frontmatter-aware check confirms every banner sits after the closing `---`.
- **Committed in:** `a7abdfb`

**4. [Rule 1 — Bug] First banner pass injected markdown into YAML frontmatter**
- **Found during:** Task 5 (self-caught before commit)
- **Issue:** The first script inserted the banner after the first `^#+ ` line, which in files with long frontmatter is a YAML comment (`# status lifecycle:`, `# Dependency graph`), corrupting the frontmatter block in 18 files.
- **Fix:** Reverted all 18 files and re-ran with a frontmatter-aware insertion point (body start). Verified programmatically that the banner line index exceeds the frontmatter close index in every affected file.
- **Files modified:** the 18 historical artifacts
- **Verification:** `ALL FRONTMATTER INTACT` check across the affected files.
- **Committed in:** `a7abdfb`

**5. [Rule 1 — Bug] Ledger summary table did not reconcile with its own row ids**
- **Found during:** Task 5 ledger audit
- **Issue:** The disposition tables carry 153 numbered rows while the summary says 148. Rows 1–5 (Task 1, tracer) are the same five tests Batch 2a/2b lists again in full; row 1 additionally attributes the R-08/S-5 url-strip row to `ingest.spec.ts` when the baseline places it in `hostile.spec.ts` (row 56 is correct). One row also had its disposition cell bolded, defeating a machine read.
- **Fix:** Added a reconciliation table naming each of the five re-listings, normalised the bolded cell, and recorded the audited arithmetic (`153 − 5 = 148`).
- **Files modified:** `03-08-CONVERSION-LEDGER.md`
- **Verification:** row audit — ids 1..153 contiguous, 0 missing, 0 duplicate ids, 0 rows without a disposition or target.
- **Committed in:** `a7abdfb`

**6. [Rule 3 — Blocking] `test:vrt` pointed at a directory the default config could not serve**
- **Found during:** Task 4
- **Issue:** `test:vrt` was `playwright test tests/vrt` while `playwright.config.ts` sets `testDir: 'e2e'` and a globalSetup that assumes the compose stack — the command would have resolved nothing meaningful and shared the functional suite's lifecycle.
- **Fix:** Added `playwright.vrt.config.ts` (own `testDir`, own snapshot template, chromium only, workers 1) and pointed `test:vrt` at it with `-c`.
- **Files modified:** `package.json`, `playwright.vrt.config.ts`
- **Verification:** 2 baselines written, then 2 passed on a clean re-run.
- **Committed in:** `aa5b4bb`

### Deliberate deviations (documented, not auto-fixed)

**`test:packaging` does not run a build.** The plan said "check:size + check:compose (and, cheaply, the build)". `check-size.mjs` already fails with `artifact missing (run "npm run build" first)`, so a build would add ~10 s to every `test:all` and re-prove what the gate asserts. Left out, rationale recorded in the SUMMARY and in this plan's commit.

---

**Total deviations:** 6 auto-fixed (4 bugs, 1 missing critical functionality, 1 blocking) + 1 deliberate.
**Impact on plan:** No scope creep into product code — every change is in the verification layer. The doc-policy gate (#1) is the one addition beyond the letter of the plan, and it exists to keep deviation #2 from recurring.

## Issues Encountered

- The baseline inventory file is doubly mojibaked (UTF-8 carried through a latin-1 stream) and two declarations are template literals, which defeated three attempts at a title-level audit. Resolved by fingerprint matching; the residual limitation is recorded as `human_judgment: true` on D7 rather than papered over.
- `git grep` is case-sensitive, so the plan's grep missed capitalised variants of the retired absolute. The test-based gate is case-insensitive and found them.

## Verification Evidence

```
npm run verify            → 279 passed (4.0m), 0 failed, 0 skipped (chromium + firefox + webkit)
npm run test:all          → unit 59 · integration 65 · contract 26 · vrt 2 · packaging 18, all green
npm run gate              → gate.mjs summary: 5 passed, 0 failed, 0 skipped
npm run check:size        → core 17.2 (45) · lazy 6.8 (25) · lazy-floor OK · adapter 0.3 (14) · runtime 24.4 (80) — PASSED
test:packaging breach     → core limit temporarily 5 KB: "SIZE FAIL core 17.2 KB gz / 5 KB", exit 1, vitest never ran; reverted
test:vrt non-vacuity      → baseline moved aside: "A snapshot doesn't exist at …launcher-display.png", exit 1; restored
doc consistency           → 63 quotes across 28 files, 0 files without a preceding or inline R-19 marker
journey cap               → 14 journeys declared, ≤20 enforced, J-15..J-20 reserved
```

## Known Stubs

None. Every type has a real test against real production code; no placeholder assertions, no skipped tests, no unrun verifications.

## Threat Flags

None. This plan touches only the verification layer: no new network endpoints, auth paths, file-access patterns or schema changes at a trust boundary. `schema/report.schema.json` is read by the contract test but never regenerated here (its working-tree CRLF difference was deliberately left unstaged).

## Next Phase Readiness

- Every type is runnable and green; `npm run test:all` is the single command that covers the matrix.
- The e2e cap is a failing test, so Phase 4 cannot quietly add a 15th journey without editing the reserved-range assertion deliberately.
- VRT is seeded with the hostile surface only. Adding webkit for canvas surfaces (J-05/J-06) was deferred until those baselines are proven stable — that is a Phase 4+ decision, not an omission.
- `.planning/phases/03-.../03-VERIFICATION.md` and `watchbugus-fun/` remained untracked throughout, per the dispatch brief.

## Self-Check: PASSED

- `playwright.vrt.config.ts` — FOUND
- `tests/vrt/j14-hostile-widget.spec.ts` — FOUND
- `tests/vrt/__screenshots__/chromium/launcher-display.png` — FOUND
- `tests/vrt/__screenshots__/chromium/launcher-zindex.png` — FOUND
- `tests/contract/report-schema-agreement.test.ts` — FOUND
- `tests/packaging/doc-policy-consistency.test.ts` — FOUND
- Commit `aa5b4bb` (Task 4) — ancestor of HEAD
- Commit `a7abdfb` (Task 5) — ancestor of HEAD

---
*Phase: 03-report-composer-annotation-editor-lazy*
*Completed: 2026-10-29*
