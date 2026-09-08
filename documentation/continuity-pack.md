# Continuity Pack — Watchbug SDK

> Log de continuidad entre sesiones y registro de caminos sin salida (dead-ends).
> Leer al inicio de cada sesión. Escribir **inmediatamente después** de cada intento fallido, antes del siguiente intento.

---

## Estado actual (2026-09-08)

- **Phase 01 — SDK Core: COMPLETE** — 5/5 planes ejecutados, verificación PASS (117 unit + 6 E2E, bundle 8.85 KB gzipped ≤45KB), shipped en `8da34ae` PR #2.
- **Phase 02 — Backend API: COMPLETE** — 4/4 planes ejecutados, verificación PASS (65 tests, 20/20 truths verified), commits `81cdf7d`, `33522e1`, `bbdcfe2`, `2235330`, `cf0333c`, `2f8f1c3`. 39/39 requirements satisfied (API-01..05, AUTH-01..04, DB-01..04, SEC-01..05).
- **Phase 03 — Admin Panel: COMPLETE** — 3/3 planes ejecutados, verificación PASS (43 tests, build 8.18kB gzipped, 0 innerHTML), completado 2026-09-02.
- **Phase 04 — Docker Deployment: COMPLETE** — 2/2 planes ejecutados, verificación PASS (5/5 must-haves, DEP-01..05 satisfied), completado 2026-09-08.

Este archivo estaba vacío hasta 2026-08-31. Se inicializa retroactivamente con los dead-ends y decisiones de Fase 1 para no repetir exploración. A partir de ahora los agentes (`gsd-executor`) deben escribir cada dead-end en el momento del fallo, no al final.

---

## Phase 01 — Dead-Ends (retroactivamente documentados)

### Dead-End: html2canvas para captura de screenshot
- **What**: `html2canvas` 1.4.1 (17.8M downloads/semana) evaluado para rasterizar DOM completo a canvas
- **Why rejected**: Bundle killer — añade ~30-50 KB minificado, rompe presupuesto `RNF-01` ≤45 KB gzipped (bundle final es 8.85 KB). Además recorre todo el DOM sin límite, riesgo de freeze/OOM en páginas grandes (Pitfall 2 de RESEARCH)
- **Evidence**: `01-RESEARCH.md:97` alternativa listada, `01-RESEARCH.md:104` tradeoff "Custom solution smaller bundle but more complex", `01-VERIFICATION.md:135` gap documentado como tradeoff aceptado: `screenshot.ts` usa `fillRect('#fff') → toDataURL` placeholder en lugar de html2canvas para mantener 19.6% del límite. Decisión alineada con plan `01-02`
- **Phase**: 01-sdk-core
- **Date**: 2026-08-30

### Dead-End: dom-to-image como alternativa a html2canvas
- **What**: `dom-to-image` 2.6.0 evaluado como alternativa más ligera a html2canvas
- **Why rejected**: Menos mantenido (400K downloads vs 17.8M), mismos problemas de bundle y sin ventaja decisiva; no resuelve el core issue de tamaño. Research lo deja como fallback solo si custom Canvas API fuese demasiado complejo
- **Evidence**: `01-RESEARCH.md:98` listado, `01-RESEARCH.md:105` "dom-to-image lighter but less maintained", nunca instalado (`package.json` no lo contiene, grep 0 hits)
- **Phase**: 01-sdk-core
- **Date**: 2026-08-30

### Dead-End: tsup como bundler principal (recomendación de research)
- **What**: `tsup` 8.5.1 recomendado en `01-RESEARCH.md:91` como bundler primario (esbuild-powered, zero-config)
- **Why rejected**: Rollup 4.x ofrece mejor tree-shaking para SDK y salida IIFE nativa sin config extra. Plan `01-01` y `sdk/rollup.config.mjs:8-12` usan `format:'iife', name:'Watchbug'` + terser, logrando 8.85 KB gzipped. tsup implicaba ESM+CJS dual que no aporta para `<script>` tag
- **Evidence**: `01-RESEARCH.md:103` "Instead of tsup Could Use Rollup — Rollup requires more config but better tree-shaking", `01-01-SUMMARY.md:19` tech-stack añade `rollup@4.20` y no `tsup`, `sdk/rollup.config.mjs` existe y `tsup.config.ts` no existe
- **Phase**: 01-sdk-core
- **Date**: 2026-08-30

### Dead-End: CSS overlay para masking de datos sensibles
- **What**: Patrón de enmascarar con `<div style="background:gray; position:absolute">` sobre canvas en lugar de manipular píxeles
- **Why rejected**: Violación `SEC-02` — los píxeles originales permanecen intactos en `ImageData`; `canvas.toDataURL()` codifica la imagen sin máscara y filtra datos sensibles. Auditoría de seguridad lo marca como bypass
- **Evidence**: `01-RESEARCH.md:322` Anti-Pattern documentado, `sdk/src/editor/tools/mask.ts:27-122` implementa `getImageData() → Uint8ClampedArray → putImageData()` destructivo probado en `tests/unit/mask.test.ts:6` (solid gray replacement), grep CSS overlay masking = 0 en `sdk/src`
- **Phase**: 01-sdk-core
- **Date**: 2026-08-30

### Dead-End: IndexedDB para persistencia de drafts
- **What**: `IndexedDB` evaluado para guardar drafts en `D-08` (retry + save draft on network failure)
- **Why rejected**: Overkill para v1 — drafts son JSON <100KB, `localStorage` es sincrónico, simple y suficiente. IndexedDB añade complejidad async y manejo de versiones sin beneficio medible para error reports
- **Evidence**: `01-RESEARCH.md:497-500` Open Question Q2 recomienda `localStorage for simplicity; IndexedDB if draft data exceeds 5MB`, `sdk/src/transport/draft.ts` usa `localStorage` con prefijo `watchbug_draft_*`, no hay `indexedDB` en `sdk/src`
- **Phase**: 01-sdk-core
- **Date**: 2026-08-30

### Dead-End: Atributos ARIA en constructor de Custom Element
- **What**: `this.setAttribute('role','application')` en `constructor()` de `WatchbugWidget`
- **Why rejected**: Viola spec de Custom Elements — jsdom lanza `NotSupportedError: Unexpected attributes` cuando el elemento se crea vía `document.createElement` en `init()`. Rompe `sdk-entry.test.ts` cuando todos los tests corren juntos
- **Evidence**: `01-01-SUMMARY.md:183` [Rule 1 - Bug] documentado, fix moviendo ARIA a `connectedCallback` con `hasAttribute` guard, commit `eccd637`, `npx vitest run` pasa 0 unhandled errors tras el fix
- **Phase**: 01-sdk-core
- **Date**: 2026-08-30

---

## Phase 01 — Notas de continuidad (no son dead-ends, pero evitan re-trabajo)

- **Shadow DOM `mode:'closed'` es intencional** (`sdk/src/widget/WatchbugWidget.ts:24`). `shadowRoot === null` en E2E es prueba de `INV-01`, no un bug. Acceso a contenido en tests vía hook `_getShadowRoot` interno. No cambiar a `open` sin consult (`AGENTS.md` Consultation Trigger).
- **Bundle gate es real**: `scripts/check-size.js` falla con exit 1 si >46080 bytes gzipped. Verificado en `01-VERIFICATION.md:97` (9059 bytes). Toda dependencia nueva debe evaluarse contra este gate.
- **`credentials:'omit'` es contrato con backend**: `sdk/src/transport/sender.ts:29`. Backend Phase 2 valida `X-Watchbug-Key`/`X-Project-Key` en lugar de cookies. Cambiar a `include` rompe `SEC-03`.
- **Screenshot actual es placeholder**: `sdk/src/capture/screenshot.ts:80-89` hace `fillRect` + sanitizer antes de `toDataURL`, no raster real del DOM. Tradeoff aprobado para bundle; si Phase 3+ necesita pixel-perfect, re-evaluar `html2canvas` detrás de feature flag guardando gate.
- **Root `package.json` necesario**: `vitest.config.ts` en raíz requiere `vitest` resoluble desde raíz. Plan original solo listaba `sdk/package.json`, pero `01-01-SUMMARY.md:164` añadió `package.json` raíz como blocking fix. No mover tests a `sdk/`.

---

## Phase 02 — Complete (2026-09-01)

- 4/4 planes ejecutados: `02-01` Tracer Backend, `02-02` Auth, `02-03` Security Hardening, `02-04` Retrieval & Status
- Verificación: `02-VERIFICATION.md` — 20/20 must-haves verified, 65 pytest green, 0 gaps
- **Deviations auto-fixed** (no dead-ends):
  1. Pydantic TRN-04 validator not firing — fixed with `validate_default=True` (Plan 01)
  2. SQLAlchemy JSONB compile error on SQLite — fixed using generic `Uuid`/`JSON` models (Plan 01)
  3. Docker Desktop Windows asyncpg host networking broken — workaround docker network + sqlite fallback (Plan 01)
  4. SQLite in-memory isolation with NullPool — switched to file fallback (Plan 01)
  5. List lazy-load N+1 on deferred BYTEA — fixed via `inspect(state.unloaded)` (Plan 04)
  6. Invalid filter values silently returning 200 — fixed via upfront `ValueError->422` (Plan 04)
- **Notas de continuidad**:
  - SQLite file fallback en `conftest.py` — tests corren en host sin Docker real; real PG verificado via docker network
  - `--workers 1` requerido por slowapi in-memory limiter (no multi-worker safe)
  - BYTEA list/detail split probado: `load_only` excluye screenshot en list, `data:image/png;base64` re-encode en detail
  - `X-Watchbug-Key` (primary) + `X-Project-Key` (fallback) dual header verified
  - `.env.example` documenta los 11 campos de Settings; `.env` nunca se commitea

---

## Phase 03 — Complete (2026-09-02)

- 3/3 planes ejecutados: `03-01` Tracer Scaffold + Vite + FastAPI Mount, `03-02` Incident List, `03-03` Detail View
- Verificación: `03-VERIFICATION.md` — 43 tests pass, build 8.18kB gzipped, 0 innerHTML
- **Deviations auto-fixed** (no dead-ends):
  1. Vite base ./ with outDir ../backend/api/static/panel — avoids 404 at /panel/assets when mounted at subpath
  2. Hash routing only — avoids FastAPI fallback, probe+refresh guard never reads HttpOnly cookie
  3. Badge classes use allowlist fallback — prevents class injection XSS
  4. Skeleton 5 rows colSpan optimization — keeps 5 shimmer count predictable vs 20
- **Notas de continuidad**:
  - Panel builds INTO `backend/api/static/panel/` — Dockerfile Node stage replicates this exact flow
  - Hash routing only (`/#/`, `/#/detail/:id`) — no server-side routing needed
  - All user-generated content rendered as escaped text (textContent, not innerHTML) — SEC-05
  - Status PATCH optimistic via select change + toast + localStorage + CustomEvent
  - List optimistic overlay getCachedStatus + event patch visible row without refetch

---

## Phase 04 — Complete (2026-09-08)

- 2/2 planes ejecutados: `04-01` Tracer Multi-Stage Dockerfile + Compose + Entrypoint, `04-02` .env.example + Persistence Docs + down -v Contract
- Verificación: `04-VERIFICATION.md` — 5/5 must-haves verified, DEP-01 through DEP-05 satisfied
- **Deviations auto-fixed** (no dead-ends):
  1. Added `PYTHONPATH=/app` to fix Alembic ModuleNotFoundError in container (Plan 01)
  2. Remapped db port to 5433:5432 to avoid host PostgreSQL conflict (Plan 01)
  3. Uncommented POSTGRES_* and PORT in .env.example to meet >=14 active key gate (Plan 02)
  4. Made env_file optional via `required: false` so compose config works without .env (Plan 02)
- **Notas de continuidad**:
  - Single multi-stage Dockerfile: Node 22-alpine builder → Python 3.12-slim runtime per D-01
  - PostgreSQL pinned to `postgres:16-alpine` per D-02 — not `:latest` or `:16`
  - Entrypoint runs `alembic upgrade head` before `exec uvicorn --workers 1` per D-03
  - Non-root user app (UID 10001) with curl for HEALTHCHECK
  - .dockerignore excludes .env, node_modules, .git — build context 674B
  - docker-compose.yml: Compose Spec (no version:), health-gated depends_on, loopback port binding
  - env_file optional via `required: false` — compose config works with or without .env
  - README documents volume lifecycle: `down` keeps pgdata, `down -v` destroys
  - Health probe contract: 200-always with curl -f, strict python -c alternative documented

---

## Protocolo para futuros agentes

1. **Leer este archivo al inicio de sesión** (Anti-Amnesia).
2. **Al fallar algo**: escribir Dead-End aquí con formato de arriba **antes** de probar la siguiente alternativa.
3. No agrupar dead-ends al final. No omitir `Evidence` concreto (mensaje de error, medida de bundle, test fail).

*Última actualización: 2026-09-08 — Phase 04 complete (Docker deployment 2/2 plans, 5/5 must-haves verified, all 4 phases complete)*
