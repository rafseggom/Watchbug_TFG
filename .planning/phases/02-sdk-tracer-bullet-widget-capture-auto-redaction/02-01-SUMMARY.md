---
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
plan: 01
subsystem: ui
tags: [widget-shell, shadow-dom, isolation, init, launcher, status-panel, build-variant, e2e, int-01, wdg-04]

# Dependency graph
requires:
  - phase: 01-contracts-ingest-slice
    provides: "the `packages/sdk` two-lane build (IIFE + ESM, one esbuild call per format), the Zod-free `@watchbug/contracts` types/constants split, the filename-gated `check:size` lanes, `scripts/gate.mjs` static assertions, and the one-Playwright-suite conventions (row title names the requirement ID, route-fulfilment fixtures, `projectKey()` read from `.env`)"
provides:
  - "INT-01: one async `<script src>` boots the widget — `window.Watchbug` with named `init` + `WATCHBUG_VERSION`, the host appended as `documentElement`'s last child, zero stylesheets/classes injected into the host document"
  - "WDG-04: the IIFE lane adds exactly one global (`Watchbug`), the ESM lane adds none, and `Object`/`Element`/`HTMLElement`/`EventTarget` prototypes are byte-identical before vs after (measured without instrumenting `window`)"
  - "the isolation primitive (`WidgetHost`): inline-`!important` host style, closed shadow root with one `<style>` beginning `all: initial`, px-only tokens, MutationObserver re-append + style re-assert, `hideSync()`/`restore()`/`isHidden()`"
  - "the one-gesture launcher: real 48x48 `<button>`, `aria-label` from the locked copy, handler that hides the host and calls the flow entry synchronously in the same task (P2-D-02/05), plus `setDisabled()`"
  - "the complete locked copy map (P2-D-04) and the status-panel renderer for every UI-SPEC state — copy via `t()`, 700 ms spinner frozen under reduced motion, `role=status`/`role=alert`, 240-char word-boundary truncation"
  - "R-14: `watchbug.e2e.js` / `watchbug.e2e.mjs` open-mode artifacts with filenames distinct from the gated production bundles"
  - "the e2e harness the rest of the phase plugs into: `e2e/sdk.spec.ts` boot/global group + `e2e/helpers/host-fixtures.ts`"
affects: [02-02 (fills the `enterFlow` seam with the capture tracer), 02-03 capture adapters, 02-04 redaction, 02-05 privacy/purge, phase-3 annotator + i18n, phase-4 enrichment, phase-6 panel]

# Actuals (#2632) — pairs with the plan's `estimate`
actuals:
  tokens: 10677
  tasks: 3
  commits: 3
  plan_head_before: 936cf4157b84785c9611d0d3474723b934d4dc16
  plan_head_after: b00fe112f19ead1cd19080c57edc9c22d55b807e

# Tech tracking
tech-stack:
  added: ["none — zero new dependencies (RNF-01 / PRF-04); the open-mode variant is a second esbuild `build()` call, not a package"]
  patterns:
    - "Three independent isolation mechanisms, one failure mode each: inline `!important` on the host (outranks a hostile author `!important`), `all: initial` at the top of the shadow `<style>` (inheritance), last-child + light MutationObserver (removal/burial)"
    - "One `<style>` element inside the shadow root, component CSS concatenated by the entry (`HOST_CSS + LAUNCHER_CSS + PANEL_CSS`) — no `adoptedStyleSheets`, no host stylesheet, no `innerHTML` anywhere in the SDK"
    - "Gesture seam: click handler calls `hide()` then `onActivate()` synchronously; 02-02 swaps the `enterFlow` body at that one call site, so transient activation is never re-sequenced"
    - "Measurement without instrumentation: the fixture writes its `window`/prototype snapshot into `data-wb-before` / `data-wb-after` on `<html>`, so taking the snapshot cannot itself add a global (which would be the leak WDG-04 forbids)"
    - "Fixtures served by `page.route` fulfilment at the panel origin — the nginx root's `default-src 'self'` CSP would block the fixture's own inline instrumentation and make the rows vacuous (Pitfall 4)"

key-files:
  created:
    - packages/sdk/src/strings.ts
    - packages/sdk/src/widget/host.ts
    - packages/sdk/src/widget/launcher.ts
    - packages/sdk/src/widget/status-panel.ts
    - packages/sdk/src/globals.d.ts
    - e2e/sdk.spec.ts
    - e2e/helpers/host-fixtures.ts
  modified:
    - packages/sdk/src/index.ts
    - packages/sdk/scripts/build.mjs

key-decisions:
  - "The host element is an **unregistered** `<watchbug-host>`: `customElements.define` would mutate the host page's global custom-element registry (pre-emptable by a hostile page), and WDG-03/04 require no trace in host-controlled global state. `attachShadow()` works on unregistered hyphenated elements, so isolation is strictly stronger at the same byte cost"
  - "`endpoint` defaults from `document.currentScript?.src` captured at module evaluation, falling back to `document.baseURI`'s origin — not `import.meta.url` (esbuild's IIFE lane cannot express it without a define/plugin, and `currentScript` is the first-party delivery signal PITFALLS.md:383 names)"
  - "The open-mode artifacts are emitted by every `npm run build`, as two extra core calls, instead of gated behind an argv flag: one build path, no stale/missing e2e bundle, and `check:size` budgets by filename so the variant is structurally outside the gate"
  - "The shadow-root registry (`openRoots` + `getShadowRoots()`) is populated only when `SHADOW_MODE === 'open'`; production folds the branch away and Playwright reaches the root through `host.shadowRoot`, so no second global is needed for testing"
  - "The panel CSS is exported from its component (`PANEL_CSS`) and composed by `index.ts` into the single shadow `<style>` — the UI-SPEC forbids a second stylesheet, and composition keeps each component's CSS next to its markup"
  - "`init()` is a validated, idempotent mount that owns config + the flow-entry seam; the state-machine transition semantics (Escape/A-7, 5 s auto-dismiss/A-5, retry progression/P2-D-03) are deliberately 02-02's, not this plan's"

requirements-completed: [INT-01, WDG-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "INT-01 — a host page with one async `<script src>` boots the widget: `window.Watchbug` (object, `init` function, version), host present as `documentElement`'s last child, closed root unpiercable (`shadowRoot === null`), zero injected stylesheets, no page errors"
    requirement: INT-01
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#INT-01: one async script tag boots the widget … (chromium + firefox + webkit, `npm run verify -- e2e/sdk.spec.ts` 9/9)"
        status: pass
    human_judgment: false
  - id: D2
    description: "INT-01 — the one-gesture launcher renders 48x48 inside the open-mode shadow root at 24 px insets, radius 24 px, `aria-label` 'Report a bug', enabled, with the panel mounted idle (`role=status`, `aria-live=polite`)"
    requirement: INT-01
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#INT-01: the one-gesture launcher renders 48x48 inside the open-mode shadow root (3 browsers)"
        status: pass
    human_judgment: false
  - id: D3
    description: "WDG-04 — passive window/prototype diff: IIFE lane adds exactly `['Watchbug']`, ESM lane adds `[]` (and still mounts the host), four native prototypes identical"
    requirement: WDG-04
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#WDG-04: the IIFE lane adds exactly one global, the ESM lane adds none … (3 browsers)"
        status: pass
    human_judgment: false
  - id: D4
    description: "R-14 build variant — `watchbug.e2e.js` / `.mjs` emitted from the same entry with `SHADOW_MODE = 'open'`, distinct filenames, and the production core tier still inside 45 KB gz"
    requirement: WDG-04
    verification:
      - kind: build
        ref: "`npm run build -w @watchbug/sdk` emits 8 artifacts; `npm run check:size` → core 4.1 KB gz / 45 KB, runtime 4.8 KB / 80 KB, PASSED"
        status: pass
      - kind: static
        ref: "`node scripts/gate.mjs` → 2 passed, 0 failed, 1 skipped (`sdk-single-encode-sink`, encode sink lands Phase 3); EXIT 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Status-panel rendering contract — every UI-SPEC state's copy through `t()`, 700 ms spinner static under `prefers-reduced-motion`, `role=status` / terminal `role=alert`, 240-char word-boundary truncation via `textContent` only"
    requirement: WDG-04
    verification:
      - kind: static
        ref: "source assertions in `packages/sdk/src/widget/status-panel.ts` (`MAX_REASON_CHARS`, `RETRY_MAX_ATTEMPTS`, `role` attributes, reduced-motion branch) + `npm run build` / `check:size`"
        status: pass
      - kind: e2e
        ref: "e2e/sdk.spec.ts#D2 asserts the mounted idle panel's live-region attributes in the real shadow root"
        status: pass
    human_judgment: false

metrics:
  duration: 45min
  completed: 2026-10-23
status: complete
---

# Phase 2 Plan 1: Widget Shell & Boot Proof Summary

**The widget now boots from one async script tag: `window.Watchbug` is the only global the IIFE lane adds (the ESM lane adds none), everything renders inside a closed shadow root whose single `<style>` starts `all: initial` behind an inline-`!important` host, and the locked UI-SPEC copy renders through a status panel that covers every state — with the open-mode `watchbug.e2e.*` build variant and the boot/global e2e rows green on chromium + firefox + webkit (9/9).** `npm run build`, `npm run typecheck`, `npm run check:size` (core 4.1 KB gz / 45 KB) and `node scripts/gate.mjs` (2 PASS / 1 SKIP, exit 0) are all green.

## Performance

- **Duration:** 45 min
- **Started:** 2026-10-23T19:55Z
- **Completed:** 2026-10-23T20:40Z
- **Tasks:** 3 (Tasks 1–2 carry `tdd="true"` in the plan; see "TDD Gate Compliance" for how R-12 governs that)
- **Files modified:** 9 (8 in the plan's `files_modified` + `packages/sdk/src/globals.d.ts`), none deleted

## Accomplishments

- **Task 1 (`2575121`):** `index.ts` rewritten from the Phase-1 stub into the validated mount — named `init(options: WatchbugInitOptions)` plus the default `{ WATCHBUG_VERSION, init }` namespace (the shape the IIFE `globalName: 'Watchbug'` exposes), hand-rolled validation (non-empty `projectKey`; `endpoint` must be an absolute http(s) URL), idempotent re-init as a documented no-op, and the `enterFlow` seam the tracer fills. `host.ts` lands the isolation primitive: the exact UI-SPEC inline-`!important` list, `attachShadow({ mode: SHADOW_MODE })`, one shadow `<style>` that opens with `all: initial` on `:host`/`.wrap` and then re-declares box-sizing, the system font stack, 15 px/1.5, ink `#1b1f26`, direction, cursor and text-align, px-only `--wb-*` tokens, three non-subtree MutationObservers (re-append, style re-assert, `documentElement` replacement), and `hideSync()`/`restore()`/`isHidden()`/`destroy()` with the open-mode root registry. `launcher.ts` renders a real 48x48 `<button>` (radius 24 px, `#2f6feb`, 24x24 `createElementNS` bug glyph, 2 px focus ring with 2 px offset) whose click handler hides the host and invokes the flow entry in the same task with no `await` between. `strings.ts` carries all 14 locked IDs verbatim and `t()` doing `{placeholder}` replacement only.
- **Task 2 (`722e6da`):** `status-panel.ts` implements the rendering half of the UI-SPEC machine — `render(view)` over `idle | capturing | sending | retrying{n,max} | sent | failed{capture,blank,network,rejected}` with an optional server reason, copy strictly through `t()`; the panel's geometry and palette as specified (`min(320px, calc(100vw - 48px))`, 16 px padding, 8 px radius, `#d6dae1` border, the 0 8 24 shadow); the 12x12 spinner at 700 ms with a `prefers-reduced-motion` branch that also removes the entrance transition; `✓` in `#1e7a46`, `✕` + headline in `#b3261e`, hints 13 px `#5b6472`; `role="status" aria-live="polite"` on the text container with `role="alert"` added only on terminal failure; 36 px action buttons 8 px apart, right-aligned; dynamic text written exclusively via `textContent` and truncated at `MAX_REASON_CHARS = 240` on a word boundary. `index.ts` mounts the panel hidden in `idle` and composes `PANEL_CSS` into the single shadow stylesheet.
- **Task 3 (`b00fe11`):** `build.mjs` gained the R-14 lane — two extra core calls producing `watchbug.e2e.js` / `watchbug.e2e.mjs` from the same entry with `SHADOW_MODE = 'open'`, leaving the 3 entries x 2 formats matrix intact and the production filenames (and therefore the size gate) untouched. `e2e/helpers/host-fixtures.ts` serves host pages and bundles by `page.route` fulfilment at `http://127.0.0.1:8080/__e2e/...` (no CSP), snapshots `Object.getOwnPropertyNames(window)` plus the four prototypes into `data-wb-before`/`data-wb-after` on `<html>`, and reads `WATCHBUG_PROJECT_KEY` from `.env` with the same fail-loud placeholder guard as the Phase-1 helpers. `e2e/sdk.spec.ts` adds the three rows: closed-bundle boot, open-mode launcher geometry/a11y, and the IIFE-vs-ESM global diff with a guard assertion that `Watchbug` is absent *before* load.

## Task Commits

Each task was committed atomically:

1. **Task 1: widget shell — `init()`, isolated host, one-gesture launcher, locked strings** - `2575121` (feat)
2. **Task 2: status-panel renderer for every UI-SPEC state** - `722e6da` (feat)
3. **Task 3: open-mode build variant + boot/global e2e rows** - `b00fe11` (feat)

**Plan metadata:** *(this commit)*

## Files Created/Modified

- `packages/sdk/src/index.ts` — `WATCHBUG_VERSION`, `WatchbugInitOptions`, `resolveOptions`, `LOADING_SCRIPT_URL`, `defaultEndpoint`, idempotent `init()`, `enterFlow` seam, default export namespace.
- `packages/sdk/src/strings.ts` — **new**: `strings` (14 locked IDs), `StringId`, `t()`.
- `packages/sdk/src/widget/host.ts` — **new**: `HOST_STYLE`, `HOST_CSS`, `WatchbugHost`, `mountHost`, `getShadowRoots`, open-mode registry, observers, hide/restore/isHidden/destroy.
- `packages/sdk/src/widget/launcher.ts` — **new**: `LAUNCHER_CSS`, `Launcher`, `LauncherOptions`, `createLauncher` (48x48 button, SVG glyph via `createElementNS`, synchronous hide-then-activate, `setDisabled`).
- `packages/sdk/src/widget/status-panel.ts` — **new**: `PANEL_CSS`, `StatusView`, `StatusFailure`, `StatusPanel`, `createStatusPanel`, `truncateReason`, `MAX_REASON_CHARS`, `RETRY_MAX_ATTEMPTS`.
- `packages/sdk/src/globals.d.ts` — **new**: declares the esbuild `SHADOW_MODE` define (`'open' | 'closed'`) so the two build lanes type-check.
- `packages/sdk/scripts/build.mjs` — the `core-e2e` pair of builds (open-mode, distinct filenames) and the R-14 doc-comment.
- `e2e/sdk.spec.ts` — **new**: `INT-01` x2 + `WDG-04` rows.
- `e2e/helpers/host-fixtures.ts` — **new**: `openHostFixture`, `waitForSnapshot`, `readSnapshot`, `addedNames`, `projectKey`, `FIXTURE_URL`.

## Decisions Made

- **Unregistered `<watchbug-host>`** (see frontmatter). The plan's artifact line says "`WatchbugHost` custom element"; registering it would mutate the host page's `customElements` registry, which a hostile page can pre-empt by defining the same tag first — and WDG-03/04 require no trace in host-controlled global state. `attachShadow()` on an unregistered hyphenated element gives the same isolation with strictly less global surface.
- **`endpoint` fallback is `document.baseURI`, not `import.meta.url`.** `document.currentScript` is only readable while the script executes, hence the module-evaluation capture; the ESM fallback would need an esbuild define or plugin to survive the IIFE lane, and the document origin is the same first-party deployment for both lanes.
- **The e2e variant is unconditional.** Every `npm run build` emits the two `watchbug.e2e.*` artifacts. The plan allowed "an argv flag (e.g. `--shadow=open`) or an extra core build"; choosing the extra build keeps one build path and removes the "forgot the flag, stale e2e bundle" failure mode. `check-size.mjs` gates by filename, so the variant is structurally outside the budget.
- **Playwright pierces the root through `host.shadowRoot`, not a registry global.** `getShadowRoots()` exists for same-realm callers (02-02's pipeline assertions), but exposing it on `window` would contradict WDG-04; the open build makes `shadowRoot` readable, which is the minimum surface that allows the assertions.
- **No `innerHTML` anywhere.** All markup is `createElement`/`createElementNS` + `textContent`, so the panel's dynamic text path has no HTML sink to sanitise (T-02-01's negative source gate holds by construction).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `SHADOW_MODE` needed a TypeScript declaration**
- **Found during:** Task 1 (`npm run typecheck` failed on `SHADOW_MODE` not being defined).
- **Issue:** The build `define` is an esbuild-time substitution; `tsc --noEmit` has no knowledge of it, so `attachShadow({ mode: SHADOW_MODE })` and the `SHADOW_MODE === 'open'` branch were type errors. The plan's `files_modified` did not list a declaration file.
- **Fix:** Added `packages/sdk/src/globals.d.ts` declaring `const SHADOW_MODE: 'open' | 'closed'` with the R-14 rationale. No runtime code, no dependency, erased at build.
- **Files modified:** `packages/sdk/src/globals.d.ts` (new).
- **Verification:** `npm run typecheck -w @watchbug/sdk` and `npm run build -w @watchbug/sdk` exit 0.
- **Committed in:** `2575121`.

**2. [Rule 1 - Bug] `import.meta.url` is not available in the IIFE lane**
- **Found during:** Task 1 (writing `defaultEndpoint`).
- **Issue:** The plan's fallback for the ESM lane (`import.meta.url` origin) has no meaning once esbuild emits an IIFE, and expressing it in shared source would need a per-format define — extra machinery for a value that is the same origin in both lanes.
- **Fix:** `document.currentScript?.src` captured at module evaluation, falling back to `document.baseURI`; both wrapped in `try/catch` returning `''` rather than throwing during boot.
- **Files modified:** `packages/sdk/src/index.ts`.
- **Verification:** INT-01 fixture boots with no page errors and the host mounts on both lanes; `endpoint` validation is separate and throws only on caller-supplied non-absolute values.
- **Committed in:** `2575121`.

**3. [Rule 2 - Missing Critical] Host element registered as a custom element would leak into the page's registry**
- **Found during:** Task 1 (implementing `host.ts` against WDG-03/04).
- **Issue:** `customElements.define('watchbug-host', …)` is a permanent, page-visible global mutation and a hostile page could define the tag first, capturing the widget's element.
- **Fix:** `document.createElement('watchbug-host')` with no registration; `attachShadow()` still applies. The rationale is recorded in the file-top comment so the next reader does not "fix" it back.
- **Files modified:** `packages/sdk/src/widget/host.ts`.
- **Verification:** WDG-04 row proves the global diff is exactly `['Watchbug']` (IIFE) and `[]` (ESM) with the four prototypes unchanged; the host still renders and is asserted present/last-child in the INT-01 row.
- **Committed in:** `2575121`.

### Documented scope additions

- **`packages/sdk/src/globals.d.ts`** — outside `files_modified`, required for task 1's `npm run typecheck` (deviation 1 above).
- **E2E artifact emission inside the default build** — the plan offered a flag *or* an extra build; the extra-build form is documented above as a decision, not a silent change.
- **`e2e/sdk.spec.ts` carries three rows, not two** — `INT-01` is split into the closed-bundle boot row and the open-mode launcher row, because the closed bundle cannot be pierced to observe the launcher (that is the point of INV-01) and conflating them would have weakened the production assertion.

### TDD Gate Compliance — not applicable under R-12 (stated, not skipped silently)

Tasks 1 and 2 carry `tdd="true"`, but the project's verification policy (R-12 + AGENTS.md, owner-stated twice) forbids unit-test suites, test frameworks and coverage tooling: the only test artefact is the one Playwright suite plus the size gate. There is therefore no RED-first unit test to write for a shadow-root host or a DOM renderer — the observable contracts are the acceptance criteria the plan itself specifies as **source assertions** plus `build`/`check:size`/`gate.mjs`.

Executed accordingly: each task ran the plan's own `<verify>` commands (`npm run build`, `node scripts/gate.mjs` for Task 1; `npm run build`, `npm run check:size` for Task 2) to green, and the behaviour those tasks specify is proven at artifact level by the Task 3 rows (`INT-01` x2, `WDG-04`) rather than by a unit-level test. No `test(02-01)` commit exists, and none was fabricated: a RED commit asserting behaviour that no test runner is permitted to execute would be theatre. Behaviour that *is* e2e-observable (boot, geometry, a11y attributes, global surface) is covered in the suite, in the same commit that creates the harness.

## Verification Results

| Check | Command | Result |
| --- | --- | --- |
| SDK build (8 artifacts incl. open-mode pair) | `npm run build -w @watchbug/sdk` | exit 0 — core 4.1 KB gz, e2e artifacts emitted |
| SDK typecheck | `npm run typecheck -w @watchbug/sdk` | exit 0 |
| Size gate (RNF-01 tiers) | `npm run check:size` | **PASSED** — core 4.1/45, lazy 0.3/25, adapter 0.3/14, runtime 4.8/80 KB |
| Static architecture gate | `node scripts/gate.mjs` | **PASSED** — 2 passed, 0 failed, 1 skipped (`sdk-single-encode-sink`: encode sink lands Phase 3) |
| Boot/global rows, chromium only | `npx playwright test e2e/sdk.spec.ts --project=chromium` | **3 passed** |
| Boot/global rows, three engines | `npm run verify -- e2e/sdk.spec.ts` | **9 passed** (chromium + firefox + webkit) |

Acceptance criteria re-checked against the source: `init` is a named export and the default export carries `WATCHBUG_VERSION` + `init`; `strings.ts` holds all 14 locked IDs with no locale logic; `host.ts` shows the inline-`!important` list, `attachShadow({ mode: SHADOW_MODE })`, a `<style>` opening `all: initial`, and hide/restore/isHidden; `launcher.ts` shows the 48x48 button and the click handler calling `hide()` then the flow entry with no `await` between; `status-panel.ts` references all eight status keys, `textContent`, `MAX_REASON_CHARS = 240`, the reduced-motion branch and both roles; `build.mjs` names the e2e artifacts distinctly and `check:size` still gates only production names; `host-fixtures.ts` fulfils every fixture through `page.route` at the panel origin with nothing copied into the nginx root.

## Issues Encountered

- **PowerShell renders esbuild's stderr progress lines in red** even on success — `npm run build` was judged by `$LASTEXITCODE`, not colour (all builds exit 0).
- **The plan's `import.meta.url` premise does not survive the IIFE lane** — resolved by the `document.baseURI` fallback (deviation 2).
- **Pre-existing working-tree noise left untouched:** ` M .planning/STATE.md`, ` M .planning/state.json`, ` M schema/report.schema.json` and untracked `watchbugus-fun/` were present before this plan and are not part of it; `dist/` (including the new `watchbug.e2e.*`) is gitignored build output.

## Known Stubs

| Stub | File / line | Why it exists | Resolved by |
| --- | --- | --- | --- |
| `enterFlow()` restores the host instead of running the pipeline | `packages/sdk/src/index.ts:114-121` | This plan owns the shell; the seam is the exact call site the launcher's handler invokes in the gesture's task (P2-D-02/05). Its body is the only thing 02-02 changes. | 02-02 Task 1 (`runCaptureFlow`) |
| Panel `onRetry` re-enters `enterFlow` | `packages/sdk/src/index.ts:137` | Same seam from the panel's action row; `Try again` semantics (A-2) and the retry progression (P2-D-03) are state-machine behaviour, deferred by the plan's own task split. | 02-02 Task 2 |
| Panel transitions not driven yet (only `idle` is rendered at mount) | `packages/sdk/src/widget/status-panel.ts` (`render` is complete; no caller drives other views) | `render(view)` is the finished rendering contract; the state callback that drives it, plus Escape (A-7) and 5 s auto-dismiss (A-5), are 02-02's. | 02-02 Task 2 |

None of these hides a gap in this plan's goal (the shell boots, isolates and renders); they are the documented seams the tracer fills, and no placeholder text, mock data or skipped test exists anywhere in the diff. Both are recorded in the cross-phase defect register (`.planning/WINDOWS.md`, kind `stub`, phase 02) so they stay visible at ship time until 02-02 closes them.

## User Setup Required

None — no new environment variables, no external service, no dependency install. The e2e rows read the existing `WATCHBUG_PROJECT_KEY` from `.env` with the Phase-1 fail-loud guard.

## Next Phase Readiness

- **02-02 can start immediately:** the launcher's synchronous `hide()` → `enterFlow()` seam, `host.isHidden()`, the panel's `render(view)` entry and the `retrying{n,max}` view are all in place and exercised by a green suite; the tracer only swaps the seam body and drives the panel.
- **The harness is reusable:** `openHostFixture` accepts any of the four bundles in either mode, so the capture rows can load `watchbug.e2e.js` (open root, pipeline assertions) while the isolation rows keep using the production bundle.
- **Budget headroom:** core sits at 4.1 KB gz of 45 KB, so the capture/redaction/transport code has ~40 KB to land in before RNF-01 binds. The pre-existing A-12/M-2 note (per-lane ceilings summing to 84 KB > 80 KB) is unchanged and still Phase 7's to resolve.
- **Carried forward:** `sdk-single-encode-sink` stays SKIP until the Annotator's `encodeFinal()` lands (Phase 3) — expected, not a regression.

## Self-Check: PASSED

- All 7 created files exist on disk; all 2 modified files carry the task changes (`git show --stat` per commit).
- All three task commits exist: `2575121`, `722e6da`, `b00fe11` (`git rev-parse --verify` → FOUND x3).
- `commits: 3` measured from the ledger (`936cf41..HEAD` → `git rev-list --count` = 3), not narrated.
- `<verification>` re-run for this check: `check:size` PASSED, `gate.mjs` exit 0 (2 PASS / 1 SKIP), `npm run verify -- e2e/sdk.spec.ts` 9/9 across three engines.
- Every `<acceptance_criteria>` re-checked against the source (see Verification Results).

---
*Phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction*
*Completed: 2026-10-23*
