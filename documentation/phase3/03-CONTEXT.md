<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 3 — Contexto: *Report Composer & Annotation Editor (lazy)*

| | |
|---|---|
| **Fase** | 3 — *Report Composer & Annotation Editor (lazy)* |
| **Rama** | `gsd/phase-3-report-composer-annotation-editor-lazy` (PR contra `develop`) |
| **Contexto recogido** | 2026-10-28 |
| **Estado** | Listo para planificación → ejecutado (ver `03-SUMMARY.md`) |
| **Requisitos en alcance** | CAP-02, CAP-03, ANN-01…ANN-06, PRV-04, PRV-07, WDG-06, PRF-02, PRF-03 (13) |

> Este documento consolida y resume `03-CONTEXT.md` y `03-DISCUSSION-LOG.md`. Es un resumen ejecutivo, no una copia literal.

---

## 1. Frontera de la fase

Al terminar la fase, un usuario final puede **componer un informe completo**: capturar o adjuntar una imagen, anotarla con mano alzada, flechas, rectángulos y etiquetas de texto, destruir de forma irreversible cualquier región sensible, revisar el resultado y enviarlo. Todo el formulario y el editor funcionan en inglés y español, y el editor se descarga **solo cuando el usuario pulsa «Anotar»**.

El compositor **sustituye** el atajo one-shot de la Fase 2 (título automático + `type:'bug'` fijo → envío inmediato) por un formulario real montado sobre el armazón que la Fase 2 ya fijó: shadow root cerrado, un único `window.Watchbug` y el `status-panel` para estados en vuelo. El contrato C-2 del puerto `Annotator` y el orden T2/T3 de las máscaras están **bloqueados por ROADMAP** y no se reabren: esta fase decide *cómo los vive el usuario*.

### Fuera de esta fase (según ROADMAP)

- Captura de consola, metadatos de entorno y privacidad de identidad (`ENR-01…05`, `INT-03`, `INT-04`) → **Fase 4**.
- Autenticación de panel, CRUD de proyectos y rotación de clave → **Fase 5**.
- Triage, estados, comentarios y purga TTL → **Fase 6**.
- Cola de durabilidad IndexedDB (`ING-02`) → **Fase 7**.
- `DomSerializeCapture` como fuente opcional → **v2** (A-08).

---

## 2. Requisitos en alcance

| ID | Descripción | Ola |
|---|---|---|
| **CAP-02** | Adjuntar una imagen del dispositivo como alternativa a la captura | 03-02 / 03-04 |
| **CAP-03** | Estado de fallo visible cuando la captura no está disponible, con envío solo-texto | 03-01 / 03-04 |
| **ANN-01** | Dibujo libre sobre la captura | 03-05 |
| **ANN-02** | Flechas | 03-05 |
| **ANN-03** | Rectángulos | 03-05 |
| **ANN-04** | Etiquetas de texto | 03-05 |
| **ANN-05** | Máscara opaca de una región | 03-06 |
| **ANN-06** | Deshacer trazos de anotación; las máscaras no se deshacen | 03-05 / 03-06 |
| **PRV-04** | La región enmascarada se destruye a nivel de píxel y no se recupera del artefacto codificado | 03-06 |
| **PRV-07** | Revisar y editar la captura antes de enviar | 03-03 |
| **WDG-06** | Widget completo en inglés y español, con auto-detección y override manual | 03-03 / 03-05 |
| **PRF-02** | Chunk lazy del editor ≤ 25 KB gz | 03-05 / 03-07 |
| **PRF-03** | Payload total en ejecución ≤ 80 KB gz | 03-07 |

---

## 3. Decisiones de implementación (P3-D-01…P3-D-16)

> Los IDs locales van prefijados `P3-D-` para no colisionar con el registro global `D-01…D-10` de `documentation/resolution-record.md`.

### 3.1 Flujo del compositor

| ID | Decisión | Reversibilidad |
|---|---|---|
| **P3-D-01** | **Captura directa → formulario.** El clic del lanzador captura de inmediato (conserva la activación transitoria de P2-D-05). Si falla, el formulario abre en modo degradado. | costosa |
| **P3-D-02** | **Título auto-rellenado editable** con `document.title` truncado a 200 códigos de punto. Enviar se bloquea solo si queda vacío. | reversible |
| **P3-D-03** | **Toggle bug/feedback** segmentado, por defecto `bug`, alineado con el `z.enum(['bug','feedback'])` del contrato. | reversible |
| **P3-D-04** | **Overlay grande** dentro del Shadow DOM; el `status-panel` de 320 px queda para `Capturing…`, `Sending…` y `Retrying…`. | costosa |

### 3.2 Editor de anotación

| ID | Decisión | Reversibilidad |
|---|---|---|
| **P3-D-05** | **«Anotar» → editor a pantalla completa** dentro del Shadow DOM, con paleta y «Listo». Anotar es opcional. | reversible |
| **P3-D-06** | **Barra vertical de iconos** a la izquierda: mano alzada, flecha, rectángulo, texto y máscara; deshacer aparte. | reversible |
| **P3-D-07** | **Tinta de un solo color** (acento del widget); sin selector de color. | reversible |
| **P3-D-08** | **Etiqueta de texto: clic → escribir → Enter** (o clic fuera). Sin modal. | reversible |

### 3.3 Máscara e irreversibilidad

| ID | Decisión | Reversibilidad |
|---|---|---|
| **P3-D-09** | **Confirmación solo la primera vez por sesión.** Las siguientes máscaras se hornean al soltar; siguen siendo no deshacibles. | costosa |
| **P3-D-10** | **Pixelación opt-in** dentro de la herramienta de máscara («Relleno / Pixelar»), relleno opaco plano por defecto, bloque ≥ `max(8 px, 2× cap-height)`, grid-snapped. | reversible |
| **P3-D-11** | **Deshacer por trazo** con botón y Ctrl/Cmd+Z; nunca una máscara; pila acotada (~20 trazos). | reversible |
| **P3-D-12** | **Sin «borrar todas las anotaciones»**: solo deshacer por trazo. Las máscaras horneadas se conservan. | reversible |

### 3.4 Degradación, adjunto y revisión

| ID | Decisión | Reversibilidad |
|---|---|---|
| **P3-D-13** | **Compositor degradado con ambas salidas** (CAP-03): aviso «captura no disponible» + «Adjuntar imagen» / «Continuar solo con texto». Nunca un panel de error muerto. | reversible |
| **P3-D-14** | **Adjuntar acepta PNG + WebP + JPEG** (CAP-02). Implica ampliar el allowlist del servidor (`sniff.ts`/`harden.ts`) y añadir la rama JPEG al re-encode. | costosa |
| **P3-D-15** | **El adjunto entra en el mismo flujo** de anotación, máscara, revisión y envío. T1 no aplica (no hay DOM que escanear); las máscaras manuales sí. | reversible |
| **P3-D-16** | **Pantalla de revisión distinta** (PRV-07): imagen final aplanada + resumen + «Editar» / «Enviar». | reversible |

**Discreción del agente:** el propietario cerró la discusión sin profundizar en la colocación del selector de idioma, el momento exacto de descarga del chunk y la forma mínima del formulario solo-texto. También quedaron a criterio la descomposición modular del editor, el grosor de trazo, la profundidad exacta del undo y la estructura de las aserciones e2e de CA-02.

---

## 4. Referencias canónicas

| Área | Documento | Qué aporta |
|---|---|---|
| Alcance y aceptación | `.planning/ROADMAP.md` § Phase 3 | Objetivo, 5 criterios de éxito, 13 requisitos y el contrato C-2/T3 |
| Requisitos | `.planning/REQUIREMENTS.md` | Definiciones y trazabilidad de CAP-02/03, ANN-01…06, PRV-04/07, WDG-06, PRF-02/03 |
| Decisiones globales | `documentation/resolution-record.md` | R-01, R-02, R-12/R-19, R-13/A-01, R-14, R-15, R-17, R-18, A-05, A-06, A-08, A-12, A-14 |
| Invariantes | `documentation/mentorship-pack.md` | INV-01…03, SEC-01/02/05, RNF-01/02/03 |
| Misión y límites | `documentation/mission-brief.md` | Objetivo, no-goals, autonomía y triggers de consulta |
| Estado de sesión | `documentation/continuity-pack.md` | Política branch-per-phase + PR manual y trampa del viewport emulado |
| Contrato | `packages/contracts/src/schema.ts` | Tipo, título, nota, URL path-only y usuario |
| Constantes | `packages/contracts/src/constants.ts` | `MAX_NOTE_CHARS`, `MAX_TITLE_CHARS`, `MAX_ENCODED_IMAGE_BYTES`, `MAX_IMAGE_PIXELS`, `MAX_IMAGE_DIM`, `MASK_ALPHA_OPAQUE`, `MASK_PIXELATION_MIN_BLOCK_PX` |
| Stack | `.planning/research/STACK.md` | Pines verificados y lista «What NOT To Use» |
| Arquitectura | `.planning/research/ARCHITECTURE.md` | `WidgetHost`, las 8 costuras, forma del ingest |

---

## 5. Estado del código

La fase parte de un monorepo **ya existente** (Fases 1 y 2):

| Activo reutilizable | Uso en Fase 3 |
|---|---|
| `packages/sdk/src/capture/pipeline.ts` | `runCaptureFlow` se parte en etapa de captura y `encodeFinal`; el compositor sustituye el envío one-shot |
| `packages/sdk/src/capture/capture-source.ts` | Costura `CaptureSource`; se añade `ManualFileCapture` como segundo adaptador |
| `packages/sdk/src/image/encode.ts` | Único sumidero `encodeOnce`; `encodeFinal()` debe pasar por él |
| `packages/sdk/src/redact/geometry.ts` | Geometría bitmap/device-pixel reutilizada por las máscaras de usuario |
| `packages/sdk/src/strings.ts` | Mapa `strings` + `t()`; se añade `stringsEs` y el resolver de locale |
| `packages/sdk/src/widget/host.ts`, `launcher.ts`, `status-panel.ts` | Armazón del widget sobre el que se monta el compositor |
| `packages/sdk/src/annotator.ts` | Entrada del chunk lazy que se rellena en esta fase |
| `packages/sdk/scripts/build.mjs` | Build multi-lane; el editor ya es un entry point |
| `scripts/check-size.mjs` | Gate de 45 / 25 / 80 KB gz |
| `e2e/` + `playwright.config.ts` | Suite Playwright de tres motores; CA-02 se prueba interceptando la petición saliente |

**Patrones establecidos:** Shadow DOM `closed` (R-14), T1 destructivo antes de cualquier encode (A-05/SEC-02), un único sumidero `toBlob` (C-2), render solo con `textContent`/`createElementNS` (SEC-05) y verificación por propiedades (R-12, ahora R-19).

---

## 6. Ideas específicas y elementos diferidos

**Específicas:**

- El compositor es el **reemplazo** del atajo one-shot de la Fase 2, no un añadido lateral.
- La confirmación de máscara es **por sesión**, no por máscara: relaja el «explicit confirm modal» de C-2 sin tocar la irreversibilidad T2.
- Adjuntar es un **camino de primera clase**: PNG + WebP + JPEG, mismo flujo de anotación y revisión, con la ampliación del allowlist del servidor como parte del trabajo.
- i18n sigue el patrón del panel: auto-detección + override manual, diccionarios en el chunk lazy.

**Diferidos:**

- Reglas de redacción configurables por el host (`Redactor` queda como costura sin usar).
- `DomSerializeCapture` opcional (v2, A-08).
- Mask-undo o confirmación por máscara: cualquier retorno es una decisión de privacidad que exige Consultation Request Pack.
- No había TODOs de fase 3 (`todo.match-phase 3` → 0).

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **ANN-0x** | Requisito de anotación (mano alzada, flecha, rectángulo, texto, máscara, undo) |
| **A-0x** | Enmienda del registro de decisiones (`resolution-record.md`) |
| **CA-0x** | Criterio de aceptación del TFG |
| **CAP-0x** | Requisito de captura (adjunto, degradación) |
| **C-2** | Contrato del puerto `Annotator`: un bitmap aplanado, máscaras destructivas, un solo `toBlob` |
| **D-0x** | Decisión global rechazada o registrada |
| **DPR** | Device Pixel Ratio |
| **e2e** | Prueba de extremo a extremo en navegador real |
| **INV-0x** | Invariante arquitectónica |
| **P3-D-xx** | Decisión local de la fase 3 |
| **PRF-0x** | Requisito de rendimiento y tamaño |
| **PRV-0x** | Requisito de privacidad |
| **R-xx** | Decisión del registro global |
| **RNF-0x** | Requisito no funcional |
| **SEC-0x** | Invariante de seguridad |
| **T1/T2/T3** | Redacción automática / máscara manual destructiva / orden de exportación |
| **UAT** | Prueba de aceptación por el usuario |
| **WDG-0x** | Requisito del widget |
