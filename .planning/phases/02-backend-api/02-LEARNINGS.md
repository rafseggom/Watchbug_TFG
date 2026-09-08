---
phase: 02
phase_name: "Backend API"
project: "Watchbug SDK"
generated: "2026-09-08"
counts:
  decisions: 10
  lessons: 5
  patterns: 7
  surprises: 2
missing_artifacts:
  - "02-LEARNINGS.md (previous)"
---

# Phase 02 Learnings: Backend API

## Decisions

### bcrypt Direct hashpw/gensalt, Not passlib
Use `bcrypt.hashpw()`/`bcrypt.gensalt(rounds=12)` directly instead of passlib wrapper.

**Rationale:** passlib adds a dependency layer with minimal benefit; direct bcrypt is simpler and the RESEARCH doc confirmed no passlib-specific features were needed.
**Source:** 02-02-SUMMARY.md

---

### LoginRequest email as str, Not EmailStr
Use `email: str` in `LoginRequest` instead of `EmailStr` to allow `admin@watchbug.local` — Pydantic's `EmailStr` rejects `.local` domains.

**Rationale:** The seeded admin uses `.local` domain; changing to `EmailStr` would break the default setup.
**Source:** 02-02-SUMMARY.md

---

### html.escape + Event-Handler Strip, Not bleach
Use `html.escape(value, quote=True)` + `_EVENT_HANDLER_RE` + `_JAVASCRIPT_RE` stripping as stdlib sanitizer, not bleach.

**Rationale:** bleach adds a heavy C dependency; stdlib `html.escape` is sufficient for plain text fields (consoleLogs args, notes, metadata).
**Source:** 02-03-SUMMARY.md

---

### Per-Route 413 Guard, Not Global Middleware
Keep per-route `len(await request.body())` 413 check instead of global `BaseHTTPMiddleware` to handle chunked encoding and avoid double-read.

**Rationale:** Global middleware reads the body once; per-route reads it explicitly. Chunked encoding means Content-Length may be absent, so explicit `request.body()` is more reliable.
**Source:** 02-03-SUMMARY.md

---

### Split CORS: Allowlist vs Open Ingest
Admin routes use `CORSMiddleware` with strict allowlist + `credentials: true`. Ingest POST `/api/incidents` uses separate `IngestCorsMiddleware` that echoes any Origin.

**Rationale:** Admin needs credential-based auth (cookies); ingest must be open for any SDK host. Combining them would require `allow_origins=["*"]` which Starlette rejects with `credentials: true`.
**Source:** 02-03-SUMMARY.md

---

### slowapi In-Memory, Single Worker Only
Use `slowapi` with `memory://` storage and document `--workers 1` constraint. No Redis/shared state.

**Rationale:** Self-hosted deployment should have zero external dependencies; in-memory is sufficient for single-worker uvicorn. Horizontal scaling requires shared storage (v2 concern).
**Source:** 02-03-SUMMARY.md

---

### Null Origin Rejected at Middleware Level
`NullOriginMiddleware` rejects `Origin: null` (file:// protocol) with 403 before any other handling.

**Rationale:** SEC-01 invariant: sandboxed iframe/file:// origins must never reach the API. Outermost middleware ensures this.
**Source:** 02-03-SUMMARY.md

---

### BYTEA Re-encode in Detail Endpoint
Detail `GET /api/incidents/:id` re-encodes screenshot BYTEA as `data:image/png;base64,...` data URL. List endpoint excludes screenshot for performance.

**Rationale:** List with 20 rows of BYTEA would be slow and memory-heavy; detail view needs the image for display.
**Source:** 02-04-SUMMARY.md

---

### Alembic Async with NullPool
Use `async_engine_from_config` with `NullPool` in Alembic env.py. Override `sqlalchemy.url` from `get_settings().DATABASE_URL`.

**Rationale:** `NullPool` prevents connection pool issues during migrations; async engine matches the app's async SQLAlchemy usage.
**Source:** 02-01-SUMMARY.md

---

### Seed Admin Idempotently in Lifespan
`seed_admin()` runs in FastAPI lifespan, upserting the admin user. Rotates hash if password changed.

**Rationale:** Zero-config startup; changing `ADMIN_PASSWORD` in `.env` auto-updates the hash on next boot.
**Source:** 02-02-SUMMARY.md

---

## Lessons

### Pydantic EmailStr Rejects .local Domains
Pydantic's `EmailStr` (via `email-validator`) rejects `.local` TLDs. The seeded admin `admin@watchbug.local` failed validation until the field was changed to `str`.

**Context:** Common in self-hosted/local development setups.
**Source:** 02-02-SUMMARY.md

---

### CORS Middleware Order Is Critical
Starlette middleware order matters: `NullOriginMiddleware` (outermost) → `IngestCorsMiddleware` → `CORSMiddleware` → `SlowAPIMiddleware`. Wrong order causes preflight failures.

**Context:** The `CORSMiddleware` blocks non-allowlisted origins before `IngestCorsMiddleware` can echo them.
**Source:** 02-03-SUMMARY.md

---

### Rate Limiter Needs Test Isolation
`slowapi` in-memory rate limiter accumulates across tests. An autouse fixture `limiter.reset()` is required to prevent flaky test failures.

**Context:** Tests that hit rate limits contaminate subsequent tests in the same process.
**Source:** 02-03-SUMMARY.md

---

### BYTEA Storage Requires Explicit Pop
Screenshot Base64 must be explicitly popped from the JSONB payload before storing as BYTEA — otherwise the same data is stored twice (once in JSONB, once in BYTEA).

**Context:** The `encode_screenshot` function strips the `data:image/png;base64,` prefix and decodes to bytes.
**Source:** 02-04-SUMMARY.md

---

### chunked Transfer Encoding Needs request.body()
Using `Content-Length` header for payload size check fails with chunked encoding. Must use `await request.body()` to get the actual body length.

**Context:** Some HTTP clients (including the SDK's fetch) use chunked encoding by default.
**Source:** 02-03-SUMMARY.md

---

## Patterns

### JWT HttpOnly Cookie Auth
Login sets `watchbug_access` (1h) + `watchbug_refresh` (7d) HttpOnly cookies. `SameSite=Lax`, `Secure` toggled by `ENV==production`. Refresh reissues access without re-authentication.

**When to use:** Web apps needing session auth without token storage in JavaScript.
**Source:** 02-02-SUMMARY.md

---

### get_current_user Dependency
FastAPI `Depends(get_current_user)` reads cookie → `jwt.decode` with HS256 allowlist → DB lookup → 401 variants (missing/expired/invalid/not found).

**When to use:** Protecting FastAPI routes with JWT cookie authentication.
**Source:** 02-02-SUMMARY.md

---

### Recursive sanitize_payload
`sanitize_payload(obj)` recursively traverses dicts/lists/strings, applying `html.escape` + event-handler strip at leaf strings.

**When to use:** Sanitizing arbitrary JSON payloads before storage to prevent Stored XSS.
**Source:** 02-03-SUMMARY.md

---

### Split CORS Architecture
Three layers: `NullOriginMiddleware` (reject null) → `IngestCorsMiddleware` (echo any origin for OPTIONS on ingest) → `CORSMiddleware` (strict allowlist for admin routes).

**When to use:** APIs with both public ingest endpoints and authenticated admin endpoints requiring different CORS policies.
**Source:** 02-03-SUMMARY.md

---

### Per-Route Payload Size Guard
```python
body = await request.body()
if len(body) > settings.MAX_PAYLOAD_BYTES:
    raise HTTPException(status_code=413, detail="payload too large")
```
Runs before `json.loads`/Pydantic validation. Handles chunked encoding.

**When to use:** APIs where payload size must be enforced before expensive parsing.
**Source:** 02-03-SUMMARY.md

---

### composite Rate Limit Key
```python
def _get_project_key(request):
    key = request.headers.get("x-watchbug-key") or "unknown"
    return f"{get_remote_address(request)}:{key}"
```
Per-IP + per-project-key rate limiting for ingest endpoints.

**When to use:** APIs with public write endpoints that need per-tenant rate limits.
**Source:** 02-03-SUMMARY.md

---

### Seed-on-Startup Pattern
Lifespan context manager runs `seed_admin()` + `seed_default_project()` idempotently on startup. Handles first boot and password rotation.

**When to use:** Self-hosted apps that need zero-config initial setup.
**Source:** 02-02-SUMMARY.md

---

## Surprises

### 65 Tests Passed on First Full Run
The entire backend test suite (65 tests) passed on first execution after all 4 plans were complete. No test-fix iterations needed.

**Impact:** High confidence in backend correctness; the tracer-first approach (plan → test → implement) paid off.
**Source:** 02-VERIFICATION.md

---

### IngestCorsMiddleware Complexity
The CORS handling for the ingest endpoint required a dedicated middleware (`IngestCorsMiddleware`) because `CORSMiddleware` with `allow_origins=["*"]` + `credentials: true` throws a `ValueError` in Starlette.

**Impact:** More middleware layers than expected; must be careful about ordering.
**Source:** 02-03-SUMMARY.md
