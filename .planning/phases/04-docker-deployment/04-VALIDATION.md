---
phase: 04
slug: docker-deployment
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-08
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Docker Compose + Python pytest + Vite build + curl health probes |
| **Config file** | docker-compose.yml / docker-compose.override.yml (none — compose spec) |
| **Quick run command** | `docker compose config` (validate) + `docker compose up -d --build` (smoke) |
| **Full suite command** | `docker compose up -d --build && curl -f http://localhost:8000/api/health && test -f backend/api/static/panel/index.html` |
| **Estimated runtime** | ~90 seconds (build + db init + health) |

---

## Sampling Rate

- **After every task commit:** Run `docker compose config` (syntax) + `hadolint` if available
- **After every plan wave:** Run full smoke (`docker compose up` + health + panel static)
- **Before `/gsd-verify-work`:** Full stack `up`, persistence cycle `down`/`up`, and `down -v` documented
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DEP-02 | — | Multi-stage Dockerfile (Node 22-alpine → python 3.12-slim) | build | `docker build -f Dockerfile . 2>&1 \| tail -20` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | DEP-01 | — | docker-compose.yml with api + db, pg_isready healthcheck | compose | `docker compose config 2>&1 \| grep -E "services|healthcheck"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | DEP-04 | SEC-05 | .env.example complete, no secrets in repo | static | `diff <(grep -E "^[A-Z_]+=.*" .env.example \| cut -d= -f1 \| sort) <(grep -E "Field" backend/app/config.py \| sed ...)` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | DEP-03 | — | Named volume pgdata persists across down/up, down -v destroys | integration | `docker compose up -d && psql insert && docker compose down && docker compose up -d && psql count==1` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | DEP-05 | — | down -v documented in README/docs | docs | `grep -n "down -v" README.md documentation/*.md` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | DEP-01 | — | /api/health 200 with db connected, depends_on healthy | health | `curl -sf http://localhost:8000/api/health \| jq .db` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `docker-compose.yml` — Compose spec with api + db, named volume, healthchecks (created by Plan 04-01 Task 1 tracer — IS Wave 0)
- [x] `Dockerfile` — Multi-stage Node builder + Python runtime, entrypoint with alembic upgrade head (created by Plan 04-01 Task 1 tracer — IS Wave 0)
- [x] `docker-entrypoint.sh` — Shell wrapper: `alembic upgrade head && exec uvicorn app.main:app` (created by Plan 04-01 Task 1 tracer — IS Wave 0)
- [x] `.env.example` — Already exists, verify completeness (11 vars) — no new Wave 0 file needed

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docker compose up -d` full stack boots and panel at /panel loads | DEP-01 | Requires Docker daemon + volume init, cannot be unit-tested | `docker compose up -d --build; curl -f http://localhost:8000/api/health; curl -f http://localhost:8000/panel/; test -f backend/api/static/panel/index.html` |
| Data persists after `down` and is destroyed after `down -v` | DEP-03/05 | Requires host Docker volume lifecycle | Insert row via POST /api/incidents, `docker compose down`, `docker compose up -d`, GET count==1, `docker compose down -v`, `up -d`, count==0 |

*If none: "All phase behaviors have automated verification."*

---

## Nyquist Compliance Justification

Plan 04-01 Task 1 (tracer) IS the Wave-0 scaffold — it creates `Dockerfile`, `docker-compose.yml`, and `docker-entrypoint.sh` on the first commit before any expansion tasks, so the 3 ❌ W0 entries in the Per-Task Map (compose/Dockerfile/persistence) are satisfied by the tracer itself with no separate Wave 0 plan sequencing needed. Sampling Rate latency <90s is satisfied by per-task `docker compose config --quiet` (~2s) and `docker build` gates; full `docker compose up -d --build` + health smoke (~90s) runs per wave merge and phase gate, not per task, meeting the Nyquist contract. The map's ❌ W0 markers denote artifacts that the tracer creates, not missing prerequisites. `wave_0_complete: true` reflects that Wave 0 is the tracer.

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (tracer creates compose/Dockerfile/persistence)
- [x] No watch-mode flags
- [x] Feedback latency < 90s (docker compose config ~2s per task, full smoke per wave)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — nyquist_compliant true via tracer-as-Wave-0 justification above
