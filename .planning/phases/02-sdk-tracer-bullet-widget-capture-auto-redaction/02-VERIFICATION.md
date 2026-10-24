---
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
verified: 2026-10-24T16:52:37Z
status: human_needed
score: 38/38 must-haves verified
covered_files:
  - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-01-PLAN.md
  - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-01-SUMMARY.md
  - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-02-PLAN.md
  - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-02-SUMMARY.md
  - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-03-PLAN.md
  - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-03-SUMMARY.md
  - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-04-PLAN.md
  - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-04-SUMMARY.md
  - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-05-PLAN.md
  - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-05-SUMMARY.md
  - packages/sdk/src/index.ts
  - packages/sdk/src/strings.ts
  - packages/sdk/src/widget/host.ts
  - packages/sdk/src/widget/launcher.ts
  - packages/sdk/src/widget/status-panel.ts
  - packages/sdk/scripts/build.mjs
  - packages/sdk/src/capture/capture-source.ts
  - packages/sdk/src/capture/pipeline.ts
  - packages/sdk/src/redact/redactor.ts
  - packages/sdk/src/redact/geometry.ts
  - packages/sdk/src/redact/patterns.ts
  - packages/sdk/src/image/encode.ts
  - packages/sdk/src/transport/lane1.ts
  - e2e/sdk.spec.ts
  - e2e/helpers/host-fixtures.ts
  - e2e/helpers/capture-stubs.ts
  - e2e/fixtures/hostile-host.html
  - scripts/gate.mjs
  - playwright.config.ts
  - documentation/resolution-record.md
covered_digest: "v2:sha256:2f80f156bd52637bec034b049c106980cd2f89124fcb1350683ddc9a70f744a0"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Run one real (unstubbed) capture in chromium and firefox: serve any host page over http://localhost or HTTPS, click the Watchbug launcher, and complete the OS screen-share picker"
    expected: "The OS picker appears; a real tab frame is captured; the host page is hidden during the grab; the report returns 201 and renders in the panel; no widget chrome pixels in the stored screenshot"
    why_human: "Every e2e capture row runs against the two-tier stub (e2e/helpers/capture-stubs.ts:38 - chromium/firefox fake getDisplayMedia, webkit ImageData seam). No automated test can drive the real OS permission picker, so the real getDisplayMedia({video:true, preferCurrentTab:true}) path (packages/sdk/src/capture/capture-source.ts:133) is source-verified and stub-exercised only"
  - test: "Visual/interaction pass over the launcher and status panel against 02-UI-SPEC.md: idle, Capturing..., Sending..., Retrying (n of 3), Report sent, and each terminal failure headline/hint/action pair, plus the 12x12 spinner, 240-char truncation and 320 px panel"
    expected: "Geometry, copy, roles (status/alert), reduced-motion branch and action labels match the UI-SPEC contract on all three engines"
    why_human: "Presence and state-sequence are asserted (e2e/sdk.spec.ts:407-418, :868-869, :904-930; packages/sdk/src/widget/status-panel.ts:139-142, :302, :313), but visual appearance and motion are not machine-checkable; 02-UI-REVIEW.md scored 22/24 PASS with 2 MAJOR findings (F-01, F-08) still open"
  - test: "Decide the disposition of review finding CR-03 (open, critical): redaction DOM scan covers only the top document's light DOM - shadow roots and same-origin iframes are never scanned"
    expected: "Owner either (a) accepts the bounded guarantee 'PRV-01/02/03 hold for top-document light-DOM content' for v1 and registers the scope in 02-SECURITY.md / integration docs, or (b) schedules a recursive per-document scan in a later phase"
    why_human: "Scope-acceptance decision, not a code check. 02-REVIEW.md:186-210 states the hole; packages/sdk/src/redact/redactor.ts:85, :91, :103 use doc.querySelectorAll/TreeWalker, which pierce neither shadow roots nor iframes; 02-SECURITY.md accepted-risk AR-01 covers only CROSS-origin iframe pixels, so this surface is currently unowned and threats_open: 0 does not account for it"
  - test: "Decide the disposition of UI finding F-08: no lang attribute on widget content (`all: initial` clears inherited lang; setAttribute('lang') has 0 matches under packages/sdk/src - confirmed by grep)"
    expected: "Either a one-line lang='en' fix lands (Phase 3 will need lang switching anyway) or the finding is explicitly deferred to Phase 3 with the widget copy"
    why_human: "Accessibility/priority decision outside the 18 Phase-2 requirement IDs; recorded as MAJOR in 02-UI-REVIEW.md:92"
  - test: "Close or accept WINDOWS.md item #5 (kind: unmet-truth, phase 02, open): REQUIREMENTS.md wording still claims webkit exercises the WebP->PNG fallback premise"
    expected: "Owner edits the release-criteria wording to match A-14 (documentation/resolution-record.md), or records the wording as intentionally kept"
    why_human: "The plan was explicitly not authorised to edit REQUIREMENTS/R-12 wording (02-05-SUMMARY.md Known Stubs); only the owner can make the edit"
---

# Phase 02: SDK Tracer Bullet — Widget, Capture & Auto-Redaction Verification Report

**Phase Goal:** "An end user can open the Watchbug widget on any host page, capture the current tab with sensitive data destructively masked before anything leaves the browser, and file a report that renders in the panel - the first real vertical slice."
**Verified:** 2026-10-24T16:52:37Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior `02-VERIFICATION.md` on disk)
**Mode:** MVP (`Mode: mvp`, ROADMAP.md Phase 2) — judged against the MVP-scoped `must_haves` of the five plans, with the five ROADMAP Success Criteria carried as non-negotiable contract rows.

## Evidence base (commands run by the verifier at HEAD `7012d3a`)

| Check | Command | Result |
| --- | --- | --- |
| Full one-suite run (R-12) | `npm run verify` (compose stack up, `/api/health` → `{"status":"ok"}` on :8080) | **297 passed, 0 failed, 0 flaky (8.2 m)** — chromium + firefox + webkit |
| Size gate (PRF-01) | `npm run check:size` | **PASSED** — core 8.5 / 45 KB gz, lazy 0.3/25, adapter 0.3/14, runtime 9.2/80; `watchbug.e2e.*` outside the gated LANES |
| Static architecture gate | `node scripts/gate.mjs` | **3 passed, 0 failed, 0 skipped** (`sdk-runtime-deps`, `sdk-no-host-storage`, `sdk-single-encode-sink`) |
| Working tree | `git status --porcelain` | clean except `schema/report.schema.json` LF/CRLF noise (`git diff` = empty content diff) |

Live command output, not SUMMARY narration, is the evidence for every `check:size` / `gate.mjs` claim below. SUMMARY "Self-Check: PASSED" lines were treated as claims and re-derived from source + the run above.

## Goal Achievement — User Flow (MVP)

| # | Story step | Expected | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | End user opens the widget on any host page | one async `<script>` boots `window.Watchbug`; `init()` mounts a 48×48 launcher in a closed shadow root | `e2e/sdk.spec.ts:160` (INT-01), `:198`; `packages/sdk/src/index.ts:113-146`; `packages/sdk/scripts/build.mjs:55` (`globalName: 'Watchbug'`); row green ×3 engines | ✓ |
| 2 | …even on a hostile host page | hostile CSS matrix cannot hide/restyle/stack over it; zero style/class/var/global leakage | `e2e/sdk.spec.ts:1087-1135` (5 variants + `CA-04` control row), `:1137`, `:1203-1269`; `packages/sdk/src/widget/host.ts:34-45,136,185` | ✓ |
| 3 | captures the current tab | one gesture → capture seam → non-blank `ImageData`; real 201 | `e2e/sdk.spec.ts:425` (CAP-01); `packages/sdk/src/capture/capture-source.ts:133,162` (`preferCurrentTab`, `displaySurface` policy) | ✓ (real OS picker → human item 1) |
| 4 | …widget never in its own capture | `hideSync()` before capture, `beforeRead()` invariant, zero accent pixels in decoded bytes | `e2e/sdk.spec.ts:470` (CAP-04); `packages/sdk/src/capture/pipeline.ts:184-206` | ✓ |
| 5 | sensitive data destructively masked before anything leaves the browser | flat opaque fill on `ImageData` **before** the single encode sink; fail-closed | `packages/sdk/src/capture/pipeline.ts:216-247` (redact → encode → send, try/catch returns before encode); `packages/sdk/src/redact/redactor.ts:152-155` (`MASK_ALPHA_OPAQUE`=255); artifact rows `e2e/sdk.spec.ts:1641,1597,1665,1686,1707,1744,1772` decode the outgoing bytes | ✓ **bounded** — top-document light DOM only (CR-03, human item 3) |
| 6 | files a report that renders in the panel | gesture → POST → 201 → row visible through nginx | `e2e/sdk.spec.ts:278-345` (INT-02: intercepts wire shape, asserts 201, then `page.goto(panel)` and asserts the title row is visible) | ✓ |

## Goal Achievement — Observable Truths

**Score: 38/38 truths verified (5 ROADMAP Success Criteria + 33 plan `must_haves` truths). behavior_unverified: 0.**

### ROADMAP Success Criteria (contract)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| SC-1 | One async script tag or ESM import + `Watchbug.init({projectKey,…})` yields a working floating widget | ✓ VERIFIED | `e2e/sdk.spec.ts:160`, `:198`, `:347` (ESM boots, zero added `window` props) — green ×3 engines; `packages/sdk/src/index.ts:89-104` option validation |
| SC-2 | Widget opens under hostile CSS, renders above host content, leaks nothing (exactly one global, no prototype patching) | ✓ VERIFIED | `e2e/sdk.spec.ts:1087-1135`, `:1137`, `:1203`, `:1225`, `:1247`, `:1269`, `:244` (WDG-04 window+prototype snapshot delta = 1) |
| SC-3 | Capture via browser prompt; widget never in it; ≤16 MP / ≤2 MB; no blank on HiDPI | ✓ VERIFIED | `e2e/sdk.spec.ts:425,470,545,578,615,646`; `packages/contracts/src/constants.ts:21-25` (`MAX_ENCODED_IMAGE_BYTES`, `MAX_IMAGE_PIXELS`, `MAX_IMAGE_DIM`); `packages/sdk/src/image/encode.ts:30-32,128-143` (DPR clamp, downscale ladder) |
| SC-4 | Password / credential patterns / `data-watchbug-sensitive` flat-filled in the capture the end user sees **and** in every encoded byte that leaves the browser | ✓ VERIFIED (bounded) | Artifact-level rows decode the outgoing bytes and assert zero original pixels in the rect **and** its 1-px ring: `e2e/sdk.spec.ts:1641` (PRV-01), `:1597/:1665/:1686/:1707/:1744` (PRV-02), `:1772` (PRV-03), `:1856-1889` (H-1 DPR 1/1.25/2/3). **Bounded scope:** top-document light DOM only (CR-03). **And:** the "capture the end user *sees*" clause has no surface yet — Phase 2 sends directly, review-before-send is `PRV-07` → Phase 3 (`REQUIREMENTS.md:243`) |
| SC-5 | Outgoing report has no host cookies/storage/auth headers, path-only URL; core ≤45 KB gz; zero runtime npm deps | ✓ VERIFIED | `e2e/sdk.spec.ts:2030` (PRV-05 sentinel scan of every header + every request byte), `:2207` (PRV-06), `:2341` (zero third-party); `lane1.ts:148` `credentials:'omit'`, `:151` `referrerPolicy:'no-referrer'`, `:95` `loc.pathname`; `check:size` core 8.5/45; `gate.mjs sdk-runtime-deps` PASS |

### 02-01 must_haves (3)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P1-T1 | Single `<script src async>` boots widget, IIFE global is `window.Watchbug` | ✓ VERIFIED | `e2e/sdk.spec.ts:160` + `:198` green ×3 engines; `build.mjs:55` `globalName:'Watchbug'`, `:69` |
| P1-T2 | Global snapshot differs by exactly one property; prototypes untouched; IIFE +1 / ESM +0 | ✓ VERIFIED | `e2e/sdk.spec.ts:244` (WDG-04), `:347` (INT-05) green ×3 engines |
| P1-T3 | Open-mode e2e artifacts `watchbug.e2e.{js,mjs}` emitted under distinct names; `check:size` gates production names only | ✓ VERIFIED | `dist/watchbug.e2e.js` (23 335 B) + `.e2e.mjs` present; `build.mjs:83-97` (`SHADOW_MODE:'open'`); `scripts/check-size.mjs:32` LANES = `watchbug.js` only; `npm run check:size` → PASSED |

### 02-02 must_haves (12)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P2-T1 | One launcher gesture drives flow to a report landing in the panel (201 + row) | ✓ VERIFIED | `e2e/sdk.spec.ts:278-345` — wire shape, 201, panel row visible (Level-4 data flow confirmed end-to-end) |
| P2-T2 | ESM build boots same widget/flow, adds zero `window` properties | ✓ VERIFIED | `e2e/sdk.spec.ts:347` green ×3 engines |
| P2-T3 | Real 48×48 `<button>` in shadow root; click starts flow; disabled while in flight | ✓ VERIFIED | `e2e/sdk.spec.ts:198`, `:407-414` (`launcherDisabled===true` during held `Sending…`); `launcher.ts:28-29,115,122-127` (no `await` before flow entry — transient activation preserved) |
| P2-T4 | Hostile CSS matrix cannot break the widget, with a control element proving each rule applied (CA-04 non-vacuous) | ✓ VERIFIED | `e2e/sdk.spec.ts:1087` ×4 variants + `:1103` closed-bundle row + `:1119` control row — all green ×3 engines |
| P2-T5 | After init + full flow the host gained zero styles/classes/custom properties | ✓ VERIFIED | `e2e/sdk.spec.ts:1137` (head style/link delta 0, `--wb-` scan, widget classes outside shadow root) |
| P2-T6 | Widget renders above hostile max-z-index modal; flow still completes | ✓ VERIFIED | `e2e/sdk.spec.ts:1203` |
| P2-T7 | Hostile fixed element at widget coords neither merges with nor captures its hit target; host `pointer-events:none` passes host clicks | ✓ VERIFIED | `e2e/sdk.spec.ts:1225`; `host.ts:45` `pointer-events: none !important` |
| P2-T8 | Empty host page → launcher at `right/bottom: 24px`, click starts flow | ✓ VERIFIED | `e2e/sdk.spec.ts:1247`; `host.ts:37-38` |
| P2-T9 | z-index tie resolved by DOM order; host re-appended after `documentElement` replacement | ✓ VERIFIED | `e2e/sdk.spec.ts:1269`; `host.ts:179,185` (MutationObserver re-append) |
| P2-T10 | In-flight copy `Capturing… → Sending… → Retrying (n of 3)` with 12×12 spinner; launcher disabled while panel open | ✓ VERIFIED | Headline sequence asserted `e2e/sdk.spec.ts:868-869` and `:845`; spinner `.spinner{width:12px;height:12px}` `status-panel.ts:139-142`, shown for in-flight `:302`; disabled launcher `:412`. Spinner *appearance* folded into human item 2 |
| P2-T11 | Every terminal failure renders documented headline + hint + `Try again`/`Dismiss`; blank never sent silently | ✓ VERIFIED | `e2e/sdk.spec.ts:716-717` (hints), `:740-747`, `:784-816`, `:886-895` (`role=alert`, Dismiss visible); blank abort before any request `:727`, `:751` |
| P2-T12 | *(backstop)* Long server reason truncated to 240 chars with ellipsis in 320 px panel, asserted by a forced long reason | ✓ VERIFIED | Wired held-out test `e2e/sdk.spec.ts:904` passed on all three engines; `MAX_REASON_CHARS`/truncation in `status-panel.ts`; `lane1.ts:104-115` surfaces the server message |

### 02-03 must_haves (6)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P3-T1 | One gesture drives the real capture seam (stubbed per engine) to a raw `ImageData` frame | ✓ VERIFIED | `e2e/sdk.spec.ts:425` (chromium+firefox media tier `capture.captureStream()`, webkit seam tier); tier map `e2e/helpers/capture-stubs.ts:38`; real path `capture-source.ts:133-162`. Real OS picker → human item 1 |
| P3-T2 | Capture never contains the widget: hidden before prompt, restored after grab, pipeline fails loudly if not hidden, decoded image widget-free | ✓ VERIFIED | `pipeline.ts:184-206` (`hideSync` → `beforeRead` assertion → `restore` in `finally`); `e2e/sdk.spec.ts:470` (inline `display:none` observation + zero accent pixels) |
| P3-T3 | Clamps: ≤16 MP, ≤2 MB encoded (target ≤800 KB, q0.8→q0.6→q0.5→0.75× ladder), DPR ≤2, HiDPI DSF2 non-blank | ✓ VERIFIED | `e2e/sdk.spec.ts:545,578,615,646`; `constants.ts:21-25`; `encode.ts:30-32,128-143,175-190` |
| P3-T4 | Blank/uniform or beyond-cap frame aborts before any request with the loud blank state | ✓ VERIFIED | `pipeline.ts:56-87,210-214`; `e2e/sdk.spec.ts:727,751` |
| P3-T5 | Non-tab surface (window/screen `displaySurface`) refused loudly, nothing sent | ✓ VERIFIED | `capture-source.ts:148-173`; `e2e/sdk.spec.ts:773` |
| P3-T6 | Silent WebP→PNG fallback detected by `blob.type` sniff; PNG part accepted with 201 | ✓ VERIFIED | `encode.ts:50,100,182`; `lane1.ts:100-102`; `e2e/sdk.spec.ts:671` (forced-PNG stub → `.png`/`image/png` → 201). *No engine in the suite produces the fallback naturally (A-14, playwright.config.ts:6-15) — see WINDOWS.md #5 / human item 5* |

**Plan prohibition (02-03):** "never a 'send anyway' fallback" — `status: resolved`, `verification: judgment`. Verdict: **held** — `pipeline.ts:225-230` returns before encode/send on redaction error, `capture-source.ts:148-173` throws on non-tab surface, `pipeline.ts:210-214` on blank; e2e `fail-closed` row (`sdk.spec.ts:1945`) asserts zero POST attempts. No code path sends an unredacted or unverifiable frame.

### 02-04 must_haves (6)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P4-T1 | `input[type=password]` values flat-filled (α=255) before encode; decoded bytes carry no original pixels in rect or 1-px ring | ✓ VERIFIED **(bounded: top-document light DOM)** | `e2e/sdk.spec.ts:1641` (artifact decode, passes ×3 engines); `redactor.ts:85,145-159`; `constants.ts:62` `MASK_ALPHA_OPAQUE=255` |
| P4-T2 | JWT / bearer / `key=`-assignments / Luhn-valid card patterns mask whole text node in decoded bytes | ✓ VERIFIED **(bounded)** | `e2e/sdk.spec.ts:1597,1665,1686,1707` + negative control `:1620` (lookalike survives) and `:1707` (Luhn-invalid survives); `patterns.ts:118-144` |
| P4-T3 | `data-watchbug-sensitive` masked at full element rect, outward-rounded, in decoded bytes | ✓ VERIFIED **(bounded)** | `e2e/sdk.spec.ts:1772`; `redactor.ts:35,85-87` |
| P4-T4 | Bitmap/device-pixel geometry from the first mask: DPR 1/1.25/2/3 and non-integer zoom leak zero edge characters | ✓ VERIFIED | `e2e/sdk.spec.ts:1856,1867,1878,1889`; `geometry.ts` floor-origin/ceil-extent (`Math.floor`/`Math.ceil`) |
| P4-T5 | On match, whole containing element/text node masked (over-masking preferred) | ✓ VERIFIED | `e2e/sdk.spec.ts:1900` (P2-D-08: unmatched substring pixels gone too); `redactor.ts:99-128` (union of `range.getClientRects()`) |
| P4-T6 | Redaction-pass error sends nothing, lands in loud failure — never falls open | ✓ VERIFIED | `pipeline.ts:216-230`; `e2e/sdk.spec.ts:1945` (zero POST attempts) |

**Plan prohibition (02-04):** "only automatic primitive is flat opaque pixel destruction (α 255) burned in before encode — no blur/overlay/semi-transparent fill". Verdict: **held** — `redactor.ts:149-158` writes RGB 0/0/0 + `MASK_ALPHA_OPAQUE` directly into `ImageData`; grep over `packages/sdk/src` finds no `blur(`, no overlay element, no CSS masking; `gate.mjs sdk-single-encode-sink` PASS (one `toBlob` at `encode.ts:75`).

**CR-03 bounded scope (stated, not hidden):** all three detection routes are `doc.querySelectorAll(...)` + `doc.createTreeWalker(doc.documentElement,…)` (`redactor.ts:85,91,103`) — neither pierces a shadow root nor reaches an `iframe`'s document. Therefore PRV-01/PRV-02/PRV-03 as verified here mean: **for the top document's light DOM, secrets are destructively masked before encode; secrets inside host shadow roots (open or closed) and inside same-origin iframes are NOT scanned, so they ride along in the captured pixels.** This is `02-REVIEW.md` CR-03, disposition `open` by explicit user decision (`02-REVIEW-DISPOSITION.md`). It is *not* covered by accepted risk AR-01 (`02-SECURITY.md:72`), which is scoped to cross-origin iframe pixels only, and `02-SECURITY.md` does not register this surface (`threats_open: 0` therefore overstates coverage). Escalated as human item 3 rather than silently passed or silently failed.

### 02-05 must_haves (6)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P5-T1 | Sentinels in host cookies/storage/auth header never reach the report; only `X-Project-Key` + `Idempotency-Key`; `gate.mjs sdk-no-host-storage` passes | ✓ VERIFIED | `e2e/sdk.spec.ts:2030` (zero sentinel hits across every header and every request byte, ×3 engines); `lane1.ts:141-152` (exactly those two headers + `credentials:'omit'` + `no-referrer`); `node scripts/gate.mjs` → PASS, 15 SDK files clean |
| P5-T2 | `meta.url` path-only: query/fragment stripped by SDK (and re-stripped by contract schema) | ✓ VERIFIED | `lane1.ts:95` `loc.pathname.slice(0, MAX_URL_PATH_CHARS)`; `e2e/sdk.spec.ts:2207` (asserts no `?`/`#`/origin in raw bytes); server-side `R-08/S-5` row `e2e/hostile.spec.ts:1150` |
| P5-T3 | `check:size` proves core ≤45 KB gz with the full widget landed; e2e artifact never gated as production | ✓ VERIFIED | `npm run check:size` → PASSED, core **8.5/45 KB gz**; `check-size.mjs:32` LANES keyed on production filenames; `dist/watchbug.e2e.*` present and excluded |
| P5-T4 | Zero runtime npm deps; `@watchbug/contracts` types/constants-only (Zod erased) | ✓ VERIFIED | `node scripts/gate.mjs sdk-runtime-deps` PASS ("runtime blocks contain only: @watchbug/contracts"); `index.ts:13-15` + `import type` convention; bundle contains no Zod (8.5 KB core) |
| P5-T5 | `title` = `document.title` truncated to `MAX_TITLE_CHARS` (200), `type:'bug'`, meta built by explicit mapping | ✓ VERIFIED | `lane1.ts:85-97` (code-point slice, literal `type:'bug'`, no spread); `e2e/sdk.spec.ts:2294` (300-char title → exactly 200 code points, `type:'bug'`) |
| P5-T6 | Zero third-party network requests (only configured API base) | ✓ VERIFIED | `e2e/sdk.spec.ts:2341` (request listener over a full flow: only API base); no fonts/CDN/analytics in `packages/sdk/src` |

**Plan prohibition (02-05):** "privacy core must never be moved out of the injected core lane to preserve the size budget". Verdict: **held** — `capture/pipeline/redact/encode/transport` are all reachable only from `src/index.ts` (the core entry); no `import()`/dynamic chunk reaches them; `check:size` core 8.5 KB contains the whole flow (the only lazy lane is the Phase-3 annotator, 0.3 KB stub chunk).

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `SHADOW_MODE` build define | `attachShadow({mode})` → open-root registry Playwright reads | `build.mjs:44` (prod `closed`), `:89` (e2e `open`); `host.ts:136,186`; `capture-source.ts:53` seam gated on `open` | ✓ WIRED | e2e rows run against `watchbug.e2e.js`; production bundle closed (`sdk.spec.ts:160`) |
| Host inline `!important` list | `check:size` filename-gated tiers | `host.ts:34-45` ↔ `check-size.mjs:32` | ✓ WIRED | e2e artifact never the gated `watchbug.js` |
| Launcher gesture handler | injected flow entry → `getDisplayMedia` transient activation | `launcher.ts:122-127` (`hide()` then `onActivate()` synchronously) → `index.ts:122` `flowRef.current.start()` → `pipeline.ts:180-200` (`capture.capture()` with no prior `await`) | ✓ WIRED | INT-02/CAP-01 rows pass on all engines |
| `init({projectKey,endpoint})` | `X-Project-Key` on `POST /api/incidents` → Phase-1 `WATCHBUG_PROJECT_KEY` | `index.ts:103,134-154` → `lane1.ts:144` | ✓ WIRED | INT-02 asserts `x-project-key === projectKey()` (`sdk.spec.ts:329`) against the seeded key |
| Capture seam `ImageData` | destructive fill → single encode sink (no encoded byte before masking) | `A-05` port type → `pipeline.ts:226` → `:234` → `lane1` | ✓ WIRED | ordering enforced in code; `gate.mjs sdk-single-encode-sink` PASS |
| Text-node `range.getClientRects()` | `toBitmapRect()` scale mapping | `fillRects` `redactor.ts:141-146` | ✓ WIRED | H-1 rows pass at DPR 1/1.25/2/3 |
| Pattern catalog | Phase-4 C-5 scrubber families (same shapes, same Luhn rule) | `patterns.ts:4,118-144` documents shape-for-shape alignment | ✓ WIRED (contract) | cross-phase: no C-5 code exists yet (Phase 4) — alignment is documented, not yet testable |
| `MASK_ALPHA_OPAQUE` import | fill loop | `redactor.ts:30,155` | ✓ WIRED | value 255 (`constants.ts:62`) |
| `gate.mjs sdk-no-host-storage` | PRV-05 sentinel e2e row (static + dynamic halves of SEC-03) | `gate.mjs` rule + `sdk.spec.ts:2030` | ✓ WIRED | both PASS |
| `check:size` filename tiers | open-mode `watchbug.e2e.*` names | `check-size.mjs:32` + `build.mjs:83` | ✓ WIRED | PRF-01 cannot be satisfied by renaming |
| `packages/sdk/package.json` runtime block | `sdk-runtime-deps` rule → `import type`-only contracts imports | `gate.mjs` + `index.ts` | ✓ WIRED | PASS |
| `Idempotency-Key` minted once | same key across retries → Phase-1 unique index | `pipeline.ts:127-133,246` (minted per payload), `lane1.ts:194-208` (reuses the same object) | ✓ WIRED | `sdk.spec.ts:824` asserts same key + same bytes on retry |
| `buildMeta()` mapping | `reportSchema` `z.strictObject` | `lane1.ts:85-97` → `packages/contracts/src/schema.ts` | ✓ WIRED | `sdk.spec.ts:2294/:2207` run `reportSchema.parse` |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
| --- | --- | --- | --- | --- |
| Launcher → panel states | `StatusView` from `createCaptureFlow.onView` | real capture/encode/send outcomes | yes — success, retry, rejection and failure states all driven by live results | ✓ FLOWING |
| Report meta | `buildMeta(document, location)` | host `document.title` + `location.pathname` | yes — asserted against values the test set (`sdk.spec.ts:284-286,334-335`) | ✓ FLOWING |
| Image part | `encodeLadder(imageData)` | real pixels from the capture seam | yes — decoded back and pixel-asserted | ✓ FLOWING |
| Panel row (goal clause) | `GET /api/incidents` list | PostgreSQL via compose stack | yes — INT-02 reads the row through nginx after the 201 (`sdk.spec.ts:342-344`) | ✓ FLOWING |
| Mask rects | `collectMaskRects(document)` at redact time | live DOM at click time | yes — negative controls (Luhn-invalid, JWT lookalike) prove discrimination, not a static list | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full one-suite run (all CA/requirement rows, 3 engines) | `npm run verify` | **297 passed / 0 failed (8.2 m)** | ✓ PASS |
| Size budget with landed widget | `npm run check:size` | **PASSED** (core 8.5/45 KB gz) | ✓ PASS |
| Static architecture gates | `node scripts/gate.mjs` | **3 passed, 0 failed, 0 skipped** | ✓ PASS |
| e2e artifacts emitted | `ls packages/sdk/dist` | `watchbug.js`, `.mjs`, `watchbug.e2e.js`, `.mjs`, annotator + dom-serialize pairs present | ✓ PASS |
| Requirement-row coverage exists (enumeration, not execution) | count of `test(` titles in `e2e/sdk.spec.ts` + the run log | 47 `test(` definitions → **50 rows per engine, 150 across the three engines** (`50 [chromium|firefox|webkit] › e2e\sdk.spec.ts` each; VALIDATION.md's "49 rows" predates one later row); every one of the 18 IDs has ≥1 named row (PRF-01/PRF-04 are gate rows by design) | ✓ PASS |
| Prior-phase regression (01-VERIFICATION 40/40 `passed`) | same `npm run verify` run | `ingest.spec.ts`, `hostile.spec.ts`, `deploy.spec.ts`, `read-surface.spec.ts` rows all green (e.g. `ok 239-244`, `ok 115-119`) | ✓ PASS |

**Probe execution (Step 7c):** no `scripts/*/tests/probe-*.sh` files exist and neither PLAN nor SUMMARY declares probe scripts for this phase — SKIPPED (not applicable). The equivalent runnable checks (`check:size`, `gate.mjs`, `verify`) were executed by the verifier directly, results above.

## Requirements Coverage (all 18 IDs)

Plan frontmatter `requirements:` union = `{INT-01, WDG-04} ∪ {INT-02, INT-05, WDG-01, WDG-02, WDG-03, WDG-05} ∪ {CAP-01, CAP-04, CAP-05} ∪ {PRV-01, PRV-02, PRV-03} ∪ {PRV-05, PRV-06, PRF-01, PRF-04}` = **exactly the 18 phase IDs**. REQUIREMENTS.md maps exactly the same 18 IDs to Phase 2 (`REQUIREMENTS.md:215-283`) — **0 orphaned requirements, 0 unplanned IDs**.

| Req | Plan | Description (REQUIREMENTS.md) | Status | Evidence |
| --- | --- | --- | --- | --- |
| INT-01 | 02-01 | single async script tag, no build step | ✓ SATISFIED | `e2e/sdk.spec.ts:160,198`; `build.mjs:55` |
| INT-02 | 02-02 | `init()` with public key/options → report | ✓ SATISFIED | `e2e/sdk.spec.ts:278-345`; `index.ts:113-146` |
| INT-05 | 02-02 | consume as ES module instead of a global | ✓ SATISFIED | `e2e/sdk.spec.ts:347`; ESM lane `build.mjs:56` |
| WDG-01 | 02-02 | open widget from floating launcher | ✓ SATISFIED | `e2e/sdk.spec.ts:198,391`; `launcher.ts:115-130` |
| WDG-02 | 02-02 | hostile CSS cannot hide/restyle/break | ✓ SATISFIED | `e2e/sdk.spec.ts:1087-1135` (5 rows + CA-04 controls) |
| WDG-03 | 02-02 | never leaks styles/classes/CSS vars | ✓ SATISFIED | `e2e/sdk.spec.ts:1137` |
| WDG-04 | 02-01 | exactly one global, no native prototype modified | ✓ SATISFIED | `e2e/sdk.spec.ts:244` |
| WDG-05 | 02-02 | renders above all host content | ✓ SATISFIED | `e2e/sdk.spec.ts:1203,1225,1247,1269`; `host.ts:36` |
| CAP-01 | 02-03 | capture via browser capture prompt | ✓ SATISFIED (bounded) | `e2e/sdk.spec.ts:425,796`; real OS picker = human item 1 |
| CAP-04 | 02-03 | capture never contains the widget | ✓ SATISFIED | `e2e/sdk.spec.ts:470`; `pipeline.ts:184-206` |
| CAP-05 | 02-03 | ≤16 MP / ≤2 MB without blanking on HiDPI | ✓ SATISFIED | `e2e/sdk.spec.ts:545,578,615,646` |
| PRV-01 | 02-04 | password values excluded automatically | ✓ SATISFIED (bounded) | `e2e/sdk.spec.ts:1641`; scope = top-document light DOM (CR-03) |
| PRV-02 | 02-04 | credential/token/card patterns redacted | ✓ SATISFIED (bounded) | `e2e/sdk.spec.ts:1597,1665,1686,1707,1744`; `patterns.ts:76-114` |
| PRV-03 | 02-04 | `data-watchbug-sensitive` redacted | ✓ SATISFIED (bounded) | `e2e/sdk.spec.ts:1772`; scope = top-document light DOM (CR-03) |
| PRV-05 | 02-05 | never reads/transmits host cookies/storage/auth | ✓ SATISFIED | `e2e/sdk.spec.ts:2030` + `gate.mjs sdk-no-host-storage` PASS |
| PRV-06 | 02-05 | query strings/fragments stripped | ✓ SATISFIED | `lane1.ts:95`; `e2e/sdk.spec.ts:2207` |
| PRF-01 | 02-05 | injected script ≤45 KB gz, build fails otherwise | ✓ SATISFIED | `npm run check:size` PASSED (8.5/45); `check-size.mjs` exits non-zero on breach |
| PRF-04 | 02-05 | zero runtime npm dependencies | ✓ SATISFIED | `gate.mjs sdk-runtime-deps` PASS |

**Explicitly out of this phase's requirement set (not gaps here):** `WDG-06`/`RNF-03` (EN+ES widget copy) → Phase 3 (`REQUIREMENTS.md:225`) — this is UI-F-01; `CAP-03`, `CAP-02`, `PRV-04`, `PRV-07` (review-before-send — the "capture the end user sees" clause of SC-4) → Phase 3 (`REQUIREMENTS.md:228,240,243`); `PRF-02/03` → later (annotator chunk); `INT-03/04` → Phase 4.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | debt markers (`TBD`/`FIXME`/`XXX`) across all 15 phase-touched implementation files + 4 e2e files: **0 matches** | ✅ none | none |
| `packages/sdk/src/strings.ts` | 6,33,34 | "placeholder" matches | ℹ️ Info | false positive — `t()` `{placeholder}` substitution, not a stub |
| `packages/sdk/src/{capture,redact,transport}` | various | `return null` | ✅ none | guarded early-returns (`capture-source.ts:53` seam gate, `geometry.ts:47` zero-area rect, `lane1.ts:127` 201 without JSON body), not empty implementations |
| `schema/report.schema.json` | — | uncommitted working-tree change | 📋 Advisory | `git diff` content-empty (LF→CRLF only); regenerated artifact, no behavioural delta |

No stubs, no placeholder copy, no `console.log`-only handlers, no hardcoded empty data in any phase-touched render path. `02-01-SUMMARY`'s single "Known Stub" (`index.ts:137` `onRetry` re-entrancy) is confirmed closed: `index.ts:124-131` wires `onRetry → flowRef.current.retry()` and `e2e/sdk.spec.ts:824` exercises it.

## Review Findings Cross-Reference (02-REVIEW.md / 02-REVIEW-DISPOSITION.md)

| Finding | Severity | Disposition | Verifier confirmation in source |
| --- | --- | --- | --- |
| CR-01 referrer leak | critical | fixed (c2d7a50) | ✓ confirmed — `packages/sdk/src/transport/lane1.ts:151` `referrerPolicy: 'no-referrer'` |
| CR-02 glued-card masking hole | critical | fixed (7c9b299) | ✓ confirmed — `packages/sdk/src/redact/patterns.ts:104-114` `luhnValidCardRun` validates whole digit groups **and** contiguous group joins; e2e row `sdk.spec.ts:1744` ("two Luhn-valid cards glued in one text node mask the whole node") passes ×3 engines |
| CR-03 scanner stops at top-document light DOM | critical | **open** (user decision) | ✓ confirmed open — `redactor.ts:85,91,103`; escalated as human item 3; PRV-01/03 reported with bounded scope; **also:** not registered in `02-SECURITY.md` (AR-01 covers cross-origin iframes only) — `threats_open: 0` overstates coverage |
| WR-01/02/03, IN-01/02/03 | warn/info | open | recorded, none contradict a phase must-have: WR-02 (ESM default endpoint = page origin) is exercised as-is by `INT-05`; IN-02 (`truncateReason` UTF-16 cut) is cosmetic and the 240-char row passes; IN-03 (byte-equality vacuous on WebKit) — chromium/firefox rows carry that assertion |

## Human Verification Required

Listed in frontmatter `human_verification` (5 items):

1. **Real OS capture prompt** (unstubbed `getDisplayMedia`) on chromium + firefox — expected: picker → real tab frame → 201 → panel row, host hidden during grab, no widget pixels. Why human: e2e replaces the picker on every engine (`e2e/helpers/capture-stubs.ts:38`).
2. **Visual/interaction conformance vs `02-UI-SPEC.md`** (states, spinner, roles, truncation, reduced motion) — machine checks cover presence and sequence only; `02-UI-REVIEW.md` = 22/24 PASS, 2 MAJOR open.
3. **CR-03 scope decision** — accept "top-document light-DOM only" for v1 and document it, or schedule the recursive per-document scan. Escalation: this qualifies the phase's core privacy promise and is currently absent from the threat register.
4. **F-08 `lang` attribute** — one-line fix vs defer to Phase 3 (not a Phase-2 requirement ID; `grep setAttribute('lang'` = 0 matches confirmed).
5. **WINDOWS.md #5 wording debt** — REQUIREMENTS release-criteria wording vs A-14; owner edit required (plan was not authorised).

## Gaps Summary

**No failed must-haves.** All 38 truths (5 roadmap SCs + 33 plan truths) are supported by substantive, wired artifacts and by live command evidence: 297/297 e2e rows across chromium+firefox+webkit, `check:size` PASSED (8.5/45 KB), `gate.mjs` 3/3 PASSED. All 18 requirement IDs are accounted for with named e2e rows or gate rows; 0 orphaned requirements; prior phase (01, 40/40 passed) shows no regression in the same run.

The phase is **not** `passed` because five human items remain — chiefly the CR-03 bounded-redaction decision (a critical finding open by explicit user decision whose scope must be accepted or scheduled, and which is not registered in `02-SECURITY.md`), the unstubbed real capture prompt, and the visual pass. Deferred-by-design items (EN+ES copy `WDG-06`/`RNF-03`, review-before-send `PRV-07`, `PRF-02/03`) are owned by later phases in the roadmap, not gaps of this one.

---

_Verified: 2026-10-24T16:52:37Z_
_Verifier: the agent (gsd-verifier) — evidence re-derived at HEAD `7012d3a`, not taken from SUMMARY claims_
