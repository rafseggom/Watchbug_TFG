<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 3 — Revisión de código: *Report Composer & Annotation Editor (lazy)*

| | |
|---|---|
| **Fase** | 3 — *Report Composer & Annotation Editor (lazy)* |
| **Rama** | `gsd/phase-3-report-composer-annotation-editor-lazy` |
| **Revisado** | 2026-10-28 |
| **Hallazgos** | 12 (1 critical · 2 high + 1 high agrupado · 3 medium · 4 low · 2 info) |
| **Estado** | 10/10 in-scope corregidos; 2 informativos abiertos por alcance, cerrados después en la remediación |

> Este documento consolida y resume `03-REVIEW.md`, `03-REVIEW-FIX.md` y `03-REVIEW-DISPOSITION.md`. Es un resumen ejecutivo, no una copia literal.

---

## 1. Resumen

La arquitectura de seguridad de la fase es sólida en sus líneas principales: las máscaras destructivas fallan cerrado y fuerzan alpha opaco; el ingest del servidor encadena magic bytes → strip de contenedor → guard de dimensiones → re-encode raíz con `limitInputPixels` + `autoOrient` + timeout; y la disciplina de `credentials: 'omit'`, URL solo-path, shadow cerrado y `textContent` se mantiene.

Los defectos se concentran donde la fase introdujo **asincronía en flujos que antes eran síncronos**:

| Familia | Qué pasó |
|---|---|
| `reviewDraft` tras el `await` | No re-valida draft/pantalla: un Discard o una nueva captura durante el encode puede dejar el widget invisible e inerte o revisar un draft degradado |
| Undo del editor | La evicción pasados 20 trazos borraba tinta del canvas y del export |
| Pixelación HiDPI | El suelo de bloque se medía en píxeles lógicos, no en bitmap; en DPR 2 quedaba por debajo del mínimo R-13 |

**Totales:** 12 hallazgos · 10 corregidos · 2 informativos abiertos por alcance · 0 skipped · 0 deferred.

---

## 2. Hallazgos y disposición

| ID | Severidad | Título | Estado |
|---|---|---|---|
| **CR-01** | critical (BLOCKER) | `reviewDraft()` no re-valida draft/pantalla tras el `await` del encode | corregido |
| **HG-01** | high (BLOCKER) | Trazos más allá de `UNDO_LIMIT` se evictan sin aplanar; la tinta más antigua desaparece | corregido |
| **HG-02** | high (BLOCKER) | El suelo de pixelación se mide con la fuente lógica de 15 px; en HiDPI queda bajo R-13 | corregido |
| **WR-01** | medium | Attach/annotate asíncronos mutan el draft sin comprobar identidad/pantalla | corregido |
| **WR-02** | medium | `fitToCaps()` aplica `MIN_EDGE_PX` por eje; adjuntos pequeños se deforman | corregido |
| **WR-03** | medium | Un fallo de encode en Review se reporta como fallo de captura y «Try again» descarta el draft | corregido |
| **LW-01** | low | `putPatch` normaliza alpha in-place sobre el parche fuente | corregido |
| **LW-02** | low | El catch de `bakeRect` convierte una máscara fallida en no-op silencioso | corregido |
| **LW-03** | low | HTTP 408 se clasifica como rechazo permanente en el retry | corregido |
| **LW-04** | low | El gate `sdk-lazy-lane-purity` no ve imports dinámicos con template literal | corregido |
| **IN-01** | info | Ctrl+Z con el diálogo de máscara abierto | abierto por alcance → cerrado en la remediación |
| **IN-02** | info | El gate del sumidero único reporta SKIP si el sumidero desaparece | abierto por alcance → cerrado en la remediación |

---

## 3. Detalle de los hallazgos críticos

### CR-01 — `reviewDraft()` no re-valida draft/pantalla después del `await`

`encodeFinal()` tarda de cientos de milisegundos a segundos y el compositor sigue visible durante la espera: Review, «Atrás» y Escape funcionan. `reviewDraft()` captura `current = draft`, pero tras el `await` asigna `current.encoded` y llama a `showScreen('review')`, que lee el `draft` global del router. Tres interleavings alcanzables:

1. **Discard durante el encode** → `draft = null`; la resolución tardía deja la pantalla en `review` con todas las superficies ocultas y el lanzador deshabilitado hasta recargar.
2. **Nueva captura durante el encode** → el draft B se instala; la resolución tardía revisa B, que no tiene `encoded`, y deja el mismo bloqueo.
3. **Nueva captura degradada** → B tiene `image: null` y `captureNote`; la condición de render pasa y se abre un Review con «No image» que permite enviar solo-texto sin elección explícita, violando P3-D-13.

**Corrección:** guard de generación después del `await` (mismo patrón que `runAnnotate`): `if (draft !== current || screen !== 'composer' || current.image !== imageAtStart) return;`, y asignar `encoded` solo después de la comprobación.

### HG-01 — La evicción de trazos borraba la tinta más antigua

El canvas es estateless entre arrastres: cada commit termina en `redraw()`, que sobrescribe con `base` y reaplica solo `strokes`. `pushStroke` hacía `shift()` al superar 20, pero la tinta evictada solo vivía en el canvas que el siguiente `redraw()` borraba. Al commitear el trazo 21, el trazo 1 desaparecía del canvas y del export.

**Corrección:** al alcanzar el tope, hacer `redraw()`, volcar el canvas completo a `base.data` y vaciar `strokes`; la tinta ya está fundida en la única fuente de redibujo. El límite de 20 sigue acotando el historial de undo, no la tinta.

### HG-02 — El suelo de pixelación no se escalaba con el bitmap

`capHeightPx` medía la fuente lógica de 15 px y devolvía ~10–11 px, así que el bloque quedaba en ~22 px de bitmap. En una captura DPR 2, el texto de la página tiene ~20–21 px de altura de mayúscula y R-13 exige bloques de ~40–42 px: el bloque de 22 px podía dejar formas reconocibles.

**Corrección:** `bitmapPerCssPx` viaja en el `Draft` y en `AnnotatorOpenOptions`; `bakeRect` multiplica la altura medida por ese factor antes de `blockSizeFor`. El oráculo e2e (`measureBlockSize`) usa la misma escala de forma independiente.

---

## 4. Detalle de los hallazgos warning

| ID | Qué pasaba | Corrección aplicada |
|---|---|---|
| **WR-01** | El attach asíncrono no comprobaba identidad de draft; podía reescribir un draft nuevo, re-mostrar el compositor bajo Review y dejar Send muerto con una `PipelineInvariantError` no capturada | Guard `open && draft === target && target.image === imageAtStart`; `onDraftMutated` re-renderiza solo la pantalla activa; `attach/annotate/review` deshabilitados durante la lane; `onSend` captura el throw y lo lleva al estado fallido |
| **WR-02** | `fitToCaps` aplicaba `MIN_EDGE_PX` por eje y deformaba adjuntos pequeños (20×400 → 32×400) | El suelo se aplica como segunda pasada que preserva el aspecto; un 10×10 se queda en 10×10 |
| **WR-03** | Un fallo de `encodeFinal` mostraba «Couldn't capture the screen» y «Try again» reiniciaba el gesto, perdiendo título, nota y anotaciones | Nuevo `StatusFailure: 'compose'` con copy propio; el retry vuelve al compositor con el draft intacto |

---

## 5. Hallazgos informativos abiertos

| ID | Hallazgo | Decisión original | Cierre posterior |
|---|---|---|---|
| **IN-01** | Ctrl/Cmd+Z ejecuta `undoStroke()` con el `alertdialog` de máscara abierto | Abierto por alcance del propietario; el puntero ya está bloqueado y las máscaras no están en el undo | Cerrado en la remediación del informe con `if (maskDialog.isOpen()) return;` |
| **IN-02** | `sdk-single-encode-sink` devuelve SKIP si `sinks === 0`, y `STRICT = false` hace que un SKIP no cuente como fallo | Abierto por alcance; el sumidero existe y el gate pasa | Cerrado en la remediación: `sinks === 0` → FAIL y `STRICT = true` |

---

## 6. Puertas tras la corrección

| Comprobación | Resultado |
|---|---|
| `npm run lint` | ✅ |
| `npm run build` | ✅ |
| `npm run check:size` | ✅ core 16.9 / 45 · lazy 6.6 / 25 · runtime 23.8 / 80 KB gz |
| `node scripts/gate.mjs` | ✅ 5/5 |
| `npm run verify` | ✅ 453/453 en chromium + firefox + webkit |
| Revisión manual | CR-01, HG-01, HG-02, WR-01 y WR-03 marcados «requires human verification»: el suite no puede probar un interleaving ni un trazo 21 sin una caminata manual |

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **BLOCKER** | Hallazgo critical/high que impide el envío |
| **CR-xx** | Hallazgo crítico de la revisión |
| **DPR** | Device Pixel Ratio |
| **e2e** | Prueba de extremo a extremo |
| **HG-xx** | Hallazgo high de la revisión |
| **IN-xx** | Hallazgo informativo |
| **LW-xx** | Hallazgo low de la revisión |
| **P3-D-xx** | Decisión local de la fase 3 |
| **PRV-0x** | Requisito de privacidad |
| **R-13** | Regla de máscara no reconstruible (relleno opaco por defecto; pixelación opt-in) |
| **R-19** | Taxonomía de seis tipos de verificación |
| **WR-xx** | Hallazgo warning de la revisión |
