---
status: complete
phase: 02-backend-api
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-09-01T17:21:26.413Z
updated: 2026-09-01T17:22:54.731Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
result: pass

### 2. FastAPI app with lifespan asynccontextmanager, Settings from .env, AsyncEngine expire_on_commit=False
expected: FastAPI app with lifespan asynccontextmanager, Settings from .env, AsyncEngine expire_on_commit=False
result: pass
source: automated
coverage_id: D1

### 3. POST /api/incidents accepts SDK contract X-Watchbug-Key, Bug/Feedback validation, BYTEA decode, returns 201
expected: POST /api/incidents accepts SDK contract X-Watchbug-Key, Bug/Feedback validation, BYTEA decode, returns 201
result: pass
source: automated
coverage_id: D2

### 4. TRN-04 validation: Bug without consoleLogs returns 422 loc body.consoleLogs
expected: TRN-04 validation: Bug without consoleLogs returns 422 loc body.consoleLogs
result: pass
source: automated
coverage_id: D3

### 5. Project key auth: missing/invalid key returns 401 invalid project key, alias X-Project-Key works
expected: Project key auth: missing/invalid key returns 401 invalid project key, alias X-Project-Key works
result: pass
source: automated
coverage_id: D4

### 6. GET /api/health public returns {status: ok, db: connected|disconnected} with SELECT 1 probe
expected: GET /api/health public returns {status: ok, db: connected|disconnected} with SELECT 1 probe
result: pass
source: automated
coverage_id: D5

### 7. DB schema: incidents/users/projects with UUID PK, JSONB/JSON payload, BYTEA screenshot, FK
expected: DB schema: incidents/users/projects with UUID PK, JSONB/JSON payload, BYTEA screenshot, FK
result: pass
source: automated
coverage_id: D6

### 8. Alembic async env.py with Base.metadata, 001_initial creates 3 tables, upgrade head idempotent
expected: Alembic async env.py with Base.metadata, 001_initial creates 3 tables, upgrade head idempotent
result: pass
source: automated
coverage_id: D7

### 9. .env.example documents all Settings fields, no secrets hardcoded in backend/app
expected: .env.example documents all Settings fields, no secrets hardcoded in backend/app
result: pass
source: automated
coverage_id: D8

### 10. Passwords stored as bcrypt $2b$12$ 60-char hash distinct per salt, verified via checkpw
expected: Passwords stored as bcrypt $2b$12$ 60-char hash distinct per salt, verified via checkpw
result: pass
source: automated
coverage_id: D1

### 11. POST /api/auth/login with valid seeded admin returns 200 logged in and both HttpOnly SameSite Lax cookies with Max-Age 3600/604800
expected: POST /api/auth/login with valid seeded admin returns 200 logged in and both HttpOnly SameSite Lax cookies with Max-Age 3600/604800
result: pass
source: automated
coverage_id: D2

### 12. Wrong password returns 401 invalid credentials without leaking existence
expected: Wrong password returns 401 invalid credentials without leaking existence
result: pass
source: automated
coverage_id: D3

### 13. GET /api/incidents without valid cookie returns 401 not authenticated, with cookie returns 200 paginated
expected: GET /api/incidents without valid cookie returns 401 not authenticated, with cookie returns 200 paginated
result: pass
source: automated
coverage_id: D4

### 14. POST /api/auth/refresh with valid refresh cookie reissues access cookie
expected: POST /api/auth/refresh with valid refresh cookie reissues access cookie
result: pass
source: automated
coverage_id: D5

### 15. POST /api/auth/logout clears both cookies via Max-Age 0 and subsequent GET fails 401
expected: POST /api/auth/logout clears both cookies via Max-Age 0 and subsequent GET fails 401
result: pass
source: automated
coverage_id: D6

### 16. JWT uses PyJWT HS256 with jti/sub/exp/iat, decode allowlist algorithms HS256, expired returns 401 token expired
expected: JWT uses PyJWT HS256 with jti/sub/exp/iat, decode allowlist algorithms HS256, expired returns 401 token expired
result: pass
source: automated
coverage_id: D7

### 17. Seed admin upserts from ADMIN_EMAIL/ADMIN_PASSWORD idempotently and rotates hash
expected: Seed admin upserts from ADMIN_EMAIL/ADMIN_PASSWORD idempotently and rotates hash
result: pass
source: automated
coverage_id: D8

### 18. .env.example documents every Settings field, no secrets hardcoded beyond Field defaults
expected: .env.example documents every Settings field, no secrets hardcoded beyond Field defaults
result: pass
source: automated
coverage_id: D9

### 19. XSS sanitization before JSONB — html.escape quote True + event-handler/javascript strip recursive, verified no raw <script> in DB
expected: XSS sanitization before JSONB — html.escape quote True + event-handler/javascript strip recursive, verified no raw <script> in DB
result: pass
source: automated
coverage_id: D1

### 20. 100KB payload guard returns 413 Payload Too Large before validation for Content-Length and chunked actual body, distinct from 422/401
expected: 100KB payload guard returns 413 Payload Too Large before validation for Content-Length and chunked actual body, distinct from 422/401
result: pass
source: automated
coverage_id: D2

### 21. CORS null rejected 403, ingest open with echo Origin+Vary and preflight 200 for any Origin, admin strict allowlist with credentials true
expected: CORS null rejected 403, ingest open with echo Origin+Vary and preflight 200 for any Origin, admin strict allowlist with credentials true
result: pass
source: automated
coverage_id: D3

### 22. Rate limiting slowapi in-memory 10/min per IP + 30/min per IP:key on ingest, 60/min on GET/PATCH/auth returns 429 with Retry-After and retry_after body
expected: Rate limiting slowapi in-memory 10/min per IP + 30/min per IP:key on ingest, 60/min on GET/PATCH/auth returns 429 with Retry-After and retry_after body
result: pass
source: automated
coverage_id: D4

### 23. Project key dual header X-Watchbug-Key primary and X-Project-Key fallback returns 401 invalid project key distinct from 422/413
expected: Project key dual header X-Watchbug-Key primary and X-Project-Key fallback returns 401 invalid project key distinct from 422/413
result: pass
source: automated
coverage_id: D5

### 24. Ingest 201 contract {id uuid, status Pending, created_at iso8601}, case-insensitive bug->Bug normalized, data URL prefix stripped for BYTEA, 422 for invalid screenshot and Bug without consoleLogs loc body.consoleLogs
expected: Ingest 201 contract {id uuid, status Pending, created_at iso8601}, case-insensitive bug->Bug normalized, data URL prefix stripped for BYTEA, 422 for invalid screenshot and Bug without consoleLogs loc body.consoleLogs
result: pass
source: automated
coverage_id: D6

### 25. Error contract distinct and no secret leakage — 401/413/422/429 each JSON detail without DATABASE_URL/JWT_SECRET/stack trace
expected: Error contract distinct and no secret leakage — 401/413/422/429 each JSON detail without DATABASE_URL/JWT_SECRET/stack trace
result: pass
source: automated
coverage_id: D7

### 26. Paginated GET /api/incidents returns {items, total, page, size, pages} with default page 1 size 20 max 100, pages ceil(total/size), ordered created_at desc, excludes BYTEA
expected: Paginated GET /api/incidents returns {items, total, page, size, pages} with default page 1 size 20 max 100, pages ceil(total/size), ordered created_at desc, excludes BYTEA
result: pass
source: automated
coverage_id: D1

### 27. Filterable by type Bug/Feedback case-insensitive and status Pending/In Progress/Resolved comma-separated, combined intersection
expected: Filterable by type Bug/Feedback case-insensitive and status Pending/In Progress/Resolved comma-separated, combined intersection
result: pass
source: automated
coverage_id: D2

### 28. GET /api/incidents without JWT cookie returns 401, invalid filter returns 422, invalid size >100 returns 422
expected: GET /api/incidents without JWT cookie returns 401, invalid filter returns 422, invalid size >100 returns 422
result: pass
source: automated
coverage_id: D3

### 29. PATCH /api/incidents/:id/status Any->Any returns 200 {id,status}, invalid id 404, invalid status 422, without auth 401
expected: PATCH /api/incidents/:id/status Any->Any returns 200 {id,status}, invalid id 404, invalid status 422, without auth 401
result: pass
source: automated
coverage_id: D4

### 30. Detail GET /api/incidents/:id re-encodes BYTEA as data:image/png;base64 data URL matching original upload bytes
expected: Detail GET /api/incidents/:id re-encodes BYTEA as data:image/png;base64 data URL matching original upload bytes
result: pass
source: automated
coverage_id: D5

### 31. GET /api/health remains public and DOCS_ENABLED gates /docs/openapi.json behind flag (404 when false)
expected: GET /api/health remains public and DOCS_ENABLED gates /docs/openapi.json behind flag (404 when false)
result: pass
source: automated
coverage_id: D6

### 32. E2E login-ingest-list-patch-detail-logout flow passes with real PG/sqlite fallback
expected: E2E login-ingest-list-patch-detail-logout flow passes with real PG/sqlite fallback
result: pass
source: automated
coverage_id: D7

## Summary

total: 32
passed: 32
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

## Deferred Follow-Ups
