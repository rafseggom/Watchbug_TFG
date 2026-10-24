---
status: testing
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
source: [02-VERIFICATION.md]
started: 2026-10-24T19:05:00Z
updated: 2026-10-24T19:05:00Z
---

## Current Test

number: 1
name: Run one real (unstubbed) capture in chromium and firefox
expected: |
  The OS picker appears; a real tab frame is captured; the host page is hidden
  during the grab; the report returns 201 and renders in the panel; no widget
  chrome pixels in the stored screenshot.
awaiting: user response

## Tests

### 1. Real (unstubbed) capture in chromium and firefox
expected: Serve any host page over http://localhost or HTTPS, click the Watchbug launcher, complete the OS screen-share picker. The OS picker appears; a real tab frame is captured; the host page is hidden during the grab; the report returns 201 and renders in the panel; no widget chrome pixels in the stored screenshot.
result: [pending]

### 2. Visual/interaction pass vs 02-UI-SPEC.md
expected: Geometry, copy, roles (status/alert), reduced-motion branch and action labels match the UI-SPEC contract on all three engines — idle, Capturing…, Sending…, Retrying (n of 3), Report sent, each terminal failure headline/hint/action pair, plus the 12x12 spinner, 240-char truncation and 320 px panel.
result: [pending]

### 3. Decide the disposition of review finding CR-03 (open, critical)
expected: Owner either (a) accepts the bounded guarantee "PRV-01/02/03 hold for top-document light-DOM content" for v1 and registers the scope in 02-SECURITY.md / integration docs, or (b) schedules a recursive per-document scan in a later phase. Note: shadow roots and same-origin iframes are never scanned today (redactor.ts:85,91,103), and 02-SECURITY.md's AR-01 covers only CROSS-origin iframes — threats_open: 0 currently overstates coverage.
result: [pending]

### 4. Decide the disposition of UI finding F-08 (missing lang attribute)
expected: Either a one-line lang='en' fix lands (Phase 3 will need lang switching anyway) or the finding is explicitly deferred to Phase 3 with the widget copy. `all: initial` clears inherited lang; setAttribute('lang') has 0 matches under packages/sdk/src.
result: [pending]

### 5. Close or accept WINDOWS.md item #5 (unmet-truth, phase 02)
expected: Owner edits the release-criteria wording in REQUIREMENTS.md to match A-14 (documentation/resolution-record.md), or records the wording as intentionally kept. The plan was not authorised to edit this wording.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

None — 38/38 must-haves verified at the artifact/e2e level; these 5 items are human-only checks (real OS picker, visual pass, and three owner scope/wording decisions).
