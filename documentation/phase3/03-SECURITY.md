<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 3 — Seguridad: *Report Composer & Annotation Editor (lazy)*

| | |
|---|---|
| **Fase** | 3 — *Report Composer & Annotation Editor (lazy)* |
| **Rama** | `gsd/phase-3-report-composer-annotation-editor-lazy` |
| **Auditado** | 2026-10-28 |
| **Amenazas cerradas** | 29/29 |
| **ASVS** | Nivel 1 |
| **Estado** | `verified` · `threats_open: 0` |

> Este documento consolida y resume `03-SECURITY.md`. Es un resumen ejecutivo, no una copia literal.

---

## 1. Fronteras de confianza

| Frontera | Descripción | Dato que cruza |
|---|---|---|
| Página anfitriona ↔ widget | Shadow root cerrado; compositor/editor/review solo con nodos del propio código | El DOM del host nunca recibe estado del widget; los bytes viven en un `Draft` de módulo |
| SDK ↔ API (`POST /api/incidents`) | Multipart meta + imagen; rate limit por IP y por clave | `project_key` público de solo escritura; bitmap ya redactado; sin credenciales del host |
| Entrada de imagen ↔ ingest | Allowlist de magic bytes → caps SOF → re-encode raíz de sharp | Bytes no confiables; EXIF/GPS eliminados antes de almacenar |
| Lane lazy ↔ loader | `widget/loader.ts` deriva la URL solo de `LOADING_SCRIPT_URL` / `import.meta.url` | Chunk ESM del editor; nunca de `init()`, `data-*` ni `document.baseURI` |
| Primitivas de máscara ↔ sumidero de encode | Escrituras destructivas en `ImageData`; máscaras primero, T1 al final | Los píxeles pre-máscara no existen en ningún buffer que llegue al wire |

---

## 2. Registro de amenazas (29/29 cerradas)

| ID | Categoría | Componente | Severidad | Mitigación | Estado |
|---|---|---|---|---|---|
| **T-03-01** | I/R | Compositor degradado | high | La captura fallida no abre un file dialog ni postea; Review inerte y cero requests antes de elegir | cerrada |
| **T-03-02** | T | `capture/manual-file.ts` | high | Allowlist de magic bytes antes del decode; caps de dimensiones; GIF polyglot rechazado | cerrada |
| **T-03-03** | T | Mapeo ext→MIME | high | Un `CONTENT_TYPE_BY_EXT` + inverso; fila JPEG en el wire | cerrada |
| **T-03-04** | I/T | `annotator/masks.ts` + primitivas | high | Lectura restringida al rect, escritura destructiva, parche post-máscara; CA-02 dentro y anillo a 0 | cerrada |
| **T-03-05** | T | Orden de replay de máscaras | high | `rebakeMasks` tras cada trazo + parches al final de `encodeFinal`; fila de tinta cruzada | cerrada |
| **T-03-06** | T | Rama sin imagen del ingest | high | Solo se saltan las etapas de imagen; validate→sanitise→re-validate y key gate siguen | cerrada |
| **T-03-07** | T | Migración `0001` | high | Solo salida de drizzle-kit, con snapshot y journal, revisada en el checkpoint antes de migrar | cerrada |
| **T-03-08** | I/D | Purga con clave nula | medium | Guarda de clave nula: borra la fila, nunca construye un path desde null | cerrada |
| **T-03-09** | S/I | Blob route deriva `ext` | medium | Un mapa y su inverso; valor desconocido → 500 saneado, nunca un MIME adivinado | cerrada |
| **T-03-10** | T | Payload embebido en JPEG | high | Allowlist + re-encode raíz de sharp como únicos bytes persistidos | cerrada |
| **T-03-11** | D | Decode bomb JPEG | high | Walker SOF antes de cualquier decoder + `MAX_IMAGE_PIXELS`/`MAX_IMAGE_DIM`; 400 sin fila ni blob | cerrada |
| **T-03-12** | I | EXIF/GPS en JPEG | medium | Strip por defecto + `autoOrient`; los bytes servidos no contienen `Exif` | cerrada |
| **T-03-13** | T | Gramática de clave `jpeg` | medium | `STORAGE_KEY_REGEX` con la tercera extensión; `pathFor` mantiene resolve+contain | cerrada |
| **T-03-14** | T | DOM del compositor/review | high | `el()` + `textContent` + `createElementNS`; prefill y razones como texto/valor; grep limpio | cerrada |
| **T-03-15** | I | `Draft` con la captura | medium | Módulo dentro del shadow cerrado, nunca en `window`; solo píxeles post-T1 y parches | cerrada |
| **T-03-16** | I | Persistencia del locale | medium | Estado de sesión en memoria; `sdk-no-host-storage` verde; sonda de cero claves del host | cerrada |
| **T-03-17** | T | Divergencia review/send | high | `encodeFinal` una vez en Review; Send transmite ese blob; fila de un solo POST | cerrada |
| **T-03-18** | D | Adjunto sobredimensionado | medium | Dimensiones al aparecer el bitmap; `bitmap.close()` en todo camino; sin canvas de trabajo | cerrada |
| **T-03-19** | T | Text-only salta validación | medium | El cuerpo meta-only pasa por el mismo pipeline; 201 real; el cliente no añade campos | cerrada |
| **T-03-20** | S/E | URL del chunk | high | Solo `LOADING_SCRIPT_URL` / `import.meta.url`; base irresoluble → promesa rechazada visible | cerrada |
| **T-03-21** | D/R | Fallo de carga del editor | medium | Botón re-habilitado con error+hint; memo limpiado; retry verde en tres motores | cerrada |
| **T-03-22** | I | Segundo stylesheet / global | medium | `EDITOR_CSS` se añade una vez al `<style data-wb-core>`; chunk ESM sin global | cerrada |
| **T-03-23** | T | Pointer→bitmap por viewport | medium | Una sola llamada con `getBoundingClientRect()` + `transformFor`; tinta mal ubicada rompe ANN | cerrada |
| **T-03-24** | I | Undo con estado pre-máscara | high | Máscaras fuera de la pila de undo; no existe snapshot pre-máscara; mask-undo = decisión de privacidad | cerrada |
| **T-03-25** | T | Mapeo pointer→bitmap de máscara | medium | Una autoridad de mapeo; rect comprometido independiente; matriz DPR + anillo de 1 px | cerrada |
| **T-03-26** | T | Diálogo de confirmación | medium | `role="alertdialog"` + focus trap + Escape propio; «Not now» no cierra el editor | cerrada |
| **T-03-27** | R/T | Filas e2e migradas | high | Helper único `completeComposer`, sin borrados ni skips; `--list` guarda el conteo | cerrada |
| **T-03-28** | T | Umbrales de `check-size` | medium | Límites intactos 45/25/80; solo cambia el artefacto medido (máximo de gemelos) | cerrada |
| **T-03-29** | I | Lazy sin prueba de requests | medium | La fila `PRF-02 lazy` cuenta peticiones antes/después del clic; se re-ejecuta en el cierre | cerrada |

**Totales:** 29 amenazas · 29 cerradas · 0 abiertas · 0 aceptadas · 0 transferidas.

---

## 3. Registro de riesgos aceptados

No hay riesgos aceptados. Las 29 entradas del registro tienen disposición `mitigate` y la mitigación está presente y probada por una fila e2e o un gate estático.

| Risk ID | Amenaza | Justificación | Aceptado por | Fecha |
|---|---|---|---|---|
| — | — | No aplica | — | — |

---

## 4. Pista de auditoría de seguridad

| Fecha | Amenazas | Cerradas | Abiertas | Ejecutado por |
|---|---|---|---|---|
| 2026-10-28 | 29 | 29 | 0 | Orquestador (secure-phase L1: registro en plan, `threats_open: 0`, ASVS 1) |

**Evidencia de cierre:** el registro se redactó en tiempo de plan (los siete planes con `<threat_model>` parseable) y cada mitigación se contrastó con la fila e2e o el gate estático nombrado en la columna. La pasada completa de `npm run verify` en `432b24b` quedó verde.

---

## 5. Firma

- [x] Todas las amenazas tienen disposición (`mitigate` / `accept` / `transfer`).
- [x] El registro de riesgos aceptados está documentado; no se necesitó ninguno.
- [x] `threats_open: 0` confirmado.
- [x] `status: verified` en el frontmatter.
- [x] `asvs_level: 1`.

**Aprobación:** verificado el 2026-10-28.

---

## 6. Relación con la revisión de código

La revisión de código (`03-REVIEW.md`) y el registro de seguridad se cruzan en tres puntos:

| Punto de cruce | Seguridad | Revisión |
|---|---|---|
| Máscaras destructivas | T-03-04, T-03-05, T-03-24 | CA-02/PRV-04, ANN-06 |
| Aislamiento y DOM | T-03-14, T-03-15, T-03-22 | CR-01, WDG-02/03/05 |
| Migración y MIME | T-03-03, T-03-07, T-03-13 | CR-02, Pitfall 8 |

Los dos hallazgos informativos que quedaron abiertos por alcance del propietario (`IN-01`, `IN-02`) se cerraron después en la remediación del informe de análisis: `IN-01` con la guarda de Ctrl+Z y `IN-02` con `sinks === 0 → FAIL` y `STRICT = true`.

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **ASVS** | Application Security Verification Standard |
| **CA-0x** | Criterio de aceptación |
| **CSP** | Content Security Policy |
| **DPR** | Device Pixel Ratio |
| **e2e** | Prueba de extremo a extremo |
| **EXIF** | Metadatos de imagen |
| **IN-0x** | Hallazgo informativo de la revisión |
| **P3-D-xx** | Decisión local de la fase 3 |
| **PRV-0x** | Requisito de privacidad |
| **R-xx** | Decisión del registro global |
| **SEC-0x** | Invariante de seguridad |
| **SOF** | Start Of Frame (cabecera de dimensiones JPEG) |
| **STRIDE** | Modelo de amenazas |
| **T-03-xx** | Amenaza del registro de la fase 3 |
| **WDG-0x** | Requisito del widget |
