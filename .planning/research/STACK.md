# Stack Research

**Domain:** Self-hosted error reporting & visual feedback SDK
**Researched:** 2026-08-29
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TypeScript** | 5.5+ | Client SDK language | Mandatory for type safety in Shadow DOM components; ES2020 target ensures broad compatibility; no runtime overhead after compilation |
| **tsup** | 8.x | Client SDK bundler | Default for TS library bundling in 2026 — esbuild-powered, zero-config, ESM+CJS dual output with .d.ts generation. 3M weekly downloads. 10-100x faster than Webpack. Produces smaller bundles than raw Rollup for most utility libraries |
| **FastAPI** | 0.141.x | Backend API framework | Async Python with auto-generated OpenAPI docs, Pydantic v2 validation, dependency injection. 102K GitHub stars, fastest-growing Python API framework. Native async/await, `lifespan` context manager (not deprecated `on_event`) |
| **PostgreSQL** | 16-alpine | Primary database | Relational integrity for incidents, JSONB for flexible metadata, mature ecosystem. `alpine` variant for minimal Docker image size |
| **Pydantic** | v2 (2.x) | Validation & settings | FastAPI's native validation layer. `field_validator` / `model_validator` (not deprecated `@validator`). `ConfigDict` for settings. Pydantic-Settings for `.env` loading |
| **Docker** | 27.x | Containerization | Multi-stage builds reduce image size by 60-72%. Single `docker-compose.yml` for entire stack |
| **Python** | 3.10+ | Backend runtime | Minimum for FastAPI features used. 3.12 preferred for `TaskGroup`, PEP 695 generics, structural pattern matching |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **SQLAlchemy** | 2.0+ (async) | ORM + async DB access | Always — use `asyncpg` driver for PostgreSQL async. `AsyncSession` with dependency injection via `Depends(get_db)` |
| **Alembic** | 1.14+ | Database migrations | Always — auto-generate migrations from SQLAlchemy models. Use `alembic revision --autogenerate` |
| **PyJWT** | 2.9+ | JWT token creation/verification | Always — replaces unmaintained `python-jose`. Has known CVEs in python-jose (constant-time comparison failure, algorithm confusion). PyJWT has 280 dependent packages, actively maintained |
| **bcrypt** (via passlib or direct) | 4.2+ | Password hashing | Always — use `bcrypt` directly or via passlib's `CryptContext`. Argon2 (`argon2-cffi`) is stronger but bcrypt is simpler for this use case. Both are OWASP-recommended |
| **slowapi** | 0.1.9+ | Rate limiting | Always — Flask-Limiter port for Starlette/FastAPI. Supports in-memory (no Redis needed for self-hosted), per-IP and per-key limiting. `@limiter.limit("10/minute")` decorator pattern |
| **httpx** | 0.27+ | Async HTTP client + TestClient | Always — FastAPI's `TestClient` is built on httpx. Also used for any outbound HTTP calls |
| **alembic** | 1.14+ | Schema migrations | Always — tracks PostgreSQL schema changes. Auto-generate from SQLAlchemy models |
| **pydantic-settings** | 2.x | Environment config | Always — load `.env` variables into typed settings. Replaces manual `os.getenv()` |
| **python-multipart** | 0.0.9+ | Form data parsing | When accepting file uploads (screenshot images). Required by FastAPI for `Form()` and `UploadFile` |
| **pytest** | 8.x | Test runner | Always — standard Python testing. Use `pytest-asyncio` for async test support |
| **pytest-playwright** | 0.6.x | E2E browser testing | For E2E tests — official Playwright pytest plugin with `page`, `context`, `browser` fixtures. Handles Shadow DOM piercing automatically |
| **playwright** | 1.62+ | Browser automation | For E2E tests — auto-waits, retries, cross-browser (Chromium/Firefox/WebKit). Critical: Playwright auto-pierces Shadow DOM boundaries with CSS selectors |
| **Ruff** | 0.16+ | Linting + formatting | Always — replaces Flake8 + Black + isort + pyupgrade in one tool. 10-100x faster. 800+ rules, auto-fix capability |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **uv** | Python package manager | Faster than pip/poetry. Use `uv add` / `uv sync` for dependency management. Installs from `pyproject.toml` |
| **esbuild** | Client SDK minification | tsup uses esbuild under the hood. For raw speed when building the SDK bundle |
| **bundlesize** / custom script | Bundle size verification | CI gate: `npm run check:size` must fail if SDK >45 KB gzipped |
| **Docker Compose** | Orchestration | Single file: API + Panel + PostgreSQL. Health checks, dependency ordering, volume mounts |
| **pre-commit** | Git hooks | Run Ruff lint+format on commit. Prevents bad code from entering repo |
| **GitHub Actions** | CI/CD | Lint (Ruff), test (pytest), E2E (Playwright), bundle size check, Docker build |

## Installation

### Python Backend

```bash
# Core dependencies
uv add fastapi[standard] uvicorn[standard] pydantic pydantic-settings
uv add sqlalchemy[asyncio] asyncpg alembic
uv add pyjwt bcrypt python-multipart
uv add slowapi

# Dev dependencies
uv add --dev pytest pytest-asyncio httpx pytest-cov
uv add --dev playwright pytest-playwright
uv add --dev ruff pre-commit
```

### Client SDK

```bash
# Initialize with tsup
npm init -y
npm install -D tsup typescript @types/node

# tsup.config.ts handles:
# - ESM + IIFE output
# - TypeScript declarations
# - esbuild minification
# - Tree-shaking
```

### Bundle Size Verification

```bash
# package.json scripts
"check:size": "node scripts/check-size.js"
# Script reads dist/watchbug.min.js, checks gzip size <= 45KB
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| **Bundler** | tsup | Rollup | Rollup requires more config for TS libraries; tsup is zero-config with same esbuild speed. Rollup only wins for complex code-splitting scenarios |
| **Bundler** | tsup | Vite library mode | Vite is for apps, not libraries. Adds dev server overhead we don't need for SDK bundling |
| **Bundler** | tsup | esbuild direct | esbuild doesn't generate .d.ts files; requires separate `tsc --emitDeclarationOnly` step. tsup wraps this away |
| **ORM** | SQLAlchemy 2.0 async | Tortoise ORM | Less mature, smaller ecosystem, fewer production battle-tested examples |
| **JWT** | PyJWT | python-jose | python-jose has known CVEs (constant-time comparison, algorithm confusion). Last release 4+ years ago. PyJWT is actively maintained |
| **Password hashing** | bcrypt | argon2-cffi | Argon2 is stronger but adds complexity. bcrypt is simpler, widely supported, OWASP-approved. Can upgrade to Argon2 later |
| **Rate limiting** | slowapi (in-memory) | Redis-backed | Self-hosted constraint: single docker-compose, no Redis dependency. slowapi supports in-memory backend. Can add Redis later if needed |
| **E2E testing** | Playwright | Cypress | Cypress runs inside browser (can't test Shadow DOM isolation properly). Playwright uses CDP protocol, auto-pierces Shadow DOM |
| **E2E testing** | Playwright | Selenium | Selenium uses WebDriver protocol (slower, less reliable). Playwright is 4x faster with auto-waiting |
| **Linter** | Ruff | Flake8 + Black + isort | Ruff replaces all three in one tool, 10-100x faster. Single config in pyproject.toml |
| **Package manager** | uv | pip + venv | uv is 10-100x faster, resolves dependencies better, integrates with pyproject.toml natively |
| **DB driver** | asyncpg | psycopg2 | asyncpg is async-native for SQLAlchemy 2.0. psycopg2 is synchronous, blocks the event loop |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **python-jose** | Unmaintained (4+ years since last release), known CVEs: constant-time comparison failure for HMAC keys, algorithm confusion with OpenSSH ECDSA keys | **PyJWT** — actively maintained, 280+ dependents, no known vulnerabilities |
| **passlib** (standalone) | Uses deprecated `pkg_resources`, compatibility issues with Python 3.12+, bcrypt version conflicts | **bcrypt** directly or **passlib** only if already integrated (passlib has renewed maintenance effort) |
| **Webpack** | 100-300 line configs for real apps, 22s cold start vs 380ms for Vite. Overkill for a library SDK | **tsup** — zero-config, esbuild-powered, 3M weekly downloads |
| **Vite for library bundling** | Designed for apps with dev server, not library publishing. Rolldown transition adds instability | **tsup** — purpose-built for TypeScript library bundling |
| **Redis** (for v1 self-hosted) | Adds external dependency, contradicts single docker-compose constraint | **slowapi in-memory backend** — works for single-server self-hosted. Add Redis later if scaling needed |
| **Cypress** | Runs inside browser process, can't test Shadow DOM isolation properly, no multi-browser support | **Playwright** — uses CDP protocol, auto-pierces Shadow DOM, Chromium/Firefox/WebKit |
| **`@validator` / `class Config`** | Pydantic v1 patterns, deprecated in v2 | **`field_validator` / `ConfigDict`** — Pydantic v2 patterns |
| **`@app.on_event("startup")`** | Deprecated in FastAPI | **`lifespan` context manager** — modern FastAPI pattern |
| **`from jose import jwt`** | python-jose is unmaintained | **`import jwt`** (PyJWT) — actively maintained |

## Stack Patterns by Variant

**If deploying behind a reverse proxy (nginx/traefik):**
- Use `X-Forwarded-For` for rate limiting key
- Configure CORS for proxy origin
- slowapi `trust_proxy=True`

**If scaling beyond single server:**
- Replace slowapi in-memory with Redis-backed rate limiting
- Add Redis to docker-compose
- Use distributed session store for JWT blacklisting

**If adding admin panel authentication:**
- PyJWT for token creation (HS256 for simplicity, RS256 for federation)
- bcrypt for password storage (cost=12)
- Short-lived access tokens (15min) + refresh tokens
- HttpOnly/SameSite/Secure cookies for browser storage

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| fastapi 0.141.x | pydantic 2.x | FastAPI 0.100+ requires Pydantic v2. Do not use Pydantic v1 |
| sqlalchemy 2.0+ | asyncpg 0.30+ | SQLAlchemy 2.0 async requires asyncpg for PostgreSQL async |
| alembic 1.14+ | sqlalchemy 2.0+ | Alembic auto-detects SQLAlchemy 2.0 model patterns |
| pyjwt 2.9+ | python 3.10+ | PyJWT 2.x dropped Python 3.7 support |
| playwright 1.62+ | python 3.9+ | Playwright Python requires Python 3.9+ |
| ruff 0.16+ | python 3.10+ | Ruff targets Python 3.10+ for modern rule sets |
| tsup 8.x | node 18+ | tsup requires Node.js 18+ for ESM support |

## Sources

- [tsup official docs](https://tsup.egoist.dev/) — bundler configuration, ESM/CJS output
- [PkgPulse: Best TypeScript Build Tools 2026](https://www.pkgpulse.com/guides/best-typescript-first-build-tools-2026) — tsup vs Rollup vs esbuild comparison
- [FastAPI PyPI](https://pypi.org/project/fastapi/) — current version 0.141.1 (Jul 2026)
- [FastAPI Best Practices (ofershap)](https://github.com/ofershap/fastapi-best-practices) — async patterns, Depends(), Pydantic v2
- [PyJWT vs python-jose (StackShare)](https://stackshare.io/stackups/pypi-pyjwt-vs-pypi-python-jose) — PyJWT: 143 stacks, python-jose: 46 stacks. python-jose has CVEs
- [FastAPI Testing Docs](https://fastapi.tiangolo.com/tutorial/testing/) — httpx TestClient pattern
- [Playwright Python E2E Tutorial 2026](https://qaskills.sh/blog/pytest-playwright-python-e2e-tutorial) — pytest-playwright setup, Shadow DOM piercing
- [slowapi GitHub](https://github.com/laurentS/slowapi) — in-memory rate limiting for Starlette/FastAPI
- [Ruff PyPI](https://pypi.org/project/ruff/) — current version 0.16.4 (Aug 2026)
- [Docker Multi-Stage Build Guide](https://collabnix.com/docker-multi-stage-builds-for-python-developers-a-complete-guide/) — 60-72% image size reduction patterns
- [MDN: Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) — closed mode, `adoptedStyleSheets`, encapsulation
- [Playwright Shadow DOM Handling](https://www.testdock.io/articles/handling-shadow-dom-and-web-components-with-playwright) — auto-piercing, explicit traversal
- [AWS: PostgreSQL JSONB Best Practices](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/) — JSONB indexing, GIN indexes, query patterns
- [Alembic Autogenerate](https://alembic.sqlalchemy.org/en/latest/autogenerate.html) — migration generation from SQLAlchemy models
- [Docker Compose FastAPI](https://betterstack.com/community/guides/scaling-python/fastapi-docker-best-practices/) — health checks, layer caching, non-root user

---
*Stack research for: Watchbug SDK — self-hosted error reporting & visual feedback*
*Researched: 2026-08-29*
