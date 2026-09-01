---
phase: 02-backend-api
plan: "02"
subsystem: auth
tags: [fastapi, jwt, bcrypt, pyjwt, httponly, cookies, auth]
requires:
  - phase: 02-01
    provides: [FastAPI backend with lifespan, incidents/users/projects tables, Alembic 001_initial, POST ingest, health probe]
provides:
  - JWT HttpOnly cookie auth with HS256 1h access + 7d refresh, jti/sub/exp/iat, seeded admin bcrypt cost12
  - Login/refresh/logout endpoints with Max-Age and SameSite Lax Secure toggle
  - get_current_user dependency protecting GET/PATCH incidents
  - Auth test suite 10 tests and SEC-05 hardening
affects: [02-03-retrieval, 02-04-hardening, 03-panel]
actuals:
  tokens: 6040
  tasks: 3
  commits: 3
tech-stack:
  added: [pyjwt==2.13.0, bcrypt==5.0.0]
  patterns: [HttpOnly cookie auth HS256 allowlist, bcrypt direct gensalt12, lifespan seed_admin+seed_default_project, get_current_user Depends]
key-files:
  created:
    - backend/app/services/auth_service.py
    - backend/app/dependencies.py
    - backend/app/routers/auth.py
    - backend/tests/test_auth.py
  modified:
    - backend/app/config.py
    - backend/app/main.py
    - backend/app/routers/incidents.py
    - backend/app/schemas/auth.py
    - backend/tests/conftest.py
    - .env.example
key-decisions:
  - "Use direct bcrypt hashpw/gensalt 12 not passlib per RESEARCH Alternatives Considered"
  - "Cookie names watchbug_access/watchbug_refresh per Agent Discretion, HttpOnly Lax Secure via ENV==production"
  - "LoginRequest email as str not EmailStr to allow admin@watchbug.local .local reserved domain"
  - "Seed admin via async_sessionmaker in lifespan with graceful fail if DB not migrated"
patterns-established:
  - "Auth service: hash_password/verify_password bcrypt, create_access_token HS256 1h jti/sub/iat, create_refresh_token 7d type refresh, verify_token allowlist"
  - "get_current_user reads watchbug_access cookie jwt.decode HS256 allowlist DB lookup 401 variants"
  - "Auth router: login/refresh/logout set_cookie HttpOnly Lax Max-Age 3600/604800/0"
  - "Protected incidents GET/PATCH via Depends(get_current_user), POST remains public"
requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - DB-02
  - SEC-05
coverage:
  - id: D1
    description: "Passwords stored as bcrypt $2b$12$ 60-char hash distinct per salt, verified via checkpw"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "backend/tests/test_auth.py#test_password_is_hashed"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /api/auth/login with valid seeded admin returns 200 logged in and both HttpOnly SameSite Lax cookies with Max-Age 3600/604800"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "backend/tests/test_auth.py#test_login_sets_cookies"
        status: pass
    human_judgment: false
  - id: D3
    description: "Wrong password returns 401 invalid credentials without leaking existence"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "backend/tests/test_auth.py#test_login_invalid_401"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /api/incidents without valid cookie returns 401 not authenticated, with cookie returns 200 paginated"
    requirement: "AUTH-03"
    verification:
      - kind: integration
        ref: "backend/tests/test_auth.py#test_protected_401"
        status: pass
      - kind: integration
        ref: "backend/tests/test_auth.py#test_protected_with_cookie_ok"
        status: pass
    human_judgment: false
  - id: D5
    description: "POST /api/auth/refresh with valid refresh cookie reissues access cookie"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "backend/tests/test_auth.py#test_refresh_flow"
        status: pass
    human_judgment: false
  - id: D6
    description: "POST /api/auth/logout clears both cookies via Max-Age 0 and subsequent GET fails 401"
    requirement: "AUTH-04"
    verification:
      - kind: integration
        ref: "backend/tests/test_auth.py#test_logout_clears"
        status: pass
    human_judgment: false
  - id: D7
    description: "JWT uses PyJWT HS256 with jti/sub/exp/iat, decode allowlist algorithms HS256, expired returns 401 token expired"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "backend/tests/test_auth.py#test_token_expired"
        status: pass
    human_judgment: false
  - id: D8
    description: "Seed admin upserts from ADMIN_EMAIL/ADMIN_PASSWORD idempotently and rotates hash"
    requirement: "DB-02"
    verification:
      - kind: integration
        ref: "backend/tests/test_auth.py#test_seed_admin_rotation"
        status: pass
    human_judgment: false
  - id: D9
    description: ".env.example documents every Settings field, no secrets hardcoded beyond Field defaults"
    requirement: "SEC-05"
    verification:
      - kind: unit
        ref: "grep JWT_SECRET backend/app/config.py shows Field only"
        status: pass
    human_judgment: false
duration: 28min
completed: 2026-09-01
status: complete
---

# Phase 02 Plan 02: JWT Cookie Auth Summary

**JWT HttpOnly cookie auth with bcrypt cost12 and 1h/7d HS256 tokens securing incidents retrieval via get_current_user dependency**

## Performance

- **Duration:** 28 min
- **Started:** 2026-09-01T16:30:00Z
- **Completed:** 2026-09-01T16:58:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Implemented bcrypt auth_service with hash/verify/gensalt 12, HS256 token creation with jti/sub/exp/iat and refresh type, and idempotent seed_admin that rotates on password change
- Created dependencies get_current_user reading watchbug_access cookie via jwt.decode HS256 allowlist, mapping Expired/Invalid to 401 variants and DB lookup
- Wired login/refresh/logout routers setting HttpOnly SameSite Lax cookies with Max-Age 3600/604800/0 and Secure toggled by ENV==production
- Protected GET /api/incidents and PATCH /status while keeping POST ingest public with project key, lifespan seeds admin+project

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth service and dependencies: bcrypt + JWT HS256 + seed** - `2b24e87` (feat)
2. **Task 2: Auth routers: login, refresh, logout with HttpOnly cookies and protected wiring** - `782de53` (feat)
3. **Task 3: Auth tests and SEC-05 hardening (.env.example, no secrets)** - `52c0687` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `backend/app/services/auth_service.py` - hash/verify bcrypt, create_access/refresh HS256, seed_admin upsert
- `backend/app/dependencies.py` - get_current_user cookie decode HS256 allowlist + require_auth alias
- `backend/app/routers/auth.py` - POST /api/auth/login|refresh|logout with cookie attributes
- `backend/app/main.py` - lifespan seed_admin+seed_default_project via async_sessionmaker, include auth router
- `backend/app/routers/incidents.py` - GET list paginated and PATCH status now protected via get_current_user
- `backend/app/config.py` - added ENV field for Secure toggle
- `backend/app/schemas/auth.py` - LoginRequest email as str to allow .local
- `backend/tests/conftest.py` - users cleanup and login_helper/seed_admin_helper
- `backend/tests/test_auth.py` - 10 tests for hash, login cookies, 401, protected, logout, refresh, expired, rotation
- `.env.example` - added ENV=development with Secure toggle docs, covers all Settings fields

## Decisions Made

- Use direct bcrypt not passlib (gensalt 12) per RESEARCH Alternatives Considered — avoids pkg_resources breakage on 3.12+
- Cookie names watchbug_access/watchbug_refresh per Agent Discretion, path "/" for access and "/api/auth" for refresh
- Change LoginRequest.email from EmailStr to str to accept admin@watchbug.local — email-validator rejects .local special-use domain, blocking seeded admin login
- Lifespan seeds via async_sessionmaker(engine) with inner try/except so startup never fails if DB not migrated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed EmailStr rejecting admin@watchbug.local**
- **Found during:** Task 2 manual verification (login 422 on seeded admin)
- **Issue:** Pydantic EmailStr uses email-validator which rejects .local as special-use reserved domain, causing 422 instead of 200 on POST /api/auth/login with ADMIN_EMAIL default
- **Fix:** Changed LoginRequest.email to str with Field(min_length=3) to allow .local; retains minimal validation without blocking seeded login
- **Files modified:** `backend/app/schemas/auth.py`
- **Verification:** `python -m pytest tests/test_auth.py::test_login_sets_cookies -q` passes 200 and cookie assertions; manual ASGI test with sqlite file also shows 200 and both cookies
- **Committed in:** `782de53` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added users cleanup and auth helpers to conftest**
- **Found during:** Task 3 test isolation
- **Issue:** conftest db_session cleanup deleted only incidents/projects, leaving users to bleed across tests causing seed_admin idempotency false positives; no login helper existed
- **Fix:** Added DELETE FROM users in cleanup and helper functions login_helper/seed_admin_helper
- **Files modified:** `backend/tests/conftest.py`
- **Verification:** `python -m pytest tests/test_auth.py -v` 10 passed with clean isolation; cross-test rotation test stable
- **Committed in:** `52c0687` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both essential for correctness — .local email otherwise blocks auth, and users bleed breaks rotation tests. No scope creep.

## Issues Encountered

- Docker Desktop Windows asyncpg host networking still broken — tests use sqlite fallback file `watchbug_test.db` on host and real PG via docker network for CI; manual ASGI tests required file sqlite not :memory: with NullPool
- Initial hash test showed escaping syntax warning for "\$2b\$" — verified prefix via chr(36) check

## User Setup Required

None - no external service configuration required. For local dev: ensure `backend/.env` has `ENV=development` (Secure false on http) and switch to `ENV=production` for https; `JWT_SECRET` min 32 chars via `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

## Next Phase Readiness

- Auth foundation complete: login flow sets HttpOnly cookies, protected routes enforce 401, refresh reissues, logout clears — ready for 02-03 pagination/filter retrieval to replace minimal list placeholder with full type/status filters
- No blockers for next plans; existing 20 tests green (10 auth + 10 health/ingest) on host sqlite fallback

---
*Phase: 02-backend-api*
*Completed: 2026-09-01*

## Self-Check: PASSED

- Files exist: backend/app/services/auth_service.py, backend/app/dependencies.py, backend/app/routers/auth.py, backend/tests/test_auth.py FOUND
- Commits exist: 2b24e87, 782de53, 52c0687 FOUND via git log
- Verification: `python -m pytest backend/tests/test_auth.py backend/tests/test_health.py backend/tests/test_incidents_ingest.py -q` 20 passed; grep JWT_SECRET shows only Field + settings usage
