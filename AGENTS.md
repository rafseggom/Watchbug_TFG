# Agent Instructions

> **This file is the entry point for any agent working on this project.**  
> Read it fully once. For detailed governing documents, see the referenced files in `documentation/`.

---

## Agentic Software Engineering (ASE) — How We Work

This project operates under the **ASE paradigm**. Every task must follow the **C-B-D-C** control framework.

### Core Axiom

> Producing code is not the bottleneck; trust, evidence, and intention alignment are.

**Rule Zero:** Never guess ambiguous intent or rush into writing code.

---

### The 4 Control Points (C-B-D-C)

| Phase | Action |
|-------|--------|
| **Contract** | Explicitly define goals, non-goals (*Declare the No*), constraints, and property-based acceptance criteria before editing code. |
| **Bound** | Respect scope boundaries, timeboxes, iteration limits, and file-access envelopes. |
| **Delegate with Evidence** | Execute with autonomy on the method, but always return a structured evidence pack (test logs, static analysis, benchmarks). |
| **Converge & Record** | Land verified changes, discard throwaway experiments, and update durable records. |

---

### Coordination Artifacts (Read These)

| Artifact | File | Purpose |
|----------|------|---------|
| **Mission Brief** | `documentation/mission-brief.md` | Task spec: Goal, Non-Goals, Plan, Autonomy Envelope, Acceptance Properties |
| **Mentorship Pack** | `documentation/mentorship-pack.md` | Institutional rules: architectural invariants, quality targets, security policies |
| **Workflow Runbook** | (TBD) | Executable SOP: step-by-step gates, commands, validation rules |
| **Continuity Pack** | `documentation/continuity-pack.md` | State across resets: progress, open questions, **dead-ends** (failed paths) |
| **Consultation Request Pack** | (output) | Generated when hitting autonomy limits: decision, options, trade-offs, evidence, recommendation |
| **Merge-Readiness Pack** | (output) | Generated on completion: scope-to-proof map, verification logs, change manifest, rollback plan |
| **Resolution Record** | (output) | Durable record of approved decisions and architectural trade-offs |

---

### Paradox Mitigation Rules (Guardrails)

| Paradox | Rule |
|---------|------|
| **Anti-Eagerness** | If under-specified: `Ask Before You Build`. Present draft Mission Brief; confirm before modifying files. |
| **Anti-Context Overload** | Keep active working sets minimal. Load-on-demand context cards. Invariants > formatting prefs. |
| **Anti-Tunnel Vision** | Validate global system properties, boundary interfaces, operational readiness—not just local file correctness. |
| **Anti-Amnesia** | Read **Continuity Pack** and **Resolution Records** at session start. Record rejected attempts in dead-ends log. |

---

### Standard Interaction Commands

| Command | Purpose |
|---------|---------|
| `MODE: PLAN` | Generate/update Mission Brief and Conceptual Plan. **Do not edit production code.** |
| `MODE: EXECUTE` | Implement within autonomy envelope; run deterministic checks. |
| `MODE: CONSULT` | Pause. Generate Consultation Request Pack for out-of-bounds decisions. |
| `MODE: CLOSEOUT` | Run full verification suites; generate Merge-Readiness Pack. |

---

## Project Overview (Watchbug SDK)

Open-source, self-hostable bug-reporting and visual-feedback SDK. A developer adds one async script tag to their web app; their end users get a floating widget that captures the current tab, annotates it, destructively masks anything sensitive, and files it as a bug or as plain feedback with console logs and environment metadata. The developer then triages those reports in a self-hosted admin panel deployed as containers.

**Stack (R-15): TypeScript end to end.** npm-workspaces monorepo - `packages/contracts`, `packages/sdk`, `apps/api` (Fastify 5), `apps/panel` (React + Vite), PostgreSQL 18, Docker. Exact pinned versions live in `.planning/research/STACK.md`.

> **Corrected 2026-10-05.** This file previously described a Python 3.10 / FastAPI / Ruff / pytest / `watchbug/*` layout with an 80% unit-test coverage target. That was leftover scaffolding from an unrelated setup and is **not** this project. See `documentation/resolution-record.md` R-15, R-16 and R-12.

---

## Architecture & Data Flow

```
Host App + Widget  --HTTP multipart-->  apps/api (Fastify)  -->  PostgreSQL
   (packages/sdk)                            |
                                             v
                                      apps/panel (static SPA behind nginx)
```

**Workspaces**

| Workspace | Purpose |
|-----------|---------|
| `packages/contracts` | The single official JSON schema (Zod 4) for CA-01. The SDK imports it **types-only**. |
| `packages/sdk` | Client: widget, capture, redaction, annotation, transport. **Zero runtime dependencies.** |
| `apps/api` | Fastify 5 ingestion + admin API. |
| `apps/panel` | React + Vite static SPA (INV-03). |

**Ports (R-02 - pragmatic hexagonal, exactly 8 seams)**

Client: `CaptureSource`, `Redactor`, `Enricher`, `Annotator`, `Transport`, `WidgetHost`. Server: `Storage`, `AuthProvider`.

Reserved ports are **seams only**. Never build an adapter for an out-of-scope feature (Jira/GitHub/Slack, S3/MinIO, bearer auth, session replay, AI analysis) - those are non-goals.

---

## Invariants & Non-Negotiables (From Mentorship Pack)

> **Full details:** `documentation/mentorship-pack.md` - Amendments: `documentation/resolution-record.md` section 5

| Invariant | Requirement |
|-----------|-------------|
| **INV-01: Total Widget Isolation** | Shadow DOM `mode: 'closed'` (build-time `SHADOW_MODE` flag emits the e2e-only bundle). Zero global CSS/JS leakage. |
| **INV-02: Clean Global Namespace** | Single `window.Watchbug` entry point. No prototype patching. |
| **INV-03: Self-Hosted Containers** | Single `docker-compose.yml`, exactly three services: `api`, `panel`, `db`. |
| **SEC-01: Auto-Sanitization** | Mask `input[type=password]`, credential/token/card patterns, `data-watchbug-sensitive`. |
| **SEC-02: Destructive Canvas Masking** | Alter `ImageData` before encode. **Flat opaque fill only** as the automatic primitive. No CSS overlays. |
| **SEC-03: No Host Credentials** | SDK never reads or sends host cookies/storage/tokens. Only the public write-only `project_key`. |
| **SEC-04: Zero Secrets in Code** | `.env` only. `.env.example` committed. |
| **SEC-05: XSS Sanitization + Rate Limiting** | Sanitise on ingest, render inert in the panel. `/api/incidents` rate-limited per IP **and** per project key. |
| **SEC-06: Secure Auth** | Argon2id. JWT TTL no more than 8 h in a `__Host-` / `HttpOnly` / `Secure` / `SameSite=Lax` cookie. |
| **RNF-01: Tiered size budget** | Injected core no more than **45 KB** gz, lazy chunk no more than **25 KB** gz, runtime total no more than **80 KB** gz. Async, never blocking the main thread. |
| **RNF-02: Total Isolation** | Host CSS cannot break the widget. |
| **RNF-03: i18n** | English + Spanish. |
| **R-13: Masking primitive** | **Flat opaque fill (alpha 255)** is the only automatic primitive. Pixelation opt-in only at block size at least `max(8 px, 2x cap-height)`, grid-snapped. **Gaussian blur is prohibited** - it is partially invertible by deconvolution. |
| **R-12: Verification policy** | **E2E and property assertions ONLY.** See Testing & QA below. |

---

## Consultation Triggers (Pause & Ask)

> **Full autonomy envelope:** `documentation/mission-brief.md` section 3

Stop autonomous work and generate a Consultation Request Pack when:
- Changing the public SDK interface (`window.Watchbug.init()`)
- Changing the `/api/incidents` payload schema (CA-01 is a contract)
- Modifying the Shadow DOM isolation strategy
- DB schema changes / migrations
- Choosing blob storage (FS vs S3/MinIO vs DB)
- Adding dependencies that push the SDK past its size tier
- Adding non-permissive licenses or uncertain GDPR edge cases

---

## Development Commands

```bash
# Setup
npm install                     # npm workspaces

# Build (packages/sdk -> IIFE + ESM; two esbuild calls, one format each)
npm run build

# Size gate (R-01 tiers; fails the build on breach)
npm run check:size

# Verification - the ONLY test artefact (see Testing & QA)
npm run verify                  # one Playwright suite: CA-01..CA-05 on chromium + firefox + webkit

# Lint / format
npm run lint

# Run locally
docker-compose up -d            # api + panel + db (INV-03)
npm run dev                     # tsx watch apps/api
```

---

## Code Conventions (Quick Reference)

| Area | Convention |
|------|------------|
| **TypeScript** | ES2020 target. `import type` from `packages/contracts` in the SDK so Zod never ships to the client. |
| **Client SDK** | IIFE + ESM dual build. Shadow DOM `closed`. Single `window.Watchbug`. Zero runtime deps. |
| **Naming** | TS: camelCase / PascalCase; kebab-case for files. Requirement IDs: `[CATEGORY]-[NN]`. |
| **Ports** | An interface per seam only where a real second implementation exists. Plain modules everywhere else. |
| **Migrations** | `drizzle-kit` generated, committed and reviewable. A migration is a consultation trigger. |

---

## Key Files

| File | Purpose |
|------|---------|
| `package.json` | npm workspaces root |
| `.env.example` | Documented env vars (DB URL, JWT secret, CORS origins, TTLs) |
| `docker-compose.yml` | Three services: `api`, `panel`, `db` |
| `packages/contracts/` | The official payload schema (Zod 4), emitting `schema/report.schema.json` |
| `packages/sdk/src/index.ts` | SDK entry point |
| `scripts/check-size.mjs` | R-01 size gate (`node:zlib`) |
| `.planning/REQUIREMENTS.md` | 70 v1 requirements with REQ-IDs |
| `.planning/ROADMAP.md` | 7 phases with requirement traceability |
| `documentation/resolution-record.md` | Decision register R-01..R-17 plus amendments A-01..A-13 |
| `documentation/continuity-pack.md` | Session state, open questions, dead-ends |

---

## Testing & QA (R-12)

> **Owner policy, stated twice: "DONT MAKE A BUNCH OF TESTS. Only make e2e as necessary, not unit tests."**
> There is **no unit-test suite**, no per-function tests, no formatter tests, and **no coverage thresholds**. Do not create them.

| What | Command | Covers |
|------|---------|--------|
| **Size gate** | `npm run check:size` | RNF-01 / CA-03 - the 45 / 25 / 80 KB tiers |
| **One e2e suite** | `npm run verify` | CA-01..CA-05, about 20 assertions, on chromium + firefox + **webkit** |

webkit is not optional: it exercises the silent WebP-to-PNG fallback. Firefox exercises the no-`ImageCapture` path.

Security properties are asserted at the **artifact level**. CA-02, for example, intercepts the outgoing request, decodes the attached image, and asserts the masked region's original pixel values are absent from the encoded bytes. That is stronger evidence than any unit test, and it is the required form.

---

<!-- GSD:project-start source:PROJECT.md -->

## Project

**Watchbug SDK**

Watchbug is an open-source, self-hostable bug-reporting and visual-feedback SDK. A developer adds one script tag to their web app; their end users get a floating widget that screenshots the current page, lets them annotate it, mask anything sensitive, and file it as a bug or as plain feedback — together with console logs and environment metadata. The developer then triages those reports in a self-hosted admin panel, deployed as containers.

It exists for developers who want Marker.io / Sentry-style user feedback **without** sending their users' data to a third-party SaaS and without the weight of session-replay tooling. Primary audience: developers and integrators self-hosting their own tooling. Secondary audience: the degree committee evaluating this as a TFG.

**Core Value:** **When a bug report lands, the developer can reproduce the bug from it — and neither the report nor its screenshot ever leaves the developer's own infrastructure.**

Every prioritisation trade-off resolves against this sentence. Capture fidelity and metadata completeness serve the first clause; self-hosting, destructive masking and the no-host-credentials rule serve the second. When they conflict, the second clause wins — a report that leaks is worse than a report that is thin.

### Constraints

- **Architecture** (R-02): pragmatic hexagonal — ports at exactly 8 seams (`CaptureSource`, `Redactor`, `Enricher`, `Annotator`, `Transport`, `Storage`, `AuthProvider`, `WidgetHost`), plain modules elsewhere. Reserved ports are seams only; no out-of-scope adapter will be built to fill them.
- **Stack** (R-15): TypeScript end-to-end in an npm-workspaces monorepo (`packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel`) with PostgreSQL and Docker. Chosen so CA-01's *single* official JSON schema is structurally true rather than a convention.
- **Client size** (RNF-01, CA-03, R-01): tiered gzipped budget — injected `watchbug.js` ≤ **45 KB** (hard), each lazy chunk ≤ **25 KB**, total runtime payload ≤ **80 KB**. Enforced by `npm run check:size`, failing CI.
- **Isolation** (INV-01, INV-02, R-14): Shadow DOM `mode:'closed'` in production (build-time `SHADOW_MODE` flag emits an e2e-only bundle). Exactly one global entry point, `window.Watchbug`, or an ES-module export. No native prototype patching. No stylesheets or classes injected into host `head`/`body`.
- **Privacy** (SEC-01, SEC-02, R-13): mask `input[type=password]`, credential/token/card values, and `[data-watchbug-sensitive]`. Masking operates destructively on `ImageData` **before** encode. Solid fill or block pixelation ≥8 px only. **No CSS overlays. No gaussian blur.**
- **Host credentials** (SEC-03): the SDK never reads or transmits host cookies, `localStorage`, `sessionStorage`, Bearer tokens or auth headers. Only the public write-only `project_key` leaves the browser.
- **Secrets** (SEC-04): zero secrets in code. All server configuration via environment variables from `.env`, with a documented, committed `.env.example`.
- **API hardening** (SEC-05): sanitise all user-supplied fields against stored XSS before storage *and* before panel rendering; rate-limit `/api/incidents` per IP and per project key; scope CORS to authorised client origins and block unauthorised access to admin APIs.
- **Panel auth** (SEC-06, R-05): Argon2id (bcrypt acceptable fallback), JWT with a defined TTL in `HttpOnly` / `SameSite=Lax` / `Secure` cookies. Single admin provisioned from `.env`.
- **Deployment** (INV-03): one `docker-compose.yml`, exactly three services — `api`, static `panel`, persistent `db`. Provider-agnostic. Attachments on a filesystem volume, served **only** through the authenticated API (R-04).
- **Personal data** (R-09, R-10): `user: {id, name?, email?}` is host-supplied and sent by default with `privacy: { userIdentity: false }` as opt-out. Identity fields auto-purge after N days (default 30, configurable); reports persist anonymised. RGPD Art. 13 notice belongs in integration docs.
- **Verification** (R-12): **e2e and property assertions only** — one Playwright suite mapping 1:1 to CA-01…CA-05, plus the `check:size` build gate. No unit-test suites, no coverage thresholds.
- **Scope discipline** (R-17): no calendar-driven descoping. Scope is cut by coherence only. All Mentorship Pack quality gates remain hard.
- **License** (R-07): Apache-2.0. ⚠ Pending confirmation of the degree-awarding institution's IP policy (Q-05) before the repository is made public.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Summary

## Recommended Stack

### Client SDK

| Package | Version | Verified? (source) | Confidence | Rationale |
|---|---|---|---|---|
| **Runtime dependencies: NONE** | — | — | high | R-01/D-04/D-05 make this a hard constraint, not a preference. Capture = `getDisplayMedia` + canvas; masking = raw `ImageData` loops; annotation = hand-rolled canvas editor; i18n = two hand-rolled dictionaries. Every byte of dependency is a byte stolen from the 45 KB hard budget. |
| `esbuild` (build) | 0.28.2 | VERIFIED — https://registry.npmjs.org/esbuild | high | One TS source → IIFE + ESM. Verified from `esbuild@0.28.2/lib/main.d.ts`: `format?: Format` where `Format = 'iife'\|'cjs'\|'esm'` — **one format per `build()` call**, so the dual output is two `build()` invocations (same entry, different `format`/`outfile`). `metafile: true` feeds the size gate. |
| `typescript` (types only) | 7.0.2 | VERIFIED — https://registry.npmjs.org/typescript (existence); TS 7 = native Go port, language unchanged vs 6.0 — https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ , https://typescriptdocs.com/release-notes/TypeScript%207.0 | medium | Type-check only; esbuild transpiles. TS 7.0 ships ~10× faster builds and "checks the same types, reports the same errors, and emits the same JavaScript as 6.0". Medium, not high: the 7.x tooling ecosystem (drizzle-kit, tsx, vite plugins) is young — see Risks. |
| `zod` — **types only in the SDK** | 4.6.5 | VERIFIED — https://registry.npmjs.org/zod | high | `packages/contracts` must expose **type-only imports** (`import type`) to the SDK so Zod is erased at compile time and never ships in the client bundle. The runtime schema object is consumed by API (CA-01 validation) and panel only. This is how R-15's "single official schema" survives R-01's budget. |
- **Capture path (Q-09):** `navigator.mediaDevices.getDisplayMedia({ video: true, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' })` → `MediaStreamTrack` → `<video>` element → `ctx.drawImage` → `getImageData`. This is the correct ~1 KB path. `ImageCapture.grabFrame()` is an optional micro-optimization only: MDN BCD shows Chrome 59+, Edge 79+, **Safari 18.4+**, Firefox **flag-only** (`dom.imagecapture.enabled`) — i.e. absent on Firefox — while `video`→canvas works everywhere `getDisplayMedia` works. VERIFIED — https://unpkg.com/@mdn/browser-compat-data@latest/data.json , https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture/grabFrame
- **Hard constraints (VERIFIED — https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia):** secure context (HTTPS/localhost) required; **transient user activation** required (must run inside the button's event handler); permission is **never persisted** — the picker appears on every capture (this is exactly Q-06's trade-off). `getDisplayMedia` itself is MDN "Limited availability / not Baseline". `preferCurrentTab` support in Firefox/Safari: **UNVERIFIED**.
- **WebP encoding (Q-08):** `canvas.toBlob(cb, 'image/webp', 0.8)` is reliable in Chromium; Safari has historically not encoded WebP from canvas and the spec makes the fallback **silent** (returns a valid PNG, no throw, no null — `blob.type` is the only tell). Correct detection is **content sniffing**, once, at startup: draw a 1×1 canvas, call `toBlob(..., 'image/webp')`, accept only if `blob && blob.type === 'image/webp'`, cache the boolean; else encode PNG (R-11 as approved). There is no capability query. VERIFIED — https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob ("If the given format is not supported, the data will be exported as image/png"), corroborated by https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp and https://dev.to/harshit_katheria/ask-canvas-for-a-webp-in-safari-and-you-silently-get-a-png-5hn6

### Contracts / Shared Schema

| Package | Version | Verified? (source) | Confidence | Rationale |
|---|---|---|---|---|
| `zod` | 4.6.5 | VERIFIED — https://registry.npmjs.org/zod (README: "Built-in JSON Schema conversion") | high | **The** official schema for CA-01. Zod 4 emits JSON Schema natively via `z.toJSONSchema(schema, { target: 'draft-2020-12' })` — confirmed by the zod-to-json-schema maintainer's deprecation notice pointing to https://zod.dev/json-schema#ztojsonschema . Zod 4 > Zod 3 **specifically because of this**: with v3 you'd need `zod-to-json-schema`, which is now a dead dependency. Zero runtime deps, MIT. |
| `zod-to-json-schema` | **do not add** | VERIFIED deprecated — https://registry.npmjs.org/zod-to-json-schema ("Notice of deprecation… As of November 2025, this project will no longer be actively maintained. Zod v4 natively supports generating JSON schemas") | high | Rejected on maintainer's own recommendation. Emit artifact `schema/report.schema.json` from `packages/contracts` at build time and commit it; the API validates payloads against the Zod schema and the JSON Schema file is the published contract. |

### API

| Package | Version | Verified? (source) | Confidence | Rationale |
|---|---|---|---|---|
| `fastify` | 5.12.5 | VERIFIED — https://registry.npmjs.org/fastify | high | R-15 core. Plugin architecture *is* the "plugs" seam at the HTTP edge. Ships with pino logging built in (no extra dep). |
| `@fastify/rate-limit` | 11.2.0 | VERIFIED — https://registry.npmjs.org/@fastify/rate-limit (README table: `>=10.x` ↔ `^5.x`) | high | SEC-05. See gotchas below. |
| `@fastify/cors` | 11.3.0 | VERIFIED — https://registry.npmjs.org/@fastify/cors (README table: `^11.x` ↔ `^5.x`) | high | SEC-05 scoped-origins. With nginx same-origin proxy (see Container images) CORS is mostly defense-in-depth. |
| `@fastify/multipart` | 10.1.2 | Version VERIFIED — https://registry.npmjs.org/@fastify/multipart ; **Fastify-5 mapping UNVERIFIED** (README has no compat table) | medium | Screenshot upload as `multipart/form-data` (R-15). Same major-line as other Fastify-5-era releases, but pin and smoke-test at first `apps/api` phase. |
| `@fastify/helmet` | 13.1.1 | VERIFIED — https://registry.npmjs.org/@fastify/helmet (README table: `>=12.x` ↔ `^5.x`) | high | Cheap hardening of admin API responses. |
| `@fastify/cookie` | 11.1.2 | VERIFIED — https://registry.npmjs.org/@fastify/cookie (README table: `>=10.x` ↔ `^5.x`) | high | SEC-06 `HttpOnly` / `SameSite=Lax` / `Secure` cookie handling. |
| `jose` | 6.2.12 | VERIFIED — https://registry.npmjs.org/jose | high | JWT with a **defined TTL** (R-05/SEC-06): `SignJWT` + `setExpirationTime` gives exact, auditable expiry; zero deps; framework-agnostic so the reserved static-token `AuthProvider` adapter reuses it. Alternative `@fastify/jwt@10.2.2` (VERIFIED ">= v9 supports Fastify@5" — https://registry.npmjs.org/@fastify/jwt) is fine but couples JWT to Fastify internals (fast-jwt). |
| `@node-rs/argon2` | 2.2.1 | VERIFIED — https://registry.npmjs.org/@node-rs%2Fargon2 | high | **Q-10 answer.** No `install` script; 13 prebuilt platform packages as `optionalDependencies` including `linux-x64-musl` **and `linux-arm64-musl`** (alpine-friendly) → zero toolchain in the Docker image. Hash/verify API supports Argon2id (exact option names **UNVERIFIED**, check docs at implementation). Fallback `hash-wasm@4.12.0` (VERIFIED zero deps, pure WASM — https://registry.npmjs.org/hash-wasm) if a target platform ever lacks a prebuilt. |
| `drizzle-orm` | 0.45.3 | VERIFIED — https://registry.npmjs.org/drizzle-orm (peer `pg >=8`) | high | **Q-3 answer: Drizzle over Kysely.** Both are zero-runtime-dep typed SQL over `pg`; the deciding factor is *migrations*: `drizzle-kit` generates reviewable SQL migrations from the schema, which is exactly what the DB-schema/migration consultation trigger wants to inspect. Kysely 0.29.6 (VERIFIED — https://registry.npmjs.org/kysely, `engines.node >=22`) is the more API-stable of the two but has **no schema/migration generator** — you author every migration by hand. Drizzle risk is 0.x churn; mitigated by exact-version pin + committed lockfile. |
| `pg` | 8.23.1 | VERIFIED — https://registry.npmjs.org/pg (`engines.node >= 16`) | high | The `pg` slot R-15 names explicitly. Works with Drizzle's node-postgres driver. |
| `sanitize-html` | 2.18.0 | VERIFIED — https://registry.npmjs.org/sanitize-html (`engines.node >= 22.12.0`) | high | SEC-05 stored-XSS: sanitize every user-supplied field **on ingest**. Panel then renders via React text nodes only (auto-escaped) — never `dangerouslySetInnerHTML`. |
| Env loading | Node built-in `--env-file` | VERIFIED — nodejs/node v24.21.0 CLI docs: "`--env-file` flag is no longer experimental" — https://raw.githubusercontent.com/nodejs/node/v24.21.0/doc/api/cli.md | high | SEC-04: `.env` via `node --env-file=.env` in dev and compose `env_file:` in prod. No `dotenv` dependency needed. |

### Panel

| Package | Version | Verified? (source) | Confidence | Rationale |
|---|---|---|---|---|
| `react` / `react-dom` | 19.3.0 | VERIFIED — https://registry.npmjs.org/react , https://registry.npmjs.org/react-dom | high | R-15. Current stable. React's text-node escaping satisfies half of SEC-05 for free. |
| `@types/react` / `@types/react-dom` | 19.3.0 | VERIFIED — https://registry.npmjs.org/@types/react | high | Matches React minor. |
| `vite` | 8.3.2 | VERIFIED — https://registry.npmjs.org/vite (`engines.node ^20.19.0 \|\| >=22.12.0`) | high | Static SPA build (INV-03). Node 24 satisfies engines. |
| `@vitejs/plugin-react` | 6.1.2 | VERIFIED — https://registry.npmjs.org/@vitejs/plugin-react (peer `vite ^8.0.0` ✓ matches 8.3.2) | high | Verified peer compatibility with Vite 8. |
| Router / state / data libs | **none** | — | high | Opinionated: the panel is one triage screen (login → list + filter + detail pane + state change). `fetch` + small hooks + `useState` covers it; `react-router-dom@7.18.4`, `zustand@5.0.15`, `@tanstack/react-query@5.104.1` (all VERIFIED to exist) are alternatives if the panel grows — each is then a one-package add. |
| i18n | hand-rolled `en`/`es` dictionaries | — | high | RNF-03 needs 2 locales with no interpolation complexity. Same pattern as the widget; one shared shape, zero deps. |

### Database

| Package | Version | Verified? (source) | Confidence | Rationale |
|---|---|---|---|---|
| **PostgreSQL** | **18.6** | VERIFIED — Docker Hub `library/postgres` tags (tag `18.6`, `18.6-alpine3.24`; the `latest` tag tracks 18.6) — https://hub.docker.com/v2/repositories/library/postgres/tags | high | Greenfield → current stable major (18, whose `latest` alias proves it's the supported head). **Supersedes R-15's illustrative "PostgreSQL 16"** — R-15 explicitly deferred exact versions to research, so this is a pin, not a reopened decision. Drop-in fallbacks if a supervisor objects: `17.11` or `16.15` (both tags VERIFIED present). |
| `drizzle-kit` | 0.31.11 | VERIFIED — https://registry.npmjs.org/drizzle-kit | high | Generates SQL migrations from the Drizzle schema into `apps/api/drizzle/` (committed, reviewable) — satisfies the migration-strategy consultation trigger with artifacts instead of opinions. |
| `pg` + `drizzle-orm` | 8.23.1 / 0.45.3 | See API table | high | Driver + ORM live in `apps/api`, not here. |

### Tooling (build, size gate, e2e)

| Package | Version | Verified? (source) | Confidence | Rationale |
|---|---|---|---|---|
| npm workspaces | built into Node 24 | VERIFIED (runtime feature of the pinned Node image) | high | R-15 monorepo: `packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel`. No turbo/nx — 4 workspaces don't justify it. |
| `esbuild` | 0.28.2 | VERIFIED — https://registry.npmjs.org/esbuild ; single-format-per-call VERIFIED from `lib/main.d.ts` | high | **Q-7 answer:** one `scripts/build.mjs` running **two `build()` calls** over the same entry — (1) `format:'iife'`, `globalName`/`footer` exposing `window.Watchbug`, `outfile: dist/watchbug.js`; (2) `format:'esm'`, `outfile: dist/watchbug.mjs`. Both with `metafile: true`, `minify: true`, `target: ['es2020']`, `define: { SHADOW_MODE: ... }` (R-14's build flag). **Gotcha:** esbuild `splitting` works only with `format:'esm'` + `outdir`, so the ≤25 KB lazy annotator chunk is a **second entry point** (`watchbug-annotator.js` / `.mjs`) loaded on demand — via dynamic `import()` in the ESM build and a script-tag injection in the IIFE build. API bundling: `esbuild.build({ platform:'node', format:'esm', packages:'external' })`. |
| Size gate (`scripts/check-size.mjs`) | Node `node:zlib` (built-in) | VERIFIED (Node builtin) | high | CA-03 permits "bundlesize **o script de inspección**" — use the script: gzipSync each dist artifact and assert R-01's 45 / 25 / 80 KB tiers. Zero dependencies, works identically in CI and locally, and reads the esbuild metafile for the runtime-total tier. |
| `@playwright/test` | 1.63.0 | VERIFIED — https://registry.npmjs.org/@playwright/test (`engines.node >=20`) | high | **Q-11 answer.** The one `npm run verify` suite (R-12): 5 groups mapping to CA-01…CA-05, ≈20 assertions. |
| Playwright browsers | chromium + webkit (+ firefox) | VERIFIED image: `mcr.microsoft.com/playwright:v1.63.0-noble` — https://mcr.microsoft.com/v2/playwright/tags/list | high | **webkit is not optional noise:** it exercises the WebP→PNG silent-fallback path (R-11) end-to-end; chromium exercises the WebP path; firefox exercises the no-`ImageCapture` path (Q-9). Three browsers, three real code paths. |
| `tsx` | 4.23.15 | VERIFIED — https://registry.npmjs.org/tsx (`engines.node >=18`) | high | `tsx watch` for `apps/api` dev; esbuild-based, no native code. |
| `@biomejs/biome` | 2.5.15 | VERIFIED — https://registry.npmjs.org/@biomejs%2Fbiome (MIT OR Apache-2.0) | medium | Lint + format in one tool (optional but cheap). Medium only because R-12 keeps verification e2e-only — lint must never grow into a test mandate. |

### Container base images

| Service | Image | Verified? (source) | Confidence | Rationale |
|---|---|---|---|---|
| `api` | `node:24.21.0-alpine3.24` | VERIFIED — Docker Hub `library/node` tags (exact tag exists) — https://hub.docker.com/v2/repositories/library/node/tags | high | **Q-1 answer: Node 24 LTS** — v24.21.0 is the current 24.x, "Krypton" Active LTS (schedule: LTS 2025-10-28 → maintenance 2026-10-20 → EOL 2028-04-30) — https://raw.githubusercontent.com/nodejs/Release/main/schedule.json + https://nodejs.org/dist/index.json . The claim "Node 24 is the active LTS" is **VERIFIED as of 2026-10-05** but flips to maintenance within weeks: **Node 26 (v26.10.0, Current) becomes Active LTS on 2026-10-28**. Pin 24 now for reproducible builds; schedule one re-pin to `node:26.x` after that date (26 is supported to 2029-04-30). Alpine is safe: `@node-rs/argon2` ships `linux-x64-musl` prebuilds. Pin the **full** version+distro tag (shown), not `node:24-alpine`. |
| `panel` (build) | `node:24.21.0-alpine3.24` | VERIFIED (same as above) | high | Multi-stage: build the Vite SPA, copy artifacts into nginx. |
| `panel` (serve) | `nginx:1.30.5-alpine3.24` | VERIFIED — Docker Hub `library/nginx` tags (`1.30.5-alpine3.24` exists; `stable-*` aliases track the 1.30 line) — https://hub.docker.com/v2/repositories/library/nginx/tags | high | Static SPA (INV-03). **Critical config:** nginx must also reverse-proxy `/api/` → `api:3000` so panel and API are **same-origin**. SEC-06 mandates `SameSite=Lax` cookies, which browsers do not send on cross-site XHR — without this proxy, cookie auth is broken by design. INV-03 is preserved: still exactly three services. |
| `db` | `postgres:18.6-alpine3.24` | VERIFIED — Docker Hub `library/postgres` tags | high | Named volume for data **and** the attachments volume for the API (R-04). |
| e2e (CI only) | `mcr.microsoft.com/playwright:v1.63.0-noble` | VERIFIED — https://mcr.microsoft.com/v2/playwright/tags/list (`v1.63.0-noble`, `-jammy`, `-resolute`, arch variants all exist) | high | Browsers preinstalled; matches `@playwright/test@1.63.0` exactly (mismatch between image and npm version is the #1 Playwright CI failure). Not part of the shipped compose file. |

## Version Verification Table

| # | Claim | Version | Source | Status |
|---|---|---|---|---|
| 1 | Node 24 is the active LTS | v24.21.0 (LTS "Krypton" since 2025-10-28) | https://nodejs.org/dist/index.json ; https://raw.githubusercontent.com/nodejs/Release/main/schedule.json | VERIFIED (but note: enters maintenance 2026-10-20; Node 26 becomes Active LTS 2026-10-28) |
| 2 | Fastify core | 5.12.5 | https://registry.npmjs.org/fastify | VERIFIED |
| 2 | `@fastify/rate-limit` 11.x ↔ Fastify 5 | 11.2.0 | https://registry.npmjs.org/@fastify/rate-limit (README table `>=10.x`↔`^5.x`) | VERIFIED |
| 2 | `@fastify/cors` 11.x ↔ Fastify 5 | 11.3.0 | https://registry.npmjs.org/@fastify/cors (README table `^11.x`↔`^5.x`) | VERIFIED |
| 2 | `@fastify/multipart` ↔ Fastify 5 | 10.1.2 | https://registry.npmjs.org/@fastify/multipart (no compat table in README) | Version VERIFIED / **Fastify-5 mapping UNVERIFIED** |
| 2 | `@fastify/helmet` 13.x ↔ Fastify 5 | 13.1.1 | https://registry.npmjs.org/@fastify/helmet (README table `>=12.x`↔`^5.x`) | VERIFIED |
| 2 | `@fastify/cookie` 11.x ↔ Fastify 5 | 11.1.2 | https://registry.npmjs.org/@fastify/cookie (README table `>=10.x`↔`^5.x`) | VERIFIED |
| 2 | `@fastify/jwt` ≥9 ↔ Fastify 5 (alternative) | 10.2.2 | https://registry.npmjs.org/@fastify/jwt ("`@fastify/jwt` >= v9 supports Fastify@5") | VERIFIED |
| 2 | rate-limit per-IP + per-key mechanics (`keyGenerator`, `max` async, custom `store`, `trustProxy`) | — | https://registry.npmjs.org/@fastify/rate-limit (README Options) | VERIFIED |
| 3 | Drizzle ORM over `pg` | drizzle-orm 0.45.3, drizzle-kit 0.31.11 | https://registry.npmjs.org/drizzle-orm ; https://registry.npmjs.org/drizzle-kit | VERIFIED |
| 3 | Kysely alternative | 0.29.6 (`engines.node >=22`) | https://registry.npmjs.org/kysely | VERIFIED |
| 4 | PostgreSQL current stable (pin) | 18.6 (`latest` tracks 18) | https://hub.docker.com/v2/repositories/library/postgres/tags | VERIFIED |
| 5 | Zod current major + native JSON Schema emit | 4.6.5 (`z.toJSONSchema`) | https://registry.npmjs.org/zod ("Built-in JSON Schema conversion"); https://registry.npmjs.org/zod-to-json-schema (deprecation notice linking https://zod.dev/json-schema#ztojsonschema) | VERIFIED |
| 5 | `zod-to-json-schema` status | 3.25.2 | https://registry.npmjs.org/zod-to-json-schema | VERIFIED **DEPRECATED** (Nov 2025, maintainer says switch to Zod v4 native) |
| 6 | React | 19.3.0 | https://registry.npmjs.org/react | VERIFIED |
| 6 | Vite | 8.3.2 (`engines.node ^20.19.0 \|\| >=22.12.0`) | https://registry.npmjs.org/vite | VERIFIED |
| 6 | `@vitejs/plugin-react` peer `vite ^8.0.0` matches | 6.1.2 | https://registry.npmjs.org/@vitejs/plugin-react | VERIFIED |
| 7 | esbuild accepts one `format` per `build()` call (`'iife'\|'cjs'\|'esm'`) → two calls for IIFE+ESM | 0.28.2 | https://unpkg.com/esbuild@0.28.2/lib/main.d.ts | VERIFIED |
| 8 | `toBlob` silently falls back to `image/png` for unsupported types (no throw, no null) | — | https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob | VERIFIED |
| 8 | Correct WebP detection = sniff `blob.type === 'image/webp'` | — | https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp ; https://dev.to/harshit_katheria/ask-canvas-for-a-webp-in-safari-and-you-silently-get-a-png-5hn6 | VERIFIED (behavior), Safari "never encodes WebP" claim = MEDIUM (single secondary source) |
| 9 | `getDisplayMedia` requires secure context + transient activation; permission never persisted | — | https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia | VERIFIED |
| 9 | `preferCurrentTab` is a top-level `getDisplayMedia` option | — | https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia | VERIFIED (spec+MDN); Firefox/Safari support **UNVERIFIED** |
| 9 | `ImageCapture.grabFrame()` support | Chrome 59+, Edge 79+, Safari 18.4+, Firefox flag-only, FF-Android none | https://unpkg.com/@mdn/browser-compat-data@latest/data.json | VERIFIED (note: Safari ≥18.4 support contradicts the folklore "Chromium-only" — Firefox remains the gap) |
| 10 | `@node-rs/argon2` prebuilt incl. musl, no install script | 2.2.1 (13 optional platform pkgs) | https://registry.npmjs.org/@node-rs%2Fargon2 | VERIFIED |
| 10 | `argon2` runs `node-gyp-build` install script | 0.45.1 | https://registry.npmjs.org/argon2 | VERIFIED |
| 10 | `hash-wasm` pure WASM, zero deps | 4.12.0 | https://registry.npmjs.org/hash-wasm | VERIFIED |
| 11 | Playwright | 1.63.0 | https://registry.npmjs.org/@playwright/test | VERIFIED |
| 11 | Playwright Docker image tag | `mcr.microsoft.com/playwright:v1.63.0-noble` | https://mcr.microsoft.com/v2/playwright/tags/list | VERIFIED |
| — | TypeScript current | 7.0.2 (native Go compiler, language unchanged vs 6.0, shipped 2026-07-08) | https://registry.npmjs.org/typescript ; https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ | VERIFIED (existence + nature); **TS 7 tooling ecosystem compatibility UNVERIFIED** |
| — | `jose` | 6.2.12 | https://registry.npmjs.org/jose | VERIFIED |
| — | `sanitize-html` (`engines.node >=22.12.0`) | 2.18.0 | https://registry.npmjs.org/sanitize-html | VERIFIED |
| — | `tsx` | 4.23.15 | https://registry.npmjs.org/tsx | VERIFIED |
| — | `@biomejs/biome` | 2.5.15 | https://registry.npmjs.org/@biomejs%2Fbiome | VERIFIED |
| — | Node `--env-file` is stable in v24 | — | https://raw.githubusercontent.com/nodejs/node/v24.21.0/doc/api/cli.md | VERIFIED |
| — | `node:24.21.0-alpine3.24` image tag exists | 24.21.0 | https://hub.docker.com/v2/repositories/library/node/tags | VERIFIED |
| — | `nginx:1.30.5-alpine3.24` (stable line) image tag exists | 1.30.5 | https://hub.docker.com/v2/repositories/library/nginx/tags | VERIFIED |

## What NOT To Use

| Rejected | Why | Use instead |
|---|---|---|
| `html2canvas` for capture | **D-04** (closed): ≈50 KB gzipped — larger than the entire 45 KB core budget. | `getDisplayMedia` + canvas (Q-9 path above) |
| `html-to-image` / SVG `foreignObject` DOM serialization as **primary** capture | **D-08** (closed): 8–14 KB *and* silent failures on cross-origin images, `<video>`, WebGL, fonts, host closed shadow roots. | Keep only as the optional `CaptureSource` adapter behind R-02's seam |
| `fabric.js` / `konva` for the annotator | **D-05** (closed): ≈85 KB / ≈45 KB gzipped — each blows the budget alone. | Hand-rolled canvas editor as the ≤25 KB lazy chunk |
| Gaussian blur as masking primitive | **D-06** / **R-13** (closed): linear, partially invertible by deconvolution — fails SEC-02. | Solid fill or block pixelation ≥8 px on `ImageData`, before encode |
| `zod-to-json-schema` | **DEPRECATED by its own maintainer** (Nov 2025). | `z.toJSONSchema()` in Zod 4 |
| `argon2` (npm native) in the Docker build | Runs `node-gyp-build` at install — the exact "native-build pain" to avoid; a missing prebuild drags node-gyp into the image. | `@node-rs/argon2` (prebuilt musl binaries); `hash-wasm` as pure-WASM fallback |
| `bcrypt` as primary hash | R-05 already ranks it as fallback only. | Argon2id via `@node-rs/argon2` |
| Redis-backed rate-limit store | Adds a **4th container** → violates INV-03's three-service promise. | `@fastify/rate-limit` in-memory store (correct for single-node self-hosting) |
| `dotenv` package | Redundant: Node 24's `--env-file` is stable (verified). | `node --env-file=.env` / compose `env_file` |
| Prisma / TypeORM / Knex | Prisma: Rust engine binary + codegen step (native layer, heavy toolchain); TypeORM: decorator-era API and legacy maintenance profile; Knex: untyped query builder. All violate "typed SQL over `pg`" with minimum machinery. | `drizzle-orm` + `pg` (R-15) |
| Redux / MobX / Zustand / React Query / router libs in the panel | The panel is one triage screen — state libraries are ceremony, and each widens the maintenance surface. | `fetch` + hooks + `useState` |
| `dangerouslySetInnerHTML` + DOMPurify as the XSS strategy | Rendering sanitized HTML re-opens the XSS surface SEC-05 is closing; `dompurify@3.4.16` is dual MPL-2.0/Apache-2.0 (license friction under R-07's Apache-2.0). | React text nodes (auto-escaped) + server-side `sanitize-html` on ingest |
| Unit-test frameworks / coverage tooling | **R-12** (owner policy, stated twice): e2e + property assertions only. | One Playwright suite + `check:size` |
| `bundlesize` package for CA-03 | CA-03 explicitly allows "script de inspección"; a package is needless surface. | `scripts/check-size.mjs` on `node:zlib` |
| Puppeteer | Duplicates Playwright's role; Playwright's webkit project is needed anyway for the R-11 fallback path. | `@playwright/test` |
| Session replay / video libs (rrweb etc.) | mission-brief §2 non-goal — and the fastest way to blow RNF-01. | Nothing |
| Next.js / Remix for the panel | Server framework for a static SPA breaks INV-03's "static panel" service shape. | React + Vite static build behind nginx |
| Python/FastAPI, Go, PHP backends | R-15 rejected list (schema duplication, two toolchains). | TypeScript end-to-end |
| `sharp` / `jimp` for pixel work | Server-side image libs are irrelevant: masking must happen client-side on `ImageData` **before** encode (SEC-02), and they're heavy. | Raw `ImageData` loops (solid fill / ≥8 px block average) |

## Risks & Open Questions

## Sources

- https://registry.npmjs.org/{fastify,@fastify/rate-limit,@fastify/cors,@fastify/multipart,@fastify/helmet,@fastify/cookie,@fastify/static,@fastify/jwt,drizzle-orm,drizzle-kit,kysely,pg,zod,zod-to-json-schema,react,react-dom,@vitejs/plugin-react,vite,esbuild,@playwright/test,playwright,typescript,@node-rs/argon2,argon2,hash-wasm,jose,sanitize-html,dompurify,tsx,@biomejs/biome}/latest — package versions, licenses, engines, install scripts, optionalDependencies
- https://registry.npmjs.org/@fastify/rate-limit … /@fastify/jwt — README compatibility tables + rate-limit options (keyGenerator / max / store / trustProxy)
- https://registry.npmjs.org/zod-to-json-schema — maintainer deprecation notice (Nov 2025) → z.toJSONSchema
- https://unpkg.com/zod@4.6.5/README.md — "Built-in JSON Schema conversion"
- https://unpkg.com/esbuild@0.28.2/lib/main.d.ts — `Format` type (one format per build call)
- https://nodejs.org/dist/index.json — v24.21.0 LTS "Krypton", v26.10.0, v22.23.3
- https://raw.githubusercontent.com/nodejs/Release/main/schedule.json — LTS/maintenance/EOL dates (v24: lts 2025-10-28, maintenance 2026-10-20; v26: lts 2026-10-28)
- https://raw.githubusercontent.com/nodejs/node/v24.21.0/doc/api/cli.md — `--env-file` stability
- https://hub.docker.com/v2/repositories/library/{postgres,node,nginx}/tags — image tags (`18.6-alpine3.24`, `24.21.0-alpine3.24`, `1.30.5-alpine3.24`)
- https://mcr.microsoft.com/v2/playwright/tags/list — `v1.63.0-noble`
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia — secure context, transient activation, `preferCurrentTab`, unpersisted permission
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob — silent PNG fallback semantics
- https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture/grabFrame
- https://unpkg.com/@mdn/browser-compat-data@latest/data.json — ImageCapture support matrix
- https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ — TS 7 native Go compiler
- https://typescriptdocs.com/release-notes/TypeScript%207.0 — "language unchanged vs 6.0"
- https://dev.to/harshit_katheria/ask-canvas-for-a-webp-in-safari-and-you-silently-get-a-png-5hn6 — Safari WebP-encode gap (MEDIUM)
- https://zod.dev/json-schema#ztojsonschema — Zod 4 JSON Schema docs (cited by maintainer)
- Project context: `.planning/PROJECT.md`, `documentation/resolution-record.md` (R-01…R-17, D-01…D-08), `documentation/mission-brief.md`, `documentation/mentorship-pack.md`

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
