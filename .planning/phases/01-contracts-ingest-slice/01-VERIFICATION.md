---
phase: 01-contracts-ingest-slice
verified: 2026-10-13T15:39:46Z
status: passed
score: 40/40 must-haves verified
covered_files:
  - .env.example
  - .gitattributes
  - .gitignore
  - .planning/phases/01-contracts-ingest-slice/01-01-PLAN.md
  - .planning/phases/01-contracts-ingest-slice/01-01-SUMMARY.md
  - .planning/phases/01-contracts-ingest-slice/01-02-PLAN.md
  - .planning/phases/01-contracts-ingest-slice/01-02-SUMMARY.md
  - .planning/phases/01-contracts-ingest-slice/01-03-PLAN.md
  - .planning/phases/01-contracts-ingest-slice/01-03-SUMMARY.md
  - .planning/phases/01-contracts-ingest-slice/01-04-PLAN.md
  - .planning/phases/01-contracts-ingest-slice/01-04-SUMMARY.md
  - apps/api/Dockerfile
  - apps/api/drizzle.config.ts
  - apps/api/drizzle/0000_grey_the_santerians.sql
  - apps/api/package.json
  - apps/api/src/app.ts
  - apps/api/src/boot/seed.ts
  - apps/api/src/config.ts
  - apps/api/src/db/client.ts
  - apps/api/src/db/schema.ts
  - apps/api/src/index.ts
  - apps/api/src/ingest/caps.ts
  - apps/api/src/ingest/guard.ts
  - apps/api/src/ingest/harden.ts
  - apps/api/src/ingest/sanitize.ts
  - apps/api/src/ingest/sniff.ts
  - apps/api/src/ingest/structure.ts
  - apps/api/src/ingest/validate-meta.ts
  - apps/api/src/plugins/cors.ts
  - apps/api/src/plugins/rate-limit.ts
  - apps/api/src/ports.ts
  - apps/api/src/routes/incidents.ts
  - apps/api/src/routes/setup.ts
  - apps/api/src/storage/fs-storage.ts
  - apps/api/tsconfig.json
  - apps/panel/Dockerfile
  - apps/panel/index.html
  - apps/panel/nginx.conf
  - apps/panel/package.json
  - apps/panel/src/App.tsx
  - apps/panel/src/api.ts
  - apps/panel/src/components/EmptyState.tsx
  - apps/panel/src/components/LanguageSwitcher.tsx
  - apps/panel/src/components/ReportDetail.tsx
  - apps/panel/src/components/ReportList.tsx
  - apps/panel/src/i18n.ts
  - apps/panel/src/main.tsx
  - apps/panel/src/tokens.css
  - apps/panel/src/vite-env.d.ts
  - apps/panel/tsconfig.json
  - apps/panel/vite.config.ts
  - docker-compose.yml
  - e2e/deploy.spec.ts
  - e2e/fixtures/decode-bomb.png
  - e2e/fixtures/hostile.svg
  - e2e/fixtures/polyglot-gif-html.gif
  - e2e/fixtures/valid-64x64.png
  - e2e/fixtures/valid-64x64.webp
  - e2e/global-setup.ts
  - e2e/hostile.spec.ts
  - e2e/ingest.spec.ts
  - e2e/make-fixtures.mjs
  - package-lock.json
  - package.json
  - packages/contracts/package.json
  - packages/contracts/scripts/emit-schema.mjs
  - packages/contracts/src/constants.ts
  - packages/contracts/src/schema.ts
  - packages/contracts/src/types.ts
  - packages/contracts/tsconfig.json
  - packages/sdk/package.json
  - packages/sdk/scripts/build.mjs
  - packages/sdk/src/annotator.ts
  - packages/sdk/src/capture/dom-serialize.ts
  - packages/sdk/src/index.ts
  - packages/sdk/tsconfig.json
  - playwright.config.ts
  - schema/report.schema.json
  - scripts/check-compose.mjs
  - scripts/check-size.mjs
  - scripts/gen-key.mjs
  - tsconfig.base.json
covered_digest: "v2:sha256:d5ec34bfd12e77a777d22bb283cbf4ee7ffeccce5d604221f21e251b5f066f09"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 38/40
  gaps_closed:
    - "Interrupted-start compose restart ordering (01-01 truth 7): observed behaviorally in this verifier's own cold `docker compose up -d --build` (db → healthy → api started, in that order) and by human UAT test 1 (pass) — no longer present-only"
    - "Concurrent burst cannot exceed the window maximum (01-03 truth 6): human UAT test 2 fired a parallel burst over a small per-key maximum and observed at most the maximum passing, the rest 429 with Retry-After — the interleaving invariant is now behaviorally proven"
    - "All 4 human verification items from the prior report completed 4/4 pass, 0 issues (01-UAT.md, 2026-10-13)"
    - "All 8 critical/warning findings of 01-REVIEW (CR-01, CR-02, WR-01…WR-06) fixed with RED→GREEN evidence; suite grew 123 → 132 rows; the 2 former advisories are closed, not carried"
  gaps_remaining: []
  regressions: []
---

# Phase 1: Contracts & Ingest Slice — Verification Report (re-verification)

**Phase Goal:** "A developer can start the self-hosted stack and push a report (image + metadata) across the wire into hardened, schema-validated storage that renders in a minimal panel — the contract, the constant set and the size gate exist from day one."
**Verified:** 2026-10-13T15:39:46Z
**Status:** passed
**Re-verification:** Yes — the prior report (`2026-10-12T22:25:51Z`, `human_needed`, 38/40) went stale because covered source files changed after it ran: the 01-REVIEW fix round (CR-01/CR-02 + WR-01…WR-06), the ING-06 pre-read linger fix (`ed20ec3`), the security re-verification (`01-SECURITY.md`, `threats_open: 0`), and the completed human UAT. This report re-runs every gate against the **current on-disk state** (HEAD `182dd69`, clean working tree) and supersedes it.

> **MVP-mode note (carried):** ROADMAP `Mode: mvp`, but the ROADMAP Goal line is prose (the plan's frontmatter transcribes it into story form: *"As a self-hosting developer, I want to start the Watchbug stack and push a report (image + metadata) across the wire into hardened, schema-validated storage that renders in a minimal panel, so that the ingest spine is proven end-to-end on my own infrastructure and neither the report nor its screenshot ever leaves it."*). Verification is goal-backward against that outcome plus the 5 roadmap Success Criteria and the four plans' `must_haves`.

## What was verified, and how

All gates were **re-run in this verifier's own process** against a stack freshly rebuilt from the current tree (Docker daemon was down at start; the verifier launched it and ran `docker compose up -d --build` — full cold path):

| Gate | Command | Result |
| --- | --- | --- |
| Cold stack bring-up | `docker compose up -d --build` | **PASS** — build output observed `db Started → Waiting → Healthy → api Starting → panel Starting` (the healthcheck ordering invariant, behaviorally); `/api/health` → `{"status":"ok"}` |
| Build (4 workspaces) | `npm run build` | **PASS**, exit 0 — `schema/report.schema.json` re-emitted byte-identical (`git status --porcelain schema/` empty) |
| Typecheck | `npm run lint` | **PASS**, exit 0 |
| Size gate | `npm run check:size` | **PASS** — lanes green, `WORST CASE (all lanes loaded): 45 + 25 + 14 = 84 KB > 80 KB` printed (A-12/M-2) |
| Compose gate | `npm run check:compose` | **PASS** — "exactly three services: db, api, panel", attachments volume api-only |
| E2E (R-12 surface) | `npm run verify` | **PASS — 132/132** across chromium + firefox + webkit, 5.8 min, exit 0 (44 test rows × 3 browsers; includes the 3 new CR-01/CR-02 regression rows) |
| WR-06 runtime check | `docker exec watchbug-api-1 id` | **PASS** — `uid=1000(node) gid=1000(node)`; image config `User: node` |

Plus 4 live behavioral probes (below) and full static wiring/anti-pattern checks over every file changed since the prior report.

## Goal Achievement — Observable Truths

### 01-01 Walking Skeleton (16 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One `docker compose up` → panel lists a posted report (DEP-01) | ✓ VERIFIED | My own cold `docker compose up -d --build` → healthy stack; `deploy.spec` + `ingest.spec:221` panel rows green in my 132/132 run |
| 2 | All settings from `.env` per committed `.env.example`; missing/empty/placeholder key fails boot naming variable + file (DEP-02) | ✓ VERIFIED | `deploy.spec` env-doc scan + unset/placeholder/malformed boot rows green in my run; fail-fast path at `config.ts:53-54` (`[watchbug] FATAL: …`) |
| 3 | Synthetic report → exactly one row, image under server-generated key on api-only volume, renders in panel (ING-01) | ✓ VERIFIED | `ingest.spec:85` (201 + list + image round-trip) + `:221` panel row green; `fs-storage.ts` `randomUUID` keys (`:1`) + `STORAGE_KEY_REGEX` check (`:47`); `check:compose` volume assertion |
| 4 | Every stored report validates against published `schema/report.schema.json` (ENR-06) | ✓ VERIFIED | `ingest.spec:85` validates the stored row against the committed schema (green); build regenerated the schema with zero git diff |
| 5 | Retry with same `Idempotency-Key` → one report, replayed same id (ING-03) | ✓ VERIFIED | `ingest.spec:156` (201 then 200, same id, one row) green |
| 6 | `check:size` enforces tiers + prints 84 KB scenario; `check:compose` fails unless 3 services and volume api-only | ✓ VERIFIED | Both commands run by me, exit 0, outputs quoted above |
| 7 | Re-run after interrupted start boots cleanly: db healthy before api; deploy e2e on fresh stack | ✓ VERIFIED *(was ⚠️; now behaviorally closed)* | **This verifier's own cold bring-up** observed `db → Waiting → Healthy → api Starting` in the compose output, then the full suite passed 132/132 against that freshly rebuilt stack; **human UAT test 1** (interrupt, restart, watch `docker compose ps`) passed. `docker-compose.yml:22-24` healthcheck + `:58 condition: service_healthy` |
| 8 | Empty key ≡ missing key (identical message); placeholder rejected (DEP-02 edge) | ✓ VERIFIED | `deploy.spec` placeholder row green; `config.ts:73` fatal naming the file |
| 9 | Empty optional settings → documented defaults (30 / 90 / 10 / 30 / 2000), never 0/unbounded | ✓ VERIFIED | `readInt` fallback at `config.ts:65`; deploy env rows green |
| 10 | Config precedence deterministic and documented (process env wins; last duplicate in `.env` wins) | ✓ VERIFIED | `.env.example` "PRECEDENCE CONTRACT … LAST occurrence wins" — Node `--env-file` semantics, not code-dependent |
| 11 | Title boundary inclusive: 200 code units stored, 201 → 400 (ENR-06 edge) | ✓ VERIFIED | `hostile.spec:1086` encoding-edge row green (Zod-4 code-point semantics pinned, documented correction) |
| 12 | Missing/empty `meta` → 400; `{}`/missing fields → 400 naming offending fields (ENR-06 edge) | ✓ VERIFIED | **My live probe P-B:** `curl -F image=@valid-64x64.png` (no meta) → `400 {"issues":[{"field":"meta","message":"the \"meta\" part is missing or empty"}]}`, list count unchanged (1380 → 1380) |
| 13 | Multi-field failures listed in schema field-declaration order, stable across repeats (ENR-06 edge) | ✓ VERIFIED | Sort at `validate-meta.ts:65` over `REPORT_FIELD_ORDER` (`schema.ts`); `hostile.spec` meta rows green in my run |
| 14 | Same submission twice → one row, same id (201 then 200) (ING-03 edge) | ✓ VERIFIED | `ingest.spec:156` green |
| 15 | Concurrent pair with one key → exactly one row via DB `UNIQUE (project_id, idempotency_key)`, never app-level check-then-insert | ✓ VERIFIED | `ingest.spec:170` concurrent-pair row green; migration unique index + `onConflictDoNothing({target:[projectId, idempotencyKey]})` at `incidents.ts:319` |
| 16 | Missing `Idempotency-Key` → 400 structured `{statusCode,error,message}`, nothing stored | ✓ VERIFIED | `ingest.spec:189` green (list unchanged) |

### 01-02 Hostile-Submission Hardening (8 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Body > `MAX_BODY_BYTES` (5 MB) → 413 via Content-Length pre-read **and** streaming counter (not `bodyLimit` alone) (ING-06) | ✓ VERIFIED | `hostile.spec:320` (pre-read, now read on a raw socket and asserting the pre-read wording) + `:336` (chunked, no Content-Length) green; **my live probe P-C:** declared `Content-Length: 9437184` → `413 … rejected from the Content-Length pre-read before the body was read` — the exact wording of the `ed20ec3` linger fix (`caps.ts:151 lingerBeforeClose`), proving the reply survives an in-flight upload |
| 2 | Part > 4 MB → 413 at parser; encoded > 2 MB → 413 semantic; truncated part never stored | ✓ VERIFIED | `hostile.spec:305` (layer 1, truncation path) + `:357` (semantic cap) green; input check `incidents.ts:228` **plus the post-re-encode re-cap WR-02 added at `incidents.ts:276`** (stored bytes can never exceed the cap either) |
| 3 | SVG/polyglot rejected 400; metadata + animation chunks and trailing data rejected/dropped | ✓ VERIFIED | `hostile.spec:375` (SVG, GIF/HTML polyglot, decode bomb) green on 3 browsers |
| 4 | Decode bomb rejected from header dimensions before decode (`w*h > 16,777,216` or dim > 8192) | ✓ VERIFIED | Decode-bomb leg of `hostile.spec:375` green (`guard.ts` runs after structure, before harden) |
| 5 | Every accepted image passes `hardenImage()` before disk write: metadata stripped, output keeps input format | ✓ VERIFIED | Chain order in `incidents.ts`; png/webp round-trips (`ingest.spec:85/:137`) green; structure guard drops `tEXt`/`eXIf`/`zTXt`/`iTXX` after IEND (`01-SECURITY.md` T-01-04) |
| 6 | Hostile client filename → 400; stored keys always server-generated, request never names a file (C-4) | ✓ VERIFIED | `hostile.spec:405` traversal row green; `preservePath:true` + `validateClientFilename` in `caps.ts`; `fs-storage.ts` server keys |
| 7 | Blob route serves only DB-resolved keys with the 5 inert headers, fixed ASCII name, 404 (never 400) for unknown ids | ✓ VERIFIED | `hostile.spec:415` (all five headers + fixed `attachment` name + no `storageKey`/`projectId` projection) and `:452` (404) green; route resolves `storageKey` via DB select (`incidents.ts:380`, stream at `:395`) |
| 8 | *(backstop)* Oversized upload aborted at the streaming counter without buffering the body; partial tmp files unlinked; concurrent oversized uploads do not accumulate memory | ✓ VERIFIED | `hostile.spec:336` chunked-abort row green in my run; tmp always unlinked + `reply.sent`/`writableEnded`/`destroyed` guard (`caps.ts:226-228`, the WR-05 fix) closes the double-reply race; prior direct observation (6 concurrent 8 MB chunked uploads → 6× 413, +0.7 MB API memory, 0 rows) still stands — the counter path is unchanged in substance |

### 01-03 Ingest Gatekeeping (8 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Missing/unknown/malformed key → same structured 401, no existence oracle, nothing stored (ING-04) | ✓ VERIFIED | `hostile.spec:479` trio green; **my live probe P-A:** unknown key → `401 {"statusCode":401,"error":"Unauthorized","message":"invalid or missing project key"}`, list unchanged; parameterised gate preHandler `incidents.ts:123`, chain at `:140` |
| 2 | Parallel invalid-key requests each get their own 401, no row regardless of interleaving | ✓ VERIFIED | `hostile.spec:513` concurrency row green |
| 3 | Three composed layers (10/key/min, 30/ip/min, 2000/project/day), env-configurable, 429 + `Retry-After` (ING-05) | ✓ VERIFIED | `hostile.spec:647/660/673` green; `plugins/rate-limit.ts`; knobs in `.env.example:76-78`; app wiring `app.ts:60` (`global: false`) |
| 4 | Boundary inclusive: exactly max pass, max+1 → 429, window resets | ✓ VERIFIED | The three boundary rows assert exactly that (green in my run) |
| 5 | `Retry-After` = whole-second ceiling, min 1, never 0/fractional | ✓ VERIFIED | `retryAfterSeconds()` at `rate-limit.ts:67-68` (`Math.max(1, Math.ceil(...))`); rows assert integer ≥1 |
| 6 | Concurrent burst cannot exceed the window maximum (increment-before-decide) | ✓ VERIFIED *(was ⚠️; now behaviorally closed)* | **Human UAT test 2:** parallel burst over a small per-key maximum → at most the maximum passed, the rest 429 with `Retry-After`. Increment-before-decide in `rate-limit.ts`; plus the new **CR-01** row (`hostile.spec:764`) proving a padded key shares its bucket and the **CR-02** rows (`:800`, `:814`) proving the per-IP bucket can't be minted fresh — the interleaving-adjacent bypasses are regression-tested on 3 browsers |
| 7 | `Origin` present → accepted only if allowlisted; allowlisted gets CORS headers, else 403 nothing stored; no-`Origin` accepted (ING-08) | ✓ VERIFIED | `hostile.spec:880` trio green; presence rule `cors.ts:34/60` |
| 8 | Mixed allowlisted/disallowed burst → independent per-request decisions | ✓ VERIFIED | `hostile.spec:903` mixed-burst row green |

### 01-04 Text Safety & First-Run Experience (8 truths)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every user string sanitised on ingest and renders inert (ING-07, SEC-05) | ✓ VERIFIED | `hostile.spec:991` (pass 1, 5 payload rows) + `:1150` (pass 2 DOM) + `:1200` (source sink gate) green on 3 browsers |
| 2 | Text-preserving: `2 < 3 & 4 > 1` round-trips literally; markup stripped | ✓ VERIFIED | `hostile.spec:1053` green |
| 3 | Zero-length title → 400; absent optionals stored `null` | ✓ VERIFIED | `hostile.spec:1068` green |
| 4 | Caps inclusive at the cap; sanitised output never exceeds its cap | ✓ VERIFIED | `hostile.spec:1086` green (code-point semantics pinned) |
| 5 | Sanitisation preserves document order of surviving text | ✓ VERIFIED | `hostile.spec:1053` styled-fragment leg green |
| 6 | *(backstop)* Sanitisation is pure per-request: concurrent hostile submissions independent, no cross-request leakage | ✓ VERIFIED | Prior direct probe (8 concurrent hostile submissions, unique markers → 8/8 correctly paired, 0 cross-leaks) — `sanitize.ts` (`PLAIN_TEXT` allowlist at `:33`, `sanitizeMeta` at `:80`) unchanged since that probe and re-exercised by 15 green ING-07 rows in my run |
| 7 | Spanish default on `navigator.language` starting `es`, selector persisted in `watchbug.lang` across reload (P1-D-05, RNF-03) | ✓ VERIFIED | `ingest.spec:379` green |
| 8 | Empty state = copy-paste curl with the real project key; running it verbatim files a real report (P1-D-07) | ✓ VERIFIED | `ingest.spec:265` (key endpoint), `:276` (shape + real key) and `:298` (**curl spawned and executed → 201 → visible after reload**) green; `registerSetupRoutes` at `app.ts:78` |

**Score: 40/40 truths verified.** The 2 truths the prior report left ⚠️ are now behaviorally closed: truth 01-01#7 by this verifier's own cold bring-up observation plus human UAT test 1, and truth 01-03#6 by human UAT test 2. `behavior_unverified: 0`.

## Prohibitions (must-NOTs)

| # | Statement | Status | Evidence |
| --- | --- | --- | --- |
| P1 (01-01) | Stored payload stays a closed shape — unknown fields rejected 400, never stored | ✓ VERIFIED | `reportSchema = z.strictObject` (`schema.ts:23`); `ingest.spec:85` schema-validation row green; prior direct probe (extra field → 400 `Unrecognized key`, list unchanged) — schema file unchanged since |
| P2 (01-01) | Contract never exports/permits an invertible or weak masking primitive | ✓ VERIFIED | Only `MASK_ALPHA_OPAQUE=255` and `MASK_PIXELATION_MIN_BLOCK_PX=8` exported (`constants.ts:62-63`); the only blur mention is the R-13 prohibition comment (`constants.ts:58-59`) |
| P3 (01-04) | No third-party network requests from panel/API | ✓ VERIFIED | Zero `http(s)://` under `apps/panel/src` + `index.html`; API self-references only loopback; SDK src has no `fetch`/URL |

## Roadmap Success Criteria

| SC | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Start API/panel/db with one `docker-compose up`; every setting from committed `.env.example` | ✓ VERIFIED | My cold `docker compose up -d --build` + `check:compose` PASS + `deploy.spec` env-doc/boot rows green |
| 2 | Synthetic report over HTTP → DB row + image on volume under server-generated key, listed in minimal panel | ✓ VERIFIED | `ingest.spec:85` + `:221` green; `fs-storage.ts` server-keyed layout |
| 3 | Every landed report validates against `schema/report.schema.json`; same idempotency key → exactly one report | ✓ VERIFIED | `ingest.spec:85` + `:156` + `:170` green; DB unique index in committed migration |
| 4 | Hostile submission cannot get stored: keys/oversize/SVG/polyglot/traversal → 401/413/429/400; user text stored sanitised and renders inert | ✓ VERIFIED | 26-row hostile group green (78/78 over 3 browsers) in my run |
| 5 | Throttles per key and per IP (+ daily quota, 429 + `Retry-After`); allowlisted origins only | ✓ VERIFIED | `hostile.spec:647/660/673/880/903` green **plus the CR-01/CR-02 regression rows `:764/:800/:814`** — the two critical quota-bypass findings are fixed and pinned |

## Requirements Coverage (all 10 plan requirement IDs accounted for)

| Requirement | REQUIREMENTS.md | Plan | Status | Evidence |
| --- | --- | --- | --- | --- |
| DEP-01 | line 137, Phase 1 Complete | 01-01 | ✓ SATISFIED | `deploy.spec` rows green; `check:compose` PASS; my cold bring-up observed the healthcheck ordering |
| DEP-02 | line 138, Phase 1 Complete | 01-01 | ✓ SATISFIED | `deploy.spec` 4 rows green; fail-fast config at `config.ts:53-73` |
| ENR-06 | line 95, Phase 1 Complete | 01-01 | ✓ SATISFIED | `ingest.spec:85` + `validate-meta.ts` ordering/empty edges; my probe P-B |
| ING-01 | line 99, Phase 1 Complete | 01-01 | ✓ SATISFIED | `ingest.spec:85` 201 + image round-trip green |
| ING-03 | line 101, Phase 1 Complete | 01-01 | ✓ SATISFIED | `ingest.spec:156/170/189` green; DB unique index; replay lookup now project-scoped (`incidents.ts:344`, WR-01 fix) |
| ING-04 | line 102, Phase 1 Complete | 01-03 | ✓ SATISFIED | `hostile.spec:479/513` green; my probe P-A |
| ING-05 | line 103, Phase 1 Complete | 01-03 | ✓ SATISFIED | `hostile.spec:647/660/673` green + CR-01/CR-02 regression rows; UAT test 2 closes the concurrency clause |
| ING-06 | line 104, Phase 1 Complete | 01-02 | ✓ SATISFIED | 5 layered rows green (`:305/:320/:336/:346/:357`) + my probe P-C on the linger-fixed pre-read path |
| ING-07 | line 105, Phase 1 Complete | 01-04 | ✓ SATISFIED | 7 ING-07 rows green (`:991…:1200`) |
| ING-08 | line 106, Phase 1 Complete | 01-03 | ✓ SATISFIED | `hostile.spec:880/903` green |

**Orphaned requirements:** none. REQUIREMENTS.md maps exactly these 10 IDs to Phase 1 (rows 249-257, 276-277). `DEP-03` remains mapped to Phase 5 — the phase's own scope note defers "served only through the *authenticated* API"; correct for Phase 1, not a gap.

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Real data? | Status |
| --- | --- | --- | --- | --- |
| `apps/panel/src/api.ts` → `App.tsx` | `incidents` state | `fetch('/api/incidents')` → nginx → Fastify → PostgreSQL (`db.select().from(incidents)`) | Yes | ✓ FLOWING |
| `ReportDetail` image | `incidentImageUrl(id)` | `GET /api/incidents/:id/image` → DB `storage_key` (`incidents.ts:380`) → `FsStorage.stream()` (`:395`) | Yes | ✓ FLOWING |
| `EmptyState` curl | `fetchSetup()` | `GET /api/setup` → boot-seeded `.env` project key (`app.ts:78`) | Yes (executed-curl e2e row green) | ✓ FLOWING |
| Ingest write path | multipart `meta` + `image` | validated → hardened → `Storage.put` → `incidents` row (`incidents.ts:316-319`) | Yes (end-to-end by e2e + my probes) | ✓ FLOWING |
| Panel static strings | i18n dictionaries | `i18n.ts` en/es | Yes (typed dictionary; switcher row green) | ✓ FLOWING |

No hardcoded/static data sinks; no `return []`/`return null` stubs in the render path (stub scan clean).

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| CA-01 wire shape (`meta` + `image`, `X-Project-Key` + `Idempotency-Key`) | `routes/incidents.ts` multipart parse | `caps.ts` receive policy (`preservePath:true`, contract limits) | WIRED | e2e POST rows + my probes exercised the exact shape |
| `constants.ts` → Zod `maxLength` → API enforcement | `schema.ts` imports every bound from `constants.ts` (R-18) | `validate-meta` / `incidents.ts` import `@watchbug/contracts/constants` | WIRED | panel-clamp segment vacuous in Phase 1 (no input form until Phase 3) |
| `incidents.storage_key` → fs-storage → `GET …/image` DB-lookup-only | `incidents.ts:380` select `storageKey` → `storage.stream(row.storageKey)` (`:395`) | `STORAGE_KEY_REGEX` + resolve-prefix assert before file access | WIRED | blob-header + 404 rows green; no key in any projection |
| `panel fetch('/api/…')` → nginx `location /api/` → `proxy_pass http://api:3000` | `api.ts` relative fetches | `apps/panel/nginx.conf` | WIRED | `/api/health` through the proxy green (A-10 same-origin); nginx now also **overwrites** `X-Forwarded-For` (`nginx.conf:27`, CR-02 fix) |
| `.env` `WATCHBUG_PROJECT_KEY` → boot seed → `X-Project-Key` lookup → e2e + onboarding curl | `boot/seed.ts` `onConflictDoNothing` | `incidents.ts:123` keyed gate; e2e and `EmptyState` curl read the same value | WIRED | `/api/setup` row + executed-curl row green |
| `.env` `WATCHBUG_TRUST_PROXY` → `readTrustProxy` (`config.ts:99`, `:178`) → Fastify `trustProxy` → per-IP limiter identity | nginx-overwritten XFF → first-untrusted-hop `req.ip` | `hostile.spec:800/814` (direct + proxy forgery rows) | WIRED | new since prior report (CR-02); both rows green on 3 browsers |

## Requirements / Artifacts Summary (Level 1-3)

Every artifact listed in the four plans' `must_haves.artifacts` exists and is substantive. No MISSING, no STUB, no ORPHANED. The 13 files changed since the prior verification (`git diff 443088b..HEAD`, excluding docs) — `app.ts`, `config.ts`, `caps.ts`, `rate-limit.ts`, `incidents.ts`, `nginx.conf`, `Dockerfile`, `.env.example`, `hostile.spec.ts` — were each re-read: all contain the claimed fixes, none is a stub. Migration committed and clean.

## Behavioral Spot-Checks

| # | Behavior | Command | Result | Status |
| --- | --- | --- | --- | --- |
| 1 | Cold stack bring-up with healthcheck ordering | `docker compose up -d --build` | db → healthy → api started, in order; `/api/health` ok | ✓ PASS |
| 2 | Build all workspaces | `npm run build` | exit 0, schema re-emitted identically | ✓ PASS |
| 3 | Typecheck | `npm run lint` | exit 0 | ✓ PASS |
| 4 | Size tiers + worst-case print | `npm run check:size` | PASS, `45 + 25 + 14 = 84 KB > 80 KB` printed | ✓ PASS |
| 5 | Compose 3 services, volume api-only | `npm run check:compose` | PASS | ✓ PASS |
| 6 | Full e2e suite | `npm run verify` | **132/132**, 5.8 min, exit 0 | ✓ PASS |
| 7 | Unknown key → uniform 401, nothing stored | curl with bogus `X-Project-Key` | 401 uniform body; list unchanged (1380) | ✓ PASS |
| 8 | Missing `meta` part → 400 naming field | curl `-F image=…` (no meta) | 400 structured naming `meta`; list unchanged | ✓ PASS |
| 9 | Content-Length 9 MB → 413 pre-read wording (linger fix) | curl declared 9.4 MB `Content-Length` | 413 with "rejected from the Content-Length pre-read before the body was read" | ✓ PASS |
| 10 | API container runs unprivileged (WR-06) | `docker exec watchbug-api-1 id` | `uid=1000(node)`; image `User: node` | ✓ PASS |

**Probe side-effects disclosed:** probes 7-9 are all failure paths (401/400/413) that store nothing — the incident list count was unchanged before and after (1380). No repo files modified; `git status --porcelain` clean apart from what the build itself regenerates byte-identically.

## Probe Execution

No `scripts/*/tests/probe-*.sh` files exist and neither PLAN nor SUMMARY declares a probe script (this phase's verification surface is `npm run verify` + `npm run check:size`, per R-12 and 01-VALIDATION.md). Probe execution: **SKIPPED (none declared)**. SUMMARY and REVIEW-FIX pass-marker claims were not used as evidence — all gates were re-run.

## Anti-Pattern Scan

| File scope | Pattern | Severity | Result |
| --- | --- | --- | --- |
| All phase source (incl. 9 files changed since prior report) | `TBD` / `FIXME` / `XXX` debt markers | 🛑 if unreferenced | **None found** |
| Same scope | `TODO` / `HACK` / `PLACEHOLDER` | ⚠️ | Only the three fail-loud `.env` placeholder-key *message/guard* strings (`.env.example:33`, `config.ts:126`, `hostile.spec.ts:63`) — correct behavior, not stubs |
| `apps/panel/src` | `dangerouslySetInnerHTML` / `innerHTML` | 🛑 (SEC-05) | **0 occurrences** (also asserted by suite row `hostile.spec:1200`) |
| manifests | `jest`/`vitest`/`mocha`/`ava`, `dotenv`, `zod-to-json-schema` | 🛑 (R-12 / STACK rejects) | **None found** |
| `apps/api/src`, `packages/sdk/src`, `scripts` | `Math.random` | 🛑 (P1-D-03) | **None found** (randomness is `crypto.randomBytes`) |
| panel/API/SDK | third-party network destinations | 🛑 (01-04 prohibition) | None (Prohibition P3) |
| Empty implementations / hardcoded `[]` render sinks | `return null`/`= []` in render path | ⚠️ | None in `apps/panel/src` |

## Review Findings — resolved since the prior report (advisory updated)

The prior report carried 13 open findings (2 critical / 6 warning / 5 info). Per `01-REVIEW-DISPOSITION.md` and my own code inspection:

- **All 8 critical/warning findings are FIXED** (CR-01, CR-02, WR-01…WR-06) with committed RED→GREEN evidence, and the fixes are present in the current source: rate-limit bucket normalization (`rate-limit.ts:90-93`), trust-list proxy with nginx XFF overwrite (`config.ts:99/178`, `nginx.conf:27`), project-scoped replay (`incidents.ts:344`), post-re-encode re-cap (`incidents.ts:276`), blob cleanup on DB failure (`incidents.ts:322/333`), shipped quickstart `.env.example` values (`:76-78`), `reply.sent` guard (`caps.ts:226-228`), unprivileged container (`Dockerfile:45` + runtime `uid=1000` observed). The suite gained 3 regression rows (`hostile.spec:764/800/814`) — all green in my 132/132 run. **The prior report's CR-01/CR-02 advisories are closed.**
- **ING-06 pre-read linger fix** (`ed20ec3`, `caps.ts:151`): my probe P-C confirmed the pre-read 413 now survives with its wording.
- **Still open (info, deliberately out of fix scope `critical_warning`):** IN-01 (JSON body parsed before limiter), IN-02 (blob stream opened before content-type check), IN-03 (no CSP on panel HTML), IN-04 (R-08 path-only `url` rule unenforced server-side), IN-05 (`BodyCapExceeded` branch unreachable). None unmet a plan acceptance criterion.
- **Accepted risk AR-02** (`01-SECURITY.md`): a client uploading an over-cap body at **full speed** can still lose the pre-read's 413 to a socket reset (`ECONNABORTED`) — the body is still rejected (no bypass); owner accepted 2026-10-13, dead-ends D-09/D-10 recorded in `resolution-record.md` §3. Not re-opened.
- **`01-SECURITY.md`:** `threats_open: 0`, 18/18 threats closed, status `verified` (L1 pass, 2026-10-13).

**Other carried-forward items:** `deferred-items.md` — 4 dev-only `npm audit` advisories in `drizzle-kit`'s esbuild chain (breaking downgrade = owner call); Node 24 image re-pin scheduled after 2026-10-20; package-lock maintained by hand.

## Human Verification Required

**None outstanding.** All 4 items from the prior report were completed in `01-UAT.md` (2026-10-13, **4/4 pass, 0 issues**): (1) interrupted-start compose restart — pass (also independently observed by this verifier's cold bring-up); (2) parallel burst over a small per-key rate limit — pass; (3) clean-checkout first-boot ergonomics — pass; (4) panel visual check (two-column layout, light/dark tokens, language switcher, empty state) — pass.

## Gaps Summary

**No gaps.** All 40 must-have truths resolve to VERIFIED; all artifacts exist, are substantive, wired and data-flowing; all 6 key links are wired; all 10 requirement IDs are satisfied with no orphans; all 3 prohibitions verified; no debt markers, no stubs, no forbidden dependencies. Since the prior report, all 8 critical/warning review findings were fixed with regression-tested evidence and all 4 human verification items passed. The phase goal — stack starts, a report crosses the wire into hardened schema-validated storage and renders in the panel, with the contract, constant set and size gate from day one — is observably achieved in the current codebase. **Status: passed.**

---

_Verified: 2026-10-13T15:39:46Z_
_Verifier: the agent (gsd-verifier subagent, re-verification) — all gates re-run in-process against a freshly rebuilt stack; SUMMARY/REVIEW-FIX claims used only as pointers_
