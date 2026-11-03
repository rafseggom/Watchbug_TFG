<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 3 — Resumen de ejecución: *Report Composer & Annotation Editor (lazy)*

| | |
|---|---|
| **Fase** | 3 — *Report Composer & Annotation Editor (lazy)* |
| **Rama** | `gsd/phase-3-report-composer-annotation-editor-lazy` (PR contra `develop`) |
| **Ejecutada** | 2026-10-28 → 2026-11-03 |
| **Olas** | 6 olas · 8 planes completos |
| **Commits de plan** | 42 task commits + 1 commit de cierre (medidos en los ocho SUMMARY) |
| **Suite final** | 280/282 e2e (2 skips de la fila WebKit-only) · 65 unit · 65 integration · 26 contract · 18 packaging · 2 VRT |
| **Estado** | Cerrada; PR abierta para merge manual |

> Este documento consolida y resume los ocho `03-0k-SUMMARY.md` y el `03-UAT.md` de cierre. Es un resumen ejecutivo, no una copia literal.

---

## 1. Qué se construyó

La fase entrega el flujo completo de reporte: el lanzador captura, el compositor muestra la imagen y el formulario, el editor se descarga solo al pulsar «Anotar», las máscaras destruyen píxeles antes de codificar, la revisión muestra el artefacto exacto y el envío llega al ingest con o sin imagen. El widget entero habla inglés y español.

### Ola 1 — `03-01` · Ingest sin captura (3 commits)

| Área | Entregado |
|---|---|
| Esquema | Migración `0001_messy_unicorn.sql`: `storage_key`/`content_type` nullable y CHECK con `image/jpeg` |
| Ruta | Rama meta-only que salta las etapas de imagen; `CONTENT_TYPE_BY_EXT` + inverso; 404 del blob |
| Purga y panel | Guarda de clave nula; `contentType: string \| null`; detalle sin `<img>` para filas sin captura |
| Pruebas | Filas CAP-03 meta-only, concurrente, 404 y panel; ocho llamadas existentes fijadas con `bytes: png` |

### Ola 1 — `03-03` · Compositor, revisión e i18n (3 commits)

| Área | Entregado |
|---|---|
| Pipeline | `CaptureOutcome`, `runCaptureStage`, `Draft`, `encodeFinal` en la entrada de Review |
| Superficies | `composer.ts` (overlay, título, tipo, nota, zona de imagen) y `review.ts` (artefacto exacto) |
| i18n | `stringsEs`, `detectLocale`, `setLocale`, `lang` en el widget y copy de core EN/ES |
| Pruebas | PRV-07, P3-D-02/03/04, contador de nota y WDG-06 en sus tres formas |

**Nota de ejecución:** 41 filas de la Fase 2 quedaron en rojo interino al desaparecer el envío one-shot; se migraron en 03-07, no se borraron.

### Ola 2 — `03-02` · Carril JPEG del servidor (3 commits)

| Área | Entregado |
|---|---|
| Contrato | `ImageExt = 'png' \| 'webp' \| 'jpeg'`; `STORAGE_KEY_REGEX` y allowlist ampliados |
| Ingest | Sniff `ff d8 ff`; walker SOF; `structure.ts` con rama JPEG de paso; `autoOrient` + `jpeg({ quality: 80 })` |
| Fixtures | JPEG 64×64, JPEG 64 MP sintético y JPEG 80×40 con EXIF Orientation = 6 |
| Pruebas | JPEG round-trip, decode-bomb, truncación, borde, allowlist y orientación; 69/69 en tres motores |

### Ola 2 — `03-04` · Adjunto y compositor degradado (3 commits)

| Área | Entregado |
|---|---|
| Adjunto | `ManualFileCapture`, `sniffClientImage` (PNG/WebP/JPEG), caps y cierre del bitmap |
| Degradación | `captureNote: denied \| blank \| oversize \| no-api`; aviso, «Adjuntar imagen» y «Continuar solo con texto» |
| Text-only | `SendPayload.blob: Blob \| null`; cuerpo sin parte `image`; 201 real |
| Pruebas | Adjunto PNG/WebP/JPEG, rechazo de no-imagen y oversize, CAP-03 y no-API; seis filas de fallo re-apuntadas |

### Ola 3 — `03-05` · Editor lazy (4 commits)

| Área | Entregado |
|---|---|
| Carga | `loader.ts` con un `import()` no analizable desde la URL del propio bundle; memo + `?retry=` |
| Editor | `canvas-layer.ts`, `tools.ts`, `editor-dom.ts`; mano alzada, flecha, rectángulo y texto |
| Undo | Pila de 20 trazos; el aplanado vuelca la tinta al bitmap del draft |
| i18n y gates | `strings.editor.ts`; `sdk-lazy-lane-purity`; `check-size` mide el máximo de los gemelos |
| Pruebas | ANN-01…04, ANN-06, PRF-02 lazy y WDG-06 editor; 24/24 × 3 motores en la familia ANN |

### Ola 4 — `03-06` · Máscaras destructivas y CA-02 (3 commits)

| Área | Entregado |
|---|---|
| Bake | `bakeMask` destruye el rect en canvas y en el buffer compartido; devuelve solo el parche post-máscara |
| Replay | `rebakeMasks` tras cada trazo; parches al final de `encodeFinal` (T3) |
| UX | Confirmación una vez por sesión (`alertdialog` con foco y Escape), toggle Relleno/Pixelar |
| Pruebas | CA-02, tinta posterior, undo, pixelación y matriz DPR 1/1.25/2/3; 13/13 × 3 motores |

### Ola 5 — `03-07` · Migración de suite y presupuestos (9 commits)

| Área | Entregado |
|---|---|
| Helper | `completeComposer()` en su forma final, sin aserciones propias |
| Migración | 41 filas one-shot al compositor, sin borrar ni saltar ninguna |
| Gates | Cinco reglas estáticas; `check-size` con máximo de gemelos y suelo de 2 KB |
| Pruebas | 453/453 en tres motores; core 16.9, lazy 6.6, runtime 23.8 KB gz |

### Ola 6 — `03-08` · Taxonomía de seis tipos (14 + 1 commits)

| Área | Entregado |
|---|---|
| Taxonomía | R-19: unit, integration, contract, VRT, packaging y e2e; tope estructural de 20 journeys |
| Infra | `vitest.config.ts`, `tests/unit`, `tests/integration`, `tests/contract`, `tests/vrt`, `tests/packaging` |
| Ledger | `03-08-CONVERSION-LEDGER.md`: 152 declaraciones clasificadas (57 convertidas, 1 redundante justificada, 90 conservadas) |
| Pruebas | 59 unit + 65 integration + 26 contract + 18 packaging + 2 VRT; 279 e2e en tres motores |
| Política | R-19 en `resolution-record.md`, `AGENTS.md`, ROADMAP y REQUIREMENTS |

---

## 2. Resultados de verificación (finales)

La tabla siguiente usa la ejecución **posterior a la remediación del informe de análisis** (misma rama). Los números de cierre de la fase se conservan entre paréntesis cuando difieren.

| Comprobación | Resultado |
|---|---|
| `npm run lint` | 4 workspaces sin errores |
| `node scripts/gate.mjs` | 5/5 PASS, 0 SKIP |
| `npm run test:unit` | 65/65 (59 al cierre de 03-08) |
| `npm run test:integration` | 65/65 |
| `npm run test:contract` | 26/26 |
| `npm run test:packaging` | 18/18 + `check:size` + `check:compose` |
| `npm run test:vrt` | 2/2 |
| `npm run verify` | 280/282 (2 skips de la fila WebKit-only); por motor: chromium 93+1, firefox 93+1, webkit 94 |
| `check:size` | core 17.8 / 45 · lazy 6.9 / 25 · adapter 0.3 / 14 · runtime 25.0 / 80 KB gz |
| `check:compose` | exactamente `db`, `api`, `panel`; volumen de adjuntos solo en `api` |

---

## 3. Desviaciones por ola

| Ola | Desviación | Resolución |
|---|---|---|
| **03-03** | 41 filas de Fase 2 en rojo interino al retirar el envío one-shot | Se migraron en 03-07; ninguna se borró ni se saltó |
| **03-03** | `putPatch` necesitaba normalización de alpha y validación fail-closed | Auto-corregido en el commit del tracer |
| **03-04** | Seis filas de fallo cambiaron de superficie (panel → compositor) | Re-apuntadas en el mismo plan; significado intacto |
| **03-05** | El memo del loader no bastaba: los motores cachean un `import()` fallido | Retry con `?retry=N` solo tras fallo; camino feliz con una sola petición |
| **03-05** | La etiqueta inline se abría en `pointerdown` y el mousedown la desenfocaba | Anclaje en `click`, con `stopPropagation` de Enter/Escape |
| **03-06** | Firefox/WebKit truncan coordenadas fraccionarias de `page.mouse` | Dispatch en píxeles CSS enteros + rect comprometido calculado por el helper |
| **03-07** | Las seis filas de fallo ya estaban re-apuntadas por 03-04 | La ola solo verificó que siguieran verdes |
| **03-08** | La clasificación del ledger es juicio, no mecánica | Lotes de ≤10 ficheros con confirmación y auditoría final 152/152 |

---

## 4. Decisiones clave registradas

- **T3:** `encodeFinal` replica los parches de máscara y después re-aplica T1 como última escritura antes de `encodeLadder`. Ambas pasadas son relleno opaco, así que la re-ejecución es idempotente.
- **Review = artefacto:** la codificación ocurre al entrar en Review, no al enviar; el botón «Enviar» solo transporta el blob exacto.
- **Un solo buffer:** el editor recibe el `ImageData` del draft y lo devuelve mutado; no existe copia pre-máscara en ningún momento.
- **Confirmación por sesión:** la primera máscara muestra el aviso; las siguientes se hornean al soltar. La irreversibilidad T2 no cambia.
- **i18n:** core lleva launcher/status/composer/review/mask-confirm en ambos idiomas; el chunk lazy solo lleva `editor.*`.
- **Adjunto sin fallback automático:** el usuario elige entre capturar, adjuntar o seguir solo con texto; nunca se abre un selector por sorpresa.
- **R-19:** la suite se reorganiza por tipo, no por framework; CA-02/PRV siguen en e2e porque el artefacto codificado es la evidencia.

---

## 5. Cumplimiento de la puerta TDD

La fase siguió el bucle **tracer → verificación → expansión** de GSD, no un TDD clásico de test-first por función:

- Cada plan abrió con un tracer end-to-end que se verificó en rojo→verde antes de expandir tareas.
- Los ocho SUMMARY cierran con `Self-Check: PASSED` y los commits de tarea son atómicos.
- 03-08 añadió el ledger de conversión para que ninguna aserción e2e desapareciera sin disposición: 57 convertidas, 1 redundante justificada, 90 conservadas.
- Las pruebas de seguridad (CA-02/PRV) se mantuvieron en e2e y se validaron sobre los bytes codificados, no sobre una función aislada.

---

## 6. Elementos diferidos (no defectos de esta fase)

No existe `deferred-items.md` en el directorio de la fase; el plan 03-08 declara `requirements: []` porque no añade un REQ nuevo. Los elementos que sí quedan fuera:

| Elemento | Destino |
|---|---|
| Reglas de redacción configurables por el host | v2; el `Redactor` queda como costura sin usar |
| `DomSerializeCapture` opcional | v2 (A-08) |
| Mask-undo o confirmación por máscara | Decisión de privacidad; requiere Consultation Request Pack |
| S-1: autenticación de lectura | Fase 5 (`AuthProvider`); la instancia sigue en loopback |
| S-8: teardown de filas/blobs e2e en local | CI limpia con `docker compose down -v`; local queda pendiente |
| L-1: `stopthatslop` en CI | Decisión de proceso abierta |

---

## 7. Autocomprobación

Los ocho SUMMARY registran `## Self-Check: PASSED`. La fase se cerró con UAT **7/7** y la verificación de fase **74/74** must-haves, 0 regresiones y 0 overrides. La revisión de código dejó **10/10 hallazgos in-scope corregidos** y **2 informativos abiertos por alcance del propietario** (`IN-01`, `IN-02`), ambos cerrados después por la remediación del informe de análisis (S-10 y S-4.1).

---

## 8. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **ANN-0x** | Requisito de anotación |
| **CA-0x** | Criterio de aceptación |
| **CAP-0x** | Requisito de captura |
| **C-2** | Contrato del `Annotator`: bitmap único, máscaras destructivas, un `toBlob` |
| **DPR** | Device Pixel Ratio |
| **e2e** | Prueba de extremo a extremo |
| **EXIF** | Metadatos de imagen (orientación, GPS, cámara) |
| **IN-0x** | Hallazgo informativo de la revisión |
| **P3-D-xx** | Decisión local de la fase 3 |
| **PRF-0x** | Requisito de rendimiento y tamaño |
| **PRV-0x** | Requisito de privacidad |
| **R-xx** | Decisión del registro global |
| **RNF-0x** | Requisito no funcional |
| **SEC-0x** | Invariante de seguridad |
| **T1/T2/T3** | Redacción automática / máscara manual / orden de exportación |
| **UAT** | Prueba de aceptación por el usuario |
| **VRT** | Visual Regression Testing |
| **WDG-0x** | Requisito del widget |
