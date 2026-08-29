# Feature Research

**Domain:** Error Reporting & Visual Feedback SDK (Self-Hosted)
**Researched:** 2026-08-29
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Error capture with metadata** | Every error tracker captures URL, User-Agent, screen resolution | LOW | Standard across all competitors (Sentry, Bugsnag, GlitchTip) |
| **Console log capture** | Developers need to see JS errors/warnings that preceded the bug | LOW | Brie, BugSpotter, Marker.io all auto-capture console output |
| **Screenshot capture** | Visual context is table stakes for any feedback tool | MEDIUM | html2canvas or SnapDOM; must handle CSP and modern CSS |
| **Canvas annotation tools (draw, arrow, text)** | Users need to visually point at bugs | MEDIUM | Standard in Marker.io, Userback, SeggWat, Ybug |
| **Privacy masking/redaction tool** | GDPR compliance requires pixel-level redaction before sending | MEDIUM | Must be destructive (pixel alteration), not CSS overlay |
| **Auto-sanitization of sensitive inputs** | Password fields, credit cards must be masked automatically | LOW | data-watchbug-sensitive attribute, input[type=password] detection |
| **Incident listing with type filter** | Users need to separate bugs from feedback | LOW | Basic CRUD + filter by Bug/Feedback |
| **Status workflow (Pending/In Progress/Resolved)** | Teams need to track incident lifecycle | LOW | Standard Kanban-style workflow |
| **Authentication (JWT sessions)** | Panel must be protected | LOW | bcrypt/Argon2 + JWT short TTL + HttpOnly cookies |
| **Self-hosted deployment** | Core value prop — single docker-compose.yml | MEDIUM | API + Panel + PostgreSQL in one command |
| **Framework-agnostic SDK** | Must work with any web app, not just React/Vue | MEDIUM | Vanilla TS/JS with IIFE+ESM dual format |
| **Async non-blocking script load** | Performance is critical — cannot block main thread | LOW | Standard `<script async>` pattern |
| **SDK bundle ≤45 KB gzipped** | Lightweight footprint is a key differentiator | MEDIUM | Must verify in CI with bundlesize checks |
| **Error grouping/fingerprinting** | Duplicate errors must be collapsed into single issues | MEDIUM | Sentry-style fingerprinting by exception type + stack trace hash |
| **i18n (English + Spanish)** | Required from day one per project requirements | LOW | Widget + panel strings |
| **CORS protection** | Security baseline for API | LOW | Configure allowed origins |
| **Rate limiting** | Prevent abuse on /api/incidents endpoint | LOW | Per IP + project key |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Destructive canvas masking (pixel-level)** | GDPR compliance that competitors don't offer — pixels permanently altered before Base64 | HIGH | No CSS overlays; actual ImageData manipulation; irreversible |
| **Self-hosted with zero external deps** | Only Sentry offers self-hosting, but requires Kafka+ClickHouse (16GB RAM); Watchbug uses Postgres only | MEDIUM | Single docker-compose.yml, no Redis/Kafka overhead |
| **Shadow DOM closed mode isolation** | Widget immune to host CSS/JS attacks; host cannot break widget | MEDIUM | mode:'closed' — maximum isolation vs competitors using open shadow DOM |
| **Visual feedback + error tracking in one** | Most tools do ONE: Sentry=errors, Marker.io=visual feedback. Watchbug does BOTH | MEDIUM | Unique positioning in market |
| **PROJECT_KEY (public, write-only)** | SDK never needs admin secrets — safer than DSN approach | LOW | Simplifies integration, reduces secret exposure |
| **Canvas editor with drawing tools** | Pencil, arrows, text — built into widget, not separate tool | MEDIUM | Standard in visual feedback tools but NOT in error trackers |
| **Network request capture** | Fetch/XHR logging with timing and status codes | MEDIUM | Brie, BugSpotter, Marker.io offer this; Sentry has breadcrumbs |
| **Session breadcrumbs** | Timeline of user actions leading to error | HIGH | Lower priority than core capture; adds complexity |
| **User action tracking (clicks, inputs)** | Understand what user did before bug occurred | HIGH | Nice-to-have but increases bundle size significantly |
| **Offline support with queue** | Reports queued in IndexedDB, synced when online | MEDIUM | sjForge/feedback-widget offers this; good for mobile users |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Session replay (rrweb-style)** | "See exactly what happened" | Massive bundle size (rrweb alone is ~50KB), complex, different product category. PROJECT.md explicitly excludes. | Focus on screenshot + metadata capture; keep it lightweight |
| **AI error analysis** | "Auto-fix suggestions" | Premature before basic capture works. Requires ML infrastructure. | Defer to v2+ after product-market fit |
| **Third-party integrations (Jira, Slack, GitHub)** | "Connect to existing workflow" | Scope creep, maintenance burden, each integration is a separate project. PROJECT.md explicitly excludes. | Focus on core capture value; add integrations post-validation |
| **OAuth2/SSO login** | "Enterprise auth" | Complex to implement correctly, edge cases with token refresh. PROJECT.md excludes for v1. | Simple email/password + static token via .env |
| **Multi-tenancy / SaaS** | "Host for others" | Fundamentally different architecture (billing, data isolation, quotas). | Self-hosted only; each team runs own instance |
| **Real-time WebSocket updates** | "Live dashboard" | Adds connection management, reconnection logic, server load. | Polling-based refresh is sufficient for v1 |
| **Custom dashboards / analytics** | "Charts and metrics" | Distracts from core incident management workflow. | Simple counts/trends; defer complex analytics |
| **Gamification / auto-resolution** | "Make it fun" | Distracts from core workflow. PROJECT.md explicitly excludes. | None — focus on utility |

## Feature Dependencies

```
[Error Capture Engine]
    ├──requires──> [Screenshot Capture]
    ├──requires──> [Console Log Capture]
    ├──requires──> [Metadata Capture (URL, UA, Resolution)]
    ├──enhances──> [Network Request Capture]
    └──enhances──> [Breadcrumbs/Session Tracking]

[Canvas Editor]
    ├──requires──> [Screenshot Capture]
    ├──requires──> [Shadow DOM Isolation]
    └──requires──> [Destructive Masking Engine]

[Destructive Masking Engine]
    ├──requires──> [Canvas API]
    └──requires──> [ImageData manipulation]

[Incident Payload]
    ├──requires──> [Error Capture Engine]
    ├──requires──> [Canvas Editor (annotated screenshot)]
    └──requires──> [Auto-Sanitization]

[Backend API]
    ├──requires──> [Incident Payload Schema]
    ├──requires──> [PostgreSQL Schema]
    └──requires──> [Authentication]

[Admin Panel]
    ├──requires──> [Backend API]
    ├──requires──> [Authentication]
    └──requires──> [Incident Listing]

[Self-Hosted Deployment]
    ├──requires──> [Backend API]
    ├──requires──> [Admin Panel]
    └──requires──> [Docker Configuration]
```

### Dependency Notes

- **Error Capture Engine requires Screenshot Capture:** The core value is visual context — errors without screenshots are just log entries
- **Canvas Editor requires Shadow DOM Isolation:** The editor must be isolated from host CSS to function reliably
- **Destructive Masking requires Canvas API:** Must use ImageData manipulation, not CSS overlays, for true GDPR compliance
- **Backend API requires Incident Payload Schema:** API contract must be defined before backend implementation
- **Admin Panel requires Backend API:** Panel is a consumer of the API; cannot be built independently
- **Self-Hosted Deployment requires everything:** Docker-compose bundles API + Panel + Database

## MVP Definition

### Launch With (v1)

- [ ] **Client SDK widget** — injectable via single script tag, loads async, ≤45 KB gzipped
- [ ] **Shadow DOM isolation** — mode:'closed', immune to host CSS/JS
- [ ] **Error capture** — screenshot (canvas), URL, User-Agent, screen resolution, JS console logs
- [ ] **Canvas editor** — pencil, arrows, text annotation tools
- [ ] **Destructive masking** — pixel-level blur/redaction before Base64 encoding
- [ ] **Auto-sanitization** — mask input[type=password], data-watchbug-sensitive, credit card patterns
- [ ] **Backend API (FastAPI)** — incident ingestion, storage, retrieval with authentication
- [ ] **Admin panel (static SPA)** — incident listing, filter by type (Bug/Feedback), status management
- [ ] **JWT authentication** — bcrypt/Argon2 hashing, short TTL, HttpOnly cookies
- [ ] **Self-hosted deployment** — single docker-compose.yml
- [ ] **i18n** — English + Spanish
- [ ] **Security** — CORS, rate limiting, XSS sanitization, zero secrets in code

### Add After Validation (v1.x)

- [ ] **Network request capture** — fetch/XHR monitoring with timing — trigger: users ask "what API calls happened?"
- [ ] **Error grouping/fingerprinting** — collapse duplicate errors — trigger: users complain about noise
- [ ] **Breadcrumbs** — user action timeline — trigger: users need more context than screenshot provides
- [ ] **Offline support** — queue reports in IndexedDB — trigger: mobile/offline use cases emerge
- [ ] **Email notifications** — alert on new incidents — trigger: teams need proactive alerts
- [ ] **Search/filter improvements** — advanced query syntax — trigger: incident volume grows

### Future Consideration (v2+)

- [ ] **Session replay** — rrweb-style DOM replay — trigger: core capture is solid, users want more context
- [ ] **Third-party integrations** — Jira, Slack, GitHub Issues — trigger: workflow integration demand
- [ ] **AI error analysis** — auto-grouping, root cause suggestions — trigger: enough data to train models
- [ ] **Custom dashboards** — charts, trends, analytics — trigger: management wants reporting
- [ ] **Webhooks** — event-driven integrations — trigger: power users need automation
- [ ] **Multi-project support** — multiple apps in one instance — trigger: team adoption grows
- [ ] **User identification** — associate errors with logged-in users — trigger: debugging needs user context

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Error capture with metadata | HIGH | LOW | P1 |
| Screenshot capture | HIGH | MEDIUM | P1 |
| Canvas annotation tools | HIGH | MEDIUM | P1 |
| Destructive masking | HIGH | HIGH | P1 |
| Auto-sanitization | HIGH | LOW | P1 |
| Backend API | HIGH | MEDIUM | P1 |
| Admin panel | HIGH | MEDIUM | P1 |
| JWT authentication | HIGH | LOW | P1 |
| Self-hosted deployment | HIGH | MEDIUM | P1 |
| i18n | MEDIUM | LOW | P1 |
| Error grouping | HIGH | MEDIUM | P2 |
| Network request capture | MEDIUM | MEDIUM | P2 |
| Breadcrumbs | MEDIUM | HIGH | P2 |
| Offline support | MEDIUM | MEDIUM | P2 |
| Email notifications | MEDIUM | LOW | P2 |
| Session replay | HIGH | VERY HIGH | P3 |
| AI error analysis | MEDIUM | VERY HIGH | P3 |
| Third-party integrations | MEDIUM | HIGH | P3 |
| Custom dashboards | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Sentry | Bugsnag | Marker.io | GlitchTip | Watchbug (Planned) |
|---------|--------|---------|-----------|-----------|-------------------|
| Error tracking | ✅ Full | ✅ Full | ❌ | ✅ Sentry-compatible | ✅ Core |
| Screenshot capture | ✅ (Unity/mobile) | ❌ | ✅ Core | ❌ | ✅ Core |
| Visual annotation | ❌ | ❌ | ✅ Core | ❌ | ✅ Core |
| Canvas masking/redaction | ❌ | ❌ | ❌ | ❌ | ✅ Destructive pixel-level |
| Auto-sanitization | ✅ (PII scrubbing) | ✅ (redactedKeys) | ❌ | ❌ | ✅ (input/password/CC) |
| Self-hosted | ✅ (heavy: Kafka+ClickHouse) | ❌ | ❌ | ✅ (lightweight) | ✅ (Postgres only) |
| Console log capture | ✅ Breadcrumbs | ✅ Breadcrumbs | ✅ Auto | ❌ | ✅ Core |
| Network monitoring | ✅ Breadcrumbs | ✅ OkHttp plugin | ✅ Auto | ❌ | ✅ P2 |
| Session replay | ✅ Full | ❌ | ❌ | ❌ | ❌ Explicitly excluded |
| Error grouping | ✅ Advanced | ✅ Auto | ❌ | ✅ Basic | ✅ Fingerprinting |
| Status workflow | ✅ | ✅ | ❌ | ❌ | ✅ (Pending/In Progress/Resolved) |
| Authentication | ✅ SSO/OAuth | ✅ SSO/OAuth | ✅ Email/password | ✅ Email/password | ✅ JWT + static token |
| Bundle size | ~150KB+ | ~80KB+ | N/A (extension) | N/A (SDK compatible) | ≤45KB gzipped |
| License | FSL (converts to Apache) | Proprietary | Proprietary | MIT | Open Source |
| Framework support | Dozens | Dozens | Extension + SDK | Sentry SDK compatible | Framework-agnostic |

## Sources

- Sentry documentation and feature comparison articles (2026)
- Bugsnag release notes and feature pages (2026)
- Marker.io feature documentation and competitor analysis
- GlitchTip and Bugsink comparison articles (2026)
- Brie, BugSpotter, sjForge/feedback-widget SDK documentation
- Visual feedback tools: Userback, SeggWat, Ybug, BetterBugs
- GDPR compliance research: data masking techniques, PII sanitization
- DevToolLab "Best Sentry Alternatives 2026" comprehensive comparison
- Open source error tracking comparisons (OSSAlt, AlternativeTo)

---
*Feature research for: Watchbug SDK — Error Reporting & Visual Feedback*
*Researched: 2026-08-29*
