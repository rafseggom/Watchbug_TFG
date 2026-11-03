<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 3 — Verificación: *Report Composer & Annotation Editor (lazy)*

| | |
|---|---|
| **Fase** | 3 — *Report Composer & Annotation Editor (lazy)* |
| **Rama** | `gsd/phase-3-report-composer-annotation-editor-lazy` |
| **Verificado** | 2026-11-03 (re-verificación tras UAT) |
| **Verdades** | 74/74 |
| **Suite de cierre** | 453/453 e2e en tres motores · 59 unit · 65 integration · 26 contract · 18 packaging · 2 VRT |
| **Estado** | `passed` · `nyquist_compliant: true` |

> Este documento consolida y resume `03-VERIFICATION.md`, `03-VALIDATION.md`, `COVERAGE.md` y `03-UAT.md`. Es un resumen ejecutivo, no una copia literal.

---

## 1. Objetivo de la fase y método

La fase se verifica con el patrón de **verdades observables**: cada criterio de éxito del ROADMAP se descompone en afirmaciones que pueden fallar por la razón correcta. El método combina:

- **e2e de artefacto** en tres motores para todo lo que necesita navegador real: shadow DOM, canvas, captura, CSS hostil y bytes codificados.
- **Ingest directo** en la API real para JPEG, límites, idempotencia, purga y MIME.
- **Gates estáticos** para el sumidero único, el aislamiento, las dependencias y el tamaño.
- **UAT humano** para los interleavings y las propiedades visuales que un test no puede provocar de forma fiable.

La re-verificación de 2026-11-03 sustituye al informe previo (`human_needed`, 66/68) después de ejecutar los siete items de UAT y de confirmar que CR-01, HG-01 y HG-02 están implementados, no solo supuestos.

---

## 2. Verdades observables (74/74)

| Ola | Verdades | Estado |
|---|---|---|
| **03-01** | Migración única, nullable, CHECK JPEG, meta-only 201, 404 del blob, purga y panel tolerantes | 12/12 |
| **03-02** | JPEG 201, MIME correcto, decode-bomb antes de sharp, truncación, EXIF orientado y metadatos fuera | 10/10 |
| **03-03** | Captura→compositor→review→send, título/tipo/nota, i18n de core, `lang` correcto | 13/13 |
| **03-04** | Adjunto PNG/WebP/JPEG, rechazo no-imagen, degradado con dos salidas, texto-only 201 | 12/12 |
| **03-05** | Chunk lazy, cinco herramientas, undo, editor i18n, pureza de lane y suelo de tamaño | 11/11 |
| **03-06** | CA-02 dentro y anillo, tinta posterior, undo de trazos, pixelación opt-in, DPR 1/1.25/2/3 | 10/10 |
| **03-07** | 41 filas migradas sin borrar, presupuestos PRF-02/03, cinco gates | 6/6 |
| **03-08** | Taxonomía de seis tipos, tope de journeys, ledger 152/152, R-19 en documentos | 6/6 |

**Score:** 74/74 verdades verificadas; 0 overrides; 0 present-behavior-unverified.

### Criterios de éxito del ROADMAP

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Fallo de captura visible y envío solo-texto; nunca captura en blanco silenciosa | ✅ | Compositor degradado con dos acciones y cero POST antes de elegir; 201 meta-only real |
| 2 | Adjuntar una imagen del dispositivo | ✅ | PNG/WebP/JPEG aceptados; no-imagen y oversize rechazados antes del canvas |
| 3 | Mano alzada, flechas, rectángulos y etiquetas | ✅ | ANN-01…04 sobre bytes decodificados |
| 4 | Máscara opaca irreversible, incluso tras tinta posterior; undo solo de trazos | ✅ | CA-02 dentro + anillo, tinta cruzada, undo de máscara imposible |
| 5 | Revisión/edición previa, EN/ES, lazy ≤ 25 KB, runtime ≤ 80 KB | ✅ | Review = artefacto; i18n completo; `check:size` verde |

---

## 3. Prohibiciones (must-NOTs)

| Prohibición | Cómo se verifica |
|---|---|
| No crear un `Blob` antes de la redacción | `encodeLadder` es el único productor; el editor devuelve `ImageData` |
| No usar CSS overlay, blur ni relleno semitransparente como máscara | Primitivas destructivas con alpha 255; revisión de fuente y gate |
| No guardar una copia pre-máscara para undo | Las máscaras no entran en la pila; el parche solo contiene píxeles destruidos |
| No cargar el editor con un `import()` literal | Gate `sdk-lazy-lane-purity`; una sola costura type-only |
| No exponer un segundo global ni parchear prototipos | Snapshot de superficie; WDG-04 |
| No renderizar HTML del servidor | `textContent`/`createElementNS`; gate `sdk-no-html-sink` |
| No aflojar los tiers 45/25/80 | `check:size` con los mismos límites; solo cambia el artefacto medido |
| No borrar ni saltar filas e2e | Ledger 152/152; cero `skip`/`fixme`/`todo` |

---

## 4. Cobertura de requisitos (13/13)

| ID | Requisito | Evidencia |
|---|---|---|
| **CAP-02** | Adjuntar imagen del dispositivo | Adjunto PNG/WebP/JPEG + carril JPEG del servidor |
| **CAP-03** | Fallo de captura visible y texto-only | Compositor degradado + 201 meta-only |
| **ANN-01** | Mano alzada | Tinta a lo largo del trazo en bytes decodificados |
| **ANN-02** | Flechas | Mango + cabeza más ancha |
| **ANN-03** | Rectángulos | Cuatro bordes; interior intacto |
| **ANN-04** | Etiquetas de texto | Enter/clic fuera; vacío no dibuja; no-ASCII verbatim |
| **ANN-05** | Máscara opaca | Relleno plano dentro del rect |
| **ANN-06** | Undo solo de trazos | Dos trazos + undo; máscara intacta |
| **PRV-04** | Máscara irrecuperable | CA-02: cero píxeles originales dentro y en el anillo |
| **PRV-07** | Revisión/edición previa | Review muestra el artefacto exacto; un solo POST |
| **WDG-06** | EN/ES con auto-detección y override | Copy de core y editor en ambos idiomas |
| **PRF-02** | Chunk lazy ≤ 25 KB gz | `check:size` sobre el máximo de los gemelos |
| **PRF-03** | Runtime ≤ 80 KB gz | `check:size` sobre core + lazy + adapter |

---

## 5. Traza de flujo de datos (Nivel 4)

| Artefacto | Variable | Origen | Flujo | Estado |
|---|---|---|---|---|
| Review canvas | `draft.encoded` | `encodeFinal` sobre el `ImageData` del draft | Sí: el e2e decodifica el artefacto y lo compara con el wire; UAT confirmó que review y envío coinciden | ✅ |
| Máscara | `masks[]` | `bakeMask` escribe píxeles destruidos | Sí: replay al final de `encodeFinal` | ✅ |
| Tinta | `strokes[]` | Trazos vectoriales | Sí: aplanado al Done en el buffer del draft | ✅ |
| Adjunto | `ImageData` | `createImageBitmap` + canvas | Sí: mismo draft, review y wire | ✅ |
| Text-only | `blob: null` | Rama meta-only | Sí: body sin parte `image`, 201 real | ✅ |
| Pixelate | `blockSizeFor(capHeightPx × bitmapPerCssPx)` | Transform de captura en el instante de lectura | Sí: UAT midió 30×30 en DPR 2 | ✅ |

---

## 6. Verificación de enlaces clave

| De | A | Vía | Estado |
|---|---|---|---|
| Lanzador | `runCaptureStage` | Clic con activación transitoria | ✅ |
| Captura | Compositor | `Draft` con `image`, `t1`, `masks`, `encoded` | ✅ |
| Compositor | Editor lazy | `loader.ts` + `import()` desde la URL del bundle | ✅ |
| Editor | Draft | `open()` recibe el `ImageData` y lo devuelve mutado | ✅ |
| Review | Transporte | `pendingFor` usa `draft.encoded` | ✅ |
| Ingest | Storage | `Storage.put` antes del insert idempotente | ✅ |
| Blob route | Fila | Clave resuelta solo desde la BD | ✅ |

---

## 7. Comprobaciones puntuales de comportamiento

| Comportamiento | Comando | Resultado |
|---|---|---|
| Suite funcional completa | `npm run verify` | ✅ 453/453 al cierre; 280/282 tras la remediación (2 skips WebKit-only) |
| Unit | `npm run test:unit` | ✅ 59/59 al cierre; 65/65 tras la remediación |
| Integration | `npm run test:integration` | ✅ 65/65 |
| Contract | `npm run test:contract` | ✅ 26/26 |
| Packaging | `npm run test:packaging` | ✅ 18/18 + gates |
| VRT | `npm run test:vrt` | ✅ 2/2 |
| Tamaño | `npm run check:size` | ✅ core 16.9 / 45 · lazy 6.6 / 25 · runtime 23.8 / 80 (cierre); 17.8 / 6.9 / 25.0 tras la remediación |
| Gates estáticos | `node scripts/gate.mjs` | ✅ 5/5, 0 skip |
| Compose | `npm run check:compose` | ✅ 3 servicios |

---

## 8. Escaneo de anti-patrones

| Anti-patrón | Resultado |
|---|---|
| Test unitario de una copia local | Eliminado: `url-path.test.ts` importa `stripQueryFragment` de producción |
| Mock de ingesta sin autenticación | Eliminado: 401 sin `X-Project-Key` en el mock compartido |
| Aserción que no puede fallar | Eliminada: el `toContain('ab')` se sustituyó por una fila exacta con token único |
| Espera fija para probar una negación | Sustituida por `networkidle` en las filas de «cero POST» |
| Gate que pasa en vacío | `sinks === 0` → FAIL; `STRICT = true`; marcador por sección; lista única de sinks |
| Constantes duplicadas en tests | Importadas de `@watchbug/contracts/constants` |
| Filas condicionales de paginación | Ahora exigen página llena y `x-next-cursor` |
| `typeof statusCode === 'number'` | Sustituido por `400` y cuerpo estructurado |

---

## 9. Estrategia de validación (Nyquist)

`03-VALIDATION.md` declara `status: validated`, `nyquist_compliant: true`.

| Aspecto | Valor |
|---|---|
| Infraestructura | Playwright 1.63.0, tres proyectos, `workers: 1`, compose real |
| Muestreo | Por ola; suite completa en la ola 5 y en el cierre |
| Cobertura por tarea | Mapa tarea → requisito → amenaza → comando → estado |
| Wave 0 | Sin framework nuevo; la taxonomía llega en 03-08 con Vitest |
| Verificaciones manual-only | Siete items de UAT, ejecutados el 2026-11-03 |
| Auditoría | 0 gaps; 27 resueltos; 2 escalados preexistentes y luego cerrados por UAT |

---

## 10. Hallazgos de revisión resueltos desde el informe previo

| Hallazgo | Estado | Evidencia |
|---|---|---|
| CR-01 (soft-lock tras encode) | Cerrado | Guard de generación en `reviewDraft`; UAT item 3 |
| HG-01 (tinta evictada) | Cerrado | Bake-to-base al alcanzar `UNDO_LIMIT`; UAT item 4 |
| HG-02 (suelo de pixelación HiDPI) | Cerrado | `bitmapPerCssPx` en `bakeRect`; UAT item 2B |
| WR-01/02/03 | Cerrados | Guards de identidad/pantalla, `fitToCaps` con aspecto, `compose` failure |
| LW-01…04 | Cerrados | Alpha en copia, error visible de máscara, 408 transitorio, gate de template literal |
| IN-01/IN-02 | Abiertos por alcance en la revisión; cerrados en la remediación | Guarda de Ctrl+Z; `STRICT` y `sinks === 0` FAIL |

---

## 11. Verificación humana (UAT 7/7)

| # | Item | Resultado | Medición |
|---|---|---|---|
| 1 | Captura con picker real → compositor con el contenido real | ✅ | Secretos en negro plano; widget ausente de la captura |
| 2 | Irreversibilidad de máscara (fill y pixelate DPR 2) | ✅ | 84 000 px al 100 % `rgb(0,0,0)` α255; bloques 30×30, σ intra-bloque 0.456, borde 58× menor |
| 3 | CR-01: Discard durante el encode | ✅ | Sin soft-lock; nunca un Review de draft degradado |
| 4 | HG-01: 21 trazos | ✅ | El primer trazo sigue en el artefacto exportado |
| 5 | Backstop: truncado a 280 en Review | ✅ | Nota de 339 caracteres completa en el wire; Review termina en «…» |
| 6 | Backstop: wrap de palabra larga en ES | ✅ | Sin overflow ni scrollbar a ~650–700 px |
| 7 | Firma del propietario sobre las never-prohibitions | ✅ | Sin filas borradas/saltadas; tiers intactos |

**Total:** 7/7 pass · 0 issues · 0 pendientes · 0 bloqueados.

**Defecto encontrado en el arnés, no en el producto:** el primer UAT usó un viewport emulado (1280×860) contra una pestaña real de 1920×952, y `transformFor()` desplazó las máscaras ×1.5/×1.107. Se corrigió lanzando con `viewport: null` y `--force-device-scale-factor`. La regla quedó en `documentation/continuity-pack.md` §11.

---

## 12. Resumen de carencias

**No hay carencias que bloqueen el objetivo.** Los dos items informativos de la revisión se cerraron en la remediación; el único residual es una **endurecimiento futuro** del SDK: este asume `frame = viewport × DPR` y no tiene guarda de desajuste. Un fallo de registración desplazaría las máscaras en silencio. Se registra como candidato de Fase 4/7, no como defecto de la fase 3.

---

## 13. Cobertura de API externa

`COVERAGE.md` no declara ninguna integración externa: la fase entrega un compositor y un editor de canvas dentro del SDK existente, más la ampliación del allowlist PNG+WebP+JPEG en `apps/api`. No hay API de terceros, SDK, servicio, webhook ni plataforma gestionada. La única llamada de red sigue siendo `POST /api/incidents` del propio proyecto.

| Integración externa | ¿Aplica? | Evidencia |
|---|---|---|
| APIs de terceros | No | Sin dependencias ni endpoints nuevos |
| Webhooks / SaaS | No | Fuera de alcance por misión |
| Almacenamiento externo | No | `FsStorage` en volumen propio |
| Autenticación externa | No | Fase 5 |

---

## 14. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **ANN-0x** | Requisito de anotación |
| **CA-0x** | Criterio de aceptación |
| **CAP-0x** | Requisito de captura |
| **C-2** | Contrato del `Annotator`: bitmap único, máscaras destructivas, un `toBlob` |
| **DPR** | Device Pixel Ratio |
| **e2e** | Prueba de extremo a extremo |
| **HG-xx** | Hallazgo high de la revisión |
| **IN-xx** | Hallazgo informativo |
| **LW-xx** | Hallazgo low de la revisión |
| **Nyquist** | Estrategia de muestreo que exige una prueba por propiedad observable |
| **P3-D-xx** | Decisión local de la fase 3 |
| **PRF-0x** | Requisito de rendimiento y tamaño |
| **PRV-0x** | Requisito de privacidad |
| **R-13** | Máscara no reconstruible |
| **R-19** | Taxonomía de seis tipos de verificación |
| **UAT** | Prueba de aceptación por el usuario |
| **VRT** | Visual Regression Testing |
| **WDG-0x** | Requisito del widget |
| **WR-xx** | Hallazgo warning de la revisión |
