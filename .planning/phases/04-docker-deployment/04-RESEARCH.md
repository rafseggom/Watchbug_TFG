# Phase 04: Docker Deployment - Research

**Researched:** 2026-09-08
**Domain:** Docker / Compose / FastAPI + PostgreSQL Deployment
**Confidence:** MEDIUM

## Summary

Phase 04 is infrastructure-only: a single `docker-compose.yml` that brings up API (FastAPI/uvicorn with built panel) + PostgreSQL 16-alpine with persisted data and zero-manual-migration UX. The panel is a Vite SPA built into `backend/api/static/panel/` and served via `StaticFiles` mount at `/panel`. The backend uses `asyncpg` with Pydantic Settings from `.env`, and the existing `lifespan` already tolerates DB-unavailable startup by swallowing seeding errors.

The dominant pattern in production FastAPI templates is **entrypoint runs `alembic upgrade head` before `exec uvicorn`** — not inside `lifespan`. Lifespan stays for idempotent admin/project seeding. Multi-stage Dockerfile uses a Node builder for `vite build` then a slim Python runtime; layer ordering (package manifests first, then source) is the primary cache win. PostgreSQL persistence is a named volume at `/var/lib/postgresql/data` with `pg_isready` healthcheck and `depends_on: condition: service_healthy` to eliminate the startup race. Docker Desktop on Windows breaks `network_mode: host` and `localhost` dual-stack — the fix is bridge networking with service-name DNS (`db`) and `127.0.0.1` for host-published ports.

**Primary recommendation:** Single multi-stage `Dockerfile` at repo root (Node 22-alpine builder → python 3.12-slim runtime) + `docker-compose.yml` (Compose Spec, no `version:`) with `db` (`postgres:16-alpine`, `pg_isready` healthcheck, named volume `pgdata`) and `api` (build from Dockerfile, `alembic upgrade head` in entrypoint, `curl -f /api/health` healthcheck, `depends_on: db: condition: service_healthy`), secure production defaults with `.env` override, and documented `down -v` destructive behavior.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01: Single multi-stage Dockerfile** with two stages: (1) Node stage builds panel via `vite build`, (2) Python stage copies panel static files and runs FastAPI with uvicorn — reversibility costly.
- **D-02: Pin PostgreSQL to `postgres:16-alpine`** — one-line change but major-version data migration may require `pg_dump`/`pg_restore`.
- **D-03: Entrypoint runs `alembic upgrade head` automatically before uvicorn** — zero manual steps; reversible to manual by modifying entrypoint.
- **D-04: docker-compose.yml includes secure production defaults:** `ENV=production`, placeholder `JWT_SECRET` (must be changed), `CORS_ORIGINS=https://localhost` — users override via `.env`.

### the agent's Discretion
- Health check configuration (interval, timeout, retries) — agent determines optimal values based on `/api/health` response characteristics
- Alpine vs slim base images — agent determines best balance of size and compatibility
- Named volume driver options — agent uses Docker defaults unless specific needs arise

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

## Project Constraints (from AGENTS.md)

| Directive | Requirement |
|-----------|-------------|
| **INV-03: Self-Hosted Containers** | Single `docker-compose.yml` for API, panel, DB — no separate compose files |
| **SEC-04: Zero Secrets in Code** | `.env` only; `.env.example` committed with documentation; never bake secrets into image |
| **RNF-01: Bundle ≤45 KB gzipped** | Async load, no main-thread blocking — panel build must not affect SDK bundle gate |
| **INV-01/02** | Widget isolation / clean global namespace — irrelevant to this phase (no widget changes) but must not regress |
| **Consultation Triggers** | DB schema changes already have alembic migration; blob storage choice (BYTEA vs FS/S3) remains deferred — do not decide in Docker phase |
| **Continuity Pack Protocol** | Record dead-ends immediately after failure (docker networking pitfalls already documented) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Docker image build (panel compile + API runtime) | API / Backend (build-time) | CDN / Static — | Build is server-side; panel static is compiled ahead of time and embedded into API image, not served by separate CDN |
| Request serving (`uvicorn` + `/panel` static mount) | API / Backend | — | FastAPI `StaticFiles` mount at `/panel` serves pre-built SPA [VERIFIED: backend/app/main.py:137-143]; no separate frontend server container |
| Data persistence (PostgreSQL + named volume) | Database / Storage | API / Backend | Compose `volumes:` owns persistence; API only holds connection string |
| Health probing (`GET /api/health` SELECT 1 + pg_isready) | API / Backend | Database / Storage | `health.py` executes `SELECT 1` against DB to report connectivity; DB healthcheck is native `pg_isready` |
| Secret/config injection (.env → Settings) | API / Backend | Database / Storage | Pydantic Settings reads `DATABASE_URL`, `JWT_SECRET`, etc. at runtime; DB container reads `POSTGRES_*` at first init |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEP-01 | Single `docker-compose.yml` — API + Panel + PostgreSQL, one-command startup | Compose Spec v2 (no `version:`), `depends_on: service_healthy`, single Dockerfile building both panel+API, bridge networking via service name `db` |
| DEP-02 | Multi-stage Dockerfile — Node builder for panel → Python production image | Node 22-alpine builder `npm ci` + `vite build` → `COPY --from` into `python:3.12-slim` runtime, layer-cache ordering, `.dockerignore`, non-root user |
| DEP-03 | Named Docker volume — PostgreSQL data persistence, documented `-v` behavior | `pgdata:/var/lib/postgresql/data` named volume survives `down`; `down -v` / `volume rm` destroys; `POSTGRES_*` only applied on empty volume |
| DEP-04 | `.env.example` — all required environment variables documented | [VERIFIED: .env.example:1-32] documents 11 vars; compose must provide secure defaults and `env_file: .env` override; SEC-04 forbids baking secrets |
| DEP-05 | PostgreSQL version pinned — specific minor version to prevent upgrade breakage | `postgres:16-alpine` pinned (not `latest`/`:16` floating); major upgrades require `pg_dump`/`pg_restore` or `pg_upgrade` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `postgres` (Docker Hub official) | `16-alpine` (pin, e.g. `16.8-alpine` at build time) | Relational storage with JSONB + BYTEA | Official image; Alpine ~70 MB vs 150 MB Debian; EOL 2028-11; `pg_isready` ships built-in; most compose guides use 16-alpine for homelab/production [CITED: docs.docker.com — postgres image, toolsops.dev 2026-05-25] |
| `python` (Docker Hub official) | `3.12-slim-bookworm` (requires-python `>=3.10` [VERIFIED: backend/pyproject.toml:5]) | API runtime | Slim excludes build toolchains; Debian variant avoids Alpine musl/bcrypt locale issues; `3.12` is stable for `asyncpg 0.31.0` + `sqlalchemy 2.0.52` [VERIFIED: backend/pyproject.toml:8-12]; pinned digest recommended for reproducibility [CITED: patrykgolabek.dev 2026-03-08] |
| `node` (Docker Hub official) | `22-alpine` | Panel build stage | `vite 6.3.5` [VERIFIED: panel/package.json:16] needs Node ≥18; 22-alpine is current LTS minimal; `npm ci` reproducible |
| `uvicorn` | `>=0.35.0` with `[standard]` extras [VERIFIED: backend/pyproject.toml:18] | ASGI server | Project dependency; single worker required for `slowapi` in-memory limiter (see Phase 02 notes: `--workers 1`) |
| `alembic` | `1.19.1` [VERIFIED: backend/pyproject.toml:12] | Schema migrations | Already used; `env.py` reads `DATABASE_URL` from Settings [VERIFIED: backend/alembic/env.py:22-24] |
| `docker compose` (Compose Spec) | v2.20+ (Compose v5.5.0 detected) | Orchestration | No `version:` key; `depends_on: condition: service_healthy` only in Spec v2 [CITED: docs.docker.com/compose — compose-file/05-services/#depends_on] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `curl` (or `wget`) | Debian/ Alpine `curl` via `apt-get`/`apk` | Container HEALTHCHECK `curl -f http://localhost:8000/api/health` | Install in runtime stage; `python:3.12-slim` does not ship curl by default [CITED: kowashlab.com 2026-02-01] |
| `tini` | `0.19.0` (Debian package) | PID 1 init + signal forwarding | Optional but recommended when `ENTRYPOINT` is a shell script; use `init: true` in compose as lighter alternative [CITED: patrykgolabek.dev] |
| `asyncpg` | `0.31.0` [VERIFIED: backend/pyproject.toml:11] | Postgres async driver | Already required; note Windows `localhost` dual-stack 10s delay (see Pitfalls) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `python:3.12-slim-bookworm` | `python:3.12-alpine` | Alpine smallest (~50 MB) but musl breaks `bcrypt` compilation and has minimal locale data; slim is recommended for Python with C extensions [CITED: techearl.com 2026-05-25] |
| Single `Dockerfile` (D-01) | Separate `Dockerfile.api` + `Dockerfile.panel` with `docker-compose build: target` | More isolation but violates locked decision D-01 and adds maintenance; single multi-stage is the approved watchbug pattern |
| Entrypoint auto-migrate (D-03) | Separate `migrate` service + `service_completed_successfully` | More explicit for production with review gates, but requires two commands; deferred — entrypoint auto-migrate is mandated for `up`-only UX [CITED: patrykgolabek.dev entrypoint.sh RUN_DB_MIGRATIONS opt-in vs always-on] |
| `curl` healthcheck | `python -c "import urllib..."` probe | Python probe avoids adding `curl` (~2 MB) and can assert JSON `db: connected` field; slightly more fragile. Prefer `curl` for readability, or use Python probe to fix the 200-always limitation (see Pitfalls) |
| `postgres:16-alpine` pinned digest | `postgres:16.8-bookworm` with digest pin `postgres:16.8-bookworm@sha256:...` | Bookworm more locale-complete, digest pin fully reproducible; Alpine is chosen per D-02 for size — document minor pin + `docker pull` refresh procedure |

**Installation (infrastructure — no new npm/pypi packages):**
```bash
# Pin base digests (optional but recommended for reproducibility)
docker pull postgres:16-alpine && docker inspect --format='{{.Id}}' postgres:16-alpine
docker pull python:3.12-slim-bookworm && docker inspect --format='{{.Id}}' python:3.12-slim-bookworm
docker pull node:22-alpine && docker inspect --format='{{.Id}}' node:22-alpine

# No npm/pip installs in this phase beyond existing lockfiles
# Build uses existing backend/pyproject.toml and panel/package.json
```

**Version verification:**
```bash
npm view vite version          # verify panel builder — expect 6.x (project uses 6.3.5)
pip index versions asyncpg     # verify asyncpg 0.31.0 still current (already pinned)
docker pull postgres:16-alpine # verify tag resolves; prefer digest in final Dockerfile
```

## Package Legitimacy Audit

> This phase installs **no new external packages** — it reuses `backend/pyproject.toml` (fastapi, asyncpg, alembic, uvicorn, etc.) and `panel/package.json` (vite, typescript, vitest). No new registry lookups beyond base image tags. Base images are all official Docker Hub `library/` images.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `postgres:16-alpine` | Docker Hub `library/postgres` | ~12 yrs (2013) | 1B+ pulls | github.com/docker-library/postgres | OK | Approved — official image, pin `16-alpine` digest |
| `python:3.12-slim-bookworm` | Docker Hub `library/python` | ~13 yrs | 1B+ pulls | github.com/docker-library/python | OK | Approved — official image, pin digest |
| `node:22-alpine` | Docker Hub `library/node` | ~12 yrs | 1B+ pulls | github.com/nodejs/docker-node | OK | Approved — official image, pin `22-alpine` digest |
| *(no new npm/pypi deps)* | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*If a future plan adds a new pip/npm package (e.g., `gunicorn`, `psycopg2-binary`), it must pass `gsd_run query package-legitimacy check` and be recorded here before approval.*

## Architecture Patterns

### System Architecture Diagram

```
                   docker-compose.yml (single entrypoint, Compose Spec v2)
                                |
          +---------------------+----------------------+
          |                                            |
     [db service]                              [api service]
  postgres:16-alpine                    multi-stage build: node:22-alpine → python:3.12-slim
          |                                            |
   named volume                              ┌─────────┴─────────┐
  pgdata:/var/lib/postgresql/data      Node builder       Python runtime
          |                          COPY panel/       COPY backend/ + panel dist
          |                          npm ci            pip install --no-cache-dir
          |                          vite build ──────► api/static/panel/ (base "./")
          |                          outDir ───────────┘   [VERIFIED: panel/vite.config.ts:4-8]
          |                                            |
   healthcheck:                               entrypoint.sh:
  pg_isready -U $$POSTGRES_USER               1. alembic upgrade head [CITED: patrykgolabek.dev]
   interval 10s                                2. exec uvicorn app.main:app --host 0.0.0.0 --port 8000
   timeout 5s                                   (--workers 1 for slowapi in-memory limiter)
   retries 5                                            |
   start_period 20s                                     |
          |                                    lifespan() in main.py:
          |                                     seed_admin + seed_default_project
          |                                     (swallows DB-unreachable errors)
          |                                            |
          +─────── Docker bridge network (service name `db`) ──────+
          |                                            |
          |         DATABASE_URL=postgresql+asyncpg://watchbug:watchbug@db:5432/watchbug
          |                                            |
          └────────────────── health probe ────────────┘
                             GET /api/health → text("SELECT 1") → {"status":"ok","db":"connected"}
                             [VERIFIED: backend/app/routers/health.py:10-17]
                                           healthcheck: curl -f http://localhost:8000/api/health
                                           interval 30s timeout 5s retries 3 start_period 60s
                             depends_on: db: condition: service_healthy
                             [CITED: docs.docker.com/compose — depends_on long syntax]

   Host: docker compose up -d  →  api http://localhost:8000  (/api/health, /api/incidents, /panel)
                                 db 127.0.0.1:5432 (optional publish, loopback only)
                                 named volume `pgdata` survives `down`; `down -v` destroys
```

**Data-flow trace (primary use case — SDK POST → retrieve in panel):**
`SDK POST /api/incidents` → `uvicorn` (api container, bridge network) → `asyncpg` via `db:5432` → `postgres` data → persisted in `pgdata` named volume → `GET /api/incidents` → Panel SPA served from `api/static/panel` at `/panel`.

### Recommended Project Structure

```
watchbug/
├── Dockerfile                 # Multi-stage: node builder → python runtime (repo root, build context ".")
├── docker-compose.yml         # Single file per INV-03; Compose Spec (no version:)
├── .env.example               # Documents all 11 Settings vars [VERIFIED: .env.example:1-32]
├── .env                       # Not committed; env_file for compose `api` service + local dev
├── .dockerignore              # Exclude node_modules, .git, backend/.venv, panel/dist, __pycache__
├── docker-entrypoint.sh       # `alembic upgrade head` + exec uvicorn (chmod +x in Dockerfile)
├── backend/
│   ├── app/                   # FastAPI app — no changes except entrypoint wrapper
│   ├── alembic/               # Migrations copied into image for entrypoint
│   ├── alembic.ini            # Overridden at runtime via env.py DATABASE_URL [VERIFIED: alembic/env.py:22-24]
│   ├── pyproject.toml         # Dependencies [VERIFIED: backend/pyproject.toml:1-18]
│   └── api/static/panel/      # Build artifact — produced by Node stage, not committed as source
├── panel/
│   ├── vite.config.ts         # base "./", outDir "../backend/api/static/panel" [VERIFIED: 4-8]
│   └── package.json           # vite 6.3.5 [VERIFIED: package.json:16]
└── documentation/
    └── continuity-pack.md     # Must document Windows host-networking dead-end (see below)
```

Build context is repo root (`.`) so Dockerfile can `COPY panel/` and `COPY backend/` in one file. Alternative `context: backend` would require copying panel from parent — avoid.

### Pattern 1: Entrypoint Owns Migrations, Lifespan Owns Seeding

**What:** `docker-entrypoint.sh` runs `alembic upgrade head` **before** `exec uvicorn`, while `lifespan()` in `main.py` seeds `admin`/`project` idempotently and swallows DB errors so import-time startup never crashes [VERIFIED: backend/app/main.py:16-49].
**When to use:** Always in Docker for Watchbug (D-03). Opt-in `RUN_DB_MIGRATIONS` env var pattern (patrykgolabek.dev) is for production with manual review gates — watchbug chooses always-on for `up`-only UX.
**Example:**
```bash
#!/usr/bin/env sh
set -eu
# docker-entrypoint.sh — must chmod +x in Dockerfile
echo "Applying Alembic migrations..."
alembic -c alembic.ini upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
```
```dockerfile
# Dockerfile tail
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
# Optional: ensure tini or compose `init: true` for PID 1 reaping
```

**Key insight:** `env.py` reads `DATABASE_URL` from `Settings` and uses `async_engine_from_config` with `poolclass=NullPool` [VERIFIED: backend/alembic/env.py:37-46]. The entrypoint must `cd /app` (or set `WORKDIR`) so `alembic.ini` is found. `DATABASE_URL` in compose must be the async URL `postgresql+asyncpg://...@db:5432/watchbug` because both runtime and alembic use `asyncpg`.

### Pattern 2: Layer-Cache Ordered Multi-Stage Build

**What:** Separate `COPY` of dependency manifests (`panel/package.json`, `backend/pyproject.toml`) + install, **then** `COPY` source + build. Each `FROM` starts a new stage; only artifacts needed at runtime are `COPY --from`.
**When to use:** Always. Rebuilds where only source changed reuse the cached `npm ci` / `pip install` layer — 45 s → 12 s saving [CITED: pkglog.com 2026-04-07, dilsyno.com 2025-05-05].
**Example:**
```dockerfile
# syntax=docker/dockerfile:1.7
# Stage 0 — panel builder
FROM node:22-alpine AS panel-builder
WORKDIR /app/panel
COPY panel/package.json panel/package-lock.json* ./
# Cache mount speeds CI rebuilds (BuildKit)
RUN --mount=type=cache,target=/root/.npm npm ci
COPY panel/ ./
# vite.config.ts outDir is "../backend/api/static/panel" relative to panel/ — need the backend tree
COPY backend/api/ ../backend/api/
RUN npm run build   # writes to ../backend/api/static/panel

# Stage 1 — python deps (keeps gcc/libpq-dev out of final image if needed)
FROM python:3.12-slim-bookworm AS python-builder
WORKDIR /app
# If bcrypt/slow compilation needed: apt-get install gcc libpq-dev here only
COPY backend/pyproject.toml backend/README.md* ./
# Project uses pip; copy requirements or install from pyproject
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir .

# Stage 2 — runtime
FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid 10001 --create-home --home-dir /home/app app \
 && apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && install -d -o app -g app /app/data
COPY --from=python-builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-builder /usr/local/bin /usr/local/bin
COPY backend/ ./
COPY --from=panel-builder /app/backend/api/static/panel ./api/static/panel
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown -R app:app /app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=60s \
  CMD curl -f http://localhost:8000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
```

**Refined alternative** that avoids `backend/api` copy hack: build panel to its own dist then `COPY --from=panel-builder /app/panel/dist ./api/static/panel` and change `vite.config.ts` outDir to absolute `/app/api/static/panel` during Docker build via `VITE_OUT_DIR` env. Planner chooses whichever avoids leaking backend into Node stage.

**Verify:** `.dockerignore` must contain `backend/.venv`, `backend/__pycache__`, `node_modules`, `.git`, `panel/dist` to keep build context small [CITED: bigiron.cc 2026].

### Pattern 3: Compose Spec v2 with Health-Gated Depends On

**What:** Remove `version:` (Compose Spec ignores it), declare top-level `services:` + `volumes:`, give `db` a `healthcheck` (`pg_isready`) and gate `api` with `depends_on: db: condition: service_healthy` [CITED: docs.docker.com/compose — depends_on, toolsops.dev].
**When to use:** Always for Watchbug — fixes the startup race where api tries asyncpg connect before PG accepts connections.
**Example (canonical):**
```yaml
# docker-compose.yml — Compose Spec (no version:)
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-watchbug}
      POSTGRES_USER: ${POSTGRES_USER:-watchbug}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-watchbug}
      # Postgres 16 volume path; PG 18 changed to /var/lib/postgresql — do not use PG18 path here
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"   # loopback only; optional — remove to fully internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  api:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://watchbug:watchbug@db:5432/watchbug
      # Service name `db` is the Docker DNS hostname — never localhost for inter-container [CITED: aidevhub.ai 2026-05-09]
      ENV: ${ENV:-production}
      JWT_SECRET: ${JWT_SECRET:-change-me-to-a-random-secret-at-least-32-chars}
      CORS_ORIGINS: ${CORS_ORIGINS:-https://localhost}
      ADMIN_EMAIL: ${ADMIN_EMAIL:-admin@watchbug.local}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-Admin123!}
      DEFAULT_PROJECT_API_KEY: ${DEFAULT_PROJECT_API_KEY:-wb_test_project_key_123}
      DOCS_ENABLED: ${DOCS_ENABLED:-false}
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/api/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s   # covers alembic on fresh DB
    init: true            # tini equivalent for PID 1 reaping without baking tini

volumes:
  pgdata:
```

**Important escaping:** In compose `$$POSTGRES_USER` → single `$` inside container. Single `$` is interpolated by Compose at parse time (fails if not set). Use `$$` for runtime vars [CITED: toolsops.dev].

### Anti-Patterns to Avoid

- **`network_mode: host` on Docker Desktop Windows/WSL2:** Host mode shares the Docker Desktop utility VM, not the WSL2 VM, so `curl localhost:8000` returns connection refused even though container shows listening [CITED: aidevhub.ai, forums.docker.com #147994]. Also breaks asyncpg inter-container connects via `localhost`. Fix: bridge network + service-name DNS + `ports:` mapping.
- **`localhost` vs `127.0.0.1` on Windows:** Windows resolves `localhost` dual-stack (`::1` + `127.0.0.1`, IPv6 preferred). Docker publishes IPv4-only by default, so clients try `::1:5432` first, wait ~10 s OS fallback, then succeed on IPv4 — every connection pays 10 s. Fix: use `127.0.0.1` for host-published PostgreSQL ports [CITED: skucherenko.hashnode.dev 2026-07-27, 10,137 ms → 27 ms].
- **`depends_on` without `condition: service_healthy`:** Short syntax only waits for container PID start, not for PG readiness. Add explicit `healthcheck` + `condition: service_healthy`; without healthcheck the condition never satisfies [CITED: blog.gntech.me 2026-05-14, jakeinsight.com].
- **Using `localhost` inside api container for `DATABASE_URL`:** Inside compose network `localhost` is the api container itself, not the db container. Use `db` as hostname: `postgresql+asyncpg://...@db:5432/...` [VERIFIED: continuity-pack Windows networking note].
- **Env `POSTGRES_*` changes without SQL:** Image only creates user/DB on **first** start when volume empty. Changing `POSTGRES_PASSWORD` in `.env` after `pgdata` exists does nothing — password stays original. Document `ALTER USER` or `down -v` + recreate [CITED: toolsops.dev].
- **No `.dockerignore`:** `COPY . .` without `.dockerignore` sends `node_modules` (~hundreds MB) + `.git` as build context, slow before first `RUN` [CITED: bigiron.cc, pkglog.com].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB readiness wait | Custom `wait-for-it.sh` / `wait-for-db.py` polling TCP | `healthcheck: pg_isready` + `depends_on: condition: service_healthy` (Compose Spec) | `pg_isready` checks actual DB acceptance (including DB exists), not just TCP open; wait scripts race and need retry logic already in Compose [CITED: jakeinsight.com] |
| Multi-stage layer caching | Single-stage Dockerfile with all tools in final image | `FROM ... AS builder` + `COPY --from=builder` + `RUN --mount=type=cache` (BuildKit) | 10–100× image size win (900 MB → 150 MB Python, 1.2 GB → 85 MB Node) and rebuild cache invalidation fix; single-stage ships compilers in prod [CITED: pkglog.com, bigiron.cc] |
| Async migration runner | Custom Python runner that reads `DATABASE_URL` and calls `asyncio.run(upgrade)` | `alembic upgrade head` in `docker-entrypoint.sh` | Alembic already reads `DATABASE_URL` via Settings and uses `NullPool` for online migrations [VERIFIED: backend/alembic/env.py:37-46]; hand-rolled runner duplicates config parsing |
| Health probing | Parsing `/api/health` with home-grown JSON check in shell without `curl` | `HEALTHCHECK CMD curl -f http://localhost:8000/api/health || exit 1` or `python -c "import urllib..."` if avoiding curl | Docker expects exit 0/1; curl -f handles HTTP error codes; hand-rolled `wget --spider` works but less standard on slim images |
| Secret handling | Hardcoded `JWT_SECRET` placeholder left as real default in code | `.env.example` + `env_file: .env` with `environment:` production placeholder that users override; document `secrets.token_urlsafe(32)` generation [VERIFIED: .env.example:8] | SEC-04 forbids secrets in code; placeholder must fail-secure (api refuses to start or warns if default unchanged) |

**Key insight:** Docker/Compose already provides health gating, layer caching, and entrypoint ordering — reimplementing them with shell loops or Python startup hooks adds complexity and still races. Use the platform primitives.

## Common Pitfalls

### Pitfall 1: API Starts Before PostgreSQL Is Ready (Startup Race)

**What goes wrong:** `api` executes `asyncpg.connect` (or `SELECT 1` in health probe, or Alembic `async_engine_from_config`) before `db` accepts connections. Logs show `connection refused` / `TimeoutError`, container restarts, eventually succeeds after retry — flaky in CI where PG init is 2–3× slower [CITED: jakeinsight.com].
**Why it happens:** `depends_on: [db]` (short syntax) only guarantees container PID exists, not that PG is accepting connections. Without `healthcheck`, `service_healthy` condition is impossible.
**How to avoid:** Define `db.healthcheck.test: pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB` with `interval: 10s`, `start_period: 20s`, and `api.depends_on.db.condition: service_healthy`. Compose blocks `api` creation until first `pg_isready` exit 0 [CITED: docs.docker.com — depends_on long syntax]. Also make entrypoint tolerant of transient PG errors (retry loop or single `alembic upgrade head` after DB healthy is sufficient).
**Warning signs:** Intermittent `ECONNREFUSED` on first `compose up` but success on second `compose restart api`; CI pass rate ~70%.

### Pitfall 2: `GET /api/health` Always Returns 200 — Docker Thinks DB-Disconnected Is Healthy

**What goes wrong:** Current handler [VERIFIED: backend/app/routers/health.py:10-17] catches all exceptions and returns `{"status":"ok","db":"disconnected"}` with HTTP 200. `curl -f` only checks HTTP status, so Docker marks api `healthy` even when DB is down.
**Why it happens:** Handler deliberately never throws, to allow probing without auth. Docker healthcheck needs a probe that fails closed.
**How to avoid:** Either (a) change health endpoint to return 503 when `db: disconnected` (Planner decides — D-08-like deviation needs explicit decision), or (b) keep endpoint as-is and make Docker HEALTHCHECK `CMD` a Python probe that asserts `json.db == "connected"` and exit 1 otherwise: `CMD python -c "import urllib.request,json,sys; d=json.load(urllib.request.urlopen('http://localhost:8000/api/health')); sys.exit(0 if d.get('db')=='connected' else 1)"`. Preferred: option (b) to avoid changing API contract in infra-only phase. If planner chooses option (a), add `status_code=503` branch and update healthcheck to `curl -f` alone.
**Warning signs:** `docker inspect --format='{{.State.Health.Status}}'` shows `healthy` while `docker compose logs db` shows crashed; `GET /api/health` returns `disconnected` but healthcheck never fails.

### Pitfall 3: Named Volume Survives `down` but `down -v` Destroys Data — and Password Changes Are Silently Ignored

**What goes wrong:** Operator runs `docker compose down -v` to reset and loses all incidents/users. Or changes `POSTGRES_PASSWORD`/`DATABASE_URL` in `.env` and wonders why new password rejected — because `postgres` entrypoint only initializes `$POSTGRES_*` when `/var/lib/postgresql/data` is empty [CITED: toolsops.dev, techearl.com].
**Why it happens:** Compose `volumes: pgdata:` is external to container lifecycle by design. Env vars are init-time only; existing `pgdata` already contains `postgresql.conf` and user records.
**How to avoid:** Document explicitly: `down` keeps data, `down -v` / `docker volume rm pgdata` destroys. For password rotation use `docker exec db psql -U watchbug -c "ALTER USER watchbug PASSWORD 'new'"` or wipe volume in dev. Never rely on `.env` change alone after first boot.
**Warning signs:** New deployment with same compose file suddenly has stale data from previous run; `POSTGRES_PASSWORD` change has no effect until volume removed.

### Pitfall 4: `localhost` in `DATABASE_URL` Breaks Inside Compose + Adds 10 s Latency on Windows

**What goes wrong:** Compose `api` container uses `postgresql+asyncpg://...@localhost:5432/...` and fails (localhost is self). Or host developer uses `localhost:5432` to connect `psql` and pays 10 s IPv6 fallback delay on every connection on Windows [CITED: skucherenko.hashnode.dev, aidevhub.ai].
**Why it happens:** Docker bridge DNS resolves service names; `localhost` inside container ≠ host. Windows resolves `localhost` → `::1` first, but Docker publish is IPv4-only.
**How to avoid:** Inside compose network, `DATABASE_URL` → `...@db:5432/...`. For host tools, use `127.0.0.1:5432` and publish as `127.0.0.1:5432:5432` to keep off public interface. Always set `connect_timeout` in asyncpg (or rely on `pg_isready` gating) so failures are loud.
**Warning signs:** `api` logs `connection refused` immediately; host `psql` connects but latency histogram shows exactly ~10 s on Windows and 27 ms on Linux.

### Pitfall 5: `vite build` outDir Path Confusion Breaks Panel Serve

**What goes wrong:** `panel/vite.config.ts` outDir `../backend/api/static/panel` [VERIFIED: panel/vite.config.ts:6] is relative to `panel/` working directory. If Dockerfile `WORKDIR` is `/app/panel` and only panel files are copied, outDir resolves to `/app/panel/../backend/api/static/panel` which doesn't exist yet, so build silently creates wrong path and final `COPY --from=panel-builder /app/backend/api/static/panel` is empty → `/panel` mounts as empty dir, panel 404.
**Why it happens:** Relative outDir depends on build context layout; separating Node and Python stages splits the tree.
**How to avoid:** Either (a) set Node stage `WORKDIR /app` and `COPY panel/ ./panel/` + `COPY backend/api/ ./backend/api/` before `npm --prefix panel run build`, or (b) change Dockerfile to `RUN npm --prefix panel run build -- --outDir /app/backend/api/static/panel` with absolute path, or (c) build panel to its own `./dist` and `COPY --from=panel-builder /app/panel/dist /app/api/static/panel` and adjust backend mount path expectation (requires FastAPI static mount path check). Planner must pick one and test with `ls` in builder.
**Warning signs:** Build succeeds but `ls backend/api/static/panel` shows only `.gitkeep` or empty after builder stage; runtime `/panel` returns 404 despite `StaticFiles` mount.

### Pitfall 6: `slowapi` In-Memory Limiter With `--workers >1` Silently Breaks Rate Limiting

**What goes wrong:** Multiple uvicorn workers each have their own in-memory counter, so per-IP limit (e.g. `10/minute`) becomes `10*N` effective, and no shared state → abuse still possible.
**Why it happens:** Phase 02 notes explicitly: `--workers 1` required for slowapi in-memory limiter; multi-worker needs Redis backend (not in DEP scope).
**How to avoid:** Keep `CMD uvicorn ... --workers 1` (or `ENV UVICORN_WORKERS=1`). Document that horizontal scaling is via `docker compose up --scale api=3` behind a load balancer, not in-process workers. Entry guard `if WORKERS>1 and limiting without storage → fail fast` pattern from patrykgolabek.dev is the safe alternative.
**Warning signs:** Load test shows rate limit 429 fires at ~30/min instead of 10/min with 3 workers.

## Code Examples

Verified patterns from official sources:

### Healthcheck-Compatible `docker-compose.yml` (Compose Spec)

```yaml
# Source: docs.docker.com — compose-file/05-services/#depends_on,  compose-file/05-services/#healthcheck
# Compose Spec does NOT use a `version:` key.
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: watchbug
      POSTGRES_USER: watchbug
      POSTGRES_PASSWORD: watchbug
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  api:
    build: { context: ., dockerfile: Dockerfile }
    ports: ["8000:8000"]
    env_file: [.env]
    environment:
      DATABASE_URL: postgresql+asyncpg://watchbug:watchbug@db:5432/watchbug
      ENV: production
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/api/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s
    init: true

volumes:
  pgdata:
```

### FastAPI Entrypoint That Runs Migrations Before Serving

```bash
# Source: patrykgolabek.dev — FastAPI Production Guide (entrypoint pattern)
# docker-entrypoint.sh
#!/usr/bin/env sh
set -eu
# Mirrors the project's async migration via alembic env.py
# [VERIFIED: backend/alembic/env.py:22-24 — reads DATABASE_URL from Settings]
# [VERIFIED: backend/pyproject.toml:12 — alembic==1.19.1]
echo "Applying Alembic migrations..."
alembic -c alembic.ini upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --proxy-headers
```

### Current Health Endpoint and Strict Probe Alternative

```python
# Source: backend/app/routers/health.py:10-17 — current behavior always 200
# [VERIFIED: backend/app/routers/health.py:10-17]
# return {"status": "ok", "db": "connected"} or {"status":"ok","db":"disconnected"} with 200
# Strict probe for Docker when db:disconnected should be unhealthy:
# HEALTHCHECK CMD python -c "import urllib.request,json,sys; \
#   d=json.load(urllib.request.urlopen('http://localhost:8000/api/health')); \
#   sys.exit(0 if d.get('db')=='connected' else 1)"
```

```python
# Source: backend/alembic/env.py:38-46 — async migration runner already configured
# No changes needed; entrypoint just invokes it via `alembic upgrade head`
# connectable = async_engine_from_config(
#     config.get_section(config.config_ini_section, {}),
#     prefix="sqlalchemy.",
#     poolclass=pool.NullPool,
# )
```

### Vite Build OutDir That Backend Mounts

```typescript
// Source: panel/vite.config.ts:4-8 [VERIFIED]
export default defineConfig({
  base: "./",
  build: {
    outDir: "../backend/api/static/panel",
    emptyOutDir: true,
  },
});
// Backend mounts it at /panel via StaticFiles if directory exists
// [VERIFIED: backend/app/main.py:137-143]
// panel_dir = os.path.join(os.path.dirname(__file__), "..", "api", "static", "panel")
// if os.path.isdir(panel_dir): app.mount("/panel", StaticFiles(..., html=True))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `docker-compose` + `version: "3.8"` top-level key | Compose Spec (`docker compose`) with no `version:` | Docker Compose v2.0 (2022), enforced ~2023 | Old `version` is ignored with warning; new spec adds `service_healthy`, `service_completed_successfully` conditions, `init:`, `start_interval` |
| `depends_on` short syntax or `condition: service_started` | `depends_on: {db: {condition: service_healthy}}` + `healthcheck: pg_isready` | Compose Spec extensibility (2022+) | Fixes flaky startup without external wait scripts; compose blocks until `pg_isready` 0 |
| `HEALTHCHECK` only via Dockerfile | `healthcheck:` per-service in compose (overrides Dockerfile) + Docker `HEALTHCHECK` instruction | Compose Spec parity | Compose healthcheck can override image healthcheck; Planner should define in both places (Dockerfile default + compose override) |
| `ENTRYPOINT` does only exec | `ENTRYPOINT [entrypoint.sh]` that runs `alembic upgrade head` then `exec uvicorn` with `tini`/`init: true` | Production FastAPI templates (2024–2026) | Zero-manual-migration UX per D-03; PID 1 signal forwarding prevents `SIGTERM` hang |
| Postgres minor `latest`/`16` floating tag | `16-alpine` pinned to minor + digest `16.8-alpine@sha256:...` | Docker best practices 2025+ [CITED: toolsops.dev] | Prevents accidental major bump via `pull` breaking `/var/lib/postgresql/data` format (16↔17 incompatible) |
| `localhost` for host+container | Host uses `127.0.0.1`, containers use service name `db` | Docker Desktop WSL2 investigation 2025–2026 [CITED: aidevhub.ai] | Fixes 10 s Windows IPv6 delay and host-network unreachable |

**Deprecated/outdated:**
- `docker-compose` ( hyphen) → `docker compose` (space) v2; still an alias but hyphen will warn.
- `postgres:16` with `version:` key and TCP wait scripts (`wait-for-it.sh`, `netcat -z`) → replaced by native `pg_isready` healthcheck.
- Using `CORS_ORIGINS="*"` with `allow_credentials=True` → invalid (Starlette raises `ValueError`); D-04 default `https://localhost` with real allowlist is correct [VERIFIED: backend/app/main.py:118-126].
- Dockerfile `MAINTAINER` instruction → `LABEL org.opencontainers.image.*` instead [CITED: docs.docker.com/reference/dockerfile/#label].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `python:3.12-slim-bookworm` is compatible with `asyncpg 0.31.0`, `sqlalchemy 2.0.52`, `pydantic 2.13.5`, `bcrypt 5.0.0` as of 2026-09 [ASSUMED] | Standard Stack | Build fails compiling `bcrypt` or `asyncpg` on slim; fallback to `python:3.11-slim-bookworm` (also satisfies `requires-python >=3.10`) or add `gcc`/`libpq-dev` in builder stage |
| A2 | Health endpoint should stay 200-always and Docker probe should assert JSON field rather than HTTP code change [ASSUMED] | Pitfalls | If team prefers HTTP-status-closed (503 when disconnected), probe logic and `curl -f` change; verify with product owner — infra-only phase should not change API contract without approval |
| A3 | Panel builder uses `npm ci` (lockfile present) — but repo may only have `package.json` without `package-lock.json` [ASSUMED] | Architecture Patterns | `npm ci` fails without lockfile; fallback is `npm install` or generate lockfile before docker phase; Planner must check `panel/package-lock.json` exists or adapt command |
| A4 | Port `8000` is the intended external port (currently `8000` in Vite proxy `target: http://localhost:8000` [VERIFIED: panel/vite.config.ts:13] and Settings default DATABASE `localhost:5432`) [CITED: .env.example] | Architecture Patterns | If host already uses 8000 (common), compose ports must remap (`"${PORT:-8000}:8000"` pattern); document env-driven port mapping |
| A5 | Digest pinning is desired for reproducibility — team agrees to run refresh script (`ops/refresh-docker-base-digests.sh` pattern) on base updates [ASSUMED] | Standard Stack | If not desired, pinning to tag only (`16-alpine`, `3.12-slim`, `22-alpine`) is sufficient but loses reproducibility guarantee emphasized by patrykgolabek.dev |

## Open Questions

1. **Should `GET /api/health` return non-200 when DB is disconnected, or keep current 200-always and use strict Python probe?**
   - What we know: Current handler always 200 with `db: disconnected` [VERIFIED: backend/app/routers/health.py:10-17]; `curl -f` healthcheck thus always passes. Phase 02 docs never specified health HTTP code semantics.
   - What's unclear: Whether infra-only phase is allowed to change health HTTP semantics (would be API change, contradicts phase boundary "no API changes"). Safer to keep 200 and use strict probe.
   - Recommendation: Keep endpoint unchanged; use `python -c` JSON-asserting probe in Docker HEALTHCHECK; document alternative (503) as deferred if health semantics later needed for orchestration.

2. **Is `postgres:16-alpine` acceptable despite musl minimal locale risk, or should runtime switch to `postgres:16-bookworm` for broader extension/locale compatibility?**
   - What we know: D-02 locks `postgres:16-alpine` per user decision; Alpine is ~70 MB vs 150 MB Debian but minimal locales can break Turkish sort / some extensions [CITED: techearl.com]. DEP-05 requires pin, not variant.
   - What's unclear: Whether future panel/API search features need locale-aware collation or `pgvector` extensions that prefer Debian.
   - Recommendation: Honor D-02 Alpine for Phase 04; add `Alternatives Considered` note that switching to `16-bookworm` is single-line change if extension/locale need arises.

3. **Does the panel lockfile exist in repo for `npm ci`, and what is the exact Dockerfile WORKDIR to satisfy relative outDir?**
   - What we know: `panel/package.json` exists without visible lockfile; `vite.config.ts` outDir `"../backend/api/static/panel"` is relative to `panel/` [VERIFIED]. Dockerfile pattern must be prototyped with `ls` after `vite build` to confirm artifact location.
   - Recommendation: Planner's first task validates lockfile presence and builds panel in an empty container to assert outDir correctness before committing Dockerfile.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine | `docker build` / `docker compose up` | ✓ | 29.2.1, build a5c7197 | — |
| Docker Compose (v2, `docker compose`) | DEP-01 single-command startup, `depends_on: service_healthy` | ✓ | v5.5.0 | No fallback — blocking; must install Compose v2.2+ for `service_healthy` |
| Python | `uvicorn` / `alembic` / local `pip install` | ✓ | 3.14.0 | Use Docker for all Python runtime; local Python only for lint/test |
| Node.js | `vite build` in builder stage | ✓ | v24.11.1 / npm 11.6.2 | Docker `node:22-alpine` handles build even if host Node mismatched |
| PostgreSQL image | `postgres:16-alpine` pull | ✓ (via Docker pull) | 16.x-alpine | — |
| `curl` in final image | `HEALTHCHECK curl -f ...` | ✗ (not in `python:3.12-slim` by default) | — | Add `apt-get install curl` in runtime stage, or switch probe to `python -c urllib` with no extra package |

**Missing dependencies with no fallback:**
- None — all required tooling is present on host. Compose v2.20+ needed for `depends_on: condition: service_healthy` with correct fallback behavior; detected v5.5.0 exceeds minimum.

**Missing dependencies with fallback:**
- `curl` not in slim runtime → install explicitly or use Python probe. Both viable; planner chooses.

**Host quirks detected:**
- Windows host (`win32`) → Docker Desktop WSL2 path suspected. Do not use `network_mode: host`; use bridge service-name `db` and `127.0.0.1` for host access. Document in `.env.example` and README.
- `python 3.14.0` on host newer than Docker `3.12`; pinning container to `3.12` avoids 3.14 edge cases.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json:9` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (backend, asyncio_mode auto) [VERIFIED: backend/pyproject.toml:29-31] + Docker native `healthcheck` status + `docker compose` smoke |
| Config file | `backend/pyproject.toml` [tool.pytest.ini_options] [VERIFIED: 29-32]; panel `vitest` is not used in this phase |
| Quick run command | `pytest -q` (existing 65 tests) ; for Docker: `docker compose config --quiet && docker compose up -d --build && docker compose ps --format json` |
| Full suite command | `docker compose down --remove-orphans; docker compose up -d --build; pytest backend/tests; docker compose ps` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEP-01 | `docker compose up -d` starts api+db, both `healthy`, `GET /api/health` returns `db: connected` | integration / smoke | `docker compose up -d --build; timeout 90 bash -c 'until curl -fs http://localhost:8000/api/health \| grep connected; do sleep 2; done'; curl -s http://localhost:8000/api/health; docker compose ps --format '{{.State}} {{.Service}}'` | ❌ Wave 0 — need `tests/test_docker_smoke.py` or shell script |
| DEP-02 | Multi-stage build produces image with panel at `api/static/panel/index.html` and no Node deps | integration | `docker build -t watchbug:test . && docker run --rm watchbug:test ls -R /app/api/static/panel && docker run --rm watchbug:test sh -c 'node --version 2>&1 || echo no-node-ok'` | ❌ Wave 0 — need `scripts/verify_docker_build.sh` |
| DEP-03 | `docker compose down` keeps data, `down -v` destroys (functional persistence) | integration | `docker compose up -d; curl -sf -X POST /api/incidents -H 'X-Project-Key: test' ... ; INC_COUNT=$(curl -sf http://localhost:8000/api/incidents \| jq .total); docker compose down; docker compose up -d; curl -sf http://localhost:8000/api/incidents \| jq ".total==$INC_COUNT"` | ❌ Wave 0 — need `tests/test_persistence.sh` |
| DEP-04 | `.env.example` documents all 11 Settings vars + copy-to-`.env` flow works | unit / manual | `diff <(grep -o '^[A-Z_]*=' .env.example) <(grep -o '^[A-Z_]*:' backend/app/config.py) || echo mismatch; cp .env.example .env && docker compose config --quiet` | ⚠️ — `.env.example` exists [VERIFIED: .env.example:1-32] but comparison script missing |
| DEP-05 | Image uses pinned `postgres:16-alpine` (not `latest`/`postgres`) and data survives minor pull | unit | `grep -q 'image: postgres:16-alpine' docker-compose.yml && grep -q 'FROM.*postgres:16' Dockerfile 2>/dev/null || echo ok-compose-only; docker inspect --format='{{.Config.Image}}' $(docker compose images -q db) \| grep -q 16` | ❌ Wave 0 — need `tests/test_pin.py` or grep gate in CI |

### Sampling Rate
- **Per task commit:** `docker compose config --quiet` (syntax validate) + `docker build --target panel-builder --dry-run` or `docker build` quick
- **Per wave merge:** `docker compose up -d --build && pytest backend/tests/test_health.py::test_health -q && curl -s http://localhost:8000/api/health | grep connected && docker compose ps`
- **Phase gate:** Full smoke: `down -v` → `up -d` → wait `service_healthy` → POST incident → GET incidents → `down` → `up -d` → verify persistence → `down -v` (documents destructive path)

### Wave 0 Gaps
- [ ] `tests/test_docker_smoke.py` or `scripts/smoke.ps1` — covers DEP-01, DEP-03, DEP-05 end-to-end smoke
- [ ] `scripts/verify_docker_build.sh` — covers DEP-02 image content assertions (`api/static/panel` present, no Node, non-root user)
- [ ] `docker-compose.yml` and `Dockerfile` + `docker-entrypoint.sh` themselves — required before any verification
- [ ] `.dockerignore` — required before first `docker build` to avoid context bloat
- [ ] Shared fixtures: `conftest.py` already exists; smoke helpers can reuse `httpx` fixture but should prefer real container curl for deployment truth
- [ ] CI gate: add `docker compose config` to existing `npm run check:size` / `pytest` pipeline so compose syntax breaks fail fast

*(If no gaps: Not empty — infra phases need first-time artifact creation before any tests can run)*

## Security Domain

> `security_enforcement` absent from config → enabled by default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `JWT_SECRET` must be rotated from placeholder; `bcrypt 5.0.0` [VERIFIED: backend/pyproject.toml:14] cost 12, `PyJWT 2.13.0` HS256, HttpOnly/SameSite=Lax/Secure cookie via `ENV=production` enables Secure flag [VERIFIED: backend/app/config.py:11-21] |
| V3 Session Management | yes | Short TTL `ACCESS_TOKEN_EXPIRE_MINUTES=60`, refresh `7d`, `ENV` toggles Secure cookie for localhost http vs prod https |
| V4 Access Control | no (infra only) | — |
| V5 Input Validation | yes | Preserve existing: CORS allowlist split (`cors_origins_list` computed field [VERIFIED: backend/app/config.py:23-26]), `IngestCorsMiddleware` open for `POST /api/incidents`, `MAX_PAYLOAD_BYTES=102400` [VERIFIED: backend/app/config.py:19] — do not open via `CORS_ORIGINS=*` in compose |
| V6 Cryptography | yes | Never bake secrets; use `POSTGRES_PASSWORD_FILE` / `docker secrets` pattern for prod later; Phase 04 keeps env_file model but warns to change placeholder |
| V14 Configuration | yes | `.dockerignore` prevents `.env` / `backend/.env` from being baked into image; `restart: unless-stopped` not `always` for dev loops |

### Known Threat Patterns for Docker / FastAPI / PostgreSQL Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret baked into image layer (`JWT_SECRET`, `POSTGRES_PASSWORD` visible in `docker history`) | Information Disclosure | `ENV` defaults are placeholders only; real values come from `env_file: .env` (ignored by `.dockerignore` + `.gitignore`); future: BuildKit `--mount=type=secret` for `pip install` tokens |
| Image runs as root → container escape more damaging | Elevation of Privilege | `USER app` (UID 10001) after `COPY --chown`, `init: true`/`tini` for signal reaping; never `USER root` at runtime [CITED: bigiron.cc, patrykgolabek.dev] |
| Unpinned `postgres:latest` upgrades major and corrupts `/var/lib/postgresql/data` | Denial of Service | Pin `postgres:16-alpine` (digest pin recommended) and document `pg_dump`/`pg_restore` path for 16→17 migration [CITED: techearl.com] |
| `CORS_ORIGINS` wildcard with credentials in compose for convenience | Information Disclosure | Keep per D-04 `CORS_ORIGINS=https://localhost` and `.env.example` pattern [VERIFIED: .env.example:19-20]; ingest open CORS is via `IngestCorsMiddleware` not via wildcard allowlist [VERIFIED: backend/app/main.py:60-83] |
| `down -v` run in production destroys volume | Denial of Service | Document `down` vs `down -v` prominently; add `README` warning and `compose` comment; consider `external: true` volume for prod cluster |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: backend/app/main.py:1-150] — `lifespan`, `create_app()`, `StaticFiles` mount at `/panel`, CORS/rate-limit middleware, seeding tolerance
- [VERIFIED: backend/app/config.py:1-31] — `Settings` 11 fields, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `ENV`, `cors_origins_list` computed field
- [VERIFIED: backend/app/routers/health.py:1-17] — `GET /api/health` `SELECT 1` → `{"status":"ok","db":"connected"|"disconnected"}`
- [VERIFIED: backend/alembic/env.py:1-64] — `get_settings()` → `sqlalchemy.url` override, `async_engine_from_config` + `NullPool`, `Base.metadata`
- [VERIFIED: backend/pyproject.toml:1-43] — `requires-python >=3.10`, `fastapi 0.141.1`, `pydantic 2.13.5`, `sqlalchemy[asyncio] 2.0.52`, `asyncpg 0.31.0`, `alembic 1.19.1`, `uvicorn[standard]`, `bcrypt 5.0.0`, `slowapi 0.1.10`
- [VERIFIED: panel/vite.config.ts:1-18] — `base: "./"`, `outDir: "../backend/api/static/panel"`, dev proxy `/api → localhost:8000`
- [VERIFIED: .env.example:1-32] — 11 vars documented (`DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGINS`, `DOCS_ENABLED`, `MAX_PAYLOAD_BYTES`, `DEFAULT_PROJECT_API_KEY`, `ENV`)

### Secondary (MEDIUM confidence)
- [CITED: docs.docker.com — compose-file/05-services/#depends_on, #healthcheck] — Compose Spec v2 `depends_on: condition: service_healthy` semantics, `healthcheck` duration format, no `version:` key
- [CITED: docs.docker.com — reference/dockerfile/#healthcheck] — `HEALTHCHECK --interval --timeout --retries --start-period` instructions
- [CITED: patrykgolabek.dev 2026-03-08 — FastAPI Production Docker Guide] — entrypoint `alembic upgrade head` before `exec uvicorn`, digest pinning, `tini` PID 1, `RUN --mount=type=cache` layer caching, single-worker default
- [CITED: toolsops.dev 2026-05-25 — Docker Compose PostgreSQL healthcheck & volume] — `pg_isready -U $$POSTGRES_USER`, `$$` escaping, `pgdata:/var/lib/postgresql/data`, `down -v` destroys, init only when volume empty
- [CITED: blog.gntech.me 2026-05-14 — Docker Compose Healthchecks] — `service_started` vs `service_healthy`, healthcheck correctness, `start_period` importance
- [CITED: techearl.com 2026-05-25 — How to Run PostgreSQL in Docker] — version EOL dates, Alpine vs Debian image sizes, `/var/lib/postgresql/data` path, major version incompatibility, `pg_isready` interval tuning
- [CITED: bigiron.cc 2026 — Multi-Stage Docker Builds: The 2026 Best Practice] — `# syntax=docker/dockerfile:1.7`, BuildKit cache mounts `type=cache,target=`, monorepo copy order, `distroless` vs `slim`
- [CITED: pkglog.com 2026-04-07 — Docker Multistage Build Optimization] — layer-cache good/bad ordering, `.dockerignore` necessity, Node/Python optimization tables
- [CITED: kowashlab.com 2026-02-01 — Docker for Backend Developers: Production Patterns] — healthcheck `interval 30s timeout 5s retries 3`, non-root user, `CORS` pitfall, `.dockerignore`
- [CITED: jakeinsight.com 2026-04-16 — Docker Compose depends_on Not Working: Postgres Startup Fix] — race table, `start_period` vs CI slowness, healthcheck required for `service_healthy`
- [CITED: aidevhub.ai 2026-05-09 — Docker Desktop WSL2 host networking trap] — `host` shares utility VM not WSL2, `!reset` override, `network_mode` vs `networks` mutual exclusivity
- [CITED: skucherenko.hashnode.dev 2026-07-27 — The localhost trap: 10s DB connection on Windows] — `localhost` dual-stack `::1` before `127.0.0.1`, 10,137 ms → 27 ms with `127.0.0.1`, `connect_timeout` necessity

### Tertiary (LOW confidence)
- [ASSUMED] `python:3.12-slim-bookworm` digest and `postgres:16-alpine` minor pin to be resolved at build time via `docker pull` — registry check deferred to planner
- [ASSUMED] Vitest/pytest integration for Docker persistence requires new script — no existing Docker test harness found; glob yielded no Dockerfile/compose files

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — images and base versions cross-checked across 6+ 2026 guides + Docker official docs; discrete values verified in repo files, but minor pins/digests not yet resolved via registry pull at this layer
- Architecture: MEDIUM — entrypoint vs lifespan separation and compose health gating are convergent across production templates; vite outDir relative path quirk needs prototype validation
- Pitfalls: MEDIUM — Windows WSL2 host networking + localhost trap are well-documented with measurements (10 s delay, `!reset` fix) and match continuity-pack's prior DevOps dead-end note; health 200-always behavior verified in repo

**Research date:** 2026-09-08
**Valid until:** 2026-10-08 (30 days — Docker/PG stable, but Compose Spec is now stable; shorten to 7 days if base image digest pin is adopted and needs monthly refresh)

