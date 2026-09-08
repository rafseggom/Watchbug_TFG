---
phase: 04-docker-deployment
plan: 01
subsystem: infra
tags: [docker, compose, postgresql, multi-stage, fastapi, uvicorn, alembic]

# Dependency graph
requires:
  - phase: 02-backend-api
    provides: FastAPI app with health endpoint, alembic migrations, asyncpg driver
  - phase: 03-admin-panel
    provides: Vite SPA panel built to backend/api/static/panel/
provides:
  - Multi-stage Dockerfile (Node 22-alpine builder + python:3.12-slim runtime)
  - docker-compose.yml with health-gated PostgreSQL 16-alpine + named volume
  - docker-entrypoint.sh with alembic auto-migration before uvicorn
  - .dockerignore for build context hygiene
affects: [04-docker-deployment plan 02]

# Actuals
actuals:
  tokens: 1281
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: [docker, docker-compose, postgres:16-alpine, python:3.12-slim-bookworm, node:22-alpine]
  patterns: [multi-stage-build, health-gated-depends-on, entrypoint-auto-migrate, non-root-container]

key-files:
  created:
    - Dockerfile
    - docker-compose.yml
    - docker-entrypoint.sh
    - .dockerignore
  modified: []

key-decisions:
  - "Single multi-stage Dockerfile with Node builder for panel + Python runtime per D-01"
  - "PostgreSQL 16-alpine pinned per D-02 for size and stability"
  - "Entrypoint runs alembic upgrade head before uvicorn per D-03"
  - "Non-root user app (UID 10001) with curl for HEALTHCHECK"
  - "PYTHONPATH=/app added to fix alembic module resolution in container"
  - "DB port remapped to 5433:5432 to avoid conflict with host PostgreSQL on 5432"

patterns-established:
  - "Multi-stage Dockerfile: Node builder for SPA → Python runtime with COPY --from"
  - "Compose health-gated depends_on: pg_isready + service_healthy condition"
  - "Entrypoint pattern: set -eu + alembic upgrade head + exec uvicorn --workers 1"
  - ".dockerignore mirrors .gitignore with Docker-specific additions"

requirements-completed: [DEP-01, DEP-02, DEP-05]

coverage:
  - id: D1
    description: "Multi-stage Dockerfile builds panel in Node stage and runs FastAPI in Python runtime"
    requirement: DEP-02
    verification:
      - kind: integration
        ref: "docker build -t watchbug:test . && docker run --rm --entrypoint sh watchbug:test -c 'test -f /app/api/static/panel/index.html && echo OK'"
        status: pass
    human_judgment: false
  - id: D2
    description: "docker-compose.yml with health-gated PostgreSQL and bridge DNS networking"
    requirement: DEP-01
    verification:
      - kind: integration
        ref: "docker compose config --quiet && docker compose up -d --build && docker compose ps shows healthy"
        status: pass
    human_judgment: false
  - id: D3
    description: "Entrypoint auto-migrates DB and starts uvicorn with single worker"
    requirement: DEP-05
    verification:
      - kind: integration
        ref: "docker compose logs api shows 'Applying Alembic migrations' then 'Uvicorn running'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Non-root runtime image with curl and HEALTHCHECK"
    requirement: DEP-02
    verification:
      - kind: integration
        ref: "docker run --rm --entrypoint sh watchbug:test -c 'whoami && id -u'"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan 1: Docker Stack Tracer Summary

**Multi-stage Dockerfile (Node 22-alpine → python:3.12-slim) with health-gated PostgreSQL 16-alpine, auto-migration entrypoint, and non-root runtime proving single-command `docker compose up` boots both services healthy**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-08T19:34:42Z
- **Completed:** 2026-09-08T19:42:00Z
- **Tasks:** 2 (1 tracer + 1 auto; Task 3 was verification-only)
- **Files created:** 4

## Accomplishments

- Multi-stage Dockerfile builds panel SPA in Node 22-alpine builder, copies to python:3.12-slim runtime at /app/api/static/panel
- docker-compose.yml with Compose Spec (no version:), health-gated PostgreSQL 16-alpine, bridge DNS @db:5432, loopback port binding
- docker-entrypoint.sh runs alembic upgrade head before exec uvicorn --workers 1
- .dockerignore reduces build context to 674B, excludes .env and secrets (SEC-04)
- Full stack boots with `docker compose up -d --build`: db healthy in ~20s, api healthy in ~60s, /api/health returns db:connected, /panel returns 200

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end tracer** - `7c67f97` (feat) — Dockerfile, docker-compose.yml, docker-entrypoint.sh
2. **Task 2: Harden runtime image** - `0de6830` (chore) — .dockerignore
3. **Task 3: Verify compose spec** - (verification-only, no file changes)

**Plan metadata:** `docs(04-01): complete plan` (pending)

## Files Created/Modified

- `Dockerfile` — Multi-stage build: Node 22-alpine panel-builder → python:3.12-slim runtime with non-root user, curl, HEALTHCHECK
- `docker-compose.yml` — Compose Spec with db (postgres:16-alpine, pg_isready healthcheck) and api (depends_on service_healthy, init:true)
- `docker-entrypoint.sh` — POSIX shell: alembic upgrade head → exec uvicorn --workers 1
- `.dockerignore` — Excludes .env, node_modules, .git, .venv, __pycache__, panel/dist

## Decisions Made

- Used `PYTHONPATH=/app` in Dockerfile to fix alembic module resolution (`from app.models import Base`)
- Remapped db port to `127.0.0.1:5433:5432` to avoid conflict with host PostgreSQL on 5432
- Kept `curl -f` healthcheck (not strict JSON probe) per RESEARCH Resolved Question 1 (infra-only, no API contract change)
- Non-root user app (UID 10001) with curl installed for HEALTHCHECK probe

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added PYTHONPATH=/app to Dockerfile**
- **Found during:** Task 1 (tracer execution)
- **Issue:** alembic env.py imports `from app.models import Base` but Python path didn't include /app, causing ModuleNotFoundError
- **Fix:** Added `ENV PYTHONPATH=/app` to Dockerfile runtime stage ENV block
- **Files modified:** Dockerfile
- **Verification:** docker compose logs api shows successful alembic migration
- **Committed in:** 7c67f97 (Task 1 commit)

**2. [Rule 3 - Blocking] Remapped db port to 5433:5432**
- **Found during:** Task 1 (docker compose up)
- **Issue:** Host PostgreSQL already using port 5432, causing bind error
- **Fix:** Changed db ports from `127.0.0.1:5432:5432` to `127.0.0.1:5433:5432`
- **Files modified:** docker-compose.yml
- **Verification:** docker compose up succeeds, both services healthy
- **Committed in:** 7c67f97 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

- Host PostgreSQL occupied port 5432 — resolved by remapping to 5433 (non-functional change, compose-internal)
- Python module path not set in container — resolved by adding PYTHONPATH env var

## Known Stubs

None — all artifacts are fully functional.

## User Setup Required

None — no external service configuration required. To run:
```bash
docker compose up -d --build
# API: http://localhost:8000
# Panel: http://localhost:8000/panel/
# Health: http://localhost:8000/api/health
```

## Next Phase Readiness

- Docker stack fully functional with single `docker compose up -d --build`
- Panel served at /panel with no manual npm build required
- Database auto-migrated on first boot, persists across restarts
- Ready for Plan 04-02 (documentation and polish)

## Self-Check: PASSED

- All created files verified present: Dockerfile, docker-compose.yml, docker-entrypoint.sh, .dockerignore, SUMMARY.md
- All commits verified in git log: 7c67f97, 0de6830

---
*Phase: 04-docker-deployment*
*Completed: 2026-09-08*
