# CONTINUITY PACK — Watchbug SDK

State preserved across session resets. Read this at the start of every session (ASE §4D, *Anti-Amnesia*).

**Last updated:** 2026-10-10 — GitHub project management set up (labels, milestones, 47 issues, epics, Project kanban #3). See §6.

---

## 1. Current progress

| Step | Status |
|------|--------|
| Consultation round (restricted decisions) | ✓ Complete — see `resolution-record.md` |
| Governing-document reconciliation | ✓ Complete — `## Enmienda` blocks appended |
| `.planning/PROJECT.md` | ✓ Complete (2026-10-05) |
| `.planning/config.json` | ✓ Complete (2026-10-05) |
| Research (stack / features / architecture / pitfalls) | ✓ Complete (2026-10-05) |
| `.planning/REQUIREMENTS.md` | ✓ Complete — 70/70 v1 requirements mapped |
| `.planning/ROADMAP.md` | ✓ Complete (2026-10-07) — 7 vertical phases, coverage 70/70 |
| GitHub project management (labels / milestones / issues / kanban) | ✓ Complete (2026-10-10) — **§6** |
| Phase 1 planning (`/gsd-plan-phase 1`) | ○ Not started |

**Next action:** `/gsd-plan-phase 1` — Contracts & Ingest Slice (milestone due 2026-10-18, issues `#5`–`#10`, epic `#45`).

---

## 2. Governing context

- **Mission Brief** — `documentation/mission-brief.md` (RF-01…08, RNF-01…03, CA-01…05, non-goals, autonomy envelope)
- **Mentorship Pack** — `documentation/mentorship-pack.md` (INV-01…03, SEC-01…06, RNF budgets, verification commands, consultation triggers)
- **ASE Instructions** — `documentation/ase-instructions.md` (C-B-D-C, coordination artifacts, paradox mitigations)
- **Resolution Record** — `documentation/resolution-record.md` (R-01…R-17, D-01…D-08, Q-01…Q-06)

⚠ `AGENTS.md` is **non-authoritative** (R-16). It is stale scaffolding and will be regenerated.

---

## 3. Open questions

Full detail in `resolution-record.md` §4.

- **Q-01** — Override window on R-14 (Shadow DOM + build flag) and R-15 (TypeScript end-to-end) is open until the next interaction.
- **Q-02** — Console-log payload caps. Unbounded console capture is a cheap DoS vector past per-IP rate limiting.
- **Q-03** — Retention N (default 30 days) confirmation; whether it is panel-configurable.
- **Q-04** — Is `public_key` rotation UI v1 or v2? Leaning v2.
- **Q-05** — University IP policy must be confirmed before the repo is public (Apache-2.0, R-07).
- **Q-06** — Default `CaptureSource` adapter: `getDisplayMedia` (≈1 KB, pixel-perfect, raises a share sheet) vs DOM serialization (8–14 KB, silent failure modes). Unscheduled; decide at phase planning with a spike if needed.

---

## 4. Dead-ends

Failed or rejected paths. **Do not re-explore.** Full rationale in `resolution-record.md` §3.

| ID | Rejected path |
|----|---------------|
| D-01 | Treating `AGENTS.md` as governing |
| D-02 | Reading `npm run test:*` vs `pytest` as a contradiction (disjoint layers) |
| D-03 | Single 45 KB whole-project budget (superseded by R-01 tiering) |
| D-04 | `html2canvas` for capture (≈50 KB gzipped) |
| D-05 | `fabric.js` / `konva` for the annotator (≈85 KB / ≈45 KB gzipped) |
| D-06 | Gaussian blur as the masking primitive (partially invertible) |
| D-07 | Python 3.10 as a target (EOL October 2026) |
| D-08 | SVG `foreignObject` DOM serialization as *primary* capture path |

---

## 5. Standing constraints for any future session

1. **R-12 is owner-stated policy, not a preference.** E2E and property assertions only. No unit-test suite, no coverage targets. Do not reintroduce them.
2. **R-17 is owner-stated policy.** No calendar-driven descoping. Cut scope by coherence only.
3. **R-13 is a security invariant derived from SEC-02.** Masking = solid fill or block pixelation ≥8 px. Never gaussian blur, never CSS overlay.
4. **Consultation triggers still bind** (`mentorship-pack.md` §5.2, `mission-brief.md` §3). Anything touching the SDK public interface, the `/api/incidents` schema, the isolation strategy, DB schema, or new non-permissive dependencies requires a Consultation Request Pack before code changes.
5. **Non-goals are hard** (`mission-brief.md` §2). R-02's reserved ports are *seams only* — building a Jira/GitHub/Slack adapter, session replay, or AI triage is out of scope even though the seam exists.

---

## 6. GitHub project management (created 2026-10-10)

Repo `rafseggom/Watchbug_TFG` · Project **#3 "Kanban Watchbug TFG"** (https://github.com/users/rafseggom/projects/3).
Tooling: **`gh` CLI** authenticated as `rafseggom` (scopes `repo`, `read:org`, `workflow`, `project`). There is no GitHub MCP server in this environment — all GitHub operations go through `gh`.

### 6.1 Labels (20)

| Group | Labels |
|-------|--------|
| Areas (new) | `area: sdk` · `area: api` · `area: panel` · `area: contracts` · `area: infra` · `area: docs` |
| Classification (new) | `epic` · `security` · `blocked` |
| Pre-existing | `bug` · `feature` · `documentation` · `testing` · `design` · `research` |
| Priority (pre-existing) | `priority: critical` · `priority: high` · `priority: medium` · `priority: low` · `priority: unimportant` |

### 6.2 Milestones = the 7 phases (legacy ones closed)

| # | Milestone | v1 reqs | Due |
|---|-----------|---------|-----|
| 6 | Phase 1 — Contracts & Ingest Slice | 10 | 2026-10-18 |
| 7 | Phase 2 — SDK Tracer Bullet: Widget, Capture & Auto-Redaction | 18 | 2026-10-31 |
| 8 | Phase 3 — Report Composer & Annotation Editor (lazy) | 13 | 2026-11-13 |
| 9 | Phase 4 — Report Payload & Enrichment | 7 | 2026-11-22 |
| 10 | Phase 5 — Secure Admin Access & Projects | 9 | 2026-11-30 |
| 11 | Phase 6 — Triage & Data Lifecycle | 10 | 2026-12-12 |
| 12 | Phase 7 — Resilience & Release Closeout | 3 | 2026-12-24 (buffer 25–31 dec) |

Closed (legacy, kept for history): Documentación, Sprint 1, Sprint 2, Investigación, Diseño arquitectura.

### 6.3 Issues: 7 epics + 40 work issues

- **Epics `#45`–`#51`** (one per phase), label `epic`. Body = goal, success criteria, `RSK-*` risks, due date, and a checklist of its children. Each child is **also a native GitHub sub-issue** of the epic, so epics show a progress bar (6/6, 7/7 …).
- **Work issues `#5`–`#44`** (~6 per phase), each with: REQ-IDs covered, "Hecho cuando…" acceptance criteria, risks, `ROADMAP.md` link, and a footer linking back to its epic + milestone.
- Numbering: `#5`–`#10` = Phase 1 … `#40`–`#44` = Phase 7. Epic = `44 + phase` (i.e. Phase 1 → `#45`, Phase 7 → `#51`).
- Priorities: 11 critical (architecture-loaded decisions and blockers) · 25 high · 3 medium. Epics carry no priority label (containers, not work).
- **Blocked (label + status):** `#33` key rotation (waits on **Q-07**, decide at `/gsd-plan-phase 5`) · `#44` release closeout (waits on **Q-05** university IP policy + Node re-pin after 2026-10-28).

### 6.4 Project #3 — board conventions

Fields: `Status` single-select with `Ready to start` (GREEN) · `Backlog` (PURPLE) · `In Progress` (YELLOW) · `Testing/Review` (PINK) · `Done` (PURPLE) · `Blocked` (RED). Views: **Kanban** (grouped by Status) and **Roadmap v1 (milestones)** (table).

Meaning of the states:

| State | Meaning |
|-------|---------|
| `Backlog` | Not yet actionable — belongs to a later phase |
| `Ready to start` | Next in queue — phase is planned and unblocked (initially: all of Phase 1) |
| `In Progress` | Someone is executing it now |
| `Testing/Review` | Implemented, awaiting the e2e suite / `check:size` / review (R-12: that *is* the verification) |
| `Done` | Meets the Definition of Done **and** issue is closed |
| `Blocked` | Waiting on an external decision, not on time — always paired with the `blocked` label |

Initial distribution (2026-10-10): Ready to start 7 (Phase 1) · Backlog 38 · Blocked 2 · Done 2 (legacy) · In Progress / Testing 0.

⚠ **Known cosmetics:** `Blocked` was appended by the API *after* `Done` in the field's option order — drag it left of `Done` in the field editor. Board grouping cannot be set through the API; confirm the Kanban view groups by `Status`.

### 6.5 Sync rules — GSD ↔ GitHub (important)

**Source of truth is `.planning/` (`ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`). GitHub is a mirror for visibility.** GSD does **not** touch GitHub issues, milestones or Projects on its own: `/gsd-execute-phase` writes code and updates `.planning`, `/gsd-ship` opens a PR, and `/gsd-inbox` only triages incoming issues (it can `gh issue close` on template violations). Nothing in GSD closes an issue because its phase finished.

Therefore, at each phase boundary, run the sync by hand (or ask the agent to):

1. Phase passes verification → close every child issue of that phase with an evidence comment (commit + `VERIFICATION.md`).
2. Close the epic when all its children are closed (its checklist and sub-issue progress must be 100 %).
3. Close the phase milestone.
4. Move the Project items to `Done`; pull the next phase's issues into `Ready to start`.

Rule of thumb: **implement → verify → close**. Never close ahead of evidence (DoD §6.2 of the PRD).
