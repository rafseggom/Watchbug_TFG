# Phase 04: Docker Deployment - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 6 (5 new, 1 modified)
**Analogs found:** 5 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `Dockerfile` (repo root) | config (build) | batch/transform | `backend/pyproject.toml` + `panel/package.json` + `panel/vite.config.ts` | partial |
| `docker-compose.yml` (repo root) | config (orchestration) | request-response + persistence | `backend/app/config.py` + `.env.example` + `backend/app/main.py` | partial |
| `docker-entrypoint.sh` (repo root) | utility (script) | batch (migrate→exec) | `backend/alembic/env.py` + `backend/alembic.ini` + `backend/app/main.py` (lifespan) | role-match |
| `.dockerignore` (repo root) | config | file-I/O | `.gitignore` | exact |
| `.env.example` (modify) | config | CRUD (env injection) | `backend/app/config.py` | exact |
| `README.md` / `documentation/*` (modify, `down -v` docs) | config (docs) | file-I/O | `documentation/continuity-pack.md` | role-match |

**Notes on data-flow labels for infra files:** `batch/transform` = layer-cache ordered COPY→install→build→copy artifact; `request-response` = compose network + uvicorn + health gating; `batch` = entrypoint sequential `alembic upgrade head` then `exec uvicorn`.

---

## Pattern Assignments

### `Dockerfile` (config, batch/transform)

**Analog:** `backend/pyproject.toml` (lines 1-19, dependency manifest layer-cache pattern) + `panel/package.json` (lines 1-19, Node manifest) + `panel/vite.config.ts` (lines 1-8, build outDir) + `backend/app/main.py` (lines 137-143, static mount expectation) + `.gitignore` (lines 1-17, ignore hygiene)

> No existing Dockerfile in repo — `git ls-files` confirms zero `Dockerfile` tracked. Patterns extracted from manifests that Dockerfile must COPY in layer-cache order and from Vite outDir that Dockerfile must reproduce.

**Manifest-first layer cache pattern — `backend/pyproject.toml` (lines 1, 5-19):**
```toml
[project]
requires-python = ">=3.10"
dependencies = [
    "fastapi[standard]==0.141.1",
    "pydantic==2.13.5",
    "pydantic-settings==2.15.0",
    "sqlalchemy[asyncio]==2.0.52",
    "asyncpg==0.31.0",
    "alembic==1.19.1",
    "pyjwt==2.13.0",
    "bcrypt==5.0.0",
    "slowapi==0.1.10",
    "httpx>=0.27.0",
    "email-validator>=2.0.0",
    "uvicorn[standard]>=0.35.0",
]
# Dockerfile must: COPY backend/pyproject.toml + README* first → RUN pip install --no-cache-dir . → COPY backend/ rest
# python base: python:3.12-slim-bookworm (requires-python >=3.10 verified, slim avoids Alpine musl/bcrypt breakage — see RESEARCH Alternatives)
```

**Node manifest pattern — `panel/package.json` (lines 1-19):**
```json
{
  "name": "@watchbug/panel",
  "private": true,
  "type": "module",
  "scripts": { "build": "vite build" },
  "devDependencies": {
    "vite": "^6.3.5",
    "typescript": "^5.5.4",
    "vitest": "^2.1.9"
  }
}
// Dockerfile Node stage must: COPY panel/package.json panel/package-lock.json* ./ → RUN npm ci → COPY panel/ ./ → RUN npm run build
// Lockfile EXISTS (Test-Path True) → use npm ci (reproducible). Fallback if lockfile missing: npm install.
// Node base: node:22-alpine (vite 6.3.5 needs Node ≥18, 22-alpine is LTS minimal)
```

**Build artifact contract — `panel/vite.config.ts` (lines 1-8):**
```typescript
import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {
    outDir: "../backend/api/static/panel",
    emptyOutDir: true,
  },
});
// outDir is RELATIVE to panel/ workdir. Dockerfile WORKDIR choices determine correctness.
// Pitfall 5 fix: Either (a) WORKDIR /app + COPY panel/ ./panel/ + COPY backend/api/ ./backend/api/ + RUN npm --prefix panel run build
//          Or (b) absolute outDir override: RUN npm --prefix panel run build -- --outDir /app/backend/api/static/panel
// Planner MUST prototype with `ls -R` after build to assert artifact at /app/backend/api/static/panel/index.html
```

**Runtime static mount expectation — `backend/app/main.py` (lines 137-144):**
```python
    # Static panel mount — Vite builds to api/static/panel with base "./"
    try:
        from fastapi.staticfiles import StaticFiles
        import os
        panel_dir = os.path.join(os.path.dirname(__file__), "..", "api", "static", "panel")
        if os.path.isdir(panel_dir):
            app.mount("/panel", StaticFiles(directory=panel_dir, html=True), name="panel")
    except Exception:
        pass
# Dockerfile runtime stage must ensure: COPY backend/ ./  +  COPY --from=panel-builder /app/backend/api/static/panel ./api/static/panel
# container WORKDIR /app → panel_dir resolves to /app/api/static/panel → mount succeeds → GET /panel/ returns 200 not 404
# Verified: backend/app/main.py:137-143 is git-tracked (git ls-files shows it)
```

**Multi-stage skeleton to copy (assembled from RESEARCH.md verified patterns, lines 229-270, adapted to git-tracked project facts):**
```dockerfile
# syntax=docker/dockerfile:1.7
# Stage 0 — panel builder (use analog: panel/package.json + panel/vite.config.ts outDir)
FROM node:22-alpine AS panel-builder
WORKDIR /app
COPY panel/package.json panel/package-lock.json* ./panel/
RUN --mount=type=cache,target=/root/.npm npm --prefix panel ci
COPY panel/ ./panel/
COPY backend/api/ ./backend/api/
RUN npm --prefix panel run build  # writes to ../backend/api/static/panel per vite.config.ts:6

# Stage 1 — python runtime (use analog: backend/pyproject.toml layer-cache)
FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid 10001 --create-home --home-dir /home/app app \
 && apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && install -d -o app -g app /app/data
COPY backend/pyproject.toml backend/README.md* ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .
COPY backend/ ./
COPY --from=panel-builder /app/backend/api/static/panel ./api/static/panel
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown -R app:app /app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=60s CMD curl -f http://localhost:8000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
# Must keep --workers 1 in entrypoint for slowapi in-memory limiter (see Shared Patterns)
```

**Error handling in build:** Fail closed on COPY miss. `npm ci` fails if lockfile absent (fallback to `npm install`). `pip install` must run as root before `USER app`. `.dockerignore` must exclude `node_modules` to avoid 100s MB context.

---

### `docker-compose.yml` (config, request-response + persistence)

**Analog:** `backend/app/config.py` (lines 7-31, Settings contract) + `.env.example` (lines 1-32, env defaults + DATABASE_URL format) + `backend/app/routers/health.py` (lines 10-17, DB probe) + `backend/app/main.py` (lines 96-147, CORS + port + static mount)

> No existing `docker-compose.yml` in repo — `git ls-files` finds zero compose files. Analogs are the Settings/env/health contracts that compose must honor exactly.

**Settings contract — `backend/app/config.py` (lines 7-31) — COMPOSE MUST MIRROR THESE KEYS:**
```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    DATABASE_URL: str = Field(default="postgresql+asyncpg://watchbug:watchbug@localhost:5432/watchbug")
    JWT_SECRET: str = Field(default="dev-secret-must-be-at-least-32-chars-long-please-change")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    ADMIN_EMAIL: str = Field(default="admin@watchbug.local")
    ADMIN_PASSWORD: str = Field(default="Admin123!", min_length=8)
    CORS_ORIGINS: str = Field(default="http://localhost:5173")
    DOCS_ENABLED: bool = Field(default=False)
    MAX_PAYLOAD_BYTES: int = Field(default=102400)
    DEFAULT_PROJECT_API_KEY: str = Field(default="wb_test_project_key_123")
    ENV: str = Field(default="development")
    @computed_field
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
# Compose `api.environment` must provide: DATABASE_URL (with @db:5432, NOT @localhost), JWT_SECRET, CORS_ORIGINS, ENV, ADMIN_*, DEFAULT_PROJECT_API_KEY, DOCS_ENABLED
# Compose must also use `env_file: [.env]` so user override wins over `environment:` defaults (SEC-04 zero-secrets-in-code)
# ENV default in compose: ${ENV:-production} (secure) but Settings default is development — compose overrides to production for deployed container
```

**Env file pattern — `.env.example` (lines 1-32) — compose secure defaults copy from here:**
```ini
# Watchbug Backend Environment Variables
# Copy to backend/.env and fill values
DATABASE_URL=postgresql+asyncpg://watchbug:watchbug@localhost:5432/watchbug
JWT_SECRET=change-me-to-a-random-secret-at-least-32-chars
CORS_ORIGINS=http://localhost:5173
ENV=development
# Docs rule: never bake real JWT_SECRET in compose; use placeholder that users MUST override via .env
# CRITICAL difference: .env.example uses @localhost:5432 for host-local dev; compose DATABASE_URL MUST use @db:5432 for bridge DNS
# Compose default: DATABASE_URL=postgresql+asyncpg://watchbug:watchbug@db:5432/watchbug  (service name `db` is DNS, never localhost inside network)
```

**Health probe + CORS contract — `backend/app/routers/health.py` (lines 10-17) + `backend/app/main.py` (lines 118-126):**
```python
# health.py — current always-200 behavior (Pitfall 2: curl -f alone will never fail when db disconnected)
@router.get("/api/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {"status": "ok", "db": db_status}  # always 200 — Docker must use JSON-asserting probe or change to 503

# main.py CORS — never allow_origins=["*"] with allow_credentials True (raises ValueError)
# Compose CORS_ORIGINS default must be https://localhost (D-04) or real allowlist, not "*"
# Compose api.ports: "8000:8000" (host uses 127.0.0.1:5432 for db publish to avoid Windows ::1 delay)
```

**Canonical compose to copy (from RESEARCH.md lines 282-335, adjusted with git-tracked Settings defaults, line numbers cite RESEARCH):**
```yaml
# docker-compose.yml — Compose Spec (NO version: key) — single file per INV-03
services:
  db:
    image: postgres:16-alpine  # D-02 pinned, ~70MB Alpine, pg_isready ships built-in
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-watchbug}
      POSTGRES_USER: ${POSTGRES_USER:-watchbug}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-watchbug}
    volumes:
      - pgdata:/var/lib/postgresql/data  # PG16 path (PG18 changed to /var/lib/postgresql — do NOT use PG18 path)
    ports:
      - "127.0.0.1:5432:5432"   # loopback only + 127.0.0.1 avoids Windows ::1 10s fallback (Pitfall 4)
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]  # $$ escaped for compose runtime (RESEARCH: toolsops.dev)
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  api:
    build:
      context: .            # repo root so Dockerfile can COPY panel/ + backend/ in one file
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://watchbug:watchbug@db:5432/watchbug  # @db not @localhost (bridge DNS)
      ENV: ${ENV:-production}        # D-04 secure default
      JWT_SECRET: ${JWT_SECRET:-change-me-to-a-random-secret-at-least-32-chars}
      CORS_ORIGINS: ${CORS_ORIGINS:-https://localhost}  # D-04, never "*"
      ADMIN_EMAIL: ${ADMIN_EMAIL:-admin@watchbug.local}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-Admin123!}
      DEFAULT_PROJECT_API_KEY: ${DEFAULT_PROJECT_API_KEY:-wb_test_project_key_123}
      DOCS_ENABLED: ${DOCS_ENABLED:-false}
    env_file:
      - .env                  # user override wins; file may not exist (compose warns, continues)
    depends_on:
      db:
        condition: service_healthy  # NOT short syntax [db] — short only waits for PID, not pg_isready (Pitfall 1)
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/api/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s      # covers alembic on fresh DB
    init: true               # tini equivalent for PID 1 reaping without baking tini

volumes:
  pgdata:                   # survives `down`, destroyed by `down -v` (DEP-03)
```

**Known pitfall variant (RESEARCH Open Question 1, Pitfall 2):** Current `/api/health` always 200 means `curl -f` probe never fails when DB down. Two options — planner must choose one and document: (a) keep 200 and use strict `python -c` JSON probe (`sys.exit(0 if d.get('db')=='connected' else 1)`), or (b) change endpoint to 503 when disconnected (requires API change, contradicts infra-only boundary). Preferred for Phase 04: (a) to keep infra-only — use alternative test `CMD python -c "import urllib.request,json,sys; d=json.load(urllib.request.urlopen('http://localhost:8000/api/health')); sys.exit(0 if d.get('db')=='connected' else 1)"` if avoiding curl false-healthy.

---

### `docker-entrypoint.sh` (utility, batch)

**Analog:** `backend/alembic/env.py` (lines 1-24, 38-46, async migration runner + DATABASE_URL from Settings) + `backend/alembic.ini` (lines 1-5, script_location) + `backend/app/main.py` (lines 16-49, lifespan seeding that swallows DB errors)

**Alembic runner pattern — `backend/alembic/env.py` (lines 18-46):**
```python
# Windows Proactor loop fix — entrypoint must NOT need this; container is Linux, but env.py handles host Windows
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from app.config import get_settings
config = context.config
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)  # env.py reads DATABASE_URL from Settings → compose DATABASE_URL must be async URL

async def run_migrations_online():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # NullPool for migrations — no pooling
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()
# Entrypoint simply invokes: alembic -c alembic.ini upgrade head  →  this code runs via env.py
# Must run from WORKDIR /app where alembic.ini lives (line 3: script_location = alembic)
```

**Alembic config — `backend/alembic.ini` (lines 1-5):**
```ini
# Alembic config - sqlalchemy.url overridden by env.py at runtime
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+asyncpg://watchbug:watchbug@localhost:5432/watchbug
# Runtime override: env.py:24 config.set_main_option("sqlalchemy.url", settings.DATABASE_URL) → compose DATABASE_URL wins
# Entrypoint must: cd /app (WORKDIR) so that `alembic -c alembic.ini upgrade head` finds ./alembic/versions/001_initial.py
```

**Seeding vs migration split — `backend/app/main.py` lifespan (lines 16-49):**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from sqlalchemy.ext.asyncio import async_sessionmaker
        from app.db import get_engine
        from app.services.auth_service import seed_admin
        from app.services.project_service import seed_default_project
        settings = get_settings()
        engine = get_engine()
        try:
            async_session = async_sessionmaker(engine, expire_on_commit=False)
            async with async_session() as session:
                await seed_admin(session, settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
                try:
                    await seed_default_project(session, settings.DEFAULT_PROJECT_API_KEY)
                except Exception:
                    pass
        except Exception:
            pass  # swallows DB-unreachable so startup never crashes — entrypoint migration already handled schema
    except Exception:
        pass
    yield
# Pattern: entrypoint OWNS migrations (before uvicorn), lifespan OWNS seeding (after DB ready, tolerant)
# Do NOT move seeding into entrypoint — lifespan is idempotent and already tested; entrypoint only runs alembic
```

**Entrypoint to copy (from RESEARCH lines 206-213, adapted to project specifics):**
```bash
#!/usr/bin/env sh
set -eu
# docker-entrypoint.sh — must chmod +x in Dockerfile (RUN chmod +x)
# WORKDIR is /app, alembic.ini is at /app/alembic.ini, migrations at /app/alembic/versions/
echo "Applying Alembic migrations..."
# Depends_on: service_healthy already gated db, but keep single attempt — pg_isready ensures DB accepts connections
alembic -c alembic.ini upgrade head
# Single worker required for slowapi in-memory limiter (continuity-pack: --workers 1, Pitfall 6)
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --proxy-headers
# Alternative port pattern: "${PORT:-8000}" allows compose ports: "${PORT:-8000}:8000" remap if host 8000 busy
# Dockerfile ENTRYPOINT: ["./docker-entrypoint.sh"] + USER app (non-root, chmod +x already done)
# Compose `init: true` provides PID 1 reaping — entrypoint does NOT need tini baked
```

**Error handling:** `set -eu` so alembic failure aborts before uvicorn starts (fail-closed). `exec` replaces shell PID so SIGTERM reaches uvicorn directly (plus `init: true` reaps zombies). Do NOT use `network_mode: host` or `localhost` in DATABASE_URL (see Shared Patterns).

---

### `.dockerignore` (config, file-I/O)

**Analog:** `.gitignore` (lines 1-17) — exact pattern: ignore build artifacts, venv, node_modules, git metadata, env files.

**Source — `.gitignore` (lines 1-17) — git-tracked, verified via `git ls-files`:**
```gitignore
.gsd-profile
.gsd-install-state.json
node_modules/
.opencode
# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
.env
.venv/
venv/
```

**`.dockerignore` to copy — extend `.gitignore` pattern for Docker context hygiene (RESEARCH Pitfall: no .dockerignore → hundreds MB context):**
```gitignore
# Copy .gitignore base, then Docker-specific additions:
.git
.gitignore
.gsd/
.planning/
.vscode/
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
node_modules/
panel/dist/
backend/api/static/panel/   # build artifact — produced by Node stage, do NOT send as context
backend/.venv/
backend/__pycache__/
.opencode/
.env                        # never send real secrets as build context (SEC-04)
*.log
coverage/
```

**Why exact match:** `.dockerignore` uses identical glob syntax to `.gitignore`. Both filter build context before first `COPY`. Missing entries cause slow `docker build` (sends `node_modules` ~hundreds MB). Verified: `panel/node_modules` exists on disk, must be excluded.

---

### `.env.example` (config, CRUD) — MODIFY existing

**Analog:** `backend/app/config.py` (lines 7-31, Settings field definitions + defaults + types)

**Settings truth — `backend/app/config.py` (lines 7-31):**
```python
DATABASE_URL: str = Field(default="postgresql+asyncpg://watchbug:watchbug@localhost:5432/watchbug")
JWT_SECRET: str = Field(default="dev-secret-must-be-at-least-32-chars-long-please-change")
JWT_ALGORITHM: str = Field(default="HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
ADMIN_EMAIL: str = Field(default="admin@watchbug.local")
ADMIN_PASSWORD: str = Field(default="Admin123!", min_length=8)
CORS_ORIGINS: str = Field(default="http://localhost:5173")
DOCS_ENABLED: bool = Field(default=False)
MAX_PAYLOAD_BYTES: int = Field(default=102400)
DEFAULT_PROJECT_API_KEY: str = Field(default="wb_test_project_key_123")
ENV: str = Field(default="development")
```

**Current `.env.example` (lines 1-32) — gap vs Settings:**
```ini
# Already documents 11 vars — matches Settings count. Needs:
# 1. Clarify DATABASE_URL dual: localhost for host dev vs db for compose (comment)
# 2. D-04: Add note that compose provides secure production defaults (ENV=production, JWT placeholder, CORS=https://localhost) overridden via .env
# 3. Document POSTGRES_* (POSTGRES_DB/USER/PASSWORD) — not Settings but required by db service (compose environment)
# 4. Document PORT (optional, for compose ports remap)
# 5. Document `down -v` behavior cross-ref (DEP-03)
```

**Pattern to copy — update `.env.example` by adding compose-specific section below existing 11, keep existing variable names/values unchanged:**
```ini
# === Docker Compose overrides (uncomment to override compose defaults) ===
# Compose DATABASE_URL uses service name `db` — override only if you need custom DB name/host
# DATABASE_URL=postgresql+asyncpg://watchbug:watchbug@db:5432/watchbug
# POSTGRES_DB=watchbug
# POSTGRES_USER=watchbug
# POSTGRES_PASSWORD=watchbug
# ENV=production
# JWT_SECRET=generate-with-python -c "import secrets; print(secrets.token_urlsafe(32))"
# CORS_ORIGINS=https://localhost
# PORT=8000
```

**Validation pattern:** After update, `diff <(grep -o '^[A-Z_]*=' .env.example | sort) <(grep -E '^\s+[A-Z_]+:' backend/app/config.py | sed 's/.*\([A-Z_]*\):.*/\1=/' | sort)` should show only POSTGRES_* / PORT as extra (expected, not error).

---

### `README.md` / documentation updates (config, file-I/O) — MODIFY existing

**Analog:** `documentation/continuity-pack.md` (lines 86-90, Windows networking dead-end + operational notes pattern)

**Operational note pattern — `documentation/continuity-pack.md` (lines 86-90):**
```markdown
  3. Docker Desktop Windows asyncpg host networking broken — workaround docker network + sqlite fallback (Plan 01)
  6. Invalid filter values silently returning 200 — fixed via upfront `ValueError->422` (Plan 04)
- **Notas de continuidad**:
   - SQLite file fallback en `conftest.py` — tests corren en host sin Docker real; real PG verificado via docker network
   - `--workers 1` requerido por slowapi in-memory limiter (no multi-worker safe)
```

**Pattern to copy — add to README/continuity-pack operational section (docs must mirror RESEARCH Pitfalls 1-5):**
```markdown
## Docker Persistence
- `docker compose down` keeps `pgdata` named volume (data survives).
- `docker compose down -v` / `docker volume rm <project>_pgdata` DESTROYS data (incidents/users) — document for operator.
- `POSTGRES_*` env vars only apply on FIRST init when volume empty; changing password after requires `ALTER USER` or `down -v`.
## Windows quirk
- Use `127.0.0.1:5432:5432` not `localhost:5432` for published DB port (Windows dual-stack ::1 delay ~10s).
- Inside compose network, DATABASE_URL must use `db:5432` not `localhost:5432`.
```

---

## Shared Patterns

### Environment & Secrets (SEC-04, D-04)
**Source:** `backend/app/config.py` (lines 1-8, SettingsConfigDict) + `.env.example` (lines 1-32) + `backend/alembic/env.py` (lines 18-24)
**Apply to:** `docker-compose.yml`, `Dockerfile`, `.env.example`, `docker-entrypoint.sh`
```python
# pydantic-settings reads .env at runtime; image must NOT bake secrets
from pydantic_settings import BaseSettings, SettingsConfigDict
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
# Compose pattern: environment: provides secure production placeholders + env_file: [.env] allows override
# Placeholder JWT_SECRET must be documented as "change-me" and fail-secure (app warns if default unchanged)
# Never COPY .env into image — .dockerignore excludes it
# DATABASE_URL duality: .env.example=localhost for host dev; compose DATABASE_URL=@db for bridge DNS
```

### Health Gating (DEP-01, Pitfall 1+2)
**Source:** `backend/app/routers/health.py` (lines 10-17, SELECT 1) + `backend/app/db.py` (lines 13-32, lazy engine) + RESEARCH Pitfall 1 (depends_on: service_healthy)
**Apply to:** `docker-compose.yml` (both services), `Dockerfile` HEALTHCHECK
```python
# health.py: SELECT 1 probe — returns 200 always, db: connected/disconnected
# Compose db: healthcheck pg_isready with start_period 20s, api depends_on condition: service_healthy
# Dockerfile HEALTHCHECK fallback: same curl probe as compose (compose overrides Dockerfile HEALTHCHECK at runtime)
# Alternative strict probe if curl false-healthy: python -c urllib JSON assert db==connected
# Do NOT use depends_on short syntax [db] — only waits for PID, not readiness
```

### Non-Root + Signal Handling (Security + Pitfall 6)
**Source:** `backend/app/main.py` (lines 109-111, limiter single-worker) + `documentation/continuity-pack.md` (line 87, --workers 1) + RESEARCH Pattern 2 (useradd, init: true)
**Apply to:** `Dockerfile` (USER app, chown, curl install), `docker-entrypoint.sh` (exec, --workers 1), `docker-compose.yml` (init: true)
```dockerfile
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid 10001 --create-home --home-dir /home/app app \
 && apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
 && install -d -o app -g app /app/data
USER app
# entrypoint: exec uvicorn ... --workers 1 --proxy-headers  (slowapi in-memory limiter breaks with >1)
# compose: init: true (tini-equivalent PID 1 reaping) — no need to bake tini
```

### Bridge Networking + Windows Dual-Stack (Pitfalls 3+4)
**Source:** `documentation/continuity-pack.md` (line 86, Docker Desktop Windows broken) + `.env.example` (line 6, localhost) + RESEARCH Anti-Patterns
**Apply to:** `docker-compose.yml` (all DATABASE_URL and ports)
```yaml
# Anti-patterns to avoid: network_mode: host (breaks on Docker Desktop WSL2), localhost inside container, localhost on Windows host
# Correct:
#   api.environment.DATABASE_URL: postgresql+asyncpg://watchbug:watchbug@db:5432/watchbug  # @db is Docker DNS
#   db.ports: "127.0.0.1:5432:5432"   # not "5432:5432" (public) nor "localhost:5432:5432"
#   Host tools: psql -h 127.0.0.1 -p 5432 (not -h localhost)
```

### Build Context Hygiene (RNF-01 bundle gate unrelated but hygiene)
**Source:** `.gitignore` (lines 1-17) + `scripts/check-size.js` (lines 1-53, bundle ≤45KB gate)
**Apply to:** `.dockerignore`, `Dockerfile` (COPY order)
```gitignore
# .dockerignore extends .gitignore: exclude node_modules, .venv, __pycache__, .git, .env, panel/dist, backend/api/static/panel
# Verify with: docker build --dry-run or `docker build . 2>&1 | head` shows "Sending build context" size < few MB, not hundreds
# Bundle gate: panel build does NOT affect sdk bundle (check-size.js checks sdk/dist/watchbug.js, not panel)
```

---

## No Analog Found

| File | Role | Data Flow | Reason | Fallback |
|------|------|-----------|--------|----------|
| `docker-compose.yml` orchestration structure (Compose Spec services/volumes/healthcheck/depends_on) | config | request-response + persistence | No compose file tracked in repo (`git ls-files` confirms zero). Nearest analog is Settings/env/health contracts, not compose YAML itself | Use RESEARCH.md lines 282-335 canonical compose + Code Examples (official docs.docker.com) as reference — planner must validate with `docker compose config --quiet` |
| `Dockerfile` multi-stage FROM/AS/COPY --from syntax | config | batch/transform | No Dockerfile tracked. Nearest analogs are pyproject/packaging manifests that inform COPY layer order | Use RESEARCH.md Pattern 2 (lines 229-270) layer-cache ordered multi-stage + verify with `docker build -t watchbug:test . && docker run --rm watchbug:test ls -R /app/api/static/panel` |

> Partial analogs EXIST for both (Settings, manifests, outDir), but the Docker DSL itself has no prior art in this repo. RESEARCH.md official patterns (docs.docker.com, patrykgolabek.dev) are the primary source for Dockerfile/compose YAML syntax; codebase analogs provide the VALUES (env names, outDir, health path, port).

---

## Metadata

**Analog search scope:** `/` (repo root), `backend/`, `backend/app/`, `backend/alembic/`, `panel/`, `scripts/`, `documentation/`, `.planning/` (context only), `.gitignore`, `package.json` (root)
**Files scanned:** 18 (tracked: `.env.example`, `.gitignore`, `backend/app/config.py`, `backend/app/db.py`, `backend/app/main.py`, `backend/app/routers/health.py`, `backend/alembic/env.py`, `backend/alembic.ini`, `backend/pyproject.toml`, `panel/package.json`, `panel/vite.config.ts`, `scripts/check-size.js`, `documentation/continuity-pack.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, plus non-tracked existence checks for `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `panel/package-lock.json`)
**Pattern extraction date:** 2026-09-08
**Git-tracked verification:** All analog paths verified via `git ls-files -- <path>` (non-empty = tracked). No mirror paths emitted. Phase 04 is greenfield infra — no prior Docker artifacts to inherit, so all analogs are indirect (Settings/manifests/health) rather than direct Dockerfile/compose copies.
**Research confidence:** MEDIUM (per 04-RESEARCH.md) — assumptions A1-A5 logged, planner must prototype vite outDir and npm ci vs install.
