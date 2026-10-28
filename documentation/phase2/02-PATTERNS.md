<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 2 — Arquitectura y patrones: *SDK Tracer Bullet: Widget, Capture & Auto-Redaction*

| | |
|---|---|
| **Fase** | 2 — *SDK Tracer Bullet: Widget, Capture & Auto-Redaction* |
| **Mapeado** | 2026-10-17 |
| **Ficheros clasificados** | 18 (14 nuevos, 4 modificados) |
| **Análogos encontrados** | 11 / 18 (4 exactos · 2 por rol · 5 parciales · 7 ninguno) |
| **Estado** | Patrones aplicados; la fase ejecutada los confirma |

> Este documento consolida y resume el `02-PATTERNS.md` de la fase. Es un resumen ejecutivo, no una copia literal. **No existe `SKELETON.md` para esta fase**: las secciones que dependen de él se marcan como «no aplica».

---

## 1. Modo greenfield: el contrato de patrones

Esta es la **primera fase que escribe código de navegador** (DOM, canvas, Shadow DOM) en el repositorio. Por eso los módulos de widget, captura, redacción e imagen **no tienen análogo de mismo rol** en el código existente. Su «patrón» es doble:

1. Los **ejemplos de código bloqueados del research** (`02-RESEARCH.md`), que codifican el orden y la forma correcta.
2. Las **restricciones duras de `scripts/gate.mjs`**, que el ejecutor incumpliría si las ignorase: un único sumidero de codificación, cero lectura de estado del anfitrión y cero tokens prohibidos en fuente **ni en comentarios**.

La otra mitad de la fase — e2e, build y scripts — sí tiene análogos exactos de la Fase 1 y se apoya en ellos.

**Consecuencia de planificación:** donde no hay análogo, el plan debe citar explícitamente la fuente del patrón (research o UI-SPEC). Donde sí lo hay, debe copiar la convención existente en lugar de inventar una.

---

## 2. Decisiones arquitectónicas del esqueleto

> **`SKELETON.md` no existe para esta fase → no aplica.** No se inventan secciones. Las decisiones estructurales que sí quedaron fijadas por el patrón se resumen aquí a partir del mapa de patrones:

| Decisión estructural | Consecuencia |
|---|---|
| **El global IIFE *es* el namespace del módulo** | `init()` debe ser export **nombrado** para aparecer en `window.Watchbug`; el export por defecto es la forma del global |
| **Tres carriles de build × dos formatos = seis llamadas** | Los ficheros nuevos se recogen automáticamente al importarse desde `src/index.ts`; no se toca `LANE_ENTRIES` |
| **La variante e2e es un build extra, no una bandera** | Un solo camino de build; `check:size` discrimina por nombre de fichero |
| **Los contratos son tipos + constantes, nunca Zod en runtime** | Los valores se inlinean en el bundle; los tipos se borran |
| **La verificación es una suite única + gates** | No se añade ningún artefacto de prueba nuevo (R-12) |
| **La raíz del widget sólo se abre en el bundle e2e** | Las aserciones de aislamiento corren contra el bundle cerrado; las de copy/estado, contra el abierto |

---

## 3. Capacidad probada de extremo a extremo

> **Sin `SKELETON.md` → la sección se construye desde la evidencia de la fase.**

Al cierre de la fase, un solo gesto sobre una página anfitriona hostil ejecuta, en orden y de forma verificable:

**script async → `init()` → lanzador 48×48 → ocultar host → `getDisplayMedia` → fotograma → aserción de host oculto → restaurar → sonda de blanco → redacción destructiva T1 → codificación en un sumidero único → POST multipart → 201 → fila visible en el panel.**

### Stack tocado en la Fase 2

| Capa | Tecnología | Qué aportó la fase |
|---|---|---|
| Cliente | TypeScript 7.0.2, ES2020, esbuild 0.28.2 | Widget, captura, redacción, codificación, transporte |
| Plataforma | `getDisplayMedia`, `<video>`, canvas, `ImageData`, Shadow DOM, `fetch` | Sin dependencias: todo API de navegador |
| Servidor | Fastify 5 (Fase 1, sin cambios) | Ingesta, deduplicación y topes ya existentes |
| Datos | PostgreSQL 18 + volumen (Fase 1) | Persistencia real del informe |
| Verificación | Playwright 1.63.0, `node:zlib`, `gate.mjs` | Tres motores, tres gates |

---

## 4. Clasificación de ficheros (rol / flujo de datos)

| Fichero | Rol | Flujo | Análogo más cercano | Calidad |
|---|---|---|---|---|
| `packages/sdk/src/index.ts` (mod) | config/bootstrap (entrada) | dirigido por eventos | él mismo + `build.mjs` (cableado del global) | por rol |
| `packages/sdk/src/strings.ts` | utilidad (diccionario) | transformación | `contracts/src/constants.ts` (sólo estilo de export) | parcial |
| `packages/sdk/src/widget/host.ts` | componente (custom element = `WidgetHost`) | dirigido por eventos | — (primer módulo DOM) | ninguno |
| `packages/sdk/src/widget/launcher.ts` | componente | dirigido por eventos | — | ninguno |
| `packages/sdk/src/widget/status-panel.ts` | componente (vista de máquina de estados) | dirigido por eventos | — | ninguno |
| `packages/sdk/src/capture/capture-source.ts` | servicio (`CaptureSource` + `DisplayMediaCapture`) | streaming | `capture/dom-serialize.ts` (el otro adaptador del mismo puerto) | por rol |
| `packages/sdk/src/capture/pipeline.ts` | servicio (orquestador) | transformación | — (el orden es el contrato) | ninguno |
| `packages/sdk/src/redact/redactor.ts` | servicio (`Redactor`) | transformación | — | ninguno |
| `packages/sdk/src/redact/patterns.ts` | utilidad (catálogo + Luhn) | transformación | — (condicionado por el gate) | ninguno |
| `packages/sdk/src/redact/geometry.ts` | utilidad (CSS px → bitmap) | transformación | — | ninguno |
| `packages/sdk/src/image/encode.ts` | utilidad/servicio (escalera) | transformación | `e2e/make-fixtures.mjs` (precedente `toBlob` + sniff) | parcial |
| `packages/sdk/src/transport/lane1.ts` | servicio (cliente HTTP) | petición-respuesta | `e2e/ingest.spec.ts` `postIncident` + `apps/api/.../incidents.ts` | parcial |
| `packages/sdk/scripts/build.mjs` (mod) | config (build) | E/S de ficheros | él mismo | exacto |
| `scripts/gate.mjs` (mod si hiciera falta) | config (gate estático) | E/S de ficheros | él mismo (`RULES`) | exacto |
| `playwright.config.ts` (mod, comentario OQ-2) | config | — | él mismo | exacto |
| `e2e/sdk.spec.ts` (filas nuevas) | test | petición-respuesta | `e2e/hostile.spec.ts` | exacto |
| `e2e/fixtures/hostile-host.html` | fixture | — | `e2e/ingest.spec.ts` (cumplimiento por `page.route`) | parcial |
| Helpers e2e (stub de captura, cargador de fixtures, PNG forzado) | utilidad de test | transformación | `e2e/make-fixtures.mjs` (`page.evaluate` + canvas) | parcial |

---

## 5. Asignaciones de patrón

### `index.ts` — bootstrap

Conservar el doc-comment de cabecera que cita invariantes (RNF-01, INV-01/02), reescrito para la fase actual. Exportar `init()` **nombrado**; mantener el objeto por defecto como forma del global. La validación de opciones es manual: cero Zod en runtime.

### `build.mjs` — variante de build (R-14)

Parametrizar `shared.define.SHADOW_MODE` por build **sin tocar la matriz de carriles**. El artefacto abierto debe tener nombre distinto (`watchbug.e2e.*`) para que `check:size`, que discrimina por nombre, no pueda medirlo como producción.

### `strings.ts` — diccionario bloqueado

Forma tomada de `constants.ts`: mapa declarativo, comentado, sin imports. Contenido bloqueado contra el contrato de copy del UI-SPEC. `t()` sólo sustituye `{placeholder}`; la Fase 3 añade `stringsEs` y un resolvedor sin refactor del núcleo.

### `widget/host.ts` — aislamiento (carga arquitectónica)

Patrón del research, probado en tres motores: lista de estilos inline `!important`, host como último hijo de `documentElement`, `attachShadow({ mode: SHADOW_MODE })`, un `<style>` dentro de la raíz que abre con `all: initial` y re-declara en px. Debe llevar además `hide()`/`restore()`/`isHidden()`, re-append por observador y registro de raíces sólo en el build abierto.

### `widget/launcher.ts` + `widget/status-panel.ts` — componentes

Lanzador: `<button>` real 48×48; el handler oculta el host y llama al flujo de forma **síncrona** (cualquier `await` previo pierde la activación transitoria). Panel: máquina de estados completa, copy por `t()`, motivos del servidor por `textContent` truncados a 240, `Escape` de documento retirado al desmontar.

### `capture/capture-source.ts` — adaptador del puerto

Mismo puerto que `dom-serialize.ts`, otro adaptador. El contrato es estructural: `capture()` devuelve `ImageData`, **nunca** un `Blob`. Cadena `getDisplayMedia` → `<video>` → `drawImage`; `track.stop()` en `finally`; verificación de superficie con fallo ruidoso.

### `capture/pipeline.ts` — orquestador

El **orden es el contrato** (ocultar → capturar → asertar → restaurar → sondear → redactar → codificar → enviar). Todo camino de error es un estado terminal visible; nunca una imagen en blanco silenciosa ni un envío sin redactar.

### `redact/{redactor,patterns,geometry}.ts` — privacidad

`redactor` implementa el puerto (costura, sin reglas del anfitrión): escaneo del DOM y relleno plano α=255 sobre `ImageData`. `patterns` es el catálogo P2-D-07 con Luhn propio; **trampa del gate**: escribir `Beare[r]` y comentarios genéricos. `geometry` es el **único** mapeo CSS px → bitmap: escala por ancho de canvas y redondeo hacia fuera.

### `image/encode.ts` — sumidero único

Precedente de codificación y sniff en `make-fixtures.mjs`. Restricción dura: **una sola** aparición textual de `toBlob|toDataURL|convertToBlob` en todo `packages/sdk/src`; la escalera es un bucle alrededor de esa llamada. Sniff de `blob.type` tras cada codificación y caché de capacidad al arrancar.

### `transport/lane1.ts` — cliente HTTP

Forma del wire tomada de `postIncident` del e2e: multipart `meta` + `image`, `X-Project-Key` + `Idempotency-Key`. Contrato del servidor: clave ≤256 caracteres, tipos aceptados PNG/WebP, 201 con `{ id }`, errores `{ statusCode, error, message }`. Una clave por informe reutilizada en todos los reintentos; timeout 15 s por intento; transitorios 1/4/10 s ±25 %; 4xx de contrato inmediatos. **Nunca** `keepalive`/`sendBeacon`.

### `e2e/specs` — la suite única

Análogo exacto: `e2e/hostile.spec.ts`. Títulos de fila con el ID del requisito; un `RegExp` compartido por ruta interceptada; `projectKey()` leída del `.env` con guarda de placeholder. Aserciones a nivel de artefacto: respuesta HTTP real y bytes decodificados, nunca mocks.

### `e2e` — fixtures y stubs

Fixture hostil por `page.route` en el origen del panel (el CSP de nginx neutralizaría el CSS inline y CA-04 pasaría de forma vacua). Stub de captura de dos niveles. Fila de PNG forzado para M-3. Aislamiento contra el bundle cerrado; copy/estado contra el abierto.

### `scripts/gate.mjs` — gate estático

Extender `RULES`, nunca duplicar gates. Si el catálogo no pudiera evitar los tokens, la exención sería **estrecha y enumerada** (sólo `src/redact/patterns.ts`, nunca las cookies/storage) con el propósito inverso escrito. **No fue necesaria:** se resolvió por redacción del regex.

---

## 6. Patrones compartidos

| # | Patrón | Fuente | Aplicación |
|---|---|---|---|
| 1 | **Disciplina de importación de contratos** | `contracts/src/types.ts`, `package.json` | Tipos con `import type` (borrados); constantes como valor (inlineadas). Nunca re-declarar un tope localmente |
| 2 | **Doc-comment de cabecera citando invariantes** | `index.ts`, `dom-serialize.ts`, `gate.mjs` | Todo fichero nuevo cita los IDs que aplica. Sin tokens literales prohibidos en comentarios |
| 3 | **Cumplimiento del gate estático** | `scripts/gate.mjs` | Sin `document.cookie`/`localStorage`/`sessionStorage`/`Authorization`/`Bearer\s`; `credentials` sólo `'omit'` o ausente; un único sumidero; runtime block sólo contratos |
| 4 | **Cuerpo de error estructurado → motivo del panel** | `apps/api/.../incidents.ts` | `message` por `textContent`, truncado a 240; nunca `innerHTML` |
| 5 | **Convenciones de la suite única** | `hostile.spec.ts`, `ingest.spec.ts`, `playwright.config.ts` | Tres motores, `workers: 1`, health gate, títulos por requisito, `page.unroute` correcto |
| 6 | **`define` de esbuild son expresiones JS** | `build.mjs` | `JSON.stringify('closed')`; artefactos abiertos con nombre distinto |

---

## 7. Sin análogos encontrados

| Fichero | Rol | Flujo | Razón | Fuente del patrón |
|---|---|---|---|---|
| `widget/host.ts` | componente | eventos | No existía código DOM/Shadow DOM | Research Pattern 1 + UI-SPEC (probado en 3 motores) |
| `widget/launcher.ts` | componente | eventos | No existían componentes de UI | Research Pattern 4 + UI-SPEC (48×48, gesto síncrono) |
| `widget/status-panel.ts` | componente | eventos | No existían vistas de máquina de estados | Research Pattern 4 + UI-SPEC (estados, copy, `textContent`, A-6/A-7) |
| `capture/pipeline.ts` | servicio | transformación | No existía orquestación | Research Code Example (el orden es el contrato) |
| `redact/redactor.ts` | servicio | transformación | No existía código canvas/`ImageData` | Research Pattern 2 + `MASK_ALPHA_OPAQUE` |
| `redact/patterns.ts` | utilidad | transformación | No existía catálogo de regex | Catálogo P2-D-07 + Luhn propio; redacción para el gate |
| `redact/geometry.ts` | utilidad | transformación | No existía geometría | Mapeo H-1 + redondeo hacia fuera |

---

## 8. Fuera de alcance y slices posteriores

**Fuera de esta fase (por diseño, no por carencia):**

- Compositor del informe y revisión previa al envío → **Fase 3**
- Editor de anotación perezoso y máscaras de usuario T2/T3 → **Fase 3**
- i18n en/es del widget y atributo `lang` → **Fase 3**
- Captura de consola, metadatos de entorno e identidad → **Fase 4**
- Autenticación, proyectos y rotación de claves → **Fase 5**
- Triage y purga TTL → **Fase 6**
- Cola IndexedDB y cierre de release → **Fase 7**

**Plan de slices posteriores que reutiliza estos patrones:**

| Slice | Qué reutiliza de la Fase 2 |
|---|---|
| Fase 3 (anotador) | `geometry.ts` (único mapeo bitmap), el sumidero único, el estado terminal visible y el mapa de `strings` |
| Fase 3 (composer) | `buildMeta()` explícito y el tope de 200 puntos de código |
| Fase 4 (C-5 scrubber) | Las cuatro familias de `patterns.ts` y la regla Luhn, como implementación de referencia |
| Fase 5 (integración) | La documentación de la limitación AR-01 y el contrato de `init()` |
| Fase 7 (release) | Las filas CA/PRV, `check:size` y la aritmética de tiers A-12/M-2 |

---

## 9. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-xx** | Enmienda del registro de decisiones |
| **AR-xx** | Riesgo aceptado formalmente |
| **CA-xx** | Criterio de aceptación basado en propiedades |
| **CAP-xx** | Requisito de captura |
| **H-1** | Peligro de mala registración de la geometría de máscara |
| **INV-xx** | Invariante arquitectónica |
| **P2-D-xx** | Decisión de implementación local de la Fase 2 |
| **PRV-xx** | Requisito de privacidad y enmascarado |
| **R-xx** | Decisión del registro global |
| **RNF-xx / PRF-xx** | Requisito no funcional / de rendimiento |
| **SEC-xx** | Invariante de seguridad |
| **T1/T2/T3** | Momentos del enmascarado |
| **WDG-xx** | Requisito del widget |
| **e2e** | Prueba de extremo a extremo |
