# Agent Instructions

> **This file is the entry point for any agent working on this project.**  
> Read it fully once. For detailed governing documents, see the referenced files in `documentation/`.

---

## Agentic Software Engineering (ASE) — How We Work

This project operates under the **ASE paradigm**. Every task must follow the **C-B-D-C** control framework.

### Core Axiom
> Producing code is not the bottleneck; trust, evidence, and intention alignment are.

**Rule Zero:** Never guess ambiguous intent or rush into writing code.

---

### The 4 Control Points (C-B-D-C)

| Phase | Action |
|-------|--------|
| **Contract** | Explicitly define goals, non-goals (*Declare the No*), constraints, and property-based acceptance criteria before editing code. |
| **Bound** | Respect scope boundaries, timeboxes, iteration limits, and file-access envelopes. |
| **Delegate with Evidence** | Execute with autonomy on the method, but always return a structured evidence pack (test logs, static analysis, benchmarks). |
| **Converge & Record** | Land verified changes, discard throwaway experiments, and update durable records. |

---

### Coordination Artifacts (Read These)

| Artifact | File | Purpose |
|----------|------|---------|
| **Mission Brief** | `documentation/mission-brief.md` | Task spec: Goal, Non-Goals, Plan, Autonomy Envelope, Acceptance Properties |
| **Mentorship Pack** | `documentation/mentorship-pack.md` | Institutional rules: architectural invariants, quality targets, security policies |
| **Workflow Runbook** | (TBD) | Executable SOP: step-by-step gates, commands, validation rules |
| **Continuity Pack** | `documentation/continuity-pack.md` | State across resets: progress, open questions, **dead-ends** (failed paths) |
| **Consultation Request Pack** | (output) | Generated when hitting autonomy limits: decision, options, trade-offs, evidence, recommendation |
| **Merge-Readiness Pack** | (output) | Generated on completion: scope-to-proof map, verification logs, change manifest, rollback plan |
| **Resolution Record** | (output) | Durable record of approved decisions and architectural trade-offs |

---

### Paradox Mitigation Rules (Guardrails)

| Paradox | Rule |
|---------|------|
| **Anti-Eagerness** | If under-specified: `Ask Before You Build`. Present draft Mission Brief; confirm before modifying files. |
| **Anti-Context Overload** | Keep active working sets minimal. Load-on-demand context cards. Invariants > formatting prefs. |
| **Anti-Tunnel Vision** | Validate global system properties, boundary interfaces, operational readiness—not just local file correctness. |
| **Anti-Amnesia** | Read **Continuity Pack** and **Resolution Records** at session start. Record rejected attempts in dead-ends log. |

---

### Standard Interaction Commands

| Command | Purpose |
|---------|---------|
| `MODE: PLAN` | Generate/update Mission Brief and Conceptual Plan. **Do not edit production code.** |
| `MODE: EXECUTE` | Implement within autonomy envelope; run deterministic checks. |
| `MODE: CONSULT` | Pause. Generate Consultation Request Pack for out-of-bounds decisions. |
| `MODE: CLOSEOUT` | Run full verification suites; generate Merge-Readiness Pack. |

---

## Project Overview (Watchbug SDK)

Open-source, self-hosted error reporting & visual feedback SDK. Injects a lightweight widget into web apps to capture issues with environment metadata. Backend API for ingestion/storage + web admin panel. Deployable via single `docker-compose.yml`.

**Stack:** Python 3.10 (FastAPI), vanilla JS/TS client SDK (≤45 KB gzipped), PostgreSQL, Docker.

---

## Architecture & Data Flow

```
Host App + Widget  ──HTTP/JSON──▶  Backend (FastAPI)  ──▶  Database (PostgreSQL)
                                     │
                                     ▼
                              Admin Panel (Static SPA)
```

**Key modules (planned):**
- `watchbug/sdk/` — Client SDK (widget, capture engine, Shadow DOM isolation)
- `watchbug/api/` — FastAPI backend (ingestion, auth, incidents CRUD)
- `watchbug/panel/` — Admin panel (SPA, served as static files)
- `watchbug/core/` — Shared schemas, utilities, i18n

---

## Invariants & Non-Negotiables (From Mentorship Pack)

> **Full details:** `documentation/mentorship-pack.md`

| Invariant | Requirement |
|-----------|-------------|
| **INV-01: Total Widget Isolation** | Shadow DOM (`mode: 'closed'`). Zero global CSS/JS leakage. |
| **INV-02: Clean Global Namespace** | Single `window.Watchbug` entry point. No prototype pollution. |
| **INV-03: Self-Hosted Containers** | Single `docker-compose.yml` for API, panel, DB. |
| **SEC-01: Auto-Sanitization** | Mask `input[type=password]`, `data-watchbug-sensitive`, card patterns. |
| **SEC-02: Destructive Canvas Masking** | Pixel alteration on `ImageData` before Base64 — no CSS overlays. |
| **SEC-03: No Host Credentials** | SDK never sends host app cookies/tokens. Only `PROJECT_KEY` (public). |
| **SEC-04: Zero Secrets in Code** | `.env` only. `.env.example` committed. |
| **SEC-05: XSS Sanitization + Rate Limiting** | All user fields sanitized. `/api/incidents` rate-limited per IP + key. |
| **SEC-06: Secure Auth** | bcrypt/Argon2. JWT short TTL, HttpOnly/SameSite/Secure cookies. |
| **RNF-01: Bundle ≤45 KB gzipped** | Async load, no main-thread blocking. |
| **RNF-02: Total Isolation** | Host CSS cannot break widget. |
| **RNF-03: i18n** | English + Spanish. |

---

## Consultation Triggers (Pause & Ask)

> **Full autonomy envelope:** `documentation/mission-brief.md#3`

Stop autonomous work and request human decision when:
- Changing public SDK init interface (`window.Watchbug.init()`)
- Adding deps that push SDK >45 KB gzipped
- Modifying Shadow DOM isolation strategy
- DB schema changes / migrations
- Choosing blob storage (FS vs S3/MinIO vs DB)
- Adding non-permissive licenses or uncertain GDPR edge cases

---

## Development Commands

```bash
# Setup
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Linting & formatting (Ruff)
ruff check .
ruff format .

# Tests
pytest                          # all
pytest tests/unit/              # unit
pytest tests/integration/       # integration
pytest tests/e2e/               # e2e (Playwright)
pytest --cov=watchbug --cov-report=xml

# Size check (client SDK)
npm run check:size              # fails if >45 KB gzipped

# Run locally
docker-compose up -d
uvicorn watchbug.api.main:app --reload
```

---

## Code Conventions (Quick Reference)

| Area | Convention |
|------|------------|
| **Python** | Ruff, mandatory type hints, `async def`, Pydantic Settings from `.env`, custom exceptions, Pydantic schemas |
| **Client SDK (TS/JS)** | ES2020, IIFE+ESM, Shadow DOM closed, single `window.Watchbug`, destructive canvas masking |
| **Naming** | Python: snake_case/PascalCase/UPPER_SNAKE. TS: camelCase/PascalCase/kebab-case. Tests: `test_<module>_<behavior>.py` / `*.spec.ts` |

---

## Key Files

| File | Purpose |
|------|---------|
| `pyproject.toml` | Project metadata, deps, tool config (Ruff, pytest, build) |
| `.env.example` | Documented env vars (DB URL, JWT secret, CORS origins) |
| `docker-compose.yml` | Single-file orchestration |
| `watchbug/api/main.py` | FastAPI app factory |
| `watchbug/api/schemas.py` | Pydantic models for `/api/incidents` |
| `watchbug/sdk/src/index.ts` | SDK entry point |
| `sonar-project.properties` | SonarCloud config |

---

## Testing & QA

| Level | Framework | Target |
|-------|-----------|--------|
| Unit | pytest | ≥80% on utils/formatters |
| Integration | pytest + httpx | API schema validation |
| E2E | Playwright | Widget isolation under hostile CSS |
| Size | custom | ≤45 KB gzipped |

**CI enforces:** Ruff lint+format, all tests pass, coverage → SonarCloud, bundle size ≤45 KB.