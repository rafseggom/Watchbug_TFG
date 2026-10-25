<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Informe de análisis — rama `gsd/phase-2-sdk-tracer-bullet`

| | |
|---|---|
| **Fecha (análisis)** | 2026-10-24 |
| **HEAD** | `9c0c089` — *test(02): persist human verification items as UAT* |
| **Base de comparación** | `origin/develop` → `2686e15` |
| **Árbol de trabajo** | **sin cambios de contenido** al empezar y al terminar. `git status --porcelain` devuelve en ambos momentos las **mismas 2 entradas**: `schema/report.schema.json` (*stat-dirty* por la conversión LF→CRLF — `git diff` vacío, mismo blob en índice y árbol) y el directorio sin seguimiento `watchbugus-fun/`, **no creado por este análisis**. Nada se modificó, nada se confirmó |
| **Alcance** | **19 ficheros** filtrados de **54** crudos — `git diff --name-only origin/develop...HEAD` + `<scope_filter>` (ver **§1.1**) |
| **Modo** | **Análisis / guidance** — sin modificar código, sin commit |
| **Ejecución del objetivo** | ninguna (sin `npm test`, sin `npm run verify`, sin Playwright, sin servidores, sin red). Único contacto con ejecutable: **medición estática** de artefactos ya construidos en `packages/sdk/dist/` |
| **Auditoría de dependencias** | `git diff -- '*package.json' '*lock*'` → **sin cambios de manifiestos** (ver **§5** del flujo: auditoría global única) |
| **Fecha (remediación)** | 2026-10-24 |
| **HEAD (tras remediación)** | `12a5049` — *fix(02): close the six findings of the remediation regression pass* (sobre `0c6565f`, la primera tanda) |
| **Modo (remediación)** | `/gsd-code-review 02 --fix` — correcciones aplicadas y verificadas en dos tandas; ver **§8** |
| **Ejecución (tras remediación)** | `npm run verify` **309/309** (chromium + firefox + webkit) · `lint` · `check:size` · `gate.mjs` · `check:compose` · `stopthatslop --pack ts` **0 findings / exit 0** — todo en verde |
| **Hallazgos del code review** | `02-REVIEW.md` (9: 3 critical · 3 warning · 3 info) **y** `02-REVIEW-FIX.md` (6: 2 critical · 2 warning · 2 info, el pase de regresión sobre la remediación) → **`02-REVIEW-DISPOSITION.md` 15/15 resueltos** |

---

## 0. Resumen ejecutivo

| Lente | Herramienta | Resultado | Veredicto |
|---|---|---|---|
| **Slop** | `stopthatslop_cli check --pack ts --format json` (pack `stopthatslop-ts-node-v1`) | **`passed: true`, `gate_finding_count: 0`, `teach_only_finding_count: 0`, `exit 0`** sobre 9 reglas *checker* | ✅ **Cero slop** en los 19 ficheros del alcance |
| **Complejidad** | Script propio sobre `ts.createSourceFile` (no hay eslint/radon/lizard en el repo) | **304 funciones** · media **2,07** · máx **19** · **3** con CC ≥ 16, **1** en 11-15, **18** en 6-10 | 🟠 Muy sano en conjunto (92,8 % CC ≤ 5), con **3 focos "dividir" concentrados en el SDK de producto** |
| **Seguridad** | `security-review` estático, fuente primero, un fichero a la vez (STRIDE) | **5 confirmados**: 3 *low* · 2 *informational* · 0 medium/high · **11 `needs_validation`** | 🟡 Ninguna vulnerabilidad explotable de alto rango; el hallazgo más relevante es un **hueco de cobertura del escáner de redacción** |

**Prioridad de remediación posterior (§5):**

1. **P1 — El escáner de redacción sólo recorre el light DOM** (`redactor.ts:85/91/103`): secretos visibles dentro de **raíces de sombra abiertas** o **iframes de mismo origen** llegan sin enmascarar a los píxeles enviados. Es la porción *alcanzable* de la clase T-02-08 (los iframes de origen cruzado ya están aceptados como T-02-14/AR-01). Fix de ~15 líneas + fila e2e.
2. **P1 — El endpoint por defecto es el origen del script cargado** (`index.ts:63-66, 79-87`): en la integración IIFE servida desde un CDN, la captura sale hacia el dominio del CDN. Asunción *first-party* documentada, pero sin aviso ni exigencia de `endpoint`.
3. **P2 — Complejidad**: dividir `render` (CC 18), `collectMaskRects` (CC 17) y `capture()` (CC 15) — los tres en banda **15+ → dividir sin discusión**, todos en código de producto.
4. **P3 — Hallazgos informativos**: el bundle de e2e `watchbug.e2e.*` (`SHADOW_MODE='open'`) se emite en el mismo `dist/` **sin ningún gate que impida desplegarlo** (`build.mjs:83-98`), y el fallback de la clave de idempotencia usa `Math.random()` (`pipeline.ts:127-133`).
5. **P3 — Test-only**: la clave de proyecto se concatena en un literal JS/HTML sin validar su formato (`host-fixtures.ts:50-59`).

> **Estado (2026-10-24, tras remediación `12a5049`):** este resumen describe el análisis original sobre `9c0c089`. **Todo lo prioritario está corregido** — S-7, S-8, I-2, S-9, I-1 y los tres focos de complejidad C-4/C-5/C-6 están **resueltos**, y los tres focos `15+` de código de producto bajaron a CC 6 / 2 / 7 (hoy ninguna función de producto está por encima de CC 10). Además `/gsd-code-review 02 --fix` cerró los **7 hallazgos abiertos de `02-REVIEW.md`** (CR-03, WR-01, WR-02, WR-03, IN-01, IN-02, IN-03) **y** los 6 que un pase de regresión encontró en la propia remediación (`02-REVIEW-FIX.md`, FX-01…FX-06): **15/15 resueltos**. Quedan abiertos únicamente 8 `needs_validation` de despliegue (§4.2) y los focos 6-10 que no se tocaron (C-7). Detalle, evidencia y verificación en **§8**.

---

## 1. Metodología y límites

### 1.1 Qué se hizo

| # | Acción | Comando / modo |
|---|---|---|
| 1 | **Alcance** | `git branch --list "gsd/phase-2-*"` → `gsd/phase-2-sdk-tracer-bullet` (rama actual) · base `origin/develop` (verificada con `git rev-parse --verify`) · `git diff --name-only origin/develop...HEAD` → **54 crudos** · filtro `<scope_filter>` → **19** (excluidos 33 de `.planning/**`, 1 de `documentation/**`, 1 de `e2e/fixtures/**`). También `git diff --name-only` y `--cached` para cambios sin confirmar: **ninguno**. |
| 2 | **Índice de grafo** | `list_projects` / `index_status` / `get_architecture` (proyecto `E-Proyectos-Github-Watchbug_TFG`, 2 648 nodos, 3 869 aristas) y **`check_index_coverage` con las 19 rutas** → `signal: best_effort`, todas `no_recorded_issue` pero con `freshness: metadata_changed` → **acción recomendada: leer fuente**. Cumplida: todo el análisis se apoya en lectura de fuente, no en el grafo (ver **§6**). |
| 3 | **Slop** | `python -m stopthatslop_cli check --repo-root "E:\Proyectos Github\Watchbug_TFG" --pack ts --format json` |
| 4 | **Complejidad** | Script propio sobre la API de `ts.createSourceFile` (sin typecheck), usando el `typescript` instalado en el motor del detector (`E:\Proyectos Github\stopthatslop\checkers\tsast`), ejecutado **sólo sobre los 19 ficheros** del alcance |
| 5 | **Seguridad** | `security-review` estático, fuente primero: **un fichero leído → tres lentes → scratch → descarte del contenido**, en secuencia (nunca varios ficheros en paralelo) |
| 6 | **Auditoría global de dependencias** | `git diff origin/develop...HEAD -- '*package.json' '*lock*'` → **vacío** + una única pasada transversal de `security-audit` en modo *guidance* sobre el código de la fase |

### 1.2 Reglas de conteo de complejidad (§3)

`CC = 1 + puntos de decisión`, contando: `if` (incluidos `else if`), `for`/`for in`/`for of`, `while`, `do while`, `case` y `default`, `catch`, ternario `? :`, y los operadores `&&` / `||` (`??` **no** cuenta). Cada punto de decisión pertenece a la función que lo contiene de forma más interna: **una función anidada se mide aparte y no infla a la externa**. Umbrales del skill: 1-5 *ok* · 6-10 *vigilar* · 11-15 *refactorizar ya* · **15+ *dividir sin discusión***.

> **Nota de honestidad sobre el método:** la primera pasada del script **no contaba `&&`/`||`** (nombre de enumeración erróneo en el propio script: `AmpersandAmpersand` en lugar de `AmpersandAmpersandToken`). Se detectó al contrastar un recuento con el código, se corrigió y **se re-ejecutó la medición completa**. Todas las cifras de §3 son de la **segunda pasada ya corregida** (304 funciones, media 2,07): la primera daba media 1,84 y máx 15, y **quedó descartada**. Los ficheros `.d.ts` y la configuración de Playwright **no declaran funciones**, así que se reportan con `CC n/a` (y CC = 1 si se contara el módulo como unidad).

### 1.3 Qué NO cubre este informe

- **No es un full audit.** No hay ledger de cobertura, ni oleadas de caza, ni validadores `findings.json`, ni verificación independiente de registros. **No existe ninguna auditoría previa de esta rama**, así que no hay registros que arrastrar: **una sola pasada, no exhaustiva.**
- **No se ejecutó el código del objetivo** (regla del skill): sin `npm run verify`, sin Playwright, sin servidores, sin red. Ninguna aseveración de seguridad se apoya en una prueba en vivo.
- **Sin control positivo del detector de slop.** A diferencia de la fase 1, **no se creó un fichero sonda** en el repositorio para demostrar que el checker detecta (habría sido una edición fuera del flujo GSD del repo). El verde de §2 es por tanto *"0 hallazgos"*, no una prueba de sensibilidad — declarado como limitación en **§6**.
- **Métricas sobre artefactos ya construidos.** Los tamaños gz de §4.4 proceden de leer `packages/sdk/dist/` con `node:zlib`; **no** se ejecutó `npm run build` ni `npm run check:size`.
- Hechos que viven **fuera** del alcance (puertos reales del despliegue, CORS de producción, si `scripts/gate.mjs` corre en CI, qué ficheros copia la imagen Docker) se clasifican como `needs_validation` (§4.2) y **no tienen severidad**.
- Ficheros **citados pero no auditados** (fuera de la fase 2): `scripts/gate.mjs`, `scripts/check-size.mjs`, `apps/api/**`, `apps/panel/**`, `packages/contracts/**`, `e2e/fixtures/hostile-host.html`, `e2e/hostile.spec.ts`, `e2e/global-setup.ts`, `.github/workflows/**`.

---

## 2. Slop de código — `stopthatslop`

**Pack:** `stopthatslop-ts-node-v1`.
**Resultado (sobre `9c0c089`):** `passed: true`, `finding_count: 0`, `gate_finding_count: 0`, `teach_only_finding_count: 0`, `exit 0`.

**Las 9 reglas activas de la ejecución** (todas con enforcement *checker*; `not_covered: []`):

| # | Regla | Estado en los 19 ficheros |
|---|---|---|
| 1 | `typescript.http.no-fetch-without-abort-timeout` | 0 findings — el único `fetch` del SDK (`transport/lane1.ts:141`) lleva `AbortController` + `signal` con timeout de 15 s |
| 2 | `typescript.web.no-node-builtin-in-client-module` | 0 findings |
| 3 | `typescript.react.no-mixed-controlled-uncontrolled` | 0 findings (no hay React en el SDK) |
| 4 | `typescript.express.no-empty-catch-in-route-handler` | 0 findings (no hay route handlers en el alcance) |
| 5 | `typescript.security.no-unvalidated-external-href` | 0 findings (el SDK no crea enlaces) |
| 6 | `typescript.reliability.no-unguarded-json-parse-on-external-input` | 0 findings |
| 7 | `typescript.correctness.no-or-default-for-nonzero-number` | 0 findings |
| 8 | `typescript.performance.no-eager-heavy-dependency-import` | 0 findings (el SDK no tiene dependencias runtime que importar) |
| 9 | `typescript.ui.no-orphaned-effect-timeouts` | 0 findings |

**Alcance del escaneo:** el CLI corre sobre **todo el repositorio**, no por fichero; su salida 0 significa **0 hallazgos también en los 19 ficheros**. No hay filtro por fichero que aplicar.

### 2.1 Observaciones manuales fuera del pack (no gatean)

Son comentarios de revisión, **no findings del detector**:

| Fichero:línea | Observación | Por qué no es hallazgo |
|---|---|---|
| `e2e/deploy.spec.ts:85` | `bootWith()` no pone timeout al proceso hijo | Riesgo de test (colgaría hasta el timeout global de Playwright), no de seguridad |
| `e2e/helpers/capture-stubs.ts:160,163` | `catch` vacíos en la instrumentación de `fetch` | Justificados por comentario ("instrumentation must never break the send"); sólo ocultan fallos del propio stub |
| `e2e/helpers/capture-stubs.ts:47,115,141,445` | Código generado con `String(function)` / `String.raw` | Frágil si la función cierra sobre módulo, pero hoy no lo hace |
| `e2e/sdk.spec.ts:339,2204` | `JSON.parse` sin `try` sobre respuestas propias | Entrada generada por el propio test: si falla, el test revienta ruidosamente |
| `e2e/helpers/host-fixtures.ts:241` | `JSON.parse` sin `try` sobre atributo DOM | Ídem |
| `packages/sdk/src/redact/patterns.ts:19-20` | Trampa `Beare[r]` para el gate *line-based* | Documentada en el propio fichero: deuda de mantenimiento anotada |
| `packages/sdk/src/image/encode.ts:4-9` | "no nombres la API de codificación en comentarios" | El gate cuenta texto incluyendo comentarios; documentado |

### 2.2 Lo que este lente NO detecta

Sólo mira el pack `ts` (9 reglas). **No dice nada sobre seguridad ni sobre complejidad** — por eso los otros dos lentes son necesarios. Además, `coverage` vino como `null` en la salida JSON: el detector no informó de su propio grado de cobertura.

---

## 3. Complejidad ciclomática

**Sin herramienta estándar instalada** (no hay `eslint`, `radon`, `lizard` ni `gocyclo`), así que se aplicó la rama *"count manually, per function, show the count"* mediante un script de análisis estático (ver §1.2, incluida la corrección del método).

### 3.1 Distribución global

| Funciones | Media CC | Máximo | 1-5 *ok* | 6-10 *vigilar* | 11-15 *ya* | 15+ *dividir* |
|---|---|---|---|---|---|---|
| **304** | **2,07** | **19** | 282 (92,8 %) | 18 | 1 | **3** |

**Veredicto:** el alcance está muy por encima de la media en salud — 92,8 % de las funciones por debajo de CC 6. El problema no es difuso: **está concentrado en 3 funciones del SDK de producto**, y una cuarta (CC 19) vive en el fichero de test.

### 3.2 Hotspots (los que requieren acción)

**Código de producto:**

| CC | LOC | Función | Fichero:línea | Umbral |
|---|---|---|---|---|
| **18** | 90 | arrow `render(view)` | `packages/sdk/src/widget/status-panel.ts:281` | 🔴 15+ → dividir |
| **17** | 52 | `collectMaskRects` | `packages/sdk/src/redact/redactor.ts:81` | 🔴 15+ → dividir |
| **15** | 97 | `capture()` (método de la costura) | `packages/sdk/src/capture/capture-source.ts:113` | 🔴 15+ → dividir |
| 10 | 32 | `blankProbe` | `packages/sdk/src/capture/pipeline.ts:56` | 🟡 vigilar (borde alto) |
| 9 | 36 | `encodeLadder` | `packages/sdk/src/image/encode.ts:165` | 🟡 vigilar |
| 8 | 17 | `luhnValid` | `packages/sdk/src/redact/patterns.ts:76` | 🟡 vigilar |
| 7 | 12 | `readServerMessage` | `packages/sdk/src/transport/lane1.ts:104` | 🟡 vigilar |
| 6 | 72 | `runFromGesture` | `packages/sdk/src/capture/pipeline.ts:180` | 🟡 vigilar |
| 6 | 16 | `resolveOptions` | `packages/sdk/src/index.ts:89` | 🟡 vigilar |
| 6 | 10 | `textMatchesFamily` | `packages/sdk/src/redact/redactor.ts:65` | 🟡 vigilar |
| 6 | 28 | `fillRects` | `packages/sdk/src/redact/redactor.ts:135` | 🟡 vigilar |
| 6 | 12 | `readCreatedId` | `packages/sdk/src/transport/lane1.ts:117` | 🟡 vigilar |
| 6 | 47 | `postOnce` | `packages/sdk/src/transport/lane1.ts:131` | 🟡 vigilar |

**Ficheros de test (medidos, no incluidos en el plan de refactor):**

| CC | LOC | Función | Fichero:línea | Umbral |
|---|---|---|---|---|
| 19 | 52 | arrow `readControlProof` (`switch` de 6 variantes) | `e2e/sdk.spec.ts:1024` | 🔴 15+ (test) |
| 9 | 41 | arrow `evaluate` de `probeWidget` | `e2e/helpers/capture-stubs.ts:506` | 🟡 vigilar |
| 9 | 33 | arrow `evaluate` de `probeHost` | `e2e/helpers/capture-stubs.ts:626` | 🟡 vigilar |
| 8 | 25 | arrow `evaluate` de `analyzeImagePixels` | `e2e/sdk.spec.ts:84` | 🟡 vigilar |
| 7 | 159 | test `PRV-05` | `e2e/sdk.spec.ts:2030` | 🟡 vigilar |
| 6 | 61 | `paintFrame` | `e2e/helpers/capture-stubs.ts:47` | 🟡 vigilar |
| 6 | 37 | `openHostileFixture` | `e2e/helpers/host-fixtures.ts:193` | 🟡 vigilar |
| 6 | 17 | arrow `evaluate` de `installSecrets` | `e2e/sdk.spec.ts:1340` | 🟡 vigilar |
| 6 | 31 | `runRedactionRow` | `e2e/sdk.spec.ts:1565` | 🟡 vigilar |

### 3.3 Por fichero (media CC · focos ≥ 6)

| Media | Máx | Funcs | Fichero | Focos |
|---|---|---|---|---|
| **4,5** | 17 | 8 | `packages/sdk/src/redact/redactor.ts` | `collectMaskRects=17`, `fillRects=6`, `textMatchesFamily=6` |
| **3,0** | 18 | 13 | `packages/sdk/src/widget/status-panel.ts` | `render=18` |
| 3,0 | 10 | 12 | `packages/sdk/src/capture/pipeline.ts` | `blankProbe=10`, `runFromGesture=6` |
| 3,0 | 7 | 11 | `packages/sdk/src/transport/lane1.ts` | `readServerMessage=7`, `readCreatedId=6`, `postOnce=6` |
| 3,0 | 3 | 2 | `packages/sdk/src/redact/geometry.ts` | — |
| 3,0 | 3 | 1 | `packages/sdk/src/strings.ts` | — |
| 2,7 | 9 | 12 | `packages/sdk/src/image/encode.ts` | `encodeLadder=9` |
| 2,8 | 8 | 6 | `packages/sdk/src/redact/patterns.ts` | `luhnValid=8` |
| 2,3 | 15 | 15 | `packages/sdk/src/capture/capture-source.ts` | `capture=15` |
| 2,6 | 9 | 23 | `e2e/helpers/capture-stubs.ts` | `probeWidget=9`, `probeHost=9`, `paintFrame=6` |
| 2,2 | 6 | 10 | `packages/sdk/src/index.ts` | `resolveOptions=6` |
| 1,9 | 4 | 11 | `packages/sdk/src/widget/host.ts` | — |
| 1,8 | 6 | 14 | `e2e/helpers/host-fixtures.ts` | `openHostileFixture=6` |
| 1,6 | 19 | 147 | `e2e/sdk.spec.ts` | `readControlProof=19`, `analyzeImagePixels=8`, `PRV-05=7`, `installSecrets=6`, `runRedactionRow=6` |
| 1,5 | 2 | 6 | `packages/sdk/src/widget/launcher.ts` | — |
| 1,2 | 3 | 13 | `e2e/deploy.spec.ts` | — |
| — | — | 0 | `packages/sdk/scripts/build.mjs` | 0 funciones (módulo CC ≈ 5) |
| — | — | 0 | `packages/sdk/src/globals.d.ts` | sólo `declare const` |
| — | — | 0 | `playwright.config.ts` | 0 funciones (módulo CC = 1) |

**Suma: 304 funciones en 19 ficheros** (17 con funciones medibles).

### 3.4 Plan de refactor posterior *(aplicado el 2026-10-24 — ver §8.7)*

Orden por riesgo, no por tamaño. **Los tres primeros son banda 15+ y están en código de producto:**

1. **`status-panel.ts:281` (`render`, CC 18 / 90 LOC)** — un único arrow contiene la clasificación del estado, la visibilidad de 5 nodos, la limpieza, el `role` a11y y un `switch` anidado de 5 estados con sub-`switch` de 4 fallos. **Guard clauses** al inicio (resolver `idle` con `return` temprano, ya existe) + **extraer** `applyVisibility(nodes, flags)`, `renderFailed(view)` y `renderSent()`. Objetivo: cada pieza < CC 10. *Precondición: cobertura e2e ya presente (`e2e/sdk.spec.ts` — filas de estados, A-5/A-7, backstop de 240 chars): ejecutar `npm run verify` antes y después.*
2. **`redactor.ts:81` (`collectMaskRects`, CC 17 / 52 LOC)** — el foco con mayor densidad de decisiones de todo el alcance. **Extraer** tres caminatas independientes ya separadas conceptualmente: `collectStructuralRects(doc)`, `collectValueRects(doc)` y `collectTextRects(doc)`. Es código crítico de SEC-01: el refactor debe preservar *byte a byte* el comportamiento y **convive con el hallazgo S-7 (§4.1-1)** — conviene hacer primero el descenso a sombras/iframes y luego partirlo, no al revés.
3. **`capture-source.ts:113` (`capture()`, CC 15 / 97 LOC)** — **guard clauses** para las tres salidas tempranas (costura, API ausente, sin track) + **extraer** `assertTabSurface(track)` (las 4 ramas de la política de superficie, `:148-173`) y `readFrame(video)` (el bloque `:179-205` con su `finally`). Objetivo: cada pieza < CC 10. *Precondición: las filas CAP-01/04/05 y OQ-1 de `e2e/sdk.spec.ts`.*
4. **Los 18 de CC 6-10** — *watch*: refactorizar sólo si se tocan por otra razón (`blankProbe` 10 es el candidato más denso: 32 LOC con 9 decisiones).
5. **Excluido a propósito:** `e2e/sdk.spec.ts:1024` (CC 19) y los 8 focos de test restantes. Convención heredada de la fase 1: los tests **se miden** (para que nadie los descuide) pero **no** entran en el plan de refactor de este informe.

---

## 4. Seguridad — `security-review` (estático, fuente primero)

**Método:** un fichero leído → STRIDE sobre ese fichero → tres lentes → *scratch* → descarte del contenido → siguiente. Principio rector: *un candidato sin principal afectado, recurso y resultado concretos no es un hallazgo*. Sólo los registros **confirmados** reciben severidad; los `needs_validation` no la tienen. Tras los 19 ficheros, **una única pasada transversal** de auditoría en modo *guidance* (§4.5).

### 4.1 Hallazgos confirmados (5)

#### 🟢 [LOW] El escáner de redacción sólo recorre el light DOM del documento principal — sombras abiertas e iframes de mismo origen quedan sin escanear

- **Evidencia** (verificada):
  - `packages/sdk/src/redact/redactor.ts:85` — `doc.querySelectorAll(SENSITIVE_SELECTOR)`;
  - `packages/sdk/src/redact/redactor.ts:91` — `doc.querySelectorAll(VALUE_SCAN_SELECTOR)`;
  - `packages/sdk/src/redact/redactor.ts:103` — `doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT)`.
  Ninguno de los tres atraviesa raíces de sombra; el `TreeWalker` tampoco entra en `iframe.contentDocument`. **No existe** ningún `element.shadowRoot`, `iframe` ni descenso recursivo en el fichero (leído completo, 177 líneas). Ninguna fila e2e de la fase compensa el hueco: `installSecrets()` (`e2e/sdk.spec.ts:1339-1356`) inyecta los secretos siempre en `document.body`.
- **Frontera:** aplicación host que renderiza contenido con **web components (raíz abierta)** o con un **iframe de mismo origen** (flujos de login/pago embebidos) → usuario que archiva un informe → control pretendido **SEC-01** (*máscara `input[type=password]`, patrones de credencial/tarjeta y `data-watchbug-sensitive`*) y **T-02-08** (*false negatives* del catálogo, clase *critical* en el registro de amenazas de la fase) → frontera de privacidad del usuario → afectado: un secreto **visible** dentro de esa sombra/iframe (un `data-watchbug-sensitive`, un JWT en texto, un número de tarjeta en claro) viaja **sin enmascarar** en los píxeles y queda almacenado en el informe → resultado: un dato personal/credencial persiste en el almacén y se sirve en el panel.
- **Contra-argumentos y por qué es `low`:**
  1. **`input[type=password]` está cubierto de forma indirecta**: el navegador lo dibuja como viñetas, así que la contraseña literal no aparece en el bitmap aunque la casilla no se enmascaque. La exposición real la tienen los **textos visibles** y los valores de campos `type=text`.
  2. Los **iframes de origen cruzado** son un riesgo **ya aceptado** por la fase (T-02-14 / AR-01, `02-04-PLAN.md:181`, `02-SECURITY.md:55`): el escáner *no puede* llegar a documentos de terceros. Este hallazgo cubre **sólo la parte alcanzable** — sombras **abiertas** (`element.shadowRoot`) e iframes de **mismo** origen (`contentDocument`), que sí son travesables.
  3. Requiere que el integrador renderice el secreto en claro en esa ubicación; no es la ruta documentada de la integración.
- **Fix mínimo (descripción):** factorizar el descenso: recorrer `element.shadowRoot` al profundizar (sólo raíces **abiertas**) y `iframe.contentDocument` cuando sea accesible, con profundidad acotada y manteniendo `UNRENDERED_PARENTS`. Añadir una fila e2e con un secreto dentro de una sombra abierta.
  **Invariante:** *el escáner de redacción visita la totalidad de los subárboles accesibles desde `document.documentElement` — light DOM, raíces de sombra abiertas e iframes de mismo origen — con profundidad acotada, y cualquier subárbol inaccesible queda declarado como limitación en la documentación de integración.*

#### 🟢 [LOW] El endpoint por defecto es el origen del script cargado: con el SDK servido desde un CDN, la captura sale hacia el dominio del CDN

- **Evidencia** (verificada): `packages/sdk/src/index.ts:63-66` captura `document.currentScript` a evaluación de módulo; `:79-87` `defaultEndpoint()` devuelve `new URL(LOADING_SCRIPT_URL ?? document.baseURI).origin`; `:102` `endpoint ?? defaultEndpoint()`. En la calle **IIFE** (`<script async src="https://cdn…/watchbug.js">`) ese origen es el del CDN, y `init()` sólo lanza si `endpoint` **se pasa** e inválido (`:96-99`) — no exige nada cuando falta.
- **Frontera:** integrador que aloja el bundle en un origen ajeno → usuario final que archiva un informe → promesa central del producto (*"ni el informe ni su captura salen nunca de la infraestructura del desarrollador"*) → frontera de datos → afectado: **píxeles de la captura y metadatos** viajan como `POST /api/incidents` al origen del CDN → resultado: el operador del CDN (y sus logs) ve bytes de capturas, aunque la API responda 404 y el panel muestre `failed network`.
- **Contra-argumentos y por qué no sube a medium:** (a) el comentario `:39-41` declara la asunción *"first-party delivery"* — supuesto documentado, no descuido; (b) hace falta que el integrador sirva el script de otro origen **y** omita `endpoint`; (c) en el lane **ESM** `document.currentScript` es `null` durante la evaluación del módulo ⇒ cae a `document.baseURI`, es decir, al origen del documento (correcto). El fallo sólo afecta a la integración IIFE+CDN y es ruidoso en el panel.
- **Fix mínimo (descripción):** si el origen del script difiere del origen del documento, **no** asumir: exigir `endpoint` explícito en `init()` (o avisar y preferir `location.origin`).
  **Invariante:** *el endpoint por defecto es siempre el origen del propio documento; cualquier otro destino requiere una decisión explícita del integrador.*
- **Nota:** no contradice SEC-03 (sólo sale la `project_key`, pública) ni SEC-01/02; es una fuga de **datos del informe**, no de credenciales.

#### 🟢 [LOW] La clave de proyecto se interpola en un literal JS/HTML sin validar su forma *(código de test)*

- **Evidencia:** `e2e/helpers/host-fixtures.ts:50-59` — `projectKey()` lee `.env` (`:51`) y **sólo rechaza el placeholder** (`:55`); no valida `^wkbt_[0-9A-Za-z]{32}$`. La clave resultante se interpola sin escapar en `:90` (`onload="Watchbug.init({ projectKey: '${key}' })"` — literal JS entre comillas simples dentro de un atributo HTML entre comillas dobles). El comentario de `:87-89` **afirma** que la clave es "a well-formed `wkbt_` token": esa garantía la da el arranque de la API, **no** este fichero. El modo ESM (`:84`) sí usa `JSON.stringify` y es seguro.
- **Frontera:** operador que edita su `.env` (no hay principal remoto) → generación del documento fixture → afectado: la página de test y con ella el proceso de Playwright en la máquina del desarrollador/CI → resultado: una clave malformada podría romper el literal y ejecutar JS *dentro del fixture de test*.
- **Por qué es `low`:** exige control local sobre `.env` y el fallo sería visible de inmediato; **no hay componente desplegado** — este código no entra en ningún bundle. Además, la presencia de la clave en un fixture **no** es una fuga: SEC-03 exige que sea pública write-only.
- **Fix mínimo:** validar el formato antes de interpolar (`/^wkbt_[0-9A-Za-z]{32}$/` → error) o usar `JSON.stringify` en ambos modos.
  **Invariante:** *toda clave que se interpola en un documento HTML/JS se valida contra su forma canónica o se serializa con escape estructurado — nunca se concatena.*

#### ⚪ [INFORMATIONAL] El bundle de e2e con `SHADOW_MODE='open'` se emite junto a los bundles de producción y nada impide desplegarlo

- **Evidencia:** `packages/sdk/scripts/build.mjs:83-98` emite `watchbug.e2e.js` / `.e2e.mjs` con `define: { SHADOW_MODE: JSON.stringify('open') }` en el **mismo** `dist/` (`:33`). El comentario `:26-29` reconoce que `scripts/check-size.mjs` **no presupuesta** ese artefacto, y **no existe ninguna comprobación** que impida servirlo.
- **Frontera:** artefacto de build → directorio que el operador copia a su infraestructura → control pretendido **INV-01** → afectado: el aislamiento del widget (una raíz **abierta** deja que cualquier script del host lea y escriba el árbol del widget) → resultado: si se sirve por error el `.e2e.`, INV-01 queda sin cumplir **y ningún gate lo detecta**.
- **Por qué es informativo:** exige un error de despliegue con un nombre deliberadamente distinto y documentado; la ruta por defecto (`watchbug.js`) es correcta.
- **Fix mínimo:** emitir los e2e a un subdirectorio no desplegable (`dist/e2e/`), o añadir un marcador de build + una regla en `gate.mjs`/`check:size` que falle si ese marcador aparece servido.
  **Invariante:** *ningún artefacto compilado con `SHADOW_MODE='open'` comparte directorio con los bundles destinados a producción, o su presencia es detectable por el gate.*

#### ⚪ [INFORMATIONAL] Fallback de idempotencia con `Math.random()` (no CSPRNG) — hoy inalcanzable en el flujo real

- **Evidencia:** `packages/sdk/src/capture/pipeline.ts:127-133`:
  ```ts
  if (source !== undefined && typeof source.randomUUID === 'function') {
    return source.randomUUID();
  }
  return `wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  ```
  La rama de reserva entrega ~41 bits de un generador **no criptográfico**.
- **Frontera:** tercero que conozca la `project_key` (pública por diseño) y pueda escribir en `POST /api/incidents` → anticipar/colisionar la `Idempotency-Key` de otra sesión → afectado: **integridad/dispibilidad de los informes** (una clave adivinada por anticipado haría que el reintento de la víctima devuelva la respuesta almacenada por el atacante en vez de registrar su informe).
- **Por qué es informativo, no low (contra-argumento verificado):** `crypto.randomUUID` exige **contexto seguro**, y `getDisplayMedia` (`capture-source.ts:131`) **también** — mientras que toda generación de clave ocurre *después* de una captura exitosa. En el flujo real las dos condiciones son inseparables ⇒ la rama es prácticamente código muerto. El riesgo se activa sólo si entra un `CaptureSource` que no requiera contexto seguro (la costura R-02 lo permite: `pipeline.ts:100-103`).
- **Fix mínimo:** reserva con `crypto.getRandomValues(...)`; si no hay CSPRNG, **terminar en estado de fallo visible** en lugar de degradar.
  **Invariante:** *toda clave de idempotencia sale de un CSPRNG; si no hay CSPRNG, el flujo no emite petición.*

### 4.2 `needs_validation` (11) — hechos fuera del repositorio

Sin severidad. Cada uno con su comprobación segura para el propietario:

| # | Hecho pendiente | Comprobación segura |
|---|---|---|
| 1 | **¿`MASK_ALPHA_OPAQUE` es 255?** Vive en `packages/contracts` (no tocado en la fase 2). Si fuera <255 el relleno sería semitransparente y violaría R-13 | `grep -n MASK_ALPHA_OPAQUE packages/contracts/src/*.ts` — debe ser `255` |
| 2 | **¿`scripts/gate.mjs` corre en CI?** Las reglas `sdk-single-encode-sink`, `sdk-no-host-storage` y `credentials:'omit'` son la garantía de fuente de SEC-02/SEC-03. El fichero **no** está en el alcance | Leer `scripts/gate.mjs` + `.github/workflows/ci.yml` y comprobar que la regla está en el job |
| 3 | **WebKit (este host) no expone cabecera `cookie`** en peticiones interceptadas (anotado en `e2e/sdk.spec.ts:2090-2095`, *probe 2026-10-24*): la mitad cookie de PRV-05 queda sólo en la regla de fuente | Repetir el probe en otro host/versión de Playwright |
| 4 | **¿El e2e bundle queda en la imagen/artefacto desplegado?** Depende de la política de copia de `dist/` (Dockerfile/compose **no** tocados en la fase 2) | `docker compose config` + inspeccionar qué copia la imagen, o `Get-ChildItem -Recurse -Filter 'watchbug.e2e.*'` desde la raíz del despliegue (debe no devolver nada fuera de `packages/sdk/dist`) |
| 5 | **¿La documentación de integración advierte del endpoint por defecto con CDN?** | `grep -rn endpoint README.md documentation/` |
| 6 | **Que el plegado del branch de costura siga vigente** en cada build futuro (hoy verificado en `dist/watchbug.js`; `dist/` está fuera del alcance) | `grep -c __watchbugCaptureFrame packages/sdk/dist/watchbug.js` + convertirlo en regla de gate |
| 7 | **¿La política CORS acepta `X-Project-Key`/`Idempotency-Key` sin credenciales** en despliegues multi-origen? (`apps/api` está fuera del alcance) | Leer `apps/api/src/plugins/cors.ts` y `.env.example` |
| 8 | **Guard `NaN` en `toBitmapRect`** — con `NaN`, `right <= left` es `false` y devolvería un rect con `NaN` (`geometry.ts:47`). Hoy inalcanzable (las fuentes son rects del DOM, siempre finitos) | Añadir `Number.isFinite` al guard y re-ejecutar las filas H-1 |
| 9 | **Que ningún lane futuro de `dist/` rompa `mode:"closed"`** (hoy `annotator`/`dom-serialize` aún no son widgets) | Alimentar el grepped de §7 al gate |
| 10 | **¿`e2e/global-setup.ts` existe y verifica `/api/health`?** (fichero citado por `playwright.config.ts:23`, fuera del alcance) | `Test-Path e2e/global-setup.ts` + leerlo |
| 11 | **¿Alguna capa de despliegue añade políticas/CSP delante de nginx?** (pregunta de despliegue, heredada de fase 1: el header propio del panel ya existe, falta la capa externa) | `curl -sI http://127.0.0.1:8080/ \| grep -i content-security-policy` (sustituir `127.0.0.1` por el host real si se despliega fuera de loopback) |

### 4.3 Candidatos examinados y **rechazados** (20)

Conviene tenerlos escritos para que nadie los reabra más tarde (las rejillas por fichero completas están en el *scratch*):

| Candidato | Fichero | Por qué NO es un hallazgo |
|---|---|---|
| Inyección vía la costura `__watchbugCaptureFrame` | `capture-source.ts:52-56` | (a) la rama está **plegada** en producción (evidencia §4.4), (b) el principal sería el propio script del host, que **ya** ejecuta JS con todos los permisos de esa página — sin elevación, (c) además se valida `instanceof ImageData` |
| `endpoint` admite cualquier host http(s); un XSS podría redirigir el widget | `index.ts:70-77` | El que fija `endpoint` es el autor de la página host, con **los mismos privilegios** que el ofensor; además `init()` es idempotente (`:114`). Sin principal de mayor privilegio |
| `javascript:`/`data:`/`file:` como endpoint | `index.ts:73` | Bloqueado: exige protocolo `http:`/`https:` y host no vacío |
| El widget podría enviar sin redactar | `pipeline.ts:225-240` | Imposible por construcción: `encode` sólo se llama tras `redact` con `return` en error; `CaptureSource` sólo produce `ImageData`. Sostenido por las filas CA-02 |
| Estado `lastIndex` de los regex `/g` compartidos → saltos de coincidencia (fail-open) | `redactor.ts:67` | `regex.lastIndex = 0` antes de cada caminata + guard de longitud cero (`:72`). Es *load-bearing* y está hecho |
| ReDoS de las familias sobre texto hostil | `patterns.ts:46,54,62,69` | Cuantificadores acotados (`{2}`, `{8,}`, `{12,18}`), sin anidamiento sin límite → coste lineal |
| Cobertura incompleta del catálogo (p. ej. claves `AKIA…`, DNI, correos) | `patterns.ts:124-137` | Fuera del alcance declarado: SEC-01 pide *password + patrones de credencial/tarjeta + `data-watchbug-sensitive`*, y eso es lo implementado. Ampliar familias es cambio de requisito |
| El escáner omite rects no renderizados / fuera de viewport | `redactor.ts:120,126` | Si `getClientRects()` está vacío, ese texto **tampoco aparece en los píxeles**; los rects totalmente fuera se descartan por el clamp |
| Descartar un rect `null` de `toBitmapRect` = fail-open | `redactor.ts:147` | Sólo se descartan rectángulos de área cero o ya fuera del bitmap |
| Bloqueo del hilo con un DOM enorme | `redactor.ts:81-129` | Síncrono sobre el `ImageData` ya obtenido, coste proporcional al trabajo de captura y sin alternativa sin dependencias |
| XSSI/DoS por reintentos | `lane1.ts:198-208` | Bucle acotado a 3 reintentos con jitter; un 4xx de contrato **no** reintenta (`:202`) |
| `error.message` / `message` del servidor llegan al panel | `lane1.ts:109` → `status-panel.ts:352` | Se asigna por **`textContent`** y se trunca a 240 chars: sin sumidero HTML |
| XSS almacenado/reflejado en el panel del widget | `status-panel.ts` completo | 0 `innerHTML`/`outerHTML`/`insertAdjacentHTML` en los 19 ficheros (sólo un comentario en `launcher.ts:15`) |
| El listener global de Escape interfiere con la app host | `status-panel.ts:253` | Sólo con panel terminal visible, sólo para `key === 'Escape'`, retirado en `destroy()`; es el comportamiento A-7 del UI-SPEC |
| Inyección vía `svgElement(name, attributes)` | `launcher.ts:75-77` | Los atributos son literales propios del fichero |
| CSS inyectado vía `style.textContent = css` | `host.ts:139` | `css` es la concatenación de tres constantes de módulo; **ningún dato de la página** entra en la hoja |
| La página host borra el widget → bucle de observadores | `host.ts:159-183` | Acotado por `reappendQueued` + `queueMicrotask`; observadores **no**-subtree; autoinfligido |
| Riesgo de secretos en el `.env` leído por el test | `host-fixtures.ts:51` | Sólo se extrae `WATCHBUG_PROJECT_KEY` (pública write-only) y se usa en la página local |
| Secreto en código (`sk_live_…`, `wbt_live_…`, JWT, `4111111111111111`, `hunter2-…`) | `sdk.spec.ts` | **Vectores de prueba sintéticos** (el PAN es el número de prueba Visa estándar). Ninguno es una credencial real → SEC-04 no aplica. En este informe se citan **redactados** |
| Inyección de shell en `deploy.spec.ts` | `deploy.spec.ts:86-90` | `spawn` con **array de argumentos** y sin `shell: true` |

### 4.4 Invariantes verificados **sin** hallazgo

- **SEC-02 / R-13 / A-05 — orden y primitiva destructiva.** `CaptureSource` sólo produce `ImageData` (nunca un `Blob`); en `pipeline.ts` la única ruta hacia `encode()` pasa antes por `redactor.redact()` con `return` en error; `fillRects` escribe `RGB=(0,0,0)` + `MASK_ALPHA_OPAQUE` **in situ** sobre `ImageData` — sin `blur`, sin `filter`, sin `globalAlpha`, sin overlays CSS. Comprobación de sumidero: `toBlob` aparece **una sola vez** en `packages/sdk/src` (`encode.ts:75`).
- **T-02-10 — fail closed:** `redactor.ts` **no contiene ni un `catch`**; el error propaga a `pipeline.ts:225-230` que corta antes de codificar/enviar. Las filas e2e de la fase lo afirman con cero POSTs.
- **SEC-01 — pruebas a nivel de artefacto (CA-02):** `expectMaskedAndTargeted` exige **cero** píxeles originales dentro del rect y de su anillo de 1 px, relleno plano ≥98 % y región control intacta; controles negativos (lookalike JWT, tarjeta Luhn-**inválida**) demuestran que la máscara no es un barrido ciego.
- **SEC-03 / PRV-05:** `credentials: 'omit'` explícito (`lane1.ts:148`), allowlist de cabeceras exacta (`['idempotency-key','x-project-key']`), sin `cookie`, sin `authorization`, sin `referer`; verificado en e2e con 4 centinelas sobre cabeceras, cuerpo crudo y bytes de imagen.
- **R-08 / CR-01:** `meta.url = location.pathname` (path-only, `lane1.ts:95`) y `referrerPolicy: 'no-referrer'` (`:151`); el propio test demuestra con un *probe* que una petición normal **sí** filtraría `?token=secret` por `referer`.
- **INV-01 — verificado sobre los artefactos construidos** (fuera del alcance de análisis, usado sólo como comprobación):
  ```
  dist/watchbug.js      mode:"closed" = 1   mode:"open" = 0   customElements = 0
  dist/watchbug.mjs     mode:"closed" = 1   mode:"open" = 0   customElements = 0
  dist/watchbug.e2e.js  mode:"closed" = 0   mode:"open" = 1            ← control positivo
  dist/watchbug.js      …ke="__watchbugCaptureFrame";function Ie(t){return null}…
  ```
  El lector de la costura está **plegado a `return null`** en producción (una página host no puede inyectar el fotograma), mientras que el bundle e2e conserva `function Ie(t){let e=t[ke];…}` (control positivo).
- **INV-02:** `globalName: 'Watchbug'` sólo en el rol IIFE; 0 apariciones de `customElements` en los tres bundles; la fila WDG-04 comprueba exactamente un global en IIFE, **cero** en ESM y prototipos idénticos antes/después.
- **RNF-01 (medido, no gateado):** con `node:zlib` sobre los artefactos presentes en `dist/` — `watchbug.js` **8,54 KB gz** (tope 45), `watchbug.mjs` **8,33 KB gz**, suma del par **16,87 KB** (tope 80), `watchbug-annotator.*` 0,33/0,07 KB (tope 25), `watchbug-dom-serialize.*` 0,34/0,08 KB. **No** se ejecutó `npm run check:size`.
- **PRF-04 / R-01:** `packages/sdk/package.json` declara como única dependencia runtime `@watchbug/contracts` (workspace) y `esbuild` en *dev*; todas las importaciones de los 19 ficheros son locales o del submódulo `@watchbug/contracts/constants` (sin Zod en el cliente).
- **M-6 — sin fallos silenciosos:** toda vía de error termina en un estado visible (`capture`/`blank`/`network`/`rejected` con la razón del servidor truncada), con `role="alert"` en los fallos.
- **T-02-14 / AR-01 (riesgo aceptado por la fase, no un hallazgo nuevo):** los iframes de **origen cruzado** no pueden escanearse; queda documentado como limitación de integración para la fase 5+.

### 4.5 Auditoría global de dependencias — **una única pasada**, modo *guidance*

| Comprobación | Resultado |
|---|---|
| `git diff --name-only origin/develop...HEAD -- '*package.json' '*lock*'` | **Vacío** — la fase 2 **no** toca ni un manifiesto ni un lockfile |
| Cambios de versión (old → new) | **Ninguno** — no hay versiones que comparar ni advisories que evaluar |
| Cambios de licencia | **Ninguno** — la fase no introduce paquetes; `packages/sdk/package.json` sigue con `Apache-2.0` |
| *Install scripts* / artefactos nativos | **Ninguno nuevo** — el SDK sigue sin dependencias runtime de terceros; `esbuild` (build) permanece en `devDependencies` sin cambios |
| Pass transversal sobre el código de la fase | Hecho fichero a fichero (§4.1-§4.4). Sin hallazgos **transversales** adicionales: ningún dato del host sale (`SEC-03`), ningún sumidero HTML (`SEC-05`), ningún patch de prototipo (`INV-02`) |
| Invariantes verificados **sin** hallazgo | `PRF-04` (deps runtime), `RNF-01` (tamaños medidos), `SEC-04` (0 literales de credencial real en el alcance; `.env` no se trackea), `INV-03` (no se toca `docker-compose.yml`) |
| `needs_validation` derivados de la auditoría | §4.2-1 (`MASK_ALPHA_OPAQUE`), §4.2-2 (`gate.mjs` en CI), §4.2-7 (CORS en `apps/api`) |

---

## 5. Plan de remediación posterior *(ya ejecutado — ver §8)*

> Esta sección es el backlog con el fix mínimo ya definido por hallazgo, tal como se escribió el 2026-10-24.
>
> **Estado a 2026-10-24 (tras `0c6565f`):** el plan **ya se ejecutó** — `S-7`, `S-8`, `S-9`, `I-1`, `I-2` y `C-4`/`C-5`/`C-6` están **resueltos**. `V-1` quedó **parcial** (los tres hechos comprobables en código cerrados; los ocho restantes son del despliegue) y `C-7` se mantuvo en *sólo si se tocan por otra razón*. Ver **§8** para qué quedó resuelto, cómo y con qué evidencia.

| Prioridad | ID | Hallazgo | Fix mínimo | Ficheros | Esfuerzo |
|---|---|---|---|---|---|
| **P1** | S-7 | Escáner light-DOM-only (LOW, §4.1-1) | Descenso recursivo por `element.shadowRoot` (raíces abiertas) e `iframe.contentDocument`, profundidad acotada + fila e2e con secreto en sombra abierta | `redact/redactor.ts`, `e2e/sdk.spec.ts` | Bajo-Medio — **hacerlo antes del refactor C-5** |
| **P1** | S-8 | Endpoint por defecto = origen del script (LOW, §4.1-2) | Si el origen del script ≠ origen del documento, exigir `endpoint` explícito (o preferir `location.origin`) + nota en docs de integración | `src/index.ts` | Bajo |
| **P2** | C-4 | `render` CC 18 / 90 LOC | Guard clauses + extraer `applyVisibility` / `renderFailed` / `renderSent` | `widget/status-panel.ts` | Medio — `npm run verify` antes/después |
| **P2** | C-5 | `collectMaskRects` CC 17 / 52 LOC | Extraer `collectStructuralRects` / `collectValueRects` / `collectTextRects` | `redact/redactor.ts` | Medio — después de S-7 |
| **P2** | C-6 | `capture()` CC 15 / 97 LOC | Guard clauses + extraer `assertTabSurface` / `readFrame` | `capture/capture-source.ts` | Medio |
| **P3** | S-9 | Clave concat sin validar (LOW, test — §4.1-3) | Validar `^wkbt_[0-9A-Za-z]{32}$` o `JSON.stringify` en ambos modos | `e2e/helpers/host-fixtures.ts` | Minuto |
| **P3** | I-1 | Bundle e2e `open` en `dist/` sin gate (INFO, §4.1-4) | Emitir a `dist/e2e/` o marcador de build + regla de gate | `packages/sdk/scripts/build.mjs`, `scripts/` | Minuto-Bajo |
| **P3** | I-2 | Fallback `Math.random()` de idempotencia (INFO, §4.1-5) | `crypto.getRandomValues` + fallar ruidosamente si no hay CSPRNG | `capture/pipeline.ts` | Minuto |
| **P3** | V-1 | Los 11 `needs_validation` (§4.2) | §4.2-1 y §4.2-2 en minutos (grep + lectura); el resto al desplegar o al tocar esas superficies | docs / despliegue | Minutos |
| **P3** | C-7 | Los 18 focos CC 6-10 | Sólo si se tocan por otra razón (§3.4-4) | varios | — |

**Secuencia recomendada:** `V-1` (#1 y #2: dos greps) → `S-7`/`S-8` (privacidad) → `S-9`/`I-1`/`I-2` (dejar lo informativo cerrado) → `C-4`/`C-5`/`C-6` (refactor con e2e en verde).

---

## 6. Limitaciones del informe

1. **Una sola pasada, sin ledger de cobertura.** No existe auditoría previa de esta rama; no hay registros que arrastrar. **Esta pasada no agota el objetivo** — superficies no exploradas en profundidad: `scripts/*.mjs` más allá de lo citado, internals de `dist/`, y todo lo que Phase 3-7 añada (anotador, composer, panel, API).
2. **Modo guidance, no full audit.** Sin fases 1-6, sin `findings.json` ni validadores, sin verificación independiente de registros. Los hallazgos fueron citados y **verificados manualmente contra el árbol en `9c0c089`** por este agente, pero no pasaron por un verificador independiente fresco.
3. **Source-first absoluto.** Nada se ejecutó: ningún hallazgo se apoya en reproducción en vivo. Las dos excepciones de "toca un artefacto" son **lecturas estáticas** (los grepped de `dist/` de §4.4 y el `node:zlib` de RNF-01), no ejecuciones del objetivo.
4. **Sin control positivo del detector de slop.** §2 reporta `0 findings`; a diferencia de la fase 1 **no se creó un fichero sonda** para demostrar sensibilidad. El motor vive fuera de este repo y `coverage` vino como `null`.
5. **Cobertura de los lentes.** `stopthatslop` cubre 9 reglas TS gateables; la complejidad cubre las **304 funciones de los 19 ficheros**; la seguridad cubrió esos mismos 19 ficheros **uno a uno** más una pasada transversal de dependencias. Ningún fichero fuera de la lista fue analizado — sólo citado como `needs_validation`.
6. **Grafo de código con frescura degradada.** `check_index_coverage` devolvió `freshness: metadata_changed` para las 19 rutas (acción recomendada `read_source_and_reindex`), `parse_partial: 2` y `parse_unusable: apps/panel/nginx.conf` (fuera del alcance). **Efecto sobre este informe: nulo**, porque ningún hallazgo se apoya en el grafo — todo es lectura directa de fuente.
7. **Dos ficheros sin funciones medibles** (`globals.d.ts`, `playwright.config.ts`) y uno de módulo (`build.mjs`) se reportan con `CC n/a`; no son ausencia de código, sólo ausencia de funciones bajo la regla.
8. **Los tests se miden pero no se refactorizan aquí** (§3.4-5): sus 9 focos, incluido el CC 19, quedan registrados y fuera del plan.

---

## 7. Anexo — comandos reproducibles

> **Nota (2026-10-24, tras `0c6565f`):** estos comandos reproducen el **análisis original** sobre `9c0c089`. Desde entonces los bundles de test se emit en `dist/e2e/` (ver §8.6), así que los paths del punto 6 y las cifras del punto 7 son los de aquella pasada. Las cifras posteriores a la remediación están en **§8.9**.

```bash
# 1. Alcance (Step 1) — salida: 54 crudos → 19 tras el filtro
git branch --list "gsd/phase-2-*"
git rev-parse --abbrev-ref HEAD
git rev-parse --verify origin/develop
git diff --name-only origin/develop...HEAD          # 54
git diff --name-only                                # sin cambios trackeados
git diff --cached --name-only                       # sin cambios en staging
# filtro manual de .planning/**, documentation/**, e2e/fixtures/**, lockfiles → 19

# 2. Slop — salida: passed: true, gate 0, teach-only 0, exit 0
python -m stopthatslop_cli check --repo-root "E:\Proyectos Github\Watchbug_TFG" --pack ts --format json

# 3. Complejidad (script propio, análisis estático, no modifica nada)
#    PowerShell: array de las 19 rutas del alcance
$f = @('e2e/deploy.spec.ts','e2e/helpers/capture-stubs.ts','e2e/helpers/host-fixtures.ts','e2e/sdk.spec.ts',
  'packages/sdk/scripts/build.mjs','packages/sdk/src/capture/capture-source.ts','packages/sdk/src/capture/pipeline.ts',
  'packages/sdk/src/globals.d.ts','packages/sdk/src/image/encode.ts','packages/sdk/src/index.ts',
  'packages/sdk/src/redact/geometry.ts','packages/sdk/src/redact/patterns.ts','packages/sdk/src/redact/redactor.ts',
  'packages/sdk/src/strings.ts','packages/sdk/src/transport/lane1.ts','packages/sdk/src/widget/host.ts',
  'packages/sdk/src/widget/launcher.ts','packages/sdk/src/widget/status-panel.ts','playwright.config.ts')
node "$env:LOCALAPPDATA\Temp\opencode\informe-analisis-phase2\cc.mjs" @f
#   salida: files 19 · functions 304 · avg 2.07 · max 19 · ok 282 / watch 18 / ref 1 / split 3
#   (1ª pasada descartada: no contaba &&/|| — corregido y re-ejecutado, ver §1.2)

# 4. Sumidero único de codificación (dentro del alcance) — comando realmente ejecutado
Select-String -Path 'packages\sdk\src\index.ts','packages\sdk\src\capture\pipeline.ts','packages\sdk\src\capture\capture-source.ts','packages\sdk\src\image\encode.ts','packages\sdk\src\redact\*.ts','packages\sdk\src\transport\lane1.ts','packages\sdk\src\widget\*.ts','packages\sdk\src\strings.ts','packages\sdk\src\globals.d.ts' -Pattern 'toBlob|encodeLadder'
#   → una sola ocurrencia real: packages/sdk/src/image/encode.ts:75 (encodeLadder se cita en pipeline.ts)

# 5. Sin sumideros HTML (comando realmente ejecutado; 0 ocurrencias reales, 1 comentario en launcher.ts:15)
Select-String -Path 'packages\sdk\src\*.ts','packages\sdk\src\**\*.ts','e2e\*.ts','e2e\helpers\*.ts','playwright.config.ts' -Pattern 'innerHTML|outerHTML|insertAdjacentHTML|document\.write|createContextualFragment|dangerouslySetInnerHTML'

# 6. INV-01 sobre artefactos (lectura estática, no ejecución) — comando realmente ejecutado
foreach ($b in @('watchbug.js','watchbug.mjs','watchbug.e2e.js')) {
  $t = Get-Content "packages\sdk\dist\$b" -Raw
  "$b mode:closed=$(([regex]::Matches($t,'mode:\"closed\"')).Count) mode:open=$(([regex]::Matches($t,'mode:\"open\"')).Count) customElements=$(([regex]::Matches($t,'customElements')).Count)"
}
#   watchbug.js     mode:closed=1 mode:open=0 customElements=0
#   watchbug.mjs    mode:closed=1 mode:open=0 customElements=0
#   watchbug.e2e.js mode:closed=0 mode:open=1                    ← control positivo
#   costura plegada en producción (watchbug.js):  …ke="__watchbugCaptureFrame";function Ie(t){return null}…
#   costura viva en e2e  (watchbug.e2e.js):       function Ie(t){let e=t[ke];return typeof e=="function"?e:null}

# 7. Tamaños RNF-01 (node:zlib sobre dist/, sin ejecutar check:size)
node -e "const fs=require('fs'),z=require('zlib');const d='packages/sdk/dist';\
for(const n of fs.readdirSync(d).filter(n=>/\.(js|mjs)$/.test(n)).sort())\
console.log(z.gzipSync(fs.readFileSync(d+'/'+n)).length, n);"
#   8745 watchbug.js · 8526 watchbug.mjs · 340 watchbug-annotator.js · 69 watchbug-annotator.mjs
#   347 watchbug-dom-serialize.js · 78 watchbug-dom-serialize.mjs · 8759 watchbug.e2e.js · 8541 watchbug.e2e.mjs

# 8. Auditoría de dependencias (una sola vez)
git diff origin/develop...HEAD -- '*package.json' '*lock*'   # vacío
git diff --shortstat origin/develop...HEAD                   # 54 files changed, 11563 insertions(+), 74 deletions(-)

# 9. Índice de grafo y cobertura (MCP)
#    list_projects / index_status / get_architecture / check_index_coverage(19 rutas)
#    → signal: best_effort, todas no_recorded_issue con freshness: metadata_changed
```

---

## 8. Estado de remediación (2026-10-24, HEAD `12a5049`)

> §8 es el **estado actual tras corregir**. §0–§7 describen el análisis original sobre `9c0c089` y **no se reescriben**: son el registro histórico de aquella pasada. Todo lo que sigue se **re-verificó contra el código en `12a5049`**, no se heredó del análisis.
>
> La remediación se ejecutó con `/gsd-code-review 02 --fix` en dos tandas: primero cerró los **7 hallazgos abiertos de `02-REVIEW.md`** (CR-03, WR-01, WR-02, WR-03, IN-01, IN-02, IN-03) y el backlog de este informe; después, un **pase de regresión independiente** sobre la propia remediación (`02-REVIEW-FIX.md`) encontró 6 defectos nuevos, también cerrados. `02-REVIEW-DISPOSITION.md` da el estado de las dos tandas: **15/15 resueltos**.

### 8.1 Resumen

| ID | Hallazgo | Estado | Cómo se arregló |
|---|---|---|---|
| **S-7** = review **CR-03** | Escáner light-DOM-only (LOW, §4.1-1) | ✅ **resuelto** | `collectScanRoots()` recorre ahora **todo** root alcanzable — light DOM, raíces de sombra **abiertas** e `iframe` de mismo origen — con profundidad acotada (`MAX_SCAN_DEPTH = 8`) y traducción de coordenadas por el origen de la caja del marco. Fila e2e nueva con secreto en sombra abierta **y** en iframe. |
| **S-8** = review **WR-02** | Endpoint por defecto = origen del script (LOW, §4.1-2) | ✅ **resuelto** | El endpoint por defecto es **siempre `location.origin`**. Si el origen del script difiere del del documento y no se pasa `endpoint`, `init()` **lanza** en lugar de adivinar. Fila e2e nueva que ejercita la entrega IIFE desde un CDN. |
| **I-2** = review **WR-03** | Fallback `Math.random()` de idempotencia (INFO, §4.1-5) | ✅ **resuelto** | UUID v4 construido con `crypto.getRandomValues` (no está atado a contexto seguro). Sin CSPRNG **no hay petición**: fallo visible, nunca una clave adivinable. |
| **S-9** | Clave concat sin validar (LOW, test, §4.1-3) | ✅ **resuelto** | `projectKey()` valida `^wkbt_[0-9A-Za-z]{32}$` **antes** de interpolar. La garantía de formato ya no depende del arranque de la API. |
| **I-1** | Bundle e2e `open` en `dist/` sin gate (INFO, §4.1-4) | ✅ **resuelto** | Los bundles de test se emiten en `dist/e2e/`, el build borra los rezagados del layout anterior y una aserción **falla el build** si algún artefacto `SHADOW_MODE:'open'` vuelve a `dist/`. |
| **C-4** | `render` CC 18 / 90 LOC | ✅ **resuelto** | **CC 18 → 6** (37 LOC), con `viewFlags` / `applyVisibility` / `renderHeadline` / `renderFailed`. |
| **C-5** | `collectMaskRects` CC 17 / 52 LOC | ✅ **resuelto** | **CC 17 → 2** (9 LOC): `collectStructuralRects` (2), `collectValueRects` (5), `collectTextRects` (8), `textNodeRect` (6), `collectScanRoots` (1 + visit 7). |
| **C-6** | `capture()` CC 15 / 97 LOC | ✅ **resuelto** | **CC 15 → 7** (39 LOC): `captureFromSeam` (2), `assertTabSurface` (3), `readFrame` (4). |
| **V-1** | 11 `needs_validation` (§4.2) | 🟡 **parcial** | #1, #2 y #8 cerrados aquí (ver §8.8). El resto son hechos del despliegue real: siguen abiertos por naturaleza. |
| **L-1** | Slop | ✅ **0 findings** | Re-ejecutado sobre `0c6565f`: `gate_finding_count: 0`, `exit 0` (ver §8.9). |
| **WR-01** *(sólo review)* | Máscara medida tras el frame | ✅ **resuelto** | Ver §8.5. |
| **IN-01** *(sólo review)* | `beyond-cap` asigna canvas antes de su `return` | ✅ **resuelto** | Ver §8.6. |
| **IN-02** *(sólo review)* | `truncateReason` parte pares sustitutos | ✅ **resuelto** | Ver §8.6. |
| **IN-03** *(sólo review)* | Igualdad de bytes vacía en WebKit | ✅ **resuelto** | Ver §8.6. |
| **FX-01 … FX-06** *(pase de regresión)* | **6 defectos introducidos por los propios arreglos** (2 críticos, 2 avisos, 2 info) | ✅ **los 6 cerrados** | Ver **§8.10** — incluido FX-01, que dejaba el widget muerto tras un fallo sin CSPRNG, y FX-02, que ponía la máscara sobre otros píxeles si un marco llevaba `transform` |

> **Sobre los IDs duplicados.** `02-REVIEW.md` y este informe se escribieron en pasadas independientes y nombraron los mismos defectos con IDs distintos. La tabla de arriba es la correspondencia; **CR-03 ≡ S-7**, **WR-02 ≡ S-8**, **WR-03 ≡ I-2**. `02-REVIEW-DISPOSITION.md` es la fuente de verdad para el estado de los hallazgos del review.

### 8.2 S-7 / CR-03 — el escáner alcanza sombras abiertas e iframes de mismo origen

**Estado:** ✅ **resuelto** (`packages/sdk/src/redact/redactor.ts`).

El análisis y el review coincidían: las tres rutas de detección (`SENSITIVE_SELECTOR`, `VALUE_SCAN_SELECTOR` y el `TreeWalker` de nodos de texto) estaban acotadas al light DOM del documento superior. Ahora:

- **`collectScanRoots(doc, maxDepth)`** devuelve cada root alcanzable junto con la traslación de sus coordenadas al viewport superior. Profundiza en `element.shadowRoot` (sólo raíces **abiertas**) y en `iframe.contentDocument` / `frame.contentDocument` cuando sea accesible. `MAX_SCAN_DEPTH = 8` acota el anidamiento de roots, **no** la altura del DOM.
- **Traducción de coordenadas.** Una raíz de sombra comparte el espacio de su documento anfitrión (desplazamiento 0). Un documento dentro de un marco no: sus `getBoundingClientRect()` son relativos al viewport **del marco**, así que se suma el origen de la caja del marco (`box.left + frame.clientLeft`). Es la parte que un descuido daría al revés — y por eso la fila e2e la ejercita con el marco desplazado (40×60 px), no pegado al origen.
- **Lo que no alcanza sigue sin alcanzar, y está declarado.** Raíces de sombra **cerradas** y marcos de **origen cruzado** son inaccesibles por construcción (`shadowRoot` / `contentDocument` devuelven `null`): es la limitación de integración T-02-14 / AR-01, no una elección del escáner.
- **Fail closed intacto (T-02-10).** El recorrido no traga errores: cualquier excepción propaga a `pipeline.ts`, que corta antes de codificar/enviar.

**Invariante ahora sostenido:** *el escáner de redacción visita la totalidad de los subárboles accesibles desde `document.documentElement` — light DOM, raíces de sombra abiertas e iframes de mismo origen — con profundidad acotada, y cualquier subárbol inaccesible queda declarado como limitación en la documentación de integración.*

**Evidencia e2e (fila nueva `S-7 / PRV-02`, 3 motores):** un secreto dentro de una sombra abierta (JWT) **y** otro dentro de un iframe de mismo origen (tarjeta Luhn válida) viajan **enmascarados** en los bytes decodificados. Cada uno lleva su propio marcador `#ff00ff` en el light DOM, **dimensionado y colocado en el rect real que el navegador le da al secreto** — medido por el motor de layout, no por el código bajo prueba, así que un rect de máscara equivocado se ve como píxeles magenta supervivientes y no como un paso vacío. La fila exige además que la región de control conserve sus píxeles y más de un color.

### 8.3 S-8 / WR-02 — el endpoint por defecto es el origen del documento

**Estado:** ✅ **resuelto** (`packages/sdk/src/index.ts`).

Se aplicó la lectura estricta de la invariant del análisis (*"el endpoint por defecto es siempre el origen del propio documento; cualquier otro destino requiere una decisión explícita del integrador"*), más la exigencia del *fix mínimo*:

- **`defaultEndpoint()` devuelve `location.origin`.** Nunca el origen del script. Un bundle servido desde un CDN ya no publica capturas hacia el CDN, que es lo que rompía la promesa central del producto.
- **Cuando el origen del script difiere del del documento y no se pasa `endpoint`, `init()` lanza** un `TypeError` con mensaje accionable (`… pass \`endpoint\` explicitly`) en lugar de adivinar. Es la variante *ruidosa* que pide M-6, no el aviso silencioso.
- **La lane ESM queda correcta por definición.** `document.currentScript` es `null` en un módulo, así que `loadingScriptOrigin()` devuelve `null` y no dispara la excepción: ahí el origen del documento **es** el destino correcto, que era exactamente la contradicción que señalaba WR-02 respecto al comentario de la API pública.

> ⚠️ **Cambio de comportamiento de la interfaz pública.** `window.Watchbug.init()` deja de funcionar sin `endpoint` en la configuración IIFE + script de origen cruzado. Es deliberado: esa configuración **no funcionaba** — publicaba la captura hacia un tercero — y ahora falla en voz alta en lugar de hacerlo en silencio. Es un disparador de consulta de `AGENTS.md` («cambiar la interfaz pública del SDK»); queda registrado aquí para su revisión. El comentario de `WatchbugInitOptions.endpoint` documenta ya la nueva regla.
>
> ✅ **Decisión del propietario (2026-10-25).** Se mantiene el comportamiento estricto: **`init()` lanza.** No se sustituye por un aviso que caiga a `location.origin`. Una excepción es el comportamiento correcto y seguro para un origen cruzado sin `endpoint` explícito. **La opción blanda descartada queda cerrada y no debe reabrirse.**

**Evidencia e2e (fila nueva `S-8`, 3 motores):** el documento se sirve de `127.0.0.1:8080` y el bundle de `localhost:8080` (la forma «script desde un CDN», resuelta por `page.route` sin segundo servidor). Se afirma que **(a)** `init()` sin `endpoint` lanza nombrando la corrección, **(b)** no se monta nada y no sale ninguna petición, y **(c)** el mismo bundle con `endpoint` explícito monta y publica **exactamente** en esa base — nunca en el origen del script.

### 8.4 I-2 / WR-03 — toda clave de idempotencia sale de un CSPRNG

**Estado:** ✅ **resuelto** (`packages/sdk/src/capture/pipeline.ts`).

`newIdempotencyKey()` usa `crypto.randomUUID` donde existe y, si no, construye un UUID v4 con `crypto.getRandomValues` (bytes 6 y 8 con los bits de versión/variante). `getRandomValues` **no** está atado a contexto seguro, que era el hueco: en un despliegue self-hosted sobre HTTP plano — audiencia principal — la clave era `Date.now()` + `Math.random()`, ~41 bits de un generador no criptográfico.

Se aplicó la invariant del análisis, no el *fix mínimo* del review: **si no hay CSPRNG no se emite petición**. La clave se acuña **antes** de la captura y su fallo termina en el estado visible `capture`, nunca en un `Idempotency-Key` adivinable detrás de `UNIQUE (project_id, idempotency_key)` (una colisión devolvería la respuesta almacenada por otro en lugar de registrar el informe: un envío perdido en silencio).

La forma del contrato (UUID, `/^[0-9a-f-]{36}$/`) deja de ser aspiracional en cualquier contexto. La fila `P2-D-03` sigue afirmando que el reintento reutiliza la **misma** clave.

### 8.5 WR-01 — la máscara se mide en el instante de la lectura de píxeles

**Estado:** ✅ **resuelto** (`redact/redactor.ts`, `capture/pipeline.ts`).

El puerto `Redactor` separa `collect()` de `redact(image, rects?)`, y el pipeline mide los rects **dentro del gancho `beforeRead` del adaptador de captura** — el mismo instante en que se leen los píxeles — en lugar de después de existir el frame. Un desplazamiento de layout entre «frame dibujado» y «DOM recorrido» ya no puede mover un secreto fuera de su máscara.

Si un `CaptureSource` no invocara `beforeRead`, `redact` vuelve a medir por su cuenta: degrada a la medida posterior, **nunca** a bytes sin redactar.

**Efecto observable en la suite.** El orden cambió en la lane *seam*: una rotura del escáner falla ahora **antes** de que el proveedor de fotogramas del stub se ejecute. La fila `fail-closed` se actualizó para afirmar el orden real de cada tier (en seam, `observation` es `null`; en media, el stub sí corrió) en lugar de dejar una comprobación que dejara de significar algo. Es estrictamente más temprano, nunca más tarde.

### 8.6 El resto: S-9, I-1, IN-01, IN-02, IN-03

| ID | Qué se hizo |
|---|---|
| **S-9** | `e2e/helpers/host-fixtures.ts` — `PROJECT_KEY_SHAPE = /^wkbt_[0-9A-Za-z]{32}$/` y `projectKey()` **lanza** si la clave no cumple, antes de interpolarla en el literal JS dentro del atributo HTML. La garantía de formato ya no depende del arranque de la API. |
| **I-1** | `packages/sdk/scripts/build.mjs` — los bundles `watchbug.e2e.*` se emiten en **`dist/e2e/`**; el build borra los rezagados que el layout anterior dejó en `dist/`; y una aserción final **falla el build** si cualquier artefacto de `dist/` contiene `mode:"open"`. `host-fixtures.ts` resuelve cada bundle en su sitio (`bundlePath()`). Comprobado sobre artefactos: `dist/` → `mode:"closed"=1, mode:"open"=0, customElements=0`; `dist/e2e/` → `mode:"open"=1`. |
| **IN-01** | `e2e/helpers/capture-stubs.ts` — el `return` de `beyond-cap` se ejecuta **antes** de que exista ningún canvas. En un motor cuyo `getContext()` devuelve `null` por encima del tope de área, la fila llega al estado *blank* que afirma, no al *capture-failed*. |
| **IN-02** | `widget/status-panel.ts` — `truncateReason` corta por **puntos de código** sin salirse del mismo tope de unidades UTF-16 que afirma la fila *backstop*. Un corte ya no puede partir un par sustituto. |
| **IN-03** | `e2e/sdk.spec.ts` — la no-vacuidad de la igualdad de bytes de P2-D-03 se afirma **allí donde el payload es observable** (chromium/firefox: la imagen codificada está realmente en el cuerpo), y la fila **declara** que en WebKit `postDataBuffer()` omite los bytes de partes FormData con blob (desviación 2). La cabecera `idempotency-key` compartida y la parte `meta` siguen afirmando el envío idéntico en los tres motores. |

### 8.7 C-4 / C-5 / C-6 — complejidad ciclomática

**Estado:** ✅ **resueltos los tres focos 15+ de código de producto.** Re-medidos sobre `0c6565f` con el mismo script del §3 (reglas de conteo idénticas, §1.2):

| Función | Antes | Después | Piezas nuevas |
|---|---|---|---|
| `render` (`widget/status-panel.ts`) | **18** / 90 LOC | **6** / 37 LOC | `viewFlags` 4 · `applyVisibility` 2 · `renderHeadline` 7 · `renderFailed` 6 |
| `collectMaskRects` (`redact/redactor.ts`) | **17** / 52 LOC | **2** / 9 LOC | `collectStructuralRects` 2 · `collectValueRects` 5 · `collectTextRects` 8 · `textNodeRect` 6 · `collectScanRoots` 1 (+ `visit` 7) |
| `capture()` (`capture/capture-source.ts`) | **15** / 97 LOC | **7** / 39 LOC | `captureFromSeam` 2 · `assertTabSurface` 3 · `readFrame` 4 |

**Distribución global tras el refactor (mismos 19 ficheros del alcance):** 342 funciones · media **2,09** · máx 19 · bandas **ok 314 / vigilar 26 / refactorizar 1 / dividir 1**.

**Ya ninguna función de producto está en banda 11+.** Los dos focos que quedan por encima de 10 son **de test** y quedan fuera del plan por la convención heredada de la fase 1 (§3.4-5: los tests se miden, no se refactorizan aquí):

| CC | Función | Fichero | Nota |
|---|---|---|---|
| 19 | `readControlProof` | `e2e/sdk.spec.ts:1035` | ya existía (§3.2) |
| 11 | `attachSecret` | `e2e/sdk.spec.ts:1368` | **nuevo** — inyector de secretos para las filas S-7 |

Los 26 focos `vigilar` (CC 6-10) son, salvo los que esta remediación tocó por otra razón (`blankProbe` 10, `encodeLadder` 9, `luhnValid` 8, `readServerMessage` 7, `postOnce` 6 …), exactamente los que ya registraba §3.2. La regla de §3.4-4 se mantiene: **sólo se refactoriza un foco 6-10 si se toca por otra razón.**

### 8.8 V-1 — los `needs_validation`

De los 11 hechos de §4.2, **tres eran comprobables en código** y quedaron cerrados en `0c6565f`. **Los otros ocho se ejecutaron el 2026-10-25** con sus comprobaciones seguras: **cinco se cierran con evidencia**, **dos quedan limitados a su despliegue** y **uno sigue siendo un entregable de documentación**. Ninguno es un defecto de código abierto.

| # | Hecho | Comprobación ejecutada | Resultado |
|---|---|---|---|
| 1 | ¿`MASK_ALPHA_OPAQUE` es 255? | `grep` en `packages/contracts/src` | ✅ **cerrado** — `constants.ts:62` → `export const MASK_ALPHA_OPAQUE = 255;` |
| 2 | ¿`scripts/gate.mjs` corre en CI? | leer `.github/workflows/ci.yml` + `gate.mjs` | ✅ **cerrado** — job `gates` ejecuta `node scripts/gate.mjs`; `sdk-no-host-storage` y `sdk-single-encode-sink` están dentro |
| 8 | Guard `NaN` en `toBitmapRect` | código + filas H-1 | ✅ **cerrado** — `allFinite(rect)` y **throw** si no es finito. Con `NaN` el guard de área degenerada no se disparaba (`right <= left` es `false`) y la máscara no se pintaba: ahora propaga y el pipeline corta en el estado ruidoso (T-02-10). Filas H-1 re-ejecutadas en verde |
| 10 | ¿Existe `e2e/global-setup.ts` y verifica `/api/health`? | `Test-Path` + lectura | ✅ **cerrado** — existe. Espera hasta 30 × 1 s y lanza un error con acción concreta si el stack no responde (`body.status === 'ok'`). Era 02-VERIFICATION en verde |
| 7 | ¿La CORS acepta `X-Project-Key`/`Idempotency-Key` sin credenciales? | preflight `OPTIONS` en vivo (origen permitido y no permitido) + `plugins/cors.ts` + `.env` | ✅ **cerrado** — origen listado → `access-control-allow-origin: <origen>` y `access-control-allow-headers: x-project-key,idempotency-key` con **`access-control-allow-credentials` AUSENTE**; origen no listado → **sin** `access-control-allow-origin`. `.env`: `WATCHBUG_CORS_ORIGINS` sólo orígenes propios y `WATCHBUG_TRUST_PROXY=127.0.0.1/8,::1/128,172.16.0.0/12` — **lista explícita, nunca `true`** (también cierra el #2 de §4.2 de la fase 1) |
| 4 | ¿La imagen desplegada contiene `watchbug.e2e.*`? | `docker run --rm --entrypoint sh <imagen> -c "find / -name 'watchbug.e2e.*'"` en `api` y `panel` + `ls` de la raíz | ✅ **cerrado** — ambas: **`none`**. La API nunca copia `packages/sdk` (sólo `packages/contracts` + `apps/api`) y el panel sólo recibe `/app/apps/panel/dist`. `I-1` además ya movió los bundles de test a `dist/e2e/` |
| 6 | ¿La costura sigue plegada en cada build? | `node` sobre los 6 bundles de `dist/` | ✅ **cerrado** — producción: `De="__watchbugCaptureFrame";function Ne(e){return null}` (**plegada**); `dist/e2e/watchbug.e2e.js`: `function Ne(e){let t=e[De];return typeof t=="function"?t:null}` (**control positivo vivo**) |
| 9 | ¿Ningún lane futuro rompe `mode:"closed"`? | barrido `mode:closed` / `mode:open` sobre los 8 bundles | ✅ **cerrado** — `mode:"open"` en el `dist/` desplegable: **NONE**; `mode:closed=1` en el core, `0` en `annotator`/`dom-serialize` (no son widgets). El gate **es la aserción de `build.mjs`** introducida por I-1, que corre en el job `build` de CI (y `gate.mjs` no puede cubrirlo: corre antes de generar `dist/`) |
| 11 | ¿Alguna capa de despliegue añade CSP delante de nginx? | `Invoke-WebRequest http://127.0.0.1:8080/` | 🟡 **cerrado en este despliegue** — el documento sí lleva `Content-Security-Policy: default-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`, más `X-Content-Type-Options` y `Referrer-Policy`, y lo sirve el **propio** nginx del panel (`Server: nginx/1.30.5`, fase 1 S-4). No hay ninguna capa externa delante aquí; en otro entorno sigue siendo comprobación del operador |
| 3 | WebKit no expone la cabecera `cookie` | sonda ya documentada en el código + `npm ls @playwright/test` | 🟡 **parcial** — la sonda (*probe 2026-10-24*) está **documentada en la propia fila** (`e2e/sdk.spec.ts:2372-2377`) y la mitad `cookie` de PRV-05 se afirma **explícitamente** en chromium/firefox y se omite con comentario en WebKit — nunca en verde vacío. La garantía del SDK (`credentials:'omit'`) queda respaldada por `gate.mjs sdk-no-host-storage`. **Repetir la sonda en otro host o versión de Playwright no es posible desde esta máquina** — queda como comprobación del operador |
| 5 | ¿La documentación de integración advierte del endpoint por defecto con CDN? | `grep -rn endpoint README.md documentation/` | ⏸ **sigue abierto** — **`README.md` no existe**; `documentation/` tiene 38 menciones de `endpoint`, ninguna en una guía de integración. El riesgo ya está **cerrado por código** (S-8 exige `endpoint`) y documentado en el JSDoc de `WatchbugInitOptions.endpoint` y en §8.3, pero la guía como tal es un entregable de la fase 5+

> **Balance:** 9 de los 11 cerrados, **2 limitados al despliegue** (#11: una capa externa ante nginx en otro entorno; #3: repetir la sonda de WebKit en otro host) y **1 entregable de documentación** (#5). Ninguna comprobación devolvió un fallo.

### 8.9 Verificación de la remediación

Todo en verde sobre `12a5049`, evidencia fresca ejecutada en esta sesión:

| Comando | Resultado |
|---|---|
| `npm run verify` | **309/309** — chromium + firefox + webkit (era **297/297** en la línea base) |
| `npm run lint` | ✅ limpio (`tsc -p tsconfig.json` por workspace) |
| `npm run check:size` | ✅ `core 9,4 · lazy 0,3 · adapter 0,3 · runtime 10,1 KB gz / 80 KB` — topes 45 / 25 / 14 intactos |
| `node scripts/gate.mjs` | ✅ 3 passed, 0 failed, 0 skipped |
| `npm run check:compose` | ✅ exactamente tres servicios |
| `python -m stopthatslop_cli check --pack ts` | ✅ `gate_finding_count: 0`, `teach_only_finding_count: 0`, **`exit 0`** |

**Filas e2e nuevas (4):**

| Fila | Qué afirma | Motores |
|---|---|---|
| `S-7 / PRV-02` | un secreto en **sombra abierta** y otro en **iframe de mismo origen** enmascaran en los bytes decodificados; cero píxeles originales dentro del rect y su anillo de 1 px; la región de control conserva sus píxeles | 3/3 |
| `S-8` | un script de **origen cruzado** sin `endpoint` **se niega** a iniciar y no monta nada; `endpoint: null` es un error duro; con `endpoint` explícito monta y publica exactamente ahí | 3/3 |
| `S-7 guard` | un marco de mismo origen **rotado** se rechaza en voz alta y **no sale ninguna petición** (FX-02) | 3/3 |
| `WR-03 guard` | sin CSPRNG el flujo falla **a la vista**, el host vuelve a estar visible y no se envía nada (FX-01) | 3/3 |

**Filas modificadas (2):** `fail-closed` (el orden de la tier *seam* tras WR-01, §8.5) y `P2-D-03` (no-vacuidad explícita de la igualdad de bytes, §8.6).

**Delta RNF-01:** `watchbug.js` **8745 → 9628 B gz** (8,54 → 9,40 KB, **+883 B**), todavía por debajo de una cuarta parte del tope duro de 45 KB. `watchbug.mjs` 8526 → 9405 B gz. La suma runtime es **10,1 KB gz** sobre 80 KB. Ningún lane cambió de naturaleza: sigue siendo un núcleo inyectado, sin imports nuevos y con **cero dependencias runtime** (regla `sdk-runtime-deps` en verde).

**Línea base previa.** La suite se ejecutó **antes** de tocar nada (**297/297** en `9c0c089`) y **después** de cada tanda de cambios. Dos regresiones intermedias aparecieron y se corrigieron ajustando la afirmación de la fila al comportamiento real, no aflojándola: el cambio de orden de WR-01 en la fila `fail-closed` de WebKit (§8.5) y, tras el pase de regresión de §8.10, el defecto FX-01 — que **no** lo detectó ninguna fila previa y por eso existe la fila `WR-03 guard`.

### 8.10 Pase de regresión sobre la remediación (`02-REVIEW-FIX.md`)

La remediación se sometió a su vez a un code review independiente (`gsd-code-reviewer`, profundidad *standard*, sobre exactamente los 10 ficheros del commit `0c6565f`). **Encontró 6 defectos introducidos por los propios arreglos** — 2 críticos, 2 avisos, 2 informativos. Los seis están **cerrados** en `12a5049`. Es la razón por la que esta sección tiene dos tandas: la primera remediación no era el final.

| ID | Hallazgo | Estado | Qué se hizo |
|---|---|---|---|
| **FX-01** *(crítico)* | La salida «sin CSPRNG» de WR-03 devolvía **sin `host.restore()`**. El launcher ya había ocultado el host en su propio handler, así que el «estado terminal visible» se pintaba dentro de un host `display:none` y el widget quedaba muerto para la sesión | ✅ **cerrado** | `host.restore()` en esa salida — todas las demás ya lo hacían. Fila nueva `WR-03 guard`: quita las dos entradas del CSPRNG, dispara el gesto y afirma que el host **vuelve a estar visible** y que no sale ninguna petición |
| **FX-02** *(crítico)* | El mapa de marcos era **sólo traslación**: cualquier `transform` CSS en un marco (o en un ancestro) colocaba la máscara sobre otros píxeles — el *fall-open* silencioso que SEC-01 prohíbe. La fila S-7 no podía cazarlo porque el fixture replicaba la misma fórmula sin transformar | ✅ **cerrado** | El mapa queda **custodiado**: un marco cuyo camino no sea una traslación pura, o cuyo tamaño renderizado difiera del de layout, se **rechaza** y el flujo falla en cerrado — la misma política que `capture-source.ts` aplica a una captura de ventana/pantalla cuyo registro DOM→bitmap no es verificable (OQ-1 / T-02-05). Fila nueva `S-7 guard` con un marco **rotado** |
| **FX-03** *(aviso)* | `endpoint: null` — la forma que produce una configuración JSON — se saltaba la comprobación estricta de `undefined` y caía por `??` a `location.origin`, eludiendo el rechazo de S-8 y perdiendo el `TypeError` documentado | ✅ **cerrado** | Un `endpoint` que no sea cadena es ahora un error duro tomado **antes** de cualquiera de las dos decisiones. Se afirma dentro de la fila S-8 |
| **FX-04** *(aviso)* | S-9 validaba la clave leída de `.env` pero **no** `HostFixtureOptions.projectKey`, mientras el comentario en el punto de interpolación afirmaba una garantía incondicional de no-escape | ✅ **cerrado** | Los dos caminos pasan por `fixtureKey()`, que valida la misma forma canónica |
| **FX-05** *(info)* | La cirugía de bytes del commit anterior corrompió **seis guiones largos** en comentarios de `redactor.ts` (mojibake) | ✅ **cerrado** | Restaurados; barrido de mojibake sobre los 10 ficheros limpio |
| **FX-06** *(info)* | El truncado por `MAX_SCAN_DEPTH` era un **salto silencioso**, contradiciendo la propia afirmación del módulo («nunca un salto silencioso») | ✅ **cerrado** | El exceso de profundidad ahora **lanza**: un subárbol al que no descendemos sacaría sus secretos sin enmascarar. La cota queda documentada como anidamiento de **roots**, nunca como altura del DOM |

El mismo pase declaró **sano el resto de la remediación**: traducción y corrección de *realm* en roots anidados, caminata única del contenido *slotted*, propagación *fail closed*, población de `measured.rects` y su interacción con el reintento y la idempotencia, la lane ESM, los refactors C-4/C-5/C-6 (verificados hunk a hunk contra la pre-imagen), el *tripwire* de build de I-1, V-1 #8, y las invariantes SEC-02/SEC-03, INV-01/INV-02 y RNF-01.

> **Decisión de alcance registrada (FX-02).** El mapa de marcos soporta **sólo traslación pura**. Un marco escalado o rotado se rechaza en voz alta en lugar de mapearse: es correcto y falla en cerrado, pero más estricto de lo necesario para un `scale` puro, que sí podría mapearse exactamente (`box.width / offsetWidth`). Es *backlog* deliberado, no un olvido — ver §8.11.

### 8.11 Lo que queda fuera de esta remediación

1. **Los 8 `needs_validation` de despliegue** (§8.8) siguen abiertos: son comprobaciones sobre un stack real, no sobre el repositorio.
2. **Refactors 6-10 no ejecutados** (C-7): 26 focos en banda *vigilar*, por la regla de §3.4-4.
3. **Dos focos de test por encima de CC 10** (`readControlProof` 19, `attachSecret` 11), fuera del plan por convención (§8.7).
4. ~~**Cambio de la interfaz pública** en S-8 (§8.3): registrado como disparador de consulta, pendiente de confirmación del propietario.~~ → ✅ **resuelto el 2026-10-25**: se confirma el comportamiento estricto (lanzar). Ver §8.3.
5. **`collectTextRects` quedó en CC 8** (era 17): dentro del objetivo de §3.4 (< 10), pero es la pieza más densa de las nuevas. Si se vuelve a tocar, `textMatchesFamily` + el filtro `UNRENDERED_PARENTS` son el siguiente corte natural.
6. **El mapa de marcos soporta sólo traslación pura** (§8.10, FX-02): un marco con `scale`/`zoom` se rechaza en voz alta aunque podría mapearse exactamente con `box.width / offsetWidth`.
   ✅ **Confirmado como backlog deliberado (2026-10-25).** La aproximación *fail-closed* es estricta pero segura y **no se añade ahora la complejidad de las matrices de transformación completas**. El *backlog* queda formal: si algún integrador lo necesita, el paso es `scale = box.width / offsetWidth` más una guardia para escala no uniforme. **No es un olvido y no debe tratarse como regresión.**
7. **El informe no cubre** lo que §1.3 ya declaraba fuera: nada se ejecutó durante el análisis; esta remediación **sí** ejecutó la suite completa y los gates, pero sigue sin ser una auditoría de seguridad en vivo ni una prueba de penetración.

---

*Análisis generado el 2026-10-24 sobre `9c0c089` (rama `gsd/phase-2-sdk-tracer-bullet`, base `origin/develop` = `2686e15`).*
*Remediación aplicada el 2026-10-24 en dos tandas (`0c6565f` y `12a5049`) — estado actual en **§8**.*
