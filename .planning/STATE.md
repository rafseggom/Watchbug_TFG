---
gsd_state_version: "1.0"
current_phase: 03
current_phase_name: Report Composer & Annotation Editor (lazy)
status: verifying
stopped_at: Completed 03-07-PLAN.md
last_updated: "2026-10-28T22:18:05.184Z"
last_activity: 2026-10-28
last_activity_desc: Phase 03 execution started
state_head: 432b24b24f115d19f0a9c9c4620ff8db708ba960
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 16
  completed_plans: 16
  percent: 29
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-13)

**Core value:** When a bug report lands, the developer can reproduce the bug from it — and neither the report nor its screenshot ever leaves the developer's own infrastructure.
**Current focus:** Phase 03 — Report Composer & Annotation Editor (lazy)

## Current Position

Phase: 03 (Report Composer & Annotation Editor (lazy)) — EXECUTING
Plan: 7 of 7
Status: Phase complete — ready for verification
Last activity: 2026-10-28 — Phase 03 execution started

Progress: [███░░░░░░░] 29%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 5 | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: n/a

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 01:45:00 | 3 tasks | 57 files |
| Phase 01 P02 | 40min | 3 tasks | 16 files |
| Phase 01 P03 | 37min | 3 tasks | 10 files |
| Phase 01 P04 | 45min | 3 tasks | 15 files |
| Phase 02 P01 | 45min | 3 tasks | 9 files |
| Phase 02 P02 | 6h00m | 3 tasks | 13 files |
| Phase 02 P03 | 40min | 3 tasks | 6 files |
| Phase 02 P04 | 50min | 3 tasks | 6 files |
| Phase 02 P05 | 60min | 3 tasks | 6 files |
| Phase 03 P01 | 25min | 3 tasks | 9 files |
| Phase 03 P03 | 84 min | 3 tasks | 14 files |
| Phase 03 P02 | 17min | 3 tasks | 12 files |
| Phase 03 P04 | 48min | 3 tasks | 11 files |
| Phase 03 P05 | 82 min | 3 tasks | 15 files |
| Phase 03 P03-06 | 56 min | 3 tasks | 7 files |
| Phase 03 P07 | 48 min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (R-01…R-17) and `documentation/resolution-record.md` §5 amendments (A-01…A-12 — §5 governs on conflict).
Recent decisions affecting current work:

- [Roadmap] PROJECT_MODE = mvp: every phase emits `**Mode:** mvp` and delivers an end-to-end demonstrable capability. Research build order compressed to 7 phases: contracts+skeleton merged into the ingest tracer; auth/projects split from triage/retention; edge-hardening merged into the release closeout.
- [Roadmap] Hard sequencing locked: `WidgetHost` isolation strategy and redaction ordering **T1** are fixed in Phase 2 (first build of the widget); **T2/T3** + the C-2 `Annotator` contract (one flattened bitmap, non-undoable masks, single `toBlob` sink) in Phase 3. R-12: verification is one Playwright suite (CA-01…CA-05) + `check:size` — no unit tests, ever.
- [Phase 1] Scope note: the hardened blob route ships here (C-3/C-4) but DEP-03's "served only through the authenticated API" completes in Phase 5 when auth exists. TTL columns land in the initial migration (M-1/A-02) to avoid schema retrofits.
- [Phase 4] INT-03's `custom` = init-scoped context riding every report (v1); distinct from ANN-V2-03 per-report custom fields (v2).
- [Phase 1 · OVERRIDE 2026-10-11 · decision-coverage gate] The `check.decision-coverage-plan` gate returned `passed: false, reason: could-not-parse` because CONTEXT.md's local decision IDs use the `P1-D-NN` grammar, which the parser does not support (it accepts `D-NN`, `D4-NN`, `D-NN — title`). Developer chose "Proceed — parser false positive": the gate's intent is already satisfied — the plan-checker's dimension-7 audit verified all 12 `P1-D-01…P1-D-12` decisions map to plan tasks with no deferred idea implemented and no scope reduction. No plan or CONTEXT.md change was made. **verify-phase must re-surface this:** if its decision-coverage counterpart reports the same `could-not-parse` on `P1-D-NN`, treat it as this same recorded false positive, not as a dropped decision.
- [Phase 2 · OVERRIDE 2026-10-18 · decision-coverage gate] Same gate, same verdict: `passed: false, reason: could-not-parse` on the `P2-D-NN` grammar (02-CONTEXT.md uses `P2-D-01…P2-D-12`, outside the parser's `D-NN` / `D4-NN` / `D-NN — title` forms). Resolved per the Phase 1 precedent above ("Proceed — parser false positive"): the plan-checker's dimension-7 audit verified all 12 `P2-D-01…P2-D-12` decisions map to plan tasks across 02-01…02-05 with no contradiction, no deferred idea implemented, and no scope reduction (P2-D-05's `selfBrowserSurface` ban explicitly honored; P2-D-01 `type:'bug'` shortcut and P2-D-04 no-locale strings map are the locked decisions themselves). No plan or CONTEXT.md change made. **verify-phase must re-surface this:** if its decision-coverage counterpart reports `could-not-parse` on `P2-D-NN`, treat it as this same recorded false positive, not as a dropped decision.
- [Phase 3 · OVERRIDE 2026-10-28 · decision-coverage gate] Third identical verdict: `passed: false, reason: could-not-parse` on the `P3-D-NN` grammar (03-CONTEXT.md uses `P3-D-01…P3-D-16`). Developer chose "Proceed — known parser false positive", per the Phase 1 and Phase 2 precedents. Substantive evidence: the plan-checker's dimension-7 audit verified all 16 `P3-D-01…P3-D-16` decisions are cited by an implementing task across 03-01…03-07 (P3-D-01, -10, -11, -12 and -14 appear in more than one plan), that the three discretion areas are decided in plan text (i18n split → 03-03, lazy-load timing → 03-05, text-only form shape → 03-04), that no deferred idea is implemented (mask-undo, host-configurable redaction rules and the DOM-serialize adapter are absent), and that no locked decision is contradicted. The four `costly` decisions (P3-D-01, -04, -09, -14) keep their ratings; P3-D-14's migration is gated by a `checkpoint:decision` in 03-01 Task 1. No plan or CONTEXT.md change made. **verify-phase must re-surface this:** if its decision-coverage counterpart reports `could-not-parse` on `P3-D-NN`, treat it as this same recorded false positive, not as a dropped decision.
- [Phase 01]: A-13: five type-only @types/* devDependencies owner-approved to make npm run lint pass (question gate; recorded in documentation/resolution-record.md A-13)
- [Phase 01]: Q-08 tooling gate PASS under typescript 7.0.2 - the documented 6.x fallback was not taken
- [Phase 01]: rate-limit and cors plugins deferred to plan 01-03 per the plan's own artifact table (ING-05 is 01-03's requirement); installing them in 01-01 caused 429s that broke the e2e suite
- [Phase 01]: Hardening backend for 01-01 is the zero-dep structural strip/rebuild (P1-D-10 fallback); sharp stays 01-02's checkpoint
- [Phase 01]: Storage.put(bytes, ext, projectId) - the on-disk layout mandates the projectId segment (deviation vs research sketch put(bytes, ext))
- [Phase 01]: P1-D-10 backend decided at plan 01-02 Task 1: sharp@0.35.5 (owner sign-off) - root re-encode is the hardening control; the zero-dep structural strip moved to structure.ts as a pre-codec guard that no longer claims to be one
- [Phase 01]: multipart fieldSize raised from the researchs 4 KB to MAX_META_BYTES (64 KB): busboy truncates fields silently, so a contract-sized meta (note up to 5000 chars) could never parse at 4 KB
- [Phase 01]: busboy runs with preservePath: true - its default basename() rewrote ../../../etc/passwd.png to passwd.png before the C-4 rule could reject it
- [Phase 01]: 01-03: e2e rate-limit maxima 1200/600/2000 (local .env) - byKey and byDay share one bucket identity, so D>K is required to prove the per-key boundary and D<2K keeps the daily row to one 65s window wait; production defaults 10/30/2000 unchanged
- [Phase 01]: 01-03: ingest preHandler chain locked as bodyCaps(onRequest) -> ingestRateLimit -> originGate -> projectKeyGate -> handler (limits before CORS before key before any write); origin enforcement is route-level, @fastify/cors is app-level for headers/preflight
- [Phase 01]: 01-03: all three limiters increment before any 429 decision (rejected requests consume every quota); GET list no longer consults X-Project-Key - write-only key per H-7/DEP-03
- [Phase 01]: 01-04: toPlainText decodes sanitize-html's re-escapes only when the decoded value cannot re-open a tag (2 < 3 & 4 > 1 round-trips literally; entity-encoded payloads and <title> RCDATA stay escaped so no markup-shaped text reaches storage)
- [Phase 01]: 01-04: text caps count Unicode code points, not UTF-16 units - Zod 4.6.5 maxLength semantics (probe-verified), matching the published JSON Schema; the plan's code-units premise was corrected in the e2e rows, not in the contract
- [Phase 01]: 01-04: ingest order kept validate -> sanitise -> re-validate: post-sanitise re-validation guarantees a stored value never exceeds the cap it validated against (200 '&' stores as 200 chars)
- [Phase 01]: 01-04: empty-state e2e rows intercept GET /api/incidents with [] (shared stack is never empty); /api/setup, the EmptyState component and the emitted curl stay real, and one row spawns the emitted snippet verbatim (201 -> visible after reload)
- [Phase 01]: 01-04: meta JSON content-type defect closed - the multipart loop re-stringifies an object field back to JSON text (curl -F shape ingests 201); CA-01 schema untouched; deferred-items entry 1 marked RESOLVED
- [Phase 02]: Host element is an unregistered <watchbug-host>: customElements.define would mutate the page's global registry (pre-emptable by a hostile page) and WDG-03/04 forbid host-visible state; attachShadow works unregistered
- [Phase 02]: endpoint defaults from document.currentScript.src captured at module evaluation, falling back to document.baseURI origin - import.meta.url cannot survive the IIFE lane
- [Phase 02]: Open-mode e2e artifacts (watchbug.e2e.js/.mjs) are emitted by every npm run build as two extra core calls rather than an argv flag; check:size budgets by filename so the variant is outside the gate
- [Phase 02]: The shadow-root registry is populated only when SHADOW_MODE === 'open'; Playwright pierces via host.shadowRoot, so no second global exists even in the test build
- [Phase 02]: 02-02: real-stack e2e rows inspect the intercepted request then pass it through with route.continue() and read the real response via waitForResponse - Playwright WebKit cannot serialize blob-backed FormData into postDataBuffer, so route.fetch() re-sent an empty image part and the API 400'd on magic bytes
- [Phase 02]: 02-02: the WebP capability probe validates RIFF/WEBP magic bytes (not blob.type alone) and encodeLadder rejects any zero-byte encode - WebKit answers a WebP request with a zero-byte blob still labelled image/webp
- [Phase 02]: 02-02: WDG-03 leak scan enumerates every --wb- custom property in computed style across all host-document elements incl. watchbug-host (custom props enumerable on all 3 engines); WDG-05 elementFromPoint asserted as launcher containment because the centre point is the SVG glyph
- [Phase 02]: 02-02: hostile-CSS matrix is one template variant per fixture document lifted by openHostileFixture with a paired control element per rule (CA-04 non-vacuous), served only by page.route fulfilment at the panel origin (Pitfall 4); isolation rows run on the closed production bundle where observable, copy/geometry on the open-mode build (Pitfall 10)
- [Phase 02]: 02-03: outgoing image bytes are read at the fetch boundary via a window.fetch wrapper in the e2e stub (readOutgoingImage), never from request.postDataBuffer - Playwright WebKit drops blob-backed FormData payloads
- [Phase 02]: 02-03: CAP-05 oversized frame sits at the 16 MP ceiling (4000x4000): frames above MAX_IMAGE_PIXELS are rejected by the P2-D-12 probe before encode, so the area clamp is source-asserted while the at-ceiling row proves the 16 MP / 2 MB contract
- [Phase 02]: 02-03: added the plan-mandated MAX_IMAGE_DIM (8192) per-side clamp to initialDimensions, RED-proven by the 9000px wide-frame row (RED_EVIDENCE_OK)
- [Phase 02]: 02-03: refusal rows are non-vacuous via a data-wb-stub-invoked attribute so a policy refusal cannot pass because the capture API was missing; uniform runs on the default tier, beyond-cap as a canvas-free ImageData at the seam
- [Phase 02]: 02-04: whole-text-node masking - a pattern match masks the union of range.getClientRects (one rect per node); fixtures use line-height:1 so the capture-stub marker paints inside the text-node rect (probe-verified on all 3 engines)
- [Phase 02]: 02-04: Pitfall 1 resolved by wording (Beare[r] spelling, generic SEC-03 comments) - no gate exemption added; sdk-no-host-storage stays green with the full catalog
- [Phase 02]: 02-04: redaction errors fail closed into the locked capture-failed state (UI-SPEC copy set has no redaction headline; dedicated copy deferred to the Phase 3 composer)
- [Phase 02]: 02-04: H-1 rows capture at frame = viewport x DPR (1/1.25/2/3), dpr3 clamped to 2560x1440 by the ladder; the dpr-1 row pins deviceScaleFactor explicitly because Desktop Safari defaults to DSF 2
- [Phase 02]: 02-04: assignment regex has no leading word boundary (api_key must match as key=) - recall over precision per P2-D-09; Luhn-invalid digit runs deliberately stay visible
- [Phase 02]: 02-04: Task 2 produced no RED - the four-group catalog shipped in Task 1 GREEN (plan-split deviation documented in SUMMARY; tdd.md fail-fast, no RED fabricated)
- [Phase 02]: 02-05: buildMeta truncates the auto-title by CODE POINTS ([...title].slice(0,200).join) to match Zod 4 .max semantics - RED proven on the wire (150 vs 200 code points for a 300-code-point emoji title)
- [Phase 02]: 02-05: PRV-05 sentinel scan covers every request byte on two surfaces - intercepted multipart buffer plus the fetch-boundary image blob - because Playwright WebKit reports 0-byte blob parts in postDataBuffer and exposes no cookie header at all (probe 2026-10-24), so the cookie provocation asserts on chromium/firefox
- [Phase 02]: 02-05: OQ-2 closed as resolution-record note A-14 - this platform WebKit encodes real WebP (probe 2026-10-17), M-3 coverage comes from the forced-PNG stub, magic-byte sniffing is the authority; R-12 untouched and the REQUIREMENTS wording delta flagged in WINDOWS ledger (kind unmet-truth)
- [Phase 02]: 02-05: deploy.spec DEP-01/S-4 heading assertions use exact:true - the shared stack holds real incidents whose titles contain Watchbug, so substring locators failed strict mode (cross-row interference fixed under Task 3 mandate, scope note recorded)
- [Phase 02 · cierre 2026-10-25]: the manual real-picker UAT found a blank-probe false positive (9 fixed samples missed a white page with one heading); blankProbe is now a dense uniformity scan (blank only when every pixel matches) with regression row P2-D-12 sparse, and the core dropped 0.1 KB
- [Phase 02 · cierre 2026-10-25]: F-08 fixed - lang="en" on the widget content root + F-08 e2e row (Phase 3 replaces the literal with the resolved locale)
- [Phase 02 · cierre 2026-10-25]: WINDOWS #5 fixed - REQUIREMENTS release criteria now state webkit covers engine-divergent rendering + CaptureSource seam, M-3 via forced-PNG stub (A-14), firefox the no-ImageCapture path
- [Phase 02 · cierre 2026-10-25]: owner decisions confirmed - S-8 strict throw for a cross-origin script without endpoint (soft fallback rejected and closed); FX-02 fail-closed frame transform kept as deliberate backlog
- [Phase 03]: ﻿03-01: owner-approved migration shape executed - ONE drizzle-kit artifact 0001 carries nullable storage_key/content_type AND the image/jpeg CHECK widening (P3-D-14); decision 'approve' recorded in 03-01-SUMMARY before Task 2
- [Phase 03]: ﻿03-01: e2e postIncident contract flipped - bytes===undefined now omits the image part entirely (reaching the route's imageless branch); the 8 pre-existing omission callers pinned with bytes: png so no existing row changed shape
- [Phase 03]: ﻿03-01: one ext-MIME allowlist read in both directions - CONTENT_TYPE_BY_EXT typed Record<ImageExt,string> plus derived EXT_BY_CONTENT_TYPE inverse; blob route 404s on a null key BEFORE any Storage call (Pitfall 8 ternaries eliminated; 03-02 adds the jpeg arm to the same map)
- [Phase 03]: 03-03: T3 encode order resolved per the plan text: replay mask patches FIRST, re-apply T1 as the last pixel write, then encodeLadder — the PATTERNS section-14 sketch inverts the first two; the plan acceptance criterion governs
- [Phase 03]: 03-03: capture failures still route to the Phase-2 status panel (blank/oversize to the blank bucket, denied/no-api to the capture bucket) until 03-04 mounts the degraded composer; the failure rows stay green; 03-07 re-points them
- [Phase 03]: 03-03: i18n split decided: core carries launcher/status/action/composer/review/mask-confirm/i18n copy in BOTH locales; the lazy chunk carries editor.* only (03-05); locale override is session-scoped in memory, never host storage (SEC-03 / UI-SPEC A-1)
- [Phase 03]: 03-03: encoding happens at Review entry and the review canvas renders the DECODED outgoing blob — shown bytes are sent bytes; Send transmits that same blob with no re-encode (T-03-17)
- [Phase 03]: 03-02: JPEG admitted on the 3-byte FF D8 FF prefix only — never the JFIF 4-byte form, because libvips output starts SOI-DQT (FF DB); proven by round-trip re-submission of the served bytes at artifact level, no unit test
- [Phase 03]: 03-02: oversize decode-bomb fixture uses the plan-sanctioned synthetic-SOF route — a real 64x64 chromium JPEG with the SOFn re-declared 8000x8192 (both sides under MAX_IMAGE_DIM so the PIXELS arm is the one that answers); a 64 MP browser canvas is memory-flaky and never needed because the guard reads only the header
- [Phase 03]: 03-02: validateStructure's JPEG arm passes bytes through UNCHANGED with the written rationale (no entropy-scan walker; the sharp root re-encode is the control; the header guard precedes it); every ingest stage is now an exhaustive switch(ext) with a never-guard default that fails closed — the three plan prohibitions are structurally enforced and flagged human-judgment for the verifier
- [Phase 03]: 03-02: sharp autoOrient: true is mandatory and carries a never-remove rationale in the harden.ts docblock; the Orientation=6 fixture row proves it (80x40 stored as 40x80, no Exif substring in the served container)
- [Phase 03]: 03-04: ManualFileCapture is standalone (never a DisplayMediaCapture wrapper, P3-D-13); blankProbe never runs on attachments (F6); attach size refusal is arm-agnostic (decoded-bitmap 'size' or engine 'decode' both satisfy the contract, A4)
- [Phase 03]: 03-04: capture failures now route to the degraded composer (data-wb-state=degraded) with the F6 hint mapping (denied/no-api to status.captureFailed.hint, blank/oversize to status.blankCapture.hint) - the six failure rows were re-pointed in 03-04 itself, 03-07 keeps only the 41 one-shot rows; the no-CSPRNG exit stays a panel state
- [Phase 03]: 03-04: SendPayload.blob widened to Blob|null - postOnce omits the image part entirely; the text-only lane files real 201s through 03-01's imageless branch (CAP-03 client half complete)
- [Phase 03]: 03-05: chunk URL derives ONLY from the core bundle's own URL (T-03-20); the retry passes through a ?retry= buster after a failure because engines cache failed dynamic-import fetches in the module map (probe-disproved the bare memo-clear retry; happy path stays exactly one bare .mjs request)
- [Phase 03]: 03-05: one-bitmap editor model - open() mutates and resolves the draft's OWN ImageData, flattens committed vector strokes into base.data at Done via one readback; no createImageBitmap in the lane; undo = pop + redraw from base (C-2/A-04 true by construction)
- [Phase 03]: 03-05: editor locale/ink/maskConfirm are core-resolved and passed in AnnotatorOpenOptions - the chunk carries no dictionary and no colour literal; EDITOR_CSS appends exactly once to the data-wb-core style element (one shadow stylesheet, no adoptedStyleSheets)
- [Phase 03]: 03-05: check-size lazy lane gates max(.js,.mjs) <= 25 KB with a >= 2 KB anti-inline floor on BOTH twins (min-twin, stronger than floor-on-max); gate.mjs sdk-lazy-lane-purity fails value/side-effect/literal-dynamic core imports of the lane, allows the single type-only crossing in widget/loader.ts
- [Phase 03]: 03-06: mask bake writes destroyed pixels into the draft own buffer (bakeMask) and stores only the post-mask patch; rebakeMasks replays patches after strokes in every redraw and encodeFinal replays patches before the T1 re-run (T3) - undo/ink cannot resurrect a region because no pre-mask copy exists (C-2/A-04 by construction)
- [Phase 03]: 03-06: e2e mask drags dispatch whole-CSS-pixel coordinates and assert the helper-predicted committed rect - Firefox/WebKit truncate fractional page.mouse coords to int CSS (measured probe); at DPR 1.25/2/3 fractional dispatch would land the mask 1-3 bitmap px inside the asked rect
- [Phase 03]: 03-06: pixelate proof asserts the mechanism on a forced-PNG artifact (per-block byte uniformity is unsatisfiable lossy); fill rows keep the real WebP path and reuse analyzeRedaction/expectMaskedAndTargeted unchanged
- [Phase 03]: 03-07: completeComposer exits at the request-issued edge (data-wb-screen 'status'); callers keep terminal assertions; heavy rows carry walk timeouts (45s/30s), tiers untouched
- [Phase 03]: 03-07: all 41 Phase-2 one-shot rows migrated through the one shared helper; zero deleted/skipped, 453x3 engines green, count guard unchanged; failure rows verified degraded (03-04 already re-pointed)
- [Phase 03]: 03-07: PRF-02/PRF-03 closed on emitted artifacts (core 16.9/45, lazy max-twin 6.6/25, floor min-twin 6.3>=2, runtime 23.8/80); gate.mjs five rules incl. new sdk-no-html-sink; ANN-04 census counts open dialogs only

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- ⚠ **Q-07 (Phase 5 planning must resolve — NOT execution):** key rotation semantics for PRJ-04 — grace period vs instant cut-off for a `public_key` embedded in already-shipped host script initialisations. Security-sensitive; decide at `/gsd-plan-phase 5`.
- **Q-05 (release gate):** degree-awarding institution's IP policy must be confirmed before the repo is public (R-07 Apache-2.0 + NOTICE).
- **UNVERIFIED at first build:** ~~`@fastify/multipart` ↔ Fastify 5 mapping~~ ✓ Phase 1 (e2e 132/132 green); ~~TS 7.x tooling ecosystem~~ ✓ Phase 1 (Q-08 gate PASS under typescript 7.0.2, no 6.x fallback); ~~`preferCurrentTab` Firefox/Safari~~ ✓ Phase 2 (Chromium-only confirmed; `displaySurface` policy accepts `browser`/`undefined`, refuses `window`/`screen`); `@node-rs/argon2` option names — resolves in Phase 5 (auth).
- **A-12/M-2 size arithmetic:** worst case 45+25+14 = 84 KB > 80 KB — multi-artifact `check:size` scenario lives in Phase 1; resolve against real numbers in Phase 7 (v1 ships core+editor = ≤70 KB; DOM-serialize adapter is v2).
- **Node 24 → 26 re-pin** scheduled after 2026-10-28 (one re-pin).
- **GDPR claims (M-1)** need legal/supervisor review before any public compliance statement.
- ⚠ **[Phase 1 deferred]** `npm audit`: 4 **moderate**, dev-only advisories in `drizzle-kit`'s `esbuild` chain (GHSA-67mh-4wv8-2f99). Runtime packages and shipped images unaffected. Only fix offered is `npm audit fix --force`, which downgrades `drizzle-kit` to 0.18.1 — needs an owner decision; schedule a dependency-upgrade run that re-verifies `drizzle-kit` against STACK.md first.
- **[Phase 1 context note]** `@fastify/busboy` basenames filenames by default — `preservePath: true` in `apps/api/.../caps.ts` is what makes the C-4 traversal-name rejection observable. Whoever touches multipart registration later must keep that option or the rule silently becomes a no-op.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261007-pm7 | Add reuse-first coding rule (R-18) and 4 Gemini review entries: CSP risk, IndexedDB fallback, orphan blob reconciliation, TS 6-vs-7 gate | 2026-10-07 | 8eafa1b | [261007-pm7-add-reuse-first-coding-rule-r-18-and-4-g](./quick/261007-pm7-add-reuse-first-coding-rule-r-18-and-4-g/) |
| 2 | Record phase 1 real start date (2026-10-11, delta +1 day) in Gantt variance tracker continuity-pack 7.1 | 2026-10-11 | 0e0af4d | — |
| 261014-m3v | S-2 â€” Add a scheduled TTL purge job so retention stops being decorative: at boot and on an interval, null out the user_* identity columns where identity_purge_at is due, and delete the row plus its Storage blob where artifact_purge_at is due, logging what was purged. Enforces R-09/R-10/RET-01-02. Files: new module apps/api/src/purge.ts, apps/api/src/app.ts, apps/api/src/db/schema.ts, docker-compose.yml, .env.example. | 2026-10-14 | 9f5ae66ed0da7169d264217132d53c87b6f024db | .planning/quick-batches/261014-m3u/items/261014-m3v-s-2-add-a-scheduled-ttl-purge-job-so-retention-stops-being-d |
| 261014-m3w | S-3 + S-6 server: per-IP read rate limit and keyset pagination for the read surface | 2026-10-14 | 35fc1bc | — |
| 261014-m3x | L-1 client + S-6 client: fix panel-side stopthatslop findings and harden the list read surface | 2026-10-15 | 338d84f | — |
| 261014-m3y | S-4 + S-5: CSP on the panel and R-08 path-only URLs in the contract | 2026-10-15 | abe0e9c | — |
| 261014-m3z | L-1 server: fix the server-side stopthatslop findings (abortable fetches, lazy sharp) | 2026-10-15 | a4b7396 | — |
| 261016-nnx | Fix api read rate-limit typecheck error: gate on isExceeded via discriminant narrowing | 2026-10-16 | f12e36d | [261016-nnx-fix-api-read-rate-limit-typecheck-error-](./quick/261016-nnx-fix-api-read-rate-limit-typecheck-error-/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| v2 scope | 15 v2 requirements (CAP-V2, ANN-V2, ENR-V2, TRI-V2, DEP-V2) + DOM-serialize capture adapter | Tracked in REQUIREMENTS.md | 2026-10-05 | v1 |
| Excluded | 13 explicit non-goals (integrations, replay, AI, SaaS, OAuth/SSO, multi-user, unit tests, …) | Hard-excluded | 2026-10-05 | — |

## Session Continuity

Last session: 2026-10-28T22:17:45.621Z
Stopped at: Completed 03-07-PLAN.md
Resume file: None
