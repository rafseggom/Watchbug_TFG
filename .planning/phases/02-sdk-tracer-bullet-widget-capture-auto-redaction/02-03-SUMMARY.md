---
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
plan: 03
subsystem: sdk
tags: [capture, display-media, capture-source-seam, encode-ladder, hidpi, blank-probe, surface-policy, loud-failures, e2e, cap-01, cap-04, cap-05, m-3, p2-d-12, oq-1]

# Dependency graph
requires:
  - phase: 01-contracts-ingest-slice
    provides: "the compose stack (Fastify ingest 201 on real multipart with PNG/WebP magic-byte acceptance), `scripts/gate.mjs`, `check:size` tiers, and the one-Playwright-suite conventions"
  - phase: 02-01 (widget shell & boot proof)
    provides: "the open-mode `watchbug.e2e.js` bundle (R-14), `hideSync()`/`restore()`/`isHidden()`, the status-panel renderer with all locked failure copy, and the e2e harness"
  - phase: 02-02 (capture tracer + isolation proof)
    provides: "the ordered `runCaptureFlow` pipeline (hide → capture → assert → restore → probe → redact → encode → send), the two-tier capture stub seam, the single-sink encode ladder with magic-byte WebP probing, the pass-through interception pattern, and the `INT-02` tracer row"
provides:
  - "CAP-01: one gesture drives the engine's real capture path per tier — `canvas.captureStream()` video path on chromium/firefox, `CaptureSource`-seam `ImageData` on webkit — to a non-blank 640×360 frame and a real 201; a rejected prompt lands in the loud `captureFailed` state with hint + both actions"
  - "CAP-04: the stub observes the widget host inline-`display: none` at invocation on every engine, and the decoded outgoing bytes contain zero launcher-accent `#2f6feb` pixels (non-vacuously: the accent is removed from the synthetic frame and asserted present on the live launcher)"
  - "CAP-05: the deterministic ladder proven at the artifact level — a 9000 px frame clamped to ≤ `MAX_IMAGE_DIM` (8192), a 16 MP at-ceiling frame delivered inside 16,777,216 px / 2,097,152 B, `deviceScaleFactor: 2` decoding non-blank 640×360, `devicePixelRatio: 3` clamped to 427×240"
  - "M-3: the forced WebP→PNG fallback ships as a `.png` / `image/png` multipart part chosen by the `blob.type` sniff (not by assumption) and the real API answers 201"
  - "P2-D-12 / OQ-1 / M-6: uniform frames and beyond-cap frames abort to `The capture came back blank.` before any request; `displaySurface: window` and a rejected prompt both land in `Couldn't capture the screen.` with zero `POST /api/incidents` attempts — asserted on all three engines"
  - "the OQ-1 surface policy in `DisplayMediaCapture`: explicit `'browser'`/`'window'`/`'screen'` comparisons, `undefined` accepted with the documented older-engines caveat, any other surface refused conservatively (T-02-05)"
affects: [02-04 (artifact-level CA-02 rows reuse `readOutgoingImage`/`analyzeImagePixels`), 02-05 (playwright.config webkit-premise correction, OQ-2), phase-7 release gate re-runs the CA-01/CA-04 rows]

# Actuals (#2632) — pairs with the plan's `estimate` (42000 tokens / 3 tasks)
actuals:
  tokens: 11760
  tasks: 3
  commits: 5
  plan_head_before: c2e88ddf65c7c3dc6b346f1c5a027d71ef4caff1
  plan_head_after: c1a86f8eb58e0a1e457f1e66a254617d41a4b672

# Tech tracking
tech-stack:
  added: ["none — zero new dependencies (RNF-01 / PRF-04); the decode/analysis runs in-page with `createImageBitmap` + canvas, the recorder is a `window.fetch` wrapper in the e2e harness"]
  patterns:
    - "Outgoing bytes are read at the **fetch boundary** (an e2e `window.fetch` wrapper recording the actual `FormData` image Blob), never from `request.postDataBuffer()` — Playwright's WebKit drops blob-backed multipart payloads (02-02 deviation 2, now load-bearing for every decode row)"
    - "Refusal rows are proved non-vacuously with a `data-wb-stub-invoked` attribute: the row distinguishes 'the policy refused the fake' from 'the API was merely missing'"
    - "RED-first e2e under R-12: the failing row itself is the RED (`test(02-03): …` + `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`), the implementation lands in the `feat(02-03): …` commit — no unit-test runner exists or may exist"
    - "Stub provocations (uniform / beyond-cap / prompt-rejected / non-tab-surface) are options on one `installCaptureStub(page, browserName, options)` helper, so no row carries bespoke init-script wiring"

key-files:
  created:
    - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-03-red-evidence-task1.json
    - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-03-red-evidence-task2.json
  modified:
    - e2e/sdk.spec.ts
    - e2e/helpers/capture-stubs.ts
    - packages/sdk/src/capture/capture-source.ts
    - packages/sdk/src/image/encode.ts

key-decisions:
  - "The decoded image always comes from the fetch-boundary recorder, not the intercepted request: WebKit's `postDataBuffer()` reports 0-byte blob parts (02-02 deviation 2), so any row that must both inspect wire headers AND decode pixels uses the recorder for bytes and the route for headers/status — INT-02's pass-through pattern extended, not replaced"
  - "CAP-05's 'oversized frame' sits AT the ceiling (4000×4000 = 16,000,000 px): a frame *above* `MAX_IMAGE_PIXELS` is rejected by the P2-D-12 probe before encode (plan Task 3's behavior, implemented in 02-02), so the ladder's area clamp is unreachable above the cap and is source-asserted; the at-ceiling row proves no blanking plus the 16 MP / 2 MB contract, and the >cap case has its own P2-D-12 row"
  - "The `MAX_IMAGE_DIM` (8192) per-side clamp was missing from the 02-02 ladder and is the plan-mandated GREEN of Task 2 (RED: 9000 px output → `a4f3b6c`; GREEN: `dbcd811`)"
  - "Uniform/beyond-cap provocations run where they are deterministic: uniform on the engine's default tier (chromium/firefox probe a solid frame straight through the real `<video>` path), beyond-cap as a canvas-free `new ImageData(4700, 3600)` at the seam on every engine so the pipeline's area probe — not an engine canvas limit — is what rejects it"
  - "OQ-1 accepts `displaySurface === undefined` with a written caveat (older engines) and refuses everything that is not `'browser'`, naming `'window'`/`'screen'` explicitly — conservative per locked P2-D-09, no send-anyway path"

patterns-established:
  - "Requirement-ID row titles for capture contracts (`CAP-01:`, `CAP-04:`, `CAP-05:`, `M-3:`, `P2-D-12:`, `OQ-1:`), one shared `INCIDENT_POST_RE` per intercepted route"
  - "In-page image analysis (`analyzeImagePixels`) decodes the outgoing bytes with the same engine that produced them — zero Node-side image dependencies (R-12)"
  - "`data-wb-*` host-page attributes for all harness observation (observation, outgoing bytes, invocation marker) — never a `window` global (WDG-04 discipline)"

requirements-completed: [CAP-01, CAP-04, CAP-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "CAP-01 — one gesture drives the engine capture tier to a non-blank 640×360 frame and a real 201; the tier actually invoked is observed (media on chromium/firefox, seam on webkit)"
    requirement: CAP-01
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-01: one gesture drives the engine capture tier to a non-blank frame and a real 201 (`npm run verify -- e2e/sdk.spec.ts`, 3 engines)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CAP-04 — the stub observes the host inline-`display: none` at invocation, and the decoded outgoing image contains zero `#2f6feb` widget-accent pixels (accent asserted present on the live launcher first)"
    requirement: CAP-04
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-04: the widget host is hidden when the capture runs and its accent pixels are absent from the sent image (3 engines)"
        status: pass
      - kind: other
        ref: "source assertion `packages/sdk/src/capture/pipeline.ts` (`host.isHidden()` → `PipelineInvariantError` → `failed{capture}`) and `capture-source.ts` (`request.beforeRead()` immediately before `drawImage`/`getImageData`)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CAP-05 — the ladder meets the size contract: 9000 px frame clamped to ≤8192 px, 16 MP at-ceiling frame inside 16,777,216 px / 2,097,152 B, deviceScaleFactor 2 non-blank at 640×360, devicePixelRatio 3 clamped to 427×240"
    requirement: CAP-05
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-05 x4 (wide, at-ceiling, DSF2, DPR-3) (`npm run verify -- e2e/sdk.spec.ts`, 3 engines)"
        status: pass
      - kind: other
        ref: "source assertion `packages/sdk/src/image/encode.ts` (`QUALITY_LADDER = [0.8, 0.6, 0.5]`, `DOWNSCALE_FACTOR = 0.75`, `MAX_IMAGE_DIM` clamp, one `encodeOnce` call site)"
        status: pass
    human_judgment: false
  - id: D4
    description: "M-3 — a forced PNG-typed encode is routed by the `blob.type` sniff to a `.png` / `image/png` multipart part (PNG magic asserted) that the real Fastify stack accepts with 201"
    requirement: CAP-05
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#M-3: a forced PNG encode ships as a .png / image/png part and the real API returns 201 (3 engines, `forcePngEncode` stub)"
        status: pass
    human_judgment: false
  - id: D5
    description: "P2-D-12 / OQ-1 / M-6 — every capture failure is a loud visible state: uniform frame → blank copy + zero POSTs; beyond-cap frame → blank copy + zero POSTs; `displaySurface: window` → capture-failed + zero POSTs with the refusal proven to be the surface policy; rejected prompt → capture-failed + hint + `Try again`/`Dismiss`"
    requirement: CAP-01
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#P2-D-12 x2 + OQ-1 + CAP-01 (prompt rejection) (`npm run verify -- e2e/sdk.spec.ts`, 3 engines)"
        status: pass
      - kind: other
        ref: "source assertion `packages/sdk/src/capture/capture-source.ts` (`'browser'`/`'window'`/`'screen'` comparisons, `surface === undefined` caveat branch, `NotAllowedError` → capture-failed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Privacy prohibition (must_haves): the widget never transmits a capture it could not destructively redact — no 'send anyway' fallback for failed redaction, non-tab surfaces or geometry failures"
    verification: []
    human_judgment: true
    rationale: "The plan marks this prohibition `verification: judgment`. The refusal paths are e2e-proven (D5), but the global claim — no send-anyway branch anywhere in the SDK — needs human sign-off at verify-work, as the plan requires."
  - id: D7
    description: "Plan gates — workspace build, RNF-01 size tiers, all three `gate.mjs` SDK rules, lint/typecheck"
    verification:
      - kind: other
        ref: "`npm run build` exit 0; `npm run check:size` → core 7.6/45, lazy 0.3/25, adapter 0.3/14, runtime 8.3/80 KB PASSED; `node scripts/gate.mjs` → 3 passed, 0 failed, 0 skipped PASSED; `npm run lint` exit 0"
        status: pass
    human_judgment: false

metrics:
  duration: 40min
  completed: 2026-10-24
  status: complete
---

# Phase 2 Plan 3: Capture Fidelity & Honest Failure Summary

**CAP-01/04/05 proven at the artifact level: the two-tier capture seam drives every engine to a real frame, the widget's `#2f6feb` accent is provably absent from the decoded bytes it sends (host observed inline-hidden at stub invocation), the encode ladder delivers 16 MP / 9000 px / HiDPI frames inside the 16,777,216 px + 2,097,152 B contract via the new `MAX_IMAGE_DIM` clamp, and every failure — uniform frame, beyond-cap frame, `window` surface, rejected prompt — lands in its locked loud state with zero POST attempts — 96/96 e2e green on chromium + firefox + webkit, `check:size` PASSED, `gate.mjs` 3 PASS, lint exit 0.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-10-24T11:55Z (immediately after 02-02 closed)
- **Completed:** 2026-10-24T12:35Z
- **Tasks:** 3 (all carry `tdd="true"`; see "TDD Gate Compliance")
- **Files modified:** 6 (4 in the plan's code/e2e scope + 2 RED-evidence records), 0 deleted — `pipeline.ts` and `status-panel.ts` were already complete from 02-02 and needed no change

## Accomplishments

- **Task 1 (`fe92fd7` RED → `8a05894` GREEN): CAP-01 + CAP-04.** The stub records, at the instant of invocation, the host's inline style and computed display into `data-wb-stub-observation` (both tiers); the launcher accent `#2f6feb` was removed from the synthetic frame palette, so `analyzeImagePixels` finding zero accent pixels in the decoded outgoing bytes can only mean the widget was absent. `CAP-01` proves gesture → observed tier → non-blank 640×360 decode → real 201 per engine. The rows read bytes from the new **fetch-boundary recorder** because WebKit's `postDataBuffer()` returns 0-byte blob parts — discovered in the three-engine run and fixed under Rule 3 (see Deviations).
- **Task 2 (`a4f3b6c` RED → `dbcd811` GREEN): CAP-05 + M-3.** `initialDimensions` gained the plan-mandated `MAX_IMAGE_DIM` (8192) per-side clamp ahead of the 16 MP area clamp (RED row: 9000 px output). Four rows: the wide frame (≤8192 px), the 4000×4000 at-ceiling frame (≤16,777,216 px, ≤2,097,152 B), `deviceScaleFactor: 2` (non-blank 640×360 with `devicePixelRatio === 2` asserted first), `deviceScaleFactor: 3` (clamped to 427×240). `M-3` provokes the silent WebP→PNG fallback via `forcePngEncode()` and asserts the sniff chose `filename="screenshot.png"` + `Content-Type: image/png`, PNG magic bytes, and a real 201.
- **Task 3 (`c1a86f8`): P2-D-12 + OQ-1 + M-6.** Failure provocations landed in `capture-stubs.ts` (uniform solid frame on the default tier; canvas-free `new ImageData(4700, 3600)` beyond-cap frame at the seam; `NotAllowedError` prompt rejection; a `displaySurface: 'window'` stream), each with a `data-wb-stub-invoked` marker so a refusal cannot pass by accident. `capture-source.ts` now spells the OQ-1 policy — `'window'`/`'screen'` refused by name, `'browser'` accepted, `undefined` accepted with the written older-engines caveat, other surfaces refused conservatively — and documents `NotAllowedError` → loud capture-failed. Four rows assert the locked copy (blank hint, capture hint, both action buttons) and **zero** `POST /api/incidents` attempts after a 600 ms settle.

## Task Commits

Each task was committed atomically (TDD RED → GREEN where behavior was new):

1. **Task 1: CAP-01/CAP-04 capture proof** - `fe92fd7` (test — RED, `RED_EVIDENCE_OK`) + `8a05894` (feat)
2. **Task 2: CAP-05 ladder + M-3 sniff proof** - `a4f3b6c` (test — RED, `RED_EVIDENCE_OK`) + `dbcd811` (feat)
3. **Task 3: blank probe / non-tab refusal / loud states** - `c1a86f8` (feat)

**Plan metadata:** *(this commit)*

_Measured from the plan ledger `c2e88dd..HEAD` → 5 commits (`git rev-list --count`), not narrated._

## Files Created/Modified

- `e2e/sdk.spec.ts` — 11 new rows: `CAP-01` ×2, `CAP-04`, `CAP-05` ×4, `M-3`, `P2-D-12` ×2, `OQ-1`; plus `analyzeImagePixels` (in-page decode + accent scan + distinct-colour sampling).
- `e2e/helpers/capture-stubs.ts` — `CaptureStubOptions` (tier override, fixed frame, uniform paint, failure provocations), `recordObservation()` on both tiers, the fetch-boundary outgoing-image recorder (`readOutgoingImage`), and `forcePngEncode()`.
- `packages/sdk/src/capture/capture-source.ts` — explicit `displaySurface` policy (`'browser'`/`'window'`/`'screen'` + `undefined` caveat) and the prompt-rejection → capture-failed mapping comment.
- `packages/sdk/src/image/encode.ts` — `MAX_IMAGE_DIM` (8192) per-side clamp in `initialDimensions`.
- `02-03-red-evidence-task1.json` / `task2.json` — RED evidence records, both `RED_EVIDENCE_OK`.

## Decisions Made

- **Fetch-boundary recorder over request inspection for pixels** (frontmatter key-decision): the intercepted request still proves wire headers/status; the actual bytes come from a `window.fetch` wrapper installed as a document-start init script. This is the only way to decode real outgoing pixels on WebKit, and it observes the true `FormData` Blob rather than a re-serialisation of it.
- **At-ceiling frame for CAP-05** (key-decision): plan Task 2 says "frame above 16 MP is downscaled", but the pipeline's P2-D-12 probe (plan Task 3, implemented in 02-02) rejects `area > MAX_IMAGE_PIXELS` *before* encode — the two behaviors meet at the same constant. Resolution: the row uses the largest frame the pipeline accepts (4000×4000 = 16,000,000) and asserts the output contract; the above-cap case is covered by its own `P2-D-12` abort row; the ladder's internal area clamp stays source-asserted. Reconciled deliberately, not silently.
- **Tier choice per row**: rows whose subject is the *media* path use the default tier (CAP-01/04, uniform); rows whose subject is the *pipeline behind* a frame use the seam on every engine for determinism (CAP-05 wide/at-ceiling, beyond-cap).
- **DPR proof beyond acceptance**: a `deviceScaleFactor: 3` row was added because the must_have claims `devicePixelRatio` is clamped to 2 — the DSF2 row alone cannot observe a clamp that only triggers above 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WebKit `postDataBuffer()` cannot yield the outgoing image bytes**
- **Found during:** Task 1 (`npm run verify -- e2e/sdk.spec.ts` — webkit CAP-01/CAP-04 failed with "Cannot create an ImageBitmap from an empty buffer").
- **Issue:** Playwright's WebKit serialises blob-backed FormData parts as 0 bytes (02-02 deviation 2, root-caused there for `route.fetch()`). Any decode row that reads the intercepted buffer passes on chromium/firefox and fails on webkit — and would pass *vacuously* on webkit if it only compared empties.
- **Fix:** the outgoing-image recorder — an e2e `window.fetch` wrapper captures the actual `image` Blob from the live `FormData` into `data-wb-outgoing-image`; `readOutgoingImage()` serves every decode row on all engines. Wire-header assertions stay on the intercepted buffer (headers are present everywhere).
- **Files modified:** `e2e/helpers/capture-stubs.ts`, `e2e/sdk.spec.ts`.
- **Verification:** three-engine run green (69/69 at that point; 96/96 at closeout).
- **Committed in:** `8a05894`.

---

**Total deviations:** 1 auto-fixed (1 × Rule 3)
**Impact on plan:** harness-only fix inside this plan's scope; no SDK production code was altered by it, no scope creep.

## TDD Gate Compliance

Tasks 1–3 all carry `tdd="true"`; `workflow.tdd_mode` is `false` for this run, and R-12 forbids unit-test suites — so the Playwright rows *are* the test artefact and RED means a failing row, with evidence records verified by `gsd_run check tdd-red-evidence`:

| Task | RED | Evidence | GREEN |
| --- | --- | --- | --- |
| 1 | `fe92fd7` — CAP-04 row fails on the missing host-state observation | `02-03-red-evidence-task1.json` → `RED_EVIDENCE_OK` | `8a05894` |
| 2 | `a4f3b6c` — CAP-05 wide row fails: width 9000 > 8192 | `02-03-red-evidence-task2.json` → `RED_EVIDENCE_OK` | `dbcd811` |
| 3 | none — see below | — | `c1a86f8` |

Task 3 has no RED commit because **every behavior it specifies already existed** (02-02 shipped `blankProbe()`, the surface check and the prompt mapping): its rows passed on their first run against unmodified code, and per `tdd.md`'s fail-fast rule ("Test doesn't fail in RED phase → feature may already exist — investigate") the investigation confirmed exactly that. What was new in Task 3 was provocation *infrastructure* (the stub failure modes) plus an acceptance-driven source clarification in `capture-source.ts` — neither can honestly fail first. RED was written where behavior was genuinely missing (the two `MAX_IMAGE_DIM`/observation gaps) and not fabricated anywhere else. Git-log gate greps: `test(02-03):` ×2, `feat(02-03):` ×3.

## Verification Results

| Check | Command | Result |
| --- | --- | --- |
| Workspace build | `npm run build` | exit 0 |
| Size gate (RNF-01) | `npm run check:size` | **PASSED** — core 7.6/45, lazy 0.3/25, adapter 0.3/14, runtime 8.3/80 KB gz |
| Static architecture gate | `node scripts/gate.mjs` | **PASSED** — 3 passed, 0 failed, 0 skipped (`sdk-single-encode-sink`: exactly 1, `encode.ts:75`) |
| Lint + typecheck (4 workspaces) | `npm run lint` | exit 0 |
| Task-level gate (Tasks 1/3) | `npx playwright test e2e/sdk.spec.ts --project=chromium` | **32 passed** |
| Plan verification — three engines | `npm run verify -- e2e/sdk.spec.ts` | **96 passed** (32 × chromium/firefox/webkit), exit 0 |
| Task 2 gates | `npm run check:size` + `node scripts/gate.mjs sdk-single-encode-sink` + chromium run | PASSED / PASS / 28 passed at that point |
| RED evidence (×2) | `gsd_run check tdd-red-evidence <record>` | `RED_EVIDENCE_OK` ×2 |

Acceptance criteria re-checked against the source (grep evidence in the execution log): all row-title families present (`CAP-01` ×2, `CAP-04`, `CAP-05` ×4, `M-3`, `P2-D-12` ×2, `OQ-1`); CAP-04 asserts inline `display: none` + zero `0x2f/0x6f/0xeb` pixels; stub exposes both tiers with `webkit → seam`; `pipeline.ts` asserts `host.isHidden()` mapping to `failed{capture}` with `beforeRead()` immediately before `drawImage`/`getImageData`; rows assert ≤16,777,216 px / ≤2,097,152 B / DSF2 non-blank / forced `.png`+201; `encode.ts` shows `QUALITY_LADDER = [0.8, 0.6, 0.5]`, `DOWNSCALE_FACTOR = 0.75`, `MAX_IMAGE_DIM`, one `encodeOnce` call site; the sniff (`sniffImageType`/`filenameFor(encoded.mimeType)`) selects the part name/MIME; `capture-source.ts` shows `'browser'`/`'window'`/`'screen'` + the `undefined` caveat branch.

## Issues Encountered

- **Two shells, two gits on this host.** The default `bash` is WSL's (git emits `/mnt/e/…`, cannot resolve the `E:/…` pin), so the root-pin guard failed closed on first contact — correctly. All git operations were re-run through Git Bash (`C:\Program Files\Git\bin\bash.exe`), where both sides of the pin resolve identically (`PIN OK: E:/Proyectos Github/Watchbug_TFG` before every commit). `gsd_run` is also not on `PATH`; invoked as `node …\gsd-core\bin\gsd-tools.cjs` per the resolver.
- **Stale `dist/` made a GREEN still fail once**: the wide-frame row kept returning 9000 px after the `encode.ts` fix because e2e serves `packages/sdk/dist` — resolved by `npm run build` before re-running (recorded here because it will bite the next executor too: **rebuild after every SDK source edit**).
- **Pre-existing working-tree noise left untouched:** `schema/report.schema.json` (line-ending-only stat diff, `git diff` empty) and untracked `watchbugus-fun/` — neither staged, per dispatch instructions.

## Known Stubs

None. No placeholder text, hardcoded empty values, skipped tests or unrun `<verify>` remain in this plan's diff; `.planning/WINDOWS.md` needed no new entry (nothing left open). The `playwright.config.ts` webkit-premise comment (OQ-2) is deliberately untouched — the plan assigns its correction to 02-05.

## User Setup Required

None — no new environment variables, no external service, no dependency install (zero new packages, PRF-04). The compose stack must be up for `npm run verify` (it answered `/api/health` → `{"status":"ok"}` before every run here).

## Next Phase Readiness

- **02-04 (redaction catalog) inherits working decode machinery:** `readOutgoingImage()` + `analyzeImagePixels()` are exactly what the artifact-level CA-02 rows need — decode the outgoing bytes, prove the masked region's original pixels are absent.
- **02-05 owns the OQ-2 correction:** `playwright.config.ts` line 8 still claims webkit exercises the WebP→PNG fallback; this host's WebKit encodes real WebP (research Pitfall 3) and M-3 is now covered by `forcePngEncode` — 02-05 updates the comment/release wording, not the R-12 policy.
- **Budget headroom:** core 7.6 KB gz of 45 KB after the ladder/policy work.
- **Suite size:** 96 rows total (32 per engine); new rows cost ~4 s per engine.

## Self-Check: PASSED

- All 6 changed files exist on disk (`[ -f ]` ×6 FOUND); none deleted (post-commit deletion check empty ×5).
- All 5 commits exist (`git log --oneline --all` FOUND ×5); `commits: 5` measured from the ledger (`c2e88dd..HEAD` → `git rev-list --count` = 5), not narrated.
- Both RED records re-verified: `RED_EVIDENCE_OK` ×2.
- Plan `<verification>` re-run at closeout: `npm run build` exit 0, `check:size` PASSED, `gate.mjs` 3 PASS / 0 FAIL, `npm run lint` exit 0, `npm run verify -- e2e/sdk.spec.ts` **96 passed** across chromium + firefox + webkit.
- Every `<acceptance_criteria>` re-checked against the source (see Verification Results).

---
*Phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction*
*Completed: 2026-10-24*
