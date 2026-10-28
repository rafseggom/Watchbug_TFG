---
phase: 03-report-composer-annotation-editor-lazy
plan: 03
subsystem: sdk-widget-ui
tags: [composer, review, i18n, shadow-dom, canvas, playwright, pipeline-split, encode-sink]

# Dependency graph
requires:
  - phase: 02-capture-redaction-privacy-core
    provides: the closed-shadow widget shell (host/launcher/status-panel), the strictly ordered capture→redaction pipeline, the single encodeLadder sink, `transformFor`/`toBitmapRect` geometry, the P2-D-01 one-shot flow this plan replaces
  - phase: 03-report-composer-annotation-editor-lazy
    plan: 03-01
    provides: the meta-only POST lane (text-only path of 03-04 rides it; this plan's composer sends the image lane)
provides:
  - "Draft type + pipeline split: runCaptureStage (T1-redacted ImageData + bitmap-space t1 measured at the read instant) / encodeFinal (single compose-time encode) / deliver classification"
  - "widget/composer.ts — the 720 px composition overlay with the fixed DOM contract (data-wb-screen/state/zone/type/locale/error; data-wb-state=image|text-only|degraded)"
  - "widget/review.ts — the review screen decodes the encoded blob: shown bytes == sent bytes"
  - "redact/masks.ts — MaskPatch/putPatch + the single MASK_RGB definition in a patterns-free leaf (the lazy lane's import path)"
  - "core i18n: Locale/detectLocale/setLocale/locale, stringsEs typed twin, host.setLang, composer EN/ES pair (session-scoped, never host storage)"
  - "ReportMeta widens to type 'bug'|'feedback' + optional note; buildMeta is the prefill helper"
  - "e2e/helpers/composer.ts harness + probeWidget composer/review fields + PRV-07/P3-D-02/03/04/WDG-06 rows"
affects: [03-04-degraded-text-only, 03-05-lazy-editor, 03-06-mask-lane, 03-07-suite-migration, phase-4-enricher]

# Actuals (#2632)
actuals:
  tokens: 28008
  tasks: 3
  commits: 3
plan_head_before: d2e6f62042136cc81826aa0afee91854d1ebf199
plan_head_after: 01fe093445c5f59e27def407c60453a6ef313db3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "status-panel skeleton for every new surface: CSS template literal + create*() -> {element, render, destroy}, el() + textContent only, one document-level Escape listener installed when the surface opens and removed when it closes"
    - "render(draft|null) as the visibility+fill entry: null hides and releases Escape; re-render mutates existing nodes, sets .value only when it differs (no focus loss)"
    - "locale change is a re-render, never a re-lookup: setLocale -> host.setLang -> render active surface"

key-files:
  created:
    - packages/sdk/src/redact/masks.ts
    - packages/sdk/src/widget/composer.ts
    - packages/sdk/src/widget/review.ts
    - e2e/helpers/composer.ts
  modified:
    - packages/sdk/src/capture/pipeline.ts
    - packages/sdk/src/image/encode.ts
    - packages/sdk/src/redact/redactor.ts
    - packages/sdk/src/strings.ts
    - packages/sdk/src/transport/lane1.ts
    - packages/sdk/src/widget/host.ts
    - packages/sdk/src/widget/launcher.ts
    - packages/sdk/src/index.ts
    - e2e/helpers/capture-stubs.ts
    - e2e/sdk.spec.ts

key-decisions:
  - "T3 order resolved against ROADMAP (the plan's flagged decision): encodeFinal replays the mask patches FIRST, then re-applies t1 as the LAST pixel write, then encodeLadder — the PATTERNS §14 sketch shows the opposite order and the plan text governs"
  - "Encoding happens at Review entry, not at Send; the review canvas is the DECODED outgoing blob (createImageBitmap), making 'what you see is what is sent' structural"
  - "Capture failures still route to the Phase-2 status panel in this plan (blank/oversize -> blank bucket, denied/no-api -> capture bucket) — the degraded composer is 03-04's surface and its row re-pointing is 03-07's, so the failure rows (P2-D-12 x2, OQ-1, CAP-01-rejected, WR-03, S-7 guard, fail-closed) stay green"
  - "i18n placement split (plan's flagged decision): core carries launcher/status/action/composer/review/mask-confirm/i18n copy in BOTH locales; the lazy chunk carries editor.* only (03-05); mask.confirm.* keys resolve through core t() and pass to AnnotatorOpenOptions.maskConfirm"
  - "The locale override is session-scoped in memory — the CONTEXT discretion note's localStorage pattern (P1-D-05, the PANEL's own storage) is NOT applied to the SDK (SEC-03 + sdk-no-host-storage gate; UI-SPEC A-1)"
  - "no-CSPRNG stays a pre-stage failure (restores the host, loud capture state) and is NOT a CaptureNote; 'no-api' is chosen only when navigator.mediaDevices.getDisplayMedia is absent at capture-throw time"

requirements-completed: [PRV-07, WDG-06]

coverage:
  - id: D1
    description: "Launcher gesture captures immediately and lands in the composer overlay holding the image; Review encodes ONCE and shows the decoded outgoing artifact; Edit report round-trips losslessly; Send posts exactly one multipart request whose meta carries the draft title/type and whose image part decodes"
    requirement: PRV-07
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#PRV-07: review shows the flattened artifact and Send posts it exactly once (chromium)"
        status: pass
      - kind: other
        ref: "node scripts/gate.mjs sdk-single-encode-sink (exactly one sink after encodeFinal)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Form semantics — 300-code-point title prefills at exactly 200 code points; empty title blocks review with composer.title.error + aria-invalid + focus kept; bug/feedback default + heading follow + meta.type on the wire; composer overlay wider than 320 px with the panel hidden and the launcher disabled, Escape -> idle re-armed; note counter hidden at 3,999 and visible at 4,000 code points"
    requirement: PRV-07
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#P3-D-02/P3-D-03/P3-D-04 + P3-D-02 note counter (4 rows, chromium)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Core i18n — es-ES auto-detects Spanish on launcher/composer/review AND the transient 'Enviando…'/'Capturando…' headlines with .wrap[lang=es]; default locale renders English with lang=en; the composer EN/ES pair switches both directions in-session with zero host-storage access"
    requirement: WDG-06
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#WDG-06 + WDG-06 es + WDG-06 override (chromium)"
        status: pass
      - kind: other
        ref: "node scripts/gate.mjs sdk-no-host-storage"
        status: pass
      - kind: other
        ref: "npm run check:size (core 14.8 KB gz / 45 KB after the Spanish dictionary)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual/UX adequacy of the composer and review overlays (layout feel, segment control affordance, preview fitting) — e2e asserts geometry (width > 320 px), DOM contract and copy, not aesthetics; the 280-char review-note ellipsis backstop and the forced long-heading wrap are UI-SPEC backstops best confirmed in phase UAT"
    verification: []
    human_judgment: true
    rationale: "Coverage not determined at authoring time — verifier must classify (no automated row asserts visual design quality; geometry and copy are asserted, taste is not)"

duration: 84 min
completed: 2026-10-28
status: complete
---

# Phase 03 Plan 03: Report Composer + Review + Core i18n Summary

**The Phase-2 one-shot shortcut is now a real composition surface: one gesture captures into a 720 px composer (prefilled editable title, bug/feedback segmented control, note with a code-point counter), Review entry runs the single `encodeFinal` and renders the DECODED outgoing blob — shown bytes are sent bytes — and the whole core surface renders in English or Spanish, auto-detected and overridable in-place without ever touching host storage.**

## Performance

- **Duration:** ~84 min (started 2026-10-28T15:16:49Z, completed 2026-10-28T16:41:09Z; the full-suite regression sweep accounts for ~28 min of it)
- **Started:** 2026-10-28T15:16:49Z
- **Completed:** 2026-10-28T16:41:09Z
- **Tasks:** 3 (1 tracer + 2 auto)
- **Files modified:** 14 (4 created, 10 modified)

## Accomplishments

- **Pipeline split at the pixel boundary** (`capture/pipeline.ts`): `runCaptureStage()` performs hide → capture → assert-hidden → restore → blank probe → destructive T1 redaction and resolves to `{ok:true, image, t1}` (t1 = `BitmapRect[]` mapped through `transformFor(image.w, image.h, view.w, view.h)` + `toBitmapRect` AT the pixel-read instant, never re-derived later) or `{ok:false, captureNote: denied|no-api|blank|oversize}`. The idempotency key stays minted before capture; `blankProbe` and the `finally { host.restore() }` discipline are untouched (Pitfall 12).
- **`encodeFinal(image, t1, masks)`** (`image/encode.ts`) replays mask patches, re-applies T1 as the last pixel write, then calls `encodeLadder` — the `sdk-single-encode-sink` gate still reports exactly one sink, and no new code spells the counted tokens even in comments.
- **`redact/masks.ts`** (leaf): `MaskPatch`, `putPatch()` (row-wise replacement, alpha normalized to opaque, fail-closed validation that throws on non-finite/non-integral/out-of-bounds/mismatched patches) and the single `MASK_RGB` definition — a `patterns.ts`-free import path for the lazy lane (R-18 one definition; `redactor.ts` re-exports and gains `fillBitmapRects`).
- **Composer** (`widget/composer.ts`): the full DOM contract (`data-wb-screen`, `data-wb-state=image|text-only|degraded`, `.composer-heading`, EN/ES `locale-toggle` pair, `button.segment[data-wb-type][aria-pressed]`, `input.composer-title` + `span.field-error[data-wb-error="title"][role=alert]`, `textarea.composer-note` + counter, `.image-zone[data-wb-zone]` with `canvas.composer-preview` drawn via `putImageData` — never an encode for the preview — annotate/replace, footer review/attach/discard). One Escape listener owned by the visible surface (Pitfall 11). Token-only CSS, px-only, reduced-motion block.
- **Review** (`widget/review.ts`): decodes the exact `EncodedImage` blob (`createImageBitmap` → `drawImage` → `bitmap.close()`, generation-token guarded), shows type/title/note summary (note display-truncated to 280 chars, full note on the wire) or the `No image` line, focus moves to `Edit report`, Escape/`✕` returns to the composer; `Send report` transmits the reviewed blob through the existing `deliver()` classification.
- **Router** (`index.ts`): `Screen = idle|status|composer|editor|review`, surfaces appended once to `host.content` and shown/hidden by `showScreen`; launcher disabled while any overlay is open; exactly one visible at a time; one concatenated `<style>` still (HOST+LAUNCHER+PANEL+COMPOSER+REVIEW).
- **Core i18n** (WDG-06): `Locale`, `detectLocale('es*')`, in-memory `activeLocale`, `setLocale`/`locale()`, `t()` reading `STRINGS[activeLocale]`; `stringsEs: Record<StringId, string>` makes a missing Spanish twin a compile error; `host.setLang` replaces the `lang="en"` literal (re-asserted on every change — F-08's `all: initial` note documented); launcher re-applies its `t()`-derived aria-label on `render()`/`setDisabled()`; the composer pair calls the handler that flips locale + `lang` + re-renders the mounted surface.
- **Wire widening**: `ReportMeta.type: 'bug' | 'feedback'` + optional `note` (sent only when non-empty, keeping empty-note reports byte-stable); `buildMeta` is now the prefill helper (code-point clamp, `location.pathname` only).
- **Harness + rows**: `e2e/helpers/composer.ts` (`waitForComposer`, `waitForReview`, `setTitle`, `setNote`, `setType`, `setLocaleToggle`, `clickComposerReview/clickReviewEdit/clickReviewSend`, `reviewAndSend` — `completeComposer` deliberately deferred to 03-07 where its first caller lives), `probeWidget` extended with the plan's 12 fields plus 6 additive ones the new rows read (`composerWidth`, `composerHeading`, `composerTitleAriaInvalid`, `titleFocused`, `composerCounter`, `composerCounterShown`), and 8 new green rows: PRV-07, P3-D-02, P3-D-03, P3-D-04, note-counter, WDG-06 (re-pointed F-08), WDG-06 es, WDG-06 override.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "capture → composer → review → send" with one encode** (tracer) - `97bcfe4` (feat) — pipeline split, masks leaf, encodeFinal, composer/review, router, copy keys + stringsEs, lane widening, harness + PRV-07. Tracer feedback gate: verify re-ran end-to-end after the commit (build green, PRV-07 green, sink gate green) — auto-continued per `human_verify_mode=end-of-phase` (the tracer's verify carries only `<automated>`, no user-facing halt).
2. **Task 2: Form semantics rows** - `ab893ab` (test) — P3-D-02/03/04 + note-counter rows green first run; small router tolerance tweak (reviewDraft also valid when re-entering from review).
3. **Task 3: Core i18n** - `01fe093` (feat) — locale runtime, setLang, launcher re-render, EN/ES pair wiring, WDG-06 rows.

## Files Created/Modified

- `packages/sdk/src/redact/masks.ts` - NEW: MaskPatch / putPatch / single MASK_RGB (lazy-lane-safe leaf)
- `packages/sdk/src/widget/composer.ts` - NEW: the composition overlay + DOM contract + COMPOSER_CSS
- `packages/sdk/src/widget/review.ts` - NEW: the review screen (decoded artifact) + REVIEW_CSS
- `e2e/helpers/composer.ts` - NEW: the suite-wide composer walk vocabulary
- `packages/sdk/src/capture/pipeline.ts` - split into runCaptureStage/CaptureOutcome/Draft + flow start/send/retry; encodeFinal re-export
- `packages/sdk/src/image/encode.ts` - encodeFinal (T3 order); single sink untouched
- `packages/sdk/src/redact/redactor.ts` - MASK_RGB moved/re-exported; fillBitmapRects added
- `packages/sdk/src/strings.ts` - 35 new core keys + stringsEs + Locale/detectLocale/setLocale/locale + locale-aware t()
- `packages/sdk/src/transport/lane1.ts` - ReportMeta widened; buildMeta → prefill helper
- `packages/sdk/src/widget/host.ts` - setLang + locale-declared lang
- `packages/sdk/src/widget/launcher.ts` - render() + label re-application
- `packages/sdk/src/index.ts` - Screen router, locale resolution, onLocaleChange
- `e2e/helpers/capture-stubs.ts` - probeWidget composer/review fields (additive only)
- `e2e/sdk.spec.ts` - 8 new rows; F-08 row re-pointed to WDG-06

## Decisions Made

- **T3 order = plan text governs** (replay masks → re-apply T1 → encode). The PATTERNS §14 sketch inverts it; the plan's acceptance criterion literally checks this source order, and both passes are flat opaque writes so the property is unaffected either way.
- **Capture failures keep the status panel in this plan.** The degraded composer is 03-04's surface (and its row re-pointing 03-07's); 03-03's `{ok:false, captureNote}` maps onto the Phase-2 loud states (`blank|oversize` → blank bucket, `denied|no-api` → capture bucket) so every failure row stays meaningful — verified: P2-D-12 ×2, OQ-1, CAP-01-rejected, WR-03, S-7 guard and fail-closed all still pass.
- **`captureNote` vocabulary implemented as the plan defines it**; the no-CSPRNG exit is deliberately NOT a captureNote (it fails before the stage, restoring the host — FX-01) and the EN/ES button pair keeps `aria-label = t('i18n.label')` exactly as the DOM contract spells it.
- **`note` reaches the wire only when non-empty** (JSON.stringify drops the undefined key), keeping empty-note reports byte-identical to the Phase-2 shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Title code-point clamp at Review entry**
- **Found during:** Task 1 (composer review handler)
- **Issue:** the plan clamps the title only at prefill; a user who PASTES a >200-code-point title would send a value the server's Zod `.max(MAX_TITLE_CHARS)` 400s — a contract-correctness gap the note field does not have (it clamps on input).
- **Fix:** `draft.title = clampCodePoints(trimmed, MAX_TITLE_CHARS)` on the unblocked review path (the input stays untouched — `maxlength` remains a hint-or-absent per Pitfall 13).
- **Files modified:** packages/sdk/src/widget/composer.ts
- **Verification:** P3-D-02 row proves the prefill clamp; the wire cap is now structurally unreachable above 200 code points.
- **Committed in:** 97bcfe4 (Task 1 commit)

**2. [Rule 2 - Missing Critical] putPatch alpha normalization + fail-closed validation**
- **Found during:** Task 1 (redact/masks.ts)
- **Issue:** the plan specifies `putPatch` as "row-wise `data.set`"; a literal copy would let a hypothetical alpha-broken patch write a semi-transparent region past the encode (the pre-mask color survives underneath — exactly the SEC-02/R-13 fall-open).
- **Fix:** alpha is forced to `MASK_ALPHA_OPAQUE` on each copied row (which is why `masks.ts` imports the constant the plan says it imports), and non-finite / non-integral / out-of-bounds / dimension-mismatched patches THROW (mirroring `toBitmapRect`'s refusal to guess) instead of silently painting nothing.
- **Files modified:** packages/sdk/src/redact/masks.ts
- **Verification:** the sink/no-storage/runtime gates stay green; PRV-07 round-trips the encode path with an empty mask list; `fillBitmapRects` throws on non-finite rects too.
- **Committed in:** 97bcfe4 (Task 1 commit)

**3. [Rule 3 - Blocking] Two additive probe fields beyond the enumerated `probeWidget` list**
- **Found during:** Task 2/3 (row authoring)
- **Issue:** the plan fixes 12 composer/review probe fields, but the P3-D-04 width assertion, the ES/override heading assertions, the blocked-review focus/aria-invalid assertions and the 3,999/4,000 counter assertion need six more reads; S-8's rule is "add fields to this probe rather than bespoke per-row evaluates".
- **Fix:** added `composerWidth`, `composerHeading`, `composerTitleAriaInvalid`, `titleFocused`, `composerCounter`, `composerCounterShown` — additive only, nothing renamed or removed.
- **Files modified:** e2e/helpers/capture-stubs.ts
- **Verification:** all rows using them pass on chromium.
- **Committed in:** 97bcfe4 / ab893ab / 01fe093 (with their respective tasks)

---

**Total deviations:** 3 auto-fixed (2 missing-critical, 1 blocking-additive).
**Impact on plan:** all three preserve the plan's contracts and the suite's vocabulary; no scope creep. The review.ts summary rows were also restructured mid-Task-1 to use ONLY approved copy-map keys after a draft introduced two non-existent ones (`review.summary.type/image` was caught by checking the UI-SPEC string map before running).

## Issues Encountered

- **Interim-red Phase-2 rows (BY DESIGN, closed by 03-07).** Replacing the one-gesture send with the composer puts every existing row that ends `clickLauncher → 'Report sent ✓'` into a waiting state. Measured on chromium: **41 rows fail** (each on the pre-send headline wait, none on an artifact assertion) and 22 pass. The families match research F4's table exactly (F4 estimated ~30; the true count including the PRV-02 ×7, H-1 ×4 and S-8 rows is **41** — 03-07 should size its migration by this number). The plan's own verification scope (`-g "PRV-07|P3-D-0|WDG-06"`) is fully green, and every capture-FAILURE row stays green because failures deliberately still route to the status panel until 03-04. No row was deleted or skipped; `completeComposer` lands with 03-07 per the plan's wave contract.
- The full-suite regression sweep (~28 min of this plan's duration) was run deliberately to produce the evidence-based count above.
- PowerShell console-encoding mangled the first `Add-Content` verification; the appended rows were re-verified byte-for-byte as UTF-8 (✓/— intact) before running.

## Security / Threat Surface

Threat register dispositions all landed: T-03-14 (el()/textContent only — static-grepped clean in composer/review), T-03-15 (Draft holds only post-T1 pixels + post-mask patches; no pre-mask state exists), T-03-16 (locale override in-memory; the running-bundle behavior probe asserts zero host-storage keys AND `sdk-no-host-storage` stays green), T-03-17 (encode once at Review entry; the PRV-07 row asserts exactly one intercepted POST whose image part decodes). No new network endpoints, no schema changes, zero packages installed. **No threat flags.**

## Known Stubs (intentional mount points — wired by named later plans)

| Stub | File | Reason / wired by |
|------|------|-------------------|
| `.composer-annotate` / `.composer-replace` click no-ops (handlers optional) | packages/sdk/src/widget/composer.ts | editor lane → 03-05 (A-2 loads the chunk at Annotate) |
| `.composer-attach` / `.composer-continue` click no-ops | packages/sdk/src/widget/composer.ts | file lane + text-only/degraded composer → 03-04 |
| `editor.loading` / `editor.load.error*` keys | packages/sdk/src/strings.ts | the Annotate button's loading states render when 03-05 wires it |
| `captureNote` stored on the Draft but not rendered | packages/sdk/src/capture/pipeline.ts | degraded composer copy (F6 hint mapping) is 03-04's surface |

None blocks this plan's goal — the plan's stated slice is "the frame the later plans mount into".

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 03-04 can mount the degraded/text-only composer directly: `data-wb-state="degraded"|"text-only"`, `data-wb-zone="none"` and the attach/continue handler slots exist; `captureNote` is on the Draft already.
- 03-05 gets the editor's mount contract: `Screen 'editor'`, the optional annotate/replace handlers, and the `maskConfirm` copy keys resolved through core `t()`.
- 03-06's mask replay matches `encodeFinal`'s order (patches → T1 → encode); `putPatch` validates strictly, so a producer must hand it integral, in-bounds, rect-sized pixels.
- 03-07 owns the migration: 41 enumerated interim-red rows (not ~30) — the failure families all walk via `completeComposer`, the six failure rows re-point at `.composer[data-wb-state="degraded"]` (which first requires 03-04), and `probeWidget`/harness fields are already in place.
- Firefox/WebKit runs of the new rows belong to the phase-level `npm run verify` (the plan's commands scoped chromium); nothing in this plan is engine-specific in its assertions except the stub-tier frame sizes, which are asserted as "> 0".

---
*Phase: 03-report-composer-annotation-editor-lazy*
*Completed: 2026-10-28*

## Self-Check: PASSED

- All 15 claimed files verified present on disk (4 created + 10 modified + SUMMARY).
- All 3 task commits verified as ancestors of HEAD (`97bcfe4`, `ab893ab`, `01fe093`); `commits: 3` measured from the plan ledger (`d2e6f62..HEAD`), matching the frontmatter.
- Plan-level verification re-run at HEAD: build green, `-g "PRV-07|P3-D-0|WDG-06"` 8/8 green (chromium), `gate.mjs` 3/3 green, `check:size` PASSED.
