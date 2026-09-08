# Watchbug SDK

## What This Is

Open-source, self-hosted error reporting & visual feedback SDK for web applications. Developers inject a lightweight widget into their apps that captures bugs with visual screenshots, console logs, and environment metadata. A backend API receives and stores incidents, and a web admin panel lets teams manage and triage issues — all deployable via a single `docker-compose.yml`.

## Core Value

A lightweight, fully isolated widget that captures bugs with full visual context (screenshot + metadata) without breaking or leaking into the host application.

## Current State

**Shipped:** v1.0 MVP (2026-09-08)
**Phases:** 4 phases, 14 plans, 54/55 requirements satisfied
**Tech stack:** TypeScript (SDK), Python/FastAPI (backend), PostgreSQL, Vite (panel), Docker
**Codebase:** ~4,900 LOC production code across SDK + backend + panel
**Bundle:** 8.85KB gzipped (81% under 45KB limit)
**Tests:** 117 unit + 6 E2E (SDK) | 65 pytest (backend) | 43 vitest (panel)
**Deployment:** Single `docker-compose up -d` starts full stack

### Known Issues (v2 backlog)
- Screenshot capture uses white placeholder (needs `html2canvas` or similar)
- ConsoleEntry schema has dual `args`/`message` fields (SDK sends `message`, backend originally expected `args`)
- No real-time updates (relies on localStorage events)
- Single uvicorn worker (slowapi in-memory constraint)
- TST-02 integration tests not implemented

## Requirements

### Validated

- ✓ Client SDK widget injectable via single script tag, loads async without blocking main thread — v1.0
- ✓ Widget fully isolated via Shadow DOM (mode: 'closed') — immune to host CSS/JS — v1.0
- ✓ Single global entry point `window.Watchbug` — no prototype pollution — v1.0
- ✓ Capture engine: screenshot (canvas), URL, User-Agent, screen resolution, JS console logs — v1.0
- ✓ Canvas editor with drawing tools (pencil, arrows, text) for visual feedback — v1.0
- ✓ Destructive pixel-level masking/blurring on canvas before Base64 encoding (no CSS overlays) — v1.0
- ✓ Auto-sanitization: mask `input[type=password]`, `data-watchbug-sensitive`, credit card patterns — v1.0
- ✓ SDK never sends host app cookies/tokens — only public `PROJECT_KEY` — v1.0
- ✓ HTTP/JSON report payload sent to backend API — v1.0
- ✓ Backend API (FastAPI/Python): incident ingestion, storage, retrieval — v1.0
- ✓ Database: PostgreSQL for incident storage — v1.0
- ✓ Admin panel (static SPA): incident listing, filter by type (Bug/Feedback), status management — v1.0
- ✓ Panel authentication: JWT sessions with HttpOnly cookies — v1.0
- ✓ Self-hosted deployment: single `docker-compose.yml` for API, panel, DB — v1.0
- ✓ Bundle ≤45 KB gzipped — verified in CI — v1.0
- ✓ i18n: Widget and panel in English + Spanish — v1.0
- ✓ All user fields sanitized against Stored XSS — v1.0
- ✓ Rate limiting on `/api/incidents` per IP and project key — v1.0
- ✓ CORS protection configured for authorized origins — v1.0
- ✓ Zero secrets in code — `.env` only, `.env.example` committed — v1.0

### Active

- [ ] Real DOM screenshot capture (replace white placeholder with html2canvas or similar)
- [ ] TST-02: Integration tests for strict JSON schema validation on /api/incidents
- [ ] Real-time incident updates (WebSocket or SSE)
- [ ] Multi-worker uvicorn support (shared rate limiter state)

### Out of Scope

- Third-party integrations (Jira, GitHub Issues, Slack, Trello) — not core to error capture value
- Session replay / video recording (LogRocket/FullStory style) — high complexity, different product category
- AI-powered error analysis — premature before basic capture works
- Gamification or automatic resolution suggestions — distracting from core workflow
- SaaS subscription / payment processing / multi-tenancy — self-hosted only
- OAuth2 third-party login (Google, GitHub, SSO) — email/password sufficient for self-hosted

## Context

- **Ecosystem**: Error monitoring space (Sentry, Bugsnag, LogRocket) — Watchbug differentiates on self-hosted + visual feedback + lightweight
- **Target users**: Developers who want error visibility without sending data to third parties
- **Deployment model**: Single `docker-compose.yml` — zero external service dependencies
- **Security posture**: GDPR-conscious, no host credential leakage, destructive data masking

## Constraints

- **Bundle size**: SDK ≤45 KB gzipped — no heavy dependencies, async load required
- **Isolation**: Shadow DOM closed mode — zero CSS/JS leakage to/from host app
- **Self-hosted**: No managed cloud offering — all infra in user's docker-compose
- **Security**: Secure password hashing, JWT with short TTL, secure cookies
- **i18n**: English + Spanish from day one

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Closed Shadow DOM with connectedCallback | jsdom throws in constructor; connectedCallback is safe lifecycle hook | ✓ Validated — widget fully isolated |
| canvas.toDataURL over html2canvas | html2canvas adds ~40KB; Canvas API is native and sufficient for viewport capture | ✓ Validated — 8.85KB bundle |
| credentials:'omit' on all SDK fetches | SEC-03: never leak host app cookies/tokens | ✓ Validated — zero credential leakage |
| bcrypt direct hashpw/gensalt, not passlib | passlib adds dependency layer with minimal benefit | ✓ Validated — secure password storage |
| html.escape + event-handler strip, not bleach | bleach adds heavy C dependency; stdlib sufficient for plain text fields | ✓ Validated — XSS prevented |
| Split CORS: allowlist admin vs open ingest | Admin needs credentials; ingest must be open for any SDK host | ✓ Validated — both policies work |
| Hash routing for panel SPA | Avoids server-side fallback configuration for static SPA at /panel subpath | ✓ Validated — shareable URLs |
| Vite base "./" for subpath mount | Panel served at /panel; absolute paths would break | ✓ Validated — assets load correctly |
| env_file required:false for compose | Developers may not have .env on first clone | ✓ Validated — compose config works |
| Single uvicorn worker | slowapi in-memory rate limiter requires single worker | ✓ Validated — no race conditions |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-08 after v1.0 milestone*
