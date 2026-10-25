---
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
verified: 2026-10-25T15:10:00Z
status: passed
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
covered_digest: "v3:sha256:75b7b07f70a5d220fa366acc1911dbb09d4a44fbe7cfee3012ef21180ada60f8"
behavior_unverified: 0
overrides_applied: 0
human_verification: []
---

# Phase 02: SDK Tracer Bullet — Widget, Capture & Auto-Redaction Verification Report

**Phase Goal:** "An end user can open the Watchbug widget on any host page, capture the current tab with sensitive data destructively masked before anything leaves the browser, and file a report that renders in the panel — the first real vertical slice."
**Verified:** 2026-10-25
**Status:** passed
**Mode:** MVP (`Mode: mvp`, ROADMAP.md Phase 2) — judged against the MVP-scoped `must_haves` of the five plans, with the five ROADMAP Success Criteria carried as non-negotiable contract rows.

> **Reconciliation note.** This report was first written at `7012d3a` (297/297, `human_needed`, CR-03 open). It has been re-verified and reconciled after the code-review remediation and the UAT closure. `covered_digest` was refreshed on 2026-10-25 with `verification fingerprint` (v3) over the final covered set.

## Evidence base (commands run by the verifier at the 2026-10-25 close)

| Check | Command | Result |
| --- | --- | --- |
| Full one-suite run (R-12) | `npm run verify` (compose stack up, `/api/health` → `{"status":"ok"}` on :8080) | **315 passed, 0 failed, 0 flaky** (105 per engine) — chromium + firefox + webkit |
| Size gate (PRF-01) | `npm run check:size` | **PASSED** — core **9.3** / 45 KB gz, lazy 0.3/25, adapter 0.3/14, runtime **10.0**/80; `watchbug.e2e.*` outside the gated LANES |
| Static architecture gate | `node scripts/gate.mjs` | **3 passed, 0 failed, 0 skipped** (`sdk-runtime-deps`, `sdk-no-host-storage`, `sdk-single-encode-sink`) |
| Compose shape (INV-03) | `npm run check:compose` | exactly three services; attachments volume only in `api` |
| Slop detector | `stopthatslop check --pack ts` | `passed: true`, `finding_count: 0`, `exit 0` |
| Working tree | `git status --porcelain` | clean except `schema/report.schema.json` LF/CRLF noise (`git diff` = empty content diff) |

Live command output, not SUMMARY narration, is the evidence for every `check:size` / `gate.mjs` claim below. SUMMARY "Self-Check: PASSED" lines were treated as claims and re-derived from source + the run above.

## Goal Achievement — User Flow (MVP)

| # | Story step | Expected | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | End user opens the widget on any host page | one async `<script>` boots `window.Watchbug`; `init()` mounts a 48×48 launcher in a closed shadow root | `e2e/sdk.spec.ts:160` (INT-01), `:198`; `packages/sdk/src/index.ts:113-146`; `packages/sdk/scripts/build.mjs:55` (`globalName: 'Watchbug'`); row green ×3 engines | ✓ |
| 2 | …even on a hostile host page | hostile CSS matrix cannot hide/restyle/stack over it; zero style/class/var/global leakage | `e2e/sdk.spec.ts:1087-1135` (5 variants + `CA-04` control row), `:1137`, `:1203-1269`; `packages/sdk/src/widget/host.ts:34-45,136,185` | ✓ |
| 3 | captures the current tab | one gesture → capture seam → non-blank `ImageData`; real 201 | `e2e/sdk.spec.ts:425` (CAP-01); `packages/sdk/src/capture/capture-source.ts:133,162` (`preferCurrentTab`, `displaySurface` policy); **manual real-picker run passed in chromium + firefox (2026-10-25)** | ✓ |
| 4 | …widget never in its own capture | `hideSync()` before capture, `beforeRead()` invariant, zero accent pixels in decoded bytes | `e2e/sdk.spec.ts:470` (CAP-04); `packages/sdk/src/capture/pipeline.ts:184-206`; manual run | ✓ |
| 5 | sensitive data destructively masked before anything leaves the browser | flat opaque fill on `ImageData` **before** the single encode sink; fail-closed | `packages/sdk/src/capture/pipeline.ts:216-247`; `packages/sdk/src/redact/redactor.ts:152-155`; artifact rows `e2e/sdk.spec.ts:1641,1597,1665,1686,1707,1744,1772`; manual run showed flat black masks | ✓ |
| 6 | files a report that renders in the panel | gesture → POST → 201 → row visible through nginx | `e2e/sdk.spec.ts:278-345` (INT-02); manual run (2026-10-25) | ✓ |

## Goal Achievement — Observable Truths

**Score: 38/38 truths verified (5 ROADMAP Success Criteria + 33 plan must_haves truths). behavior_unverified: 0.**

### ROADMAP Success Criteria (contract)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| SC-1 | One async script tag or ESM import + `Watchbug.init({projectKey,…})` yields a working floating widget | ✓ VERIFIED | `e2e/sdk.spec.ts:160`, `:198`, `:347` (ESM boots, zero added `window` props) — green ×3 engines; `packages/sdk/src/index.ts:89-104` option validation |
| SC-2 | Widget opens under hostile CSS, renders above host content, leaks nothing (exactly one global, no prototype patching) | ✓ VERIFIED | `e2e/sdk.spec.ts:1087-1135`, `:1137`, `:1203`, `:1225`, `:1247`, `:1269`, `:244` (WDG-04 window+prototype snapshot delta = 1) |
| SC-3 | Capture via browser prompt; widget never in it; ≤16 MP / ≤2 MB; no blank on HiDPI | ✓ VERIFIED | `e2e/sdk.spec.ts:425,470,545,578,615,646`; `packages/contracts/src/constants.ts:21-25`; `packages/sdk/src/image/encode.ts:30-32,128-143`; manual real-picker run |
| SC-4 | Password / credential patterns / `data-watchbug-sensitive` flat-filled in the capture the end user sees **and** in every encoded byte that leaves the browser | ✓ VERIFIED | Artifact rows decode the outgoing bytes and assert zero original pixels in the rect **and** its 1-px ring: `e2e/sdk.spec.ts:1641` (PRV-01), `:1597/:1665/:1686/:1707/:1744` (PRV-02), `:1772` (PRV-03), `:1856-1889` (H-1 DPR 1/1.25/2/3), `:1931` (S-7: open shadow root + same-origin iframe). **Scanner coverage:** light DOM + open shadow roots + same-origin iframes. Closed roots and cross-origin iframes are the documented limit (T-02-14 / AR-01). The "capture the end user *sees*" clause has no separate review surface yet — Phase 2 sends directly; review-before-send is `PRV-07` → Phase 3 (`REQUIREMENTS.md:243`) |
| SC-5 | Outgoing report has no host cookies/storage/auth headers, path-only URL; core ≤45 KB gz; zero runtime npm deps | ✓ VERIFIED | `e2e/sdk.spec.ts:2030` (PRV-05 sentinel scan of every header + every request byte), `:2207` (PRV-06), `:2341` (zero third-party); `lane1.ts:148` `credentials:'omit'`, `:151` `referrerPolicy:'no-referrer'`, `:95` `loc.pathname`; `check:size` core 9.3/45; `gate.mjs sdk-runtime-deps` PASS |

### 02-01 must_haves (3)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P1-T1 | Single `<script src async>` boots widget, IIFE global is `window.Watchbug` | ✓ VERIFIED | `e2e/sdk.spec.ts:160` + `:198` green ×3 engines; `build.mjs:55` `globalName:'Watchbug'`, `:69` |
| P1-T2 | Global snapshot differs by exactly one property; prototypes untouched; IIFE +1 / ESM +0 | ✓ VERIFIED | `e2e/sdk.spec.ts:244` (WDG-04), `:347` (INT-05) green ×3 engines |
| P1-T3 | Open-mode e2e artifacts `watchbug.e2e.{js,mjs}` emitted under distinct names; `check:size` gates production names only | ✓ VERIFIED | `dist/e2e/watchbug.e2e.js` + `.e2e.mjs` present (I-1 layout); `build.mjs:83-97`; `scripts/check-size.mjs:32` LANES = `watchbug.js` only; `npm run check:size` → PASSED |

### 02-02 must_haves (12)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P2-T1 | One launcher gesture drives flow to a report landing in the panel (201 + row) | ✓ VERIFIED | `e2e/sdk.spec.ts:278-345` — wire shape, 201, panel row visible (Level-4 data flow confirmed end-to-end) |
| P2-T2 | ESM build boots same widget/flow, adds zero `window` properties | ✓ VERIFIED | `e2e/sdk.spec.ts:347` green ×3 engines |
| P2-T3 | Real 48×48 `<button>` in shadow root; click starts flow; disabled while in flight | ✓ VERIFIED | `e2e/sdk.spec.ts:198`, `:407-414`; `launcher.ts:28-29,115,122-127` (no `await` before flow entry) |
| P2-T4 | Hostile CSS matrix cannot break the widget, with a control element proving each rule applied (CA-04 non-vacuous) | ✓ VERIFIED | `e2e/sdk.spec.ts:1087` ×4 variants + `:1103` closed-bundle row + `:1119` control row — green ×3 engines |
| P2-T5 | After init + full flow the host gained zero styles/classes/custom properties | ✓ VERIFIED | `e2e/sdk.spec.ts:1137` |
| P2-T6 | Widget renders above hostile max-z-index modal; flow still completes | ✓ VERIFIED | `e2e/sdk.spec.ts:1203` |
| P2-T7 | Hostile fixed element at widget coords neither merges with nor captures its hit target; host `pointer-events:none` passes host clicks | ✓ VERIFIED | `e2e/sdk.spec.ts:1225`; `host.ts:45` |
| P2-T8 | Empty host page → launcher at `right/bottom: 24px`, click starts flow | ✓ VERIFIED | `e2e/sdk.spec.ts:1247`; `host.ts:37-38` |
| P2-T9 | z-index tie resolved by DOM order; host re-appended after `documentElement` replacement | ✓ VERIFIED | `e2e/sdk.spec.ts:1269`; `host.ts:179,185` |
| P2-T10 | In-flight copy `Capturing… → Sending… → Retrying (n of 3)` with 12×12 spinner; launcher disabled while panel open | ✓ VERIFIED | `e2e/sdk.spec.ts:868-869`, `:845`; `status-panel.ts:139-142,302`; `:412`; manual run |
| P2-T11 | Every terminal failure renders documented headline + hint + `Try again`/`Dismiss`; blank never sent silently | ✓ VERIFIED | `e2e/sdk.spec.ts:716-717`, `:740-747`, `:784-816`, `:886-895`; blank abort before any request `:727`, `:751`, `:774` |
| P2-T12 | *(backstop)* Long server reason truncated to 240 chars with ellipsis in 320 px panel | ✓ VERIFIED | `e2e/sdk.spec.ts:904` passed ×3 engines; `MAX_REASON_CHARS`/truncation in `status-panel.ts` |

### 02-03 must_haves (6)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P3-T1 | One gesture drives the real capture seam (stubbed per engine) to a raw `ImageData` frame | ✓ VERIFIED | `e2e/sdk.spec.ts:425`; tier map `e2e/helpers/capture-stubs.ts:38`; real path `capture-source.ts:133-162`; **manual real picker** (chromium + firefox, 2026-10-25) |
| P3-T2 | Capture never contains the widget: hidden before prompt, restored after grab, pipeline fails loudly if not hidden, decoded image widget-free | ✓ VERIFIED | `pipeline.ts:184-206`; `e2e/sdk.spec.ts:470`; manual run |
| P3-T3 | Clamps: ≤16 MP, ≤2 MB encoded (target ≤800 KB, q0.8→q0.6→q0.5→0.75× ladder), DPR ≤2, HiDPI DSF2 non-blank | ✓ VERIFIED | `e2e/sdk.spec.ts:545,578,615,646`; `constants.ts:21-25`; `encode.ts:30-32,128-143,175-190` |
| P3-T4 | Blank/uniform or beyond-cap frame aborts before any request with the loud blank state | ✓ VERIFIED | `pipeline.ts:56-87,210-214`; `e2e/sdk.spec.ts:727,751,774` (uniform, beyond-cap, and the sparse-page regression) |
| P3-T5 | Non-tab surface (window/screen `displaySurface`) refused loudly, nothing sent | ✓ VERIFIED | `capture-source.ts:148-173`; `e2e/sdk.spec.ts:773` |
| P3-T6 | Silent WebP→PNG fallback detected by `blob.type` sniff; PNG part accepted with 201 | ✓ VERIFIED | `encode.ts:50,100,182`; `lane1.ts:100-102`; `e2e/sdk.spec.ts:671` (forced-PNG stub → `.png`/`image/png` → 201). *No engine reproduces the fallback naturally (A-14) — see WINDOWS.md #5, closed 2026-10-25* |

**Plan prohibition (02-03):** "never a 'send anyway' fallback" — `status: resolved`, `verification: judgment`. Verdict: **held** — `pipeline.ts:225-230` returns before encode/send on redaction error, `capture-source.ts:148-173` throws on non-tab surface, `pipeline.ts:210-214` on blank; e2e `fail-closed` row (`sdk.spec.ts:1945`) asserts zero POST attempts. The manual UAT confirmed the loud blank state and that nothing was sent.

### 02-04 must_haves (6)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P4-T1 | `input[type=password]` values flat-filled (α=255) before encode; decoded bytes carry no original pixels in rect or 1-px ring | ✓ VERIFIED | `e2e/sdk.spec.ts:1641` (artifact decode, ×3 engines); `redactor.ts:85,145-159`; `constants.ts:62`; manual run showed the flat black mask |
| P4-T2 | JWT / bearer / `key=`-assignments / Luhn-valid card patterns mask whole text node in decoded bytes | ✓ VERIFIED | `e2e/sdk.spec.ts:1597,1665,1686,1707` + negative control `:1620` and `:1707`; `patterns.ts:118-144` |
| P4-T3 | `data-watchbug-sensitive` masked at full element rect, outward-rounded, in decoded bytes | ✓ VERIFIED | `e2e/sdk.spec.ts:1772`; `redactor.ts:35,85-87`; manual run showed the flat black mask |
| P4-T4 | Bitmap/device-pixel geometry from the first mask: DPR 1/1.25/2/3 and non-integer zoom leak zero edge characters | ✓ VERIFIED | `e2e/sdk.spec.ts:1856,1867,1878,1889`; `geometry.ts` floor-origin/ceil-extent |
| P4-T5 | On match, whole containing element/text node masked (over-masking preferred) | ✓ VERIFIED | `e2e/sdk.spec.ts:1900` (P2-D-08); `redactor.ts:99-128` |
| P4-T6 | Redaction-pass error sends nothing, lands in loud failure — never falls open | ✓ VERIFIED | `pipeline.ts:216-230`; `e2e/sdk.spec.ts:1945` (zero POST attempts) |

**Plan prohibition (02-04):** "only automatic primitive is flat opaque pixel destruction (α 255) burned in before encode — no blur/overlay/semi-transparent fill". Verdict: **held** — `redactor.ts:149-158` writes RGB 0/0/0 + `MASK_ALPHA_OPAQUE` directly into `ImageData`; grep over `packages/sdk/src` finds no `blur(`, no overlay element, no CSS masking; `gate.mjs sdk-single-encode-sink` PASS (one `toBlob` at `encode.ts:75`). The manual UAT visually confirmed the masks survive the real encode path.

### 02-05 must_haves (6)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P5-T1 | Sentinels in host cookies/storage/auth header never reach the report; only `X-Project-Key` + `Idempotency-Key`; `gate.mjs sdk-no-host-storage` passes | ✓ VERIFIED | `e2e/sdk.spec.ts:2030` (zero sentinel hits, ×3 engines); `lane1.ts:141-152`; `node scripts/gate.mjs` → PASS, 15 SDK files clean |
| P5-T2 | `meta.url` path-only: query/fragment stripped by SDK (and re-stripped by contract schema) | ✓ VERIFIED | `lane1.ts:95`; `e2e/sdk.spec.ts:2207`; server-side `R-08/S-5` row `e2e/hostile.spec.ts:1150` |
| P5-T3 | `check:size` proves core ≤45 KB gz with the full widget landed; e2e artifact never gated as production | ✓ VERIFIED | `npm run check:size` → PASSED, core **9.3/45 KB gz**; `check-size.mjs:32`; `dist/e2e/watchbug.e2e.*` excluded |
| P5-T4 | Zero runtime npm deps; `@watchbug/contracts` types/constants-only (Zod erased) | ✓ VERIFIED | `gate.mjs sdk-runtime-deps` PASS; `index.ts:13-15`; bundle contains no Zod |
| P5-T5 | `title` = `document.title` truncated to `MAX_TITLE_CHARS` (200), `type:'bug'`, meta built by explicit mapping | ✓ VERIFIED | `lane1.ts:85-97`; `e2e/sdk.spec.ts:2294` (300-char title → exactly 200 code points, `type:'bug'`) |
| P5-T6 | Zero third-party network requests (only configured API base) | ✓ VERIFIED | `e2e/sdk.spec.ts:2341`; no fonts/CDN/analytics in `packages/sdk/src` |

**Plan prohibition (02-05):** "privacy core must never be moved out of the injected core lane to preserve the size budget". Verdict: **held** — `capture/pipeline/redact/encode/transport` are reachable only from `src/index.ts`; no dynamic chunk reaches them; `check:size` core 9.3 KB contains the whole flow.

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `SHADOW_MODE` build define | `attachShadow({mode})` → open-root registry Playwright reads | `build.mjs:44` (prod `closed`), `:89` (e2e `open`); `host.ts:136,186`; `capture-source.ts:53` | ✓ WIRED | e2e rows run against `watchbug.e2e.js`; production bundle closed (`sdk.spec.ts:160`) |
| Host inline `!important` list | `check:size` filename-gated tiers | `host.ts:34-45` ↔ `check-size.mjs:32` | ✓ WIRED | e2e artifacts live in `dist/e2e/` and are never the gated `watchbug.js` |
| Launcher gesture handler | injected flow entry → `getDisplayMedia` transient activation | `launcher.ts:122-127` → `index.ts:122` → `pipeline.ts:180-200` | ✓ WIRED | INT-02/CAP-01 rows pass; manual real picker in chromium |
| `init({projectKey,endpoint})` | `X-Project-Key` on `POST /api/incidents` | `index.ts:103,134-154` → `lane1.ts:144` | ✓ WIRED | INT-02 asserts `x-project-key === projectKey()` |
| Capture seam `ImageData` | destructive fill → single encode sink | `pipeline.ts:226` → `:234` → `lane1` | ✓ WIRED | ordering enforced; `gate.mjs sdk-single-encode-sink` PASS |
| Text-node `range.getClientRects()` | `toBitmapRect()` scale mapping | `fillRects` `redactor.ts:141-146` | ✓ WIRED | H-1 rows pass at DPR 1/1.25/2/3 |
| Pattern catalog | Phase-4 C-5 scrubber families | `patterns.ts:4,118-144` | ✓ WIRED (contract) | cross-phase: C-5 code does not exist yet (Phase 4) |
| `MASK_ALPHA_OPAQUE` import | fill loop | `redactor.ts:30,155` | ✓ WIRED | value 255 (`constants.ts:62`) |
| `gate.mjs sdk-no-host-storage` | PRV-05 sentinel e2e row | `gate.mjs` + `sdk.spec.ts:2030` | ✓ WIRED | both PASS |
| `check:size` filename tiers | open-mode `watchbug.e2e.*` names | `check-size.mjs:32` + `build.mjs` | ✓ WIRED | PRF-01 cannot be satisfied by renaming |
| `packages/sdk/package.json` runtime block | `sdk-runtime-deps` → `import type`-only contracts imports | `gate.mjs` + `index.ts` | ✓ WIRED | PASS |
| `Idempotency-Key` minted once | same key across retries → Phase-1 unique index | `pipeline.ts:127-133,246`, `lane1.ts:194-208` | ✓ WIRED | `sdk.spec.ts:824` asserts same key + same bytes on retry |
| `buildMeta()` mapping | `reportSchema` `z.strictObject` | `lane1.ts:85-97` → `packages/contracts/src/schema.ts` | ✓ WIRED | `sdk.spec.ts:2294/:2207` run `reportSchema.parse` |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
| --- | --- | --- | --- | --- |
| Launcher → panel states | `StatusView` from `createCaptureFlow.onView` | real capture/encode/send outcomes | yes — success, retry, rejection and failure states all driven by live results; manual run | ✓ FLOWING |
| Report meta | `buildMeta(document, location)` | host `document.title` + `location.pathname` | yes — asserted against values the test set | ✓ FLOWING |
| Image part | `encodeLadder(imageData)` | real pixels from the capture seam | yes — decoded back and pixel-asserted | ✓ FLOWING |
| Panel row (goal clause) | `GET /api/incidents` list | PostgreSQL via compose stack | yes — INT-02 and the manual run read the row through nginx after the 201 | ✓ FLOWING |
| Mask rects | `collectMaskRects(document)` at redact time | live DOM at click time | yes — negative controls prove discrimination; S-7 covers open shadow roots + same-origin iframes | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full one-suite run (all CA/requirement rows, 3 engines) | `npm run verify` | **315 passed / 0 failed (105 per engine)** | ✓ PASS |
| Size budget with landed widget | `npm run check:size` | **PASSED** (core 9.3/45 KB gz) | ✓ PASS |
| Static architecture gates | `node scripts/gate.mjs` | **3 passed, 0 failed, 0 skipped** | ✓ PASS |
| Compose shape | `npm run check:compose` | exactly three services | ✓ PASS |
| e2e artifacts emitted | `ls packages/sdk/dist` | `watchbug.js`, `.mjs`, `dist/e2e/watchbug.e2e.*`, annotator + dom-serialize pairs present | ✓ PASS |
| Requirement-row coverage exists (enumeration, not execution) | count of `test(` titles + the run log | 56 sdk rows per engine after the UAT fixes (54 + F-08 + sparse probe); every one of the 18 IDs has ≥1 named row | ✓ PASS |
| Manual real-picker capture (UAT #1) | headed browser, production bundle, OS picker | passed in chromium + firefox; 201 + panel row; masks visible | ✓ PASS |
| Prior-phase regression (01-VERIFICATION 40/40 `passed`) | same `npm run verify` run | `ingest.spec.ts`, `hostile.spec.ts`, `deploy.spec.ts`, `read-surface.spec.ts` rows all green | ✓ PASS |

**Probe execution (Step 7c):** no `scripts/*/tests/probe-*.sh` files exist and neither PLAN nor SUMMARY declares probe scripts for this phase — SKIPPED (not applicable). The equivalent runnable checks (`check:size`, `gate.mjs`, `verify`) were executed directly.

## Requirements Coverage (all 18 IDs)

Plan frontmatter `requirements:` union = exactly the 18 phase IDs. `REQUIREMENTS.md` maps exactly the same 18 IDs to Phase 2 — **0 orphaned requirements, 0 unplanned IDs**.

| Req | Plan | Description (REQUIREMENTS.md) | Status | Evidence |
| --- | --- | --- | --- | --- |
| INT-01 | 02-01 | single async script tag, no build step | ✓ SATISFIED | `e2e/sdk.spec.ts:160,198`; `build.mjs:55` |
| INT-02 | 02-02 | `init()` with public key/options → report | ✓ SATISFIED | `e2e/sdk.spec.ts:278-345`; `index.ts:113-146` |
| INT-05 | 02-02 | consume as ES module instead of a global | ✓ SATISFIED | `e2e/sdk.spec.ts:347`; ESM lane |
| WDG-01 | 02-02 | open widget from floating launcher | ✓ SATISFIED | `e2e/sdk.spec.ts:198,391` |
| WDG-02 | 02-02 | hostile CSS cannot hide/restyle/break | ✓ SATISFIED | `e2e/sdk.spec.ts:1087-1135` |
| WDG-03 | 02-02 | never leaks styles/classes/CSS vars | ✓ SATISFIED | `e2e/sdk.spec.ts:1137` |
| WDG-04 | 02-01 | exactly one global, no native prototype modified | ✓ SATISFIED | `e2e/sdk.spec.ts:244` |
| WDG-05 | 02-02 | renders above all host content | ✓ SATISFIED | `e2e/sdk.spec.ts:1203,1225,1247,1269` |
| CAP-01 | 02-03 | capture via browser capture prompt | ✓ SATISFIED | `e2e/sdk.spec.ts:425,796`; manual real picker |
| CAP-04 | 02-03 | capture never contains the widget | ✓ SATISFIED | `e2e/sdk.spec.ts:470`; `pipeline.ts:184-206`; manual run |
| CAP-05 | 02-03 | ≤16 MP / ≤2 MB without blanking on HiDPI | ✓ SATISFIED | `e2e/sdk.spec.ts:545,578,615,646` |
| PRV-01 | 02-04 | password values excluded automatically | ✓ SATISFIED | `e2e/sdk.spec.ts:1641`; scanner covers light DOM + open shadow roots + same-origin iframes |
| PRV-02 | 02-04 | credential/token/card patterns redacted | ✓ SATISFIED | `e2e/sdk.spec.ts:1597,1665,1686,1707,1744` |
| PRV-03 | 02-04 | `data-watchbug-sensitive` redacted | ✓ SATISFIED | `e2e/sdk.spec.ts:1772`; manual run |
| PRV-05 | 02-05 | never reads/transmits host cookies/storage/auth | ✓ SATISFIED | `e2e/sdk.spec.ts:2030` + `gate.mjs sdk-no-host-storage` PASS |
| PRV-06 | 02-05 | query strings/fragments stripped | ✓ SATISFIED | `lane1.ts:95`; `e2e/sdk.spec.ts:2207` |
| PRF-01 | 02-05 | injected script ≤45 KB gz, build fails otherwise | ✓ SATISFIED | `npm run check:size` PASSED (9.3/45) |
| PRF-04 | 02-05 | zero runtime npm dependencies | ✓ SATISFIED | `gate.mjs sdk-runtime-deps` PASS |

**Explicitly out of this phase's requirement set (not gaps here):** `WDG-06`/`RNF-03` (EN+ES widget copy) → Phase 3; `CAP-02`, `CAP-03`, `PRV-04`, `PRV-07` (review-before-send) → Phase 3; `PRF-02/03` → later; `INT-03/04` → Phase 4.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | debt markers (`TBD`/`FIXME`/`XXX`) across all phase-touched implementation files + e2e files: **0 matches** | ✅ none | none |
| `packages/sdk/src/strings.ts` | 6,33,34 | "placeholder" matches | ℹ️ Info | false positive — `t()` `{placeholder}` substitution, not a stub |
| `packages/sdk/src/{capture,redact,transport}` | various | `return null` | ✅ none | guarded early-returns, not empty implementations |
| `schema/report.schema.json` | — | uncommitted working-tree change | 📋 Advisory | `git diff` content-empty (LF→CRLF only) |

No stubs, no placeholder copy, no `console.log`-only handlers, no hardcoded empty data in any phase-touched render path.

## Review Findings Cross-Reference (02-REVIEW.md / 02-REVIEW-DISPOSITION.md)

| Finding | Severity | Disposition | Verifier confirmation in source |
| --- | --- | --- | --- |
| CR-01 referrer leak | critical | fixed | ✓ `referrerPolicy: 'no-referrer'`; PRV-06 now asserts the header is absent |
| CR-02 glued-card masking hole | critical | fixed | ✓ `luhnValidCardRun` validates groups + adjacent joins; glued-card e2e row passes ×3 engines |
| CR-03 scanner stops at top-document light DOM | critical | **fixed** | ✓ `collectScanRoots` reaches open shadow roots and same-origin iframes; `S-7 / PRV-02` row passes ×3 engines; closed roots / cross-origin frames documented (AR-01) |
| WR-01/02/03 | warning | fixed | ✓ rects measured in `beforeRead`; endpoint = document origin with strict throw; CSPRNG-only idempotency key |
| IN-01/02/03 | info | fixed | ✓ canvas-free beyond-cap return; code-point truncation; non-vacuity guard + engine conditionality stated in-row |
| FX-01…FX-06 | 2 critical / 2 warning / 2 info | fixed | ✓ `host.restore()` on no-CSPRNG; transformed-frame refusal; non-string endpoint; fixture key shape; comment restoration; depth throw |

## Human Verification Required

**None outstanding.** All five items from the first pass are resolved (detail in `02-UAT.md`):

1. **Real unstubbed capture** — passed in chromium + firefox (2026-10-25): OS picker, real frame, host hidden, 201, panel row, flat black masks. The run also found and led to the blank-probe fix below.
2. **Visual pass vs `02-UI-SPEC.md`** — passed: manual idle/capturing/sending/sent + masks; full state matrix from `02-UI-REVIEW.md` (22/24 PASS, 0 BLOCK).
3. **CR-03 disposition** — resolved by code, not deferred.
4. **F-08 `lang`** — fixed: `lang="en"` on the widget content root + e2e row.
5. **WINDOWS.md #5 wording** — fixed: `REQUIREMENTS.md` release criteria corrected; `gsd-tools windows fixed 5`.

### Post-UAT correction (2026-10-25)

The manual capture exposed a false positive the suite could not see: `blankProbe()` sampled a fixed 3×3 grid at 25/50/75 % and rejected a legitimate sparse page (white page with a single heading in the top-left corner) as blank. The probe is now a **dense uniformity scan** — the frame is blank only when every pixel is byte-identical — with a regression row `P2-D-12: a sparse but real page … is not blank` (frame white except a 4×4 block outside the old sample points). The uniform and beyond-cap rejection rows still pass, so the blank guarantee is unchanged for a genuinely blank capture.

## Gaps Summary

**No failed must-haves.** All 38 truths are supported by substantive, wired artifacts and by live command evidence: 315/315 e2e rows across chromium+firefox+webkit, `check:size` PASSED (9.3/45 KB), `gate.mjs` 3/3 PASSED, and the real-picker UAT passed on both engines. All 18 requirement IDs are accounted for with named e2e rows or gate rows; 0 orphaned requirements; prior phase (01, 40/40 passed) shows no regression.

The phase is **passed**. Deferred-by-design items (EN+ES copy `WDG-06`/`RNF-03`, review-before-send `PRV-07`, `PRF-02/03`) are owned by later phases in the roadmap, not gaps of this one.

---

_Verified: 2026-10-25 (reconciled after the code-review remediation and the UAT closure)_
_Verifier: the agent (gsd-verifier first pass at `7012d3a`; reconciliation by the closure pass) — evidence re-derived, not taken from SUMMARY claims_
