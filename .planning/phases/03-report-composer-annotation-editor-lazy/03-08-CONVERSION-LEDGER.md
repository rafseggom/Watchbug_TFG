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
| 67 | `deploy.spec.ts` — "panel root returns the SPA shell (DEP-01)" | `converted` | `tests/packaging/deploy-contract.test.ts` — live HTTP 200 + `text/html` + `#root` + external `/assets/*.js` script in the served body, plus the built `apps/panel/dist/index.html` artifact (no inline script / no inline style — the cause of a CSP refusal, replacing the browser console watch). The *rendered* React frame half is covered by the kept J-02/J-07 panel journeys. | 49ee180 |
| 68 | `deploy.spec.ts` — "panel document ships the full CSP plus the header pair (S-4)" | `converted` | `tests/packaging/deploy-contract.test.ts` — five directive-level assertions + the two header values on the live document response, and the same pair on the proxied `/api/health` response (the nginx `add_header` inheritance guard). | 49ee180 |
| 69 | `deploy.spec.ts` — "/api/health returns 200 through the nginx proxy (DEP-01, A-10)" | `converted` | `tests/packaging/deploy-contract.test.ts` — status 200 + exact `{status:'ok'}` body. | 49ee180 |
| 70 | `deploy.spec.ts` — "every env var read by apps/api/src/config.ts is documented in .env.example (DEP-02)" | `converted` | `tests/packaging/deploy-contract.test.ts` — unchanged static scan (>5 reads found; zero undocumented). | 49ee180 |
| 71 | `deploy.spec.ts` — "boot with WATCHBUG_PROJECT_KEY unset exits non-zero naming the variable (DEP-02)" | `converted` | `tests/packaging/deploy-contract.test.ts` — unchanged spawn of `apps/api/dist/index.mjs`. | 49ee180 |
| 72 | `deploy.spec.ts` — "boot with the documented placeholder key exits non-zero (DEP-02)" | `converted` | `tests/packaging/deploy-contract.test.ts` — unchanged spawn, asserts `placeholder` in stderr. | 49ee180 |
| 73 | `deploy.spec.ts` — "boot with a malformed key exits non-zero naming the expected format (DEP-02)" | `converted` | `tests/packaging/deploy-contract.test.ts` — unchanged spawn, asserts `32` + `base62` in stderr. | 49ee180 |

---

### Task 3 — Batch 3a: `sdk.spec.ts` classification (80 declarations) + meta/transport/i18n conversion

**Count correction.** The running total reserved **77** unclassified `sdk.spec.ts`
rows. The true remainder is **80**: the 88 source declarations in the baseline
inventory minus the 8 declarations Batch 2b moved to `e2e/hostile.spec.ts`
(`WDG-02` loop, `WDG-02` closed bundle, `CA-04`, `WDG-03`, `WDG-05` ×4). The
previous summary counted those 8 moved declarations as **11 instances** (the
`WDG-02` loop generates 4 tests), so it over-counted `kept` by 3 and
under-counted `unclassified` by 3. This batch uses **declaration accounting
throughout** (the units the 148 baseline is built from) and records the instance
counts separately in the notes.

**Classification policy (applied below, no exceptions):**

| Disposition | Meaning |
|---|---|
| `kept-in-journey` | The row's *observable* requires a real browser (shadow DOM, canvas pixels, capture API, network interception through a page) and it is a J-01..J-14 journey or a sub-assertion of one. |
| `converted` | **Every** claim in the row is reproducible in a cheaper layer. The row is deleted from `sdk.spec.ts`. |
| `justified-redundant` | Another row proves the same claim with equal or stronger evidence. Must name the superset row. |

A row that mixes a pure-logic claim with a DOM claim is **kept** (the DOM half
cannot be re-homed) and the pure half is additionally pinned at the cheaper
layer; that pin is recorded in the row's "Target / justification" cell so the
authority is never left untested. No row was marked `justified-redundant` in
this batch: the two closest candidates (`ANN-06` undo-one-of-two and `ANN-06
masks` undo-with-mask-present) are **not** redundant — only the first proves the
undo stack pops exactly one entry.

| # | Original Spec / Test Title (short) | Disposition | Target / Justification | Commit |
|---|---|---|---|---|
| 74 | `INT-01` — one async script tag boots `window.Watchbug` + isolated host, closed prod bundle | `kept-in-journey` | J-01. Boot of the shipped artifact; needs the IIFE lane in a real page. | |
| 75 | `INT-01` — one-gesture launcher renders 48×48 inside the open-mode shadow root | `kept-in-journey` | J-01. Enters the shadow root (`watchbug.e2e.js`, R-14) — no browser, no evidence. | |
| 76 | `WDG-06` — `.wrap lang` matches the resolved locale under the default locale | `kept-in-journey` | J-12. Rendered `lang` + English copy. Rule pinned in `tests/unit/i18n-resolver.test.ts`. | |
| 77 | `WDG-04` — IIFE adds exactly one global, ESM none, native prototypes untouched | `kept-in-journey` | J-01. INV-02 is a property of the *running* bundles. | |
| 78 | `INT-02` — launcher gesture files a real report (201) rendered in the panel | `kept-in-journey` | J-02 golden path; the only row that walks the compose stack (`route.continue`) end to end. | |
| 79 | `INT-05` — ESM build boots the same widget, zero window properties | `kept-in-journey` | J-01. Second bundle lane; global-surface delta is runtime-only. | |
| 80 | `WDG-01` — launcher is a 48×48 shadow-root button, disabled while panel open | `kept-in-journey` | J-01. Geometry + disabled rendering. | |
| 81 | `CAP-01` — one gesture drives the engine capture tier to a non-blank frame + 201 | `kept-in-journey` | J-02/J-03. `getDisplayMedia` live path. | |
| 82 | `CAP-04` — widget host hidden during capture; accent pixels absent from the sent image | `kept-in-journey` | J-03. Pixel-level capture integrity (`analyzeImagePixels`). | |
| 83 | `CAP-05` — frame wider than `MAX_IMAGE_DIM` scaled to 8192 px before encode | `kept-in-journey` | J-08. Real canvas encode + decode of the delivered bytes. | |
| 84 | `CAP-05` — oversized 16 MP synthetic frame delivered inside 16 MP / 2 MB | `kept-in-journey` | J-08. Encode ladder under the real engine. | |
| 85 | `CAP-05` — `deviceScaleFactor: 2` capture decodes non-blank at expected dimensions | `kept-in-journey` | J-08. HiDPI device emulation is browser-only. | |
| 86 | `CAP-05` — devicePixelRatio above the clamp of 2 is reduced before encode | `kept-in-journey` | J-08. Same ladder, DPR-3 device. | |
| 87 | `M-3` — forced PNG encode ships `.png` / `image/png` and the real API returns 201 | `kept-in-journey` | J-09. R-11 WebP→PNG fallback through a stubbed encoder. | |
| 88 | `CAP-03` — a blank capture never posts before the user chooses | `kept-in-journey` | J-07. Blank detection + degraded composer. | |
| 89 | `P2-D-12` — sparse but real page is not blank; the report is sent | `kept-in-journey` | J-03. Blank-detection negative control (pixels). | |
| 90 | `P2-D-12` — frame beyond the canvas cap aborts to the blank bucket | `kept-in-journey` | J-07. Failure routing into the degraded composer. | |
| 91 | `OQ-1` — a non-tab capture surface is refused loudly, nothing sent | `kept-in-journey` | J-03. `preferCurrentTab` surface check. | |
| 92 | `CAP-01` — rejected capture prompt opens the degraded composer with both actions | `kept-in-journey` | J-07. Permission-denial UI. | |
| 93 | `P2-D-03` — transient 500 retries with the same `Idempotency-Key` and same encoded bytes | `kept-in-journey` | J-10. The **browser** half is the observable: `Capturing… → Sending… → Retrying (1 of 3)… → Report sent ✓`, launcher disabled for the retry window, and byte-equal parts through the *real* encode pipeline. Transport classification pinned in `tests/integration/transport-retry.test.ts`. | |
| 94 | `P2-D-03` — contract 400 fails immediately, renders the server message, never retries | `kept-in-journey` | J-10. Browser half: `role="alert"` headline, reason text, Retry/Dismiss buttons, disabled launcher. Classification + `SendError.reason` pinned in `tests/integration/transport-retry.test.ts`. | |
| 95 | `UI-SPEC backstop` — long server reason truncated to ≤240 chars with an ellipsis in ≤320 px | `kept-in-journey` | J-10. Rendering: the same string inside the 320 px panel. `truncateReason` (the whole clamp) pinned in `tests/unit/status-truncate.test.ts`. | |
| 96 | `UI-SPEC A-5/A-7` — sent auto-dismisses after 5 s, Escape dismisses a terminal failure | `kept-in-journey` | J-10. Wall-clock timing + `data-hidden` transition + keyboard focus. | |
| 97 | `PRV-02` — JWT shape masks the whole text node (zero original pixels in rect + 1-px ring) | `kept-in-journey` | J-04. **Security, R-19: stays e2e.** Decoded-bytes artifact evidence. | |
| 98 | `PRV-02` — JWT lookalike outside the `eyJ` shape stays visible | `kept-in-journey` | J-04. **Security.** Negative control — over-masking is a product bug. | |
| 99 | `PRV-01` — `input[type=password]` masks at the full element rect | `kept-in-journey` | J-04. **Security.** | |
| 100 | `PRV-02` — bearer-token shape masks the containing text node | `kept-in-journey` | J-04. **Security.** | |
| 101 | `PRV-02` — `key=/token=/secret=/password=` assignments mask the containing text node | `kept-in-journey` | J-04. **Security.** | |
| 102 | `PRV-02` — Luhn-valid card masks while its Luhn-invalid lookalike stays visible | `kept-in-journey` | J-04. **Security** + negative control. | |
| 103 | `PRV-02` — two Luhn-valid cards in one text node mask the whole node | `kept-in-journey` | J-04. **Security.** | |
| 104 | `PRV-03` — `data-watchbug-sensitive` element masks at the full element rect | `kept-in-journey` | J-04. **Security.** | |
| 105 | `S-7 / PRV-02` — secrets in an OPEN shadow root and a same-origin iframe mask | `kept-in-journey` | J-04. **Security.** Root-traversal reach is DOM-only. | |
| 106 | `S-7 guard` — a transformed same-origin frame is refused loudly, nothing sent | `kept-in-journey` | J-03. Fail-closed geometry guard; needs a real iframe. | |
| 107 | `WR-03 guard` — with no CSPRNG the flow fails visibly, never a guessable key | `kept-in-journey` | J-11. `crypto.getRandomValues` removal + visible failure state. | |
| 108 | `H-1` — devicePixelRatio 1 masks in bitmap space (rect + 1-px ring clean) | `kept-in-journey` | J-08. DPR matrix over auto-redaction pixels. | |
| 109 | `H-1` — devicePixelRatio 1.25 (non-integer scale) masks in bitmap space | `kept-in-journey` | J-08. | |
| 110 | `H-1` — devicePixelRatio 2 masks in bitmap space | `kept-in-journey` | J-08. | |
| 111 | `H-1` — devicePixelRatio 3 masks before the DPR-2 encode clamp | `kept-in-journey` | J-08. | |
| 112 | `P2-D-08` — a partially-matching text node masks its whole rect | `kept-in-journey` | J-04. **Security** (over-mask is the safe direction). Pixels only. | |
| 113 | `fail-closed` — a redaction scan error lands in the loud capture-failed state, zero POSTs | `kept-in-journey` | J-04. Error injection into the live scan + zero-request assertion. | |
| 114 | `PRV-05` — the report carries no host cookie, storage or auth material | `kept-in-journey` | J-11. **SEC-03, stays e2e.** Sentinels planted in the real host context. | |
| 115 | `PRV-06` — `meta.url` is path-only, query + fragment never enter the report | `kept-in-journey` | J-11. Intercepted request from a real page (the artifact-level proof). The helper is pinned in `tests/unit/sdk-meta.test.ts` (url half) and `tests/unit/url-path.test.ts` (API strip). | |
| 116 | `P2-D-01` — the auto-title is `document.title` truncated to 200 code points, type is bug | **`converted`** | **`tests/unit/sdk-meta.test.ts`** — `buildMeta` is the production clamp (pure: reads `doc.title` + `loc.pathname`). All 8 tests carry the row's exact fixture (100 ASCII + 200 emoji) and thresholds. Both browser halves it also asserted are covered: `"type":"bug"` on the wire by `INT-02` (row 78) and the clamped prefill by `P3-D-02` (row 120). | |
| 117 | `self-hosted` — zero third-party requests, only the configured API base | `kept-in-journey` | J-11. Every `page.on('request')` on a real navigation. | |
| 118 | `S-8` — a cross-origin loading script refuses to init without an explicit `endpoint` | `kept-in-journey` | J-11. Cross-origin script tag in a real page. | |
| 119 | `PRV-07` — review shows the flattened artifact and Send posts exactly once | `kept-in-journey` | J-02. The one-send guarantee on a live request. | |
| 120 | `P3-D-02` — title prefills from `document.title` truncated to 200 code points; empty blocks review | `kept-in-journey` | J-02. DOM: `input.value`, aria-invalid, focus retention, recovery. Clamp pinned in `tests/unit/composer-text-clamp.test.ts`. | |
| 121 | `P3-D-03` — segmented control defaults to bug, switches the heading, reaches the wire | `kept-in-journey` | J-02. `aria-pressed` + heading copy + wire value. | |
| 122 | `P3-D-04` — composer is a wide overlay replacing the 320 px panel; Escape returns to idle | `kept-in-journey` | J-02. Measured widths + Escape key handling. | |
| 123 | `P3-D-02 note counter` — hidden at 3,999 code points, visible at 4,000 | `kept-in-journey` | J-02. DOM: `data-shown` flip + counter text. Threshold, code-point counting and the `4000 / 5000` copy pinned in `tests/unit/composer-text-clamp.test.ts`. | |
| 124 | `WDG-06 es` — the whole core surface renders Spanish copy with `lang="es"` | `kept-in-journey` | J-12. Rendered locale (`test.use({ locale: 'es-ES' })`). Rule pinned in `tests/unit/i18n-resolver.test.ts`. | |
| 125 | `WDG-06 override` — the composer EN/ES pair switches copy and lang both ways, no host storage | `kept-in-journey` | J-12. Toggle clicks + the no-host-storage assertion. | |
| 126 | `CAP-02 attach` — a picked PNG reaches the preview, the review and the wire | `kept-in-journey` | J-07. Real file input + decode. | |
| 127 | `CAP-02 attach` — WebP and JPEG are accepted | `kept-in-journey` | J-07. Magic-byte sniffing on real bytes. | |
| 128 | `CAP-02 reject` — a non-image is refused with the inline error and no request | `kept-in-journey` | J-07. DOM error copy + zero requests. | |
| 129 | `CAP-02 reject` — an oversized-pixel file is refused | `kept-in-journey` | J-07. Decode-bomb guard on a real file. | |
| 130 | `CAP-03` — a denied capture opens the degraded composer with both actions and files text-only | `kept-in-journey` | J-07. Permission denial + text-only lane. | |
| 131 | `CAP-03 no-API` — a browser without `getDisplayMedia` still files text-only feedback | `kept-in-journey` | J-07. API removal in a real page. | |
| 132 | `ANN-01` — freehand ink follows the drag path | `kept-in-journey` | J-06. Canvas pixel bands (`analyzeInk`). | |
| 133 | `PRF-02 lazy` — the annotator chunk is fetched only on Annotate, exactly once, adds no global | `kept-in-journey` | J-06/J-13. Chunk request count + global surface on a live page. | |
| 134 | `PRF-02 lazy` — loading state, failed load re-enables the button, retry opens the editor | `kept-in-journey` | J-06. Route-abort of the chunk + DOM states. | |
| 135 | `ANN-02` — an arrow paints a shaft and a wider head | `kept-in-journey` | J-06. Pixel geometry. | |
| 136 | `ANN-03` — a rectangle outlines its four edges and leaves the interior alone | `kept-in-journey` | J-06. Pixel geometry. | |
| 137 | `ANN-04` — a text label is click-typed-confirmed without a modal | `kept-in-journey` | J-06. Real typing into the canvas overlay. | |
| 138 | `ANN-04 empty` — confirming an empty label draws nothing | `kept-in-journey` | J-06. | |
| 139 | `ANN-04 encoding` — a non-ASCII label is drawn verbatim | `kept-in-journey` | J-06. Canvas glyphs. | |
| 140 | `ANN-06` — undo removes one stroke and never a mask | `kept-in-journey` | J-06. The **only** row proving the undo stack pops exactly one entry. | |
| 141 | `ANN-06` — Ctrl/Cmd+Z matches the undo button | `kept-in-journey` | J-06. Keyboard path. | |
| 142 | `WDG-06 editor` — the editor chrome localises | `kept-in-journey` | J-12. Lazy chunk's own dictionary (`STRINGS_EDITOR`, parity pinned in `tests/unit/i18n-resolver.test.ts`). | |
| 143 | `PRV-04 CA-02` — a user mask destroys the region and its boundary ring (flat opaque fill) | `kept-in-journey` | J-05. **Security, R-19: stays e2e.** SEC-02 decoded-bytes artifact proof. | |
| 144 | `ANN-05` — the first mask asks, later masks do not | `kept-in-journey` | J-05. Confirmation dialog state machine. | |
| 145 | `ANN-05 Not now` — refusing the first mask bakes nothing; Escape does not close the editor | `kept-in-journey` | J-05. Pixel-level "nothing was baked". | |
| 146 | `ANN-05 mask-mode` — the toggle shows only for the mask tool and defaults to fill | `kept-in-journey` | J-05. DOM visibility + default mode. | |
| 147 | `PRV-04 pixelate` — block-averaged, grid-snapped and opaque | `kept-in-journey` | J-05. **Security.** R-13 ≥8 px, measured on pixels. | |
| 148 | `PRV-04 stroke` — a freehand drawn across the mask cannot resurrect it | `kept-in-journey` | J-05. **Security.** Destructive bake proven on decoded bytes. | |
| 149 | `ANN-06 masks` — undo removes strokes and never a mask | `kept-in-journey` | J-05. The mask survives two undos + a survivor-stroke control. | |
| 150 | `PRV-04 DPR` — devicePixelRatio 1 masks land where they were dragged | `kept-in-journey` | J-05/J-08. **Security.** User-mask DPR matrix. | |
| 151 | `PRV-04 DPR` — devicePixelRatio 1.25 (non-integer scale) masks land where dragged | `kept-in-journey` | J-05/J-08. **Security.** | |
| 152 | `PRV-04 DPR` — devicePixelRatio 2 masks land where they were dragged | `kept-in-journey` | J-05/J-08. **Security.** | |
| 153 | `PRV-04 DPR` — devicePixelRatio 3 masks before the DPR-2 encode clamp | `kept-in-journey` | J-05/J-08. **Security.** | |

**Batch 3a totals:** `converted` 1 · `kept-in-journey` 79 · `justified-redundant` 0 — 80 of 80.
The `Commit` column above is left blank for this batch: every row 74–153 was
touched by the single commit **`6723c68`** (`refactor(03-08): Batch 3a — classify
sdk.spec.ts and re-home the meta/i18n/transport logic`).

**Rows explicitly NOT converted (and why), because they were on the batch's candidate list:**

- `P2-D-03` (×2) — the transport half is now pinned at the cheaper layer, but the
  rows are not removable: the retry *status copy sequence*, the disabled launcher
  during the retry window, the `role="alert"`/`role="status"` pair and the
  Retry/Dismiss affordances are the J-10 journey and only exist in the shadow DOM.
- `UI-SPEC backstop` — `truncateReason` is pinned in unit, but the row's claim is
  that the truncated string *renders inside a 320 px panel*; that is a layout
  assertion.
- `P3-D-02` / `P3-D-02 note counter` — the clamp arithmetic and the 4,000
  threshold are pinned in unit; the `input.value`, `aria-invalid`, focus
  retention and `data-shown` observations are DOM.
- `WDG-06` (×4) — `detectLocale`/`t`/dictionary parity pinned in unit; the rows
  observe rendered copy and `lang`.
- `PRV-06` — a unit pin already existed (`tests/unit/url-path.test.ts`, Task 1);
  the sdk row is the artifact-level interception over a real page and stays.
- `P2-D-01` — **converted** (the batch's one full conversion).

**Verification for this batch:** `npm run test:unit` 5 files / 35 tests green;
`npm run test:integration` 11 files / 65 tests green (48 previous + 17 new);
`npm run verify` **279/279 passed** in 4.0 m (93 per engine); `npm run gate`
5/5; `npm run check:size` PASSED (core 17.2 KB gz / 45, lazy 6.8 / 25, runtime
24.4 / 80); `packages/sdk` `tsc --noEmit` clean.

---

## Summary Counts (running)

| Disposition | Count |
|-------------|-------|
| kept-in-journey | 90 (2 ingest + 1 hostile XSS-render row + 8 `J-14` declarations moved from `sdk.spec.ts` + 79 `sdk.spec.ts` rows classified in Task 3a) |
| converted | 57 (20 ingest + 3 read-surface + 26 hostile + 7 deploy + 1 sdk `P2-D-01`) |
| justified-redundant | 1 (ingest i18n default) |
| **Unclassified** | **0** |

`57 + 90 + 1 = 148` — the baseline **source declaration** count, with no gaps.
The `sdk.spec.ts` row is now 80 declarations, not 77: Batch 2b moved 8
declarations (not 11 — 11 is the *instance* count the `WDG-02` loop inflates
them to), so `88 − 8 = 80`. Instance counts are reported separately below.

**Instances per engine (post-Batch 3a, `npx playwright test --list`):**

| Spec | Declarations | Instances |
|------|--------------|-----------|
| `e2e/sdk.spec.ts` | 79 | 79 |
| `e2e/hostile.spec.ts` | 9 | 12 |
| `e2e/ingest.spec.ts` | 2 | 2 |
| **Per engine** | **90** | **93** |
| **× 3 engines** | | **279** |

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
| J-10: Transport resilience | ING-03, P2-D-03 (kept for its shadow-DOM half; classification pinned in `tests/integration/transport-retry.test.ts`), UI-SPEC backstop |
| J-11: Payload privacy | PRV-05, PRV-06, SEC-03 |
| J-12: i18n en/es | WDG-06, RNF-03 (sdk.spec.ts only) |
| J-13: Size budget | PRF-01..04, CA-03 |
| J-14: Hostile CSS isolation | WDG-02/03/05, CA-04 |

---

## Notes

- Security rows (PRV-01..04, CA-02 decoded-bytes) **stay e2e** per R-19 — artifact-level evidence must not be downgraded.
- The ledger will be updated after each batch checkpoint.
- Final audit in Task 5 must show 148 declarations accounted for with no gaps
  (152 was the earlier instance-based figure; the ledger now reconciles on
  declarations and reports instances separately).
- **Batch 3a** (Task 3): all 80 remaining `sdk.spec.ts` declarations classified;
  1 fully converted (`P2-D-01` → `tests/unit/sdk-meta.test.ts`), 79 kept with
  their pure-logic halves pinned at the cheaper layer:
  `tests/unit/sdk-meta.test.ts` (8), `tests/unit/composer-text-clamp.test.ts` (7),
  `tests/unit/status-truncate.test.ts` (5), `tests/unit/i18n-resolver.test.ts` (8),
  `tests/integration/transport-retry.test.ts` (17).
  Two production functions gained an `export` so the unit lane imports the real
  code instead of a copy: `codePoints` / `clampCodePoints` in
  `packages/sdk/src/widget/composer.ts` (no behaviour change; the module is
  already imported by the built bundle unchanged).
- **Batch 3a non-conversions and why** — recorded per row above. The short
  version: every remaining row observes something only the browser produces
  (shadow DOM, canvas `ImageData`, `getDisplayMedia`, chunk fetches, planted
  host sentinels). Rows whose *only* claim was pure logic were converted; rows
  that mix a pure claim with a DOM claim keep the DOM row and pin the pure claim
  at the cheaper layer. No threshold was weakened and no security row
  (`PRV-01..07`, `CA-02`/`PRV-04` decoded-bytes) moved out of e2e.
- Task 1 entries 2-5 were reclassified from `kept-in-journey` to `converted` after Batch 2a clarified journey scope: J-10 (transport resilience) and J-07 (text-only panel) are browser journeys, but the idempotency and text-only API tests are HTTP-surface and belong in integration. They are the **same** declarations later listed as Batch 2a rows 14-16/18 — the tracer batch adds no test beyond the 148 baseline.
- `read-surface.spec.ts` deleted entirely — all 3 tests re-homed to `tests/integration/read-surface-rate-limit.test.ts`.
- Batch 2b: `hostile.spec.ts` (27 tests) → 1 kept (`ING-07 pass 2` render-inert) + 26 converted; J-14 (11 tests) physically moved from `sdk.spec.ts` to the new `e2e/hostile.spec.ts`, which is now 12 tests. Integration/contract/packaging gained 21 new tests (48 integration, 6 contract, 1 packaging).
- Batch 2b re-homes map to five files: `hostile-size-caps` (5), `hostile-auth-rate-limit` (10), `hostile-sanitisation` (6), `hostile-payload-control` (6), `no-dangerouslySetInnerHTML` (1).
- Batch 2c: `deploy.spec.ts` (7 tests) re-homed **entirely** to `tests/packaging/deploy-contract.test.ts` and the spec deleted — no row was a core user journey. Research's J-21 (first-run `docker-compose` + onboarding curl) is deliberately type 6 per the plan, so the journey cap stays at exactly 20 with J-15..J-20 reserved for Phases 4–7. `e2e/` is now three specs — `sdk` 80 instances (77 declarations + 3 generated `for`-loop variants), `hostile` 12, `ingest` 2 = 94 per engine, 282 over 3 engines, confirmed by `npx playwright test --list`.
- Batch 2c coverage audit: every original assertion survives. The two browser-only halves have named successors rather than drops — the rendered "Watchbug" heading/app frame is exercised by the kept J-02/J-07 panel journeys, and the "no CSP refusal" console watch is replaced by its artifact-level *cause* (the shipped `apps/panel/dist/index.html` carries no inline `<script>`/`<style>`, which is what `default-src 'self'` would refuse). Every live row targets the same `http://127.0.0.1:8080` same-origin surface the deleted spec used.
- Batch 2c environment note: the three live rows need the compose stack, exactly as the integration suite needs the published API. `test:packaging` now runs `check:size` → `check:compose` → `vitest run tests/packaging` so the type-6 suite is actually executed by the command that names it (previously only the two gate scripts ran, leaving the packaging tests uninvoked by their own script). Verified: `test:packaging` 8/8 green, `npx vitest run tests/integration tests/contract tests/packaging` 62/62 (55 previous + 7 new), `npm run verify` 282/282, `gate` 5/5, `check:size` PASS.
- Batch 2c docs: `.github/workflows/ci.yml`'s host-build comment referenced `deploy.spec.ts` as the spawner of `apps/api/dist/index.mjs`; it now names `tests/packaging/deploy-contract.test.ts`.
- **Commit map** (the `Commit` column is left as `—` where a row's batch hash is recorded here instead): Task 1 / Batch 1c = `792ab96`; Batch 2a (rows 6–20, 22, 24–27, 29–31) = `132a2c5`; Batch 2b (rows 32–66) = `b1e2b35`, ledger hash backfill = `78d632e`; Batch 2c (rows 67–73) = `49ee180`; Batch 3a (rows 74–153) = `6723c68`.