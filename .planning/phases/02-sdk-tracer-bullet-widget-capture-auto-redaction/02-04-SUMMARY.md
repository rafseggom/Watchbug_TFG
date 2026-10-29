---
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
plan: 04
subsystem: sdk
tags: [redaction, privacy, pattern-catalog, luhn, bitmap-geometry, hidpi, fail-closed, e2e, prv-01, prv-02, prv-03, h-1, p2-d-07, p2-d-08, p2-d-09, t1-ordering, ca-02]

# Dependency graph
requires:
  - phase: 01-contracts-ingest-slice
    provides: "the compose stack (`/api/health`, ingest 201), `MASK_ALPHA_OPAQUE` (255) in `@watchbug/contracts/constants`, `scripts/gate.mjs` with its `sdk-no-host-storage` rule, and the one-Playwright-suite conventions"
  - phase: 02-02 (widget + tracer pipeline)
    provides: "the ordered `runCaptureFlow` (hide → capture → probe → **redact** → encode → send), the SEC-01 structural families (`input[type=password]`, `[data-watchbug-sensitive]`) and `redact/geometry.ts` outward rounding"
  - phase: 02-03 (capture fidelity)
    provides: "the two-tier capture stub (with the `[data-capture-marker]` paint), the fetch-boundary `readOutgoingImage()` recorder, `interceptIncidentPosts` pass-through, `analyzeImagePixels`-style in-page decode, and the loud-failure row idioms (`expectNoRequest`, `CAPTURE_HINT`)"
provides:
  - "the complete P2-D-07 catalog in `redact/patterns.ts`: JWT dotted-triple, bearer-token shape, `key=`/`token=`/`secret=`/`password=` assignments, card runs gated by a hand-rolled `luhnValid()` (PRF-04, zero deps), each matched in text nodes AND form-control values"
  - "whole-text-node masking (`TreeWalker` + `range.getClientRects()` unioned to ONE rect per node) and whole-element masking for structural/value families — P2-D-08 granularity, P2-D-09 conservative over-masking"
  - "**the security property, asserted per family at the artifact level:** the decoded bytes that left the browser contain none of the sensitive original pixel values inside the masked rect OR on its 1-px boundary ring — password fields, JWT, bearer, assignments, Luhn-valid cards (with a Luhn-invalid control that provably stays visible), `data-watchbug-sensitive`, a HiDPI case at devicePixelRatio 1/1.25/2/3 (incl. non-integer 1.25), and the fail-closed path (zero `POST /api/incidents` attempts)"
  - "fail-closed redaction: any DOM-scan/geometry error short-circuits in `pipeline.ts` BEFORE encode/send into the loud capture-failed terminal state (T-02-10) — the pipeline never falls open to unredacted bytes"
  - "H-1 bitmap-space geometry proven across DPR: rows capture at frames of `viewport × dpr` (1280×720 … 3840×2160, the dpr-3 case clamped to 2560×1440 by the encode ladder) and re-derive the expected rect from the decoded output's own scale"
affects: [02-05 (privacy/purge closeout runs the same suite), phase-3 annotator T2/T3 user masks reuse `geometry.ts` outward rounding, phase-4 C-5 scrubber must keep the same four families + Luhn rule, phase-7 release gate re-runs the PRV/H-1 rows]

# Actuals (#2632) — pairs with the plan's `estimate` (44000 tokens / 3 tasks)
actuals:
  tokens: 12100
  tasks: 3
  commits: 5
  plan_head_before: 8e254f849be15f16cbaf0b50dd06683c77e6d01c
  plan_head_after: 03f53b08cfd78214ca95a1d169ba8819afe7e006

# Tech tracking
tech-stack:
  added: ["none — zero new dependencies (RNF-01 / PRF-04): the catalog is 4 regexes + a 15-line Luhn check, the proof decodes in-page with `createImageBitmap` + canvas"]
  patterns:
    - "CA-02-style artifact proof without a reference image: both capture stubs paint `#ff00ff` over `[data-capture-marker]`'s viewport rect (same outward rounding as the redactor), so 'zero marker-coloured pixels inside the expected rect' IS the original-pixels-absent proof — and lookalike/negative-control rows prove the marker survives (and this analysis finds it) when nothing masks"
    - "fixture secrets styled `line-height: 1` so the element rect (what the stub paints) sits inside the text-node rect (what the redactor masks) — probe-verified on all three engines; `line-height: 1.5` inverts the relationship and legitimate marker pixels would survive"
    - "expected-mask rect computed from the DECODED output's own scale (`bitmap.width / viewport.width`), so ladder resamples (dpr-3 clamp) stay correctly registered"
    - "RED-first e2e under R-12: the failing row itself is the RED (`test(02-04): …` + `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`), no unit-test runner existed then (amended by R-19)"

key-files:
  created:
    - packages/sdk/src/redact/patterns.ts
    - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-04-red-evidence-task1.json
    - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-04-red-evidence-task3.json
  modified:
    - packages/sdk/src/redact/redactor.ts
    - packages/sdk/src/capture/pipeline.ts
    - e2e/sdk.spec.ts

key-decisions:
  - "Pitfall 1 resolved by WORDING, not exemption: the bearer shape is spelled `Beare[r]` and SEC-03 comments stay generic ('host cookies, storage or auth headers'), so `gate.mjs sdk-no-host-storage` is green with the catalog present and `scripts/gate.mjs` was NOT modified — the plan's preferred strategy, its exemption fallback never triggered"
  - "fail-closed reuses the LOCKED capture-failure state (`failed{capture}` → \"Couldn't capture the screen.\" + \"Nothing was sent…\" hint): the UI-SPEC copy set has no redaction headline and `status-panel.ts`/`strings.ts` are outside this plan's file scope; dedicated copy, if wanted, belongs with the Phase 3 composer"
  - "each family group is recorded twice (`text-node` + `input-value` records) so `PatternFamily.source` keeps its literal meaning while covering both P2-D-07 detection surfaces; assignment matching has NO leading word boundary (`api_key=` must match as `key=`) — recall over precision per P2-D-09"
  - "H-1 rows capture at `frame = viewport × devicePixelRatio` (1 / 1.25 / 2 / 3) — the real HiDPI geometry — and pin the expected output width (1280 / 1600 / 2560 / 2560-when-clamped); the dpr-1 row pins `deviceScaleFactor: 1` explicitly because Playwright's `Desktop Safari` descriptor defaults to DSF 2 (discovered when the webkit row failed its own non-vacuity assert)"
  - "non-vacuity is split: masked rows assert zero original pixels + flat-fill interior + untouched control region; the JWT-lookalike and Luhn-invalid rows assert the marker pixels SURVIVE — together they make 'the original pixels are gone' non-accidental"
  - "Task 2 produced no RED commit: the full four-group catalog shipped in Task 1's GREEN (plan-split deviation below), so every Task 2 row passed on first run — per `tdd.md` fail-fast rule the feature was investigated as already existing, and RED was not fabricated"

patterns-established:
  - "requirement-ID row titles for privacy contracts (`PRV-01:`, `PRV-02:`, `PRV-03:`), one artifact row per family, each decoding the outgoing image at the fetch boundary"
  - "`analyzeRedaction()` — in-page region accounting (magenta = original, black = flat fill) over the expected rect, its 1-px ring, and a control region; `expectMaskedAndTargeted()` / `expectStillVisible()` are the two assertion poles"
  - "e2e provocations ride document-start init scripts keyed into `data-wb-stub-invoked` (now `redaction-scan-failure`), so a refusal/failure cannot pass vacuously"

requirements-completed: [PRV-01, PRV-02, PRV-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "PRV-01 — an input[type=password] value masks at the full element rect; decoded outgoing bytes carry zero original pixels inside the rect and its 1-px boundary ring, control region keeps its pixels"
    requirement: PRV-01
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#PRV-01: an input[type=password] value masks at the full element rect (`npm run verify -- e2e/sdk.spec.ts`, 3 engines)"
        status: pass
      - kind: other
        ref: "source assertion `redact/redactor.ts` (`SENSITIVE_SELECTOR` → element rect → `fillRects` with `MASK_ALPHA_OPAQUE`)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PRV-02 — the complete P2-D-07 catalog masks per family at the artifact level: JWT pair (shape masks / lookalike stays visible), bearer shape, key=/token=/secret=/password= assignments, Luhn-valid card masked with its Luhn-invalid lookalike provably visible"
    requirement: PRV-02
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#PRV-02 x6 (JWT shape, JWT lookalike, bearer, assignments, card+Luhn-negative) (`npm run verify -- e2e/sdk.spec.ts`, 3 engines)"
        status: pass
      - kind: other
        ref: "source assertion `redact/patterns.ts` exports `luhnValid` + four family groups (jwt, bearer, assignment, card)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PRV-03 — a data-watchbug-sensitive element masks at the full element rect, decoded bytes carry zero original pixels inside the rect and its ring"
    requirement: PRV-03
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#PRV-03: a data-watchbug-sensitive element masks at the full element rect (3 engines)"
        status: pass
    human_judgment: false
  - id: D4
    description: "H-1 — the same known secret masked at devicePixelRatio 1 / 1.25 (non-integer) / 2 / 3 with zero original pixels in the rect and its 1-px boundary ring at every scale; dpr-3 exercises the mask-before-clamp order (frame 3840×2160 → 2560×1440 output)"
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#H-1 x4 (`npm run verify -- e2e/sdk.spec.ts`, 3 engines)"
        status: pass
      - kind: other
        ref: "source assertion `redact/geometry.ts` (`Math.floor` on x/y origins, `Math.ceil` on extent terms)"
        status: pass
    human_judgment: false
  - id: D5
    description: "P2-D-08 — a partially-matching text node masks its WHOLE rect: the unmatched substring's original pixels are absent too (whole-node granularity, never the matched substring alone)"
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#P2-D-08: a partially-matching text node masks its whole rect (3 engines)"
        status: pass
      - kind: other
        ref: "source assertion `redact/redactor.ts` (one union rect per matched text node from `range.getClientRects()`)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Fail-closed redaction (T-02-10) — a simulated DOM-scan error lands in the loud capture-failed state (alert role + locked hint + actions) with zero POST /api/incidents attempts after a 600 ms settle, proven non-vacuously (capture stub observed, provocation fired)"
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#fail-closed: a redaction scan error lands in the loud capture-failed state with zero POST attempts (3 engines)"
        status: pass
      - kind: other
        ref: "source assertion `capture/pipeline.ts` (`try { redactor.redact(image) } catch → failed{capture} → return` placed before the encode try and `deliver`)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Pitfall 1 / static privacy gate — `node scripts/gate.mjs` (all 3 SDK rules) and `gate.mjs sdk-no-host-storage` stay green with the completed catalog present; no exemption was added (wording strategy)"
    verification:
      - kind: other
      ref: "`node scripts/gate.mjs` → 3 passed, 0 failed, 0 skipped PASSED; `node scripts/gate.mjs sdk-no-host-storage` → PASS (15 SDK files clean)"
      status: pass
    human_judgment: false
  - id: D8
    description: "Plan gates — workspace build, RNF-01 size tiers, lint/typecheck, and the three-engine suite (45 rows × 3 = 135)"
    verification:
      - kind: other
      ref: "`npm run build` exit 0; `npm run check:size` → runtime 9.1/80 KB PASSED; `npm run lint` exit 0; `npm run verify -- e2e/sdk.spec.ts` → 135 passed"
      status: pass
    human_judgment: false
  - id: D9
    description: "Privacy prohibition (must_haves): masking never uses reversible or visual-only primitives — no blur, no CSS overlay, no semi-transparent fills; the only automatic primitive is flat opaque pixel destruction (alpha 255) burned in before encode"
    verification: []
    human_judgment: true
    rationale: "The plan marks this prohibition `verification: judgment`. The artifact rows prove destruction per family, but the global claim — no reversible/visual-only primitive anywhere in the SDK — needs human sign-off at verify-work, as the plan requires."

metrics:
  duration: 50min
  completed: 2026-10-24
  status: complete
---

> **Superseded by R-19 (2026-10-29):** this document predates the six-type test taxonomy.
> Every "no unit tests / never unit tests / DONT MAKE A BUNCH OF TESTS / no other test
> artefact" statement in it is a **historical record of R-12 as it stood then** — not current
> policy. Current policy lives in `AGENTS.md` → *Testing & QA* and `.planning/REQUIREMENTS.md`
> (R-19 amends R-12; artifact-level security evidence and the no-coverage-vanity rule survive).


# Phase 2 Plan 4: Auto-Redaction Catalog & Artifact-Level Privacy Proof Summary

**The full P2-D-07 catalog (password inputs, JWT/bearer/assignment/Luhn-card text patterns, `data-watchbug-sensitive`) destructively flat-fills the `ImageData` before any encode, and every family is proven the CA-02 way — decode the bytes that left the browser and find zero original pixels inside the masked rect and on its 1-px boundary ring — at devicePixelRatio 1/1.25/2/3, with a Luhn-invalid control that provably stays visible and a fail-closed redaction path that sends nothing on error: 135/135 e2e green on chromium + firefox + webkit, `gate.mjs` 3 PASS (no exemption needed), `check:size` PASSED (runtime 9.1/80 KB), lint exit 0.**

## Security Property Owned by This Plan

> **The decoded bytes that left the browser contain none of the sensitive original pixel values inside the masked rect OR on its 1-px boundary ring — asserted per family (PRV-01 password fields, PRV-02 JWT / bearer / assignment / Luhn-valid card shapes, PRV-03 `data-watchbug-sensitive`), including a HiDPI case (devicePixelRatio 1 / 1.25 / 2 / 3, non-integer scale included) and the fail-closed path (a redaction error ⇒ zero `POST /api/incidents` attempts — nothing unredacted can ever leave).**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-10-24T12:53:31Z
- **Completed:** 2026-10-24T13:45Z
- **Tasks:** 3 (all carry `tdd="true"`; see "TDD Gate Compliance")
- **Files modified:** 6 (3 SDK/e2e code + 2 RED-evidence records + ledger-side `pipeline.ts`), 0 deleted

## Accomplishments

- **Task 1 (`0214ba5` RED → `b1ebf13` GREEN): JWT family end-to-end at the artifact level.** New `redact/patterns.ts` defines the `PatternFamily { id, regex, source, validate? }` shape with the JWT dotted-triple family (text nodes + input values); `redactor.ts` gained the `TreeWalker` text-node scan that masks the union of `range.getClientRects()` — ONE rect per whole text node (P2-D-08) — through the existing outward-rounded `toBitmapRect()` fill. The new `analyzeRedaction()` in-page analysis decodes the outgoing bytes and counts original-marker pixels vs flat-fill pixels over the expected rect, its 1-px ring, and a control region. RED was genuine: **2464 original pixels survived inside the expected rect** (`RED_EVIDENCE_OK`); GREEN leaves **zero**, with the lookalike control row proving the marker machinery non-vacuously.
- **Task 2 (`e17241b`): the complete P2-D-07 catalog + per-family rows (PRV-01/02/03).** Five new artifact rows: password input (element rect), bearer-token shape, `key=`/`token=`/`secret=`/`password=` assignments, **Luhn-valid card masked + Luhn-invalid lookalike visible** (marker pixels survive the decode — the plan's negative sub-assertion), and `data-watchbug-sensitive` (element rect). `luhnValid()` is hand-rolled (~15 lines, PRF-04 — no dependency). Pitfall 1 resolved honestly by **wording** (`Beare[r]` spelling, generic SEC-03 comments): `gate.mjs sdk-no-host-storage` is green with the catalog present and **no exemption was added** — `scripts/gate.mjs` is untouched. TDD note: no RED commit here (see Deviations — the catalog shipped in Task 1's GREEN).
- **Task 3 (`274b6a3` RED → `03f53b0` GREEN): H-1 geometry across DPR, whole-node granularity, fail-closed redaction.** Four `H-1:` rows capture at explicit frames of `viewport × dpr` (1280×720, 1600×900, 2560×1440, 3840×2160→clamped 2560×1440) and assert the boundary ring is clean at every scale, with the expected rect re-derived from each decoded output's own scale; the `P2-D-08:` row proves a partially-matching text node masks its whole rect; the `fail-closed:` row provokes a DOM-scan error through an init-script seam and (GREEN) finds the loud capture-failed state with **zero POST attempts** — `pipeline.ts` now wraps `redactor.redact(image)` in a fail-closed handler before encode/send. RED was genuine (panel stuck on `Capturing…`, `RED_EVIDENCE_OK`).

## Task Commits

Each task was committed atomically (TDD RED → GREEN where behavior was missing):

1. **Task 1: JWT family end-to-end artifact proof** - `0214ba5` (test — RED, `RED_EVIDENCE_OK`) + `b1ebf13` (feat)
2. **Task 2: full catalog + PRV-01/02/03 artifact rows** - `e17241b` (test — no RED; behavior already shipped, see TDD Gate Compliance)
3. **Task 3: H-1 DPR rows + fail-closed redaction** - `274b6a3` (test — RED, `RED_EVIDENCE_OK`) + `03f53b0` (feat)

**Plan metadata:** *(this commit)*

_Measured from the plan ledger `8e254f8..HEAD` → 5 commits (`git rev-list --count`), not narrated._

## Files Created/Modified

- `packages/sdk/src/redact/patterns.ts` — **new**: the complete P2-D-07 catalog (`PATTERN_FAMILIES` with jwt/bearer/assignment/card groups × text-node/input-value), `luhnValid()`, `TEXT_FAMILIES`/`INPUT_VALUE_FAMILIES` split views.
- `packages/sdk/src/redact/redactor.ts` — `TreeWalker` text-node scan (whole-node union rects), input-value scan over `input`/`textarea`, structural SEC-01 selector unchanged; renamed to the plan's artifact names (`collectMaskRects`/`fillRects`); no error swallowing (fail-closed seam).
- `packages/sdk/src/capture/pipeline.ts` — fail-closed redaction: `try { redactor.redact(image) } catch → failed{capture} → return`, strictly before encode/send.
- `e2e/sdk.spec.ts` — 13 new rows (`PRV-01` ×1, `PRV-02` ×6 incl. the JWT pair, `PRV-03` ×1, `H-1` ×4, `P2-D-08`, `fail-closed`) + the artifact-proof toolkit (`installSecrets`, `readMaskRect`, `analyzeRedaction`, `expectMaskedAndTargeted`, `expectStillVisible`, `runRedactionRow`, `runHidpiMaskRow`, `BREAK_DOM_SCAN`).
- `02-04-red-evidence-task1.json` / `task3.json` — RED evidence records, both `RED_EVIDENCE_OK`.

## Decisions Made

- **Pitfall 1 → wording, not exemption** (frontmatter key-decision): `Beare[r]` regex spelling + generic SEC-03 comment wording keep `sdk-no-host-storage` green; the plan's narrower `gate.mjs` exemption fallback was never needed, so `scripts/gate.mjs` (despite being in `files_modified`) is intentionally untouched — the gate still reports 15 SDK source files clean.
- **Fail-closed reuses the locked capture-failure state**: the UI-SPEC copy set has no redaction headline and `status-panel.ts`/`strings.ts` sit outside this plan's scope, so the error lands in `failed{capture}` whose load-bearing sentence is "Nothing was sent." Dedicated copy (if wanted) is deferred to the Phase 3 composer — recorded in the code comment so it reads as a decision, not an omission.
- **Fixture geometry** (patterns-established): secrets use `line-height: 1` so the stub's marker paint (element rect) sits *inside* the text-node rect the redactor masks — probe-verified on chromium/firefox/webkit before any row was written; the H-1 rows pin `deviceScaleFactor` explicitly (Desktop Safari defaults to DSF 2).
- **Assignment regex has no leading word boundary** so `api_key=`/`mytoken:` match (recall over precision — P2-D-09: a false negative is a leak); `keyboard:`-style prose still cannot match because the separator must be `=` or `:`.
- **Card scope as locked**: candidate runs of 13–19 digits (optional single separators) are masked ONLY when `luhnValid()` passes — long non-Luhn digit runs (IDs, timestamps) deliberately stay visible.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test-helper `ReferenceError` invalidated the first RED attempt**
- **Found during:** Task 1 (first `-g "JWT"` junit run errored both rows: `masked is not defined`).
- **Issue:** `analyzeRedaction` passed a shorthand `masked` that was not in scope (the parameter is `options.masked`). An infra error is INVALID_RED, not a red.
- **Fix:** `masked: options.masked` in the evaluate payload; re-ran to a genuine assertion RED (2464 original pixels).
- **Files modified:** `e2e/sdk.spec.ts` (uncommitted at RED time, included in `0214ba5`).
- **Verification:** `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`.

**2. [Rule 1 - Bug] webkit H-1 dpr-1 row failed its own non-vacuity assertion**
- **Found during:** Task 3 three-engine run (`devicePixelRatio` expected 1, received 2).
- **Issue:** Playwright's `Desktop Safari` project descriptor defaults to `deviceScaleFactor: 2`, so "dpr 1" cannot be assumed from the project default on webkit.
- **Fix:** the baseline row now pins `test.use({ deviceScaleFactor: 1 })` explicitly (with a comment naming the cause).
- **Files modified:** `e2e/sdk.spec.ts`; **Committed in:** `03f53b0`.
- **Verification:** `npm run verify -- e2e/sdk.spec.ts` → 135 passed.

**3. [Plan-split deviation] Task 1 GREEN shipped the complete catalog; Task 2 therefore produced no RED commit**
- **Found during:** Task 2 RED planning (`tdd.md` fail-fast rule: "test passes before implementation — investigate").
- **Issue:** Task 1's `<action>` says "define the catalog shape that Task 2 completes … starting with the JWT-shape family"; the GREEN commit `b1ebf13` implemented all four family groups (bearer, assignments, Luhn cards) instead of JWT-only, so every Task 2 row passed on first run.
- **Resolution:** investigated per `tdd.md` — the behavior genuinely already existed; RED was **not** fabricated (02-03's precedent: "RED was written where behavior was genuinely missing … not fabricated anywhere else"). Task 2's own deliverable — the five per-family artifact rows plus the gate/size checks — landed in `e17241b`, and the shipped-but-unproven families were proven (or would have been fixed) there.
- **Impact:** one missing `test`/`feat` pair on Task 2 only; PRV-01/02/03 coverage and all acceptance criteria are unaffected.

**4. [Scope note] `pipeline.ts` edited though absent from the frontmatter `files_modified` list**
- Task 3's `<files>` and its final `<acceptance_criteria>` explicitly require the fail-closed handler in `packages/sdk/src/capture/pipeline.ts`; the plan frontmatter (and the dispatch's plan-scope line) omit it — an internal plan inconsistency resolved in favor of the task definition (the fail-closed requirement is a must_have; without the edit Task 3 cannot close). No file outside the union of the plan's `files_modified ∪ tasks/<files>` was touched.

---

**Total deviations:** 2 auto-fixed (Rule 1 ×2) + 1 plan-split deviation (documented, no RED fabricated) + 1 scope note.
**Impact on plan:** all auto-fixes are in-scope correctness; the plan-split deviation affects TDD commit shape on Task 2 only, not delivered behavior or verification coverage.

## TDD Gate Compliance

Tasks 1–3 carry `tdd="true"`; `workflow.tdd_mode` is `false` and R-12 forbids unit-test suites — so the Playwright rows *are* the test artefact and RED means a failing row, with evidence records verified by `gsd_run check tdd-red-evidence`:

| Task | RED | Evidence | GREEN |
| --- | --- | --- | --- |
| 1 | `0214ba5` — PRV-02 JWT row fails: 2464 original pixels inside the expected mask rect | `02-04-red-evidence-task1.json` → `RED_EVIDENCE_OK` | `b1ebf13` |
| 2 | none — see Deviations 3 (catalog shipped in Task 1's GREEN; rows passed first run; no RED fabricated) | — | `e17241b` (test commit) |
| 3 | `274b6a3` — fail-closed row fails: panel stuck on `Capturing…`, no failure state (10 s timeout on the target assertion) | `02-04-red-evidence-task3.json` → `RED_EVIDENCE_OK` | `03f53b0` |

Git-log gate greps: `test(02-04):` ×3, `feat(02-04):` ×2 — both RED and GREEN gate commits present. No REFACTOR commit (no post-GREEN cleanup warranted; tests stayed green through the DSF fix, which landed inside Task 3's GREEN).

## Verification Results

| Check | Command | Result |
| --- | --- | --- |
| Workspace build | `npm run build` | exit 0 (run after every SDK source edit) |
| Size gate (RNF-01) | `npm run check:size` | **PASSED** — runtime 9.1 KB gz / 80 KB (catalog + scan added ~0.8 KB) |
| Static architecture gate | `node scripts/gate.mjs` | **PASSED** — 3 passed, 0 failed, 0 skipped |
| Pitfall-1 gate (Task 2) | `node scripts/gate.mjs sdk-no-host-storage` | **PASS** — 15 SDK source files clean, catalog present, no exemption |
| Lint + typecheck (4 workspaces) | `npm run lint` | exit 0 |
| Task 1/2 gates | `npx playwright test e2e/sdk.spec.ts --project=chromium` | **39 passed** at Task 2 close (34 at Task 1) |
| Task 3 + plan verification — three engines | `npm run verify -- e2e/sdk.spec.ts` | **135 passed** (45 rows × chromium/firefox/webkit), exit 0 |
| RED evidence (×2) | `gsd_run check tdd-red-evidence <record>` | `RED_EVIDENCE_OK` ×2 |

Acceptance criteria re-checked against the source and the run log: PRV-01/02/03 rows present, each decoding the outgoing image and asserting zero original pixels inside the rect **and** its 1-px ring (`expectMaskedAndTargeted`: `insideMagenta === 0`, `ringMagenta === 0`, flat-fill interior, control region keeps its pixels); the PRV-02 card row asserts the Luhn-invalid run is NOT masked via surviving marker pixels; `patterns.ts` exports `luhnValid` + the four family-group ids; `geometry.ts` shows `Math.floor` on x/y origins and `Math.ceil` on extent terms; `pipeline.ts` shows the redact call inside the fail-closed try that precedes encode/send; H-1 rows exist and pass at DSF 1/1.25/2/3; `P2-D-08` asserts the unmatched substring's pixels are gone; `fail-closed` asserts zero POST attempts + visible alert state; `gate.mjs sdk-no-host-storage` green with **no exemption** (conditional AC satisfied by the no-change branch).

## Issues Encountered

- **Shell/pin-guard friction (known from 02-03):** the default `bash` on this host is WSL's (git emits `/mnt/e/…`, breaking the `E:/…` pin), and PowerShell mangles `$()`/nested quotes passed to `bash -lc`. All guard/commit/test commands therefore ran through **Git Bash** (`C:\Program Files\Git\bin\bash.exe`) with commands pre-written to a temp script file; the pin guard reported `PIN OK: E:/Proyectos Github/Watchbug_TFG` before every commit.
- **Two RED runs were disqualified before commit:** the Task 1 helper `ReferenceError` (infra error ≠ red) and, at Task 2, first-run greens for the already-shipped families — both documented above rather than papered over.
- **Pre-existing working-tree noise left untouched:** `schema/report.schema.json` (line-ending-only stat diff, `git diff` empty) and untracked `watchbugus-fun/` — neither staged, per dispatch instructions.

## Known Stubs

None. No placeholder text, hardcoded empty values, skipped tests, TODO/FIXME markers or unrun `<verify>` remain in this plan's diff (stub-pattern grep over all four changed code files: clean); `.planning/WINDOWS.md` needed no new entry. The `input-value` families and every `PATTERN_FAMILIES` group are exercised by artifact rows — no catalog entry is unwired.

## User Setup Required

None — no new environment variable, no external service, no dependency install (zero new packages, PRF-04). The compose stack must be up for the suite (it answered `/api/health` → `{"status":"ok"}` before every run here).

## Next Phase Readiness

- **02-05 (privacy/purge closeout)** inherits the full 45-row suite and can re-run `npm run verify -- e2e/sdk.spec.ts` as its regression base; `playwright.config.ts`'s OQ-2 webkit-premise comment correction remains assigned to it.
- **Phase 3 (annotator T2/T3)** reuses `geometry.ts`'s single outward-rounded mapping for user masks — the H-1 rows are its regression guard; the Phase 3 composer is also where dedicated redaction-failure copy (if wanted) would land.
- **Phase 4 (C-5 scrubber)** must stay aligned with these four families + the Luhn rule (`PATTERN_FAMILIES` is now the reference implementation).
- **Budget headroom:** runtime 9.1 KB gz of 80 KB; core well inside the 45 KB hard tier.
- **Suite size:** 135 rows (45 per engine); new rows cost ~4 s per engine.

## Self-Check: PASSED

- All 6 changed files exist on disk (`[ -f ]` ×6 FOUND); none deleted (post-commit deletion check empty ×5).
- All 5 commits exist (`git log --oneline --all` FOUND ×5); `commits: 5` measured from the ledger `8e254f8..HEAD` (`git rev-list --count` = 5), not narrated.
- Both RED records re-verified: `RED_EVIDENCE_OK` ×2.
- Plan `<verification>` re-run at closeout: `npm run build` exit 0, `check:size` PASSED, `gate.mjs` 3 PASS / 0 FAIL, `npm run lint` exit 0, `npm run verify -- e2e/sdk.spec.ts` **135 passed** across chromium + firefox + webkit.
- Every `<acceptance_criteria>` re-checked against the source (see Verification Results).

---
*Phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction*
*Completed: 2026-10-24*
