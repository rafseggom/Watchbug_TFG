# Phase 1: Contracts & Ingest Slice - Research

**Researched:** 2026-10-11
**Domain:** TypeScript monorepo bootstrap (npm workspaces), Fastify 5 multipart ingest hardening, Zod 4 contract publishing, Drizzle/PostgreSQL storage, hardened blob serving, React/Vite minimal panel, Docker Compose deployment
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

> Local decision IDs are prefixed `P1-D-` to avoid collision with the global `D-01…D-08` register in `documentation/resolution-record.md`.

#### Origen del project key (fase sin auth)
- **P1-D-01:** El developer obtiene una clave válida mediante **seed idempotente desde `.env`**: `.env.example` documenta `WATCHBUG_PROJECT_KEY` y el arranque del API crea la fila `projects` si no existe. La e2e lee la misma variable → determinista. El CRUD real de proyectos lo sustituye en Fase 5. — **Reversibility:** reversible — la migración a CRUD de Fase 5 es una mejora, no una ruptura.
- **P1-D-02:** Si la variable falta o es placeholder → **fail-fast al arrancar** con mensaje que indica exactamente qué falta en `.env`. Nunca puede existir una clave predecible en producción (SEC-04, "fail loud, nunca silencioso"). — **Reversibility:** reversible
- **P1-D-03:** Formato de la clave pública: **`wkbt_` + 32 bytes aleatorios en base62 (≈190 bits)**, generada con `crypto`. Prefijo identificable para logs/secret-scanners y para la rotación de Fase 5. — **Reversibility:** costly — el formato queda fijado en toda fila `projects` y en la documentación de integración; cambiarlo después exige migración de claves existentes o rotación.

#### Aspecto del panel mínimo
- **P1-D-04:** Estructura **lista + panel de detalle en dos columnas** (lista de reportes a la izquierda, imagen grande + metadatos a la derecha). Es la forma final del triage de Fase 6 → la base visual se sienta aquí y Fases 5/6 solo añaden filtros, estados y acciones, sin rediseño. — **Reversibility:** costly — es la base sobre la que se construyen las 6 fases siguientes de UI.
- **P1-D-05:** Idioma por defecto: **auto-detectar `navigator.language`** (`es*` → español, resto → inglés) + selector manual persistido en `localStorage` del panel (RNF-03; el `localStorage` del panel propio no toca SEC-03). — **Reversibility:** reversible
- **P1-D-06:** Base visual: **tokens CSS (color/spacing/typography) con soporte `prefers-color-scheme` light/dark desde la Fase 1**, en lugar de estilos hardcodeados. — **Reversibility:** costly — migrar a tokens después toca todas las clases ya escritas en 5 fases de UI.
- **P1-D-07:** Estado vacío = **snippet `curl` listo para copiar, pre-rellenado con el project key real de la instancia** (pega → ejecuta → recargas → ves el reporte). El estado vacío es el onboarding del producto. — **Reversibility:** reversible

#### Plan B de `@fastify/multipart` (UNVERIFIED ↔ Fastify 5)
- **P1-D-08:** Orden de preferencia si el smoke-test falla: **1)** probar otra versión de `@fastify/multipart` sin tocar el contrato; **2)** si ninguna sirve, **parser multipart propio** (boundary + streams); **3)** JSON+base64 **solo con consulta expresa al propietario** (cambio de contrato CA-01 = consultation trigger). — **Reversibility:** reversible — los pasos 1 y 2 dejan CA-01 intacto.
- **P1-D-09:** El smoke-test de multipart es el **primer trabajo de la fase**, antes de escribir el endpoint de ingest: commit mínimo que arranca Fastify y parsea un `FormData` de prueba. Cierra el riesgo con coste casi cero. — **Reversibility:** reversible

#### Profundidad del hardening C-4
- **P1-D-10:** **Re-encode obligatorio en servidor**: cada imagen se re-codifica de raíz antes de escribir a disco (mata políglotos y EXIF), además del sniff estricto de magic bytes, los tres headers de la ruta de blob (`nosniff`, `Content-Disposition: attachment`, `CSP: default-src 'none'; sandbox`) y el anti decode-bomb (≤16 MP de A-06). ⚠ STACK.md rechaza `sharp`/`jimp`: **cualquier dependencia pesada nueva para lograrlo se consulta al propietario antes de añadirla.** — **Reversibility:** costly — la ruta de ingest se diseña alrededor del re-encode; quitarlo después cambiaría las afirmaciones de seguridad de SEC-02/C-4 y la e2e que las prueba.
- **P1-D-11:** Allowlist de formatos: **solo PNG + WebP** (exactamente los que produce la captura, R-11). JPEG se reconsidera en Fase 3 con `ManualFileCapture` si hace falta (ampliar allowlist es barato y consultable). SVG rechazado incondicionalmente. — **Reversibility:** reversible — ampliar es un cambio local; el contrato de respuesta no cambia.
- **P1-D-12:** Formato de salida tras el re-encode: **mismo formato de entrada** (PNG→PNG, WebP→WebP). Respeta los caps de A-06 sin inflar y mantiene la promesa de R-11 del fallback WebP→PNG. — **Reversibility:** reversible

### the agent's Discretion
No gray area was left as "you decide" by the owner — every discussed decision has an explicit choice. Free technical latitude remains for the researcher/planner on: exact seed mechanism (bootstrap vs migration), Drizzle schema shape, file/plan decomposition, nginx proxy details (A-10), and the concrete e2e structure of the CA assertions.

### Deferred Ideas (OUT OF SCOPE)
- **JPEG support in the allowlist** — revisit in Phase 3 alongside `ManualFileCapture` (A-05) if users need to attach captures made with other tools.
- **Auth-gated panel and blob route** — DEP-03's "served only through the authenticated API" completes in Phase 5; this phase makes no auth claim.
- No gray area was marked "agent decides"; no todos matched this phase (`todo.match-phase 1` → 0).
</user_constraints>

## Project Constraints (from AGENTS.md)

Extracted from `E:/Proyectos Github/Watchbug_TFG/AGENTS.md` (project entry point — binding on this phase):

- **ASE C-B-D-C paradigm:** Contract → Bound → Delegate with Evidence → Converge & Record. Rule Zero: never guess ambiguous intent. Under-specified work → `Ask Before You Build` (Consultation Request Pack).
- **R-12 Verification policy (owner directive, stated twice): "DONT MAKE A BUNCH OF TESTS. Only make e2e as necessary, not unit tests."** There is NO unit-test suite, no per-function tests, no coverage thresholds — do not create any. Verification = `npm run check:size` + one Playwright e2e suite (`npm run verify`, CA-01…CA-05 on chromium + firefox + webkit).
- **INV-01..INV-03:** Shadow DOM isolation (Phase 2+), single `window.Watchbug` global (Phase 2+), and **INV-03: one `docker-compose.yml`, exactly three services — `api`, `panel`, `db`** (this phase).
- **SEC-01..SEC-06** all apply where relevant; this phase owns SEC-04 (zero secrets in code, `.env` + committed `.env.example`), SEC-05 (XSS sanitization + rate limiting), and the C-3/C-4 hardening of first ingest.
- **RNF-01 / R-01 size budget:** core ≤ 45 KB gz, lazy chunk ≤ 25 KB gz, runtime total ≤ 80 KB gz — enforced by `npm run check:size`, which ships in this phase (A-12/M-2 multi-artifact scenario).
- **R-13:** masking = flat opaque fill only (Phase 2+), no gaussian blur, no CSS overlays.
- **R-15:** TypeScript end-to-end npm-workspaces monorepo (`packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel`).
- **R-17:** no calendar-driven descoping. **R-18:** reuse-first code creation; DRY on domain logic (masking math, limit constants, formatters, schema validation → single source in `packages/contracts`).
- **Consultation triggers (pause & ask):** public SDK interface changes, `/api/incidents` payload schema changes (CA-01 is a contract), Shadow DOM strategy changes, **DB schema changes / migrations**, blob-storage choice changes, dependencies pushing the SDK past its size tier, non-permissive licenses.
- **Commands:** `npm install` (workspaces) → `npm run build` → `npm run check:size` → `npm run verify` → `npm run lint`; `docker-compose up -d` for the stack; `npm run dev` = `tsx watch apps/api`.
- **Docs:** `documentation/resolution-record.md` (R-01…R-18, A-01…A-12, §5 governs on conflict) and `documentation/continuity-pack.md` (session state, dead-ends) are durable records that constrain approaches.
- **Workflow (continuity-pack §6.5–§6.6):** this phase lives on branch `gsd/phase-1-contracts-ingest` (config `phase_branch_template`), PR against `develop` with `Closes #N` per issue.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEP-01 | A developer can start API + panel + database with one `docker-compose up` (INV-03) | Compose 3-service layout + nginx `/api` reverse-proxy pattern (A-10, [VERIFIED: documentation/resolution-record.md:353-355]); Docker 29.2.1 + Compose v5.5.1 available in env audit; CI compose assertion design (C-4) |
| DEP-02 | A developer can configure every server setting from `.env` using the committed `.env.example` (SEC-04) | Node 24 `--env-file` is stable (verified in STACK.md) — no `dotenv`; fail-fast boot contract P1-D-02; `.env` variable inventory below |
| ENR-06 | Every report validates against the single published JSON schema (CA-01) | Zod 4.6.5 `z.toJSONSchema(schema, { target: 'draft-2020-12' })` emitting `schema/report.schema.json` ([CITED: zod.dev/json-schema#ztojsonschema via .planning/research/STACK.md]); contracts = single source of truth (R-15); validation-order pipeline (ARCHITECTURE step 9) |
| ING-01 | A report (image + metadata) reaches the configured backend over HTTP (RF-05) | `FormData { meta, image }` + `X-Project-Key` + `Idempotency-Key` wire shape ([VERIFIED: .planning/research/ARCHITECTURE.md:270-298]); `@fastify/multipart` 10.1.2 API verified against Fastify 5 (see Multipart answer) |
| ING-03 | A retried submission does not create a duplicate report | `UNIQUE (project_id, idempotency_key)` with response replay ([VERIFIED: .planning/research/SUMMARY.md:87]); `INSERT … ON CONFLICT DO NOTHING RETURNING` + select-for-replay pattern |
| ING-04 | The API rejects ingestion without a valid project key | P1-D-01/02/03 seed + key format; structured 401; write-only key never gates reads (H-7) |
| ING-05 | The API rate-limits per IP and per project key (SEC-05) | `@fastify/rate-limit` 11.2.0 ↔ Fastify 5 compat table verified; `fastify.createRateLimit()` manual limiters for layered per-IP / per-key / per-day quotas; `retry-after` emitted by default ([CITED: github.com/fastify/fastify-rate-limit README]) |
| ING-06 | The API rejects oversized bodies and images | Layered caps (5 MB body / 4 MB part / 64 KB meta / 2 MB image / 16 MP decode guard) — see Constants answer; ⚠ multipart bypasses Fastify `bodyLimit` → Content-Length pre-read + streaming counter are mandatory (README verified) |
| ING-07 | The API sanitises all user-supplied text before storage and before panel rendering (SEC-05) | `sanitize-html` 2.18.0 on ingest (pass 1) + React text-node rendering (pass 2); C-3 double-control rationale ([VERIFIED: .planning/research/PITFALLS.md:92-118]) |
| ING-08 | The API accepts ingestion only from allowlisted origins | `WATCHBUG_CORS_ORIGINS` env allowlist (A-11, [VERIFIED: documentation/resolution-record.md:357-359]); `@fastify/cors` 11.3.0; Origin-present enforcement with no-Origin (curl) acceptance per P1-D-07 |
</phase_requirements>

## Summary

Phase 1 is the greenfield bootstrap plus the synthetic ingest tracer: monorepo skeleton, the single official contract (`packages/contracts` → `schema/report.schema.json`), the binding constant set, a three-service `docker-compose.yml`, a hardened `POST /api/incidents` that stores a synthetic report (image + metadata) into PostgreSQL + a filesystem volume, a hardened blob route, and a minimal two-column panel that renders the report. The riskiest items are known and land first: the `@fastify/multipart` ↔ Fastify 5 smoke test (P1-D-09), the TS 7.x tooling gate (Q-08), and the P1-D-10 re-encode dependency consultation.

**The single most important technical finding of this research:** `@fastify/multipart` parses multipart bodies with a dedicated streaming parser that **does not pass through Fastify's `bodyLimit` enforcement** — `bodyLimit` only seeds the per-file `fileSize` default (1 MiB). Quote from the official README: *"multipart requests are parsed by a dedicated streaming parser and do not go through Fastify's `bodyLimit` enforcement. `bodyLimit` is only used to compute the per-file `fileSize` default; it is **not** enforced as an aggregate limit across the whole multipart payload."* [CITED: github.com/fastify/fastify-multipart README] Therefore H-7's "5 MB body" cap cannot be set with one Fastify option: the plan MUST combine (a) `Content-Length` pre-read rejection, (b) a streaming byte counter that aborts mid-upload, and (c) explicit `limits` (`files: 1`, `fileSize`, `fields`, `fieldSize`, `headerPairs`, `parts`) whose product bounds the aggregate. This resolves research question 1 and half of question 2, and it converts the ROADMAP's "Content-Length pre-read plus streaming counter" from belt-and-braces into the *only* aggregate control.

The `@fastify/multipart` ↔ Fastify 5 mapping itself (the flagged UNVERIFIED item) now has three independent pieces of evidence: the plugin's own `devDependencies` pin `fastify: ^5.0.0` (its CI test matrix runs against Fastify 5), it builds on `fastify-plugin@^6` (the Fastify-5 plugin line) and `@fastify/busboy@^3`, and `@fastify/rate-limit`'s compatibility table (`>=10.x` ↔ `^5.x`) confirms the ecosystem's version-line convention. [VERIFIED: npm registry — `npm view @fastify/multipart@10.1.2 devDependencies`; CITED: github.com/fastify/fastify-rate-limit README compat table]. The smoke test (P1-D-09) still runs first as the owner decided — it is now expected to pass rather than a coin flip.

The security posture lands at first ingest, exactly as the phase rationale demands (C-3/C-4): PNG/WebP magic-byte + structural allowlist with SVG rejected unconditionally, a mandatory server-side re-encode decision (P1-D-10 — consultation-gated on the heavy dependency), tmp→fsync→rename storage with server-generated `projectId/<xx>/<uuid>.<ext>` keys and DB-lookup-only resolution, the three hardened blob headers, layered abuse caps with decode-bomb header guard, per-key/per-IP/per-day rate limits with `429 + Retry-After`, and `sanitize-html` on write + text-only rendering. TTL columns (identity 30 d, artifacts 90 d) exist in the initial Drizzle migration so retention retrofits never become migration-triggered consultations.

**Primary recommendation:** sequence the phase risk-first — (1) multipart smoke test + TS 7.x tooling gate in one minimal scaffolding commit, (2) the re-encode consultation (P1-D-10) as a human checkpoint before the ingest endpoint is written, then (3) contracts → compose/env → ingest edge → Storage → panel → e2e — and implement the ingest pipeline as the ordered chain `Content-Length gate → rate limits → CORS → multipart limits → Zod validate (contracts) → key check → magic-byte + structural image check → decode-bomb guard → re-encode → Storage.put (tmp→fsync→rename) → idempotent INSERT → replay-safe response`.

**Research questions answered (for the planner):** the 10 questions from the orchestrator are answered inline below; the quick index is: (1) multipart↔Fastify 5 = verified, but `bodyLimit` does not bound multipart — see Standard Stack + Pitfall 1; (2) constants table + `packages/contracts` layout = see Architecture Pattern 1; (3) magic-byte/structural allowlist + re-encode options = Pattern 2 + Don't Hand-Roll; (4) `Storage` port = Pattern 3; (5) Drizzle TTL migration shape = Pattern 4; (6) idempotency = Pattern 5; (7) layered rate limiting = Pattern 6; (8) sanitize + render = Pattern 7; (9) `check:size` multi-artifact = Pattern 8; (10) hardened blob route = Pattern 9.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Official payload contract + constant set (`packages/contracts`) | Build/Contracts (leaf package) | — | Single source of truth (R-15/R-18); imported by API (runtime Zod) and panel (types); SDK imports types/constants only |
| Ingest endpoint (multipart receive, validation order) | API / Backend | — | TB-2 trust boundary lives server-side; client clamps are UX-only |
| Abuse caps + rate limiting + CORS allowlist | API / Edge | CDN/Static (nginx `client_max_body_size` as coarse pre-filter) | Cheapest guard closest to the wire, precise control at the app (H-7 layered caps) |
| Image hardening (magic bytes, structure, decode guard, re-encode) | API / Backend | — | Never trust client-declared MIME; server is the control (SEC-05/C-3) |
| Text sanitisation (pass 1, on write) | API / Backend | Browser (pass 2, on render) | C-3 double control — either alone has a known bypass class |
| Blob storage (volume, tmp→fsync→rename) | Database / Storage (filesystem volume in `api` container) | — | R-04; volume mounted only in `api`; path building is server-derived |
| Blob serving (hardened headers) | API / Backend | — | R-04: never static files; DB-lookup-only key resolution |
| Idempotency / dedup | Database / Storage (UNIQUE constraint) | API (replay response) | The DB is the only authority that survives restarts and replicas |
| Report list + detail rendering (minimal panel) | Browser (React SPA) | API (read endpoints) | TB-5 render-side escaping; static SPA behind nginx (INV-03) |
| Server configuration (`.env`, fail-fast boot) | API / Backend (boot) | Compose | SEC-04; P1-D-02 fail-fast at startup |
| TTL columns (identity + artifacts) | Database / Storage | API (computed at insert) | M-1/A-02: retrofits are migrations = consultation triggers |
| Size gate + compose assertion | Build/CI tooling | — | A-12/M-2 + C-4; gates belong in scripts (`check:size`, `check:compose`), not unit tests (R-12) |

## Standard Stack

> **Version source:** `.planning/research/STACK.md` is the verified pin set (all rows `VERIFIED` against the npm registry / Docker Hub on 2026-10-05) and the "What NOT To Use" list is binding. This section does not re-litigate the stack; it re-verified today only what this phase's research questions required (`@fastify/multipart`, `@fastify/rate-limit`, esbuild/Playwright/sharp legitimacy) and records how to implement with the pins. Do not substitute alternatives.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | 5.12.5 | API edge (R-15) | Plugin ecosystem is the HTTP-edge "plugs" seam; pino logging built in |
| `@fastify/multipart` | 10.1.2 | `multipart/form-data` receive (`meta` JSON + `image` Blob) | CA-01 wire shape is FormData; see the critical `bodyLimit` gap below |
| `@fastify/rate-limit` | 11.2.0 | SEC-05 layered limits | Compat table `>=10.x` ↔ `^5.x` verified; `retry-after` by default; manual limiters via `createRateLimit()` |
| `@fastify/cors` | 11.3.0 | ING-08 origin allowlist (A-11) | Env-driven allowlist, no schema change |
| `@fastify/helmet` | 13.1.1 | Hardened API responses | Cheap defense-in-depth |
| `drizzle-orm` + `drizzle-kit` | 0.45.3 / 0.31.11 | Typed SQL over `pg` + reviewable generated migrations | Only Drizzle emits SQL migrations (the migration consultation trigger wants artifacts) |
| `pg` | 8.23.1 | PostgreSQL driver | R-15 named slot |
| `zod` | 4.6.5 | The CA-01 contract + `z.toJSONSchema()` emit | Native JSON Schema conversion; `zod-to-json-schema` is deprecated by its maintainer |
| `sanitize-html` | 2.18.0 | SEC-05 ingest sanitisation (pass 1) | Mature allowlist sanitizer (`engines.node >=22.12.0` — Node 24 satisfies) |
| `react` / `react-dom` / `vite` / `@vitejs/plugin-react` | 19.3.0 / 19.3.0 / 8.3.2 / 6.1.2 | Minimal panel (static SPA, INV-03) | React text-node escaping is half of SEC-05 for free |
| `typescript` | 7.0.2 (fallback 6.x line — Q-08 gate) | Types only; esbuild transpiles | TS 7 = native Go port, language unchanged vs 6.0 |
| `esbuild` | 0.28.2 | SDK dual build + API bundling; `metafile` feeds `check:size` | One format per `build()` call (verified) |
| `@playwright/test` | 1.63.0 | The single `npm run verify` suite (R-12) | Chromium + firefox + webkit projects |
| `node:zlib` (built-in) | — | `scripts/check-size.mjs` gzip gate | Zero deps, identical in CI and locally |
| PostgreSQL (image) | `postgres:18.6-alpine3.24` | `db` service | Current stable major (supersedes illustrative "16") |
| Node (image) | `node:24.21.0-alpine3.24` | `api` + panel build | Active LTS until 2026-10-20 (re-pin to 26 after 2026-10-28 — one re-pin) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | 4.23.15 | `tsx watch apps/api` dev loop | Dev only |
| `@node-rs/argon2` | 2.2.1 | Argon2id (SEC-06) | **Not this phase** — lands Phase 5 with auth |
| `jose` | 6.2.12 | JWT TTL (SEC-06) | **Not this phase** — Phase 5 |
| `sharp` (candidate) | 0.35.x [CITED: sharp.pixelplumbing.com changelog] | Server-side re-encode (P1-D-10) | **Only after the owner consultation** — see Re-encode decision; `sharp` [WARNING: flagged as suspicious by the legitimacy seam ("too-new") — verify before using.] |
| `nginx` (image) | `nginx:1.30.5-alpine3.24` | `panel` service: static SPA + `/api` reverse proxy (A-10) | Compose |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fastify/multipart` | base64-in-JSON body | **Rejected** (+33 % wire size; burns the 64 KiB keepalive budget) — and per P1-D-08 base64 is step 3 requiring explicit owner consultation (CA-01 contract change) |
| `@fastify/multipart` | Hand-rolled boundary/stream parser | P1-D-08 step 2 fallback only — zero-dep but re-implements hostile-input parsing; never chosen while step 1 works |
| `drizzle-orm` | `kysely` 0.29.6 | Kysely has no migration generator — every migration hand-authored (STACK.md rejected) |
| In-memory rate-limit store | Redis store | **Rejected** — Redis is a 4th container, violates INV-03 (STACK.md "What NOT To Use") |
| `sharp` re-encode | Zero-dep structural strip/rebuild of PNG/RIFF containers | Strip/rebuild needs no consultation (no new dep) but kills only container-level polyglots/metadata, not decoder-differential ones — see Re-encode decision |
| `zod-to-json-schema` | — | **Deprecated** by its maintainer (Nov 2025); Zod 4 `z.toJSONSchema()` replaces it |
| `dotenv` | Node `--env-file` | Node 24 flag is stable (verified); `dotenv` rejected in STACK.md |
| Unit-test framework | — | **Abolished by R-12** — never introduce one, including for contracts/constants "just to be safe" |

**Installation:**
```bash
npm install                         # npm workspaces — root package.json with workspaces: ["packages/*", "apps/*"]
npm run build                       # contracts emit schema/report.schema.json; esbuild SDK shells; vite panel
npm run check:size                  # R-01 multi-artifact gate (A-12)
docker compose up -d                # api + panel + db (INV-03)
npm run verify                      # the ONE Playwright suite (R-12)
```

**Version verification (this session):** `npm view @fastify/multipart@10.1.2` → version exists, `devDependencies.fastify: ^5.0.0`, deps `fastify-plugin ^6.0.0`, `@fastify/busboy ^3.0.0` [VERIFIED: npm registry]. `npm view @fastify/rate-limit@11.2.0` / `fastify@5.12.5` → exist as pinned [VERIFIED: npm registry]. All other versions carry STACK.md's 2026-10-05 registry verification [VERIFIED: .planning/research/STACK.md]. Local toolchain probe: Node v24.11.1, npm 11.6.2, Docker 29.2.1, Docker Compose v5.5.1 [VERIFIED: environment probe 2026-10-11].

## Package Legitimacy Audit

Run via `gsd-tools query package-legitimacy check --ecosystem npm …` this session. ⚠ **Seam caveat:** every package that published a release within roughly the last month is flagged `SUS` with the single reason `"too-new"` — the signal keys on the *latest release date*, not package age. All rows below except `sharp` carry the official upstream repository and multi-million weekly downloads, so the flag is a false-positive on release cadence; recorded verbatim for audit, dispositioned accordingly.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `fastify` | npm | ~10 yrs | 15.3M/wk | github.com/fastify/fastify | SUS (`too-new`) | Approved on STACK.md A-09 pin + official repo — batched `checkpoint:human-verify` before Wave-0 install |
| `@fastify/multipart` | npm | ~8 yrs | 3.0M/wk | github.com/fastify/fastify-multipart | SUS (`too-new`) | Approved — same batched checkpoint; smoke test is P1-D-09 first commit |
| `@fastify/rate-limit` | npm | ~8 yrs | 3.5M/wk | github.com/fastify/fastify-rate-limit | SUS (`too-new`) | Approved — batched checkpoint |
| `@fastify/cors` | npm | ~9 yrs | 7.2M/wk | github.com/fastify/fastify-cors | SUS (`too-new`) | Approved — batched checkpoint |
| `@fastify/helmet` | npm | ~8 yrs | 2.7M/wk | github.com/fastify/fastify-helmet | SUS (`too-new`) | Approved — batched checkpoint |
| `@fastify/cookie` | npm | ~9 yrs | 3.5M/wk | github.com/fastify/fastify-cookie | SUS (`too-new`) | Approved — batched checkpoint |
| `drizzle-orm` | npm | ~5 yrs | 27.8M/wk | github.com/drizzle-team/drizzle-orm | SUS (`too-new`) | Approved — batched checkpoint |
| `drizzle-kit` | npm | ~5 yrs | 22.8M/wk | github.com/drizzle-team/drizzle-orm | SUS (`too-new`) | Approved — batched checkpoint |
| `pg` | npm | ~14 yrs | 64.6M/wk | github.com/brianc/node-postgres | SUS (`too-new`) | Approved — batched checkpoint |
| `sanitize-html` | npm | ~12 yrs | 11.9M/wk | github.com/apostrophecms (sanitize-html) | SUS (`too-new`) | Approved — batched checkpoint |
| `zod` | npm | ~7 yrs | 341.7M/wk | github.com/colinhacks/zod | SUS (`too-new`) | Approved — batched checkpoint |
| `@playwright/test` | npm | ~5 yrs | 75.7M/wk | github.com/microsoft/playwright | SUS (`too-new`) | Approved — batched checkpoint |
| `sharp` | npm | ~12 yrs | 115.9M/wk | github.com/lovell/sharp | SUS (`too-new`) | **Flagged — planner must add a dedicated `checkpoint:human-verify` (this is also P1-D-10's consultation trigger) before installing** |
| `esbuild` | npm | ~7 yrs | 303.3M/wk | github.com/evanw/esbuild | OK | Approved (`postinstall: node install.js` — standard platform-binary fetch, official repo; noted per protocol) |
| `pngjs` | npm | ~11 yrs | 70.3M/wk | github.com/pngjs/pngjs | OK | Approved (candidate for the zero-dep PNG path if the owner rejects `sharp`) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all `@fastify/*`, `fastify`, `drizzle-*`, `pg`, `sanitize-html`, `zod`, `@playwright/test` (seam false-positive on release cadence — one batched human checkpoint at Wave 0 covers the STACK.md-pinned install), and `sharp` (genuinely new to this project AND a P1-D-10 consultation trigger — its own checkpoint).

*Packages discovered via WebSearch or training data that have not been verified against an authoritative source are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.* — in this research that applies to `sharp` as a *recommendation*: its behavior claims are `[CITED: sharp.pixelplumbing.com/api-output]` but it is not a STACK.md pin.

## Architecture Patterns

### System Architecture Diagram

```
 Synthetic client (curl / future SDK)                Panel browser (developer)
   |  POST /api/incidents                                |  GET / (SPA)
   |  FormData { meta: JSON, image: Blob }               |  GET /api/incidents        (list, Phase 1: unauthenticated by scope)
   |  X-Project-Key · Idempotency-Key · Origin           |  GET /api/incidents/:id/image
   v                                                     v
+------------------------------- docker-compose.yml (exactly 3 services — INV-03) -------------------------------+
|                                                                                                                |
|  panel (nginx:1.30) ------------------ /api/* reverse-proxy (A-10) ---------------> api (Fastify 5, node:24)    |
|  serves static SPA                                                                     |                       |
|  NO volume mount (C-4)                                                                 v                       |
|                                                                     ingest edge chain (ordered):              |
|                                                                       1 Content-Length pre-read (413)         |
|                                                                       2 streaming byte counter (abort)        |
|                                                                       3 rate limits: key/min · ip/min · day    |
|                                                                       4 CORS allowlist (env)                   |
|                                                                       5 multipart limits (files/size/fields)   |
|                                                                       6 Zod validate meta (packages/contracts)|
|                                                                       7 project-key lookup (401)               |
|                                                                       8 image: magic bytes + structure + dims  |
|                                                                       9 re-encode (P1-D-10) / strip fallback   |
|                                                                      10 sanitize text (pass 1)                |
|                                                     +---------------------+---------------------+             |
|                                                     |                     |                     |             |
|                                                     v                     v                     v             |
|                                            Storage.put() tmp→fsync→rename   PostgreSQL 18 (db)   error mapper  |
|                                            volume: projectId/<xx>/<uuid>.<ext>  projects · incidents (UNIQUE    |
|                                            (mounted ONLY in api, C-4)       (project_id, idempotency_key))     |
|                                                                             TTL columns from first migration   |
+--------------------------------------------------------------------------------------------------------------+
        ^
        | blob bytes (DB-lookup-only key resolution; request never names a file)
        +--- GET /api/incidents/:id/image → nosniff · Content-Disposition: attachment · CSP: default-src 'none'; sandbox
```

Data flow for the primary case (success criterion 2): synthetic `FormData` POST → edge chain → validated+sanitised meta + hardened image → `Storage.put` writes tmp → fsync → rename to `projectId/<xx>/<uuid>.<ext>` → `INSERT incidents … ON CONFLICT (project_id, idempotency_key) DO NOTHING RETURNING id` → `201 { id }` → panel list fetch → detail pane renders image via the hardened blob route.

### Recommended Project Structure
```
packages/
├── contracts/              # CA-01 single source of truth (R-15, R-18 DRY)
│   ├── src/constants.ts    # ALL limit constants — plain TS, ZERO zod import (SDK-safe)
│   ├── src/schema.ts       # Zod 4 schema (API/panel runtime) — imports constants.ts
│   ├── src/types.ts        # exported TS types (SDK `import type` only)
│   └── scripts/emit-schema.mjs   # z.toJSONSchema → schema/report.schema.json (committed)
├── sdk/                    # Phase 2+ behavior; shell + build wiring + check:size lane now
apps/
├── api/
│   ├── src/app.ts          # composition root (plugins, routes wired here — one per process)
│   ├── src/routes/incidents.ts   # POST ingest + GET list + GET :id/image
│   ├── src/ingest/         # ordered edge chain modules (caps, sniff, guard, sanitize)
│   ├── src/storage/        # Storage adapter (R-02 seam #6): fs volume, tmp→fsync→rename
│   ├── src/db/             # drizzle schema + generated migrations (committed)
│   └── src/ports.ts        # Storage (+ AuthProvider placeholder) interfaces only
├── panel/                  # React + Vite SPA: two-column list/detail (P1-D-04), CSS tokens (P1-D-06)
scripts/
├── check-size.mjs          # R-01 multi-artifact gate (A-12/M-2) — node:zlib
└── check-compose.mjs       # C-4: fail if `panel` mounts the blob volume
e2e/
├── verify.spec.ts (+ CA group files)  # THE one Playwright suite (R-12)
└── fixtures/               # valid png/webp + hostile: SVG, polyglot, traversal names, XSS strings
docker-compose.yml          # api + panel + db, volume only in api
.env.example                # every server setting documented (DEP-02, SEC-04)
schema/report.schema.json   # published contract artifact (committed)
```

### Pattern 1: Constants live in `packages/contracts`, clamps stay UX-only
**What:** one `constants.ts` module holds every limit from the binding constant set; the Zod schema imports it for validation, the API imports it for edge enforcement, the SDK imports it as plain values (inlined at build — zero Zod bytes), and the panel imports it for client-side clamps that are **UX only** ("client clamps are UX only, server caps are the control" — [VERIFIED: .planning/research/SUMMARY.md:72]).
**When to use:** every cap, size, count and TTL in this phase. R-18 makes this mandatory (limit constants are named DRY territory).
**The reconciled constant set** — layered, each tier coarser than the next precise one (H-7):

| Constant | Value | Enforcement point | Status code | Evidence |
|---|---|---|---|---|
| `MAX_BODY_BYTES` | 5 MB | `Content-Length` pre-read + streaming counter + nginx `client_max_body_size` | 413 | [VERIFIED: .planning/research/SUMMARY.md:82] — quote: `Total request body | **5 MB** (\`bodyLimit\` → 413); reject on \`Content-Length\` before read **plus** a streaming byte counter` |
| `MAX_IMAGE_PART_BYTES` | 4 MB | multipart `limits.fileSize` (parser-level guard) | 413 | [VERIFIED: .planning/research/SUMMARY.md:83] — quote: `Multipart limits | \`files: 1\`, file part **≤ 4 MB**, \`fields: 8\`, \`fieldSize\` 4 KB, \`headerPairs\` 1 KB` |
| `MAX_ENCODED_IMAGE_BYTES` | 2 MB (hard) | semantic check after part read | 413 | [VERIFIED: documentation/resolution-record.md:302-315] — quote: `| Image | **2 MB hard, ≤ 16 MP** after downscale | stays under Safari's canvas-area cap |` |
| `MAX_IMAGE_PIXELS` | 16,777,216 (16 MP) | header parse **before** any decode | 400/413 | [VERIFIED: .planning/research/PITFALLS.md:520] — quote: `| **Canvas area guard** | \`16,777,216\` px (\`4096×4096\`) hard max |` + P1-D-10 "anti decode-bomb (≤16 MP de A-06)" |
| `MAX_IMAGE_DIM` | 8192 px per side | header parse before decode | 400 | [VERIFIED: .planning/research/PITFALLS.md:531] — quote: `| **Decoded image cap** | \`w,h ≤ 8192\` and \`w*h ≤ 25,000,000\` px, checked from headers before decode |` (the 25 MP figure is superseded by the stricter P1-D-10 16 MP decision) |
| `MAX_META_BYTES` | 64 KB serialized | `meta` part semantic check | 400/413 | [VERIFIED: .planning/research/SUMMARY.md:80] — quote: `| \`meta\` JSON part | **64 KB** serialized |` |
| multipart `limits` | `files: 1`, `fields: 8`, `fieldSize: 4096`, `headerPairs: 1024`, `parts` bounded | parser | 400/413 | [VERIFIED: .planning/research/PITFALLS.md:530] — quote: `| **Ingestion body caps** | \`bodyLimit\` 5 MB total, 4 MB per file part, 1 KB per header pair, \`files: 1\`, \`fields: 8\`, \`fieldSize: 4 KB\` |` |
| `MAX_CONSOLE_TOTAL_BYTES` | 48 KB | schema (Phase 4 populates; constant ships now) | 400 | [VERIFIED: documentation/resolution-record.md:302-315] — quote: `| \`consoleLogs\` total | **48 KB** | keeps a metadata-only flush ≤ 60 KB |` |
| Console entry caps | 100 entries drop-oldest, 2,048/msg, 1,024/arg, depth 3, `stack` 8,192 | schema constants now, SDK clamp later | 400 | [VERIFIED: .planning/research/SUMMARY.md:76-79] — quote: `| Console entries | **100, drop-oldest** … | Console per-message / per-arg | **2,048 / 1,024 chars**, serialization depth 3 | Console \`stack\` field | **8,192 chars** per entry | Console total serialized buffer | **48 KB**, drop-oldest |` |
| Text field caps | title 200, description/note 5,000, `user.name` 120, `user.email` 254, `user.id` 64, URL path 2,048, Enricher values 512 | Zod schema (`maxLength`) | 400 | [VERIFIED: .planning/research/SUMMARY.md:81] — quote: `| Text field caps | title **200**, description/note **5,000**, \`user.name\` **120**, \`user.email\` **254**, \`user.id\` **64**, URL path **2,048**, \`Enricher\` values **512** |` |
| Rate limits | 10/min per project key, 30/min per IP, 2,000/day per project | `@fastify/rate-limit` (in-memory) | 429 + `Retry-After` | [VERIFIED: .planning/research/SUMMARY.md:86] — quote: `| Rate limits | **10 req/min per \`project_key\` + 30 req/min per IP + 2,000 reports/day per project** … 429 + \`Retry-After\` |` |
| TTL columns | identity 30 d, artifacts 90 d (env-configurable) | initial Drizzle migration columns | — | [VERIFIED: documentation/resolution-record.md:266-277] — quote: `| \`user.*\` identity fields | purge at N days | **30** |` and `| Full incident (screenshot, \`consoleLogs\`, metadata) | purge at M days | **90** |` |

⚠ **Note the two "image" numbers deliberately coexisting:** 4 MB is the *multipart part* cap (parser guard) and 2 MB is the *encoded image* semantic cap (A-06 "hard"). The 4 MB parser guard bounds work before validation; the 2 MB semantic cap is what "hard cap" means for the contract. Legitimate clients clamp at 2 MB as UX (with the A-06 re-encode ladder); hostile clients are stopped at 4 MB no matter what. If the planner prefers a single number, use 2 MB semantic + 4 MB parser as shown — see Open Questions #3.

**Example (contracts layout):**
```typescript
// packages/contracts/src/constants.ts — plain TS, NO zod import (SDK-safe, R-18 single source)
// Values [VERIFIED: .planning/research/SUMMARY.md:74-88] ("one binding constant set")
export const MAX_BODY_BYTES = 5 * 1024 * 1024;        // 5 MB hard reject
export const MAX_IMAGE_PART_BYTES = 4 * 1024 * 1024;  // multipart parser guard
export const MAX_ENCODED_IMAGE_BYTES = 2 * 1024 * 1024; // A-06 "2 MB hard"
export const MAX_IMAGE_PIXELS = 16_777_216;           // 4096×4096, P1-D-10 decode guard
export const MAX_IMAGE_DIM = 8192;
export const MAX_META_BYTES = 64 * 1024;
export const MAX_CONSOLE_TOTAL_BYTES = 48 * 1024;
export const MAX_TITLE_CHARS = 200;
export const MAX_NOTE_CHARS = 5_000;
export const RATE_LIMIT_PER_KEY_PER_MIN = 10;
export const RATE_LIMIT_PER_IP_PER_MIN = 30;
export const RATE_LIMIT_PER_PROJECT_PER_DAY = 2_000;
export const TTL_IDENTITY_DAYS = 30;
export const TTL_ARTIFACT_DAYS = 90;

// packages/contracts/scripts/emit-schema.mjs — Source: [CITED: zod.dev/json-schema#ztojsonschema]
// import { reportSchema } from '../src/schema.js';
// const json = z.toJSONSchema(reportSchema, { target: 'draft-2020-12' });
// writeFileSync('schema/report.schema.json', JSON.stringify(json, null, 2));
```

### Pattern 2: Image hardening — sniff → structure → guard → re-encode (or strip)
**What:** the C-3 control stack for the image part, in order. (a) **Magic bytes, never the declared MIME:** PNG signature is 8 bytes `137 80 78 71 13 10 26 10` [CITED: libpng.org/pub/png/spec/1.2/PNG-Structure.html §3.1]; WebP must begin `'RIFF'` + uint32 LE size + `'WEBP'` [CITED: developers.google.com/speed/webp/docs/riff_container]. SVG/`text/html`/anything else → rejected unconditionally (P1-D-11: PNG + WebP only). (b) **Structural parse before accept:** PNG chunks (Length/Type/Data/CRC; IHDR first, IEND last) — allowlist `IHDR/PLTE/IDAT/IEND`, drop ancillary `tEXt/eXIf/zTXt/iTXt/tIME` [CITED: libpng spec §3.2–3.3]; WebP RIFF chunks — allowlist `VP8X?/VP8|VP8L/ALPH?`, reject `ANIM/ANMF` (animation), drop `EXIF/XMP /ICCP/unknown`, reject trailing data past the declared File Size ("The file SHOULD NOT contain any data after the data specified by File Size" [CITED: developers.google.com/speed/webp/docs/riff_container]). (c) **Decode-bomb guard from headers before any decode:** PNG IHDR width/height (bytes 16–23, big-endian) or WebP VP8X "Canvas Width/Height Minus One" (24-bit LE) → reject `w*h > MAX_IMAGE_PIXELS` or `w/h > MAX_IMAGE_DIM`. (d) **Re-encode (P1-D-10, mandatory)** — same format in, same format out (P1-D-12).
**When to use:** every accepted image, from the first ingest.
**Re-encode decision (consultation-gated):** P1-D-10 mandates re-encode but explicitly requires owner consultation for any heavy new dependency (STACK.md rejects `sharp`/`jimp` for client pixel work). Options for the planner:
1. **`sharp` server-side re-encode (P1-D-10 literal).** "By default all metadata will be removed, which includes EXIF-based orientation" and `png()`/`webp()` output with format-specific options [CITED: sharp.pixelplumbing.com/api-output] — kills polyglots, EXIF/XMP and trailing data in one operation, output format preserved (P1-D-12). `timeout({ seconds })` adds a processing-time guard against bombs [CITED: same]. Cost: native libvips dependency in the `api` image (not the SDK — RNF-01 untouched). **Requires the P1-D-10 consultation + a `checkpoint:human-verify` (seam verdict SUS).**
2. **Zero-dep structural strip/rebuild (fallback if the owner refuses heavy deps).** Re-emit only the allowlisted chunks (recompute PNG CRCs via `node:zlib`-based tooling or `pngjs` [legitimacy OK]; RIFF chunk re-assembly is plain byte work). Kills metadata, trailing data and container-level polyglots without decoding a single pixel — immune to decode bombs by construction. Weaker than re-encode against decoder-differential polyglots (a file that decodes differently in different decoders).
3. **WASM codecs** (`@jsquash/*` style) — **[ASSUMED]**, unproven for this use, heavier than `sharp` in practice: do not pursue.
**Recommendation:** plan the ingest pipeline around the re-encode interface (`hardenImage(bytes) → { bytes, ext, w, h }`) as a **plain module** (not a port — R-02 fixes exactly 8 seams), put the `sharp` consultation as an early `checkpoint:human-verify`, and implement option 2 as the automatic fallback so the phase never blocks. Even with `sharp`, run (a)–(c) first: the cheap guards must reject hostile input before any codec sees it.

### Pattern 3: Path-traversal-proof `Storage` (R-02 seam #6)
**What:** the port shape already fixed by research — quote [VERIFIED: .planning/research/ARCHITECTURE.md:101-121]: `put(bytes: Uint8Array, ext: 'webp' | 'png'): Promise<{ key: string }>;` / `stream(key: string)` with key `validated: /^[a-z0-9]{2}\/[a-f0-9-]{36}\.(webp|png)$/` / `delete(key: string): Promise<void>;` — *"Keys are SERVER-generated … a put() taking a client-supplied name would be the path-traversal hole R-04 forbids, so it can't be expressed."* Layout quote [VERIFIED: .planning/research/ARCHITECTURE.md:330-339]: `/volume/blobs/<projectId>/<uuid[0:2]>/<uuid>.<ext>` and `/volume/tmp/<uuid>.<part>` with *"Write path: stream to `tmp/` → `fsync` → `rename()` (atomic on POSIX volumes; avoids orphaned partial blobs on crash)"*.
**When to use:** from the first line of `apps/api/src/storage/`.
**Implementation requirements (all C-4):** UUIDv4 keys via `crypto.randomUUID()`; key grammar `^<projectId>/[a-f0-9]{2}/[0-9a-f-]{36}\.(webp|png)$` (extends the verified regex with the `projectId` segment the layout mandates); `path.resolve(VOLUME, key)` + `assert(resolved.startsWith(path.resolve(VOLUME) + path.sep))` belt-and-braces [VERIFIED: .planning/research/ARCHITECTURE.md:341-350]; **DB-lookup-only key resolution on serve — "The request never names a file"**; volume mounted **only** in `api`, with the CI compose assertion (`scripts/check-compose.mjs`) failing if `panel` lists the attachments volume; client-supplied filenames are metadata only (C-4 quote: *"Client names are metadata only, never paths"* [VERIFIED: .planning/research/PITFALLS.md:534]).
**Write/insert order (orphan semantics):** `Storage.put` (tmp→fsync→rename) **then** `INSERT incidents … ON CONFLICT DO NOTHING` — a crash between rename and INSERT leaves an orphan *blob without row*, exactly the failure RSK-25's purge reconciliation (>24 h age threshold, never touches in-flight writes) is designed to sweep [VERIFIED: documentation/ProductRequirementsDocument.md:547,638]. On idempotency conflict, delete the just-written blob and replay the stored response.

### Pattern 4: Drizzle initial migration — TTL columns from day one (M-1/A-02)
**What:** the initial `drizzle-kit generate` migration creates `projects` and `incidents` **including the retention columns now**: identity fields as column-separable nullable columns (`user_id`, `user_name`, `user_email`) plus `identity_purge_at` and `artifact_purge_at` `timestamptz` columns computed at insert from `WATCHBUG_TTL_IDENTITY_DAYS` (30) / `WATCHBUG_TTL_ARTIFACT_DAYS` (90) — quote [VERIFIED: documentation/resolution-record.md:266-277]: *"TTLs cover the whole incident … Both configurable in `.env`"*. Also `UNIQUE (project_id, idempotency_key)` [VERIFIED: .planning/research/SUMMARY.md:87] and `storage_key`, `content_type` (`'image/webp' | 'image/png'`), `type` (`'bug' | 'feedback'`), `status` (seed `'pending'` — TRI-06's `Pending / In Progress / Resolved` transitions arrive Phases 5–6 but the column avoids a migration), `created_at`.
**When to use:** one migration, committed and reviewable (`apps/api/drizzle/`). ⚠ A DB schema change/migration is a **consultation trigger** (AGENTS.md) — getting the shape right now is why TTL columns land here.
**Project key seeding (P1-D-01/02/03):** boot-time idempotent seed — `INSERT INTO projects (id, name, public_key) … ON CONFLICT DO NOTHING` when absent, sourced from `WATCHBUG_PROJECT_KEY`; missing/placeholder → fail-fast with an exact `.env` message. Key format `wkbt_` + base62 ≈190 bits [VERIFIED: 01-CONTEXT.md P1-D-03 — quote: `` **`wkbt_` + 32 bytes aleatorios en base62 (≈190 bits)** ``]; generate 32 base62 chars from `crypto.randomBytes` with **rejection sampling** (naive `byte % 62` is modulo-biased) [ASSUMED interpretation of the 32-bytes-vs-190-bits wording — see Assumptions Log A1].

### Pattern 5: Idempotent ingest with response replay (ING-03)
**What:** client generates `crypto.randomUUID()` per logical report and reuses it across retries; server enforces `UNIQUE (project_id, idempotency_key)` and **duplicates replay the stored response** — quote [VERIFIED: .planning/research/SUMMARY.md:87]: `` `UNIQUE (project_id, idempotency_key)` with response replay ``. Retry policy for the future SDK lane (constant ships now): quote [VERIFIED: .planning/research/PITFALLS.md:535]: *"3 attempts, backoff 1 s / 4 s / 10 s with ±25 % jitter, per-attempt timeout 15 s; idempotency key = client-generated report UUID"*.
**When to use:** `POST /api/incidents` handler tail.
```typescript
// apps/api/src/routes/incidents.ts (sketch — values [VERIFIED: .planning/research/SUMMARY.md:87])
const inserted = await db.insert(incidents)
  .values({ projectId, idempotencyKey, ...row })
  .onConflictDoNothing({ target: [incidents.projectId, incidents.idempotencyKey] })
  .returning({ id: incidents.id });
if (inserted.length === 0) {
  const existing = await db.query.incidents.findFirst({
    where: and(eq(incidents.projectId, projectId), eq(incidents.idempotencyKey, idempotencyKey)),
  });
  await storage.delete(newKey);            // discard the blob we just wrote (see Pattern 3 order)
  return reply.code(200).send({ id: existing.id, replayed: true });
}
return reply.code(201).send({ id: inserted[0].id });
```
Missing `Idempotency-Key` header → `400` (contract: the key is part of the CA-01 wire shape [VERIFIED: .planning/research/ARCHITECTURE.md:152-154]).

### Pattern 6: Layered rate limiting — 429 + `Retry-After` (ING-05)
**What:** `@fastify/rate-limit` 11.2.0 with `global: false`, then three composed limiters on the ingest route via the documented `fastify.createRateLimit()` manual-limiter API (per-IP 30/min, per-project-key 10/min, per-project 2,000/day). The returned object exposes `isExceeded` and `ttlInSeconds`, and the plugin emits `retry-after` by default (`addHeaders: { … 'retry-after': true }`) [CITED: github.com/fastify/fastify-rate-limit README]. In-memory store (INV-03 — no Redis); `trustProxy` configured **explicitly** (the default `keyGenerator` only honours `X-Forwarded-For` when `trustProxy` is set — H-7's spoofing/naive-NAT concern); NAT caveat documented and limits env-tunable [VERIFIED: .planning/research/SUMMARY.md:86].
**When to use:** `preHandler` on `POST /api/incidents`.
```typescript
// Source: [CITED: github.com/fastify/fastify-rate-limit README — "Manual Rate Limit", "Custom hook example"]
await fastify.register(import('@fastify/rate-limit'), { global: false, keyGenerator: (req) => req.ip });
const byIp  = fastify.createRateLimit({ max: RATE_LIMIT_PER_IP_PER_MIN,  timeWindow: '1 minute', keyGenerator: (req) => req.ip });
const byKey = fastify.createRateLimit({ max: RATE_LIMIT_PER_KEY_PER_MIN, timeWindow: '1 minute', keyGenerator: (req) => String(req.headers['x-project-key'] ?? '') });
const byDay = fastify.createRateLimit({ max: RATE_LIMIT_PER_PROJECT_PER_DAY, timeWindow: '1 day', keyGenerator: (req) => String(req.headers['x-project-key'] ?? '') });

async function ingestRateLimit(req, reply) {
  for (const limiter of [byIp, byKey, byDay]) {
    const s = await limiter(req);                       // increments the counter
    if (!s.isAllowed && s.isExceeded) {
      reply.header('retry-after', String(s.ttlInSeconds));  // plugin default also sets it
      return reply.code(429).send({ statusCode: 429, error: 'Too Many Requests', retryAfter: s.ttlInSeconds });
    }
  }
}
```

### Pattern 7: Sanitise on write, escape on render (ING-07 / SEC-05)
**What:** pass 1 at ingest — every user-supplied string (title, note, future console messages, `user.name`/`user.email`) goes through `sanitize-html` with an **empty allowlist** (strip all markup to text) before storage; pass 2 at render — the panel renders report fields exclusively as React text nodes (auto-escaped), **never** `dangerouslySetInnerHTML`, never linkified. C-3 rationale: *"Context-appropriate output encoding is the primary control … Input sanitisation at ingest (SEC-05) is defence in depth"* [VERIFIED: .planning/research/PITFALLS.md:110-115]. Console strings are *"the highest-risk field: length-cap, strip control chars, and render each log line as text only — never linkified, never HTML"* (same citation).
**When to use:** all text fields from day one (Phase 1's synthetic `meta` already carries title/note/user).
```typescript
// Source: [ASSUMED — sanitize-html API shape; package pin [VERIFIED: .planning/research/STACK.md]]
import sanitizeHtml from 'sanitize-html';
const toPlainText = (s: string) => sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} });
```

### Pattern 8: `check:size` multi-artifact scenario (A-12/M-2)
**What:** `scripts/check-size.mjs` (node:zlib `gzipSync`, zero deps) gates **three lanes + worst-case total** from Phase 1: core `watchbug.js` ≤ 45 KB gz, lazy editor chunk ≤ 25 KB gz, optional-adapter chunk ≤ 14 KB, runtime total ≤ 80 KB — with the **worst-case scenario 45+25+14 = 84 KB > 80 KB printed visibly** so the arithmetic is never invisible (A-12 quote [VERIFIED: documentation/resolution-record.md:361-363]: *"45 + 25 + 14 = **84 KB > 80 KB** runtime ceiling in the worst case. `check:size` needs an explicit multi-artifact scenario in the first phase"*). Print a per-entrypoint gz delta on every run (SUMMARY hard constraint #3 [VERIFIED: .planning/research/SUMMARY.md:119]).
**When to use:** Phase 1 ships the gate over the SDK *shell* artifacts (empty stubs trivially pass; the scenario logic and arithmetic report are the deliverable). Real enforcement begins Phase 2; the lazy-chunk budget is revisited in Phase 7 against real numbers. Not a "test" — it is a build gate like `check:size` has always been (R-12 keeps it).

### Pattern 9: Hardened blob route (no auth claim — DEP-03 completes Phase 5)
**What:** `GET /api/incidents/:id/image` resolves the row by `:id` (parameterised SQL), reads `storage_key`, validates the key regex, `path.resolve` + prefix assertion, then streams. Response headers — quote [VERIFIED: .planning/research/PITFALLS.md:533]: `` verified `Content-Type` + `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment` (or sandboxed iframe) + `CSP: default-src 'none'; sandbox` + `CORP: same-origin` ``. `Content-Type` mapped from the DB `content_type` enum via a server allowlist (never from the request or extension); `Content-Disposition: attachment; filename="screenshot.webp|png"` — fixed ASCII name (C-4: unquoted/CR-LF filenames are header-injection vectors [VERIFIED: .planning/research/PITFALLS.md:130-132]); `Cache-Control: private, max-age=…` (never `public`). Invalid/unknown key or id → **404, not 400** ("do not confirm existence" [VERIFIED: .planning/research/PITFALLS.md:138]).
**When to use:** ship now (phase scope), make **no auth claim** (CONTEXT deferred item): the route is hardened but open until Phase 5 wraps `AuthProvider`. Record the exposure in the phase PR and bind the compose `api`/`panel` ports to `127.0.0.1` by default in dev (see Open Questions #5).

### Anti-Patterns to Avoid
- **Trusting Fastify `bodyLimit` for the multipart cap** — it does not bound multipart payloads (README quote in Summary). Always compose pre-read + streaming counter + `limits`.
- **Accepting the client-declared `Content-Type` for images** — sniff magic bytes + structure; SVG is an active text format that sniffer-based allowlists misclassify (C-3).
- **Buffering the image part with `data.toBuffer()` before the size/dim guards** — stream to tmp with `pipeline`, check `file.truncated` / `on('limit')` and header dims first (H-7).
- **Client-supplied names reaching `path.*`** — server-generated keys only; the request never names a file (C-4).
- **`req.file()` without consuming the stream** — the multipart promise never settles (README behavior); always `pipeline()` the part stream.
- **Field order assumptions in multipart** — busboy parses serially; put `meta` before `image` in the `FormData` (or read `data.fields` after consuming the file stream) [CITED: fastify-multipart README].
- **Rendering panel fields with any HTML sink** — `dangerouslySetInnerHTML` count must be zero (C-3 warning sign).
- **Unit-testing the contracts/constants "because they're pure"** — R-12 abolishes unit tests outright; CA-01's schema assertion lives in the e2e suite.
- **Adding Redis/microservices for rate-limit state** — INV-03 is exactly three containers.
- **Skipping the P1-D-10 consultation and quietly adding `sharp`** — it is both a heavy-dependency consultation trigger and a legitimacy-seam SUS verdict.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multipart parsing (fallback only) | Boundary/stream parser | `@fastify/multipart` 10.1.2 | Hostile-input parsing (`@fastify/busboy`) has a decade of edge cases (CRLF, nested boundaries, header pairs); P1-D-08 step 2 exists only if the smoke test fails |
| Rate limiting | Keyed counter maps + timers | `@fastify/rate-limit` `createRateLimit()` manual limiters | Documented store interface, `Retry-After`/`x-ratelimit-*` semantics, IPv6 normalization (`ipv6Subnet: 64`) — all easy to get subtly wrong |
| JSON Schema emission | Hand-written `report.schema.json` | Zod 4 `z.toJSONSchema(schema, { target: 'draft-2020-12' })` | The schema and the artifact would drift — the exact failure CA-01 exists to prevent |
| HTML sanitization | Regex stripping of `<script>` | `sanitize-html` with empty allowlist | Regex sanitizers have a known bypass class; contexts differ (attributes, URLs, encodings) |
| Blob key naming & path safety | `path.join(UPLOAD_DIR, filename)` + sanitize function | Server-generated UUIDv4 keys + DB-lookup + resolve-prefix assert | Traversal variants (`..%5c`, NUL, drive-relative) are an open-ended class; the safe shape makes the hole unexpressible |
| UUIDs / randomness | `Math.random`-based ids | `crypto.randomUUID()` / `crypto.randomBytes` (rejection sampling for base62) | Correctness + zero deps (ARCHITECTURE: `IdGenerator` port rejected as ceremony) |
| Schema-constant duplication across workspaces | Copy-pasted limits | `packages/contracts` `constants.ts` (R-18 DRY) | Client clamps must never diverge from server caps |
| Size gate | `bundlesize` package or CI-only script | `scripts/check-size.mjs` on `node:zlib` | CA-03 permits a script; zero deps, identical locally and in CI |
| Image re-encode (if approved) | PNG/WebP codecs in JS | `sharp` (consultation-gated) or structural strip/rebuild | Full codecs are exactly the heavy, risky work P1-D-10 routes through a consultation |

**Key insight:** every item above is an adversarial-input or cross-context problem where the library's edge-case history *is* the value. This phase's budget pressure (RNF-01) applies to the **SDK bundle**, not to `apps/api` server dependencies — but P1-D-10 and the STACK rejection list still gate heavy server additions through the owner.

## Common Pitfalls

### Pitfall 1: `bodyLimit` silently fails to bound multipart requests
**What goes wrong:** the 5 MB body cap (ING-06) is configured as Fastify `bodyLimit` alone; attackers stream unbounded multipart payloads (many parts, or one huge file up to the default `fileSize` derived from `bodyLimit`) past the "limit".
**Why it happens:** `@fastify/multipart` uses a dedicated streaming parser — README: *"do not go through Fastify's `bodyLimit` enforcement … it is **not** enforced as an aggregate limit across the whole multipart payload"* [CITED: fastify-multipart README]. This is the #1 H-7 gap in this stack.
**How to avoid:** compose (1) `Content-Length` pre-read → 413 before reading, (2) streaming byte counter that destroys the stream past `MAX_BODY_BYTES`, (3) explicit `limits` with `files: 1`, `fileSize: MAX_IMAGE_PART_BYTES`, `fields: 8`, `fieldSize: 4096`, `headerPairs: 1024`, and (4) nginx `client_max_body_size` upstream. Handle `RequestFileTooLargeError` (`fastify.multipartErrors`, carries `statusCode`) or `file.truncated` → structured 413 and delete any partial tmp file.
**Warning signs:** only one limit configured; `toBuffer()` on the file part; no `truncated`/`on('limit')` handling; no test uploading a body larger than 5 MB with a lying/absent `Content-Length`.

### Pitfall 2: `file.truncated` silently storing a cut-off image
**What goes wrong:** with `throwFileSizeLimit: false` (or streams piped to disk), a 10 MB upload is written truncated to 4 MB and stored as a corrupt image instead of rejected.
**Why it happens:** `limits.fileSize` *truncates* the stream by default in stream mode; the docs show checking `data.file.truncated` explicitly after `pipeline()` [CITED: fastify-multipart README].
**How to avoid:** keep `throwFileSizeLimit: true` (the ≥4.0.0 default) and map `RequestFileTooLargeError` → 413; if streaming to tmp, always check `truncated` before accepting, and unlink the tmp file on rejection.

### Pitfall 3: image validation trusts headers and declared MIME (polyglot / SVG / EXIF)
**What goes wrong:** a GIF/HTML polyglot or an SVG with `<script>` is accepted as "image/*", later served on the panel origin and content-sniffed into stored XSS (C-3's critical class); EXIF carries the very PII the masking is supposed to destroy.
**Why it happens:** magic-byte checks that only read the declared `Content-Type`, or accept text-based active formats; storing uploaded bytes verbatim.
**How to avoid:** P1-D-11 allowlist (PNG+WebP only, SVG unconditionally rejected) + structural chunk validation + P1-D-10 re-encode (or strip/rebuild fallback) + the three blob headers (`nosniff`, `attachment`, `CSP: default-src 'none'; sandbox`) + `CORP: same-origin`. E2E fixtures must include the hostile set now (C-3 warning sign): `"><img src=x onerror=alert(1)>`, `javascript:alert(1)`, UTF-7/UTF-16 BOM strings, an SVG, and a polyglot GIF/HTML [VERIFIED: .planning/research/PITFALLS.md:103-108].
**Warning signs:** any allowlist entry for `image/svg`, `text/html`, `*/*`; blob responses without both `nosniff` and `attachment`; zero hostile fixtures in `e2e/fixtures/`.

### Pitfall 4: decode bombs — header dims never checked before decode
**What goes wrong:** a tiny PNG/WebP declares (or expands to) hundreds of megapixels; the server decodes it during re-encode and OOMs or stalls (H-7). Node image stacks have no PIL-style default bomb guard.
**Why it happens:** dimensions are read *after* decode, or re-encode runs before any size check.
**How to avoid:** parse PNG IHDR / WebP VP8X dims from the first bytes **before** any decode; reject `w*h > 16,777_216` and `w/h > 8192`; if `sharp` is approved, add `timeout({ seconds })` [CITED: sharp.pixelplumbing.com/api-output]. The strip/rebuild fallback never decodes at all.
**Warning signs:** decode code reachable before the guard; no cap on `limits.fileSize` relative to expected image sizes; no e2e fixture with a small file declaring a huge canvas.

### Pitfall 5: rate limits keyed on one dimension, or spoofable IP identity
**What goes wrong:** a single leaked project key becomes a free firehose (H-7); or `X-Forwarded-For` rotation grants unlimited requests; or a university NAT's shared egress IP 429s every legitimate user at once.
**Why it happens:** `keyGenerator` defaults to `request.ip`, which honours `X-Forwarded-For` only when `trustProxy` is set — and setting `trustProxy: true` blindly lets attackers frame each other [CITED: fastify-rate-limit README keyGenerator docs].
**How to avoid:** layered limiters (per-key 10/min + per-IP 30/min + per-project 2,000/day), `trustProxy` set **explicitly and documented** for the deployment posture, NAT caveat documented, all three env-tunable, `429 + Retry-After` (plugin default). E2e asserts both dimensions and the daily quota (small env-configured quota in test mode).

### Pitfall 6: idempotency implemented as "check then insert" (racy) or key scoped per-project incorrectly
**What goes wrong:** two concurrent retries both pass the existence check → duplicate rows; or the uniqueness is global so two projects cannot use the same client UUID namespace.
**Why it happens:** application-level existence checks instead of a DB constraint.
**How to avoid:** `UNIQUE (project_id, idempotency_key)` + `ON CONFLICT DO NOTHING RETURNING` + replay of the stored response [VERIFIED: .planning/research/SUMMARY.md:87]; the blob write/insert order and conflict cleanup per Pattern 3/5; e2e: submit twice with one key → exactly one row, same `id`.

### Pitfall 7: TTL columns deferred ("we'll add them with retention in Phase 6")
**What goes wrong:** retention arrives in Phase 6 as a schema migration — a consultation trigger — and every incident row lacks `identity_purge_at`/`artifact_purge_at` history (M-1/A-02).
**Why it happens:** treating Phase 1 as "just the skeleton".
**How to avoid:** TTL columns in the initial migration now (Pattern 4); `.env` TTLs documented in `.env.example` now (RET-03's config surface, even though the purge job is Phase 6).

### Pitfall 8: TS 7.x tooling friction discovered mid-phase (Q-08)
**What goes wrong:** `drizzle-kit` / `tsx` / Vite plugins misbehave under TypeScript 7.0.2 (the native-Go line) and the phase stalls on toolchain archaeology.
**Why it happens:** TS 7 is young; STACK.md pinned 7.0.2 with a documented 6.x fallback and Q-08 makes the gate a Phase-1 obligation ("Phase 1 planners/executors must … resolve **Q-08** … via the Phase 1 tooling smoke-test before locking STACK.md" [VERIFIED: .planning/quick/261007-pm7-…/261007-pm7-SUMMARY.md:135]).
**How to avoid:** fold the tooling smoke test into the same first scaffolding commit as the multipart smoke test (P1-D-09): `drizzle-kit generate` on a scratch schema, `tsx watch` boot, `vite build` of the panel shell. If friction → fall back to the 6.x line and record the outcome in `documentation/continuity-pack.md` (as Q-08 prescribes).
**Warning signs:** untyped `any` creep from missing plugin type-checks; `drizzle-kit` exiting non-zero on generate.

### Pitfall 9: empty-state curl onboarding breaks the origin allowlist (ING-08 vs P1-D-07)
**What goes wrong:** the CORS allowlist rejects requests with no `Origin` header → the product's own onboarding `curl` (P1-D-07) returns 403, or conversely the allowlist accepts everything and ING-08 fails its success criterion.
**Why it happens:** "allowlisted origins" applied uniformly to non-browser clients.
**How to avoid:** enforce the allowlist when an `Origin` header is present (browser requests — `Origin: https://evil.com` → 403), accept header-less clients (curl/server-side — they are outside the browser CORS model). The e2e covers both directions: disallowed `Origin` rejected, no-`Origin` accepted, allowlisted `Origin` accepted.

## Code Examples

Verified patterns from official sources. In-repo discrete values carry `[VERIFIED: <file>:<lines>]` with verbatim quotes beside the owning pattern above.

### Ingest route skeleton — multipart with caps (the shape P1-D-09 smoke-tests first)
```typescript
// Source: [CITED: github.com/fastify/fastify-multipart README — "Usage", "Handle file size limitation", "limits"]
fastify.register(import('@fastify/multipart'), {
  limits: {
    files: 1,                                  // [VERIFIED: .planning/research/PITFALLS.md:530] "files: 1"
    fileSize: MAX_IMAGE_PART_BYTES,            // 4 MB — parser guard (constants.ts)
    fields: 8,
    fieldSize: 4096,
    headerPairs: 1024,
    parts: 16,
  },
  throwFileSizeLimit: true,                    // throws RequestFileTooLargeError at limits.fileSize
});

fastify.post('/api/incidents', {
  preHandler: [contentLengthGate, ingestRateLimit, corsAllowlist],
  config: { bodyLimit: MAX_BODY_BYTES },       // NOTE: does NOT bound multipart — Pattern 1 layer 1 does
}, async (req, reply) => {
  const data = await req.file();               // stream mode — never toBuffer() before guards
  // data.file (stream), data.fields (meta JSON string), data.filename (metadata only — never a path)
  await pipeline(data.file, tmpWriteStream);   // stream to /volume/tmp/<uuid>.part with byte counter
  if (data.file.truncated) throw new fastify.multipartErrors.RequestFileTooLargeError();
  // … then: Zod validate meta → key check → sniff/structure/dims → harden → Storage.put → idempotent insert
});
```

### Magic-byte + structural sniff (PNG / WebP)
```typescript
// Source: [CITED: libpng.org/pub/png/spec/1.2/PNG-Structure.html §3.1] — PNG signature (decimal): 137 80 78 71 13 10 26 10
// Source: [CITED: developers.google.com/speed/webp/docs/riff_container] — 'RIFF' + uint32 LE size + 'WEBP'
const PNG_SIG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
function sniffImage(b: Buffer): 'png' | 'webp' | null {
  if (b.subarray(0, 8).equals(Buffer.from(PNG_SIG))) return 'png';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;                                 // SVG/HTML/GIF/anything else → reject (P1-D-11)
}
// dims before decode: PNG IHDR w/h big-endian at bytes 16..23;
// WebP: VP8X 'Canvas Width/Height Minus One' (24-bit LE) or the VP8/VP8L frame headers.
```

### Hardened blob response (C-3/C-4 headers)
```typescript
// Source: [VERIFIED: .planning/research/PITFALLS.md:533] — quote: "verified Content-Type + X-Content-Type-Options: nosniff
//   + Content-Disposition: attachment (or sandboxed iframe) + CSP: default-src 'none'; sandbox + CORP: same-origin"
const MIME_BY_EXT = { webp: 'image/webp', png: 'image/png' } as const;   // server allowlist from DB content_type
reply
  .header('Content-Type', MIME_BY_EXT[ext])
  .header('X-Content-Type-Options', 'nosniff')
  .header('Content-Disposition', 'attachment; filename="screenshot.' + ext + '"')  // fixed ASCII name
  .header('Content-Security-Policy', "default-src 'none'; sandbox")
  .header('Cross-Origin-Resource-Policy', 'same-origin')
  .header('Cache-Control', 'private, max-age=3600')
  .send(stream);
```

### `check:size` multi-artifact scenario (A-12)
```javascript
// scripts/check-size.mjs — Source: [CITED: node:zlib docs via .planning/research/STACK.md]; thresholds [VERIFIED: documentation/resolution-record.md:361-363]
import { gzipSync } from 'node:zlib';
// lanes: core 45 KB gz (hard) · lazy editor 25 KB gz · optional adapter 14 KB · runtime total 80 KB
// scenario 'worst-case-all-lanes': 45 + 25 + 14 = 84 KB → PRINT AS VISIBLE > 80 KB (not hidden, not waived)
const kb = (buf) => (gzipSync(buf).length / 1024).toFixed(1);
// per-entrypoint delta printed on every run ([VERIFIED: .planning/research/SUMMARY.md:119])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `zod-to-json-schema` | Zod 4 `z.toJSONSchema()` | Nov 2025 (maintainer deprecation) | Contracts emits the CA-01 artifact natively — one less dependency |
| TypeScript 6.x | TS 7.0.2 (native Go compiler) | 2026-07 | ~10× faster checks, same language; **tooling ecosystem still young — Q-08 gate lives in this phase** |
| Node 22/24 `dotenv` | Node `--env-file` (stable) | Node 24 | SEC-04 without a dependency |
| Single size number (45 KB) | Tiered lanes + multi-artifact scenario | R-01 / A-12 | `check:size` must model core + lazy + adapter from day one |
| Rate limit per-IP only | Layered per-key + per-IP + per-day with `Retry-After` | H-7 / SEC-05 | One leaked key is no longer a firehose |
| Store uploads verbatim | Structural validation + re-encode (P1-D-10) | C-3/C-4 | Polyglots/EXIF die at ingest |

**Deprecated/outdated:**
- `zod-to-json-schema`: deprecated by its maintainer — never add it.
- Trusting Fastify `bodyLimit` as the multipart aggregate cap: disproven by the current plugin README (Pitfall 1).
- `keepalive`/`sendBeacon` for report bodies: spec-capped at 64 KiB (H-9) — not this phase's problem (Phase 7), but the idempotency groundwork here is what makes the future retry queue safe.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | P1-D-03's "32 bytes aleatorios en base62 (≈190 bits)" means **32 base62 characters** (≈190 bits entropy), generated from `crypto.randomBytes` with rejection sampling | Pattern 4 | Low — `wkbt_` + base62 shape is locked either way; only the length/entropy accounting differs. Confirm at consultation if a strict reading of "32 bytes" (256 bits → 43 base62 chars) is intended |
| A2 | `sharp` behavior (metadata stripped by default, `png()`/`webp()` same-format re-encode, `timeout()` guard) | Pattern 2 | Low — claims are `[CITED: sharp.pixelplumbing.com/api-output]`, but the *adoption* of `sharp` is not approved: it is consultation-gated (P1-D-10) and legitimacy-seam SUS |
| A3 | `sanitize-html` API shape (`sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} })`) | Pattern 7 | Low — stable, well-known API; package pin verified. Would fail fast at first `npm run verify` if wrong |
| A4 | `@fastify/cors` 11.x option names for an env-driven origin allowlist (`origin` callback/list) | ING-08 | Low — plugin pin + Fastify-5 mapping verified in STACK.md; exact option spelling to confirm against its README at implementation |
| A5 | Layered image caps: 4 MB parser guard + **2 MB semantic** reject (rather than accepting up to 4 MB semantically) | Pattern 1 table | Medium-low — A-06 calls 2 MB "hard"; SUMMARY fixes the parser part at 4 MB. If the planner picks one number only, pick 2 MB (the stricter, contract-level one). See Open Questions #3 |
| A6 | Drizzle column/table naming (`snake_case` columns, `timestamptz` TTL columns, `status` seeded `'pending'`) | Pattern 4 | Low — schema shape is explicitly "the agent's Discretion" (CONTEXT) |
| A7 | Phase-1 e2e layout (CA-group file split inside one suite, hostile fixture set, Playwright `request` for synthetic uploads) | Validation Architecture | Low — "concrete e2e structure of the CA assertions" is agent's discretion |
| A8 | Compose invocation is `docker compose` (hyphenless) — Compose v5.5.1 provides the plugin; the legacy `docker-compose` binary may be absent | Environment Availability | Low — AGENTS.md writes `docker-compose up -d`; document both or normalize in README |
| A9 | Read endpoints (list + image) ship **unauthenticated** in Phase 1 as an explicit, documented scope decision (DEP-03 auth completes Phase 5) | Pattern 9 | Medium — security-relevant exposure if the deployment is internet-facing; mitigated by localhost port binding + PR disclosure. See Open Questions #5 |

## Open Questions

1. **Re-encode dependency (P1-D-10 consultation — blocks the ingest endpoint's image stage).**
   - What we know: P1-D-10 mandates server-side re-encode but requires owner consultation for heavy dependencies; STACK.md rejects `sharp`/`jimp` for *client* pixel work; `sharp` re-encodes png/webp and strips metadata by default [CITED: sharp.pixelplumbing.com/api-output]; a zero-dep structural strip/rebuild alternative exists (Pattern 2, option 2).
   - What's unclear: whether the owner accepts `sharp` (native libvips in the `api` image only) or prefers the strip/rebuild fallback (weaker against decoder-differential polyglots).
   - Recommendation: one `CONSULT`/`checkpoint:human-verify` task before the ingest implementation; implement the `hardenImage()` module seam so both backends drop in; never block the phase.

2. **TS 7.x tooling gate (Q-08).**
   - What we know: STACK.md pins TS 7.0.2 with a 6.x fallback; Q-08 says the Phase-1 smoke test (`drizzle-kit`/`tsx`/Vite plugins) decides and must be recorded in `continuity-pack.md`.
   - Recommendation: run it inside the first scaffolding commit alongside the P1-D-09 multipart smoke test; fall back to 6.x on friction.

3. **Image cap semantics: 2 MB vs 4 MB (Assumption A5).**
   - What we know: A-06 "2 MB hard" (encoded image), SUMMARY "4 MB per file part" (parser), 5 MB body.
   - Recommendation: layered as in Pattern 1 (4 MB parser guard + 2 MB semantic reject + 16 MP dim guard). Lock this in the plan's constants task so the e2e fixtures assert the intended status codes (413 at both layers).

4. **Daily quota enforcement durability.** The in-memory limiter resets on API restart — the 2,000/day per project quota is best-effort in a single-node self-hosted deployment (INV-03 forbids Redis). Document the caveat in `.env.example`/integration docs; revisit only if the owner raises it.

5. **Phase-1 read-surface exposure (Assumption A9).** List + blob endpoints are unauthenticated until Phase 5 by explicit scope. Recommendation: bind `api`/`panel` published ports to `127.0.0.1` in the committed compose file for dev posture, state the exposure in the PR, and revisit at Phase 5 with `AuthProvider`.

6. **`Idempotency-Key` header absence policy.** Recommended: 400 when absent on `POST /api/incidents` (the CA-01 wire shape includes it). Alternative: accept and treat the request as non-idempotent. Cheap to decide in the plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, api dev, tooling | ✓ | v24.11.1 (local); 24.21.0 pinned in images | — |
| npm (workspaces) | monorepo install/build | ✓ | 11.6.2 | — |
| Docker Engine | DEP-01 compose stack | ✓ | 29.2.1 | — |
| Docker Compose | DEP-01 (`docker-compose up`) | ✓ | v5.5.1 (`docker compose`; see A8) | document `docker compose` spelling |
| PostgreSQL 18.6 | `db` service | ✓ (via image) | `postgres:18.6-alpine3.24` (Docker Hub, verified in STACK.md) | — |
| Playwright browsers | `npm run verify` | install-time | 1.63.0 (`npx playwright install` — Wave 0 step) | CI image `mcr.microsoft.com/playwright:v1.63.0-noble` |
| tsx / vite / esbuild / drizzle-kit | dev + build | install-time | pins from STACK.md | TS 6.x line if Q-08 gate fails |

**Missing dependencies with no fallback:** none — the machine has the full toolchain; everything else installs from the pinned registry versions behind the batched human checkpoint.

**Missing dependencies with fallback:** `sharp` (re-encode) — absent by decision pending consultation; fallback = zero-dep structural strip/rebuild.

**Step 2.6 note:** all probes run 2026-10-11 on the target machine (Windows): `node --version`, `npm --version`, `docker --version`, `docker compose version` all green.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section is included. **R-12 overrides the default unit-test expectation:** there is no unit-test framework, no per-function tests, no coverage thresholds. All automated behavior verification lives in the one Playwright suite + the build gates. Gates (`check:size`, `check:compose`) are scripts, not tests.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@playwright/test` 1.63.0 (STACK.md pin) — the ONLY framework |
| Config file | `playwright.config.ts` (Wave 0 — to be created; projects: chromium, firefox, webkit) |
| Quick run command | `npm run verify` |
| Full suite command | `npm run verify` (one suite — same command) |
| Build gates | `npm run check:size` (A-12 multi-artifact), `npm run check:compose` (C-4 volume assertion) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEP-01 | `docker compose up` starts api + panel + db; panel proxies `/api` | e2e (global setup asserts `/api/health` + panel 200) | `npm run verify` | ❌ Wave 0 |
| DEP-02 | Missing/placeholder `WATCHBUG_PROJECT_KEY` → fail-fast boot with exact `.env` message | e2e (spec boots `apps/api` with bad env and asserts exit + message) | `npm run verify` | ❌ Wave 0 |
| ENR-06 | Stored report validates against `schema/report.schema.json` | e2e (fixture round-trip; validate stored row against the published artifact) | `npm run verify` | ❌ Wave 0 |
| ING-01 | Synthetic `FormData` report lands as row + image on the volume | e2e (Playwright `request` POST → list → blob) | `npm run verify` | ❌ Wave 0 |
| ING-03 | Retry with same `Idempotency-Key` → exactly one row, same id (replay) | e2e (double POST) | `npm run verify` | ❌ Wave 0 |
| ING-04 | Missing/invalid project key → structured 401 | e2e | `npm run verify` | ❌ Wave 0 |
| ING-05 | Per-key + per-IP throttling + daily quota → 429 + `Retry-After` | e2e (small env-tunable quotas in test mode; assert both dimensions) | `npm run verify` | ❌ Wave 0 |
| ING-06 | Oversized body/image → 413; SVG/polyglot → 400; traversal-style names rejected | e2e (hostile fixtures) | `npm run verify` | ❌ Wave 0 |
| ING-07 | XSS strings stored sanitised; panel renders inert text | e2e (assert text content, zero injected elements) | `npm run verify` | ❌ Wave 0 |
| ING-08 | Disallowed `Origin` rejected; allowlisted + no-`Origin` accepted | e2e | `npm run verify` | ❌ Wave 0 |
| RNF-01/CA-03 gates | Size tiers + worst-case 84>80 scenario visible | build gate | `npm run check:size` | ❌ Wave 0 |
| INV-03/C-4 gate | Blob volume mounted only in `api` | build gate | `npm run check:compose` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run verify` (targeted specs via `-g` where possible) — R-12: as few assertions as prove the property.
- **Per wave merge:** `npm run verify` + `npm run check:size` + `npm run check:compose`.
- **Phase gate:** all three green before `/gsd-verify-work`; the one suite stays ≈20 assertions (R-12) — Phase 1 consumes roughly 12–15 of them across the ingest group.

### Wave 0 Gaps
- [ ] `playwright.config.ts` — 3 browser projects (webkit matters from Phase 2 for the WebP→PNG fallback; harmless now)
- [ ] `e2e/verify.spec.ts` skeleton with CA-01…CA-05 group structure (Phase 1 fills the ingest/contract groups)
- [ ] `e2e/fixtures/` — valid PNG + WebP, SVG (must-reject), polyglot GIF/HTML, traversal-style filenames, XSS strings (`"><img src=x onerror=alert(1)>`, `javascript:alert(1)`, UTF-7/UTF-16 BOM) per C-3's "add them **now**" [VERIFIED: .planning/research/PITFALLS.md:108]
- [ ] `scripts/check-size.mjs` — multi-artifact scenario (A-12)
- [ ] `scripts/check-compose.mjs` — C-4 volume assertion
- [ ] Root `package.json` workspaces + `tsconfig.base.json` + workspace shells (`packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel`)
- [ ] **No unit-test framework of any kind (R-12).** "Wave 0 gaps" here means harness + fixtures + gates only.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` (`.planning/config.json`). This phase is a security-dense phase: it implements C-3/C-4 at first ingest.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial (write-side only) | Write-only `project_key` (`wkbt_`…, P1-D-03) gates ingest as a *capability*, never a read (H-7). Real authentication (Argon2id + JWT) is Phase 5 — this phase makes no auth claim |
| V3 Session Management | no | Phase 5 (`__Host-` cookie, TTL ≤ 8 h — SEC-06) |
| V4 Access Control | yes (partial) | Project-key check on POST (401 structured); blob route hardened but unauthenticated until Phase 5 (A9/Open Q5); key never gates reads |
| V5 Input Validation | yes | Zod closed schema (CA-01, no free-form bag), layered size caps, magic-byte + structural image allowlist (PNG/WebP only, SVG unconditional reject), decode-bomb header guard, `sanitize-html` on ingest |
| V6 Cryptography | yes (light) | `crypto.randomBytes`/`randomUUID` for keys and blob names (rejection sampling for base62); no hand-rolled crypto; Argon2id arrives Phase 5 (SEC-06) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via report text (C-3) | Tampering / Elevation | `sanitize-html` allowlist-empty on write + React text-node-only rendering (double control; either alone has a bypass class) |
| Image-borne XSS: SVG, polyglots, content sniffing (C-3) | Tampering | PNG/WebP magic-byte + structural allowlist, SVG unconditional reject, re-encode (P1-D-10) / strip fallback, blob headers `nosniff` + `attachment` + `CSP: default-src 'none'; sandbox` + `CORP: same-origin` |
| Path traversal / arbitrary file read (C-4) | Information disclosure | Server-generated UUIDv4 keys `projectId/<xx>/<uuid>.<ext>`, DB-lookup-only resolution, key regex + `path.resolve` prefix assertion, volume mounted only in `api` + CI compose assertion, 404 (not 400) on bad keys |
| Ingest DoS: body/payload/decode bombs, multipart abuse (H-7) | Denial of service | Content-Length pre-read + streaming counter (⚠ `bodyLimit` does not bound multipart), multipart `limits`, 16 MP + 8192-dim header guard, layered rate limits (key/IP/day) with `Retry-After`, `trustProxy` explicit |
| Project-key abuse / enumeration (H-7) | Elevation | Rate limits per key + per IP; key authenticates writes only; 401 responses do not leak key existence |
| Header injection via filenames (C-4) | Tampering | Fixed ASCII `Content-Disposition` filename; client names never reach headers or paths |
| EXIF/metadata PII retention (M-1/C-3) | Information disclosure | Re-encode/strips metadata at ingest; TTL columns from first migration |
| Idempotency races → duplicate personal data | Repudiation | DB `UNIQUE (project_id, idempotency_key)` + response replay |

## Sources

### Primary (HIGH confidence)
- `npm view` registry metadata (`@fastify/multipart@10.1.2`, `@fastify/rate-limit@11.2.0`, `fastify@5.12.5`, `esbuild`, `sharp`, `pngjs`, `@playwright/test`) — versions, devDependencies (`fastify: ^5.0.0`), dependency lines (`fastify-plugin ^6`, `@fastify/busboy ^3`), postinstall scripts [VERIFIED: npm registry]
- github.com/fastify/fastify-multipart README (fetched 2026-10-11) — `limits` options, `RequestFileTooLargeError`/`throwFileSizeLimit`/`file.truncated`, stream/disk modes, **the `bodyLimit` non-enforcement note**, field-order note, Zod integration pointer
- github.com/fastify/fastify-rate-limit README (fetched 2026-10-11) — compat table (`>=10.x` ↔ `^5.x`), `retry-after` default headers, `createRateLimit()` manual limiters (`isExceeded`, `ttlInSeconds`, `{ increment: false }`), custom `store` interface, `keyGenerator`/`trustProxy` semantics
- sharp official docs — sharp.pixelplumbing.com/api-output (fetched 2026-10-11) — metadata stripped by default, `png()`/`webp()`/`toFormat`, `timeout({seconds})`, changelog (v0.35.5, 2026-09-27)
- PNG Specification v1.2 §3 (libpng.org — reference implementation site, fetched 2026-10-11) — signature `137 80 78 71 13 10 26 10`, chunk layout, ancillary/critical bits
- WebP Container Specification (developers.google.com/speed/webp/docs/riff_container, fetched 2026-10-11) — RIFF header layout, VP8X canvas dims, EXIF/XMP/ICCP chunks, trailing-data clause

### Project governing records (read this session; in-repo claims quoted verbatim with line ranges above)
- `.planning/phases/01-contracts-ingest-slice/01-CONTEXT.md` — P1-D-01…P1-D-12, discretion, deferred ideas
- `documentation/resolution-record.md` — R-01…R-18, A-01…A-12 (esp. A-02, A-06, A-09, A-10, A-11, A-12), Q-08
- `.planning/research/SUMMARY.md` — "one binding constant set" table, transport/idempotency resolution, hard constraints
- `.planning/research/PITFALLS.md` — C-3/C-4/H-7/H-9 details + recommended constants table
- `.planning/research/ARCHITECTURE.md` — `Storage`/`AuthProvider` port shapes, ingest edge order, storage layout & blob serving, multipart-vs-base64 verdict
- `.planning/REQUIREMENTS.md` — DEP-01/02, ENR-06, ING-01/03…08 definitions
- `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json`, `documentation/ProductRequirementsDocument.md` (RSK-23/24/25, storage invariant 5), `.planning/quick/261007-pm7-…/261007-pm7-SUMMARY.md` (Q-08 Phase-1 gate)

### Secondary (MEDIUM confidence)
- STACK.md's 2026-10-05 registry/Docker Hub verification of all remaining pins (re-confirmed selected rows today)

### Tertiary (LOW confidence / ASSUMED)
- `sharp`-adoption trade-offs as an engineering recommendation (behavior claims cited; adoption unapproved) — Assumptions Log A2
- `sanitize-html` and `@fastify/cors` exact API spellings in examples — A3/A4
- Layered 2 MB + 4 MB image-cap reading — A5

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pins verified in STACK.md and selectively re-verified against the npm registry today; the two flagged plugin mappings now have registry-level evidence
- Architecture: HIGH — governing decisions (CONTEXT, resolution-record, research set) read first; Fastify/Rate-limit/WebP/PNG behavior grounded in official docs
- Pitfalls: HIGH — the phase-critical `bodyLimit` gap is quoted from the plugin's own README; remaining pitfalls drawn from the project's cross-checked PITFALLS research

**Research date:** 2026-10-11
**Valid until:** 2026-11-10 (30 days — stack is version-pinned and greenfield; re-validate if the phase slips past the Node 24→26 re-pin window (2026-10-28) or if `@fastify/multipart` publishes a new major)

**Digests cached:** 3 entries via `research-store put` (multipart↔Fastify-5 mapping; layered rate-limit API; PNG/WebP container forensics) — reusable by Phases 2–7 research.
