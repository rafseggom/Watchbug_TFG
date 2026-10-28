<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 2 — Investigación: *SDK Tracer Bullet: Widget, Capture & Auto-Redaction*

| | |
|---|---|
| **Fase** | 2 — *SDK Tracer Bullet: Widget, Capture & Auto-Redaction* |
| **Investigado** | 2026-10-17 |
| **Dominio** | SDK de navegador — aislamiento con Shadow DOM, captura de pantalla, redacción/codificación en canvas, ingeniería de bundle sin dependencias |
| **Confianza** | **ALTA** en aislamiento y mecánica de captura (probado empíricamente en los tres motores de Playwright) |
| **Vigencia** | Hasta 2026-11-16; los hallazgos sobre WebKit están atados a Playwright 1.63.0 |

> Este documento consolida y resume el `02-RESEARCH.md` de la fase. Es un resumen ejecutivo, no una copia literal.

---

## 1. Resumen

La mitad servidor ya estaba hecha (Fase 1). Todo lo que faltaba es cliente y cabe entero en el carril core de 45 KB gzip con cero dependencias: un host con Shadow DOM cerrado y endurecido contra CSS hostil, una cadena de captura de un solo gesto (`getDisplayMedia` → `<video>` → canvas → `ImageData` crudo), la redacción automática T1 sobre ese `ImageData`, una escalera de codificación WebP determinista con detección del fallback silencioso, y un transporte `fetch` con reintento acotado e idempotencia.

### El hallazgo técnico más importante

**Tres resultados empíricos cambiaron la estrategia de verificación del plan:**

| # | Hallazgo | Consecuencia |
|---|---|---|
| 1 | La técnica de aislamiento **funciona en los tres motores**: el `!important` inline del host vence al `!important` del autor hostil, y `all: initial` en la raíz cerrada corta la herencia | El contrato de aislamiento del UI-SPEC es implementable tal cual |
| 2 | El **WebKit de Playwright en este host no tiene `navigator.mediaDevices` ni `canvas.captureStream`** | El stub e2e de webkit debe subir un nivel: costura `CaptureSource`/`ImageData` |
| 3 | El **WebKit de Playwright codifica WebP real** (`RIFF…WEBP` verificado por bytes mágicos) | La premisa documentada «webkit ejercita el fallback PNG» es **falsa aquí**; M-3 se provoca con un stub forzado |

Un cuarto hallazgo, más barato: el gate `sdk-no-host-storage` **ya existe**, es línea a línea y **ciego a comentarios**; el catálogo de patrones y los comentarios de SEC-03 colisionan con él salvo que se redacten con cuidado. Y `sdk-single-encode-sink` exige **exactamente una** aparición textual del sumidero en todo `packages/sdk/src`.

### Recomendación principal

**Secuenciar por riesgo:** primero el bundle e2e `SHADOW_MODE=open`, el fixture hostil y la costura de captura de dos niveles; después el aislamiento `WidgetHost`; después el pipeline T1 (capturar → sondear → redactar → codificar → transportar). Mantener **toda** aserción de seguridad a nivel de artefacto: decodificar los bytes que realmente salieron del navegador.

---

## 2. Mapa de responsabilidades arquitectónicas

| Capacidad | Nivel primario | Nivel secundario | Razón |
|---|---|---|---|
| Renderizado y aislamiento (WDG-01…05) | Navegador / cliente | — | Vive dentro de una página hostil; INV-01/RNF-02 son concerns del navegador |
| Captura de pestaña (CAP-01/04) | Navegador / cliente | — | `getDisplayMedia` exige activación transitoria en el handler del gesto |
| Redacción T1 (PRV-01/02/03) | Navegador / cliente | — | Debe ocurrir sobre `ImageData` antes de codificar (SEC-02/A-05); estructuralmente imposible en otro sitio |
| Reducción y codificación (CAP-05, M-3) | Navegador / cliente | — | La escalera precede al transporte; el tope de 2 MB del servidor es control, no diseño |
| Transporte lane 1 | Navegador / cliente | API (Fase 1) | `fetch` a `POST /api/incidents`; el servidor posee deduplicación y topes |
| Validación del contrato | API (hecho) | — | `z.strictObject` es el contrato único; el SDK se conforma, nunca lo amplía |
| Privacidad del payload (PRV-05/06) | Navegador / cliente | API | El SDK no lee estado del anfitrión; el esquema re-recorta como defensa en profundidad |
| Presupuesto de tamaño/dependencias | Build | — | `check:size` y `gate.mjs`, no código en runtime |
| Renderizado del informe aterrizado | Panel (hecho) | — | El panel de la Fase 1 ya pinta tipo/título/URL/usuario e imagen |

---

## 3. Stack verificado y alternativas descartadas

### Stack de la fase

| Pieza | Versión | Papel | Por qué |
|---|---|---|---|
| **Dependencias runtime: NINGUNA** | — | Todo el widget | PRF-04 es requisito duro; cada byte cuenta contra los 45 KB |
| `esbuild` (sólo build) | 0.28.2 | Build dual IIFE+ESM en tres carriles | Ya cableado; un `format` por llamada → 6 llamadas |
| `typescript` (sólo tipos) | 7.0.2 | Type-check (`npm run lint`) | La puerta Q-08 pasó con 7.0.2; sin fallback a 6.x |
| `@watchbug/contracts` (sólo tipos) | workspace | Constantes y tipos del informe | R-18: conjunto único de constantes; `import type` lo borra del bundle |
| `@playwright/test` | 1.63.0 | La única suite e2e | Tres proyectos de motor ya configurados |
| `node:zlib` | Node 24 | Tiers gzip de `check:size` | Ya en uso |

**Instalación: ninguna.** La fase instala **cero** paquetes. Añadir uno sería disparador de consulta (presupuesto) y tendría que pasar la puerta de legitimidad.

### Alternativas consideradas y descartadas

| En lugar de | Se podría usar | Compromiso |
|---|---|---|
| Host con Shadow DOM cerrado | Host en `<iframe>` de origen cruzado | Aislamiento más fuerte, pero exige `allow="display-capture"`, una entrada `frame-src` en el CSP de cada anfitrión, muere en embeds con sandbox y cuesta KB. El iframe queda como adaptador reservado de `WidgetHost` |
| Stub `canvas.captureStream()` en los tres motores | Stub en la costura `CaptureSource` para webkit | El WebKit de este host no tiene `captureStream`; el stub de dos niveles es lo único verde en los tres proyectos |
| Servir el fixture hostil desde la raíz nginx del panel | Cumplimiento con `page.route` en el origen del panel | El CSP de `location /` bloquea `<style>`/`style=` inline: el CSS hostil quedaría neutralizado y CA-04 pasaría de forma vacua |
| `ImageCapture.grabFrame()` como vía de captura | `getDisplayMedia` + `<video>` → canvas | Firefox no tiene `ImageCapture`; la vía de vídeo funciona donde funcione `getDisplayMedia` |
| Detectar WebP por capacidades | Sniff de `blob.type` tras una codificación de prueba 1×1 | No existe consulta de capacidad; el fallback es silencioso |
| Librerías de captura (`html2canvas`, `fabric.js`, `konva`) | `getDisplayMedia` + canvas/`ImageData` crudos | 50–85 KB cada una reventaría el presupuesto y además capturan otra cosa (snapshot del DOM ≠ lo que ve el usuario) |
| Una dependencia para Luhn/regex | ~15 líneas propias en `redact/patterns.ts` | El código de privacidad debe ser auditable y no puede costar bytes |
| Framework de tests unitarios | La suite Playwright + `check:size` + `gate.mjs` | R-12, política del propietario enunciada dos veces |

---

## 4. Conjunto de constantes vinculante

Tomadas de `packages/contracts` (fuente única, R-18) y del research:

| Constante | Valor | Uso en la fase |
|---|---|---|
| `MAX_ENCODED_IMAGE_BYTES` | **2 097 152** (2 MB) | Tope duro del servidor (413); el cliente no debe alcanzarlo por diseño |
| `MAX_IMAGE_PIXELS` | **16 777 216** (16 MP) | Techo de la escalera y de la sonda de blanco |
| `MAX_IMAGE_DIM` | **8192 px** | Clamp por lado (añadido en la fase) |
| `MAX_TITLE_CHARS` | **200** | Truncado del título automático, por **puntos de código** |
| `MASK_ALPHA_OPAQUE` | **255** | Única primitiva automática: relleno plano opaco |
| `MASK_PIXELATION_MIN_BLOCK_PX` | **8** | Pixelación opt-in (no automática en esta fase) |
| `MAX_URL_PATH_CHARS` | — | Recorte del path enviado en `meta.url` |
| Objetivo de salida | **≤ 800 KB** | Base WebP q0.8; si se supera, bajar calidad |
| Escalera de calidad | **0.8 → 0.6 → 0.5** | Re-encode sobre el mismo sumidero |
| Factor de reducción | **0.75×** | Downscale sucesivo hasta cumplir |
| Clamp DPR | **2** | Se aplica en la captura, no en el envío |
| Reintentos | **3**, esperas **1/4/10 s ±25 %** | Sólo transitorios; timeout **15 s** por intento |
| Presupuesto de tamaño | **45 / 25 / 14 / 80 KB gz** | Core / chunk perezoso / adaptador / runtime total |

---

## 5. Los cuatro patrones de arquitectura

### Patrón 1 — Aislamiento `WidgetHost` (carga arquitectónica, fijar en el primer build)

Un elemento **no registrado** `<watchbug-host>` como **último hijo de `document.documentElement`** (cadena de ancestros mínima), re-insertado por un `MutationObserver` ligero si se reemplaza; endurecido con **`!important` inline** (`position:fixed`, `z-index:2147483647`, `right/bottom:24px`, `pointer-events:none`); dentro, una raíz cerrada con un `<style>` **propio** (nunca `adoptedStyleSheets`) que abre con `all: initial` y re-declara explícitamente cada propiedad usada, en px.

**Evidencia (sonda 2026-10-17, tres motores):** un host con `!important` inline conservó `display`, `position`, `z-index` y `color` bajo `* { display:none !important; position:static !important; z-index:auto !important; color:red !important; font-size:4px !important }`; la raíz cerrada con `all: initial` renderizó a 15 px pese al `4px` hostil.

**Reglas obligatorias:** sólo px (cero `rem`/`em`) · tokens `--wb-*` sólo en el wrapper interno · sin `part`/`::part`/`::theme` · cero hojas o clases en `head`/`body` del anfitrión · cero peticiones externas · `pointer-events: none` en la caja del host para no tragarse clics.

### Patrón 2 — Orden de redacción T1 (la idea portante)

`CaptureSource.capture()` devuelve **`ImageData` crudo, nunca un `Blob`**. El pipeline es estrictamente: obtener fotograma → sonda de blanco → relleno destructivo → **sólo entonces** codificar. Estructuralmente no puede existir un byte codificado sin enmascarar.

Detalles clave:

- Las máscaras viven en **espacio bitmap** desde la primera: `scale = canvas.width / window.innerWidth`, redondeo **hacia fuera** (suelo en origen, techo en extensión). Sobre-enmascarar es seguro.
- Relleno plano con `MASK_ALPHA_OPAQUE = 255`; sin desenfoque, sin capas CSS, sin rellenos semitransparentes.
- El puerto `Redactor` es costura; en v1 no hay reglas configurables por el anfitrión.

### Patrón 3 — Cadena de captura con verificación de superficie y fallos ruidosos

El handler oculta el host de forma síncrona, llama a `getDisplayMedia({ video: true, preferCurrentTab: true })`, espera un fotograma real, **aserta que el host sigue oculto justo antes de leer píxeles**, restaura el host y sondea el blanco. `track.stop()` en `finally`. Todo fallo termina en un estado visible.

**Hueco que el plan debe cerrar:** `preferCurrentTab` sólo es una pista; el usuario puede compartir una ventana o la pantalla entera, donde el mapeo DOM→píxel no es válido y la redacción automática no puede funcionar. Se exige `displaySurface === 'browser'` y se falla en voz alta en otro caso; `preferCurrentTab` es sólo Chromium (Firefox/Safari no lo soportan).

### Patrón 4 — Panel de estado como máquina de estados + mapa `strings`

Estados `idle → capturing → sending → retrying (n of 3) → sent | failed{Capture,Blank,Network,Rejected}` con copy y geometría exactos del UI-SPEC. Todo el copy vive en `strings.ts` (ID→inglés). Los motivos del servidor se pintan por `textContent`, truncados a 240 caracteres. El listener de `Escape` es de documento y se retira al desmontar.

### Anti-patrones a evitar

- `adoptedStyleSheets` o un `<style>` en el documento anfitrión.
- `rem`/`em`, `part`, `::theme`, color o fuente heredados del anfitrión.
- `selfBrowserSurface: 'exclude'` (incompatible con `preferCurrentTab`, sólo Chromium).
- Enmascarar el bbox del widget en el bitmap en vez de ocultar el host.
- Capas CSS, desenfoque gaussiano o rellenos semitransparentes como máscara.
- `keepalive`/`sendBeacon` para informes con imagen (tope de 64 KiB).
- `innerHTML` para el motivo del servidor o cualquier texto dinámico.
- Un segundo sumidero de codificación.
- Asumir que webkit produce el fallback PNG en esta plataforma.

---

## 6. Los diez peligros comunes y sus guardas

| # | Peligro | Guarda |
|---|---|---|
| 1 | **Colisión de tokens con `gate.mjs`**: `sdk-no-host-storage` falla con `document.cookie`, `localStorage`, `sessionStorage`, `Authorization` o `Bearer` **incluso en comentarios** | Redactar comentarios de forma genérica; escribir el patrón como `Beare[r]`; exención estrecha sólo como último recurso |
| 2 | **El stub de captura no es uniforme entre motores**: webkit no tiene `mediaDevices` ni `captureStream` | Stub de dos niveles: `captureStream` en chromium/firefox, costura `ImageData` en webkit |
| 3 | **La premisa «webkit ejercita el fallback PNG» es falsa aquí** | Cubrir M-3 con un stub que devuelva PNG y registrar la corrección (A-14), sin editar R-12 |
| 4 | **El fixture hostil no puede servirse bajo el CSP del panel**: `location /` bloquea estilos inline | Cumplir el fixture por `page.route` en el mismo origen, sin CSP; asertar que la regla hostil aplica |
| 5 | **`getDisplayMedia` exige activación transitoria**: cualquier `await` previo la pierde | Ocultar el host y llamar a `getDisplayMedia` de forma síncrona en el handler |
| 6 | **Mala registración de geometría en HiDPI**: máscaras en px CSS aplicadas en px de dispositivo filtran caracteres de borde | Un único módulo de geometría, escala por ancho de canvas, redondeo hacia fuera |
| 7 | **Superficies no-pestaña invalidan el mapeo DOM→bitmap** | Verificar `displaySurface` y fallar en voz alta; nunca «enviar sin redactar» |
| 8 | **Fallback WebP→PNG silencioso y sumidero único** | Sniff de `blob.type` tras cada codificación; la escalera es un bucle alrededor de **una** llamada |
| 9 | **`document.title` y los motivos del servidor son entrada no confiable** | Sólo `textContent`, truncado a 240; meta por campos explícitos, nunca spread |
| 10 | **Playwright y raíces cerradas**: las consultas no atraviesan la raíz | Bundle e2e con raíz abierta para copy/estado; aserciones de aislamiento contra el bundle cerrado |

---

## 7. Preguntas abiertas (resueltas)

| ID | Pregunta | Resolución |
|---|---|---|
| **OQ-1** | Superficies de captura no-pestaña | v1 rechaza toda superficie distinta de `browser` con estado de fallo visible; `undefined` se acepta con salvedad documentada para motores antiguos |
| **OQ-2** | Documentación frente a la realidad del probe (webkit/WebP) | El proyecto webkit se mantiene; M-3 se cubre con el stub PNG forzado; la corrección se registra como comentario en `playwright.config.ts` + enmienda A-14, sin tocar R-12 |
| **OQ-3** | Iframes de origen cruzado no son redactables | Aceptado para v1 (T-02-14, AR-01): ninguna política de sobre-enmascarado arregla ubicaciones desconocidas. Documentación honesta en la fase 5+ |
| **OQ-4** | Reemplazo de `documentElement` y ciclo de vida | Re-insertar mientras esté inicializado (observador) y retirar el listener de `Escape` al desmontar. `Watchbug.destroy()` sería cambio de interfaz pública (disparador de consulta), deliberadamente fuera de la fase |
| **OQ-5** | Baseline de Lighthouse (CA-03/PRF-05) | La ruta y el mecanismo del fixture quedan fijados ahora y estables; la medición Lighthouse pertenece a la Fase 7 |

---

## 8. Supuestos registrados

| # | Afirmación | Riesgo si es falsa |
|---|---|---|
| A1 | v1 sólo acepta captura de pestaña (`displaySurface === 'browser'`) | UX en Firefox/Safari donde compartir escritorio es costumbre; requiere visto bueno del propietario |
| A2 | Las filas de webkit stubean en la costura `CaptureSource` | Si se quisiera la vía de medios real en webkit, es imposible en este host |
| A3 | `gate.mjs` recibe una exención estrecha o se resuelve por redacción | Si se deja intacto y los comentarios colisionan, el gate falla la fase |
| A4 | El fixture se sirve por `page.route` en el origen del panel | Un fixture servido de verdad exigiría un `location` nginx sin CSP |
| A5 | La mitigación del «fixed-position trap» se hereda del research (la sonda fue inconclusa) | Bajo: la matriz hostil de la fase la ejercita |
| A6 | El Safari real de macOS sí cae a PNG en `toBlob` | Bajo: el sniff es correcto en cualquier dirección |
| A7 | El contenido de raíz cerrada se aserta con el bundle abierto; el aislamiento, con el cerrado | Bajo: decisión de estructura de test |
| A8 | Las constantes de reintento y los objetivos de encode son correctos tal como están bloqueados | Bajo: están parametrizados |
| A9 | La sonda de blanco aborta cuando el frame es uniforme | **Resuelto en el cierre (2026-10-25):** la rejilla fija de 9 muestras daba falsos positivos en páginas legítimamente escasas (la UAT la reprodujo con una página blanca y un `<h1>`); se sustituyó por un barrido denso que sólo aborta si **todos** los píxeles son idénticos |
| A10 | Contextos `deviceScaleFactor ≥ 2` son prueba suficiente de HiDPI | Bajo: se combinan con marcos sintéticos por la costura |

---

## 9. Auditoría de legitimidad de paquetes

**No aplica: la fase no instala ningún paquete externo.**

PRF-04 prohíbe nuevas dependencias runtime; el toolchain de build y verificación (`esbuild` 0.28.2, `@playwright/test` 1.63.0, `typescript` 7.0.2) se instaló y auditó en la Fase 1. El gate `sdk-runtime-deps` falla el build si aparece cualquier bloque runtime fuera de la lista permitida.

| Paquete | Registro | Antigüedad | Descargas | Repo | Veredicto |
|---|---|---|---|---|---|
| — | — | — | — | — | ninguno instalado en esta fase |

**Paquetes retirados por veredicto `SLOP`:** ninguno · **Marcados `SUS`:** ninguno.

---

## 10. Arquitectura de validación

> R-12 en vigor: **sólo e2e y aserciones de propiedad**. Una única suite Playwright, más `npm run check:size` y `node scripts/gate.mjs`. Sin tests unitarios, sin cobertura.

| Propiedad | Valor |
|---|---|
| Framework | Playwright 1.63.0 |
| Configuración | `playwright.config.ts` — tres proyectos de motor, `workers: 1`, comprobación de salud en global-setup |
| Comando rápido | `npx playwright test e2e/sdk.spec.ts --project=chromium` |
| Comando completo | `npm run verify` + `check:size` + `gate.mjs` |
| Muestreo | Por tarea: carril rápido + tamaño · Por ola: tres motores + gates · Puerta de fase: suite completa verde |

### Mapa requisito → prueba

| Requisito | Comportamiento | Tipo | Evidencia |
|---|---|---|---|
| INT-01 | Una etiqueta async arranca el widget | e2e | Fixture que carga `dist/watchbug.js` |
| INT-02 | `init({projectKey,…})` archiva un informe | e2e | Intercepción + fila en el panel |
| INT-05 | Import ESM arranca el widget | e2e | Fixture `<script type="module">` |
| WDG-01 | El lanzador abre el flujo | e2e | Botón 48×48 en la raíz |
| WDG-02 | CSS hostil no rompe el widget (CA-04) | e2e | Matriz de fixtures hostiles |
| WDG-03 | Cero fugas al anfitrión | e2e | Enumeración de `head`, estilos computados, `--wb-` |
| WDG-04 | Un solo global, prototipos intactos | e2e | Snapshot de `window` y prototipos |
| WDG-05 | Se dibuja sobre todo | e2e | `elementFromPoint` sobre modal hostil |
| CAP-01 | Captura vía prompt (stub por motor) | e2e | Costura de dos niveles |
| CAP-04 | El widget no aparece en la captura | e2e | Host oculto en la invocación + píxeles ausentes |
| CAP-05 | ≤16 MP / ≤2 MB, HiDPI no blanco | e2e | Marco sintético + `deviceScaleFactor` |
| PRV-01 | Passwords enmascarados | e2e artefacto | Rect original ausente en bytes decodificados |
| PRV-02 | Patrones token/tarjeta (Luhn) | e2e artefacto | Por familia + control negativo |
| PRV-03 | `data-watchbug-sensitive` | e2e artefacto | Rect del elemento ausente |
| PRV-05 | Sin cookies/storage/auth | e2e + gate | Centinelas + `sdk-no-host-storage` |
| PRV-06 | URL sólo ruta | e2e | `meta.url` sin `?`/`#` en bytes crudos |
| PRF-01 | ≤45 KB gz | gate de tamaño | `check:size` |
| PRF-04 | Cero deps runtime | gate estático | `sdk-runtime-deps` |

### Brechas de la ola 0 (todas cerradas por el plan)

`e2e/sdk.spec.ts`; `e2e/fixtures/hostile-host.html` + cargador por `route`; variante `SHADOW_MODE=open` + registro de raíces; costura de captura de dos niveles; fila de PNG forzado; estrategia de redacción para el gate. No hizo falta instalar ningún framework.

---

## 11. Dominio de seguridad (ASVS nivel 1)

| Categoría ASVS | Aplica | Control |
|---|---|---|
| V2 Autenticación | No (Fase 5) | — |
| V3 Gestión de sesión | No (Fase 5) | — |
| V4 Control de acceso | Sí | `project_key` público de sólo escritura en `X-Project-Key`; el cliente no envía nada más |
| V5 Validación de entrada | Sí | Contrato cerrado (`z.strictObject` sólo tipos), validación defensiva de opciones de `init`, título a 200 puntos de código |
| V6 Criptografía | No (cliente) | La irreversibilidad es destrucción de píxeles (α=255), no cifrado |

### Patrones de amenaza conocidos

| Patrón | STRIDE | Mitigación |
|---|---|---|
| Datos sensibles exfiltrados en los bytes de la captura | Divulgación | Redacción T1 destructiva antes de codificar; artefacto e2e |
| Robo de credenciales del anfitrión por el SDK | Divulgación | SEC-03 + `sdk-no-host-storage` + fila de centinelas |
| XSS por textos del servidor o del anfitrión | Manipulación | Sólo `textContent`; saneado en ingesta (Fase 1) |
| Página hostil que manipula u oculta el widget | Manipulación/DoS | Aislamiento del patrón 1 y fallos visibles |
| Captura en blanco u obsoleta como pérdida silenciosa | Repudio/DoS | Sonda de uniformidad densa y `track.stop()` en `finally` |
| Slop de cadena de suministro en el bundle | Divulgación | Cero deps runtime + gate |
| XSS portada por imagen (SVG/polyglot) | Manipulación | Rechazo en servidor (Fase 1); el SDK sólo envía PNG/WebP |

---

## 12. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-xx** | Enmienda del registro de decisiones |
| **AR-xx** | Riesgo aceptado formalmente |
| **ASVS** | *Application Security Verification Standard* (OWASP) |
| **CA-xx** | Criterio de aceptación basado en propiedades |
| **CAP-xx** | Requisito de captura |
| **DPR / DSF** | *Device Pixel Ratio* / *Device Scale Factor* |
| **H-x** | Identificador de peligro del research |
| **INV-xx** | Invariante arquitectónica |
| **INT-xx** | Requisito de integración |
| **M-3** | Riesgo de fallback silencioso WebP→PNG |
| **OQ-x** | Pregunta abierta del research |
| **PRF-xx** | Requisito de rendimiento y presupuesto |
| **PRV-xx** | Requisito de privacidad y enmascarado |
| **R-xx** | Decisión del registro global |
| **SEC-xx** | Invariante de seguridad |
| **STRIDE** | Marco de amenazas (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) |
| **T1/T2/T3** | Momentos del enmascarado |
| **WDG-xx** | Requisito del widget |
| **e2e** | Prueba de extremo a extremo |
