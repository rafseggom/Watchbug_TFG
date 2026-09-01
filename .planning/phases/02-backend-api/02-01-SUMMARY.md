---
phase: 02-backend-api
plan: "01"
subsystem: api
tags: [fastapi, sqlalchemy, asyncpg, alembic, pydantic, postgres, jwt, bcrypt]
requires:
  - phase: 01-sdk-core
    provides: [SDK transport sender with X-Watchbug-Key, validation TRN-04, ReportPayload schema]
provides:
  - FastAPI backend with lifespan asynccontextmanager and async DB
  - Incident/User/Project tables with UUID JSONB BYTEA and Alembic 001_initial
  - POST /api/incidents ingest with project key auth and 201 response
  - GET /api/health with SELECT 1 probe
  - Pydantic Settings from .env with .env.example
affects: [02-02-auth, 02-03-retrieval, 02-04-hardening, 03-panel, 04-docker]
actuals:
  tokens: 8400
  tasks: 3
  commits: 3
tech-stack:
  added: [fastapi==0.141.1, pydantic==2.13.5, pydantic-settings==2.15.0, sqlalchemy[asyncio]==2.0.52, asyncpg==0.31.0, alembic==1.19.1, pyjwt==2.13.0, bcrypt==5.0.0, slowapi==0.1.10, httpx, email-validator, aiosqlite]
  patterns: [lifespan asynccontextmanager, Settings BaseSettings lru_cache, AsyncEngine expire_on_commit=False, Uuid/JSON generic models, Pydantic field_validator type normalize + TRN-04, BYTEA LargeBinary decode, dual header X-Watchbug-Key/X-Project-Key]
key-files:
  created:
    - backend/pyproject.toml
    - backend/app/main.py
    - backend/app/config.py
    - backend/app/db.py
    - backend/app/models/incident.py
    - backend/app/models/user.py
    - backend/app/models/project.py
    - backend/app/models/__init__.py
    - backend/app/schemas/incident.py
    - backend/app/schemas/auth.py
    - backend/app/schemas/common.py
    - backend/app/services/incident_service.py
    - backend/app/services/project_service.py
    - backend/app/routers/health.py
    - backend/app/routers/incidents.py
    - backend/alembic.ini
    - backend/alembic/env.py
    - backend/alembic/script.py.mako
    - backend/alembic/versions/001_initial.py
    - backend/tests/conftest.py
    - backend/tests/test_health.py
    - backend/tests/test_incidents_ingest.py
    - .env.example
  modified: []
key-decisions:
  - "Use generic Uuid/JSON in models for sqlite test compat while migration keeps JSONB/UUID for Postgres"
  - "Add validate_default=True on consoleLogs field to ensure TRN-04 fires when Bug missing logs"
  - "Run Alembic upgrade via docker network due to Windows Docker Desktop asyncpg port-forward bug"
  - "Conftest sqlite fallback for host tests when asyncpg localhost unreachable, real PG verified via docker"
patterns-established:
  - "Lifespan asynccontextmanager with engine dispose"
  - "Settings(BaseSettings) with SettingsConfigDict and computed cors_origins_list"
  - "AsyncEngine expire_on_commit=False with get_db dependency"
  - "IncidentCreate type normalize + consoleLogs TRN-04 via field_validator"
  - "BYTEA LargeBinary decode with data: prefix strip and validate=True"
  - "Project key dual header resolve via Starlette normalized headers"
requirements-completed:
  - API-01
  - API-02
  - API-05
  - DB-01
  - DB-02
  - DB-03
  - DB-04
  - SEC-05
coverage:
  - id: D1
    description: "FastAPI app with lifespan asynccontextmanager, Settings from .env, AsyncEngine expire_on_commit=False"
    requirement: "API-01"
    verification:
      - kind: integration
        ref: "backend/tests/test_health.py#test_health_ok"
        status: pass
      - kind: automated_ui
        ref: "grep -c asynccontextmanager backend/app/main.py"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /api/incidents accepts SDK contract X-Watchbug-Key, Bug/Feedback validation, BYTEA decode, returns 201"
    requirement: "API-02"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_create_bug_success"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_feedback_without_logs_ok"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_create_bug_lowercase_normalized"
        status: pass
    human_judgment: false
  - id: D3
    description: "TRN-04 validation: Bug without consoleLogs returns 422 loc body.consoleLogs"
    requirement: "API-02"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_bug_without_logs_422"
        status: pass
    human_judgment: false
  - id: D4
    description: "Project key auth: missing/invalid key returns 401 invalid project key, alias X-Project-Key works"
    requirement: "API-02"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_invalid_project_key_401"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_fallback_header_alias"
        status: pass
    human_judgment: false
  - id: D5
    description: "GET /api/health public returns {status: ok, db: connected|disconnected} with SELECT 1 probe"
    requirement: "API-05"
    verification:
      - kind: integration
        ref: "backend/tests/test_health.py#test_health_ok"
        status: pass
      - kind: integration
        ref: "backend/tests/test_health.py#test_health_db_disconnected"
        status: pass
    human_judgment: false
  - id: D6
    description: "DB schema: incidents/users/projects with UUID PK, JSONB/JSON payload, BYTEA screenshot, FK"
    requirement: "DB-01"
    verification:
      - kind: integration
        ref: "docker exec watchbug-pg psql -c \"\\dt\" shows 4 tables"
        status: pass
      - kind: integration
        ref: "python -c \"from app.models import Base; print(Base.metadata.tables.keys())\" contains 3 tables"
        status: pass
    human_judgment: false
  - id: D7
    description: "Alembic async env.py with Base.metadata, 001_initial creates 3 tables, upgrade head idempotent"
    requirement: "DB-04"
    verification:
      - kind: integration
        ref: "docker run --link watchbug-pg:postgres python -m alembic upgrade head"
        status: pass
      - kind: integration
        ref: "docker exec watchbug-pg psql -c \"SELECT to_regclass('public.incidents')\""
        status: pass
    human_judgment: false
  - id: D8
    description: ".env.example documents all Settings fields, no secrets hardcoded in backend/app"
    requirement: "SEC-05"
    verification:
      - kind: unit
        ref: "grep JWT_SECRET backend/app/config.py shows Field definition only"
        status: pass
    human_judgment: false
duration: 35min
completed: 2026-09-01
status: complete
---

# Phase 02 Plan 01: Tracer Backend Slice Summary

**End-to-end FastAPI tracer with lifespan, async Postgres, BYTEA ingest, and health probe — proves DB persistence via 10 green tests**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-01T15:28:00Z
- **Completed:** 2026-09-01T16:25:00Z
- **Tasks:** 3
- **Files modified:** 28

## Accomplishments

- Scaffolded FastAPI backend from zero: pyproject, Settings, AsyncEngine, lifespan, CORS, routers
- Created 3 tables (incidents, users, projects) with UUID PK, JSON payload, BYTEA screenshot, FK; Alembic 001_initial applied via docker network
- Implemented POST /api/incidents public ingest with dual header, TRN-04 validation, Base64→BYTEA, sanitize hook, 201 {id,status,created_at}
- Implemented GET /api/health public probe with SELECT 1 → connected/disconnected
- Delivered test harness with 10 tests covering Bug/Feedback, 422, 401, alias header, screenshot encoding, health — green on host (sqlite fallback) and docker (real PG)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end tracer: scaffold + lifespan + DB + health + minimal ingest** - `81cdf7d` (feat)
2. **Task 2: Alembic async setup and blocking schema push + seed** - `33522e1` (feat)
3. **Task 3: Test harness and tracer verification** - `bbdcfe2` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `backend/pyproject.toml` - project manifest with fastapi[standard] sqlalchemy asyncpg alembic pyjwt bcrypt slowapi
- `backend/app/config.py` - Settings BaseSettings with computed cors_origins_list lru_cache
- `backend/app/db.py` - Base DeclarativeBase, AsyncEngine expire_on_commit=False, get_db
- `backend/app/models/incident.py` - Incident Uuid PK type/status payload JSON screenshot LargeBinary project_id FK
- `backend/app/models/user.py` - User Uuid PK email unique password_hash
- `backend/app/models/project.py` - Project Uuid PK name api_key unique
- `backend/app/models/__init__.py` - re-exports Base+models for Alembic autogenerate
- `backend/app/schemas/incident.py` - ConsoleEntry + IncidentCreate with type normalize + TRN-04 + metadata check
- `backend/app/schemas/auth.py` - LoginRequest EmailStr + MessageResponse
- `backend/app/schemas/common.py` - PaginatedResponse
- `backend/app/services/incident_service.py` - sanitize, decode_screenshot, create_incident
- `backend/app/services/project_service.py` - resolve_project dual header + seed_default_project
- `backend/app/routers/health.py` - GET /api/health SELECT 1 probe
- `backend/app/routers/incidents.py` - POST /api/incidents 201/401/422 + GET/PATCH stubs
- `backend/app/main.py` - FastAPI lifespan asynccontextmanager CORS docs gated
- `backend/alembic.ini` - alembic config overridden by env.py
- `backend/alembic/env.py` - async env with Base.metadata and Windows selector fix
- `backend/alembic/script.py.mako` - migration template
- `backend/alembic/versions/001_initial.py` - op.create_table for 3 tables with JSONB BYTEA
- `backend/tests/conftest.py` - fixtures async_client db_session seeded_project with PG/sqlite fallback
- `backend/tests/test_health.py` - health connected/disconnected tests
- `backend/tests/test_incidents_ingest.py` - 8 ingest tests per validation map
- `.env.example` - documents DATABASE_URL JWT_SECRET ADMIN_* CORS_ORIGINS DOCS_ENABLED MAX_PAYLOAD_BYTES
- `backend/.env` - dev env (not committed, gitignored)

## Decisions Made

- Use generic `Uuid`/`JSON` in SQLAlchemy models for sqlite test compat while keeping `JSONB`/`UUID` in Alembic migration for Postgres production — proven via `Base.metadata.create_all` on both dialects
- Add `Field(validate_default=True)` on `consoleLogs` to ensure TRN-04 validator fires when Bug missing logs (Pydantic v2 default skip fix)
- Run Alembic upgrade via `docker run --link watchbug-pg:postgres` due to Windows Docker Desktop port-forward bug where host asyncpg gets `ConnectionDoesNotExistError` (Proactor + port forward)
- Implement conftest sqlite fallback (temp file `watchbug_test.db`) for host development when PG unreachable, while documenting real PG verification via docker
- Keep `.env` not committed (gitignored) per SEC-04, only `.env.example` committed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Pydantic TRN-04 validator not firing for missing consoleLogs**
- **Found during:** Task 3 (test harness)
- **Issue:** `consoleLogs` field with `None` default did not trigger `field_validator` when missing, causing Bug without logs to return 201 instead of 422
- **Fix:** Added `Field(default=None, validate_default=True)` and verified `info.data` contains type; switched to ensure validator runs
- **Files modified:** `backend/app/schemas/incident.py`
- **Verification:** `python -m pytest tests/test_incidents_ingest.py::test_bug_without_logs_422 -xvs` now passes 422 with loc consoleLogs
- **Committed in:** `bbdcfe2` (Task 3 commit)

**2. [Rule 1 - Bug] Fixed SQLAlchemy JSONB compile error on SQLite fallback**
- **Found during:** Task 3 (test harness on host)
- **Issue:** `postgresql.JSONB` and `postgresql.UUID` don't render on SQLite dialect, causing `CompileError` during `create_all` for sqlite fallback
- **Fix:** Changed models to use generic `Uuid` and `JSON` (sqlalchemy generic) which render as UUID/JSON on Postgres and TEXT on SQLite; kept migration with `postgresql.JSONB` for production
- **Files modified:** `backend/app/models/incident.py`, `backend/app/models/project.py`, `backend/app/models/user.py`
- **Verification:** `python -m pytest tests/test_health.py tests/test_incidents_ingest.py -v` 10 passed on host and via docker
- **Committed in:** `bbdcfe2` (Task 3 commit)

**3. [Rule 3 - Blocking] Handled Docker Desktop Windows asyncpg host networking failure**
- **Found during:** Task 2 (alembic upgrade)
- **Issue:** Host `asyncpg` connection to `localhost:5432` fails with `ConnectionDoesNotExistError` (Proactor + Docker port forward), blocking `alembic upgrade head` and `pytest` against real PG
- **Fix:** Ran `alembic upgrade head` and seed via `docker run --link watchbug-pg:postgres` with DATABASE_URL `postgres:5432`; added WindowsSelectorEventLoopPolicy in `alembic/env.py`; added sqlite fallback in `conftest.py` for host, with real PG verified via docker
- **Files modified:** `backend/alembic/env.py`, `backend/tests/conftest.py`
- **Verification:** `docker run --link watchbug-pg:postgres python -m alembic upgrade head` succeeded; `docker exec watchbug-pg psql -c "\dt"` shows 4 tables; `docker run --link ... pytest` 10 passed
- **Committed in:** `33522e1` (Task 2) and `bbdcfe2` (Task 3)

**4. [Rule 3 - Blocking] Fixed conftest sqlite in-memory isolation with NullPool**
- **Found during:** Task 3 (test harness)
- **Issue:** `sqlite+aiosqlite:///:memory:` with NullPool creates isolated DB per connection, so tables created in one connection not visible to session, causing `no such table: projects`
- **Fix:** Switched fallback to file `sqlite+aiosqlite:////tmp/watchbug_test.db` with `Base.metadata.create_all` and file cleanup
- **Files modified:** `backend/tests/conftest.py`
- **Verification:** Host `pytest` 10 passed after fix
- **Committed in:** `bbdcfe2`

---

**Total deviations:** 4 auto-fixed (2 bug, 2 blocking)
**Impact on plan:** All auto-fixes essential for correctness (TRN-04) and for making tracer runnable on Windows host where Docker Desktop networking breaks asyncpg. No scope creep; production PG path preserved.

## Issues Encountered

- Docker Desktop on Windows breaks host->container TCP for asyncpg (Proactor loop) — workaround via docker network for alembic/seed and sqlite fallback for host pytest. Documented as blocking deviation above.
- `backend/backend/` stray directory created during pip install — removed before Task 2 commit.
- `alembic revision --autogenerate` failed due to need for DB connection — hand-wrote `001_initial.py` per RESEARCH Partition 13; verified via `alembic upgrade head`.

## User Setup Required

None - no external service configuration required. For local dev:

- Copy `.env.example` to `backend/.env` (already present with dev secrets) — ensure `JWT_SECRET` ≥32 chars
- Ensure Docker Desktop running and `docker run -d --name watchbug-pg -e POSTGRES_USER=watchbug -e POSTGRES_PASSWORD=watchbug -e POSTGRES_DB=watchbug -p 5432:5432 postgres:16-alpine` before `alembic upgrade head` (or use `docker run --link` workaround on Windows)
- Run `python -m pytest backend/tests -v` (host) or `docker run --link watchbug-pg:postgres ... pytest` for real PG

## Next Phase Readiness

- Tracer proven: lifespan + async DB + BYTEA + migration + routing all green; ready for 02-02 (auth), 02-03 (retrieval), 02-04 (hardening) to layer on this foundation
- No blockers for next plans except Windows host networking — recommend documenting docker-based test command for CI
- `watchbug-pg` container running with seeded projects `wb_test_project_key_123` and `test-project-key-123` — idempotent seed verified

---
*Phase: 02-backend-api*
*Completed: 2026-09-01*

## Self-Check: PASSED

- Files exist: backend/pyproject.toml, backend/app/main.py, backend/app/config.py, backend/app/db.py, backend/app/models/incident.py, backend/tests/conftest.py, .env.example all FOUND
- Commits exist: 81cdf7d, 33522e1, bbdcfe2 FOUND via git log
- Verification: `python -m pytest backend/tests/test_health.py backend/tests/test_incidents_ingest.py -q` 10 passed (host sqlite fallback) and docker network 10 passed (real PG); `grep -c asynccontextmanager backend/app/main.py` >=1 and `grep -c on_event backend/app/main.py` ==0; `grep -c expire_on_commit=False backend/app/db.py` >=1
