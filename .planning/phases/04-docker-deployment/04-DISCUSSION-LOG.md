# Phase 4: Docker Deployment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-04
**Phase:** 4-docker-deployment
**Areas discussed:** Dockerfile structure, PostgreSQL version, Database init on startup, Env defaults & security

---

## Dockerfile Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single multi-stage (Recommended) | One Dockerfile with stages: (1) Node stage builds panel, (2) Python stage runs FastAPI with panel static files copied in. Simpler to maintain, one file. | ✓ |
| Separate Dockerfiles | Dockerfile.api for Python backend, Dockerfile.panel for Node build. docker-compose builds both. More isolation but more files to maintain. | |
| Pre-built panel | Panel is built on host machine, Dockerfile only handles Python API. COPY pre-built panel static files. Simplest but requires host build step. | |

**User's choice:** Single multi-stage Dockerfile
**Notes:** User agreed with the recommended approach for simpler maintenance.

---

## PostgreSQL Version

| Option | Description | Selected |
|--------|-------------|----------|
| PostgreSQL 16 (Recommended) | Latest stable with JSONB improvements and parallel query. Well-tested with asyncpg. Good default for new projects. | ✓ |
| PostgreSQL 15 | Mature, widely deployed. Proven stability. Most Docker tutorials use this version. | |
| PostgreSQL 17 | Newest release. May have edge cases with asyncpg. Best for cutting-edge features. | |

**User's choice:** PostgreSQL 16
**Notes:** User chose the recommended stable version.

---

## Database Init on Startup

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-migrate on startup (Recommended) | Entrypoint script runs `alembic upgrade head` before starting uvicorn. Zero manual steps — just `docker-compose up` and it works. | ✓ |
| Separate migration step | docker-compose has a `migrate` service that runs Alembic. User runs `docker-compose run migrate` first, then `docker-compose up`. More control but extra step. | |
| Manual migration only | Documentation instructs users to run Alembic manually. Full control but requires user action on every schema change. | |

**User's choice:** Auto-migrate on startup
**Notes:** User wants zero manual steps — single command deployment.

---

## Env Defaults & Security

| Option | Description | Selected |
|--------|-------------|----------|
| Secure production defaults (Recommended) | docker-compose.yml sets ENV=production, generates strong JWT_SECRET placeholder, CORS_ORIGINS=https://localhost. Users override via .env file. | ✓ |
| Minimal defaults | docker-compose.yml only references .env file variables. No inline defaults. Users must create .env with all values. | |
| Development-friendly | docker-compose.yml defaults to development settings (ENV=development, localhost CORS). Users override for production. | |

**User's choice:** Secure production defaults
**Notes:** User wants secure-by-default approach, consistent with the product's security posture.

---

## Agent's Discretion

- Health check configuration (interval, timeout, retries) — agent determines optimal values
- Alpine vs slim base images — agent determines best balance
- Named volume driver options — agent uses Docker defaults

## Deferred Ideas

None — discussion stayed within phase scope
