---
status: testing
phase: 01-contracts-ingest-slice
source: [01-VERIFICATION.md]
started: 2026-10-12T22:28:57Z
updated: 2026-10-12T22:28:57Z
---

## Current Test

number: 1
name: Interrupted-start restart of the compose stack (see behavior_unverified_items[0])
expected: |
  db healthy before api starts; deploy e2e green against the freshly restarted stack
awaiting: user response

## Tests

### 1. Interrupted-start restart of the compose stack (see behavior_unverified_items[0])
expected: db healthy before api starts; deploy e2e green against the freshly restarted stack
result: [pending]

### 2. Parallel burst over a small per-key rate limit (see behavior_unverified_items[1])
expected: at most the configured maximum passes; the rest 429 with Retry-After
result: [pending]

### 3. Clean-checkout first boot (01-VALIDATION.md manual-only row): `cp .env.example .env`, `npm run key:gen` into `WATCHBUG_PROJECT_KEY`, `docker compose up -d` from a fresh clone, open http://127.0.0.1:8080
expected: Stack comes up with no manual step beyond the `.env` copy; the panel shows the empty state with the onboarding curl
result: [pending]

### 4. Panel visual check in a browser: two-column list/detail layout, light/dark tokens (`prefers-color-scheme`), language switcher (English/Español) and empty state
expected: Layout renders as designed (P1-D-04/P1-D-06), switching language visibly changes labels, no hardcoded colours
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
