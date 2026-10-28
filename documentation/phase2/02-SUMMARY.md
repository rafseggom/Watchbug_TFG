<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 2 — Resumen de ejecución: *SDK Tracer Bullet: Widget, Capture & Auto-Redaction*

| | |
|---|---|
| **Fase** | 2 — *SDK Tracer Bullet: Widget, Capture & Auto-Redaction* |
| **Rama** | `gsd/phase-2-sdk-tracer-bullet` |
| **Ejecutada** | 2026-10-23 → 2026-10-24 (remediación 2026-10-24/25) |
| **Olas** | 5/5 · 15 tareas · 22 commits de tarea |
| **Suite e2e final** | **315/315** en chromium + firefox + webkit (294 al cierre de la fase; 309 tras la remediación; 315 tras las correcciones de la UAT) |
| **Estado** | Ejecución completa; verificación humana pendiente (ver `02-VERIFICATION.md`) |

> Este documento consolida y resume los cinco resúmenes de ola (`02-01-SUMMARY.md` … `02-05-SUMMARY.md`). Es un resumen ejecutivo, no una copia literal.

---

## 1. Qué se construyó

El SDK dejó de ser un contrato y pasó a ser un producto: **una etiqueta async arranca un widget aislado, un gesto captura la pestaña, la redacción destruye lo sensible sobre `ImageData` antes de que exista un byte codificado, y el informe aterriza en el panel**. Todo dentro de un núcleo de **8,5 KB gzip** (45 disponibles), sin una sola dependencia runtime y con la suite completa en verde en tres motores.

### Ola 02-01 — Armazón del widget y prueba de arranque (3 commits)

| Área | Entregado |
|---|---|
| Punto de entrada | `init({ projectKey, endpoint? })` validado a mano, idempotente, export nombrado + namespace por defecto; `WATCHBUG_VERSION` |
| Aislamiento | `WatchbugHost`: elemento **no registrado**, raíz `closed`, un único `<style>` que abre con `all: initial`, tokens `--wb-*` locales, px-only, último hijo de `documentElement` con re-append por `MutationObserver` |
| Lanzador | `<button>` real de 48×48, glifo SVG, `aria-label`, anillo de foco 2 px, gesto que oculta el host e invoca el flujo **en el mismo turno** |
| Panel de estado | `render(view)` para todos los estados, spinner 12×12 a 700 ms, `role=status`/`role=alert`, truncado a 240 caracteres por `textContent` |
| Copy | `strings.ts` con los 14 IDs bloqueados y `t()` con sustitución `{placeholder}` |
| Build | Variante `SHADOW_MODE=open` que emite `watchbug.e2e.{js,mjs}` con nombres distintos |
| Arnés e2e | `e2e/sdk.spec.ts` + `host-fixtures.ts` con fixtures por `page.route` en el origen del panel |

**Verificación:** 9/9 filas · core 4,1 KB gz · `gate.mjs` 2 PASS / 1 SKIP (el sumidero de codificación aún no existía).

### Ola 02-02 — El tracer: un gesto, un informe real (4 commits)

| Área | Entregado |
|---|---|
| Pipeline | `runCaptureFlow`: ocultar → capturar → **asertar oculto** → restaurar → sonda de blanco → redactar → codificar → enviar |
| Captura | Puerto `CaptureSource` que devuelve `ImageData` (nunca `Blob`), `DisplayMediaCapture` con `preferCurrentTab` y `track.stop()` en `finally` |
| Redacción SEC-01 | `input[type=password]` y `[data-watchbug-sensitive]` rellenos con α=255; geometría bitmap con redondeo hacia fuera |
| Codificación | Escalera de calidad alrededor de **un único** `toBlob`; sniff de tipo, clamp DPR 2, techo 16 MP |
| Transporte | Multipart `meta` + `image`, `X-Project-Key` + `Idempotency-Key` acuñada una vez, `credentials: 'omit'`, `no-referrer`, timeout 15 s |
| Reintentos | Transitorios 1/4/10 s ±25 % con la misma clave; 4xx de contrato fallan de inmediato con el mensaje del servidor |
| Aislamiento | Matriz hostil de seis variantes con control por variante (CA-04 no vacua) y probes de apilamiento, adyacencia, página vacía y reemplazo de `documentElement` |

**Verificación:** 63/63 · core 7,6 KB gz · `gate.mjs` 3 PASS · lint limpio.

### Ola 02-03 — Fidelidad de captura y fallo honesto (5 commits)

| Área | Entregado |
|---|---|
| Costura por motor | `captureStream()` falso en chromium/firefox; costura `ImageData` en webkit; el resto del pipeline es código de producción |
| CAP-04 | El stub observa el host con `display:none` inline; cero píxeles del acento `#2f6feb` en los bytes decodificados, con control positivo sobre el lanzador vivo |
| Escalera | Añadido el clamp por lado `MAX_IMAGE_DIM` (8192); marcos de 9000 px, 16 MP en el techo, DSF2 no blanco y DPR 3 reducido |
| M-3 | PNG forzado enviado como parte `.png`/`image/png` por sniff y aceptado con 201 |
| Fallos ruidosos | Fotograma uniforme, fotograma por encima del tope y prompt rechazado aterrizan en su estado visible con **cero** POST |
| Política de superficie | `'browser'` aceptado; `'window'`/`'screen'` rechazados por nombre; `undefined` aceptado con salvedad documentada |

**Verificación:** 96/96 · core 7,6 KB gz · 2 RED evidenciados (`RED_EVIDENCE_OK`).

### Ola 02-04 — Catálogo T1 completo y geometría (5 commits)

| Área | Entregado |
|---|---|
| Catálogo | JWT, `Bearer`, asignaciones `key=/token=/secret=/password=`, tarjetas por Luhn — cada familia en nodos de texto **y** valores de formulario |
| Granularidad | Un rect por nodo de texto completo (unión de `range.getClientRects()`); elemento completo para familias estructurales |
| Luhn | Verificador propio de ~15 líneas, sin dependencia; una secuencia Luhn-inválida **no** se enmascara y se prueba que sigue visible |
| Geometría H-1 | Mismo secreto a DPR 1 / 1,25 / 2 / 3, con el rect esperado re-derivado de la escala del propio output decodificado |
| Fail-closed | Cualquier error de escaneo/geometría corta antes de codificar y enviar: estado visible y cero POST |
| Gate | Resuelto por **redacción del regex** (`Beare[r]`), sin exención en `gate.mjs` |

**Verificación:** 135/135 · runtime 9,1 KB gz · 2 RED evidenciados.

### Ola 02-05 — Privacidad del payload y presupuestos (5 commits)

| Área | Entregado |
|---|---|
| SEC-03 por payload | Cuatro centinelas (cookie, `localStorage`, `sessionStorage`, cabecera de autorización) demostrados en el tráfico propio del anfitrión y ausentes de **todas** las superficies del informe |
| URL | `meta.url = location.pathname`, comprobado sobre los bytes crudos antes de la transformación del esquema |
| Título | Truncado por **puntos de código** (no unidades UTF-16) para alinear con el tope Zod de 200 |
| Autohospedaje | Fila `self-hosted`: cero destinos de terceros en todo el flujo |
| Presupuesto | `check:size` con el widget completo: core 8,5/45, runtime 9,1/80; e2e fuera de los carriles |
| Premisa webkit/WebP | Corregida en `playwright.config.ts` y registrada como enmienda **A-14**; R-12 intacto |

**Verificación:** 294/294 en la suite completa (cuatro grupos × tres motores) · lint limpio.

---

## 2. Resultados de verificación (finales)

| Comando | Al cierre de la fase | Tras la remediación (`12a5049`) | Cierre final (2026-10-25) |
|---|---|---|---|
| `npm run verify` | **294/294** | **309/309** | **315/315** (7,2 min) |
| `npm run check:size` | core 8,5 / runtime 9,1 KB gz | core 9,4 / runtime 10,1 KB gz | core **9,3** / runtime **10,0** KB gz |
| `node scripts/gate.mjs` | 3 PASS | 3 PASS | 3 PASS |
| `npm run lint` | limpio | limpio | limpio |
| `npm run check:compose` | 3 servicios | 3 servicios | 3 servicios |
| `stopthatslop --pack ts` | — | 0 findings / exit 0 | 0 findings / exit 0 |

**Presupuesto:** el núcleo ocupa **9,3 KB de 45** (20,7 %) y el runtime completo **10,0 KB de 80** (12,5 %). Las 315 filas son 105 por motor; la suite de la fase aporta **56 filas por motor** (53 definiciones `test()`, algunas parametrizadas).

**Cero dependencias runtime:** `packages/sdk/package.json` sólo declara `@watchbug/contracts` (tipos y constantes); Zod nunca entra en el bundle. Todas las incorporaciones de la fase son código propio o arnés de pruebas.

---

## 3. Desviaciones por ola

| Ola | Desviaciones | Resumen |
|---|---|---|
| **02-01** | 3 autocorregidas | `globals.d.ts` para el `define` de esbuild; `import.meta.url` no sobrevive al carril IIFE (fallback a `document.baseURI`); registrar el custom element habría mutado el registro global del anfitrión (se deja sin registrar) |
| **02-02** | 3 autocorregidas | La sonda WebP confiaba sólo en `blob.type` (webkit devuelve blobs de 0 bytes etiquetados WebP) → se validan bytes mágicos `RIFF`/`WEBP`; `route.fetch()` perdía la parte de imagen en webkit → `route.continue()` + `waitForResponse`; el escaneo de fugas era una sonda de tres tokens → enumeración genérica de `--wb-` |
| **02-03** | 1 autocorregida | `postDataBuffer()` no puede entregar la imagen en webkit → grabadora de `window.fetch` en el límite de la petición, reutilizada por todas las filas de decodificación |
| **02-04** | 2 autocorregidas + 1 de reparto de plan | `ReferenceError` en el helper invalidó el primer RED; el descriptor «Desktop Safari» de Playwright usa DSF 2 (la fila DPR 1 lo fija explícitamente); el catálogo completo se adelantó al GREEN de la tarea 1, así que la tarea 2 no tuvo RED y **no se fabricó** |
| **02-05** | 4 | El transporte ya era libre de credenciales (sin cambio de producción); webkit no expone la cabecera `cookie` (provocación condicional por motor); las filas de `deploy.spec.ts` resolvían a datos reales del panel → `exact: true`; un redirect UTF-16 corrompió el primer registro de evidencia RED |

**Patrón común:** todas las desviaciones son correcciones de corrección dentro del alcance de su propia ola. Ninguna amplió el alcance, cambió la arquitectura ni añadió una dependencia.

**Corrección posterior a la UAT (2026-10-25).** La prueba manual real (selector del sistema, sin stub) encontró un defecto que la suite no veía: la sonda de blanco muestreaba **9 puntos fijos** al 25/50/75 % y rechazaba páginas legítimamente escasas — una página blanca con un `<h1>` arriba a la izquierda caía en `The capture came back blank.` porque ninguno de los nueve puntos tocaba el título. Se sustituyó por un **barrido denso de uniformidad** (el frame sólo es «blank» si todos sus píxeles son idénticos), se añadió la fila de regresión `P2-D-12: a sparse but real page … is not blank`, y se resolvieron F-08 (`lang="en"` en el contenido + fila `F-08`) y `WINDOWS.md` #5 (redacción del criterio de release). El núcleo bajó de 9,4 a **9,3 KB gz** porque el barrido es más pequeño que la rejilla.

---

## 4. Decisiones clave registradas

| Decisión | Por qué |
|---|---|
| **Host sin registrar** (`document.createElement('watchbug-host')`) | `customElements.define` muta el registro global del anfitrión y una página hostil podría definir la etiqueta primero; `attachShadow()` funciona igual |
| **Variante e2e incondicional** | Un único camino de build elimina el fallo «olvidé la bandera y el bundle e2e está obsoleto»; el gate discrimina por nombre de fichero |
| **Playwright atraviesa la raíz por `host.shadowRoot`** | Exponer el registro en `window` contradiría WDG-04; la raíz abierta sólo existe en el bundle de pruebas |
| **Bytes mágicos como evidencia de capacidad** | `blob.type` es una declaración; los bytes `RIFF`/`WEBP` son la prueba |
| **Grabadora en el límite de `fetch`** | Es la única forma de decodificar los píxeles reales en webkit y observa el `Blob` auténtico, no una reserialización |
| **Marcador magenta sobre el rect del fixture** | Permite probar «los píxeles originales ya no están» sin imagen de referencia, y las filas de control negativo demuestran que el análisis no es ciego |
| **Fail-closed reutiliza el estado de fallo de captura** | El contrato de copy no tiene titular de redacción; crear uno pertenece al compositor de la Fase 3 |
| **Truncado por puntos de código** | Zod 4 cuenta puntos de código; un `slice` UTF-16 habría enviado 150 de 200 |
| **A-14 como nota, no como edición de política** | La premisa webkit/WebP era falsa en este host; R-12 y el criterio de release no se tocan sin el propietario |

---

## 5. Cumplimiento de la puerta TDD

`workflow.tdd_mode` es `false` y **R-12 prohíbe suites unitarias**: el único artefacto de prueba es la suite Playwright y `check:size`. Por tanto «RED» significa **una fila e2e que falla**, nunca un test unitario.

| Ola | RED evidenciados | Detalle |
|---|---|---|
| 02-01 | 0 | Tareas con `tdd="true"` pero sin comportamiento nuevo observable fuera de la suite; se declaró explícitamente en vez de fabricar teatro |
| 02-02 | 0 | Igual: el comportamiento se prueba en las filas creadas en la misma ola |
| 02-03 | **2** | CAP-04 sin observación del host; CAP-05 con 9000 px sin clamp → `RED_EVIDENCE_OK` ×2 |
| 02-04 | **2** | 2464 píxeles originales sobrevivían; la fila fail-closed se quedaba en `Capturing…` → `RED_EVIDENCE_OK` ×2 |
| 02-05 | **1** | El título enviado medía 150 puntos de código, no 200 → `RED_EVIDENCE_OK` |

**Regla aplicada:** se escribió RED donde el comportamiento faltaba de verdad y **no se fabricó** donde ya existía (tareas 2 de 02-04 y 1 de 02-05, investigadas según la regla *fail-fast*). Los 5 registros de evidencia se validaron con `gsd_run check tdd-red-evidence`.

---

## 6. Elementos diferidos (no defectos de esta fase)

| Elemento | Destino | Motivo |
|---|---|---|
| Compositor del informe; `title`/`type` dejan de ser fijos | Fase 3 | P2-D-01 es un atajo deliberado; el formulario llega con el compositor |
| Adjuntar imagen, envío sólo texto y UX completa de degradación | Fase 3 | H-4/H-5; hasta entonces los errores de captura sólo fallan en voz alta |
| Editor de anotación perezoso y máscaras de usuario T2/T3 | Fase 3 | ANN-01…06, PRV-04/PRV-07; reutilizará la geometría bitmap de esta fase |
| i18n en/es del widget y atributo `lang` | Fase 3 | WDG-06/RNF-03; el mapa de `strings` es la forma donde encaja |
| Captura de consola, metadatos de entorno e identidad | Fase 4 | ENR-01…05, INT-03/INT-04 |
| Cola de durabilidad IndexedDB y cierre de release | Fase 7 | ING-02/PRF-05/DEP-04 |
| Iframes de origen cruzado no escaneables | Fase 5+ (documentación) | Riesgo aceptado AR-01: ningún mecanismo v1 puede enmascarar ubicaciones desconocidas |
| Aritmética 45 + 25 + 14 = 84 > 80 KB | Fase 7 | A-12/M-2; se resuelve contra medidas reales de core + editor |
| Redacción con copy propio del fallo | Fase 3 | Hoy reutiliza el estado de fallo de captura |

No existió `deferred-items.md` en esta fase: no hubo elementos diferidos por falta de tiempo (R-17), sólo por coherencia de slice.

---

## 7. Autocomprobación

| Ola | Resultado | Evidencia |
|---|---|---|
| 02-01 | **PASSED** | 7 ficheros creados y 2 modificados presentes; 3 commits verificados (`2575121`, `722e6da`, `b00fe11`); gates re-ejecutados |
| 02-02 | **PASSED** | 13 ficheros; 4 commits (`032a66c`, `9e53db8`, `e7cb5f2`, `76247b4`); stubs #3/#4 de `WINDOWS.md` marcados `fixed` |
| 02-03 | **PASSED** | 6 ficheros; 5 commits; 2 registros RED re-verificados |
| 02-04 | **PASSED** | 6 ficheros; 5 commits; 2 registros RED re-verificados; gate sin exención |
| 02-05 | **PASSED** | 6 ficheros; 5 commits; 1 registro RED re-verificado; suite completa verde |
| **Cierre UAT** | **PASSED** | 315/315 en tres motores; UAT 5/5; `WINDOWS.md` #5 `fixed`; `02-VERIFICATION.md` `passed` |

**Cifras medidas, no narradas:** cada ola midió sus commits con `git rev-list --count` sobre el ledger del plan y contrastó cada `<acceptance_criteria>` contra la fuente. No hay tests omitidos, placeholders ni `<verify>` sin ejecutar en el diff de la fase.

---

## 8. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-xx** | Enmienda del registro de decisiones |
| **CA-xx** | Criterio de aceptación basado en propiedades |
| **CAP-xx** | Requisito de captura |
| **DPR / DSF** | *Device Pixel Ratio* / *Device Scale Factor* (equivalentes en Playwright) |
| **H-x** | Identificador de peligro del research |
| **INV-xx** | Invariante arquitectónica |
| **INT-xx** | Requisito de integración |
| **P2-D-xx** | Decisión de implementación local de la Fase 2 |
| **PRF-xx** | Requisito de rendimiento y presupuesto |
| **PRV-xx** | Requisito de privacidad y enmascarado |
| **R-xx** | Decisión del registro global |
| **RED / GREEN** | Fase de la disciplina TDD: prueba que falla / prueba que pasa |
| **SEC-xx** | Invariante de seguridad |
| **T1/T2/T3** | Momentos del enmascarado (T1 automático en captura) |
| **TDD** | *Test-Driven Development* |
| **WDG-xx** | Requisito del widget |
| **e2e** | Prueba de extremo a extremo |
| **UAT** | *User Acceptance Testing* |
