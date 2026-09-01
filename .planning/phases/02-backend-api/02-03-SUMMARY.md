---
phase: 02-backend-api
plan: "03"
subsystem: api
tags: [fastapi, security, cors, rate-limiting, xss, slowapi, html-escape]
requires:
  - phase: 02-02
    provides: [JWT HttpOnly cookie auth, protected GET/PATCH incidents, seeded admin]
provides:
  - XSS sanitization before JSONB via html.escape + event-handler strip (SEC-03)
  - 100KB payload guard 413 before validation with chunked support (SEC-04)
  - Split CORS with null rejection 403, allowlist admin vs open ingest echo + preflight (SEC-01)
  - slowapi in-memory rate limiting per IP + per key with Retry-After 429 (SEC-02)
  - Ingest contract distinct 401 vs 413 vs 422 vs 429 with dual header and case-insensitive type
affects: [02-04-hardening, 03-panel, 04-docker]
actuals:
  tokens: 18200
  tasks: 3
  commits: 3
tech-stack:
  added: [slowapi==0.1.10, html-stdlib-sanitize, limits-memory-storage]
  patterns: [per-route 413 guard not global middleware, NullOrigin+IngestCors before CORSMiddleware, slowapi composite key IP+project_key, recursive sanitize_payload, BYTEA data URL strip, case-insensitive type normalize]
key-files:
  created:
    - backend/app/utils/sanitize.py
    - backend/app/middleware/payload_size.py
    - backend/app/limiter.py
    - backend/tests/test_security.py
  modified:
    - backend/app/services/incident_service.py
    - backend/app/routers/incidents.py
    - backend/app/routers/auth.py
    - backend/app/main.py
    - backend/tests/test_incidents_ingest.py
    - backend/tests/conftest.py
key-decisions:
  - "Use html.escape quote True + event-handler/js strip as stdlib sanitizer, not bleach — plain text consoleLogs/notes per RESEARCH Don't Hand-Roll"
  - "Keep per-route len(await request.body()) 413 check not global BaseHTTPMiddleware to handle chunked and avoid double-read (Pitfall 8)"
  - "Add dedicated IngestCorsMiddleware for OPTIONS preflight on /api/incidents with any Origin to bypass CORSMiddleware allowlist 400, while NullOriginMiddleware remains outermost 403 for null"
  - "Centralize slowapi Limiter in backend/app/limiter.py with memory:// and reset autouse fixture to isolate tests; document single worker --workers 1 only per Pitfall 6"
patterns-established:
  - "sanitize_string html.escape + _EVENT_HANDLER_RE + _JAVASCRIPT_RE and recursive sanitize_payload before JSONB"
  - "Per-route 413 guard actual len(body) > MAX_PAYLOAD_BYTES before json.loads/Pydantic, distinct from 422"
  - "Split CORS: CORSMiddleware allowlist with credentials true, ingest POST echo Access-Control-Allow-Origin+Vary, admin strict allowlist, OPTIONS open via IngestCorsMiddleware, null rejected 403"
  - "Rate limiting: 10/min per IP + 30/min per IP:key composite on POST, 60/min per IP on GET/PATCH/auth via @limiter.limit decorators with get_remote_address key_func and Retry-After header"
  - "Project key dual header X-Watchbug-Key primary + X-Project-Key fallback lowercased via Starlette, 401 distinct"
  - "Type normalization via field_validator before + after, screenshot data: prefix strip + base64 validate True 422 on bad encoding, screenshot popped from JSONB before BYTEA storage"
requirements-completed:
  - API-02
  - SEC-01
  - SEC-02
  - SEC-03
  - SEC-04
coverage:
  - id: D1
    description: "XSS sanitization before JSONB — html.escape quote True + event-handler/javascript strip recursive, verified no raw <script> in DB"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "backend/tests/test_security.py#test_xss_sanitized"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_create_bug_success DB payload check"
        status: pass
    human_judgment: false
  - id: D2
    description: "100KB payload guard returns 413 Payload Too Large before validation for Content-Length and chunked actual body, distinct from 422/401"
    requirement: "SEC-04"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_payload_too_large_413"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_payload_too_large_chunked"
        status: pass
    human_judgment: false
  - id: D3
    description: "CORS null rejected 403, ingest open with echo Origin+Vary and preflight 200 for any Origin, admin strict allowlist with credentials true"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "backend/tests/test_security.py#test_cors_null_rejected"
        status: pass
      - kind: integration
        ref: "backend/tests/test_security.py#test_cors_ingest_open"
        status: pass
      - kind: integration
        ref: "backend/tests/test_security.py#test_cors_ingest_open_preflight"
        status: pass
      - kind: integration
        ref: "backend/tests/test_security.py#test_cors_admin_blocked"
        status: pass
      - kind: integration
        ref: "backend/tests/test_security.py#test_cors_admin_allowlisted"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rate limiting slowapi in-memory 10/min per IP + 30/min per IP:key on ingest, 60/min on GET/PATCH/auth returns 429 with Retry-After and retry_after body"
    requirement: "SEC-02"
    verification:
      - kind: integration
        ref: "backend/tests/test_security.py#test_rate_limit_post_429"
        status: pass
      - kind: integration
        ref: "backend/tests/test_security.py#test_rate_limit_per_key_429"
        status: pass
      - kind: integration
        ref: "backend/tests/test_security.py#test_rate_limit_auth_429"
        status: pass
    human_judgment: false
  - id: D5
    description: "Project key dual header X-Watchbug-Key primary and X-Project-Key fallback returns 401 invalid project key distinct from 422/413"
    requirement: "API-02"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_invalid_project_key_401"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_missing_project_key_401"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_fallback_header_alias"
        status: pass
    human_judgment: false
  - id: D6
    description: "Ingest 201 contract {id uuid, status Pending, created_at iso8601}, case-insensitive bug->Bug normalized, data URL prefix stripped for BYTEA, 422 for invalid screenshot and Bug without consoleLogs loc body.consoleLogs"
    requirement: "API-02"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_response_shape_201"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_case_insensitive_type"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_screenshot_data_url_variant"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_bug_without_logs_422"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_ingest.py#test_invalid_screenshot_encoding_422"
        status: pass
    human_judgment: false
  - id: D7
    description: "Error contract distinct and no secret leakage — 401/413/422/429 each JSON detail without DATABASE_URL/JWT_SECRET/stack trace"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "backend/tests/test_security.py#test_error_codes_distinct"
        status: pass
      - kind: integration
        ref: "backend/tests/test_security.py#test_no_secret_leakage_on_errors"
        status: pass
    human_judgment: false
duration: 42min
completed: 2026-09-01
status: complete
---

# Phase 02 Plan 03: Ingest Hardening Summary

**Production-hardened POST /api/incidents with XSS html.escape sanitization, 100KB 413 guard before 422, split CORS null-reject + open ingest with preflight, and slowapi per-IP/per-key rate limiting with Retry-After**

## Performance

- **Duration:** 42 min
- **Started:** 2026-09-01T17:00:00Z
- **Completed:** 2026-09-01T17:42:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Hardened public ingest to production security: recursive html.escape + handler/js strip before JSONB, no raw <script>/onerror/javascript: in storage
- Enforced 100KB size guard per-route via actual len(body) handling both Content-Length and chunked, returning 413 distinct from 401/422
- Split CORS: null origin 403, admin allowlist with credentials true, ingest open with Origin echo+Vary and dedicated OPTIONS preflight handler bypassing CORSMiddleware allowlist 400
- Wired slowapi in-memory limiter 10/min per IP + 30/min per IP:key composite on POST and 60/min on GET/PATCH/auth with JSON {detail: rate limit exceeded, retry_after} + Retry-After header, documented single worker

## Task Commits

Each task was committed atomically:

1. **Task 1: XSS sanitization + payload size guard + project key and schema hardening** - `df62de4` (feat)
2. **Task 2: Split CORS and in-memory rate limiting with Retry-After** - `87260d6` (feat)
3. **Task 3: Ingest contract finalization and security regression tests** - `903a581` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `backend/app/utils/sanitize.py` - sanitize_string html.escape + event-handler strip + recursive sanitize_payload
- `backend/app/middleware/payload_size.py` - placeholder documenting per-route 413 guard over global double-read
- `backend/app/limiter.py` - central slowapi Limiter memory:// instance to avoid circular imports
- `backend/app/services/incident_service.py` - now imports canonical sanitize_payload, strips screenshot from JSONB before BYTEA storage, data URL prefix strip with validate True
- `backend/app/routers/incidents.py` - null 403 first, POST echo Origin+Vary, 401 before 413 split, 413 via len(body), prepend body loc for 422 shape, stacked @limiter.limit per IP + per key, GET/PATCH 60/min
- `backend/app/routers/auth.py` - added request param and @limiter.limit 60/min on login/refresh
- `backend/app/main.py` - added NullOriginMiddleware outermost, IngestCorsMiddleware for open OPTIONS preflight, CORSMiddleware allowlist credentials true, SlowAPIMiddleware innermost, RateLimitExceeded handler with Retry-After
- `backend/tests/conftest.py` - autouse reset_rate_limiter fixture to isolate slowapi memory across tests
- `backend/tests/test_security.py` - CORS null/open/preflight/allowlist, rate-limit 11/31/61 429, XSS, error contract, data URL, case-insensitive, no secret leakage
- `backend/tests/test_incidents_ingest.py` - added 413 large/chunked, 201 shape, data URL BYTEA, case-insensitive Bug/Feedback, empty body edge

## Decisions Made

- Use html stdlib html.escape not bleach/nh3 per RESEARCH — plain text consoleLogs/notes with Panel textContent double defense
- Per-route 413 check via len(await request.body()) not Content-Length header, handles chunked and fires before Pydantic
- Add IngestCorsMiddleware for OPTIONS /api/incidents with any Origin to avoid CORSMiddleware 400 Disallowed, keep NullOrigin outermost for null 403
- Stack two @limiter.limit decorators on POST with same limiter but different key_func (IP vs IP:key composite) to enforce 10 and 30 without extra infra
- Central limiter in app/limiter.py avoids circular import between main.py and routers; storage reset via limiter.reset() in conftest autouse

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed OPTIONS preflight 400 Disallowed CORS origin for arbitrary ingest origins**
- **Found during:** Task 2 verification (test_cors_ingest_open_preflight failed 400)
- **Issue:** CORSMiddleware with allowlist rejects OPTIONS preflight for customer domains (X-Watchbug-Key triggers preflight), breaking SDK on arbitrary origins per D-13
- **Fix:** Added IngestCorsMiddleware intercepting OPTIONS /api/incidents before CORSMiddleware, returning 200 with echo Access-Control-Allow-Origin+Vary for any origin (null still 403 via outermost NullOriginMiddleware)
- **Files modified:** `backend/app/main.py`
- **Verification:** `pytest test_cors_ingest_open_preflight` now passes 200 with allow header; manual OPTIONS with https://customer.example returns 200 not 400
- **Committed in:** `87260d6` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Pydantic 422 loc missing body prefix**
- **Found during:** Task 1 manual verification (bug no logs returned loc ["consoleLogs"] not ["body","consoleLogs"])
- **Issue:** Manual IncidentCreate(**data_dict) raised ValidationError with loc ("consoleLogs",) but FastAPI default expects ("body","consoleLogs") per D-06
- **Fix:** Wrap errors with ("body",)+loc before raising RequestValidationError
- **Files modified:** `backend/app/routers/incidents.py`
- **Verification:** Manual POST bug without logs now returns loc ["body","consoleLogs"]; test_bug_without_logs_422 still passes strict check
- **Committed in:** `df62de4` (Task 1 commit)

**3. [Rule 3 - Blocking] Added rate limiter isolation fixture to prevent spillover**
- **Found during:** Task 2 integration (29 tests would exceed 10/min per IP across functions)
- **Issue:** slowapi memory storage persists across test functions sharing same app instance, causing later tests to hit 429 even with <10 requests in that test
- **Fix:** Added autouse reset_rate_limiter fixture in conftest that calls limiter.reset() before and after each function; explicit limiter.reset() in rate-limit test loops
- **Files modified:** `backend/tests/conftest.py`, `backend/app/limiter.py`
- **Verification:** `pytest backend/tests -q` 39 passed (previously spillover would cause 429 on second ingest test)
- **Committed in:** `87260d6` (Task 2 commit)

**4. [Rule 2 - Missing Critical] Added case-insensitive type and data URL handling verification**
- **Found during:** Task 3 expansion
- **Issue:** Plan required case-insensitive bug->Bug and data: prefix strip but no regression guard for storage TitleCase check
- **Fix:** Added test_case_insensitive_type and test_screenshot_data_url_variant asserting incident.type == TitleCase and BYTEA bytes == decode of stripped b64 and payload lacks screenshot key
- **Files modified:** `backend/tests/test_incidents_ingest.py`, `backend/tests/test_security.py`
- **Verification:** `pytest test_screenshot_data_url_variant` passes with both plain and data: prefix; case-insensitive loop passes 6 variants
- **Committed in:** `903a581` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 bug, 1 blocking, 1 missing critical)
**Impact on plan:** All essential for correctness (preflight would break SDK, loc shape required by Panel, rate-limit isolation needed for deterministic tests). No scope creep.

## Issues Encountered

- Windows Docker Desktop asyncpg host networking continues to prevent real PG on host; sqlite fallback file watchbug_test.db used for host, real PG verified via docker network in prior plans
- Ingest CORS preflight failure discovered during Task 2 due to allowlist + custom header; required new IngestCorsMiddleware before CORS
- Slowapi memory per-process limitation documented as single worker --workers 1 only per Pitfall 6

## User Setup Required

None - no external service configuration required. For local dev: ensure `CORS_ORIGINS` comma-separated exact matches includes `http://localhost:5173` for allowlisted admin; POST ingest remains open via echo. Rate limiting is in-memory per process; deploy with `uvicorn app.main:app --workers 1` only.

## Next Phase Readiness

- Public ingest is production-hardened: XSS, size, CORS, rate-limit all verified with 27 passing ingest+security tests (13 security + 14 ingest)
- Admin retrieval still minimal paginated list from 02-02; ready for 02-04 hardening or Phase 3 Panel to consume filtered list
- No blockers; remaining concerns are single-worker constraint for self-hosted and BYTEA vs future MinIO (STR-01 deferred)

---
*Phase: 02-backend-api*
*Completed: 2026-09-01*

## Self-Check: PASSED

- Files exist: backend/app/utils/sanitize.py, backend/app/middleware/payload_size.py, backend/app/limiter.py, backend/tests/test_security.py FOUND
- Commits exist: df62de4, 87260d6, 903a581 FOUND via git log
- Verification: `python -m pytest backend/tests/test_security.py backend/tests/test_incidents_ingest.py -q` 27 passed; `python -m pytest backend/tests -q` 39 passed; grep allow_origins never ["*"] with credentials true; CORSMiddleware allow_credentials True checked
