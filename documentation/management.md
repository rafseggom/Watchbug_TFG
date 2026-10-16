# Management — Gestión del repositorio, el board y las issues

> **Fuente canónica viva** de *cómo* gestionamos GitHub y el repo. Última revisión: **2026-10-16**.
>
> Este documento son **reglas y procedimientos**, no un retrato del estado actual. La foto viva del trabajo está en `.planning/` (fases, requisitos, orden de ejecución) y en GitHub (issues, milestones, board); aquí solo está *cómo se opera* sobre ellos. Cuando algo se desfasa, **se corrige el artefacto vivo, no este documento**.
>
> `continuity-pack.md` §6 conserva el registro histórico de la sesión de creación (2026-10-10). Si algo contradice, **manda este documento**.

---

## 1. Principio rector: `.planning/` manda, GitHub es espejo

| Artefacto | Fuente de verdad | Papel de GitHub |
|-----------|------------------|-----------------|
| Qué fases existen, sus goals, requisitos y fechas | `.planning/ROADMAP.md` | Milestone = reflejo del due date de la fase |
| Qué requisitos tiene el proyecto | `.planning/REQUIREMENTS.md` | Se citan en los bodies de las issues |
| Orden de ejecución y desglose de trabajo | `.planning/phases/NN-*/NN-NN-PLAN.md` | **No se refleja en el board** (ver §7.2) |
| Estado real de la implementación | Código + `npm run verify` + `npm run check:size` | El board lo refleja, nunca lo adelanta |

**GSD no toca GitHub por sí solo.** `/gsd-execute-phase` escribe código y `.planning/`; `/gsd-ship` abre una PR; `/gsd-inbox` solo triagea issues entrantes. **Nada en GSD cierra una issue porque su fase terminó.** La sincronización la hace el agente **a petición del propietario, en la frontera de cada fase** (ver §8).

Razón: si el board pudiera quedar desfasado del código, dejaría de ser útil. Así es un **estado derivado de la evidencia**, no una tarea aparte que se descuelga.

---

## 2. El repositorio

- **Repo:** `rafseggom/Watchbug_TFG`. Rama por defecto: **`develop`**.
- **`gh` CLI** autenticado como `rafseggom` (scopes `repo`, `read:org`, `workflow`, `project`). No hay servidor MCP de GitHub en este entorno: **todas las operaciones pasan por `gh`**.
- **Rama por fase:** patrón `gsd/phase-{n}-{slug}` (`{n}` = número de fase, `{slug}` = slug corto de su título). Se crea **desde `develop` ya actualizada** y es donde vive el trabajo de la fase.
- **`develop` no recibe código de fase directamente.** Cada fase entra a `develop` **mediante PR**, revisado con **PR-Lens** (`pr-lens` / `.pr-lens`, ignorado en git).
- **`develop` sí recibe directamente los commits de gobernanza y documentación** (reglas, PRD, ROADMAP, continuidad, este mismo documento). No necesitan rama ni PR: no son trabajo de fase.
- **Ramas legacy** (`docusaurus`, `landingpage`, `first-try-skills`, `gsd/first-trial`, `gsd/second-try`, `gentle/first-try`, `documentation`, `release`, `gh-pages`, `main`): se conservan por historial y **no forman parte del flujo activo**.

---

## 3. Labels

**Convención:** una issue lleva **una** label de tipo, **una** de prioridad y una o varias de área. Las épicas **no** llevan prioridad (son contenedores, no trabajo).

| Grupo | Labels | Uso |
|-------|--------|-----|
| **Área** | `area: sdk` · `area: api` · `area: panel` · `area: contracts` · `area: infra` · `area: docs` | Dónde se toca el código (monorepo: `packages/sdk`, `apps/api`, `apps/panel`, `packages/contracts`) |
| **Prioridad** | `priority: critical` · `high` · `medium` · `low` · `unimportant` | `critical` = bloqueante o decisión cargada de arquitectura |
| **Clasificación** | `epic` · `security` · `blocked` | `epic` solo en las issues épica; `security` = SEC-01..06 / privacidad; `blocked` **siempre junto al estado `Blocked`** |
| **Tipo** | `bug` · `feature` · `documentation` · `testing` · `design` · `research` | `testing` en issues que *son* la puerta de verificación (R-12) |

El inventario vivo es `gh label list`. Si se crea una label nueva, se le asigna grupo aquí; una label que no encaje en ningún grupo es señal de taxonomía mal pensada, no de que falte un grupo.

---

## 4. Milestones: uno por fase

- **Un milestone por fase.** Su **due date es la fecha de cierre de la fase** y es lo que consume `documentation/Gantt.md` como calendario.
- La **descripción del milestone lista sus REQ-IDs**: es el atajo para conocer el alcance de una fase sin abrir el ROADMAP.
- Fechas y alcance mandan en `.planning/ROADMAP.md`; la lista viva se lee en GitHub (`gh api repos/<repo>/milestones --paginate`).
- Los milestones se **cierran al cerrar la fase** (§8.3). Los legacy (Sprint 1/2, Diseño arquitectura, Documentación, Investigación) se conservan solo por historial.

---

## 5. Issues: una épica por fase + issues de trabajo

- **Épicas:** **una por fase**, label `epic`. Su body lleva objetivo, criterios de éxito, riesgos `RSK-*`, fecha y checklist de hijas. Cada hija va **además enlazada como sub-issue nativa** de GitHub, de modo que la épica muestra una barra de progreso real (el checklist markdown es solo lectura humana, no el mecanismo).
- **Issues de trabajo:** varias por fase, cada una con los **REQ-IDs que cubre**, criterios *"Hecho cuando…"*, riesgos, enlace al `ROADMAP.md` y un pie con su épica + milestone.
- **Numeración:** las épicas se crearon como `44 + fase` y las issues de trabajo por bloques consecutivos. Es una **convención de nacimiento, no una regla de mantenimiento**: lo que identifica el trabajo es el **milestone** y el **vínculo con la épica**, no el número.
- **`Blocked` (label + estado):** siempre las dos cosas juntas, y solo cuando la espera es una **decisión externa** (una `Q-*` del PRD o del ROADMAP), no tiempo. La issue bloqueada cita *qué* la desbloquea y *dónde* se decide (p. ej. `/gsd-plan-phase N`).

### 5.1 Las issues NO son requisitos

Es la distinción más importante de este documento:

- Un **REQ-ID** (`ING-01`, `DEP-02`, `WDG-06`…) es un requisito del producto, definido en `REQUIREMENTS.md`. Es la unidad **estable**.
- Una **issue** es una *rebanada de trabajo* que cubre **uno o varios** REQ-IDs a la vez: la unidad **cómoda para un humano**, no un requisito.
- Algunas issues **no cubren ningún REQ** porque son **habilitadoras** (monorepo, size gate, puertas de CI, infraestructura). Se declaran como *"Habilitador (ningún REQ de esta fase)"*.

**El rastreo issue ⇄ requisito va por los REQ-IDs citados en el body de la issue**, no por nada más. Si una issue no cita REQ-IDs, comprueba si es habilitadora antes de darla por incompleta.

---

## 6. El board — Project #3 "Kanban Watchbug TFG"

https://github.com/users/rafseggom/projects/3 · público.

**Campos:** `Status` (single-select), `Assignees`, `Labels`, `Milestone`, `Parent issue`, `Sub-issues progress`, `Linked pull requests`, `Repository`, `Reviewers`, `Created`, `Updated`, `Closed`, `Fase` (iteration), `Start Date`, `End Date`.

**Vistas:** **Kanban** (agrupado por `Status`) y **Roadmap v1** (tabla por milestones). El campo `Fase` (iteration) marca a qué fase pertenece cada item; el orden de las opciones y el agrupamiento de la vista **no se fijan por API** — si se reordena el campo `Status`, confirmar a mano que la vista sigue agrupando por él.

### 6.1 Estados

| Estado | Significado |
|--------|-------------|
| `Backlog` | Aún no es accionable — pertenece a una fase posterior |
| `Ready to start` | Siguiente en cola — la fase está planificada y desbloqueada |
| `In Progress` | Alguien lo está ejecutando ahora |
| `Testing/Review` | Implementado, a la espera de la suite e2e / `check:size` / revisión (R-12: eso **es** la verificación) |
| `Done` | Cumple la Definition of Done **y** la issue está cerrada |
| `Blocked` | Esperando una decisión externa, no tiempo — **siempre** con el label `blocked` |

### 6.2 Cómo se lee el estado del board

**Este documento no guarda un snapshot de la distribución.** Se desfasa por definición; se lee en vivo:

```bash
gh project item-list 3 --owner rafseggom --limit 100 --format json
```

Lo que sí es una **invariante de forma** (y por tanto, un síntoma si no se cumple):

- Las fases futuras están en `Backlog`, la fase en curso en `Ready to start` / `In Progress` / `Testing/Review`, y las cerradas en `Done`.
- Las esperas por decisión externa están en `Blocked` **con** el label `blocked`.
- Un item en `Backlog` **no es un olvido**: significa que aún no es accionable.

---

## 7. Reglas (lecciones ya pagadas)

### 7.1 Las épicas no ocupan la columna de trabajo activo

Una épica es un **contenedor**: su progreso se lee por sub-issues, no por la columna. Vive en `Backlog` aunque su fase esté en curso, y solo pasa a `Done` cuando **todas** sus hijas están cerradas (§8.1).

### 7.2 Las waves **no** van en el board

Se probó un campo `Wave` (single-select) casando issues con las waves de una fase, **se revirtió y se borró el campo**. El motivo, que conviene no repetir:

- Una **issue** se corta por *rebanada de feature* (cómo piensa un humano).
- Una **wave** se corta por *dependencia entre planes* (cómo piensa el executor).
- El cruce es **many-to-many, no 1:1** (una issue abarca varias waves; un plan toca varias issues). Forzar un número por issue **distorsiona la información**.

**Regla resultante:** las waves viven **dentro de `.planning/`** (ROADMAP + PLANs), se regeneran por fase al planificar y **no se filtran al kanban**. El kanban muestra *qué* trabajo hay; el **orden** de ejecución lo decide `.planning/ROADMAP.md`, que es lo que lee `/gsd-execute-phase`.

### 7.3 El join key que ya existe: los REQ-IDs

Cuando se necesite saber **qué issues toca un plan** (o al revés), **no se infiere — se deriva** de los REQ-IDs, que ya están puestos por ambos lados:

- El planner genera en cada `NN-NN-PLAN.md` § *Multi-Source Coverage Audit* una tabla **REQ → plan** para toda la fase.
- Cada issue **cita sus REQ-IDs** en el body (§5.1).

Cruce: `issue → sus REQ-IDs → el plan que los cubre`. Se calcula **en tiempo de cierre desde el estado vivo**, así que no puede desfasarse como desfasaría una tabla guardada.

### 7.4 Toda issue accionable está asignada a quien la ejecuta

En cuanto una issue entra en la cola activa (`Ready to start` en adelante) se asigna a la persona que la va a ejecutar. Es lo que hace legible la columna: *quién* está haciendo *qué*.

---

## 8. Cierre y sincronización

**Fuente de verdad = `.planning/` + evidencia de verificación. El board la refleja, nunca la adelanta.**

> Las **reglas de cierre** (cuándo se cierra una issue) viven canónicamente en **`CONVENTIONS.md`**. Aquí queda el **procedimiento** operativo.

### 8.1 Reglas de cierre (resumen; manda `CONVENTIONS.md`)

- Las issues de una fase **se cierran juntas, al completarse la fase** — no por plan.
- **Nunca se cierra sin evidencia:** `npm run verify` + `npm run check:size` en verde, y los commits + `VERIFICATION.md` como comentario. Regla de oro: **implementar → verificar → cerrar**.
- Una issue cuyos REQ-IDs **se reparten entre varios planes** no se cierra al terminar un plan: **avanza de estado** y se cierra con el resto de la fase.
- Las **habilitadoras sin REQ-ID** se cierran con el plan que las consume, al completarse la fase.
- La **épica** se cierra cuando todas sus hijas están cerradas (checklist y barra de sub-issues al 100 %).
- El **milestone** se cierra con la fase.

### 8.2 Procedimiento de sincronización (a petición, en frontera de fase)

Cuando una fase pase verificación y el propietario pida *"sincroniza GitHub"*, el agente:

1. Cierra **todas** las hijas de la fase, cada una con comentario de evidencia (commits + `VERIFICATION.md`).
2. Cierra la épica (checklist + sub-issues al 100 %).
3. Cierra el milestone de la fase.
4. Mueve los items del Project a `Done` y trae las issues de la **siguiente fase** a `Ready to start`, asignadas a quien las ejecuta (§7.4). Las épicas no se mueven (§7.1).

### 8.3 Automatización del board por el agente

Si se automatiza, que el agente mueva **estado y assignee**, pero:

- **No cierre ciegamente** issues many-to-many (varios REQ-IDs repartidos entre planes) — aplicar §8.1.
- Que ocurra en el paso de cierre GSD (Converge & Record), **empujado por la evidencia** e2e/size-gate, derivando los targets de los REQ-IDs del body en ese momento (§7.3), no desde una tabla guardada.

---

## 9. Comandos útiles (`gh`)

```bash
# Estado del board (campo Status como string plano)
gh project item-list 3 --owner rafseggom --limit 100 --format json

# Sub-issues reales de una épica (no el checklist markdown)
gh api repos/rafseggom/Watchbug_TFG/issues/<EPIC>/sub_issues --jq 'length'

# Enlazar una issue como sub-issue de una épica (requiere node ID, no número)
gh api -X POST repos/rafseggom/Watchbug_TFG/issues/<EPIC>/sub_issues -F sub_issue_id=<node_id>

# Mover un item del board de estado (option-IDs de la tabla de abajo)
gh project item-edit --id <ITEM_ID> --project-id <PROJECT_ID> \
  --field-id <STATUS_FIELD_ID> --single-select-option-id <OPTION_ID>

# Milestones con due dates (los consume el Gantt)
gh api repos/rafseggom/Watchbug_TFG/milestones --paginate

# Campos del board y option-IDs para editar un item
gh project field-list 3 --owner rafseggom --format json
```

⚠ **Aviso de codificación en Windows:** PowerShell redirige a UTF-16 por defecto. Al pasar JSON de `gh` a `node`, usar **pipe** (`gh … | node -e "…"`) en vez de `> archivo.json`, o `node` fallará al parsear el BOM UTF-16. Y `[Console]::OutputEncoding=[Text.Encoding]::UTF8` para que la consola no muestre `???` en tildes (es solo visual; GitHub guarda bien los acentos).

---

## 10. Historial de decisiones de gestión

| Fecha | Decisión |
|-------|----------|
| 2026-10-10 | Sesión de creación: labels, milestones, épicas por fase e issues de trabajo (detalle histórico en `continuity-pack.md` §6). |
| 2026-10-12 | PR legado fuera del board · las épicas **no** ocupan la columna de trabajo activo (§7.1) · issues asignadas a quien las ejecuta (§7.4) · el campo `Wave` se probó y se **revirtió** (§7.2) · los huecos plan↔issue se cubren creando issues, no forzando cierres. |
| 2026-10-16 | Este documento pasa a ser un **manual de reglas** en vez de un retrato del estado: se retiran el snapshot de distribución del board, la tabla de milestones y los recuentos de issues, que ahora se leen en vivo (§6.2). |
