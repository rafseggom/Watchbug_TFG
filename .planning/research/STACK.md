# Stack Research: Watchbug SDK

**Scope:** Stack-dimension research (greenfield). Mandate: **verify and pin** the R-15 stack with exact current versions — not re-choose it. All version claims were checked against live sources on **2026-10-05** (npm registry, nodejs.org, Docker Hub, MCR, MDN, maintainer READMEs). Anything not confirmed against a live source is explicitly marked **UNVERIFIED**.

## Summary

The pinned stack is **TypeScript end-to-end in an npm-workspaces monorepo on Node 24 LTS (v24.21.0)** — nothing in the decided architecture (R-15) is invalidated by current ecosystem state. **Fastify 5.12.5** with `@fastify/rate-limit@11.2.0`, `@fastify/cors@11.3.0`, `@fastify/multipart@10.1.2`, `@fastify/helmet@13.1.1`, `@fastify/cookie@11.1.2` (all verified Fastify-5 compatible except multipart, flagged), **Drizzle ORM 0.45.3 + drizzle-kit 0.31.11 over `pg@8.23.1`** (Drizzle confirmed as the pick over Kysely: schema-as-code + generated SQL migrations, which the DB-schema consultation trigger needs), **PostgreSQL 18.6** (`postgres:18.6-alpine3.24`; supersedes R-15's illustrative "16" — version pinning was explicitly deferred to research), **Zod 4.6.5 with native `z.toJSONSchema()`** for CA-01's single official schema (`zod-to-json-schema` is officially **deprecated** since Nov 2025 — do not use), **React 19.3.0 + Vite 8.3.2 + @vitejs/plugin-react 6.1.2** for the panel, **esbuild 0.28.2** building IIFE + ESM from one TS source in two build calls (the API accepts one format per call — verified), **@playwright/test 1.63.0** for the single e2e suite, **@node-rs/argon2 2.2.1** (prebuilt musl binaries — zero native-build pain in alpine) + **jose 6.2.12** for panel auth. Containers: `node:24.21.0-alpine3.24` (api + panel build), `nginx:1.30.5-alpine3.24` (panel, with `/api` reverse proxy so the `SameSite=Lax` cookie works same-origin), `postgres:18.6-alpine3.24`. One time-sensitive note: **Node 26 becomes Active LTS on 2026-10-28** — keep 24 pinned for reproducibility now, plan one re-pin later.

## Recommended Stack

### Client SDK

| Package | Version | Verified? (source) | Confidence | Rationale |
|---|---|---|---|---|
| **Runtime dependencies: NONE** | — | — | high | R-01/D-04/D-05 make this a hard constraint, not a preference. Capture = `getDisplayMedia` + canvas; masking = raw `ImageData` loops; annotation = hand-rolled canvas editor; i18n = two hand-rolled dictionaries. Every byte of dependency is a byte stolen from the 45 KB hard budget. |
| `esbuild` (build) | 0.28.2 | VERIFIED — https://registry.npmjs.org/esbuild | high | One TS source → IIFE + ESM. Verified from `esbuild@0.28.2/lib/main.d.ts`: `format?: Format` where `Format = 'iife'\|'cjs'\|'esm'` — **one format per `build()` call**, so the dual output is two `build()` invocations (same entry, different `format`/`outfile`). `metafile: true` feeds the size gate. |
| `typescript` (types only) | 7.0.2 | VERIFIED — https://registry.npmjs.org/typescript (existence); TS 7 = native Go port, language unchanged vs 6.0 — https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ , https://typescriptdocs.com/release-notes/TypeScript%207.0 | medium | Type-check only; esbuild transpiles. TS 7.0 ships ~10× faster builds and "checks the same types, reports the same errors, and emits the same JavaScript as 6.0". Medium, not high: the 7.x tooling ecosystem (drizzle-kit, tsx, vite plugins) is young — see Risks. |
| `zod` — **types only in the SDK** | 4.6.5 | VERIFIED — https://registry.npmjs.org/zod | high | `packages/contracts` must expose **type-only imports** (`import type`) to the SDK so Zod is erased at compile time and never ships in the client bundle. The runtime schema object is consumed by API (CA-01 validation) and panel only. This is how R-15's "single official schema" survives R-01's budget. |

**Screenshot + encoding decisions (verified, no packages needed):**

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

**`@fastify/rate-limit` gotchas for SEC-05 (per-IP AND per-project-key) — verified from README:**

1. Default `keyGenerator` is a **normalized IP** (IPv6 mapped/masked at `/64` by default, `ipv6Subnet` configurable). `X-Forwarded-For` is only honored when Fastify `trustProxy` is enabled — set it deliberately behind the nginx proxy.
2. The plugin counts **one counter per key**. For *per-IP and per-key* limiting, the documented mechanisms are: (a) `keyGenerator` returning a composite `${ip}|${projectKey}` (limits the pair), (b) `max` as `async (request, key) => number` for per-key quotas read from the DB, and (c) a **custom `store`** (documented `CustomStore` interface: `incr(key, cb, timeWindow, max)` + `child(routeOptions)`) that increments an IP counter *and* a project-key counter — (c) is the correct reading of SEC-05 ("per IP/Project Key") and is the recommended implementation.
3. In-memory store is the default; the `redis` option needs `ioredis` and a **4th container** — forbidden by INV-03. Single-node self-hosting makes in-memory correct; document that limits are per-process.
4. Useful extras: `ban` (429→403 escalation), `continueExceeding`, `skipOnError`, `errorResponseBuilder`. 429 responses carry `retry-after` — keep that shape in the contract.

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

*Confidence-tier provenance: the GSD `classify-confidence` seam maps `context7`/`jina`/`exa` (verified) → MEDIUM and `websearch`/`webfetch` → LOW. The claims above were fetched from **first-party registries and official docs** (npm registry JSON, nodejs.org, Docker Hub/MCR APIs, MDN, maintainer READMEs), which is why version rows carry HIGH confidence despite the coarse seam mapping; secondary-source claims are downgraded explicitly in the table. All six research digests were cached via `research-store` with seam-provided tiers.*

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

1. **TypeScript 7 ecosystem maturity (medium risk).** TS 7.0.2 is the native Go compiler; the *language* is unchanged (verified), but tooling integrations (`tsx`, `drizzle-kit`, `@vitejs/plugin-react`, editor tooling) against the 7.x compiler API are **UNVERIFIED**. Mitigation: pin exact versions + commit the lockfile in phase 1; if anything breaks, `typescript` can fall back to the 6.x/5.x line without touching product code (exact fallback version **UNVERIFIED**). TS 7.1 is rumored for Nov 2026 (MEDIUM confidence — secondary source) — do not chase it mid-project.
2. **Node 24 → 26 LTS flip (date risk, low).** Node 24 enters maintenance **2026-10-20** and Node 26 becomes Active LTS **2026-10-28**. Pin `24.21.0` now (reproducible builds), and schedule a single re-pin to Node 26 after that date for support runway to 2029-04-30.
3. **`@fastify/multipart` ↔ Fastify 5 mapping UNVERIFIED** (its README ships no compat table). Smoke-test multipart upload at the first `apps/api` execution; fallback is base64-in-JSON upload (contract change → consultation trigger).
4. **esbuild cannot code-split the IIFE build** (`splitting` is ESM-only). The ≤25 KB annotator chunk must be a **second entry** loaded via script-tag injection in the IIFE flavor and `import()` in the ESM flavor. The `check:size` gate must measure both flavors' chunks. This is the single most likely R-01 budget surprise.
5. **WebP encode support is browser-dependent and the fallback is silent (R-11).** Detection is one async sniff at startup (`blob.type`), and Playwright webkit must cover the PNG path in e2e. Do not trust filename/MIME heuristics.
6. **Capture UX and coverage (Q-06 stays open).** `getDisplayMedia` shows a picker on **every** capture, requires a secure context and transient user activation — insecure-context hosts (http:// intranets) get **no capture**. Decide the degraded behavior (report without screenshot vs. D-08 adapter as fallback) during phase planning.
7. **`preferCurrentTab` support in Firefox/Safari: UNVERIFIED.** Design the picker copy so a full "share this tab" chooser is acceptable UX.
8. **`ImageCapture` is not the portable path** (Firefox flag-only per BCD) — track→video→canvas is the default; `grabFrame` is Chromium/Safari-18.4+ only. Don't build the primary path on it.
9. **Rate-limit store is per-process.** Correct for the single-node compose target; document that horizontal scaling later requires the `store`/`redis` option (adds a service → new consultation trigger).
10. **SameSite=Lax cookie requires the nginx `/api` proxy** (same-origin). If a deployment splits origins, cookie auth breaks silently — document this as a hard deployment constraint (SEC-06).
11. **Q-02 (console-log payload caps) and Q-03/Q-04 remain open** and belong to the contracts schema + API phases, not the stack. Ensure `packages/contracts` reserves fields/limits for them so CA-01's "official schema" doesn't churn.
12. **PG 18 vs R-15's "PostgreSQL 16"** — this document pins 18.6 (R-15 deferred exact versions to research). Log one-line amendment in `documentation/resolution-record.md` so the number "16" doesn't resurface; `17.11`/`16.15` remain drop-in fallbacks.

## Sources

First-party (all fetched 2026-10-05):

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

Secondary (corrorobative only):

- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ — TS 7 native Go compiler
- https://typescriptdocs.com/release-notes/TypeScript%207.0 — "language unchanged vs 6.0"
- https://dev.to/harshit_katheria/ask-canvas-for-a-webp-in-safari-and-you-silently-get-a-png-5hn6 — Safari WebP-encode gap (MEDIUM)
- https://zod.dev/json-schema#ztojsonschema — Zod 4 JSON Schema docs (cited by maintainer)
- Project context: `.planning/PROJECT.md`, `documentation/resolution-record.md` (R-01…R-17, D-01…D-08), `documentation/mission-brief.md`, `documentation/mentorship-pack.md`
