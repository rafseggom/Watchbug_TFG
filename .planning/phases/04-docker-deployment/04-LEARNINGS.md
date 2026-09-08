---
phase: 04
phase_name: "Docker Deployment"
project: "Watchbug SDK"
generated: "2026-09-08"
counts:
  decisions: 4
  lessons: 3
  patterns: 3
  surprises: 1
missing_artifacts: []
---

# Phase 04 Learnings: Docker Deployment

## Decisions

### env_file with required: false
Make `env_file` optional via `required: false` so `docker-compose config` works without a `.env` file — compose defaults in the `environment:` block take effect.

**Rationale:** Developers may not have `.env` on first clone; compose should still validate. The `${VAR:-default}` syntax provides fallback values.
**Source:** 04-02-SUMMARY.md

---

### curl -f Healthcheck, Not Strict JSON Probe
Use `curl -f http://localhost:8000/api/health` for the API healthcheck, not a strict JSON body check.

**Rationale:** Infra-only phase boundary; `curl -f` (fail on HTTP errors) is sufficient. Strict JSON validation belongs in integration tests.
**Source:** 04-02-SUMMARY.md

---

### Multi-Stage Dockerfile: Node Builder + Python Runtime
Two stages: `node:22-alpine` for panel build → `python:3.12-slim-bookworm` for runtime. Panel output copied via `COPY --from=panel-builder`.

**Rationale:** Node.js is only needed for `npm run build`; runtime image stays small (Python only). No Node.js attack surface in production.
**Source:** 04-01-SUMMARY.md

---

### Entrypoint: Alembic Then Uvicorn
`docker-entrypoint.sh` runs `alembic upgrade head` before `exec uvicorn --workers 1`. Single worker documented as slowapi constraint.

**Rationale:** Schema migrations must run before the app starts accepting requests. `exec` replaces shell with uvicorn for proper signal handling.
**Source:** 04-01-SUMMARY.md

---

## Lessons

### POSTGRES_* Vars Are Init-Only
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` only take effect on first volume init (when `/var/lib/postgresql/data` is empty). Changing them later has no effect.

**Context:** Common Docker PostgreSQL gotcha. Documented in `.env.example` with rotation instructions.
**Source:** 04-02-SUMMARY.md

---

### Windows Needs 127.0.0.1, Not localhost
On Windows, `localhost` may resolve to IPv6 `::1` first, causing 10s fallback delays. Using `127.0.0.1` in `DATABASE_URL` avoids this.

**Context:** Docker Desktop on Windows uses Hyper-V networking; IPv4 loopback is more reliable.
**Source:** 04-README.md

---

### down -v Is Destructive
`docker compose down -v` destroys the named volume and all data. Must be documented prominently — developers used to `docker-compose down` expect data persistence.

**Context:** The `-v` flag is easy to type accidentally; the README documents this explicitly.
**Source:** 04-02-SUMMARY.md

---

## Patterns

### env_file Optional with Compose Defaults
```yaml
environment:
  DATABASE_URL: postgresql+asyncpg://watchbug:watchbug@db:5432/watchbug
env_file:
  - path: .env
    required: false
```
Compose provides secure defaults; `.env` overrides when present.

**When to use:** Self-hosted apps where `.env` is optional but overrides defaults.
**Source:** 04-02-SUMMARY.md

---

### Multi-Stage Dockerfile Pattern
```dockerfile
FROM node:22-alpine AS builder
COPY panel/ . && npm ci && npm run build

FROM python:3.12-slim AS runtime
COPY --from=builder /app/backend/api/static/panel ./api/static/panel
```

**When to use:** Projects with separate frontend build and backend runtime.
**Source:** 04-01-SUMMARY.md

---

### Volume Lifecycle Documentation
```markdown
| Command | Data |
|---------|------|
| `docker compose down` | Preserved |
| `docker compose down -v` | Destroyed |
```

**When to use:** Any Docker deployment with persistent data volumes.
**Source:** 04-02-SUMMARY.md

---

## Surprises

### compose config Passes Without .env
With `env_file: [{path: .env, required: false}]` and `${VAR:-default}` syntax, `docker-compose config` validates successfully even without a `.env` file.

**Impact:** Better developer experience; first clone works immediately with defaults.
**Source:** 04-02-SUMMARY.md
