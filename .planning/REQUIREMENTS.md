# Requirements: Watchbug SDK

**Defined:** 2026-08-29
**Core Value:** A lightweight, fully isolated widget that captures bugs with full visual context (screenshot + metadata) without breaking or leaking into the host application.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### SDK Core

- [ ] **SDK-01**: Client SDK injectable via single `<script>` tag, loads async without blocking main thread
- [ ] **SDK-02**: Widget renders inside Shadow DOM (`mode: 'closed'`) — immune to host CSS/JS interference
- [ ] **SDK-03**: Single global entry point `window.Watchbug` with `init()` method — no prototype pollution
- [ ] **SDK-04**: SDK bundle ≤45 KB gzipped — verified in CI with `npm run check:size`
- [ ] **SDK-05**: All `fetch()` calls use `credentials: 'omit'` — never sends host app cookies/tokens
- [ ] **SDK-06**: i18n support — widget text available in English and Spanish
- [ ] **SDK-07**: Lighthouse performance score impact ≤2 points when SDK is injected on a test page

### Capture Engine

- [ ] **CAP-01**: Screenshot capture via Canvas API — viewport-only, max 1280px width, 500ms timeout
- [ ] **CAP-02**: Metadata collection — URL, User-Agent, screen resolution, viewport size, timestamp
- [ ] **CAP-03**: JavaScript console log capture — intercept `console.*` calls with redaction filter for secrets
- [ ] **CAP-06**: Incident type distinction — Bug reports require consoleLogs, Feedback reports allow sending without consoleLogs
- [ ] **CAP-04**: Auto-sanitization — mask `input[type=password]`, `data-watchbug-sensitive`, credit card patterns
- [ ] **CAP-05**: Event batching — queue events in memory with configurable flush interval, graceful degradation

### Canvas Editor

- [ ] **EDT-01**: Drawing tools — pencil (freehand), arrows, text annotations
- [ ] **EDT-02**: Destructive pixel masking — `getImageData()` → modify `Uint8ClampedArray` → `putImageData()` before Base64
- [ ] **EDT-03**: Masking is irreversible — no CSS overlays, pixels permanently altered in canvas before encoding

### Transport

- [ ] **TRN-01**: HTTP/JSON report payload — image (Base64 PNG) + metadata JSON sent to backend API
- [ ] **TRN-02**: Payload validation — client-side schema validation before send, retry on network failure
- [ ] **TRN-04**: Payload schema enforces `consoleLogs` required for type=Bug, optional for type=Feedback (CA-01)
- [ ] **TRN-03**: Consent API — `Watchbug.setConsent(boolean)` to control capture behavior per host app requirements

### Backend API

- [ ] **API-01**: FastAPI app with lifespan context manager, Pydantic Settings from `.env`
- [ ] **API-02**: Incident ingestion — `POST /api/incidents` accepts payload, validates schema, stores in PostgreSQL
- [ ] **API-03**: Incident retrieval — `GET /api/incidents` with pagination, filter by type (Bug/Feedback), status
- [ ] **API-04**: Status update — `PATCH /api/incidents/:id/status` (Pending → In Progress → Resolved)
- [ ] **API-05**: Health check endpoint — `GET /api/health` returns DB connection status

### Authentication

- [ ] **AUTH-01**: JWT authentication — login with email/password, short-lived token, HttpOnly cookie
- [ ] **AUTH-02**: Password hashing — bcrypt (never store plaintext)
- [ ] **AUTH-03**: Protected routes — all `/api/incidents/*` endpoints require valid JWT, return 401 otherwise
- [ ] **AUTH-04**: Logout — invalidate session, clear cookie

### Database

- [ ] **DB-01**: PostgreSQL schema — incidents table (id, type, status, payload JSONB, screenshot BYTEA, created_at, updated_at)
- [ ] **DB-02**: Users table — id, email, password_hash, created_at
- [ ] **DB-03**: Projects table — id, name, api_key (public, write-only), created_at
- [ ] **DB-04**: Alembic migrations — version-controlled schema changes

### Security

- [ ] **SEC-01**: CORS — configurable origin allowlist, block `null` origin, no wildcard on ingest endpoint
- [ ] **SEC-02**: Rate limiting — slowapi per IP + project key on `/api/incidents`
- [ ] **SEC-03**: XSS sanitization — all user fields sanitized before storage and rendering
- [ ] **SEC-04**: Payload size limit — 100KB max on API level
- [ ] **SEC-05**: Zero secrets in code — `.env` only, `.env.example` committed with documentation

### Admin Panel

- [ ] **PAN-01**: Static SPA — served from `api/static/panel/` via FastAPI
- [ ] **PAN-02**: Login form — email/password, redirects to incident list on success
- [ ] **PAN-03**: Incident listing — paginated table with columns: type, status, date, preview
- [ ] **PAN-04**: Filter bar — filter by type (Bug/Feedback), status (Pending/In Progress/Resolved)
- [ ] **PAN-05**: Incident detail view — full screenshot preview, metadata display, status management
- [ ] **PAN-06**: Responsive layout — works on desktop and tablet
- [ ] **PAN-07**: All user content rendered as escaped text — no raw HTML rendering

### Deployment

- [ ] **DEP-01**: Single `docker-compose.yml` — API + Panel + PostgreSQL, one-command startup
- [ ] **DEP-02**: Multi-stage Dockerfile — Node builder for panel → Python production image
- [ ] **DEP-03**: Named Docker volume — PostgreSQL data persistence, documented `-v` behavior
- [ ] **DEP-04**: `.env.example` — all required environment variables documented
- [ ] **DEP-05**: PostgreSQL version pinned — specific minor version to prevent upgrade breakage

### Testing & Verification

- [ ] **TST-01**: Unit tests — coverage on date formatters, canvas pixel matrix manipulation, i18n formatters (`npm run test:unit`)
- [ ] **TST-02**: Integration tests — strict JSON schema validation of incident payload on `/api/incidents` (`npm run test:integration`)
- [ ] **TST-03**: E2E tests — inject SDK in HTML with aggressive CSS (`* { display: none !important; }`) and verify widget is functional (`npm run test:e2e`)
- [ ] **TST-04**: Bundle size check — build fails if SDK exceeds 45 KB gzipped (`npm run check:size`)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Network Capture

- **NET-01**: Intercept fetch/XHR requests — capture API call failures with URL, method, status
- **NET-02**: Network request timing — show latency for failed requests

### Breadcrumbs

- **BRD-01**: User action breadcrumbs — track click/navigation events preceding error
- **BRD-02**: Configurable breadcrumb depth — let developers control how many events to retain

### Notifications

- **NTF-01**: Email notifications — alert team on new high-severity incidents
- **NTF-02**: Webhook notifications — POST to configurable URL on incident creation

### Error Intelligence

- **INT-01**: Error grouping — fingerprint by exception type + stack trace hash
- **INT-02**: Duplicate detection — collapse similar errors into single incident

### Storage Scaling

- **STR-01**: Filesystem/MinIO storage — migrate screenshots from BYTEA to object storage at scale
- **STR-02**: Image compression — WebP conversion for storage efficiency

## Out of Scope

| Feature | Reason |
|---------|--------|
| Session replay / video recording | Different product category (LogRocket/FullStory), would bloat SDK |
| AI-powered error analysis | Premature before basic capture is validated |
| Third-party integrations (Jira, Slack, GitHub) | Scope creep — core value is capture, not integration |
| OAuth2/SSO login | Complexity not justified for v1 self-hosted audience |
| Multi-tenancy / SaaS | Self-hosted only — different architecture entirely |
| Real-time WebSocket updates | Polling sufficient for admin panel use case |
| Custom dashboards / analytics | Distraction from core incident management workflow |
| Gamification | Not utility-focused — wrong product category |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SDK-01 | Phase 1 | Pending |
| SDK-02 | Phase 1 | Pending |
| SDK-03 | Phase 1 | Pending |
| SDK-04 | Phase 1 | Pending |
| SDK-05 | Phase 1 | Pending |
| SDK-06 | Phase 1 | Pending |
| SDK-07 | Phase 1 | Pending |
| CAP-01 | Phase 1 | Pending |
| CAP-02 | Phase 1 | Pending |
| CAP-03 | Phase 1 | Pending |
| CAP-04 | Phase 1 | Pending |
| CAP-05 | Phase 1 | Pending |
| CAP-06 | Phase 1 | Pending |
| EDT-01 | Phase 1 | Pending |
| EDT-02 | Phase 1 | Pending |
| EDT-03 | Phase 1 | Pending |
| TRN-01 | Phase 1 | Pending |
| TRN-02 | Phase 1 | Pending |
| TRN-03 | Phase 1 | Pending |
| TRN-04 | Phase 2 | Pending |
| API-01 | Phase 2 | Pending |
| API-02 | Phase 2 | Pending |
| API-03 | Phase 2 | Pending |
| API-04 | Phase 2 | Pending |
| API-05 | Phase 2 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| DB-01 | Phase 2 | Pending |
| DB-02 | Phase 2 | Pending |
| DB-03 | Phase 2 | Pending |
| DB-04 | Phase 2 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| SEC-03 | Phase 2 | Pending |
| SEC-04 | Phase 2 | Pending |
| SEC-05 | Phase 2 | Pending |
| PAN-01 | Phase 3 | Pending |
| PAN-02 | Phase 3 | Pending |
| PAN-03 | Phase 3 | Pending |
| PAN-04 | Phase 3 | Pending |
| PAN-05 | Phase 3 | Pending |
| PAN-06 | Phase 3 | Pending |
| PAN-07 | Phase 3 | Pending |
| DEP-01 | Phase 4 | Pending |
| DEP-02 | Phase 4 | Pending |
| DEP-03 | Phase 4 | Pending |
| DEP-04 | Phase 4 | Pending |
| DEP-05 | Phase 4 | Pending |
| TST-01 | Phase 1 | Pending |
| TST-02 | Phase 2 | Pending |
| TST-03 | Phase 1 | Pending |
| TST-04 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 55
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-29*
*Last updated: 2026-08-29 — added SDK-07, CAP-06, TRN-04, TST-01..04 to close gaps with mission brief and mentorship pack*
