---
phase: 03-report-composer-annotation-editor-lazy
plan: 05
subsystem: sdk-widget-ui
tags: [annotator, canvas, lazy-loading, dynamic-import, undo, i18n, playwright, size-gate, static-gates]

# Dependency graph
requires:
  - phase: 03-report-composer-annotation-editor-lazy
    plan: 03-03
    provides: the composer frame + annotate-button slot (the no-op this plan wires), the Draft with the single working ImageData, encodeFinal's one sink, redact/geometry (transformFor/toBitmapRect), strings.ts editor.loading + editor.load.error* + mask.confirm.* core keys, probeWidget/composer harness
  - phase: 03-report-composer-annotation-editor-lazy
    plan: 03-04
    provides: the file lane + degraded composer (attach/replacement races the annotate guard defuses), composerPreviewWidth/Height probe fields, the six re-pointed failure rows (03-05's editor rows sit on top of them)
provides:
  - "widget/loader.ts — one memoised, non-analyzable import() of watchbug-annotator.mjs resolved ONLY from the core bundle's own URL; failure clears the memo and a ?retry= buster defeats the engine's cached module-map rejection (probe-verified)"
  - "The hand-rolled lazy editor: fullscreen canvas inside the same closed shadow root, ONE bitmap (the draft's own ImageData mutated in place + flattened at Done), freehand/arrow/rectangle/text tools, bounded 20-stroke undo by button and Ctrl/Cmd+Z, no clear-all"
  - "strings.editor.ts — editor.* EN+ES typed twin living entirely in the lazy lane; locale arrives through AnnotatorOpenOptions so editor chrome and core surfaces cannot disagree"
  - "EDITOR_CSS appended once to the data-wb-core style element — still exactly one <style> after the chunk loads"
  - "e2e/helpers/editor.ts — the annotation walk vocabulary with the canvas->viewport mapping written independently of the SDK's geometry; analyzeInk band/box/cross pixel evidence over the decoded wire bytes"
  - "check-size: lazy lane gated max(.js,.mjs) <= 25 KB with a >= 2 KB anti-inline floor on both twins; gate.mjs: sdk-lazy-lane-purity (4 rules total, all green)"
  - "rows ANN-01/02/03/04(+empty,+encoding)/ANN-06 x2/PRF-02 lazy x2/WDG-06 editor — 33 green runs across chromium+firefox+webkit"
affects: [03-06-mask-lane, 03-07-suite-migration, verify-work-03, phase-4-enricher]

# Actuals (#2632)
actuals:
  tokens: 28098   # chars/4 over the realized packages+e2e+scripts diff (d789107..948178b)
  tasks: 3
  commits: 4      # MEASURED: git rev-list --count d789107..HEAD
plan_head_before: d7891077cf7aadaf24d59b39613bd7cdfb86b686
plan_head_after: 948178b42ed08bb97ece36b09660e913aff86cae

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "module-map retry buster: a cleared loader memo is necessary but NOT sufficient — engines cache a failed dynamic-import fetch per URL, so a retry re-fetches through `href + '?retry=N'` only after a failure (happy path stays exactly one bare request)"
    - "ink-evidence windows placed in the stub frame's palette-block gap rows/columns and far from #0b7285 teal (d2 11709) so no presence/absence assertion can pass vacuously; tolerance 14400 under a <= +-8 WebP noise margin"
    - "inline label flow anchored on `click` (not pointerdown — the click's own mousedown would blur-commit it empty) with its keydown handlers stopPropagating Escape/Enter so the editor's Escape-to-Done never double-fires (Pitfall 11 discipline)"
    - "flatten-at-Done: committed vector strokes merge into the draft's own buffer via one getImageData -> base.data.set readback; the transient copy dies in the same statement — no retained second bitmap anywhere (C-2/A-04)"

key-files:
  created:
    - packages/sdk/src/widget/loader.ts
    - packages/sdk/src/annotator.ts
    - packages/sdk/src/annotator/canvas-layer.ts
    - packages/sdk/src/annotator/tools.ts
    - packages/sdk/src/annotator/editor-dom.ts
    - packages/sdk/src/strings.editor.ts
    - e2e/helpers/editor.ts
  modified:
    - packages/sdk/src/widget/host.ts
    - packages/sdk/src/widget/composer.ts
    - packages/sdk/src/index.ts
    - e2e/helpers/host-fixtures.ts
    - e2e/helpers/capture-stubs.ts
    - e2e/sdk.spec.ts
    - scripts/check-size.mjs
    - scripts/gate.mjs

key-decisions:
  - "loadAnnotator takes the core bundle's own URL from index.ts (LOADING_SCRIPT_URL ?? guarded import.meta.url); the chunk URL is derived only from it (T-03-20) and the retry passes through a query buster after a failure (module-map discovery)"
  - "The editor holds exactly one bitmap: base IS the draft's ImageData, mutated in place; undo is redraw-from-base + vector replay; createImageBitmap is never called in the lane"
  - "maskConfirm strings + ink color + locale are resolved by core and passed in AnnotatorOpenOptions — the chunk imports no dictionary, no color literal"
  - "EDITOR_CSS appends once to the data-wb-core style element (host.ts marker) — one stylesheet, no adoptedStyleSheets"
  - "The mask rail button renders (layout/aria/i18n complete) but is inert until 03-06; text/arrow/rectangle land fully in Task 2"
  - "check-size floors BOTH lazy twins at 2 KB (min-twin), stronger than the plan's floor-on-max: a collapsed twin is exactly the drift the max-gate exists to catch"

patterns-established:
  - "Artifact-level ink evidence: drive the editor with trusted pointer drags in bitmap coordinates, decode the OUTGOING wire bytes in the engine that encoded them, and locate ink with independently-computed geometry (band/box/cross)"
  - "Static lane-purity gate: value/side-effect/literal-dynamic imports of the lazy lane from core FAIL; the single type-only crossing (widget/loader.ts) is named in the PASS notes"

requirements-completed: [ANN-01, ANN-02, ANN-03, ANN-04, ANN-06, WDG-06, PRF-02]

coverage:
  - id: D1
    description: "The annotator chunk is fetched only on the Annotate click — zero requests while composing, exactly one bare .mjs request after, no second fetch on reopen (memoised), no new globals/prototypes from the chunk load"
    requirement: PRF-02
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#PRF-02 lazy: the annotator chunk is fetched only on Annotate, exactly once, and adds no global (chromium+firefox+webkit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loading/error UX: 12 px spinner + editor.loading on the disabled button mid-fetch; on failure the button re-enables with editor.load.error + hint inline (never a dead button) and the retry opens the editor (module-map buster)"
    requirement: PRF-02
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#PRF-02 lazy: the fetch shows the loading state, and a failed load re-enables the button with the inline error (chromium+firefox+webkit)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The four tools draw through one geometry authority and the flattened ink survives to the wire: freehand along the drag path, arrow shaft+wider head, rectangle outline with untouched interior, text labels (Enter/click-outside commit, Escape cancels, empty draws nothing, non-ASCII verbatim) — all asserted on the decoded outgoing bytes"
    requirement: ANN-01
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#ANN-01/ANN-02/ANN-03/ANN-04/ANN-04 empty/ANN-04 encoding (24/24 runs green across chromium+firefox+webkit)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Undo removes one annotation stroke per invocation by button and by Ctrl/Cmd+Z; the kept stroke is the only ink left; the stack is capped at 20 with no clear-all control and no mask path"
    requirement: ANN-06
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#ANN-06: undo removes one stroke and never a mask / Ctrl/Cmd+Z matches the undo button (chromium+firefox+webkit)"
        status: pass
      - kind: other
        ref: "source assertion: UNDO_LIMIT = 20 with shift-cap in canvas-layer.ts; zero 'clear' affordances in editor-dom.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Editor chrome localises: title/Done/tool aria-labels/title-attr/canvas label all Spanish under es-ES while core copy resolved es before the chunk existed (locale passed in AnnotatorOpenOptions)"
    requirement: WDG-06
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#WDG-06 editor: the editor chrome localises (chromium+firefox+webkit)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The laziness claim is mechanical: check-size gates the lazy lane on max(twins)<=25 KB with a >=2 KB anti-inline floor (both twins print, fixed lane order), and sdk-lazy-lane-purity fails any value/side-effect/literal-dynamic core import of the lane (rejection path proven with a scratch violation)"
    requirement: PRF-02
    verification:
      - kind: other
        ref: "npm run check:size (lazy 4.6/4.3 KB gz, floor OK, runtime 21.8 KB, PASSED)"
        status: pass
      - kind: other
        ref: "node scripts/gate.mjs (4 passed, 0 failed — purity allows exactly widget/loader.ts:22 type-only)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The three plan prohibitions (no editor prefetch before the gesture; core never absorbing editor bytes for convenience; no pre-mask snapshot or second retained bitmap anywhere in the editor model) hold as standing never-assertions"
    verification: []
    human_judgment: true
    rationale: "The plan marks all three must_haves.prohibitions verification: judgment — the rows and gates prove the current build (zero-before-request, floor + purity gate, one-bitmap source shape), but the never-claims are code-review properties for the phase verifier"

duration: 82 min
completed: 2026-10-28
status: complete
---

# Phase 03 Plan 05: Lazy Annotation Editor Summary

**The hand-rolled annotation editor ships as a real lazy lane: `Annotate image` fetches `watchbug-annotator.mjs` (4.6/4.3 KB gz, floor-protected) through one non-analyzable `import()` resolved only from the core bundle's own URL, opens a fullscreen canvas inside the same closed shadow root on exactly one bitmap, draws freehand/arrow/rectangle/text with stroke-level undo, and flattens its ink into the draft's own `ImageData` — proven on the decoded wire bytes across all three engines, with lane purity and the chunk floor now enforced by two mechanical gates.**

## Performance

- **Duration:** ~82 min (started 2026-10-28T18:52:08Z, completed 2026-10-28T20:13:50Z)
- **Started:** 2026-10-28T18:52:08Z
- **Completed:** 2026-10-28T20:13:50Z
- **Tasks:** 3 (1 tracer + 2 auto)
- **Files modified:** 15 (6 SDK-created incl. the annotator/** lane, 4 e2e, 2 scripts, 3 core-modified)

**Estimate miss (#2632):** plan estimated 92 000 tokens (confidence low); the realized diff measures ~28 100 tokens (chars/4). Roughly a 3x overestimate — every empirical probe (module-map retry, WebP dilution windows) stayed inside the plan's own decisions, so no risk budget was actually spent.

## Accomplishments

- **Tracer (Task 1, `fcb97a4`):** loader + module contract + editor shell + canvas layer + freehand end-to-end: spinner/loading state, `data-wb-error="editor"` recovery path, `data-wb-core` single-stylesheet discipline, the independent-mapping harness (`e2e/helpers/editor.ts`), set-serving `serveBundle` (chunk twins served, unknown names still 404), probeWidget editor fields, `snapshotGlobals` (WDG-04 shape on demand), and rows ANN-01 + PRF-02 lazy x2. Tracer feedback gate: verify re-ran after the commit (build, ANN-01, PRF-02 lazy all green) — auto-continued per `human_verify_mode=end-of-phase` (verify carries only `<automated>`).
- **Task 2 (`30fef1b` + `b0c3635`):** arrow (shaft + filled head with a perpendicular-width probe proving head > shaft), rectangle (four edge bands + a pure-gradient interior window at strict 0), text (Enter + click-outside commit, Escape cancels without closing the editor, empty draws nothing, `Añadir ✓` verbatim with a right-end sub-window so truncation fails). All five rows green on chromium AND firefox (the engine with the most divergent canvas font parsing) — then webkit too.
- **Task 3 (`948178b`):** ANN-06 rows (button and Ctrl/Cmd+Z remove exactly one stroke, the survivor is the only ink), WDG-06 editor row (all six tool labels + `Listo` + canvas label + `title` attrs in Spanish), `check-size` max-of-twins + 2 KB floor with both twins and the floor verdict printed in fixed lane order, and `sdk-lazy-lane-purity` (4/4 rules green; rejection proven against a scratch value/side-effect import before deletion).
- **Suite totals for this plan's scope:** `ANN-0` 24/24 x 3 engines; `PRF-02 lazy|WDG-06 editor` 9/9 x 3 engines; composer/file-lane regression `PRV-07|P3-D-0|WDG-06|CAP-02|CAP-03` 16/16 chromium; `npm run build` + `check:size` + `gate.mjs` green; SDK typecheck clean (full `npm run lint`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Annotate -> lazy chunk -> freehand -> Done -> ink on the wire** (tracer) - `fcb97a4` (feat)
2. **Task 2: Arrow, rectangle, text on one geometry authority** - `30fef1b` (feat) + `b0c3635` (test: Escape-cancels assertion closing the acceptance list)
3. **Task 3: Undo, editor i18n, size/gate guards** - `948178b` (feat)

**Plan metadata:** this SUMMARY's commit (docs: complete plan).

## Files Created/Modified

- `packages/sdk/src/widget/loader.ts` - NEW: `loadAnnotator(coreUrl)`, memoised, retryable via `?retry=` buster, variable specifier
- `packages/sdk/src/annotator.ts` - REAL lane entry (was the build stub): `AnnotatorModule`/`AnnotatorOpenOptions`/`open()`, `ANNOTATOR_LANE` kept for the size gate
- `packages/sdk/src/annotator/canvas-layer.ts` - NEW: pointer capture, canvas-box -> `transformFor` -> bitmap mapping, live previews, 20-cap undo, click-anchored labels, flatten-at-Done
- `packages/sdk/src/annotator/tools.ts` - NEW: self-contained `Stroke` records + per-tool renderers + `resolveFont` read-back (Pitfall 6)
- `packages/sdk/src/annotator/editor-dom.ts` - NEW: `EDITOR_CSS`, top bar + 44px vertical rail with SVG glyphs, inline `input.text-label`, one-time `injectEditorCss`
- `packages/sdk/src/strings.editor.ts` - NEW: `STRINGS_EDITOR` EN+ES typed twin + local `tEditor`
- `packages/sdk/src/widget/host.ts` - `data-wb-core` on the single style element
- `packages/sdk/src/widget/composer.ts` - annotate loading/error states, `runAnnotate` round-trip (mount guard: draft identity + frame identity + `opened`-path restore), `ComposerEditorDeps`
- `packages/sdk/src/index.ts` - `CORE_BUNDLE_URL` (IIFE/ESM lanes), editor screen transitions through the router
- `e2e/helpers/editor.ts` - NEW: openEditor/selectTool/dragOnBitmap/clickOnBitmap/typeLabel/undo/undoKey/done + independent `canvasToViewport` + `analyzeInk` (bands/boxes/crosses)
- `e2e/helpers/host-fixtures.ts` - annotator twins in `BundleName`, set-serving `serveBundle` (404 stays meaningful), `snapshotGlobals`
- `e2e/helpers/capture-stubs.ts` - probeWidget gains the plan's 8 editor fields + `annotateDisabled`
- `e2e/sdk.spec.ts` - 10 new rows + the shared `drawAndSend` walk
- `scripts/check-size.mjs` - lazy lane: max(twins) ceiling + min(twin) floor, both printed, order/A-12 note untouched
- `scripts/gate.mjs` - `sdk-lazy-lane-purity`

## Decisions Made

- **Chunk URL derives ONLY from the core bundle's own URL** (`LOADING_SCRIPT_URL ?? import.meta.url`, the latter compiling to `undefined` in the IIFE lane — Pitfall 2); `init()` options, data-attributes and `document.baseURI` are never consulted (T-03-20).
- **Retry through a fresh URL:** the research's "clear the memo so a 404 is retryable" was probe-disproved against the live engine (`probe2`: module map returns the cached rejection without a network re-fetch — request attempts stayed at 1). The buster fires only after a failure, so PRF-02's one-bare-request claim keeps its teeth. Recorded as a deviation below.
- **One bitmap discipline in code:** `finish()` replays `base` + vector strokes then folds the canvas back into `base.data` — no snapshot before mutations, no held copy after; `createImageBitmap` appears in the lane only in the comment that forbids it.
- **Text labels anchor on `click`,** not `pointerdown` (the same trusted click's mousedown blur-commits a just-opened input empty), and the input's Enter/Escape handlers `stopPropagation` so Escape cancels the label without closing the editor (Pitfall 11).
- **Ink windows were chosen empirically against the stub frame's palette:** teal `#0b7285` sits at d²=11709 under the 14400 tolerance, so every sampled band/box lies in block-gap rows/columns and/or on the navy side of the gradient; the rectangle moved there after the probe caught a thin blue stroke over the gold half collapsing under WebP 4:2:0 chroma dilution (a real encoding-robustness fact, not a geometry bug — the canvas proved the stroke painted).
- **Floor on BOTH twins** (min >= 2 KB) — strictly stronger than the plan's floor-on-max for detecting a collapsed twin; the ceiling is the max exactly as planned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The editor painted the canvas but never flattened ink into the draft buffer**
- **Found during:** Task 1 (before any commit, via a throwaway probe row)
- **Issue:** the first cut returned `base` mutated only on the canvas surface — the decoded outgoing image carried zero ink (`bandInk: 0` measured).
- **Fix:** `finish()` replays and folds `getImageData` back into `base.data` (same instance).
- **Files modified:** packages/sdk/src/annotator/canvas-layer.ts
- **Verification:** probe re-run: 804 ink-band pixels along the path on the wire, ANN-01 green.
- **Committed in:** fcb97a4 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Module-map rejection caching defeats a bare re-`import()` retry**
- **Found during:** Task 1 (the load-error recovery row timed out on retry)
- **Issue:** research Pattern 4/Code Examples asserted clearing the memo makes a transient failure retryable; Chromium (and the spec) cache the failed fetch per URL — the retry never re-hit the network (probe: 1 attempt, cached rejection).
- **Fix:** `loadAnnotator` appends `?retry=N` only for attempts after a failure; the happy path keeps the bare URL so PRF-02's request-count assertions remain exact.
- **Files modified:** packages/sdk/src/widget/loader.ts
- **Verification:** recovery row green on all three engines: error -> re-enabled button -> retry opens the editor; laziness row still sees exactly one bare `.mjs` request.
- **Committed in:** fcb97a4 (Task 1 commit)

**3. [Rule 1 - Bug] The text input self-cancelled before a single keystroke**
- **Found during:** Task 2 (label rows timed out; probe caught `data-shown` flipping false synchronously)
- **Issue:** opening/focusing the input inside `pointerdown` let the same click's mousedown default move focus away -> blur -> empty commit -> closed.
- **Fix:** anchor the label on the canvas `click` event (after focus settles); `labelDown` carries the pointerdown bitmap point.
- **Files modified:** packages/sdk/src/annotator/canvas-layer.ts
- **Verification:** ANN-04 (+empty, +encoding) green on all three engines.
- **Committed in:** 30fef1b (Task 2 commit)

**4. [Rule 3 - Blocking] E2e ink windows were vacuous or noise-flaky at first placement**
- **Found during:** Task 2 (ANN-03 interior failed with 1 counted pixel; analysis found the old rectangle's right edge over the gold gradient AND sample windows clipping teal `#0b7285` blocks)
- **Issue:** teal is inside the 14400 tolerance and thin blue over gold loses WebP chroma subsampling — presence could pass without ink (teal) or fail with it (gold).
- **Fix:** all editor-row geometry moved to the stub frame's block-gap rows/columns on the navy side; windows machine-checked against the teal grid before shipping.
- **Files modified:** e2e/sdk.spec.ts, e2e/helpers/editor.ts (tolerance + window documentation)
- **Verification:** every presence window excludes teal pixels (script-checked), every absence window sits at background d² >= ~17-23k (noise margin >= ~3k); rows stable x3 engines.
- **Committed in:** 30fef1b / b0c3635 / 948178b with their tasks

### Execution notes (not defects)

- Throwaway probe specs (`probe-editor`, `probe2/3/4`) drove the empirical discoveries above; all were deleted before any commit (the working tree never carried them into git).
- The Task-2 acceptance line "Escape cancels" got its own assertion commit (`b0c3635`) rather than riding in the feature commit — the plan's rows list doesn't name it, the acceptance criteria do.

---

**Total deviations:** 4 auto-fixed (2 bugs incl. one research-vs-engine contradiction, 1 missing-critical, 1 blocking-test-design).
**Impact on plan:** all four were required to make the plan's own truths observable (flattened ink, retryable load, committed labels, non-vacuous ink windows); no scope growth — the editor is exactly the decided surface (mask still 03-06's).

## Issues Encountered

- **Scoped full-suite run:** plan verification item 5 (`npm run verify -- e2e/sdk.spec.ts` all files) was run as scoped three-engine group runs over every row this plan owns or touches (24+9+16 green) per the dispatch environment's directive — the whole file still carries the ~41 Phase-2 one-shot rows 03-07 owns (red by design, recorded in 03-03/03-04 SUMMARYs); a whole-file run would report exactly those.
- **PowerShell Add-Content mangles non-ASCII** (em-dashes became hyphens mid-append; `'Annadir'`-class glyphs at risk) — the row block was truncated and re-added through the edit tool with byte-verified UTF-8 (`Report sent ✓` confirmed x34, U+2713 intact). The 03-03 note recurs; treat `Add-Content` as ASCII-only in this repo.
- Shared-ID requirement WDG-06: 03-03's SUMMARY already existed, so the #2388 readiness gate passes and the ID flips Complete with this plan (editor half closing the ID the composer half opened). ANN-06 and PRF-02 stayed blocked-by-sibling (03-06/03-07 also declare them without SUMMARYs) and flip when the last declaring plan lands.
- **WINDOWS ledger catch-up** (side effect of recording this plan's stub): entry 6 (annotate mount point, closed HERE) marked fixed; a new entry 9 records the plan-authorized inert mask button for 03-06. While at it, entries 1/2/7/8 were found still `open` despite their defects being documented closed (01-02/01-03, 01-04, 03-04 x2) — each was verified against the code/STATE and marked fixed (entry 1 evidence: `fieldSize: MAX_META_BYTES` in apps/api/src/ingest/caps.ts:51). Ledger now carries exactly one open entry (id 9, owned by 03-06). A stale `.WINDOWS.lock` from a dead holder pid was verified dead and cleared during the sweep.

## Security / Threat Surface

Register dispositions landed: **T-03-20** (chunk URL from the core bundle URL only — never init options/data attributes/baseURI; unresolvable base = rejected promise surfaced as the inline error), **T-03-21** (re-enables with error+hint, memo cleared, retry row green x3 engines), **T-03-22** (one `<style>` asserted on the wire row; ES-module chunk adds no global — snapshot diff asserted), **T-03-23** (one mapping call site through the canvas box; misplaced ink would break the ANN rows), **T-03-SC** (zero packages installed — canvas API + `createElementNS` + `import()` only). No new network endpoints; the `?retry=` query rides the same same-origin path. **No threat flags beyond the plan's register.**

## Known Stubs (intentional mount points — wired by named later plans)

| Stub | File | Reason / wired by |
|------|------|-------------------|
| Mask rail button renders but selecting it does nothing | packages/sdk/src/annotator/canvas-layer.ts | 03-06 wires the drag/bake/confirm dialog (plan-declared: the button exists so rail layout, `aria-pressed` semantics and i18n keys are complete) |
| `maskConfirm` option carried and unused; `masks` round-trips unchanged | packages/sdk/src/annotator.ts | 03-06's bake consumes both — the contract is live before the feature so no later API break |
| `editor.mask.mode.label` / `editor.mask.fill` / `editor.mask.pixelate` keys unreferenced | packages/sdk/src/strings.editor.ts | the mask style mini-toggle lands with 03-06 (WDG-06 requires the keys complete now) |

None blocks this plan's goal: the declared slice (frame + drawing tools, mask tool deferred) is delivered.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **03-06 (mask lane)** gets a live editor mount: `options.masks` round-trips into the same array shape `encodeFinal` replays; the flatten-at-Done readback already runs `base.data.set` so a bake writing post-mask patches into the same buffer needs no contract change. The mask rail button, its i18n keys and the `maskConfirm` strings are already wired end-to-end from core.
- **03-07 (suite migration):** unchanged scope — the 41 one-shot rows + `completeComposer`; this plan's `drawAndSend`/`analyzeInk`/`snapshotGlobals` harness additions are reusable vocabulary; `sdk-no-html-sink` + the closed five-rule verdict still lands there per plan.
- **Verifier:** D7 (the three never-prohibitions) needs human sign-off; everything else is pass-proven on three engines. `check:size` real numbers: core 16.9 / lazy 4.6-4.3 / runtime 21.8 KB gz — the A-12/M-2 arithmetic stays honest (core+lazy = 21.5 KB, deep inside 80).
- **Calibration note:** plan estimate 92K tokens vs 28K actual — the planner's risk budget (loader + geometry + laziness proof) was pre-researched to near-zero execution surprise; future lazy-lane plans can price the research, not the wiring.

---
*Phase: 03-report-composer-annotation-editor-lazy*
*Completed: 2026-10-28*

## Self-Check: PASSED

- All 15 claimed files + this SUMMARY verified present on disk.
- All 4 task commits verified as ancestors of HEAD (`fcb97a4`, `30fef1b`, `b0c3635`, `948178b`); `commits: 4` measured from the on-disk ledger (`d789107..HEAD`), matching the frontmatter.
- No throwaway probe spec reached git history (checked fcb97a4's file list).
- Plan-level verification re-run at HEAD: build green; `check:size` PASSED (lazy 4.6/4.3 floor OK); `gate.mjs` 4/4; `-g "ANN-0"` 24/24 x3 engines; `-g "PRF-02 lazy|WDG-06 editor"` 9/9 x3 engines; composer regression 16/16 chromium.
