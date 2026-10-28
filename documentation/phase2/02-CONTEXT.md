<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 2 — Contexto: *SDK Tracer Bullet: Widget, Capture & Auto-Redaction*

| | |
|---|---|
| **Fase** | 2 — *SDK Tracer Bullet: Widget, Capture & Auto-Redaction* |
| **Rama** | `gsd/phase-2-sdk-tracer-bullet` (PR contra `develop`) |
| **Contexto recogido** | 2026-10-16 |
| **Requisitos en alcance** | 18 — INT-01/02/05, WDG-01…05, CAP-01/04/05, PRV-01/02/03/05/06, PRF-01/04 |
| **Estado** | Contexto cerrado y ejecutado (5/5 olas; ver `02-SUMMARY.md`) |

> Este documento consolida y resume el `02-CONTEXT.md` y el `02-DISCUSSION-LOG.md` de planificación. Es un resumen ejecutivo, no una copia literal.

---

## 1. Frontera de la fase

Por primera vez el producto hace algo real de extremo a extremo: **un usuario final abre el widget de Watchbug en una página anfitriona cualquiera** —integrado con una única etiqueta `<script async>` sin paso de build, o consumido como módulo ES— **captura la pestaña actual** a través del selector del navegador y **archiva un informe cuyo screenshot ya llevaba los datos sensibles destruidos en el momento de la captura**, sobre `ImageData` crudo y antes de que exista un solo byte codificado. El informe aparece en el panel.

La fase fija en su primera construcción las **dos decisiones que cargan arquitectura**:

| Decisión | Qué se fija | Por qué ahora |
|---|---|---|
| **Aislamiento `WidgetHost`** (H-2/H-3) | Shadow DOM `closed` en producción, host como último hijo de `documentElement`, `all: initial` y re-declaración explícita en px | Rehacerlo después es reescribir todos los estilos del widget |
| **Orden de redacción T1** (A-05) | `CaptureSource.capture()` devuelve `ImageData` crudo, nunca un `Blob`; `Redactor` actúa destructivamente antes de `encode` | Si existieran bytes codificados antes de enmascarar, la promesa central del producto sería falsa por construcción |

El núcleo inyectado se mantiene **≤ 45 KB gzip y con cero dependencias npm en runtime**.

### Fuera de esta fase (según ROADMAP)

- Compositor del informe, revisión antes de enviar, adjuntar imagen manualmente y UX de captura degradada → **Fase 3**
- Editor de anotación perezoso, enmascarado T2/T3 y herramienta de máscara del usuario → **Fase 3**
- i18n completo del widget (en/es) → **Fase 3**
- Captura de consola, metadatos de entorno y privacidad de identidad → **Fase 4**
- Autenticación del panel, proyectos y rotación de claves → **Fase 5**
- Triage y purga TTL → **Fase 6**
- Cola de durabilidad IndexedDB y puerta de release → **Fase 7**

---

## 2. Requisitos en alcance

| ID | Descripción | Ola |
|----|-------------|-----|
| **INT-01** | Integración con una sola etiqueta `<script async>`, sin build | 02-01 |
| **INT-02** | `Watchbug.init({ projectKey, … })` como punto de entrada público | 02-02 |
| **INT-05** | Consumo como módulo ES, sin añadir globales | 02-02 |
| **WDG-01** | Apertura del widget desde un lanzador flotante | 02-02 |
| **WDG-02** | El CSS hostil del anfitrión no puede ocultar, reestilizar ni romper el widget | 02-02 |
| **WDG-03** | El widget no filtra estilos, clases ni variables CSS al documento anfitrión | 02-02 |
| **WDG-04** | Exactamente un global (`window.Watchbug`) y ningún prototipo nativo modificado | 02-01 |
| **WDG-05** | El widget se dibuja por encima de todo el contenido del anfitrión | 02-02 |
| **CAP-01** | Captura de la pestaña actual mediante el selector del navegador | 02-03 |
| **CAP-04** | La captura nunca contiene el propio widget | 02-03 |
| **CAP-05** | Reducción a ≤ 16 MP y ≤ 2 MB sin quedar en blanco en pantallas HiDPI | 02-03 |
| **PRV-01** | Los valores de `input[type=password]` se excluyen automáticamente | 02-04 |
| **PRV-02** | Patrones de credencial, token y tarjeta se redactan automáticamente | 02-04 |
| **PRV-03** | Los elementos `data-watchbug-sensitive` se redactan automáticamente | 02-04 |
| **PRV-05** | El SDK nunca lee ni transmite cookies, almacenamiento ni cabeceras de auth del anfitrión | 02-05 |
| **PRV-06** | Query string y fragmento de la URL se eliminan antes de transmitir | 02-05 |
| **PRF-01** | El script inyectado ≤ 45 KB gzip; el build falla si se supera | 02-05 |
| **PRF-04** | El SDK cliente tiene cero dependencias npm en runtime | 02-05 |

---

## 3. Decisiones de implementación (P2-D-01…P2-D-12)

> Los IDs locales van prefijados `P2-D-` para no colisionar con el registro global `D-01…D-10` de `documentation/resolution-record.md`.

### 3.1 Flujo del widget y del envío

| ID | Decisión | Reversibilidad |
|----|----------|----------------|
| **P2-D-01** | **Envío directo con `title` autogenerado.** Un clic captura y envía; `title` = `document.title` truncado a 200 caracteres y `type: 'bug'` fijo. Sin formulario ni elección de tipo hasta el compositor de la Fase 3. | reversible |
| **P2-D-02** | **Un gesto + panel de estado.** El clic del lanzador *es* la activación transitoria: el lanzador se oculta y `getDisplayMedia` se invoca en el mismo handler. El panel flotante dentro del Shadow DOM muestra «Capturando… → Enviando… → resultado» y es además el contenido de diálogo que CA-04 aserta bajo CSS hostil. | costosa |
| **P2-D-03** | **Reintento sólo de transitorios.** Red, timeout, 5xx y 429: 3 intentos con backoff 1/4/10 s ±25 % y la **misma `Idempotency-Key`**. Los 4xx de contrato fallan de inmediato mostrando el motivo del servidor, con botón manual de reintento. | reversible |
| **P2-D-04** | **Mapa `strings` ID→inglés, sin i18n.** Un único `strings.ts` en el carril core; sin detección de locale, sin conmutador y sin `es`. La forma permite que la Fase 3 añada el segundo idioma sin refactor. | reversible |

### 3.2 El widget fuera de la captura

| ID | Decisión | Reversibilidad |
|----|----------|----------------|
| **P2-D-05** | **Ocultar y restaurar el host.** De forma síncrona dentro del handler del gesto y antes de `getDisplayMedia`; se restaura tras obtener el `ImageData`. Se descartaron `selfBrowserSurface: 'exclude'` (incompatible con `preferCurrentTab` y sólo Chromium) y enmascarar el bbox del widget en el bitmap (si está bien oculto no hay nada que borrar, y el relleno destruiría zona legítima). | costosa |
| **P2-D-06** | **Invariante asertada en el pipeline.** El pipeline comprueba que el host está oculto justo antes de `drawImage`/`getImageData`; si no, la captura falla con estado visible en lugar de producir un frame contaminado. La garantía vive en el código, no en el orden de llamadas. | reversible |

### 3.3 Alcance de la auto-redacción

| ID | Decisión | Reversibilidad |
|----|----------|----------------|
| **P2-D-07** | **Catálogo alineado con el scrubber C-5 de la Fase 4:** forma JWT (`eyJ…`), `Bearer <token>`, asignaciones `key=/token=/secret=/password=`, secuencias tipo tarjeta validadas por **Luhn**, más `input[type=password]` y `[data-watchbug-sensitive]`. Detección sobre el DOM; sin OCR. | costosa |
| **P2-D-08** | **Granularidad = elemento / nodo de texto completo.** Al coincidir un patrón se enmascara el rectángulo completo del elemento o del nodo, redondeado **hacia fuera** en espacio bitmap. Se prefiere enmascarar de más antes que filtrar caracteres por el borde. | costosa |
| **P2-D-09** | **Política conservadora, sin reglas del host en v1.** El anfitrión sólo puede marcar con `data-watchbug-sensitive` u ocultar vía `input[type=password]`; no hay API pública de redacción personalizada y el puerto `Redactor` queda como costura. Un falso positivo es inocuo; un falso negativo es una fuga. | reversible |

### 3.4 Fidelidad frente a tamaño de la captura

| ID | Decisión | Reversibilidad |
|----|----------|----------------|
| **P2-D-10** | **Escalera de reducción determinista en cliente:** clamp de DPR a 2 → reducir a ≤ 16 MP → WebP q0.8 → si supera el tope, re-encode q0.6 → q0.5 y downscale 0.75× hasta cumplir. El servidor conserva su tope duro de 2 MB como control, pero no se alcanza por diseño. | costosa |
| **P2-D-11** | **Objetivo ≤ 800 KB, tope duro 2 MB** (`MAX_ENCODED_IMAGE_BYTES`). | reversible |
| **P2-D-12** | **Sonda contra la captura en blanco.** Si el frame es uniforme o el canvas excede el área soportada, se aborta con error visible; **nunca** se envía una imagen en blanco en silencio. Causa conocida: el tope de área de canvas de Safari (16 777 216 px). *(Implementación final: comprobación **densa** de uniformidad — cualquier píxel distinto del primero evita el falso «blank»; sustituyó a la rejilla de 9 muestras tras la UAT, ver `02-SUMMARY.md` §3.)* | reversible |

**Discreción del agente.** Ningún área quedó marcada como «decide tú»: todas las decisiones discutidas tienen elección explícita del propietario. Quedó latitud técnica para research y planificación en la estrategia de recorrido del DOM para localizar coincidencias y calcular bounding boxes, la descomposición en módulos y ficheros, la disposición concreta de entradas esbuild para los carriles, el cableado de `SHADOW_MODE`, la estructura exacta de las aserciones e2e y los detalles del reintento/backoff.

---

## 4. Referencias canónicas

| Área | Documento | Qué aporta |
|------|-----------|------------|
| **Alcance y aceptación** | `.planning/ROADMAP.md` § Phase 2 | Objetivo, 5 criterios de éxito, los 18 requisitos y el párrafo de riesgos (aislamiento, T1, geometría bitmap, lane 1, `blob.type`, fallo ruidoso) |
| **Requisitos** | `.planning/REQUIREMENTS.md` | Definiciones y trazabilidad de los 18 IDs de la fase |
| **Decisiones e invariantes** | `documentation/resolution-record.md` | R-01 (presupuesto por niveles), R-02 (8 puertos), R-11 (WebP/PNG), R-12 (e2e), R-13/A-01 (relleno plano α=255), R-14 (`SHADOW_MODE`), R-15, R-17, R-18, A-05 (`ImageData`, nunca `Blob`), A-06 (topes). **§5 manda en conflicto** |
| **Puertas de calidad** | `documentation/mentorship-pack.md` | INV-01/02/03, SEC-01/02/03/05, RNF-01/02/03 |
| **No-objetivos y autonomía** | `documentation/mission-brief.md` | *Declarar el NO*, envelope de autonomía y disparadores de consulta |
| **Contratos y constantes** | `packages/contracts/src/constants.ts`, `schema.ts` | `MAX_ENCODED_IMAGE_BYTES` (2 MB), `MAX_IMAGE_PIXELS` (16 MP), `MAX_IMAGE_DIM` (8192 px), `MAX_TITLE_CHARS` (200), `MASK_ALPHA_OPAQUE` (255), `MASK_PIXELATION_MIN_BLOCK_PX` (8); esquema `strictObject` con URL sin query/fragmento |
| **Evidencia de research** | `.planning/research/{SUMMARY,STACK,ARCHITECTURE}.md` | Cadena de captura, lane 1, objetivos de encode, constantes de reintento, clamp DPR, sonda de uniformidad, `track.stop()` en `finally` |
| **Código existente (Fase 1)** | `packages/sdk/scripts/build.mjs`, `src/index.ts`, `apps/api/src/routes/incidents.ts`, `scripts/check-size.mjs`, `e2e/hostile.spec.ts`, `playwright.config.ts`, `apps/panel`, `.env.example` | Puntos de extensión y activos reutilizables |
| **Entrada del proyecto** | `AGENTS.md` | Marco C-B-D-C, disparadores de consulta y comandos |

---

## 5. Estado del código al planificar

La Fase 2 **no parte de cero**: la Fase 1 dejó el esqueleto funcional y los contratos.

| Activo | Estado al inicio | Qué añade la Fase 2 |
|---|---|---|
| `packages/sdk/src/index.ts` | Stub del carril core con `WATCHBUG_VERSION` | El `window.Watchbug.init()` real y el arranque del widget |
| `packages/sdk/scripts/build.mjs` | Build dual IIFE/ESM en tres carriles, `SHADOW_MODE` fijo a `'closed'` | Cableado del bundle e2e con `'open'` (R-14) |
| `packages/contracts` | Constantes y esquema Zod publicados | Se importan **sólo como tipos/constantes**; Zod nunca viaja al cliente |
| `apps/api` | Ingesta multipart `{ meta, image }` con `X-Project-Key` e `Idempotency-Key` | Ningún cambio: la fase sólo consume el endpoint |
| `apps/panel` | Renderiza tipo, título, URL, usuario e imagen | Ningún cambio: la mitad «aparece en el panel» ya existe |
| `e2e/` + `playwright.config.ts` | Suite única con aserciones a nivel de artefacto | Se extiende la misma suite; no se crea otra (R-12) |
| `scripts/check-size.mjs` | Puerta de tamaño por carriles | Se mantiene; el bundle e2e queda fuera de los carriles de producción |

**Patrones establecidos que la fase hereda:** bandera de build para el Shadow DOM, orden T1, conjunto único de constantes, verificación e2e exclusiva, y `commit_docs: true` con planes `02-NN-PLAN.md`.

---

## 6. Ideas específicas y elementos diferidos

**Específicas**

- **El panel de estado vale por dos:** es la realimentación de progreso del usuario *y* el «dialog content» que la fila de CSS hostil (CA-04) aserta. Bajo CSS hostil y con raíz cerrada, un panel flotante que sigue visible es la prueba de que el widget se dibuja por encima.
- **Secuenciación por riesgo:** como el aislamiento es carga arquitectónica y la bandera `SHADOW_MODE=open` es lo que lo hace testeable, el fixture hostil y el bundle e2e deben existir **antes** de terminar el pipeline de captura.
- **La redacción es la idea portante:** todo el valor del producto descansa en T1. No puede existir un instante en el que bytes sin enmascarar sean transmisibles.

**Diferidos**

- **`title`/`type` fijos** (P2-D-01) — nota del propietario: *«Recordar arreglar este hardcode si es necesario en fases posteriores»*. Se revisa en la Fase 3 con el compositor.
- **UX completa de degradación de captura** (adjuntar imagen, envío sólo texto, estado «screenshot no disponible») — H-4/H-5, obligatoria pero de Fase 3. Hasta entonces los errores de captura sólo fallan en voz alta.
- **i18n en/es del widget** — WDG-06/RNF-03, Fase 3; el mapa de `strings` es la forma donde encaja.
- **Reglas de redacción configurables por el host** — `Redactor` queda como costura; una API pública sería cambio de interfaz (disparador de consulta).
- **`CaptureSource` opcional por serialización DOM** — v2 (A-08); su escenario de tamaño permanece en `check:size`, pero no se construye adaptador.
- Sin tareas pendientes asociadas a esta fase (`todo.match-phase 2` → 0).

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-xx** | Enmienda del registro de decisiones (`resolution-record.md` §5) |
| **CA-xx** | Criterio de aceptación basado en propiedades (invariante del producto) |
| **CAP-xx** | Requisito de captura |
| **DPR** | *Device Pixel Ratio* (relación píxel de dispositivo / píxel CSS) |
| **H-x** | Identificador de peligro (*pitfall*) del research de la fase |
| **INV-xx** | Invariante arquitectónica del *Mentorship Pack* |
| **INT-xx** | Requisito de integración |
| **P2-D-xx** | Decisión de implementación local de la Fase 2 |
| **PRF-xx** | Requisito de rendimiento y presupuesto de tamaño |
| **PRV-xx** | Requisito de privacidad y enmascarado |
| **R-xx** | Decisión del registro global (`resolution-record.md`) |
| **RNF-xx** | Requisito no funcional del *Mission Brief* |
| **SEC-xx** | Invariante de seguridad del *Mentorship Pack* |
| **T1/T2/T3** | Momentos del enmascarado: T1 automático en captura, T2 al completar trazo, T3 re-aplicación al exportar (T2/T3 son de Fase 3) |
| **WDG-xx** | Requisito del widget y su aislamiento |
| **e2e** | Prueba de extremo a extremo (única forma de verificación admitida, R-12) |
| **UAT** | *User Acceptance Testing* — verificación humana |
