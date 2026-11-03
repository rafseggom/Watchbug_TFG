<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Informe de análisis — rama `gsd/phase-3-report-composer-annotation-editor-lazy`

| | |
|---|---|
| **Fecha** | 2026-11-03 |
| **HEAD** | `0d17ab8` — *docs(03): close phase 3 - UAT 7/7, verification regenerated 74/74, transition to phase 4* |
| **Árbol de trabajo** | sucio: `documentation/entorno-trabajo.md` modificado y tres scripts sin trackear en la raíz (`manual-widget.mjs`, `open-browser.mjs`, `report-bug.cmd`), todos **fuera** del alcance |
| **Alcance** | 73 rutas vivas de las 75 que pasan el filtro (146 brutas en el diff): `git diff --name-only origin/develop...gsd/phase-3-report-composer-annotation-editor-lazy` → 2 borrados (`e2e/deploy.spec.ts`, `e2e/read-surface.spec.ts`) + 72 ficheros de código/infra + `package.json` (manifiesto, §5). 20.634 líneas |
| **Modo** | **Análisis / guidance** — sin modificar código, sin ejecutar el objetivo |
| **Ejecución del objetivo** | ninguna (sin `npm test`, sin `playwright`, sin `docker compose`, sin red) |

---

## 0. Resumen ejecutivo

| Lente | Herramienta | Resultado | Veredicto |
|---|---|---|---|
| **Slop** | `stopthatslop check --pack ts` (pack `stopthatslop-ts-node-v1`, 9 reglas, todas *checker*) | `gate_finding_count: 0`, `teach_only_finding_count: 0`, `exit 0` | ✅ **Cero slop según el detector** — pero el pack no cubre codificación, ramas muertas ni contradicciones documento/código; la revisión manual de §2 añade **28 observaciones** |
| **Complejidad** | Script propio sobre `ts.createSourceFile` (TypeScript 5.9.3), regla `CC = 1 + puntos de decisión` | **1.117 funciones** · media **2,07** · máximo **33** · 93,1 % ≤ CC 5. En producción: 313 funciones, media 3,27, **12 focos ≥ 11** | 🟠 Sano en conjunto, **concentrado** en la cadena de imagen de la API y en dos ficheros del SDK |
| **Seguridad** | `security-audit` (guidance, source-first) + revisión delegada de `apps/api`, `packages/*`, `apps/panel`, `e2e/` y `tests/` | **10 confirmados**: 1 high (heredado) · 2 medium · 6 low · 1 informational · **7 `needs_validation`** | 🔴 Un hallazgo high preexistente sin cerrar + un gate de verificación que no se ejecuta en CI |

**Prioridad de remediación posterior (§5):**

1. **P0 — La superficie de lectura sigue sin autenticar** (`GET /api/incidents` y `GET /api/incidents/:id/image` devuelven todo el almacén, incluido `user.email` y las capturas). Es el hallazgo **S-1** de la fase 1, no resuelto: la fase 3 solo añadió rate limit y paginación. La única barrera es el bind a `127.0.0.1` del compose. **Verificar exposición antes de desplegar fuera de loopback.**
2. **P1 — CI no ejecuta ninguna de las suites nuevas de R-19** (`unit`, `integration`, `contract`, `packaging`, `vrt`). El workflow solo corre typecheck, build, tamaño, gates estáticos, gitleaks y e2e; además su cabecera sigue afirmando que R-12 prohíbe los tests unitarios.
3. **P1 — El gate de la CSP del panel compara subcadenas** y **ocho controles de verificación pueden dar verde sin probar el control** (sumidero único en SKIP, marcador de política a nivel de fichero, gate del panel con 2 de 4 sumideros, snapshot de 4 prototipos, tope de jornadas evadible, umbral de rate limit sin probar, fila del proxy y atribución de nginx).
4. **P2 — Complejidad**: partir `POST /api/incidents` (CC 33 / 236 LOC) y `stripPng`/`stripWebp`; `sniffClientImage` (CC 23) es una cadena booleana trivial pero desproporcionada.
5. **P3 — Robustez del cliente**: los topes de tamaño de un adjunto se aplican después de decodificar el bitmap completo; `beforeRead` no es obligatorio en el contrato de `CaptureSource`.

---

## 1. Metodología y límites

### 1.1 Qué se hizo

| # | Acción | Comando / modo |
|---|---|---|
| 1 | Alcance | `git diff --name-only origin/develop...gsd/phase-3-report-composer-annotation-editor-lazy`, filtrado por la regla del skill (código + infraestructura, sin `.planning/`, `documentation/`, lockfiles, binarios ni `e2e/fixtures/`) |
| 2 | Slop | `python -m stopthatslop_cli check --repo-root "E:\Proyectos Github\Watchbug_TFG" --pack ts --format json` |
| 3 | Complejidad | `node <temp>/cc.mjs` sobre los 66 ficheros `.ts`/`.tsx` vivos del alcance, con el compilador de TypeScript ya presente en `stopthatslop/checkers/tsast` (5.9.3) |
| 4 | Seguridad | revisión source-first en tres pasadas delegadas (`e2e/sdk.spec.ts` + `e2e/ingest.spec.ts` + `e2e/make-fixtures.mjs`; `e2e/helpers/*` + `e2e/hostile.spec.ts`; los 25 ficheros de `tests/`), más lectura directa de los 31 ficheros de producción; consolidación y **verificación manual de todas las citas de §4.1** por este agente |
| 5 | Auditoría de dependencias | una sola pasada sobre el diff de `package.json`/`package-lock.json` (§5) |

### 1.2 Reglas de conteo de complejidad (§3)

`CC = 1 + puntos de decisión`, contando: `if` (incluidos `else if`), `for`/`for in`/`for of`, `while`, `do while`, `case` y `default`, `catch`, ternario `? :`, y los operadores `&&` / `||` (`??` no cuenta). Cada punto de decisión pertenece a la función que lo contiene de forma más interna: **una función anidada se mide aparte y no infla a la externa**. Umbrales: 1-5 *ok* · 6-10 *vigilar* · 11-15 *refactorizar ya* · 15+ *dividir sin discusión*. La columna LOC es el rango de líneas de la función, extremos incluidos.

### 1.3 Qué NO cubre este informe

- **No es un full audit.** Una sola pasada, sin ledger de cobertura acumulada, sin `findings.json` ni validadores independientes. No existe auditoría previa de esta rama que arrastrar.
- **No se ejecutó el código del objetivo.** Ninguna aserción se apoya en una reproducción en vivo: no se corrió la suite e2e, ni Vitest, ni los gates, ni el stack de compose. Los hechos que dependen de una ejecución están en §4.2.
- **El detector de slop es un conjunto cerrado de 9 reglas.** Que devuelva `0` significa "ninguna de esas 9 se dispara", no "no hay slop": la corrupción de codificación de `incidents.ts`, las ramas muertas y las contradicciones comentario/código que recoge §2 son invisibles para él.
- **La revisión de `e2e/sdk.spec.ts` (4.454 líneas) se delegó y se contrastó por muestreo**, no línea a línea por este agente. Las citas de ese fichero se verificaron en los puntos que sostienen un hallazgo.
- **La cobertura del grafo de código no se usó como evidencia**: el índice disponible no estaba garantizado fresco para esta rama, así que todo el análisis se hizo sobre fuente leída directamente (regla source-first).

### 1.4 Cobertura del alcance (trazabilidad)

| Capa | Ficheros | Cómo se analizó |
|---|---|---|
| `apps/api` (rutas, ingesta, purga, esquema, migración) | 9 | Lectura directa + tres lentes |
| `apps/panel` (cliente HTTP y detalle) | 2 | Lectura directa + tres lentes |
| `packages/contracts` | 1 | Lectura directa + tres lentes |
| `packages/sdk` (core, captura, máscaras, editor, composición, transporte, i18n) | 21 | Lectura directa + tres lentes |
| `scripts/` y configuraciones de runner (`playwright*`, `vitest`) | 5 | Lectura directa + tres lentes |
| `.github/workflows/` | 1 | Lectura directa + tres lentes |
| `e2e/` (3 specs vivos + `make-fixtures.mjs` + 4 helpers) | 8 | Pasada delegada con las tres lentes; citas de los hallazgos verificadas por muestreo |
| `tests/` (unit, integration, contract, packaging, vrt) | 25 | Pasada delegada con las tres lentes; citas de los hallazgos verificadas por muestreo |
| `package.json` (manifiesto) | 1 | Auditoría de dependencias (§5.1) |
| **Total** | **73** | — |

Los dos ficheros borrados en la fase (`e2e/deploy.spec.ts`, `e2e/read-surface.spec.ts`) no se analizan: su contenido ya no existe en `0d17ab8`; sus aserciones se trasladaron a `tests/packaging` y `tests/integration`.

---

## 2. Slop de código — `stopthatslop`

**Pack:** `stopthatslop-ts-node-v1` — 9 reglas, **todas `checker`** (ya no hay reglas *teach-only* en esta versión del pack):
`no-unvalidated-external-href`, `no-fetch-without-abort-timeout`, `no-node-builtin-in-client-module`, `no-mixed-controlled-uncontrolled`, `no-orphaned-effect-timeouts`, `no-or-default-for-nonzero-number`, `no-empty-catch-in-route-handler`, `no-eager-heavy-dependency-import`, `no-unguarded-json-parse-on-external-input`.

**Resultado (HEAD `0d17ab8`):**

```
passed: true
gate_finding_count: 0
teach_only_finding_count: 0
exit 0
```

Ningún fichero del alcance dispara ninguna de las 9 reglas. Las correcciones de la fase 1 siguen en pie (carga perezosa de `sharp`, `AbortSignal.timeout` en los `fetch`, `res.json()` dentro de `try`).

### 2.1 Revisión manual (fuera del alcance del pack)

| # | Regla | Fichero:línea | Observación |
|---|---|---|---|
| 1 | `encoding-corruption` | `apps/api/src/routes/incidents.ts:93-100` | **12 bytes U+FFFD** (`EF BF BD`) en el docblock: `preHandler �?" before` y `(limits ��' key` — un round-trip Windows-1252 corrompió el texto. Es el único fichero del alcance con bytes de reemplazo. |
| 2 | `dead-disjunct` | `apps/api/src/ingest/structure.ts:87` | `!PNG_ALLOWED.has(type) \|\| PNG_METADATA_CHUNKS.has(type)`: el segundo operando es inalcanzable, porque todo chunk de metadatos ya está fuera de `PNG_ALLOWED`. |
| 3 | `empty-branch` | `apps/api/src/ingest/structure.ts:87-89` | Rama `if` con cuerpo vacío y solo un comentario; invertir la condición o usar `continue`. |
| 4 | `dead-state` | `packages/sdk/src/index.ts:405` | `mounted` guarda `host/launcher/panel/composer/review/config`, pero lo único que se lee en todo el fichero es `mounted !== null`; el payload nunca se consume. |
| 5 | `duplicated-constant` | `packages/sdk/src/index.ts:49` | `WATCHBUG_VERSION = '0.1.0'` duplica `package.json.version` (hoy coincide); ningún gate lo comprueba. |
| 6 | `dead-guard` | `packages/sdk/src/redact/redactor.ts:200` | La guarda de longitud cero de `textMatchesFamily` es inalcanzable: las cuatro familias son regex globales que no pueden casar vacío. |
| 7 | `comment-contradiction` | `packages/sdk/src/widget/composer.ts:720` | El comentario promete "the chunk carries no colour literal of its own" y la línea devuelve el literal `'#2f6feb'`. |
| 8 | `unclamped-write` | `packages/sdk/src/widget/composer.ts:932` | `reviewButton` escribe `draft.note = noteInput.value` sin el `clampCodePoints` que sí aplica el handler de `input` (línea 884). |
| 9 | `missing-listener` | `packages/sdk/src/annotator/canvas-layer.ts:87` | `fitCanvas()` corre una sola vez; no hay listener de `resize`, así que el canvas conserva el encaje anterior tras un cambio de viewport. |
| 10 | `module-level-flag` | `packages/sdk/src/annotator/editor-dom.ts:708` | `cssInjected` impide reinsuflar `EDITOR_CSS` en un shadow root nuevo; hoy es inalcanzable porque no hay teardown público. |
| 11 | `validation-duplication` | `packages/sdk/src/redact/masks.ts:49-76` y `99-108` | Tres validaciones de rect casi idénticas (`putPatch`, `assertPaintRect`, clamp de cada primitiva). |
| 12 | `speculative-shape` | `apps/panel/src/api.ts:100-113` | `fetchIncidents` acepta array **o** `{rows}` y `nextCursor ?? cursor`: dos contratos de respuesta para un endpoint que emite uno. |
| 13 | `logging-inconsistency` | `apps/api/src/purge.ts:96,106,125` | `console.*` en vez del logger de pino que Fastify ya tiene: los barridos TTL no quedan en el log estructurado. |
| 14 | `fixed-sleep-assertion` | `e2e/sdk.spec.ts:212` (y 1508, 1598, 2890, 3237, 3311, 3678) | `expectNoRequest` duerme 600 ms antes de afirmar "cero POSTs"; el comentario lo llama "an assertion, not a race" — es exactamente una carrera. |
| 15 | `magic-offset` | `e2e/helpers/capture-stubs.ts:536` (repetido en `:873`) | El clic del lanzador se hace en `viewport - 48, viewport - 48`, no sobre el botón; `probeHost` comparte la misma suposición, así que puede validarse a sí mismo. |
| 16 | `poll-then-reread` | `e2e/helpers/editor.ts:320` | Espera `data-shown` y vuelve a leer el diálogo en un segundo `evaluate`: TOCTOU entre las dos llamadas. |
| 17 | `config-at-import` | `e2e/ingest.spec.ts:25,35` | `projectKey()` se ejecuta al cargar el módulo: sin `.env` el fichero falla en colección y dos jornadas desaparecen del run sin decir "no ejecutado". |
| 18 | `duplication` | `e2e/make-fixtures.mjs:36-195` | El mismo canvas y el mismo conversor base64 aparecen cinco veces (~120 de 204 líneas son copia). |
| 19 | `fragile-replace` | `e2e/helpers/host-fixtures.ts:308` | `html.replace(/\s+onload="[^"]*"/, '')` elimina el **primer** `onload` del documento; un segundo handler convierte `autoInit: false` en un no-op silencioso. |
| 20 | `unfalsifiable-assertion` | `e2e/hostile.spec.ts:389` | `toContain('ab')` no puede fallar: el heading `Watchbug` del propio fixture ya contiene `ab`. |
| 21 | `silent-under-validation` | `tests/contract/report-schema-agreement.test.ts:124` | El intérprete del JSON Schema solo trata `additionalProperties === false`; una forma con esquema se ignoraría en silencio (latente: el artefacto actual no la usa). |
| 22 | `brittle-inventory` | `tests/packaging/journey-cap.test.ts:26,40` | La jornada y el inventario se cuentan con regex sobre el texto (`^test\.describe\('J-\d\d — `, `^\s+test\(`); renombrar con otro guion rompe el gate sin que cambie la cobertura. |
| 23 | `stale-policy-prose` | `.github/workflows/ci.yml:3-12,154-156` | La cabecera afirma que R-12 "abolishes unit tests" y ordena "Do not add them", mientras `package.json` ya publica `test:unit\|integration\|contract\|vrt\|packaging`. |
| 24 | `conditional-gate` | `tests/integration/read-surface-rate-limit.test.ts:99-105` | `if (next) { … }`: si la API deja de emitir `x-next-cursor`, la fila de paginación pasa sin ejecutarla (`data.length <= 5` también se cumple con lista vacía). |
| 25 | `type-not-value` | `tests/integration/ingest-idempotency.test.ts:108-110` | `typeof statusCode === 'number'` en vez de `statusCode === 400`: un 401/409 numérico pasaría la fila. |
| 26 | `first-error-only` | `tests/contract/report-schema-agreement.test.ts:260-262` | `validate(...)[0]` inspecciona solo el primer error; uno espurio anterior al de tipo también satisface la fila. |
| 27 | `title-vs-coverage` | `tests/unit/i18n-resolver.test.ts:91-97` | "translates every EN string to a different ES string" solo comprueba `composer.heading.feedback`: un diccionario ES 90 % en inglés pasaría. |
| 28 | `duplicated-constants` | `tests/integration/hostile-size-caps.test.ts:12-14` | Replica `MAX_BODY_BYTES`/`MAX_IMAGE_PART_BYTES`/`MAX_ENCODED_IMAGE_BYTES` en vez de importarlas: subir el límite real hace fallar la fila por el número copiado. |

### 2.2 Lectura

- **El hallazgo 1 no es cosmético**: un docblock corrupto en la ruta de ingesta es lo primero que lee quien vaya a tocar el pipeline, y las flechas `→` que describen el orden de los preHandlers son justo la información que se pierde.
- **Los hallazgos 2, 3, 6 y 10 son ramas muertas**. Ninguna cambia el comportamiento, pero todas dicen "aquí hay una decisión" donde ya no la hay, y encarecen la lectura de los dos ficheros con más densidad de seguridad del repo.
- **Los hallazgos 7 y 8 son contradicciones dentro de la misma función** que el comentario usa para justificar una decisión de diseño (P3-D-07 y el clamp del contrato). La primera induce a error sobre de dónde sale el color; la segunda deja una vía por la que un `note` sin clamps puede llegar al wire si se escribe por código y no por teclado.
- **Los hallazgos 14-19 y 24-28 son el patrón dominante en `e2e/` y `tests/`**: esperas fijas para probar negaciones, offsets mágicos, relecturas y aserciones que aceptan más de lo que su título promete. La suite es grande (4.454 líneas en un solo spec) y estos patrones son la fuente natural de intermitencia y de falsos verdes.
- **El detector no ve ninguno de los 28.** Su pack cubre patrones de framework (fetch sin abort, JSON sin guardia, imports pesados); no cubre integridad del texto, ramas inalcanzables ni coherencia entre comentario y código.

### 2.3 Observación de proceso

`stopthatslop` **no está conectado a CI**: ningún job de `.github/workflows/ci.yml` ni `scripts/gate.mjs` lo invoca. Se ejecuta a mano cuando alguien lo recuerda. Igual que en la fase 1 (`L-2`, descartado a propósito), el gate existe y no gatea.

---

## 3. Complejidad ciclomática

**Sin herramienta estándar instalada**: el repo no tiene `eslint`, `radon` ni `lizard`, y `npm run lint` es un `tsc --noEmit` por workspace. Se aplicó la rama *"count manually, per function, show the count"* con un script de análisis estático sobre el AST.

### 3.1 Distribución global

| Ámbito | Ficheros | Funciones | Media CC | Máximo | 1-5 *ok* | 6-10 *vigilar* | 11-15 *ya* | 15+ *dividir* |
|---|---|---|---|---|---|---|---|---|
| **Todo el alcance** | 63 | **1.117** | **2,07** | **33** | 1.040 (93,1 %) | 58 | 8 | 11 |
| Producción (sin `tests/`, `e2e/` ni configs) | 31 | 313 | 3,27 | 33 | 259 (82,7 %) | 42 | 5 | 7 |
| Tests, e2e y configuraciones | 32 | 804 | 1,61 | 21 | 781 | 16 | 3 | 4 |

**Veredicto:** el conjunto está muy por encima de la media en salud — 9 de cada 10 funciones por debajo de CC 6. El problema no es difuso: **12 funciones de producción concentran todos los focos**, y 7 de ellas están en la cadena de imagen (API: `structure`, `guard`, `sniff`; SDK: `manual-file`, `redact/masks`).

### 3.2 Hotspots de producción (CC ≥ 11)

| CC | LOC | Función | Fichero:línea | Umbral |
|---|---|---|---|---|
| **33** | 236 | handler `POST /api/incidents` (anónimo) | `apps/api/src/routes/incidents.ts:172` | 🔴 15+ → dividir |
| **23** | 30 | `sniffClientImage` | `packages/sdk/src/capture/manual-file.ts:43` | 🔴 15+ → dividir |
| **21** | 50 | `putPatch` | `packages/sdk/src/redact/masks.ts:47` | 🔴 15+ → dividir |
| **20** | 55 | `stripPng` | `apps/api/src/ingest/structure.ts:57` | 🔴 15+ → dividir |
| **17** | 30 | `readJpegDimensions` | `apps/api/src/ingest/guard.ts:83` | 🔴 15+ → dividir |
| **16** | 51 | `onPointerUp` | `packages/sdk/src/annotator/canvas-layer.ts:322` | 🔴 15+ → dividir |
| **16** | 49 | `stripWebp` | `apps/api/src/ingest/structure.ts:113` | 🔴 15+ → dividir |
| 12 | 64 | `capture` (`ManualFileCapture`) | `packages/sdk/src/capture/manual-file.ts:82` | 🟠 11-15 → refactorizar ya |
| 12 | 45 | `reviewDraft` | `packages/sdk/src/index.ts:271` | 🟠 11-15 → refactorizar ya |
| 12 | 17 | `showScreen` | `packages/sdk/src/index.ts:217` | 🟠 11-15 → refactorizar ya |
| 11 | 13 | `sniffImage` | `apps/api/src/ingest/sniff.ts:20` | 🟠 11-15 → refactorizar ya |
| 11 | 39 | `fillBitmapRects` | `packages/sdk/src/redact/redactor.ts:335` | 🟠 11-15 → refactorizar ya |

Focos en tests/e2e (no entran en el plan de refactor): `validate` (21) en `tests/contract/report-schema-agreement.test.ts:83`, dos callbacks `page.evaluate` (20 y 17) en `e2e/hostile.spec.ts:63` y `e2e/helpers/editor.ts:411`, y `jpegHeaderDims` (17) en `tests/integration/ingest-schema-validation.test.ts:237`.

### 3.3 Por fichero de producción (media CC · focos ≥ 6)

| Media | Máx | Funcs | Fichero | Focos |
|---|---|---|---|---|
| **14,3** | 20 | 3 | `apps/api/src/ingest/structure.ts` | `stripPng=20`, `stripWebp=16` |
| **12,0** | 23 | 3 | `packages/sdk/src/capture/manual-file.ts` | `sniffClientImage=23`, `capture=12` |
| **11,0** | 11 | 1 | `apps/api/src/ingest/sniff.ts` | `sniffImage=11` |
| **8,2** | 21 | 5 | `packages/sdk/src/redact/masks.ts` | `putPatch=21`, `pixelateRegion=9` |
| **8,2** | 17 | 5 | `apps/api/src/ingest/guard.ts` | `readJpegDimensions=17`, `readWebpDimensions=9` |
| **5,6** | 33 | 14 | `apps/api/src/routes/incidents.ts` | POST=33, GET lista=10, `decodeCursor=9` |
| 4,2 | 10 | 4 | `packages/sdk/src/annotator/masks.ts` | `bakeMask=10` |
| 3,8 | 11 | 18 | `packages/sdk/src/redact/redactor.ts` | `fillBitmapRects=11` |
| 3,5 | 10 | 4 | `packages/sdk/src/annotator/tools.ts` | `drawStroke=10` |
| 3,4 | 10 | 7 | `apps/panel/src/api.ts` | `requestJson=10` |
| 3,0 | 12 | 25 | `packages/sdk/src/index.ts` | `reviewDraft=12`, `showScreen=12` |
| 2,9 | 16 | 27 | `packages/sdk/src/annotator/canvas-layer.ts` | `onPointerUp=16` |

`packages/sdk/src/widget/composer.ts` no aparece aquí por CC (media 2,8, máximo 10) pero **sí es el mayor hotspot de tamaño**: una factoría de 627 líneas con 42 funciones internas.

### 3.4 Plan de refactor posterior *(descripción, no aplicado)*

Orden por riesgo, no por tamaño:

1. **`incidents.ts:172` (CC 33 / 236 LOC)** — una sola función valida el contrato, aplica caps, resuelve idempotencia, sanea, endurece la imagen, escribe el blob y persiste. Extraer `readMultipart`, `validateImageChain`, `storeBlob`, `insertIdempotent` y aplicar guard clauses al principio. Objetivo: cada pieza por debajo de CC 10. *Precondición: `tests/integration/ingest-*` y `e2e/` en verde antes y después.*
2. **`structure.ts:57/113` (`stripPng` 20, `stripWebp` 16)** — table lookup de chunks y un `extract function` por tipo. Es código binario sensible (SEC-02): el refactor debe preservar byte a byte el comportamiento y validarse con `e2e/fixtures/`.
3. **`manual-file.ts:43` (`sniffClientImage` 23)** — la función es una cadena de comparaciones de bytes; sustituirla por una tabla de firmas (`[{name, bytes}]` + `every`) baja el CC a ~4 sin cambiar semántica. `capture` (12) se arregla extrayendo la validación de dimensiones.
4. **`redact/masks.ts:47` (`putPatch` 21)** — cuatro `isFinite` + cuatro `isInteger` + tres comprobaciones de rect: un único `assertRectIntegral(rect, target)` compartido con `assertPaintRect` (hoy duplicado).
5. **`guard.ts:83` (`readJpegDimensions` 17)** — el walk de marcadores es intrínsecamente ramificado; extraer `isStandaloneMarker`, `isSofMarker` y `readSofDims` deja el bucle en CC ~6 y hace auditable cada condición.
6. **`canvas-layer.ts:322` (`onPointerUp` 16)** — separar el commit por herramienta (`commitFreehand`, `commitShape`, `commitMask`) y la comprobación de "dentro del canvas".
7. **Los 42 focos de CC 6-10** — *watch*: refactorizar solo si se tocan por otra razón.

---

## 4. Seguridad — `security-audit` (guidance mode)

**Método:** fuente primero. Principio rector: *un candidato sin principal afectado, recurso y resultado concretos no es un hallazgo*. Solo los registros **confirmados** reciben severidad; los `needs_validation` no la tienen. Las citas de §4.1 se releyeron contra el árbol en `0d17ab8`.

### 4.1 Hallazgos confirmados

#### 🔴 [HIGH] La superficie de lectura sigue sin autenticación — heredada de la fase 1, sin cerrar

- **Evidencia** (verificada): `apps/api/src/routes/incidents.ts:425-432` — el `GET /api/incidents` solo lleva `readRateLimit` como `preHandler`; el comentario lo declara deliberado ("the read surface is deliberately ungated", DEP-03 → Fase 5). `:482-484` — la ruta del blob, igual. `:551-566` — `toListRow` devuelve `user.email`, `user.name` y `user.id` verbatim. El panel proxya `/api/` desde nginx, así que la lectura es alcanzable por cualquier cliente que llegue al panel.
- **Frontera:** cliente de red sin credenciales → `GET /api/incidents` y `GET /api/incidents/:id/image` → control pretendido **SEC-05** ("unauthorised access to admin APIs blocked") y **R-04** ("attachments served only through the authenticated API") → afectado: **todos los reportes y capturas de la instancia** → resultado: volcado completo con PII y screenshots.
- **Por qué se mantiene el veredicto:** la fase 3 **sí** mejoró la mitad de abuso (rate limit por IP en ambas rutas y paginación keyset con `limit` acotado a 200), pero no la de autenticación: `AuthProvider` sigue sin existir en el código. El bind a `127.0.0.1` del compose es una propiedad de despliegue, no un control de acceso.
- **Fix mínimo:** un `preHandler` de autorización sobre las rutas de lectura y acotar las filas al proyecto del principal (Fase 5). Mientras tanto, la comprobación de §4.2-1 es obligatoria antes de exponer nada.
- **Invariante:** *ninguna ruta que devuelva datos de incidentes puede ejecutarse sin una comprobación de autorización exitosa, y toda lectura está acotada al proyecto del principal.*

#### 🟠 [MEDIUM] CI no ejecuta ninguna de las suites que R-19 introdujo

- **Evidencia** (verificada): `.github/workflows/ci.yml` tiene seis jobs — `build`, `size`, `gates`, `sdk-deps`, `secrets`, `e2e` — y **cero apariciones** de `vitest`, `test:unit`, `test:integration`, `test:contract`, `test:packaging` o `test:vrt`. El `package.json` de la raíz sí publica las seis entradas (`test:unit`, `test:integration`, `test:contract`, `test:vrt`, `test:packaging`, `test:all`), y la fase 3 creó 25 ficheros de test más la configuración de VRT. El job `e2e` levanta el stack y corre `npm run verify` (solo Playwright funcional).
- **Frontera:** cambio entrante → los tests que cubren SEC-05 (sanitización, rate limit, caps de tamaño), CA-01 (contrato) y las invariantes de empaquetado **no se ejecutan en CI** → resultado: una regresión puede mergear en verde, y el "74/74" de la verificación de fase no se re-comprueba en cada PR.
- **Atenuante:** el e2e sí corre y cubre las rutas hostiles a nivel de artefacto; por eso es `medium` y no `high`. Pero R-19 declaró estas suites la capa barata donde debe fallar primero.
- **Fix mínimo:** un job `suites` que haga `npm ci && npm run test` + `npm run test:contract` + `npm run test:packaging`, y `npm run test:integration` en el mismo job que ya levanta el compose; VRT como job opcional. Y corregir la cabecera del workflow, que aún ordena no añadir tests unitarios.
- **Invariante:** *toda suite que el proyecto declara como política de verificación se ejecuta en CI o no es política, es documentación.*

#### 🟠 [MEDIUM] El gate de la CSP del panel compara subcadenas — una política debilitada pasaría

- **Evidencia** (verificada): `tests/packaging/deploy-contract.test.ts:86-91` afirma con `toContain` sobre la cabecera completa. Añadir `'unsafe-inline'` a `script-src` o `default-src` sigue conteniendo `default-src 'self'`, así que la fila pasa; el comentario del propio fichero afirma que "a partial policy cannot satisfy the row".
- **Frontera:** cambio en `apps/panel/nginx.conf` → gate de despliegue → afectado: cualquier cliente que cargue el panel → resultado: una CSP con `unsafe-inline`/`unsafe-eval`, o sin `script-src`/`object-src`, se despliega con el gate en verde.
- **Fix mínimo:** parsear la cabecera en directivas y asertar la ausencia de `unsafe-inline`/`unsafe-eval` y la presencia de `default-src`, `script-src`, `style-src`, `object-src`, `base-uri` y `frame-ancestors` con sus valores exactos.
- **Invariante:** *un gate de una cabecera de seguridad compara directivas, no subcadenas.*

#### 🟡 [LOW] Ocho controles de verificación pueden dar verde sin haber probado el control

Ocho gates comparten el mismo modo de fallo: el sujeto cambia o desaparece y el gate lo interpreta como éxito.

| # | Control | Evidencia | Qué se pierde |
|---|---|---|---|
| 1 | Gate del sumidero único | `scripts/gate.mjs:152-156` devuelve `skip` cuando `sinks === 0`, y `STRICT = false` (`:34`) hace que un SKIP no cuente como fallo | Un `encodeFinal` borrado o movido deja de estar gateado; la invariante C-2/SEC-02 ("máscaras re-aplicadas antes del único encode") pierde su comprobación estática. Es el hallazgo **IN-02** de la propia fase. |
| 2 | Gate de política documental | `tests/packaging/doc-policy-consistency.test.ts:100,115` acepta un marcador **en cualquier línea anterior del fichero**, `SCAN_ROOTS:53` solo recorre `AGENTS.md`, `documentation`, `scripts` y `.planning`, y `:54` limita las extensiones a `.md`/`.mjs` | `AGENTS.md:250` sigue afirmando "No unit-test suites, no coverage thresholds" y pasa; `.github/workflows/ci.yml` (fuera de los roots) contiene la misma contradicción y el gate no puede verla. |
| 3 | Gate de sumideros HTML del panel | `tests/packaging/no-dangerouslySetInnerHTML.test.ts:16-17` busca solo `dangerouslySetInnerHTML` e `innerHTML` | `outerHTML`, `insertAdjacentHTML`, `document.write`, `srcdoc` o un `href` con `javascript:` no se detectan — el gate del SDK (`scripts/gate.mjs:173-178`) sí cubre cuatro sumideros, el del panel dos. |
| 4 | Snapshot de superficie global | `e2e/helpers/host-fixtures.ts:129` compara solo `Object`, `Element`, `HTMLElement` y `EventTarget` | Un parche en `Node.prototype`, `Document.prototype`, `Navigator.prototype` o `CanvasRenderingContext2D.prototype` pasa la fila, aunque INV-02 prohíbe "any native prototype patching". Es el hallazgo **FIX-01** del análisis delegado. |
| 5 | Tope de jornadas e2e | `tests/packaging/journey-cap.test.ts:26,30,112` reconoce solo `test.describe('J-NN — …`, no `test.describe.serial`, `.skip`/`.fixme` ni títulos con backticks, y `readdirSync(e2e)` no es recursivo | Un 15.º journey declarado con un modificador o en un subdirectorio evade el tope R-19 con la suite en verde. |
| 6 | Umbral del rate limit de lectura | `tests/integration/read-surface-rate-limit.test.ts:70-82` acepta un 429 en **cualquier** iteración, incluso la primera, y no exige que 1..N respondan 200 | Un limitador global (o un 429 permanente) pasa la fila; el umbral por IP no se prueba. |
| 7 | Fila CR-02 "a través del proxy" | `tests/integration/hostile-auth-rate-limit.test.ts:386-387` solo exige `not.toBe(429)` | Si nginx deja de enrutar `/api`, la respuesta 404/502/503 sigue siendo "no 429" y la fila queda verde. |
| 8 | Fila `client_max_body_size` de nginx | `tests/integration/hostile-size-caps.test.ts:255-262` aserta el 413 pero no de quién viene | Si la directiva de nginx desaparece, Fastify sigue devolviendo 413 y la prueba pasa: el control de borde queda sin atribución. |

- **Frontera:** quien cambia el código (o una regresión) → el control que debía detenerlo → afectado: la confianza en el verde de CI → resultado: un invariante de seguridad sin evidencia ejecutable.
- **Fix mínimo:** tratar `sinks === 0` como FAIL; exigir el marcador de política **por sección** y escanear `.github/` + `README.md` + `.ts`/`.yml`; unificar el gate de sumideros HTML en una sola lista de cinco patrones para SDK y panel; ampliar la lista de prototipos; aceptar los modificadores de `describe` y recorrer `e2e/` recursivamente; exigir el bucle `200…200, 429` con `Retry-After`; asertar `401` (o `201`) en la fila del proxy y el `content-type: text/html` de nginx en la del tamaño.
- **Invariante:** *un control cuya ausencia de sujeto se reporta como éxito no es un control.*

#### 🟡 [LOW] Los topes de tamaño de un adjunto se aplican después de decodificar el bitmap entero

- **Evidencia** (verificada): `packages/sdk/src/capture/manual-file.ts:108` llama a `createImageBitmap(file)` (decode completo), y solo en `:114-121` compara `bitmap.width * bitmap.height` contra `MAX_IMAGE_PIXELS` y `MAX_IMAGE_DIM`. El comentario reconoce que "the decode of the bitmap already happened at the engine's own budget".
- **Frontera:** usuario final → fichero grande elegido por él o recibido de un tercero → frontiera de memoria del tab → afectado: la pestaña del usuario y el borrador en curso → resultado: una imagen de decenas de megapíxeles puede agotar la memoria antes de ser rechazada (caída del tab y pérdida del informe).
- **Por qué es `low`:** es auto-infligido y el servidor tiene su propio guard de cabecera antes de decodificar; el SDK no es el control de registro.
- **Fix mínimo:** leer las dimensiones de la cabecera (el servidor ya tiene el lector) o pasar `resizeWidth`/`resizeHeight` al decoder para acotar la asignación.
- **Invariante:** *ningún buffer de tamaño determinado por el atacante se materializa antes de comprobar su tamaño.*

#### 🟡 [LOW] `beforeRead` no es obligatorio en el contrato de `CaptureSource`

- **Evidencia** (verificada): `packages/sdk/src/capture/pipeline.ts:250` — `const rects = measured.rects ?? redactor.collect();`. Si un adaptador no invoca `beforeRead`, los rects se miden **después** de capturar y de restaurar el host, que es exactamente la condición que WR-01/H-1 eliminaron para que una máscara no se desplace.
- **Frontera:** adaptador de captura de terceros (seam reservado de R-02) → frame ya leído → afectado: los píxeles que deberían quedar destruidos → resultado: una máscara aplicada a una región medida en otro instante; el secreto puede quedar visible.
- **Por qué es `low`:** los dos adaptadores enviados (`DisplayMediaCapture` y `ManualFileCapture`) llaman a `beforeRead`; el camino solo se abre con un adaptador nuevo.
- **Fix mínimo:** convertir la invocación en obligatoria — si `measured.rects === null` al volver, fail-closed con `captureNote: 'denied'`.
- **Invariante:** *una medición tardía nunca sustituye a la medición en el instante de lectura; si falta, no se envía.*

#### 🟡 [LOW] El detalle interno del codec viaja en el cuerpo 400

- **Evidencia** (verificada): `apps/api/src/ingest/harden.ts:77-81` construye el mensaje con la primera línea del error de sharp (hasta 160 caracteres) y `incidents.ts:300-306` lo devuelve tal cual al cliente.
- **Frontera:** cliente sin autenticar → POST con imagen manipulada → afectado: la superficie de información del servidor → resultado: se revela la clase de fallo del decoder, su redacción y ocasionalmente rutas o versiones de libvips.
- **Fix mínimo:** mapear a un mensaje fijo por clase (`decode`, `timeout`, `unsupported`) y registrar el detalle solo en el log del servidor.
- **Invariante:** *el cliente recibe una categoría de error, nunca el texto de una librería interna.*

#### 🟡 [LOW] La capa de tests codifica modelos que no son los de producción

- **Evidencia** (verificada):
  1. **Datos persistentes sin teardown** — `e2e/ingest.spec.ts:83-88,121-125` crea dos informes reales (uno con PNG) contra el stack y no los borra; `e2e/sdk.spec.ts:1319-1331,3218-3225` hace lo mismo en las filas de stack real.
  2. **Mock de ingesta sin autenticación** — `e2e/sdk.spec.ts:161-178` (y ~33 sitios) responde `201` a cualquier POST sin mirar `X-Project-Key`: una regresión de la validación de clave seguiría mostrando "Report sent ✓".
  3. **Lectura con clave que nadie consulta** — `tests/integration/hostile-sanitisation.test.ts:65` y `read-surface-rate-limit.test.ts:24` envían `X-Project-Key` a `GET /api/incidents`, una ruta que **no lo consulta** (`incidents.ts:425-432`).
  4. **Un test unitario de una copia, no de producción** — `tests/unit/url-path.test.ts:11-19` define un `extractPathOnly` local que, para una URL absoluta, devuelve `/cb`, mientras el contrato real conserva esquema y host (`tests/integration/hostile-sanitisation.test.ts:211`). El test puede pasar con una divergencia real de R-08.
  5. **Familias de redacción sin ejercicio** — `tests/unit/redaction-patterns.test.ts:89-92` cuenta las cuatro familias `*-in-input` pero solo ejerce las cuatro `TEXT_FAMILIES` (`:94-151`): un regex de valor de formulario roto no hace fallar ninguna fila, y SEC-01 depende de él.
- **Frontera:** ejecución de la suite → PostgreSQL 18 + volumen de adjuntos (R-04) y la confianza en la cobertura de SEC-01/SEC-05 → afectado: la base del desarrollador y la garantía de que la autenticación y la redacción se prueban → resultado: filas y blobs acumulados, y aserciones que seguirían verdes con la ingesta o la redacción de formularios rota.
- **Atenuante:** en CI el stack se destruye con `docker compose down -v`; el e2e de artefacto sí cubre las rutas hostiles reales. Por eso es `low`.
- **Fix mínimo:** `test.afterAll` que borre por los `id` devueltos (o stack efímero); mock que devuelva `401` sin clave, con una fila que lo afirme; retirar el header inútil de `storedRow`; que `url-path.test.ts` importe `stripQueryFragment` de producción; añadir una fila por cada familia `*-in-input`.
- **Invariante:** *un test que no ejercita la función de producción no prueba la propiedad que nombra, y una suite que escribe en un recurso persistente lo limpia.*

#### 🟡 [LOW] La cobertura e2e tiene tres huecos concretos

- **Evidencia** (verificada):
  1. `e2e/helpers/capture-stubs.ts:39` — `captureStubTier` devuelve `'seam'` para WebKit, así que **ninguna fila de WebKit ejerce el adaptador de producción** (`getDisplayMedia → <video> → drawImage`); Safari real no está probado en ese tramo.
  2. `e2e/hostile.spec.ts:396-400` — el barrido "render-inert" busca solo `[onerror]`, `script:not([src])`, `iframe` y `javascript:`; `onclick`, `onload`, `<svg onload>` o `srcdoc` no se detectan.
  3. `e2e/sdk.spec.ts:3833,4016` — `page.route(/\/api\/health$/)` no ancla el origen, así que la sonda de no-vacuidad puede satisfacerse con tráfico a otro origen.
- **Frontera:** regresión en el adaptador de captura de Safari o en el render inerte → suite en verde → afectado: el usuario final de WebKit y la garantía SEC-05 → resultado: un fallo real no se detecta en el motor donde más diverge.
- **Fix mínimo:** una fila WebKit sin costura que verifique al menos el fallo clasificado (`no-api`); ampliar el barrido a los atributos `on*` y `srcdoc`; anclar la ruta al origen del fixture.
- **Invariante:** *cada motor declarado en `playwright.config.ts` ejerce el camino de producción que se le atribuye, y un barrido de sinks enumera la clase completa, no cuatro ejemplos.*

#### ⚪ [INFORMATIONAL] Ctrl+Z sigue activo con el diálogo de confirmación de máscara abierto

- **Evidencia** (verificada): `packages/sdk/src/annotator/canvas-layer.ts:473-477` ejecuta `undoStroke()` con Ctrl/Cmd+Z sin comprobar `shell.maskDialog.isOpen()`; el diálogo solo intercepta `Escape` y `Tab` (`editor-dom.ts:589-609`). Es el hallazgo **IN-01**, abierto por decisión de alcance del propietario.
- **Por qué es informativo:** el puntero ya está bloqueado mientras el diálogo está abierto y el bake está condicionado a la confirmación; el atajo deshace un trazo, no una máscara (las máscaras nunca entran en la pila de undo). Es un fallo de UX, no de integridad de la máscara.
- **Fix mínimo:** `if (shell.maskDialog.isOpen()) return;` en la rama del atajo.

### 4.2 `needs_validation` (7) — hechos fuera del repositorio

| # | Hecho pendiente | Comprobación segura |
|---|---|---|
| 1 | **¿Es la instancia alcanzable más allá de `127.0.0.1`?** Es lo que fija la severidad de §4.1-1 | `docker compose port api 3000` / `docker compose port panel 8080`; desde otra máquina, `curl -s -o /dev/null -w '%{http_code}' http://<host>:8080/api/incidents` — basta el código HTTP, **sin pegar la respuesta** |
| 2 | **¿Qué orígenes hay en `WATCHBUG_CORS_ORIGINS`?** Deciden qué páginas ajenas pueden leer la lista desde JS | `docker exec $(docker compose ps -q api) printenv WATCHBUG_CORS_ORIGINS` — cada entrada debe ser un origen propio |
| 3 | **¿El `.env` que leen los tests es el mismo fichero que el `env_file:` del servicio `api`?** Un desajuste se manifiesta como 401 opaco | Comparar `docker compose config` con la ruta que abre `tests/integration/*.ts:15` y `e2e/ingest.spec.ts:25` |
| 4 | **¿Existen y resuelven `actions/checkout@v7` y `actions/setup-node@v7`?** | Revisar la versión publicada en el marketplace; no verificable sin red |
| 5 | **¿Pasan las suites nuevas en los tres motores en la versión fijada?** No se ejecutaron aquí | `npm run test:all` en local con el stack levantado; el informe de la última ejecución no es evidencia fresca |
| 6 | **¿El escaneo de gitleaks acepta los centinelas sintéticos de la suite?** (`SENTINELS`, `HIDPI_SECRET_TEXT`, `?token=secret`) | Revisar `.gitleaks.toml` y confirmar que cada valor lleva `gitleaks:allow`; el escaneo real es de CI |
| 7 | **¿Se limpia el volumen de adjuntos entre ejecuciones locales?** En CI sí (`docker compose down -v`) | `docker volume ls` antes/después de una ejecución local y comparar el conteo de blobs |

### 4.3 Candidatos examinados y **rechazados** (14)

| Candidato | Por qué NO es un hallazgo |
|---|---|
| Inyección SQL por `limit`/`cursor` | Drizzle parametriza; `limit` pasa por `parseInt` y rango 1..200; el cursor es JSON tipado dentro de `try` (`incidents.ts:409-450`) |
| Path traversal en `/api/incidents/:id/image` | La clave sale de la fila, no de la petición; `STORAGE_KEY_REGEX` (`ports.ts:24`) y `path.resolve` con prefijo de volumen la validan antes de tocar disco |
| Divulgación cross-tenant en el replay idempotente | El replay filtra por `(projectId, idempotencyKey)` (`incidents.ts:392-396`) |
| Bomba de descompresión vía SOF mentiroso | El primer SOFn declara el frame y sharp abre con `limitInputPixels` como segundo techo antes de decodificar (`harden.ts:104`) |
| Polyglot o trailing data en JPEG | `structure.ts` lo deja pasar a propósito; los controles son el allowlist de magic bytes, el guard SOF y el re-encode raíz obligatorio |
| SVG/GIF/HTML almacenado | Tres firmas mágicas y nada más: el `Content-Type` del cliente nunca se consulta (`sniff.ts:20-32`) |
| XSS en el panel | Todos los campos se renderizan como nodos de texto de React; el `<img>` deriva su `src` de `encodeURIComponent(id)` y la ruta fija del blob (`ReportDetail.tsx:57-71`) |
| XSS en el widget | `textContent`/`.value`/`setAttribute` en todas las superficies; el gate `sdk-no-html-sink` cubre todo `packages/sdk/src` con cuatro patrones (no re-ejecutado aquí) |
| Máscara semitransparente o no destructiva | `putPatch` fuerza alpha 255 en una copia (`masks.ts:87-93`); `solidFillRegion`/`pixelateRegion` sustituyen píxeles; el replay de las máscaras es el último write antes del encode (`encode.ts:260-263`) |
| Segundo sumidero de codificación | Un solo `toBlob` (`encode.ts:79`); el gate cuenta las apariciones y devuelve PASS |
| La costura `__watchbugCaptureFrame` llega al bundle de producción | `capture-source.ts:72-76` devuelve `null` salvo `SHADOW_MODE === 'open'`; esbuild pliega la rama y el build falla si un artefacto `open` queda en `dist/` |
| El chunk anotador se carga desde un origen arbitrario | `annotatorChunkUrl` resuelve contra la URL del propio bundle, nunca contra `init()`, `data-` ni `document.baseURI` (`loader.ts:37-44`) |
| Chunk sin SRI | El SDK ya se ejecuta con los privilegios del origen que sirve el chunk; no hay escalada demostrable |
| `transform` en un ancestro de un shadow host puede desplazar la máscara | `isUntransformedPath` para en la frontera del shadow root, pero `getBoundingClientRect()` ya incorpora el transform del host: no se demuestra un fallo de mapeo |

### 4.4 Invariantes verificados **sin** hallazgo

- **SEC-03 (sin credenciales del host)** — `lane1.ts:163-166` usa `credentials: 'omit'` y `referrerPolicy: 'no-referrer'`; `scripts/gate.mjs:101-121` escanea cookies, `localStorage`, `sessionStorage`, `Authorization` y `Bearer` sobre todo `packages/sdk/src` (25 ficheros en la verificación de la fase, no re-ejecutado aquí).
- **SEC-04 (cero secretos)** — solo `.env.example` está trackeado; CI ejecuta gitleaks con `permissions: contents: read`.
- **R-08 (URL solo ruta)** — `lane1.ts:105` envía `location.pathname.slice(...)`; nunca `href`, y el contrato recorta query y fragmento.
- **INV-01 (aislamiento)** — shadow cerrado, una sola hoja `<style>` con `all: initial`, host como último hijo de `documentElement` con `MutationObserver` no-subtree, y el editor anexa su CSS al mismo `<style>` marcado `data-wb-core`.
- **INV-02 (un solo global)** — el IIFE expone `Watchbug` y el tag del host no se registra en `customElements`.
- **C-2 / PRV-04 (una sola máscara destructiva)** — las máscaras se hornean sobre `ImageData` antes de cualquier encode, se guardan como parches post-máscara y no entran en la pila de undo; `encodeFinal` re-aplica T1 al final.
- **ING-03 (idempotencia)** — índice único `(project_id, idempotency_key)` en el esquema y `onConflictDoNothing` en la inserción; nunca un check-then-insert.
- **R-09/R-10 (retención)** — `purge.ts` vacía identidad y borra fila + blob con `storageKey === null` como guarda; arranca desde `app.ts` con `setInterval` y `unref`.
- **SEC-05 (rate limit)** — límites de ingesta (IP + clave) y de lectura (IP) enganchados como `preHandler`; `/api/setup` solo devuelve la clave pública write-only.

---

## 5. Plan de remediación posterior *(estado al 2026-11-03: pendiente)*

| Prioridad | ID | Hallazgo | Fix mínimo | Ficheros | Esfuerzo |
|---|---|---|---|---|---|
| **P0** | S-1 | Lecturas sin autenticación (HIGH, §4.1-1) — **heredado, no introducido en fase 3** | `preHandler` de autorización + acotar filas al proyecto; CORS de lectura separado del de ingesta | `routes/incidents.ts`, `plugins/cors.ts` | Medio — requiere Fase 5 (`AuthProvider`) |
| **P0** | V-0 | Verificar §4.2-1 antes de exponer el stack (fija la severidad de S-1) | Comprobación de puerto/código HTTP, sin pegar respuestas | despliegue | Minuto |
| **P1** | S-2 | CI no ejecuta las suites R-19 (MEDIUM) | Job `suites` con `test`, `test:contract`, `test:packaging`; integración en el job con compose; corregir la cabecera del workflow | `.github/workflows/ci.yml` | Bajo |
| **P1** | S-3 | El gate de la CSP compara subcadenas (MEDIUM) | Parsear directivas y asertar la ausencia de `unsafe-inline`/`unsafe-eval` | `tests/packaging/deploy-contract.test.ts` | Bajo |
| **P1** | S-4 | Ocho gates que pueden dar verde en vacío (LOW) | `sinks===0` → FAIL; marcador por sección + `.github/`; lista única de sinks; más prototipos; `describe` con modificadores + recorrido recursivo; bucle 200→429; `401`/`201` en el proxy; atribución de nginx | `scripts/gate.mjs`, `tests/packaging/*`, `tests/integration/*`, `e2e/helpers/host-fixtures.ts` | Bajo |
| **P1** | L-1 | Gate de `stopthatslop` no conectado a CI (§2.3) | Añadir el check al job `gates` (decidir antes dónde vive el motor) | `.github/`, `scripts/` | Bajo — decisión abierta |
| **P2** | S-5 | Topes de adjunto tras el decode (LOW) | Leer dimensiones de cabecera o acotar el decode | `capture/manual-file.ts` | Bajo |
| **P2** | S-6 | `beforeRead` opcional (LOW) | Fail-closed si `measured.rects === null` | `capture/pipeline.ts` | Minuto |
| **P2** | S-7 | Detalle del codec en el 400 (LOW) | Categorías de error propias | `ingest/harden.ts` | Bajo |
| **P2** | C-1 | `incidents.ts:172` CC 33 / 236 LOC | Guard clauses + extraer `readMultipart`/`validateImageChain`/`storeBlob`/`insertIdempotent` | `routes/incidents.ts` | Medio — integración + e2e en verde antes/después |
| **P2** | C-2 | `stripPng` 20 / `stripWebp` 16 | Table lookup + extract por chunk; comportamiento byte a byte | `ingest/structure.ts` | Medio — fixtures |
| **P3** | C-3 | `sniffClientImage` CC 23 / `putPatch` 21 / `readJpegDimensions` 17 / `onPointerUp` 16 | Tabla de firmas, `assertRect` único, predicados de marcador, commit por herramienta | `manual-file.ts`, `redact/masks.ts`, `guard.ts`, `canvas-layer.ts` | Medio |
| **P3** | S-8 | Modelos de test que no son los de producción (LOW) | Teardown por id; mock 401 sin clave; `url-path.test.ts` sobre producción; una fila por familia `*-in-input` | `e2e/*`, `tests/unit/*`, `tests/integration/hostile-sanitisation.test.ts` | Bajo |
| **P3** | S-9 | Huecos de cobertura e2e (LOW) | Fila WebKit sin costura; barrido `on*`/`srcdoc`; anclar la sonda al origen | `e2e/*` | Bajo |
| **P3** | S-10 | IN-01: Ctrl+Z con el diálogo abierto (INFO) | `if (maskDialog.isOpen()) return;` | `annotator/canvas-layer.ts` | Minuto |
| **P3** | L-2 | 28 observaciones de slop (§2.1) | Empezar por la codificación de `incidents.ts` y las ramas muertas; el resto, al tocar cada fichero | varios | Bajo |

**Secuencia recomendada:** `V-0` (minutos) → `S-2`/`S-3`/`S-4` (recuperar el valor del verde de CI) → `L-1` (decidir el gate de slop) → `S-1` (Fase 5) → `S-5`/`S-6`/`S-7` (cliente y API) → `C-*` (refactor con suites en verde) → `L-2`.

### 5.1 Auditoría de dependencias de la fase (una sola pasada)

- **Cambios de versión:** **ninguno**. El diff de `package.json` solo añade siete scripts (`test:*`) y una devDependency: **`vitest@5.0.5`**. No hay cambios en `dependencies`, `peerDependencies` ni `optionalDependencies`, ni en las versiones ya fijadas (`typescript@7.0.2`, `@playwright/test@1.63.0`, `tsx@4.23.15`).
- **Lockfile:** `package-lock.json` +287 / −2 líneas. **Cero entradas con `hasInstallScript`** en el diff: ninguna dependencia nueva ejecuta scripts de instalación.
- **Licencias:** `vitest@5.0.5` es **MIT**; las entradas nuevas del lockfile que declaran licencia son MIT. Postura Apache-2.0 intacta.
- **Motor:** `vitest@5.0.5` declara `engines.node: ^22.12.0 || ^24.0.0 || >=26.0.0`; el proyecto fija Node 24, compatible.
- **Artefactos nativos:** ninguno añadido. El único binario nativo del repo sigue siendo `sharp` en la API, cargado en perezoso.
- **Invariantes comprobadas sin hallazgo:** RNF-01 (el SDK sigue declarando cero dependencias de runtime; `sdk-runtime-deps` en verde), SEC-03 (ninguna dependencia nueva en el camino del cliente), INV-03 (ningún servicio nuevo: Vitest corre en el runner, no en compose).
- **`needs_validation`:** que la versión de `vitest` fijada resuelva en el runner de CI con Node 24 y que sus transitivas no introduzcan binarios nativos en otra plataforma — ambas cosas se comprueban en la primera ejecución real de `npm ci` en CI.

---

## 6. Limitaciones del informe

1. **Una sola pasada, sin ledger de cobertura acumulada.** No existe auditoría previa de esta rama. Esta pasada **no agota el objetivo**: no se revisaron en profundidad los internals de `apps/api/src/plugins/`, `apps/api/src/ingest/{caps,sanitize,validate-meta}.ts` (fuera del diff de la fase) ni el `apps/panel` completo (solo los dos ficheros tocados).
2. **Modo guidance, no full audit.** Sin oleadas de caza, sin `findings.json` ni verificadores independientes. Las citas de §4.1 se releyeron contra el árbol, pero no pasaron por un verificador fresco.
3. **Source-first absoluto.** Nada se ejecutó: ni la suite e2e, ni Vitest, ni los gates, ni el stack. Todo lo que depende de una ejecución está en §4.2.
4. **La cobertura de `e2e/sdk.spec.ts` (4.454 líneas) se delegó y se verificó por muestreo.** Las citas que sostienen un hallazgo se comprobaron una a una; el resto del fichero no se releyó por este agente.
5. **Los lentes no se solapan pero tampoco son exhaustivos entre sí.** `stopthatslop` cubre 9 reglas TS; la complejidad cubre las 1.117 funciones de los 63 ficheros con funciones; la seguridad cubrió los 31 ficheros de producción y las capas de test mediante tres revisiones delegadas.
6. **La severidad de S-1 depende de un hecho externo** (§4.2-1). En loopback estricto es `medium` con potencial de escalar; expuesto fuera de loopback, es `high` sin matices.
7. **El análisis de dependencias es de guidance**, no un `npm audit` ejecutado: se apoya en el diff de manifiestos y lockfile, no en una base de vulnerabilidades consultada en vivo.

---

## 7. Anexo — comandos reproducibles

```bash
# 0. Alcance (rama de fase y base)
git branch --list "gsd/phase-3-*"
git rev-parse --abbrev-ref HEAD
git diff --name-only origin/develop...gsd/phase-3-report-composer-annotation-editor-lazy
git diff --name-status origin/develop...gsd/phase-3-report-composer-annotation-editor-lazy -- e2e/deploy.spec.ts e2e/read-surface.spec.ts

# 1. Slop — salida en este HEAD: gate_finding_count 0 / teach_only 0 / exit 0
python -m stopthatslop_cli check --repo-root "E:\Proyectos Github\Watchbug_TFG" --pack ts
python -m stopthatslop_cli check --repo-root "E:\Proyectos Github\Watchbug_TFG" --pack ts --format json

# 2. Complejidad (script propio, análisis estático, no modifica nada)
node "%LOCALAPPDATA%\Temp\opencode\informe-analisis-phase3\cc.mjs" $(git diff --name-only --diff-filter=ACMR origin/develop...HEAD -- '*.ts' '*.tsx')

# 3. Integridad de codificación (12 bytes U+FFFD en un solo fichero)
#    Lectura de bytes EF BF BD sobre los .ts del alcance.

# 4. Cobertura de CI de la taxonomía R-19 (0 apariciones)
Select-String -Path .github/workflows/ci.yml -Pattern "vitest|test:unit|test:integration|test:contract|test:packaging|test:vrt"

# 5. Auditoría de dependencias
git diff origin/develop...HEAD -- package.json
git diff --numstat origin/develop...HEAD -- package-lock.json
git diff origin/develop...HEAD -- package-lock.json | Select-String -Pattern "hasInstallScript"

# 6. Seguridad — guía aplicada: source-first, sin ejecución del objetivo,
#    sin red, sin instalar dependencias. Ver §1.3 para el alcance.
```

---

## 8. Estado de remediación (2026-11-03, HEAD `0d17ab8`)

> Estado: **pendiente / no aplica (análisis inicial)**. Esta es la primera pasada de análisis sobre la fase 3: no se ha corregido ninguno de los hallazgos de §4.1 ni aplicado el plan de §5. §2-§5 describen el árbol tal y como está en `0d17ab8`.

| ID | Hallazgo | Estado |
|---|---|---|
| S-1 | Lecturas sin autenticación (HIGH, heredado) | ⏸ pendiente — Fase 5 (`AuthProvider`) |
| S-2 | CI no ejecuta las suites R-19 (MEDIUM) | ⏸ pendiente |
| S-3 | El gate de la CSP compara subcadenas (MEDIUM) | ⏸ pendiente |
| S-4 | Ocho gates que pueden dar verde en vacío (LOW) | ⏸ pendiente |
| S-5 | Topes de adjunto tras el decode (LOW) | ⏸ pendiente |
| S-6 | `beforeRead` opcional (LOW) | ⏸ pendiente |
| S-7 | Detalle del codec en el 400 (LOW) | ⏸ pendiente |
| S-8 | Modelos de test que no son los de producción (LOW) | ⏸ pendiente |
| S-9 | Huecos de cobertura e2e (LOW) | ⏸ pendiente |
| S-10 | IN-01: Ctrl+Z con el diálogo abierto (INFO) | ⏸ pendiente — abierto por decisión del propietario |
| L-2 | 28 observaciones de slop (§2.1) | ⏸ pendiente |

*Análisis generado el 2026-11-03 sobre `0d17ab8`. Único fichero creado por este análisis: `documentation/phase3/03-INFORME-ANALISIS.md`. Scratch de trabajo (fuera del repo, no se commitea): `%LOCALAPPDATA%\Temp\opencode\informe-analisis-phase3\` — un `.md` por cada uno de los 72 ficheros de código/infra analizados más `ledger.md`.*
