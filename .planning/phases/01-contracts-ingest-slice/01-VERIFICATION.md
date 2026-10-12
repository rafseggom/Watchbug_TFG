---
phase: 01-contracts-ingest-slice
verified: 2026-10-12T22:25:51Z
status: human_needed
score: 38/40 must-haves verified
covered_files:
  - .planning/phases/01-contracts-ingest-slice/01-01-PLAN.md
  - .planning/phases/01-contracts-ingest-slice/01-02-PLAN.md
  - .planning/phases/01-contracts-ingest-slice/01-03-PLAN.md
  - .planning/phases/01-contracts-ingest-slice/01-04-PLAN.md
  - .planning/phases/01-contracts-ingest-slice/01-01-SUMMARY.md
  - .planning/phases/01-contracts-ingest-slice/01-02-SUMMARY.md
  - .planning/phases/01-contracts-ingest-slice/01-03-SUMMARY.md
  - .planning/phases/01-contracts-ingest-slice/01-04-SUMMARY.md
  - package.json
  - package-lock.json
  - tsconfig.base.json
  - .env.example
  - .gitignore
  - docker-compose.yml
  - playwright.config.ts
  - schema/report.schema.json
  - .gitattributes
  - scripts/check-size.mjs
  - scripts/check-compose.mjs
  - scripts/gen-key.mjs
  - packages/contracts/package.json
  - packages/contracts/tsconfig.json
  - packages/contracts/src/constants.ts
  - packages/contracts/src/schema.ts
  - packages/contracts/src/types.ts
  - packages/contracts/scripts/emit-schema.mjs
  - packages/sdk/package.json
  - packages/sdk/tsconfig.json
  - packages/sdk/src/index.ts
  - packages/sdk/src/annotator.ts
  - packages/sdk/src/capture/dom-serialize.ts
  - packages/sdk/scripts/build.mjs
  - apps/api/package.json
  - apps/api/tsconfig.json
  - apps/api/drizzle.config.ts
  - apps/api/Dockerfile
  - apps/api/src/index.ts
  - apps/api/src/app.ts
  - apps/api/src/config.ts
  - apps/api/src/ports.ts
  - apps/api/src/db/schema.ts
  - apps/api/src/db/client.ts
  - apps/api/src/boot/seed.ts
  - apps/api/src/routes/incidents.ts
  - apps/api/src/routes/setup.ts
  - apps/api/src/ingest/validate-meta.ts
  - apps/api/src/ingest/sniff.ts
  - apps/api/src/ingest/guard.ts
  - apps/api/src/ingest/harden.ts
  - apps/api/src/ingest/sanitize.ts
  - apps/api/src/ingest/caps.ts
  - apps/api/src/ingest/structure.ts
  - apps/api/src/plugins/rate-limit.ts
  - apps/api/src/plugins/cors.ts
  - apps/api/src/storage/fs-storage.ts
  - apps/api/drizzle/0000_grey_the_santerians.sql
  - apps/panel/package.json
  - apps/panel/tsconfig.json
  - apps/panel/vite.config.ts
  - apps/panel/index.html
  - apps/panel/Dockerfile
  - apps/panel/nginx.conf
  - apps/panel/src/main.tsx
  - apps/panel/src/App.tsx
  - apps/panel/src/api.ts
  - apps/panel/src/tokens.css
  - apps/panel/src/i18n.ts
  - apps/panel/src/vite-env.d.ts
  - apps/panel/src/components/ReportList.tsx
  - apps/panel/src/components/ReportDetail.tsx
  - apps/panel/src/components/EmptyState.tsx
  - apps/panel/src/components/LanguageSwitcher.tsx
  - e2e/deploy.spec.ts
  - e2e/ingest.spec.ts
  - e2e/hostile.spec.ts
  - e2e/global-setup.ts
  - e2e/make-fixtures.mjs
  - e2e/fixtures/valid-64x64.png
  - e2e/fixtures/valid-64x64.webp
  - e2e/fixtures/hostile.svg
  - e2e/fixtures/polyglot-gif-html.gif
  - e2e/fixtures/decode-bomb.png
covered_digest: "v3:sha256:edb01bdb2912259e458c4cdb3958e92cbef9b42c5e9edb6aa14c8dfbda451862"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "Re-running `docker compose up` after an interrupted start boots cleanly: `db` passes its `pg_isready` healthcheck before `api` starts, and the deploy e2e passes against a freshly rebuilt stack. (01-01, DEP-01 concurrency edge)"
    test: "Interrupt the stack (Ctrl-C / `docker compose stop api`), then `docker compose up -d` from the repo root and watch `docker compose ps`"
    expected: "db reaches `healthy` (pg_isready) before api starts; api connects and boots without a connection-retry failure; `npm run verify -- e2e/deploy.spec.ts` passes against that stack"
    why_human: "The ordering invariant is declarative in docker-compose.yml (`healthcheck` + `depends_on: condition: service_healthy`) and the deploy suite is green against the already-running stack, but no test exercises the interrupted-start restart transition — presence of the healthcheck clause is not behavior."
  - truth: "A concurrent burst cannot exceed the window maximum: limiter counters are incremented before the handler runs, so at most the configured maximum passes even when submissions arrive in parallel. (01-03, ING-05 concurrency edge)"
    test: "On a local `.env` with a small per-key maximum (e.g. `WATCHBUG_RATE_LIMIT_PER_KEY_PER_MIN=5`), fire ~10 POST /api/incidents in parallel with one fresh `X-Project-Key`-matching value and distinct `Idempotency-Key`s"
    expected: "Exactly ≤5 requests succeed; the rest get 429 with `Retry-After`; never more than the maximum pass"
    why_human: "The e2e proves the *sequential* boundary (exactly max pass, max+1 is 429). Increment-before-decide is visible in `plugins/rate-limit.ts`, but no test trips the limiter under parallel arrival, so the no-exceedance-under-interleaving invariant is present-and-wired, not behaviorally proven."
human_verification:
  - test: "Interrupted-start restart of the compose stack (see behavior_unverified_items[0])"
    expected: "db healthy before api starts; deploy e2e green against the freshly restarted stack"
    why_human: "Ordering/recovery transition not exercised by any automated row"
  - test: "Parallel burst over a small per-key rate limit (see behavior_unverified_items[1])"
    expected: "at most the configured maximum passes; the rest 429 with Retry-After"
    why_human: "Concurrency invariant of the in-memory limiter; the suite only proves the sequential boundary"
  - test: "Clean-checkout first boot (01-VALIDATION.md manual-only row): `cp .env.example .env`, `npm run key:gen` into `WATCHBUG_PROJECT_KEY`, `docker compose up -d` from a fresh clone, open http://127.0.0.1:8080"
    expected: "Stack comes up with no manual step beyond the `.env` copy; the panel shows the empty state with the onboarding curl"
    why_human: "Container bootstrap on a dev machine is environment-dependent; the suite asserts the running stack, not first-boot ergonomics (explicitly declared manual-only in the phase's own validation contract)"
  - test: "Panel visual check in a browser: two-column list/detail layout, light/dark tokens (`prefers-color-scheme`), language switcher (English/Español) and empty state"
    expected: "Layout renders as designed (P1-D-04/P1-D-06), switching language visibly changes labels, no hardcoded colours"
    why_human: "Visual appearance and UX cannot be asserted by grep or the API-level suite (phase ROADMAP UI hint: yes)"
---

# Phase 1: Contracts & Ingest Slice — Verification Report

**Phase Goal:** "A developer can start the self-hosted stack and push a report (image + metadata) across the wire into hardened, schema-validated storage that renders in a minimal panel — the contract, the constant set and the size gate exist from day one."
**Verified:** 2026-10-12T22:25:51Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior VERIFICATION.md)

> **MVP-mode note:** ROADMAP `Mode: mvp`, but the ROADMAP Goal line is prose (the plan's own frontmatter records this and transcribes it into story form: *"As a self-hosting developer, I want to start the Watchbug stack and push a report (image + metadata) across the wire into hardened, schema-validated storage that renders in a minimal panel, so that the ingest spine is proven end-to-end on my own infrastructure and neither the report nor its screenshot ever leaves it."*). Verification is goal-backward against that outcome plus the 5 roadmap Success Criteria and the four plans' `must_haves`.

## What was verified, and how

All four gates were **re-run in the verifier's own process** (not taken from SUMMARY claims):

| Gate | Command | Result |
| --- | --- | --- |
| Build (4 workspaces) | `npm run build` | **PASS**, exit 0 — `emit-schema.mjs` re-emitted `schema/report.schema.json` byte-identical (no git diff) |
| Typecheck | `npm run lint` | **PASS**, exit 0 |
| Size gate | `npm run check:size` | **PASS** — lanes green, `WORST CASE (all lanes loaded): 45 + 25 + 14 = 84 KB > 80 KB` printed (A-12/M-2) |
| Compose gate | `npm run check:compose` | **PASS** — "exactly three services: db, api, panel", attachments volume api-only |
| E2E (R-12 surface) | `npm run verify` | **PASS — 123/123** across chromium + firefox + webkit, 4.7 min, exit 0 |

Plus 12 targeted behavioral spot-checks (below) and full static wiring checks.

## Goal Achievement — Observable Truths

### 01-01 Walking Skeleton (16 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One `docker compose up` → panel lists a posted report (DEP-01) | ✓ VERIFIED | `docker compose ps` shows exactly api/panel/db up; `deploy.spec` panel-shell + `/api/health` rows and `ingest.spec` "panel renders the row and its screenshot" all green in my 123/123 run |
| 2 | All settings from `.env` per committed `.env.example`; missing/empty/placeholder key fails boot naming variable + file (DEP-02) | ✓ VERIFIED | `deploy.spec` env-doc scan + unset/placeholder/malformed boot rows (green); **spot-check:** boot with `WATCHBUG_PROJECT_KEY=""` vs unset both exit 1 with byte-identical `[watchbug] FATAL: WATCHBUG_PROJECT_KEY is missing or empty. Set it in .env…` |
| 3 | Synthetic report → exactly one row, image under server-generated key on api-only volume, renders in panel (ING-01) | ✓ VERIFIED | `ingest.spec:85` (201 + list + image round-trip) + panel row green; `fs-storage.ts:63 randomUUID` / `:86 rename`; spot-check P2 observed a server-generated `projectId/xx/uuid.png` key |
| 4 | Every stored report validates against published `schema/report.schema.json` (ENR-06) | ✓ VERIFIED | `ingest.spec:85` validates the stored row against the committed schema; build regenerates the schema with zero git diff |
| 5 | Retry with same `Idempotency-Key` → one report, replayed same id (ING-03) | ✓ VERIFIED | `ingest.spec:156` (201 then 200, same id, one row) green |
| 6 | `check:size` enforces tiers + prints 84 KB scenario; `check:compose` fails unless 3 services and volume api-only | ✓ VERIFIED | Both commands run by me, exit 0, outputs quoted above; fail branches present (`check-compose.mjs:79 COMPOSE FAIL expected exactly […]`) |
| 7 | Re-run after interrupted start boots cleanly: db healthy before api; deploy e2e on fresh stack | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `docker-compose.yml:22 pg_isready healthcheck` + `:58 condition: service_healthy` present and wired; deploy suite green against the running stack — but no test exercises the interrupted-start transition → human item |
| 8 | Empty key ≡ missing key (identical message); placeholder rejected (DEP-02 edge) | ✓ VERIFIED | `deploy.spec` placeholder row (green) + my boot probe: identical FATAL line for `""` and unset (`config.ts:87`) |
| 9 | Empty optional settings → documented defaults (30 / 90 / 10 / 30 / 2000), never 0/unbounded | ✓ VERIFIED | **Spot-check S5:** `loadConfig({...WATCHBUG_TTL_*: '', WATCHBUG_RATE_LIMIT_*: ''})` → `{"ttlIdentity":30,"ttlArtifact":90,"perKey":10,"perIp":30,"perDay":2000}`; `readInt` falls back on `trimmed === ''` (`config.ts:53-70`) |
| 10 | Config precedence deterministic and documented (process env wins; last duplicate in `.env` wins) | ✓ VERIFIED | `.env.example:6-8` "PRECEDENCE CONTRACT … Node `--env-file` semantics … LAST occurrence wins"; Node semantics documented, not code-dependent |
| 11 | Title boundary inclusive: 200 code units stored, 201 → 400 (ENR-06 edge) | ✓ VERIFIED | `hostile.spec:872` encoding-edge row green (incl. the documented Zod-4 code-point correction) |
| 12 | Missing/empty `meta` → 400; `{}`/missing fields → 400 naming offending fields (ENR-06 edge) | ✓ VERIFIED | **Spot-check S1/S2:** missing part → `400 {"issues":[{"field":"meta","message":"the \"meta\" part is missing or empty"}]}`; `{}` → `400` naming `type`, `title`; list count unchanged (859 → 859) |
| 13 | Multi-field failures listed in schema field-declaration order, stable across repeats (ENR-06 edge) | ✓ VERIFIED | **Spot-check S2a/S2b:** two identical requests produced byte-identical bodies, order `type, title` = `REPORT_FIELD_ORDER = ['type','title','note','url','user']` (`schema.ts:48`); sort logic in `validate-meta.ts:51-56` |
| 14 | Same submission twice → one row, same id (201 then 200) (ING-03 edge) | ✓ VERIFIED | `ingest.spec:156` green |
| 15 | Concurrent pair with one key → exactly one row via DB `UNIQUE (project_id, idempotency_key)`, never app-level check-then-insert | ✓ VERIFIED | `ingest.spec:170` concurrent-pair row green; `db/schema.ts:51 uniqueIndex` + migration `0000_…sql:32 CREATE UNIQUE INDEX incidents_project_idempotency_unique`; route uses `onConflictDoNothing({target:[projectId, idempotencyKey]})` (`incidents.ts:284`) |
| 16 | Missing `Idempotency-Key` → 400 structured `{statusCode,error,message}`, nothing stored | ✓ VERIFIED | `ingest.spec:189` row green (list unchanged); `incidents.ts:141-149` mandatory-header branch |

### 01-02 Hostile-Submission Hardening (8 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Body > `MAX_BODY_BYTES` (5 MB) → 413 via Content-Length pre-read **and** streaming counter (not `bodyLimit` alone) (ING-06) | ✓ VERIFIED | `hostile.spec` layers 2 + 2b green (chunked, no Content-Length → 413 naming `MAX_BODY_BYTES`); **my probe Q1** re-confirmed at the API origin |
| 2 | Part > 4 MB → 413 at parser; encoded > 2 MB → 413 semantic; truncated part never stored | ✓ VERIFIED | `hostile.spec` layer 1 + semantic-cap rows green (layer 1 is the truncation-at-limit path: `caps.ts:265 file.truncated → RequestPartTooLargeError`, tmp always unlinked at `caps.ts:269`); 413 precedes any insert |
| 3 | SVG/polyglot rejected 400; metadata + animation chunks and trailing data rejected/dropped | ✓ VERIFIED | `hostile.spec:299` C-3 row green (SVG, GIF/HTML polyglot, decode bomb); **my probes P1/P3/P4:** PNG trailing-after-IEND → 400, WebP trailing-past-File-Size → 400, `ANIM` WebP → 400 (`structure.ts:98,113,127`) |
| 4 | Decode bomb rejected from header dimensions before decode (`w*h > 16,777,216` or dim > 8192) | ✓ VERIFIED | `hostile.spec:299` decode-bomb leg green (`guard.ts` runs after structure, before harden) |
| 5 | Every accepted image passes `hardenImage()` before disk write: metadata stripped, output keeps input format | ✓ VERIFIED | Chain order in `incidents.ts:224→234→238→248→264`; format kept observed (`ingest.spec` png/webp round-trips, `content-type` from server ext); **my probe P2:** PNG carrying a `tEXt` chunk with marker `WATCHBUG-VERIF-MARKER` accepted → stored bytes (286 B) contain **neither** the marker **nor** a `tEXt` chunk |
| 6 | Hostile client filename → 400; stored keys always server-generated, request never names a file (C-4) | ✓ VERIFIED | `hostile.spec:329` traversal row green; `preservePath:true` + `validateClientFilename` in `caps.ts`; `fs-storage.ts` `randomUUID` + resolve-prefix assertion |
| 7 | Blob route serves only DB-resolved keys with the 5 inert headers, fixed ASCII name, 404 (never 400) for unknown ids | ✓ VERIFIED | `hostile.spec:339` (all five headers + `attachment; filename="screenshot.png"` + no `storageKey`/`projectId` projection) and `hostile.spec:376` (404) green; route resolves `storageKey` via DB select (`incidents.ts:330-332`) |
| 8 | *(backstop)* Oversized upload aborted at the streaming counter without buffering the body; partial tmp files unlinked; concurrent oversized uploads do not accumulate memory | ✓ VERIFIED | **My probe Q1 (direct observation):** 6 concurrent chunked 8 MB uploads (48 MB offered, no Content-Length) → 6/6 structured 413 naming `MAX_BODY_BYTES`, API container memory **+0.7 MB**, zero rows created. Backstop evidence obtained behaviorally, not by presence |

### 01-03 Ingest Gatekeeping (8 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Missing/unknown/malformed key → same structured 401, no existence oracle, nothing stored (ING-04) | ✓ VERIFIED | `hostile.spec:403` trio green (byte-identical body asserted); parameterised `where(eq(projects.publicKey, publicKey.trim()))` at `incidents.ts:81-83`, gate as preHandler (`incidents.ts:139`) before any write |
| 2 | Parallel invalid-key requests each get their own 401, no row regardless of interleaving | ✓ VERIFIED | `hostile.spec:437` concurrency row green |
| 3 | Three composed layers (10/key/min, 30/ip/min, 2000/project/day), env-configurable, 429 + `Retry-After` (ING-05) | ✓ VERIFIED | `hostile.spec:570/583/596` green; `plugins/rate-limit.ts` `createIngestRateLimit` with `byKey`/`byIp`/`byDay`; knobs in `.env.example:60-62`; app wiring `app.ts:57,61,82-95` |
| 4 | Boundary inclusive: exactly max pass, max+1 → 429, window resets | ✓ VERIFIED | The three boundary rows assert exactly that (green) |
| 5 | `Retry-After` = whole-second ceiling, min 1, never 0/fractional | ✓ VERIFIED | Rows assert integer ≥1; `retryAfterSeconds()` at `rate-limit.ts:65` |
| 6 | Concurrent burst cannot exceed the window maximum (increment-before-decide) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Sequential boundary proven by 3 green rows; increments run before the 429 decision (`rate-limit.ts:102-115`) — but no row trips a limiter under parallel arrival → human item |
| 7 | `Origin` present → accepted only if allowlisted; allowlisted gets CORS headers, else 403 nothing stored; no-`Origin` accepted (ING-08) | ✓ VERIFIED | `hostile.spec:666` trio green; `plugins/cors.ts:60-63` presence rule; `WATCHBUG_CORS_ORIGINS` documented |
| 8 | Mixed allowlisted/disallowed burst → independent per-request decisions | ✓ VERIFIED | `hostile.spec:689` mixed-burst row green |

### 01-04 Text Safety & First-Run Experience (8 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every user string sanitised on ingest and renders inert (ING-07, SEC-05) | ✓ VERIFIED | `hostile.spec` pass-1 (5 rows) + pass-2 DOM row + source sink gate green; `sanitizeMeta` covers title/note/url/user.* (`sanitize.ts:80-99`) |
| 2 | Text-preserving: `2 < 3 & 4 > 1` round-trips literally; markup stripped | ✓ VERIFIED | `hostile.spec:839` green |
| 3 | Zero-length title → 400; absent optionals stored `null` | ✓ VERIFIED | `hostile.spec:854` green |
| 4 | Caps inclusive at the cap; sanitised output never exceeds its cap | ✓ VERIFIED | `hostile.spec:872` green (code-point semantics pinned — plan's "code units" premise corrected and documented) |
| 5 | Sanitisation preserves document order of surviving text | ✓ VERIFIED | `hostile.spec:839` styled-fragment leg green |
| 6 | *(backstop)* Sanitisation is pure per-request: concurrent hostile submissions independent, no cross-request leakage | ✓ VERIFIED | **My probe Q2 (direct observation):** 8 concurrent hostile submissions with unique markers → 8/8 stored rows paired with their own request, markup stripped, **0 cross-leaks** |
| 7 | Spanish default on `navigator.language` starting `es`, selector persisted in `watchbug.lang` across reload (P1-D-05, RNF-03) | ✓ VERIFIED | `ingest.spec:379` green |
| 8 | Empty state = copy-paste curl with the real project key; running it verbatim files a real report (P1-D-07) | ✓ VERIFIED | `ingest.spec:276` (shape + real key) and `ingest.spec:298` (**curl spawned and executed → 201 → visible after reload**) green; `GET /api/setup` registered (`app.ts:75`) |

**Score: 38/40 truths verified** (2 present + wired, behavior unexercised → `behavior_unverified: 2`, routed to human verification).

## Prohibitions (must-NOTs)

| # | Statement | Status | Evidence |
| --- | --- | --- | --- |
| P1 (01-01) | Stored payload stays a closed shape — unknown fields rejected 400, never stored | ✓ VERIFIED (observed) | `reportSchema = z.strictObject` (`schema.ts:23`); **my probe S3:** meta with `extra_field` → `400 {"issues":[{"field":"meta","message":"Unrecognized key: \"extra_field\""}]}`, list unchanged |
| P2 (01-01) | Contract never exports/permits an invertible or weak masking primitive | ✓ VERIFIED | Only `MASK_ALPHA_OPAQUE=255` and `MASK_PIXELATION_MIN_BLOCK_PX=8` exported (`constants.ts:62-63`); repo-wide grep for `blur|smear|soften` in contracts → only the R-13 prohibition comment (`constants.ts:58`) |
| P3 (01-04) | No third-party network requests from panel/API | ✓ VERIFIED | Zero `http(s)://` occurrences under `apps/panel/src` + `index.html`; API only self-references `127.0.0.1` (`index.ts:91`); SDK src has no `fetch`/URL |

## Roadmap Success Criteria

| SC | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Start API/panel/db with one `docker-compose up`; every setting from committed `.env.example` | ✓ VERIFIED | `check:compose` 3 services (run by me); `deploy.spec` env-doc + boot rows green |
| 2 | Synthetic report over HTTP → DB row + image on volume under server-generated key, listed in minimal panel | ✓ VERIFIED | `ingest.spec:85` + panel row green; `fs-storage.ts` server-keyed layout; probe P2 observed the key |
| 3 | Every landed report validates against `schema/report.schema.json`; same idempotency key → exactly one report | ✓ VERIFIED | `ingest.spec:85` + `:156` + `:170` green; DB unique index in committed migration |
| 4 | Hostile submission cannot get stored: keys/oversize/SVG/polyglot/traversal → 401/413/429/400; user text stored sanitised and renders inert | ✓ VERIFIED | 23-row hostile group green (69/69 over 3 browsers) + my probes P1/P3/P4/Q1 |
| 5 | Throttles per key and per IP (+ daily quota, 429 + `Retry-After`); allowlisted origins only | ✓ VERIFIED (sequential behavior; see ⚠️ 01-03 #6 and finding CR-01) | `hostile.spec:570/583/596/666/689` green |

## Requirements Coverage (all 10 plan requirement IDs accounted for)

| Requirement | REQUIREMENTS.md | Plan | Status | Evidence |
| --- | --- | --- | --- | --- |
| DEP-01 | line 137, Phase 1 Complete | 01-01 | ✓ SATISFIED | `deploy.spec` 2 rows green; `check:compose` PASS |
| DEP-02 | line 138, Phase 1 Complete | 01-01 | ✓ SATISFIED | `deploy.spec` 4 rows green + my empty-key/defaults probes |
| ENR-06 | line 95, Phase 1 Complete | 01-01 | ✓ SATISFIED | `ingest.spec:85` + `validate-meta.ts` (ordering/empty edges observed) |
| ING-01 | line 99, Phase 1 Complete | 01-01 | ✓ SATISFIED | `ingest.spec:85` 201 + image round-trip green |
| ING-03 | line 101, Phase 1 Complete | 01-01 | ✓ SATISFIED | `ingest.spec:156/170/189` green; DB unique index |
| ING-04 | line 102, Phase 1 Complete | 01-03 | ✓ SATISFIED | `hostile.spec:403/437` green |
| ING-05 | line 103, Phase 1 Complete | 01-03 | ✓ SATISFIED | `hostile.spec:570/583/596` green (concurrency clause → human; CR-01 advisory) |
| ING-06 | line 104, Phase 1 Complete | 01-02 | ✓ SATISFIED | `hostile.spec` 5 layered rows green + my probe Q1 |
| ING-07 | line 105, Phase 1 Complete | 01-04 | ✓ SATISFIED | `hostile.spec` 7 ING-07 rows green + my probe Q2 |
| ING-08 | line 106, Phase 1 Complete | 01-03 | ✓ SATISFIED | `hostile.spec:666/689` green |

**Orphaned requirements:** none. REQUIREMENTS.md maps exactly these 10 IDs to Phase 1 (rows 249-257, 276-277). `DEP-03` is mapped to **Phase 5** (Pending) — the phase's own scope note defers "served only through the *authenticated* API"; correct for Phase 1, not a gap.

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Real data? | Status |
| --- | --- | --- | --- | --- |
| `apps/panel/src/api.ts` → `App.tsx` | `incidents` state | `fetch('/api/incidents')` → nginx → Fastify → PostgreSQL (`db.select().from(incidents)`) | Yes | ✓ FLOWING |
| `ReportDetail` image | `incidentImageUrl(id)` | `GET /api/incidents/:id/image` → DB `storage_key` → `FsStorage.stream()` file | Yes | ✓ FLOWING |
| `EmptyState` curl | `fetchSetup()` | `GET /api/setup` → `config.projectKey` (boot-seeded `.env` value) | Yes (verified by executed-curl e2e row) | ✓ FLOWING |
| Ingest write path | multipart `meta` + `image` | validated → hardened → `Storage.put` → `incidents` row | Yes (observed end-to-end by e2e + my probes) | ✓ FLOWING |
| Panel static strings | i18n dictionaries | `i18n.ts` en/es | Yes (typed dictionary, switcher row green) | ✓ FLOWING |

No hardcoded/static data sinks found; no `return []`/`return null` stubs in the render path (stub scan clean).

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| CA-01 wire shape (`meta` + `image`, `X-Project-Key` + `Idempotency-Key`) | `routes/incidents.ts` multipart parse | `caps.ts` receive policy (`preservePath:true`, limits from contracts constants) | WIRED | e2e POST rows + my probes exercised the exact shape |
| `constants.ts` → Zod `maxLength` → API enforcement | `schema.ts` imports every bound from `constants.ts` (R-18) | `validate-meta` / `incidents.ts` import `@watchbug/contracts/constants` | WIRED | *panel clamps* segment is vacuous in Phase 1 (panel is list/detail; no input form until Phase 3) |
| `incidents.storage_key` → fs-storage → `GET …/image` DB-lookup-only | `incidents.ts:330` select `storageKey` → `storage.stream(row.storageKey)` | `STORAGE_KEY_REGEX` + resolve-prefix assert before file access | WIRED | blob-header + 404 rows green; no key exposed in any projection |
| `panel fetch('/api/…')` → nginx `location /api/` → `proxy_pass http://api:3000` | `api.ts` relative fetches | `apps/panel/nginx.conf:18-19` | WIRED | `/api/health` through the proxy green (A-10 same-origin) |
| `.env` `WATCHBUG_PROJECT_KEY` → boot seed → `X-Project-Key` lookup → e2e + onboarding curl | `boot/seed.ts:20 onConflictDoNothing` | `incidents.ts:81` keyed lookup; e2e and `EmptyState` curl read the same value | WIRED | `/api/setup` row + executed-curl row green |

## Requirements / Artifacts Summary (Level 1-3)

Every artifact listed in the four plans' `must_haves.artifacts` exists and is substantive (spot-verified: `caps.ts`, `structure.ts`, `harden.ts`, `sanitize.ts`, `rate-limit.ts`, `cors.ts`, `fs-storage.ts`, `validate-meta.ts`, migration SQL, panel components, scripts, e2e specs, fixtures). No MISSING, no STUB, no ORPHANED artifacts. Migration committed and clean (`git status --porcelain apps/api/drizzle` → empty).

## Behavioral Spot-Checks

| # | Behavior | Command | Result | Status |
| --- | --- | --- | --- | --- |
| 1 | Build all workspaces | `npm run build` | exit 0, schema re-emitted identically | ✓ PASS |
| 2 | Typecheck | `npm run lint` | exit 0 | ✓ PASS |
| 3 | Size tiers + worst-case print | `npm run check:size` | PASS, `45 + 25 + 14 = 84 KB > 80 KB` printed | ✓ PASS |
| 4 | Compose 3 services, volume api-only | `npm run check:compose` | PASS | ✓ PASS |
| 5 | Full e2e suite | `npm run verify` | **123/123**, 4.7 min, exit 0 | ✓ PASS |
| 6 | Missing `meta` part → 400 naming field | `curl -F image=…` (no meta) | 400 structured, list 859→859 | ✓ PASS |
| 7 | `meta={}` → 400 naming offending fields, schema order, stable | two identical curls | identical bodies, `type, title` order = `REPORT_FIELD_ORDER` | ✓ PASS |
| 8 | Unknown field rejected (closed shape) | curl with `extra_field` | 400 `Unrecognized key: "extra_field"` | ✓ PASS |
| 9 | Empty key ≡ unset key | spawn `apps/api/dist/index.mjs` ×2 | exit 1 both, byte-identical FATAL line | ✓ PASS |
| 10 | Empty optional settings → defaults | `loadConfig({...''})` via tsx | `30/90/10/30/2000` | ✓ PASS |
| 11 | Structure rejects trailing/animated containers | crafted PNG+16B / WebP+8B / `ANIM` WebP | 400 ×3 with precise messages | ✓ PASS |
| 12 | Metadata never survives storage | PNG + `tEXt` marker chunk → POST → GET | 201; stored bytes contain no marker, no `tEXt` | ✓ PASS |
| 13 | Concurrent oversize aborted without buffering | 6 × chunked 8 MB (48 MB offered) in parallel | 6/6 413 `MAX_BODY_BYTES`, API mem **+0.7 MB**, 0 rows | ✓ PASS |
| 14 | Concurrent sanitisation independence | 8 parallel hostile submissions, unique markers | 8/8 correctly paired, markup stripped, 0 cross-leaks | ✓ PASS |

**Probe side-effects disclosed:** spot-checks 12 and 14 created rows in the local dev database; each row **and** its blob was deleted afterwards (list count restored to the pre-probe 859; `git status --porcelain` unchanged apart from the pre-existing untracked `.planning/milestone.lock` and `documentation/img/`).

## Probe Execution

No `scripts/*/tests/probe-*.sh` files exist and neither PLAN nor SUMMARY declares a probe script (this phase's verification surface is `npm run verify` + `npm run check:size`, per R-12 and 01-VALIDATION.md). Probe execution: **SKIPPED (none declared)**. SUMMARY PASS-marker claims were not used as evidence — all four gates were re-run.

## Anti-Pattern Scan

| File scope | Pattern | Severity | Result |
| --- | --- | --- | --- |
| All phase `files_modified` (src/scripts/e2e) | `TBD` / `FIXME` / `XXX` debt markers | 🛑 if unreferenced | **None found** |
| `apps/**`, `packages/**` | `TODO` / `HACK` / `PLACEHOLDER` | ⚠️ | Only a *message string* describing the `.env` placeholder key (`config.ts:96`) — correct behavior, not a stub |
| `apps/panel/src` | `dangerouslySetInnerHTML` / `innerHTML` | 🛑 (SEC-05) | **0 occurrences** (also asserted by a suite row) |
| manifests | `jest`/`vitest`/`mocha`/`ava`, `dotenv`, `zod-to-json-schema` | 🛑 (R-12 / STACK rejects) | **None found** |
| `apps/api/src`, `packages/sdk/src`, `scripts` | `Math.random` | 🛑 (P1-D-03) | Only the comment in `gen-key.mjs:13` stating `Math.random` is banned; randomness is `crypto.randomBytes` |
| panel/API/SDK | third-party network destinations | 🛑 (01-04 prohibition) | None (see Prohibitions P3) |
| Empty implementations / hardcoded `[]` render sinks | `return null`/`= []` in render path | ⚠️ | None in `apps/panel/src` (initial `useState(null)` is fetch-populated) |

## Findings from 01-REVIEW (advisory — NOT counted as failed must-haves)

13 open findings (2 critical / 6 warning / 5 info), per `01-REVIEW-DISPOSITION.md`:

- **CR-01 (critical, open):** per-key/per-day limiters key on the raw header while the gate trims it → a padded `X-Project-Key` gets a fresh quota bucket (rate-limit bypass). *No plan acceptance criterion is unmet (the boundary rows pass), but this materially weakens ING-05 in adversarial conditions — recommend fixing before Phase 2 exposes the endpoint to the real widget.*
- **CR-02 (critical, open):** with `WATCHBUG_TRUST_PROXY=true` (the documented compose setting) `req.ip` is the client-controlled leftmost `X-Forwarded-For` → per-IP limiter spoofable. Same disposition as CR-01.
- **WR-01** idempotent-replay lookup not project-scoped (cross-tenant id on conflict) — single-project phase; becomes real when Phase 5 adds projects.
- **WR-02** 2 MB semantic cap checked on input only (re-encode output not re-capped) · **WR-03** blob written before insert → orphaned files on DB failure (the plan explicitly accepts orphan blobs for idempotency) · **WR-04** shipped `.env.example` rate-limit values make the documented quickstart `npm run verify` fail (e2e needs the tuned local `.env`) · **WR-05** streaming-413 watcher can double-`reply.send` · **WR-06** API container runs as root.
- **IN-01…IN-05** info: JSON body parsed before limiter; blob stream opened before content-type check; no CSP on panel HTML; R-08 path-only `url` rule unenforced server-side; unreachable `BodyCapExceeded` branch.

None of these unmet a plan `acceptance_criteria` row, so none is promoted to a gap; they are reported here and in the disposition record for the orchestrator's decision (fix / defer with reason).

**Other carried-forward items:** `deferred-items.md` — 4 dev-only `npm audit` advisories in `drizzle-kit`'s esbuild chain (breaking downgrade = owner call); Node 24 image re-pin scheduled after 2026-10-20; package-lock maintained by hand.

**Recorded decision-coverage false positive:** the `check.decision-coverage-plan` `could-not-parse` on `P1-D-NN` IDs is the developer-overridden parser false positive recorded in `.planning/STATE.md` (plan-checker dimension-7 already mapped `P1-D-01…P1-D-12` to tasks). **Not** reported as a dropped decision; no decision-coverage gate was re-run by this verifier.

## Human Verification Required

See `human_verification` in frontmatter (4 items): (1) interrupted-start compose restart; (2) parallel burst over a small per-key rate limit; (3) clean-checkout first-boot ergonomics (VALIDATION.md manual-only row); (4) panel visual check (two-column layout, tokens, language switcher).

## Gaps Summary

**No gaps.** All 40 must-have truths resolve to VERIFIED (38) or PRESENT_BEHAVIOR_UNVERIFIED (2); all artifacts exist, are substantive, wired and data-flowing; all 5 key links are wired; all 10 requirement IDs are satisfied with no orphans; all 3 prohibitions verified; no debt markers, no stubs, no forbidden dependencies. The phase goal — stack starts, a report crosses the wire into hardened schema-validated storage and renders in the panel, with the contract, constant set and size gate from day one — is observably achieved in the codebase. Status is `human_needed` solely because two behavior-dependent invariants lack an exercising test and the plan/validation contract carries human-only checks (first-boot ergonomics, visual UI).

---

_Verified: 2026-10-12T22:25:51Z_
_Verifier: the agent (gsd-verifier subagent) — gates re-run in-process; SUMMARY claims used only as pointers_
