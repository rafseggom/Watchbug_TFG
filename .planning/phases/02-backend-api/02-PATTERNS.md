# Phase 02: Backend API - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 26 (20 new + 6 implied)
**Analogs found:** 9 / 26 (greenfield backend — 17 files have no codebase analog and must be established from RESEARCH.md FastAPI conventions)
**Analog search scope:** `sdk/src/**`, `sdk/*.config.*`, `.planning/research/**`, root configs
**Files scanned:** 18 SDK source files + 4 config files

> **GREENFIELD NOTICE:** `backend/` directory does not exist yet (`Test-Path backend → False`). There is zero Python/FastAPI code in this repo. The SDK (`sdk/`) is the only sibling codebase. All backend patterns below are either (a) adapted from the closest SDK analog where the *concern* overlaps (validation, sanitization, transport contract, config) or (b) new FastAPI conventions that must be established from scratch following `02-RESEARCH.md` Patterns 1-13 and `ARCHITECTURE.md` recommendations. No analog search produced an exact Python match — every backend file is a first-establishment.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/pyproject.toml` | config | N/A (build) | `sdk/package.json` | partial — project manifest pattern |
| `backend/alembic.ini` | config | N/A (migration) | *(none)* | no-analog — new from RESEARCH.md Pattern 4 |
| `backend/alembic/env.py` | config/migration | file-I/O + async DB | *(none)* | no-analog — RESEARCH.md Pattern 4 code example |
| `backend/alembic/versions/001_initial.py` | migration | N/A (DDL) | *(none)* | no-analog — SQLAlchemy autogenerate |
| `backend/app/__init__.py` | provider | N/A | `sdk/src/index.ts` (module entry) | partial |
| `backend/app/main.py` | provider/config | request-response + lifecycle | `sdk/src/index.ts` (init + lifespan) | partial |
| `backend/app/config.py` | config | request-response (settings) | `sdk/src/index.ts` `WatchbugConfig` type (lines 15-21) + `sdk/tsconfig.json` strict config | partial |
| `backend/app/db.py` | provider/service | CRUD (connection pooling) | *(none)* — new `AsyncEngine`/`AsyncSession` pattern | no-analog — RESEARCH.md Pattern 3 |
| `backend/app/models/incident.py` | model | CRUD + file-I/O (BYTEA) | *(none)* | no-analog — RESEARCH.md Pattern 3 + 13 |
| `backend/app/models/user.py` | model | CRUD | *(none)* | no-analog — RESEARCH.md Pattern 3 + 6 |
| `backend/app/models/project.py` | model | CRUD | *(none)* | no-analog — RESEARCH.md Pattern 11 |
| `backend/app/models/__init__.py` | provider | N/A (re-export for Alembic) | `sdk/src/index.ts` barrel re-export lines 345-351 | partial |
| `backend/app/schemas/incident.py` | provider/validation | request-response + validation | `sdk/src/transport/validation.ts` (lines 1-73) | partial — closest validation analog |
| `backend/app/schemas/auth.py` | provider/validation | request-response | `sdk/src/transport/validation.ts` | partial |
| `backend/app/schemas/common.py` | provider/utility | request-response | *(none)* | no-analog — pagination envelope |
| `backend/app/routers/incidents.py` | controller/route | request-response + CRUD | `sdk/src/transport/sender.ts` (lines 13-53) — defines the contract this router must honor | partial |
| `backend/app/routers/auth.py` | controller/route | request-response | `sdk/src/transport/sender.ts` | partial |
| `backend/app/routers/health.py` | controller/route | request-response | *(none)* | no-analog — health probe |
| `backend/app/services/incident_service.py` | service | CRUD + transform (sanitize+BYTEA) | `sdk/src/capture/batcher.ts` (queue/transform) + `sdk/src/editor/sanitizer.ts` | partial |
| `backend/app/services/auth_service.py` | service | CRUD + transform (hash/JWT) | *(none)* | no-analog — RESEARCH.md Patterns 5+6 |
| `backend/app/services/project_service.py` | service | CRUD | `sdk/src/index.ts` key handling (lines 69-70, `config.key`) | partial |
| `backend/app/dependencies.py` | middleware/provider | request-response | *(none)* — FastAPI `Depends()` pattern | no-analog — RESEARCH.md Pattern 5 excerpt |
| `backend/app/middleware/payload_size.py` | middleware | request-response (guard) | `sdk/src/transport/validation.ts` size guard intent (not exact) | partial |
| `backend/app/utils/sanitize.py` | utility | transform (XSS) | `sdk/src/editor/sanitizer.ts` (lines 1-66) | role-match — same concern, server-side |
| `backend/app/utils/pagination.py` | utility | transform (pagination math) | `sdk/src/capture/batcher.ts` batch math (lines 28-29, 42-49) | partial |
| `backend/tests/conftest.py` | test/config | N/A (fixtures) | `sdk/vitest.config.ts` + `sdk/src/index.ts` `_resetForTesting` (lines 300-342) | partial |
| `backend/tests/test_health.py` | test | request-response | `sdk/tests` via `vitest.config.ts` pattern + `sdk/src/transport/sender.ts` fetch contract | partial |
| `backend/tests/test_auth.py` | test | request-response | *(none)* — new auth flow tests | no-analog |
| `backend/tests/test_incidents_ingest.py` | test | CRUD + request-response | `sdk/src/transport/validation.ts` test analog for TRN-04 | partial |
| `backend/tests/test_incidents_list.py` | test | CRUD (pagination/filter) | *(none)* | no-analog |
| `backend/tests/test_incidents_status.py` | test | CRUD (PATCH) | *(none)* | no-analog |
| `.env.example` | config | N/A | *(none - implied)* | no-analog — RESEARCH.md Pattern 2 |

---

## Pattern Assignments

### `backend/pyproject.toml` (config, N/A)

**Analog:** `sdk/package.json` (lines 1-28) — project manifest pattern

**Imports/manifest pattern** (`sdk/package.json` lines 1-8):
```json
{
  "name": "@watchbug/sdk",
  "version": "0.1.0",
  "description": "Watchbug SDK - lightweight visual feedback widget",
  "type": "module",
  "main": "dist/watchbug.js"
}
```

**What to copy:** Project name/version/description block, then dependency sections. For backend, use `pyproject.toml` with `[project]` + `[tool.ruff]` + `[tool.pytest.ini_options]` + `[tool.alembic]` — follows `uv` convention per `02-RESEARCH.md` Installation (lines 146-163). Include `requires-python = ">=3.10"` (research says 3.10+ / 3.12 preferred).

**No direct analog for:** `[tool.ruff]`, `[tool.pytest]`, `[tool.alembic]` — new patterns from `STACK.md` and `02-RESEARCH.md` lines 315-373. Copy verbatim the `pytest` asyncio config `asyncio_mode = "auto"` from RESEARCH.md Validation Architecture table.

---

### `backend/app/main.py` (provider/config, request-response + lifecycle)

**Analog:** `sdk/src/index.ts` (lines 51-174) — lifecycle + init factory pattern

**Imports + lifespan pattern** — ESTABLISH FROM RESEARCH.md Pattern 1 (lines 312-337), no SDK analog exists for Python ASGI:
```python
# Source: 02-RESEARCH.md Pattern 1 — lifespan asynccontextmanager (NOT on_event)
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db import engine, Base
from app.services.auth_service import seed_admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: engine + Alembic upgrade head + seed admin + seed default project
    from app.config import get_settings
    settings = get_settings()
    await seed_admin(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
    yield
    # shutdown
    await engine.dispose()

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
# docs gated below based on DOCS_ENABLED — see RESEARCH.md Pattern 1 lines 335-336
```

**SDK analog that informs structure** — `sdk/src/index.ts` lines 51-73 (factory + single entry point):
```typescript
export function createWatchbug(): WatchbugAPI {
  const api: WatchbugAPI = {
    get _initialized() { return _initialized; },
    init(config: WatchbugConfig): void {
      if (!config || !config.key || typeof config.key !== 'string' || config.key.trim() === '') {
        throw new Error('[Watchbug] init() requires a non-empty `key` property');
      }
      _config = { ...config };
      _initialized = true;
```

**Copy pattern:** Factory function `create_app()` or module-level `app` with `lifespan`. Single entry point invariant (cf. INV-02: single `window.Watchbug`) → single `app` object. Middleware order matters — RESEARCH.md Architecture Diagram lines 208-213 shows stack: PayloadSize → CORS → RateLimiter.

**Error handling pattern:** No try/catch in lifespan startup — failures must abort app (RESEARCH Pitfall 1). Don't swallow Alembic/seed errors.

---

### `backend/app/config.py` (config, request-response)

**Analog:** `sdk/src/index.ts` lines 15-21 (`WatchbugConfig` type) + `sdk/package.json` — config shape pattern

**SDK config type** (`sdk/src/index.ts` lines 15-21):
```typescript
export type WatchbugConfig = {
  key: string;
  autoSanitize?: boolean;
  language?: 'en' | 'es';
  apiUrl?: string;
  bufferSize?: number;
};
```

**New pattern to establish** — RESEARCH.md Pattern 2 (lines 341-377) — `BaseSettings` with `SettingsConfigDict`:

```python
# Source: 02-RESEARCH.md Pattern 2 — pydantic-settings 2.x docs
from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = Field(default="postgresql+asyncpg://watchbug:watchbug@localhost:5432/watchbug")
    JWT_SECRET: str = Field(min_length=32)
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    ADMIN_EMAIL: str = Field(default="admin@watchbug.local")
    ADMIN_PASSWORD: str = Field(min_length=8)
    CORS_ORIGINS: str = Field(default="http://localhost:5173")
    DOCS_ENABLED: bool = Field(default=False)
    MAX_PAYLOAD_BYTES: int = Field(default=102400)

    @computed_field
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

from functools import lru_cache
@lru_cache
def get_settings() -> Settings:
    return Settings()
```

**Copy from SDK pattern:** Optional fields with defaults + validation at boundary (cf. `sdk/src/transport/validation.ts` lines 16-73 validates before network). Settings should fail fast on missing required vars like `JWT_SECRET` — mirrors SDK `throw new Error('[Watchbug] init() requires...')` fail-fast at `index.ts:62`.

**Do NOT use** `os.getenv()` — single source of truth is `Settings` per RESEARCH.md Pattern 2 Pitfall. Must also create `.env.example` documenting every field (SEC-05).

---

### `backend/app/db.py` (provider/service, CRUD)

**Analog:** None — pure new FastAPI/SQLAlchemy async pattern. Establish from RESEARCH.md Pattern 3 (lines 377-410).

**Core pattern** (RESEARCH.md lines 382-407):
```python
# Source: SQLAlchemy 2.0 async docs — 02-RESEARCH.md Pattern 3
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, LargeBinary, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
import uuid

class Base(DeclarativeBase):
    pass

# engine
# DATABASE_URL must be postgresql+asyncpg:// — not postgresql:// (sync psycopg2 blocks event loop per Pitfall)
# dependency
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
```

**Critical detail to copy:** `expire_on_commit=False` prevents `MissingGreenlet` after commit (RESEARCH Pitfall 2). Always `await session.commit(); await session.refresh(incident)` after insert to populate server defaults like `created_at`.

**No SDK analog** — SDK has no DB. Planner must treat this as new foundational pattern with no prior art in repo.

---

### `backend/app/models/incident.py` (model, CRUD + BYTEA)

**Analog:** None — new SQLAlchemy model. Establish from RESEARCH.md Patterns 3 + 13.

**Core pattern** (RESEARCH.md lines 392-402 + 722-739):
```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, LargeBinary, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
import uuid
from datetime import datetime

class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="Pending")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    screenshot: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # BYTEA — NOT Text
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

**What NOT to do** (from RESEARCH Anti-Patterns): Do NOT store `data:image/png;base64,...` string in TEXT — violates ARCHITECTURE.md Anti-Pattern #3. Do NOT store screenshot inside JSONB payload — keep binary in BYTEA column separate.

**SDK contract to honor:** SDK sends lowercase `type: 'bug'|'feedback'` (`sdk/src/capture/batcher.ts` lines 3-4), DB stores TitleCase `Bug`/`Feedback` per D-11. Normalize at schema layer via `field_validator` — see `schemas/incident.py` below.

---

### `backend/app/models/user.py` (model, CRUD)

**Analog:** None — establish from RESEARCH.md Pattern 3 + 6.

**Core pattern:**
```python
class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(60), nullable=False)  # bcrypt output length 60
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

**Auth pattern ties:** Seeded via `seed_admin` using `bcrypt.hashpw`/`checkpw` with `gensalt(rounds=12)` — see `services/auth_service.py` pattern. Idempotent upsert on lifespan startup (RESEARCH Pattern 6 lines 502-513).

---

### `backend/app/models/project.py` (model, CRUD)

**Analog:** `sdk/src/index.ts` lines 69-70 where `projectKey = config.key` is the source of truth for `X-Watchbug-Key`.

**Core pattern** (RESEARCH.md lines 657-677 + Pattern 11):
```python
class Project(Base):
    __tablename__ = "projects"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)  # public write-only
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

**SDK header contract** (`sdk/src/transport/sender.ts` lines 30-32):
```typescript
headers: {
  'Content-Type': 'application/json',
  'X-Watchbug-Key': projectKey,
},
```

Backend must accept BOTH `X-Watchbug-Key` (primary, matches SDK) and `X-Project-Key` (spec alias, D-05).

---

### `backend/app/schemas/incident.py` (provider/validation, request-response)

**Analog:** `sdk/src/transport/validation.ts` (lines 1-73) — client-side validation that server must mirror.

**SDK validation pattern** (`sdk/src/transport/validation.ts` lines 16-73):
```typescript
export function validatePayload(payload: unknown): ValidationResult {
  const errors: string[] = [];
  if (p.type !== 'bug' && p.type !== 'feedback') {
    errors.push("type must be 'bug' or 'feedback'");
  }
  if (typeof p.screenshot !== 'string' || (p.screenshot as string).trim() === '') {
    errors.push('screenshot must be a non-empty string');
  }
  if (!p.metadata || typeof p.metadata !== 'object' || Array.isArray(p.metadata)) {
    errors.push('metadata is required');
  } else {
    const m = p.metadata as Record<string, unknown>;
    if (typeof m.url !== 'string' || (m.url as string).trim() === '') {
      errors.push('metadata.url is required');
    }
  // ...
  if (p.type === 'bug') {
    if (!Array.isArray(p.consoleLogs) || (p.consoleLogs as unknown[]).length === 0) {
      errors.push('consoleLogs is required for type=bug');
    }
  }
```

**Server pattern to establish** — RESEARCH.md Code Example (lines 838-883) + Pattern 9/10:

```python
# Source: 02-RESEARCH.md Code Examples — IncidentCreate Schema (TRN-04)
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Literal

class ConsoleEntry(BaseModel):
    level: Literal["log", "warn", "error", "info"]
    args: list[str]
    timestamp: str

class IncidentCreate(BaseModel):
    type: Literal["Bug", "Feedback"] | Literal["bug", "feedback"]
    screenshot: str = Field(min_length=1, description="Base64 PNG, data URL prefix optional")
    metadata: dict = Field(min_length=1)
    consoleLogs: list[ConsoleEntry] | None = None  # camelCase: SDK sends camelCase
    errors: list[str] = Field(default_factory=list)
    notes: str | None = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v: str) -> str:
        mapping = {"bug": "Bug", "feedback": "Feedback", "Bug": "Bug", "Feedback": "Feedback"}
        if isinstance(v, str) and v.lower() in ("bug", "feedback"):
            return mapping.get(v, v) if v in mapping else mapping[v.lower()]
        return v

    @field_validator("consoleLogs", mode="after")
    @classmethod
    def check_console_logs_for_bug(cls, v, info):
        typ = info.data.get("type")
        if typ == "Bug" and (v is None or len(v) == 0):
            raise ValueError("consoleLogs is required for type=Bug")
        return v
```

**Copy from SDK:** Validation rules are 1:1 — `sdk/src/transport/validation.ts` already codifies TRN-04 (`consoleLogs required for Bug`), metadata `url/userAgent/timestamp` required, `type` enum. Reverse the contract: SDK validates lowercase `bug`/`feedback`, server validates TitleCase `Bug`/`Feedback` but must ALSO accept lowercase and normalize (RESEARCH Pitfall 9). Use `field_validator`/`ConfigDict`, NOT deprecated `@validator`/`class Config`.

**Error shape:** FastAPI default 422 `{detail: [{loc: ["body","consoleLogs"], msg, type}]}` per D-06 — keep default, no custom envelope.

---

### `backend/app/schemas/auth.py` + `common.py` (provider/validation, request-response)

**Analog:** `sdk/src/transport/validation.ts` pattern reused for auth fields.

**Auth schema pattern** (from RESEARCH.md Pattern 5 + 12):

```python
# schemas/auth.py
from pydantic import BaseModel, EmailStr, Field

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)

class MessageResponse(BaseModel):
    message: str

class TokenPayload(BaseModel):
    sub: str
    jti: str
    exp: int
    iat: int

# schemas/common.py
from pydantic import BaseModel

class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)

class PaginatedResponse(BaseModel):
    items: list[IncidentOut]
    total: int
    page: int
    size: int
    pages: int  # ceil(total/size)
```

**Copy pattern:** Use `EmailStr` for email validation (Pydantic extra dep `email-validator` may be needed — RESEARCH lists it implicitly). `Field(ge=1, le=100)` for pagination caps per D-09.

---

### `backend/app/routers/incidents.py` (controller/route, CRUD + request-response)

**Analog:** `sdk/src/transport/sender.ts` (lines 13-53) — defines the exact HTTP contract this router must satisfy. Also `sdk/src/capture/batcher.ts` for response expectations.

**SDK contract to honor** (`sdk/src/transport/sender.ts` lines 24-35):
```typescript
const endpoint = `${apiUrl.replace(/\/+$/, '')}/api/incidents`;
const res = await fetch(endpoint, {
  method: 'POST',
  credentials: 'omit' as RequestCredentials,  // NO cookies on ingest
  headers: {
    'Content-Type': 'application/json',
    'X-Watchbug-Key': projectKey,
  },
  body: JSON.stringify(payload),
});
if (res.ok) {
  return { success: true };
}
```

**Server pattern to establish** — RESEARCH.md Patterns 7/8/10/11/12 + Code Examples:

```python
# Source: 02-RESEARCH.md Patterns 10,11,12 combined — incidents router outline
from fastapi import APIRouter, Request, Response, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/incidents")

# POST /api/incidents — PUBLIC, requires X-Watchbug-Key OR X-Project-Key, NOT JWT
# Must check: 1) project key → 401 if missing/invalid (D-08)
#             2) payload size → 413 if >100KB (D-08/Pattern 10)
#             3) Pydantic 422 on bad schema (D-06)
#             4) sanitize before storage (D-15/Pattern 9)
#             5) Base64 → BYTEA decode (Pattern 13)
#             6) return 201 {id, status, created_at} (D-07)
@router.post("", status_code=201)
async def create_incident(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # Pattern 11: resolve project
    # Pattern 10: body size check via await request.body()
    # Pattern 13: decode_screenshot
    # Pattern 9: sanitize_payload
    ...

# GET /api/incidents — JWT required, paginated+filterable (D-09/D-10/Pattern 12)
@router.get("")
async def list_incidents(
    request: Request,
    user: User = Depends(get_current_user),  # Pattern 5 dependency
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None),
    status: str | None = Query(None),
):
    ...

# PATCH /api/incidents/{id}/status — JWT required, Any→Any (D-12)
@router.patch("/{id}/status")
async def update_status(id: uuid.UUID, body: StatusUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ...
```

**Critical split:** `POST` uses `credentials: 'omit'` + `X-Watchbug-Key`, so NO `Depends(get_current_user)` on POST. `GET`/`PATCH` use `Depends(get_current_user)` cookie auth. Mixing these breaks SDK per D-05 (Reversibility: one-way).

**CORS nuance (Pattern 7):** Ingest must work on any customer domain — don't block POST with allowlist CORS. Echo `Origin` header when not in allowlist (RESEARCH.md lines 543-551).

**Rate limiting (Pattern 8):** Stack two decorators: `@limiter.limit("10/minute")` (per IP) + `@limiter.limit("30/minute", key_func=get_project_key)` (per key) on POST; `@limiter.limit("60/minute")` on GET/PATCH.

---

### `backend/app/routers/auth.py` (controller/route, request-response)

**Analog:** `sdk/src/index.ts` consent/auth boundary `setConsent` pattern (lines 176-223) — not direct, but closest auth-gating analog. Real pattern is RESEARCH.md Pattern 5.

**Core pattern** (RESEARCH.md Pattern 5, lines 442-486):

```python
# Source: 02-RESEARCH.md Pattern 5 — JWT HttpOnly Cookie Auth
import jwt, uuid, bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Response, Request, Depends, HTTPException

router = APIRouter(prefix="/api/auth")

@router.post("/login")
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, body.email)
    if not user or not bcrypt.checkpw(body.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="invalid credentials")
    access = create_access_token(str(user.id), settings.JWT_SECRET)
    refresh = create_refresh_token(str(user.id), settings.JWT_SECRET)
    response.set_cookie(key="watchbug_access", value=access, httponly=True, secure=not settings.DEBUG, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="watchbug_refresh", value=refresh, httponly=True, secure=not settings.DEBUG, samesite="lax", max_age=604800, path="/api/auth")
    return {"message": "logged in"}

@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("watchbug_refresh")
    # jwt.decode + reissue access cookie

@router.post("/logout")
async def logout(response: Response):
    response.set_cookie(key="watchbug_access", value="", httponly=True, samesite="lax", max_age=0, path="/")
    response.set_cookie(key="watchbug_refresh", value="", httponly=True, samesite="lax", max_age=0, path="/api/auth")
    return {"message": "logged out"}
```

**Cookie names:** `watchbug_access`/`watchbug_refresh` per Agent's Discretion in CONTEXT.md. Must be namespaced and `HttpOnly`, `SameSite=Lax`, `Secure` toggled by `ENV==production`.

**Pitfall to avoid:** `Secure=True` on localhost http drops cookie (RESEARCH Pitfall 5).

---

### `backend/app/routers/health.py` (controller/route, request-response)

**Analog:** None — simple health probe per API-05/D-16.

**Core pattern** (RESEARCH.md D-16 + Architecture Diagram lines 230-233):

```python
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

@router.get("/api/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {"status": "ok", "db": db_status}
```

Public endpoint, no auth. Also probe for Docker healthcheck per `ARCHITECTURE.md` Docker Pattern.

---

### `backend/app/services/incident_service.py` (service, CRUD + transform)

**Analog:** `sdk/src/capture/batcher.ts` (lines 18-49) + `sdk/src/editor/sanitizer.ts` (lines 1-66) — queue/transform + sanitization concerns.

**SDK batcher pattern** (`sdk/src/capture/batcher.ts` lines 41-50):
```typescript
async flush(): Promise<void> {
  if (this.queue.length === 0) return;
  const batch = this.queue.splice(0, this.batchSize);
  try {
    await this.flushFn(batch);
  } catch {
    // Re-queue failed batch for retry per D-08 — prepend to preserve order
    this.queue.unshift(...batch);
  }
}
```

**New service pattern to establish** — RESEARCH.md Patterns 9 + 10 + 12 + 13 combined:

```python
# Source: 02-RESEARCH.md Patterns 9 (sanitize), 13 (BYTEA), 12 (pagination)
import html, re, base64, binascii
from sqlalchemy import select, func

_EVENT_HANDLER_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
_JAVASCRIPT_RE = re.compile(r"javascript\s*:", re.IGNORECASE)

def sanitize_string(value: str) -> str:
    escaped = html.escape(value, quote=True)
    escaped = _EVENT_HANDLER_RE.sub("", escaped)
    escaped = _JAVASCRIPT_RE.sub("", escaped)
    return escaped

def sanitize_payload(payload: dict) -> dict:
    if isinstance(payload, dict):
        return {k: sanitize_payload(v) for k, v in payload.items()}
    if isinstance(payload, list):
        return [sanitize_payload(v) for v in payload]
    if isinstance(payload, str):
        return sanitize_string(payload)
    return payload

def decode_screenshot(b64: str) -> bytes:
    if "," in b64 and b64.startswith("data:"):
        b64 = b64.split(",", 1)[1]
    try:
        return base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=422, detail="invalid screenshot encoding")

# CRUD: create, list with pagination+filter, update status
async def create_incident(db: AsyncSession, data: IncidentCreate, project_id: uuid.UUID) -> Incident:
    sanitized = sanitize_payload(data.model_dump())
    screenshot_bytes = decode_screenshot(data.screenshot)
    # strip screenshot from JSONB payload before storage (Open Question Q2 in RESEARCH.md)
    sanitized.pop("screenshot", None)
    incident = Incident(type=sanitized["type"], status="Pending", payload=sanitized, screenshot=screenshot_bytes, project_id=project_id)
    db.add(incident)
    await db.commit()
    await db.refresh(incident)  # needed for created_at per expire_on_commit=False
    return incident

async def list_incidents(db, page, size, type_filter, status_filter):
    # RESEARCH.md Pattern 12: SELECT COUNT(*) + offset/limit + ceil(total/size)
    ...

def to_incident_out(incident: Incident) -> dict:
    # list endpoint: exclude BYTEA or encode as needed; detail: include Base64
    ...
```

**Copy from SDK sanitizer** (`sdk/src/editor/sanitizer.ts` lines 9-28): Server-side sanitization is the double-defense partner to client-side `sanitizeCanvas`. Same regex patterns for sensitive data, but applied to strings not pixels. Use `html.escape` stdlib per RESEARCH Don't Hand-Roll table.

**Size guard:** Per-route `len(await request.body()) > 102400 → 413` before Pydantic parsing (RESEARCH Pitfall 8 — chunked bypass). Don't rely solely on `Content-Length` header.

---

### `backend/app/services/auth_service.py` (service, CRUD + transform)

**Analog:** None — new bcrypt + JWT service. Establish from RESEARCH.md Patterns 5 + 6.

**Core pattern** (RESEARCH.md Pattern 6, lines 490-514 + Pattern 5 lines 451-457):

```python
# Source: 02-RESEARCH.md Patterns 5+6 — bcrypt direct + JWT HS256
import bcrypt, jwt, uuid
from datetime import datetime, timedelta, timezone

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, secret: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "jti": str(uuid.uuid4()), "exp": now + timedelta(hours=1), "iat": now}
    return jwt.encode(payload, secret, algorithm="HS256")

def create_refresh_token(user_id: str, secret: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "jti": str(uuid.uuid4()), "exp": now + timedelta(days=7), "iat": now, "type": "refresh"}
    return jwt.encode(payload, secret, algorithm="HS256")

def verify_token(token: str, secret: str) -> dict:
    return jwt.decode(token, secret, algorithms=["HS256"])  # raises ExpiredSignatureError, InvalidTokenError

# seed on startup (idempotent) — called from lifespan
async def seed_admin(db: AsyncSession, email: str, password: str):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=email, password_hash=hash_password(password))
        db.add(user)
    elif not verify_password(password, user.password_hash):
        user.password_hash = hash_password(password)  # rotated per CONTEXT.md specifics: update if ADMIN_PASSWORD changed
    await db.commit()
```

**Do NOT use** `passlib` or `python-jose` — both violate RESEARCH.md What NOT to Use (passlib pkg_resources breakage, jose CVEs).

---

### `backend/app/services/project_service.py` (service, CRUD)

**Analog:** `sdk/src/index.ts` lines 69-70 (key is source of truth) informs the lookup.

**Core pattern** (RESEARCH.md Pattern 11, lines 657-677):

```python
# Source: 02-RESEARCH.md Pattern 11 — Project Key Validation
from sqlalchemy import select

async def resolve_project(request: Request, db: AsyncSession = Depends(get_db)) -> Project:
    key = request.headers.get("x-watchbug-key") or request.headers.get("x-project-key")
    if not key:
        raise HTTPException(status_code=401, detail="invalid project key")
    result = await db.execute(select(Project).where(Project.api_key == key))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=401, detail="invalid project key")
    return project

async def seed_default_project(db: AsyncSession, api_key: str = None):
    # if PROJECT_API_KEY set in env, seed projects table idempotently
    ...
```

Header is `X-Watchbug-Key` primary (matches SDK `sender.ts:32`), fallback `X-Project-Key` alias per D-05. Case-insensitive via `request.headers.get` (Starlette normalizes to lowercase).

---

### `backend/app/dependencies.py` (middleware/provider, request-response)

**Analog:** None — FastAPI `Depends()` auth dependency. Establish from RESEARCH.md Pattern 5 dependency example (lines 471-486).

**Core pattern** (RESEARCH.md lines 471-486 + Code Example lines 885-906):

```python
# Source: 02-RESEARCH.md Pattern 5 dependency — reads HttpOnly cookie → jwt.decode → User
from fastapi import Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import jwt

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get("watchbug_access")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    try:
        payload = jwt.decode(token, get_settings().JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    import uuid
    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    return user
```

**Copy pattern from SDK auth boundary:** SDK's `setConsent` gates via `if (!_consentEnabled) return` (index.ts:177-179). Server equivalent is dependency raising 401 before route handler — same gate-at-boundary principle but server-enforced.

**Do NOT** also accept `Authorization: Bearer` header — D-01 is cookie-only, header would violate decision.

---

### `backend/app/middleware/payload_size.py` (middleware, request-response)

**Analog:** `sdk/src/transport/validation.ts` validation-before-network principle (lines 19-22), but server does size-before-parse.

**Core pattern** (RESEARCH.md Pattern 10, lines 622-655):

```python
# Source: 02-RESEARCH.md Pattern 10 — 100KB guard
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# Recommended: per-route check, NOT global middleware that consumes stream
# Per-route in routers/incidents.py:
@router.post("/api/incidents", status_code=201)
async def create_incident(request: Request, ...):
    body = await request.body()
    if len(body) > 102400:
        raise HTTPException(status_code=413, detail="payload too large")
    data = json.loads(body)  # then validate via Pydantic
```

**Why per-route not global middleware (RESEARCH Pitfall 8):** Global `BaseHTTPMiddleware` that reads `request.body()` risks double-consumption and misses `Transfer-Encoding: chunked` when only checking `Content-Length` header. Per-route `await request.body()` is safe.

**SDK analog:** Client validates before fetch (`sender.ts:19-22` `validatePayload` before `fetch`). Server validates size before Pydantic — same defense-in-depth ordering, mirrored on server.

---

### `backend/app/utils/sanitize.py` (utility, transform)

**Analog:** `sdk/src/editor/sanitizer.ts` (lines 1-66) — same XSS concern, server-side string version vs client-side canvas pixel version.

**SDK sanitizer pattern** (`sdk/src/editor/sanitizer.ts` lines 9-44):
```typescript
export function sanitizeCanvas(ctx: CanvasRenderingContext2D, ...): void {
  if (!options?.autoSanitize) return;
  // Mask password inputs
  const pwdInputs = document.querySelectorAll('input[type="password"]');
  pwdInputs.forEach((el) => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    maskRegion(ctx, rect.x, rect.y, rect.width, rect.height, 'solid');
  });
  // Mask data-watchbug-sensitive elements + CC regex
}
```

**Server utility to establish** (RESEARCH.md Pattern 9, lines 594-618):

```python
# Source: 02-RESEARCH.md Pattern 9 — XSS Sanitization at Ingest
import html, re

_EVENT_HANDLER_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
_JAVASCRIPT_RE = re.compile(r"javascript\s*:", re.IGNORECASE)

def sanitize_string(value: str) -> str:
    escaped = html.escape(value, quote=True)
    escaped = _EVENT_HANDLER_RE.sub("", escaped)
    escaped = _JAVASCRIPT_RE.sub("", escaped)
    return escaped

def sanitize_payload(payload: dict) -> dict:
    if isinstance(payload, dict):
        return {k: sanitize_payload(v) for k, v in payload.items()}
    if isinstance(payload, list):
        return [sanitize_payload(v) for v in payload]
    if isinstance(payload, str):
        return sanitize_string(payload)
    return payload
```

**Copy principle:** Client destroys pixels before Base64 (`sanitizeCanvas` → `maskRegion` → `putImageData` before `toDataURL`). Server destroys markup before JSONB (`sanitize_payload` before `INSERT`). Both are irreversible, primary gates. Double defense but server is canonical per D-15.

**Do NOT use** `bleach`/`nh3` — RESEARCH says `html.escape` stdlib is correct for plain-text consoleLogs/notes (not rich HTML).

---

### `backend/app/utils/pagination.py` (utility, transform)

**Analog:** `sdk/src/capture/batcher.ts` lines 28-29 (batch math: `batchSize: 5`) and flush `queue.splice(0, batchSize)` — similar offset/limit slicing logic, but for DB pagination.

**New pattern to establish** (RESEARCH.md Pattern 12, lines 686-716):

```python
# Source: 02-RESEARCH.md Pattern 12 — Pagination + Filtering
from sqlalchemy import select, func

async def paginate_query(db, base_query, page: int, size: int, filters: list):
    # total count — separate query per RESEARCH pitfall
    count_q = select(func.count()).select_from(Incident).where(*filters)
    total = (await db.execute(count_q)).scalar_one()
    pages = (total + size - 1) // size if total else 0
    # items
    q = select(Incident).where(*filters).order_by(Incident.created_at.desc()).offset((page - 1) * size).limit(size)
    items = (await db.execute(q)).scalars().all()
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}
```

**SDK analog:** `EventBatcher` flush does `queue.splice(0, batchSize)` which is `OFFSET 0 LIMIT batchSize` equivalent. Pagination uses `OFFSET (page-1)*size LIMIT size`. Same slicing mental model. Copy the `ceil(total/size)` math exactly — RESEARCH warns off-by-one breaks Panel footer per D-09.

**Also:** Exclude `LargeBinary` screenshot from list query via `load_only` or separate query to avoid OOM (RESEARCH Pitfall 7).

---

### `backend/alembic/env.py` + `alembic.ini` + `versions/001_initial.py` (config/migration, file-I/O)

**Analog:** None — no analogous migration system in SDK. Establish from RESEARCH.md Pattern 4 (lines 411-438).

**Core pattern** (`02-RESEARCH.md` Lines 415-437):

```python
# alembic/env.py — async variant (source: Alembic async docs)
import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool
from alembic import context
from app.models import Base  # MUST import all models — see Pitfall 10
from app.config import get_settings

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().DATABASE_URL)
target_metadata = Base.metadata

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    connectable = async_engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

if context.is_offline_mode():
    ...
else:
    asyncio.run(run_migrations_online())
```

**Critical import:** `from app.models import Base` must transitively import all models (`app/models/__init__.py` should re-export `Incident`, `User`, `Project`) otherwise `alembic revision --autogenerate` produces empty migration (RESEARCH Pitfall 10).

**SDK config analog:** `sdk/tsconfig.json` lines 1-22 shows strict config file pattern — `alembic.ini` is similarly strict `sqlalchemy.url` overridden by `env.py` at runtime (per RESEARCH Pattern 4 note).

---

### `backend/tests/conftest.py` (test/config)

**Analog:** `sdk/vitest.config.ts` (lines 1-9) + `sdk/src/index.ts` `_resetForTesting()` (lines 300-342) + `sdk/tsconfig.json` strictness.

**SDK test infra** (`sdk/src/index.ts` lines 300-342 `_resetForTesting`):
```typescript
export function _resetForTesting(): void {
  _initialized = false;
  _consentEnabled = true;
  _config = null;
  if (_stopConsoleCapture) { try { _stopConsoleCapture(); } catch {} _stopConsoleCapture = null; }
  if (_batcher) { try { _batcher.stop(); } catch {} _batcher = null; }
  _captureStarted = false;
  _consoleBufferObj = createConsoleBuffer(50);
  // Clear drafts for test isolation
  try {
    if (typeof localStorage !== 'undefined') {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('watchbug_draft_')) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch {}
  const existing = document.querySelector('watchbug-widget');
  if (existing) { existing.remove(); }
}
```

**New pattern to establish** (RESEARCH.md tests/conftest per lines 302-309 + Validation Architecture table lines 1015-1022):

```python
# tests/conftest.py — fixtures: async_client, db_session, seeded user/project, auth cookie helper
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import app
from app.db import get_db, Base
from app.config import get_settings

# Override DATABASE_URL for tests — use real PG via TEST_DATABASE_URL or sqlite+aiosqlite fallback
# per RESEARCH.md Assumptions A4: need Docker PG `docker run ... postgres:16-alpine` for integration

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def db_session():
    engine = create_async_engine(get_settings().DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # yield session...

@pytest.fixture
async def async_client(db_session):
    # override dependency
    app.dependency_overrides[get_db] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()

def auth_cookie_helper(client, email="admin@watchbug.local", password="test123"):
    # POST /api/auth/login then extract watchbug_access cookie
    ...
```

**Copy from SDK:** Isolation via reset (`_resetForTesting` clears shared state, localStorage, DOM) → backend equivalent is per-test DB transaction rollback or `Base.metadata.create_all/drop_all` per fixture. SDK's `vitest.config.ts` uses `globals: true, environment: 'jsdom'` → backend uses `asyncio_mode = "auto"` in `pyproject.toml` (RESEARCH Validation Architecture line 1019).

---

### `backend/tests/test_*.py` (test, request-response + CRUD)

**Analog:** SDK validation tests implied by `validation.ts` (no explicit test files in sdk listed, but contract is testable). Grep shows no `sdk/tests` visible beyond vitest config — pattern is new.

**Establish per RESEARCH.md Phase Requirements → Test Map (lines 1023-1047):**

| Test file | Requirement coverage | Key assertions to copy from SDK contract |
|-----------|---------------------|------------------------------------------|
| `test_health.py` | API-05, API-01 | `GET /api/health → {status:"ok", db:"connected"}` public; also test `db:"disconnected"` when DB down |
| `test_auth.py` | AUTH-01..04 | Login sets `watchbug_access` + `watchbug_refresh` HttpOnly cookies (SEC-06); wrong password → 401; logout clears with `Max-Age=0` |
| `test_incidents_ingest.py` | API-02, SEC-03/04 | Bug without consoleLogs → 422 `loc=["body","consoleLogs"]`; Feedback without logs → 201; invalid key → 401; >100KB → 413; XSS payload → sanitized html in DB; response is `201 {id, status:"Pending", created_at}` per D-07 |
| `test_incidents_list.py` | API-03, AUTH-03 | No JWT → 401; with JWT → `{items,total,page,size,pages}` with `page=1 size=20` defaults, `size<=100` cap; filter `?type=Bug&status=Pending` comma-separated |
| `test_incidents_status.py` | API-04 | `PATCH /api/incidents/{id}/status {status:"Resolved"}` → 200 `{id,status}`; no state-machine enforcement (Any→Any); invalid id → 404 |

**SDK validation to mirror in ingest tests** — reuse `sdk/src/transport/validation.ts` cases (lines 52-65: Bug requires consoleLogs, Feedback optional):

```typescript
// sdk/src/transport/validation.ts — the exact cases test_incidents_ingest must replicate server-side:
if (p.type === 'bug') {
  if (!Array.isArray(p.consoleLogs) || p.consoleLogs.length === 0) {
    errors.push('consoleLogs is required for type=bug');
  }
} else if (p.type === 'feedback') {
  if (p.consoleLogs !== undefined && !Array.isArray(p.consoleLogs)) {
    errors.push('consoleLogs must be an array when provided');
  }
}
```

Server test `test_bug_without_logs_422` should POST `{"type":"Bug","screenshot":"...","metadata":{...}}` (no consoleLogs) and assert 422 with `detail[0].loc == ["body","consoleLogs"]`.

---

## Shared Patterns

All new backend files must inherit these cross-cutting conventions. No existing backend code exists, so these are establishment rules from RESEARCH.md + SDK lessons.

### Authentication (HttpOnly JWT HS256, 1h/7d)

**Source:** `02-RESEARCH.md` Pattern 5 (lines 442-486) + Code Example lines 885-906
**Apply to:** `app/routers/auth.py`, `app/routers/incidents.py` (GET/PATCH), `app/dependencies.py`, `app/services/auth_service.py`, `app/config.py`

```python
# Shared auth snippet — copy into dependencies.py and auth router:
import jwt, uuid
from datetime import datetime, timedelta, timezone
# HS256 only — never python-jose; always algorithms=["HS256"] allowlist
# Cookies: watchbug_access (1h) + watchbug_refresh (7d), HttpOnly, SameSite=Lax
# Secure=False in dev (localhost http), True in prod (ENV==production)
# D-01: cookie-only, never Authorization: Bearer header
```

**SDK analog lesson:** `sdk/src/transport/sender.ts` uses `credentials: 'omit'` on ingest — backend must NOT require cookie there. All other incident endpoints require cookie via `Depends(get_current_user)`.

---

### Error Handling (distinct HTTP codes per D-06/D-08/D-14)

**Source:** `02-RESEARCH.md` Security Domain V7 + Patterns 5/10/11 + `sdk/src/transport/sender.ts` lines 37-48 (res.ok handling)
**Apply to:** All routers + services

```python
# Error code contract — planner must enforce this split per D-06/D-08/D-14:
# 401 → missing/invalid project key OR missing/invalid JWT cookie
# 413 → payload >100KB (body length before parse)
# 422 → Pydantic schema failure (FastAPI default {detail:[{loc,msg,type}]}) + invalid Base64 decode per discretion
# 429 → rate limit exceeded (slowapi RateLimitExceeded handler → {detail:"rate limit exceeded",retry_after} + Retry-After header)
# 404 → incident id not found (PATCH)
# Never echo DATABASE_URL or JWT_SECRET or stack traces — generic detail messages only (RESEARCH V7)
```

**SDK error pattern** (`sdk/src/transport/sender.ts` lines 40-48) — generic error text extraction:
```typescript
let errorMessage = `Request failed with status ${res.status}`;
try {
  const text = await res.text();
  if (text) errorMessage = text;
} catch {}
return { success: false, error: errorMessage };
```
Server should return JSON `{"detail": ...}` so SDK's `res.text()` extraction still works, but shape is FastAPI standard.

---

### Validation (Pydantic v2 field_validator / ConfigDict)

**Source:** `02-RESEARCH.md` Pattern 3 notes + Code Example lines 838-883 + `sdk/src/transport/validation.ts`
**Apply to:** All `app/schemas/**`, plus `app/routers/incidents.py` query validators

```python
# Use field_validator / model_validator + ConfigDict — NOT @validator / class Config (Pydantic v1, silently ignored per Pitfall 3)
# Example filter validation in router:
from fastapi import Query

@router.get("/api/incidents")
async def list_incidents(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),  # max 100 per D-09
    type: str | None = Query(None),
    status: str | None = Query(None),
):
    # type/status comma-separated → split → validate against allowed enums before SQLAlchemy .in_()
    # Normalize SDK lowercase bug/feedback → TitleCase Bug/Feedback per Pitfall 9
```

**SDK lesson:** `sdk/src/transport/validation.ts:26-27` validates `type !== 'bug' && type !== 'feedback'` strictly — server mirrors but normalizes case via `field_validator(mode="before")` to avoid 422/filter miss per Pitfall 9.

---

### Rate Limiting (slowapi in-memory, per IP + per key)

**Source:** `02-RESEARCH.md` Pattern 8 (lines 555-590)
**Apply to:** `app/main.py` (limiter setup + exception handler), `app/routers/incidents.py`, `app/routers/auth.py`

```python
# Source: 02-RESEARCH.md Pattern 8
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse

limiter = Limiter(key_func=get_remote_address, storage_uri="memory://", default_limits=[])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda req, exc: JSONResponse(... 429 + Retry-After...))
app.add_middleware(SlowAPIMiddleware)

# Per-route:
@router.post("/api/incidents")
@limiter.limit("10/minute")  # per IP
# plus custom key_func for per PROJECT_KEY 30/min — stack two decorators or composite key
```

**Note:** In-memory limiter is per-process — document single worker `uvicorn --workers 1` only per Pitfall 6. Do not add workers in Phase 2.

---

### CORS Split (open ingest vs allowlist admin)

**Source:** `02-RESEARCH.md` Pattern 7 (lines 517-554)
**Apply to:** `app/main.py`

```python
from fastapi.middleware.cors import CORSMiddleware

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # comma-separated exact matches from .env CORS_ORIGINS
    allow_credentials=True,
    allow_methods=["GET", "PATCH", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Watchbug-Key", "X-Project-Key"],
)
# Ingest override in router: if origin not in allowlist, echo it explicitly + Vary: Origin
# Reject Origin: null with 403 per SEC-01 — explicit check, not just allowlist miss
```

**Do NOT** use `allow_origins=["*"]` with `allow_credentials=True` — Starlette rejects this / browsers block per Pitfall 4.

---

### Settings / Secrets (pydantic-settings, .env only)

**Source:** `02-RESEARCH.md` Pattern 2 + `.planning/research/STACK.md`
**Apply to:** All files that read env vars — `app/config.py`, `alembic/env.py`, `app/main.py`, `app/db.py`

```python
# All secrets via Settings(BaseSettings) with model_config = SettingsConfigDict(env_file=".env", extra="ignore")
# .env.example must document every field — SEC-05 Zero secrets in code
# Verify: grep -R JWT_SECRET backend/app --include="*.py" must not contain hardcoded value
# Fields: DATABASE_URL, JWT_SECRET (min_length 32), ADMIN_EMAIL, ADMIN_PASSWORD (min_length 8), CORS_ORIGINS, DOCS_ENABLED, MAX_PAYLOAD_BYTES=102400
# Alembic env.py overrides sqlalchemy.url via config.set_main_option("sqlalchemy.url", get_settings().DATABASE_URL)
```

**SDK analogy:** No `.env` in SDK, but SDK's `WatchbugConfig.key` is the same public write-only pattern — never store host credentials. Backend's `PROJECT_KEY` is also public write-only per SEC-03.

---

### Testing (pytest + pytest-asyncio + httpx TestClient)

**Source:** `02-RESEARCH.md` Validation Architecture (lines 1015-1052) + `sdk/vitest.config.ts`
**Apply to:** All `backend/tests/**`, `backend/pyproject.toml`

```python
# pyproject.toml snippet — RESEARCH.md lines 1018-1020:
# [tool.pytest.ini_options]
# asyncio_mode = "auto"
# testpaths = ["tests"]

# conftest uses ASGITransport(app=app) + override_get_db + NullPool
# Fixture isolation = transaction rollback or create_all/drop_all — mirrors SDK _resetForTesting clearing localStorage+DOM

# Run commands:
# quick per-commit: pytest -q
# full with coverage: pytest --cov=app --cov-report=term-missing -v
# integration against real PG: docker run -d --name watchbug-pg -e POSTGRES_USER=watchbug -e POSTGRES_PASSWORD=watchbug -e POSTGRES_DB=watchbug -p 5432:5432 postgres:16-alpine
```

---

## No Analog Found

These files have no close match in the codebase. The SDK (TypeScript/Rollup/vitest) shares no Python, SQLAlchemy, or FastAPI surface. The planner must use `02-RESEARCH.md` patterns (referenced per file) instead of copying SDK code. This is expected for a greenfield second-stack establishment.

| File | Role | Data Flow | Reason | Canonical Source |
|------|------|-----------|--------|------------------|
| `backend/alembic.ini` | config | N/A | No Alembic/migration system in SDK — TS bundler `rollup.config.mjs` is unrelated | RESEARCH Pattern 4; Alembic docs |
| `backend/alembic/env.py` | config | file-I/O | Async `env.py` is Python/SQLAlchemy-specific | RESEARCH Pattern 4 code example |
| `backend/alembic/versions/001_initial.py` | migration | N/A | DDL migration autogenerate — no SDK analog | RESEARCH Pitfall 10 + Stack |
| `backend/app/db.py` | provider | CRUD | AsyncEngine/AsyncSession pooling — no DB in SDK | RESEARCH Pattern 3 |
| `backend/app/models/incident.py` | model | CRUD+BYTEA | BYTEA/JSONB PostgreSQL model — SDK has `ReportPayload` type but not DB model | RESEARCH Patterns 3+13 + ARCHITECTURE Anti-Pattern 3 |
| `backend/app/models/user.py` | model | CRUD | Users table — no users concept in SDK | RESEARCH Patterns 3+6 |
| `backend/app/dependencies.py` | middleware | request-response | FastAPI `Depends(get_current_user)` cookie→JWT→User — SDK has no server auth | RESEARCH Pattern 5 dependency example |
| `backend/app/services/auth_service.py` | service | transform | bcrypt + PyJWT HS256 — SDK only validates payloads, never hashes | RESEARCH Patterns 5+6 |
| `backend/app/routers/health.py` | route | request-response | Health `SELECT 1` probe — no health check in SDK | RESEARCH D-16 + Architecture diagram |
| `backend/tests/test_auth.py` | test | request-response | Auth flow (login/refresh/logout HttpOnly cookies) — SDK tests are widget/shadow-DOM, not server auth | RESEARCH Validation table |
| `backend/tests/test_incidents_list.py` | test | CRUD | Pagination + filter + auth guard — SDK has batching but not paginated retrieval | RESEARCH Patterns 12 + Validation table |
| `backend/tests/test_incidents_status.py` | test | CRUD | PATCH status Any→Any — no status mutation in SDK | RESEARCH D-12 + Validation table |
| `.env.example` | config | N/A | No `.env` in SDK | RESEARCH Pattern 2 + Stack |

> For all No-Analog files: treat `02-RESEARCH.md` code blocks as the primary pattern source. Each referenced pattern includes verified line numbers into RESEARCH.md and official library docs. Do not search for further analogs — 3–5 strong SDK matches already captured below; additional search yields diminishing returns on a greenfield backend.

---

## Analog Search Details

**Closest analogs extracted (SDK) — 5 files read in full (≤2,000 lines each, single Read call per file):**

| SDK analog file | Lines read | Concern mapped to backend | Reuse signal |
|-----------------|-----------|---------------------------|--------------|
| `sdk/src/transport/sender.ts` (53 lines) | 1-53 | `app/routers/incidents.py` POST contract: `credentials:omit` + `X-Watchbug-Key` + `JSON.stringify(payload)` — backend MUST honor `X-Watchbug-Key` primary + `X-Project-Key` fallback + `201 {id,status,created_at}` | **Highest** — defines the wire contract per D-05/D-07 |
| `sdk/src/transport/validation.ts` (73 lines) | 1-73 | `app/schemas/incident.py` TRN-04 validation: `type` enum, `screenshot` required, `metadata.url/userAgent/timestamp` required, `consoleLogs` required for Bug optional for Feedback | **Highest** — 1:1 rule replication server-side with Pydantic |
| `sdk/src/editor/sanitizer.ts` (66 lines) | 1-66 | `app/utils/sanitize.py` + `app/services/incident_service.py` — destructive masking principle before encode; double-defense XSS per D-15/SEC-03 | **High** — same SEC concern, pixel vs string variant |
| `sdk/src/capture/batcher.ts` (69 lines) | 1-69 | `app/services/incident_service.py` queue math + `app/utils/pagination.py` offset/limit slicing + transport retry intervals | **Medium** — slicing math analog; retry intervals inform rate-limit thresholds |
| `sdk/src/index.ts` (351 lines) | 15-21, 51-174, 300-342 | `app/config.py` config shape + `app/main.py` lifecycle factory + `tests/conftest.py` isolation via `_resetForTesting` | **Medium** — init factory + typed config + test isolation pattern |
| `sdk/tsconfig.json` (22 lines) | 1-22 | `backend/pyproject.toml` `[tool.ruff]` + `[tool.pytest]` strict config | **Low** — only strictness philosophy, not runtime pattern |
| `sdk/rollup.config.mjs` (28 lines) | 1-28 | `backend/pyproject.toml` build manifest pattern | **Low** — IIFE vs Python wheel, only manifest intent overlaps |

**Search method:** `Glob sdk/src/**/*.ts` → 18 files found; `Grep` for `credentials|Project-Key|X-Watchbug` confirmed `sender.ts` as only ingest contract site; `Read` 5 files in full (all <100 lines except `index.ts` at 351). No re-reads. Stopped at 5 analogs once contract+validation+sanitizer+batcher+init coverage was complete — captures all overlapping concerns. Backend analog search returned 0 hits for `class.*Controller|router.(get|post)` in Python — confirmed greenfield per `Test-Path backend → False`.

---

## Metadata

**Analog search scope:** `sdk/src/**` (18 files), `sdk/*.config.*`, root `vitest.config.ts`, `.planning/research/**` (STACK/ARCHITECTURE), `.planning/phases/02-backend-api/02-RESEARCH.md` (1133 lines, 13 patterns)
**Files scanned:** 18 SDK source files + 4 config files + 4 research docs
**Pattern extraction date:** 2026-08-31
**Backend greenfield:** Yes — `backend/` does not exist; 0 Python files scanned; all DB/auth/migration patterns are first-establishment from RESEARCH.md
**SDK contract files verified:** `sdk/src/transport/sender.ts:27-35` (`credentials:'omit'` + `X-Watchbug-Key`), `sdk/src/capture/batcher.ts:3-10` (`ReportPayload` shape `bug|feedback`), `sdk/src/transport/validation.ts:51-55` (TRN-04 consoleLogs rule)
**Stack locked:** FastAPI 0.141.1 + Pydantic 2.13.5 + pydantic-settings 2.15.0 + SQLAlchemy 2.0.52 + asyncpg 0.31.0 + Alembic 1.19.1 + PyJWT 2.13.0 + bcrypt 5.0.0 + slowapi 0.1.10 — per RESEARCH.md pip registry verification 2026-08-31
