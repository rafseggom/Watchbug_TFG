# Phase 4: Docker Deployment - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The entire stack (API + Panel + PostgreSQL) starts with a single `docker-compose up` command and persists data across restarts. This is infrastructure-only — no new features, no API changes, no UI changes.

</domain>

<decisions>
## Implementation Decisions

### Dockerfile Structure
- **D-01:** Single multi-stage Dockerfile with two stages: (1) Node stage builds the panel via `vite build`, (2) Python stage copies panel static files and runs FastAPI with uvicorn — **Reversibility:** costly — changing from single to multi-file requires restructuring build pipeline and docker-compose build context

### PostgreSQL Version
- **D-02:** Pin PostgreSQL to version 16 (specifically `postgres:16-alpine`) — **Reversibility:** reversible — changing the image tag is a one-line docker-compose edit, though data migration between major versions may require pg_dump/pg_restore

### Database Initialization
- **D-03:** Entrypoint script runs `alembic upgrade head` automatically before starting uvicorn — zero manual migration steps required — **Reversibility:** reversible — can be changed to manual migration by modifying entrypoint, but auto-migrate is the expected UX for self-hosted deployment

### Environment Defaults & Security
- **D-04:** docker-compose.yml includes secure production defaults: `ENV=production`, placeholder `JWT_SECRET` (must be changed), `CORS_ORIGINS=https://localhost` — users override via `.env` file — **Reversibility:** reversible — defaults can be changed, but the pattern of secure-by-default is the right approach for a security-conscious product

### Agent's Discretion
- Health check configuration (interval, timeout, retries) — agent determines optimal values based on `/api/health` response characteristics
- Alpine vs slim base images — agent determines best balance of size and compatibility
- Named volume driver options — agent uses Docker defaults unless specific needs arise

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Structure
- `.planning/ROADMAP.md` §Phase 4 — Phase goal, requirements (DEP-01 through DEP-05), success criteria
- `.planning/REQUIREMENTS.md` §Deployment — DEP-01 through DEP-05 requirement definitions
- `.planning/PROJECT.md` — Project constraints (self-hosted, single docker-compose.yml)

### Backend Entry Point
- `backend/app/main.py` — FastAPI app factory, lifespan handler (seeds admin + project), static panel mount at `/panel`
- `backend/app/config.py` — Pydantic Settings class reading from `.env` (all 11 environment variables)
- `backend/pyproject.toml` — Python dependencies (fastapi, asyncpg, alembic, uvicorn, etc.)

### Panel Build
- `panel/vite.config.ts` — Build config: `base: "./"`, `outDir: "../backend/api/static/panel"`
- `panel/package.json` — Zero runtime deps, all devDependencies for build tooling

### Database
- `backend/alembic.ini` — Alembic configuration (`script_location = "alembic"`)
- `backend/alembic/env.py` — Async migration runner
- `backend/alembic/versions/001_initial.py` — Initial schema (projects, users, incidents tables)

### Environment
- `.env.example` — All 11 environment variables with documentation

### Known Issues
- `documentation/continuity-pack.md` — Docker Desktop Windows asyncpg host networking broken; use Docker network (not host networking)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/main.py:create_app()` — Factory function already handles lifespan (startup seeding, shutdown cleanup). Entrypoint script wraps this with alembic migration.
- `backend/app/routers/health.py` — `GET /api/health` returns DB connectivity status. Ideal for Docker healthcheck.
- `backend/api/static/panel/` — Pre-built panel static files already exist. Can be COPY'd in Docker build.

### Established Patterns
- Panel builds INTO `backend/api/static/panel/` — Dockerfile Node stage replicates this exact flow
- FastAPI serves panel as static mount at `/panel` — no separate web server needed for panel
- `.env` file pattern — All config via pydantic-settings from environment variables, no hardcoded secrets

### Integration Points
- `backend/app/main.py` line ~150: `app = create_app()` — Uvicorn entry point (`app.main:app`)
- `backend/app/config.py`: `Settings` class — reads all env vars, validates types
- `backend/alembic/env.py`: reads `DATABASE_URL` from Settings for migration target

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard Docker practices.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 4-Docker Deployment*
*Context gathered: 2026-09-04*
