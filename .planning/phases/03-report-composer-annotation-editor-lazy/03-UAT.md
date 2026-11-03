---
status: complete
phase: 03-report-composer-annotation-editor-lazy
source: [03-VERIFICATION.md]
started: 2026-10-29T00:05:00Z
updated: 2026-11-03T18:38:09.152Z
---

# Phase 03 — User Acceptance Testing

## Current Test

[testing complete]

## Tests

### 1. Real-picker capture → composer with the true screen content
expected: `npm run dev` (or the served panel), open a page, click the launcher, accept the picker — the composer shows the real screen content with `input[type=password]` and credential-pattern values destructively flat-filled before anything is encoded. (The e2e lane uses a capture stub; this exercises the true picker.)
result: pass

**Evidence (2026-11-03, headed Chromium, production `watchbug.js`, real `getDisplayMedia` picker, closed root):** the launcher opened the composer with the live tab; the stored blob (report `a47442be…`) showed the real page with `input[type=password]`, the Luhn-valid card `4111 1111 1111 1111`, `api_token=…`, the JWT, the `Bearer sk-live-…` text node and the `data-watchbug-sensitive` block all arriving as flat black rectangles; the widget was absent from the capture.

**Harness defect found here (not a product defect).** The first attempt showed every mask displaced: the harness had launched a headed browser with an **emulated** viewport (1280×860) while the real tab surface was 1920×952, so `transformFor()` scaled the rects by ×1.5 / ×1.107 into a frame that was not the viewport. Fixed by launching with `viewport: null` (real window) and `--force-device-scale-factor` for DPR. Full write-up: `documentation/continuity-pack.md` §11 and dead-end D-11. Re-run after the fix: registration 1:1 and all secrets covered.

### 2. Mask-irreversibility eyeball on a real photo (incl. opt-in Pixelate at DPR 2)
expected: Mask a face/text in a real screenshot and send; download the stored blob; the masked region yields nothing to contrast/brightness recovery. Also try opt-in Pixelate at devicePixelRatio 2 — blocks ≥ max(8px, 2× cap-height), letterforms not readable through the block grid (the HG-02 floor gap lives here).
result: pass

**Evidence A — Fill over an attached image (report `49198adf…`, 1024×1024).** Interior of the masked rect (600×140 = 84,000 px): **one colour only**, `rgb(0,0,0)` α=255 at **100 %**. Variance zero — there is no information left to recover by contrast, brightness or levels.

**Evidence B — Pixelate on a DPR-2 capture (report `2ae70d70…`, artifact 1280×574).** The masked band is a grid of **30×30 px** blocks: with the block grid aligned, the mean within-block standard deviation is **0.456** (WebP compression noise), while a deliberately misaligned 30 px grid scores 3.86; 19 distinct block means exist, so the region holds block averages rather than a single wash. High-contrast edge density inside the mask is **0.0023** against **0.1346** in untouched body text (**58× lower**) — no legible letterform survives. The 30 px block is far above the R-13 floor for the fixture's 8 px text.

**Note:** a first pixelate attempt (report `39652be8…`) came out as a Fill (solid, 98.3 % pure black) because the style was still on `Relleno`; re-run with the **Pixelar** toggle selected produced Evidence B. No product defect.

### 3. CR-01 interleaving: discard during encode
expected: Click Review (starts the one encode), then Discard mid-encode, then launch a capture that fails — the widget does NOT soft-lock (launcher stays usable without reload) and no Send-enabled review of a degraded draft ever appears.
result: pass

**Evidence:** Review → Discard during the encode → new gesture with the picker cancelled: the widget stayed visible and the launcher re-armed without reload; no review screen with `Send report` appeared over a degraded draft; the degraded composer offered only `Attach image` / `Continue with text only`. Matches the generation guard in `packages/sdk/src/index.ts` (`reviewDraft`) and the zero-post invariant.

### 4. HG-01: strokes beyond the undo cap
expected: Draw 21 freehand strokes in the editor, click Done — the FIRST stroke still survives in the exported image (it must not be silently evicted by the UNDO_LIMIT shift).
result: pass

**Evidence:** the first stroke was drawn as a distinctive circle, followed by 20 short strokes; after Done → Review → Send the circle was still present in the exported artifact. Consistent with `canvas-layer.ts` baking the canvas into `base` when the stroke stack reaches `UNDO_LIMIT`.

### 5. Backstop: 280-char review truncation
expected: Compose a note longer than 280 code points → the review screen shows the truncated reason with the ellipsis, while the wire/meta carries the full note value unchanged.
result: pass

**Evidence:** a 339-character note ending in `FIN-DEL-TEXTO.` was composed. In the review screen's **Detalles** row the value ended in **“…”** and did **not** contain `FIN-DEL-TEXTO`; the stored `meta.note` (report `45c132bc…`) carries all **339 characters** and ends in `FIN-DEL-TEXTO.` — the display cap never reached the wire.

### 6. Backstop: long localized heading word-wrap
expected: Switch to ES and trigger a long-word heading in the 720 px overlay (e.g. a long server reason) — no horizontal overflow of the composer/review card.
result: pass

**Evidence:** with the widget in Spanish and the window narrowed to ~650–700 px (`width: min(720px, 100vw − 32px)`), the heading rendered complete, an unbroken ~130-character URL token wrapped across several lines inside the card, and no horizontal scrollbar or clipped control appeared.

### 7. D8 never-prohibitions owner sign-off
expected: Owner confirms the 03-07 judgment items: no e2e rows deleted or skipped, no vacuous migration of the 41 rows (assertions untouched, helper-only walk), size tiers never relaxed (45/25/80 unchanged in check-size.mjs). Statically corroborated (29 completeComposer sites, zero skips, thresholds unchanged) — the sign-off itself is the owner's call.
result: pass

**Evidence presented to the owner (2026-11-03):**

1. **No row deleted, renamed away or skipped.** `03-08-CONVERSION-LEDGER.md` gives each of the **152** baseline rows exactly one disposition: **90 kept-in-journey**, **62 converted** to unit/integration/contract/VRT/packaging with the target file named per row, and **1 justified-redundant** (the panel i18n default, covered by J-12). The suite currently holds **90 top-level rows** (sdk 79 + hostile 9 + ingest 2), exactly the 90 kept. Zero `test.skip` / `xit` / `fixme` / `todo` in `e2e/` or `tests/` (the only match is the detector regex in `tests/packaging/journey-cap.test.ts`).
2. **No vacuous migration.** The 62 converted rows live in the cheaper layer named by the ledger; the 90 kept are the same behaviours inside J-01…J-20. The suite was green at 2026-10-29 18:24, **after** the last test commit (`aa5b4bb`, 17:59). Declared limit: the 152 new assertions were not read line by line — the ledger plus the green run is the evidence.
3. **Size tiers never relaxed.** `scripts/check-size.mjs` still enforces core **45 KB**, lazy **25 KB** (floor 2 KB) and runtime **80 KB**; no phase-3 commit raised a limit.

**Owner verdict:** confirmed (`Todo correcto`, 2026-11-03).

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None against the product. The only defect surfaced by this UAT was in the **manual harness** (emulated viewport vs. real tab surface), documented in `documentation/continuity-pack.md` §11 / dead-end D-11 so it cannot recur.

The three review findings that the automated suite could not reach are now empirically closed: **CR-01** (generation guard, test 3), **HG-01** (bake-to-base at the undo cap, test 4) and **HG-02** (pixelation floor in bitmap space, test 2 Evidence B).

Residual, not a UAT gap: the SDK trusts `frame = viewport × DPR` and has no mismatch guard; a registration break would misplace masks silently. Candidate fail-closed hardening recorded in `continuity-pack.md` §11 for Phase 4/7 planning.
