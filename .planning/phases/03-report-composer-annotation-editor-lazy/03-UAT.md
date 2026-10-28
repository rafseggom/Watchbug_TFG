---
status: testing
phase: 03-report-composer-annotation-editor-lazy
source: [03-VERIFICATION.md]
started: 2026-10-29T00:05:00Z
updated: 2026-10-29T00:05:00Z
---

## Current Test

number: 1
name: Real-picker capture → composer with the true screen content
expected: |
  After accepting the browser's getDisplayMedia picker, the composer shows the real
  screen; password fields and credential-pattern text arrive flat-filled.
awaiting: user response

## Tests

### 1. Real-picker capture → composer with the true screen content
expected: `npm run dev` (or the served panel), open a page, click the launcher, accept the picker — the composer shows the real screen content with `input[type=password]` and credential-pattern values destructively flat-filled before anything is encoded. (The e2e lane uses a capture stub; this exercises the true picker.)
result: [pending]

### 2. Mask-irreversibility eyeball on a real photo (incl. opt-in Pixelate at DPR 2)
expected: Mask a face/text in a real screenshot and send; download the stored blob; the masked region yields nothing to contrast/brightness recovery. Also try opt-in Pixelate at devicePixelRatio 2 — blocks ≥ max(8px, 2× cap-height), letterforms not readable through the block grid (the HG-02 floor gap lives here).
result: [pending]

### 3. CR-01 interleaving: discard during encode
expected: Click Review (starts the one encode), then Discard mid-encode, then launch a capture that fails — the widget does NOT soft-lock (launcher stays usable without reload) and no Send-enabled review of a degraded draft ever appears.
result: [pending]

### 4. HG-01: strokes beyond the undo cap
expected: Draw 21 freehand strokes in the editor, click Done — the FIRST stroke still survives in the exported image (it must not be silently evicted by the UNDO_LIMIT shift).
result: [pending]

### 5. Backstop: 280-char review truncation
expected: Compose a note longer than 280 code points → the review screen shows the truncated reason with the ellipsis, while the wire/meta carries the full note value unchanged.
result: [pending]

### 6. Backstop: long localized heading word-wrap
expected: Switch to ES and trigger a long-word heading in the 720 px overlay (e.g. a long server reason) — no horizontal overflow of the composer/review card.
result: [pending]

### 7. D8 never-prohibitions owner sign-off
expected: Owner confirms the 03-07 judgment items: no e2e rows deleted or skipped, no vacuous migration of the 41 rows (assertions untouched, helper-only walk), size tiers never relaxed (45/25/80 unchanged in check-size.mjs). Statically corroborated (29 completeComposer sites, zero skips, thresholds unchanged) — the sign-off itself is the owner's call.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
