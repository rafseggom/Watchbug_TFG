# 03-08 Conversion Ledger

**Purpose:** Every one of the 152 original e2e tests (148 source `test()` declarations + 4 generated) must have exactly one disposition:
- `kept-in-journey` — remains in the e2e suite as part of a J-01..J-20 core journey
- `converted(target-file)` — re-homed to unit/integration/contract/VRT/packaging
- `justified-redundant` — explicitly redundant, justified in this ledger

**No silent drops.** Any row without an entry is a coverage gap.

---

## Baseline Inventory (from `/tmp/opencode/baseline-tests.txt`)

| Spec File | Test Count | Notes |
|-----------|------------|-------|
| e2e/sdk.spec.ts | 88 | Widget, capture, redaction, annotation, transport |
| e2e/hostile.spec.ts | 27 | Oversize, content, naming, rate limits, sanitisation |
| e2e/ingest.spec.ts | 23 | Schema validation, idempotency, text-only, onboarding |
| e2e/deploy.spec.ts | 7 | Compose, CSP, health, env vars, boot fail-fast |
| e2e/read-surface.spec.ts | 3 | Rate limiting, pagination, malformed params |
| **Total** | **148** | Source declarations |

---

## Conversion Log

### Task 1 — Tracer Foundation (Batch 1c)

| # | Original Spec / Test Title | Disposition | Target File / Justification | Commit |
|---|----------------------------|-------------|----------------------------|--------|
| 1 | `ingest.spec.ts` — "R-08/S-5: meta.url is stored path-only — query string and fragment stripped on ingest" | `converted` | `tests/integration/url-stripping.test.ts` (3 tests) | — |
| 2 | `ingest.spec.ts` — "ING-03: same Idempotency-Key replays the same id and stores one row" | `kept-in-journey` | J-10 (resilience) | — |
| 3 | `ingest.spec.ts` — "ING-03: concurrent pair with one key yields one row" | `kept-in-journey` | J-10 (resilience) | — |
| 4 | `ingest.spec.ts` — "ING-03 (Q6): missing Idempotency-Key → 400 structured body" | `converted` | `tests/integration/` (pending) | — |
| 5 | `ingest.spec.ts` — "CAP-03 text-only: a meta-only submission stores a row with no screenshot" | `kept-in-journey` | J-07 (degraded capture) | — |
| ... | (remaining 143 tests to be classified in Tasks 2–4) | | | |

---

## Summary Counts (running)

| Disposition | Count |
|-------------|-------|
| kept-in-journey | 2 |
| converted | 1 (3 sub-tests) |
| justified-redundant | 0 |
| **Unclassified** | **145** |

---

## Journey Mapping (J-01..J-14 widget subset)

| Journey | Spec Tests Kept |
|---------|-----------------|
| J-01: Script tag + init() | INT-01, INT-05, WDG-01, WDG-04 |
| J-02: Golden path | CAP-01, ING-01, ENR-06, PRV-07, CA-01 |
| J-03: Capture integrity | CAP-04, M-6, P2-D-12, OQ-1 |
| J-04: Auto-redaction T1 | PRV-01/02/03, SEC-01/02, R-13 |
| J-05: Manual mask T2/T3 | ANN-05/06, PRV-04, CA-02 |
| J-06: Full annotation | ANN-01..04, ANN-06, PRF-02, C-2 |
| J-07: Degraded capture | CAP-02, CAP-03 |
| J-08: HiDPI fidelity | CAP-05, H-1 |
| J-09: WebP→PNG fallback | M-3, R-11, A-14 |
| J-10: Transport resilience | ING-03, P2-D-03 |
| J-11: Payload privacy | PRV-05, PRV-06, SEC-03 |
| J-12: i18n en/es | WDG-06, RNF-03 |
| J-13: Size budget | PRF-01..04, CA-03 |
| J-14: Hostile CSS isolation | WDG-02/03/05, CA-04 |

---

## Notes

- Security rows (PRV-01..04, CA-02 decoded-bytes) **stay e2e** per R-19 — artifact-level evidence must not be downgraded.
- The ledger will be updated after each batch checkpoint.
- Final audit in Task 5 must show 152 accounted for with no gaps.