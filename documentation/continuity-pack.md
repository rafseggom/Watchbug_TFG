# CONTINUITY PACK — Watchbug SDK

State preserved across session resets. Read this at the start of every session (ASE §4D, *Anti-Amnesia*).

**Last updated:** 2026-10-15 — INFORME-ANALISIS remediation batch `261014-m3u` landed on `gsd/phase-1-contracts-ingest` (§9).

---

## 9. INFORME-ANALISIS remediation — batch `261014-m3u` (2026-10-14 → 10-15)

Remediated the security/slop findings from `documentation/INFORME-ANALISIS.md` via `/gsd-quick-batch` on `gsd/phase-1-contracts-ingest`. **Not merged to `develop`** — the owner merges the open PR by hand (explicit instruction).

| Item | Content | Merge commit |
|------|---------|--------------|
| `261014-m3v` | S-2: TTL purge job (retention actually enforced) | `9f5ae66` |
| `261014-m3w` | S-3 + S-6: per-IP read rate-limit + keyset pagination | `35fc1bc` |
| `261014-m3x` | L-1 + S-6: hardened panel fetch, bounded list | `338d84f` |
| `261014-m3y` | S-4 (CSP) + S-5 (R-08 path-only URLs) | `abe0e9c` |
| `261014-m3z` | L-1: server-side slop (abortable fetch, lazy `sharp`) | `a4b7396` |
| `261014-m40` | L-2: connect stopthatslop gate in CI | ❌ **descoped** — see below |

`261014-m40` was **descoped by the owner**: no vendored `stopthatslop` engine, no CI job. The informe is kept as a **findings source only**; the 5 findings are fixed directly in code by `m3z` (api `index.ts` 2× fetch, `ingest/harden.ts` lazy `sharp`) and `m3x` (panel `api.ts` fetch + guarded `res.json()`). Reason recorded in `BATCH.json` `failure_reason`.

**Verification:** `npm run verify` **147/147** (chromium + firefox + webkit); `npm run lint`, `scripts/gate.mjs`, `check:compose` all pass. Pushed to `origin/gsd/phase-1-contracts-ingest` at `a4b7396` (0 ahead / 0 behind).

**Two orchestrator-side corrections worth keeping:**

1. **`m3y`'s test asserted the behaviour it wanted, not the behaviour the edge produced.** The S-4 test expected a bare `Referrer-Policy: same-origin` on proxied API responses, but `helmet`'s default is `no-referrer` and nginx *appends* its own `add_header` (nginx concatenates, never replaces upstream values) → the browser saw `no-referrer,same-origin`. Fixed at the **root**, not the test: `app.ts` sets `helmet`'s `referrerPolicy` to `same-origin` explicitly, and `nginx.conf /api/` adds `proxy_hide_header Referrer-Policy` — the same duplication the conf already handled for `X-Content-Type-Options`. The edge is now the single source for the header pair on proxied responses. Commit `6f0b55f`.
2. **Two firefox failures mid-run were resource contention, not regressions.** Both were `Tearing down "context" exceeded the test timeout` (teardown hang, not an assertion/CSP failure) with ~20 orphaned `chrome` processes left from earlier runs. After killing the orphans, the suite went clean 147/147. When a "failure" names teardown rather than an assertion, check for browser-process buildup before blaming the change.

**Dead-end (do not re-run):** the executor worktree for `m3x` was killed by an orchestrator `shell` timeout (`180000` ms) while running `item-dispatch.cjs` in the **foreground**. Dispatch executor worktrees in **background** shells (`background: true`) so a foreground timeout cannot kill a running worker; reconcile the stale `running` record first (`needsReconciliation: true`) by setting `.claude/worktrees/*.worker.json` `state` to a terminal value — the `already_running` guard only blocks on `state === 'running'`.

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
| `documentation/Gantt.md` — línea base inmutable | ✓ Complete (2026-10-10) |
| `documentation/Gantt-Actual.md` — real + variación | ○ Deferred — se crea al cerrar la Fase 1 (**§7**) |
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
| D-09 | Server-side "grace" alone for the ING-06 layer-2 pre-read 413 (delay the socket close 250 ms) |
| D-10 | Fixing the ING-06 layer-2 flake on the test side alone (raw-socket transport) |

> **Residual aceptado por el propietario (2026-10-13):** el flake de la fila ING-06 layer 2 quedó
> resuelto (15/15 dirigidas, 132/132 suite), pero un cliente que suba el cuerpo **a velocidad
> completa** todavía puede perder el 413 (`ECONNABORTED`). No investigar más sin petición explícita.
> Mecanismo y arreglo: `apps/api/src/ingest/caps.ts` → `lingerBeforeClose()` (ed20ec3) +
> `e2e/hostile.spec.ts` (c0a3d89). Justificación completa de por qué se descartaron otras dos vías:
> `resolution-record.md` §3, D-09 y D-10.

---

## 5. Standing constraints for any future session

1. **R-12 is owner-stated policy, not a preference.** E2E and property assertions only. No unit-test suite, no coverage targets. Do not reintroduce them.
2. **R-17 is owner-stated policy.** No calendar-driven descoping. Cut scope by coherence only.
3. **R-13 is a security invariant derived from SEC-02.** Masking = solid fill or block pixelation ≥8 px. Never gaussian blur, never CSS overlay.
4. **Consultation triggers still bind** (`mentorship-pack.md` §5.2, `mission-brief.md` §3). Anything touching the SDK public interface, the `/api/incidents` schema, the isolation strategy, DB schema, or new non-permissive dependencies requires a Consultation Request Pack before code changes.
5. **Non-goals are hard** (`mission-brief.md` §2). R-02's reserved ports are *seams only* — building a Jira/GitHub/Slack adapter, session replay, or AI triage is out of scope even though the seam exists.

---

## 6. GitHub project management (created 2026-10-10)

> ⚠ **Esta sección es el registro histórico de la sesión de creación (2026-10-10).** La referencia **viva** es [`documentation/management.md`](management.md), que añade los cambios de 2026-10-12 (PR `#2` fuera del board, issues de la Fase 1 asignadas, épica `#45` a Backlog, issue `#52` creada, campo `Wave` probado y revertido) y las reglas de cierre/sincronización. **Si algo contradice, manda `management.md`.**

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

Therefore, **the sync is done by the agent, on request, at each phase boundary** (owner decision, 2026-10-10 — no script, no auto-close). When a phase passes verification and you say *"sincroniza GitHub"*, the agent runs:

1. Close **all** child issues of that phase **together** (owner decision: issues close at *phase* completion, not per-plan — a phase is one complete e2e proof under the PRD DoD), each with an evidence comment (commits + `VERIFICATION.md`).
2. Close the epic when all its children are closed (its checklist and sub-issue progress must be 100 %).
3. Close the phase milestone.
4. Move the Project items to `Done`; pull the next phase's issues into `Ready to start`.

Rule of thumb: **implement → verify → close**. Never close ahead of evidence (PRD §6.2 DoD).

### 6.6 Branch-per-phase + PR (decisión del propietario, 2026-10-10)

- **`develop` = base siempre actualizada** (snapshot de la planificación desde `4a301c5`). No se desarrolla directamente en ella.
- **Una rama por épica/fase**, con el template ya previsto en `config.json`: `gsd/phase-{phase}-{slug}` — p. ej. `gsd/phase-1-contracts-ingest`.
- **Cada fase entra a `develop` mediante PR**, revisado con **PR-Lens** (el skill `pr-lens` / `.pr-lens`, ignorado en git) para llevar el control del cambio.
- Los PRs se abren **contra `develop`** (rama por defecto del repo) y deben llevar en el body `Closes #N` por cada issue de esa fase → al mergear, **GitHub cierra esas issues automáticamente**, lo que automatiza el paso 1 de §6.5. La épica y el milestone se cierran aparte (GitHub no auto-cierra la issue padre al cerrar sus sub-issues).
- ⚠ `config.json` → `git.branching_strategy` sigue en `"none"`. Si se quiere que GSD cree la rama de fase y el PR solo (`/gsd-ship`), hay que cambiarlo a la estrategia de fases — decisión pendiente del propietario, no se toca sin confirmación.

---

## 7. Plan vs real — Gantt de variación (deferido hasta la 1ª fase)

**Decisión del propietario (2026-10-10):** no se genera hoy, porque no se ha empezado a ejecutar. Se activa con el cierre de la Fase 1.

- **Línea base (inmutable):** `documentation/Gantt.md` — el plan ideal del 10-oct. **Nunca se edita**; su valor es poder compararse. Cualquier cambio de fecha que implique re-planificar se hace aquí solo con aprobación explícita, y anotando la enmienda.
- **Real + variación:** `documentation/Gantt-Actual.md` — se crea al cerrar la Fase 1 (o antes, si hay algo que reportar) con barras pareadas *plan vs real* y tabla de Δ.

### 7.1 Captura de fechas reales

| Fase | Plan inicio | Plan fin | **Real inicio** | **Real fin** | Δ (días) |
|------|-------------|----------|-----------------|--------------|----------|
| 1 | 2026-10-10 | 2026-10-18 | 2026-10-11 | `closed_at` del milestone 6 | +1 (inicio; discuss de fase hecho el 2026-10-11) |
| 2 | 2026-10-18 | 2026-10-31 | *(idem)* | `closed_at` del milestone 7 | — |
| 3 | 2026-10-31 | 2026-11-13 | | `closed_at` del milestone 8 | |
| 4 | 2026-11-13 | 2026-11-22 | | `closed_at` del milestone 9 | |
| 5 | 2026-11-22 | 2026-11-30 | | `closed_at` del milestone 10 | |
| 6 | 2026-11-30 | 2026-12-12 | | `closed_at` del milestone 11 | |
| 7 | 2026-12-12 | 2026-12-24 | | `closed_at` del milestone 12 | |

**Regla de captura — el único dato que GitHub NO guarda solo es el *inicio* de cada fase.** Al arrancar cada fase (`/gsd-plan-phase N`), el agente anota `Real inicio = fecha de hoy` en esta tabla. El *fin* sale solo de `gh api repos/rafseggom/Watchbug_TFG/milestones?state=all` (`closed_at`), y el detalle por issue de los `closed_at` de las issues de esa fase.

### 7.2 Métricas a calcular en `Gantt-Actual.md`

1. **Δ por fase** — `real fin − plan fin` (positivo = retraso).
2. **Deriva acumulada** contra el 31-dic-2026.
3. **% de buffer consumido** — el buffer vale 7 días (25–31 dic); se agota al ritmo en que la deriva supere las fases tolerantes (4, 5 y 6 tienen holgura implícita).
4. **Duración real vs planificada por fase** — detecta fases que se comieron más días de los previstos aunque llegaran "a tiempo" arrancando tarde.

### 7.3 Procedimiento

```
Al ARRANCAR fase N  → §7.1: Real inicio = hoy
Al CERRAR fase N    → durante la sincronía GitHub (§6.5):
                      1. §7.1: Real fin = closed_at del milestone N; calcular Δ
                      2. Crear/actualizar documentation/Gantt-Actual.md
                      3. Gantt.md NO se toca
```

---

## 8. Phase 1 execution log

### 8.1 [LEGITIMACY GATE] Plan 01-01 Task 1 — pinned dependency set APPROVED (2026-10-12)

**Gate:** `checkpoint:human-verify` · `gate="blocking-human"` (plan 01-01 Task 1) · **Result: `approved`** — recorded before any `npm install` / `docker pull` ran anywhere in the phase (Task 1 acceptance criterion).

Human reviewed `.planning/research/STACK.md` (Version Verification Table) and `.planning/phases/01-contracts-ingest-slice/01-RESEARCH.md` § Package Legitimacy Audit, **including the disclosed discrepancy** that `typescript`, `vite`, `react`/`react-dom`, `@vitejs/plugin-react` and `tsx` have no audit row and rest on STACK.md verification alone.

**Approved — npm (17 pinned packages):** `fastify@5.12.5`, `@fastify/multipart@10.1.2`, `@fastify/rate-limit@11.2.0`, `@fastify/cors@11.3.0`, `@fastify/helmet@13.1.1`, `drizzle-orm@0.45.3`, `drizzle-kit@0.31.11`, `pg@8.23.1`, `zod@4.6.5`, `sanitize-html@2.18.0`, `react@19.3.0`, `react-dom@19.3.0`, `vite@8.3.2`, `@vitejs/plugin-react@6.1.2`, `typescript@7.0.2`, `esbuild@0.28.2`, `@playwright/test@1.63.0`, `tsx@4.23.15`.

**Approved — Docker images (3):** `node:24.21.0-alpine3.24`, `nginx:1.30.5-alpine3.24`, `postgres:18.6-alpine3.24`.

**NOT approved in this batch:** `sharp` — it is not in plan 01-01's set and carries its own `checkpoint:human-verify` in plan **01-02** (P1-D-10 consultation). It must not be installed until that gate is cleared.

**Standing rule from the approval:** no package may be silently swapped for a non-STACK.md alternative; a swap is a consultation, not an edit.

### 8.2 [Q-08] TypeScript 7.0.2 tooling gate — PASS, no 6.x fallback (2026-10-12)

Plan 01-01 Task 2 Step 0 ran the Q-08 smoke test under the pinned `typescript@7.0.2` **before any ingest code**, as 01-RESEARCH.md Pitfall 8 prescribes:

- `drizzle-kit generate` on a scratch schema → emitted `drizzle/0000_*.sql` + `meta/` snapshot under `.planning/research/.cache/q08/`.
- `tsx apps/api/src/index.ts` → `GET /api/health` → `200 {"status":"ok"}` (Fastify 5.12.5 + tsx 4.23.15).
- `vite build` of the panel shell → `✓ built` (Vite 8.3.2, 14 modules).

**Disposition:** Q-08 resolves as **PASS** — the toolchain stays on TypeScript 7.0.2 and the documented 6.x fallback is **not** taken. Re-verified in-session before this record was written.

**Open item (type-only deps):** `npm run lint` runs `tsc` across the workspaces and cannot typecheck `apps/api` (`node:fs` / `process`) or `apps/panel` (JSX / `react-dom/client`) without type-only devDeps (`@types/node`, `@types/react`, `@types/react-dom`, plus `@types/pg` and `@types/sanitize-html` for untyped runtime deps). Those are **outside the 17 approved pins**, so nothing has been installed — a human decision is required (approve type-only devDeps vs. scope `lint` down). This does not affect `npm run build`, `check:size`, `check:compose` or the e2e suite.

*(Resolved 2026-10-12: the owner approved the five type-only `@types/*` devDependencies — A-13, `documentation/resolution-record.md`.)*

### 8.3 [P1-D-10] Re-encode backend DECIDED — `sharp@0.35.5` (Option A) (2026-10-12)

**Gate:** `checkpoint:human-verify` · `gate="blocking-human"` (plan 01-02 Task 1) · **Result: `sharp`** — the owner adopted **Option A: `sharp@0.35.5`** as the P1-D-10 re-encode backend, after reviewing P1-D-10's locked text, the option comparison (sharp re-encode vs. structural strip/rebuild) and the package-legitimacy evidence. Recorded **before** Task 2 installs or commits the backend (Task 1 acceptance criterion). `sharp` is now explicitly approved — the legitimacy gate for it must not be re-opened.

**Rationale (P1-D-10, locked):** the decision requires a **root re-encode** (`re-codifica de raíz`) — only a true decode → re-encode kills decoder-differential polyglots, which a structural strip/rebuild cannot (it only kills container-level polyglots, metadata and trailing data). The cost is low in this codebase:

1. **No toolchain in the image.** `sharp` installs from `optionalDependencies` prebuilds — including `@img/sharp-libvips-linuxmusl-x64` and `@img/sharp-libvips-linuxmusl-arm64` — so no `node-gyp`/compiler enters `node:24.21.0-alpine3.24`.
2. **`apps/api` only.** It lives in the server workspace; `packages/sdk` and the RNF-01 size lanes (45/25/80 KB) are untouched — `check:size` proves it.
3. **License Apache-2.0** — compatible with R-07.
4. **Legitimacy seam false positive.** The seam's `SUS ("too-new")` verdict is the same release-cadence false positive already dispositioned for the 16 other approved packages: the package is ~12 years old, ~115.9 M downloads/week, official repo `github.com/lovell/sharp`.

**Operational consequences accepted:** a native libvips layer in the `api` image (image size grows; the container count does not — INV-03 still exactly 3), and a processing-time guard (`timeout({ seconds })`) on the decode as the T-01-08 mitigation alongside the pre-decode header guard.

**Scope:** pin exactly `sharp@0.35.5` in `apps/api/package.json` **only**. No other new dependency in this plan. The zero-dep structural strip/rebuild stays as code history (`structure.ts` keeps the chunk validation as a pre-codec guard) but is no longer the hardening backend.
