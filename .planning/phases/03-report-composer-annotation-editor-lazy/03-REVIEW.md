---
phase: 03-report-composer-annotation-editor-lazy
reviewed: 2026-10-28T22:47:31Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - apps/api/src/db/schema.ts
  - apps/api/src/ingest/guard.ts
  - apps/api/src/ingest/harden.ts
  - apps/api/src/ingest/sniff.ts
  - apps/api/src/ingest/structure.ts
  - apps/api/src/ports.ts
  - apps/api/src/purge.ts
  - apps/api/src/routes/incidents.ts
  - apps/panel/src/api.ts
  - apps/panel/src/components/ReportDetail.tsx
  - e2e/helpers/capture-stubs.ts
  - e2e/helpers/composer.ts
  - e2e/helpers/editor.ts
  - e2e/helpers/host-fixtures.ts
  - e2e/ingest.spec.ts
  - e2e/make-fixtures.mjs
  - e2e/sdk.spec.ts
  - packages/contracts/src/types.ts
  - packages/sdk/src/annotator.ts
  - packages/sdk/src/annotator/canvas-layer.ts
  - packages/sdk/src/annotator/editor-dom.ts
  - packages/sdk/src/annotator/masks.ts
  - packages/sdk/src/annotator/tools.ts
  - packages/sdk/src/capture/capture-source.ts
  - packages/sdk/src/capture/manual-file.ts
  - packages/sdk/src/capture/pipeline.ts
  - packages/sdk/src/image/encode.ts
  - packages/sdk/src/index.ts
  - packages/sdk/src/redact/masks.ts
  - packages/sdk/src/redact/redactor.ts
  - packages/sdk/src/strings.editor.ts
  - packages/sdk/src/strings.ts
  - packages/sdk/src/transport/lane1.ts
  - packages/sdk/src/widget/composer.ts
  - packages/sdk/src/widget/host.ts
  - packages/sdk/src/widget/launcher.ts
  - packages/sdk/src/widget/loader.ts
  - packages/sdk/src/widget/review.ts
  - scripts/check-size.mjs
  - scripts/gate.mjs
findings:
  critical: 1
  high: 2
  medium: 3
  low: 4
  info: 2
  total: 12
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-10-28T22:47:31Z
**Depth:** standard (per-file analysis with cross-module call tracing on the masking, encode, ingest and router lanes)
**Files Reviewed:** 40 source files (planning artifacts, the generated `apps/api/drizzle/` migration, and binary `.jpg` fixtures excluded)
**Status:** issues_found

## Summary

Phase 03's security architecture is, in its main lines, sound: the destructive masking leaves (`redact/masks.ts`, `annotator/masks.ts`) correctly fail closed and force opaque alpha; the server ingest chain (magic-bytes sniff → container strip → header dimension guard → forced sharp re-encode with `limitInputPixels` + `autoOrient` + timeout → post-harden re-cap) is layered and exhaustiveness-guarded; `credentials: 'omit'`/pathname-only URL/closed-shadow-DOM/textContent-everywhere discipline holds (the `?secret=` string in `lane1.ts` is a comment documenting the R-08 rationale, and the `sdk-no-html-sink` census confirms zero parse sinks). The client title/note code-point clamps genuinely match Zod 4's code-point `.max()` semantics (verified against the installed zod).

The defects cluster where Phase 3 introduced **asynchrony into previously synchronous flows**: the `reviewDraft()` encode await has no post-await draft/screen re-validation (the composer's own `runAnnotate` demonstrates the right pattern, and `reviewDraft` omits it), producing a reproducible widget soft-lock and, in one interleaving, a Send-enabled review of a degraded draft — the exact P3-D-13 invariant the phase declares. The editor's `UNDO_LIMIT` eviction drops strokes from the redraw set without flattening them into the base, silently erasing the oldest ink from the exported image once the user commits a 21st stroke. The opt-in pixelation floor is measured at the *unscaled* 15 px label font while every glyph in bitmap space is scaled, so on HiDPI captures the block is smaller than the 2× cap-height R-13 floor demands.

Tier mapping: **critical + high = BLOCKER** (must fix before ship); **medium + low = WARNING**; **info** is advisory. Every finding below has file:line evidence from the current source at `64f8bda`.

## Critical Issues

### CR-01: `reviewDraft()` never re-validates the draft/screen after the encode await — stale resolution soft-locks the widget or reviews a degraded draft (BLOCKER)

**File:** `packages/sdk/src/index.ts:259-280` (reviewDraft), `216-232` (showScreen), contrast the correct guard in `packages/sdk/src/widget/composer.ts:706`
**Issue:** `encodeFinal()` takes hundreds of milliseconds to several seconds (the ladder runs up to 18 `toBlob` passes), and the composer stays fully visible during that window — Review/✕/Escape all work. `reviewDraft()` captures `current = draft` but after the await unconditionally runs `current.encoded = await encodeFinal(...)` and `showScreen('review')`, and `showScreen('review')` reads the **router-global** `draft`, not `current`. Three interleavings, all reachable:

1. **Discard during encode** → `onDiscard` sets `draft = null`, screen goes `idle`; the stale resolution then flips `screen = 'review'`, and `showScreen` renders `panel: idle`, `composer.render(null)`, `review.render(null)` (condition `draft !== null` fails) and calls `launcher.setDisabled(true)`. Every surface is hidden, the launcher is disabled, and both Escape listeners were removed on close — the widget is invisible **and** inert until a page reload.
2. **New capture during encode** → `onDraft` installed draft B; stale resolution runs `showScreen('review')` with B — B's `encoded === null` and `B.image !== null` fails the render condition → same all-hidden + launcher-disabled lock, and B's correctly-captured composer was dismissed without user intent.
3. **New capture that lands a degraded draft** (B.image null, B.captureNote set) → the render condition passes on `draft.image === null` → a **Send-enabled review of a degraded draft** showing "No image". `pendingFor` then takes the meta-only branch, so the user can post a text report out of the diagnosis state with zero explicit choice — the exact "never a silent post from the diagnosis state" (P3-D-13) invariant, bypassed by timing rather than by UI.

The green 453-test suite cannot see this: every row drives the walk conversationally and never interleaves Discard/new-capture with a slow encode. `runAnnotate` (composer.ts:706) already proves the fix pattern in this same codebase — `if (!open || draft !== current || current.image !== base) return;`.

**Fix:**
```typescript
const reviewDraft = async (): Promise<void> => {
  const current = draft;
  if (current === null) return;
  if (screen !== 'composer' && screen !== 'review') return;
  const imageAtStart = current.image;
  if (current.image !== null) {
    let encoded;
    try {
      encoded = await encodeFinal(current.image, current.t1, current.masks);
    } catch {
      if (draft !== current || screen !== 'composer') return; // stale failure — surface nothing
      onView({ kind: 'failed', failure: 'capture' });
      return;
    }
    // Generation check (mirror of composer.runAnnotate): discard, replacement
    // or a new gesture during the encode abandons this resolution entirely.
    if (draft !== current || screen !== 'composer' || current.image !== imageAtStart) return;
    current.encoded = encoded;
  } else {
    if (draft !== current || screen !== 'composer') return;
    current.encoded = null;
    current.captureNote = null;
  }
  showScreen('review');
};
```
Also assign `current.encoded` only after the check (as shown) so a stale encode cannot overwrite a fresh draft's `encoded = null`.

## High Issues

### HG-01: strokes beyond `UNDO_LIMIT` are evicted from the redraw set without being flattened — the oldest annotation silently vanishes (BLOCKER)

**File:** `packages/sdk/src/annotator/canvas-layer.ts:100-103, 106-109, 311-343, 460-462`
**Issue:** the canvas is stateless between drags: every commit (and `finish()`) ends with `redraw()` → `rebakeMasks(context, base, strokes, masks)`, which **overwrites the entire canvas with `base`** (`putImageData(base)`) and then replays only the `strokes[]` array. `base` receives committed ink only at `finish()` (line 461-462). But `pushStroke` evicts the oldest entry with `strokes.shift()` once length > 20 — the evicted stroke's pixels live *only* in the canvas that the next `redraw()` wipes. Consequence: on committing stroke #21 the user's stroke #1 disappears from the canvas instantly and from the exported image forever; pressing Undo down to the boundary similarly restores ink that then re-evicts another stroke. This is silent loss of user annotation content under ordinary use ("~20 strokes" in P3-D-11 intends the *undo history* to be bounded, not the ink to be deleted). The ANN-06 e2e rows stay under the cap, so the suite is green and blind to it.
**Fix:** when the cap is hit, snapshot-flatten the whole canvas into `base` before evicting, so dropped records have already merged into the only redraw source (the same readback `finish()` does at 461-462):
```typescript
const pushStroke = (stroke: Stroke): void => {
  strokes.push(stroke);
  if (strokes.length > UNDO_LIMIT) {
    // Eviction must not erase ink: bake the current canvas (base + all
    // strokes; mask patches re-bake last and stay irreversible, so C-2
    // holds) into the base buffer before dropping vector records.
    redraw();
    base.data.set(context.getImageData(0, 0, base.width, base.height).data);
    strokes.length = 0;
  }
};
```
The strokes list then restarts, keeping ~20 undo steps exactly as P3-D-11 intends; `finish()`'s flatten stays correct (replaying an empty strokes list onto the already-flat base is a no-op). An O(frame) readback once per 21st stroke is acceptable and bounded. Do **not** simply raise `UNDO_LIMIT` — any bound still erases silently with the current redraw model.

### HG-02: pixelation block floor is measured at the unscaled 15 px label font — on HiDPI captures the opt-in block mask is below the R-13 "2× cap-height" floor for bitmap-space content (BLOCKER)

**File:** `packages/sdk/src/annotator/masks.ts:45-58`, call site `packages/sdk/src/annotator/canvas-layer.ts:234`
**Issue:** `bakeRect` computes `blockPx = blockSizeFor(capHeightPx(context))`; `capHeightPx` sets the font to `LABEL_FONT_PX` (15 px, **logical**) and returns `actualBoundingBoxAscent` (~10–11 px), yielding a floor of ~22 **bitmap pixels**. But every glyph in bitmap space is scaled: the editor draws its own text labels at `LABEL_FONT_PX * canvasTransform().scaleX` (canvas-layer.ts:379), and the captured page's text is DPR-scaled in the frame (1 bitmap px = 1 device px). On a DPR-2 capture a 14 px page input has ~20–21 px of bitmap cap-height and the R-13 floor demands ≥ 40–42 px blocks — the implementation still bakes 22 px blocks, whose block-means can leave letterforms recognizably intact, exactly the failure class R-13's floor exists to prevent ("a block swallows at least two glyph rows" is false at any scale > 1, including the editor's own DPR-1 labels, which render at `15 × scaleX` bitmap px because the editor canvas is letterboxed). The e2e mask-finality matrix proves destruction for `fill` mode (flat black is scale-independent); pixelate's floor is the gap tests cannot see, and pixelate is a user-selectable privacy mode.
**Fix:** thread the frame's bitmap-per-CSS-px scale into the bake and scale the measured cap height with it. Core knows it at capture time (`transformFor(image.width, image.height, view.innerWidth, view.innerHeight).scaleX` in pipeline.ts:234); carry it on the Draft and pass it through `AnnotatorOpenOptions`, then in `bakeRect`:
```typescript
const blockPx = style === 'pixelate'
  ? blockSizeFor(capHeightPx(context) * options.bitmapPerCssPx)
  : 0;
```
(For the editor's own labels this is conservative since they render at `15 × scaleX` ≥ the page text scale.) `snapOutward` grid tiling is unaffected; block sizes stay integral.

## Medium Issues

### WR-01: async attach/annotate lanes mutate the draft without identity or screen checks — review + composer can both render, and Send becomes a silently dead button (WARNING)

**File:** `packages/sdk/src/widget/composer.ts:764-773` (attach `.then`), `692-740` (annotate lane), `861-879` (reviewButton not disabled while attaching), `packages/sdk/src/index.ts:333-335` (uncaught `pendingFor` throw)
**Issue:** three compounding gaps: (a) the attach `.then` does `const current = draft;` and only checks `current === null` — it never verifies the draft is the *same instance* the picker was opened on (unlike `runAnnotate`'s `draft !== current || current.image !== base` guard), so a slow decode resolving after discard → new capture rewrites the **new** draft's `image/t1/masks/encoded` with the old file's bytes; (b) the attach `.then` calls `render(current)` unconditionally — if the user clicked `Review report` while the decode ran (the Review button is not among the buttons `setAttaching` disables), the encode resolves into the review screen, the attach then re-shows the composer *underneath it* (both `data-hidden="false"`, both Escape listeners live, focus stolen by the render's `titleInput.focus()`), sets `encoded = null`, and the subsequent `Send report` click routes into `pendingFor(draft)`, which throws `PipelineInvariantError` ('send called before encodeFinal produced the artifact') into `void flowRef.current?.send(current)` with no `.catch` — an unhandled rejection and a dead button with zero user feedback; (c) the annotate lane and attach lane can also run concurrently on the same draft (Annotate is not disabled while attaching), with last-resolver-wins on `draft.image`.
**Fix:** capture `const target = draft; const imageAtStart = draft.image;` in the `change` handler and bail in `.then` unless `open && draft === target && target.image === imageAtStart`; render through the router (a `onDraftMutated` handler that calls `showScreen(screen)`) instead of `render()` directly so a background composer cannot re-show while the review owns the screen; add `reviewButton` (and `annotateButton`) to the disabled set in `setAttaching`; and wrap the review `onSend` body in a try/catch that routes a `pendingFor` throw to the loud failed state instead of an unhandled rejection.

### WR-02: `fitToCaps()` applies the `MIN_EDGE_PX` floor per axis — small attachments are upscaled and aspect-distorted (WARNING)

**File:** `packages/sdk/src/image/encode.ts:141-165`, consumer `packages/sdk/src/capture/manual-file.ts:131-137`
**Issue:** `fitToCaps` only ever *shrinks* to the caps, but then returns `Math.max(MIN_EDGE_PX, nextWidth)` / `Math.max(MIN_EDGE_PX, nextHeight)` independently. Any attached image with one side under 32 px (a 20×400 error-banner screenshot, a 10×10 icon) is stretched to ≥ 32 on that axis with the other side untouched: `ManualFileCapture` then `drawImage(bitmap, 0, 0, canvas.width, canvas.height)` at the fitted size, producing a ~60 % horizontally distorted, upsampled attachment. The CAP-02 e2e rows use a 64×64 fixture, above the floor on both axes, so the mismatch never fires. The capture path can't reach it (frames are viewport-sized), making the attach lane the only victim — but the user's deliberately chosen photo is what gets mangled, and "the outgoing image decodes to the attached picture's dimensions" (the plan's own CAP-02 property) is false for small inputs.
**Fix:** floor only as a scale-preserving second pass, or skip the floor entirely for attachments:
```typescript
export function fitToCaps(width: number, height: number): { width: number; height: number } {
  // ...cap shrink as today...
  if (nextWidth < MIN_EDGE_PX || nextHeight < MIN_EDGE_PX) {
    const grow = Math.max(MIN_EDGE_PX / nextWidth, MIN_EDGE_PX / nextHeight);
    if (grow > 1) { nextWidth = Math.round(nextWidth * grow); nextHeight = Math.round(nextHeight * grow); }
  }
  return { width: nextWidth, height: nextHeight };
}
```
(scale-preserving; never up-down one axis only — or clamp to `Math.min(MIN_EDGE_PX, original)` so an honest 10×10 stays 10×10.)

### WR-03: encode failure at Review entry is reported as a *capture* failure, and "Try again" discards the composed draft with all annotations (WARNING)

**File:** `packages/sdk/src/index.ts:266-270`, retry semantics `packages/sdk/src/capture/pipeline.ts:459-472`
**Issue:** when `encodeFinal` rejects (fail-closed `putPatch`/`fillBitmapRects` throw, or the engine refusing to encode / the 2 MB ceiling), the router shows `onView({ kind: 'failed', failure: 'capture' })` — i.e. the copy "Couldn't capture the screen. / Nothing was sent. Allow screen sharing, then try again." The screen *did* capture successfully; the diagnosis misattributes the fault (and hints at a permission the user already granted). Worse, from that panel `flow.retry()` finds `pendingSend === null` and re-runs `start()`: a brand-new gesture with a new idempotency key, throwing away the edited title, note, type, annotations and baked masks — the user's entire composition — over a transient encode error. M-6's "visible terminal state" is honored; correctness of the state and its exits is not.
**Fix:** add a distinct `StatusView` failure kind (`'compose'`) whose copy names the real problem ("Something went wrong preparing the screenshot") and whose Try-again re-enters the composer with the draft intact (the draft is still non-null — route dismissal to `showScreen('composer')` rather than re-running the gesture), or at minimum re-attempt `reviewDraft()` before falling back to a fresh capture.

## Low Issues

### LW-01: `putPatch` normalizes alpha **in place on the source patch** via the subarray view (WARNING)

**File:** `packages/sdk/src/redact/masks.ts:78-88`
**Issue:** `const row = source.subarray(...)` then `row[at] = MASK_ALPHA_OPAQUE` mutates `patch.pixels.data` — the draft's retained `MaskPatch` (also replayed by the editor's `rebakeMasks` and re-sent on the next round-trip). Today every producer writes alpha 255, so the mutation is a no-op; the moment a non-255 producer exists (the exact hypothetical the fail-safe exists for), encodeFinal silently rewrites the draft's history rather than normalizing on the copy, and two consecutive replays of different drafts over the same patch object alias each other.
**Fix:** copy-then-normalize: `const row = new Uint8ClampedArray(width * 4); row.set(source.subarray(from, from + width * 4)); for (...) row[at] = MASK_ALPHA_OPAQUE; target.data.set(row, ...);` — or add a comment that the source mutation is intentional and assert it.

### LW-02: `bakeRect`'s catch turns a failed mask into a silent no-op the user cannot distinguish from success (WARNING)

**File:** `packages/sdk/src/annotator/canvas-layer.ts:237-240` (and the already-confirmed second-mask path at 286-289, which skips the dialog)
**Issue:** every geometry error in `bakeMask` is swallowed with only "Aborted — fail closed, the region stays as it was". On the *confirmed* path (after the once-per-session dialog) a swallowed throw leaves the region visibly unmasked for only the duration of the next `redraw()` — but a user mid-flow can plausibly miss it, and the report ships with the secret intact, believing it masked. The case is near-unreachable today (integral rects, integer blocks), which is exactly why no test covers the feedback path.
**Fix:** on catch, surface a refusal through the shell (reuse the inline `attach-error`/`editor-load-error` copy pattern with a new `editor.mask.error` string) instead of staying silent; the privacy invariant deserves a loud fall-open.

### LW-03: HTTP 408 is classified as a permanent contract rejection in the transport (WARNING)

**File:** `packages/sdk/src/transport/lane1.ts:185`
**Issue:** `const transient = response.status === 429 || response.status >= 500;` — a 408 Request Timeout (explicitly a transient condition, commonly emitted by reverse proxies like the phase's nginx before slow upstreams) is routed to the non-retryable `SendError('rejected')` branch, killing the locked P2-D-03 retry schedule and the "reuse the same key" guarantee for a failure that the same key exists to survive.
**Fix:** `const transient = status === 408 || status === 429 || status >= 500;`

### LW-04: the `sdk-lazy-lane-purity` gate misses template-literal dynamic imports that esbuild also inlines (WARNING)

**File:** `scripts/gate.mjs:238`
**Issue:** the literal-specifier census is `/\bimport\s*\(\s*['"]([^'"]+)['"]/` — backtick specifiers (`import(\`./annotator.ts\`)`) are analyzable by esbuild (no substitution ⇒ constant-folded) and would inline the lane into core, the exact Pitfall-1 regression this gate exists to catch, yet the census never sees them. The variable-specifier loader stays green.
**Fix:** extend the pattern to `/\bimport\s*\(\s*(['"`])((?:(?!\1)[^\\]|\\.)*)(?:\1)/` and check the captured specifier for both quote styles.

## Info

### IN-01: Ctrl+Z undo fires while the mask-confirmation alertdialog is open (editor-dom modal owns Escape/Tab only)

**File:** `packages/sdk/src/annotator/canvas-layer.ts:445-449`, dialog keydown `packages/sdk/src/annotator/editor-dom.ts:564-584`
**Issue:** the alertdialog's trap handles `Escape` and `Tab`; any other key (including the document-level Ctrl+Z undo listener) reaches the editor behind the modal. Undoing a stroke while a mask rect is pending is harmless to the mask itself (the bake is rect-based) but redraws behind the modal the dialog claims to own, bending the "the dialog owns the interaction" contract (P3-D-09) the code documents. **Fix:** have the dialog's keydown stop non-Escape/Tab propagation (or gate `onKeyDown` on `!shell.maskDialog.isOpen()`).

### IN-02: the encode-sink gate reports a vanished sink as SKIP (exit 0) rather than FAIL until Phase 7's `STRICT` flip

**File:** `scripts/gate.mjs:151-155`
**Issue:** the `sinks === 0` branch is correctly honest about "build defect, not pending phase" (03-07 improvement), but with `STRICT = false` a regression that deletes `encodeFinal` entirely leaves `gate.mjs` exiting 0 with one skip line — the single-sink control silently stops controlling between now and the Phase 7 flip. Documented as a deliberate toggle; noting so the flip is not missed. **Fix:** consider `fail` for the zero-sink case specifically (the artifact exists — only the subject regressed — unlike the "does not exist yet" SKIP semantics the header defines).

---

**Verified non-findings** (checked explicitly so they are not re-litigated): Zod 4 `.max()` counts code points, so the client code-point clamps for title/note match the server exactly (probed against the installed zod); `buildMeta` pathname-only + `credentials:'omit'` + `referrerPolicy:'no-referrer'` keep SEC-03/R-08 intact; the `?secret=` match in `lane1.ts` is a comment; the server guard's JPEG walker cannot overflow `width * height` (sides checked before the product, and `limitInputPixels` bounds the real decode); the WebP `File Size` equality check and PNG CRC re-emission are correct; the idempotent `encodeFinal` ordering (masks → T1 → encode) is scale-order-safe and matches the T3 contract; `newIdempotencyKey`'s fallback v4 UUID sets the version/variant bits correctly; loader retry URL-busting after a failed `import()` matches the engine module-map behavior it documents; the `storageKey === null` invariant has exactly the two claimed readers (blob-route 404, purge skip guard); migration `0001` matches the widened CHECK and DROP NOT NULLs.

---

_Reviewed: 2026-10-28T22:47:31Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
