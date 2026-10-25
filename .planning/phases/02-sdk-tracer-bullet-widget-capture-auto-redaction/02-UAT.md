---
status: complete
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
source: [02-VERIFICATION.md]
started: 2026-10-24T19:05:00Z
updated: 2026-10-25T15:35:00Z
---

# Phase 02 — User Acceptance Testing

## Current Test

<!-- Cleared on completion: all five checks passed (2026-10-25). -->

## Tests

### 1. Real (unstubbed) capture in chromium and firefox
expected: Serve a host page over http://127.0.0.1:8080, click the launcher and complete the OS screen-share picker. The picker appears; a real tab/window frame is captured; the host page is hidden during the grab; the report returns 201 and renders in the panel; no widget chrome pixels appear in the stored screenshot.
result: pass

**Evidence (2026-10-25, chromium + firefox, production `watchbug.js`, closed root, no capture stub):** both engines showed the real OS picker; the host hid during the grab; the panel reached `Report sent ✓` and a new row appeared at `http://127.0.0.1:8080/`; the stored screenshot showed the `input[type=password]` value and the `data-watchbug-sensitive` block as flat black rectangles; the widget was absent from the captured image.

**Defect found here:** the first run (minimal fixture: white page + one heading) aborted with `The capture came back blank.` The old probe sampled a fixed 3×3 grid and none of the nine points landed on the heading. Fixed by a dense uniformity scan + regression row `P2-D-12: a sparse but real page … is not blank`. Re-run after the fix: passed on both engines.

### 2. Visual/interaction pass vs 02-UI-SPEC.md
expected: Geometry, copy, roles (status/alert), reduced-motion branch and action labels match the UI-SPEC contract on all three engines — idle, Capturing…, Sending…, Retrying (n of 3), Report sent, each terminal failure, the 12×12 spinner, 240-char truncation and the 320 px panel.
result: pass

**Evidence:** manual run (chromium + firefox) confirmed idle launcher, `Capturing…`, `Sending…`, `Report sent ✓`, the disabled/dimmed launcher while the panel was open, and the masked regions in the stored image. The full state matrix (every terminal failure, spinner motion, reduced motion, focus ring, 240-char truncation, 320 px panel) is `02-UI-REVIEW.md` — **22/24 PASS, 0 BLOCK**. The two MAJOR findings were F-01 (EN-only copy → Phase 3) and F-08 (missing `lang`, fixed in test 4).

### 3. Decide the disposition of review finding CR-03 (critical)
expected: Either accept the bounded "top-document light-DOM only" guarantee and document it, or schedule the recursive per-document scan.
result: pass

**Resolution:** resolved by code, not deferred. The scanner now walks every reachable root — light DOM, open shadow roots and same-origin iframes — with `MAX_SCAN_DEPTH = 8`, coordinate translation per frame origin, and a loud throw on depth exhaustion. Evidence: `S-7 / PRV-02` row (secret inside an open shadow root and inside a same-origin iframe, decoded bytes clean). Closed roots and cross-origin frames remain the documented limitation (T-02-14 / AR-01).

### 4. Decide the disposition of UI finding F-08 (missing lang attribute)
expected: Land a one-line `lang` fix now, or defer it to Phase 3 with the widget copy.
result: pass

**Resolution:** fixed now (2026-10-25). `mountHost()` sets `lang="en"` on the `.wrap` content root; the copy is English-only until Phase 3's locale resolver, which will replace the literal, not the mechanism. New e2e row `F-08: the widget content declares lang="en" …` asserts both the attribute and the resolved language of the launcher.

### 5. Close or accept WINDOWS.md item #5 (unmet-truth, phase 02)
expected: Edit the release-criteria wording in REQUIREMENTS.md to match A-14, or record the wording as intentionally kept.
result: pass

**Resolution (owner-approved edit):** `REQUIREMENTS.md` release criteria now say webkit covers engine-divergent rendering and the `CaptureSource`-seam capture tier, that the silent WebP→PNG fallback is covered by the forced-PNG stub because this platform's WebKit encodes real WebP (A-14), and that firefox covers the no-`ImageCapture` path. `gsd-tools windows fixed 5` recorded the closure.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. The one defect surfaced by this UAT (blank-probe false positive on a
sparse real page) was fixed and covered by an e2e regression row before
closing.
