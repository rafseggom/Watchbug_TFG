---
phase: 04
phase_name: "Docker Deployment"
project: "Watchbug SDK"
generated: "2026-09-08"
counts:
  decisions: 6
  lessons: 4
  patterns: 4
  surprises: 2
missing_artifacts: []
---

# Phase 04 Learnings: Docker Deployment

## Decisions

### Single Multi-Stage Dockerfile (D-01)
Single multi-stage Dockerfile with Node 22-alpine builder stage for panel SPA and Python 3.12-slim runtime stage. Avoids managing separate Dockerfiles and keeps build context unified.

**Rationale:** Simplifies build pipeline; changing to separate Dockerfiles would require restructuring compose build keys (rated "costly" reversibility). Panel builds INTO backend/api/static/panel/ via vite outDir, so COPY --from pattern works cleanly.

**Source:** 04-01-PLAN.md D-01, 04-01-SUMMARY.md

---

### PostgreSQL 16-alpine Pinned (D-02)
Pin PostgreSQL to `postgres:16-alpine` specifically, not `:latest` or `:16`. Prevents major version upgrade breakage (PG16 → PG17 volume format corruption).

**Rationale:** Self-hosted deployment must be stable; pinning ensures reproducible builds. Changing the image tag is a one-line edit, but data migration between major versions requires pg_dump/pg_restore.

**Source:** 04-01-PLAN.md D-02, 04-CONTEXT.md

---

### Entrypoint Auto-Migration (D-03)
Entrypoint script runs `alembic upgrade head` automatically before starting uvicorn. Zero manual migration steps required for self-hosted deployment.

**Rationale:** Expected UX for self-hosted product — operators should not need to know about Alembic. Entrypoint is idempotent; lifespan seeding in main.py is also idempotent.

**Source:** 04-01-PLAN.md D-03, docker-entrypoint.sh

---

### PYTHONPATH=/app in Container
Added `ENV PYTHONPATH=/app` to Dockerfile runtime stage to fix Alembic module resolution (`from app.models import Base`).

**Rationale:** Alembic env.py imports `app.models` but Python path inside container didn't include `/app`, causing ModuleNotFoundError. This is a container-specific path issue not present in host development.

**Source:** 04-01-SUMMARY.md (deviation Rule 1)

---

### DB Port Remapped to 5433:5432
Remapped db port from `127.0.0.1:5432:5432` to `127.0.0.1:5433:5432` to avoid conflict with host PostgreSQL on port 5432.

**Rationale:** Development machines often have PostgreSQL running on default port 5432. Loopback-only binding prevents public exposure; host tools use `127.0.0.1:5433`.

**Source:** 04-01-SUMMARY.md (deviation Rule 3)

---

### env_file Optional via required: false
Made `env_file` optional in docker-compose.yml via `[{path: .env, required: false}]` so compose config works without .env file present.

**Rationale:** Compose v5.5.0 supports this syntax. Allows `docker compose config` to pass both with and without .env, using `${VAR:-default}` fallbacks in the environment block. Critical for CI/CD and fresh clone workflows.

**Source:** 04-02-SUMMARY.md (deviation Rule 3)

---

## Lessons

### Container Module Paths Differ from Host
Python module resolution in containers differs from host development. Alembic's `from app.models import Base` works on host because of PYTHONPATH or cwd, but fails in container without explicit `ENV PYTHONPATH=/app`.

**Context:** This is a common Docker+Python pitfall — always test Alembic migrations inside the container, not just on host.

**Source:** 04-01-SUMMARY.md

---

### Port Conflicts Require Explicit Handling
Host services (like PostgreSQL) commonly occupy default ports. Docker Compose port mappings must account for this — either use non-default host ports or document the conflict resolution.

**Context:** On Windows development machines, PostgreSQL often runs as a service on port 5432. The Docker db container cannot bind to the same port.

**Source:** 04-01-SUMMARY.md

---

### env_file Syntax Varies by Compose Version
The `env_file` directive syntax differs between Compose versions. Compose v5.5.0+ supports `[{path: .env, required: false}]` but older versions use plain string syntax. Must verify target Compose version supports the syntax.

**Context:** The `required: false` option is essential for development workflows where .env may not exist.

**Source:** 04-02-SUMMARY.md

---

### POSTGRES_* Env Vars Are Init-Only
POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD only apply when the PostgreSQL volume is first created. Changing these after initial boot requires either `ALTER USER` SQL or `docker compose down -v` to recreate the volume.

**Context:** Operators frequently misunderstand this — must be documented prominently in README and .env.example.

**Source:** 04-02-PLAN.md, README.md

---

## Patterns

### Multi-Stage Dockerfile: Node Builder → Python Runtime
Pattern for building SPA frontends in Docker: use Node alpine for build stage, copy static output to Python slim runtime. No Node.js in production image.

**When to use:** Any project where a JavaScript build step produces static assets served by a Python/Go/Ruby backend.

**Source:** 04-01-SUMMARY.md, Dockerfile

---

### Health-Gated depends_on with pg_isready
Compose `depends_on` with `condition: service_healthy` and a `pg_isready` healthcheck prevents startup race conditions. The API service waits until PostgreSQL accepts connections before starting.

**When to use:** Any Docker Compose stack where one service depends on a database being ready. Avoids application-level retry loops and connection refused errors.

**Source:** 04-01-SUMMARY.md, docker-compose.yml

---

### Entrypoint Pattern: set -eu + Migration + exec
POSIX shell entrypoint with `set -eu` (exit on error, undefined vars error), run migrations, then `exec` the main process. Single worker for slowapi in-memory limiter compatibility.

**When to use:** Any containerized Python/FastAPI application that needs database migrations on startup. The `exec` ensures the app process becomes PID 1 for signal handling.

**Source:** docker-entrypoint.sh, 04-01-SUMMARY.md

---

### README Volume Lifecycle Matrix
Documenting Docker volume lifecycle explicitly: `docker compose down` keeps named volumes, `docker compose down -v` destroys them. Include a table format for clarity.

**When to use:** Any self-hosted application using Docker volumes for data persistence. Operators need to understand what survives restarts vs what is destructive.

**Source:** README.md, 04-02-SUMMARY.md

---

## Surprises

### Build Context Reduced to 674B with .dockerignore
The .dockerignore reduced Docker build context from the full repo to 674 bytes. Excluding .git, node_modules, .venv, and other development artifacts dramatically speeds up builds.

**Impact:** First-time builds and CI/CD pipelines benefit significantly from small build context. The .dockerignore pattern mirrors .gitignore with Docker-specific additions.

**Source:** 04-01-SUMMARY.md

---

### Compose Spec Works Without version: Key
Modern Docker Compose (v2+) does not require a `version:` key. Removing it eliminates deprecation warnings and produces cleaner compose config output. The spec is inferred from the file structure.

**Impact:** Cleaner compose files, no version warnings in output. Must verify target Docker Compose version supports spec inference.

**Source:** 04-01-PLAN.md, docker-compose.yml
