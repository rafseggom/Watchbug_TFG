<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 3 — Investigación: *Report Composer & Annotation Editor (lazy)*

| | |
|---|---|
| **Fase** | 3 — *Report Composer & Annotation Editor (lazy)* |
| **Rama** | `gsd/phase-3-report-composer-annotation-editor-lazy` |
| **Investigado** | 2026-10-28 |
| **Alcance** | Compositor, editor lazy, máscaras destructivas, adjunto, carril JPEG y migración e2e |
| **Estado** | Cerrada; las cinco preguntas abiertas quedaron resueltas por los planes |

> Este documento consolida y resume `03-RESEARCH.md` (97 KB). Es un resumen ejecutivo, no una copia literal.

---

## 1. Resumen

La fase 3 es una **fase de arquitectura cliente con un único cambio peligroso en la superficie del servidor**. Cuatro hallazgos dominan el plan:

1. **El presupuesto de tamaño no es el riesgo.** Medido con `check:size`: core **9.3 KB gz / 45**, lazy **0.3 / 25**, runtime **10.0 / 80**. Hay ~35 KB de margen en core y ~24.7 KB en el chunk lazy. Un editor de cinco herramientas y dos diccionarios caben con holgura; lo que falta es contenido y una prueba **de comportamiento**: que el chunk no se pida antes de pulsar «Anotar».
2. **El chunk no puede cargarse con un `import()` asistido por bundler.** Verificado con `esbuild@0.28.2`: un `import()` con literal se inlinea si `splitting` está apagado, y `splitting` solo funciona en formato ESM; el núcleo IIFE absorbería el editor y rompería el tier de 45 KB. La solución es un `import(variableUrl)` **no analizable**, conservado en ambos formatos, que además obliga a que el chunk sea `.mjs` y mantiene WDG-04 trivial.
3. **La fase rompe ~30 filas e2e existentes.** Toda fila que asumía `click → POST` debe pasar por `composer → Review report → Send report`; las de fallo cambian del `status-panel` al compositor degradado. Es mecánico, pero es el mayor coste de calendario y exige un helper único.
4. **JPEG es un cambio de seguridad del servidor; el cliente nunca lo envía.** `ManualFileCapture` devuelve `ImageData` y `encodeLadder` es el único productor de `Blob`, así que el SDK re-codifica a WebP/PNG. JPEG es (a) formato de entrada del cliente y (b) allowlist del servidor alcanzable solo por un cliente directo. Toca un CHECK de BD → migración y consulta obligatoria.

### 1.1 El hallazgo técnico más importante

El **bug latente de la ternary de MIME**: `incidents.ts` mapea todo lo que no es PNG a `image/webp`. Añadir `'jpeg'` al tipo y al sniffer sin tocar esa línea almacenaría bytes JPEG con `content_type = 'image/webp'`; el CHECK lo aceptaría y el blob route serviría `image/webp` + `screenshot.webp` sobre bytes JPEG. La corrección es un único `Record<ImageExt, string>` y su inverso, nunca una segunda ternary.

### 1.2 Recomendación principal

Construir el editor como un módulo de **un solo canvas, lista de trazos vectoriales y parches de máscara re-aplicados**. Cargarlo con un único `import(variableUrl)` resuelto desde la URL del propio bundle. Mantener `encodeLadder` como único sumidero. Dividir la fase en: flow + compositor + i18n de core; editor + máscaras + CA-02; adjunto + JPEG + migración; migración e2e + lazy proof + size gate.

---

## 2. Mapa de responsabilidades arquitectónicas

| Capacidad | Nivel primario | Nivel secundario | Razón |
|---|---|---|---|
| Estado del formulario | SDK core | — | Sin round-trip hasta Send; los caps son UX, la API es el control |
| Captura de pestaña | `DisplayMediaCapture` | — | Requiere activación transitoria; debe seguir en la tarea del clic |
| Adjunto archivo → píxeles | `ManualFileCapture` | — | El fichero no sale del dispositivo; el puerto devuelve `ImageData` |
| Anotación (5 herramientas) | **Chunk lazy** | — | Solo canvas; cero sumidero DOM; tier de 25 KB |
| Máscara destructiva T2/T3 | Cliente | — | SEC-02/R-13: destruir antes de cualquier encode; el servidor no puede hacerlo |
| Encode final | SDK core (`encodeLadder`) | — | Único `toBlob`, gateado por `sdk-single-encode-sink` |
| i18n | Core (formulario/estado) | Lazy (editor) | El formulario debe localizarse antes de que exista el chunk (OQ-1) |
| Allowlist / decode / re-encode | **API** | — | Frontera de confianza; los caps del cliente son UX |
| `content_type` | **BD** | API | El CHECK decide qué puede servir el blob route |

---

## 3. Stack verificado (pines de esta fase)

| Superficie | Tecnología | Uso | Por qué |
|---|---|---|---|
| Editor | `HTMLCanvasElement` + `CanvasRenderingContext2D` | Dibujo, texto, `getImageData` | `fabric.js`/`konva` están descartados por peso (~85/45 KB gz) |
| Pointer | `pointerdown/move/up` + `setPointerCapture` | Arrastre de trazo y máscara | Una familia de eventos para ratón, touch y lápiz |
| Decode de adjunto | `createImageBitmap(File)` | Archivo → bitmap | Sin `FileReader`; `imageOrientation` aplica EXIF por defecto |
| Carga lazy | `import(variableUrl)` | Fetch del editor | Funciona en IIFE y ESM; sin global y sin `globalName` |
| Locale | `navigator.language` | Auto-detección | `es*` → `es`; el resto → `en`; sin runtime de i18n |
| Re-encode servidor | `sharp@0.35.5` (ya instalado) | Rama JPEG | `autoOrient: true` + `jpeg({ quality: 80 })` |
| Gate de tamaño | `scripts/check-size.mjs` | PRF-02/PRF-03 | Ya presupuesta el chunk lazy y el runtime total |
| Gate estático | `scripts/gate.mjs` | C-2 | `sdk-single-encode-sink` debe seguir verde |
| Suite | `@playwright/test@1.63.0` | Toda la verificación | Tres motores, un solo comando |

### Alternativas consideradas y descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Dos canvas (base + tinta) compuestos al exportar | Es una pila de capas, prohibida por C-2/A-04; además convierte «la máscara gana» en un supuesto de orden |
| Inyección de `<script src>` para el chunk IIFE | Reintroduce el problema del `globalName` y contradice WDG-04 |
| `getImageData` de todo el bitmap por cada máscara | La lectura restringida al rect es O(rect), no O(frame), con la misma garantía |
| Re-derivar los píxeles de la máscara en cada redraw | Un pixelado re-promediaría píxeles contaminados por tinta y derivaría entre preview y export |
| Walker estructural de JPEG | Un walker buggy es peor que ninguno; el re-encode raíz de sharp es el control |
| Frameworks de editor | `fabric.js`/`konva` superan el presupuesto por sí solos |

---

## 4. Conjunto de constantes vinculante

| Constante | Valor | Uso |
|---|---|---|
| `MAX_TITLE_CHARS` | 200 | Clamp del título; el contrato es el control |
| `MAX_NOTE_CHARS` | 5 000 | Clamp de la nota; contador desde 4 000 |
| `MAX_ENCODED_IMAGE_BYTES` | 2 MB | Techo duro del artefacto enviado |
| `MAX_IMAGE_PIXELS` | 16 777 216 (16 MP) | Guard de decode-bomb |
| `MAX_IMAGE_DIM` | 8192 px | Lado máximo por eje |
| `MASK_ALPHA_OPAQUE` | 255 | Alpha forzado en toda máscara |
| `MASK_PIXELATION_MIN_BLOCK_PX` | 8 px | Suelo del bloque de pixelación |
| `UNDO_LIMIT` | 20 trazos | Pila de undo del editor |
| Tier core | ≤ 45 KB gz | RNF-01 / PRF-02 |
| Tier lazy | ≤ 25 KB gz | PRF-02 |
| Tier runtime | ≤ 80 KB gz | PRF-03 |

---

## 5. Los 6 patrones de arquitectura

| # | Patrón | Regla |
|---|---|---|
| 1 | **Cortar el pipeline en la frontera del píxel**, no en la del widget | `runCaptureStage` termina en `ImageData` ya redactado; `encodeFinal` es el único camino a bytes |
| 2 | **Un canvas del tamaño del bitmap, ajustado por CSS**; mapear punteros con `geometry.ts` | Una sola autoridad de transformación (`transformFor`/`toBitmapRect`) |
| 3 | **Las máscaras son parches re-aplicados tras cada trazo** | T2 y T3 en un solo mecanismo; nunca una copia pre-máscara |
| 4 | **Carga lazy = un `import()` no analizable** desde la URL del bundle | Sin literal, sin `data-`, sin `document.baseURI`; `.mjs` obligatorio |
| 5 | **Router de pantallas en core**; `StatusView` intacto | El panel de estado sigue siendo el estado en vuelo |
| 6 | **`ManualFileCapture` como segundo `CaptureSource`** | Un archivo entra como `ImageData` y sigue el mismo flujo |

### Anti-patrones a evitar

- Guardar un `Blob` antes de la redacción.
- Usar una capa CSS o un blur como «máscara».
- Re-derivar la máscara desde píxeles ya contaminados por tinta.
- Cargar el editor con un `import()` literal o con un `<script>` que exponga un global.
- Duplicar la transformación CSS→bitmap.
- Renderizar texto del servidor con `innerHTML`.
- Añadir una dependencia de i18n o de canvas.

---

## 6. Los 13 peligros comunes

| # | Pitfall | Guarda |
|---|---|---|
| 1 | El editor se inlinea en core por un `import()` literal | `import(variableUrl)` + gate de pureza de lane |
| 2 | `import.meta.url` en la lane IIFE | Cadena `LOADING_SCRIPT_URL ?? import.meta.url` con fallback |
| 3 | La ruta e2e del chunk devuelve 404 | `serveBundle` sirve un **set**: core + gemelos del chunk |
| 4 | Guardar una copia pre-máscara «para undo» | El patch contiene solo píxeles destruidos; el undo no toca máscaras |
| 5 | `pointerup` fuera del canvas no dispara | `setPointerCapture` + comprobación «dentro del canvas» |
| 6 | `context.font` se ignora en silencio | Asignar, leer de vuelta y caer a `15px sans-serif` |
| 7 | Geometría de máscara contra el espacio equivocado | Una sola autoridad: `getBoundingClientRect()` + `transformFor` |
| 8 | Ternary de `content_type` que etiqueta JPEG como WebP | `Record<ImageExt,string>` + inverso |
| 9 | Perder la orientación EXIF en el re-encode | `autoOrient: true`; el tag desaparece con la orientación ya aplicada |
| 10 | Re-aplicar el mismo trazo tras undo | Redraw desde base + trazos restantes + parches |
| 11 | Dos listeners de `Escape` peleando | El diálogo de máscara detiene el evento mientras está abierto |
| 12 | `hideSync()` con el compositor montado | Restaurar el host en cada salida |
| 13 | Suponer que `maxlength` aplica el cap del contrato | Clamp por code points en JS |

---

## 7. Preguntas abiertas (resueltas)

| ID | Pregunta | Resolución |
|---|---|---|
| **OQ-1** | ¿Dónde viven los diccionarios si el chunk solo se carga al anotar? | **Split por superficie:** core lleva launcher/status/action/composer/review/mask-confirm; el chunk solo `editor.*`. `mask.confirm.*` viaja por `AnnotatorOpenOptions` |
| **OQ-2** | ¿La migración JPEG está pre-aprobada por P3-D-14? | **No sola:** 03-01 Task 1 es un checkpoint bloqueante que aprueba el SQL generado antes de `db:migrate` |
| **OQ-3** | ¿Un aviso de captura o los tres diagnósticos existentes? | **Un aviso** (`composer.image.none`) + hint elegido de `status.captureFailed.hint` / `status.blankCapture.hint` |
| **OQ-4** | ¿Hay copy para «el editor no cargó»? | **Se añaden** `editor.load.error` y `.hint` en ambos idiomas; reutilizar el error de adjunto diría lo incorrecto |
| **OQ-5** | ¿El gate de PRF-02 mide `.js` o `.mjs`? | **Máximo de los gemelos** + suelo anti-inline de 2 KB; se imprimen ambos |

---

## 8. Supuestos registrados

| # | Supuesto | Riesgo si falla |
|---|---|---|
| A1 | Un editor de 5 herramientas + toolbar + diccionarios cabe en 25 KB gz | Bajo: core de Fase 2 = 9.3 KB; margen 24.7 KB |
| A2 | `page.mouse` puede dibujar en canvas en los tres motores con shadow root abierto | Medio: si un motor falla, usar `dispatchEvent(new PointerEvent(...))` |
| A3 | Se puede omitir el walker JPEG y confiar en sharp | Medio: JPEG es la lane más débil; el re-encode es el control documentado |
| A4 | Un adjunto elegido por el usuario no es un vector serio de decode-bomb | Bajo-medio: el input vive en shadow root cerrado; el servidor re-comprueba |
| A5 | `context.font` necesita lectura de vuelta | Bajo: si no, la verificación es redundante |
| A6 | El subsampling 4:2:0 puede perturbar una aserción estricta en el borde de una máscara JPEG | Bajo: el interior se exige al 0.98 y el anillo a <0.5 |
| A7 | El copy español de core cuesta ~1.5–2 KB gz | Bajo: hay 35.7 KB de margen |
| A8 | Codificar al entrar en Review, no al enviar | Bajo: ambas formas cumplen PRV-07; Review=artefacto es más fuerte |
| A9 | `import()` de un `.mjs` del mismo directorio funciona bajo CSP realistas | Medio en CSP con nonce sin `strict-dynamic`; se documenta como límite de integración |

---

## 9. Auditoría de legitimidad de paquetes

**No se añade ningún paquete en la fase 3.** `sharp` ya estaba instalado en `apps/api`; `@playwright/test`, `esbuild` y el resto de tooling ya estaban fijados. La única incorporación de la ola 6 es `vitest` como **devDependency** exacta, sin dependencias de runtime para el SDK. La auditoría de legitimidad se limita a confirmar que no hay paquetes nuevos que revisar.

---

## 10. Arquitectura de validación

| Propiedad | Valor |
|---|---|
| Framework | `@playwright/test@1.63.0` (suite funcional) |
| Config | `playwright.config.ts`: chromium, firefox, webkit; `workers: 1`; `globalSetup` exige el compose en `127.0.0.1:8080` |
| Comando rápido | `npx playwright test e2e/sdk.spec.ts -g "ANN-" --project=chromium` |
| Comando completo | `npm run verify` |
| Gate de tamaño | `npm run check:size` tras `npm run build` |
| Gates estáticos | `npm run gate` (sink único, sin storage del host, cero deps) |
| Ingest directo | `npx playwright test e2e/ingest.spec.ts -g "JPEG"` |

### Mapa requisito → prueba

| Requisito | Comportamiento | Tipo | Archivo |
|---|---|---|---|
| CAP-03 | Captura denegada → compositor degradado → texto-only 201 | e2e | `sdk.spec.ts` / `ingest.spec.ts` |
| CAP-02 | Adjuntar PNG/WebP/JPEG; rechazo de no-imagen | e2e | `sdk.spec.ts` |
| CAP-02 servidor | JPEG directo → 201, `image/jpeg`, blob correcto | e2e API | `ingest.spec.ts` |
| ANN-01…04 | Trazos, flecha, rectángulo y texto en bytes decodificados | e2e | `sdk.spec.ts` |
| ANN-05 | Máscara opaca dentro del rect | e2e | `sdk.spec.ts` |
| ANN-06 | Undo de trazos; máscara intacta | e2e | `sdk.spec.ts` |
| PRV-04 | CA-02: cero píxeles originales dentro y en el anillo | e2e | `sdk.spec.ts` |
| PRV-07 | Review muestra el artefacto exacto | e2e | `sdk.spec.ts` |
| WDG-06 | EN/ES en core y editor | e2e | `sdk.spec.ts` |
| PRF-02/03 | Chunk lazy y runtime bajo tier | packaging | `check-size` |

---

## 11. Dominio de seguridad (ASVS nivel 1)

`security_enforcement: true`, `security_asvs_level: 1`.

| Categoría ASVS | Aplica | Control |
|---|---|---|
| V2 Autenticación | No | Sin auth en cliente; panel en Fase 5 |
| V3 Sesión | No | `credentials: 'omit'` ya probado |
| V4 Control de acceso | Parcial | Solo `project_key` público; la máscara es el control sobre píxeles |
| V5 Validación de entrada | **Sí** | Caps de code points, magic bytes, guard de dimensiones, sharp con límites, Zod re-validado |
| V6 Criptografía | No | Argon2id/JWT son Fase 5 |
| V7 Errores y logging | Parcial | Fallo cerrado en redacción; error de editor visible y recuperable |
| V8 Protección de datos | **Sí** | Mutación destructiva antes del encode; sin blur, sin overlay, sin copia pre-máscara |
| V12 Ficheros y recursos | **Sí** | Input de archivo: magic bytes, caps de cabecera, downscale antes del canvas |
| V14 Configuración | Parcial | URL del chunk solo desde el bundle o `import.meta.url` |

### Patrones de amenaza conocidos

| Patrón | STRIDE | Mitigación |
|---|---|---|
| El host lee píxeles pre-máscara | Divulgación | Shadow cerrado, un global, sin parcheo de prototipos, sin `Blob` antes de redactar |
| Un trazo o undo resucita la máscara | Manipulación / divulgación | Parches re-aplicados al final; undo solo de trazos |
| XSS por adjunto (SVG/HTML/GIF) | Manipulación | Magic bytes + re-encode + `nosniff` + `attachment` + CSP |
| Decode bomb | DoS | Guard de cabecera + `limitInputPixels` + timeout |
| Polyglot/trailing data | Manipulación | PNG/WebP walkers; JPEG re-encode raíz |
| EXIF/GPS | Divulgación | Strip por defecto + `autoOrient` |
| Redirección del chunk | Spoofing / elevación | URL solo del bundle |
| Texto de error del servidor | XSS | `textContent` + truncado a 240 |
| Locale en storage del host | Divulgación | Estado en memoria; gate de storage |

---

## 12. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **ANN-0x** | Requisito de anotación |
| **ASVS** | Application Security Verification Standard |
| **CA-0x** | Criterio de aceptación |
| **CAP-0x** | Requisito de captura |
| **C-2** | Contrato del `Annotator`: bitmap único, máscaras destructivas, un `toBlob` |
| **CSP** | Content Security Policy |
| **DPR** | Device Pixel Ratio |
| **e2e** | Prueba de extremo a extremo |
| **EXIF** | Metadatos de imagen (orientación, GPS, cámara) |
| **OQ-x** | Open Question de la investigación |
| **P3-D-xx** | Decisión local de la fase 3 |
| **PRF-0x** | Requisito de rendimiento y tamaño |
| **PRV-0x** | Requisito de privacidad |
| **R-xx** | Decisión del registro global |
| **SEC-0x** | Invariante de seguridad |
| **SOF** | Start Of Frame (cabecera de dimensiones JPEG) |
| **STRIDE** | Modelo de amenazas |
| **T1/T2/T3** | Redacción automática / máscara manual / orden de exportación |
| **WDG-0x** | Requisito del widget |
