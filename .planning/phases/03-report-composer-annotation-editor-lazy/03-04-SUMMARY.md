---
phase: 03-report-composer-annotation-editor-lazy
plan: 04
subsystem: sdk-widget-ui
tags: [composer, file-attach, magic-bytes, degraded-state, text-only, cap-02, cap-03, playwright, capture-source]

# Dependency graph
requires:
  - phase: 03-report-composer-annotation-editor-lazy
    plan: 03-03
    provides: the composer frame + DOM contract (data-wb-state image|text-only|degraded, zone slots, optional handler stubs this plan wires), the Draft/CaptureNote pipeline split, the one-encode-at-Review sink
  - phase: 03-report-composer-annotation-editor-lazy
    plan: 03-01
    provides: the meta-only (imageless) POST lane the text-only send rides to a real 201
  - phase: 03-report-composer-annotation-editor-lazy
    plan: 03-02
    provides: the server JPEG lane + the three magic-prefix rules the client gate mirrors (committed oversize/polyglot fixtures)
provides:
  - "ManualFileCapture: the second CaptureSource — user-picked PNG/WebP/JPEG enters as ImageData through the same seam, re-encoded by the single sink (never the picked container)"
  - "sniffClientImage: the client magic-byte allowlist mirroring the server sniff; every refusal is a visible inline state with the locked copy, zero requests, draft preserved"
  - "Degraded composer: denied / no-api / blank / oversize captures open the composer with a failure-distinct hint (F6) and two real exits; nothing posts before the user chooses"
  - "Meta-only lane1 (SendPayload.blob: Blob | null): text-only review shows the No image line and files a real 201 with no image part"
  - "attachImage / expectZoneState / clickVisibleAttach / clickContinueTextOnly harness + degraded-state probe fields"
affects: [03-05-lazy-editor, 03-07-suite-migration, verify-work-03]

# Actuals (#2632)
actuals:
  tokens: 19110   # chars/4 over the realized packages+e2e diff (measured from the plan commit range)
  tasks: 3
  commits: 3      # MEASURED via git rev-list ${plan_head_before}..HEAD at authoring time

plan_head_before: 39118006692599c1c1f204c0be2ab0376a6ca37d
plan_head_after: 982062b7c5e6c3a6391402b14700082a1f52f6e7

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "untrusted-file admission: magic prefixes decide, the picker's accept attribute is decoration; refusal = one CaptureUnavailableError instanceof with a distinguishing reason ('format' | 'size' | 'decode')"
    - "visible-failure state machine: a capture failure never becomes a dialog or a dead panel — the degraded composer is the loud state, and every exit (attach / text-only) reuses the Task-1 lane"
    - "data-wb-attaching settle signal: an async mutation of the draft is observable to e2e without polling half-applied state"

key-files:
  created:
    - packages/sdk/src/capture/manual-file.ts
  modified:
    - packages/sdk/src/capture/capture-source.ts
    - packages/sdk/src/capture/pipeline.ts
    - packages/sdk/src/image/encode.ts
    - packages/sdk/src/widget/composer.ts
    - packages/sdk/src/widget/review.ts
    - packages/sdk/src/transport/lane1.ts
    - packages/sdk/src/index.ts
    - e2e/helpers/composer.ts
    - e2e/helpers/capture-stubs.ts
    - e2e/sdk.spec.ts

key-decisions:
  - "ManualFileCapture is standalone, never a wrapper around DisplayMediaCapture (P3-D-13: a denied capture is the user's choice to make, not a silent fall-through)"
  - "blankProbe never runs on an attachment (research F6): a legitimately uniform photo is a valid report"
  - "Attachment size refusal accepts EITHER client arm (decoded-bitmap 'size' or an engine 'decode' refusal of an inconsistent container) — both satisfy 'refused before a working canvas is allocated' (A4); the row asserts user-visible behavior, not the arm"
  - "Degraded notice hint is chosen from the existing status.* diagnostics by captureNote (denied/no-api → captureFailed.hint, blank/oversize → blankCapture.hint) — no new copy keys, the diagnosis survives (F6)"
  - "At most one visible .composer-attach at any time: the footer attach is CSS-hidden in degraded, the notice attach is hidden outside it; helpers click the VISIBLE one"
  - "Draft.captureNote clears to null on a successful attach (the plan's 'ok' as an implementable value: null is the existing no-failure-note convention)"

requirements-completed: [CAP-02, CAP-03]  # shared IDs with 03-02 (CAP-02 server half) and 03-01 (CAP-03 server half); both sibling SUMMARYs exist, so both flip Complete now

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Device attach end-to-end: a picked PNG/WebP/JPEG reaches the 64x64 preview, survives review, and the outgoing part decodes at the attached picture's dimensions, non-blank — re-encoded by the single sink, never the picked JPEG container"
    requirement: CAP-02
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-02 attach: a picked PNG reaches the preview, the review and the wire (chromium + webkit)"
        status: pass
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-02 attach: WebP and JPEG are accepted (chromium + webkit; chromium asserts the built payload really is image/jpeg)"
        status: pass
      - kind: other
        ref: "node scripts/gate.mjs sdk-single-encode-sink (exactly one sink after the attach lane)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Client format gate: HTML/SVG/polyglot-GIF and the 65.5 MP-declared JPEG are refused before decode-to-canvas with composer.attach.error + hint + the preserved previous draft and zero POST attempts; the accept attribute is never consulted"
    requirement: CAP-02
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-02 reject: a non-image is refused with the inline error and no request (chromium + webkit)"
        status: pass
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-02 reject: an oversized-pixel file is refused (chromium + webkit)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Degraded composer: denied, no-getDisplayMedia, blank and oversize captures all open .composer[data-wb-state=degraded] with heading composer.image.none, the failure-distinct hint, and both actions; the inert Review click posts nothing; Attach from degraded reaches the Task-1 preview; the 6 former panel failure rows (P2-D-12 x2, OQ-1, CAP-01-rejected, S-7 guard, fail-closed) assert this state"
    requirement: CAP-03
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-03: a blank capture never posts before the user chooses (chromium + firefox + webkit; includes the attach-from-degraded walk)"
        status: pass
      - kind: e2e
        ref: "e2e/sdk.spec.ts#OQ-1 / CAP-01 rejected / P2-D-12 oversize / S-7 guard / fail-closed (re-pointed; 5/5 webkit)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Text-only filing: Continue with text-only hides the image zone, keeps a footer Attach image, review shows the No image line with no canvas, and Send reaches a REAL compose-stack 201 whose intercepted multipart body carries no image part"
    requirement: CAP-03
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-03: a denied capture opens the degraded composer with both actions and files text-only (real 201 via route.continue; chromium + webkit)"
        status: pass
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-03 no-API: a browser without getDisplayMedia can still file text-only feedback (real 201; chromium + webkit)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The three plan prohibitions stay structural properties: a failed capture never auto-opens a file dialog (the composer renders two visible actions instead), the magic bytes are the only admission test (accept is decoration), and an attachment never skips the review/mask path (it enters as ImageData through the same seam)"
    verification: []
    human_judgment: true
    rationale: "The plan marks all three must_haves.prohibitions verification: judgment — the rows prove the behaviors and the sniff/gate shape at commit time, but the standing never-assertions (no future wrapper around DisplayMediaCapture, no format authority for declared MIME types, no blob-shortcut around review) are code-review properties for the phase verifier"
  - id: D6
    description: "Real-device ergonomics of the picker and degraded flow (iOS Safari has no getDisplayMedia at all; the e2e engine coverage is Playwright webkit's removed-mediaDevices stub, not a phone)"
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-03 no-API (stub shape, not hardware)"
        status: pass
    human_judgment: true
    rationale: "03-VALIDATION.md's manual-only table keeps 'real-picker capture → composer' for human UAT — the picker surface cannot be automated past the OS dialog on real hardware; the no-API fallback itself is fully automated"

duration: 48 min
completed: 2026-10-28
status: complete
---

# Phase 03 Plan 04: Attach lane + Degraded Composer Summary

**The two escape hatches ship: a user-picked PNG/WebP/JPEG enters the composer as raw `ImageData` through the `CaptureSource` seam (magic-byte gate mirroring the server, caps enforced before any working canvas), re-encodes through the single sink and files like a capture — and every way capture can fail (denied, absent, blank, oversize) now opens the composer in `data-wb-state="degraded"` with a failure-distinct hint and two working exits, one of which posts a real text-only 201 with no image part.**

## Performance

- **Duration:** ~48 min (started 2026-10-28T17:57:07Z, tasks done 18:45Z + close-out)
- **Started:** 2026-10-28T17:57:07Z
- **Completed:** 2026-10-28T18:45:00Z
- **Tasks:** 3 (1 tracer + 2 auto)
- **Files modified:** 11 (1 created, 10 modified) + this SUMMARY

## Accomplishments

- **Tracer (Task 1):** `capture/manual-file.ts` — `createManualFileCapture()` implements the existing seam and resolves to `ImageData` (A-05: no encoded byte can exist before the sink; an attached JPEG leaves as WebP or PNG because nothing else encodes). Flow: `CaptureRequest.file` → 12-byte head → magic sniff → `createImageBitmap` → decoded-bitmap caps → `beforeRead()` (seam contract kept; no-op for a file, its throw still aborts) → `fitToCaps` onto a `willReadFrequently` canvas with high smoothing → `getImageData`; `bitmap.close()` in every path; `CaptureUnavailableError` for every rejection class so the composer's branch is one `instanceof`. `encode.ts` gained the exported `fitToCaps()` (caps + MIN_EDGE floor only — no DPR clamp, a file's pixel grid is not the display) with `initialDimensions` delegating after its clamp; `createCanvas`/`context2d` reused, not duplicated (R-18). Composer: footer/notice `Attach image` + `Replace image` open the hidden shadow-root picker; success sets `image`, clears `t1`/`masks`/`encoded`/`captureNote`, re-renders; `blankProbe` never runs on an attachment. The e2e row proves the button actually opens the picker (chromium `filechooser`), the 640×360 stub frame is REPLACED by the 64×64 attachment preview, review shows a real encoded artifact, and the intercepted+fetch-boundary bytes decode 64×64 non-blank with a WebP/PNG magic on the wire — never JPEG.
- **The gate (Task 2):** `sniffClientImage(bytes) → 'png' | 'webp' | 'jpeg' | null` applies the server's three stated prefix rules (PNG's 8-byte signature, `RIFF`/`WEBP` at 0/8, `ff d8 ff`) before decode; rejections carry reason `'format' | 'size' | 'decode'`. A refusal keeps the previous image (or degraded state) intact, shows `span.field-error[data-wb-error="attach"]` (role alert) with `composer.attach.error` + the `.hint` as `aria-describedby` text, re-enables the attach action, and sends nothing. Rows: WebP accepted (fixture) + JPEG accepted (in-page payload — chromium asserts the built bytes really are `image/jpeg`); HTML/SVG/polyglot-GIF refused ×3 with the copy + preserved draft + zero `POST /api/incidents`; the 65.5 MP-declared JPEG refused before the working canvas.
- **Degraded composer (Task 3):** `runGesture`'s `!stage.ok` now mints a degraded **draft** (captureNote rides it) instead of a panel failure — the Phase-2 failure panel is unreachable from capture paths (the no-CSPRNG pre-stage exit stays a panel state, per 03-03's decision). The notice heading is always `composer.image.none`; the hint maps `denied/no-api → status.captureFailed.hint`, `blank/oversize → status.blankCapture.hint` (F6, no new keys). `Continue with text only` clears the note → `data-wb-state="text-only"`: image zone CSS-hidden, footer keeps the secondary `Attach image`, `Review report` on a pixel-less draft skips `encodeFinal` and review renders the `No image` summary line (canvas hidden). `SendPayload.blob` became `Blob | null`; `postOnce` appends the `image` part only when bytes exist — both text-only rows file **real 201s** from the compose stack with an intercepted body that carries `name="meta"` and never `name="image"`. Review clicks in the degraded state are inert (zero posts asserted with the settle-wait).
- **Suite migration actually done:** the plan's explicit re-point (P2-D-12 uniform → `CAP-03: a blank capture never posts before the user chooses`) plus the five sibling failure rows that the routing change made stale (P2-D-12 oversize, OQ-1, CAP-01-rejected, S-7 guard, fail-closed) now assert the degraded composer — green on chromium AND webkit. **03-07's remaining scope is only the 41 one-shot send rows.**
- **Verification:** CAP-02|CAP-03 7/7 chromium, 7/7 webkit; re-pointed failure rows 5/5 webkit; blank row 3/3 engines; PRV-07/P3-D-0/WDG-06 regression set 15/15 chromium (the 03-03 surface untouched by the rename `composer-continue` → `composer-continue-text` — nothing referenced the old class); `gate.mjs` 3/3; `check:size` core 16.2 KB / 45 KB; `npm run lint` 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end attach (tracer)** — `7783f38` (feat: manual-file adapter + CaptureRequest.file + fitToCaps + composer file lane + attach row + harness)
2. **Task 2: Attachment gate rows** — `abda3f9` (test: WebP/JPEG accepted, non-image + oversize refused request-free)
3. **Task 3: Degraded composer + text-only 201** — `982062b` (feat: failure routing, meta-only lane1, review/skip-encode, 6 re-pointed rows, 2 new CAP-03 rows)

**Plan metadata:** this SUMMARY's commit (docs: complete plan).

Tracer feedback gate: after `7783f38` the `<verify>` chain was re-run end-to-end (row green, sink gate green) — auto-continued per `human_verify_mode=end-of-phase` (verify carries only `<automated>`; no user-facing halt).

## Files Created/Modified

- `packages/sdk/src/capture/manual-file.ts` — NEW: `createManualFileCapture()`, `sniffClientImage()`, caps-before-canvas posture
- `packages/sdk/src/capture/capture-source.ts` — `CaptureRequest.file?: File` (additive); `CaptureUnavailableError` gains `reason?: 'format' | 'size' | 'decode'`
- `packages/sdk/src/image/encode.ts` — exported `fitToCaps()` extracted from `initialDimensions` (delegates after the DPR clamp); `createCanvas`/`context2d` exported for reuse; sink untouched
- `packages/sdk/src/capture/pipeline.ts` — failure → degraded draft (never the panel); `pendingFor` meta-only branch; `PendingSend`/`send` widened to `Blob | null`; `Draft.t1` made writable
- `packages/sdk/src/transport/lane1.ts` — `SendPayload.blob: Blob | null`; conditional `image` part; `filenameFor` untouched
- `packages/sdk/src/widget/composer.ts` — hidden picker + attach/replace wiring + `data-wb-attaching` settle flag + refusal spans (error/hint, aria wiring) + degraded notice attach + `composer-continue` → `composer-continue-text` + F6 hint mapping + inert Review in degraded + degraded/text-only state CSS
- `packages/sdk/src/widget/review.ts` — canvas hidden on a text-only review (`data-wb-empty`)
- `packages/sdk/src/index.ts` — text-only review routing (`encodeFinal` skipped, router accepts encoded-or-pixel-less), locale re-render follows
- `e2e/helpers/composer.ts` — `attachImage()` (two-phase settle wait), `expectZoneState()`, `clickVisibleAttach()`, `clickContinueTextOnly()`
- `e2e/helpers/capture-stubs.ts` — `no-display-media` provocation + 11 additive probe fields (preview dims, notice copy, action visibility, attach refusal copy, `reviewNoImage`)
- `e2e/sdk.spec.ts` — 7 new rows (CAP-02 ×4, CAP-03 ×3 incl. the re-pointed blank row) + 5 re-pointed failure rows

## Decisions Made

- The size-refusal row is arm-agnostic by design (research A4): whether the engine reports the declared oversize bitmap ('size') or refuses the inconsistent container outright ('decode'), the contract — refused before a working canvas exists, zero requests, same visible copy — holds either way, and no engine can ACCEPT the fixture.
- `attachImage` writes the file input directly (`setInputFiles`) per the plan's harness contract; the BUTTON → picker wiring is separately proven by the chromium `filechooser` walk inside the rows, so neither layer passes vacuously.
- The attach flow resets `draft.encoded = null` on replacement (beyond the plan's listed fields): a stale reviewed artifact must never ride a replaced frame to the wire; the review-entry re-encode makes it unreachable anyway, this closes the interval.
- Text-only `PendingSend.filename` is `''` (unused when `blob === null`) instead of optionalizing the field — `filenameFor` stays untouched per the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Draft.t1` was `readonly` — attachments must clear it**
- **Found during:** Task 1 (composer attach wiring)
- **Issue:** the plan's action literally says `draft.t1 = []` on attach, but the interface (pipeline.ts) declared `readonly t1` — the type blocked the required state transition.
- **Fix:** made the property writable (`t1: readonly BitmapRect[]` — the array stays read-only to consumers); documented why in the interface docblock. pipeline.ts is added to Task 1's touched files (it was only listed for Task 3).
- **Files modified:** packages/sdk/src/capture/pipeline.ts
- **Verification:** typecheck + all rows green.
- **Committed in:** 7783f38 (Task 1 commit)

**2. [Rule 3 - Blocking/Interpretation] `draft.captureNote = 'ok'` is not in the CaptureNote union**
- **Found during:** Task 1 (attach success handling)
- **Issue:** the plan wrote `draft.captureNote = 'ok'`, but `CaptureNote` is the failure vocabulary (`denied|no-api|blank|oversize`) with `null` as the existing no-failure convention; widening the union for a success token would have made the degraded-state derivation worse, not better.
- **Fix:** successful attach sets `captureNote = null` — identical observable outcome (zone state `image`), no vocabulary growth.
- **Files modified:** packages/sdk/src/widget/composer.ts
- **Verification:** `data-wb-state="image"` asserted by the rows; CAP-03 hint mapping unaffected.
- **Committed in:** 7783f38 (Task 1 commit)

**3. [Rule 1 - Regression prevention] Five green capture-failure rows re-pointed, not just the one the plan enumerated**
- **Found during:** Task 3 (failure routing)
- **Issue:** the plan routes capture failures to the degraded composer "NEVER to the Phase 2 failure panel" but only re-points the P2-D-12 blank row; the 03-03 handoff had deferred the other five (P2-D-12 oversize, OQ-1, CAP-01-rejected, S-7 guard, fail-closed) to 03-07 — leaving them would have turned 5 green rows red as a side effect of THIS plan's routing.
- **Fix:** re-pointed all six rows to the degraded composer (same provocations, same zero-request claims, composer-side assertions); the WR-03 no-CSPRNG row correctly keeps the panel (its exit is pre-stage, not a captureNote).
- **Files modified:** e2e/sdk.spec.ts
- **Verification:** re-pointed rows 5/5 webkit + within the 15/15 chromium regression run; 03-07's scope shrinks to the 41 one-shot rows only.
- **Committed in:** 982062b (Task 3 commit)

**4. [Rule 2 - Missing Critical] `data-wb-attaching` settle flag + inert Review in degraded**
- **Found during:** Tasks 1/3 (harness + CAP-03 truths)
- **Issue:** (a) the async decode has no observable settle edge without one — same-size replacements would race assertions against half-applied state; (b) "nothing posts before the user chooses" is only true if the Review path is actually guarded in the degraded state, not just un-clicked in tests.
- **Fix:** the composer marks `data-wb-attaching` across the decode (helpers two-phase-wait it) and disables the attach actions while it runs; the Review handler returns without navigating while `image === null && captureNote !== null`.
- **Files modified:** packages/sdk/src/widget/composer.ts, e2e/helpers/composer.ts
- **Verification:** blank row asserts the inert click + zero posts; two-tone replace timing race eliminated.
- **Committed in:** 7783f38 / 982062b

**5. [Rule 3 - Blocking/Polish] review.ts canvas hidden on a text-only review**
- **Found during:** Task 3 (text-only review shape)
- **Issue:** review.render was previously unreachable with `encoded === null`; the 0×0 `.review-image` box (border + background) painted a 2 px artifact. review.ts is not in the plan's Task 3 file list.
- **Fix:** `data-wb-empty` attribute + one CSS rule hides the canvas; the `No image` summary line (already shipped by 03-03 for exactly this) stays the whole image truth.
- **Files modified:** packages/sdk/src/widget/review.ts
- **Verification:** `reviewImageWidth === 0` asserted; all 15 regression rows green.
- **Committed in:** 982062b (Task 3 commit)

### Execution notes (not defects)

- The plan authorizes `sniffClientImage` as a Task 2 artifact, but a tracer must be production quality: the format gate + reason class shipped in Task 1's commit (`7783f38`); Task 2's commit is its three gate rows. No source refinement was needed when the gate was exercised — it passed first run.
- The existing class family `zone-notice` / `.zone-notice-heading` / `.zone-notice-hint` (03-03's shipped DOM contract) was kept where the plan's artifact list describes `.composer-notice` / `.notice-heading` / `.notice-hint`; nothing in the suite referenced the names, and renaming a shipped contract has no behavioral value. The plan's genuinely new names (`composer-continue-text`, `data-wb-error="attach"`, `data-wb-state` values, hidden `input.composer-file`) are implemented as written.

---

**Total deviations:** 5 auto-fixed (2 blocking-type/interpretation, 1 regression-prevention, 1 missing-critical, 1 blocking-polish). **Impact on plan:** all preserve the plan's contracts; the failure-row re-point (3) additionally de-risks 03-07 by closing the interim-red surface this plan's routing would otherwise have created. No scope growth beyond the plan's own truths required them.

## Issues Encountered

- Two template-literal breakages during development (backticks inside comments of the `COMPOSER_CSS` literal and of a `String.raw` init-script) — caught pre-commit by the build and by Playwright's transform; fixed before any commit ever carried them. Recorded because the SDK's own gates count comment tokens: literal-embedded prose is a real hazard class in this codebase.
- The P2-D-12 sparse row and the CAP-01 tier row (464/470) plus the P2-D-03 retry rows remain red on every engine — the known 41-row one-shot family waiting on pre-send headlines; verified this plan added no new red (failure-signature check: all fail in `waitForHeadline`, none in an artifact assertion). 03-07 owns them.
- Shared-ID requirements gate (#2388): CAP-02 and CAP-03 were each also declared by sibling plans 03-02/03-01 whose SUMMARYs already exist, so both mark Complete with this plan (client halves close both IDs).

## Authentication Gates

None occurred.

## Security / Threat Surface

Threat register dispositions all landed: **T-03-01** (degraded path never auto-dialogs, never posts — inert-Review guard + zero-request assertions), **T-03-02** (magic-byte allowlist before decode; picker input inside the closed shadow root; declared MIME/extension never consulted — the polyglot GIF refusal proves it), **T-03-18** (dimensions checked on the decoded bitmap before the working canvas exists; `bitmap.close()` on every path), **T-03-19** (meta-only body still validates server-side through the unchanged pipeline — proven against the REAL 201 lane, and the client cannot add fields). Zero dependencies installed (`createImageBitmap` is platform API); no new endpoints; `sdk-no-host-storage` and `sdk-single-encode-sink` gates stayed green throughout. **No threat flags beyond the plan's register.**

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 03-05 (lazy editor): the `onAnnotate` slot remains the only composer no-op left (plus `editor.loading` keys) — the editor's mount contract is unchanged by this plan; note `replaceButton` now opens the file picker (per CAP-02) while `onReplace` remains an optional notification.
- 03-06 (mask lane): `encodeFinal` still the only producer; attachments arrive with `t1 = []` so mask replay over an attachment draft is already exercised by the attach rows' encode path.
- 03-07 (suite migration): remaining scope is ONLY the 41 one-shot send rows + `completeComposer` — the six capture-failure rows this plan inherited are already migrated (deviation 3). `expectZoneState(page, 'degraded')` is the canonical wait for re-pointed rows.
- Verifier: D5/D6 coverage entries (prohibition invariants; real-device picker ergonomics) need human sign-off; everything else is pass-proven.

---

*Phase: 03-report-composer-annotation-editor-lazy*
*Completed: 2026-10-28*

## Self-Check: PASSED

- All 11 claimed files + SUMMARY verified present on disk (this session).
- All 3 task commits verified as ancestors of HEAD (`7783f38`, `abda3f9`, `982062b`); `commits: 3` measured from the on-disk ledger `3911800..HEAD`, matching the frontmatter.
- Plan-level verification re-run at HEAD: `-g "CAP-02|CAP-03"` 7/7 chromium + 7/7 webkit; re-pointed failure rows 5/5 webkit; regression set PRV-07|P3-D-0|WDG-06 15/15 chromium; `gate.mjs` 3/3; `check:size` PASSED (core 16.2 KB / 45 KB); `npm run lint` exit 0.
