<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Documento 2 — Suite completa de tests E2E manuales

| | |
|---|---|
| **Proyecto** | Watchbug SDK |
| **Fecha de diseño** | 2026-11-03 |
| **Base** | Requisitos, casos de uso y criterios de aceptación de `.planning/` |
| **Casos de prueba** | **67** (42 ejecutables hoy + 4 parciales + 21 prospectivos de fases 4–7) |
| **Cobertura** | 70/70 requisitos v1 · 6/6 historias de usuario · 5/5 CA globales |
| **Prioridades** | 27 × P1 · 25 × P2 · 12 × P3 · 3 × P4 |
| **Automatización** | 62 «Sí» · 4 «Parcial» · 1 «No» |
| **Formato** | Un caso = un recorrido E2E verificable manualmente, con pasos y resultado esperado por paso |

> **Nota de alcance.** Esta suite es **manual y de aceptación**. No sustituye a la suite automatizada de seis tipos de R-19: la complementa con recorridos de negocio, observación visual, juicio humano y escenarios prospectivos de las fases aún no construidas. Los casos marcados **«Prospectivo»** no son ejecutables contra el estado actual del proyecto; se incluyen porque el encargo pide cubrir la totalidad de los requisitos planificados.

---

## 0. Convenciones de ejecución

### 0.1 Prioridades

| Prioridad | Definición | Uso en esta suite |
|---|---|---|
| **1** | Feature clave / muy repetida en el tiempo | Camino feliz del reportero, seguridad de datos, ingesta, auth, triaje básico |
| **2** | Flujo secundario importante de uso frecuente | Integración ESM, i18n, adjunto, undo, filtros, proyectos |
| **3** | Caso poco frecuente o de impacto medio | Fallback de motor, DPR alto, comentarios, backup |
| **4** | Edge case / interacción rara y de poco impacto | Fallback WebP→PNG, tinta sobre máscara, recursión de consola, borrado de proyecto |

### 0.2 Valoración de automatización

| Valor | Significado |
|---|---|
| **Sí** | Flujo estable, determinista, alto ROI; debe estar en CI o en la suite automatizada |
| **Parcial** | El mecanismo se automatiza, pero la aceptación final exige ojo humano o un entorno no determinista |
| **No** | Depende de un selector del sistema operativo, de una apreciación visual o de un juicio humano irrepetible |

### 0.3 Precondiciones globales

1. **Pila levantada:** `docker compose up -d --build`; `db` healthy antes de `api`; `panel` en `http://127.0.0.1:8080`; `/api/health` → `{"status":"ok"}`.
2. **Configuración:** `.env` copiado de `.env.example`; `WATCHBUG_PROJECT_KEY` generada con `npm run key:gen`; CORS limitado al origen del panel; TTLs de retención a valores cortos sólo en los casos de retención.
3. **Navegadores:** Chromium, Firefox y WebKit actuales. Para captura real: navegador *headed*, `viewport: null` y `--force-device-scale-factor` cuando se pruebe DPR (regla D-11 de `continuity-pack.md`).
4. **Fixtures:** página host limpia; página host con CSS hostil (5 variantes); formulario con `input[type=password]`; bloque `data-watchbug-sensitive`; textos con JWT, `Bearer`, `api_token=`, tarjeta Luhn válida e inválida; PNG/WebP/JPEG válidos; SVG, GIF/HTML polyglot, archivo no-imagen, imagen > 16 MP, cuerpo > 5 MB.
5. **Datos de panel (fases 5–6):** credenciales de admin en `.env`; dos proyectos A/B con claves distintas; reportes en estado Pending, In Progress y Resolved; un reporte con identidad y otro sin ella.
6. **Evidencia:** captura de pantalla, HAR o intercepción de red, bytes de la imagen decodificada, fila de BD y contenido del volumen. En pruebas de seguridad, la evidencia es el **artefacto** (bytes, respuesta HTTP, fila), no la función.

### 0.4 Criterio de paso

Un caso pasa sólo si **todos** sus pasos producen el resultado esperado y el resultado final se observa sin ambigüedad. Un paso «no aplica» debe justificarse; no se admite pasar por omisión.

---

## 1. Grupo A — Integración, despliegue y contexto

### TC-A-01 · Un `<script async>` y `Watchbug.init()` montan el widget

| Campo | Valor |
|---|---|
| **Trazabilidad** | INT-01, INT-02 · US-4 · CA-04 (contenido del diálogo) |
| **Precondiciones** | Pila arriba; página host con un único `<script async src="…/watchbug.js">`; project key válida |
| **Prioridad** | **1** — camino de integración principal |
| **Automatización** | **Sí** — flujo determinista y de altísimo ROI; ya cubierto por J-01/J-02 |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Cargar la página host → *Esperado:* el script responde 200; `window.Watchbug` existe; no hay errores de consola de la SDK.
2. Ejecutar `Watchbug.init({ projectKey })` → *Esperado:* aparece un lanzador flotante de 48×48 px en la esquina inferior derecha; no se modifica ningún prototipo nativo.
3. Pulsar el lanzador → *Esperado:* se abre el picker de captura o, si se usa un stub, el compositor con la imagen; el lanzador queda deshabilitado mientras el panel está abierto.
4. Completar título y enviar → *Esperado:* POST 201; el reporte aparece en el panel tras recargar.

**Resultado final esperado:** un integrador añade un solo script y obtiene un widget funcional que archiva un reporte visible en el panel, sin build step.

---

### TC-A-02 · Consumo como módulo ES sin global

| Campo | Valor |
|---|---|
| **Trazabilidad** | INT-05 · US-4 |
| **Precondiciones** | Página con `<script type="module">`; build ESM disponible |
| **Prioridad** | **2** — integración alternativa frecuente en stacks modernos |
| **Automatización** | **Sí** — mismo recorrido que el IIFE, con una comprobación de superficie global |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Importar el módulo ESM y llamar a `init({ projectKey })` → *Esperado:* el lanzador aparece igual que en el caso A-01.
2. Comparar `Object.keys(window)` antes y después → *Esperado:* cero propiedades nuevas; no se crea `window.Watchbug`.
3. Ejecutar un reporte completo → *Esperado:* 201 y fila en el panel.

**Resultado final esperado:** el mismo widget funciona por import ESM sin contaminar el espacio global.

---

### TC-A-03 · Contexto de inicialización y opt-out de identidad

| Campo | Valor |
|---|---|
| **Trazabilidad** | INT-03, INT-04 · US-3 · R-09 |
| **Precondiciones** | Fase 4 implementada; host que llama a `init({ user, appVersion, custom })` |
| **Prioridad** | **2** — configuración habitual de integración |
| **Automatización** | **Sí** — payload observable en la petición |
| **Ejecutabilidad** | 🟡 Prospectivo (Fase 4) |

**Pasos y resultado esperado**

1. Inicializar con `user: { id, name, email }`, `appVersion` y `custom` → *Esperado:* el contexto queda registrado y no se lee de cookies ni storage.
2. Enviar un reporte → *Esperado:* `user`, `appVersion` y `custom` viajan en el payload; `custom` es contexto de init, no campo libre por reporte.
3. Reinicializar con `privacy: { userIdentity: false }` y enviar → *Esperado:* ningún campo de identidad sale del navegador; el resto del reporte sigue siendo válido.
4. Repetir sin `user` en el host → *Esperado:* no se inventa identidad; el reporte se envía sin `user`.

**Resultado final esperado:** el host controla qué contexto y qué identidad viajan; la SDK nunca descubre identidad por su cuenta.

---

### TC-A-04 · Arranque limpio con `docker compose up` y `.env.example`

| Campo | Valor |
|---|---|
| **Trazabilidad** | DEP-01, DEP-02 · US-6 · INV-03 · SEC-04 |
| **Precondiciones** | Clone limpio; Docker disponible; sin volúmenes previos; `.env.example` committed |
| **Prioridad** | **1** — primer contacto del desarrollador |
| **Automatización** | **Parcial** — automatizable en CI; la experiencia de primera ejecución exige revisión humana |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Copiar `.env.example` a `.env` y generar la clave → *Esperado:* el archivo documenta todas las variables; la clave tiene formato `wkbt_` + 32 bytes base62.
2. Ejecutar `docker compose up -d --build` → *Esperado:* exactamente tres servicios `db`, `api`, `panel`; `db` healthy antes de `api`.
3. Abrir `http://127.0.0.1:8080` → *Esperado:* panel carga; si no hay reportes, muestra el estado vacío con el `curl` de onboarding y la clave real.
4. Ejecutar el `curl` emitido tal cual → *Esperado:* 201; tras recargar, el reporte aparece listado.
5. Revisar el compose → *Esperado:* el volumen de adjuntos está montado sólo en `api`; no hay cuarto servicio.

**Resultado final esperado:** desde un clon limpio, sólo copiando `.env.example` y ejecutando un comando, el desarrollador tiene la pila y su primer reporte.

---

### TC-A-05 · Fail-fast de configuración y defaults seguros

| Campo | Valor |
|---|---|
| **Trazabilidad** | DEP-02 · SEC-04 |
| **Precondiciones** | Capacidad de arrancar `api` con variables alteradas |
| **Prioridad** | **3** — error de operación poco frecuente pero de diagnóstico crítico |
| **Automatización** | **Sí** — arranque de proceso con variables controladas |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Arrancar sin `WATCHBUG_PROJECT_KEY` → *Esperado:* exit no cero; el mensaje nombra la variable y el archivo.
2. Arrancar con la clave placeholder documentada → *Esperado:* exit no cero; mensaje de placeholder.
3. Arrancar con clave malformada → *Esperado:* exit no cero; el mensaje nombra el formato esperado (32 bytes base62).
4. Arrancar con variables opcionales vacías → *Esperado:* se aplican defaults documentados (30/90 días, 10/30/2000 límites), nunca 0 ni infinito.
5. Repetir con una variable opcional con valor `0` o basura → *Esperado:* fallo ruidoso, no degradación silenciosa.

**Resultado final esperado:** una configuración inválida nunca produce un arranque inseguro o silencioso.

---

## 2. Grupo B — Widget, aislamiento e i18n

### TC-B-01 · Apertura desde el lanzador flotante

| Campo | Valor |
|---|---|
| **Trazabilidad** | WDG-01 · US-1 |
| **Precondiciones** | Página host con la SDK inicializada |
| **Prioridad** | **1** — gesto de entrada a todo el producto |
| **Automatización** | **Sí** — J-01/J-02 |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Localizar el lanzador → *Esperado:* botón real de 48×48 px dentro del shadow root, visible y con `aria-label`.
2. Pulsarlo → *Esperado:* se inicia el flujo; el lanzador se deshabilita mientras el panel/compositor está abierto.
3. Cerrar o completar el flujo → *Esperado:* el lanzador vuelve a estar operativo sin recargar.

**Resultado final esperado:** el usuario siempre puede abrir el widget desde un control flotante estable.

---

### TC-B-02 · CSS hostil no oculta, reescribe ni rompe el widget

| Campo | Valor |
|---|---|
| **Trazabilidad** | WDG-02 · CA-04 · RNF-02 · INV-01 |
| **Precondiciones** | Fixture con 5 variantes hostiles: `* { display:none !important }`, `button { display:none !important }`, `font-size:0`, `transform`, `:not(html):not(body)` |
| **Prioridad** | **1** — invariante de aislamiento |
| **Automatización** | **Sí** — J-14 + VRT; la matriz es estable |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Cargar cada variante con un elemento de control afectado por la regla → *Esperado:* el control demuestra que la regla se aplica (prueba no vacua).
2. Verificar el lanzador → *Esperado:* sigue visible, con tamaño y posición correctos, y recibe clics.
3. Abrir el widget → *Esperado:* el diálogo/compositor muestra su contenido completo, legible y por encima del host.
4. Repetir con el bundle de producción (shadow root cerrado) → *Esperado:* mismo resultado.

**Resultado final esperado:** ninguna regla CSS del host altera la visibilidad, el layout ni la interactividad del widget.

---

### TC-B-03 · Cero fugas y un único global

| Campo | Valor |
|---|---|
| **Trazabilidad** | WDG-03, WDG-04 · INV-01, INV-02 |
| **Precondiciones** | Página host con estilos y variables propias; snapshot inicial de `window` y prototipos |
| **Prioridad** | **2** — invariante de convivencia con el host |
| **Automatización** | **Sí** — J-01/J-14; deltas de superficie y estilos computados |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Capturar `Object.keys(window)` y prototipos nativos antes de cargar la SDK → *Esperado:* snapshot base.
2. Inicializar y completar un reporte → *Esperado:* el delta de `window` es exactamente `Watchbug` en IIFE; cero en ESM; ningún prototipo cambia.
3. Recorrer todos los elementos del host, incluido `watchbug-host` → *Esperado:* no aparece ninguna clase, hoja de estilos ni custom property `--wb-*` en el documento host.
4. Inspeccionar `document.head`/`body` → *Esperado:* no se inyectan `<style>` ni clases de la SDK.

**Resultado final esperado:** el widget vive aislado y el host no puede observar ni romper su estado interno.

---

### TC-B-04 · Apilamiento, z-index y DOM order

| Campo | Valor |
|---|---|
| **Trazabilidad** | WDG-05 |
| **Precondiciones** | Host con modal de `z-index` máximo, elemento fijo en las coordenadas del widget, y reemplazo de `documentElement` |
| **Prioridad** | **3** — escenario hostil poco frecuente |
| **Automatización** | **Sí** — J-14; geometría y `elementFromPoint` |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Abrir el widget sobre un modal hostil con `z-index` máximo → *Esperado:* el widget queda por encima y el flujo se completa.
2. Colocar un elemento fijo en las coordenadas del lanzador → *Esperado:* no captura el hit target ni absorbe los clics del host.
3. Provocar un empate de `z-index` → *Esperado:* el orden DOM resuelve a favor del widget.
4. Reemplazar `document.documentElement` → *Esperado:* el host del widget se re-apenda y sigue operativo.

**Resultado final esperado:** el widget gana el concurso de apilamiento en todos los escenarios documentados.

---

### TC-B-05 · Inglés y español en el núcleo del widget

| Campo | Valor |
|---|---|
| **Trazabilidad** | WDG-06 · RNF-03 · US-1 |
| **Precondiciones** | Navegador con `locale: 'es-ES'`; página con la SDK |
| **Prioridad** | **2** — requisito de producto y accesibilidad |
| **Automatización** | **Sí** — J-12; `lang` y copy renderizado |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Cargar con `navigator.language = 'es-ES'` → *Esperado:* lanzador, estado, compositor y revisión en español; `.wrap[lang="es"]`.
2. Cambiar manualmente a inglés → *Esperado:* todo el copy del núcleo cambia a inglés; `lang="en"`; no se escribe en storage del host.
3. Recargar → *Esperado:* se aplica la política de persistencia decidida (sesión en memoria o almacenamiento propio del widget), sin tocar cookies/localStorage del host.
4. Repetir con un idioma no español → *Esperado:* inglés por defecto.

**Resultado final esperado:** el widget se adapta al idioma del navegador y permite override manual sin violar SEC-03.

---

### TC-B-06 · Inglés y español en el editor lazy

| Campo | Valor |
|---|---|
| **Trazabilidad** | WDG-06 · PRF-02 |
| **Precondiciones** | Captura o adjunto disponible; editor descargado |
| **Prioridad** | **2** — coherencia de idioma en toda la superficie |
| **Automatización** | **Sí** — J-12 |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Abrir el editor con locale ES → *Esperado:* herramientas, ayuda, botón «Listo» y diálogo de máscara en español.
2. Cambiar a EN y reabrir el editor → *Esperado:* chrome del editor en inglés, sin recargar la página.
3. Verificar el chunk → *Esperado:* el diccionario del editor viaja en el chunk lazy, no en el core.

**Resultado final esperado:** el editor localiza su propia interfaz sin engordar el bundle inyectado.

---

## 3. Grupo C — Captura y adjunto

### TC-C-01 · Captura real de la pestaña actual

| Campo | Valor |
|---|---|
| **Trazabilidad** | CAP-01 · US-1 |
| **Precondiciones** | Navegador headed; producción `watchbug.js`; página con contenido real; permiso de captura disponible |
| **Prioridad** | **1** — funcionalidad central |
| **Automatización** | **No** — el picker del sistema operativo no es determinista; la suite usa stubs por motor |
| **Ejecutabilidad** | ✅ Hoy (manual real) |

**Pasos y resultado esperado**

1. Abrir la página en Chromium headed con `viewport: null` → *Esperado:* sin viewport emulado; el tamaño real de la pestaña es el que se capturará.
2. Pulsar el lanzador y aceptar el picker del sistema → *Esperado:* aparece el picker; se elige la pestaña actual; el host se oculta durante la captura.
3. Observar el compositor → *Esperado:* muestra el contenido real de la pestaña, con dimensiones coherentes (`blob.width === innerWidth × devicePixelRatio`).
4. Enviar → *Esperado:* 201 y fila visible en el panel.

**Resultado final esperado:** la captura representa fielmente lo que el usuario ve, sin desplazamientos ni frames en blanco.

---

### TC-C-02 · La captura nunca contiene el widget

| Campo | Valor |
|---|---|
| **Trazabilidad** | CAP-04 · US-1 |
| **Precondiciones** | Captura válida; imagen descargable del panel |
| **Prioridad** | **1** — integridad visual del reporte |
| **Automatización** | **Sí** — J-03; análisis de píxeles del artefacto |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Capturar con el lanzador visible → *Esperado:* el host se oculta de forma síncrona antes de `getDisplayMedia`.
2. Confirmar que el pipeline falla si el host no está oculto → *Esperado:* estado de error ruidoso, nunca frame contaminado.
3. Descargar y decodificar la imagen enviada → *Esperado:* cero píxeles del color de acento del widget; no aparece el lanzador ni el panel.

**Resultado final esperado:** el artefacto no se autofotografía; la garantía vive en el código, no en el orden de llamadas.

---

### TC-C-03 · Límites de 16 MP, 2 MB y HiDPI no blanco

| Campo | Valor |
|---|---|
| **Trazabilidad** | CAP-05 · R-11 |
| **Precondiciones** | Fixtures de 4000×4000 (16 MP), 9000 px de ancho, DPR 2 y DPR 3 |
| **Prioridad** | **1** — evita capturas corruptas o rechazos del servidor |
| **Automatización** | **Sí** — J-08; matriz DPR con Playwright |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Capturar un frame de 4000×4000 → *Esperado:* se entrega dentro de 16 MP y ≤ 2 MB; la imagen decodifica y no está en blanco.
2. Capturar un frame de 9000 px de ancho → *Esperado:* se reduce por lado a ≤ 8192 px antes de codificar.
3. Capturar con `deviceScaleFactor: 2` → *Esperado:* imagen no blanca, dimensiones esperadas.
4. Capturar con DPR 3 → *Esperado:* el DPR se limita a 2 antes de codificar; sin imagen en blanco.
5. Repetir en los tres motores → *Esperado:* mismo contrato, con la ruta de captura propia de cada motor.

**Resultado final esperado:** toda captura entregada respeta los topes y sigue siendo una imagen útil en pantallas HiDPI.

---

### TC-C-04 · Fallo de captura: estado degradado y envío text-only

| Campo | Valor |
|---|---|
| **Trazabilidad** | CAP-03 · US-2, US-3 |
| **Precondiciones** | Poder denegar el permiso, eliminar `getDisplayMedia`, capturar una página en blanco y una imagen sobredimensionada |
| **Prioridad** | **1** — la degradación es parte del producto, no un error |
| **Automatización** | **Sí** — J-07; estados y cero peticiones antes de elegir |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Denegar el permiso de captura → *Esperado:* compositor degradado con aviso «captura no disponible» y dos acciones: «Adjuntar imagen» / «Continuar solo con texto».
2. Repetir sin `getDisplayMedia` → *Esperado:* mismo estado degradado; no hay excepción no controlada.
3. Capturar una página uniforme → *Esperado:* se detecta como blanca; nunca se envía en silencio.
4. Antes de elegir una acción → *Esperado:* cero POST.
5. Elegir «Continuar solo con texto», completar y enviar → *Esperado:* 201 real con `contentType: null`; el panel muestra el reporte sin `<img>` roto.

**Resultado final esperado:** cualquier fallo de captura termina en una salida útil y visible, nunca en un callejón sin salida ni en una imagen en blanco.

---

### TC-C-05 · Adjuntar una imagen válida desde el dispositivo

| Campo | Valor |
|---|---|
| **Trazabilidad** | CAP-02 · US-1, US-3 |
| **Precondiciones** | Archivos PNG, WebP y JPEG válidos; compositor abierto |
| **Prioridad** | **1** — vía alternativa principal |
| **Automatización** | **Sí** — J-07; file input real y bytes decodificados |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Elegir «Adjuntar imagen» y seleccionar un PNG → *Esperado:* preview correcta; el compositor conserva título, tipo y nota.
2. Anotar y enmascarar la imagen → *Esperado:* el editor y las máscaras funcionan igual que sobre una captura; T1 no aplica, T2/T3 sí.
3. Revisar → *Esperado:* la imagen revisada es el artefacto que se enviará.
4. Enviar → *Esperado:* 201; el tipo almacenado es WebP o PNG (el adjunto se re-codifica en el cliente); el servidor no recibe un JPEG del cliente.
5. Repetir con WebP y JPEG → *Esperado:* ambos se aceptan y se normalizan por el mismo sink.

**Resultado final esperado:** adjuntar es un camino de primera clase, con la misma revisión y el mismo enmascarado que la captura.

---

### TC-C-06 · Rechazo de adjuntos inválidos o sobredimensionados

| Campo | Valor |
|---|---|
| **Trazabilidad** | CAP-02, CAP-03 · ING-06 · SEC-05 |
| **Precondiciones** | Archivo no-imagen, SVG, GIF/HTML polyglot, imagen > 16 MP, imagen > 2 MB |
| **Prioridad** | **3** — error de usuario poco frecuente |
| **Automatización** | **Sí** — J-07 + integración de allowlist |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Seleccionar un `.txt` renombrado a `.png` → *Esperado:* error inline; no se decodifica ni se envía.
2. Seleccionar un SVG → *Esperado:* rechazo; SVG es formato activo, no permitido.
3. Seleccionar un GIF/HTML polyglot → *Esperado:* rechazo por magic bytes, no por extensión.
4. Seleccionar una imagen > 16 MP → *Esperado:* rechazo antes de crear un canvas que pueda bloquear el navegador.
5. Confirmar la petición → *Esperado:* cero requests; el estado previo del compositor se conserva.

**Resultado final esperado:** el cliente rechaza lo que el servidor también rechazaría, con un mensaje claro y sin efectos laterales.

---

### TC-C-07 · Fallback silencioso WebP → PNG

| Campo | Valor |
|---|---|
| **Trazabilidad** | CA-01 (tipo de imagen) · R-11 · A-14 |
| **Precondiciones** | Entorno o stub que fuerce `toBlob(..., 'image/webp')` a devolver PNG |
| **Prioridad** | **4** — caso de motor poco frecuente |
| **Automatización** | **Sí** — J-09; stub forzado a PNG |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Forzar el encoder a devolver un blob PNG aunque se pida WebP → *Esperado:* la SDK inspecciona `blob.type` y los magic bytes, no confía en la petición.
2. Enviar el reporte → *Esperado:* la parte se llama `.png`, `Content-Type: image/png` y el servidor responde 201.
3. Repetir con WebP real → *Esperado:* se usa `.webp`/`image/webp`; no se fuerza PNG innecesariamente.

**Resultado final esperado:** el fallback se detecta por contenido y el reporte sigue siendo válido en cualquier motor.

---

## 4. Grupo D — Anotación y editor lazy

### TC-D-01 · Mano alzada, flecha y rectángulo

| Campo | Valor |
|---|---|
| **Trazabilidad** | ANN-01, ANN-02, ANN-03 · US-1 |
| **Precondiciones** | Editor abierto sobre una imagen |
| **Prioridad** | **1** — herramientas principales de anotación |
| **Automatización** | **Sí** — J-06; análisis de bandas de píxeles |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Seleccionar mano alzada y arrastrar → *Esperado:* la tinta sigue el camino del puntero; las zonas fuera del trazo no cambian.
2. Seleccionar flecha y arrastrar → *Esperado:* se pinta un eje y una cabeza más ancha que el eje, orientada al destino.
3. Seleccionar rectángulo y arrastrar → *Esperado:* se dibujan los cuatro bordes; el interior queda intacto.
4. Pulsar «Listo» → *Esperado:* los trazos se aplanan sobre el bitmap del draft y vuelven al compositor.

**Resultado final esperado:** las tres herramientas producen geometría reconocible y el resultado se conserva al salir del editor.

---

### TC-D-02 · Etiqueta de texto

| Campo | Valor |
|---|---|
| **Trazabilidad** | ANN-04 · US-1 |
| **Precondiciones** | Editor abierto; herramienta texto |
| **Prioridad** | **2** — herramienta secundaria frecuente |
| **Automatización** | **Sí** — J-06; typing real sobre el overlay |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Hacer clic en el canvas, escribir un texto y pulsar Enter → *Esperado:* el texto se dibuja en tinta de acento de 15 px, sin modal.
2. Repetir y confirmar haciendo clic fuera → *Esperado:* también se confirma.
3. Confirmar una etiqueta vacía → *Esperado:* no se dibuja nada.
4. Escribir un texto no-ASCII (p. ej. `áéíóú 日本語`) → *Esperado:* se dibuja literal, sin sustitución ni recorte.

**Resultado final esperado:** el usuario puede añadir anotaciones textuales legibles y el editor no inventa contenido.

---

### TC-D-03 · Undo por trazo y persistencia del primer trazo

| Campo | Valor |
|---|---|
| **Trazabilidad** | ANN-06 · US-1 |
| **Precondiciones** | Editor abierto; al menos dos trazos |
| **Prioridad** | **1** — control de corrección básico |
| **Automatización** | **Sí** — J-06 |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Dibujar dos trazos distinguibles (p. ej. un círculo y una línea) → *Esperado:* ambos visibles.
2. Pulsar deshacer → *Esperado:* desaparece sólo el último trazo; el primero permanece.
3. Dibujar otro trazo y pulsar Ctrl/Cmd+Z → *Esperado:* mismo efecto que el botón.
4. Dibujar 21 trazos y pulsar «Listo» → *Esperado:* el primer trazo sigue en la imagen exportada; no se pierde por el límite de pila.

**Resultado final esperado:** el undo quita exactamente un trazo y nunca evapora tinta ya comprometida.

---

### TC-D-04 · Undo nunca deshace una máscara

| Campo | Valor |
|---|---|
| **Trazabilidad** | ANN-06, ANN-05 · PRV-04 |
| **Precondiciones** | Editor abierto; una máscara ya confirmada y un trazo posterior |
| **Prioridad** | **3** — edge de privacidad relevante |
| **Automatización** | **Sí** — J-05/J-06; píxeles del artefacto |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Aplicar una máscara opaca sobre una región con contenido → *Esperado:* la región queda destruida.
2. Dibujar un trazo encima y pulsar deshacer → *Esperado:* desaparece el trazo; la máscara permanece destruida.
3. Pulsar deshacer varias veces → *Esperado:* no se recupera ningún píxel original de la máscara.
4. Exportar y decodificar → *Esperado:* la región sigue siendo relleno opaco.

**Resultado final esperado:** el undo es una comodidad de anotación, no un mecanismo de recuperación de datos enmascarados.

---

### TC-D-05 · Carga lazy del editor: una sola descarga y sin global

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRF-02, PRF-03 · WDG-04 |
| **Precondiciones** | Compositor abierto; red observable |
| **Prioridad** | **2** — presupuesto y rendimiento |
| **Automatización** | **Sí** — J-13; conteo de requests y snapshot de `window` |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Abrir el compositor sin pulsar «Anotar» → *Esperado:* cero peticiones al chunk del editor.
2. Pulsar «Anotar» → *Esperado:* exactamente una petición al chunk; aparece el estado de carga y luego el editor.
3. Comprobar `window` → *Esperado:* ninguna propiedad global nueva.
4. Cerrar y reabrir el editor → *Esperado:* se reutiliza el chunk memoizado; no se vuelve a descargar.
5. Simular un fallo de carga → *Esperado:* el botón se rehabilita con error inline; el reintento abre el editor.

**Resultado final esperado:** el editor no pesa en la carga inicial y su fallo no bloquea el reporte.

---

### TC-D-06 · Geometría de máscara en DPR 1, 1.25, 2 y 3

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRV-04 · ANN-05 · H-1 |
| **Precondiciones** | Editor abierto; `deviceScaleFactor` controlado; imagen con marcas de referencia |
| **Prioridad** | **3** — caso de pantallas HiDPI, impacto alto si falla |
| **Automatización** | **Sí** — J-05/J-08; matriz DPR |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Arrastrar una máscara en DPR 1 → *Esperado:* la máscara cae exactamente donde se arrastró, con ring de 1 px limpio.
2. Repetir en DPR 1.25 → *Esperado:* sin desplazamiento por escala no entera.
3. Repetir en DPR 2 y DPR 3 → *Esperado:* la geometría se calcula en espacio bitmap; DPR 3 se limita a 2 al codificar sin mover la máscara.
4. Verificar los cuatro artefactos → *Esperado:* cero caracteres originales visibles en el borde.

**Resultado final esperado:** la máscara no se desplaza ni deja franjas legibles en ninguna escala de pantalla.

---

## 5. Grupo E — Privacidad, enmascarado y revisión

### TC-E-01 · Enmascarado automático de `input[type=password]`

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRV-01 · SEC-01 · CA-02 |
| **Precondiciones** | Página con un campo password relleno con un valor reconocible |
| **Prioridad** | **1** — seguridad de datos |
| **Automatización** | **Sí** — J-04; bytes decodificados |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Capturar la página → *Esperado:* el valor del campo aparece ya enmascarado en la imagen que ve el usuario.
2. Enviar e interceptar la petición → *Esperado:* el valor original no aparece en ningún byte de la imagen.
3. Decodificar la región → *Esperado:* relleno opaco plano; el rect y su anillo de 1 px no contienen píxeles originales.
4. Repetir en los tres motores → *Esperado:* mismo resultado.

**Resultado final esperado:** una contraseña nunca sale del navegador, ni siquiera en los bordes de la máscara.

---

### TC-E-02 · Patrones de credenciales, tokens y tarjetas

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRV-02 · SEC-01 · CA-02 |
| **Precondiciones** | Página con JWT, `Bearer sk-…`, `api_token=…`, tarjeta Luhn válida, tarjeta Luhn inválida y dos tarjetas pegadas |
| **Prioridad** | **1** — catálogo de fuga más sensible |
| **Automatización** | **Sí** — J-04; artefacto + unit de patrones |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Capturar y decodificar → *Esperado:* JWT, Bearer y asignaciones enmascaran el nodo de texto completo.
2. Verificar la tarjeta Luhn válida → *Esperado:* enmascarada.
3. Verificar la tarjeta Luhn inválida → *Esperado:* visible; el falso positivo no se come texto legítimo.
4. Verificar dos tarjetas pegadas → *Esperado:* el nodo completo se enmascara; no queda una mitad legible.
5. Comprobar un JWT *lookalike* sin `eyJ` → *Esperado:* visible; el patrón no sobreactúa.

**Resultado final esperado:** el catálogo enmascara lo que debe y conserva lo que no, con el nodo completo como unidad segura.

---

### TC-E-03 · Enmascarado de `data-watchbug-sensitive`

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRV-03 · SEC-01 |
| **Precondiciones** | Página con un bloque marcado y texto reconocible en su interior |
| **Prioridad** | **2** — control explícito del integrador |
| **Automatización** | **Sí** — J-04 |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Capturar → *Esperado:* el rect completo del elemento marcado queda opaco, redondeado hacia fuera.
2. Decodificar → *Esperado:* cero píxeles originales dentro del rect y su anillo.
3. Comprobar un elemento vecino no marcado → *Esperado:* permanece visible; no hay sobre-enmascarado por contaminación.

**Resultado final esperado:** el host puede señalar datos sensibles y la SDK los destruye sin afectar al resto.

---

### TC-E-04 · Máscara de relleno opaco: destrucción real en el artefacto

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRV-04 · CA-02 · SEC-02 · ANN-05 |
| **Precondiciones** | Imagen con una región de color/marcas únicas; editor abierto |
| **Prioridad** | **1** — criterio de aceptación central |
| **Automatización** | **Sí** — J-05; decodificación del blob enviado |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Aplicar máscara de relleno sobre la región marcada → *Esperado:* la región se vuelve `rgb(0,0,0)` α255.
2. Enviar e interceptar el blob → *Esperado:* el artefacto contiene la máscara, no una capa CSS superpuesta.
3. Decodificar el rect completo y su anillo de 1 px → *Esperado:* cero píxeles con los valores originales; 100 % del interior es relleno opaco.
4. Repetir con la imagen girada o reescalada → *Esperado:* la máscara sigue en la región correcta.

**Resultado final esperado:** la información enmascarada es irrecuperable desde los bytes codificados, no sólo invisible en pantalla.

---

### TC-E-05 · Pixelación opt-in con bloque mínimo

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRV-04 · ANN-05 · R-13 |
| **Precondiciones** | Editor; herramienta máscara; texto de altura de capital conocida |
| **Prioridad** | **2** — alternativa de enmascarado |
| **Automatización** | **Parcial** — el mecanismo se mide; la irreversibilidad visual exige ojo humano |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Activar el modo «Pixelar» → *Esperado:* sólo aparece para la herramienta máscara; por defecto sigue «Relleno».
2. Aplicar sobre texto → *Esperado:* bloques de tamaño ≥ `max(8 px, 2 × altura de capital)`, alineados a la rejilla, opacos.
3. Decodificar → *Esperado:* cada bloque es la media de sus píxeles; no se distingue ninguna letra.
4. Comparar con la región sin tocar → *Esperado:* la densidad de bordes cae de forma drástica; no hay contornos legibles.

**Resultado final esperado:** la pixelación es una opción real, no un blur reversible, y cumple el mínimo de bloque de R-13.

---

### TC-E-06 · La tinta posterior no resucita la máscara

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRV-04 · ANN-06 · C-2/T3 |
| **Precondiciones** | Máscara aplicada; herramienta de mano alzada |
| **Prioridad** | **3** — edge adversarial de privacidad |
| **Automatización** | **Sí** — J-05; decodificación del artefacto |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Aplicar máscara sobre una región → *Esperado:* destruida.
2. Dibujar un trazo que cruce la máscara → *Esperado:* la tinta se pinta, pero no revela el fondo.
3. Exportar y decodificar → *Esperado:* los píxeles de la máscara siguen siendo relleno; las máscaras se re-aplican como última operación de píxel.
4. Repetir con varias máscaras y trazos → *Esperado:* ninguna combinación recupera el contenido.

**Resultado final esperado:** ninguna anotación puede deshacer físicamente una máscara ya horneada.

---

### TC-E-07 · Confirmación de la primera máscara y no-deshacibilidad

| Campo | Valor |
|---|---|
| **Trazabilidad** | ANN-05, ANN-06 · P3-D-09 |
| **Precondiciones** | Editor abierto; ninguna máscara aplicada en la sesión |
| **Prioridad** | **2** — momento de consentimiento de irreversibilidad |
| **Automatización** | **Sí** — J-05; estado del diálogo y píxeles |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Aplicar la primera máscara → *Esperado:* aparece un `alertdialog` que avisa de que la máscara es permanente; foco dentro; Escape equivale a «Ahora no».
2. Elegir «Ahora no» → *Esperado:* no se hornea nada; el editor sigue abierto.
3. Aplicar de nuevo y confirmar → *Esperado:* la máscara se hornea.
4. Aplicar una segunda máscara → *Esperado:* no vuelve a pedir confirmación.
5. Pulsar deshacer → *Esperado:* no se deshace la máscara.

**Resultado final esperado:** el usuario entiende la irreversibilidad una vez por sesión y el sistema no la relaja después.

---

### TC-E-08 · Revisión antes de enviar: lo que se ve es lo que se envía

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRV-07 · US-3 · P3-D-16 |
| **Precondiciones** | Compositor con imagen anotada y formulario completo |
| **Prioridad** | **1** — control de confianza del usuario |
| **Automatización** | **Sí** — J-02; comparación del blob revisado con el enviado |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Pulsar «Revisar» → *Esperado:* se codifica una sola vez y la pantalla muestra la imagen final aplanada, título, tipo y nota.
2. Comparar la imagen mostrada con el blob que se enviará → *Esperado:* son el mismo artefacto; no hay re-codificación al enviar.
3. Pulsar «Editar» → *Esperado:* vuelve al compositor/editor con el estado intacto.
4. Volver a revisar y pulsar «Enviar» → *Esperado:* exactamente un POST; estado «Report sent ✓».

**Resultado final esperado:** el usuario revisa el artefacto exacto y el envío no introduce cambios posteriores.

---

### TC-E-09 · Sin credenciales del host y URL sólo con path

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRV-05, PRV-06 · SEC-03 · R-08 |
| **Precondiciones** | Host con cookies, `localStorage`, `sessionStorage` y cabecera `Authorization` sembradas con centinelas; URL con `?token=…#frag` |
| **Prioridad** | **2** — invariante de privacidad |
| **Automatización** | **Sí** — J-11; escaneo de todos los bytes de la petición |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Inicializar y enviar un reporte → *Esperado:* sólo salen `X-Project-Key` y `Idempotency-Key`; ningún centinela de cookie/storage/auth aparece.
2. Inspeccionar `meta.url` → *Esperado:* sólo path; query y fragmento eliminados.
3. Inspeccionar cabeceras → *Esperado:* sin `Referer`; `credentials: omit`.
4. Repetir en Chromium, Firefox y WebKit → *Esperado:* mismo contrato; las diferencias de motor no abren una vía de fuga.

**Resultado final esperado:** la SDK no lee ni transmite credenciales del host y no filtra parámetros de URL.

---

## 6. Grupo F — Payload, contrato y enriquecimiento

### TC-F-01 · Validación contra el esquema JSON oficial

| Campo | Valor |
|---|---|
| **Trazabilidad** | ENR-06 · CA-01 |
| **Precondiciones** | Esquema `schema/report.schema.json` emitido; API arriba |
| **Prioridad** | **1** — contrato CA-01 |
| **Automatización** | **Sí** — contract suite + integración |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Enviar un reporte `bug` válido → *Esperado:* 201; la fila almacenada valida contra el esquema publicado.
2. Enviar un campo desconocido → *Esperado:* 400; no se almacena.
3. Enviar título de 200 code points y de 201 → *Esperado:* 200 se acepta; 201 se rechaza; el conteo es por code points, no UTF-16.
4. Enviar `meta` ausente o vacío → *Esperado:* 400 estructurado nombrando el campo.
5. Enviar varios errores → *Esperado:* se listan en orden estable de campos.

**Resultado final esperado:** todo lo que se almacena cumple el contrato único y todo lo que no cumple se rechaza con un error accionable.

---

### TC-F-02 · Un `bug` siempre lleva logs de consola

| Campo | Valor |
|---|---|
| **Trazabilidad** | ENR-01 · CA-01 · US-1 |
| **Precondiciones** | Fase 4 implementada; página que emite `console.log/warn/error` antes del reporte |
| **Prioridad** | **1** — evidencia para reproducir |
| **Automatización** | **Sí** — payload inspeccionable |
| **Ejecutabilidad** | 🟡 Prospectivo (Fase 4) |

**Pasos y resultado esperado**

1. Emitir varios logs reconocibles → *Esperado:* se capturan con nivel, mensaje, timestamp y orden.
2. Enviar un reporte `bug` → *Esperado:* el payload incluye `consoleLogs` no vacío.
3. Intentar enviar un `bug` sin el campo `consoleLogs` → *Esperado:* rechazo; el campo es obligatorio aunque el array pueda estar vacío si no hubo logs.
4. Inspeccionar secretos en los logs → *Esperado:* JWT, Bearer y tarjetas se han scrubbeado antes de salir.

**Resultado final esperado:** todo bug lleva la evidencia de consola necesaria y ningún secreto viaja dentro de ella.

---

### TC-F-03 · Un `feedback` puede enviarse sin logs

| Campo | Valor |
|---|---|
| **Trazabilidad** | ENR-02 · CA-01 · US-2 |
| **Precondiciones** | Fase 4 implementada; compositor en modo feedback |
| **Prioridad** | **2** — flujo secundario principal |
| **Automatización** | **Sí** — integración |
| **Ejecutabilidad** | 🟡 Prospectivo (Fase 4) |

**Pasos y resultado esperado**

1. Seleccionar «Feedback» y escribir una nota → *Esperado:* no se exige captura ni logs.
2. Enviar sin logs → *Esperado:* 201; el payload no lleva `consoleLogs` o los lleva vacíos, según el contrato.
3. Enviar un `bug` sin logs → *Esperado:* rechazo; la condicionalidad se aplica solo a `bug`.
4. Verificar el panel → *Esperado:* el feedback se distingue del bug y se muestra sin errores.

**Resultado final esperado:** el feedback no obliga a adjuntar evidencia técnica; el bug sí.

---

### TC-F-04 · Metadatos de entorno completos

| Campo | Valor |
|---|---|
| **Trazabilidad** | ENR-03 |
| **Precondiciones** | Fase 4 implementada; viewport, pantalla y locale conocidos |
| **Prioridad** | **2** — reproducibilidad del bug |
| **Automatización** | **Sí** — payload contrastado con APIs del navegador |
| **Ejecutabilidad** | 🟡 Prospectivo (Fase 4) |

**Pasos y resultado esperado**

1. Enviar un reporte → *Esperado:* el payload lleva path, user agent, viewport, resolución de pantalla, devicePixelRatio, idioma, timezone y timestamp.
2. Contrastar cada valor con el navegador → *Esperado:* coinciden; no hay valores inventados.
3. Cambiar viewport/idioma/timezone y repetir → *Esperado:* los valores reflejan el entorno actual.
4. Verificar que la URL no lleva query/fragment → *Esperado:* sigue siendo path-only.

**Resultado final esperado:** el desarrollador recibe el entorno exacto en el que ocurrió el bug.

---

### TC-F-05 · `appVersion`, `custom` y `user` de inicialización

| Campo | Valor |
|---|---|
| **Trazabilidad** | ENR-04 · INT-03 · R-09 |
| **Precondiciones** | Fase 4 implementada; host que pasa contexto |
| **Prioridad** | **2** — contexto de integración |
| **Automatización** | **Sí** — payload |
| **Ejecutabilidad** | 🟡 Prospectivo (Fase 4) |

**Pasos y resultado esperado**

1. Inicializar con `appVersion: '2.4.1'` y `custom: { plan: 'pro', region: 'eu' }` → *Esperado:* el contexto queda asociado a la instancia.
2. Enviar dos reportes distintos → *Esperado:* ambos llevan la misma `appVersion` y el mismo `custom`.
3. Verificar la forma → *Esperado:* `custom` es un objeto de contexto init-scoped, no un campo libre por reporte.
4. Enviar sin `user` → *Esperado:* no se inventa identidad; el reporte sigue siendo válido.

**Resultado final esperado:** el contexto del host viaja de forma consistente y acotada, sin convertirse en un canal libre.

---

### TC-F-06 · Buffer de consola acotado y sin recursión

| Campo | Valor |
|---|---|
| **Trazabilidad** | ENR-05 · RNF-01 |
| **Precondiciones** | Fase 4 implementada; página capaz de emitir cientos de logs y objetos circulares |
| **Prioridad** | **4** — edge de abuso/DoS |
| **Automatización** | **Sí** — unit + integración con límites |
| **Ejecutabilidad** | 🟡 Prospectivo (Fase 4) |

**Pasos y resultado esperado**

1. Emitir 150 logs → *Esperado:* se conservan los 100 últimos; se informa «N earlier messages dropped».
2. Emitir un mensaje de 10 000 caracteres → *Esperado:* se trunca al límite por mensaje (2 048/1 024 según campo).
3. Emitir un error con stack enorme → *Esperado:* stack truncado a 8 192 caracteres.
4. Emitir objetos circulares y `Request` con cabeceras → *Esperado:* serialización eager, sin referencias, sin secretos.
5. Comprobar el total → *Esperado:* el buffer no supera 48 KB; no se produce recursión por los logs de la propia SDK.

**Resultado final esperado:** la captura de consola es útil pero acotada, sin poder congelar la pestaña ni exfiltrar secretos.

---

## 7. Grupo G — Transporte e ingesta

### TC-G-01 · Envío multipart y persistencia visible

| Campo | Valor |
|---|---|
| **Trazabilidad** | ING-01 · US-1, US-6 · CA-01 |
| **Precondiciones** | Compositor con imagen y metadatos; API arriba; project key válida |
| **Prioridad** | **1** — camino de datos principal |
| **Automatización** | **Sí** — J-02 + integración |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Pulsar «Enviar» → *Esperado:* una sola petición `multipart/form-data` con partes `meta` e `image`, `X-Project-Key` e `Idempotency-Key`.
2. Recibir la respuesta → *Esperado:* 201 con id del reporte.
3. Abrir el panel y recargar → *Esperado:* el reporte aparece con su imagen y metadatos.
4. Inspeccionar la fila y el volumen → *Esperado:* una fila; un blob bajo clave generada por el servidor; no se usa el nombre del cliente.

**Resultado final esperado:** imagen y metadatos cruzan la red y quedan persistidos de forma visible y segura.

---

### TC-G-02 · Idempotencia, reintento y concurrencia

| Campo | Valor |
|---|---|
| **Trazabilidad** | ING-03 · P2-D-03 |
| **Precondiciones** | Petición válida; capacidad de simular 500/429/timeout y de lanzar dos peticiones concurrentes |
| **Prioridad** | **1** — evita duplicados y pérdidas |
| **Automatización** | **Sí** — integración + J-10 |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Enviar con una `Idempotency-Key` y repetir la misma petición → *Esperado:* 201 y luego 200 con el mismo id; una sola fila.
2. Lanzar dos peticiones concurrentes con la misma clave → *Esperado:* exactamente una fila; nunca dos.
3. Simular un 500 transitorio → *Esperado:* reintento automático con la misma clave y los mismos bytes; el panel muestra «Retrying (n of 3)».
4. Simular un 400 de contrato → *Esperado:* fallo inmediato, mensaje del servidor, sin reintento.
5. Verificar el panel → *Esperado:* un solo reporte, estado final correcto.

**Resultado final esperado:** un envío reintentado no duplica el reporte y un error de contrato no se reintenta a ciegas.

---

### TC-G-03 · Cola durable ante cierre de pestaña o red caída

| Campo | Valor |
|---|---|
| **Trazabilidad** | ING-02 · US-6 |
| **Precondiciones** | Fase 7 implementada; IndexedDB disponible; red conmutable offline |
| **Prioridad** | **2** — resiliencia de uso real |
| **Automatización** | **Sí** — e2e de unload + integración de dedupe |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 7) |

**Pasos y resultado esperado**

1. Enviar un reporte y cortar la red justo después → *Esperado:* el reporte queda en cola; el panel muestra un estado de reintento visible, nunca un drop silencioso.
2. Cerrar la pestaña y reabrir la aplicación → *Esperado:* en `pageshow`/visibility se vacía la cola con la misma `Idempotency-Key`.
3. Recuperar la red → *Esperado:* el reporte llega exactamente una vez; el servidor deduplica si hubo doble flush.
4. Probar con IndexedDB deshabilitado → *Esperado:* cola en memoria + estado de reintento visible; no hay pérdida silenciosa.
5. Superar el tope de la cola → *Esperado:* se aplica la política documentada (cuenta/bytes) sin bloquear la pestaña.

**Resultado final esperado:** un reporte sobrevive al cierre y a una red intermitente, sin duplicados y sin pérdidas invisibles.

---

### TC-G-04 · Clave de proyecto inválida

| Campo | Valor |
|---|---|
| **Trazabilidad** | ING-04 · SEC-05 |
| **Precondiciones** | API arriba; claves ausente, desconocida y malformada |
| **Prioridad** | **2** — control de acceso a la ingesta |
| **Automatización** | **Sí** — integración hostile |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Enviar sin `X-Project-Key` → *Esperado:* 401 estructurado uniforme; nada almacenado.
2. Enviar con clave desconocida → *Esperado:* mismo 401; sin oráculo de existencia.
3. Enviar con clave malformada → *Esperado:* mismo 401.
4. Lanzar un burst de claves inválidas → *Esperado:* cada una recibe su 401; ninguna escritura.
5. Revisar el log → *Esperado:* no se filtra la clave ni se distingue el motivo entre los tres casos.

**Resultado final esperado:** sin una clave válida no entra nada y el atacante no aprende si una clave existe.

---

### TC-G-05 · Límites de tasa por clave, IP y día

| Campo | Valor |
|---|---|
| **Trazabilidad** | ING-05 · SEC-05 |
| **Precondiciones** | Límites de prueba pequeños y deterministas; capacidad de simular IP y clave |
| **Prioridad** | **1** — abuso y disponibilidad |
| **Automatización** | **Sí** — integración hostile |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Enviar hasta el máximo por clave → *Esperado:* pasan exactamente las permitidas; la siguiente recibe 429 con `Retry-After` entero ≥ 1.
2. Repetir desde una IP distinta → *Esperado:* el bucket por IP se aplica de forma independiente.
3. Alcanzar el cupo diario por proyecto → *Esperado:* 429 con `Retry-After`; no se reinicia por cambiar de IP.
4. Enviar una clave con padding NBSP → *Esperado:* comparte bucket con la clave sin padding; no se acuña cuota nueva.
5. Falsear el `X-Forwarded-For` → *Esperado:* nginx lo sobrescribe; no se obtiene un bucket nuevo.
6. Revisar el panel → *Esperado:* las peticiones rechazadas no crean filas.

**Resultado final esperado:** ningún cliente puede eludir los límites cambiando de IP, de padding o de cabecera.

---

### TC-G-06 · Rechazo de cuerpos e imágenes sobredimensionadas

| Campo | Valor |
|---|---|
| **Trazabilidad** | ING-06 · SEC-05 |
| **Precondiciones** | Fixtures > 5 MB de cuerpo, > 4 MB de parte, > 2 MB codificado, > 16 MP, lado > 8192 |
| **Prioridad** | **2** — abuso de recursos |
| **Automatización** | **Sí** — integración hostile |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Enviar cuerpo declarado > 5 MB → *Esperado:* 413 desde la pre-lectura de `Content-Length`; el cuerpo no se bufferea.
2. Enviar cuerpo chunked sin `Content-Length` > 5 MB → *Esperado:* 413 por contador de streaming.
3. Enviar parte de imagen > 4 MB → *Esperado:* 413 en el parser.
4. Enviar imagen codificada > 2 MB → *Esperado:* 413 semántico.
5. Enviar imagen > 16 MP o lado > 8192 → *Esperado:* 400 antes de decodificar.
6. Revisar volumen y BD → *Esperado:* ningún archivo temporal huérfano, ninguna fila.

**Resultado final esperado:** un envío hostil no consume memoria ni disco y se rechaza con el código correcto.

---

### TC-G-07 · Sanitización de texto hostil y render inerte

| Campo | Valor |
|---|---|
| **Trazabilidad** | ING-07 · SEC-05 |
| **Precondiciones** | Payloads `<img src=x onerror=…>`, `<script>`, BOM, UTF-7, entidades, caracteres de control |
| **Prioridad** | **1** — XSS almacenado |
| **Automatización** | **Sí** — integración hostile + J-14 |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Enviar cada payload como título/nota → *Esperado:* se almacena el texto plano; el markup desaparece.
2. Comprobar `2 < 3 & 4 > 1` → *Esperado:* round-trip literal; no se escapa de más.
3. Abrir el panel → *Esperado:* el texto se muestra literal; cero elementos inyectados.
4. Medir los caps → *Esperado:* se cuentan code points; el valor sanitizado no supera el cap.
5. Repetir en concurrencia con marcadores únicos → *Esperado:* no hay contaminación cruzada entre reportes.

**Resultado final esperado:** ningún texto de usuario se ejecuta ni altera el DOM del panel, y el texto legítimo se conserva.

---

### TC-G-08 · Allowlist de orígenes

| Campo | Valor |
|---|---|
| **Trazabilidad** | ING-08 · SEC-05 |
| **Precondiciones** | Origen allowlisted y origen no allowlisted; capacidad de omitir `Origin` |
| **Prioridad** | **2** — control de superficie |
| **Automatización** | **Sí** — integración hostile |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Enviar con `Origin` no allowlisted → *Esperado:* 403; nada almacenado.
2. Enviar con `Origin` allowlisted → *Esperado:* 201 + cabeceras CORS correctas.
3. Enviar sin `Origin` → *Esperado:* 201 (política documentada para clientes no navegador).
4. Lanzar un burst mixto → *Esperado:* cada petición se decide por su propio `Origin`, sin contaminación.

**Resultado final esperado:** sólo los orígenes autorizados pueden ingerir desde un navegador, y la política es consistente.

---

## 8. Grupo H — Autenticación, proyectos y blobs

### TC-H-01 · Login, cookie JWT y logout

| Campo | Valor |
|---|---|
| **Trazabilidad** | TRI-01, TRI-03 · SEC-06 · US-5 |
| **Precondiciones** | Fase 5 implementada; credenciales de admin en `.env`; Argon2id |
| **Prioridad** | **1** — puerta del panel |
| **Automatización** | **Sí** — integración de auth |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 5) |

**Pasos y resultado esperado**

1. Abrir el panel sin sesión → *Esperado:* formulario de login; ninguna ruta de datos responde.
2. Introducir credenciales correctas → *Esperado:* cookie JWT `__Host-`/`HttpOnly`/`Secure`/`SameSite=Lax`; TTL ≤ 8 h; redirección al panel.
3. Introducir contraseña incorrecta → *Esperado:* 401; sin enumeración de usuario; rate limit.
4. Pulsar «Logout» → *Esperado:* cookie invalidada; una petición posterior con la cookie antigua devuelve 401.
5. Inspeccionar el almacenamiento → *Esperado:* el token no es accesible por JS; no hay secretos en `localStorage`.

**Resultado final esperado:** sólo el admin de `.env` obtiene una sesión, y el logout la invalida de verdad.

---

### TC-H-02 · 401 uniforme en todas las rutas de panel

| Campo | Valor |
|---|---|
| **Trazabilidad** | TRI-02 · CA-05 · SEC-06 |
| **Precondiciones** | Fase 5 implementada; inventario de rutas de panel y rutas públicas |
| **Prioridad** | **1** — criterio CA-05 |
| **Automatización** | **Sí** — integración de auth |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 5) |

**Pasos y resultado esperado**

1. Recorrer todas las rutas de panel sin credenciales → *Esperado:* 401 uniforme en cada una; ninguna filtra datos.
2. Repetir con cookie inválida, expirada y manipulada → *Esperado:* 401; no se acepta una firma alterada.
3. Repetir con método incorrecto → *Esperado:* 405 o 401 según política, nunca 200.
4. Probar mutaciones `POST/PATCH/DELETE` → *Esperado:* exigen auth y verificación de `Origin`.
5. Verificar rutas públicas declaradas (`/api/health`, `/api/setup` si aplica) → *Esperado:* siguen públicas y no exponen datos de reportes.

**Resultado final esperado:** CA-05 se cumple en todo el panel y las excepciones públicas están explícitamente justificadas.

---

### TC-H-03 · Crear, seleccionar y renombrar proyecto

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRJ-01, PRJ-02, PRJ-03 · R-06 |
| **Precondiciones** | Fase 5 implementada; sesión de admin |
| **Prioridad** | **2** — gestión habitual |
| **Automatización** | **Sí** — integración + panel |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 5) |

**Pasos y resultado esperado**

1. Crear un proyecto con nombre → *Esperado:* se crea y se muestra una clave pública `wkbt_…` write-only.
2. Copiar la clave → *Esperado:* se puede usar en `init()` y produce 201; no permite leer reportes.
3. Seleccionar el proyecto como activo → *Esperado:* la lista y los contadores se filtran a ese proyecto.
4. Renombrar el proyecto → *Esperado:* el nombre cambia; la clave y los reportes se conservan.
5. Recargar → *Esperado:* la selección y el nombre persisten.

**Resultado final esperado:** el admin gestiona varios proyectos con claves write-only y un proyecto activo claro.

---

### TC-H-04 · Rotación de la clave pública

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRJ-04 · Q-07 |
| **Precondiciones** | Fase 5 implementada; semántica de rotación decidida; un host con la clave antigua |
| **Prioridad** | **3** — operación poco frecuente pero crítica |
| **Automatización** | **Sí** — una vez fijada la semántica |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 5) |

**Pasos y resultado esperado**

1. Pulsar «Rotar clave» → *Esperado:* se genera una clave nueva; se explica la semántica elegida (gracia o corte).
2. Probar la clave nueva → *Esperado:* 201.
3. Probar la clave antigua → *Esperado:* según Q-07: sigue aceptando durante la ventana de gracia o devuelve 401 de inmediato; nunca un comportamiento ambiguo.
4. Revisar el panel → *Esperado:* se muestra el estado de la clave antigua (cuenta atrás o inactiva).
5. Revisar la documentación de integración → *Esperado:* explica cómo redesplegar el host.

**Resultado final esperado:** la rotación es deliberada, visible y no deja hosts rotos por sorpresa.

---

### TC-H-05 · Borrado de proyecto con cascada de reportes y blobs

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRJ-05 · DEP-03 |
| **Precondiciones** | Fase 5 implementada; proyecto con reportes e imágenes |
| **Prioridad** | **4** — operación destructiva poco frecuente |
| **Automatización** | **Sí** — integración + inspección de volumen |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 5) |

**Pasos y resultado esperado**

1. Pulsar «Eliminar proyecto» → *Esperado:* confirmación explícita; se advierte de que se borran reportes e imágenes.
2. Confirmar → *Esperado:* desaparecen los reportes del proyecto y sus blobs; no quedan huérfanos.
3. Intentar abrir un reporte borrado → *Esperado:* 404.
4. Verificar otro proyecto → *Esperado:* intacto.
5. Revisar el volumen → *Esperado:* no quedan archivos del proyecto borrado.

**Resultado final esperado:** borrar un proyecto no deja datos ni archivos residuales y no afecta a otros proyectos.

---

### TC-H-06 · Blob servido sólo por API autenticada y path-safe

| Campo | Valor |
|---|---|
| **Trazabilidad** | DEP-03 · TRI-05 · C-4 |
| **Precondiciones** | Fase 5 implementada; reporte con imagen; URL de blob conocida |
| **Prioridad** | **2** — privacidad del artefacto |
| **Automatización** | **Sí** — integración de auth + headers |
| **Ejecutabilidad** | 🟡 Prospectivo (Fase 5; hoy hay ruta sin auth) |

**Pasos y resultado esperado**

1. Pedir el blob sin sesión → *Esperado:* 401; no se sirve la imagen.
2. Pedir con sesión → *Esperado:* 200 con `nosniff`, `CSP: default-src 'none'; sandbox`, `CORP: same-origin` y `Content-Disposition: attachment`.
3. Intentar un id inexistente → *Esperado:* 404, nunca 400 ni una ruta del sistema.
4. Intentar traversal (`../`, clave manipulada) → *Esperado:* 404; nunca se resuelve fuera del volumen.
5. Acceder al volumen por URL estática → *Esperado:* no existe ruta pública.

**Resultado final esperado:** la imagen sólo se obtiene con sesión válida y el servidor nunca resuelve una ruta nombrada por el cliente.

---

### TC-H-07 · Aislamiento entre múltiples proyectos

| Campo | Valor |
|---|---|
| **Trazabilidad** | R-06 · PRJ-02 · TRI-04 |
| **Precondiciones** | Fase 5/6 implementadas; proyectos A y B con reportes propios |
| **Prioridad** | **3** — multi-proyecto poco frecuente |
| **Automatización** | **Sí** — integración |
| **Ejecutabilidad** | ⬜ Prospectivo (Fases 5–6) |

**Pasos y resultado esperado**

1. Enviar un reporte con la clave de A → *Esperado:* aparece sólo en A.
2. Enviar con la clave de B → *Esperado:* aparece sólo en B.
3. Seleccionar A en el panel → *Esperado:* la lista y los contadores no muestran B.
4. Intentar leer un reporte de B desde una URL de A → *Esperado:* 404/403, no fuga.
5. Borrar A → *Esperado:* B sigue intacto.

**Resultado final esperado:** cada proyecto es una frontera de datos real, no un filtro de UI.

---

## 9. Grupo I — Triaje y ciclo de vida de datos

### TC-I-01 · Lista, filtros y contadores

| Campo | Valor |
|---|---|
| **Trazabilidad** | TRI-04, TRI-10 · US-5 |
| **Precondiciones** | Fase 6 implementada; reportes de tipo bug/feedback, estados Pending/In Progress/Resolved y proyectos A/B |
| **Prioridad** | **1** — pantalla principal del desarrollador |
| **Automatización** | **Sí** — integración + VRT |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 6) |

**Pasos y resultado esperado**

1. Abrir el panel con sesión → *Esperado:* lista de reportes con tipo, estado, proyecto, fecha y título.
2. Filtrar por `bug` → *Esperado:* sólo bugs; el contador coincide con la lista.
3. Filtrar por `Pending` → *Esperado:* sólo pendientes; se puede combinar con tipo y proyecto.
4. Cambiar de proyecto activo → *Esperado:* la lista y los contadores se recalculan.
5. Comprobar los contadores por estado/tipo/proyecto → *Esperado:* coinciden con los datos; no hay conteos obsoletos.

**Resultado final esperado:** el desarrollador encuentra el subconjunto relevante en pocos clics y los números son fiables.

---

### TC-I-02 · Detalle con screenshot, logs y metadatos

| Campo | Valor |
|---|---|
| **Trazabilidad** | TRI-05 · US-5 · DEP-03 |
| **Precondiciones** | Fase 6 implementada; reporte con imagen, logs y metadatos |
| **Prioridad** | **1** — reproducibilidad del bug |
| **Automatización** | **Sí** — integración + panel |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 6) |

**Pasos y resultado esperado**

1. Abrir un reporte desde la lista → *Esperado:* se muestran título, tipo, estado, nota, URL path, entorno y fecha.
2. Ver la imagen → *Esperado:* se carga por la ruta autenticada; no hay imagen roja ni 404.
3. Ver los logs → *Esperado:* nivel, mensaje, timestamp y orden; se indica si hubo descartes.
4. Ver un reporte text-only → *Esperado:* no aparece un `<img>` roto; se muestra «No image».
5. Probar texto hostil almacenado → *Esperado:* se renderiza literal, sin ejecutar nada.

**Resultado final esperado:** el detalle contiene toda la evidencia necesaria para reproducir y no reabre el XSS.

---

### TC-I-03 · Transiciones de estado y reapertura

| Campo | Valor |
|---|---|
| **Trazabilidad** | TRI-06 · US-5 |
| **Precondiciones** | Fase 6 implementada; reporte en Pending |
| **Prioridad** | **1** — flujo de trabajo central |
| **Automatización** | **Sí** — integración |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 6) |

**Pasos y resultado esperado**

1. Pasar de Pending a In Progress → *Esperado:* el estado cambia y persiste tras recargar.
2. Pasar a Resolved → *Esperado:* cambia; se registra la fecha de resolución si el modelo la tiene.
3. Reabrir → *Esperado:* vuelve a Pending/In Progress según la política; no se pierde el historial.
4. Intentar una transición inválida → *Esperado:* rechazo con mensaje; no se corrompe el estado.
5. Verificar los contadores → *Esperado:* reflejan el nuevo estado.

**Resultado final esperado:** el ciclo de vida del reporte es explícito, persistente y consistente con los contadores.

---

### TC-I-04 · Comentarios internos

| Campo | Valor |
|---|---|
| **Trazabilidad** | TRI-07 · US-5 |
| **Precondiciones** | Fase 6 implementada; reporte abierto; sesión de admin |
| **Prioridad** | **3** — colaboración poco frecuente en un solo admin |
| **Automatización** | **Sí** — integración |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 6) |

**Pasos y resultado esperado**

1. Añadir un comentario interno → *Esperado:* se guarda con autor/fecha y aparece en el detalle.
2. Recargar → *Esperado:* el comentario persiste.
3. Añadir texto hostil → *Esperado:* se almacena sanitizado y se renderiza inerte.
4. Verificar el reporte público → *Esperado:* el comentario no se expone al reportero ni al SDK.

**Resultado final esperado:** el admin puede dejar contexto interno sin filtrarlo fuera del panel.

---

### TC-I-05 · Borrado de reporte y su blob

| Campo | Valor |
|---|---|
| **Trazabilidad** | TRI-08 · DEP-03 |
| **Precondiciones** | Fase 6 implementada; reporte con imagen; volumen inspeccionable |
| **Prioridad** | **2** — operación de limpieza habitual |
| **Automatización** | **Sí** — integración + volumen |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 6) |

**Pasos y resultado esperado**

1. Pulsar «Eliminar reporte» → *Esperado:* confirmación explícita.
2. Confirmar → *Esperado:* la fila desaparece de la lista; la URL de detalle devuelve 404.
3. Pedir el blob → *Esperado:* 404; el archivo ya no está en el volumen.
4. Verificar los contadores → *Esperado:* se decrementan.
5. Repetir el borrado → *Esperado:* idempotente o 404, sin error 500.

**Resultado final esperado:** borrar un reporte elimina fila y artefacto, sin dejar huérfanos ni romper el panel.

---

### TC-I-06 · Borrado inmediato de identidad del reportero

| Campo | Valor |
|---|---|
| **Trazabilidad** | TRI-09 · RET-01 · RGPD Art. 18 |
| **Precondiciones** | Fase 6 implementada; reporte con `user.id`, `name`, `email` |
| **Prioridad** | **2** — derecho del interesado |
| **Automatización** | **Sí** — integración + fila |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 6) |

**Pasos y resultado esperado**

1. Pulsar «Borrar identidad» → *Esperado:* confirmación que explica qué se borra y qué se conserva.
2. Confirmar → *Esperado:* `user_id`, `user_name` y `user_email` quedan NULL de inmediato.
3. Verificar el reporte → *Esperado:* el reporte y su imagen siguen existiendo, salvo que la política decida borrar el artefacto.
4. Verificar los logs → *Esperado:* no se registra la PII borrada.
5. Repetir → *Esperado:* idempotente; no hay error.

**Resultado final esperado:** la identidad se elimina de inmediato y el resto del reporte queda en el estado que la política documente.

---

### TC-I-07 · Purga automática de identidad por TTL

| Campo | Valor |
|---|---|
| **Trazabilidad** | RET-01 · R-09, R-10 |
| **Precondiciones** | Purga implementada; TTL de identidad corto; reporte con identidad y `identity_purge_at` vencido |
| **Prioridad** | **2** — promesa de retención |
| **Automatización** | **Sí** — backdating de fechas + job |
| **Ejecutabilidad** | 🟡 Parcial (quick `m3v`; verificación diferida) |

**Pasos y resultado esperado**

1. Crear un reporte con identidad y adelantar `identity_purge_at` → *Esperado:* el job lo selecciona en la siguiente pasada.
2. Ejecutar la purga (boot o intervalo) → *Esperado:* los campos `user_*` quedan NULL; la fila y el blob permanecen.
3. Repetir la pasada → *Esperado:* no hay cambios ni errores; la operación es idempotente.
4. Revisar el log → *Esperado:* se registran recuentos, configuración e ids; nunca la PII borrada.
5. Verificar el panel → *Esperado:* el reporte sigue visible sin identidad.

**Resultado final esperado:** la identidad desaparece automáticamente al vencer su TTL y el reporte sobrevive anonimizado.

---

### TC-I-08 · Purga automática del reporte completo por TTL

| Campo | Valor |
|---|---|
| **Trazabilidad** | RET-02 · R-10 · Fase 6 SC5 |
| **Precondiciones** | Purga implementada; TTL de artefacto corto; reporte con blob y `artifact_purge_at` vencido |
| **Prioridad** | **2** — límite de conservación |
| **Automatización** | **Sí** — backdating + job + volumen |
| **Ejecutabilidad** | 🟡 Parcial (quick `m3v`; verificación diferida) |

**Pasos y resultado esperado**

1. Crear un reporte con imagen y adelantar `artifact_purge_at` → *Esperado:* el job lo selecciona.
2. Ejecutar la purga → *Esperado:* se borra primero el blob y después la fila; no queda fila apuntando a un archivo inexistente.
3. Revisar el volumen → *Esperado:* el archivo ya no está.
4. Revisar el log → *Esperado:* recuento e id del reporte; sin PII.
5. Verificar `purge_runs` o el mecanismo de evidencia → *Esperado:* la pasada queda registrada de forma consultable (si el criterio SC5 se mantiene).

**Resultado final esperado:** los reportes completos desaparecen al vencer su TTL, con evidencia y sin huérfanos.

---

### TC-I-09 · Configuración de TTLs desde `.env`

| Campo | Valor |
|---|---|
| **Trazabilidad** | RET-03 · DEP-02 |
| **Precondiciones** | `.env` editable; API reiniciable |
| **Prioridad** | **3** — configuración de operador |
| **Automatización** | **Sí** — arranque con variables |
| **Ejecutabilidad** | 🟡 Parcial (knobs desde Fase 1; sin aceptación de fase) |

**Pasos y resultado esperado**

1. Configurar `RETENTION_IDENTITY_DAYS=7` y `RETENTION_ARTIFACT_DAYS=14` → *Esperado:* la API arranca y aplica esos valores; no usa 30/90.
2. Configurar valores vacíos → *Esperado:* se aplican los defaults 30/90, nunca 0.
3. Configurar `0`, negativo o basura → *Esperado:* fallo de arranque nombrando la variable.
4. Configurar el intervalo de purga → *Esperado:* se respeta; un valor inválido falla ruidosamente.
5. Revisar `.env.example` → *Esperado:* todas las variables están documentadas.

**Resultado final esperado:** el operador controla la retención desde el entorno sin tocar código ni arriesgar un valor inseguro.

---

## 10. Grupo J — Rendimiento, empaquetado y release

### TC-J-01 · Tiers de tamaño 45 / 25 / 80 KB gz

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRF-01, PRF-02, PRF-03 · CA-03 · RNF-01 |
| **Precondiciones** | Build de producción emitido; `node:zlib` disponible |
| **Prioridad** | **1** — presupuesto duro de producto |
| **Automatización** | **Sí** — `check:size` en CI |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Ejecutar el build → *Esperado:* se emiten core IIFE/ESM, chunk lazy y variante e2e.
2. Ejecutar `check:size` → *Esperado:* core ≤ 45 KB gz, lazy ≤ 25 KB con suelo ≥ 2 KB, runtime total ≤ 80 KB.
3. Superar artificialmente un tier → *Esperado:* el gate falla; no se puede aprobar renombrando el artefacto.
4. Revisar el peor caso → *Esperado:* se imprime el escenario 45+25+14=84 KB; la decisión de Fase 7 sigue visible.

**Resultado final esperado:** el presupuesto se mide sobre artefactos reales y un exceso bloquea la entrega.

---

### TC-J-02 · Cero dependencias npm de runtime

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRF-04 · R-01 |
| **Precondiciones** | `packages/sdk/package.json`; bundle emitido |
| **Prioridad** | **2** — restricción estructural |
| **Automatización** | **Sí** — gate estático |
| **Ejecutabilidad** | ✅ Hoy |

**Pasos y resultado esperado**

1. Revisar `dependencies` del SDK → *Esperado:* vacío o inexistente; sólo `devDependencies`.
2. Buscar Zod en el bundle → *Esperado:* no aparece; `contracts` se importa sólo como tipos/constantes.
3. Ejecutar el gate de dependencias → *Esperado:* PASS; un import de runtime lo hace fallar.
4. Revisar peticiones de red de la SDK → *Esperado:* sólo el endpoint configurado; cero CDN/fuentes/analytics.

**Resultado final esperado:** el cliente no arrastra dependencias de runtime ni peticiones de terceros.

---

### TC-J-03 · Caída de Lighthouse ≤ 2 puntos

| Campo | Valor |
|---|---|
| **Trazabilidad** | PRF-05 · CA-03 |
| **Precondiciones** | Fase 7 implementada; fixture hostil; Lighthouse con throttling y baseline definidos |
| **Prioridad** | **3** — medición de release poco frecuente |
| **Automatización** | **Parcial** — la medición puede automatizarse, pero es sensible al entorno |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 7) |

**Pasos y resultado esperado**

1. Medir el fixture sin Watchbug → *Esperado:* baseline de performance registrado (mediana de N ejecuciones).
2. Inyectar Watchbug y medir → *Esperado:* misma configuración de red/CPU; diferencia ≤ 2 puntos.
3. Repetir N veces → *Esperado:* la mediana se mantiene; no se acepta una sola corrida afortunada.
4. Revisar el script → *Esperado:* carga async, no bloquea el hilo principal.

**Resultado final esperado:** el coste medible para el host está dentro del presupuesto declarado, con un método reproducible.

---

### TC-J-04 · Backup/restore y gate de release en máquina limpia

| Campo | Valor |
|---|---|
| **Trazabilidad** | DEP-04 · CA-01…CA-05 · US-6 |
| **Precondiciones** | Fase 7 implementada; volumen de datos y BD con reportes; máquina limpia |
| **Prioridad** | **3** — operación de release/recuperación |
| **Automatización** | **Parcial** — el restore puede scriptarse; la aceptación final exige una máquina limpia |
| **Ejecutabilidad** | ⬜ Prospectivo (Fase 7) |

**Pasos y resultado esperado**

1. Copiar el volumen de adjuntos y ejecutar `pg_dump` → *Esperado:* backup íntegro y documentado.
2. Restaurar en una instalación limpia → *Esperado:* los reportes y sus imágenes se ven igual; no hay rutas rotas.
3. Arrancar con `docker-compose up` y sólo `.env.example` → *Esperado:* tres servicios sanos.
4. Ejecutar el release gate → *Esperado:* CA-01…CA-05 en chromium/firefox/webkit + `check:size` + cero secretos en el repositorio.
5. Repetir el restore tras una purga TTL → *Esperado:* el backup no resucita datos que la política de retención ya había eliminado, o la limitación está documentada.

**Resultado final esperado:** el despliegue se puede recuperar y el release se demuestra desde cero, con las limitaciones de backup vs borrado explícitas.

---

## 11. Matriz de trazabilidad requisito → caso de prueba

> Todos los requisitos v1 tienen al menos un caso. Un caso puede cubrir varios requisitos; la prioridad mostrada es la máxima del conjunto.

| Requisito | Caso(s) | Prioridad | Ejecutabilidad |
|---|---|---:|---|
| INT-01 | TC-A-01 | 1 | ✅ |
| INT-02 | TC-A-01 | 1 | ✅ |
| INT-03 | TC-A-03, TC-F-05 | 2 | 🟡 Fase 4 |
| INT-04 | TC-A-03 | 2 | 🟡 Fase 4 |
| INT-05 | TC-A-02 | 2 | ✅ |
| WDG-01 | TC-B-01 | 1 | ✅ |
| WDG-02 | TC-B-02 | 1 | ✅ |
| WDG-03 | TC-B-03 | 2 | ✅ |
| WDG-04 | TC-B-03 | 2 | ✅ |
| WDG-05 | TC-B-04 | 3 | ✅ |
| WDG-06 | TC-B-05, TC-B-06 | 2 | ✅ |
| CAP-01 | TC-C-01 | 1 | ✅ |
| CAP-02 | TC-C-05, TC-C-06 | 1 | ✅ |
| CAP-03 | TC-C-04 | 1 | ✅ |
| CAP-04 | TC-C-02 | 1 | ✅ |
| CAP-05 | TC-C-03 | 1 | ✅ |
| ANN-01 | TC-D-01 | 1 | ✅ |
| ANN-02 | TC-D-01 | 1 | ✅ |
| ANN-03 | TC-D-01 | 1 | ✅ |
| ANN-04 | TC-D-02 | 2 | ✅ |
| ANN-05 | TC-E-05, TC-E-07 | 2 | ✅ |
| ANN-06 | TC-D-03, TC-D-04, TC-E-06, TC-E-07 | 1 | ✅ |
| PRV-01 | TC-E-01 | 1 | ✅ |
| PRV-02 | TC-E-02 | 1 | ✅ |
| PRV-03 | TC-E-03 | 2 | ✅ |
| PRV-04 | TC-E-04, TC-E-05, TC-E-06, TC-D-04, TC-D-06 | 1 | ✅ |
| PRV-05 | TC-E-09 | 2 | ✅ |
| PRV-06 | TC-E-09 | 2 | ✅ |
| PRV-07 | TC-E-08 | 1 | ✅ |
| ENR-01 | TC-F-02 | 1 | 🟡 Fase 4 |
| ENR-02 | TC-F-03 | 2 | 🟡 Fase 4 |
| ENR-03 | TC-F-04 | 2 | 🟡 Fase 4 |
| ENR-04 | TC-F-05 | 2 | 🟡 Fase 4 |
| ENR-05 | TC-F-06 | 4 | 🟡 Fase 4 |
| ENR-06 | TC-F-01 | 1 | ✅ |
| ING-01 | TC-G-01 | 1 | ✅ |
| ING-02 | TC-G-03 | 2 | ⬜ Fase 7 |
| ING-03 | TC-G-02 | 1 | ✅ |
| ING-04 | TC-G-04 | 2 | ✅ |
| ING-05 | TC-G-05 | 1 | ✅ |
| ING-06 | TC-G-06 | 2 | ✅ |
| ING-07 | TC-G-07 | 1 | ✅ |
| ING-08 | TC-G-08 | 2 | ✅ |
| TRI-01 | TC-H-01 | 1 | ⬜ Fase 5 |
| TRI-02 | TC-H-02 | 1 | ⬜ Fase 5 |
| TRI-03 | TC-H-01 | 1 | ⬜ Fase 5 |
| TRI-04 | TC-I-01 | 1 | ⬜ Fase 6 |
| TRI-05 | TC-I-02 | 1 | ⬜ Fase 6 |
| TRI-06 | TC-I-03 | 1 | ⬜ Fase 6 |
| TRI-07 | TC-I-04 | 3 | ⬜ Fase 6 |
| TRI-08 | TC-I-05 | 2 | ⬜ Fase 6 |
| TRI-09 | TC-I-06 | 2 | ⬜ Fase 6 |
| TRI-10 | TC-I-01 | 1 | ⬜ Fase 6 |
| PRJ-01 | TC-H-03 | 2 | ⬜ Fase 5 |
| PRJ-02 | TC-H-03, TC-H-07 | 2 | ⬜ Fase 5 |
| PRJ-03 | TC-H-03 | 2 | ⬜ Fase 5 |
| PRJ-04 | TC-H-04 | 3 | ⬜ Fase 5 |
| PRJ-05 | TC-H-05 | 4 | ⬜ Fase 5 |
| RET-01 | TC-I-07 | 2 | 🟡 Parcial |
| RET-02 | TC-I-08 | 2 | 🟡 Parcial |
| RET-03 | TC-I-09 | 3 | 🟡 Parcial |
| DEP-01 | TC-A-04 | 1 | ✅ |
| DEP-02 | TC-A-04, TC-A-05 | 1 | ✅ |
| DEP-03 | TC-H-06 | 2 | 🟡 Parcial |
| DEP-04 | TC-J-04 | 3 | ⬜ Fase 7 |
| PRF-01 | TC-J-01 | 1 | ✅ |
| PRF-02 | TC-J-01, TC-D-05 | 1 | ✅ |
| PRF-03 | TC-J-01, TC-D-05 | 1 | ✅ |
| PRF-04 | TC-J-02 | 2 | ✅ |
| PRF-05 | TC-J-03 | 3 | ⬜ Fase 7 |

**Cobertura:** 70/70 requisitos v1 con al menos un caso; 6/6 US; 5/5 CA globales.

---

## 12. Resumen de la suite

### 12.1 Por grupo

| Grupo | Casos | P1 | P2 | P3 | P4 |
|---|---:|---:|---:|---:|---:|
| A — Integración, despliegue y contexto | 5 | 2 | 2 | 1 | 0 |
| B — Widget, aislamiento e i18n | 6 | 2 | 3 | 1 | 0 |
| C — Captura y adjunto | 7 | 5 | 0 | 1 | 1 |
| D — Anotación y editor | 6 | 2 | 2 | 2 | 0 |
| E — Privacidad y revisión | 9 | 4 | 4 | 1 | 0 |
| F — Payload y enriquecimiento | 6 | 2 | 3 | 0 | 1 |
| G — Transporte e ingesta | 8 | 4 | 4 | 0 | 0 |
| H — Auth, proyectos y blobs | 7 | 2 | 2 | 2 | 1 |
| I — Triaje y retención | 9 | 3 | 4 | 2 | 0 |
| J — Rendimiento y release | 4 | 1 | 1 | 2 | 0 |
| **Total** | **67** | **27** | **25** | **12** | **3** |

### 12.2 Por ejecutabilidad

| Estado | Casos | Lectura |
|---|---:|---|
| ✅ Ejecutable hoy (fases 1–3) | 42 | Cubre todo el camino del reportero y la ingesta |
| 🟡 Parcial (trabajo adelantado) | 4 | RET-01, RET-02, RET-03, DEP-03 |
| ⬜ Prospectivo (fases 4–7) | 21 | Diseñado, no ejecutable hasta que existan los planes |
| **Total** | **67** | |

### 12.3 Por automatización

| Valoración | Casos | Comentario |
|---|---:|---|
| **Sí** | 62 | La mayoría son deterministas y deben estar en CI |
| **Parcial** | 4 | Primera ejecución, pixelación visual, Lighthouse y restore |
| **No** | 1 | Captura real con picker del sistema operativo |

---

*Suite diseñada desde `.planning/` · 2026-11-03*
