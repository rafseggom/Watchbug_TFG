# Phase 1: Contracts & Ingest Slice - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A developer can start the self-hosted stack (api + panel + db, one `docker-compose up`) and push a synthetic report — image + metadata — across the wire into hardened, schema-validated storage that renders in a minimal panel. The single official contract (`packages/contracts` → `schema/report.schema.json`), the binding constant set (A-06) and the size gate (`check:size`) exist from day one.

Requirements in scope: **DEP-01, DEP-02, ENR-06, ING-01, ING-03, ING-04, ING-05, ING-06, ING-07, ING-08** (10).

Explicitly NOT in this phase (they complete later, per ROADMAP): auth / project CRUD (Phase 5), the real widget and SDK (Phase 2), composer/annotation (Phase 3), console+env enrichment (Phase 4), triage actions and TTL purge (Phase 6), durability queue (Phase 7).

</domain>

<decisions>
## Implementation Decisions

> Local decision IDs are prefixed `P1-D-` to avoid collision with the global `D-01…D-08` register in `documentation/resolution-record.md`.

### Origen del project key (fase sin auth)
- **P1-D-01:** El developer obtiene una clave válida mediante **seed idempotente desde `.env`**: `.env.example` documenta `WATCHBUG_PROJECT_KEY` y el arranque del API crea la fila `projects` si no existe. La e2e lee la misma variable → determinista. El CRUD real de proyectos lo sustituye en Fase 5. — **Reversibility:** reversible — la migración a CRUD de Fase 5 es una mejora, no una ruptura.
- **P1-D-02:** Si la variable falta o es placeholder → **fail-fast al arrancar** con mensaje que indica exactamente qué falta en `.env`. Nunca puede existir una clave predecible en producción (SEC-04, "fail loud, nunca silencioso"). — **Reversibility:** reversible
- **P1-D-03:** Formato de la clave pública: **`wkbt_` + 32 bytes aleatorios en base62 (≈190 bits)**, generada con `crypto`. Prefijo identificable para logs/secret-scanners y para la rotación de Fase 5. — **Reversibility:** costly — el formato queda fijado en toda fila `projects` y en la documentación de integración; cambiarlo después exige migración de claves existentes o rotación.

### Aspecto del panel mínimo
- **P1-D-04:** Estructura **lista + panel de detalle en dos columnas** (lista de reportes a la izquierda, imagen grande + metadatos a la derecha). Es la forma final del triage de Fase 6 → la base visual se sienta aquí y Fases 5/6 solo añaden filtros, estados y acciones, sin rediseño. — **Reversibility:** costly — es la base sobre la que se construyen las 6 fases siguientes de UI.
- **P1-D-05:** Idioma por defecto: **auto-detectar `navigator.language`** (`es*` → español, resto → inglés) + selector manual persistido en `localStorage` del panel (RNF-03; el `localStorage` del panel propio no toca SEC-03). — **Reversibility:** reversible
- **P1-D-06:** Base visual: **tokens CSS (color/spacing/typography) con soporte `prefers-color-scheme` light/dark desde la Fase 1**, en lugar de estilos hardcodeados. — **Reversibility:** costly — migrar a tokens después toca todas las clases ya escritas en 5 fases de UI.
- **P1-D-07:** Estado vacío = **snippet `curl` listo para copiar, pre-rellenado con el project key real de la instancia** (pega → ejecuta → recargas → ves el reporte). El estado vacío es el onboarding del producto. — **Reversibility:** reversible

### Plan B de `@fastify/multipart` (UNVERIFIED ↔ Fastify 5)
- **P1-D-08:** Orden de preferencia si el smoke-test falla: **1)** probar otra versión de `@fastify/multipart` sin tocar el contrato; **2)** si ninguna sirve, **parser multipart propio** (boundary + streams); **3)** JSON+base64 **solo con consulta expresa al propietario** (cambio de contrato CA-01 = consultation trigger). — **Reversibility:** reversible — los pasos 1 y 2 dejan CA-01 intacto.
- **P1-D-09:** El smoke-test de multipart es el **primer trabajo de la fase**, antes de escribir el endpoint de ingest: commit mínimo que arranca Fastify y parsea un `FormData` de prueba. Cierra el riesgo con coste casi cero. — **Reversibility:** reversible

### Profundidad del hardening C-4
- **P1-D-10:** **Re-encode obligatorio en servidor**: cada imagen se re-codifica de raíz antes de escribir a disco (mata políglotos y EXIF), además del sniff estricto de magic bytes, los tres headers de la ruta de blob (`nosniff`, `Content-Disposition: attachment`, `CSP: default-src 'none'; sandbox`) y el anti decode-bomb (≤16 MP de A-06). ⚠ STACK.md rechaza `sharp`/`jimp`: **cualquier dependencia pesada nueva para lograrlo se consulta al propietario antes de añadirla.** — **Reversibility:** costly — la ruta de ingest se diseña alrededor del re-encode; quitarlo después cambiaría las afirmaciones de seguridad de SEC-02/C-4 y la e2e que las prueba.
- **P1-D-11:** Allowlist de formatos: **solo PNG + WebP** (exactamente los que produce la captura, R-11). JPEG se reconsidera en Fase 3 con `ManualFileCapture` si hace falta (ampliar allowlist es barato y consultable). SVG rechazado incondicionalmente. — **Reversibility:** reversible — ampliar es un cambio local; el contrato de respuesta no cambia.
- **P1-D-12:** Formato de salida tras el re-encode: **mismo formato de entrada** (PNG→PNG, WebP→WebP). Respeta los caps de A-06 sin inflar y mantiene la promesa de R-11 del fallback WebP→PNG. — **Reversibility:** reversible

### the agent's Discretion
No gray area was left as "you decide" by the owner — every discussed decision has an explicit choice. Free technical latitude remains for the researcher/planner on: exact seed mechanism (bootstrap vs migration), Drizzle schema shape, file/plan decomposition, nginx proxy details (A-10), and the concrete e2e structure of the CA assertions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & acceptance
- `.planning/ROADMAP.md` § Phase 1 — goal, 5 success criteria, requirements list, Rationale/Risks paragraph (C-3/C-4, H-7, A-12/M-2, M-1/A-02, ENR-06, DEP-03 seam, multipart UNVERIFIED)
- `.planning/REQUIREMENTS.md` — DEP-01, DEP-02, ENR-06, ING-01, ING-03…ING-08 definitions + traceability table

### Decisions & invariants (governing)
- `documentation/resolution-record.md` — A-06 (binding constant set: 5 MB body / 2 MB image / 16 MP / layered rate limits), A-09 (version pins), A-10 (nginx must reverse-proxy `/api` for same-origin), A-12/M-2 (multi-artifact `check:size`), R-12 (e2e-only verification), R-13 (masking primitives), R-15 (TS end-to-end), R-17 (no calendar descoping). §5 governs on conflict.
- `documentation/mentorship-pack.md` — architectural invariants and quality gates (all hard).
- `documentation/mission-brief.md` — goal, non-goals (Declare the No), autonomy envelope.
- `documentation/continuity-pack.md` §6.5–§6.6 — GitHub sync rules and **branch-per-phase + PR policy** (this phase lives on `gsd/phase-1-contracts-ingest`, PR against `develop` with `Closes #N`).

### Research evidence (locked inputs)
- `.planning/research/ARCHITECTURE.md` — ingest edge concerns, `FormData { meta, image }` + `Idempotency-Key` + `X-Project-Key`, `UNIQUE (project_id, idempotency_key)` with response replay, storage key scheme, sanitize-on-write
- `.planning/research/STACK.md` — verified pins and the "What NOT To Use" rejection list (`sharp`/`jimp`, `dotenv`, unit-test frameworks, Redis rate-limit store…)
- `.planning/research/SUMMARY.md` — retry/dedup constants (3 attempts, backoff 1/4/10 s ±25 %, 15 s timeout), transport lanes
- `.planning/research/PITFALLS.md` — C-3/C-4, H-7, H-9 hazard details (if present in `documentation/`)

### Project entry point
- `AGENTS.md` — C-B-D-C control framework, consultation triggers, commands

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None — greenfield.** The repository contains planning docs only (`.planning/`, `documentation/`, `.github/`, `.pr-lens/`). No `packages/`, `apps/`, or source files exist yet. This phase creates the monorepo skeleton that every later phase builds on.

### Established Patterns
- **npm workspaces monorepo layout** is fixed by R-15/STACK.md: `packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel` — Phase 1 creates all four directory shells (the SDK shell stays empty of behavior until Phase 2).
- **Verification pattern (R-12):** one Playwright suite mapping 1:1 to CA-01…CA-05 + `npm run check:size`. No unit tests, no coverage thresholds — ever. Phase 1 wires the harness and the size gate even though the full suite completes in Phase 7.
- **Commit/docs pattern:** `commit_docs: true` — planning artifacts are committed alongside code; plan files follow `{padded_phase}-{NN}-PLAN.md`.

### Integration Points
- `packages/contracts` emits `schema/report.schema.json` (Zod 4 `z.toJSONSchema`) — the API validates ingest against it and it is the published contract for SDK (types-only import) and panel.
- `apps/api` ingest route ↔ `Storage` port (R-02 seam) — first implementation of the server-side seam.
- `apps/panel` fetches the report list from the API through the nginx `/api` proxy (A-10, same-origin groundwork for Phase 5 cookies).
- `docker-compose.yml` must contain exactly three services (`api`, `panel`, `db`) — INV-03 — plus a CI assertion that the blob volume mounts only in `api` (C-4).

</code_context>

<specifics>
## Specific Ideas

- **Empty state as onboarding:** the "no reports yet" screen is the product's first-run experience — a copy-paste `curl`, pre-filled with the instance's real project key, so the first successful ingest takes seconds.
- **Two-column panel from day one:** deliberately chosen so Fases 5/6 extend the same layout instead of redesigning it.
- **Risk-first sequencing:** the UNVERIFIED multipart smoke test is deliberately the first commit of the phase, before any ingest code exists.

</specifics>

<deferred>
## Deferred Ideas

- **JPEG support in the allowlist** — revisit in Phase 3 alongside `ManualFileCapture` (A-05) if users need to attach captures made with other tools.
- **Auth-gated panel and blob route** — DEP-03's "served only through the authenticated API" completes in Phase 5; this phase makes no auth claim.
- No gray area was marked "agent decides"; no todos matched this phase (`todo.match-phase 1` → 0).

</deferred>

---

*Phase: 1-Contracts & Ingest Slice*
*Context gathered: 2026-10-11*
