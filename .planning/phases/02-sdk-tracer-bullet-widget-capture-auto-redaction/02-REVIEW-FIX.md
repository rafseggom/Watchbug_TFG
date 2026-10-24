---
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
reviewed: 2026-10-24T20:10:27Z
depth: standard
scope: regression pass over remediation commit 0c6565f (findings from 02-REVIEW.md are closed; not re-reported)
files_reviewed: 10
files_reviewed_list:
  - e2e/helpers/capture-stubs.ts
  - e2e/helpers/host-fixtures.ts
  - e2e/sdk.spec.ts
  - packages/sdk/scripts/build.mjs
  - packages/sdk/src/capture/capture-source.ts
  - packages/sdk/src/capture/pipeline.ts
  - packages/sdk/src/index.ts
  - packages/sdk/src/redact/geometry.ts
  - packages/sdk/src/redact/redactor.ts
  - packages/sdk/src/widget/status-panel.ts
findings:
  critical: 2
  warning: 2
  info: 2
  total: 6
status: issues_found
---

# Phase 2: Code Review — Remediation Regression Report

**Reviewed:** 2026-10-24T20:10:27Z
**Depth:** standard (with cross-file tracing of the capture → redact → encode → send chain)
**Files Reviewed:** 10 (exactly the remediation commit `0c6565f`)
**Status:** issues_found — 2 critical, 2 warning, 2 info

## Summary

This is the regression pass over the remediation commit `0c6565f`, not a re-review of the
original phase. The 02-REVIEW.md findings are closed and were not re-opened. Each of the
eight remediation items (CR-03/S-7, WR-01, WR-02/S-8, WR-03/I-2, IN-01..03, S-9, I-1,
V-1 #8, C-4/C-5/C-6) was checked against the diff (`9c0c089..0c6565f`) and against the
project invariants (SEC-02/R-13, T-02-10, SEC-03, INV-01, INV-02, RNF-01).

Most of the remediation is correct: the nested-root scan is realm-correct and fail-closed,
slotted content is walked exactly once, `measured.rects` is populated on both built-in
`CaptureSource` paths, the retry path reuses the idempotency key, the ESM lane does not
throw in `resolveEndpoint`, `truncateReason` holds its UTF-16 cap, and the C-4/C-5/C-6
refactors are behaviour-preserving (verified hunk-by-hunk against the pre-image).
The I-1 build gate, IN-01 ordering fix and V-1 #8 guard are correct as written.

However, the remediation itself introduces one new user-visible defect (FX-01: the WR-03
failure path hides the widget forever instead of showing the "visible terminal state" the
fix claims), leaves one silent privacy fall-open inside the very feature that closed CR-03
(FX-02: frame rect translation is translation-only and misplaces masks under any CSS
transform), and weakens two of its own guarantees (FX-03, FX-04). Two cosmetic/claim
defects (FX-05, FX-06) round it out.

---

## Structural Findings (fallow)

None provided for this pass.

---

## Narrative Findings (AI reviewer)

## Critical Issues

### FX-01: The WR-03 no-CSPRNG path hides the widget permanently — its "visible terminal state" is rendered into a `display:none` host

**File:** `packages/sdk/src/capture/pipeline.ts:206-214`
**Affected principal / resource / outcome:** End user on any engine without a CSPRNG → the
widget's terminal-state UI → the click produces *no feedback at all*: the launcher, the
panel and the failure state all disappear together and never come back for the session.

**Issue:** The remediation moved the idempotency-key mint to before the capture and wrapped
it so a missing CSPRNG becomes "a loud visible failure". But the early return skips the
`host.restore()` that every other exit path gets (it lives in the `finally` of the *capture*
try, which this path never enters):

```ts
host.hideSync();                 // ← host becomes display:none !important
launcher.setDisabled(true);
...
try {
  idempotencyKey = newIdempotencyKey();
} catch {
  onView({ kind: 'failed', failure: 'capture' });  // rendered into the hidden host
  return;                                          // ← host.restore() never runs
}
```

`hideSync()` sets `hidden = true` with `display: none !important` on `<watchbug-host>`
(`widget/host.ts:150,192-195`), and the host's own `selfObserver` **re-applies** that style
if anything strips it (`host.ts:182-183`). Both the launcher and the panel are children of
`host.content` (`src/index.ts:171-172`), so `display:none` hides the failure panel too.
The pipeline's own header contract ("every failure path is a **visible terminal state**
(M-6)") and P2-D-05's hide/restore invariant are both broken by this path — the one path
the WR-03 fix added. `retry()`/`dismiss` cannot recover either: their affordances are inside
the hidden host.

This is exactly the class of defect the fix was supposed to remove: "a missing CSPRNG is a
loud visible failure instead of a guessable key" is the fix's own wording; today it is a
silent disappearance. Reachable wherever `crypto.randomUUID` and `crypto.getRandomValues`
are both absent (privacy-stripping host scripts, exotic webviews), and by construction in
any test of the no-CSPRNG path.

**Fix:** restore the host before rendering the terminal state (keeps the mint-before-capture
ordering):

```ts
      let idempotencyKey: string;
      try {
        idempotencyKey = newIdempotencyKey();
      } catch {
        host.restore();
        onView({ kind: 'failed', failure: 'capture' });
        return;
      }
```

(Alternatively mint before `host.hideSync()` at the top of `runFromGesture` — the key is
not capture-dependent — or move `host.restore()` into the outer `finally`.) Add an e2e row
that deletes `window.crypto` and asserts the capture-failed panel is visible and the host is
not `display:none`; nothing in the 303-row suite covers this path today.

---

### FX-02: Frame rect translation is translation-only — any CSS transform/zoom/rotation on a frame silently misplaces the mask, leaking the secrets CR-03 was closed for

**File:** `packages/sdk/src/redact/redactor.ts:125-131` (with `packages/sdk/src/redact/geometry.ts:55-70`)
**Affected principal / resource / outcome:** End user filing a report from a host page that
renders a same-origin frame under a CSS `transform`/`zoom` (scaled embeds, preview panes,
responsive `zoom` hacks) → the outgoing screenshot bytes → SEC-01 secrets inside that frame
(JWTs, card runs, assignment shapes, `input[type=password]`, `[data-watchbug-sensitive]`)
ship **unmasked**, while the module and the disposition ledger report them as masked.

**Issue:** `collectScanRoots` maps a frame's client coordinates to the top viewport with a
pure translation:

```ts
const box = frame.getBoundingClientRect();
visit(inner, dx + box.left + frame.clientLeft, dy + box.top + frame.clientTop, depth + 1);
```

`getBoundingClientRect()` of an element *inside* a frame is in the inner document's own,
untransformed coordinate space, while `box` above is the frame's **visual** (transformed)
box. Under `transform: scale(2)` on the iframe (or any ancestor), or `zoom`, or any
rotation/skew, translation alone is wrong in both origin and extent. Worked example: a
1100×420 frame at (40,60) with `scale(2)`, an inner secret at inner-rect
(120,300)-(320,316) — true viewport rect is (280,660)-(680,980); the code computes
(160,360)-(360,376). The mask lands nowhere near the secret: `fillRects` paints an
unrelated region black, `insideMagenta`-style checks are not in the runtime, and the secret
pixels are encoded and sent.

This is the silent fall-open `geometry.ts` itself forbids in its own words ("the mask
silently not landing is exactly the fall-open this module exists to prevent") and that
T-02-10 turns into a hard no-send — except here it is not detected at all, because nothing
is "non-finite": the rects are finite and simply wrong. The module doc's claim — "What it
cannot reach … is a documented integration limit, never a silent skip" — does not cover
this case: the root IS reached and produces plausible-looking, wrong rects. The new S-7
e2e row cannot catch it either: `installSecrets`/`readMaskRect` replicate the same
translation-only formula (`e2e/sdk.spec.ts:1373-1401, 1460-1471`) against an untransformed
fixture iframe.

Nested-frame accumulation is otherwise correct (dx/dy compose properly for scrolled and
nested frames), and shadow roots are correct (shared coordinate space) — the hole is
specifically the scale/rotation component of frame mapping.

**Fix:** make the frame mapping honest in one of two ways:
1. Fail closed (minimal, T-02-10-consistent): derive the frame's visual scale per axis
   (`box.width / frame.offsetWidth`, `box.height / frame.offsetHeight`) and **throw** from
   `collectScanRoots` when either axis deviates from 1 (or when `getComputedStyle` of the
   frame or any ancestor has a non-`none` `transform`/`zoom`) — the pipeline already turns
   that into the loud no-send; or
2. Map through the scale: pass per-axis scale factors on `ScanRoot` alongside `dx`/`dy` and
   apply them in `pushRect`/`textNodeRect`, still throwing on rotation/skew (which an
   axis-aligned rect cannot represent).

Either way, extend `installSecrets` with a transformed-frame variant so the S-7 row pins
the chosen behaviour instead of only the identity case.

---

## Warnings

### FX-03: `endpoint: null` bypasses the S-8 cross-origin refusal and silently defaults to `location.origin` — and no longer yields the documented TypeError

**File:** `packages/sdk/src/index.ts:109-124`
**Affected principal / resource / outcome:** Integrator loading the bundle cross-origin
(CDN) whose config object carries `"endpoint": null` (JSON config where the key is unset —
a realistic path) → the `init()` contract → `init()` runs and files reports to
`location.origin` instead of refusing as documented; the S-8 guarantee "the report
destination is never guessed" is silently void for that input.

**Issue:** the S-8 guard tests strict `undefined`:

```ts
if (endpoint === undefined) {            // ← null skips the refusal
  ...
}
const raw: unknown = endpoint ?? defaultEndpoint();   // ← null falls through to the default
```

Three consequences:
1. With a cross-origin loading script and `endpoint: null`, the documented refusal
   ("pass `endpoint` explicitly") never fires; the default is guessed — which the fix's own
   rationale forbids ("guessing the document's origin would silently file reports somewhere
   the integrator never chose. So `init()` refuses").
2. `null` is a non-string `endpoint`; the remediation's stated contract ("non-string
   `endpoint` still yields the documented TypeError") is now false for `null`. The
   pre-remediation code (`endpoint !== undefined` → `typeof endpoint !== 'string'` → throw)
   **did** reject `null`; this is a behaviour regression of the fix itself.
3. The guard and the default disagree (`=== undefined` vs `??`), so the same "absent"
   notion has two different meanings in ten lines of code.

**Fix:** use one notion of "absent" consistently — either treat `null` as absent in both
places (`const raw: unknown = endpoint == null ? defaultEndpoint() : endpoint;` plus
`if (endpoint == null)` for the refusal — preserves the refusal, trades the TypeError for
`null` in the same-origin case), or keep strict typing everywhere so `null` falls into the
TypeError branch exactly as before the remediation:

```ts
function resolveEndpoint(endpoint: string | undefined): string {
  const raw: unknown = endpoint;
  if (raw === undefined) {
    const scriptOrigin = loadingScriptOrigin();
    if (scriptOrigin !== null && scriptOrigin !== location.origin) {
      throw new TypeError(
        'Watchbug.init: the loading script origin differs from the document origin; pass `endpoint` explicitly.',
      );
    }
  }
  const resolved =
    raw === undefined ? defaultEndpoint().replace(/\/+$/, '') :
    typeof raw === 'string' ? raw.replace(/\/+$/, '') : '';
  if (!isAbsoluteHttpUrl(resolved)) {
    throw new TypeError('Watchbug.init: `endpoint` must be an absolute http(s) URL.');
  }
  return resolved;
}
```

This restores the pre-remediation behaviour for every non-string (including `null`) and
keeps the S-8 refusal un-bypassable. Worth one e2e assertion in the S-8 row:
`Watchbug.init({ projectKey, endpoint: null })` must refuse exactly like the omitted case.

---

### FX-04: S-9's key-shape validation is bypassable via `HostFixtureOptions.projectKey` — the interpolation-site comment claims an unconditional guarantee

**File:** `e2e/helpers/host-fixtures.ts:75-94` (validation), `:168` (bypass), `:126-132` and `:257` (interpolation)
**Affected principal / resource / outcome:** Maintainer adding a fixture row that passes a
non-canonical `projectKey` (e.g. a deliberately-wrong-key row) → the fixture document's
integrity → the value is concatenated raw into `onload="Watchbug.init({ projectKey: '<key>' })"`,
so a `'` (or, via `__PROJECT_KEY__`, a quote/angle bracket) breaks out of the literal and
runs script inside the fixture page — silently invalidating the WDG-04 global-surface and
SEC-03 payload rows that page feeds.

**Issue:** the shape check lives inside `projectKey()`, which only validates the key read
from `.env`. `openHostFixture`/`openHostileFixture` use `options.projectKey ?? projectKey()`
(`:168`, `:241`), so an explicit option skips the check entirely — while the comment at
`:129-131` states it as absolute: "`projectKey()` validates the key against its canonical
form (S-9), so a single-quoted JS literal inside the attribute cannot break out of it."
That claim is only true for the `.env`-sourced path. (Note the sibling fields `scriptOrigin`
and `variant` are interpolated with the same trust model — the fix is proportionate for
today's threat, but the guarantee as written is wrong.)

**Fix:** validate at the boundary, not at one source. Either run the key through
`PROJECT_KEY_SHAPE.test()` inside `loaderMarkup`/`openHostileFixture` before interpolation,
or factor `assertCanonicalKey(key: string): string` and apply it to `options.projectKey ??
projectKey()` at both call sites. Then the comment is true by construction.

---

## Info

### FX-05: The remediation corrupted six comment lines in `redactor.ts` (mojibake)

**File:** `packages/sdk/src/redact/redactor.ts:2, 7, 10, 12, 14, 24`
**Issue:** the commit re-encoded the file's em-dashes: `—` now reads `â€”` (e.g. line 2
"P2-D-08/09) â€” the destructive half"). The pre-image had correct UTF-8; this is an
encoding slip introduced while editing the file. Comment-only — no user-visible string is
affected — but it degrades the module's documentation and will spread the next time the
file is edited on a mis-configured toolchain.
**Fix:** restore the em-dash characters on those six lines and re-save the file as UTF-8.

### FX-06: `MAX_SCAN_DEPTH` truncation is a silent skip, contradicting the module's "never a silent skip" claim

**File:** `packages/sdk/src/redact/redactor.ts:68-72, 115-117` (claim at `:159-162`)
**Issue:** `visit()` returns silently at `depth > maxDepth`, dropping the whole subtree —
a secret in a 9th-level nested shadow root/frame is left unmasked with no signal. The doc
for `collectMaskRects` says "What it cannot reach (closed shadow roots, cross-origin
frames) is a documented integration limit, **never a silent skip**" — depth truncation is a
third unreachable category that *is* silent and is not in that list. Practical reachability
is negligible (and a hostile page has easier documented escapes), so this is a claim/
robustness defect, not a leak finding.
**Fix:** either add depth truncation to the documented-limit sentence (and to the T-02-14 /
AR-01 register), or make truncation loud — set a flag when `depth > maxDepth` is hit and
have `collectMaskRects` throw, letting T-02-10 fail closed like every other scan anomaly.

---

## Checks performed that came back clean

Verified against the diff and the surrounding modules, for the record:

- **CR-03/S-7 scan reach:** nested-frame translation accumulates correctly (dx/dy compose
  through `iframe → iframe` chains and inner-document scrolling is already absorbed by
  viewport-relative rects); shadow roots inherit their host document's offsets correctly;
  `ownerDocument ?? root` (not `?? document`) is realm-correct for same-origin frame
  documents in `collectTextRects`/`textNodeRect`; slotted content lives in the light DOM,
  is walked once there at its rendered slot position, and is invisible to the shadow
  root's `TreeWalker` — no double-count, no miss; no `try/catch` swallows a traversal
  error anywhere in the scan, and `pipeline.ts` converts it into a no-send before encode
  and send (T-02-10 holds).
- **WR-01:** `measured.rects` is populated on both built-in paths (`captureFromSeam` and
  `readFrame` both invoke `beforeRead()` immediately before the pixel read); the
  `rects ?? undefined` fallback re-measures rather than skipping redaction; an empty
  measured array is not mistaken for "absent"; the retry path (`pendingSend`) resends the
  same blob and idempotency key unchanged; `collect()` during `display:none` means the
  widget contributes no rects.
- **WR-02/S-8:** the ESM lane (`document.currentScript === null` → `LOADING_SCRIPT_URL`
  undefined) never throws; the IIFE same-origin lane resolves to `location.origin`
  unchanged; non-string `endpoint` values other than `null` still produce the documented
  TypeError (see FX-03 for `null`); `javascript:`/`data:` and non-http schemes are
  rejected; the refused `init()` mounts nothing (`resolveOptions` runs before `mountHost`).
- **WR-03/I-2:** the v4 assembly (version/variant bits, 8-4-4-4-12 hex grouping) is
  correct; `getRandomValues` is not secure-context-gated so plain HTTP still mints real
  keys; the throw is caught inside `runFromGesture` and cannot escape as an unhandled
  rejection (its visibility defect is FX-01).
- **IN-01:** the beyond-cap early return now precedes any canvas allocation; the
  `beyondCap` flag is intentionally media-tier-irrelevant (the media tier's real
  4700×3600 frame trips the same `MAX_IMAGE_PIXELS` probe).
- **IN-02:** `truncateReason` output is ≤ `max` UTF-16 units for every input with
  `max ≥ 1`, never splits a surrogate pair, and matches the old behaviour on BMP strings.
- **IN-03:** the byte-equality row's non-vacuity guard is explicit per engine and the
  `meta` part (string-backed, present on all engines) still carries the claim on WebKit.
- **S-9/I-1:** the `.env` key path is validated before interpolation (see FX-04 for the
  option path); `build.mjs` emits the open-shadow bundles to `dist/e2e/`, removes the
  stale `dist/watchbug.e2e.*` layout, and its `mode:"open"` tripwire genuinely matches the
  minified `attachShadow({mode:"open"})` that `SHADOW_MODE` folding produces in
  `widget/host.ts:136` (and does not match the closed bundles). `host-fixtures.bundlePath`
  agrees with the new layout.
- **C-4/C-5/C-6:** hunk-by-hunk equivalence with the pre-image — `render`'s state machine
  (data-hidden, terminal/failed classes, `role="alert"`, five visibility toggles, timer and
  Escape affordance ordering) is preserved, including the pre-existing early-return on
  `idle`; `capture()`'s split preserves the surface policy exactly (`undefined`/`browser`
  accepted, everything else refused) and the teardown order; `collectMaskRects`' split
  preserves the per-family behaviour.
- **V-1 #8:** `toBitmapRect` now throws on non-finite input, and the throw propagates to
  the pipeline's pre-encode short-circuit (fail-closed intact).
- **Invariants:** `credentials: 'omit'` and `referrerPolicy: 'no-referrer'` untouched
  (SEC-03); `image/encode.ts` remains the single encode sink (SEC-02); no new SDK
  dependency and no new global (RNF-01/INV-02); `INV-01` production bundles stay
  `SHADOW_MODE:'closed'`.
- **patterns.ts contract (cross-file):** all four pattern regexes carry the `g` flag, which
  `textMatchesFamily`'s `exec` loop depends on to advance — no infinite-loop hazard from
  the new `textMatchesFamily` extraction.

---

_Reviewed: 2026-10-24T20:10:27Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
_Scope: remediation commit 0c6565f (regression pass; 02-REVIEW.md findings closed)_
