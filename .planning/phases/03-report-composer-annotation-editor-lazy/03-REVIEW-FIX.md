---
phase: 03
fixed_at: 2026-10-28T23:52:51Z
review_path: .planning/phases/03-report-composer-annotation-editor-lazy/03-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-10-28T23:52:51Z
**Source review:** `.planning/phases/03-report-composer-annotation-editor-lazy/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 10 (1 critical, 2 high, 3 medium, 4 low)
- Fixed: 10
- Skipped: 0
- Out of scope by instruction (info tier, untouched): IN-01, IN-02

Two of the fixes added **new visible copy** (`status.composeFailed*` in core, `editor.mask.error` in the lazy lane) which the UI-SPEC copy map does not yet contain — see *Items the human must confirm*.

## Fixed Issues

### CR-01: `reviewDraft()` never re-validates the draft/screen after the encode await — stale resolution soft-locks the widget or reviews a degraded draft

**Files modified:** `packages/sdk/src/index.ts`
**Commit:** `506cd06`
**Status:** fixed — requires human verification

**Applied fix:** `reviewDraft()` now captures the generation it belongs to (`screenAtStart`, `imageAtStart`) before the `encodeFinal` await and re-validates after it:

```ts
if (draft !== current || screen !== screenAtStart || current.image !== imageAtStart) return;
```

`current.encoded` is assigned **only after** that check (a stale encode can no longer overwrite a replacement draft's `encoded`), and the `catch` applies the same guard before surfacing the failure — a stale failure now surfaces nothing. The guard is `screen === screenAtStart` rather than the review's literal `screen === 'composer'`, so the entry path from `review` (which the pre-existing `screen !== 'composer' && screen !== 'review'` admits) still resolves instead of silently dying. Mirrors the proven `composer.runAnnotate` pattern.

### HG-01: strokes beyond `UNDO_LIMIT` are evicted from the redraw set without being flattened — the oldest annotation silently vanishes

**Files modified:** `packages/sdk/src/annotator/canvas-layer.ts`
**Commit:** `8d64779`
**Status:** fixed — requires human verification

**Applied fix:** `pushStroke` no longer calls `strokes.shift()`. When the cap is exceeded it runs `redraw()` (base + all 21 vector records + mask patches last), reads the canvas back into `base.data` — the same flattening `finish()` already performs — and restarts the vector list (`strokes.length = 0`). Evicted records have therefore already merged into the only redraw source, so no ink is lost; the *undo history* stays bounded at ~20 as P3-D-11 intends. `UNDO_LIMIT` is deliberately unchanged.

### HG-02: pixelation block floor measured at the unscaled 15 px label font — below the R-13 floor on HiDPI captures

**Files modified:** `packages/sdk/src/capture/pipeline.ts`, `packages/sdk/src/annotator.ts`, `packages/sdk/src/annotator/canvas-layer.ts`, `packages/sdk/src/widget/composer.ts`, `e2e/helpers/editor.ts`, `e2e/sdk.spec.ts`
**Commit:** `3377758`
**Status:** fixed — requires human verification

**Applied fix:** the frame's bitmap-per-CSS-px scale is now plumbed to the bake:

1. `CaptureOutcome` (ok branch) carries `bitmapPerCssPx: transform.scaleX` — the exact H-1 transform already computed at the pixel-read instant; no second derivation.
2. `Draft` gains `bitmapPerCssPx: number`, constructed from the stage value, `1` for a degraded/text-only draft.
3. `AnnotatorOpenOptions` gains `bitmapPerCssPx`, passed by `composer.runAnnotate` from the draft.
4. `bakeRect`: `blockSizeFor(capHeightPx(context) * options.bitmapPerCssPx)` for `pixelate` only; `fill` is untouched (flat black is scale-independent).
5. The attach lane sets `bitmapPerCssPx = 1` when a file replaces the frame (a picked file's pixel grid has nothing to do with the display).

The e2e block-size oracle (`e2e/helpers/editor.ts:measureBlockSize`) is the documented independent twin of the SDK formula, so it now takes the scale and multiplies identically; the pixelate row (`e2e/sdk.spec.ts`) reads the scale in-page as `frame.width / window.innerWidth` — the same expression core uses rather than an assumption about it. Because the tracer frame is 640×360 against a 1280×720 viewport, the floor moves from ~22 to ~11 bitmap px, i.e. the pixelate row now genuinely exercises the scaled path (it would have failed with the old oracle).

**What remains:** an *attachment* has no CSS reference, so its scale is the neutral `1` and the floor is measured in the attachment's own pixels — the same behaviour as before this fix. Deriving a text scale for an arbitrary photo is not possible client-side.

### WR-01: async attach/annotate lanes mutate the draft without identity or screen checks

**Files modified:** `packages/sdk/src/widget/composer.ts`, `packages/sdk/src/index.ts`
**Commit:** `07b5f80`
**Status:** fixed — requires human verification

**Applied fix:** three gaps closed, plus one shared authority:

- **(a) identity:** the `change` handler captures `const target = draft; const imageAtStart = target.image;` before the decode and the `.then` bails unless `open && draft === target && target.image === imageAtStart` (a discarded, replaced or editor-swapped draft is abandoned silently). The `.catch` applies the same guard, so a stale rejection cannot paint a refusal onto a different draft.
- **(b) screen:** the `.then` no longer calls `render()`; it calls the new **required** `ComposerHandlers.onDraftMutated`, and `index.ts` implements it as `showScreen(screen)` — the router re-renders only the surface that currently owns the screen. `open` is false whenever another surface owns the screen (the router renders the composer with `null`), so a background attach can no longer re-show the composer underneath the review and leave a Send that throws out of `pendingFor`.
- **(c) concurrency:** one `updateBusyButtons()` matrix disables `attach`, `noticeAttach`, `replace`, `annotate` **and** `review` while either async lane is in flight; `runAnnotate` gains an `attaching` guard and `openPicker` an `annotating` guard.
- **`pendingFor` throw:** `onSend` now routes a rejection to the loud terminal state instead of `void flow.send(...)` (unhandled rejection + dead button).

### WR-02: `fitToCaps()` applies the `MIN_EDGE_PX` floor per axis — small attachments are upscaled and aspect-distorted

**Files modified:** `packages/sdk/src/image/encode.ts`
**Commit:** `25fdd6d`

**Applied fix:** the floor is now a second, **scale-preserving** pass: `grow = max(MIN_EDGE_PX / w, MIN_EDGE_PX / h)` applied to both axes (guarded against a zero dimension so no `Infinity`/`NaN` can reach `createCanvas`). A 20×400 banner becomes 32×640 instead of 32×400; a 64×64 fixture (the CAP-02 rows) is unchanged. Both consumers (`encodeLadder`, `ManualFileCapture`) share the fix.

### WR-03: encode failure at Review entry is reported as a *capture* failure, and "Try again" discards the composed draft

**Files modified:** `packages/sdk/src/index.ts`, `packages/sdk/src/widget/status-panel.ts`, `packages/sdk/src/strings.ts`
**Commit:** `4d8ac4b`
**Status:** fixed — requires human verification

**Applied fix:** a new `StatusFailure` member `'compose'` (the frame captured; the artifact could not be produced) with its own headline + hint in both locales, rendered by `renderFailed`. `reviewDraft`'s catch and the `onSend` catch both use it. The panel's `onRetry` now checks the last view: on `compose` with a live draft it calls `showScreen('composer')` — the title, note, type, ink and masks are all intact — instead of `flow.retry()`, which would have started a brand-new gesture with a new idempotency key. Every other failure keeps the Phase-2 semantics (resend the payload, or restart the capture).

**New copy (needs UI-SPEC sign-off):** EN `Something went wrong preparing the screenshot.` / `Nothing was sent. Your report is still here — try again.`; ES `No se pudo preparar la captura.` / `No se envió nada. Tu informe sigue aquí; inténtalo de nuevo.`

### LW-01: `putPatch` normalizes alpha in place on the source patch via the subarray view

**Files modified:** `packages/sdk/src/redact/masks.ts`
**Commit:** `8cc79aa`

**Applied fix:** copy-then-normalize — each row is copied into a fresh `Uint8ClampedArray`, alpha is forced to `MASK_ALPHA_OPAQUE` on that copy, and the copy is written to the target. The draft's retained `MaskPatch` pixels (replayed by `rebakeMasks`, re-sent on the next round trip) can no longer be rewritten by a `putPatch` call. Fail-closed validation above it is unchanged.

### LW-02: `bakeRect`'s catch turns a failed mask into a silent no-op

**Files modified:** `packages/sdk/src/annotator/canvas-layer.ts`, `packages/sdk/src/annotator/editor-dom.ts`, `packages/sdk/src/strings.editor.ts`
**Commit:** `b64db16`

**Applied fix:** the editor shell gained an in-bar `span.editor-error` (`role="alert"`, `data-shown="false"`, `--wb-color-danger`, hidden by default) with `showMaskError()` / `clearMaskError()`. `bakeRect`'s catch now calls `showMaskError()` and a successful bake clears it; `renderCopy()` re-resolves the shown refusal's copy so a locale switch cannot leave the previous language on screen. The once-per-session confirmation path and the second-mask path share the same `bakeRect`, so both are covered.

**New copy (needs UI-SPEC sign-off):** EN `That area couldn't be masked. Nothing was hidden there.`; ES `No se pudo enmascarar esa zona. Ahí no se ocultó nada.`

### LW-03: HTTP 408 is classified as a permanent contract rejection

**Files modified:** `packages/sdk/src/transport/lane1.ts`
**Commit:** `26bae79`

**Applied fix:** `const transient = response.status === 408 || response.status === 429 || response.status >= 500;` — a Request Timeout now rides the locked P2-D-03 retry schedule with the same key instead of becoming `SendError('rejected')`.

### LW-04: the `sdk-lazy-lane-purity` gate misses template-literal dynamic imports

**Files modified:** `scripts/gate.mjs`
**Commit:** `f29b113`

**Applied fix:** the literal-specifier census is now `/\bimport\s*\(\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/` and reads the specifier from group 2. Probed directly: `import('./annotator.ts')`, `import("./annotator/x.ts")`, `` import(`./annotator.ts`) `` and `` import(`./strings.editor.ts`) `` all resolve to the specifier; `import(specifier)` (the loader's legal variable form) still does not match. `npm run gate` passes 5/5 with the real tree.

## Skipped Issues

None. IN-01 and IN-02 were excluded by the fix scope (info tier) and are intentionally untouched.

## Verification

**Verification ran in the MAIN CHECKOUT** (`E:\Proyectos Github\Watchbug_TFG`) — no worktree, no branch, per the orchestrator's environment override. The gates below ran against the working tree that holds all ten commits, with the repository's existing `node_modules`.

| # | Command | Result |
|---|---------|--------|
| 0 | `npm run lint` (baseline, before any edit) | PASS |
| — | `npm --workspace @watchbug/sdk run typecheck` (after **each** fix, before its commit) | PASS ×10 |
| 1 | `npm run lint` (workspace-wide `tsc` ×4: contracts, sdk, api, panel) | **PASS** — no diagnostics |
| 2 | `npm run build` (contracts → sdk IIFE+ESM core/lazy/adapter → api → panel) | **PASS** — core 17.2 KB gz, panel built |
| 3 | `npm run check:size` | **PASS** — `core 17.2 / 45`, `lazy 6.8 / 25`, `adapter 0.3 / 14`, `runtime 24.4 / 80` |
| 4 | `npm run verify` (Playwright, chromium + firefox + webkit) | **PASS — 453 passed (9.0m)**, 0 failed |

Verbatim result lines:

```
> watchbug@0.1.0 lint
> npm run typecheck --workspaces --if-present
> @watchbug/contracts@0.1.0 typecheck   (clean)
> @watchbug/sdk@0.1.0 typecheck         (clean)
> @watchbug/api@0.1.0 typecheck         (clean)
> @watchbug/panel@0.1.0 typecheck       (clean)

SIZE OK   core      17.2 KB gz / 45 KB | watchbug.mjs: 17.0 KB gz (-0.2 vs iife)
SIZE OK   lazy       6.8 KB gz / 25 KB (max of .js 6.8 / .mjs 6.6 KB gz)
SIZE OK   lazy-floor    >=  2 KB gz  OK (min twin 6.6 KB gz)
SIZE OK   adapter    0.3 KB gz / 14 KB | watchbug-dom-serialize.mjs: 0.1 KB gz (-0.3 vs iife)
SIZE OK   runtime   24.4 KB gz / 80 KB (core + lazy + adapter)
check:size PASSED

  453 passed (9.0m)
```

Re-run from the repository root:

```bash
npm run lint
npm run build
npm run check:size
npm run verify
```

`npm run gate` was also run while landing LW-04: `gate.mjs summary: 5 passed, 0 failed, 0 skipped` / `gate.mjs PASSED`.

## Items the human must confirm

1. **CR-01 / HG-01 / HG-02 / WR-01 / WR-03 are logic and state-machine fixes.** Type-checking and the e2e suite cannot prove an interleaving is gone: no row drives Discard or a new capture *during* a slow encode, no row commits a 21st stroke, and no row forces an encode failure. Each is marked `fixed — requires human verification` above; a manual walkthrough (slow-encode + Discard, slow-encode + new capture, 21 strokes then Done, a >20-stroke undo, a HiDPI pixelate mask over 14 px text) is the evidence these need.
2. **Two new copy sets were introduced** (`status.composeFailed` / `.hint`, `editor.mask.error`, EN + ES). The review's `Fix:` text called for them, but the UI-SPEC copy map is the project's copy authority — please ratify or replace the wording; both locales are in `packages/sdk/src/strings.ts` and `packages/sdk/src/strings.editor.ts`.
3. **The e2e block-size oracle changed** (`e2e/helpers/editor.ts` + one row in `e2e/sdk.spec.ts`) because it is the documented independent twin of the SDK formula. It is not a relaxation: the pixelate row now derives a ~11 px grid instead of ~22 px and still asserts snapping, block uniformity, opacity and averaging against the real outgoing bytes.
4. **HG-01 trade-off:** once the cap is reached, the undo history restarts from empty, so pressing Undo immediately after the flattening stroke is a no-op. That is the bounded-history behaviour P3-D-11 asks for; the ink is preserved. Switching to a debounced flatten or a headless base layer would change P3-D-11 semantics and was out of scope.
5. **Not fixed by design:** `fitToCaps` still upscales a genuinely tiny attachment (a 10×10 icon becomes 32×32, aspect preserved) rather than leaving it at its native size — the reviewer's primary suggestion. The alternative (`Math.min(MIN_EDGE_PX, original)`) would keep native pixels; say the word if faithfulness to the source dimensions should win over the minimum-edge floor.

---

_Fixed: 2026-10-28T23:52:51Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
