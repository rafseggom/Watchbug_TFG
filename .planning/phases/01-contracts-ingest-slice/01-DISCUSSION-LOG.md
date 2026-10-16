# Phase 1: Contracts & Ingest Slice - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-11
**Phase:** 1-Contracts & Ingest Slice
**Areas discussed:** Origen del project key, Aspecto del panel mínimo, Plan B de multipart, Profundidad del hardening C-4

---

## Origen del project key

**Q1 — ¿Cómo obtiene el developer una clave de proyecto válida en el primer `docker-compose up`?**

| Option | Description | Selected |
|--------|-------------|----------|
| Seed desde .env | `.env.example` documenta `WATCHBUG_PROJECT_KEY`; seed idempotente de la fila `projects` al arrancar; la e2e lee la misma variable | ✓ |
| Script de bootstrap CLI | `npm run bootstrap` crea la fila e imprime la clave | |
| Auto-generar y loguear | El API genera la clave en el primer arranque y la imprime en el log | |

**User's choice:** Seed desde .env
**Notes:** Determinista para la e2e; reemplazado por el CRUD real en Fase 5.

---

**Q2 — ¿Y si la variable no está definida o es placeholder?**

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-fast al arrancar | El API no arranca y explica qué variable falta en `.env` | ✓ |
| Auto-generar si vacía | Genera una aleatoria, la persiste y la imprime en el log | |
| Clave por defecto en .env.example | `.env.example` trae una clave de ejemplo funcional | |

**User's choice:** Fail-fast al arrancar
**Notes:** Nunca puede existir una clave predecible en producción (SEC-04; "fail loud, nunca silencioso").

---

**Q3 — ¿Qué formato usa la project key pública?**

| Option | Description | Selected |
|--------|-------------|----------|
| Prefijo wkbt_ + aleatoria larga | `wkbt_` + 32 bytes base62 (≈190 bits) | ✓ |
| Prefijo wkbt_ + UUIDv4 | `wkbt_` + `crypto.randomUUID()` | |
| Lo decides tú | Formato a elección del research/planner con prefijo identificable | |

**User's choice:** Prefijo wkbt_ + aleatoria larga
**Notes:** Distingue claves Watchbug en logs/secret-scanners; base para la rotación de Fase 5.

*More questions? → Next area.*

---

## Aspecto del panel mínimo

**Q1 — ¿Qué estructura tiene la página mínima del panel en Fase 1?**

| Option | Description | Selected |
|--------|-------------|----------|
| Lista + panel de detalle | Dos columnas: lista + detalle (imagen grande + metadatos) = forma final del triage | ✓ |
| Tabla densa + modal | Tabla con thumbnail; imagen en modal | |
| Solo lista con thumbnail | Detalle completo en Fase 6 | |

**User's choice:** Lista + panel de detalle
**Notes:** Evita rediseño en Fases 5/6.

---

**Q2 — ¿Idioma por defecto del panel?**

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detectar + selector | `navigator.language` → `es*` = es, resto = en; selector persistente | ✓ |
| Inglés por defecto | Inglés + selector visible | |
| Español por defecto | Español + selector | |

**User's choice:** Auto-detectar + selector
**Notes:** RNF-03 sin fricción.

---

**Q3 — ¿Cómo encaramos la base visual?**

| Option | Description | Selected |
|--------|-------------|----------|
| Tokens + light/dark | CSS variables + `prefers-color-scheme` desde la Fase 1 | ✓ |
| Solo light | Tema claro, denso, tipo issue-tracker | |
| Lo decide gsd-ui-phase | Dirección visual completa en el UI-SPEC de esta fase | |

**User's choice:** Tokens + light/dark
**Notes:** Fase 5/6 no tendrá que migrar estilos.

---

**Q4 — ¿Qué ve el developer con el panel vacío?**

| Option | Description | Selected |
|--------|-------------|----------|
| Vacío con curl copiable | Snippet `curl` pre-rellenado con la clave real de la instancia | ✓ |
| Mensaje simple | "No hay reportes todavía" | |
| Botón 'enviar ejemplo' | El panel dispara un envío sintético | |

**User's choice:** Vacío con curl copiable
**Notes:** El estado vacío es el onboarding del producto. El botón descartado por la ruta de ingest "interna" a proteger.

*More questions? → Next area.*

---

## Plan B de multipart

**Q1 — ¿Qué hago si `@fastify/multipart` no funciona con Fastify 5?**

| Option | Description | Selected |
|--------|-------------|----------|
| Versiones → parser propio → consulta | Otra versión del plugin → parser multipart propio → JSON+base64 solo con consulta | ✓ |
| Versiones → JSON+base64 | Otra versión → JSON+base64 (cambio de contrato) | |
| Consultar al primer fallo | Cualquier fallo genera Consultation Request Pack inmediato | |

**User's choice:** Versiones → parser propio → consulta
**Notes:** CA-01 intacto en los dos primeros pasos.

---

**Q2 — ¿Cuándo se ejecuta el smoke-test de multipart?**

| Option | Description | Selected |
|--------|-------------|----------|
| Primer trabajo de la fase | Commit mínimo antes del endpoint de ingest | ✓ |
| Al probar el endpoint | Se descubre con la ruta de ingest completa | |
| En la e2e final | Solo con la subida real de imagen | |

**User's choice:** Primer trabajo de la fase
**Notes:** Cierra el riesgo con coste casi cero.

*More questions? → Next area.*

---

## Profundidad del hardening C-4

**Q1 — ¿Qué nivel de re-encode exige la Fase 1?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sniff + headers; re-encode si es barato | Re-encode solo si el researcher encuentra camino barato | |
| Re-encode obligatorio | Re-codificación real de cada imagen de raíz, consultando dependencias pesadas | ✓ |
| Sniff + headers, sin re-encode | Sin re-codificación; documentar para fase futura | |

**User's choice:** Re-encode obligatorio
**Notes:** ⚠ Dependencia pesada nueva (p. ej. `sharp`) → **consultar al propietario antes de añadirla**; STACK.md rechaza `sharp`/`jimp`.

---

**Q2 — ¿Qué formatos de imagen acepta `/api/incidents` en la Fase 1?**

| Option | Description | Selected |
|--------|-------------|----------|
| Solo PNG + WebP | Exactamente los que produce la captura (R-11) | ✓ |
| PNG + WebP + JPEG | Adelanta los adjuntos manuales de Fase 3 | |
| Lo decides tú | Según lo que `ManualFileCapture` necesite | |

**User's choice:** Solo PNG + WebP
**Notes:** Allowlist mínima desde el día 1; ampliar a JPEG se reconsidera en Fase 3.

---

**Q3 — ¿A qué formato sale la imagen tras el re-encode obligatorio?**

| Option | Description | Selected |
|--------|-------------|----------|
| Mismo formato de entrada | PNG→PNG, WebP→WebP | ✓ |
| Normalizar todo a PNG | Un solo camino de codificación, ficheros más pesados | |
| Lo decides tú | Midiendo pesos reales contra el cap de 2 MB | |

**User's choice:** Mismo formato de entrada
**Notes:** Respeta los caps de A-06 y la promesa de R-11.

*More questions? → Next area (cierre de las 4 áreas).*

---

## the agent's Discretion

No gray area was answered with "you decide". Residual technical latitude left to research/planning: seed mechanism details, Drizzle schema shape, plan decomposition, nginx proxy config (A-10), e2e structure of the CA assertions.

## Deferred Ideas

- **JPEG en la allowlist** — reconsiderar en Fase 3 con `ManualFileCapture`.
- **Panel y ruta de blob autenticados** — DEP-03 completo en Fase 5.
