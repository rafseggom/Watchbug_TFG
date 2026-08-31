# Phase 2: Backend API - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Incidents captured by the SDK are securely ingested via `POST /api/incidents` with a public `PROJECT_KEY`, persisted in PostgreSQL (incidents JSONB+BYTEA, users, projects), and retrievable with authenticated, paginated, filterable access (`GET /api/incidents`, `PATCH /api/incidents/:id/status`). Authenticated admin access is gated by JWT in HttpOnly cookies. Scope is strictly backend API + persistence + auth + security hardening — Panel SPA (Phase 3) and Docker orchestration (Phase 4) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Auth & Session Transport
- **D-01:** JWT delivered via `HttpOnly` cookie only (not Authorization header) — `Set-Cookie: HttpOnly, Secure, SameSite=Lax` — JS cannot read token, protecting against XSS theft. Panel uses `credentials: 'include'` for subsequent requests. — **Reversibility:** costly — Switching to header auth requires Panel fetch rewrite and CORS credential changes
- **D-02:** Token lifetime: 1-hour access token + 7-day refresh token (second HttpOnly cookie). Access token carries `jti`, `sub` (user id), `exp`. Refresh flow via `POST /api/auth/refresh`. Per SEC-06 Short TTL requirement — chosen as middle ground between OWASP 15min strictness and 24h simplicity. — **Reversibility:** reversible
- **D-03:** Admin user is a seeded DB row in `users` table, created/updated on startup from `.env` values `ADMIN_EMAIL` + `ADMIN_PASSWORD` (bcrypt hashed per AUTH-02). No open registration endpoint; DB-02 users table is canonical source. Allows future multi-user without schema change. — **Reversibility:** one-way — Seeded-user pattern determines auth data source; switching to env-only check would leave users table unused and require migration
- **D-04:** Logout = `POST /api/auth/logout` clears both cookies via `Set-Cookie: Max-Age=0` (access + refresh). No server-side denylist/blacklist. JWT remains cryptographically valid until 1h expiry but browser stops sending it. — **Reversibility:** reversible

### Incident Ingest Contract
- **D-05:** `POST /api/incidents` is public — requires valid `X-Project-Key` (or `X-Watchbug-Key`) header matched against `projects.api_key` (DB-03). No JWT required on this endpoint. All other `/api/incidents/*` (GET, PATCH) require valid JWT cookie and return 401 otherwise — satisfies both Success Criterion 1 (SDK can POST) and 5 (unauth to incident retrieval = 401). — **Reversibility:** one-way — Changing ingest to JWT-only would break every deployed SDK (`credentials: 'omit'` + public key contract from Phase 1 TRN-01/SEC-04)
- **D-06:** Validation errors return HTTP 422 with Pydantic field-level detail `{detail: [{loc: [\"body\", \"consoleLogs\"], msg, type}]}`. Applies to TRN-04/CA-01 rule: `consoleLogs` required when `type: \"Bug\"`, optional when `type: \"Feedback\"`. FastAPI default behavior kept — no custom error envelope. — **Reversibility:** reversible
- **D-07:** On success, `POST /api/incidents` returns `201 Created` with `{id: uuid, status: \"Pending\", created_at: iso8601}`. SDK's transport sender shows success toast on any 2xx; returning id enables future trace/de-duplication and satisfies integration test assertions. — **Reversibility:** reversible
- **D-08:** Missing or invalid project key → `401 {detail: \"invalid project key\"}`. Payload exceeding `SEC-04` 100KB limit → `413 Payload Too Large` before schema validation. Explicit split enables distinct SDK retry behavior and rate-limit accounting per key. — **Reversibility:** reversible

### Storage & Retrieval Shape
- **D-09:** Pagination for `GET /api/incidents` uses `?page=1&size=20` query params returning `{items: [...], total, page, size, pages}`. Default `page=1, size=20`, max `size=100`. Total needed for Panel (Phase 3) table pagination per API-03. — **Reversibility:** costly — Changing to cursor pagination requires Panel query and backend count query rewrites
- **D-10:** Filtering via query params: `?type=Bug&status=Pending` (comma-separated for multiples, e.g. `status=Pending,InProgress`). Combination of type (Bug/Feedback) and status (Pending/In Progress/Resolved) with pagination. Cacheable/bookmarkable per REST, aligns with PAN-04 filter bar needs. — **Reversibility:** reversible
- **D-11:** Storage per DB-01/DB-03 spec: `incidents` table `(id UUID PK, type ENUM('Bug','Feedback'), status ENUM('Pending','In Progress','Resolved'), payload JSONB, screenshot BYTEA, project_id FK, created_at, updated_at)`; `users` `(id, email unique, password_hash, created_at)`; `projects` `(id, name, api_key unique public write-only, created_at)`. Screenshot stored as BYTEA (Base64 decoded) — no filesystem/MinIO in v1; STR-01 deferred to v2. Payload JSONB holds sanitized metadata+consoleLogs. — **Reversibility:** one-way — BYTEA vs text vs object-storage choice determines DB schema and Docker volume layout; changing requires data migration
- **D-12:** Status transition via `PATCH /api/incidents/:id/status` with body `{status: \"Resolved\"}` allows Any → Any among the three states (no state-machine enforcement for v1). Returns `200 {id, status}`. Simplifies Panel dropdown without workflow friction per API-04. — **Reversibility:** reversible

### Security Boundaries
- **D-13:** CORS: admin/panel origins are an explicit allowlist from `.env` `CORS_ORIGINS` (comma-separated exact matches, reject `null` origin, no wildcard) per SEC-01. `POST /api/incidents` ingest is intentionally open to any Origin (but still requires valid PROJECT_KEY + rate limiting) — otherwise SDK breaks on arbitrary customer domains. `credentials: true` only for admin routes. — **Reversibility:** reversible
- **D-14:** Rate limiting via `slowapi` in-memory (no Redis per self-hosted constraint): `POST /api/incidents` → `10/minute per IP` + `30/minute per PROJECT_KEY`; `GET/PATCH /api/incidents*` (authenticated) → `60/minute per IP`. Exceeding returns `429 {detail: \"rate limit exceeded\", retry_after}` with `Retry-After` header. — **Reversibility:** reversible
- **D-15:** XSS sanitization per SEC-03/PAN-07: sanitize before storage — strip/escape HTML tags, `<script>`, event handlers (`onerror=`, `onload=`) from all user-controlled fields (consoleLogs, user notes/title) using a server-side HTML escaper before writing to JSONB. Panel additionally renders escaped text (no raw HTML/v-html). Double defense but primary gate is at ingest. — **Reversibility:** reversible
- **D-16:** Health check `GET /api/health` is public, returns `{status: \"ok\", db: \"connected\"|\"disconnected\"}` with DB connectivity check (per API-05). FastAPI auto-docs `/docs`/`/openapi.json` are gated: enabled only when `.env DOCS_ENABLED=true` (dev) and protected behind JWT in production. — **Reversibility:** reversible

### Agent's Discretion
- Exact cookie names (`watchbug_access`, `watchbug_refresh`) — agent chooses clear namespaced names
- Pydantic Settings field naming and `.env` parsing details (case sensitivity, prefix `WATCHBUG_`) — agent follows pydantic-settings conventions
- Alembic migration file naming and auto-generate workflow — agent standard practice
- Slowapi key function implementation (X-Forwarded-For fallback for reverse proxy) — agent handles per STACK patterns
- Screenshot Base64 decode error handling detail (400 vs 422) — agent decides appropriate validation error code
- JWT `HS256` vs `RS256` algorithm choice — agent picks HS256 for single-instance self-hosted simplicity (PyJWT default)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` — Phase 2 definition, goal, success criteria (5 items), dependencies, requirement ID lists (API-01..05, AUTH-01..04, DB-01..04, SEC-01..05)
- `.planning/REQUIREMENTS.md` — Full definitions for API-01..05, AUTH-01..04, DB-01..04, SEC-01..05, SEC-04 100KB limit, and traceability matrix
- `.planning/PROJECT.md` — Core value, self-hosted single docker-compose constraint, i18n/security constraints

### Security & Architecture
- `documentation/mission-brief.md` — Non-goals declaration, autonomy envelope, RFC/RNFs RF-05..RF-08/RNF-02, acceptance criteria CA-01/CA-05
- `documentation/mentorship-pack.md` — Invariants: SEC-01..SEC-06 (CORS, rate limiting, XSS, no host credentials, JWT HttpOnly/SameSite/Secure, bcrypt), INV-03 self-hosted agnostic infra

### Stack & Research
- `.planning/research/STACK.md` — Locked stack: FastAPI 0.141.x + Pydantic v2 + SQLAlchemy 2.0 async/asyncpg + Alembic 1.14+ + PyJWT 2.9+ + bcrypt 4.2+ + slowapi 0.1.9+ + pydantic-settings 2.x + uv + Docker 27.x, plus Alternatives Considered and What NOT to Use (python-jose CVEs)
- `.planning/research/FEATURES.md` — Feature domain decomposition for Watchbug
- `.planning/research/ARCHITECTURE.md` — System architecture and integration points
- `.planning/phases/01-sdk-core/01-RESEARCH.md` — Phase 1 research: payload schema, transport contract (TRN-01/04), interval batching, ingest endpoint expectations
- `.planning/phases/01-sdk-core/01-CONTEXT.md` — Phase 1 locked decisions D-01..D-17, payload type distinction Bug/Feedback, credentials:omit, consent API

### Project Context
- `.planning/phases/01-sdk-core/01-VERIFICATION.md` — Phase 1 verification PASS evidence (5/5 plans, bundle size 8.85KB)
- `documentation/ase-instructions.md` — C-B-D-C control framework
- `documentation/continuity-pack.md` — Continuity across sessions (currently empty)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No backend code yet — greenfield FastAPI service. Phase 1 delivered SDK client only (Rollup IIFE 8.85KB, Shadow DOM, Canvas editor, transport sender) — no backend assets to reuse, but transport layer in Phase 1 defines the exact payload schema Phase 2 must accept (`sdk/src/transport/sender.ts` payload shape: type, screenshot Base64 PNG, metadata, consoleLogs).
- Existing project scaffolding: `sdk/` is sibling to future `backend/` — backend should be sibling directory `backend/` (per ARCHITECTURE.md) with `pyproject.toml`, `alembic.ini`, `Dockerfile`.

### Established Patterns
- TypeScript + Rollup + Vitest + Playwright established for SDK; backend establishes new Python patterns: FastAPI lifespan context manager (not deprecated on_event), Pydantic `field_validator`/`ConfigDict` (not deprecated @validator), SQLAlchemy 2.0 async `AsyncSession` with `Depends(get_db)`.
- Pydantic Settings from `.env` with `.env.example` committed (SEC-05) — established in mentorship pack, no code yet but convention locked.

### Integration Points
- SDK Transport → `POST /api/incidents` with `credentials: 'omit'` + `X-Project-Key` header: Phase 2 must accept exactly this contract (see D-05) else Phase 1 SDK breaks.
- Admin Panel (Phase 3) → `GET /api/incidents?page&size&type&status` + `PATCH /api/incidents/:id/status` with JWT cookie: pagination/filter contract in D-09/D-10 is load-bearing for Panel table.
- Docker Deployment (Phase 4) → `backend/` + `PostgreSQL 16-alpine` must be composable via single `docker-compose.yml` with named volume; decisions here (BYTEA, Alembic, in-memory rate limiting) keep compose simple (no Redis/MinIO yet).

</code>

<specifics>
## Specific Ideas

- 1-hour access token chosen explicitly (not 15min default) to reduce refresh frequency for self-hosted single-admin flow while keeping short TTL per SEC-06.
- `page/size+total` pagination chosen over cursor because admin panel expects total count for table footer ("Page 1 of N") — consistent with PAN-03.
- Seeded admin user from `.env` avoids open registration attack surface; startup hook should be idempotent (insert if not exists, update password hash if ADMIN_PASSWORD changed).
- CORS split (allowlist for admin, open for ingest) is critical — user emphasized SDK must work on any customer domain without pre-registration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. All suggested scope beyond Phase 2 (webhooks, email notifications NTF-01/02, MinIO STR-01, error grouping INT-01/02, breadcrumbs BRD-01/02) remain tracked in REQUIREMENTS.md v2 Requirements and are correctly deferred to future phases.

</deferred>

---

*Phase: 2-Backend API*
*Context gathered: 2026-08-31*
