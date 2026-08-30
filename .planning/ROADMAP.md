# Roadmap: Watchbug SDK

## Overview

Watchbug ships as four vertical slices: a client SDK that captures bugs with full visual context in complete isolation, a backend API that ingests and stores incidents with secure authentication, an admin panel that lets teams triage issues, and a Docker deployment that ties everything together with a single command. Each phase delivers a complete, verifiable capability that builds on the previous one.

## Phases

- [ ] **Phase 1: SDK Core** - Client widget with Shadow DOM isolation, capture engine, canvas editor, and transport
- [ ] **Phase 2: Backend API** - FastAPI ingestion, PostgreSQL storage, JWT auth, and security hardening
- [ ] **Phase 3: Admin Panel** - Static SPA for incident listing, filtering, detail view, and status management
- [ ] **Phase 4: Docker Deployment** - Single docker-compose.yml with multi-stage build and data persistence

## Phase Details

### Phase 1: SDK Core

**Goal**: Developers can inject a single script tag and capture bugs with screenshots, metadata, and console logs — fully isolated from the host application
**Depends on**: Nothing (first phase)
**Requirements**: SDK-01, SDK-02, SDK-03, SDK-04, SDK-05, SDK-06, SDK-07, CAP-01, CAP-02, CAP-03, CAP-04, CAP-05, CAP-06, EDT-01, EDT-02, EDT-03, TRN-01, TRN-02, TRN-03, TRN-04
**Success Criteria** (what must be TRUE):

  1. Developer can add `<script>` tag and call `window.Watchbug.init()` — widget loads asynchronously without blocking the host page
  2. Widget renders inside Shadow DOM (`mode: 'closed'`) — host CSS cannot break widget styling, host JS cannot access widget internals
  3. Developer can trigger a report that captures screenshot (via Canvas API), URL, User-Agent, screen resolution, and console logs
  4. Canvas editor allows drawing pencil annotations, arrows, and text on the screenshot
  5. Sensitive data (password fields, credit card patterns, `data-watchbug-sensitive` elements) is pixel-masked before Base64 encoding — masking is irreversible

**Plans:** 4/5 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Project scaffold + Shadow DOM widget + i18n foundation

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Capture engine: screenshot, metadata, console logs, batching

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Canvas editor with drawing tools and destructive pixel masking

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Transport layer: HTTP sender, validation, retry, consent API

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-05-PLAN.md — Build pipeline, bundle size check, E2E tests, final verification

### Phase 2: Backend API

**Goal**: Incidents captured by the SDK are securely ingested, stored in PostgreSQL, and retrievable with authenticated access
**Depends on**: Phase 1
**Requirements**: API-01, API-02, API-03, API-04, API-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, DB-01, DB-02, DB-03, DB-04, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):

  1. SDK can POST an incident payload (screenshot + metadata) to `/api/incidents` and receive a success response — data persists in PostgreSQL
  2. Admin can log in with email/password and receive a JWT token in an HttpOnly cookie
  3. Authenticated requests to `GET /api/incidents` return paginated results filterable by type (Bug/Feedback) and status
  4. Status can be updated via `PATCH /api/incidents/:id/status` (Pending → In Progress → Resolved)
  5. Unauthenticated requests to protected endpoints return 401; CORS blocks unauthorized origins; rate limiting prevents abuse on `/api/incidents`

**Plans**: TBD

### Phase 3: Admin Panel

**Goal**: Teams can log in, browse incidents with visual screenshots, filter and search, and manage issue status through a responsive web interface
**Depends on**: Phase 2
**Requirements**: PAN-01, PAN-02, PAN-03, PAN-04, PAN-05, PAN-06, PAN-07
**Success Criteria** (what must be TRUE):

  1. User can log in with email/password and is redirected to the incident list on success
  2. Incident list shows paginated table with type, status, date, and screenshot preview — filterable by Bug/Feedback and by status
  3. Clicking an incident opens detail view with full screenshot preview, metadata display, and status dropdown
  4. Status changes from the detail view persist to the backend and reflect in the list
  5. Panel works on desktop and tablet viewports; all user-generated content is rendered as escaped text (no raw HTML)

**Plans**: TBD
**UI hint**: yes

### Phase 4: Docker Deployment

**Goal**: The entire stack (API + Panel + PostgreSQL) starts with a single `docker-compose up` command and persists data across restarts
**Depends on**: Phase 3
**Requirements**: DEP-01, DEP-02, DEP-03, DEP-04, DEP-05
**Success Criteria** (what must be TRUE):

  1. `docker-compose up -d` starts API, Panel, and PostgreSQL — all services healthy and connected
  2. Multi-stage Dockerfile builds panel in Node stage, copies output to Python production image
  3. PostgreSQL data persists across `docker-compose down` / `docker-compose up` cycles via named volume
  4. `.env.example` documents all required environment variables — new deployment requires only copying to `.env` and filling values
  5. `docker-compose down -v` behavior is documented — developers understand this destroys data

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. SDK Core | 4/5 | In Progress|  |
| 2. Backend API | 0/TBD | Not started | - |
| 3. Admin Panel | 0/TBD | Not started | - |
| 4. Docker Deployment | 0/TBD | Not started | - |
