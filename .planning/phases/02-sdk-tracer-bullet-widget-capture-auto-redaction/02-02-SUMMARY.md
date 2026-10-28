---
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
plan: 02
subsystem: sdk
tags: [capture-pipeline, redaction, transport, retry, status-panel, widget-isolation, hostile-css, e2e, int-02, int-05, wdg-01, wdg-02, wdg-03, wdg-05, ca-04]

# Dependency graph
requires:
  - phase: 01-contracts-ingest-slice
    provides: "the real compose stack (Fastify ingest `POST /api/incidents` returning 201 with `{ id }`, `UNIQUE (project_id, idempotency_key)` dedupe, `WATCHBUG_PROJECT_KEY` in `.env`), the one-Playwright-suite conventions, `scripts/gate.mjs`, and the filename-gated `check:size` tiers"
  - phase: 02-01 (widget shell & boot proof)
    provides: "the `enterFlow` gesture seam, the isolated `WidgetHost` (inline `!important`, closed shadow root), the 48×48 launcher with `setDisabled()`, the status-panel renderer (`render(view)`), the locked copy map, and the `e2e/sdk.spec.ts` + `host-fixtures.ts` harness with the open-mode build variant"
provides:
  - "INT-02: one launcher gesture wires `runCaptureFlow` through hide → capture → assert → restore → blank probe → destructive redaction → encode → lane-1 POST, returns a real 201 from Fastify and renders the report in the panel"
  - "INT-05: `dist/watchbug.mjs` boots the same widget via `import { init }` and adds zero window properties"
  - "WDG-01: the launcher is a 48×48 shadow-root `<button>` that renders disabled while the panel is open"
  - "the strictly-ordered capture pipeline (`capture/pipeline.ts`) with the P2-D-06 hidden-host assertion and the 9-pixel P2-D-12 blank probe — every failure path a loud visible state"
  - "the SEC-01 first-commit redaction (`redact/redactor.ts` + outward-rounded `redact/geometry.ts`) running destructively on `ImageData` before any encode byte exists (A-05/T1)"
  - "the single-sink encode ladder (`image/encode.ts`, P2-D-10/11) with magic-byte WebP capability probing and empty-encode rejection"
  - "lane-1 transport (`transport/lane1.ts`) with the locked P2-D-03 retry contract: transients retry 1 s/4 s/10 s ±25 % with one stable `Idempotency-Key`, contract 4xx fail immediately with the server reason"
  - "the complete status-panel state machine: `capturing → sending → retrying (n of 3) → sent | failed{Capture,Blank,Network,Rejected}`, 5 s auto-dismiss, document-level `Escape` removed on teardown, `Try again` semantics per UI-SPEC A-2"
  - "WDG-02/WDG-03/WDG-05 + CA-04: the hostile-CSS fixture matrix (`e2e/fixtures/hostile-host.html`) proving isolation non-vacuously — control element per hostile rule, zero-leak enumeration scans, stacking/hit-test probes on all three engines"
affects: [02-03 (capture adapters CAP-01/04/05), 02-04 (redaction catalog + artifact-level CA-02), 02-05 (privacy/purge), phase-3 annotator, phase-7 size closeout]

# Actuals (#2632) — pairs with the plan's `estimate` (45000 tokens / 3 tasks)
actuals:
  tokens: 24992
  tasks: 3
  commits: 4
  plan_head_before: 8fbbec099ada30272ac12a326f145e9c05691f3a
  plan_head_after: 76247b4fa41bafda174a7c2486a98cf62db24fc0

# Tech tracking
tech-stack:
  added: ["none — zero new dependencies (RNF-01 / PRF-04); every new module is hand-rolled SDK source or e2e harness code"]
  patterns:
    - "Tracer pipeline order as the security property: hide → capture → assert-hidden → restore → blank-probe → destructive redact → encode → send; no encoded byte exists before `Redactor` runs (A-05/T1)"
    - "One encode sink as a loop: the quality ladder and the capability probe both route through the single `encodeOnce` call site, so `sdk-single-encode-sink` holds structurally"
    - "Capability probes must verify magic bytes, not transport labels: `blob.type === 'image/webp'` is insufficient (WebKit answers with zero-byte labelled blobs); the server's magic-byte check is the authority"
    - "e2e pass-through over re-serialization: inspect the intercepted request, then `route.continue()` and read the response via `waitForResponse` — `route.fetch()` rebuilds multipart bodies and drops WebKit's blob parts"
    - "Hostile-CSS matrix as one `<template>` per variant lifted by the helper, each with a paired control element, so a CA-04 row can never pass vacuously (Pitfall 4)"
    - "Isolation assertions run against the closed production bundle where observable (host computed style, `document.elementFromPoint`), copy/geometry against the open-mode registry build (Pitfall 10)"

key-files:
  created:
    - e2e/fixtures/hostile-host.html
  modified:
    - e2e/sdk.spec.ts
    - e2e/helpers/host-fixtures.ts
    - e2e/helpers/capture-stubs.ts
    - packages/sdk/src/index.ts
    - packages/sdk/src/capture/capture-source.ts
    - packages/sdk/src/capture/pipeline.ts
    - packages/sdk/src/redact/redactor.ts
    - packages/sdk/src/redact/geometry.ts
    - packages/sdk/src/image/encode.ts
    - packages/sdk/src/transport/lane1.ts
    - packages/sdk/src/widget/status-panel.ts
    - packages/sdk/src/widget/host.ts

key-decisions:
  - "WebKit cannot serialize blob-backed FormData into `request.postDataBuffer()`, so any row that must both inspect a multipart body AND see the real server response passes the request through with `route.continue()` and reads the 201 via `page.waitForResponse` — `route.fetch()` re-sends an empty image part and the API 400s on magic bytes"
  - "The WebP capability probe validates `RIFF`/`WEBP` magic bytes of the produced probe blob in addition to `blob.type`, and `encodeLadder` rejects any zero-byte encode loudly — blob labels are claims, magic bytes are evidence"
  - "The WDG-03 leak scan is a literal generic enumeration: every host-document element (the `watchbug-host` element included) has its computed style walked for any property starting with `--wb-`, plus a head `style`/`link` count delta and a widget-class selector scan — probing a fixed token list could not satisfy the acceptance wording"
  - "The `elementFromPoint` contract is asserted as containment (`launcher.contains(hit)`), not strict identity: the launcher's centre is covered by its own SVG glyph, and the hit landing anywhere else in the shadow tree would fail the assertion"
  - "The hostile `display: none !important` selector excludes `html`/`body` (the fixture documents why): `display: none` on a rendering root removes the document's principal box so nothing can paint — widget included — and including it would make the control pass while proving nothing about the SDK"

patterns-established:
  - "Requirement-ID row titles in `e2e/sdk.spec.ts` (`WDG-02:`/`WDG-03:`/`WDG-05:`/`CA-04:`), parameterized where a matrix repeats the same contract"
  - "Fixtures served exclusively by `page.route` fulfilment at the panel origin — never copied into the nginx panel root whose CSP would neuter inline styles (Pitfall 4)"
  - "Two-tier capture stub per engine: `canvas.captureStream()` fake on chromium/firefox, `CaptureSource`-seam `ImageData` on webkit (Pitfall 2)"

requirements-completed: [INT-02, INT-05, WDG-01, WDG-02, WDG-03, WDG-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "INT-02 — one launcher gesture on the real compose stack: multipart POST with `meta` + `image` parts, `X-Project-Key` + `Idempotency-Key` headers, a real 201 with `{ id }` from Fastify, and the report visible in the panel after reload"
    requirement: INT-02
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#INT-02: one launcher gesture files a real report that returns 201 and renders in the panel (`npm run verify -- e2e/sdk.spec.ts`, chromium + firefox + webkit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "INT-05 — the ESM build `dist/watchbug.mjs` boots the same widget via module import and adds zero window properties (guarded by an absent-`Watchbug` precondition)"
    requirement: INT-05
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#INT-05: the ESM build boots the same widget and adds zero window properties (3 engines)"
        status: pass
    human_judgment: false
  - id: D3
    description: "WDG-01 — the launcher is a 48×48 px `<button>` inside the shadow root and renders disabled while the status panel is open mid-flow"
    requirement: WDG-01
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#WDG-01: the launcher is a 48×48 shadow-root button and renders disabled while the panel is open (3 engines)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Status-panel state machine + P2-D-03 retry contract — forced 500 retries through `Retrying (1 of 3)` with the identical `Idempotency-Key` and identical bytes; forced 400 renders the server message with no second attempt; 300+ char reason truncated to 240 with `…`; copy progression `Capturing… → Sending… → Retrying (n of 3)…`; `sent` auto-dismiss at 5 s and `Escape` dismissal"
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#P2-D-03 x2 + UI-SPEC backstop + UI-SPEC A-5/A-7 rows (3 engines)"
        status: pass
      - kind: other
        ref: "source assertion `packages/sdk/src/transport/lane1.ts` (`RETRY_DELAYS_MS = [1000, 4000, 10000]`, `RETRY_JITTER_RATIO = 0.25`, `SEND_TIMEOUT_MS = 15_000`, key minted once outside the attempt loop)"
        status: pass
    human_judgment: false
  - id: D5
    description: "CA-04 non-vacuous hostile matrix — every hostile rule (display `!important`, 4 px root font, `all: unset`, transform/filter fixed-containment trap, max-z modal, adjacency decoy) demonstrably applies to its paired control element before the widget assertions run"
    requirement: WDG-02
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CA-04: every hostile rule in the matrix demonstrably applies to its control element (3 engines)"
        status: pass
    human_judgment: false
  - id: D6
    description: "WDG-02 — the widget stays visible, interactive and contract-shaped under every hostile rule (inline `!important` computed style, 48×48 geometry at 24 px insets) and one gesture still files a report; plus the closed production bundle row where shadow geometry is unobservable"
    requirement: WDG-02
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#WDG-02 x5 (display/fontsize/unset/transform + closed-bundle contract) (3 engines)"
        status: pass
    human_judgment: false
  - id: D7
    description: "WDG-03 — before init, after init and after a full report flow: head `style`/`link` count delta 0, zero `--wb-` custom-property occurrences on any host-document element, and no widget class name outside the shadow root"
    requirement: WDG-03
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#WDG-03: init and a full report flow leak zero styles, classes or custom properties into the host document (3 engines)"
        status: pass
    human_judgment: false
  - id: D8
    description: "WDG-05 — `elementFromPoint` over a hostile max-z modal resolves to the widget and the flow completes; an adjacency decoy painted at the widget's coordinates captures no hit while host clicks still land; an empty host page renders at 24 px insets and starts the flow; a z-index tie stays resolved by DOM order and the host is re-appended after a `documentElement` replacement"
    requirement: WDG-05
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#WDG-05 x4 (modal, adjacency, empty, ordering+replacement) (3 engines)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Plan gates — SDK build, RNF-01 size tiers, the three `gate.mjs` SDK rules, lint/typecheck, and the no-HTML-sink source check"
    verification:
      - kind: other
        ref: "`npm run check:size` → core 7.6/45, lazy 0.3/25, adapter 0.3/14, runtime 8.3/80 KB PASSED; `node scripts/gate.mjs` → 3 passed, 0 failed, 0 skipped PASSED"
        status: pass
      - kind: other
        ref: "`npm run build` exit 0; `npm run lint` (tsc typecheck x4 + biome) exit 0; grep for `innerHTML|outerHTML|insertAdjacentHTML|document.write` under `packages/sdk/src` → comment mention only, no sink usage"
        status: pass
    human_judgment: false

metrics:
  duration: 6h00m
  completed: 2026-10-24
status: complete
---

# Phase 2 Plan 2: Capture Tracer Bullet & Isolation Proof Summary

**One launcher gesture now files a real masked report end-to-end (`runCaptureFlow`: hide → capture → assert → restore → blank probe → destructive T1 redaction → single-sink encode ladder → lane-1 POST → 201 → panel row) with the complete P2-D-03 retry state machine, and the `WidgetHost` isolation contract is proven non-vacuously under a six-variant hostile-CSS matrix — 63/63 e2e green on chromium + firefox + webkit, `check:size` (core 7.6/45 KB gz), `gate.mjs` (3 PASS) and lint all green.**

## Performance

- **Duration:** ~6h 00m active across three sessions (wall window 2026-10-23T20:40Z → 2026-10-24T11:45Z includes a ~9 h interruption between Task 3's authoring start and its resume)
- **Started:** 2026-10-23T20:40Z (immediately after 02-01 closed)
- **Completed:** 2026-10-24T11:45Z
- **Tasks:** 3 (Tasks 1–2 carry `tdd="true"`; see "TDD Gate Compliance")
- **Files modified:** 13 (12 in the plan's `files_modified` + `packages/sdk/src/widget/host.ts`), 1 created, 0 deleted

## Accomplishments

- **Task 1 (`032a66c`): tracer bullet.** `index.ts` fills the `enterFlow` seam with `runCaptureFlow`, threading the pipeline's state callback into `StatusPanel.render()` and `Launcher.setDisabled()`. `capture/capture-source.ts` lands the `CaptureSource` port (`capture()` returns raw `ImageData`, never a Blob — A-05) plus the `DisplayMediaCapture` adapter (`getDisplayMedia({ video, preferCurrentTab })` → display-surface policy check → real frame → `getImageData`, `track.stop()` in `finally`). `capture/pipeline.ts` enforces the order in code (P2-D-06 hidden-host assertion immediately before the pixel read, P2-D-12 9-pixel blank probe). `redact/` lands the SEC-01 families (password inputs + `[data-watchbug-sensitive]`) as destructive flat fills with outward-rounded bitmap geometry. `image/encode.ts` lands the single-sink quality ladder (q0.8 → 0.6 → 0.5 → 0.75× downscale, DPR clamp, 16 MP ceiling, `blob.type` sniff). `transport/lane1.ts` posts multipart `meta` + `image` with explicit field mapping (`document.title` truncated to 200, `location.pathname` only), `Idempotency-Key` minted once, `AbortSignal.timeout(15_000)`, `credentials: 'omit'`. The two-tier capture stub and the `INT-02`/`INT-05`/`WDG-01` rows close the task.
- **Task 2 (`9e53db8`): state machine + retry contract.** The panel drives every UI-SPEC state with the locked copy; transients retry on the exact 1 s/4 s/10 s ±25 % schedule with one stable `Idempotency-Key` and identical bytes; contract 4xx fail immediately rendering the server `message` through `textContent` truncated to 240 chars; `sent` auto-dismisses at 5 s; document-level `Escape` is removed on teardown (A-7); `Try again` re-POSTs same bytes + same key on send-side failures and restarts the gesture with a fresh key after capture-side failures (A-2).
- **Task 3 (`76247b4` + `e7cb5f2`): isolation proof.** `e2e/fixtures/hostile-host.html` carries six hostile variants, each with a paired control element; `openHostileFixture` serves it (and only via `page.route` fulfilment at the panel origin — Pitfall 4) with the variant lifted into a slot; `probeHost()` reads geometry, inline contract, stacking and hit-test results. New rows: `WDG-02` ×5, `CA-04` control matrix, `WDG-03` zero-leak enumeration (pre-init / post-init / post-flow), `WDG-05` ×4 (max-z modal, adjacency, empty page, z-index tie + `documentElement` replacement). Plus two verification-driven bug fixes (see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end tracer — one widget gesture files one real report (INT-02, INT-05, WDG-01)** - `032a66c` (feat)
2. **Task 2: Complete the status-panel state machine and the P2-D-03 retry contract** - `9e53db8` (feat)
3. **Task 3: Prove WidgetHost isolation under hostile host CSS (CA-04, WDG-02/03/05)** - `76247b4` (feat) + `e7cb5f2` (fix — WebP probe, verified under Task 3's own verify commands)

**Plan metadata:** *(this commit)*

_Measured from the plan ledger `8fbbec0..HEAD` → 4 commits (`git rev-list --count`), not narrated._

## Files Created/Modified

- `packages/sdk/src/index.ts` — `runCaptureFlow` at the gesture seam, state callback → panel + `setDisabled()`.
- `packages/sdk/src/capture/capture-source.ts` — **new**: `CaptureSource` port (`ImageData`), `DisplayMediaCapture`, e2e seam hook.
- `packages/sdk/src/capture/pipeline.ts` — **new**: `runCaptureFlow()` ordered orchestration, `blankProbe()`.
- `packages/sdk/src/redact/redactor.ts` — **new**: SEC-01 DOM scan → destructive `MASK_ALPHA_OPAQUE` fill.
- `packages/sdk/src/redact/geometry.ts` — **new**: `toBitmapRect()` outward rounding (H-1).
- `packages/sdk/src/image/encode.ts` — single-sink ladder, type sniff, magic-byte capability probe, empty-encode guard.
- `packages/sdk/src/transport/lane1.ts` — **new**: `sendReport()`, `buildMeta()`, `RETRY_DELAYS_MS`, `MAX_RETRIES`, jittered schedule.
- `packages/sdk/src/widget/status-panel.ts` — state-driving completion (auto-dismiss, `Escape`, retry progression semantics).
- `packages/sdk/src/widget/host.ts` — flow-era additions (hide/restore wiring used by the pipeline).
- `e2e/helpers/capture-stubs.ts` — capture stubs (Task 1) + `probeHost()`/`HostProbe` (Task 3).
- `e2e/helpers/host-fixtures.ts` — `openHostileFixture`, `HostileVariant`, `HOSTILE_URL`, shared `serveBundle()`.
- `e2e/sdk.spec.ts` — `INT-02`/`INT-05`/`WDG-01`, state-machine rows, `WDG-02`/`CA-04`/`WDG-03`/`WDG-05` isolation rows.
- `e2e/fixtures/hostile-host.html` — **new**: the hostile-CSS variant matrix with per-variant control elements.

## Decisions Made

- **Pass-through over re-serialization for real-stack rows** (frontmatter key-decision): the INT-02 row now inspects the intercepted request, sends the engine's original request with `route.continue()`, and reads the real 201 via `page.waitForResponse`. Playwright's WebKit cannot read blob-backed FormData parts into `postDataBuffer()`, so `route.fetch()` — the pattern `e2e/ingest.spec.ts` used — re-sent an empty `image` part and the API correctly 400'd on magic bytes. The wire assertions (`meta`/`image` parts, both headers, multipart content-type) still run on the intercepted buffer.
- **Magic bytes are the capability evidence.** The startup WebP probe verifies `RIFF`+`WEBP` bytes of the produced blob, not just its label; zero-byte encodes throw instead of shipping.
- **Generic `--wb-` enumeration for WDG-03.** Custom properties proved enumerable in computed style on all three engines, so the leak scan walks every host-document element for any `--wb-` property — literal acceptance wording, no fixed token list.
- **Containment for `elementFromPoint`.** The shadow-level assertion requires the hit to be the launcher button or its descendant (the centre point is the SVG glyph's); anything outside the button fails.
- **One hostile rule per fixture variant**, lifted by the helper into a slot, each paired with a control assertion — a row cannot go green while its rule silently fails to apply.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WebP capability probe trusted `blob.type` alone**
- **Found during:** Task 3 (three-engine verification of INT-02 against the real API).
- **Issue:** WebKit answers a WebP `toBlob` request with a **zero-byte blob still labelled `image/webp`** (spec says fall back to PNG; this build does not). The type-only probe cached "WebP supported", and a zero-byte encode could reach the wire where the API rejects it on magic bytes.
- **Fix:** `hasWebpMagic()` validates `RIFF`/`WEBP` at offsets 0/8 of the probe blob before caching capability; `encodeLadder` throws loudly on any zero-byte encode (the pipeline maps that to a visible `failedCapture` state — never a silent send).
- **Files modified:** `packages/sdk/src/image/encode.ts`.
- **Verification:** `npm run verify -- e2e/sdk.spec.ts` → 63/63 with the real API accepting every image (`201`); `node scripts/gate.mjs` still 3 PASS (single sink intact).
- **Committed in:** `e7cb5f2`.

**2. [Rule 1 - Bug] INT-02's `route.fetch()` pattern drops WebKit's multipart image part**
- **Found during:** Task 3 (`npm run verify -- e2e/sdk.spec.ts` — webkit reported 1 failed).
- **Issue:** The row inspected the request then re-sent it via `route.fetch()`, which rebuilds the multipart body from `request.postDataBuffer()`. Playwright's WebKit cannot serialize blob-backed FormData parts into that buffer (image part = 0 bytes; `meta` + headers intact), so the API received an empty image and returned `400 "image is neither PNG nor WebP (magic bytes)"` — the SDK's actual request was correct all along.
- **Fix:** the route handler inspects and then `route.continue()`s the engine's original request; the real response is read via `page.waitForResponse` and asserted (`201` + `{ id }`). Chromium/firefox behavior and all body/header assertions unchanged.
- **Files modified:** `e2e/sdk.spec.ts`.
- **Verification:** three-engine run green (63/63), INT-02 still artifact-level (real Fastify 201, real panel row after reload).
- **Committed in:** `76247b4`.

**3. [Rule 2 - Missing Critical] WDG-03 leak scan was a fixed three-token probe**
- **Found during:** Task 3 acceptance-criteria verification loop.
- **Issue:** The scan probed only `--wb-color-accent`, `--wb-color-surface`, `--wb-space-4`, but the acceptance wording requires **zero `--wb-` property occurrences** (the SDK declares 19 tokens) — and it skipped the `watchbug-host` element, exactly where a `:host`-declared token would appear.
- **Fix:** generic enumeration of every computed-style property starting with `--wb-` on every host-document element including the host itself (verified enumerable on all three engines), keeping the head style/link count delta and the widget-class scan.
- **Files modified:** `e2e/sdk.spec.ts`.
- **Verification:** the strengthened row passes on chromium + firefox + webkit (63/63).
- **Committed in:** `76247b4`.

### Scratch-artifact cleanup (not a deviation)

- The interrupted session's debug specs (`e2e/tmp-debug*.spec.ts`) were deleted without ever being committed; `watchbugus-fun/` (unrelated, untracked) was left untouched, and `schema/report.schema.json`'s line-ending-only stat noise was never staged.

---

**Total deviations:** 3 auto-fixed (2 × Rule 1, 1 × Rule 2)
**Impact on plan:** all three are correctness fixes inside this plan's own scope (one SDK encoding bug, two e2e-assertion defects); no scope creep, no architectural change.

## TDD Gate Compliance — not applicable under R-12 (stated, not skipped silently)

Tasks 1–2 carry `tdd="true"`, but R-12 (owner policy, stated twice) forbids unit-test suites: the only test artefact is the one Playwright suite plus `check:size`. As in 02-01, no `test(02-02)` commit exists and none was fabricated — RED-first would mean authoring a test no runner is permitted to execute. Each task ran its own `<verify>` commands to green, and every behavior the plan specifies is proven at artifact level by the suite rows (`INT-02`, `INT-05`, `WDG-01`, the P2-D-03 rows, `WDG-02`/`WDG-03`/`WDG-05`, `CA-04`). `workflow.tdd_mode` is `false` for this run, so no orchestrator RED gate applies.

## Verification Results

| Check | Command | Result |
| --- | --- | --- |
| Full workspace build | `npm run build` | exit 0 |
| Size gate (RNF-01 tiers) | `npm run check:size` | **PASSED** — core 7.6/45, lazy 0.3/25, adapter 0.3/14, runtime 8.3/80 KB gz |
| Static architecture gate | `node scripts/gate.mjs` | **PASSED** — 3 passed, 0 failed, 0 skipped (`sdk-runtime-deps`, `sdk-no-host-storage`, `sdk-single-encode-sink`) |
| Lint + typecheck (4 workspaces) | `npm run lint` | exit 0 |
| Task 3 first gate — chromium | `npx playwright test e2e/sdk.spec.ts --project=chromium` | **21 passed** |
| Plan verification — three engines | `npm run verify -- e2e/sdk.spec.ts` | **63 passed** (chromium 21 + firefox 21 + webkit 21), exit 0 |
| Source gate — no HTML sink | grep `innerHTML\|outerHTML\|insertAdjacentHTML\|document.write` under `packages/sdk/src` | comment mention only (`launcher.ts:15` prose); no sink usage |

Acceptance criteria re-checked against the source: all four row-title families present (`WDG-02:` ×5, `WDG-03:` ×1, `WDG-05:` ×4, `CA-04:` ×1) each with a paired control assertion per hostile rule; WDG-03 asserts head style/link count delta 0 plus the generic `--wb-` zero scan after a full report flow; the WDG-05 rows assert `elementFromPoint` at the launcher centre under the hostile modal, on the empty page and on the z-index tie (plus adjacency and `documentElement`-replacement probes); `hostile-host.html` is fulfilled via `page.route` at the panel origin (source assertion in `openHostileFixture`) and does not exist under `apps/panel/`.

## Issues Encountered

- **Docker Desktop's engine exited between sessions**, failing `npm run verify` in `globalSetup` (compose stack unreachable). This was remediated by the agent — started Docker Desktop from `C:\Users\Dekker\AppData\Local\Programs\DockerDesktop`, waited for `/api/health` → `{"status":"ok"}` — and the verification was then run for real. No result was faked; no human gate was needed.
- **Playwright WebKit multipart instrumentation limitation** (root-caused before fixing, see Deviation 2): `postDataBuffer()` excludes blob-backed FormData parts — relevant to any future row that inspects binary uploads on webkit.
- **Pre-existing working-tree noise left untouched:** `watchbugus-fun/` (unrelated untracked directory) and `schema/report.schema.json` (line-ending-only stat diff) were present before this plan and are not part of it.

## Known Stubs

None. The three seams 02-01 recorded (enterFlow body, `onRetry` semantics, undriven panel transitions) are all closed by Tasks 1–2, and `.planning/WINDOWS.md` entries #3 and #4 were marked `fixed` at closeout (ledger now: 2 open, both phase-01 deferrals owned by other plans). No placeholder text, mock data, hardcoded empty values or skipped tests exist anywhere in this plan's diff; the P2-D-07 pattern catalog and the `luhnValid()` helper are plan-designated 02-04 scope (the plan says so explicitly), not stubs left behind.

## User Setup Required

None — no new environment variables, no external service, no dependency install (zero new packages, per PRF-04). The e2e rows read the existing `WATCHBUG_PROJECT_KEY` from `.env`; the compose stack must be up for `npm run verify` (its `globalSetup` fails loud if not).

## Next Phase Readiness

- **02-03 (capture adapters) starts green:** the `CaptureSource` port, the two-tier stub seam and the whole pipeline order are in place; CAP-01/04/05 rows extend the same harness.
- **02-04 (redaction catalog) has its ordering guaranteed:** T1 runs before every encode today; the artifact-level CA-02 rows decode the very bytes this plan's single sink produces.
- **Budget headroom:** core is 7.6 KB gz of 45 KB — ~37 KB left for Phase 3–7 (annotator is the 25 KB lazy lane).
- **Carried forward:** `sdk-single-encode-sink` now PASSes (02-01 had it SKIP); the A-12/M-2 per-lane worst-case note (84 > 80 KB) remains Phase 7's to resolve.

## Self-Check: PASSED

- All 13 changed files exist on disk (`git diff --name-only 8fbbec0..HEAD` matched against `[ -f ]`); `e2e/fixtures/hostile-host.html` created, none deleted (post-commit deletion check empty ×4).
- All 4 commits exist: `032a66c`, `9e53db8`, `e7cb5f2`, `76247b4` (`git log --oneline` FOUND ×4); `commits: 4` measured from the ledger (`8fbbec0..HEAD` → `git rev-list --count` = 4), not narrated.
- Plan `<verification>` re-run in this closeout: `npm run build` exit 0, `check:size` PASSED, `gate.mjs` 3 PASS / 0 FAIL, `npm run verify -- e2e/sdk.spec.ts` **63 passed** across chromium + firefox + webkit.
- Every `<acceptance_criteria>` re-checked against the source (see Verification Results).
- `.planning/WINDOWS.md` stubs #3/#4 marked `fixed`; no new stubs, skipped tests or unrun verifies to record.

---
*Phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction*
*Completed: 2026-10-24*
