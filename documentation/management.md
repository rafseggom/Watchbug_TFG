# Management — Gestión del repositorio, el board y las issues

> **Fuente canónica viva** de cómo gestionamos GitHub y el repo. Última revisión: **2026-10-12**.
>
> `continuity-pack.md` §6 documenta la **sesión de creación** del 2026-10-10 (labels, milestones, issues iniciales). Es el registro histórico; **si algo contradice este documento, manda este**. Los cambios operativos de hoy (2026-10-12) están solo aquí.

---

## 1. Principio rector: `.planning/` manda, GitHub es espejo

| Artefacto | Fuente de verdad | Papel de GitHub |
|-----------|------------------|-----------------|
| Qué fases existen, sus goals, requisitos y fechas | `.planning/ROADMAP.md` | Milestone = reflejo del due date de la fase |
| Qué requisitos tiene el proyecto (70 REQ-IDs) | `.planning/REQUIREMENTS.md` | Se citan en los bodies de las issues |
| Orden de ejecución y desglose de trabajo | `.planning/phases/NN-*/NN-NN-PLAN.md` | **No se refleja en el board** (ver §7) |
| Estado real de la implementación | Código + `npm run verify` + `npm run check:size` | El board lo refleja, nunca lo adelanta |

**GSD no toca GitHub por sí solo.** `/gsd-execute-phase` escribe código y `.planning/`; `/gsd-ship` abre una PR; `/gsd-inbox` solo triagea issues entrantes. **Nada en GSD cierra una issue porque su fase terminó.** La sincronización la hace el agente **a petición del propietario, en la frontera de cada fase** (ver §8).

Razón: si el board pudiera quedar desfasado del código, dejaría de ser útil. Así es un **estado derivado de la evidencia**, no una tarea aparte que se descuelga.

---

## 2. El repositorio

- **Repo:** `rafseggom/Watchbug_TFG` · default branch `develop`.
- **`gh` CLI** autenticado como `rafseggom` (scopes `repo`, `read:org`, `workflow`, `project`). No hay servidor MCP de GitHub en este entorno: **todas las operaciones pasan por `gh`**.
- **Rama por fase**, patrón `gsd/phase-{n}-{slug}` (p. ej. `gsd/phase-1-contracts-ingest`). `develop` es la base siempre actualizada; **no se desarrolla directamente en ella**.
- **Cada fase entra a `develop` mediante PR**, revisado con **PR-Lens** (`pr-lens` / `.pr-lens`, ignorado en git).
- Estado en el momento de escribir (2026-10-12): rama actual `gsd/phase-1-contracts-ingest`, **10 commits por delante de `origin/develop`** (planificación de la Fase 1, **sin push**). Existen ramas legacy (`docusaurus`, `landingpage`, `first-try-skills`, `gsd/first-trial`, `gsd/second-try`, `gentle/first-try`, `documentation`, `release`, `gh-pages`, `main`) — **no forman parte del flujo activo**.

---

## 3. Labels (20)

| Grupo | Labels | Uso |
|-------|--------|-----|
| **Área** | `area: sdk` · `area: api` · `area: panel` · `area: contracts` · `area: infra` · `area: docs` | Dónde se toca el código (monorepo: `packages/sdk`, `apps/api`, `apps/panel`, `packages/contracts`) |
| **Prioridad** | `priority: critical` · `high` · `medium` · `low` · `unimportant` | `critical` = bloqueante o decisión cargada de arquitectura |
| **Clasificación** | `epic` · `security` · `blocked` | `epic` solo en las issues épica; `security` = SEC-01..06 / privacidad; `blocked` **siempre junto al estado `Blocked`** |
| **Tipo (preexistentes)** | `bug` · `feature` · `documentation` · `testing` · `design` · `research` | `testing` en issues que *son* la puerta de verificación (R-12) |

**Convención:** una issue lleva **una** de tipo, **una** de prioridad, una o varias de área. Las épicas **no** llevan prioridad (son contenedores, no trabajo).

---

## 4. Milestones = las 7 fases

Un milestone por fase; su **due date es la fecha de cierre de fase** y es lo que consume `documentation/Gantt.md` como calendario.

| # | Milestone | REQs v1 | Due |
|---|-----------|---------|-----|
| 6 | Phase 1 — Contracts & Ingest Slice | 10 | 2026-10-18 |
| 7 | Phase 2 — SDK Tracer Bullet: Widget, Capture & Auto-Redaction | 18 | 2026-10-31 |
| 8 | Phase 3 — Report Composer & Annotation Editor (lazy) | 13 | 2026-11-13 |
| 9 | Phase 4 — Report Payload & Enrichment | 7 | 2026-11-22 |
| 10 | Phase 5 — Secure Admin Access & Projects | 9 | 2026-11-30 |
| 11 | Phase 6 — Triage & Data Lifecycle | 10 | 2026-12-12 |
| 12 | Phase 7 — Resilience & Release Closeout | 3 | 2026-12-24 (buffer 25–31 dic) |

Los milestones legados se cerraron y se conservan solo por historial (`Sprint 1`, `Sprint 2`, `Diseño arquitectura`, `Documentación`). `Investigación` es el milestone del issue `#1` (research, cerrado).

**La descripción de cada milestone lista sus REQ-IDs** — es el atajo para saber el alcance de una fase sin abrir el ROADMAP.

---

## 5. Issues: 7 épicas + 41 issues de trabajo

- **Total real: 49 issues** (48 abiertas + `#1` cerrada). ⚠ Los números `#2`, `#3`, `#4` **no son issues, son PRs** legados fusionados/cerrados — por eso la numeración de issues salta de `#1` a `#5`.
- **Épicas `#45`–`#51`** (una por fase), label `epic`. Body = objetivo, criterios de éxito, riesgos `RSK-*`, fecha, y checklist de hijas. Cada hija está **también enlazada como sub-issue nativa** de GitHub, así la épica muestra barra de progreso (7/7, 6/6 …).
- **Issues de trabajo**, ~5–7 por fase, cada una con: REQ-IDs que cubre, criterios "Hecho cuando…", riesgos, enlace a `ROADMAP.md`, y pie con su épica + milestone.
- **Numeración:** épica = `44 + fase` (Fase 1 → `#45`, Fase 7 → `#51`). Las issues de trabajo de una fase van por bloques: `#5`–`#10` + `#52` = Fase 1, `#11`–`#16` = Fase 2, etc.
- **Blocked (label + estado):** `#33` rotación de clave (espera **Q-07**, se decide en `/gsd-plan-phase 5`) · `#44` cierre de release (espera **Q-05** política IP + re-pin Node tras 2026-10-28).

### 5.1 Las issues NO son requisitos

Es la distinción más importante de este documento:

- Un **REQ-ID** (`ING-01`, `DEP-02`, `WDG-06`…) es un requisito del producto, en `REQUIREMENTS.md`. Son 70 en total.
- Una **issue** es una *rebanada de trabajo* que cubre **varios** REQ-IDs a la vez: `#9` cubre `ING-04`…`ING-08`.
- Algunas issues **no cubren ningún REQ** porque son habilitadoras: `#5` (monorepo + size gate) se declara sola: *"Habilitador (ningún REQ de esta fase)"*.

**El rastreo issue ⇄ requisito va por los REQ-IDs citados en el body de la issue**, no por nada más. Si una issue no cita REQ-IDs, comprueba si es habilitadora antes de darla por incompleta.

---

## 6. El board — Project #3 "Kanban Watchbug TFG"

https://github.com/users/rafseggom/projects/3 · público.

**Campos:** `Status` (single-select), `Assignees`, `Labels`, `Milestone`, `Parent issue`, `Sub-issues progress`, `Linked pull requests`, `Repository`, `Reviewers`, `Created`, `Updated`, `Closed`.

**Vistas:** **Kanban** (agrupado por `Status`) y **Roadmap v1** (tabla por milestones).

### 6.1 Estados

| Estado | Significado |
|--------|-------------|
| `Backlog` | Aún no es accionable — pertenece a una fase posterior |
| `Ready to start` | Siguiente en cola — la fase está planificada y desbloqueada |
| `In Progress` | Alguien lo está ejecutando ahora |
| `Testing/Review` | Implementado, a la espera de la suite e2e / `check:size` / revisión (R-12: eso **es** la verificación) |
| `Done` | Cumple la Definition of Done **y** la issue está cerrada |
| `Blocked` | Esperando una decisión externa, no tiempo — **siempre** con el label `blocked` |

⚠ **Cosmético pendiente:** `Blocked` se añadió por API *después* de `Done` en el orden de opciones; arrástralo a la izquierda de `Done` en el editor de campo. El agrupamiento de la vista Kanban no se puede fijar por API — confirmar a mano que agrupa por `Status`.

### 6.2 Distribución actual (2026-10-12)

Fase 1, la única planificada:

| Issue | Status | Assignee |
|-------|--------|----------|
| `#5` Monorepo + size gate | Ready to start | rafseggom |
| `#6` Contrato Zod 4 | Ready to start | rafseggom |
| `#7` docker-compose 3 servicios | Ready to start | rafseggom |
| `#8` Endpoint de ingesta | Ready to start | rafseggom |
| `#9` Hardening (caps, rate limit, CORS) | Ready to start | rafseggom |
| `#10` Panel mínimo + suite e2e | Ready to start | rafseggom |
| `#52` Panel first-run (i18n, onboarding, render inerte) | Backlog | rafseggom |
| `#45` Épica Fase 1 | Backlog | rafseggom |

El resto de fases: `Backlog`. `#33` y `#44`: `Blocked`. `#1`: `Done`.

---

## 7. Decisiones de gestión de 2026-10-12 (y sus lecciones)

Registro de cuatro cambios aplicados y, sobre todo, del **error** que corrigieron — conviene no repetirlo.

### 7.1 Cambios aplicados

1. **PR `#2` "Phase 4: Docker Deployment" eliminado del board.** Era un PR fusionado legado de un estado anterior del repo; su título contradecía la Fase 4 real. Ruido en `Done`.
2. **Issues de la Fase 1 asignadas a `rafseggom`** (quien las ejecuta).
3. **Épica `#45` bajada a `Backlog`** — las épicas no ocupan la columna de trabajo activo; su progreso se ve por sub-issues.
4. **Issue `#52` creada** (Fase 1, `Backlog`, sub-issue de `#45`): el plan `01-04-PLAN.md` entrega i18n del panel en/es, estado vacío con curl onboarding y `GET /api/setup`, y **ninguna de las 6 issues originales cubría eso**. Hueco real plan↔issue. Nota: su alcance viene de las decisiones `P1-D-05`/`P1-D-07`, que **no son REQ-IDs de fase** — por eso se mantuvo en `Backlog` y no en la cola activa.

### 7.2 Lección: las waves **no** van en el board

Se creó un campo `Wave` (single-select 1–4) y se rellenó casando issues con las 4 waves de la Fase 1. **Se revirtió y se borró el campo.** El motivo, que conviene recordar:

- Una **issue** se corta por *rebanada de feature* (cómo piensa un humano).
- Una **wave** se corta por *dependencia entre planes* (cómo piensa el executor: `01-01 → 01-02 → 01-03 → 01-04`).
- El cruce es **many-to-many, no 1:1**: `#9` abarca las waves 2, 3 y 4; el plan `01-01` toca cinco issues distintas. Forzar un número por issue **distorsiona la información** (decir "Wave 2" de `#9` oculta que se arrastra hasta la 4).

Además, **las waves solo existen para la Fase 1** porque es la única planificada. En el ROADMAP, las fases 2–7 siguen con `Plans: TBD`. Inventar waves para el resto sería ficción.

**Regla resultante:** las waves viven **dentro de `.planning/`** (ROADMAP + PLANs), se regeneran por fase al planificar, y **no se filtran al kanban**. El kanban muestra *qué* trabajo hay; el **orden** de ejecución lo decide `.planning/ROADMAP.md`, que es lo que lee `/gsd-execute-phase`.

### 7.3 El join key que ya existe: los REQ-IDs

Cuando se necesite saber **qué issues toca un plan** (o al revés), **no se infiere — se deriva** de los REQ-IDs, que ya están puestos por ambos lados:

- El planner genera en `01-01-PLAN.md` § *Multi-Source Coverage Audit* una tabla **REQ → plan** para toda la fase (p. ej. `ING-06 → 01-02`, `ING-07 → 01-04`).
- Cada issue **cita sus REQ-IDs** en el body (§5.1).

Cruce: `issue → sus REQ-IDs → el plan que los cubre`. Se calcula **en tiempo de cierre desde el estado vivo**, así que no puede desfasarse como desfasaría una tabla guardada.

---

## 8. Reglas de cierre y sincronización

**Fuente de verdad = `.planning/` + evidencia de verificación. El board la refleja, nunca la adelanta.**

### 8.1 Cuándo se cierra una issue

Decisión del propietario (2026-10-10, refinada 2026-10-12):

- Las issues de una fase **se cierran juntas, al completarse la fase** — no por plan. Una fase es una prueba e2e completa según la DoD del PRD.
- **Nunca se cierra sin evidencia:** `npm run verify` + `npm run check:size` en verde, y los commits + `VERIFICATION.md` como comentario. Regla de oro: **implementar → verificar → cerrar**.
- El epic se cierra cuando todas sus hijas están cerradas (checklist y barra de sub-issues al 100 %).
- El milestone se cierra con la fase.

### 8.2 Cierre por REQ-IDs (convención propuesta — pendiente de formalizar)

Refinamiento derivado de §7.3, **aún no escrito en `CONVENTIONS.md`** (ese archivo está vacío; proponente: sesión 2026-10-12, pendiente de aprobación del propietario):

> Una issue se **cierra** cuando **todos** los REQ-IDs que cita están cubiertos por planes completados. Si sus REQ-IDs se reparten entre varios planes, se **avanza el estado, no se cierra**. Las habilitadoras sin REQ (`#5`) se cierran con el plan que las consume.

Con esta regla, `#8` deja de ser trampa: tras el plan `01-01` su storage+idempotencia está hecho pero el endurecimiento no — "avanzar" es correcto, "cerrar" sería mentira.

### 8.3 Procedimiento de sincronización (a petición, en frontera de fase)

Cuando una fase pase verificación y se pida *"sincroniza GitHub"*, el agente:

1. Cierra **todas** las hijas de la fase, cada una con comentario de evidencia (commits + `VERIFICATION.md`).
2. Cierra la épica (checklist + sub-issues al 100 %).
3. Cierra el milestone de la fase.
4. Mueve los items del Project a `Done` y trae las issues de la siguiente fase a `Ready to start`.

### 8.4 Automatización del board por el agente

Si se automatiza, que el agente mueva **estado y assignee**, pero:

- **No cierre ciegamente** issues many-to-many (varios REQ-IDs repartidos entre planes) — aplicar §8.2.
- Que ocurra en el paso de cierre GSD (Converge & Record), **empujado por la evidencia** e2e/size-gate, derivando los targets de los REQ-IDs del body en ese momento (§7.3), no desde una tabla guardada.

---

## 9. Comandos útiles (`gh`)

```bash
# Estado del board (campo Status como string plano)
gh project item-list 3 --owner rafseggom --limit 100 --format json

# Sub-issues reales de una épica (no el checklist markdown)
gh api repos/rafseggom/Watchbug_TFG/issues/45/sub_issues --jq 'length'

# Enlazar una issue como sub-issue de una épica (requiere node ID, no número)
gh api -X POST repos/rafseggom/Watchbug_TFG/issues/45/sub_issues -F sub_issue_id=<node_id>

# Milestones con due dates (los consume el Gantt)
gh api repos/rafseggom/Watchbug_TFG/milestones --paginate

# Campos del board y option-IDs para editar un item
gh project field-list 3 --owner rafseggom --format json
```

⚠ **Aviso de codificación en Windows:** PowerShell redirige a UTF-16 por defecto. Al pasar JSON de `gh` a `node`, usar **pipe** (`gh … | node -e "…"`) en vez de `> archivo.json`, o `node` fallará al parsear el BOM UTF-16. Y `[Console]::OutputEncoding=[Text.Encoding]::UTF8` para que la consola no muestre `???` en tildes (es solo visual; GitHub guarda bien los acentos).
