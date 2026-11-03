<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 3 — Arquitectura y patrones: *Report Composer & Annotation Editor (lazy)*

| | |
|---|---|
| **Fase** | 3 — *Report Composer & Annotation Editor (lazy)* |
| **Rama** | `gsd/phase-3-report-composer-annotation-editor-lazy` |
| **Mapeado** | 2026-10-28 |
| **Ficheros clasificados** | 37 rutas nuevas/modificadas en SDK, API, contratos, e2e y gates |
| **Estado** | Ejecutado; los patrones se conservan en el código |

> Este documento consolida y resume `03-PATTERNS.md` y el `SKELETON.md` raíz. Es un resumen ejecutivo, no una copia literal. No existe un `SKELETON.md` propio de la fase 3; el esqueleto raíz se usa como contexto histórico y el mapa de la fase vive en `03-PATTERNS.md`.

---

## 1. Modo greenfield: el contrato de patrones

La fase no inventa una arquitectura nueva: **extiende las costuras de las Fases 1 y 2**. Cada fichero nuevo debe tener un análogo existente (mismo rol y flujo) o una razón escrita para no tenerlo. La regla R-18 (reuse-first) manda: antes de escribir, se busca la implementación existente; solo se crea cuando la semántica no coincide.

Los tres contratos que ningún patrón puede romper:

| Contrato | Regla |
|---|---|
| **C-2 / A-04** | Un bitmap aplanado, máscaras destructivas no deshacibles, tinta vectorial sobre el bitmap ya enmascarado, un único `toBlob` |
| **T3** | Tinta → re-aplicar máscaras al final → re-aplicar T1 → encode |
| **A-05** | `CaptureSource.capture()` devuelve `ImageData`, nunca un `Blob`; no existe byte sin redactar |

---

## 2. Decisiones arquitectónicas del esqueleto

El `SKELETON.md` raíz documenta el estado tras la Fase 1. La fase 3 lo respeta y lo extiende:

| Decisión | Estado en Fase 3 |
|---|---|
| Monorepo npm workspaces: `packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel` | Se mantiene; no se añade workspace |
| `packages/contracts` como única fuente del esquema CA-01 | Se mantiene; solo se añade `'jpeg'` a `ImageExt` |
| SDK con build dual IIFE + ESM y cero dependencias de runtime | Se mantiene; el editor es una lane lazy más |
| API Fastify 5 con cadena de ingest por etapas | Se mantiene; se añade la rama JPEG |
| Panel React + Vite estático en tres contenedores | Se mantiene; solo tolera `contentType: null` |
| `check:size` como gate de build | Se mantiene; mide el máximo de los gemelos lazy |
| `check:compose` con exactamente tres servicios | Se mantiene |
| E2E como suite de artefacto | Se mantiene y se amplía a la taxonomía R-19 |

**Capacidad probada de extremo a extremo:** el usuario pulsa el lanzador, captura o adjunta, compone, anota, enmascara, revisa y envía; el ingest guarda la fila y el blob; el panel lista el informe y muestra la captura. La fase 3 añade el tramo compositor→editor→máscara→review sin sustituir las costuras existentes.

### Stack tocado en Fase 3

| Capa | Tecnología | Cambio |
|---|---|---|
| Cliente | TypeScript, canvas 2D, `import()` | Compositor, review, editor lazy, máscaras |
| Contratos | Zod 4 + tipos | `ImageExt` con `'jpeg'`; sin cambios de esquema de payload |
| API | Fastify 5, Drizzle, sharp | Rama JPEG, SOF walker, `autoOrient`, migración `0001` |
| Panel | React 19 + Vite 8 | `contentType` nullable; detalle sin `<img>` |
| Pruebas | Playwright 1.63 + Vitest 5 | Seis tipos; 14 journeys; VRT y packaging |

---

## 3. Clasificación de ficheros (rol / flujo)

| Fichero | Rol | Flujo | Análogo | Match |
|---|---|---|---|---|
| `widget/composer.ts` *(nuevo)* | Componente (vista) | Event-driven (formulario) | `widget/status-panel.ts` | exacto |
| `widget/review.ts` *(nuevo)* | Componente (vista) | Render-once | `widget/status-panel.ts` | exacto |
| `widget/loader.ts` *(nuevo)* | Utilidad (singleton async) | Lazy load | `image/encode.ts` (`preferredMimeType`) | rol |
| `index.ts` *(modificado)* | Entrada + router de pantallas | Event-driven | Él mismo | exacto |
| `widget/host.ts` *(modificado: `lang`)* | Componente (aislamiento) | — | Él mismo | exacto |
| `widget/launcher.ts` *(modificado)* | Componente | Event-driven | Él mismo | exacto |
| `strings.ts` *(modificado)* | Config (diccionario) | Transform | `apps/panel/src/i18n.ts` | exacto |
| `strings.editor.ts` *(nuevo, lazy)* | Config (diccionario) | Transform | `strings.ts` + panel `i18n.ts` | rol |
| `annotator.ts` *(stub → entry)* | Entrada + componente | Pointer + transform | `encode.ts` + `status-panel.ts` | parcial |
| `annotator/canvas-layer.ts` *(nuevo)* | Utilidad | Event-driven | `geometry.ts` + `capture-source.ts` | parcial |
| `annotator/tools.ts` *(nuevo)* | Utilidad | Transform | `geometry.ts` | parcial |
| `annotator/masks.ts` *(nuevo)* | Utilidad | Transform (píxeles) | `redactor.ts:fillRects` | exacto (flujo) |
| `annotator/editor-dom.ts` *(nuevo)* | Componente | Event-driven | `status-panel.ts` + `launcher.ts` | rol |
| `capture/pipeline.ts` *(split)* | Servicio (orquestación) | Request-response | Él mismo | exacto |
| `capture/manual-file.ts` *(nuevo)* | Adaptador (`CaptureSource`) | Archivo → `ImageData` | `capture-source.ts` + canvas | rol |
| `image/encode.ts` *(modificado)* | Utilidad (sumidero único) | Encode | Él mismo | exacto |
| `redact/geometry.ts` *(reuso)* | Utilidad | Transform | Él mismo | exacto |
| `redact/redactor.ts` *(reuso)* | Utilidad | Transform | Él mismo | exacto |
| `transport/lane1.ts` *(modificado)* | Servicio | Request-response | Él mismo | exacto |
| `packages/contracts/src/types.ts` | Modelo (tipo) | — | Él mismo | exacto |
| `apps/api/src/ingest/sniff.ts` | Etapa de ingest | Transform | Él mismo | exacto |
| `apps/api/src/ingest/structure.ts` | Etapa de ingest | Transform | Él mismo | exacto |
| `apps/api/src/ingest/guard.ts` | Etapa de ingest | Transform | `readWebpDimensions` | exacto |
| `apps/api/src/ingest/harden.ts` | Etapa de ingest | Transform | Él mismo | exacto |
| `apps/api/src/routes/incidents.ts` | Controlador | Request-response | Él mismo | exacto |
| `apps/api/src/db/schema.ts` | Modelo | — | Él mismo | exacto |
| `apps/api/drizzle/0001_*.sql` | Migración | Batch | `0000_grey_the_santerians.sql` | exacto |
| `e2e/helpers/composer.ts` *(nuevo)* | Helper de test | UI walk | `capture-stubs.ts` | rol |
| `e2e/helpers/editor.ts` *(nuevo)* | Helper de test | Pointer drag | `capture-stubs.ts` + `readMaskRect` | rol |
| `e2e/helpers/host-fixtures.ts` | Helper de test | Servir bundles | Él mismo | exacto |
| `e2e/helpers/capture-stubs.ts` | Helper de test | Event-driven | Él mismo | exacto |
| `e2e/sdk.spec.ts` | Test | e2e | Él mismo | exacto |
| `e2e/ingest.spec.ts` | Test | e2e API | Él mismo | exacto |
| `e2e/make-fixtures.mjs` | Tooling | Archivo | Él mismo | exacto |
| `scripts/check-size.mjs` | Config (gate) | Batch | Él mismo | exacto |
| `scripts/gate.mjs` | Config (gate) | Análisis estático | Él mismo | exacto |

---

## 4. Asignaciones de patrón

### 4.1 `widget/composer.ts` — el análogo más importante

Sigue `status-panel.ts`: `el()` con `createElement`, texto con `textContent`, atributos `data-wb-*` como contrato DOM, CSS propio (`COMPOSER_CSS`) y una función `render(draft)` que no conserva estado fuera del draft. Añade el overlay grande, el formulario, la zona de imagen y los estados `degraded`/`text-only`. No crea un segundo global ni toca el `host`.

### 4.2 `widget/review.ts`

Render-once como `status-panel.ts`: recibe el draft ya codificado, pinta la imagen y el resumen, y expone `Editar`/`Enviar`. No re-codifica ni muta el draft.

### 4.3 `widget/loader.ts`

Singleton memoizado con la forma de `encode.ts` (`preferredMimeType`): una promesa, un fallo que limpia el memo y un `?retry=` tras error. La URL sale solo del bundle, nunca de `init()`.

### 4.4 `index.ts`

Router de pantallas (`idle`, `status`, `composer`, `editor`, `review`) con el mismo patrón de `showScreen`: oculta todas, muestra la activa y ajusta el lanzador. La generación de draft se comprueba tras los `await`.

### 4.5 `strings.ts` / `strings.editor.ts`

El mapa `strings` + `t(id, vars?)` ya existía. Se añade `stringsEs` y el resolver de locale. El chunk lazy recibe `locale` por `AnnotatorOpenOptions`; no importa el diccionario de core.

### 4.6 `annotator/masks.ts`

Análogo exacto de `redactor.ts:fillRects`: lectura restringida al rect, escritura destructiva, alpha 255. La diferencia es que devuelve un parche post-máscara y que `rebakeMasks` lo re-aplica al final.

### 4.7 `annotator/canvas-layer.ts` / `tools.ts` / `editor-dom.ts`

No hay análogo de editor canvas en el repo (D-05 cerró `fabric.js`/`konva`). Se sigue el patrón de research: un canvas del tamaño del bitmap, `pointerdown/move/up` con `setPointerCapture`, trazos vectoriales y replay. `editor-dom.ts` reutiliza el SVG de `launcher.ts` y el CSS de `status-panel.ts`; el `alertdialog` y el focus trap son nuevos (~20 líneas).

### 4.8 `capture/pipeline.ts` / `manual-file.ts`

La pipeline se parte en `runCaptureStage` (hasta `ImageData` redactado) y `encodeFinal` (bytes). `manual-file.ts` implementa la segunda `CaptureSource` con la misma forma que `DisplayMediaCapture`: `capture(request) → ImageData`, `beforeRead` obligatorio y errores `CaptureUnavailableError`.

### 4.9 `image/encode.ts` / `redact/*`

Se reutiliza `encodeLadder` y se exporta `fitToCaps`; el sumidero sigue siendo uno. `geometry.ts` y `redactor.ts` se reutilizan sin duplicar la transformación.

### 4.10 `apps/api/*`

La cadena de ingest mantiene el orden de la Fase 1. Se añade la rama JPEG en `sniff`/`structure`/`guard`/`harden`, se sustituyen las ternarias por un `Record<ImageExt,string>` y se genera la migración `0001` con drizzle-kit.

### 4.11 e2e y gates

`composer.ts` es el helper de migración de las 41 filas; `editor.ts` encapsula el arrastre y la predicción del rect; `host-fixtures.ts` sirve un set de bundles; `check-size` mide el máximo de los gemelos; `gate.mjs` añade la pureza de lane y el sumidero HTML.

---

## 5. Patrones compartidos

| ID | Patrón | Aplicación |
|---|---|---|
| **S-1** | Sumidero único de encode (C-2) | Solo `encodeLadder` produce `Blob`; el editor devuelve `ImageData` |
| **S-2** | Sin sumidero HTML (SEC-05) | `createElement`, `textContent`, `createElementNS` |
| **S-3** | Fallo cerrado en redacción | Cualquier error de escaneo/geometría termina en estado visible, nunca en bytes sin redactar |
| **S-4** | Sin storage del host ni credenciales (SEC-03) | `credentials: 'omit'`; gate de `localStorage`/cookies/`Authorization` |
| **S-5** | Activación transitoria en la misma tarea | `getDisplayMedia` dentro del handler del clic |
| **S-6** | Tokens de estilo y layout | Variables CSS, sin colores hardcodeados fuera del token |
| **S-7** | Lookup i18n | `t(id, vars?)`; sin runtime de i18n |
| **S-8** | Arnés e2e compartido | `completeComposer`, `probeWidget`, `capture-stubs` |
| **S-9** | Reuso de la aserción CA-02 | `analyzeRedaction`/`expectMaskedAndTargeted`; no se escribe análisis de píxeles nuevo |
| **S-10** | Convención de intercepción de requests | Una regex compartida por ruta; `unroute` por la misma fuente |

---

## 6. Sin análogos encontrados

| Fichero | Rol | Por qué no hay análogo |
|---|---|---|
| `annotator.ts` (core del editor) | Componente | No existe editor canvas en el repo; D-05 descartó `fabric.js`/`konva` |
| `annotator/canvas-layer.ts` | Utilidad | La máquina de estados de pointer y `setPointerCapture` es nueva; solo la geometría tiene análogo |
| `annotator/tools.ts` | Utilidad | El modelo de trazo y el orden de replay son nuevos |
| `annotator/editor-dom.ts` | Componente | No hay modal/alertdialog en el SDK; se reutiliza el SVG del launcher y el CSS del panel |
| `widget/loader.ts` | Utilidad | No existía un loader de chunk; solo el singleton memoizado de `encode.ts` |

---

## 7. Fuera de alcance (diferido a slices posteriores)

| Elemento | Destino |
|---|---|
| Reglas de redacción configurables por el host | v2; el `Redactor` queda como costura sin usar |
| `DomSerializeCapture` | v2 (A-08) |
| Mask-undo o confirmación por máscara | Decisión de privacidad; Consultation Request Pack |
| Captura de consola y metadatos de entorno | Fase 4 |
| Auth, proyectos y rotación de clave | Fase 5 |
| Triage, estados y purga TTL | Fase 6 |
| Cola de durabilidad IndexedDB | Fase 7 |

### Plan de slices posteriores

1. **Fase 4:** enriquecer el `meta` con consola, entorno, `appVersion` y privacidad de identidad.
2. **Fase 5:** auth del panel, 401, proyectos y rotación de clave.
3. **Fase 6:** listado/filtros, detalle, estados, comentarios, borrado y purga TTL.
4. **Fase 7:** cola de durabilidad, Lighthouse, backup/restore y release gate completo.

---

## 8. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-0x** | Enmienda del registro de decisiones |
| **CA-0x** | Criterio de aceptación |
| **C-2** | Contrato del `Annotator`: bitmap único, máscaras destructivas, un `toBlob` |
| **DPR** | Device Pixel Ratio |
| **e2e** | Prueba de extremo a extremo |
| **P3-D-xx** | Decisión local de la fase 3 |
| **PRF-0x** | Requisito de rendimiento y tamaño |
| **R-18** | Reuse-first |
| **R-19** | Taxonomía de seis tipos de verificación |
| **SEC-0x** | Invariante de seguridad |
| **T1/T2/T3** | Redacción automática / máscara manual / orden de exportación |
| **VRT** | Visual Regression Testing |
| **WDG-0x** | Requisito del widget |
