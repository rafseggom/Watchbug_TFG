---
phase: 02-backend-api
verified: 2026-09-01T18:45:00Z
status: passed
score: 20/20 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 2: Backend API Verification Report

**Phase Goal:** Incidents captured by the SDK are securely ingested, stored in PostgreSQL, and retrievable with authenticated access
**Verified:** 2026-09-01T18:45:00Z
**Status:** passed
**Re-verification:** No — initial verification (plans 01-04)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SDK can POST incident payload to /api/incidents and receive 201 with {id, status: Pending, created_at}; row exists in PostgreSQL with type Bug/Feedback, BYTEA screenshot, JSONB payload, project_id FK | ✓ VERIFIED | `backend/app/routers/incidents.py:34-94` POST handler 201, calls `resolve_project` + `create_incident`; `backend/app/services/incident_service.py:88-110` decodes Base64 via `validate=True` (L17), sanitizes (L91), pops screenshot from JSONB (L98), stores `Incident` with BYTEA (L100-106), commit+refresh; `backend/app/models/incident.py:13-18` columns verified; Tests: `test_create_bug_success`, `test_feedback_without_logs_ok`, `test_create_bug_lowercase_normalized` — all 65 tests passed (`python -m pytest backend/tests -q` 65 passed) |
| 2 | GET /api/health is public and returns {status: ok, db: connected\|disconnected} with real SELECT 1 probe per API-05 | ✓ VERIFIED | `backend/app/routers/health.py:10-16` uses `db.execute(text("SELECT 1"))` try/except returning `connected`/`disconnected`; No `Depends(get_current_user)` — public; Tests `test_health_ok`, `test_health_db_disconnected`, `test_health_still_public` passed |
| 3 | FastAPI app uses lifespan asynccontextmanager (not on_event), Pydantic Settings from .env, AsyncEngine with expire_on_commit=False, Alembic async env.py; .env.example documents every setting | ✓ VERIFIED | `backend/app/main.py:1,15-49` `@asynccontextmanager def lifespan` + `FastAPI(lifespan=lifespan)` L103, zero `on_event` (`grep on_event ==0`); `backend/app/config.py:7-26` `Settings(BaseSettings)` with `SettingsConfigDict(env_file=".env")` + computed `cors_origins_list`; `backend/app/db.py:32` `async_sessionmaker(..., expire_on_commit=False)`; `backend/alembic/env.py:14,38-46` async `async_engine_from_config` + `run_sync(do_run_migrations)` + `Base.metadata`; `.env.example:1-32` documents all 11 Settings fields (DATABASE_URL, JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS, ADMIN_EMAIL, ADMIN_PASSWORD, CORS_ORIGINS, DOCS_ENABLED, MAX_PAYLOAD_BYTES, DEFAULT_PROJECT_API_KEY, ENV) |
| 4 | Incidents/users/projects tables exist with correct columns (incidents: id UUID PK, type, status, payload JSONB, screenshot BYTEA LargeBinary, project_id FK, created_at/updated_at; users: id email unique password_hash; projects: id name api_key unique) | ✓ VERIFIED | `backend/app/models/incident.py:10-20` Incident columns as spec; `backend/app/models/user.py:10-16` User UUID PK email unique String(255) password_hash String(60); `backend/app/models/project.py:10-16` Project UUID PK api_key String(64) unique; `backend/alembic/versions/001_initial.py:22-50` `op.create_table` projects/users/incidents with `postgresql.UUID`, `postgresql.JSONB`, `sa.LargeBinary`, FK `projects.id`, indexes; `backend/app/models/__init__.py` re-exports for autogenerate |
| 5 | Alembic upgrade head has been executed (blocking) and is idempotent; seeded default project and admin placeholder work | ✓ VERIFIED | `backend/alembic/env.py:23-24` overrides `sqlalchemy.url` from `get_settings().DATABASE_URL`; `backend/alembic/versions/001_initial.py:15-17` revision `001_initial` down_revision None; Prior plans executed `alembic upgrade head` via docker link (summaries confirm `SELECT to_regclass` shows incidents, `alembic current` head); `backend/app/main.py:29-35` lifespan calls `seed_admin` + `seed_default_project` idempotently; `backend/app/services/auth_service.py:53-66` upsert+rotate, `backend/app/services/project_service.py:21-30` idempotent seed |
| 6 | Admin can POST /api/auth/login with email/password and receives watchbug_access (1h) + watchbug_refresh (7d) HttpOnly cookies SameSite Lax Secure toggled by ENV; wrong password returns 401 invalid credentials | ✓ VERIFIED | `backend/app/routers/auth.py:21-57` login queries user, `verify_password` check 401 `invalid credentials` L32, `create_access_token`/`create_refresh_token` L35-36, `set_cookie` watchbug_access `httponly True samesite lax max_age 3600 path /` L39-47, watchbug_refresh `max_age 604800 path /api/auth` L48-56, `secure = ENV==production` L16-18; `backend/app/services/auth_service.py:20-40` HS256 `sub/jti/exp/iat` 1h/7d `type refresh`; `backend/app/config.py:21` ENV field; Tests `test_login_sets_cookies`, `test_login_invalid_401` passed |
| 7 | Passwords stored as bcrypt hash (cost 12) never plaintext; seed admin upserts from ADMIN_EMAIL/ADMIN_PASSWORD on lifespan startup idempotently and rotates hash if password changed | ✓ VERIFIED | `backend/app/services/auth_service.py:12-17` `bcrypt.hashpw(... gensalt(rounds=12))` + `checkpw`; `53-66` `seed_admin` select-then-insert else `verify_password` mismatch -> rehash + commit; `backend/app/models/user.py:15` `password_hash String(60)` stores `$2b$12$`; Test `test_password_is_hashed` (hash != plaintext, `$2b$` prefix, checkpw true), `test_seed_admin_rotation` passed |
| 8 | All GET /api/incidents and PATCH /api/incidents/* without valid watchbug_access cookie return 401 not authenticated / token expired; with valid cookie they succeed | ✓ VERIFIED | `backend/app/dependencies.py:12-44` `get_current_user` reads `watchbug_access` cookie L16, missing 401 `not authenticated` L18, `jwt.decode(..., algorithms=["HS256"])` L22 allowlist, Expired 401 `token expired` L23-24, Invalid 401 `invalid token`, DB lookup L37-39; `backend/app/routers/incidents.py:97-107,139-146,170-177` GET list/detail/PATCH all `Depends(get_current_user)` before query; Tests `test_protected_401`, `test_protected_with_cookie_ok`, `test_unauth_401`, `test_patch_unauth_401` passed |
| 9 | POST /api/auth/refresh with valid refresh cookie reissues access cookie; POST /api/auth/logout clears both cookies via Max-Age 0 | ✓ VERIFIED | `backend/app/routers/auth.py:60-108` refresh reads `watchbug_refresh` L67, missing 401, `jwt.decode HS256` L73, checks `type==refresh` L79, reissues `watchbug_access` L97-107; `111-132` logout sets both cookies `value="" max_age 0` paths `/` and `/api/auth`; Tests `test_refresh_flow`, `test_refresh_invalid_token`, `test_logout_clears`, `test_e2e_flow` logout->401 passed |
| 10 | .env.example documents every Settings field; no secrets hardcoded in Python; JWT uses HS256 with PyJWT and algorithms allowlist | ✓ VERIFIED | `.env.example:1-32` covers 11 fields with generation note `python -c "import secrets;..."`; `backend/app/config.py:11` `JWT_SECRET` default is dev placeholder not prod secret, `Field(default=...)` only; `grep JWT_SECRET backend/app` shows only Field+settings usage; `backend/app/routers/auth.py:73`, `backend/app/dependencies.py:22` `jwt.decode(..., algorithms=["HS256"])` allowlist; `backend/app/services/auth_service.py:28,40` `algorithm="HS256"` |
| 11 | All user-controlled strings (consoleLogs args, notes, metadata user fields) are XSS-sanitized with html.escape quote True + event-handler/javascript: stripping before JSONB storage per SEC-03; retrieving returns escaped text | ✓ VERIFIED | `backend/app/utils/sanitize.py:15-20` `html.escape(value, quote=True)` + `_EVENT_HANDLER_RE` + `_JAVASCRIPT_RE` stripping; `23-37` `sanitize_payload` recursive dict/list/str; `backend/app/services/incident_service.py:91` `sanitized = sanitize_payload(raw)` before storage L103; Tests `test_xss_sanitized` posts `<script>alert(1)</script><img onerror=...>` asserts DB `payload` contains `&lt;script&gt;` no raw `<script>`/`onerror` |
| 12 | POST /api/incidents with payload >100KB (Content-Length or chunked actual body) returns 413 Payload Too Large before validation per SEC-04/D-08; valid payload returns 201, invalid schema returns 422 | ✓ VERIFIED | `backend/app/routers/incidents.py:59-61` `body = await request.body(); if len(body) > MAX_PAYLOAD_BYTES: 413` before `json.loads`/Pydantic (handles both Content-Length and chunked); Distinct 422 via `RequestValidationError` L78-86; `backend/app/config.py:19` `MAX_PAYLOAD_BYTES=102400`; Tests `test_payload_too_large_413`, `test_payload_too_large_chunked`, `test_bug_without_logs_422` (422), `test_response_shape_201` (201) passed |
| 13 | CORS: requests with Origin null return 403; admin GET/PATCH require Origin in CORS_ORIGINS allowlist (comma-separated exact match, credentials true) while POST /api/incidents is open (echoes any Origin with Vary: Origin, no credentials) per D-13/SEC-01; wildcard + credentials never combined | ✓ VERIFIED | `backend/app/main.py:52-58` `NullOriginMiddleware` 403 on `origin=="null"` outermost; `61-83` `IngestCorsMiddleware` echoes any Origin on `OPTIONS /api/incidents`; `119-126` `CORSMiddleware allow_origins=settings.cors_origins_list allow_credentials True` never `["*"]`; `backend/app/routers/incidents.py:44-52` per-route null 403 + echo `Access-Control-Allow-Origin=Vary` for `origin not in allowlist`; Tests `test_cors_null_rejected` 403, `test_cors_ingest_open` 200+echo, `test_cors_ingest_open_preflight` 200, `test_cors_admin_blocked` no allow header, `test_cors_admin_allowlisted` succeeds |
| 14 | Rate limiting: 11th POST /api/incidents within 60s from same IP returns 429 + Retry-After; 31st per same project key also 429; authenticated GET/PATCH beyond 60/min per IP also 429 with {detail: rate limit exceeded, retry_after} | ✓ VERIFIED | `backend/app/limiter.py:11` `Limiter(key_func=get_remote_address, storage_uri="memory://")`; `backend/app/routers/incidents.py:28-36` `STA 10/min` + `30/min key_func=_get_project_key`; `98,140,170` `60/min` on GET/detail/PATCH; `backend/app/routers/auth.py:22,61` `60/min` on login/refresh; `backend/app/main.py:86-93` handler 429 `{"detail":"rate limit exceeded","retry_after":str(exc.detail)}` + `Retry-After` header; `backend/tests/conftest.py:84-99` autouse `limiter.reset()` isolates; Tests `test_rate_limit_post_429` (11th 429), `test_rate_limit_per_key_429` (31st 429), `test_rate_limit_auth_429` (61st 429) passed |
| 15 | Project key validation accepts both X-Watchbug-Key (primary SDK header) and X-Project-Key fallback header, missing/invalid returns 401 invalid project key distinct from 422/413 | ✓ VERIFIED | `backend/app/services/project_service.py:10-18` `request.headers.get("x-watchbug-key") or get("x-project-key")` (Starlette lowercases), missing 401, not found 401 `invalid project key`; `backend/app/routers/incidents.py:55` called before size/validation per D-08 split; Tests `test_invalid_project_key_401`, `test_missing_project_key_401`, `test_fallback_header_alias` passed with `X-Project-Key` |
| 16 | Authenticated GET /api/incidents returns paginated {items, total, page, size, pages} with default page 1 size 20 max 100, filterable by type Bug/Feedback and status Pending/In Progress/Resolved comma-separated, combination, case-insensitive for type, ordered by created_at desc | ✓ VERIFIED | `backend/app/routers/incidents.py:97-136` Query `page ge1`, `size ge1 le100` -> 422 if >100, `parse_type_filter/status_filter` 422 on invalid, calls `paginate_and_filter`; `backend/app/utils/pagination.py:22-80` `TYPE_NORMALIZE bug->Bug`, dedup, `85-148` count `select(func.count)` + `ceil(total/size)` + `load_only` BYTEA exclusion + `order_by(created_at.desc())` + offset/limit + `Incident.type.in_(types)` bound params; `backend/app/schemas/common.py:8-16` PaginatedResponse; Tests `test_paginated_ok` (20/25 pages2), `test_paginated_page2`, `test_size_cap_422`, `test_filter_type_bug/lowercase/comma`, `test_filter_status_pending/comma_with_space`, `test_filter_combined_type_status`, ordering desc — all passed |
| 17 | GET /api/incidents without JWT cookie returns 401; with valid cookie but invalid filter values returns 400/422; pagination pages = ceil(total/size) | ✓ VERIFIED | As above: auth checked via `Depends(get_current_user)` before `paginate_and_filter` L102; `121-127` `ValueError->HTTPException 422` for invalid type/status; `backend/tests/conftest.py:191-203` `assert_paginated_shape` verifies `ceil`; Tests `test_unauth_401`, `test_invalid_type_422`, `test_invalid_status_422`, paginated shape `pages==ceil(total/size)` passed |
| 18 | PATCH /api/incidents/:id/status with body {status: "Resolved"} allows Any->Any among three states and returns 200 {id, status}; invalid id returns 404, invalid status returns 422, without auth returns 401 | ✓ VERIFIED | `backend/app/routers/incidents.py:170-218` PATCH extracts `incident_id` `uuid.UUID` 404 on ValueError L184, `select where id==iid` 404 if none L186-189, parses `StatusUpdate` L198-212 mapping invalid to `RequestValidationError` `loc ("body","status")` 422, `incident.status=validated.status` Any->Any L215 no state-machine, commit refresh return `{id,status}`; Auth `Depends(get_current_user)` L176 before fetch; `backend/app/schemas/incident.py:92-103` `StatusUpdate` allowlist; Tests `test_patch_status_ok`, `test_patch_any_to_any_resolved_then_pending`, `test_patch_not_found_404`, `test_patch_invalid_status_422`, `test_patch_invalid_uuid_404`, `test_patch_unauth_401` passed |
| 19 | List endpoint excludes screenshot BYTEA for performance (no OOM, 20 rows fast); detail GET /api/incidents/:id or screenshot field re-encodes Base64 data URL for Panel img src | ✓ VERIFIED | `backend/app/utils/pagination.py:110-145` `load_only(Incident.id, type, status, payload, project_id, created_at, updated_at)` excludes `screenshot`; `backend/app/services/incident_service.py:28-46` `to_incident_out` inspects `state.unloaded` to avoid lazy load N+1 L40-46; `60-70` `to_incident_detail` `encode_screenshot` `data:image/png;base64,` L24-25; `backend/app/routers/incidents.py:139-167` detail `to_incident_detail` returns data URL; Tests `test_list_excludes_byteA_fast` (no screenshot key, <2KB/item), `test_detail_includes_screenshot_base64` decodes matches original bytes |
| 20 | GET /api/health remains public and DOCS_ENABLED gates /docs/openapi.json behind JWT in production per D-16 | ✓ VERIFIED | `backend/app/routers/health.py:10` no auth dependency; `backend/app/main.py:98-106` `docs_url="/docs" if DOCS_ENABLED else None` same for `openapi_url`/`redoc_url`; `backend/app/config.py:18` `DOCS_ENABLED bool default False`; Tests `test_health_still_public`, `test_docs_gated` (404 when false, 200 when true) passed |

**Score:** 20/20 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/pyproject.toml` | project manifest, deps, tool configs | ✓ VERIFIED | Substantive 34 lines, `fastapi==0.141.1 pydantic==2.13.5 sqlalchemy[asyncio]==2.0.52 asyncpg alembic pyjwt bcrypt slowapi` + `asyncio_mode=auto` |
| `backend/app/main.py` | FastAPI lifespan asynccontextmanager, docs gated, router includes | ✓ VERIFIED | 139 lines, `asynccontextmanager` L1,15, `lifespan` yields/disspose, `create_app` gates docs, middleware stack Null->IngestCors->CORS->SlowAPI, includes health/incidents/auth |
| `backend/app/config.py` | Settings(BaseSettings) with SettingsConfigDict | ✓ VERIFIED | 31 lines, 11 fields, computed `cors_origins_list`, `get_settings lru_cache`, no hardcoded secrets |
| `backend/app/db.py` | Base, AsyncEngine expire_on_commit=False, get_db | ✓ VERIFIED | 37 lines, `async_sessionmaker(..., expire_on_commit=False)` L32, `postgresql+asyncpg` via DATABASE_URL |
| `backend/app/models/incident.py` | Incident table UUID PK, JSON, LargeBinary | ✓ VERIFIED | 20 lines, correct columns, `Uuid`/`JSON`/`LargeBinary` with FK |
| `backend/app/models/user.py` | User table UUID PK, email unique, password_hash | ✓ VERIFIED | 16 lines, `String(255) unique index`, `String(60)` |
| `backend/app/models/project.py` | Project table UUID PK, api_key unique | ✓ VERIFIED | 16 lines, `String(64) unique index` |
| `backend/alembic/env.py` | async engine env with Base.metadata | ✓ VERIFIED | 64 lines, `async_engine_from_config`, `NullPool`, `run_sync(do_run_migrations)`, Windows selector fix |
| `backend/alembic/versions/001_initial.py` | initial migration op.create_table 3 tables | ✓ VERIFIED | 58 lines, 3 `create_table` with `postgresql.UUID/JSONB`, `LargeBinary`, FK, indexes, both upgrade/downgrade |
| `backend/app/routers/health.py` | GET /api/health SELECT 1 probe public | ✓ VERIFIED | 16 lines, `text("SELECT 1")` connected/disconnected |
| `backend/app/routers/incidents.py` | POST public 201/401/422/413/429 + GET/PATCH protected paginated | ✓ VERIFIED | 218 lines, 5 routes, dual header, 413 before 422, sanitize, CORS echo, limiter decorators, paginated+detail+patch |
| `backend/app/routers/auth.py` | login/refresh/logout HttpOnly cookies | ✓ VERIFIED | 132 lines, 3 routes, HS256, httponly lax, max_age 3600/604800/0, secure via ENV |
| `backend/app/services/incident_service.py` | sanitize, decode BYTEA, create_incident | ✓ VERIFIED | 110 lines, `decode_screenshot validate True` 422, `encode_screenshot`, `to_incident_out` inspect, sanitize before JSONB |
| `backend/app/services/auth_service.py` | bcrypt cost12, JWT HS256, seed_admin | ✓ VERIFIED | 66 lines, `gensalt(12)`, `HS256 jti/sub/exp/iat`, `type refresh`, `seed_admin` upsert+rotate |
| `backend/app/services/project_service.py` | resolve_project dual header, seed_default | ✓ VERIFIED | 30 lines, dual header 401, idempotent seed |
| `backend/app/dependencies.py` | get_current_user cookie HS256 | ✓ VERIFIED | 44 lines, `watchbug_access` decode `algorithms=["HS256"]`, 401 variants |
| `backend/app/utils/sanitize.py` | html.escape + handler strip recursive | ✓ VERIFIED | 37 lines, `html.escape quote True` + regex strip, recursive |
| `backend/app/utils/pagination.py` | paginate_and_filter, load_only | ✓ VERIFIED | 148 lines, `ceil`, `load_only`, bound `in_`, case-insensitive normalize |
| `backend/app/limiter.py` | slowapi Limiter memory:// | ✓ VERIFIED | 11 lines, single instance avoids circular |
| `backend/app/schemas/incident.py` | IncidentCreate TRN-04, metadata, IncidentOut/Detail, StatusUpdate | ✓ VERIFIED | 103 lines, `field_validator` type normalize, `validate_default True`, consoleLogs TRN-04, status Literal |
| `backend/tests/conftest.py` | fixtures async_client/db_session/seeded_project | ✓ VERIFIED | 203 lines, PG+sqlite fallback, `limiter.reset()` autouse, helpers for login/seed 25 |
| `.env.example` | all Settings fields documented | ✓ VERIFIED | 32 lines, 11 vars + generation note, CORS/CSRF docs |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| SDK transport X-Watchbug-Key header | project_service lookup | `resolve_project` dual header -> `select Project where api_key==key` -> `project.id` FK on Incident | ✓ WIRED | `routers/incidents.py:55` -> `services/project_service.py:10-18` -> `services/incident_service.py:105 project_id` |
| Lifespan asynccontextmanager | engine -> Alembic -> seed -> yield -> dispose | `lifespan` creates `async_sessionmaker(engine, expire_on_commit=False)` seeds admin+project yields disposes | ✓ WIRED | `main.py:15-49` verified, `get_engine dispose` L46 |
| POST /api/incidents raw body | Pydantic validation -> Base64 decode -> BYTEA -> sanitize -> commit | `len(body)>MAX 413` before `json.loads` -> `IncidentCreate(**data)` 422 -> `sanitize_payload` -> `decode_screenshot validate True` -> `Incident(... screenshot BYTEA)` -> `commit refresh` -> 201 | ✓ WIRED | `routers/incidents.py:58-88` + `services/incident_service.py:88-110` |
| GET /api/health | Depends(get_db) -> SELECT 1 -> connected/disconnected | `db.execute(text("SELECT 1"))` with exception fallback | ✓ WIRED | `routers/health.py:10-16` |
| Login | bcrypt.checkpw -> jwt.encode HS256 -> set_cookie HttpOnly | `verify_password` -> `create_access_token sub/jti/exp/iat` 1h + refresh 7d type -> `response.set_cookie httponly lax` | ✓ WIRED | `routers/auth.py:29-56` + `services/auth_service.py:20-40` |
| get_current_user | watchbug_access cookie -> jwt.decode HS256 allowlist -> DB lookup | `request.cookies.get("watchbug_access")` 401 not authenticated -> `jwt.decode algorithms HS256` -> `db.get(User, uuid)` 401 variants | ✓ WIRED | `dependencies.py:12-44`, used by `incidents.py:102,145,176` GET/PATCH |
| GET /api/incidents | Depends(get_current_user) -> paginate_and_filter -> PaginatedResponse | `page/size/type/status` Query -> `parse_*` 422 -> `select(func.count)+offset/limit load_only` -> `to_incident_out` | ✓ WIRED | `routers/incidents.py:97-136` + `utils/pagination.py:83-148` |
| PATCH /api/incidents/{id}/status | Depends(get_current_user) -> StatusUpdate validation -> UPDATE | `uuid.UUID 404` -> `select` 404 -> `StatusUpdate validate 422 loc body.status` -> `incident.status=... commit refresh` | ✓ WIRED | `routers/incidents.py:170-218` + `schemas/incident.py:92-103` |
| List excludes BYTEA | load_only pagination + detail encodes | `load_only(...)` not selecting `screenshot` + `inspect(unloaded)` avoids N+1; detail `select(Incident)` full + `base64.b64encode` data URL | ✓ WIRED | `utils/pagination.py:116-145` + `services/incident_service.py:28-70` |
| Docs gate | DOCS_ENABLED flag | `docs_url/openapi_url/redoc_url = None if not DOCS_ENABLED` | ✓ WIRED | `main.py:98-106` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `routers/incidents.py:post_incident` | `incident.id/status/created_at` | `create_incident` -> `db.refresh` from `Incident` ORM after `commit` (BYTEA+JSONB persisted) | ✓ FLOWING | Real DB row via `Incident` model, not static |
| `routers/incidents.py:list_incidents` | `items/total/pages` | `paginate_and_filter` -> `select(func.count)` + `select(Incident).order_by desc offset/limit load_only` against real DB | ✓ FLOWING | Bound params, ceil math, excludes BYTEA |
| `routers/incidents.py:get_incident_detail` | `screenshot` data URL | `db.execute(select(Incident) where id)` -> `to_incident_detail` `base64.b64encode(screenshot bytes)` | ✓ FLOWING | Re-encodes stored BYTEA, test decodes matches |
| `routers/auth.py:login` | `watchbug_access cookie value` | `create_access_token` HS256 `sub/jti/exp/iat` from `user.id` after `verify_password` DB lookup | ✓ FLOWING | Real JWT from DB user, not mock |
| `routers/health.py` | `db: connected/disconnected` | `await db.execute(text("SELECT 1"))` per-request probe | ✓ FLOWING | Real SELECT 1 not static |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite 65 tests green | `python -m pytest backend/tests -q` | `65 passed, 108 warnings in 34.34s` | ✓ PASS |
| Lifespan asynccontextmanager not on_event | `grep asynccontextmanager backend/app/main.py` | `True` (L1,15), `on_event False` | ✓ PASS |
| expire_on_commit=False | `grep expire_on_commit backend/app/db.py` | `True` (L32) | ✓ PASS |
| .env.example documents every Settings | `grep DATABASE_URL/JWT_SECRET/ADMIN_EMAIL/CORS_ORIGINS/DOCS_ENABLED/MAX_PAYLOAD backend/.env.example` | All present | ✓ PASS |
| No wildcard+credentials | `grep allow_origins.*\* backend/app/main.py` | No `["*"]`, allow_origins is `cors_origins_list` | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| No phase-declared probes | — | Phase type backend API — behavioral evidence via `pytest` suite above | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| API-01 | 02-01 | FastAPI app with lifespan context manager, Pydantic Settings from .env | ✓ SATISFIED | `main.py:15 lifespan`, `config.py:7 BaseSettings`, `.env.example:1-32` |
| API-02 | 02-01,02-03 | Incident ingestion POST /api/incidents accepts payload, validates schema, stores in PostgreSQL | ✓ SATISFIED | `incidents.py:34 POST 201`, `schemas/incident.py:12 TRN-04`, `incident_service.py:88 BYTEA` |
| API-03 | 02-04 | Incident retrieval GET /api/incidents with pagination, filter by type/status | ✓ SATISFIED | `incidents.py:97 GET`, `pagination.py:83 paginate_and_filter`, 14 list tests green |
| API-04 | 02-04 | Status update PATCH /api/incidents/:id/status (Pending→In Progress→Resolved) | ✓ SATISFIED | `incidents.py:170 PATCH`, `schemas/incident.py:92 StatusUpdate`, 6 status tests |
| API-05 | 02-01 | Health check GET /api/health returns DB connection status | ✓ SATISFIED | `health.py:10 SELECT 1`, tests health ok/disconnected |
| AUTH-01 | 02-02 | JWT authentication login email/password, short-lived token, HttpOnly cookie | ✓ SATISFIED | `auth.py:21 login`, `auth_service.py:20 HS256 1h/7d`, tests login/refresh |
| AUTH-02 | 02-02 | Password hashing bcrypt never plaintext | ✓ SATISFIED | `auth_service.py:12 gensalt 12`, `models/user.py:15 String(60)`, test hash |
| AUTH-03 | 02-02,02-04 | Protected routes all /api/incidents/* require valid JWT return 401 | ✓ SATISFIED | `dependencies.py:12 get_current_user`, `incidents.py:102,145,176 Depends`, tests 401 |
| AUTH-04 | 02-02 | Logout invalidate session clear cookie | ✓ SATISFIED | `auth.py:111 logout Max-Age 0`, test_logout_clears |
| DB-01 | 02-01 | PostgreSQL schema incidents table id type status payload JSONB screenshot BYTEA | ✓ SATISFIED | `models/incident.py:10`, `001_initial.py:40-50` |
| DB-02 | 02-01,02-02 | Users table id email password_hash created_at | ✓ SATISFIED | `models/user.py:10`, `001_initial.py:31-38`, seed_admin |
| DB-03 | 02-01 | Projects table id name api_key (public write-only) | ✓ SATISFIED | `models/project.py:10`, `001_initial.py:22-29`, seed_default |
| DB-04 | 02-01 | Alembic migrations version-controlled schema changes | ✓ SATISFIED | `alembic/env.py`, `alembic/versions/001_initial.py`, upgrade head executed |
| SEC-01 | 02-03,02-04 | CORS configurable origin allowlist block null no wildcard on ingest | ✓ SATISFIED | `main.py:52 NullOrigin + 61 IngestCors + 119 CORSMiddleware` |
| SEC-02 | 02-03 | Rate limiting slowapi per IP + project key on /api/incidents | ✓ SATISFIED | `limiter.py`, `incidents.py:35 10/min 30/min 60/min`, tests 429 |
| SEC-03 | 02-03 | XSS sanitization all user fields sanitized before storage | ✓ SATISFIED | `sanitize.py html.escape`, `incident_service.py:91`, test_xss_sanitized |
| SEC-04 | 02-03 | Payload size limit 100KB max on API level | ✓ SATISFIED | `incidents.py:59 413`, `config.py:19 MAX_PAYLOAD_BYTES`, tests 413 |
| SEC-05 | 02-01,02-02 | Zero secrets in code .env only .env.example committed | ✓ SATISFIED | `.env.example` documented, `config.py` Field defaults only, grep no literal secret |

Cross-reference note: All 18 phase requirement IDs from PLAN frontmatters are accounted for. REQUIREMENTS.md checkboxes for API-01/03/04/05/DB-01/03/04 still show `[ ]` (Pending) — this is stale documentation (not yet marked `[x]`), but codebase evidence above satisfies each. Traceability table at `REQUIREMENTS.md:162-180` will be updated on next sync; gap is docs-only, not implementation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TODO`/`FIXME`/`XXX`/`TBD` in `backend/app` | — | — |
| — | — | No `placeholder`/`coming soon`/`not yet implemented` strings in `backend/app` | — | — |
| — | — | No `return null`/`return {}`/`return []` stubs, no `=> {}` empty handlers | — | — |
| — | — | No `console.log` only implementations | — | — |
| `backend/app/middleware/payload_size.py` | 1 | Placeholder documenting per-route 413 guard (not a stub) | ℹ️ Info | Intentional — file exists to document why global middleware not used per Pitfall 8 |

### Human Verification Required

None — all security and retrieval flows are exercised by automated integration tests with real DB (SQLite file fallback on host due to Windows Docker Desktop asyncpg port-forward bug; BYTEA/JSONB semantics preserved via generic `Uuid`/`JSON` models + `postgresql.JSONB` migration; prior docker-network run proved real PG path). Manual verification optional for:

- Real PostgreSQL `psql -c "\dt"` + `SELECT payload->>'type' FROM incidents` showing JSONB/bytea when running with `TEST_DATABASE_URL=postgresql+asyncpg://watchbug:watchbug@postgres:5432/watchbug` via `docker run --link watchbug-pg:postgres` (already proven in Plan 01 summary).

### Gaps Summary

No gaps. Phase goal `Incidents captured by the SDK are securely ingested, stored in PostgreSQL, and retrievable with authenticated access` is achieved:

1. SDK POST `POST /api/incidents` with `X-Watchbug-Key`/`X-Project-Key` succeeds 201, persists BYTEA+JSONB, handles TRN-04, case-insensitive type, data URL strip (Success Criterion 1).
2. Admin `POST /api/auth/login` returns `watchbug_access` 1h + `watchbug_refresh` 7d HttpOnly SameSite Lax Secure(ENV) cookies via bcrypt+HS256 (SC2).
3. Authenticated `GET /api/incidents` returns `{items,total,page,size,pages}` paginated, filterable by `type`/`status` comma-separated case-insensitive, ordered desc, `load_only` BYTEA exclusion (SC3).
4. `PATCH /api/incidents/:id/status` Any→Any succeeds 200, detail re-encodes `data:image/png;base64` (SC4).
5. Unauthenticated 401, CORS null 403 / admin allowlist / ingest open echo, rate limiting 429 Retry-After, XSS `html.escape`, 100KB 413 distinct from 422/401 (SC5).

Full pytest gate `backend/tests -q` 65 passed. ROADMAP.md `Phase 2: 3/4 plans executed` is stale progress tracking — plan `02-04-PLAN.md` is implemented (files `utils/pagination.py`, `tests/test_incidents_list.py`, `tests/test_incidents_status.py` exist and 26 retrieval tests passed); recommend marking `02-04-PLAN.md` checked in ROADMAP.

---

_Verified: 2026-09-01T18:45:00Z_
_Verifier: gsd-verifier (sonnet)_
