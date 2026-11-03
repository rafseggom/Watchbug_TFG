
> **Superseded by R-19 (2026-10-29):** this document predates the six-type test taxonomy.
> Every "no unit tests / never unit tests / DONT MAKE A BUNCH OF TESTS / no other test
> artefact" statement in it is a **historical record of R-12 as it stood then** — not current
> policy. Current policy lives in `AGENTS.md` → *Testing & QA* and `.planning/REQUIREMENTS.md`
> (R-19 amends R-12; artifact-level security evidence and the no-coverage-vanity rule survive).

# Phase 1: Contracts & Ingest Slice - Pattern Map

**Mapped:** 2026-10-11
**Files analyzed:** 27 (all new — greenfield)
**Analogs found:** 0 / 27 — **the repository contains zero application source code.** Every file below is `none — greenfield`.

> **Greenfield mode.** There is no `packages/`, `apps/`, or script source in the repo today (only `AGENTS.md`, `documentation/`, `.planning/`, `.github/`, `.vscode/`, `sonar-project.properties`). This file therefore serves as the **pattern contract**: for each file-to-be-created it names the role, the data-flow position, and the *binding pattern source* (durable project records + the already-researched implementation patterns) the creator must copy from. Pattern sources of truth:
>
> | Source | What it binds |
> |---|---|
> | `AGENTS.md` | Invariants INV-01..03, SEC-01..06, RNF-01, R-13, **R-12 (e2e + size gate ONLY, no unit tests)**, R-15, consultation triggers |
> | `documentation/resolution-record.md` | R-01..R-18 + A-01..A-12 (A-06 constant set, A-10 nginx `/api` proxy, A-12/M-2 multi-artifact `check:size`) — §5 governs on conflict |
> | `.planning/research/STACK.md` | Verified pins (Node 24.21.0-alpine, Fastify 5.12.5, @fastify/multipart 10.1.2, @fastify/rate-limit 11.2.0, drizzle-orm 0.45.3 / drizzle-kit 0.31.11, pg 8.23.1, zod 4.6.5, sanitize-html 2.18.0, React 19.3.0, Vite 8.3.2, esbuild 0.28.2, @playwright/test 1.63.0, postgres 18.6) + the binding **"What NOT To Use"** list |
> | `01-RESEARCH.md` | Patterns 1–9, code examples, pitfalls 1–9 (line refs below point here) |
> | `01-CONTEXT.md` | Locked decisions P1-D-01..P1-D-12 |

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `package.json` (root, npm workspaces) | config | build | none — greenfield | none |
| `tsconfig.base.json` + per-workspace `tsconfig.json` | config | build | none — greenfield | none |
| `docker-compose.yml` | config | deployment | none — greenfield | none |
| `.env.example` | config | deployment | none — greenfield | none |
| `scripts/check-size.mjs` | utility (build gate) | file-I/O / build | none — greenfield | none |
| `scripts/check-compose.mjs` | utility (build gate) | file-I/O / build | none — greenfield | none |
| `playwright.config.ts` | config (test harness) | test orchestration | none — greenfield | none |
| `e2e/verify.spec.ts` (+ CA group specs) | test | request-response (e2e) | none — greenfield | none |
| `e2e/fixtures/*` (valid + hostile) | test fixture | static data | none — greenfield | none |
| `packages/contracts/src/constants.ts` | model (constants) | transform (single source) | none — greenfield | none |
| `packages/contracts/src/schema.ts` | model (validation schema) | transform | none — greenfield | none |
| `packages/contracts/src/types.ts` | model (types) | transform | none — greenfield | none |
| `packages/contracts/scripts/emit-schema.mjs` | utility (build) | file-I/O | none — greenfield | none |
| `schema/report.schema.json` | config (published artifact) | generated output | none — greenfield | none |
| `packages/sdk/` shell + build wiring | config (shell only) | build | none — greenfield | none |
| `apps/api/src/app.ts` | controller (composition root) | request-response | none — greenfield | none |
| `apps/api/src/ports.ts` | model (seam interfaces) | contract | none — greenfield | none |
| `apps/api/src/routes/incidents.ts` | controller (route) | request-response (multipart CRUD) | none — greenfield | none |
| `apps/api/src/ingest/*` (caps, sniff, guard, harden, sanitize) | utility (pipeline stages) | transform | none — greenfield | none |
| `apps/api/src/storage/fs-storage.ts` | service (adapter) | file-I/O | none — greenfield | none |
| `apps/api/src/db/schema.ts` | model (DB schema) | CRUD | none — greenfield | none |
| `apps/api/src/db/migrations/*` (drizzle-kit, committed) | migration | DB DDL | none — greenfield | none |
| `apps/api/src/boot/seed.ts` (idempotent project-key seed) | service (boot) | CRUD | none — greenfield | none |
| `apps/api/src/plugins/*` (rate-limit, cors, helmet, multipart) | middleware | request-response | none — greenfield | none |
| `apps/panel/src/{main.tsx,App.tsx}` | component (shell) | request-response | none — greenfield | none |
| `apps/panel/src/components/*` (list, detail, empty state) | component | request-response | none — greenfield | none |
| `apps/panel/src/{api.ts,i18n.ts,tokens.css}` | service / utility / config | request-response / static | none — greenfield | none |

## Pattern Assignments

> Every assignment below is **"no analog — copy from the research pattern named"**. Line numbers refer to `01-RESEARCH.md` unless another source is quoted.

### `packages/contracts/src/constants.ts` (model/constants, transform)

**Analog:** none — greenfield. **Pattern source:** RESEARCH Pattern 1 (lines 261–306), A-06 in `documentation/resolution-record.md`.

**Core pattern** (RESEARCH 284–300) — plain TS, **zero Zod import** (SDK-safe, R-18 DRY):
```typescript
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
```
Also include the console-entry caps (100 entries drop-oldest / 2,048 msg / 1,024 arg / depth 3 / stack 8,192) and text caps (user.name 120, user.email 254, user.id 64, URL 2,048, Enricher 512) from the full table (RESEARCH 266–279). Note the deliberate two-tier image numbers: 4 MB parser guard vs 2 MB semantic cap (RESEARCH 281).

### `packages/contracts/src/schema.ts` + `src/types.ts` (model/validation)

**Analog:** none — greenfield. **Pattern source:** RESEARCH Pattern 1 + Standard Stack (Zod 4.6.5, `z.toJSONSchema` native).

- Zod 4 schema imports `constants.ts` for every `maxLength`/size bound — constants are never duplicated in the schema.
- `types.ts` exports TS types only; the SDK consumes them via `import type` so Zod never ships to the client (R-01/STACK).
- Response error shape is part of the contract: structured `401/400/413/429` bodies (see routes below).

### `packages/contracts/scripts/emit-schema.mjs` + `schema/report.schema.json` (utility/build + published artifact)

**Analog:** none — greenfield. **Pattern source:** RESEARCH 302–305 [CITED: zod.dev/json-schema#ztojsonschema]:
```javascript
// import { reportSchema } from '../src/schema.js';
// const json = z.toJSONSchema(reportSchema, { target: 'draft-2020-12' });
// writeFileSync('schema/report.schema.json', JSON.stringify(json, null, 2));
```
`schema/report.schema.json` is **generated and committed** (reviewable contract artifact). Never hand-write it (RESEARCH Don't Hand-Roll, line 404) and never add `zod-to-json-schema` (deprecated, STACK "What NOT To Use").

### `apps/api/src/app.ts` (controller/composition root)

**Analog:** none — greenfield. **Pattern source:** RESEARCH Standard Stack + Code Example "Ingest route skeleton" (469–494).

- One composition root per process: register `@fastify/helmet` 13.1.1, `@fastify/cors` 11.3.0 (env allowlist), `@fastify/rate-limit` 11.2.0 (`global: false`), `@fastify/multipart` 10.1.2 with explicit `limits`, then wire `routes/incidents.ts`.
- Boot order: env fail-fast (P1-D-02) → DB connect → idempotent project seed (P1-D-01) → listen. Missing/placeholder `WATCHBUG_PROJECT_KEY` → exit with an exact `.env` message (DEP-02).
- `trustProxy` set **explicitly and documented** (Pitfall 5, lines 439–442) — never `true` blindly.

**Multipart registration** (RESEARCH 472–482):
```typescript
fastify.register(import('@fastify/multipart'), {
  limits: {
    files: 1,
    fileSize: MAX_IMAGE_PART_BYTES,   // 4 MB — parser guard (constants.ts)
    fields: 8,
    fieldSize: 4096,
    headerPairs: 1024,
    parts: 16,
  },
  throwFileSizeLimit: true,           // throws RequestFileTooLargeError at limits.fileSize
});
```

### `apps/api/src/routes/incidents.ts` (controller/route, request-response)

**Analog:** none — greenfield. **Pattern source:** RESEARCH Patterns 5, 6, 9 + Code Examples (469–523).

**Route shape:** `POST /api/incidents` (ingest), `GET /api/incidents` (list), `GET /api/incidents/:id/image` (blob). Ordered ingest chain (RESEARCH Summary — the binding pipeline order):
`Content-Length gate → rate limits → CORS → multipart limits → Zod validate (contracts) → key check → magic-byte + structural image check → decode-bomb guard → re-encode → Storage.put (tmp→fsync→rename) → idempotent INSERT → replay-safe response`.

**Handler skeleton** (RESEARCH 484–493):
```typescript
fastify.post('/api/incidents', {
  preHandler: [contentLengthGate, ingestRateLimit, corsAllowlist],
  config: { bodyLimit: MAX_BODY_BYTES },  // NOTE: does NOT bound multipart — layer 1 does
}, async (req, reply) => {
  const data = await req.file();          // stream mode — never toBuffer() before guards
  // data.file (stream), data.fields (meta JSON string), data.filename (metadata only — never a path)
  await pipeline(data.file, tmpWriteStream);  // stream to /volume/tmp/<uuid>.part with byte counter
  if (data.file.truncated) throw new fastify.multipartErrors.RequestFileTooLargeError();
  // … then: Zod validate meta → key check → sniff/structure/dims → harden → Storage.put → idempotent insert
});
```

**Idempotency** (RESEARCH 331–346) — `UNIQUE (project_id, idempotency_key)`, duplicates replay the stored response; missing `Idempotency-Key` header → `400`:
```typescript
const inserted = await db.insert(incidents)
  .values({ projectId, idempotencyKey, ...row })
  .onConflictDoNothing({ target: [incidents.projectId, incidents.idempotencyKey] })
  .returning({ id: incidents.id });
if (inserted.length === 0) {
  const existing = await db.query.incidents.findFirst({ /* projectId + idempotencyKey */ });
  await storage.delete(newKey);            // discard the blob we just wrote (Pattern 3 order)
  return reply.code(200).send({ id: existing.id, replayed: true });
}
return reply.code(201).send({ id: inserted[0].id });
```

**Hardened blob response** (RESEARCH 510–523) — DB-lookup-only key resolution, `Content-Type` from a server allowlist, invalid/unknown id → **404, never 400** (Pattern 9, line 383):
```typescript
const MIME_BY_EXT = { webp: 'image/webp', png: 'image/png' } as const;
reply
  .header('Content-Type', MIME_BY_EXT[ext])
  .header('X-Content-Type-Options', 'nosniff')
  .header('Content-Disposition', 'attachment; filename="screenshot.' + ext + '"')  // fixed ASCII name
  .header('Content-Security-Policy', "default-src 'none'; sandbox")
  .header('Cross-Origin-Resource-Policy', 'same-origin')
  .header('Cache-Control', 'private, max-age=3600')
  .send(stream);
```
No auth claim in this phase (deferred to Phase 5) — record the exposure in the PR.

### `apps/api/src/ingest/*` (utility/pipeline stages, transform)

**Analog:** none — greenfield. **Pattern source:** RESEARCH Pattern 2 (308–315), Code Example 496–508, Pitfalls 1–4.

- `caps.ts` — `Content-Length` pre-read → 413 + streaming byte counter that destroys the stream past `MAX_BODY_BYTES`. **`bodyLimit` does not bound multipart** (Pitfall 1, 416–420); the composite is the only aggregate control.
- `sniff.ts` — magic bytes only, never declared MIME (RESEARCH 500–507):
```typescript
const PNG_SIG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
function sniffImage(b: Buffer): 'png' | 'webp' | null {
  if (b.subarray(0, 8).equals(Buffer.from(PNG_SIG))) return 'png';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;   // SVG/HTML/GIF/anything else → reject (P1-D-11: PNG+WebP only, SVG unconditional)
}
```
- `structure.ts` — PNG chunk allowlist `IHDR/PLTE/IDAT/IEND` (drop `tEXt/eXIf/zTXt/iTXt/tIME`); WebP RIFF allowlist `VP8X?/VP8|VP8L/ALPH?`, reject `ANIM/ANMF`, drop `EXIF/XMP/ICCP`, reject trailing data past declared File Size.
- `guard.ts` — decode-bomb guard from headers **before any decode**: PNG IHDR w/h (bytes 16–23 BE) or VP8X canvas (24-bit LE) → reject `w*h > MAX_IMAGE_PIXELS` (16 MP) or `w/h > MAX_IMAGE_DIM` (8192).
- `harden.ts` — **re-encode interface** `hardenImage(bytes) → { bytes, ext, w, h }` as a **plain module** (R-02 fixes exactly 8 seams — this is not a port). P1-D-10 is consultation-gated (heavy dep like `sharp` requires owner sign-off); implement the zero-dep structural strip/rebuild (PNG chunk re-emit + RIFF re-assembly) as the automatic fallback so the phase never blocks. Same format in → same format out (P1-D-12).
- `sanitize.ts` — `sanitize-html` 2.18.0 with **empty allowlist** (RESEARCH 373–376):
```typescript
import sanitizeHtml from 'sanitize-html';
const toPlainText = (s: string) => sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} });
```

### `apps/api/src/storage/fs-storage.ts` (service/adapter, file-I/O)

**Analog:** none — greenfield. **Pattern source:** RESEARCH Pattern 3 (317–321) [VERIFIED: `.planning/research/ARCHITECTURE.md:101-121, 330-350`].

Port shape (`apps/api/src/ports.ts`) — `put(bytes, ext)`, `stream(key)`, `delete(key)`; key grammar `^<projectId>/[a-f0-9]{2}/[0-9a-f-]{36}\.(webp|png)$`. Keys are **server-generated** (`crypto.randomUUID()`) — a `put()` taking a client name would express the path-traversal hole R-04 forbids.
- Layout: `/volume/blobs/<projectId>/<uuid[0:2]>/<uuid>.<ext>`, write via `/volume/tmp/<uuid>.<part>` → `fsync` → `rename()`.
- Belt-and-braces: `path.resolve(VOLUME, key)` + `assert(resolved.startsWith(path.resolve(VOLUME) + path.sep))`.
- **Write/insert order:** `Storage.put` **then** `INSERT … ON CONFLICT DO NOTHING`; on idempotency conflict delete the just-written blob and replay the stored response (orphan blobs are swept by the later purge reconciliation).

### `apps/api/src/db/schema.ts` + migrations + `apps/api/src/boot/seed.ts` (model/migration/service)

**Analog:** none — greenfield. **Pattern source:** RESEARCH Pattern 4 (323–326).

- Drizzle 0.45.3 schema; migrations generated by `drizzle-kit generate` into `apps/api/drizzle/`, **committed and reviewable**. ⚠ A DB migration is a consultation trigger — get the shape right now.
- Tables: `projects(id, name, public_key)` and `incidents` with `UNIQUE (project_id, idempotency_key)`, `storage_key`, `content_type` (`'image/webp' | 'image/png'`), `type` (`'bug' | 'feedback'`), `status` (seed `'pending'`), `created_at`, **TTL columns from day one**: separable nullable `user_id/user_name/user_email`, `identity_purge_at`, `artifact_purge_at` (`timestamptz`, computed at insert from `WATCHBUG_TTL_IDENTITY_DAYS` / `WATCHBUG_TTL_ARTIFACT_DAYS`) — M-1/A-02.
- Seed (P1-D-01/02/03): boot-time `INSERT … ON CONFLICT DO NOTHING` from `WATCHBUG_PROJECT_KEY`; key format `wkbt_` + 32 base62 chars from `crypto.randomBytes` with **rejection sampling** (naive `byte % 62` is modulo-biased).

### `apps/api/src/plugins/*` (middleware, request-response)

**Analog:** none — greenfield. **Pattern source:** RESEARCH Pattern 6 (348–367), Pitfalls 5 + 9.

**Layered rate limiting** (ING-05) — in-memory store (no Redis: INV-03), `429 + Retry-After` (RESEARCH 353–366):
```typescript
await fastify.register(import('@fastify/rate-limit'), { global: false, keyGenerator: (req) => req.ip });
const byIp  = fastify.createRateLimit({ max: RATE_LIMIT_PER_IP_PER_MIN,  timeWindow: '1 minute', keyGenerator: (req) => req.ip });
const byKey = fastify.createRateLimit({ max: RATE_LIMIT_PER_KEY_PER_MIN, timeWindow: '1 minute', keyGenerator: (req) => String(req.headers['x-project-key'] ?? '') });
const byDay = fastify.createRateLimit({ max: RATE_LIMIT_PER_PROJECT_PER_DAY, timeWindow: '1 day', keyGenerator: (req) => String(req.headers['x-project-key'] ?? '') });
```
**CORS allowlist** (ING-08, Pitfall 9): enforce `WATCHBUG_CORS_ORIGINS` **only when an `Origin` header is present** (`Origin: https://evil.com` → 403); accept header-less clients (the onboarding `curl` of P1-D-07 must work).

### `apps/panel/src/*` (components + service + config, request-response)

**Analog:** none — greenfield. **Pattern source:** `01-CONTEXT.md` P1-D-04..07, RESEARCH Pattern 7 (369–376).

- **Two-column list + detail layout from day one** (P1-D-04) — Fases 5/6 extend it, no redesign.
- **CSS tokens with `prefers-color-scheme` light/dark from day one** (P1-D-06) — no hardcoded colors.
- **i18n:** hand-rolled `en`/`es` dictionaries, auto-detect `navigator.language` (`es*` → es), manual selector persisted in panel `localStorage` (P1-D-05; panel localStorage does not touch SEC-03).
- **Empty state = onboarding** (P1-D-07): copy-paste `curl` snippet pre-filled with the instance's real project key.
- **Rendering rule (SEC-05 pass 2):** every report field renders as a React text node only. **`dangerouslySetInnerHTML` count must be zero** (RESEARCH Anti-Pattern 393). Console lines: text only, never linkified.
- `api.ts` — plain `fetch` against `/api/...` (same-origin through the nginx proxy, A-10). No router/state/data libraries (STACK rejection list).
- Reads go through `GET /api/incidents` and `GET /api/incidents/:id/image`; the write-only project key never gates reads.

### Root tooling: `package.json`, `tsconfig*`, `docker-compose.yml`, `.env.example`, `scripts/*`, `playwright.config.ts`, `e2e/*`

**Analog:** none — greenfield. **Pattern source:** INV-03/SEC-04/A-10/A-12/C-4/R-12, RESEARCH Patterns 8 + Validation Architecture (604–645).

- **`package.json`** — npm workspaces root (`packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel`); scripts: `build`, `check:size`, `check:compose`, `verify`, `lint`, `dev` (`tsx watch apps/api`). Node image `node:24.21.0-alpine3.24`; TS 7.0.2 with the documented 6.x fallback — fold the **TS tooling smoke test** (drizzle-kit generate, tsx watch, vite build) into the first scaffolding commit (Pitfall 8, 454–458; P1-D-09).
- **`docker-compose.yml`** — **exactly three services** `api`, `panel`, `db` (INV-03); images `node:24.21.0-alpine3.24` / `nginx:1.30.5-alpine3.24` / `postgres:18.6-alpine3.24`; the attachments volume mounts **only** in `api` (C-4); nginx reverse-proxies `/api/` → `api:3000` (A-10 — without it `SameSite=Lax` cookie auth is broken by design in Phase 5).
- **`.env.example`** — every server setting documented (DEP-02/SEC-04): DB URL, `WATCHBUG_PROJECT_KEY`, `WATCHBUG_CORS_ORIGINS`, TTLs, rate-limit knobs, volume path. Zero secrets in code; env via Node `--env-file` (no `dotenv`).
- **`scripts/check-size.mjs`** — node:zlib `gzipSync`, zero deps; lanes core ≤ 45 KB gz / lazy editor ≤ 25 KB / optional adapter ≤ 14 KB / total ≤ 80 KB, with the **worst-case 45+25+14 = 84 KB > 80 KB printed visibly** (A-12/M-2) and a per-entrypoint delta on every run (RESEARCH 525–533):
```javascript
import { gzipSync } from 'node:zlib';
// lanes: core 45 KB gz (hard) · lazy editor 25 KB gz · optional adapter 14 KB · runtime total 80 KB
// scenario 'worst-case-all-lanes': 45 + 25 + 14 = 84 KB → PRINT AS VISIBLE > 80 KB (not hidden, not waived)
const kb = (buf) => (gzipSync(buf).length / 1024).toFixed(1);
```
- **`scripts/check-compose.mjs`** — fail if `panel` lists the attachments volume (C-4).
- **`playwright.config.ts`** — `@playwright/test` 1.63.0, projects chromium + firefox + **webkit** (webkit exercises the WebP→PNG silent fallback from Phase 2; harmless now).
- **`e2e/verify.spec.ts` (+ CA groups)** — **the only test artefact** (R-12: no unit tests, no coverage). Structure maps 1:1 to CA-01…CA-05 groups; Phase 1 fills the ingest/contract assertions (~12–15 of the suite's ≈20): DEP-01..02, ENR-06, ING-01, ING-03..08 (requirement→test map at RESEARCH 617–631). Assertions live at the artifact level (e.g. stored row validates against `schema/report.schema.json`).
- **`e2e/fixtures/`** — valid PNG + WebP **and the hostile set from day one** (Pitfall 3, 430): SVG (must-reject), polyglot GIF/HTML, traversal-style filenames, XSS strings (`"><img src=x onerror=alert(1)>`, `javascript:alert(1)`, UTF-7/UTF-16 BOM), and a small file declaring a huge canvas (decode bomb).
- **`packages/sdk/` shell** — directory + esbuild wiring (two `build()` calls: IIFE + ESM) + the `check:size` lane only. **Zero behavior** until Phase 2; zero runtime dependencies (R-01).

## Shared Patterns

### Verification policy (R-12) — applies to EVERY file
**Source:** `AGENTS.md` ("DONT MAKE A BUNCH OF TESTS. Only make e2e as necessary, not unit tests")
No unit-test framework, no per-function tests, no coverage thresholds. Behavior verification = `npm run verify` (one Playwright suite) + build gates `npm run check:size` / `npm run check:compose`. Gates are scripts, not tests. Never add a test "because the code is pure".

### Constants single source (R-18 DRY) — applies to contracts, api, panel, sdk
**Source:** RESEARCH Pattern 1. Every cap/size/count/TTL lives once in `packages/contracts/src/constants.ts`; the Zod schema, the API edge enforcement and the panel clamps all import it. Client clamps are UX-only; server caps are the control.

### Error/response shape — applies to all API routes
Structured JSON errors with a `statusCode` field (`401` invalid/missing project key, `400` contract/validation failure, `413` size caps, `429 + Retry-After` rate limits, `404` for unknown blob id — never `400` on the blob route). Map `fastify.multipartErrors.RequestFileTooLargeError` (carries `statusCode`) to 413 and unlink partial tmp files.

### Validation order — applies to ingest chain
Cheap guards first, codecs last: length caps → rate limits → CORS → multipart limits → Zod → key → magic bytes → structure → dims → harden → store. Never buffer (`toBuffer()`) before the guards; never let a codec see input the cheap guards would reject (Pitfalls 1–4).

### Randomness & identity — applies to keys, ids, blob names
`crypto.randomUUID()` / `crypto.randomBytes` with rejection sampling for base62. Never `Math.random`. Client-supplied filenames are metadata only, never paths.

### Secrets & config — applies to api, compose, e2e
Zero secrets in code (SEC-04): `.env` + committed `.env.example`; Node `--env-file`, no `dotenv`. Fail loud on missing/placeholder config (P1-D-02).

## No Analog Found

All 27 files — the repository has no application source code. Planner must use the pattern sources above (`AGENTS.md`, `documentation/resolution-record.md`, `.planning/research/STACK.md`, `01-RESEARCH.md` Patterns 1–9 + Code Examples) as the binding templates.

| File group | Role | Data Flow | Reason |
|---|---|---|---|
| Root tooling (package.json, tsconfig*, compose, .env.example, scripts/, playwright.config.ts, e2e/) | config / utility / test | build, deployment, file-I/O, e2e | Greenfield — no source exists |
| `packages/contracts` (constants, schema, types, emit) | model / utility | transform | Greenfield |
| `packages/sdk` shell | config | build | Greenfield |
| `apps/api` (app, ports, routes, ingest, storage, db, seed, plugins) | controller / service / model / middleware / migration | request-response, file-I/O, CRUD, transform | Greenfield |
| `apps/panel` (shell, components, api, i18n, tokens) | component / service / config | request-response | Greenfield |

## Metadata

**Analog search scope:** whole repository (`E:\Proyectos Github\Watchbug_TFG`) — verified greenfield: no `packages/`, `apps/`, `src/`, or script source exists; only `AGENTS.md`, `documentation/`, `.planning/`, `.github/`, `.vscode/`, `sonar-project.properties`.
**Files scanned:** 0 source files (none exist); 4 governing documents consulted (`AGENTS.md`, `01-CONTEXT.md`, `01-RESEARCH.md`, `.planning/research/STACK.md` embedded in project context).
**Pattern extraction date:** 2026-10-11
