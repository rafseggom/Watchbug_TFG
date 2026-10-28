---
phase: "3"
slug: "report-composer-annotation-editor-lazy"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-28"
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
| **Static gates** | `npm run gate` — must keep `sdk-single-encode-sink`, `sdk-no-host-storage`, `sdk-runtime-deps` green |
| **Direct-ingest rows** | `npx playwright test e2e/ingest.spec.ts -g "JPEG"` |
| **Estimated runtime** | ~6–10 min full suite (3 projects, serial workers) |

---

## Sampling Rate

- **After every task commit:** `npm run build && npm run check:size && npm run gate`, plus the single spec file for the touched area on one project.
- **After every plan wave — waves 1–4:** run the wave's own `<automated>` commands, which are all `-g`-scoped rows (plus the size and static gates). Do **not** run the unscoped `sdk.spec.ts` here: 03-03 (wave 1) inserts the composer between the launcher and the POST, so the ~30 Phase 2 rows that end at `Report sent ✓` go red from wave 1 until 03-07 Task 2 migrates them. That interim red widget suite is **expected** — do not repair those rows ahead of the migration plan.
- **After wave 5:** `npm run verify` (all three projects) — the only point at which the unscoped suite is a valid gate.
- **Before `/gsd-verify-work`:** full suite green on chromium **+ firefox + webkit** and `check:size` PASS.
- **Max feedback latency:** ~180 s (build + size gate + gate + one-project spec file).

---

## Per-Task Verification Map

> Populated at requirement granularity when the plan is seeded; `validate-phase`
> rewrites the Task ID/Plan/Wave columns against the real `03-NN-PLAN.md` task list.
> Every row is an **artifact-level** assertion — decoded outgoing bytes, a decoded
> stored blob, an HTTP response, or the emitted bundle. No function-boundary tests.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-TBD | TBD | 1 | CAP-03 | — | A blank/uniform capture never posts; zero `POST /api/incidents` before the user chooses | e2e | `npx playwright test e2e/sdk.spec.ts -g "CAP-03" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 1 | CAP-03 | T-03-01 | Capture denied → degraded composer with notice + both actions → text-only filing reaches a real `201` | e2e (real stack) | `npx playwright test e2e/sdk.spec.ts -g "CAP-03" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 1 | CAP-03 | — | A capture-less browser (no `getDisplayMedia`) still files text-only feedback | e2e | `npx playwright test e2e/sdk.spec.ts -g "CAP-03 no-API" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 3 | CAP-02 | T-03-02 | Attach PNG → outgoing image decodes at the attached picture's dimensions and is non-blank | e2e | `npx playwright test e2e/sdk.spec.ts -g "CAP-02 attach" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 3 | CAP-02 | T-03-02 | Attach WebP + JPEG → same contract; JPEG on the wire is WebP or PNG (single encode sink) | e2e | `npx playwright test e2e/sdk.spec.ts -g "CAP-02 attach" --project=webkit` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 3 | CAP-02 | T-03-02 | Attach rejects non-image / oversized-pixel file with the inline error and no request | e2e | `npx playwright test e2e/sdk.spec.ts -g "CAP-02 reject" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 3 | CAP-02 (server) | T-03-03 | Direct `POST` of a real JPEG → `201`, `content_type = 'image/jpeg'`, blob route serves `image/jpeg` + `nosniff` + `attachment` | e2e (API) | `npx playwright test e2e/ingest.spec.ts -g "JPEG" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 3 | CAP-02 (server) | T-03-03 | A >16 MP JPEG is rejected **before** sharp; SVG/GIF still rejected | e2e (API) | `npx playwright test e2e/ingest.spec.ts -g "JPEG" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 2 | ANN-01 | — | Freehand drag → decoded image carries accent-ink pixels along the dragged path and none off it | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-01" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 2 | ANN-02 | — | Arrow drag → ink at tail, at head, and a head wider than the shaft | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-02" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 2 | ANN-03 | — | Rectangle drag → ink on the four edges, interior unchanged | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-03" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 2 | ANN-04 | — | Text label → ink inside the anchor box; `Enter` and click-outside both confirm; no modal | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-04" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 2 | ANN-05 | T-03-04 | Mask drag → flat opaque fill inside the rect, control region untouched | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-05" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 2 | ANN-06 | — | Two strokes then one undo → only the first stroke's ink survives; a mask is never removed | e2e | `npx playwright test e2e/sdk.spec.ts -g "ANN-06" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 2 | PRV-04 | T-03-05 | **CA-02**: mask over a magenta marker → `insideMagenta === 0` **and** `ringMagenta === 0`; interior black ≥ 0.98; control region intact | e2e | `npx playwright test e2e/sdk.spec.ts -g "PRV-04" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 2 | PRV-04 | T-03-05 | A freehand stroke drawn **across** the masked region cannot resurrect pixels (T3 order) | e2e | `npx playwright test e2e/sdk.spec.ts -g "PRV-04 stroke" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 4 | PRV-04 | T-03-05 | Pixelate mode → the mechanism is asserted, not colour survival: region grid-snapped outward to a block ≥ `max(8 px, 2× cap-height)`, every block uniform, α = 255, distinct colours ≤ block count. (A uniform source averages to its own colour, so "no original colour survives" is unsatisfiable and is deliberately not asserted — see 03-06 "Flagged assumptions".) | e2e | `npx playwright test e2e/sdk.spec.ts -g "PRV-04 pixelate" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 2 | PRV-04 | T-03-05 | DPR 1 / 1.25 / 2 / 3 editor mask rows (H-1 geometry in the editor) | e2e ×4 | `npx playwright test e2e/sdk.spec.ts -g "PRV-04 DPR" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 1 | PRV-07 | — | Review renders the flattened image + type/title/note; `Edit report` returns with state intact; `Send report` posts exactly once | e2e | `npx playwright test e2e/sdk.spec.ts -g "PRV-07" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 1 | WDG-06 | — | Default locale: `.wrap[lang]` matches the resolved locale, EN copy rendered (extends the existing `F-08` row) | e2e | `npx playwright test e2e/sdk.spec.ts -g "WDG-06" --project=chromium` | ⚠ edit | ⬜ pending |
| 03-TBD | TBD | 1 | WDG-06 | — | `test.use({ locale: 'es-ES' })` → auto-detected Spanish copy + `lang="es"` on launcher, status, composer, review | e2e | `npx playwright test e2e/sdk.spec.ts -g "WDG-06 es" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 1 | WDG-06 | — | Manual EN/ES override switches visible copy **and** `lang`, in both directions | e2e | `npx playwright test e2e/sdk.spec.ts -g "WDG-06 override" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 2 | WDG-06 | — | Editor chrome localises too (toolbar aria-labels + `Done`) after `Annotate image` | e2e | `npx playwright test e2e/sdk.spec.ts -g "WDG-06 editor" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 4 | PRF-02 | — | Chunk ≤ 25 KB gz | size gate | `npm run build && npm run check:size` | ✅ | ⬜ pending |
| 03-TBD | TBD | 4 | PRF-02 | — | **Laziness**: zero requests for `watchbug-annotator.mjs` while the composer is open; exactly one after `Annotate image` | e2e | `npx playwright test e2e/sdk.spec.ts -g "PRF-02 lazy" --project=chromium` | ❌ W0 | ⬜ pending |
| 03-TBD | TBD | 4 | PRF-03 | — | Runtime total ≤ 80 KB gz | size gate | `npm run build && npm run check:size` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/helpers/composer.ts` — `waitForComposer`, `setTitle`, `setNote`, `setType`, `reviewAndSend`, `completeComposer` (used by the ~30 migrated rows **and** every new row).
- [ ] `e2e/helpers/editor.ts` — `selectTool`, `dragOnCanvas(bitmapFrom, bitmapTo)`, `undo`, `done`, plus the canvas→viewport mapping (documented beside the SDK's mapping, never imported from it).
- [ ] `e2e/helpers/host-fixtures.ts` — extend `BundleName` and `serveBundle` to serve the sibling annotator chunk (today it 404s any bundle whose basename differs from the one requested).
- [ ] `e2e/fixtures/valid-64x64.jpg` and an oversized JPEG fixture, generated by `e2e/make-fixtures.mjs` (already drives `sharp`).
- [ ] The composer / editor / review DOM contracts (class names, `data-*` hooks) must be **decided before the first e2e row is written** — the open-mode shadow root is the only query surface.
- [ ] No framework install needed. No unit-test files. No coverage config — prohibited by R-12.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-picker capture → composer with the true screen content | CAP-02/03 | `getDisplayMedia` cannot be automated past the browser picker; the e2e path uses the capture stub | `npm run dev`, open the hostile fixture, click the launcher, accept the picker, confirm the composer shows the real screen with password fields flat-filled |
| Mask irreversibility by eyeball on a real photo | PRV-04 | Lossy-encode tolerance is asserted numerically in e2e; a human check catches visually plausible-but-recoverable artefacts | Mask a face in a real screenshot, send, download the stored blob, attempt contrast/brightness recovery on the region |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
