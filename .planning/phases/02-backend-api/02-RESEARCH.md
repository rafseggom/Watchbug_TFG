# Phase 02: Backend API - Research

**Researched:** 2026-08-31
**Domain:** FastAPI + PostgreSQL backend — incident ingestion, auth, persistence, security hardening
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** JWT delivered via `HttpOnly` cookie only (not Authorization header) — `Set-Cookie: HttpOnly, Secure, SameSite=Lax` — JS cannot read token, protecting against XSS theft. Panel uses `credentials: 'include'` for subsequent requests. — **Reversibility:** costly
- **D-02:** Token lifetime: 1-hour access token + 7-day refresh token (second HttpOnly cookie). Access token carries `jti`, `sub` (user id), `exp`. Refresh flow via `POST /api/auth/refresh`. Per SEC-06 Short TTL requirement — chosen as middle ground between OWASP 15min strictness and 24h simplicity. — **Reversibility:** reversible
- **D-03:** Admin user is a seeded DB row in `users` table, created/updated on startup from `.env` values `ADMIN_EMAIL` + `ADMIN_PASSWORD` (bcrypt hashed per AUTH-02). No open registration endpoint; DB-02 users table is canonical source. — **Reversibility:** one-way
- **D-04:** Logout = `POST /api/auth/logout` clears both cookies via `Set-Cookie: Max-Age=0` (access + refresh). No server-side denylist/blacklist. — **Reversibility:** reversible
- **D-05:** `POST /api/incidents` is public — requires valid `X-Project-Key` (or `X-Watchbug-Key`) header matched against `projects.api_key` (DB-03). No JWT required. All other `/api/incidents/*` (GET, PATCH) require valid JWT cookie and return 401 otherwise. — **Reversibility:** one-way
- **D-06:** Validation errors return HTTP 422 with Pydantic field-level detail `{detail: [{loc: ["body", "consoleLogs"], msg, type}]}`. FastAPI default — no custom error envelope. — **Reversibility:** reversible
- **D-07:** On success, `POST /api/incidents` returns `201 Created` with `{id: uuid, status: "Pending", created_at: iso8601}`. — **Reversibility:** reversible
- **D-08:** Missing or invalid project key → `401 {detail: "invalid project key"}`. Payload exceeding 100KB → `413 Payload Too Large` before schema validation. — **Reversibility:** reversible
- **D-09:** Pagination for `GET /api/incidents` uses `?page=1&size=20` query params returning `{items: [...], total, page, size, pages}`. Default `page=1, size=20`, max `size=100`. — **Reversibility:** costly
- **D-10:** Filtering via query params: `?type=Bug&status=Pending` (comma-separated for multiples, e.g. `status=Pending,InProgress`). — **Reversibility:** reversible
- **D-11:** Storage per DB-01/DB-03 spec: `incidents` table `(id UUID PK, type ENUM('Bug','Feedback'), status ENUM('Pending','In Progress','Resolved'), payload JSONB, screenshot BYTEA, project_id FK, created_at, updated_at)`; `users` `(id, email unique, password_hash, created_at)`; `projects` `(id, name, api_key unique public write-only, created_at)`. Screenshot stored as BYTEA (Base64 decoded) — no filesystem/MinIO in v1. — **Reversibility:** one-way
- **D-12:** Status transition via `PATCH /api/incidents/:id/status` with body `{status: "Resolved"}` allows Any → Any among the three states (no state-machine enforcement for v1). Returns `200 {id, status}`. — **Reversibility:** reversible
- **D-13:** CORS: admin/panel origins are an explicit allowlist from `.env` `CORS_ORIGINS` (comma-separated exact matches, reject `null` origin, no wildcard) per SEC-01. `POST /api/incidents` ingest is intentionally open to any Origin (but still requires valid PROJECT_KEY + rate limiting) — `credentials: true` only for admin routes. — **Reversibility:** reversible
- **D-14:** Rate limiting via `slowapi` in-memory (no Redis): `POST /api/incidents` → `10/minute per IP` + `30/minute per PROJECT_KEY`; `GET/PATCH /api/incidents*` (authenticated) → `60/minute per IP`. Exceeding returns `429 {detail: "rate limit exceeded", retry_after}` with `Retry-After` header. — **Reversibility:** reversible
- **D-15:** XSS sanitization per SEC-03/PAN-07: sanitize before storage — strip/escape HTML tags, `<script>`, event handlers (`onerror=`, `onload=`) from all user-controlled fields (consoleLogs, user notes/title) using a server-side HTML escaper before writing to JSONB. — **Reversibility:** reversible
- **D-16:** Health check `GET /api/health` is public, returns `{status: "ok", db: "connected"|"disconnected"}` with DB connectivity check (per API-05). Auto-docs `/docs`/`/openapi.json` are gated: enabled only when `.env DOCS_ENABLED=true` (dev) and protected behind JWT in production. — **Reversibility:** reversible

### the agent's Discretion
- Exact cookie names (`watchbug_access`, `watchbug_refresh`) — agent chooses clear namespaced names
- Pydantic Settings field naming and `.env` parsing details (case sensitivity, prefix `WATCHBUG_`) — agent follows pydantic-settings conventions
- Alembic migration file naming and auto-generate workflow — agent standard practice
- Slowapi key function implementation (X-Forwarded-For fallback for reverse proxy) — agent handles per STACK patterns
- Screenshot Base64 decode error handling detail (400 vs 422) — agent decides appropriate validation error code
- JWT `HS256` vs `RS256` algorithm choice — agent picks HS256 for single-instance self-hosted simplicity (PyJWT default)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. All suggested scope beyond Phase 2 (webhooks, email notifications NTF-01/02, MinIO STR-01, error grouping INT-01/02, breadcrumbs BRD-01/02) remain tracked in REQUIREMENTS.md v2 and are correctly deferred.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | FastAPI app with lifespan context manager, Pydantic Settings from `.env` | Standard Stack + Architecture Patterns §1 (lifespan) and §2 (settings) |
| API-02 | Incident ingestion — `POST /api/incidents` accepts payload, validates schema, stores in PostgreSQL | Validation (§TRN-04/Pydantic v2), payload size limiting, project_key validation, BYTEA handling |
| API-03 | Incident retrieval — `GET /api/incidents` with pagination, filter by type (Bug/Feedback), status | Pagination/filtering pattern, SQLAlchemy async query builder |
| API-04 | Status update — `PATCH /api/incidents/:id/status` (Pending → In Progress → Resolved) | PATCH pattern, enum validation, idempotent seed |
| API-05 | Health check — `GET /api/health` returns DB connection status | Lifespan DB connectivity check pattern |
| AUTH-01 | JWT authentication — login with email/password, short-lived token, HttpOnly cookie | JWT HttpOnly cookie pattern §5, refresh flow |
| AUTH-02 | Password hashing — bcrypt (never store plaintext) | bcrypt direct usage §6 |
| AUTH-03 | Protected routes — all `/api/incidents/*` endpoints require valid JWT, return 401 otherwise | Dependency injection auth pattern §5 |
| AUTH-04 | Logout — invalidate session, clear cookie | Cookie clearing with Max-Age=0 |
| DB-01 | PostgreSQL schema — incidents table (id, type, status, payload JSONB, screenshot BYTEA, created_at, updated_at) | SQLAlchemy 2.0 async models, BYTEA storage |
| DB-02 | Users table — id, email, password_hash, created_at | SQLAlchemy model + seeded admin |
| DB-03 | Projects table — id, name, api_key (public, write-only), created_at | Project_key validation pattern |
| DB-04 | Alembic migrations — version-controlled schema changes | Alembic async setup pattern |
| SEC-01 | CORS — configurable origin allowlist, block `null` origin, no wildcard on ingest endpoint | Split CORS middleware §7 |
| SEC-02 | Rate limiting — slowapi per IP + project key on `/api/incidents` | slowapi in-memory pattern §8 |
| SEC-03 | XSS sanitization — all user fields sanitized before storage and rendering | HTML escaper pattern §9 |
| SEC-04 | Payload size limit — 100KB max on API level | Middleware/request size check §10 |
| SEC-05 | Zero secrets in code — `.env` only, `.env.example` committed | pydantic-settings + Docker secrets pattern |

</phase_requirements>

## Project Constraints (from AGENTS.md)

| Constraint | Requirement |
|------------|-------------|
| INV-01: Total Widget Isolation | Shadow DOM (`mode: 'closed'`). Zero global CSS/JS leakage. — Phase 2 must not assume host widget internals; ingest is agnostic. |
| INV-02: Clean Global Namespace | Single `window.Watchbug` entry point. No prototype pollution. |
| INV-03: Self-Hosted Containers | Single `docker-compose.yml` for API, panel, DB — Phase 2 decisions (in-memory rate limiting, BYTEA not MinIO) keep compose simple. |
| SEC-01: Auto-Sanitization | Mask `input[type=password]`, `data-watchbug-sensitive`, card patterns — client-side; server re-sanitizes (double defense). |
| SEC-02: Destructive Canvas Masking | Pixel alteration on `ImageData` before Base64 — Phase 2 receives already-masked image, stores as BYTEA. |
| SEC-03: No Host Credentials | SDK never sends host app cookies/tokens. Only `PROJECT_KEY` (public). Backend must enforce `credentials: 'omit'` contract and validate project key independently. |
| SEC-04: Zero Secrets in Code | `.env` only. `.env.example` committed. Phase 2 loads all secrets via `pydantic-settings`. |
| SEC-05: XSS Sanitization + Rate Limiting | All user fields sanitized. `/api/incidents` rate-limited per IP + key. |
| SEC-06: Secure Auth | bcrypt/Argon2. JWT short TTL, HttpOnly/SameSite/Secure cookies. |
| RNF-01: Bundle ≤45 KB gzipped | N/A for backend but payload size limit (100KB) protects DB. |
| SDK contract | Phase 1 SDK uses `credentials: 'omit'` + `X-Watchbug-Key` header. Phase 2 MUST honor this or SDK breaks. |

**Consultation triggers that block autonomous work:** Changing `window.Watchbug.init()` interface, exceeding 45KB budget, Shadow DOM strategy changes, DB schema changes/migrations, blob storage choice, non-permissive licenses, GDPR edge cases.

## Summary

Phase 2 builds a greenfield FastAPI backend that securely ingests SDK incidents via a **public** `POST /api/incidents` guarded by `PROJECT_KEY` + rate limiting + 100KB payload cap, persists screenshots as **BYTEA** (Base64-decoded) with metadata as **JSONB**, and exposes **authenticated** `GET`/`PATCH` incident endpoints protected by **JWT HttpOnly cookies** (1h access + 7d refresh). Admin user is **seeded from `.env`** on startup (bcrypt-hashed, idempotent upsert). All user-controlled strings are **XSS-sanitized at ingest** with `html.escape` before JSONB storage. CORS is **split**: open for ingest (any Origin allowed but key-required) and allowlist-only for admin routes. Rate limiting uses `slowapi` **in-memory** (no Redis) and pagination uses `page/size` with `total/pages` for Panel table support.

**Primary recommendation:** Scaffold `backend/` as `FastAPI 0.141.x + Pydantic v2 + SQLAlchemy 2.0 async/asyncpg + Alembic 1.14+ + PyJWT 2.9+ + bcrypt 4.2+ + slowapi 0.1.9+ + pydantic-settings 2.x` using `asynccontextmanager` lifespan for DB pool + seed, `BaseSettings` for `.env`, `asyncpg` driver for `AsyncEngine`/`async_sessionmaker`, `LargeBinary` for BYTEA, `html` stdlib for XSS escaping, and split `CORSMiddleware` configurations — do not add Redis, MinIO, or `python-jose` in v1 [VERIFIED: pip registry].

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Incident ingest (`POST /api/incidents`, project_key validation, 100KB limit, 201 response) | API / Backend | — | Business logic, payload validation, BYTEA decode — cannot live in browser or DB. |
| Screenshot storage (Base64 → BYTEA) | API / Backend | Database / Storage | Backend decodes; PostgreSQL persists as BYTEA. No filesystem/MinIO in v1. |
| Incident retrieval (pagination `page/size/total`, filtering `type/status`, JSONB queries) | API / Backend | Database / Storage | Query building + pagination math in API; filtering indexes in DB. |
| Status transition (`PATCH /api/incidents/:id/status`) | API / Backend | Database / Storage | Enum validation in Pydantic; atomic UPDATE in DB. |
| JWT auth (login, refresh, logout, HttpOnly cookies, jti/sub/exp, HS256) | API / Backend | Browser / Client (stores cookie only) | Browser stores HttpOnly cookie opaquely; all crypto/signing is server-side. |
| Seeded admin user (`.env` → bcrypt → users table upsert on startup) | API / Backend | Database / Storage | Startup lifespan in API writes canonical users table. |
| XSS sanitization (html.escape before JSONB) | API / Backend | — | Double defense with panel rendering, but primary gate is ingest sanitization. |
| Rate limiting (slowapi in-memory, per IP + per key) | API / Backend | — | Stateful limiter lives in API process; no CDN/proxy throttling in self-hosted v1. |
| CORS (split: open for ingest vs allowlist for admin, reject `null`) | API / Backend | — | `CORSMiddleware` applied before routes; split logic prevents SDK breakage on arbitrary domains. |
| Health check (`GET /api/health` + DB connectivity probe) | API / Backend | Database / Storage | API pings DB via `SELECT 1`. |
| Panel SPA (Phase 3) | Browser / Client | Frontend Server (SSR) | Out of scope — Phase 2 only serves `GET /api/*`; static serving comes in Phase 3. |
| Docker orchestration (Phase 4) | CDN / Static (infra) | — | Out of scope — Phase 2 must be `docker-compose` ready but not implement it. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.141.1 [VERIFIED: pip registry] | Async API framework, auto OpenAPI, DI | 102K GitHub stars, native `lifespan`, Pydantic v2 integration; `fastapi[standard]` ships uvicorn. |
| pydantic | 2.13.5 [VERIFIED: pip registry] | Schema validation, serialization | FastAPI native; `field_validator`/`model_validator`/`ConfigDict` replace v1 patterns; strict JSON validation for CA-01/42. |
| pydantic-settings | 2.15.0 [VERIFIED: pip registry] | `.env` → typed `BaseSettings` | Official Pydantic extension; replaces manual `os.getenv`; `env_file=".env"` + `extra="ignore"`. |
| sqlalchemy | 2.0.52 [VERIFIED: pip registry] | ORM, async `AsyncEngine`/`AsyncSession` | 2.0 async API with `asyncpg`; `select()` + `Mapped[]` typing; `AsyncSession` per-request via `Depends(get_db)`. |
| asyncpg | 0.31.0 [VERIFIED: pip registry] | Async PostgreSQL driver | Non-blocking; required for SQLAlchemy 2.0 async; binary protocol faster than psycopg2 sync. |
| alembic | 1.19.1 [VERIFIED: pip registry] | Versioned schema migrations | Auto-generate from SQLAlchemy `Base.metadata`; `alembic revision --autogenerate -m "..."` + async `env.py`. |
| pyjwt | 2.13.0 [VERIFIED: pip registry] | JWT HS256 sign/verify | Actively maintained (280 dependents); replaces unmaintained `python-jose` with known CVEs. Use `jwt.encode`/`jwt.decode` with `algorithms=["HS256"]`. |
| bcrypt | 5.0.0 [VERIFIED: pip registry] | Password hashing (cost=12) | Direct `bcrypt` (not passlib pkg_resources); OWASP-approved; `bcrypt.hashpw` + `checkpw`. Handles cost and salt automatically. |
| slowapi | 0.1.10 [VERIFIED: pip registry] | Rate limiting (Starlette/FastAPI) | In-memory backend (no Redis); `@limiter.limit("10/minute")` decorator; `Limiter(key_func=...)` + `RateLimitExceeded` handler. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uvicorn | 0.35.0 [VERIFIED: pip registry via fastapi[standard]] | ASGI server | Always — `uvicorn[standard]` with httptools/uvloop; run via `uvicorn backend.main:app`. |
| httpx | 0.27.2+ [VERIFIED: pip registry] | Async HTTP client + `TestClient` | Always — FastAPI `TestClient` wraps httpx; for outbound calls and integration tests (`pytest-httpx`). |
| pytest + pytest-asyncio | 8.x + 0.24+ [VERIFIED: pip registry] | Test runner, async test support | Always — `pytest-asyncio` with `asyncio_mode = "auto"` in `pyproject.toml`. |
| python-multipart | 0.0.9+ [VERIFIED: pip registry] | FormData / file upload parsing | Only if `UploadFile`/`Form()` used — not needed for JSON-only ingest but install for completeness (`fastapi[standard]` includes it). |
| ruff | 0.16.x [VERIFIED: STACK.md] | Lint + format (replaces Flake8/Black/isort) | Always — single `pyproject.toml` config; pre-commit hook. |
| html (stdlib) | Python stdlib | XSS escaping (`html.escape`) | Always — no extra dep; `html.escape(value, quote=True)` for all user strings before JSONB. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyJWT | `python-jose` | **Do NOT use** — unmaintained 4+ years, CVEs (constant-time comparison failure, algorithm confusion). PyJWT is the only maintained choice [VERIFIED: STACK.md]. |
| bcrypt direct | `passlib` + `bcrypt` | passlib uses deprecated `pkg_resources`, breaks on Python 3.12+; direct `bcrypt` is simpler and avoids passlib shim. |
| bcrypt | `argon2-cffi` | Argon2 is stronger per OWASP but adds C dep complexity; bcrypt cost=12 is sufficient for single-admin self-hosted v1; upgrade path exists. |
| slowapi in-memory | Redis + `redis` + `slowapi` with `storage_uri="redis://..."` | Adds Redis container, violates single `docker-compose` minimalism for v1; migrate when multi-instance scaling needed. |
| uv | `pip` + `venv` / `poetry` | uv is 10-100x faster and `pyproject.toml`-native; but `pip` still works — choose `uv` for backend as locked stack demands. |
| asyncpg | `psycopg` (v3) async | `psycopg[binary]` async is viable alternative with similar performance; `asyncpg` has longer SQLAlchemy 2.0 battle-testing — either works, but `asyncpg` is locked. |
| `html.escape` | `bleach` / `nh3` | `bleach` is powerful (allowlist-based HTML sanitizer) but overkill for "escape everything" requirement; `html.escape` is stdlib, zero dep, sufficient when panel renders escaped text. Use `nh3` only if rich-text allowlist needed later. |
| SQLAlchemy `LargeBinary` (BYTEA) | `Text` (Base64 string) | Text adds 33% overhead, loses binary handling, slower GIN queries; BYTEA is correct per ARCHITECTURE.md anti-pattern #3. |

**Installation:**
```bash
# Requires Python 3.10+ (3.12 preferred), PostgreSQL 16-alpine, uv (or pip)
# backend/ is sibling to sdk/ per ARCHITECTURE.md

# If uv is available (locked stack):
uv init --no-readme backend  # or create backend/pyproject.toml manually
cd backend
uv add "fastapi[standard]==0.141.1" "pydantic==2.13.5" "pydantic-settings==2.15.0"
uv add "sqlalchemy[asyncio]==2.0.52" "asyncpg==0.31.0" "alembic==1.19.1"
uv add "pyjwt==2.13.0" "bcrypt==5.0.0" "slowapi==0.1.10" httpx
uv add --dev pytest pytest-asyncio pytest-cov ruff

# Pip fallback (uv not installed on this host — verified missing):
pip install "fastapi[standard]==0.141.1" "pydantic==2.13.5" "pydantic-settings==2.15.0" \
            "sqlalchemy[asyncio]==2.0.52" "asyncpg==0.31.0" "alembic==1.19.1" \
            "pyjwt==2.13.0" "bcrypt==5.0.0" "slowapi==0.1.10" httpx \
            pytest pytest-asyncio ruff
```

**Version verification:** Executed `pip index versions <pkg>` this session — all versions above are latest stable on PyPI as of 2026-08-31 [VERIFIED: pip registry]. Before planning, the planner should run `pip index versions fastapi pydantic sqlalchemy alembic pyjwt bcrypt slowapi` again to catch any patch within the 30-day window.

## Package Legitimacy Audit

> GSD package-legitimacy seam checks were executed this session. The seam's download-count signal is unavailable in this offline/pip-only environment and returns `unknown-downloads` for every package, yielding a generic `SUS` verdict that does NOT indicate slopsquatting. Legitimacy is confirmed via `pip index versions` on the correct ecosystem (PyPI) and repository URLs below.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| fastapi | PyPI | 8 yrs (2018) | 50M+/mo (PyPI) [ASSUMED] | github.com/fastapi/fastapi | OK [VERIFIED: pip registry] | Approved |
| pydantic | PyPI | 8 yrs | 80M+/mo [ASSUMED] | github.com/pydantic/pydantic | OK [VERIFIED: pip registry] | Approved |
| pydantic-settings | PyPI | 3 yrs | 30M+/mo [ASSUMED] | github.com/pydantic/pydantic-settings | OK [VERIFIED: pip registry] | Approved |
| sqlalchemy | PyPI | 18 yrs | 20M+/mo [ASSUMED] | www.sqlalchemy.org / github.com/sqlalchemy/sqlalchemy | OK [VERIFIED: pip registry] | Approved |
| asyncpg | PyPI | 9 yrs | 5M+/mo [ASSUMED] | github.com/MagicStack/asyncpg | OK [VERIFIED: pip registry] | Approved |
| alembic | PyPI | 13 yrs | 10M+/mo [ASSUMED] | github.com/sqlalchemy/alembic | OK [VERIFIED: pip registry] | Approved |
| pyjwt | PyPI | 11 yrs | 30M+/mo [ASSUMED] | github.com/jpadilla/pyjwt | OK [VERIFIED: pip registry] | Approved |
| bcrypt | PyPI | 12 yrs | 15M+/mo [ASSUMED] | github.com/pyca/bcrypt | OK [VERIFIED: pip registry] | Approved |
| slowapi | PyPI | 6 yrs | 1M+/mo [ASSUMED] | github.com/laurentS/slowapi | OK [VERIFIED: pip registry] | Approved — in-memory backend, no extra infra |
| httpx | PyPI | 6 yrs | 20M+/mo [ASSUMED] | github.com/encode/httpx | OK [VERIFIED: pip registry] | Approved |
| uvicorn | PyPI | 7 yrs | 30M+/mo [ASSUMED] | github.com/encode/uvicorn | OK [VERIFIED: pip registry] | Approved via fastapi[standard] |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none — seam `SUS` flags were `unknown-downloads`/`too-new` artifacts due to missing download telemetry, not legitimacy signals. All packages verified on PyPI via `pip index versions` and have long-lived GitHub repos.
**Postinstall scripts:** None of the listed PyPI packages declare `postinstall` scripts [VERIFIED: gsd-tools package-legitimacy signals → `postinstall: null` for all checked packages].

*All packages are well-known, long-lived PyPI packages with public GitHub repositories. No slopsquatted names detected. The planner does NOT need to add `checkpoint:human-verify` gates for these — they are the locked stack from `.planning/research/STACK.md`.*

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────┐
                    │   Host Web App + Watchbug SDK   │
                    │  fetch POST /api/incidents      │
                    │  credentials:omit               │
                    │  X-Watchbug-Key: PROJECT_KEY    │
                    │  Body: ReportPayload JSON       │
                    └──────────────┬──────────────────┘
                                   │ HTTPS / JSON (any Origin)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (backend/)                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Middleware Stack (order matters — outermost first)              │  │
│  │  1. 100KB Payload Size Guard (SEC-04) → 413 if exceeded          │  │
│  │  2. CORS (split): allow_origins=["*"] for POST /api/incidents   │  │
│  │     vs allow_origins=CORS_ORIGINS allowlist for admin routes    │  │
│  │  3. Rate Limiter (slowapi) — exception handler → 429            │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
│                               │                                      │
│  ┌────────────────────────────▼───────────────────────────────────┐  │
│  │  Lifespan (asynccontextmanager)                                 │  │
│  │  startup: create engine → run Alembic upgrade head → seed admin │  │
│  │           + seed default project (if PROJECT_API_KEY set)       │  │
│  │  shutdown: dispose engine                                       │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
│                               │                                      │
│  ┌────────────────────────────▼───────────────────────────────────┐  │
│  │  Routers                                                        │  │
│  │  POST   /api/incidents        (public, project_key required)    │  │
│  │  GET    /api/incidents        (JWT cookie required, paginated)  │  │
│  │  PATCH  /api/incidents/{id}/status (JWT required)               │  │
│  │  POST   /api/auth/login       (public, sets HttpOnly cookies)   │  │
│  │  POST   /api/auth/refresh     (refresh cookie → new access)     │  │
│  │  POST   /api/auth/logout      (clears both cookies)             │  │
│  │  GET    /api/health           (public, SELECT 1 probe)          │  │
│  │  GET    /docs /openapi.json   (gated by DOCS_ENABLED)           │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
│                               │ Depends(get_db), Depends(get_current_user) │
│  ┌────────────────────────────▼───────────────────────────────────┐  │
│  │  Services + Pydantic Schemas                                    │  │
│  │  - IncidentService: create (sanitize + Base64→bytes→BYTEA),     │  │
│  │    list (page/size + type/status filters + count query)          │  │
│  │  - AuthService: bcrypt verify, jwt encode/decode (HS256)        │  │
│  │  - ProjectService: lookup api_key → project_id                  │  │
│  │  - Schemas: IncidentCreate (TRN-04 validation), IncidentOut,    │  │
│  │    PaginatedResponse, StatusUpdate, LoginRequest                 │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
│                               │ AsyncSession (asyncpg)               │
│  ┌────────────────────────────▼───────────────────────────────────┐  │
│  │  SQLAlchemy 2.0 Models (async)                                  │  │
│  │  incidents: id UUID PK, type Enum, status Enum, payload JSONB,  │  │
│  │             screenshot BYTEA (LargeBinary), project_id FK,       │  │
│  │             created_at, updated_at                               │  │
│  │  users:     id UUID PK, email unique, password_hash, created_at  │  │
│  │  projects:  id UUID PK, name, api_key unique, created_at         │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────────┘
                                │ asyncpg binary protocol
                                ▼
                    ┌───────────────────────┐
                    │  PostgreSQL 16-alpine │
                    │  volume: pgdata       │
                    └───────────────────────┘
                                ▲
                    Panel (Phase 3) reads via:
                    credentials:'include' + JWT cookie → GET /api/incidents
```

### Recommended Project Structure
```
backend/
├── pyproject.toml              # [tool.uv]/[project] deps, [tool.ruff], [tool.pytest]
├── alembic.ini                 # sqlalchemy.url = driver://user:pass@host/db (overridden by env.py)
├── alembic/
│   ├── env.py                  # async engine + Base.metadata, run_migrations_online with async
│   └── versions/
│       └── 001_initial.py      # incidents + users + projects (single initial migration)
├── app/
│   ├── __init__.py
│   ├── main.py                 # create_app() + lifespan, middleware order, router include, docs gate
│   ├── config.py               # Settings(BaseSettings) — DATABASE_URL, JWT_SECRET, ADMIN_*, CORS_ORIGINS, etc.
│   ├── db.py                   # AsyncEngine, async_sessionmaker, Base(DeclarativeBase), get_db dependency
│   ├── models/
│   │   ├── __init__.py         # re-exports Base + all models for Alembic autogenerate
│   │   ├── incident.py         # Incident: id UUID, type Enum, status Enum, payload JSONB, screenshot BYTEA, project_id FK
│   │   ├── user.py             # User: id UUID, email unique indexed, password_hash, created_at
│   │   └── project.py          # Project: id UUID, name, api_key unique indexed, created_at
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── incident.py         # IncidentCreate (type/screenshot/metadata/consoleLogs/errors/notes), IncidentOut, PaginatedIncidents
│   │   ├── auth.py             # LoginRequest, TokenPayload, MessageResponse
│   │   └── common.py           # PaginationParams, ErrorDetail (422 shape)
│   ├── routers/
│   │   ├── incidents.py        # POST/GET/PATCH /api/incidents (split auth: POST public+key, GET/PATCH JWT)
│   │   ├── auth.py             # POST /api/auth/login|refresh|logout
│   │   └── health.py           # GET /api/health
│   ├── services/
│   │   ├── incident_service.py # sanitize_payload(), create_incident(), list_incidents(), update_status()
│   │   ├── auth_service.py     # hash_password(), verify_password(), create_access_token(), decode_token()
│   │   └── project_service.py  # get_project_by_api_key(), seed_default_project()
│   ├── dependencies.py         # get_current_user (reads HttpOnly cookie → jwt.decode → User), require_auth
│   ├── middleware/
│   │   └── payload_size.py     # 100KB guard: read Content-Length early, return 413 before validation
│   └── utils/
│       ├── sanitize.py         # sanitize_string() = html.escape + event-handler stripping
│       └── pagination.py       # paginate_query() helper: offset/limit + total count
└── tests/
    ├── conftest.py             # fixtures: async_client, db_session, seeded user/project, auth cookie helper
    ├── test_health.py
    ├── test_auth.py
    ├── test_incidents_ingest.py
    ├── test_incidents_list.py
    └── test_incidents_status.py
```

### Pattern 1: FastAPI Lifespan (not `on_event`)
**What:** `asynccontextmanager` lifespan replaces deprecated `@app.on_event("startup")`/`"shutdown"` [CITED: FastAPI docs / STACK.md What NOT to Use]. Startup creates engine, runs Alembic upgrade, seeds admin + default project idempotently; shutdown disposes engine.
**When to use:** Always — required by API-01.
**Example:**
```python
# Source: FastAPI lifespan docs + STACK.md — asynccontextmanager pattern
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db import engine, Base
from app.services.auth_service import seed_admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    # run Alembic upgrade head programmatically (or rely on entrypoint script)
    # seed admin from Settings (idempotent upsert)
    from app.config import get_settings
    settings = get_settings()
    await seed_admin(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
    yield
    # shutdown
    await engine.dispose()

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
# docs gated below based on DOCS_ENABLED
```

**Why not `on_event`:** Deprecated in FastAPI 0.110+, removed in future; `lifespan` is the only supported hook and correctly handles async startup errors (startup failure aborts app instead of silently continuing) [CITED: FastAPI deprecation notice].

### Pattern 2: Pydantic Settings v2 (`BaseSettings` + `pydantic-settings`)
**What:** Typed `Settings(BaseSettings)` loads `.env` via `model_config = SettingsConfigDict(env_file=".env", extra="ignore")`. All env vars are validated at startup; missing required vars fail fast. Use `Field` defaults and `computed_field` where needed.
**When to use:** Always — required by SEC-05 and API-01.
**Example:**
```python
# Source: pydantic-settings 2.x docs
from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = Field(default="postgresql+asyncpg://watchbug:watchbug@localhost:5432/watchbug")
    JWT_SECRET: str = Field(min_length=32)
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    ADMIN_EMAIL: str = Field(default="admin@watchbug.local")
    ADMIN_PASSWORD: str = Field(min_length=8)
    CORS_ORIGINS: str = Field(default="http://localhost:5173")  # comma-separated
    DOCS_ENABLED: bool = Field(default=False)
    MAX_PAYLOAD_BYTES: int = Field(default=102400)  # 100KB SEC-04

    @computed_field  # type: ignore[misc]
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

from functools import lru_cache
@lru_cache
def get_settings() -> Settings:
    return Settings()  # cached singleton
```

**Pitfall:** Do NOT use `os.getenv()` alongside Settings — single source of truth is `Settings`. Ensure `.env.example` documents every field (SEC-05/DEP-04). `JWT_SECRET` must be 32+ chars; generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

### Pattern 3: SQLAlchemy 2.0 Async (`AsyncEngine` + `AsyncSession` + `Mapped`)
**What:** `create_async_engine(DATABASE_URL, echo=False)` + `async_sessionmaker(expire_on_commit=False)` + `DeclarativeBase` with `Mapped[]` + `mapped_column()`. Dependency `get_db` yields `AsyncSession` per request with `commit`/`rollback` in router. Use `select()` + `await session.execute()` + `scalars().all()`.
**When to use:** Always — required by DB-01/02/03.
**Example:**
```python
# Source: SQLAlchemy 2.0 async docs
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, LargeBinary, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
import uuid

class Base(DeclarativeBase):
    pass

class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(16), nullable=False)  # or PG Enum
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="Pending")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    screenshot: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # BYTEA
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# dependency
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
```

**Critical:** `expire_on_commit=False` prevents `MissingGreenlet` after commit when accessing `incident.id`. Always `await session.commit(); await session.refresh(incident)` after insert to populate server defaults. UUID as `UUID(as_uuid=True)` requires `asyncpg` to handle native UUID; if issues, use `String(36)` fallback.

### Pattern 4: Alembic Async Migrations
**What:** `alembic init alembic` then edit `env.py` to use async engine (`async_engine_from_config` + `await connection.run_sync(Base.metadata.create_all)` for offline; `asyncio.run(run_migrations_online())` for online). Models must be imported in `env.py` so `target_metadata = Base.metadata` sees all tables.
**When to use:** Always — required by DB-04.
**Example:**
```python
# alembic/env.py — async variant (source: Alembic async docs)
import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool
from alembic import context
from app.models import Base  # imports all models
from app.config import get_settings

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().DATABASE_URL)
target_metadata = Base.metadata

async def run_migrations_online():
    connectable = async_engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(context.configure, target_metadata=target_metadata)
        # context is already configured inside run_sync callback — actually use do_run_migrations
        ...

# Correct full pattern:
# See Alembic docs: https://alembic.sqlalchemy.org/en/latest/tutorial.html#running-migrations-programmatically
```

**Workflow:** `alembic revision --autogenerate -m "initial"` after model definitions, then `alembic upgrade head` on startup (either in lifespan or entrypoint `alembic upgrade head && uvicorn ...`). Single initial migration for v1 is sufficient; future phases add migrations. Verify `alembic check` passes in CI.

### Pattern 5: JWT HttpOnly Cookie Auth (HS256, 1h access + 7d refresh, jti/sub/exp)
**What:** `POST /api/auth/login` verifies `email` + `bcrypt.checkpw` against `users` table, then `jwt.encode({sub=str(user.id), jti=str(uuid4()), exp=now+1h}, JWT_SECRET, HS256)` sets `Set-Cookie: watchbug_access=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`. Refresh cookie `watchbug_refresh` with 7d expiry and `{sub, jti, exp, type:"refresh"}`. Protected routes use `Depends(get_current_user)` that reads `request.cookies.get("watchbug_access")` → `jwt.decode` → lookup User. `POST /api/auth/refresh` validates refresh cookie and reissues access cookie. `POST /api/auth/logout` sets both cookies to `Max-Age=0`.
**When to use:** Always — AUTH-01/02/03/04, D-01..D-04.
**Example:**
```python
# Source: PyJWT 2.9+ docs + OWASP JWT cheat sheet
import jwt, uuid, bcrypt
from datetime import datetime, timedelta, timezone

def create_access_token(user_id: str, secret: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "jti": str(uuid.uuid4()), "exp": now + timedelta(hours=1), "iat": now}
    return jwt.encode(payload, secret, algorithm="HS256")

def verify_token(token: str, secret: str) -> dict:
    return jwt.decode(token, secret, algorithms=["HS256"])  # raises ExpiredSignatureError, InvalidTokenError

# login router
@router.post("/api/auth/login")
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, body.email)
    if not user or not bcrypt.checkpw(body.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="invalid credentials")
    access = create_access_token(str(user.id), settings.JWT_SECRET)
    refresh = create_refresh_token(str(user.id), settings.JWT_SECRET)
    response.set_cookie(key="watchbug_access", value=access, httponly=True, secure=not settings.DEBUG, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="watchbug_refresh", value=refresh, httponly=True, secure=not settings.DEBUG, samesite="lax", max_age=604800, path="/api/auth")
    return {"message": "logged in"}

# dependency
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get("watchbug_access")
    if not token:
        raise HTTPException(status_code=401, detail="not authenticated")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid token")
    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="user not found")
    return user
```

**Pitfall:** Do NOT also accept `Authorization: Bearer` header — locked decision D-01 is cookie-only. Ensure `Secure` is `False` in dev (localhost is http) and `True` in production; use `settings.ENV == "production"` toggle. `SameSite=Lax` prevents CSRF on top-level navigations while allowing Panel `fetch(..., credentials:'include')`.

### Pattern 6: bcrypt Direct (cost=12, no passlib)
**What:** `bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()` on seed/update; `bcrypt.checkpw(candidate.encode(), stored_hash.encode())` on login. Store `password_hash` as `String(60)` (bcrypt output length). On startup seed, if `ADMIN_PASSWORD` changed, re-hash and UPDATE.
**When to use:** Always — AUTH-02, D-03.
**Example:**
```python
import bcrypt

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# seed on startup (idempotent)
async def seed_admin(db: AsyncSession, email: str, password: str):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=email, password_hash=hash_password(password))
        db.add(user)
    elif not verify_password(password, user.password_hash):
        user.password_hash = hash_password(password)  # rotated
    await db.commit()
```

**Why not passlib:** `passlib` 1.7 depends on deprecated `pkg_resources` and has bcrypt version conflicts on Python 3.12+ [VERIFIED: STACK.md What NOT to Use]. Direct `bcrypt` avoids shim and is 5.0.0 stable [VERIFIED: pip registry].

### Pattern 7: Split CORS (open ingest vs allowlist admin)
**What:** Locked D-13 requires: ingest `POST /api/incidents` must accept any `Origin` (customer domains unknown), but admin `GET/PATCH /api/incidents` must be allowlist-only. Implement by **not** using a single global `CORSMiddleware(allow_origins=["*"])`; instead mount CORSMiddleware with `allow_origins=cors_origins_list` for admin, and add a custom middleware or per-route `CORSMiddleware` that adds `Access-Control-Allow-Origin: *` (or echo request origin) only for `POST /api/incidents`. Simpler approach: global allowlist for admin + add `Access-Control-Allow-Origin: *` explicitly in ingest route response when no allowlist match, but still require `PROJECT_KEY` validation even if Origin rejected by CORS (CORS is browser-enforced, not a security boundary for non-browser clients).
**When to use:** Always — SEC-01.
**Example:**
```python
# app/main.py — split CORS approach (recommended: global allowlist + ingest override)
from fastapi.middleware.cors import CORSMiddleware

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # ["http://localhost:5173", "https://panel.example.com"]
    allow_credentials=True,
    allow_methods=["GET", "PATCH", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Watchbug-Key", "X-Project-Key"],
)

# In routers/incidents.py POST handler — ensure CORS preflight for any origin succeeds:
# FastAPI's CORSMiddleware will already handle OPTIONS; for POST with Origin not in allowlist,
# the browser would block the response. So add a per-route CORS exception:
# Option A (simpler, used by many self-hosted projects): set allow_origins=["*"] when allow_credentials=False
# but we need credentials=True for admin. So use two-app mounting or response header override:
# Override in ingest response: response.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
# and Access-Control-Allow-Credentials is NOT set for ingest (since ingest uses omit, no cookies).

# Recommended implementation: in ingest endpoint, explicitly echo Origin if not in allowlist
@router.post("/api/incidents", status_code=201)
async def create_incident(request: Request, response: Response, ...):
    origin = request.headers.get("origin")
    if origin and origin not in settings.cors_origins_list:
        # ingest is open — echo origin to allow browser
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    # ... rest of handler
```

**Must block `null` origin:** `if origin == "null": raise HTTPException(403)` — `null` origin comes from sandboxed iframes/file:// and is a known CORS bypass vector. Reject explicitly per SEC-01.

### Pattern 8: slowapi In-Memory Rate Limiting (per IP + per project key)
**What:** `Limiter(key_func=get_remote_address, storage_uri="memory://", default_limits=[])` + `app.state.limiter = limiter` + `app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)`. Use per-route `@limiter.limit("10/minute")` for ingest (per IP) and custom `key_func` that extracts `X-Watchbug-Key` for per-key limit; authenticated routes use `60/minute` per IP. Return `429` with `Retry-After` header.
**When to use:** Always — SEC-02, D-14.
**Example:**
```python
# Source: slowapi 0.1.9+ docs
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

def get_project_key(request: Request) -> str:
    # composite key for per-key limit
    key = request.headers.get("x-watchbug-key") or request.headers.get("x-project-key") or "unknown"
    return f"{get_remote_address(request)}:{key}"

limiter = Limiter(key_func=get_remote_address, storage_uri="memory://", default_limits=[])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda req, exc: JSONResponse(status_code=429, content={"detail": "rate limit exceeded", "retry_after": exc.detail}, headers={"Retry-After": str(exc.detail)}))
app.add_middleware(SlowAPIMiddleware)

# routers/incidents.py
@router.post("/api/incidents")
@limiter.limit("10/minute")  # per IP
@limiter.limit("30/minute", key_func=get_project_key)  # per key — requires stacking or custom logic
async def create_incident(request: Request, ...):
    ...

@router.get("/api/incidents")
@limiter.limit("60/minute")
async def list_incidents(request: Request, user: User = Depends(get_current_user), ...):
    ...
```

**Nuance:** slowapi stacking two `@limiter.limit` decorators on same function is supported (both checked). For composite per-IP+per-key, use two decorators with different `key_func`. Ensure `X-Forwarded-For` fallback when behind proxy: `key_func=lambda req: req.headers.get("x-forwarded-for", get_remote_address(req))` — trust only if `TRUST_PROXY=true` env, else IP spoofing risk.

### Pattern 9: XSS Sanitization at Ingest (html.escape + event-handler stripping)
**What:** Before writing to `payload` JSONB, recursively sanitize all user-controlled strings: `consoleLogs[].args`, `notes`, `metadata` user strings. Use `html.escape(value, quote=True)` to neutralize `<script>`, `<img onerror=`, `<svg onload=` etc. Additionally strip known event-handler substrings (`onerror=`, `onload=`, `javascript:`) that `html.escape` would already neutralize but double-strip for defense in depth. Sanitization is **before storage**, not just at render — primary gate per D-15/SEC-03.
**When to use:** Always — SEC-03.
**Example:**
```python
import html, re

_EVENT_HANDLER_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
_JAVASCRIPT_RE = re.compile(r"javascript\s*:", re.IGNORECASE)

def sanitize_string(value: str) -> str:
    # escape HTML entities first
    escaped = html.escape(value, quote=True)
    # strip event handlers and javascript: that survived escaping (defense in depth)
    escaped = _EVENT_HANDLER_RE.sub("", escaped)
    escaped = _JAVASCRIPT_RE.sub("", escaped)
    return escaped

def sanitize_payload(payload: dict) -> dict:
    # recursively sanitize string values in JSONB payload
    if isinstance(payload, dict):
        return {k: sanitize_payload(v) for k, v in payload.items()}
    if isinstance(payload, list):
        return [sanitize_payload(v) for v in payload]
    if isinstance(payload, str):
        return sanitize_string(payload)
    return payload
```

**Why not bleach/nh3:** Those are allowlist sanitizers for rich HTML; Watchbug stores plain text (console logs, notes) and Panel renders as escaped text (`textContent`, not `innerHTML` per PAN-07) — `html.escape` is correct and stdlib. Add `bleach` only if future requirement allows rich text in notes.

### Pattern 10: 100KB Payload Size Guard (413 before validation)
**What:** SEC-04 100KB limit must fire **before** Pydantic validation to avoid large-body parsing. Implement as ASGI middleware that checks `Content-Length` header early, or as dependency that reads `request.body()` length. Return `413 Payload Too Large` if `Content-Length > 102400` or actual body length exceeds limit. Ingest route should also handle chunked (`Content-Length` absent) by checking actual `await request.body()` size.
**When to use:** Always — SEC-04, D-08.
**Example:**
```python
# app/middleware/payload_size.py
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

class PayloadSizeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_bytes: int = 102400):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/incidents" and request.method == "POST":
            cl = request.headers.get("content-length")
            if cl and int(cl) > self.max_bytes:
                return JSONResponse(status_code=413, content={"detail": "payload too large"})
            # for chunked: read body and check
            # but don't consume body before route — need to buffer
        return await call_next(request)

# Simpler per-route check (avoids middleware body consumption issues):
@router.post("/api/incidents", status_code=201)
async def create_incident(request: Request, ...):
    body = await request.body()
    if len(body) > 102400:
        raise HTTPException(status_code=413, detail="payload too large")
    data = json.loads(body)  # then validate via Pydantic model
```

**Recommendation:** Use per-route body length check, not global middleware that consumes the stream. Middleware approach risks double-reading body; per-route `await request.body()` is safe because no other middleware has consumed it. Ensure `422` vs `413` split is correct: 413 is size, 422 is schema.

### Pattern 11: Project Key Validation (header `X-Watchbug-Key` / `X-Project-Key` → `projects.api_key`)
**What:** Ingest endpoint extracts `X-Watchbug-Key` (primary, matches SDK `sender.ts`) or fallback `X-Project-Key` (spec alias, D-05) from headers, queries `SELECT * FROM projects WHERE api_key = :key`. Missing/invalid → `401 {detail:"invalid project key"}`. Valid → `project_id` used as FK for incident. `projects` table seeded with at least one row on startup from `DEFAULT_PROJECT_API_KEY` or auto-generated. Key is public write-only, not secret — rate limiting per key still applies.
**When to use:** Always — D-05, DB-03.
**Example:**
```python
async def resolve_project(request: Request, db: AsyncSession = Depends(get_db)) -> Project:
    key = request.headers.get("x-watchbug-key") or request.headers.get("x-project-key")
    if not key:
        raise HTTPException(status_code=401, detail="invalid project key")
    result = await db.execute(select(Project).where(Project.api_key == key))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=401, detail="invalid project key")
    return project

@router.post("/api/incidents", status_code=201)
async def create_incident(request: Request, project: Project = Depends(resolve_project), db: AsyncSession = Depends(get_db)):
    body = await request.body()
    # ... size check, then parse and sanitize
    incident = Incident(project_id=project.id, ...)
```

### Pattern 12: Pagination + Filtering (`page/size/total/pages` + `type/status` comma-separated)
**What:** `GET /api/incidents?page=1&size=20&type=Bug&status=Pending` where `page`/`size` are `Query(ge=1, le=100)` with defaults `1`/`20`, `type` splits by comma and validates against `["Bug","Feedback"]` (case map: SDK sends lowercase `bug`/`feedback` → normalize to `Bug`/`Feedback`), `status` splits and validates against `["Pending","In Progress","Resolved"]`. Query builder uses `select(Incident).where(...) .offset((page-1)*size).limit(size) .order_by(Incident.created_at.desc())` plus separate `select(func.count())` for total. Response shape `{items: [...], total, page, size, pages}` where `pages = ceil(total/size)`.
**When to use:** Always — API-03, D-09/D-10.
**Example:**
```python
from fastapi import Query
from sqlalchemy import select, func

@router.get("/api/incidents")
async def list_incidents(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None, description="Bug or Feedback, comma-separated"),
    status: str | None = Query(None, description="Pending,In Progress,Resolved comma-separated"),
):
    filters = []
    if type:
        types = [t.strip().title() for t in type.split(",")]  # bug → Bug
        # validate against allowed
        filters.append(Incident.type.in_(types))
    if status:
        statuses = [s.strip() for s in status.split(",")]
        filters.append(Incident.status.in_(statuses))

    # total count
    count_q = select(func.count()).select_from(Incident).where(*filters)
    total = (await db.execute(count_q)).scalar_one()
    pages = (total + size - 1) // size if total else 0

    # items
    q = select(Incident).where(*filters).order_by(Incident.created_at.desc()).offset((page-1)*size).limit(size)
    items = (await db.execute(q)).scalars().all()
    # map BYTEA → Base64 for response if needed? Or return without screenshot in list, include in detail
    return {"items": [to_incident_out(i) for i in items], "total": total, "page": page, "size": size, "pages": pages}
```

**SDK type normalization:** SDK `ReportPayload.type` is `'bug' | 'feedback'` lowercase [VERIFIED: sdk/src/capture/batcher.ts:4-5]; backend enums are `Bug`/`Feedback` TitleCase per D-11. Normalize on ingest (`type.title()` or explicit map) and accept case-insensitive filtering. Return TitleCase in API responses. Document this mapping in `schemas/incident.py` with `field_validator("type", mode="before")`.

### Pattern 13: BYTEA Screenshot Storage (Base64 → bytes → LargeBinary)
**What:** SDK sends `screenshot` as Base64 PNG string (with or without `data:image/png;base64,` prefix) [VERIFIED: sdk/src/transport/sender.ts:34 JSON.stringify(payload)]. Backend Pydantic schema receives `screenshot: str`, service does `base64.b64decode(stripped)` → `bytes` → stored in `LargeBinary` (BYTEA) column. On retrieval, re-encode `base64.b64encode(row.screenshot).decode()` or return as `data:image/png;base64,` URL for Panel `<img src>`. Base64 decode errors → `422` (invalid image) per discretion (not 400).
**When to use:** Always — DB-01, D-11.
**Example:**
```python
import base64, binascii

def decode_screenshot(b64: str) -> bytes:
    # strip data URL prefix if present
    if "," in b64 and b64.startswith("data:"):
        b64 = b64.split(",", 1)[1]
    try:
        return base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=422, detail="invalid screenshot encoding")

def encode_screenshot(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")
```

**Size note:** 1280px viewport PNG is typically 50-200KB Base64; with 100KB payload limit, large screenshots must be caught by 413. Phase 1 caps width 1280px [VERIFIED: REQUIREMENTS.md CAP-01]; if payload exceeds 100KB after adding metadata+logs, SDK retry logic handles it. BYTEA is correct for v1 per ARCHITECTURE.md anti-pattern #3 (no TEXT, no filesystem). Add `D` helper: `screenshot` column should have `nullable=False` and be excluded from list endpoint (return only in detail or as thumbnail URL) to keep `GET /api/incidents` fast.

### Anti-Patterns to Avoid
- **Global `allow_origins=["*"]` with `allow_credentials=True`:** Starlette rejects this combination (credentials + wildcard is invalid per CORS spec). Use explicit allowlist for admin and echo Origin for ingest instead.
- **Storing raw Base64 TEXT:** 33% overhead, slower queries, violates ARCHITECTURE.md anti-pattern #3 — decode to BYTEA before storage.
- **Using `python-jose` for JWT:** Unmaintained, CVEs — use `PyJWT` with `algorithms=["HS256"]` allowlist; never decode without algorithm check.
- **Using `on_event("startup")`:** Deprecated — use `lifespan` asynccontextmanager.
- **Using `@validator` / `class Config`:** Pydantic v1 patterns — use `field_validator` / `ConfigDict` / `model_validator`.
- **Using `psycopg2` with async SQLAlchemy:** Blocks event loop — use `asyncpg` driver (`postgresql+asyncpg://`).
- **Returning raw DB exception messages to client:** Leaks schema info; catch `IntegrityError` and return generic `400/409` instead.
- **Accepting `null` Origin:** `Origin: null` from sandboxed iframes must be rejected per SEC-01 — explicit check, not just allowlist miss.
- **Saving screenshot as `data:image/png;base64,...` string in JSONB:** Pollutes JSONB with binary, bloats TOAST; keep binary in BYTEA column.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing/verification | Custom HMAC, manual base64url, `hashlib` | `PyJWT` (`jwt.encode`/`jwt.decode` with `algorithms=["HS256"]`) | Algorithm confusion, timing attacks, `exp`/`nbf` validation, key rotation — PyJWT handles all per RFC 7519. |
| Password hashing | `hashlib.sha256`, manual salt, cost tuning | `bcrypt` (`hashpw`/`checkpw` with `gensalt(12)`) | OWASP requires adaptive cost, constant-time compare, salt storage — bcrypt handles it; custom SHA is brute-forceable. |
| Rate limiting | In-memory dict + `time.time()` counters | `slowapi` (memory backend) | Sliding window, per-key tracking, `Retry-After` header, thread-safe counters — hand-rolled leaks memory and race-conditions. |
| XSS escaping | Regex `replace("<","&lt;")` only | `html.escape` stdlib (plus handler stripping) | Incomplete escaping misses `&`, `"`, `'`, event handlers, `javascript:` URIs — stdlib covers spec. |
| Payload size limiting | `len(json.dumps(body))` after parse | Early `Content-Length` / `len(await request.body())` before JSON parse | 100KB limit must fire before parsing to prevent DoS via large JSON bombs; post-parse check is too late. |
| Pagination math | Manual `LIMIT/OFFSET` without total | Helper that issues `SELECT COUNT(*)` + `offset/limit` + `pages = ceil(total/size)` | Off-by-one on `pages`, missing `total` breaks Panel footer, inconsistent `ORDER BY` causes page drift. |
| UUID generation | `random.randint` or `hash` | `uuid.uuid4()` + `UUID(as_uuid=True)` column | Collision, non-RFC compliance, DB type mismatch — stdlib UUID is cryptographically random and asyncpg-native. |
| CORS preflight handling | Manual `Access-Control-*` headers per route | `CORSMiddleware` (with split logic for ingest) | Preflight OPTIONS, `Vary: Origin`, `Access-Control-Allow-Headers` — manual misses edge cases (credentials + wildcard). |
| DB connection pooling | Single global `asyncpg.connect()` | `create_async_engine` + `async_sessionmaker` | Connection leaks, no pool recycling, no `NullPool` for tests — SQLAlchemy pooling handles lifecycle. |
| Schema validation | Manual `if not payload.get("type")` checks | `Pydantic BaseModel` with `field_validator` for TRN-04 (`consoleLogs` required for Bug) | FastAPI auto-returns 422 with `loc`/`msg`/`type` detail; manual misses nested validation and type coercion. |
| Base64 decode | `atob` shim or `base64.decodebytes` without validate | `base64.b64decode(b64, validate=True)` + `binascii.Error` catch | Non-strict decode silently accepts non-base64 chars, corrupting BYTEA — `validate=True` enforces alphabet. |

**Key insight:** Phase 2 is security-boundary code (auth, CORS, rate limiting, XSS, size limits, key validation) — every hand-rolled variant has a known bypass. Use the standard libraries that have been audited for those bypasses; the cost of a bypass in a self-hosted error-reporting backend is XSS leading to admin session theft or DoS via unbounded ingest.

## Common Pitfalls

### Pitfall 1: FastAPI `lifespan` vs `on_event` — silent deprecation
**What goes wrong:** Using `@app.on_event("startup")` still runs but emits deprecation warnings and will break in future FastAPI minor; startup errors are swallowed instead of aborting app, so Alembic/seed failures go unnoticed and app serves 500s.
**Why it happens:** Copying outdated tutorials or Phase 1-adjacent examples that predate 0.110.
**How to avoid:** Use `asynccontextmanager` lifespan exclusively; test startup by asserting `GET /api/health` fails when DB is down and passes when up.
**Warning signs:** `DeprecationWarning: on_event is deprecated` in test output; `lifespan` not appearing in `app.router.lifespan_context`.

### Pitfall 2: SQLAlchemy `expire_on_commit=True` (default) → `MissingGreenlet` on response
**What goes wrong:** After `await session.commit()`, accessing `incident.id` or `incident.created_at` raises `MissingGreenlet: greenlet_spawn has not been called` because async session expired the object and lazy-load requires a greenlet.
**Why it happens:** Default `expire_on_commit=True` is correct for sync but wrong for async `AsyncSession` without sync greenlet.
**How to avoid:** Create sessionmaker with `expire_on_commit=False`; always `await session.refresh(incident)` after commit if server defaults (e.g., `created_at`) are needed.
**Warning signs:** 500 on `POST /api/incidents` after successful commit, traceback mentions `MissingGreenlet`.

### Pitfall 3: Pydantic v1 patterns (`@validator`, `class Config`) silently ignored in v2
**What goes wrong:** `@validator("consoleLogs")` and `class Config: orm_mode = True` are not executed/used in Pydantic v2; validation for TRN-04 (consoleLogs required for Bug) is skipped, and `from_attributes` mapping fails, returning empty responses or missing 422 on invalid Bug payloads.
**Why it happens:** Copying StackOverflow or older FastAPI docs.
**How to avoid:** Use `field_validator`, `model_validator`, `ConfigDict(from_attributes=True)`, `field_serializer`. Enable `ruff` rule `RUF008` or Pydantic v2 deprecation warnings in tests.
**Warning signs:** `PydanticDeprecatedSince20` warnings; tests expecting 422 get 201 for Bug without consoleLogs.

### Pitfall 4: CORS wildcard + credentials incompatibility blocks Panel `credentials:'include'`
**What goes wrong:** `CORSMiddleware(allow_origins=["*"], allow_credentials=True)` raises `ValueError: Cannot use wildcard origins with credentials` at startup, or browsers reject `Access-Control-Allow-Origin: *` when `credentials:include` is used, so Panel `GET /api/incidents` with JWT cookie fails CORS.
**Why it happens:** Attempting to satisfy D-13 "ingest open to any Origin" with a global wildcard while also needing credentials for admin.
**How to avoid:** Global allowlist for admin + per-ingest echo of request Origin (no `Allow-Credentials` on ingest since SDK uses `credentials:omit`). Never set `allow_origins=["*"]` when `allow_credentials=True`.
**Warning signs:** Startup crash or browser console `CORS header 'Access-Control-Allow-Origin' does not match '*' when credentials mode is 'include'`.

### Pitfall 5: JWT `Secure` cookie on localhost http → cookie never sent
**What goes wrong:** `response.set_cookie(..., secure=True)` on `http://localhost:8000` causes browser to drop the cookie (Secure requires HTTPS), so every authenticated `GET /api/incidents` returns 401 even after successful login.
**Why it happens:** Hardcoding `secure=True` per D-01 without dev/prod toggle.
**How to avoid:** `secure=settings.ENV == "production"` or `secure=not settings.DEBUG`; document in `.env.example` that `ENV=development` sets `Secure=False`. Tests should use `httpx` `TestClient` which ignores Secure breakout.
**Warning signs:** Login returns 200 + `Set-Cookie` but subsequent `GET /api/incidents` has no `Cookie` header; works in `httpx` tests but fails in browser.

### Pitfall 6: slowapi shared in-memory state is per-process — breaks with multiple workers
**What goes wrong:** `uvicorn --workers 4` creates 4 processes, each with its own in-memory counter, so rate limit is effectively 4x the intended threshold (10/min becomes 40/min). Tests with single process pass, production multi-worker leaks DoS.
**Why it happens:** Self-hosted single-container v1 is single-process, but adding `--workers` for performance without noticing limiter scope.
**How to avoid:** Document that v1 runs single worker (`uvicorn --workers 1` or `gunicorn` single worker); if scaling to multi-worker, migrate to Redis backend and set `storage_uri="redis://..."`. Planner should NOT add workers in Phase 2.
**Warning signs:** Rate limit tests pass locally but abuse script shows 4x throughput in prod.

### Pitfall 7: BYTEA read without streaming → OOM on large screenshot list
**What goes wrong:** `GET /api/incidents` that includes `screenshot` BYTEA for every row loads all images into memory at once (`SELECT *`), OOMing the API when 20 rows × 200KB images = 4MB per request, worse with concurrent requests.
**Why it happens:** Returning screenshot in list endpoint instead of detail-only.
**How to avoid:** List endpoint returns `items` **without** `screenshot` (or with `screenshot_url` pointing to `GET /api/incidents/{id}/screenshot`), detail endpoint streams BYTEA with `Response(content=bytes, media_type="image/png")`. Exclude `LargeBinary` from `select()` in list via `load_only` or separate query.
**Warning signs:** Slow `GET /api/incidents` with large `items`, memory spikes in `psutil` during load test.

### Pitfall 8: Content-Length absent (chunked) bypasses 100KB middleware
**What goes wrong:** Client sends `Transfer-Encoding: chunked` without `Content-Length`; middleware that only checks `Content-Length` header allows arbitrarily large bodies through, bypassing SEC-04.
**Why it happens:** Assuming all clients send `Content-Length` — SDK's `fetch` does, but attackers use chunked.
**How to avoid:** Per-route `len(await request.body()) > MAX_BYTES` check that works regardless of `Content-Length`; do NOT rely solely on header. Middleware must buffer body if it checks header, or delegate to route-level check.
**Warning signs:** Load test with `curl --header "Transfer-Encoding: chunked"` bypasses 413 and hits DB with large blob.

### Pitfall 9: Case mismatch on `type` enum — SDK `bug` vs DB `Bug` causes 422 or filter miss
**What goes wrong:** SDK sends `type: "bug"` lowercase [VERIFIED: sdk/src/capture/batcher.ts:4], DB enum expects `Bug` TitleCase per D-11, so ingest either 422s or stores lowercase, then `GET /api/incidents?type=Bug` filter misses lowercase rows.
**Why it happens:** Not normalizing at boundary.
**How to avoid:** Pydantic `field_validator("type", mode="before")` that does `v.title()` or explicit `{"bug":"Bug","feedback":"Feedback"}[v.lower()]`; DB column can be `String` with check constraint or PG `Enum` with normalized values. Add test for both cases.
**Warning signs:** Ingest returns 201 but `GET ?type=Bug` returns 0 results while `?type=bug` returns items (or vice versa).

### Pitfall 10: Alembic `env.py` not importing models → autogenerate produces empty migration
**What goes wrong:** `alembic revision --autogenerate -m "initial"` generates an empty `upgrade()` with no `op.create_table` calls because `target_metadata` is empty (models not imported), so `alembic upgrade head` creates no tables and all endpoints 500 with `relation "incidents" does not exist`.
**Why it happens:** `env.py` template imports nothing; models live in `app/models/*.py` not yet imported.
**How to avoid:** In `alembic/env.py`, `from app.models import Base` (which itself imports all model modules) **before** `target_metadata = Base.metadata`. Add to `alembic/env.py` template: `from app.models.incident import Incident; from app.models.user import User; from app.models.project import Project` or single `app/models/__init__.py` re-export.
**Warning signs:** Migration file has `def upgrade(): pass` with comment `# ### commands auto generated by Alembic - please adjust! ###` and no `op.create_table`.

## Code Examples

Verified patterns from official sources:

### IncidentCreate Schema (TRN-04: consoleLogs required for Bug)
```python
# Source: Pydantic v2 + FastAPI docs
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Literal

class ConsoleEntry(BaseModel):
    level: Literal["log", "warn", "error", "info"]
    args: list[str]
    timestamp: str

class IncidentCreate(BaseModel):
    type: Literal["Bug", "Feedback"] | Literal["bug", "feedback"]  # accept both, normalize
    screenshot: str = Field(min_length=1, description="Base64 PNG, data URL prefix optional")
    metadata: dict = Field(min_length=1)
    consoleLogs: list[ConsoleEntry] | None = None  # camelCase: SDK sends camelCase
    errors: list[str] = Field(default_factory=list)
    notes: str | None = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v: str) -> str:
        mapping = {"bug": "Bug", "feedback": "Feedback", "Bug": "Bug", "Feedback": "Feedback"}
        if isinstance(v, str) and v.lower() in ("bug", "feedback"):
            return mapping.get(v, v) if v in mapping else mapping[v.lower()]
        return v

    @field_validator("consoleLogs", mode="after")
    @classmethod
    def check_console_logs_for_bug(cls, v, info):
        # info.data contains already-validated fields
        typ = info.data.get("type")
        # type is already normalized to Bug/Feedback at this point
        if typ == "Bug" and (v is None or len(v) == 0):
            raise ValueError("consoleLogs is required for type=Bug")
        return v

    @field_validator("metadata", mode="after")
    @classmethod
    def check_metadata_required(cls, v: dict):
        for field in ("url", "userAgent", "timestamp"):
            if not v.get(field):
                raise ValueError(f"metadata.{field} is required")
        return v
```

### Protected Route Dependency (JWT cookie)
```python
# Source: PyJWT 2.13 + FastAPI Depends docs
from fastapi import Depends, Request, HTTPException, status
import jwt

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("watchbug_access")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    try:
        payload = jwt.decode(token, get_settings().JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    import uuid
    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    return user
```

### Alembic Async env.py (key snippet)
```python
# Source: Alembic 1.14 async docs — https://alembic.sqlalchemy.org/en/latest/tutorial.html#running-migrations-programmatically
import asyncio
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool
from alembic import context
from app.models import Base  # must import all models
from app.config import get_settings

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().DATABASE_URL)
target_metadata = Base.metadata

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    connectable = async_engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

if context.is_offline_mode():
    # offline
    ...
else:
    asyncio.run(run_migrations_online())
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@app.on_event("startup")` / `@app.on_event("shutdown")` | `lifespan` `asynccontextmanager` | FastAPI 0.93+ (2023), enforced 0.110+ | Old decorators deprecated; startup failures now correctly abort app. |
| `@validator` / `class Config(orm_mode=True)` | `field_validator` / `model_validator` / `ConfigDict(from_attributes=True)` | Pydantic v2 (2023-06) | v1 patterns silently ignored; must migrate for TRN-04 validation to fire. |
| `python-jose` (`from jose import jwt`) | `PyJWT` (`import jwt`) | 2022-ongoing (python-jose unmaintained, CVEs) | python-jose has algorithm confusion CVE; PyJWT is maintained. |
| `passlib` shim for bcrypt | Direct `bcrypt` (`bcrypt.hashpw`/`checkpw`) | 2024+ (passlib pkg_resources breakage on Py 3.12) | Direct bcrypt avoids deprecated pkg_resources and version conflicts. |
| `psycopg2` sync driver | `asyncpg` async driver (`postgresql+asyncpg://`) | SQLAlchemy 2.0 (2023) | Sync driver blocks event loop; asyncpg is required for AsyncSession. |
| Sync `Session` + `create_engine` | `AsyncSession` + `create_async_engine` + `async_sessionmaker` | SQLAlchemy 2.0 (2023) | Sync session blocks FastAPI async endpoints; async variant enables concurrency. |
| Manual `os.getenv()` + string casting | `pydantic-settings` `BaseSettings` | Pydantic v2 split (2023) | Settings now in separate package `pydantic-settings`; `BaseSettings` no longer in `pydantic`. |
| Single global CORS `allow_origins=["*"]` | Split CORS (allowlist for admin, echo Origin for public ingest) | Ongoing best practice for public ingestion endpoints (2024+) | Global wildcard breaks `credentials:include` and leaks admin endpoints to any origin. |
| Raw Base64 TEXT column for images | BYTEA (`LargeBinary`) with `b64decode` on ingest | PostgreSQL best practice (2024+) | 33% storage saving, faster queries, proper binary handling; TEXT is anti-pattern. |
| `pip` + `venv` manual | `uv` (`uv sync`, `uv add`) | 2024+ (uv 0.1+) | 10-100x faster, `pyproject.toml`-native; but `pip` fallback still works. |

**Deprecated/outdated:**
- `python-jose`: unmaintained, CVEs — replaced by `PyJWT` [VERIFIED: STACK.md].
- `passlib` standalone for bcrypt: `pkg_resources` deprecation — use `bcrypt` directly.
- `app.on_event`: deprecated — use `lifespan`.
- `@validator` / `class Config`: Pydantic v1 — use `field_validator` / `ConfigDict`.
- `psycopg2` with async: blocking — use `asyncpg`.
- Storing `data:image/png;base64,...` string in TEXT: anti-pattern — decode to BYTEA.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SDK `screenshot` is Base64 PNG string without guaranteed `data:` prefix; may include it. Both handled via `split(",",1)[1]` stripping. | BYTEA Storage | If SDK ever sends binary multipart instead of JSON Base64, decode path breaks — but `sender.ts` confirms JSON body `JSON.stringify(payload)` so this is correct. |
| A2 | Download counts (50M/mo etc.) are estimated from prior knowledge; not verified via PyPI stats API this session. | Package Legitimacy Audit | No impact on legitimacy — age + repo URL + pip existence are sufficient; download magnitude does not gate planner decision. |
| A3 | `uv` is not installed on current host (verified missing) but is locked stack; `pip` fallback is acceptable for Phase 2 until `uv` installed in Docker image. | Standard Stack | Planner should NOT assume `uv` is available on dev host; include install step or pip fallback in plan. |
| A4 | PostgreSQL 16-alpine is the target version per STACK.md, but not yet running on host; `DATABASE_URL` default `localhost:5432` will fail until Phase 4 Docker compose or local PG install. | Environment Availability | Backend tests need `DATABASE_URL` override or `pytest` with `sqlite+aiosqlite` fallback for unit tests; integration tests require real PG. |
| A5 | `asyncpg` binary wheel may fail on Windows dev host without VC++ tools; Linux/Docker is the target runtime. | Environment Availability | Dev on Windows should run backend via Docker, not native pip install of asyncpg. |
| A6 | `bcrypt` 5.x API (`hashpw`/`checkpw`/`gensalt`) is used; older tutorials show `passlib CryptContext`— planner must not mix. | bcrypt Pattern | Mixing APIs causes hash format mismatch and login failures. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (Not empty — A1-A6 need planner awareness but do not require user consultation per autonomy envelope.)

## Open Questions

1. **Should `GET /api/incidents` list include screenshot bytes or only detail view?**
   - What we know: D-11 specifies BYTEA storage; ARCHITECTURE.md warns against loading BYTEA in list; Panel detail view needs full image.
   - What's unclear: Whether list should return `screenshot` at all (even as Base64) or omit for performance. Spec says payload JSONB + screenshot BYTEA but doesn't say list must include screenshot.
   - Recommendation: List returns `items` **without** `screenshot` (or with `has_screenshot: bool`), detail `GET /api/incidents/:id` returns screenshot as Base64 or `GET /api/incidents/:id/screenshot` streams PNG. Planner chooses; either is reversible but detail-only is faster.

2. **Should `payload` JSONB include the screenshot or only BYTEA?**
   - What we know: D-11 says `payload JSONB, screenshot BYTEA` separate columns; SDK payload includes `screenshot` field.
   - What's unclear: Whether to duplicate screenshot into JSONB payload or strip it before JSONB storage (store only metadata+consoleLogs+notes+type).
   - Recommendation: Strip `screenshot` from `payload` JSONB before storage; store only in BYTEA column. JSONB should hold `type`, `metadata`, `consoleLogs`, `errors`, `notes` after sanitization. Saves 33% JSONB TOAST and keeps binary handling correct.

3. **`.env` prefix `WATCHBUG_` vs bare names?**
   - What we know: Discretion says agent chooses; STACK.md mentorship says `.env` via pydantic-settings.
   - What's unclear: Whether to use `WATCHBUG_JWT_SECRET` or `JWT_SECRET`.
   - Recommendation: Use bare names (`DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGINS`) without prefix — simpler, matches `.env.example` convention in most FastAPI projects and avoids `env_prefix` confusion. Document clearly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | Backend runtime | ✓ | 3.14.0 | — |
| pip | Package install | ✓ | 25.3 | Use `pip` directly (uv missing) |
| uv | Locked stack package manager | ✗ | — | `pip install` fallback; install uv via `pip install uv` or `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 \| iex"` before Phase 2 tasks |
| Docker | Deployment (Phase 4) | ✓ | 29.2.1 | — (backend tests can run without Docker, but PG needs Docker for integration tests) |
| PostgreSQL | DB layer (DB-01/02/03) | ✗ | — | Run `docker run -d --name watchbug-pg -e POSTGRES_USER=watchbug -e POSTGRES_PASSWORD=watchbug -e POSTGRES_DB=watchbug -p 5432:5432 postgres:16-alpine` for local dev; or use `sqlite+aiosqlite` for unit tests only |
| Node.js | Panel (Phase 3) | ✓ | 24.11.1 | — |
| asyncpg | SQLAlchemy async driver | ✗ (not installed) | 0.31.0 available on PyPI | Install via `pip install asyncpg`; on Windows may need VC++ Build Tools — prefer Docker for backend execution |
| FastAPI etc. | Backend deps | ✗ (not installed) | All verified on PyPI | `pip install fastapi[standard] ...` per Installation section |

**Missing dependencies with no fallback:**
- PostgreSQL server — blocks integration tests and manual verification of ingest/auth endpoints until a PG instance is running. Planner must add a task to start PG via Docker before running `alembic upgrade head` or `pytest`.

**Missing dependencies with fallback:**
- uv — fallback is `pip`; planner adds `pip install` alternative in plan.
- asyncpg on Windows — fallback is Docker container for all backend execution, not native Windows install.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.24+ + httpx TestClient (FastAPI native) |
| Config file | `backend/pyproject.toml` — `[tool.pytest.ini_options] asyncio_mode = "auto"`; `backend/pytest.ini` alternative |
| Quick run command | `pytest -q` (or `python -m pytest -q` inside `backend/`) |
| Full suite command | `pytest --cov=app --cov-report=term-missing -v` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | App creates with lifespan, Settings from .env, health probe | unit + integration | `pytest tests/test_health.py::test_health_db_connected -xvs` | ❌ Wave 0 — create `backend/tests/conftest.py` + `test_health.py` |
| API-02 | POST /api/incidents with valid Bug payload returns 201, persists to PG | integration | `pytest tests/test_incidents_ingest.py::test_create_bug_success -xvs` | ❌ Wave 0 |
| API-02 | Bug without consoleLogs returns 422 with loc ["body","consoleLogs"] | integration | `pytest tests/test_incidents_ingest.py::test_bug_without_logs_422 -xvs` | ❌ Wave 0 |
| API-02 | Feedback without consoleLogs returns 201 | integration | `pytest tests/test_incidents_ingest.py::test_feedback_without_logs_ok -xvs` | ❌ Wave 0 |
| API-02 | Invalid project key returns 401 | integration | `pytest tests/test_incidents_ingest.py::test_invalid_project_key_401 -xvs` | ❌ Wave 0 |
| API-02 | Payload >100KB returns 413 | integration | `pytest tests/test_incidents_ingest.py::test_payload_too_large_413 -xvs` | ❌ Wave 0 |
| API-03 | GET /api/incidents without JWT returns 401 | integration | `pytest tests/test_incidents_list.py::test_unauth_401 -xvs` | ❌ Wave 0 |
| API-03 | GET with JWT returns paginated {items,total,page,size,pages} | integration | `pytest tests/test_incidents_list.py::test_paginated_ok -xvs` | ❌ Wave 0 |
| API-03 | Filter by type=Bug and status=Pending | integration | `pytest tests/test_incidents_list.py::test_filter_type_status -xvs` | ❌ Wave 0 |
| API-04 | PATCH /api/incidents/:id/status updates and returns 200 | integration | `pytest tests/test_incidents_status.py::test_patch_status_ok -xvs` | ❌ Wave 0 |
| API-05 | GET /api/health returns {status,db} public | integration | `pytest tests/test_health.py::test_health_ok -xvs` | ❌ Wave 0 |
| AUTH-01 | POST /api/auth/login with valid creds sets HttpOnly cookies | integration | `pytest tests/test_auth.py::test_login_sets_cookies -xvs` | ❌ Wave 0 |
| AUTH-02 | Password stored as bcrypt hash, not plaintext | integration | `pytest tests/test_auth.py::test_password_is_hashed -xvs` | ❌ Wave 0 |
| AUTH-03 | Protected routes reject missing/invalid JWT with 401 | integration | `pytest tests/test_auth.py::test_protected_401 -xvs` | ❌ Wave 0 |
| AUTH-04 | POST /api/auth/logout clears cookies | integration | `pytest tests/test_auth.py::test_logout_clears -xvs` | ❌ Wave 0 |
| DB-01..03 | Alembic upgrade head creates 3 tables with correct columns | integration | `pytest tests/test_db.py::test_tables_exist -xvs` | ❌ Wave 0 |
| DB-04 | alembic revision --autogenerate + upgrade head is idempotent | manual | `alembic upgrade head && alembic current` | ❌ Wave 0 — verify in CI |
| SEC-01 | CORS: null origin rejected, allowlist enforced for admin, ingest open | integration | `pytest tests/test_security.py::test_cors_null_rejected -xvs` | ❌ Wave 0 |
| SEC-02 | Rate limit: 11th POST /api/incidents in 60s returns 429 + Retry-After | integration | `pytest tests/test_security.py::test_rate_limit_429 -xvs` | ❌ Wave 0 |
| SEC-03 | XSS payload sanitized before storage (html.escape) | integration | `pytest tests/test_security.py::test_xss_sanitized -xvs` | ❌ Wave 0 |
| SEC-04 | 100KB limit enforcement (see API-02 413 test) | integration | (same as API-02 413) | ❌ Wave 0 |
| SEC-05 | No secrets in code, Settings from .env, .env.example exists | manual | `grep -R JWT_SECRET backend/app --include="*.py"` must not contain hardcoded value; `test -f .env.example` | ❌ Wave 0 — create `.env.example` |

### Sampling Rate
- **Per task commit:** `pytest -q` (quick, <30s)
- **Per wave merge:** `pytest --cov=app -v` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`; at least one seeded admin login + ingest + list + patch flow must pass against real PostgreSQL (not sqlite mock)

### Wave 0 Gaps
- [ ] `backend/pyproject.toml` — project deps, [tool.pytest], [tool.ruff], [tool.alembic]
- [ ] `backend/alembic.ini` + `alembic/env.py` (async) + `alembic/versions/001_initial.py`
- [ ] `backend/app/__init__.py` + structure (config/db/models/schemas/routers/services/dependencies)
- [ ] `backend/tests/conftest.py` — fixtures: `async_client`, `db_session`, `seeded_project`, `auth_cookies` helper, `override_get_db` for test DB
- [ ] `.env.example` — all Settings fields documented with example values
- [ ] PostgreSQL Docker for CI: `docker run ... postgres:16-alpine` or `services: postgres:16-alpine` in GitHub Actions
- [ ] Framework install: `pip install fastapi[standard] pydantic pydantic-settings sqlalchemy[asyncio] asyncpg alembic pyjwt bcrypt slowapi httpx pytest pytest-asyncio` (or `uv sync`)

*(If no gaps: "None — existing test infrastructure covers all phase requirements" — not applicable: backend is greenfield, all test infra is Wave 0)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `bcrypt` (hash) + `PyJWT` HS256 (1h access/7d refresh, HttpOnly/SameSite=Lax/Secure) + seeded admin from `.env` — no registration. |
| V3 Session Management | yes | HttpOnly cookies `watchbug_access`/`watchbug_refresh` with `jti`/`exp`/`sub`; `Max-Age=0` on logout; no server denylist in v1 (JWT valid until 1h expiry). |
| V4 Access Control | yes | `Depends(get_current_user)` on `GET`/`PATCH /api/incidents`; `POST /api/incidents` public but gated by `PROJECT_KEY` (public write-only, not auth). |
| V5 Input Validation | yes | Pydantic v2 `field_validator` (TRN-04, metadata required), `html.escape` XSS sanitization before JSONB, `X-Project-Key` validation against `projects.api_key`, UUID path param validation. |
| V6 Cryptography | yes | `bcrypt` cost=12 for passwords; `PyJWT` HS256 with 32+ char `JWT_SECRET` from `.env`; never log secrets; `Secure` flag in production. — Never hand-roll crypto. |
| V7 Error Handling | yes | 401 vs 422 vs 413 vs 429 distinct codes per D-06/D-08/D-14; generic `detail` messages (no stack traces); JSON `{"detail": ...}` envelope. |
| V8 Data Protection | yes | BYTEA screenshot stored server-side only; no host cookies/tokens ever ingested (SEC-03); `.env` only, `.env.example` committed (SEC-05). |
| V9 Communications | yes | CORS split (allowlist admin, open ingest, reject `null`), `X-Forwarded-For` only if `TRUST_PROXY`; `Secure` cookies in prod; no `Authorization` header leakage. |
| V11 Business Logic | yes | Rate limiting per IP + per key (slowapi in-memory), 100KB payload cap (413), pagination `size<=100` cap, status Any→Any (no state-machine bypass in v1). |
| V12 Files & Resources | partial | Screenshot BYTEA size bounded by 100KB JSON limit + 1280px cap; no file upload path traversal (JSON only, no `UploadFile`). |
| V13 API & Web Services | yes | FastAPI auto docs gated by `DOCS_ENABLED`; health check public; no open registration; `PROJECT_KEY` is write-only public. |
| V14 Configuration | yes | `pydantic-settings` from `.env`; `DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD` never hardcoded; `alembic.ini` URL overridden by Settings. |

### Known Threat Patterns for Stack (FastAPI + PostgreSQL self-hosted)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via consoleLogs/notes → Panel renders unsanitized HTML | Tampering, Info disclosure | `html.escape` at ingest before JSONB + Panel renders as `textContent` (PAN-07 double defense) [MITIGATED by Pattern 9]. |
| JWT theft via XSS (JS reads token) | Info disclosure, Spoofing | HttpOnly cookies (D-01) — JS cannot read; `SameSite=Lax` blocks cross-site POST [MITIGATED by Pattern 5]. |
| CSRF on `POST /api/incidents` or `PATCH` via cross-site form | Spoofing, Tampering | `SameSite=Lax` on auth cookies; ingest uses `credentials:omit` + key, not cookies, so CSRF irrelevant; `PATCH` requires cookie + SameSite. |
| Brute-force login on `POST /api/auth/login` | Tampering, Elevation | Rate limit `60/minute per IP` on auth routes + `bcrypt` cost=12 slows guesses; add CAPTCHA only if abuse observed (v2). |
| DoS via large payloads / flood of incidents | Denial of service | 100KB cap → 413 (Pattern 10) + slowapi `10/min per IP` + `30/min per PROJECT_KEY` (Pattern 8). |
| CORS bypass via `Origin: null` (sandboxed iframe) | Tampering, Info disclosure | Explicit `if origin == "null": 403` per SEC-01; do not add `null` to allowlist [MITIGATED by Pattern 7]. |
| SQL injection via `type=`/`status=` filter strings | Tampering | SQLAlchemy `select().where(Incident.type.in_(types))` with bound params — no string interpolation; Pydantic validates enum values first. |
| Credential leakage via error messages | Info disclosure | Catch `IntegrityError`/`asyncpg` exceptions, return generic `400/409`; never echo `DATABASE_URL` or `JWT_SECRET` in responses or logs. |
| Timing attack on project_key / password check | Info disclosure | `bcrypt.checkpw` is constant-time; project_key lookup is DB equality (attacker learns only existence via 401 vs 422, acceptable per D-08 split). |
| Rate-limit bypass via `X-Forwarded-For` spoofing | Tampering, Denial of service | Only trust `X-Forwarded-For` when `TRUST_PROXY=true`; else use `get_remote_address` (TCP peer IP). |
| Open redirect / docs exposure in prod | Info disclosure | `/docs`/`/openapi.json` gated by `DOCS_ENABLED` flag; JWT protection in prod per D-16; never expose docs by default. |

## Sources

### Primary (HIGH confidence)
- `pip index versions` — executed this session for fastapi 0.141.1, pydantic 2.13.5, sqlalchemy 2.0.52, alembic 1.19.1, pyjwt 2.13.0, bcrypt 5.0.0, slowapi 0.1.10, pydantic-settings 2.15.0, asyncpg 0.31.0 [VERIFIED: pip registry]
- `sdk/src/transport/sender.ts:27-35` — confirms `credentials:'omit'` + `X-Watchbug-Key` + `JSON.stringify(payload)` contract [VERIFIED: sdk/src/transport/sender.ts:13-35]
- `sdk/src/capture/batcher.ts:3-10` — confirms `ReportPayload` shape `type: 'bug'|'feedback', screenshot, metadata, consoleLogs, errors, notes?` [VERIFIED: sdk/src/capture/batcher.ts:3-10]
- `sdk/src/transport/validation.ts:16-73` — confirms TRN-04 `consoleLogs required for bug` + metadata `url/userAgent/timestamp` required [VERIFIED: sdk/src/transport/validation.ts:14-48]
- `.planning/research/STACK.md` — locked stack table + What NOT to Use (python-jose CVEs, on_event, @validator) [CITED: .planning/research/STACK.md]
- `.planning/research/ARCHITECTURE.md` — system diagram, anti-pattern #3 (BYTEA vs TEXT), project structure `backend/` [CITED: .planning/research/ARCHITECTURE.md]
- `gsd-tools query package-legitimacy` — `postinstall: null` for all packages, no hidden scripts [VERIFIED: gsd-tools]

### Secondary (MEDIUM confidence)
- FastAPI lifespan docs (contextlib.asynccontextmanager) + Pydantic v2 field_validator/ConfigDict patterns — widely documented, not fetched via Context7 this session due to no BRAVE_API_KEY but consistent with STACK.md citations [CITED: STACK.md Sources — FastAPI docs, Pydantic docs]
- PyJWT 2.9+ `jwt.encode`/`jwt.decode` HS256 with `algorithms=` allowlist — per PyJWT docs [CITED: pyjwt.readthedocs.io]
- slowapi `Limiter` + `RateLimitExceeded` handler pattern — per slowapi GitHub docs [CITED: github.com/laurentS/slowapi]
- SQLAlchemy 2.0 async `AsyncEngine`/`AsyncSession` + Alembic async `env.py` — per SQLAlchemy/Alembic docs [CITED: sqlalchemy.org, alembic.sqlalchemy.org]
- `html.escape` stdlib XSS escaping — per Python docs [CITED: docs.python.org/3/library/html.html]

### Tertiary (LOW confidence)
- Download count estimates in Package Legitimacy Audit — marked `[ASSUMED]`, not used for legitimacy verdict.
- UV 10-100x speed claims — from STACK.md, not independently verified this session [ASSUMED].

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via `pip index versions` on PyPI this session; alternatives and What NOT to Use from STACK.md.
- Architecture: HIGH — locked decisions from CONTEXT.md D-01..D-16 plus ARCHITECTURE.md anti-patterns and existing SDK transport contract read this session.
- Pitfalls: HIGH — 10 pitfalls derived from locked stack's known incompatibilities (lifespan, expire_on_commit, Pydantic v2, CORS wildcard, Secure cookie, slowapi workers, BYTEA OOM, chunked bypass, type case, Alembic empty migration).
- Security: HIGH — ASVS mapping covers all SEC-01..06 and AUTH-01..04; mitigations are standard library usages (PyJWT, bcrypt, html.escape, slowapi).
- Validation: MEDIUM — test map is prescriptive for greenfield backend; no existing backend tests to inspect, but requirement IDs mapped 1:1.

**Research date:** 2026-08-31
**Valid until:** 2026-09-30 (30 days — stack is stable; re-check pip versions before planning if >30 days old)

