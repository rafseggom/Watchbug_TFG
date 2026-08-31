# Phase 2: Backend API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 02-backend-api
**Areas discussed:** Auth & session transport, Incident ingest contract, Storage & retrieval shape, Security boundaries

---

## Auth & Session Transport

### Q1: How should the JWT be delivered to the browser after login?

| Option | Description | Selected |
|--------|-------------|----------|
| HttpOnly cookie only (Recommended) | Set-Cookie: HttpOnly, Secure, SameSite=Lax. JS cannot read token → XSS can't steal it. Panel fetches with credentials:include. | ✓ |
| Authorization header | Return {access_token} JSON, Panel stores in memory/localStorage and sends Bearer header. | |
| Both (cookie + header) | Cookie for Panel SPA, header for programmatic API clients. More flexibility but two code paths. | |

**User's choice:** HttpOnly cookie only (Recommended)
**Notes:** Aligns with mentorship SEC-06.

### Q2: What token lifetime strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| 15-30min + refresh (Recommended for prod) | Access 15min, refresh 7 days via second HttpOnly cookie. OWASP best practice but needs /auth/refresh endpoint. | ✓ (modified) |
| 24-hour single token | One JWT valid 24h, no refresh. Simplest for v1 self-hosted. | |
| 60-min with sliding | Token extends on each authenticated request if <5min left. | |

**User's choice:** First option but not 15min but 1hour + refresh — access 1h, refresh 7 days
**Notes:** User explicitly negotiated 1h over 15min for reduced refresh frequency in self-hosted single-admin flow.

### Q3: Who is the admin user?

| Option | Description | Selected |
|--------|-------------|----------|
| Seeded DB user from .env (Recommended) | On startup, create/update users table row from ADMIN_EMAIL + ADMIN_PASSWORD_HASH (.env). bcrypt. | ✓ |
| Env-only check, no users table | POST /api/auth/login simply compares against .env values, no DB write. | |
| Register endpoint | First user can POST /api/auth/register to create admin. Flexible but adds open registration surface. | |

**User's choice:** Seeded DB user from .env (Recommended)
**Notes:** Supports future multi-user without schema change; idempotent startup hook.

### Q4: Logout behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Clear cookie only (Recommended) | POST /auth/logout deletes Set-Cookie (Max-Age=0). Simple, no state. | ✓ |
| Blacklist in DB/memory | Store jti in denylist table until expiry, check on each request. Immediate revocation but adds DB lookup. | |
| Short expiry only, no logout | No logout endpoint — just expire in 1h. | |

**User's choice:** Clear cookie only (Recommended)

---

## Incident Ingest Contract

### Q1: Who is allowed to POST /api/incidents?

| Option | Description | Selected |
|--------|-------------|----------|
| Public + PROJECT_KEY (Recommended) | Checks X-Project-Key against projects.api_key. No JWT required. Admin retrieval still needs JWT. | ✓ |
| JWT-only | SDK would need admin JWT to post — breaks isolated SDK flow. | |
| Public anonymous, no key | Accept any POST, no verification. Anyone can spam. | |

**User's choice:** Public + PROJECT_KEY (Recommended)

### Q2: Payload validation & error shape

| Option | Description | Selected |
|--------|-------------|----------|
| 422 + field details (Recommended) | FastAPI/Pydantic auto 422 with {detail: [{loc, msg, type}]}. | ✓ |
| 400 generic | Any validation failure → 400 {error: "invalid payload"}. | |
| 200 with errors array | Always 200, body {success:false, errors:[...]}. Never use HTTP error codes. | |

**User's choice:** 422 + field details (Recommended)

### Q3: Success response after POST

| Option | Description | Selected |
|--------|-------------|----------|
| 201 {id, status} (Recommended) | 201 Created JSON {id: uuid, status: "Pending", created_at}. | ✓ |
| 204 No Content | Empty success, minimal bandwidth but loses id. | |
| 200 echo payload | Return full stored incident. Heavier. | |

**User's choice:** 201 {id, status} (Recommended)

### Q4: Invalid PROJECT_KEY handling

| Option | Description | Selected |
|--------|-------------|----------|
| 401 missing/invalid key + 413 oversize (Recommended) | No/wrong X-Project-Key → 401 invalid project key. Body >100KB → 413. | ✓ |
| 403 for bad key | 401 for missing, 403 for wrong key (reveals existence). | |
| 404 hide existence | Any bad key → 404 to hide endpoint. | |

**User's choice:** 401 missing/invalid key + 413 oversize (Recommended)

---

## Storage & Retrieval Shape

### Q1: How should GET /api/incidents paginate?

| Option | Description | Selected |
|--------|-------------|----------|
| page/size + total (Recommended) | GET /api/incidents?page=1&size=20 → {items:[...], total, page, size, pages}. | ✓ |
| offset/limit cursor | ?limit=20&offset=40 | |
| Cursor pagination | ?cursor=<id>&limit=20 → {items, next_cursor}. Better for large datasets but overkill. | |

**User's choice:** page/size + total (Recommended)

### Q2: Filtering shape

| Option | Description | Selected |
|--------|-------------|----------|
| Query params (Recommended) | GET /incidents?type=Bug&status=Pending&page=1&size=20. Comma-separated for multiples. | ✓ |
| POST /incidents/query body | POST with JSON {type, status, page}. More expressive but breaks REST cacheability. | |
| Separate endpoints | GET /incidents/bugs , /incidents/feedback etc. | |

**User's choice:** Query params (Recommended)

### Q3: DB storage for screenshots

| Option | Description | Selected |
|--------|-------------|----------|
| BYTEA + JSONB per spec (Recommended) | incidents: id, type enum, status enum, payload JSONB, screenshot BYTEA, project_id FK. | ✓ |
| Text Base64 in JSONB | Store screenshot as Base64 string inside payload JSONB, no BYTEA. | |
| Filesystem volume now | Write PNG to disk / S3 from day one. Adds docker volume or MinIO complexity. | |

**User's choice:** BYTEA + JSONB per spec (Recommended)

### Q4: Status update transitions

| Option | Description | Selected |
|--------|-------------|----------|
| Any → Any (Recommended for v1) | Accept any of Pending/In Progress/Resolved in any order. | ✓ |
| Strict forward only | Pending → In Progress → Resolved only. 400 if backwards. | |
| Allow revert to Pending | Resolved can go back to In Progress/Pending, but not skip ahead. | |

**User's choice:** Any → Any (Recommended for v1)

---

## Security Boundaries

### Q1: CORS

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist from .env + ingest open (Recommended) | CORS_ORIGINS=.env comma list for admin. POST /api/incidents allows any Origin. | ✓ |
| Strict allowlist for all | Even ingest requires Origin in allowlist. Most secure but friction. | |
| Wildcard * for MVP | Allow * on all endpoints. Simplest but violates SEC-01. | |

**User's choice:** Allowlist from .env + ingest open (Recommended)

### Q2: Rate limiting

| Option | Description | Selected |
|--------|-------------|----------|
| 10/min ingest, 60/min admin (Recommended) | POST /api/incidents: 10/min per IP + 30/min per PROJECT_KEY; GET/PATCH: 60/min per IP. 429 with Retry-After. | ✓ |
| 5/min strict | Very conservative. | |
| 100/min lenient | Almost no throttling. | |

**User's choice:** 10/min ingest, 60/min admin (Recommended)

### Q3: XSS sanitization

| Option | Description | Selected |
|--------|-------------|----------|
| Sanitize before storage (Recommended) | Strip/escape HTML tags before writing to JSONB. Panel renders escaped text. | ✓ |
| Sanitize on render only | Store raw, escape in Panel when displaying. | |
| Both ingest + render | Double sanitize. Safest but may double-escape. | |

**User's choice:** Sanitize before storage (Recommended)

### Q4: Health check & admin surface

| Option | Description | Selected |
|--------|-------------|----------|
| Public health, docs under auth (Recommended) | GET /api/health public → {status, db}; /docs enabled only when DOCS_ENABLED=true. | ✓ |
| Health requires JWT | Everything auth-gated including health. | |
| Public everything | Health + docs always public. | |

**User's choice:** Public health, docs under auth (Recommended)

---

## Agent's Discretion

- Cookie names, Pydantic Settings env prefix, Alembic migration naming, slowapi key function, screenshot decode error code, JWT algorithm (HS256) — all deferred to agent.

## Deferred Ideas

None — discussion stayed within Phase 2 scope. v2 items (NTF-01/02 webhooks/email, STR-01 MinIO, INT-01/02 grouping, BRD-01/02 breadcrumbs, NET-01/02 network capture) remain tracked in REQUIREMENTS.md and not folded.
