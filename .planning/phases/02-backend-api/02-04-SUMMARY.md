---
phase: 02-backend-api
plan: "04"
subsystem: api
tags: [fastapi, pagination, filtering, sqlalchemy, jwt, bytea, docs-gating]
requires:
  - phase: 02-03
    provides: [XSS sanitization, 100KB guard, split CORS, slowapi rate limiting, ingest contract hardening]
provides:
  - Paginated filtered GET /api/incidents with page/size/total/pages, type/status comma-separated, case-insensitive type, ordered desc, BYTEA excluded via load_only
  - Detail GET /api/incidents/:id with screenshot re-encoded as data:image/png;base64 data URL
  - Status PATCH /api/incidents/:id/status Any->Any with StatusUpdate validation, 404/422/401
  - Docs gating via DOCS_ENABLED flag and health public verification with 26 new tests + E2E flow
affects: [03-panel, 04-docker]
actuals:
  tokens: 12460
  tasks: 3
  commits: 3
tech-stack:
  added: [pagination helper, status update, detail encode]
  patterns: [paginate_and_filter bound params load_only, case-insensitive type normalize, status comma split preserving In Progress space, to_incident_out deferred BYTEA inspect, StatusUpdate Pydantic validation, detail data URL re-encode, docs gating]
key-files:
  created:
    - backend/app/utils/pagination.py
    - backend/tests/test_incidents_list.py
    - backend/tests/test_incidents_status.py
  modified:
    - backend/app/schemas/common.py
    - backend/app/schemas/incident.py
    - backend/app/services/incident_service.py
    - backend/app/routers/incidents.py
    - backend/app/main.py
    - backend/tests/conftest.py
key-decisions:
  - "Use load_only to exclude LargeBinary screenshot from list query and inspect(state.unloaded) to avoid lazy load N+1, inferring has_screenshot=True when deferred per T-02-04-03 OOM mitigation"
  - "Normalize type filter case-insensitive via lower mapping bug->Bug feedback->Feedback, preserve status In Progress space by comma split trimmed, validate via allowlist before SQLAlchemy .in_ bound params per T-02-04-01"
  - "Return 422 for invalid filter values via ValueError->HTTPException and Query le=100 for size cap per D-09; pagination pages = ceil(total/size) via math.ceil"
  - "Detail re-encodes BYTEA via base64.b64encode with data:image/png;base64 prefix for Panel img src direct use; list returns has_screenshot bool not bytes"
  - "PATCH status uses StatusUpdate schema validator for strict 422 shape loc body.status, maps invalid UUID string to 404 not 422 for enumeration safety per T-02-04-04"
patterns-established:
  - "Pagination helper paginate_and_filter: parse_type_filter/parse_status_filter -> select(func.count) + offset/limit + load_only ordering created_at desc"
  - "IncidentOut without screenshot + IncidentOutDetail with screenshot data URL + StatusUpdate Literal validation"
  - "to_incident_out/inspect deferred handling and to_incident_detail encode_screenshot mapping"
  - "GET /api/incidents with Query page/size/type/status Depends(get_current_user) before query builder"
  - "GET /api/incidents/{id} detail and PATCH /{id}/status Any->Any with 60/min limiter and JWT"
requirements-completed:
  - API-03
  - API-04
  - AUTH-03
  - SEC-01
coverage:
  - id: D1
    description: "Paginated GET /api/incidents returns {items, total, page, size, pages} with default page 1 size 20 max 100, pages ceil(total/size), ordered created_at desc, excludes BYTEA"
    requirement: "API-03"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_paginated_ok"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_paginated_page2"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_size_cap_422"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_list_excludes_byteA_fast"
        status: pass
    human_judgment: false
  - id: D2
    description: "Filterable by type Bug/Feedback case-insensitive and status Pending/In Progress/Resolved comma-separated, combined intersection"
    requirement: "API-03"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_filter_type_bug"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_filter_type_lowercase_normalized"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_filter_type_comma"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_filter_status_pending"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_filter_status_comma_with_space"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_filter_combined_type_status"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /api/incidents without JWT cookie returns 401, invalid filter returns 422, invalid size >100 returns 422"
    requirement: "AUTH-03"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_unauth_401"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_invalid_type_422"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_list.py#test_invalid_status_422"
        status: pass
    human_judgment: false
  - id: D4
    description: "PATCH /api/incidents/:id/status Any->Any returns 200 {id,status}, invalid id 404, invalid status 422, without auth 401"
    requirement: "API-04"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_status.py#test_patch_status_ok"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_status.py#test_patch_any_to_any_resolved_then_pending"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_status.py#test_patch_not_found_404"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_status.py#test_patch_invalid_status_422"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_status.py#test_patch_unauth_401"
        status: pass
    human_judgment: false
  - id: D5
    description: "Detail GET /api/incidents/:id re-encodes BYTEA as data:image/png;base64 data URL matching original upload bytes"
    requirement: "API-03"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_status.py#test_detail_includes_screenshot_base64"
        status: pass
    human_judgment: false
  - id: D6
    description: "GET /api/health remains public and DOCS_ENABLED gates /docs/openapi.json behind flag (404 when false)"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "backend/tests/test_incidents_status.py#test_health_still_public"
        status: pass
      - kind: integration
        ref: "backend/tests/test_incidents_status.py#test_docs_gated"
        status: pass
    human_judgment: false
  - id: D7
    description: "E2E login-ingest-list-patch-detail-logout flow passes with real PG/sqlite fallback"
    requirement: "API-03"
    verification:
      - kind: e2e
        ref: "backend/tests/test_incidents_status.py#test_e2e_flow"
        status: pass
    human_judgment: false
duration: 42min
completed: 2026-09-01
status: complete
---

# Phase 02 Plan 04: Retrieval & Status Management Summary

**Paginated filtered incident listing with Any->Any status updates, JWT-protected detail with BYTEA data-URL re-encode, and docs gating — 26 retrieval tests completing API-03/04 and AUTH-03**

## Performance

- **Duration:** 42 min
- **Started:** 2026-09-01T17:40:00Z
- **Completed:** 2026-09-01T18:22:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Delivered paginated, filterable GET /api/incidents with page/size/total/pages ceil math, type Bug/Feedback case-insensitive and status Pending/In Progress/Resolved comma-separated combined filters, ordered created_at desc, excluding LargeBinary BYTEA via load_only for OOM safety
- Implemented PATCH /api/incidents/:id/status Any->Any with StatusUpdate Literal validation (200 {id,status}, 404 missing, 422 invalid, 401 unauth) and GET detail re-encoding BYTEA as data:image/png;base64 for Panel img src
- Hardened auth boundary: 401 before query builder runs, bound params via .in_ for SQL injection mitigation, health public and docs gated by DOCS_ENABLED flag
- Added 26 new tests (14 list + 12 status) covering pagination, filtering, case normalization, combined, ordering, size cap, BYTEA exclusion, status transitions, detail screenshot validity, and E2E flow — full suite 65 passed with real PG via sqlite fallback on Windows

## Task Commits

Each task was committed atomically:

1. **Task 1: Paginated filtered incident retrieval (list without BYTEA)** - `2235330` (feat)
2. **Task 2: Status update and detail with BYTEA re-encode + docs gating** - `cf0333c` (feat)
3. **Task 3: Retrieval tests and E2E phase verification** - `2f8f1c3` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `backend/app/utils/pagination.py` - paginate_and_filter, parse_type_filter/status_filter, load_only BYTEA exclusion, ceil pages, bound params
- `backend/app/schemas/common.py` - PaginatedResponse with items/total/page/size/pages and PaginationParams ge/le
- `backend/app/schemas/incident.py` - IncidentOut (no screenshot, has_screenshot), IncidentOutDetail (data URL), StatusUpdate validator
- `backend/app/services/incident_service.py` - encode_screenshot, to_incident_out with inspect deferred check, to_incident_detail, update_incident_status helper
- `backend/app/routers/incidents.py` - GET list with Query validation 422, GET detail with auth and 404, PATCH status with StatusUpdate 422 and Any->Any commit
- `backend/app/main.py` - already gated docs via DOCS_ENABLED flag (verified 404 when false)
- `backend/tests/conftest.py` - seed_incidents_helper and assert_paginated_shape for 25-incident seeding with staggered timestamps
- `backend/tests/test_incidents_list.py` - 14 tests paginated, filters, combined, case-insensitive, ordering, size cap, unauth, BYTEA guard
- `backend/tests/test_incidents_status.py` - 12 tests patch ok/any->any/404/422/unauth, detail screenshot base64, health/docs, E2E flow

## Decisions Made

- Use `load_only` to exclude LargeBinary screenshot from list query and `sqlalchemy.inspect(state.unloaded)` to avoid lazy load N+1, inferring has_screenshot=True when deferred — prevents OOM for 20 rows per T-02-04-03
- Normalize type filter case-insensitive via lower mapping and preserve status In Progress space by comma-split trimmed, validate via allowlist before .in_ bound params — mitigates SQL injection per T-02-04-01
- Return 422 for invalid filter values via ValueError->HTTPException and Query(le=100) for size cap; pages = ceil(total/size) via math.ceil — supports Panel footer per D-09/D-10
- Detail re-encodes BYTEA via base64.b64encode with data:image/png;base64 prefix for direct Panel img src use
- PATCH maps invalid UUID string to 404 not 422 and uses StatusUpdate Pydantic validator for 422 shape loc body.status — balances enumeration safety and spec compliance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed list has_screenshot lazy-load N+1 when BYTEA deferred**
- **Found during:** Task 1 manual verification (list returned correct but triggered per-row SELECT for screenshot)
- **Issue:** `bool(getattr(incident, \"screenshot\", None))` on load_only deferred attribute triggers implicit SELECT per incident, defeating OOM exclusion and causing 20 extra queries
- **Fix:** Use `sqlalchemy.inspect(incident).unloaded` check; if screenshot in unloaded, set has_screenshot True without accessing attribute; otherwise read normally
- **Files modified:** `backend/app/services/incident_service.py`
- **Verification:** Manual list with 5 incidents returns 200 and items without extra query; `pytest test_list_excludes_byteA_fast` passes; list response lacks screenshot key
- **Committed in:** `2235330` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added explicit invalid filter validation returning 422**
- **Found during:** Task 1 verification (type=Invalid returned 200 with 0 items instead of 422 per must_haves)
- **Issue:** Plan required invalid filter values return 400/422, but paginate helper silently ignored unknown values if not validated before query
- **Fix:** Call parse_type_filter/status_filter upfront in router and map ValueError to HTTPException 422, plus Query validation for size/page 422
- **Files modified:** `backend/app/routers/incidents.py`, `backend/app/utils/pagination.py`
- **Verification:** `pytest test_invalid_type_422` and `test_invalid_status_422` now pass 422; manual GET ?type=Invalid returns 422 with allowed values message
- **Committed in:** `2235330`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both essential for correctness and security — BYTEA lazy load would re-introduce OOM risk, and silent filter ignore would violate API contract. No scope creep.

## Issues Encountered

- Windows Docker Desktop asyncpg host networking still broken — host tests use sqlite file fallback `watchbug_test.db`, real PG verified via docker network in prior plans; conftest already handles fallback so 65 tests pass on host
- Initial unauth list appeared to return 200 due to httpx AsyncClient cookie jar auto-persisting login cookie across requests; fixed test by using fresh client for unauth assertions — verified unauth fresh returns 401
- Size 101 returns 422 via FastAPI Query(le=100) automatic validation — confirmed with `GET ?size=101` returns detail loc query.size

## User Setup Required

None - no external service configuration required. For local dev: ensure `backend/.env` has `DOCS_ENABLED=false` for prod (docs 404) or `true` for dev; pagination defaults page=1 size=20 max 100 per D-09; filtering `?type=Bug,Feedback&status=Pending,In Progress` is cacheable/bookmarkable per D-10.

## Next Phase Readiness

- Panel (Phase 3) can consume `GET /api/incidents?page&size&type&status` with {items,total,page,size,pages} and PATCH status per D-09/D-12 — admin workflow Success Criteria 3-4 unblocked
- Auth verified on real retrieval flows (AUTH-03) via 401 before query builder, and BYTEA performance-safe list vs detail split proven
- No blockers for Phase 3; remaining concerns are single-worker in-memory limiter (documented --workers 1) and future STR-01 MinIO vs BYTEA decision deferred

---
*Phase: 02-backend-api*
*Completed: 2026-09-01*

## Self-Check: PASSED

- Files exist: backend/app/utils/pagination.py, backend/tests/test_incidents_list.py, backend/tests/test_incidents_status.py FOUND
- Commits exist: 2235330, cf0333c, 2f8f1c3 FOUND via git log --oneline
- Verification: `python -m pytest backend/tests -v` 65 passed; manual curl equivalents via httpx verify paginated filtered list, detail data URL match, patch Any->Any, unauth 401, health public, docs 404
