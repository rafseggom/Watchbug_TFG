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
| 1 | `ingest.spec.ts` — "R-08/S-5: meta.url is stored path-only — query string and fragment stripped on ingest" | `converted` | `tests/integration/url-stripping.test.ts` (3 tests) | 792ab96 |
| 2 | `ingest.spec.ts` — "ING-03: same Idempotency-Key replays the same id and stores one row" | `converted` | `tests/integration/ingest-idempotency.test.ts` | 792ab96 |
| 3 | `ingest.spec.ts` — "ING-03: concurrent pair with one key yields one row" | `converted` | `tests/integration/ingest-idempotency.test.ts` | 792ab96 |
| 4 | `ingest.spec.ts` — "ING-03 (Q6): missing Idempotency-Key → 400 structured body" | `converted` | `tests/integration/ingest-idempotency.test.ts` | 792ab96 |
| 5 | `ingest.spec.ts` — "CAP-03 text-only: a meta-only submission stores a row with no screenshot" | `converted` | `tests/integration/ingest-text-only.test.ts` | 792ab96 |

### Task 2 — Batch 2a: `ingest.spec.ts` (23) + `read-surface.spec.ts` (3)

| # | Original Spec / Test Title | Disposition | Target File / Justification | Commit |
|---|----------------------------|-------------|----------------------------|--------|
| 6 | `ingest.spec.ts` — "POST /api/incidents: 201, row validates against the published schema, list + image round-trip (ING-01, ENR-06)" | `converted` | `tests/integration/ingest-schema-validation.test.ts` | — |
| 7 | `ingest.spec.ts` — "webp fixture ingests and serves image/webp" | `converted` | `tests/integration/ingest-schema-validation.test.ts` | — |
| 8 | `ingest.spec.ts` — "JPEG: a real JPEG ingests, stores image/jpeg and the blob route serves it as a JPEG" | `converted` | `tests/integration/ingest-schema-validation.test.ts` | — |
| 9 | `ingest.spec.ts` — "JPEG decode-bomb: a >16 MP JPEG is rejected before sharp" | `converted` | `tests/integration/ingest-schema-validation.test.ts` | — |
| 10 | `ingest.spec.ts` — "JPEG header: a truncated JPEG is rejected" | `converted` | `tests/integration/ingest-schema-validation.test.ts` | — |
| 11 | `ingest.spec.ts` — "JPEG boundary: a side above MAX_IMAGE_DIM is rejected" | `converted` | `tests/integration/ingest-schema-validation.test.ts` | — |
| 12 | `ingest.spec.ts` — "format allowlist: SVG and GIF are still rejected and the copy names JPEG" | `converted` | `tests/integration/ingest-schema-validation.test.ts` | — |
| 13 | `ingest.spec.ts` — "JPEG orientation: an EXIF-rotated photo is stored upright without its EXIF segment" | `converted` | `tests/integration/ingest-schema-validation.test.ts` | — |
| 14 | `ingest.spec.ts` — "ING-03: same Idempotency-Key replays the same id and stores one row" | `converted` | `tests/integration/ingest-idempotency.test.ts` | — |
| 15 | `ingest.spec.ts` — "ING-03: concurrent pair with one key yields one row" | `converted` | `tests/integration/ingest-idempotency.test.ts` | — |
| 16 | `ingest.spec.ts` — "ING-03 (Q6): missing Idempotency-Key → 400 structured body, list unchanged" | `converted` | `tests/integration/ingest-idempotency.test.ts` | — |
| 17 | `ingest.spec.ts` — "wrong project key → 401; svg → 400 (SEC-03, P1-D-11)" | `converted` | `tests/integration/ingest-auth-project-key.test.ts` | — |
| 18 | `ingest.spec.ts` — "CAP-03 text-only: a meta-only submission stores a row with no screenshot" | `converted` | `tests/integration/ingest-text-only.test.ts` | — |
| 19 | `ingest.spec.ts` — "CAP-03 text-only concurrent: one idempotency key, one row, no blob" | `converted` | `tests/integration/ingest-text-only.test.ts` | — |
| 20 | `ingest.spec.ts` — "CAP-03 text-only: the blob route never 500s" | `converted` | `tests/integration/ingest-text-only.test.ts` | — |
| 21 | `ingest.spec.ts` — "CAP-03 text-only: the panel lists it" | `kept-in-journey` | J-07 (degraded capture) | — |
| 22 | `ingest.spec.ts` — "CAP-03 text-only: a meta-only post without X-Project-Key gets the same structured 401" | `converted` | `tests/integration/ingest-auth-project-key.test.ts` | — |
| 23 | `ingest.spec.ts` — "panel renders the row and its screenshot (P1-D-04, SEC-05 pass 2)" | `kept-in-journey` | J-02 (golden path) | — |
| 24 | `ingest.spec.ts` — "P1-D-07 / T-01-16: GET /api/setup serves exactly the seeded write-only project key through nginx" | `converted` | `tests/integration/ingest-onboarding.test.ts` | — |
| 25 | `ingest.spec.ts` — "P1-D-07: with an empty list the panel shows the onboarding curl carrying the real key and the CA-01 wire shape" | `converted` | `tests/integration/ingest-onboarding.test.ts` (onboarding API shape) | — |
| 26 | `ingest.spec.ts` — "P1-D-07: the emitted onboarding curl runs verbatim and the new report appears after reload" | `converted` | `tests/integration/ingest-onboarding.test.ts` (onboarding API works) | — |
| 27 | `ingest.spec.ts` — "P1-D-07: a meta part sent with Content-Type: application/json ingests (the curl -F shape)" | `converted` | `tests/integration/ingest-onboarding.test.ts` | — |
| 28 | `ingest.spec.ts` — "P1-D-05: language defaults from navigator.language and a manual switch survives reload" | `justified-redundant` | Covered by `sdk.spec.ts` J-12 (i18n journey) | — |
| 29 | `read-surface.spec.ts` — "read surface: GET routes are rate-limited per IP with integer Retry-After" | `converted` | `tests/integration/read-surface-rate-limit.test.ts` | — |
| 30 | `read-surface.spec.ts` — "read surface: list is bounded and returns x-next-cursor for large sets" | `converted` | `tests/integration/read-surface-rate-limit.test.ts` | — |
| 31 | `read-surface.spec.ts` — "read surface: malformed limit and cursor return 400" | `converted` | `tests/integration/read-surface-rate-limit.test.ts` | — |

---

## Summary Counts (running)

| Disposition | Count |
|-------------|-------|
| kept-in-journey | 2 |
| converted | 28 (31 sub-tests including Task 1) |
| justified-redundant | 1 |
| **Unclassified** | **117** |

---

## Journey Mapping (J-01..J-14 widget subset)

| Journey | Spec Tests Kept |
|---------|-----------------|
| J-01: Script tag + init() | INT-01, INT-05, WDG-01, WDG-04 |
| J-02: Golden path | CAP-01, ING-01, ENR-06, PRV-07, CA-01 + **ingest.spec.ts J-02 panel render** |
| J-03: Capture integrity | CAP-04, M-6, P2-D-12, OQ-1 |
| J-04: Auto-redaction T1 | PRV-01/02/03, SEC-01/02, R-13 |
| J-05: Manual mask T2/T3 | ANN-05/06, PRV-04, CA-02 |
| J-06: Full annotation | ANN-01..04, ANN-06, PRF-02, C-2 |
| J-07: Degraded capture | CAP-02, CAP-03 + **ingest.spec.ts J-07 text-only panel** |
| J-08: HiDPI fidelity | CAP-05, H-1 |
| J-09: WebP→PNG fallback | M-3, R-11, A-14 |
| J-10: Transport resilience | ING-03, P2-D-03 (moved to integration) |
| J-11: Payload privacy | PRV-05, PRV-06, SEC-03 |
| J-12: i18n en/es | WDG-06, RNF-03 (sdk.spec.ts only) |
| J-13: Size budget | PRF-01..04, CA-03 |
| J-14: Hostile CSS isolation | WDG-02/03/05, CA-04 |

---

## Notes

- Security rows (PRV-01..04, CA-02 decoded-bytes) **stay e2e** per R-19 — artifact-level evidence must not be downgraded.
- The ledger will be updated after each batch checkpoint.
- Final audit in Task 5 must show 152 accounted for with no gaps.
- Task 1 entries 2-5 were reclassified from `kept-in-journey` to `converted` after Batch 2a clarified journey scope: J-10 (transport resilience) and J-07 (text-only panel) are browser journeys, but the idempotency and text-only API tests are HTTP-surface and belong in integration.
- `read-surface.spec.ts` deleted entirely — all 3 tests re-homed to `tests/integration/read-surface-rate-limit.test.ts`.