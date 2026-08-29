# Project Research Summary

**Project:** Watchbug SDK
**Domain:** Self-hosted error reporting & visual feedback SDK
**Researched:** 2026-08-29
**Confidence:** HIGH

## Executive Summary

Watchbug is a self-hosted error reporting and visual feedback SDK that combines two capabilities most tools treat separately: error tracking (like Sentry) and visual annotation (like Marker.io). The product injects a lightweight widget into web apps that captures screenshots with canvas-based annotations, console logs, and environment metadata, then sends them to a FastAPI backend for storage and triage via a static admin panel. The entire stack runs in a single `docker-compose.yml` with PostgreSQL as the only database dependency.

The recommended approach uses TypeScript (tsup bundler) for the client SDK targeting ≤45 KB gzipped, Python/FastAPI for the backend with SQLAlchemy async and Pydantic v2 validation, and a vanilla JS/TS static SPA for the admin panel. Research across four parallel investigations (stack, features, architecture, pitfalls) converges on the same conclusion: the critical path is getting the SDK's Shadow DOM isolation, destructive canvas masking, and secure transport layer right from day one — these are security invariants that cannot be retrofitted.

The top risks are: (1) Shadow DOM `closed` mode creates a debugging and accessibility black hole that must be mitigated with ARIA attributes and a debug API, (2) canvas screenshot capture can cause memory explosions on complex pages without viewport capping and blob-based encoding, and (3) CSS overlay masking (a common mistake) silently leaks sensitive data through `toDataURL()`. All three are addressable with correct patterns applied from Phase 1. The project has no major architectural unknowns — the patterns are well-documented and the technology choices are proven.

## Key Findings

### Recommended Stack

The stack research (confidence: HIGH) identifies mature, well-supported technologies with clear rationale for each choice. The client SDK uses TypeScript 5.5+ with tsup 8.x for bundling (esbuild-powered, zero-config, 3M weekly downloads), producing IIFE+ESM dual output. The backend uses FastAPI 0.141.x with Pydantic v2, SQLAlchemy 2.0 async (asyncpg driver), and Alembic for migrations. Authentication uses PyJWT (not python-jose, which has known CVEs) with bcrypt for password hashing. Rate limiting uses slowapi with in-memory backend (no Redis dependency for self-hosted v1). Testing uses pytest + pytest-playwright for E2E (Playwright auto-pierces Shadow DOM, unlike Cypress). Linting uses Ruff (replaces Flake8+Black+isort, 10-100x faster). Package management uses uv (replaces pip+venv).

**Core technologies:**
- **TypeScript 5.5+ / tsup 8.x:** Client SDK language and bundler — type safety for Shadow DOM components, zero-config ESM+CJS output with .d.ts generation
- **FastAPI 0.141.x:** Backend API — async Python with auto-generated OpenAPI docs, Pydantic v2 validation, dependency injection
- **PostgreSQL 16-alpine:** Primary database — relational integrity for incidents, JSONB for flexible metadata, minimal Docker image
- **SQLAlchemy 2.0+ async (asyncpg):** ORM — non-blocking DB access, `AsyncSession` with dependency injection
- **PyJWT 2.9+:** JWT tokens — actively maintained, no CVEs (unlike python-jose)
- **slowapi 0.1.9+:** Rate limiting — in-memory backend, no Redis needed for self-hosted
- **Playwright 1.62+:** E2E testing — auto-pierces Shadow DOM, Chromium/Firefox/WebKit support

### Expected Features

The features research (confidence: HIGH) defines a clear MVP scope with 17 table-stakes features, 6 differentiators, and 8 anti-features to explicitly avoid.

**Must have (table stakes) — 17 features for v1 launch:**
- Error capture with metadata (URL, UA, screen resolution) — standard across all competitors
- Console log capture — developers need preceding JS errors/warnings
- Screenshot capture — visual context is table stakes for feedback tools
- Canvas annotation tools (draw, arrow, text) — users need to visually point at bugs
- Privacy masking/redaction tool — GDPR compliance requires pixel-level redaction
- Auto-sanitization of sensitive inputs — password fields, credit cards masked automatically
- Incident listing with type filter (Bug/Feedback) — standard CRUD + filter
- Status workflow (Pending/In Progress/Resolved) — Kanban-style lifecycle tracking
- Authentication (JWT sessions) — panel must be protected
- Self-hosted deployment — single docker-compose.yml (core value prop)
- Framework-agnostic SDK — works with any web app, not just React/Vue
- Async non-blocking script load — cannot block main thread
- SDK bundle ≤45 KB gzipped — lightweight footprint key differentiator
- Error grouping/fingerprinting — collapse duplicate errors into single issues
- i18n (English + Spanish) — required from day one per project requirements
- CORS protection — security baseline for API
- Rate limiting — prevent abuse on /api/incidents endpoint

**Should have (differentiators) — unique competitive advantages:**
- Destructive canvas masking (pixel-level) — GDPR compliance competitors don't offer; pixels permanently altered before Base64
- Self-hosted with zero external deps — only Sentry offers self-hosting but requires Kafka+ClickHouse (16GB RAM); Watchbug uses Postgres only
- Shadow DOM closed mode isolation — widget immune to host CSS/JS attacks
- Visual feedback + error tracking in one — most tools do ONE; Watchbug does BOTH
- PROJECT_KEY (public, write-only) — SDK never needs admin secrets, safer than DSN approach
- Canvas editor with drawing tools — built into widget, not separate tool

**Defer to v1.x (after validation):** Network request capture, error grouping improvements, breadcrumbs, offline support, email notifications, search/filter improvements

**Explicitly exclude (anti-features):** Session replay (bundle bloat), AI error analysis (premature), third-party integrations (scope creep), OAuth2/SSO (complexity), multi-tenancy/SaaS (different architecture), real-time WebSocket (polling sufficient), custom dashboards (distraction), gamification (not utility)

### Architecture Approach

The architecture research (confidence: HIGH) defines a layered system with clear component boundaries and five documented patterns. The client SDK lives inside a Shadow DOM custom element (`mode: 'closed'`) with four internal modules: Widget (UI entry), Capture Engine (screenshot + metadata), Canvas Editor (drawing + masking), and Event Batcher (queue + flush). The backend follows FastAPI's "bigger applications" pattern with routers (HTTP concerns), services (business logic), models (SQLAlchemy), and schemas (Pydantic). The admin panel is a separate SPA that builds into `api/static/panel/` via Docker multi-stage build.

**Major components:**
1. **Client SDK (watchbug/sdk/):** Injectable widget with Shadow DOM isolation, screenshot capture via Canvas API, canvas editor with pencil/arrow/text tools, destructive pixel masking, event batching, HTTP transport
2. **Backend API (watchbug/api/):** FastAPI app with CORS middleware, rate limiter (slowapi), JWT auth dependency, incident CRUD routers, service layer, SQLAlchemy async database layer
3. **Admin Panel (watchbug/panel/):** Static SPA with incident listing, filter bar (Bug/Feedback/Status), detail view with image preview, login form, state management
4. **Shared Core (watchbug/core/):** TypeScript interfaces shared SDK↔API, Python constants, i18n JSON files (en/es)
5. **Docker Orchestration:** Single docker-compose.yml with API + Panel + PostgreSQL, multi-stage Dockerfile (Node builder → Python production)

**Key patterns:**
- Shadow DOM `mode: 'closed'` with `adoptedStyleSheets` for isolation (INV-01)
- Destructive canvas pixel masking via `getImageData()`/`putImageData()` — never CSS overlays (SEC-02)
- Event batching with in-memory queue and configurable flush (graceful degradation)
- FastAPI `Depends()` for auth injection (testable, clean separation)
- Docker multi-stage build (Node panel builder → Python production image, 60-72% size reduction)

### Critical Pitfalls

The pitfalls research (confidence: HIGH) identifies 10 pitfalls mapped to specific phases, with 8 technical debt patterns, 8 integration gotchas, 5 performance traps, 7 security mistakes, and 5 UX pitfalls.

1. **Shadow DOM closed mode breaks debugging and accessibility** — `mode: 'closed'` makes widget invisible to DevTools and screen readers. Mitigate with `__DEBUG__` flag for development, ARIA attributes for accessibility, and `window.Watchbug.inspect()` API. Address in Phase 1 (SDK Core).

2. **Canvas screenshot memory explosion on large pages** — 1920×1080 screenshot = ~8MB raw pixel data, ~14MB after Base64. Causes tab freezes, tainted canvas errors, OOM on mobile. Mitigate with viewport-only capture, max 1280px width, `toBlob()` instead of `toDataURL()`, 500ms timeout. Address in Phase 2 (Capture Engine).

3. **Destructive canvas masking applied to wrong layer** — CSS overlays look identical to pixel blur but `toDataURL()` reads the original unmasked bitmap. Sensitive data leaks in cleartext. Must use `getImageData()` → modify `Uint8ClampedArray` → `putImageData()`. Address in Phase 2 (Capture Engine).

4. **SDK captures console logs containing secrets** — Host apps log API keys, JWT tokens, connection strings. SDK intercepts all `console.*` calls indiscriminately. Mitigate with redaction filter on sensitive patterns (password, secret, token, api_key, Bearer, credit card regexes), truncate at 500 chars, disable `console.dir()`/`console.table()`. Address in Phase 2 (Capture Engine).

5. **SDK sends host app cookies and tokens** — `fetch()` includes credentials by default for same-origin requests. Host app session cookies leak to Watchbug backend. Mitigate with `credentials: 'omit'` on all SDK fetch calls. Address in Phase 1 (SDK Core).

6. **CORS wildcard on ingest endpoint enables abuse** — `Access-Control-Allow-Origin: *` allows DDoS, data exfiltration, cost amplification. Mitigate with configurable origin allowlist, rate limiting per IP + project key, block `null` origin. Address in Phase 3 (Backend API).

7. **Docker Compose DB volume not persisting data** — Anonymous volumes or `docker compose down -v` loses PostgreSQL data. Mitigate with named volumes, document that `-v` destroys data, pin PostgreSQL image to specific minor version. Address in Phase 4 (Deployment).

8. **Stored XSS via incident payload** — Malicious payloads with `<script>` in console notes rendered as raw HTML in admin panel. Mitigate with strict Pydantic models (`extra='forbid'`), sanitize all string fields, max field lengths, escape user content in panel rendering. Address in Phase 3 (Backend API).

## Implications for Roadmap

Based on combined research, the recommended phase structure follows a bottom-up dependency chain: database schema → backend API → client SDK → admin panel → deployment. Each phase builds on the previous one's output, with the API contract (schemas) as the central coordination point.

### Phase 1: SDK Core (Widget + Isolation + Transport)
**Rationale:** The SDK is the primary deliverable and has the most architectural risk (Shadow DOM isolation, destructive masking, bundle size). Building it first forces early resolution of the hardest problems. The API contract (schemas) can be defined alongside the SDK transport layer without requiring a running backend.

**Delivers:** Shadow DOM widget with closed mode, error capture engine, canvas editor (pencil/arrow/text), destructive pixel masking, auto-sanitization, event batcher, HTTP transport, i18n (en/es), bundle ≤45 KB gzipped, `window.Watchbug.init()` public API, consent API (`Watchbug.setConsent()`).

**Addresses:** Error capture with metadata, console log capture, screenshot capture, canvas annotation tools, privacy masking/redaction, auto-sanitization, framework-agnostic SDK, async non-blocking load, SDK bundle ≤45KB, i18n, `credentials: 'omit'` on all fetch calls.

**Avoids:** Shadow DOM closed mode debugging/accessibility pitfall (add `__DEBUG__` flag, ARIA attributes, inspect API), canvas memory explosion (viewport capping, `toBlob()`, 500ms timeout), destructive masking on wrong layer (getImageData/putImageData, not CSS), console log secret capture (redaction filter), SDK sending host credentials (`credentials: 'omit'`), PII capture without consent (consent API).

**Research flags:** Low — Shadow DOM patterns and Canvas API are well-documented. Main risk is bundle size budget (45KB) requiring careful dependency selection.

### Phase 2: Backend API (Ingestion + Storage + Auth)
**Rationale:** The backend depends on the incident payload schema defined in Phase 1. Building it second provides the storage and retrieval layer that the admin panel will consume. Auth (JWT + bcrypt) must be in place before the panel works.

**Delivers:** FastAPI app with lifespan context manager, Pydantic Settings from `.env`, incident ingestion endpoint (`POST /api/incidents`), incident retrieval with pagination and filters (`GET /api/incidents`), status update (`PATCH /api/incidents/:id/status`), JWT authentication (login/logout), bcrypt password hashing, CORS configuration, rate limiting (slowapi), SQLAlchemy async models (incidents, users, projects), Alembic migrations, health check endpoint, XSS sanitization on all string fields, payload size limits (100KB max).

**Addresses:** Error capture with metadata (storage), status workflow (Pending/In Progress/Resolved), authentication (JWT sessions), CORS protection, rate limiting, error grouping/fingerprinting.

**Avoids:** CORS wildcard abuse (configurable allowlist, block null origin), stored XSS (strict Pydantic models, sanitize strings, escape in panel), no payload size limits (100KB max at API level), no rate limiting (slowapi per IP + project key).

**Research flags:** Low — FastAPI patterns are well-documented. Main decision: screenshot storage as BYTEA (v1) vs filesystem/MinIO (v2+).

### Phase 3: Admin Panel (SPA)
**Rationale:** The panel is a consumer of the API built in Phase 2. It depends on auth being in place and API endpoints being defined. Building it third allows the full user workflow to be validated.

**Delivers:** Static SPA served from `api/static/panel/`, login form, incident listing with pagination, filter bar (Bug/Feedback/Status), incident detail view with image preview, status management (Pending/In Progress/Resolved), responsive layout, all user-generated content rendered as escaped text (no raw HTML).

**Addresses:** Incident listing with type filter, status workflow, self-hosted deployment (panel served as static files).

**Avoids:** Stored XSS in panel rendering (escape all user content, CSP headers), no admin panel auth bypass (JWT required for all endpoints).

**Research flags:** Low — vanilla JS/TS SPA patterns are straightforward. Main risk: CSS for responsive layout without a framework.

### Phase 4: Docker + Deployment
**Rationale:** Docker orchestration ties everything together and must come last since it depends on all components being built. Multi-stage Dockerfile builds the panel in Node, then copies output to Python production image.

**Delivers:** `docker-compose.yml` (API + Panel + PostgreSQL), multi-stage Dockerfile, named volume for PostgreSQL data, health checks, `.env.example` with documented variables, deployment documentation, PostgreSQL version pinning, data persistence verification.

**Addresses:** Self-hosted deployment (single docker-compose.yml), database persistence.

**Avoids:** Docker data loss (named volumes, document `-v` behavior), PostgreSQL version upgrade breakage (pin to specific minor version), Docker Compose networking issues (use service names, internal bridge network).

**Research flags:** Low — Docker Compose patterns are well-established. Main risk: multi-stage build optimization for image size.

### Phase Ordering Rationale

- **Bottom-up dependency chain:** Each phase depends on the output of the previous one. DB schema → API → Panel → Docker. SDK can be built in parallel with the API once the contract (schemas) is defined.
- **Security-first approach:** Phases 1-2 establish the security invariants (Shadow DOM isolation, destructive masking, credential filtering, CORS, rate limiting, XSS sanitization) before any user-facing deployment.
- **Risk mitigation:** The hardest problems (Shadow DOM isolation, bundle size budget, destructive masking) are tackled in Phase 1 when the codebase is smallest and easiest to change.
- **Pitfall avoidance:** Each phase explicitly addresses the pitfalls mapped to it in the PITFALLS research, with verification steps built into the phase output.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (SDK Core):** Bundle size budget analysis — evaluate html2canvas vs dom-to-image vs custom Canvas API solution to stay under 45KB; Shadow DOM accessibility patterns for screen reader support
- **Phase 2 (Backend API):** BYTEA vs filesystem storage decision for screenshots at scale; Alembic migration strategy for schema evolution

Phases with standard patterns (skip research-phase):
- **Phase 3 (Admin Panel):** Well-documented vanilla SPA patterns, no framework overhead
- **Phase 4 (Docker):** Standard Docker Compose + multi-stage build patterns, well-established best practices

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are mature, well-documented, and have clear rationale for selection. Version compatibility matrix verified. Alternatives considered and rejected with documented reasons. |
| Features | HIGH | Comprehensive competitor analysis (Sentry, Bugsnag, Marker.io, GlitchTip). Clear priority matrix (P1/P2/P3). Anti-features explicitly excluded with rationale. MVP definition is tight and achievable. |
| Architecture | HIGH | Standard layered architecture with well-documented patterns. Component boundaries are clear. Data flow is fully traced. Build order is logical and dependency-driven. |
| Pitfalls | HIGH | 10 critical pitfalls mapped to specific phases with prevention strategies. Technical debt patterns documented. Integration gotchas identified. "Looks done but isn't" checklist provided. |

**Overall confidence:** HIGH

### Gaps to Address

- **html2canvas vs alternative:** The SDK needs a DOM-to-canvas library. html2canvas is the default choice but has CSP issues and bundle size concerns. Evaluate dom-to-image and custom Canvas API solutions during Phase 1 planning. Constraint: must stay under 45KB total bundle.
- **Screenshot storage at scale:** BYTEA works for v1 (0-1000 incidents/day) but hits performance walls at 1K+ incidents/day. The decision to move to filesystem/MinIO is deferred to v1.x. Document the migration path in Phase 2.
- **Admin panel framework:** The research specifies "vanilla JS/TS" but doesn't choose a specific approach (pure DOM manipulation, lit-html, preact, etc.). This decision should be made during Phase 3 planning based on bundle size and developer experience constraints.
- **Canvas editor UX:** The research defines the tools (pencil, arrows, text) but not the interaction model (toolbar placement, undo/redo, color picker). UX design decisions should be made during Phase 1 planning with user testing.
- **Error grouping algorithm:** The research specifies "fingerprinting by exception type + stack trace hash" but the exact algorithm (what to include in the hash, how to handle minified stacks) needs implementation-level design during Phase 2.

## Sources

### Primary (HIGH confidence)
- tsup official docs (https://tsup.egoist.dev/) — bundler configuration, ESM/CJS output
- FastAPI Documentation (https://fastapi.tiangolo.com/) — async patterns, middleware, CORS, SQL databases
- SQLAlchemy 2.0 Documentation — async sessions, AsyncSession patterns
- Playwright Python Documentation — Shadow DOM piercing, E2E testing patterns
- MDN Web Docs: Shadow DOM (https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) — closed mode, adoptedStyleSheets
- MDN Web Docs: Canvas pixel manipulation — getImageData/putImageData patterns
- PyJWT Documentation — JWT creation/verification, algorithm selection
- slowapi GitHub (https://github.com/laurentS/slowapi) — in-memory rate limiting for FastAPI

### Secondary (MEDIUM confidence)
- PkgPulse: Best TypeScript Build Tools 2026 — tsup vs Rollup vs esbuild comparison
- FastAPI Best Practices (ofershap) — async patterns, Depends(), Pydantic v2
- PyJWT vs python-jose (StackShare) — CVE analysis, maintenance status
- Docker Multi-Stage Build Guide — 60-72% image size reduction patterns
- PostgreSQL JSONB Best Practices (AWS) — indexing, GIN indexes, query patterns
- AuditBuffet Pattern Catalog — secrets in error messages
- OWASP: Testing CORS — origin validation patterns

### Tertiary (LOW confidence)
- DevToolLab "Best Sentry Alternatives 2026" — competitor feature comparison
- Blendbyte: Stack Traces and Personal Data GDPR — GDPR compliance for error reporting
- Controlled Rollout Systems: Bundle Size Optimization — tree-shaking SDK patterns
- Brie, BugSpotter, sjForge/feedback-widget SDK documentation — feature comparisons

---

*Research completed: 2026-08-29*
*Ready for roadmap: yes*
