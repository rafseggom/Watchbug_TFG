# Watchbug

Open-source, self-hosted error reporting & visual feedback SDK for web applications. Inject a lightweight widget into your app to capture bugs with visual screenshots, console logs, and environment metadata — all deployable via a single `docker compose up`.

---

## Quickstart

```bash
# 1. Clone the repo
git clone https://github.com/your-org/watchbug.git
cd watchbug

# 2. Copy environment file and set a secure JWT secret
cp .env.example .env
# Edit .env and replace JWT_SECRET with a real secret:
#   python -c "import secrets; print(secrets.token_urlsafe(32))"

# 3. Start the stack
docker compose up -d --build

# 4. Verify services are healthy
curl http://localhost:8000/api/health
# → {"status":"ok","db":"connected"}

# 5. Open the admin panel
open http://localhost:8000/panel/
# Default login: admin@watchbug.local / Admin123!
```

---

## Services

| Service | Port | Description |
|---------|------|-------------|
| **api** | `8000` | FastAPI backend + panel SPA served at `/panel` |
| **db** | `5432` (internal) | PostgreSQL 16-alpine |

**Exposed ports on host:**
- `http://localhost:8000` — API + Panel
- `127.0.0.1:5433` — PostgreSQL (optional, for host tools like `psql`)

---

## Environment Setup

Copy `.env.example` to `.env` at the repo root and edit values:

```bash
cp .env.example .env
```

**Must-change before production:**
- `JWT_SECRET` — generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- `ADMIN_PASSWORD` — default `Admin123!` is for development only
- `CORS_ORIGINS` — set to your actual domain (never use `*` with credentials)

**Compose provides secure production defaults** via `${VAR:-default}` in `docker-compose.yml`. The `env_file: .env` overrides these defaults when the file exists. If `.env` is missing, compose uses the `environment:` block defaults (which include a placeholder `JWT_SECRET` that must be changed).

See `.env.example` for the full list of 11 backend Settings variables plus 3 PostgreSQL container variables (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`).

---

## Volume Lifecycle

Watchbug uses a **named Docker volume** `pgdata` for PostgreSQL data persistence.

| Command | What happens to `pgdata` | Data safe? |
|---------|--------------------------|------------|
| `docker compose down` | Volume **survives** — data intact | ✅ Yes |
| `docker compose up -d` | Volume re-attached — data restored | ✅ Yes |
| `docker compose down -v` | Volume **destroyed** — all incidents, users, projects lost | ❌ No |
| `docker volume rm <project>_pgdata` | Same as `down -v` | ❌ No |

**Data lifecycle:**
- `docker compose down` then `docker compose up -d` — your incidents, users, and projects survive
- `docker compose down -v` — wipes everything; next `up` starts with a fresh database

**PostgreSQL password rotation:**
Changing `POSTGRES_PASSWORD` in `.env` after the first boot has **no effect** — PostgreSQL only initializes credentials when the volume is empty. To rotate the password after first boot:

```bash
# Option 1: ALTER USER (keeps data)
docker exec -it watchbug-db-1 psql -U watchbug -c "ALTER USER watchbug PASSWORD 'newpassword';"
# Also update DATABASE_URL in .env to match

# Option 2: Wipe and re-seed (loses data)
docker compose down -v
docker compose up -d --build
```

---

## Windows Notes

Docker Desktop on Windows (WSL2 backend) has a known quirk with `localhost` resolution:

- **Use `127.0.0.1`** instead of `localhost` for `psql` and other host tools connecting to the published PostgreSQL port (`127.0.0.1:5433`)
- `localhost` resolves dual-stack (`::1` + `127.0.0.1`), causing a ~10 second IPv6 fallback delay on every connection
- **Never use `network_mode: host`** on Docker Desktop — it shares the utility VM, not WSL2, and breaks service-to-service communication

Inside the Docker bridge network, the API service connects to PostgreSQL via the service name `db` (not `localhost`). This is configured in `docker-compose.yml` and handled automatically.

---

## Health Probe Contract

`GET /api/health` always returns HTTP 200 with a JSON body:

```json
{"status": "ok", "db": "connected"}
```

or when the database is unreachable:

```json
{"status": "ok", "db": "disconnected"}
```

The endpoint **always returns 200** by design (allows liveness probing without auth). The `db` field indicates actual database connectivity.

**Docker HEALTHCHECK** uses `curl -f http://localhost:8000/api/health` which checks HTTP status only — the container shows `healthy` even when `db` is `disconnected`.

**Strict DB-aware probe** (optional, for operators who want unhealthy when DB is down):

```bash
python -c "import urllib.request,json,sys; d=json.load(urllib.request.urlopen('http://localhost:8000/api/health')); sys.exit(0 if d.get('db')=='connected' else 1)"
```

**Operator verification commands:**

```bash
# Check API health
curl -fs http://localhost:8000/api/health | python -m json.tool

# Check panel loads
curl -fs http://localhost:8000/panel/ -o /dev/null && echo "Panel OK"

# Check compose service status
docker compose ps
```

---

## Architecture

```
docker-compose.yml (single file)
├── api service (multi-stage: Node 22-alpine builder → python:3.12-slim runtime)
│   ├── FastAPI + uvicorn (single worker for rate limiting)
│   ├── Panel SPA served at /panel via StaticFiles mount
│   └── Alembic auto-migration on startup
└── db service (postgres:16-alpine)
    └── Named volume pgdata:/var/lib/postgresql/data
```

**Build:** Multi-stage Dockerfile builds the panel SPA in a Node stage, then copies the compiled static files into the Python runtime image. No Node.js in the final image.

**Migrations:** `docker-entrypoint.sh` runs `alembic upgrade head` before starting uvicorn. Zero manual migration steps.

**Rate limiting:** uvicorn runs with `--workers 1` for slowapi in-memory rate limiter to function correctly. Horizontal scaling is via `docker compose up --scale api=N` behind a load balancer, not multi-worker.

---

## Troubleshooting

**`docker compose up` fails with port conflict:**
```bash
# Check what's using port 8000
lsof -i :8000  # or: netstat -tlnp | grep 8000
# Change the port in docker-compose.yml or stop the conflicting service
```

**API shows `db: disconnected`:**
```bash
# Check db container is healthy
docker compose ps
# Check db logs
docker compose logs db
# Restart if needed
docker compose restart api
```

**Panel returns 404 at `/panel/`:**
```bash
# Verify panel files were built and copied
docker compose exec api ls /app/api/static/panel/
# Rebuild if empty
docker compose up -d --build
```

**PostgreSQL connection slow on Windows (10s delay):**
```bash
# Use 127.0.0.1 instead of localhost
psql -h 127.0.0.1 -p 5433 -U watchbug -d watchbug
```

---

## Development

For local development without Docker:

```bash
# Backend
cd backend
cp ../.env.example .env  # or backend/.env
pip install -e .
uvicorn app.main:app --reload

# Panel
cd panel
npm install
npm run dev  # proxies to localhost:8000
```

---

## License

See [LICENSE](LICENSE) for details.
