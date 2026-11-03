<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 3 — Plan: *Report Composer & Annotation Editor (lazy)*

| | |
|---|---|
| **Fase** | 3 — *Report Composer & Annotation Editor (lazy)* |
| **Rama** | `gsd/phase-3-report-composer-annotation-editor-lazy` (PR contra `develop`) |
| **Planificado** | 2026-10-28 |
| **Olas** | 6 olas · 8 planes (`03-01`…`03-08`) |
| **Estado** | 8/8 planes ejecutados (ver `03-SUMMARY.md`) |

> Este documento consolida y resume los ocho `03-0k-PLAN.md`. Es un resumen ejecutivo, no una copia literal.

---

## 1. Objetivo de la fase

**Como** usuario final de una aplicación web, **quiero** componer un informe completo — capturar o adjuntar una imagen, anotarla, enmascarar de forma destructiva lo sensible, revisarla y enviarla — con el editor descargado bajo gesto y toda la interfaz en inglés o español, **para que** el desarrollador reciba un informe reproducible y ni el informe ni su captura abandonen su infraestructura.

La forma de aceptación es la del ROADMAP: cinco criterios de éxito, trece requisitos y el contrato C-2 no negociable (un bitmap aplanado, máscaras destructivas, un único sumidero `toBlob`, orden T3). El plan no reabre esas decisiones; las convierte en pantallas, gestos y pruebas.

---

## 2. Las 6 olas

| Ola | Planes | Entrega | Dependencia |
|---|---|---|---|
| **1** | `03-01`, `03-03` | Servidor capaz de guardar un informe sin captura + compositor, revisión y i18n de core | — |
| **2** | `03-02`, `03-04` | Carril JPEG en servidor + adjunto de imagen y compositor degradado en cliente | Ola 1 |
| **3** | `03-05` | Editor de anotación lazy: mano alzada, flecha, rectángulo, texto y undo | Ola 2 |
| **4** | `03-06` | Máscaras destructivas T2/T3, confirmación por sesión, pixelación opt-in y CA-02 | Ola 3 |
| **5** | `03-07` | Migración de ~30 filas e2e al compositor + cierre de presupuestos PRF-02/PRF-03 | Ola 4 |
| **6** | `03-08` | Refactor de la suite a seis tipos de verificación y enmienda R-19 | Ola 5 |

**Orden risk-first decidido:** primero el contrato del servidor y el armazón del compositor; después el carril JPEG (superficie de seguridad); luego editor, máscaras y CA-02; al final la contabilidad de la suite. El orden evita construir la UI sobre un ingest que todavía rechaza el caso sin captura.

---

## 3. Detalle por ola

### Ola 1 — `03-01` · Ingest sin captura y migración única

**Objetivo:** que un informe **sin imagen** sea almacenable y legible, y que el CHECK de `content_type` admita `image/jpeg` en una sola migración revisable.

**Tareas:**

1. Checkpoint bloqueante: aprobar el contenido de `0001` (nullable + `image/jpeg`) antes de generarla.
2. Tracer meta-only → fila listable: `storage_key`/`content_type` nullable, rama sin `image`, `CONTENT_TYPE_BY_EXT`/`EXT_BY_CONTENT_TYPE`, 404 del blob, guarda de purga, tolerancia del panel.
3. Concurrencia y límites: par idempotente meta-only, 404 JSON, panel sin `<img>`, 401 sin `X-Project-Key`.

**Entregable clave:** una migración `0001_*.sql` con `DROP NOT NULL` y el CHECK `('image/webp','image/png','image/jpeg')`, y un POST meta-only que devuelve 201.

### Ola 1 — `03-03` · Compositor, revisión y i18n de core

**Objetivo:** la superficie de composición real: captura → formulario → revisión → envío, con un solo encode y copy EN/ES.

**Tareas:**

1. Tracer `capture → composer → review → send` con `encodeFinal` en la entrada de Review.
2. Semántica del formulario: título editable con clamp por code points, toggle bug/feedback, nota, descartar y reentrada.
3. i18n de core: locale auto-detectado, override manual y `lang` en el widget.

**Entregable clave:** `Draft` con `t1`, `masks`, `encoded` y `captureNote`; `composer.ts` y `review.ts`; `stringsEs`; router de pantallas.

### Ola 2 — `03-02` · Carril JPEG del servidor

**Objetivo:** aceptar, normalizar y servir JPEG sin debilitar la cadena PNG/WebP.

**Tareas:**

1. Tracer JPEG → almacenamiento → respuesta con `image/jpeg`.
2. Límites de decode-bomb y truncación: SOF antes de cualquier decoder.
3. Orientación EXIF aplicada por `autoOrient` y metadatos eliminados.

**Entregable clave:** `ImageExt` con `jpeg`, `readJpegDimensions`, allowlist de `ff d8 ff`, rama `pipeline.jpeg({ quality: 80 })` y fixtures JPEG/oversize/rotada.

### Ola 2 — `03-04` · Adjunto y compositor degradado

**Objetivo:** las dos salidas de la fase: adjuntar una imagen y presentar un fallo de captura con dos acciones reales.

**Tareas:**

1. Tracer adjuntar PNG → preview → revisión → wire.
2. Puerta de adjunto: PNG/WebP/JPEG; todo lo demás se rechaza antes del decode.
3. Compositor degradado: aviso, «Adjuntar imagen», «Continuar solo con texto»; el texto-only llega a un 201 real.

**Entregable clave:** `ManualFileCapture`, `sniffClientImage`, `CaptureRequest.file`, `captureNote` y el estado `text-only`.

### Ola 3 — `03-05` · Editor de anotación lazy

**Objetivo:** el marco del editor y sus herramientas de dibujo, descargados solo al pulsar «Anotar».

**Tareas:**

1. Tracer `Annotate image → chunk → trazo → Done → tinta en el wire`.
2. Flecha, rectángulo y texto sobre la misma autoridad de geometría.
3. Undo, i18n del editor y gates de lazy/size.

**Entregable clave:** `loader.ts`, `canvas-layer.ts`, `tools.ts`, `editor-dom.ts`, `strings.editor.ts` y `UNDO_LIMIT = 20`.

### Ola 4 — `03-06` · Máscaras destructivas y CA-02

**Objetivo:** la máscara del usuario y la prueba de que la región desaparece de los bytes codificados, incluido su anillo de 1 px.

**Tareas:**

1. Tracer enmascarar → enviar → cero píxeles originales dentro y en el anillo.
2. Confirmación una vez por sesión y modo pixelar opt-in.
3. La tinta posterior no resucita la máscara; las máscaras sobreviven al undo; geometría a DPR 1/1.25/2/3.

**Entregable clave:** `bakeMask`, `rebakeMasks`, `solidFillRegion`, `pixelateRegion`, `snapOutward` y el replay de parches al final de `encodeFinal`.

### Ola 5 — `03-07` · Migración de filas y presupuestos

**Objetivo:** migrar las ~30 filas que asumían el envío one-shot al compositor, sin borrar aserciones, y cerrar PRF-02/PRF-03 con los chunks reales.

**Tareas:**

1. Tracer de una familia de redacción migrada con el helper compartido.
2. Migrar el resto de familias, incluidas las filas de fallo que cambian de superficie.
3. Cierre de presupuesto: números reales, cinco gates, suite completa en tres motores.

**Entregable clave:** `completeComposer()`, filas re-apuntadas al compositor degradado y `check-size` midiendo el máximo de los gemelos lazy.

### Ola 6 — `03-08` · Refactor de la suite a seis tipos

**Objetivo:** pasar de 152 tests e2e / 876 aserciones a ≤20 journeys críticos y re-alojar el resto en unit/integration/contract/VRT/packaging.

**Tareas:**

1. Fundación: Vitest, documento de taxonomía, enmienda R-19 y una conversión tracer.
2. Reducir los specs no-widget (hostile, ingest, deploy, read-surface) a sus journeys.
3. Reducir `sdk.spec.ts` a J-01…J-14.
4. Levantar VRT, contract y packaging con un ejemplo real cada uno.
5. Verificación y convergencia: gate completo, auditoría del ledger y consistencia documental.

**Entregable clave:** `03-08-CONVERSION-LEDGER.md`, `vitest.config.ts`, `tests/*` y R-19 en `resolution-record.md`, `AGENTS.md`, ROADMAP y REQUIREMENTS.

---

## 4. Modelo de amenazas (STRIDE, resumen)

Los ocho planes comparten el mismo registro; se agrupan por tema para que un lector vea qué amenaza movió cada control.

| Tema | Amenazas | Mitigación |
|---|---|---|
| **Ingest sin captura** | T-03-06 (rama sin imagen), T-03-07 (migración), T-03-08 (purga con clave nula), T-03-09 (MIME derivado) | La rama meta-only solo salta las etapas de imagen; Zod/sanitize/key/idempotencia siguen; migración generada y revisada; guarda de clave nula; un mapa y su inverso |
| **JPEG** | T-03-03 (MIME), T-03-10 (polyglot/trailing), T-03-11 (decode bomb), T-03-12 (EXIF/GPS), T-03-13 (clave de storage) | Un `Record<ImageExt,string>`; allowlist + re-encode raíz; SOF antes del decoder + `limitInputPixels` + timeout; `autoOrient` + strip; regex de clave con `jpeg` |
| **Compositor** | T-03-14 (DOM), T-03-15 (draft), T-03-16 (locale), T-03-17 (review/send) | `textContent`/`createElementNS`; draft en módulo cerrado; estado de sesión; `encodeFinal` una vez en Review y envío del blob exacto |
| **Adjunto y degradación** | T-03-01 (degradado), T-03-02 (decode), T-03-18 (memoria), T-03-19 (text-only) | Dos acciones explícitas y cero POST; allowlist + caps + cierre del bitmap; dimensiones antes del canvas; meta-only pasa por el mismo pipeline |
| **Editor lazy** | T-03-20 (URL del chunk), T-03-21 (fallo de carga), T-03-22 (segundo stylesheet), T-03-23 (mapeo pointer→bitmap) | URL del propio bundle; botón re-habilitado con error; CSS al `<style data-wb-core>`; una sola autoridad de mapeo |
| **Máscaras** | T-03-04 (bake/replay), T-03-05 (orden), T-03-24 (undo), T-03-25 (geometría), T-03-26 (diálogo) | Píxeles destruidos, parche post-máscara; `rebakeMasks` tras cada trazo; máscaras fuera del undo; matriz DPR + anillo; alertdialog con foco y Escape propios |
| **Suite** | T-03-27 (filas migradas), T-03-28 (umbrales), T-03-29 (lazy sin prueba), T-03-30 (sobre-borrado), T-03-31 (tests vacíos), T-03-32 (CA-02 degradado), T-03-33 (journey 21), T-03-34 (docs contradictorios) | Helper único sin borrar aserciones; límites intactos; fila de conteo de requests; ledger 152/152; importar producción; CA-02 sigue e2e; tope estructural; grep de absolutos |
| **Cadena de suministro** | T-03-SC | Cero dependencias nuevas salvo `vitest` (dev) y pines ya existentes |

---

## 5. Verificación y criterios de éxito

| Nivel | Cómo se prueba |
|---|---|
| **Producto** | Playwright sobre tres motores: compositor, editor, máscaras, adjunto, degradado, i18n y revisión |
| **CA-02/PRV** | Interceptar la petición saliente, decodificar la imagen y comprobar que los píxeles originales no están en la región ni en su anillo |
| **Servidor** | Ingest con filas de 201/400/401/404/413, idempotencia, purga y MIME |
| **Presupuesto** | `check:size` contra los chunks reales: core ≤ 45, lazy ≤ 25, runtime ≤ 80 KB gz |
| **Contrato** | Zod y `schema/report.schema.json` sin deriva |
| **Verificación** | R-19: unit, integration, contract, VRT, packaging y e2e; e2e ≤ 20 journeys |

**Criterios de éxito del ROADMAP:** captura fallida visible con envío solo-texto; adjunto desde dispositivo; mano alzada/flechas/rectángulos/texto; máscara opaca irreversible incluso tras tinta posterior y undo solo de trazos; revisión/edición previa, EN/ES completo y presupuestos de chunk y runtime.

---

## 6. Supuestos señalados (del plan)

- **`03-01`:** el ingest no toleraba un informe sin imagen; el caso se trata como trabajo de primera clase, no como parche cliente. La migración `0001` mezcla dos concerns porque ambos son widening-only.
- **`03-02`:** no hay walker estructural de JPEG; el control es allowlist + SOF + re-encode raíz. El SDK nunca envía JPEG: las filas JPEG son HTTP directo.
- **`03-03`:** los diccionarios de core llevan launcher/status/composer/review/mask-confirm; el chunk lazy solo lleva `editor.*`, porque el compositor debe localizarse antes de que exista el chunk.
- **`03-04`:** el adjunto no hace fallback automático al selector; el usuario elige. La comprobación de dimensiones es sobre el bitmap decodificado, no sobre la cabecera (el servidor sigue siendo el control de registro).
- **`03-05`:** carga bajo demanda en el clic de «Anotar»; el chunk es el gemelo `.mjs`; el `.js` se emite y se mide el máximo.
- **`03-06`:** el bake escribe en el mismo buffer que el editor redibuja; no existe copia pre-máscara. La prueba de pixelación es mecánica (bloques uniformes, alpha 255, colores distintos ≤ bloques).
- **`03-07`:** la migración es un plan único; las filas de fallo cambian de superficie, no de significado.
- **`03-08`:** `requirements: []` es deliberado (no hay REQ nuevo); J-15…J-20 quedan reservados; R-12 se enmienda, no se borra; la clasificación del ledger es trabajo de juicio revisado por el propietario.

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **ANN-0x** | Requisito de anotación |
| **A-0x** | Enmienda del registro de decisiones |
| **CA-0x** | Criterio de aceptación |
| **CAP-0x** | Requisito de captura |
| **C-2** | Contrato del `Annotator`: bitmap único, máscaras destructivas, un `toBlob` |
| **DPR** | Device Pixel Ratio |
| **e2e** | Prueba de extremo a extremo |
| **EXIF** | Metadatos de imagen (orientación, GPS, cámara) |
| **JPEG** | Formato de imagen con compresión lossy |
| **P3-D-xx** | Decisión local de la fase 3 |
| **PRF-0x** | Requisito de rendimiento y tamaño |
| **PRV-0x** | Requisito de privacidad |
| **R-xx** | Decisión del registro global |
| **RNF-0x** | Requisito no funcional |
| **SEC-0x** | Invariante de seguridad |
| **SOF** | Start Of Frame (cabecera de dimensiones JPEG) |
| **STRIDE** | Modelo de amenazas (Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation) |
| **T1/T2/T3** | Redacción automática / máscara manual / orden de exportación |
| **UAT** | Prueba de aceptación por el usuario |
| **WDG-0x** | Requisito del widget |
