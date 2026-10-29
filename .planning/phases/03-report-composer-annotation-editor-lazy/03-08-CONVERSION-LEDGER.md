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

### Task 2 — Batch 2b: `hostile.spec.ts` (27) → 1 kept + 26 converted; J-14 (11) moved in from `sdk.spec.ts`

| # | Original Spec / Test Title | Disposition | Target File / Justification | Commit |
|---|----------------------------|-------------|----------------------------|--------|
| 32 | `hostile.spec.ts` — "ING-06 layer 1: image part > MAX_IMAGE_PART_BYTES (4 MB) → 413 structured at the multipart parser" | `converted` | `tests/integration/hostile-size-caps.test.ts` | b1e2b35 |
| 33 | `hostile.spec.ts` — "ING-06 layer 2: body > MAX_BODY_BYTES (5 MB) → 413 structured from the Content-Length pre-read (direct to API)" | `converted` | `tests/integration/hostile-size-caps.test.ts` | b1e2b35 |
| 34 | `hostile.spec.ts` — "ING-06 layer 2b: a chunked body with NO Content-Length over MAX_BODY_BYTES is aborted by the streaming counter → 413" | `converted` | `tests/integration/hostile-size-caps.test.ts` | b1e2b35 |
| 35 | `hostile.spec.ts` — "ING-06 layer 3: the stated nginx limit (client_max_body_size 5m) stops the same body at the panel origin" | `converted` | `tests/integration/hostile-size-caps.test.ts` | b1e2b35 |
| 36 | `hostile.spec.ts` — "ING-06: an encoded image over MAX_ENCODED_IMAGE_BYTES is rejected 413 (semantic cap, A-06 hard)" | `converted` | `tests/integration/hostile-size-caps.test.ts` | b1e2b35 |
| 37 | `hostile.spec.ts` — "C-3: SVG, GIF/HTML polyglot and decode-bomb payloads are rejected 400 (structured)" | `converted` | `tests/contract/hostile-payload-control.test.ts` (3 sub-tests) | b1e2b35 |
| 38 | `hostile.spec.ts` — "C-4: traversal-shaped client filenames are rejected 400 — the name never reaches a path" | `converted` | `tests/contract/hostile-payload-control.test.ts` (3 sub-tests) | b1e2b35 |
| 39 | `hostile.spec.ts` — "C-3/C-4: the blob route serves the report with the full inert header set and a fixed ASCII name" | `converted` | `tests/contract/hostile-payload-control.test.ts` | b1e2b35 |
| 40 | `hostile.spec.ts` — "C-4: an unknown incident id is 404 — never 400, and the body shape matches the other 404s" | `converted` | `tests/contract/hostile-payload-control.test.ts` | b1e2b35 |
| 41 | `hostile.spec.ts` — "ING-04: missing, unknown and malformed project keys all get the same structured 401 and nothing is stored" | `converted` | `tests/integration/hostile-auth-rate-limit.test.ts` | b1e2b35 |
| 42 | `hostile.spec.ts` — "ING-04 concurrency: a parallel burst of invalid-key requests each receives its own uniform 401 and stores nothing" | `converted` | `tests/integration/hostile-auth-rate-limit.test.ts` | b1e2b35 |
| 43 | `hostile.spec.ts` — "ING-05 per key: exactly RATE_LIMIT_PER_KEY_PER_MIN requests pass on a fresh key, max+1 is 429 + Retry-After" | `converted` | `tests/integration/hostile-auth-rate-limit.test.ts` | b1e2b35 |
| 44 | `hostile.spec.ts` — "ING-05 per IP: exactly RATE_LIMIT_PER_IP_PER_MIN requests pass from one forwarded IP, max+1 is 429 + Retry-After" | `converted` | `tests/integration/hostile-auth-rate-limit.test.ts` | b1e2b35 |
| 45 | `hostile.spec.ts` — "ING-05 per day: the daily project quota trips at RATE_LIMIT_PER_PROJECT_PER_DAY + 1 with Retry-After" | `converted` | `tests/integration/hostile-auth-rate-limit.test.ts` | b1e2b35 |
| 46 | `hostile.spec.ts` — "CR-01: NBSP-padded X-Project-Key shares the padded key's bucket — padding never mints fresh per-key quota" | `converted` | `tests/integration/hostile-auth-rate-limit.test.ts` | b1e2b35 |
| 47 | `hostile.spec.ts` — "CR-02 (direct): a forged leftmost X-Forwarded-For entry never becomes req.ip — the asserted rightmost hop owns the per-IP bucket" | `converted` | `tests/integration/hostile-auth-rate-limit.test.ts` | b1e2b35 |
| 48 | `hostile.spec.ts` — "CR-02 (proxy): nginx overwrites the client X-Forwarded-For — a forged entry cannot ride the panel edge into a fresh per-IP bucket" | `converted` | `tests/integration/hostile-auth-rate-limit.test.ts` | b1e2b35 |
| 49 | `hostile.spec.ts` — "ING-08 trio: non-allowlisted Origin → 403 + nothing stored; allowlisted Origin → 201 + CORS headers; no Origin → 201" | `converted` | `tests/integration/hostile-auth-rate-limit.test.ts` | b1e2b35 |
| 50 | `hostile.spec.ts` — "ING-08 concurrency: a mixed parallel burst yields per-request decisions matching each request's own Origin" | `converted` | `tests/integration/hostile-auth-rate-limit.test.ts` | b1e2b35 |
| 51 | `hostile.spec.ts` — "ING-07 pass 1: hostile text payloads are stored with all markup removed (img-onerror, script, BOM, UTF-7, entity-encoded)" | `converted` | `tests/integration/hostile-sanitisation.test.ts` | b1e2b35 |
| 52 | `hostile.spec.ts` — "ING-07 pass 1: plain text with angle brackets round-trips exactly; styled fragments keep document order" | `converted` | `tests/integration/hostile-sanitisation.test.ts` | b1e2b35 |
| 53 | `hostile.spec.ts` — "ING-07 empty edge: a zero-length title is rejected 400; absent optional fields are stored as null" | `converted` | `tests/integration/hostile-sanitisation.test.ts` | b1e2b35 |
| 54 | `hostile.spec.ts` — "ING-07 encoding edge: caps count Unicode code points (inclusive at the cap, one over is 400) and sanitised output never exceeds its cap" | `converted` | `tests/integration/hostile-sanitisation.test.ts` | b1e2b35 |
| 55 | `hostile.spec.ts` — "ING-07: control characters are stripped from every user string on write" | `converted` | `tests/integration/hostile-sanitisation.test.ts` | b1e2b35 |
| 56 | `hostile.spec.ts` — "R-08/S-5: meta.url is stored path-only — query string and fragment stripped on ingest" | `converted` | `tests/integration/hostile-sanitisation.test.ts` | b1e2b35 |
| 57 | `hostile.spec.ts` — "ING-07 pass 2: stored hostile payloads render as literal text and inject zero elements into the panel DOM" | `kept-in-journey` | J-14 (XSS-render-inert representative) | b1e2b35 |
| 58 | `hostile.spec.ts` — "ING-07 pass 2: apps/panel/src contains no HTML-rendering sink (dangerouslySetInnerHTML / innerHTML)" | `converted` | `tests/packaging/no-dangerouslySetInnerHTML.test.ts` | b1e2b35 |
| 59 | `sdk.spec.ts` — "WDG-02: hostile host CSS cannot hide, restyle or break the widget — display/fontsize/unset/transform (4 variants)" | `kept-in-journey` | J-14 (moved to `e2e/hostile.spec.ts`) | b1e2b35 |
| 60 | `sdk.spec.ts` — "WDG-02: the closed production bundle keeps the inline isolation contract under *:not(html):not(body) { display: none !important }" | `kept-in-journey` | J-14 (moved to `e2e/hostile.spec.ts`) | b1e2b35 |
| 61 | `sdk.spec.ts` — "CA-04: every hostile rule in the matrix demonstrably applies to its control element" | `kept-in-journey` | J-14 (moved to `e2e/hostile.spec.ts`) | b1e2b35 |
| 62 | `sdk.spec.ts` — "WDG-03: init and a full report flow leak zero styles, classes or custom properties into the host document" | `kept-in-journey` | J-14 (moved to `e2e/hostile.spec.ts`) | b1e2b35 |
| 63 | `sdk.spec.ts` — "WDG-05: the widget wins the stacking contest over a hostile max-z-index modal and the flow still completes" | `kept-in-journey` | J-14 (moved to `e2e/hostile.spec.ts`) | b1e2b35 |
| 64 | `sdk.spec.ts` — "WDG-05: a hostile element painted at the widget coordinates neither captures its hit target nor swallows host clicks" | `kept-in-journey` | J-14 (moved to `e2e/hostile.spec.ts`) | b1e2b35 |
| 65 | `sdk.spec.ts` — "WDG-05: an empty host page still renders the launcher at 24 px insets and starts the flow" | `kept-in-journey` | J-14 (moved to `e2e/hostile.spec.ts`) | b1e2b35 |
| 66 | `sdk.spec.ts` — "WDG-05: a z-index tie stays resolved by DOM order and the host is re-appended after a documentElement replacement" | `kept-in-journey` | J-14 (moved to `e2e/hostile.spec.ts`) | b1e2b35 |

### Task 2 — Batch 2c: `deploy.spec.ts` (7) → packaging; spec deleted

| # | Original Spec / Test Title | Disposition | Target File / Justification | Commit |
|---|----------------------------|-------------|----------------------------|--------|
| 67 | `deploy.spec.ts` — "panel root returns the SPA shell (DEP-01)" | `converted` | `tests/packaging/deploy-contract.test.ts` — live HTTP 200 + `text/html` + `#root` + external `/assets/*.js` script in the served body, plus the built `apps/panel/dist/index.html` artifact (no inline script / no inline style — the cause of a CSP refusal, replacing the browser console watch). The *rendered* React frame half is covered by the kept J-02/J-07 panel journeys. | — |
| 68 | `deploy.spec.ts` — "panel document ships the full CSP plus the header pair (S-4)" | `converted` | `tests/packaging/deploy-contract.test.ts` — five directive-level assertions + the two header values on the live document response, and the same pair on the proxied `/api/health` response (the nginx `add_header` inheritance guard). | — |
| 69 | `deploy.spec.ts` — "/api/health returns 200 through the nginx proxy (DEP-01, A-10)" | `converted` | `tests/packaging/deploy-contract.test.ts` — status 200 + exact `{status:'ok'}` body. | — |
| 70 | `deploy.spec.ts` — "every env var read by apps/api/src/config.ts is documented in .env.example (DEP-02)" | `converted` | `tests/packaging/deploy-contract.test.ts` — unchanged static scan (>5 reads found; zero undocumented). | — |
| 71 | `deploy.spec.ts` — "boot with WATCHBUG_PROJECT_KEY unset exits non-zero naming the variable (DEP-02)" | `converted` | `tests/packaging/deploy-contract.test.ts` — unchanged spawn of `apps/api/dist/index.mjs`. | — |
| 72 | `deploy.spec.ts` — "boot with the documented placeholder key exits non-zero (DEP-02)" | `converted` | `tests/packaging/deploy-contract.test.ts` — unchanged spawn, asserts `placeholder` in stderr. | — |
| 73 | `deploy.spec.ts` — "boot with a malformed key exits non-zero naming the expected format (DEP-02)" | `converted` | `tests/packaging/deploy-contract.test.ts` — unchanged spawn, asserts `32` + `base62` in stderr. | — |

---

## Summary Counts (running)

| Disposition | Count |
|-------------|-------|
| kept-in-journey | 14 (2 ingest + 1 hostile XSS-render row + 11 J-14 moved from `sdk.spec.ts`) |
| converted | 56 (20 ingest + 3 read-surface + 26 hostile + 7 deploy) |
| justified-redundant | 1 (ingest i18n default) |
| **Unclassified** | **77** (`sdk.spec.ts` only — Task 3's widget batches) |

`56 + 14 + 1 + 77 = 148` — the baseline source declaration count. The four
generated tests (the `for`-loop variants in `sdk.spec.ts`) are counted inside
their row, so the ledger reconciles to 148 while Task 5's audit reports 152.

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
- Task 1 entries 2-5 were reclassified from `kept-in-journey` to `converted` after Batch 2a clarified journey scope: J-10 (transport resilience) and J-07 (text-only panel) are browser journeys, but the idempotency and text-only API tests are HTTP-surface and belong in integration. They are the **same** declarations later listed as Batch 2a rows 14-16/18 — the tracer batch adds no test beyond the 148 baseline.
- `read-surface.spec.ts` deleted entirely — all 3 tests re-homed to `tests/integration/read-surface-rate-limit.test.ts`.
- Batch 2b: `hostile.spec.ts` (27 tests) → 1 kept (`ING-07 pass 2` render-inert) + 26 converted; J-14 (11 tests) physically moved from `sdk.spec.ts` to the new `e2e/hostile.spec.ts`, which is now 12 tests. Integration/contract/packaging gained 21 new tests (48 integration, 6 contract, 1 packaging).
- Batch 2b re-homes map to five files: `hostile-size-caps` (5), `hostile-auth-rate-limit` (10), `hostile-sanitisation` (6), `hostile-payload-control` (6), `no-dangerouslySetInnerHTML` (1).
- Batch 2c: `deploy.spec.ts` (7 tests) re-homed **entirely** to `tests/packaging/deploy-contract.test.ts` and the spec deleted — no row was a core user journey. Research's J-21 (first-run `docker-compose` + onboarding curl) is deliberately type 6 per the plan, so the journey cap stays at exactly 20 with J-15..J-20 reserved for Phases 4–7. `e2e/` is now three specs — `sdk` 80 instances (77 declarations + 3 generated `for`-loop variants), `hostile` 12, `ingest` 2 = 94 per engine, 282 over 3 engines, confirmed by `npx playwright test --list`.
- Batch 2c coverage audit: every original assertion survives. The two browser-only halves have named successors rather than drops — the rendered "Watchbug" heading/app frame is exercised by the kept J-02/J-07 panel journeys, and the "no CSP refusal" console watch is replaced by its artifact-level *cause* (the shipped `apps/panel/dist/index.html` carries no inline `<script>`/`<style>`, which is what `default-src 'self'` would refuse). Every live row targets the same `http://127.0.0.1:8080` same-origin surface the deleted spec used.
- Batch 2c environment note: the three live rows need the compose stack, exactly as the integration suite needs the published API. `test:packaging` now runs `check:size` → `check:compose` → `vitest run tests/packaging` so the type-6 suite is actually executed by the command that names it (previously only the two gate scripts ran, leaving the packaging tests uninvoked by their own script). Verified: `test:packaging` 8/8 green, `npx vitest run tests/integration tests/contract tests/packaging` 62/62 (55 previous + 7 new), `npm run verify` 282/282, `gate` 5/5, `check:size` PASS.
- Batch 2c docs: `.github/workflows/ci.yml`'s host-build comment referenced `deploy.spec.ts` as the spawner of `apps/api/dist/index.mjs`; it now names `tests/packaging/deploy-contract.test.ts`.