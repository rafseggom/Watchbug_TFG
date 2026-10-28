---
phase: "3"
slug: "report-composer-annotation-editor-lazy"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-28"
validated: "2026-10-28"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **R-12 governs this file:** e2e and property assertions ONLY. There is no unit-test
> framework, no per-function suite, and no coverage threshold in this project — and none
> will be added. Verification is exactly two shipped artifacts (`npm run verify` +
> `npm run check:size`) plus the static gates in `npm run gate`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@playwright/test` 1.63.0 — the one suite |
| **Config file** | `playwright.config.ts` — projects `chromium`, `firefox`, `webkit`; `workers: 1`; `fullyParallel: false`; `globalSetup` requires the compose stack on `127.0.0.1:8080` |
| **Quick run command** | `npm run build && npm run check:size && npm run gate` |
| **Full suite command** | `npm run verify` (all three projects) |
| **Static gates** | `npm run gate` — `sdk-single-encode-sink`, `sdk-no-host-storage`, `sdk-runtime-deps`, `sdk-lazy-lane-purity`, `sdk-no-html-sink` all green |
| **Direct-ingest rows** | `npx playwright test e2e/ingest.spec.ts -g "JPEG"` |
| **Estimated runtime** | ~6–10 min full suite (3 projects, serial workers) |

---

## Sampling Rate

- **After every task commit:** `npm run build && npm run check:size && npm run gate`, plus the single spec file for the touched area on one project.
- **After every plan wave — waves 1–4:** run the wave's own `<automated>` commands, which are all `-g`-scoped rows (plus the size and static gates). Do **not** run the unscoped `sdk.spec.ts` here: 03-03 (wave 1) inserts the composer between the launcher and the POST, so the ~41 Phase 2 rows that ended at `Report sent ✓` went red from wave 1 until 03-07 migrated them. That interim red widget suite was **expected** — do not repair those rows ahead of the migration plan.
- **After wave 5:** `npm run verify` (all three projects) — the only point at which the unscoped suite is a valid gate. **Executed at `432b24b`: PASSED** (`test-results/.last-run.json` = `{"status":"passed","failedTests":[]}`, completed 2026-10-28T23:13:34 local; re-confirmed on the final closeout tree).
- **Before `/gsd-verify-work`:** full suite green on chromium **+ firefox + webkit** and `check:size` PASS.
- **Max feedback latency:** ~180 s (build + size gate + gate + one-project spec file).

---

## Per-Task Verification Map

> Audited by validate-phase on 2026-10-28 against the seven executed plans (03-01…03-07)
> and their SUMMARYs. Task/Plan/Wave columns now name the real plans. Every row is an
> **artifact-level** assertion — decoded outgoing bytes, a decoded stored blob, an HTTP
> response, or the emitted bundle. No function-boundary tests. Status `green` = the row
> exists in the named spec file and passed inside the full-suite run above (and inside
> the plan-level `-g` runs recorded in each SUMMARY).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-04 T1 | 03-04 | 2 | CAP-03 | — | A blank/uniform capture never posts; zero `POST /api/incidents` before the user chooses | e2e | `npx playwright test e2e/sdk.spec.ts -g "CAP-03" --project=chromium` | ✅ | 🟢 green |
| 03-04 T2 | 03-04 | 2 | CAP-03 | T-03-01 | Capture denied → degraded composer with notice + both actions → text-only filing reaches a real `201` | e2e (real stack) | `npx playwright test e2e/sdk.spec.ts -g "CAP-03" --project=chromium` | ✅ | 🟢 green |
| 03-04 T2 | 03-04 | 2 | CAP-03 | — | A capture-less browser (no `getDisplayMedia`) still files text-only feedback | e2e | `npx playwright test e2e/sdk.spec.ts -g "CAP-03 no-API" --project=chromium` | ✅ | 🟢 green |
| 03-04 T1 | 03-04 | 2 | CAP-02 | T-03-02 | Attach PNG → outgoing image decodes at the attached picture's dimensions and is non-blank | e2e | `npx playwright test e2e/sdk.spec.ts -g "CAP-02 attach" --project=chromium` | ✅ | 🟢 green |
| 03-04 T1 | 03-04 | 2 | CAP-02 | T-03-02 | Attach WebP + JPEG → same contract; JPEG on the wire is WebP or PNG (single encode sink) | e2e | `npx playwright test e2e/sdk.spec.ts -g "CAP-02 attach" --project=webkit` | ✅ | 🟢 green |
| 03-04 T2 | 03-04 | 2 | CAP-02 | T-03-02 | Attach rejects non-image / oversized-pixel file with the inline error and no request | e2e | `npx playwright test e2e/sdk.spec.ts -g "CAP-02 reject" --project=chromium` | ✅ | 🟢 green |
| 03-02 T1 | 03-02 | 2 | CAP-02 (server) | T-03-03 | Direct `POST` of a real JPEG → `201`, `content_type = 'image/jpeg'`, blob route serves `image/jpeg` + `nosniff` + `attachment` | e2e (API) | `npx playwright test e2e/ingest.spec.ts -g "JPEG" --project=chromium` | ✅ | 🟢 green |
| 03-02 T2 | 03-02 | 2 | CAP-02 (server) | T-03-03 | A >16 MP JPEG is rejected **before** sharp; SVG/GIF still rejected | e2e (API) | `npx playwright test e2e/ingest.spec.ts -g "JPEG" --project=chromium` | ✅ | 🟢 green |
| 03-05 T1 | 03-05 | 3 | ANN-01 | — | Freehand drag → decoded image carries accent-ink pixels along the dragged path and none off it | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-01" --project=chromium` | ✅ | 🟢 green |
| 03-05 T2 | 03-05 | 3 | ANN-02 | — | Arrow drag → ink at tail, at head, and a head wider than the shaft | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-02" --project=chromium` | ✅ | 🟢 green |
| 03-05 T2 | 03-05 | 3 | ANN-03 | — | Rectangle drag → ink on the four edges, interior unchanged | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-03" --project=chromium` | ✅ | 🟢 green |
| 03-05 T2 | 03-05 | 3 | ANN-04 | — | Text label → ink inside the anchor box; `Enter` and click-outside both confirm; no modal | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-04" --project=chromium` | ✅ | 🟢 green |
| 03-06 T1 | 03-06 | 4 | ANN-05 | T-03-04 | Mask drag → flat opaque fill inside the rect, control region untouched | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-05" --project=chromium` | ✅ | 🟢 green |
| 03-05 T3 | 03-05 | 3 | ANN-06 | — | Two strokes then one undo → only the first stroke's ink survives; a mask is never removed | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-06" --project=chromium` | ✅ | 🟢 green |
| 03-06 T1 | 03-06 | 4 | PRV-04 | T-03-05 | **CA-02**: mask over a magenta marker → `insideMagenta === 0` **and** `ringMagenta === 0`; interior black ≥ 0.98; control region intact | e2e | `npx playwright test e2e/sdk.spec.ts -g "PRV-04" --project=chromium` | ✅ | 🟢 green |
| 03-06 T3 | 03-06 | 4 | PRV-04 | T-03-05 | A freehand stroke drawn **across** the masked region cannot resurrect pixels (T3 order) | e2e | `npx playwright test e2e/sdk.spec.ts -g "PRV-04 stroke" --project=chromium` | ✅ | 🟢 green |
| 03-06 T2 | 03-06 | 4 | PRV-04 | T-03-05 | Pixelate mode → mechanism asserted, not colour survival: grid-snapped outward to a block ≥ `max(8 px, 2× cap-height)`, every block uniform, α = 255, distinct colours ≤ block count (see 03-06 "Flagged assumptions") | e2e | `npx playwright test e2e/sdk.spec.ts -g "PRV-04 pixelate" --project=chromium` | ✅ | 🟢 green |
| 03-06 T3 | 03-06 | 4 | PRV-04 | T-03-05 | DPR 1 / 1.25 / 2 / 3 editor mask rows (H-1 geometry in the editor) | e2e ×4 | `npx playwright test e2e/sdk.spec.ts -g "PRV-04 DPR" --project=chromium` | ✅ | 🟢 green |
| 03-03 T1 | 03-03 | 1 | PRV-07 | — | Review renders the flattened image + type/title/note; `Edit report` returns with state intact; `Send report` posts exactly once | e2e | `npx playwright test e2e/sdk.spec.ts -g "PRV-07" --project=chromium` | ✅ | 🟢 green |
| 03-03 T3 | 03-03 | 1 | WDG-06 | — | Default locale: `.wrap[lang]` matches the resolved locale, EN copy rendered (extends the existing `F-08` row) | e2e | `npx playwright test e2e/sdk.spec.ts -g "WDG-06" --project=chromium` | ✅ | 🟢 green |
| 03-03 T3 | 03-03 | 1 | WDG-06 | — | `test.use({ locale: 'es-ES' })` → auto-detected Spanish copy + `lang="es"` on launcher, status, composer, review | e2e | `npx playwright test e2e/sdk.spec.ts -g "WDG-06 es" --project=chromium` | ✅ | 🟢 green |
| 03-03 T3 | 03-03 | 1 | WDG-06 | — | Manual EN/ES override switches visible copy **and** `lang`, in both directions | e2e | `npx playwright test e2e/sdk.spec.ts -g "WDG-06 override" --project=chromium` | ✅ | 🟢 green |
| 03-05 T3 | 03-05 | 3 | WDG-06 | — | Editor chrome localises too (toolbar aria-labels + `Done`) after `Annotate image` | e2e | `npx playwright test e2e/sdk.spec.ts -g "WDG-06 editor" --project=chromium` | ✅ | 🟢 green |
| 03-07 T3 | 03-07 | 5 | PRF-02 | — | Chunk ≤ 25 KB gz | size gate | `npm run build && npm run check:size` | ✅ | 🟢 green |
| 03-05 T1 | 03-05 | 3 | PRF-02 | — | **Laziness**: zero requests for `watchbug-annotator.mjs` while the composer is open; exactly one after `Annotate image` | e2e | `npx playwright test e2e/sdk.spec.ts -g "PRF-02 lazy" --project=chromium` | ✅ | 🟢 green |
| 03-07 T3 | 03-07 | 5 | PRF-03 | — | Runtime total ≤ 80 KB gz | size gate | `npm run build && npm run check:size` | ✅ | 🟢 green |

*Status: ⬜ pending · 🟢 green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `e2e/helpers/composer.ts` — `waitForComposer`, `setTitle`, `setNote`, `setType`, `reviewAndSend`, `completeComposer` (authored in 03-07 Task 1; used by the migrated rows and every new row).
- [x] `e2e/helpers/editor.ts` — `selectTool`, `dragOnCanvas(bitmapFrom, bitmapTo)`, `undo`, `done`, plus the canvas→viewport mapping (authored by 03-05, extended by 03-06 with the integer-coordinate DPR harness).
- [x] `e2e/helpers/host-fixtures.ts` — `BundleName`/`serveBundle` extended by 03-05 to serve the sibling annotator chunk.
- [x] `e2e/fixtures/valid-64x64.jpg`, `oversize-64mp.jpg` and `rotated-exif-80x40.jpg` — generated by `e2e/make-fixtures.mjs` (03-01/03-02).
- [x] Composer / editor / review DOM contracts decided before the first e2e row (03-UI-SPEC.md + 03-CONTEXT.md; open-mode shadow root is the only query surface).
- [x] No framework install needed. No unit-test files. No coverage config — prohibited by R-12.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-picker capture → composer with the true screen content | CAP-02/03 | `getDisplayMedia` cannot be automated past the browser picker; the e2e path uses the capture stub | `npm run dev`, open the hostile fixture, click the launcher, accept the picker, confirm the composer shows the real screen with password fields flat-filled |
| Mask irreversibility by eyeball on a real photo | PRV-04 | Lossy-encode tolerance is asserted numerically in e2e; a human check catches visually plausible-but-recoverable artefacts | Mask a face in a real screenshot, send, download the stored blob, attempt contrast/brightness recovery on the region |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated (automated set green at `432b24b` / closeout HEAD; the two Manual-Only rows and the D8 never-prohibitions judgment items ride `/gsd-verify-work 03`)

## Validation Audit

### 2026-10-28 — validate-phase (post-execution audit)
- Gaps found: 0 · Resolved: 27 · Escalated: 2 (pre-existing Manual-Only rows, unchanged)
- Seeded draft rows rewritten against executed plans 03-01…03-07; every automated row verified green inside the full `npm run verify` pass at `432b24b` (453 tests, 3 projects) and per-plan `-g` runs in each SUMMARY.

## Validation Audit 2026-10-28

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 27 |
| Escalated | 2 |
