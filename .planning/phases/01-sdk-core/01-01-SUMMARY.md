---
phase: 01-sdk-core
plan: 01
subsystem: sdk
tags: [typescript, rollup, vitest, shadow-dom, i18n, widget, jsdom]
requires: []
provides:
  - SDK entry point with window.Watchbug global (init, setConsent, getConsoleLogs)
  - Shadow DOM widget with closed mode isolation and floating buttons
  - Bundled i18n (en/es) with runtime language switching
  - Project scaffold with TypeScript, Rollup IIFE, Vitest + jsdom
affects: [01-02-capture-engine, 01-03-canvas-editor, 01-04-transport, 01-05-build-pipeline, backend-api, admin-panel]
actuals:
  tokens: 7886
  tasks: 3
  commits: 3
tech-stack:
  added: [typescript@5.5, rollup@4.20, "@rollup/plugin-terser@0.4", "@rollup/plugin-typescript@11.1", vitest@2.1, jsdom@25, tslib@2.8]
  patterns: [closed-shadow-dom, adoptedStyleSheets-with-fallback, single-global-entry, bundled-i18n, IIFE-bundle]
key-files:
  created:
    - sdk/src/index.ts
    - sdk/src/widget/WatchbugWidget.ts
    - sdk/src/widget/styles.ts
    - sdk/src/widget/i18n.ts
    - sdk/package.json
    - sdk/tsconfig.json
    - sdk/rollup.config.mjs
    - vitest.config.ts
    - tests/unit/sdk-entry.test.ts
    - tests/unit/widget.test.ts
    - tests/unit/i18n.test.ts
  modified: []
key-decisions:
  - "Use closed Shadow DOM with connectedCallback for ARIA to avoid jsdom constructor attribute error"
  - "Use adoptedStyleSheets with <style> fallback for jsdom compatibility"
  - "Root package.json required for vitest at project root — plan only listed sdk/package.json"
  - "Widget reads language from data-language attribute in connectedCallback for init({language}) integration"
requirements-completed:
  - SDK-01
  - SDK-02
  - SDK-03
  - SDK-06
coverage:
  - id: D1
    description: "Developer can call window.Watchbug.init({key, language}) and floating button appears"
    requirement: SDK-01
    verification:
      - kind: unit
        ref: "tests/unit/sdk-entry.test.ts#init() mounts a custom element to document.body"
        status: pass
    human_judgment: false
  - id: D2
    description: "Widget renders inside Shadow DOM with mode closed — host CSS cannot affect it"
    requirement: SDK-02
    verification:
      - kind: unit
        ref: "tests/unit/widget.test.ts#creates shadow root with mode closed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two separate buttons rendered: Report Bug and Send Feedback"
    requirement: SDK-02
    verification:
      - kind: unit
        ref: "tests/unit/widget.test.ts#renders two buttons: Report Bug and Send Feedback"
        status: pass
    human_judgment: false
  - id: D4
    description: "Switching language between en and es via init config changes all widget button text"
    requirement: SDK-06
    verification:
      - kind: unit
        ref: "tests/unit/i18n.test.ts#WatchbugWidget reads data-language attribute on connect"
        status: pass
    human_judgment: false
  - id: D5
    description: "window.Watchbug exposes only init, setConsent, getConsoleLogs, _initialized"
    requirement: SDK-03
    verification:
      - kind: unit
        ref: "tests/unit/sdk-entry.test.ts#window.Watchbug has only init, setConsent, getConsoleLogs, _initialized"
        status: pass
    human_judgment: false
  - id: D6
    description: "SDK bundle loads via <script> tag without blocking (IIFE output)"
    requirement: SDK-01
    verification:
      - kind: unit
        ref: "sdk/rollup.config.mjs iife format check + sdk/dist/watchbug.js exists"
        status: pass
    human_judgment: false
  - id: D7
    description: "All widget styles are scoped inside Shadow DOM — no global leakage"
    requirement: SDK-02
    verification:
      - kind: unit
        ref: "tests/unit/widget.test.ts#widget styles are scoped inside shadow DOM"
        status: pass
    human_judgment: false
duration: 17min
completed: 2026-08-30
status: complete
---

# Phase 01 Plan 01: Project Scaffold + Shadow DOM Widget + i18n Summary

**Working SDK widget with closed Shadow DOM isolation, two floating buttons, overlay, bundled en/es translations, Rollup IIFE build and Vitest+jsdom test suite**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-30T16:13:10Z
- **Completed:** 2026-08-30T16:30:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Project scaffold with TypeScript ES2020 strict, Rollup IIFE+ESM outputs via terser, jsdom test environment
- SDK entry point `window.Watchbug` with `init({key, language, apiUrl, bufferSize})`, `setConsent`, `getConsoleLogs`, `_initialized` and consent-aware console buffer
- Shadow DOM widget (`watchbug-widget`) with mode `closed`, adoptedStyleSheets, bottom-right floating container, two circular buttons, full-screen overlay (hidden by default, z-index 2147483647), toolbar and canvas, ARIA attributes
- Bundled i18n module `createI18n` with 12 keys (en/es), runtime `setLanguage`, widget live text update via `data-language` attribute and `setLanguage` method
- 28 unit tests (8 sdk-entry, 11 widget, 9 i18n) all passing, Rollup build produces `dist/watchbug.js` (7.2 KB) and `dist/watchbug.esm.js` (11 KB) before gzip

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffold + SDK entry point with init() global** - `da12d03` (feat)
2. **Task 2: Shadow DOM widget with floating buttons and full-screen overlay** - `eccd637` (feat)
3. **Task 3: Bundled i18n with runtime language switching** - `fb3891d` (feat)

**Plan metadata:** `pending` (docs: complete plan)

## Files Created/Modified

- `sdk/package.json` - SDK package with @watchbug/sdk name, rollup build, vitest, typescript
- `sdk/tsconfig.json` - ES2020, strict, bundler resolution, DOM lib
- `sdk/rollup.config.mjs` - IIFE to dist/watchbug.js (name Watchbug, terser) + ESM to dist/watchbug.esm.js
- `sdk/src/index.ts` - WatchbugAPI, createWatchbug(), init mount, consent, console buffer, window.Watchbug assignment, widget side-effect import
- `sdk/src/widget/styles.ts` - WIDGET_CSS scoped styles (container fixed bottom-right, buttons 56px, overlay, toolbar)
- `sdk/src/widget/WatchbugWidget.ts` - Closed Shadow DOM widget, ARIA, overlay show/hide, toolbar, canvas, i18n integration
- `sdk/src/widget/i18n.ts` - TRANSLATIONS 12 keys, createI18n with t/setLanguage/getLanguage
- `vitest.config.ts` - globals, jsdom, include tests/**/*.test.ts
- `tests/unit/sdk-entry.test.ts` - 8 tests for init, mount, global namespace, error handling, consent
- `tests/unit/widget.test.ts` - 11 tests for shadow mode, buttons, overlay, isolation, ARIA
- `tests/unit/i18n.test.ts` - 9 tests for defaults, switching, all keys, widget integration
- `package.json` + `package-lock.json` - Root vitest runner for project-level tests
- `sdk/package-lock.json` - Locked SDK deps

## Decisions Made

- Moved ARIA `role`/`aria-label` from widget constructor to `connectedCallback` to avoid jsdom `NotSupportedError: Unexpected attributes` when element is created via `document.createElement` (spec forbids attribute mutation in constructor during parser creation). Test updated to check attributes after append.
- Added root `package.json` for vitest at project root — plan listed only `sdk/package.json` but `vitest.config.ts` at root requires vitest resolvable from root. Documented as blocking deviation.
- Added side-effect `import './widget/WatchbugWidget'` in `sdk/src/index.ts` so Rollup bundles widget with entry and `customElements.define` runs before `init()` mounts. Plan's allowed files for Task 2 omitted `index.ts`, treated as Rule 3 blocking fix.
- Used `CSSStyleSheet.replaceSync` / `adoptedStyleSheets` with `<style>` fallback for jsdom where adoptedStyleSheets is partially supported.
- Fixed Rollup TypeScript error on `shadow.addEventListener('keydown', (e: KeyboardEvent))` by narrowing to `Event` and casting to `KeyboardEvent`.
- Widget language: default `en`, reads `data-language` attribute in `connectedCallback` and re-renders via `_updateTexts()`. `setLanguage` updates DOM in place without rebuilding shadow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Root package.json required for vitest at project root**
- **Found during:** Task 1 (vitest config at root)
- **Issue:** Plan creates `vitest.config.ts` at project root with `include: ["tests/**/*.test.ts"]` but only installs vitest inside `sdk/`. `npx vitest run` from root fails to resolve vitest. Tests would not run as specified.
- **Fix:** Created `package.json` and `package-lock.json` at project root with `vitest` and `jsdom` devDeps, installed via `npm install`.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npx vitest run` from root now passes (28 tests).
- **Committed in:** `da12d03` (Task 1)

**2. [Rule 3 - Blocking] Widget not bundled without import in entry point**
- **Found during:** Task 2 (widget bundling)
- **Issue:** `sdk/src/index.ts` created in Task 1 mounts `watchbug-widget` via `createElement` but never imports `WatchbugWidget.ts`. Rollup tree-shakes widget out, resulting bundle has no widget definition. `customElements.get('watchbug-widget')` would be undefined at runtime.
- **Fix:** Added `import './widget/WatchbugWidget'` side-effect import to `sdk/src/index.ts`.
- **Files modified:** `sdk/src/index.ts`
- **Verification:** `npx rollup -c` produces bundle containing widget code; `customElements.get('watchbug-widget')` defined.
- **Committed in:** `eccd637` (Task 2)

**3. [Rule 1 - Bug] jsdom NotSupportedError when setting ARIA in constructor**
- **Found during:** Task 2 (all tests run together)
- **Issue:** `WatchbugWidget` constructor called `this.setAttribute('role', ...)` which throws `NotSupportedError: Unexpected attributes` when element is instantiated via `document.createElement('watchbug-widget')` in `init()` (jsdom enforces spec: no attribute mutation in constructor). Widget tests using `new WatchbugWidget()` passed, but sdk-entry tests failed with 6 unhandled errors.
- **Fix:** Moved ARIA attribute setting to `connectedCallback`, guarded by `hasAttribute` check. Updated widget test to assert after `appendChild`.
- **Files modified:** `sdk/src/widget/WatchbugWidget.ts`, `tests/unit/widget.test.ts`
- **Verification:** `npx vitest run` now passes with 0 unhandled errors (19→28 tests after Task 3).
- **Committed in:** `eccd637` (Task 2)

**4. [Rule 1 - Bug] Rollup TS2769 on ShadowRoot addEventListener overload**
- **Found during:** Task 2 (rollup build)
- **Issue:** `shadow.addEventListener('keydown', (e: KeyboardEvent) => ...)` fails type check because `ShadowRoot` only declares `slotchange` overload strictly. Rollup emits TS2769 warning treated as error in strict CI.
- **Fix:** Changed handler to `(e: Event) => { const ke = e as KeyboardEvent; ... }`
- **Files modified:** `sdk/src/widget/WatchbugWidget.ts`
- **Verification:** `npx rollup -c` completes without TS2769.
- **Committed in:** `fb3891d` (Task 3, bundled with i18n update)

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bug)
**Impact on plan:** All fixes necessary for correctness and testability. No scope creep, no architectural change.

## Issues Encountered

- jsdom `adoptedStyleSheets` partially supported — implemented fallback to `<style>` injection still scoped inside Shadow DOM. Verified via test that global head does not contain widget styles.
- `npx vitest run` from `sdk/` with `include: ["tests/**/*.test.ts"]` finds no tests because tests are at project root, not inside sdk. Plan's `cd sdk && npx vitest run` would exit 1 from sdk dir. Deviation logged but not fixed — root-level run is canonical per `vitest.config.ts` location. Future Plan 05 may add `sdk/vitest.config.ts` proxy if needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SDK foundation ready for Plan 01-02 (capture engine: screenshot, metadata, console logs, batching)
- Widget can be imported via `<script src="sdk/dist/watchbug.js">` + `window.Watchbug.init({key, language})`
- i18n ready for capture/editor text; add new keys to `TRANSLATIONS` as editor tools expand
- No blockers

## Self-Check: PASSED

- All 12 created files found (sdk/src/*, sdk/*, tests/unit/*, vitest.config.ts, SUMMARY.md)
- All 3 task commits verified (da12d03, eccd637, fb3891d)
- `npx vitest run` passes 28/28, `npx rollup -c` succeeds, grep checks for mode:closed and customElements.define pass

---
*Phase: 01-sdk-core*
*Completed: 2026-08-30*
