# Watchbug SDK

## What This Is

Open-source, self-hosted error reporting & visual feedback SDK for web applications. Developers inject a lightweight widget into their apps that captures bugs with visual screenshots, console logs, and environment metadata. A backend API receives and stores incidents, and a web admin panel lets teams manage and triage issues — all deployable via a single `docker-compose.yml`.

## Core Value

A lightweight, fully isolated widget that captures bugs with full visual context (screenshot + metadata) without breaking or leaking into the host application.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Client SDK widget injectable via single script tag, loads async without blocking main thread
- [ ] Widget fully isolated via Shadow DOM (mode: 'closed') — immune to host CSS/JS
- [ ] Single global entry point `window.Watchbug` — no prototype pollution
- [ ] Capture engine: screenshot (canvas), URL, User-Agent, screen resolution, JS console logs
- [ ] Canvas editor with drawing tools (pencil, arrows, text) for visual feedback
- [ ] Destructive pixel-level masking/blurring on canvas before Base64 encoding (no CSS overlays)
- [ ] Auto-sanitization: mask `input[type=password]`, `data-watchbug-sensitive`, credit card patterns
- [ ] SDK never sends host app cookies/tokens — only public `PROJECT_KEY`
- [ ] HTTP/JSON report payload sent to backend API
- [ ] Backend API (FastAPI/Python): incident ingestion, storage, retrieval
- [ ] Database: PostgreSQL for incident storage
- [ ] Admin panel (static SPA): incident listing, filter by type (Bug/Feedback), status management
- [ ] Panel authentication: credentials (user/password) or static token via `.env`, JWT sessions
- [ ] Self-hosted deployment: single `docker-compose.yml` for API, panel, DB
- [ ] Bundle ≤45 KB gzipped — verified in CI
- [ ] i18n: Widget and panel in English + Spanish
- [ ] All user fields sanitized against Stored XSS
- [ ] Rate limiting on `/api/incidents` per IP and project key
- [ ] CORS protection configured for authorized origins
- [ ] Zero secrets in code — `.env` only, `.env.example` committed

### Out of Scope

- Third-party integrations (Jira, GitHub Issues, Slack, Trello) — not core to error capture value
- Session replay / video recording (LogRocket/FullStory style) — high complexity, different product category
- AI-powered error analysis — premature before basic capture works
- Gamification or automatic resolution suggestions — distracting from core workflow
- SaaS subscription / payment processing / multi-tenancy — self-hosted only for v1
- OAuth2 third-party login (Google, GitHub, SSO) — email/password sufficient for v1

## Context

- **Ecosystem**: Error monitoring space (Sentry, Bugsnag, LogRocket) — Watchbug differentiates on self-hosted + visual feedback + lightweight
- **Target users**: Developers who want error visibility without sending data to third parties
- **Deployment model**: Single `docker-compose.yml` — zero external service dependencies
- **Security posture**: GDPR-conscious, no host credential leakage, destructive data masking

## Constraints

- **Bundle size**: SDK ≤45 KB gzipped — no heavy dependencies, async load required
- **Isolation**: Shadow DOM closed mode — zero CSS/JS leakage to/from host app
- **Self-hosted**: No managed cloud offering — all infra in user's docker-compose
- **Security**: Secure password hashing, JWT with short TTL, secure cookies — per mentorship pack
- **i18n**: English + Spanish from day one

## Key Decisions

Decisions are made during phase planning and logged here as they are confirmed.

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| | | |

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
*Last updated: 2026-08-29 after initialization*
