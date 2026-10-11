# Walking Skeleton — Watchbug SDK

**Phase:** 1 — Contracts & Ingest Slice
**Generated:** 2026-10-11
**Delivered by:** `01-01-PLAN.md` Task 2 (`type="tracer"`)

## Capability Proven End-to-End

> A developer starts the self-hosted three-service stack with one `docker compose up` and pushes a synthetic report — image + metadata — across the wire into hardened, schema-validated storage that lands as a PostgreSQL row with its image on the `api`-only filesystem volume and renders in a minimal two-column panel page.

**User story (phase goal, MVP framing):**
**As a** self-hosting developer, **I want to** start the Watchbug stack and push a report (image + metadata) across the wire into hardened, schema-validated storage that renders in a minimal panel, **so that** the ingest spine is proven end-to-end on my own infrastructure and neither the report nor its screenshot ever leaves it.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo | npm workspaces: `packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel` (root `package.json` + `tsconfig.base.json`) | R-15 TypeScript end-to-end; the single official schema (CA-01) is structurally true, not a convention |
| Contract | `packages/contracts` (Zod 4.6.5) → `z.toJSONSchema(reportSchema, { target: 'draft-2020-12' })` emits committed `schema/report.schema.json` | CA-01 single source of truth; SDK imports types-only so Zod never ships to the browser (R-01) |
| Constant set | `packages/contracts/src/constants.ts` — plain TS, zero Zod import: A-06 layered caps + R-13 masking constants | R-18 DRY: client clamps stay UX-only; server caps are the control |
| API | Fastify 5.12.5 on Node `24.21.0-alpine3.24`; `@fastify/multipart` 10.1.2, `@fastify/helmet` 13.1.1, `@fastify/cors` 11.3.0, `@fastify/rate-limit` 11.2.0 | Verified pins (A-09); plugin stack is the HTTP-edge seam |
| Data layer | PostgreSQL `18.6-alpine3.24` + Drizzle 0.45.3 (`drizzle-kit` 0.31.11 generated, committed migrations) + `pg` 8.23.1 | Only Drizzle emits reviewable SQL migrations — the migration consultation trigger wants artifacts |
| Storage | Filesystem volume mounted **only** in `api`; server-generated UUIDv4 keys `projectId/<xx>/<uuid>.<ext>`; tmp→fsync→rename; DB-lookup-only serve | R-04/C-4: the request never names a file — the traversal hole is unexpressible |
| Image hardening | `hardenImage()` plain module seam in the ordered ingest chain (sniff → structure → dim guard → harden → store); zero-dep structural strip/rebuild backend ships first, `sharp` re-encode is consultation-gated (P1-D-10) | R-02 fixes exactly 8 ports — this is a plain module; P1-D-10 mandates a harden stage before disk write, heavy deps need owner sign-off |
| Auth | None in Phase 1 — write-only `wkbt_` project key seeded idempotently from `.env` (P1-D-01/02/03); real auth (Argon2id + JWT) lands Phase 5 | Phase scope; the blob route ships hardened but makes **no auth claim** (DEP-03 completes Phase 5) |
| Deployment target | `docker-compose.yml` — exactly three services `api`, `panel`, `db` (INV-03); `panel` nginx `1.30.5-alpine3.24` reverse-proxies `/api/` → `api:3000` (A-10); published ports bound to `127.0.0.1` | Same-origin is required for Phase-5 `SameSite=Lax` cookies; localhost binding is the Phase-1 exposure posture (Open Q5) |
| Directory layout | Workspaces as above; API internals `src/{app,config,ports}.ts`, `src/routes/`, `src/ingest/`, `src/storage/`, `src/db/`, `src/boot/`; panel `src/{App,api,i18n}.ts(x)`, `src/components/`, `src/tokens.css` | Matches `01-PATTERNS.md` file map (the greenfield conventions contract) |
| Verification | R-12: ONE Playwright 1.63.0 suite (`npm run verify`, CA-01…CA-05 on chromium + firefox + webkit) + build gates `npm run check:size` (RNF-01/A-12) and `npm run check:compose` (C-4) | Owner policy stated twice: **no unit tests, no coverage thresholds** |
| Masking contract | `MASK_ALPHA_OPAQUE = 255`, `MASK_PIXELATION_MIN_BLOCK_PX = 8` land in `constants.ts` now (R-13/A-01) | The masking primitive decision lands as a contract before any client code exists |
| i18n | Hand-rolled `en`/`es` dictionaries, `navigator.language` auto-detect, panel `localStorage` selector (P1-D-05) | RNF-03; zero deps — the panel is one screen |

## Stack Touched in Phase 1

- [x] Project scaffold (npm workspaces, tsconfigs, esbuild/Vite builds, Biome lint hook, gates)
- [x] Routing — real HTTP routes: `GET /api/health`, `POST /api/incidents`, `GET /api/incidents`, `GET /api/incidents/:id/image`, `GET /api/setup`
- [x] Database — real writes (`INSERT incidents … ON CONFLICT DO NOTHING`) and reads (list + blob-row lookup) in PostgreSQL
- [x] UI — report list → detail interaction wired to the API through the nginx same-origin proxy
- [x] Deployment — documented full-stack run: `cp .env.example .env && npm run key:gen && docker compose up -d`

## Out of Scope (Deferred to Later Slices)

- Widget/SDK behavior (script tag, capture, auto-redaction) — Phase 2. The `packages/sdk` shell exists only for build wiring and the `check:size` lanes.
- Report composer, capture fallback chain, annotation editor — Phase 3.
- Console ring buffer + env/host enrichment (ENR-01/02) — Phase 4. CA-01's console-conditional clause is completed there; the schema is closed today with the fields this phase ingests.
- Admin auth, project CRUD, key rotation, authenticated blob serving (DEP-03) — Phase 5.
- Triage actions, comments, TTL purge jobs (`purge_runs`) — Phase 6. TTL **columns** exist from the first migration (M-1/A-02).
- Idempotent durability queue (ING-02), Lighthouse proof, backup/restore — Phase 7.
- JPEG in the image allowlist (revisit with `ManualFileCapture`), DOM-serialize capture adapter (v2, A-08).

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: an end user opens the widget on a hostile host page, captures the tab with sensitive data destructively masked, and files the first real report.
- Phase 3: the end user composes a report and annotates the capture with irreversible masking before sending.
- Phase 4: the report payload carries console logs, environment and host context with secrets scrubbed.
- Phase 5: the developer logs in securely and manages projects and keys; blobs become authenticated.
- Phase 6: the developer triages reports and retention TTLs purge identity and artifacts.
- Phase 7: reports survive unload and flaky networks exactly once, and the release gate passes on a clean `docker compose up`.
