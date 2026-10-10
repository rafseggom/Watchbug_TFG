# Product Requirements Document (PRD)

**Producto:** Watchbug SDK
**Versión:** 1.0
**Fecha:** 2026-10-05
**Estado:** Aprobado (salvo los apartados marcados explícitamente)
**Enlace a esquema interactivo:** [Canvas interactivo](https://prlens.dev/c/OEZaYBRN8dROsvU6nlxqsA)

> **Fuente de verdad.** `.planning/REQUIREMENTS.md` sigue siendo la referencia viva para estados y trazabilidad fase-requisito; este PRD es la **definición de producto consolidada**, revisada en los límites de milestone (regla de *Evolution* de `PROJECT.md`). Identificadores técnicos (`RF-`, `RNF-`, `INV-`, `SEC-`, `CA-`, `REQ-`) se mantienen en su forma original en inglés para que la trazabilidad con los documentos de gobierno sea exacta.
>
> Documentos de gobierno consolidados: `documentation/mission-brief.md`, `documentation/mentorship-pack.md`, `documentation/ase-instructions.md`, `documentation/resolution-record.md`.

---

## 1. Goals

### 1.1 Goal primario

> **Cuando llega un informe de fallo, el desarrollador puede reproducir el fallo a partir de él — y ni el informe ni su captura salen jamás de la infraestructura propia del desarrollador.**

Esta frase es el árbitro de toda decisión de priorización. *Fidelidad de captura* y *completitud de metadatos* sirven a la primera cláusula; *auto-hospedaje*, *enmascarado destructivo* y *no-envío-de-credenciales* sirven a la segunda. Cuando entren en conflicto, **gana la segunda**: un informe que fuga es peor que un informe escaso.

### 1.2 Goals

| ID | Goal | Cómo se mide |
|----|------|--------------|
| G-1 | Permitir a un desarrollador integrar Watchbug con **una sola etiqueta `<script>` asíncrona**, sin paso de build | `INT-01`; CA-03 |
| G-2 | Capturar el contexto necesario para **reproducir** un fallo (captura anotada + consola + entorno) | `RF-01`, `ENR-01/03`; `CA-01` |
| G-3 | Garantizar que los datos sensibles **queden destruidos antes de salir del navegador**, de forma irreversible | `RF-04`, `PRV-01…04`, `R-13`; `CA-02` |
| G-4 | Auto-hospedar **toda** la plataforma con un único `docker-compose up`, sin depender de terceros | `RF-08`, `INV-03` |
| G-5 | Costar **casi nada** a la página anfitriona: no bloquear el hilo principal, no romper su CSS | `RNF-01`, `RNF-02`; `CA-03`, `CA-04` |
| G-6 | Ofrecer un panel de triaje **usable y localizado** (EN/ES) para gestionar los informes | `RF-06`, `RNF-03` |
| G-7 | Ser arquitectura **extensible sin reescritura**: puertos donde existe una segunda implementación real | `R-02` |
| G-8 | Mantener **evidencia verificable** en cada propiedad, sin test suite parasitaria | `R-12`, `CA-01…05` |

### 1.3 No-goals (Declare the No) 

Exclusiones **duras**. No se diseñará ni se implementará nada de esto en este ciclo. Los puertos reservados son **costuras**, no permisos: constrir un adaptador para cualquiera de ellos sería una violación de alcance.

| # | No-goal | Origen |
|---|---------|--------|
| NG-1 | Integraciones con plataformas de terceros (Jira, GitHub Issues, Slack, Trello) | `mission-brief` §2 |
| NG-2 | Grabación de vídeo o reconstrucción de sesión (LogRocket / FullStory) | `mission-brief` §2 · incompatible con `RNF-01` |
| NG-3 | Motor de análisis de errores por IA | `mission-brief` §2 |
| NG-4 | Gamificación o sugerencias automáticas de resolución de bugs | `mission-brief` §2 |
| NG-5 | Servicios de suscripción, pasarelas de pago o multi-tenancy SaaS gestionado por nosotros | `mission-brief` §2 (excluye el **modelo de hospedaje**, no el multi-proyecto de `R-06`) |
| NG-6 | Integración OAuth2 con proveedores externos (Google, GitHub, SSO) | `mission-brief` §2 |
| NG-7 | Cuentas multiusuario y roles en el panel | `R-05` — administrador único por diseño |
| NG-8 | Suites de pruebas unitarias y umbrales de cobertura | `R-12` — política del propietario, declarada dos veces |
| NG-9 | *Memoria* del TFG y web de documentación de usuario | `R-03` — pista paralela |
| NG-10 | SDKs nativos o no-web | Web-first: el widget es artefacto de navegador |
| NG-11 | Enmascarado con capa CSS o desenfoque gaussiano | `SEC-02` + `R-13` — **prohibición de seguridad**, no de alcance |
| NG-12 | Adjuntos SVG o de tipo arbitrario | XSS vía imagen (riesgo C-3). Solo PNG y WebP |
| NG-13 | Leer cookies, `localStorage` o cabeceras de autenticación del anfitrión | `SEC-03` — invariante |

---

## 2. MVP Core

### 2.1 Definición

`mission-brief.md` §1 define el MVP como cuatro piezas funcionando juntas:

1. Un **script cliente inyectable y aislado** (widget + motor de captura).
2. Una **API/backend ligera** de recepción y almacenamiento.
3. Un **panel web** de gestión auto-hospedable.
4. **Autenticación básica** del panel (credenciales desde `.env`) con sesión JWT.

### 2.2 Alcance del MVP (v1)

| Dimensión | Valor |
|-----------|-------|
| Requisitos v1 | **70** (ver apartado 4.3) |
| Requisitos v2 diferidos | 17 |
| Exclusiones explícitas | 13 |
| Fases | **7** (Vertical MVP, `PROJECT_MODE=mvp`) |
| Cobertura | **70/70 → 100 %**, 0 huérfanos, 0 duplicados |

### 2.3 Núcleo de valor verificable

El MVP completo son 7 fases, pero **el momento en que el Core Value se vuelve verdadero** es el final de la **Fase 3**: un informe real — capturado, enmascarado de forma irreversible, anotado y transmitido — aparece en el panel. Todo lo anterior a ese punto es preparación; todo lo posterior es pulido y resistencia.

| Bloque | Fases | Qué demuestra |
|--------|-------|---------------|
| **Esqueleto + ingesta** | 1 | El dato cruza la red y se almacena con seguridad desde la primera línea |
| **Tracer bullet** | 2 | Widget aislado + captura + redacción destructiva (T1) |
| **Compositor** | 3 | **✓ Núcleo verificable** — informe completo con máscara irreversible |
| **Evidencia** | 4 | Metadatos completos, consola acotada, privacidad de identidad |
| **Experiencia del desarrollador** | 5–6 | Acceso seguro, proyectos, triaje, ciclo de vida del dato |
| **Resistencia y cierre** | 7 | Durablez ante descarga de pestaña, presupuesto, release gate |

### 2.4 Límites duros del MVP (resumidos)

| Límite | Valor | Origen |
|--------|-------|--------|
| Core inyectado | ≤ **45 KB** gzipped | `RNF-01` / `R-01` |
| Cada chunk diferido | ≤ **25 KB** gzipped | `R-01` |
| Carga total en ejecución | ≤ **80 KB** gzipped | `R-01` |
| Dependencias de runtime del cliente | **cero** | `R-01` |
| Caída de Lighthouse | ≤ **2 puntos** | `CA-03` |
| Servicios en `docker-compose` | **3** (`api`, `panel`, `db`) | `INV-03` |
| Globales nuevos en la página anfitriona | **1** (`window.Watchbug`) | `INV-02` |
| Artefactos de verificación | **1 suite e2e + 1 size gate** | `R-12` |

---

## 3. Requisitos no funcionales (RNF)

### 3.1 RNF explícitos (`mission-brief` §4)

| ID | Requisito | Criterio de aceptación | Verificación |
|----|-----------|------------------------|--------------|
| **RNF-01** | Rendimiento del script: ≤ 45 KB gzipped, carga asíncrona sin bloquear el main thread | `CA-03` | `npm run check:size` + medición Lighthouse |
| **RNF-02** | Aislamiento total: inmune al CSS/JS del anfitriona y sin contaminar sus estilos ni variables globales | `CA-04` | e2e con CSS hostil |
| **RNF-03** | Internacionalización: widget y panel disponibles en inglés y español | — | e2e (presencia de cadenas EN/ES) |

### 3.2 Presupuesto de tamaño por niveles (`R-01`)

La cifra única de 45 KB se interpreta por niveles **sin elevar su techo**: la promesa real de `RNF-01` es *no costar nada a la página anfitriona*, y el editor de anotación se descarga bajo gesto de usuario, nunca en el camino crítico.

| Nivel | Límite (gzipped) | Imposición |
|-------|------------------|-----------|
| `watchbug.js` — core inyectado | ≤ **45 KB**, duro | `npm run check:size`, falla la build |
| Cada chunk diferido | ≤ **25 KB** | ídem |
| Carga total en ejecución | ≤ **80 KB** | ídem |

⚠ Peor caso conocido: 45 + 25 + 14 = **84 KB > 80 KB**. El `check:size` debe incluir un **escenario multi-artefacto desde la Fase 1** para que la brecha sea visible desde el día uno (`A-12`).

### 3.3 Invariantes arquitectónicos (`INV`)

| ID | Requisito |
|----|-----------|
| **INV-01** | Aislamiento total del widget vía Shadow DOM `mode: 'closed'`. Ninguna regla CSS del anfitriona puede romperlo. No se inyectan hojas de estilo ni clases en `head`/`body` globales. |
| **INV-02** | Un único punto de entrada global (`window.Watchbug`) o exportación ES Module. **Prohibido** modificar prototipos nativos. |
| **INV-03** | Backend y panel agnósticos de proveedor. Un único `docker-compose.yml` con **exactamente tres servicios**: API, panel estático y base de datos persistente. |

### 3.4 Privacidad y seguridad (`SEC`)

| ID | Requisito | Notas de implementación |
|----|-----------|------------------------|
| **SEC-01** | Sanitización automática de entradas: omitir/enmascarar `input[type=password]`, valores de credenciales/tarjetas y elementos con `data-watchbug-sensitive` | Ejecuta en **T1**, sobre `ImageData`, antes de que el editor muestre la imagen |
| **SEC-02** | Destrucción de datos sensibles en canvas: alteración directa sobre `ImageData` **antes** de codificar a Base64/PNG. **Prohibido** tapar con capas CSS superpuestas | La imagen final enviada a la API tiene el área sensible alterada de forma irreversible |
| **SEC-03** | El SDK **nunca** adjunta cookies, tokens Bearer ni cabeceras de autorización del anfitriona. Solo sale el `project_key` público de solo escritura | Bloqueado estructuralmente: `CaptureSource.capture()` devuelve `ImageData`, no un `Blob` |
| **SEC-04** | Cero secretos en código. Toda la configuración del backend desde `.env`, con `.env.example` documentado y commiteado | — |
| **SEC-05** | Sanitización contra stored XSS en todos los campos recibidos; rate limiting por IP **y** por `project_key`; CORS acotado a orígenes autorizados | Límites por capa: 5 MB cuerpo, 4 MB parte, 64 KB meta, imagen 2 MB |
| **SEC-06** | Hash de contraseñas seguro; JWT con TTL definido y cookies `HttpOnly` / `SameSite` / `Secure` | `R-05`: Argon2id + JWT ≤ 8 h en cookie `__Host-` |

### 3.5 RNF adicionales derivados de decisiones

| ID | Requisito | Origen |
|----|-----------|--------|
| RNF-04 | Cliente con **cero dependencias npm de runtime** | `PRF-04` / `R-01` |
| RNF-05 | Verificación **solo e2e y por propiedades**; sin suites unitarias ni umbrales de cobertura | `R-12` |
| RNF-06 | Máscara = **relleno opaco plano** como único primitivo automático; desenfoque gaussiano prohibido | `R-13` / `A-01` |
| RNF-07 | Retención con TTL sobre **identidad (30 d)** y sobre **artefactos completos (90 d)** | `R-10` / `A-02` |
| RNF-08 | Transporte de informes con **cola de durableza** e idempotencia (el `keepalive`/`sendBeacon` está limitado a 64 KiB) | `A-03` / H-9 |
| RNF-09 | Compatibilidad: **chromium + firefox + webkit** como matriz mínima de verificación | Research (webkit ejercita el fallback WebP→PNG) |

---

## 4. Requisitos funcionales (RF)

### 4.1 Desglose de `mission-brief.md` §4

| ID | Requisito funcional | Mapeo a REQ-IDs | Fases |
|----|--------------------|------------------|-------|
| **RF-01** | Al accionar el botón de reporte, el sistema captura el estado visual del navegador y recolecta metadatos (URL, User-Agent, resolución, registros de consola JS) | `INT-01`, `INT-02`, `WDG-01`, `CAP-01`, `CAP-04`, `CAP-05`, `ENR-03` | 2 |
| **RF-02** | Permitir el envío de comentarios o sugerencias **sin obligar** a adjuntar logs de consola | `ENR-02` | 4 |
| **RF-03** | El editor de capturas ofrece herramientas de dibujo (lápiz, flechas, texto) y enmascarado/pixelado para ocultar datos sensibles antes del envío | `ANN-01…06`, `PRV-07`, `PRV-04` | 3 |
| **RF-04** | El script omite automáticamente contenido de `type="password"`, atributos de credenciales y elementos marcados con `data-watchbug-sensitive` | `PRV-01`, `PRV-02`, `PRV-03` | 2 |
| **RF-05** | Empaquetar el informe (imagen + JSON de metadatos) y enviarlo por HTTP al backend vinculado | `ING-01`, `ENR-06`, `DEP-03` | 1 |
| **RF-06** | Panel web protegido: listado de incidencias, filtro por tipo (Bug/Feedback), cambio de estado (Pendiente/En Proceso/Resuelto) y examen de metadatos | `TRI-04…10`, `TRI-06` | 6 |
| **RF-07** | Acceso al panel mediante credenciales simples configuradas en el entorno del servidor | `TRI-01`, `TRI-02`, `TRI-03` | 5 |
| **RF-08** | Backend y panel levantables mediante una única orquestación `docker-compose` | `DEP-01`, `DEP-02`, `DEP-04` | 1, 7 |

### 4.2 Requisitos funcionales **sin origen en RF** (derivados de decisiones)

Es importante no confundirlos: son requerimientos reales que llegaron de `resolution-record.md`, no del mission brief.

| Bloque | REQ-IDs | Por qué existe |
|--------|---------|----------------|
| Integración | `INT-03`, `INT-04`, `INT-05` | Contexto de host (`user`, `appVersion`, `custom`), *opt-out* de identidad, consumo como módulo ES |
| Aislamiento | `WDG-02…06` | CSS hostil, no-fuga de estilos, único global, stacking, i18n |
| Captura | `CAP-02`, `CAP-03` | Adjunto desde dispositivo + estado de fallo (cadena de captura, `A-05`) |
| Privacidad | `PRV-05`, `PRV-06` | `SEC-03` (sin credenciales) + URL solo con *path* (`R-08`) |
| Ingesta | `ING-02…08` | Cola durable, idempotencia, clave, rate limit, límites, sanitización, CORS |
| Panel | `TRI-07…10` | Comentarios, borrado, anonimización inmediata, contadores |
| Proyectos | `PRJ-01…05` | `R-06` multi-proyecto: CRUD + rotación de clave |
| Retención | `RET-01…03` | `R-10` / `A-02`: TTL sobre identidad **y** artefactos |
| Presupuesto | `PRF-01…05` | `R-01` / `CA-03`: los cuatro niveles + cero deps |

### 4.3 Catálogo completo de requisitos v1 (70)

> Fuente viva y con estados: `.planning/REQUIREMENTS.md`. Reproducido aquí para que el PRD sea autocontenido.

#### Integration
- `INT-01` — Un desarrollador puede añadir Watchbug con una sola etiqueta `<script>` asíncrona y sin build
- `INT-02` — Un desarrollador puede inicializar Watchbug con clave pública y opciones mediante `window.Watchbug.init()`
- `INT-03` — Un desarrollador puede adjuntar `user`, `appVersion` y `custom` en `init` y que viajen en cada informe
- `INT-04` — Un desarrollador puede desactivar la identidad del usuario final con `privacy: { userIdentity: false }`
- `INT-05` — Un desarrollador puede consumir Watchbug como módulo ES en lugar de como global

#### Widget & Isolation
- `WDG-01` — Un usuario final puede abrir el widget desde un botón flotante
- `WDG-02` — CSS hostil del anfitrión (p. ej. `* { display: none !important }`) no puede ocultar, recolorear ni romper el widget
- `WDG-03` — El widget no filtra estilos, clases ni variables CSS al documento anfitrión
- `WDG-04` — La página gana exactamente un global (`window.Watchbug`) y ningún prototipo nativo se modifica
- `WDG-05` — El widget se dibuja sobre todo el contenido del anfitrión sea cual sea su stacking context
- `WDG-06` — Un usuario final puede usar el widget en inglés o español, detectado del navegador con conmutador manual

#### Capture
- `CAP-01` — Un usuario final puede capturar la pestaña actual mediante el diálogo nativo del navegador
- `CAP-02` — Un usuario final puede adjuntar una imagen de su dispositivo en lugar de capturar
- `CAP-03` — Un usuario final ve un estado de fallo claro cuando la captura no está disponible y aún puede enviar solo texto
- `CAP-04` — Una captura nunca contiene el propio widget de Watchbug
- `CAP-05` — Las capturas se reducen a ≤ 16 MP y ≤ 2 MB sin quedar en blanco en pantallas HiDPI

#### Annotation
- `ANN-01` — Dibujo libre
- `ANN-02` — Flechas
- `ANN-03` — Rectángulos
- `ANN-04` — Etiquetas de texto
- `ANN-05` — Enmascarado de una región con relleno opaco
- `ANN-06` — Deshacer trazos de anotación (las máscaras son deliberadamente irreversibles)

#### Privacy & Masking
- `PRV-01` — Los valores de `input[type=password]` quedan excluidos automáticamente
- `PRV-02` — Los patrones de credenciales, tokens y tarjetas se enmascaran automáticamente
- `PRV-03` — Los elementos marcados `data-watchbug-sensitive` se enmascaran automáticamente
- `PRV-04` — Una región enmascarada queda destruida a nivel de píxel y es irrecuperable en la imagen codificada
- `PRV-05` — El SDK nunca lee ni transmite cookies, storage ni cabeceras de autenticación del anfitrión
- `PRV-06` — Los query strings y fragmentos de la URL se eliminan antes de transmitir
- `PRV-07` — Un usuario final puede revisar y editar la captura antes de enviarla

#### Payload & Enrichment
- `ENR-01` — Un informe de *bug* lleva siempre registros de consola
- `ENR-02` — Un informe de *feedback* puede enviarse sin registros de consola
- `ENR-03` — Los informes llevan ruta de URL, user agent, viewport, resolución, `devicePixelRatio`, idioma, zona horaria y marca temporal
- `ENR-04` — Los informes llevan la versión de aplicación aportada por el anfitrión
- `ENR-05` — La captura de consola está acotada y no puede recursar sobre el propio logging del SDK
- `ENR-06` — Todo informe valida contra el esquema JSON oficial publicado

#### Transport & Ingestion
- `ING-01` — Un informe (imagen + metadatos) llega al backend por HTTP
- `ING-02` — Un informe sobrevive a la descarga de la pestaña y a fallos de red transitorios mediante una cola durable
- `ING-03` — Un reenvío repetido no crea un informe duplicado
- `ING-04` — La API rechaza la ingesta sin clave de proyecto válida
- `ING-05` — La API limita la tasa por IP y por clave de proyecto
- `ING-06` — La API rechaza cuerpos e imágenes de tamaño excesivo
- `ING-07` — La API sanitiza todo texto de usuario antes de almacenarlo y antes de renderizarlo en el panel
- `ING-08` — La API acepta ingesta solo desde orígenes de la lista permitida

#### Panel & Triage
- `TRI-01` — Un administrador puede iniciar sesión con credenciales de `.env` y obtiene una cookie de sesión JWT
- `TRI-02` — Cualquier petición sin autenticar a la API del panel devuelve `401 Unauthorized`
- `TRI-03` — Un administrador puede cerrar sesión y la sesión queda invalidada
- `TRI-04` — Un administrador puede listar informes filtrando por tipo, estado y proyecto
- `TRI-05` — Un administrador puede ver captura, registros de consola y metadatos de un informe
- `TRI-06` — Un administrador puede mover un informe a Pendiente / En proceso / Resuelto y reabrirlo
- `TRI-07` — Un administrador puede añadir comentarios internos a un informe
- `TRI-08` — Un administrador puede eliminar un informe
- `TRI-09` — Un administrador puede borrar de inmediato la identidad del usuario final (RGPD Art. 18)
- `TRI-10` — Un administrador puede ver contadores por estado, tipo y proyecto

#### Projects
- `PRJ-01` — Un administrador puede crear un proyecto y obtener su clave pública de solo escritura
- `PRJ-02` — Un administrador puede seleccionar el proyecto activo
- `PRJ-03` — Un administrador puede renombrar un proyecto
- `PRJ-04` — Un administrador puede rotar la clave pública de un proyecto
- `PRJ-05` — Un administrador puede eliminar un proyecto y sus informes

#### Retention
- `RET-01` — Los campos de identidad se purgan automáticamente tras N días (por defecto 30)
- `RET-02` — Los informes completos (captura, consola, metadatos) se purgan automáticamente tras M días (por defecto 90)
- `RET-03` — Un desarrollador puede configurar ambos TTL en `.env`

#### Deployment & Operations
- `DEP-01` — Un desarrollador arranca API + panel + base de datos con un único `docker-compose up`
- `DEP-02` — Un desarrollador configura todo ajuste de servidor desde `.env` usando `.env.example`
- `DEP-03` — Las capturas viven en un volumen de sistema de archivos y se sirven solo por la API autenticada
- `DEP-04` — Un desarrollador puede respaldar y restaurar copiando el volumen y volcando la base de datos

#### Performance Budget
- `PRF-01` — El script inyectado pesa ≤ 45 KB gzipped; la build falla si lo supera
- `PRF-02` — Cada chunk diferido pesa ≤ 25 KB gzipped
- `PRF-03` — La carga total del cliente en ejecución pesa ≤ 80 KB gzipped
- `PRF-04` — El SDK cliente se distribuye con cero dependencias npm de runtime
- `PRF-05` — Inyectar Watchbug reduce la puntuación Lighthouse en ≤ 2 puntos

### 4.4 Requisitos v2 (diferidos, 17)

**Captura y anotación:** captura de página completa · adaptador `DomSerializeCapture` · recorte · numeración de pasos · campos personalizados por informe.
**Enrichment:** captura de errores de red · trazas de usuario · experiencia completa de cola *offline*.
**Triage:** etiquetas y responsables · pistas de informes similares (heurística por palabras, sin IA) · analítica temporal · TTL configurables desde el panel · cuentas multiusuario con roles · operaciones masivas.
**Despliegue y adaptadores:** adaptador `Storage` S3/MinIO · adaptador `AuthProvider` de token estático para CI · analítica de uso de claves.

---

## 5. Flujos de usuario y wireframes

### 5.1 Actores

| Actor | Rol |
|-------|-----|
| **Usuario final** | Persona que usa la aplicación anfitriona y encuentra un fallo o deja una sugerencia. No tiene cuenta de Watchbug. |
| **Desarrollador / integrador** | Quien instala el SDK, auto-hospeda el stack y hace el triaje. Administrador único del panel. |
| **Navegador** | Tercera parte activa: concede permiso de captura, bloquea scripts (ad-blockers) y aplica CSP. |

### 5.2 Flujo F1 — Usuario final: informar de un fallo *(US-1)*

1. El usuario navega por la aplicación anfitriona y hace clic en el botón flotante de Watchbug.
2. El widget abre y solicita captura. **El navegador muestra su diálogo nativo** con la pestaña actual preseleccionada.
3. El widget se oculta temporalmente para no aparecer en su propia captura (`CAP-04`).
4. La imagen se decodifica a `ImageData` y el motor de redacción **T1 destruye** automáticamente `type="password"`, patrones de credenciales/tarjeta y `[data-watchbug-sensitive]` — *antes* de que el editor la muestre.
5. El editor carga (chunk diferido, bajo gesto). El usuario dibuja, añade flechas, rectángulos o texto.
6. El usuario enmascara una región → la máscara se hornea **destructivamente al completar el trazo (T2)** y no puede deshacerse.
7. El usuario revisa y edita en pantalla de previsualización (`PRV-07`).
8. Elige tipo **Bug**, escribe título y descripción.
9. El informe se empaqueta en `multipart/form-data`: `meta` (JSON) + `image` (Blob).
10. Se envía con clave de idempotencia. En fallo, entra en la **cola de durableza de IndexedDB** y se reintenta en `pageshow`.
11. El servidor valida contra el esquema oficial, sanitiza, almacena la imagen en `projectId/<xx>/<uuid>.<ext>` y crea la fila.
12. El usuario ve confirmación.

**Ramificaciones de error:**

| Situación | Comportamiento requerido |
|-----------|--------------------------|
| El navegador no soporta captura (iOS) o el permiso se deniega | Estado de fallo visible: *"captura no disponible — ¿enviar de todos modos?"* (`CAP-03`). **Nunca** una imagen en blanco enviada en silencio |
| `Permissions-Policy` bloquea `display-capture` | Igual que arriba + ruta de adjunto manual (`CAP-02`) |
| La página tiene rastreadores bloqueados y `fetch` falla | Cola durable + reintento con estado visible, nunca descarte silencioso |
| Página con logs de consola masivos | Búfer anulado *(drop-oldest)* con aviso "N mensajes anteriores descartados" (`ENR-05`) |
| IndexedDB bloqueada o cuota agotada (modo privado estricto) | Cola en memoria + estado visible de reintento. **Nunca** descarte silencioso (`RSK-24`) |

### 5.3 Flujo F2 — Usuario final: sugerencia sin logs *(US-2)*

1. Abre el widget, elige tipo **Feedback**.
2. `consoleLogs` se marca opcional: el usuario puede **no** adjuntarlos (`ENR-02`, condición de `CA-01`).
3. Captura opcional. Si la captura falla, puede enviar solo texto.
4. Envío → mismo camino de ingestión que F1.

### 5.4 Flujo F3 — Usuario final: privacidad *(US-3)*

1. Antes de salir el navegador, el usuario ve la captura ya enmascarada con las reglas automáticas aplicadas.
2. Puede añadir enmascarado propio (irreversible) y quitar trazos de anotación (deshacer).
3. El panel de envío **declara qué se envía**: identidad (si el anfitrión la aportó), URL solo con *path*, metadatos de entorno.
4. Si el anfitrión configuró `privacy: { userIdentity: false }`, la identidad no viaja desde el origen.

### 5.5 Flujo F4 — Desarrollador: integración *(US-4)*

1. Copia la etiqueta `<script async>` o importa el módulo ES.
2. Llama a `window.Watchbug.init({ projectKey, appVersion, user })`.
3. Su usuario final obtiene el widget operativo. Sin build, sin dependencias, sin bloqueo del main thread.

### 5.6 Flujo F5 — Desarrollador: triaje *(US-5)*

1. Abre el panel y se autentica con credenciales de `.env` → cookie JWT.
2. Selecciona proyecto en el selector global.
3. Revisa contadores (estado · tipo · proyecto).
4. Filtra: tipo, estado, texto.
5. Abre un informe: captura, metadatos de entorno, registros de consola.
6. Cambia estado y/o reabre; añade nota interna.
7. Opcional: borra el informe o anonimiza su identidad de inmediato.

**Ramificación de seguridad:** cualquier petición sin credenciales a `/api/incidents/*` → `401` (`CA-05`).

### 5.7 Flujo F6 — Desarrollador: auto-hospedaje *(US-6)*

1. Copia `.env.example` a `.env` y lo rellena.
2. `docker-compose up -d` → tres servicios: `api`, `panel`, `db`.
3. El panel hace *reverse proxy* de `/api` a `api` — **obligatorio**, porque la cookie `SameSite=Lax` exige mismo origen (`A-10`).
4. Creación de proyectos y obtención de claves públicas.
5. Respaldos: copia de volumen + volcado de base de datos.

### 5.8 Wireframes

> Estructurales (ASCII), no de fidelidad gráfica. Los mockups finos salen de `/gsd-sketch 1` durante la planificación de la fase correspondiente.

**W1 — Launcher en la página anfitriona (Shadow DOM cerrado)**

```
+--------------------------------------------------+
|  contenido de la aplicación anfitriona            |
|  (CSS hostil no afecta a este bloque)             |
|                                                   |
|                                        +-----+    |
|                                        |  !  |    <- launcher flotante
|                                        +-----+    <- anclado a
|                                                   documentElement
+--------------------------------------------------+
```

**W2 — Compositor de informe (widget)**

```
+--------------------------------+
| Reportar un problema      [X]  |
+--------------------------------+
| Tipo:  (x) Bug   ( ) Feedback  |
+--------------------------------+
|  +--------------------------+  |
|  |      vista previa        |  |   <- T1 ya aplicada
|  |      (enmascarada)        |  |      antes de mostrarse
|  +--------------------------+  |
| [lapiz][flecha][rect][texto]   |
| [enmascarar]      [deshacer]*  |   <- deshacer NO afecta a
+--------------------------------+      máscaras (irreversibles)
| Titulo *                        |
| [____________________________]  |
| Descripcion *                   |
| [____________________________]  |
+--------------------------------+
| Se enviara:                     |
|   identidad  URL(ruta)  entorno |
| [ ] No enviar mi identidad      |
+--------------------------------+
| [Vista previa]         [Enviar] |
+--------------------------------+
```

**W3 — Panel: lista de informes**

```
+--------------------------------------+
| Watchbug          Proy:[Acme v] [Sal]|
+--------------------------------------+
| 12 total | 8 Bugs | 4 Feedback       |
| Pend 7 | En proceso 3 | Resuelto 2   |
+--------------------------------------+
| [tipo v] [estado v] [buscar .....]   |
+--------------------------------------+
| titulo        estado     fecha       |
| ------------  --------   ----------  |
| Pago falla    Pendiente  05-10-2026  |
| Boton gris    Resuelto   04-10-2026  |
| Texto corta   En proc.   03-10-2026  |
+--------------------------------------+
```

**W4 — Panel: detalle de informe**

```
+--------------------------------------+
| < Volver      Informe #42            |
+--------------------------------------+
| Pago se corta en checkout            |
| Bug | Pendiente | 05-10 | Acme       |
+--------------------------------------+
|  +-------------+  URL    /checkout   |
|  |             |  Nav    Firefox     |
|  |  captura    |  OS     Windows     |
|  |             |  View   1920x1080   |
|  +-------------+  DPR    1.5         |
| [Zoom]           User    u_123       |
+--------------------------------------+
| Registros de consola (12)            |
|  TypeError: x is null  checkout:42   |
|  [ver todo]                          |
+--------------------------------------+
| Estado: [Pendiente][En proc][Resuelt] |
| [Reabrir]                            |
+--------------------------------------+
| Nota interna                         |
| [___________________________][Anadir]|
| - reproduce pasos 3-4 con card X     |
+--------------------------------------+
| [Borrar informe] [Anonimizar usuario]|
+--------------------------------------+
```

---

## 6. Criterios de aceptación

### 6.1 CA-01 … CA-05 (`mission-brief.md` §5)

| ID | Propiedad | Método de verificación **(enmendado por `R-12`)** |
|----|-----------|---------------------------------------------------|
| **CA-01** | Todo informe enviado valida contra el esquema JSON oficial. `consoleLogs` obligatorio en *bug*, opcional en *feedback* | Aserciones de contrato contra `schema/report.schema.json` **a través del camino real de ingesta** |
| **CA-02** | Al aplicar máscaras, los píxeles de la región se reemplazan **permanentemente** por relleno opaco en el canvas final, **antes** de codificar | e2e aplica la máscara, **intercepta la petición HTTP saliente**, decodifica la imagen adjunta y comprueba que los valores de píxel originales de la región están **ausentes en los bytes codificados** |
| **CA-03** | Distribuible compilado ≤ 45 KB gzipped por los niveles de `R-01`. Caída de Lighthouse ≤ 2 puntos | `npm run check:size` + ejecución de Lighthouse contra el fixture CSS hostil |
| **CA-04** | CSS hostil (`button { display: none !important }`) no altera visibilidad ni layout del widget | e2e inyecta el SDK en un fixture con CSS global agresivo y comprueba interactividad del lanzador y contenido del diálogo |
| **CA-05** | Cualquier petición no autenticada a rutas de la API del panel devuelve `401 Unauthorized` | Aserciones de endpoint con credenciales ausentes e inválidas |

> **Por qué cambió `CA-02`.** El método original era un test unitario del manipulador de la matriz de píxeles: eso demuestra que una función muta un array. El método actual demuestra la *irreversibilidad* de `SEC-02` sobre el artefacto que **realmente sale del navegador**. La propiedad no cambió; la evidencia se hizo fuerte (`R-12`).

### 6.2 Definition of Done

Un requisito está **Completo** cuando:

1. Está implementado dentro de las restricciones de `PROJECT.md` y `resolution-record.md` §5.
2. Está cubierto por una aserción en la **única suite e2e** **o** por `npm run check:size` — no se crea ningún otro artefacto de prueba (`R-12`).
3. Su comportamiento sensible a seguridad está verificado a **nivel de artefacto** (bytes codificados, respuesta HTTP, fila almacenada), no en el límite de una función.
4. Está commiteado y el cambio queda reflejado en la trazabilidad de `.planning/ROADMAP.md`.

### 6.3 Criterios de release

- `npm run check:size` pasa en todos los artefactos contra su nivel.
- La suite e2e pasa CA-01…CA-05 en los tres proyectos de Playwright: **chromium, firefox, webkit** (webkit ejercita el fallback WebP→PNG; firefox el camino sin `ImageCapture`).
- `docker-compose up` levanta tres servicios funcionales en una máquina limpia usando solo `.env.example` como guía.
- **Ningún secreto** presente en el repositorio.
- ⚠ `Q-05`: confirmada la política de propiedad intelectual de la universidad antes de hacer público el repositorio (Apache-2.0, `R-07`).

---

## 7. Registro de riesgos

> Origen: `.planning/research/PITFALLS.md` (26 hallazgos), `SUMMARY.md` (correcciones y conflictos) y los bloques *Rationale / Risks* de `.planning/ROADMAP.md`.

### 7.1 Críticos

| ID | Riesgo | Prob. | Impacto | Mitigación | Fase |
|----|--------|-------|---------|------------|------|
| **RSK-01** | Texto pixelado o desenfocado **se reconstruye** (Unredacter, Depix, Shacham et al., Underactor) → fuga de datos sensibles | Alta | Crítico | `R-13`/`A-01`: **relleno opaco plano (α=255)** como único primitivo automático. Pixelación solo opt-in con bloque ≥ `max(8 px, 2×cap-height)` y rejilla alineada. Desenfoque gaussiano **prohibido** | 2, 3 |
| **RSK-02** | Píxeles originales vivos en la pila de *deshacer*, en exportaciones por capas o en capas *offscreen* → se codifican sin enmascarar | Media | Crítico | `A-04`/C-2: **un único bitmap aplanado**; máscaras destructivas y **no undoables**; anotaciones vectoriales sobre el bitmap ya enmascarado; **un único sumidero `toBlob`** (puerta grep) | 3 |
| **RSK-03** | Stored XSS vía logs de consola, títulos o notas renderizados en el panel | Media | Crítico | Sanitizar al ingerir (`sanitize-html`) **y** renderizar inerte en el panel: nodos de texto de React, **cero `dangerouslySetInnerHTML`**. Fixtures hostiles en la suite e2e | 1, 6 |
| **RSK-04** | XSS vía imagen: SVG (formato de texto activo), binarios políglotos, falta de `nosniff` | Media | Crítico | Allowlist **solo webp/png**, SVG rechazado incondicionalmente, re-encode al ingerir, `nosniff` + `Content-Disposition: attachment` + `CSP: sandbox` en blobs | 1, 5 |
| **RSK-05** | *Path traversal* al servir capturas desde el volumen (`R-04`) | Media | Crítico | Claves UUIDv4 generadas por servidor; resolución **solo por consulta a BD** (la petición nunca nombra un archivo); volumen montado **únicamente** en `api` con aserción de CI; `path.resolve` + prefijo | 1, 5 |

### 7.2 Altos

| ID | Riesgo | Mitigación | Fase |
|----|--------|------------|------|
| **RSK-06** | Exfiltración de secretos a través de los logs de consola de la propia app (tokens en mensajes, cabeceras arrastradas por errores serializados) | Esquema de payload **cerrado**, *scrubber* de secretos en origen, serialización ansiosa (se descartan referencias a objetos), nunca enviar `document.referrer`, puerta grep de `document.cookie|localStorage|Authorization|Bearer` en `packages/sdk` | 4 |
| **RSK-07** | `keepalive`/`sendBeacon` limitados a **64 KiB** → un informe con captura no puede usar ese transporte | Transporte de dos carriles: `fetch` plano con clave de idempotencia + **cola de durableza en IndexedDB** vaciada en `pageshow` | 7 (cola), 2 (carril 1) |
| **RSK-08** | **iOS no tiene `getDisplayMedia`**; `preferCurrentTab` es solo Chromium; el límite de 16 777 216 px de Safari deja capturas en blanco | Cadena de captura + estado de fallo visible + adjunto manual diseñado **desde el diseño**, no pegado después | 3 |
| **RSK-09** | Aislamiento del widget roto por CSS hostil o *containing blocks* | Set completo de hardening del `WidgetHost`: `!important` en línea, anclado a `documentElement`, `:host { all: initial }` + re-declaración explícita, unidades px, sin `part`/`::theme`, `<style>` interno, build `SHADOW_MODE=open` para e2e | 2 |
| **RSK-10** | Rebases de presupuesto: peor caso 45 + 25 + 14 = **84 KB > 80 KB** | `check:size` con escenario **multi-artefacto desde la Fase 1**; presupuesto de chunk revisado con medidas reales | 1, 7 |
| **RSK-11** | Purgar `user.*` **no anonimiza** el informe: la captura y la consola también son datos personales | `A-02`: TTL sobre artefactos completos, no solo identidad | 6 |
| **RSK-12** | Documentar la supresión de identidad como "anonimización" es una afirmación RGPD falsa | La documentación de integración debe ser honesta; **revisión legal antes de cualquier afirmación de cumplimiento** | 6 |

### 7.3 Medios y bajos

| ID | Riesgo | Prob. | Mitigación | Fase / plazo |
|----|--------|-------|------------|--------------|
| **RSK-13** | `@fastify/multipart` ↔ Fastify 5 sin tabla de compatibilidad (**UNVERIFIED**) | Media | *Smoke-test* en la primera fase de `apps/api`. Fallback *base64-in-JSON* = cambio de contrato → **consulta obligatoria** | 1 |
| **RSK-14** | Ecosistema TS 7.x inmaduro (drizzle-kit, tsx, plugins de vite) (**UNVERIFIED**) | Media | Fallback a la línea 6.x — no cambia producto, solo tooling | 1 |
| **RSK-15** | Ad-blockers / listas de filtros bloquean el script | Media | Rutas neutras (`/api/incidents`, `/w.js`), fallo **visible**, retest de listas en release (las listas cambian) | 7 |
| **RSK-16** | Node 24 entra en mantenimiento **2026-10-20**; Node 26 es Active LTS **2026-10-28** | Alta | Fijar `node:24.21.0-alpine3.24` ahora; **programar un re-pin** tras el 28-10 | Post-28-10 |
| **RSK-17** | La política de IP de la universidad no permite Apache-2.0 | Baja | `Q-05` es **puerta de release**: repo privado hasta confirmar | Release |
| **RSK-18** | Rotar `project_key` rompe scripts ya desplegados | Media | `Q-07`: decidir **período de gracia vs corte instantivo** en `/gsd-plan-phase 5`, no improvisar en ejecución | 5 |
| **RSK-19** | `R-12` elimina la red de seguridad de tests unitarios sobre lógica pura | Media | Compensado con aserciones a nivel de artefacto (más fuertes) + puertas grep estáticas + `check:size` | Transversal |
| **RSK-20** | Máscaras no deshacibles: consecuencia UX **no validada** | Media | *Spike* de UX de máscara en Fase 3 | 3 |
| **RSK-21** | Falta `fetchLater()` está sin verificar | Alta | **No diseñar contra él** | — |
| **RSK-22** | Ausencia de `getDisplayMedia` en móvil con fuente **LOW** | Media | Re-test de la matriz de captura en Fase 7 | 7 |
| **RSK-23** | La CSP de la página anfitriona (`script-src`/`connect-src`) bloquea la carga del script o el `fetch` de ingesta | Media | Estudio ya realizado en `PITFALLS.md` H-8: entrega *first-party* desde el propio origen como perfil por defecto; documentar en la guía de integración las directivas exactas a añadir si la carga es cross-origin (`script-src https://<host-watchbug>; connect-src https://<host-watchbug>`), soporte SRI y opción módulo ES; fallo **visible**, nunca silencioso | 7 |
| **RSK-24** | La cola de durableza falla si IndexedDB está bloqueado o revota cuota (modo privado estricto) | Media | Fallback explícito: cola **en memoria** + estado visible "no se pudo guardar — reintentar" (nunca descarte silencioso, coherente con M-6). Multi-pestaña: sin carrera nueva — la misma `Idempotency-Key` + `UNIQUE (project_id, idempotency_key)` deduplica en servidor (`ARCHITECTURE.md`), documentarlo | 7 |
| **RSK-25** | Archivos huérfanos en el volumen: caída entre el `rename` del blob y el `INSERT` en BD, o carrera con la purga `RET-02` | Baja | Reconciliación en la rutina de purga: barrido con umbral de edad (>24 h, nunca toca subidas en vuelo) que borre blobs sin fila y detecte filas sin blob; resultados registrados en `purge_runs.details` | 6, 7 |

---

## 8. Modelo de datos

> ## ⚠ BORRADOR — NO APROBADO
>
> El diseño interno de las tablas de la base de datos es una **decisión restringida** según `mission-brief.md` §3: exige una **Consultation Request Pack** antes de implementarse. Este apartado es una **propuesta derivada de los requisitos**, con el único propósito de que el PRD sea completo. No es una decisión aprobada.
>
> Adicionalmente, generar una migración con `drizzle-kit` es un disparador de consulta por sí mismo (`mentorship-pack` §5.2).

### 8.1 Entidades propuestas

```
projects 1 --- n incidents 1 --- n incident_comments
   |                  |
   |                  +---> (blob en FS: projectId/<xx>/<uuid>.<webp|png>)
   |
purge_runs   (registro de ejecuciones de purga, sin FK)
```

#### `projects`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `name` | TEXT | NOT NULL |
| `public_key` | TEXT | UNIQUE, NOT NULL — clave pública de **solo escritura** (`R-06`) |
| `previous_public_key` | TEXT NULL | **Propuesta para `Q-07`**: ventana de gracia tras rotación |
| `key_rotated_at` | TIMESTAMPTZ NULL | Ídem |
| `key_grace_until` | TIMESTAMPTZ NULL | **Propuesta para `Q-07`**: antigua clave acepta escritura hasta esta fecha |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | `deleted_at` = borrado lógico en `PRJ-05` |

#### `incidents`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `project_id` | UUID | FK → `projects` **ON DELETE CASCADE** |
| `kind` | ENUM(`bug`,`feedback`) | `RF-01` / `RF-02` |
| `status` | ENUM(`pending`,`in_progress`,`resolved`) | `RF-06`; `TRI-06` añade transición de reapertura |
| `title` | TEXT | ≤ 200 |
| `description` | TEXT | ≤ 5 000 |
| `idempotency_key` | TEXT NULL | **UNIQUE (project_id, idempotency_key)** → `ING-03` |
| `url` | TEXT | **Solo ruta** — query y fragmento eliminados en origen (`R-08`) |
| `user_agent`, `language`, `timezone` | TEXT | `ENR-03` |
| `viewport`, `screen` | JSONB | `{width,height,dpr}` |
| `app_version` | TEXT NULL | `ENR-04` |
| `custom` | JSONB NULL | Lista de claves permitida, `INT-03` |
| `user_id`, `user_name`, `user_email` | TEXT NULL | **Identidad** (`R-09`) — hipo miembro de `RET-01` |
| `console_logs` | JSONB | ≤ 100 entradas · 2 048 car/msg · 1 024 car/arg · **48 KB total** (`A-06`) |
| `screenshot_key` | TEXT | Formato estricto `^[a-z0-9]{2}\/[a-f0-9-]{36}\.(webp\|png)$` |
| `screenshot_mime`, `screenshot_bytes`, `screenshot_width`, `screenshot_height` | — | Permiten servir blobs sin abrirlos (`C-4`) |
| `identity_purged_at` | TIMESTAMPTZ NULL | `RET-01` |
| `artifact_purged_at` | TIMESTAMPTZ NULL | `RET-02` |
| `occurred_at`, `client_ts`, `ingested_at`, `status_updated_at` | TIMESTAMPTZ | |

#### `incident_comments`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `incident_id` | UUID | FK → `incidents` ON DELETE CASCADE |
| `body` | TEXT | ≤ 5 000, sanitizado (`TRI-07`) |
| `created_at` | TIMESTAMPTZ | |

#### `purge_runs`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `ran_at` | TIMESTAMPTZ | |
| `identity_purged` | INT | Conteo de `user.*` purgados |
| `incidents_purged` | INT | Conteo de informes completos purgados |
| `details` | JSONB | Evidencia auditable del trabajo (`A-02`, `RET-02`) |

### 8.2 Índices propuestos

- `(project_id, created_at DESC)` — listado
- `(project_id, status)` — filtro de estado
- `(project_id, kind)` — filtro tipo
- Parcial: `WHERE identity_purged_at IS NULL` — trabajo de purga
- `UNIQUE (project_id, idempotency_key)` — deduplicación y **reproducción de respuesta** en reintento

### 8.3 Invariantes de almacenamiento

1. `screenshot_key` **nunca** se deriva de entrada del usuario.
2. Escritura: ruta temporal → `fsync` → `rename` (atómico).
3. El volumen **solo** está montado en el servicio `api`.
4. La ruta del blob solo se resuelve **por consulta a la base de datos**.
5. Reconciliación de huérfanos: la rutina de purga elimina blobs sin fila con umbral de edad (>24 h) y reporta filas sin blob, registrando el resultado en `purge_runs` (`RSK-25`).

---

## 9. Arquitectura de alto nivel y stack

### 9.1 Diagrama

```
   Página anfitriona
   +----------------------------------------------+
   |  <script async src="https://host/w.js">      |
   |  Watchbug.init({ projectKey })               |
   |                                              |
   |  +------------------------------------------+|      HTTPS multipart
   |  | packages/sdk  (Shadow DOM closed)        ||| ------------------+
   |  |                                          |||                   |
   |  |  CaptureSource -> Redactor(T1) -> Annotator|                    v
   |  |         |                 (T2)            ||          +-----------------+
   |  |         v                    v            ||          |   apps/api      |
   |  |      ImageData --------> toBlob (unico)   ||          |   Fastify 5     |
   |  |  Enricher -> Transport (fetch + cola IDB) ||          |                 |
   |  +------------------------------------------+|          | rate-limit      |
   +----------------------------------------------+          | Zod (CA-01)     |
                                                             | sanitize        |
   Panel del desarrollador                                   | Storage -> FS   |
   +---------------------------+                             | AuthProvider     |
   | apps/panel (React + Vite) | --/api--> nginx (proxy) ---+| (Argon2id+JWT)  |
   | estático, INV-03          |                             +--------+--------+
   +---------------------------+                                      |
                                                                      v
                                                            +------------------+
                                                            |  PostgreSQL 18   |
                                                            +------------------+
```

### 9.2 Workspaces (monorepo npm)

| Workspace | Responsabilidad |
|-----------|-----------------|
| `packages/contracts` | **El único** esquema oficial del payload (Zod 4) → emite `schema/report.schema.json`. El SDK lo importa **solo como tipos**. |
| `packages/sdk` | Cliente: widget, captura, redacción, anotación, transporte. **Cero dependencias de runtime.** |
| `apps/api` | Ingesta y API de administración (Fastify 5). |
| `apps/panel` | SPA estática React + Vite detrás de nginx (INV-03). |

### 9.3 Puertos (pragmático hexagonal — `R-02`)

| Lado | Puertos | Adaptador por defecto | Adaptadores reservados (costuras) |
|------|---------|----------------------|-----------------------------------|
| Cliente | `CaptureSource` | `DisplayMediaCapture` | `ManualFileCapture` (v1, 2º eslabón) · `DomSerializeCapture` (v2) |
| | `Redactor` | Reglas `SEC-01` | Reglas añadidas por el anfitrión |
| | `Enricher` | URL/UA/viewport/consola | Proveedores añadidos por el anfitrión |
| | `Annotator` | Editor canvas propio (chunk diferido) | — |
| | `Transport` | `fetch` + idempotencia + cola IDB | — |
| | `WidgetHost` | Shadow DOM `closed` | build `open` solo para e2e |
| Servidor | `Storage` | Volumen de sistema de archivos (`R-04`) | S3/MinIO (v2) |
| | `AuthProvider` | Administrador único desde `.env` (`R-05`) | Token estático (v2) |

**Regla:** puertos solo donde existe una **segunda implementación real**. Nada de `Clock`, `Logger` ni `IdGenerator` — exactamente la ceremonia que `R-02` advierte evitar.

**Orden de redacción (invariante de seguridad):**

- **T1** — redacción automática sobre `ImageData` **al capturar, antes de que el editor muestre la imagen**
- **T2** — las máscaras del usuario se hornean destructivamente al completar el trazo
- **T3** — al exportar: aplanar anotaciones → **rehornear todas las máscaras como ÚLTIMA operación de píxel** → re-ejecutar reglas T1 → `toBlob` nuevo

Con este orden, un trazo de anotación **no puede** filtrar píxeles enmascarados.

### 9.4 Stack versionado

> Versiones **verificadas en vivo el 2026-10-05** contra registros oficiales. Fuente completa con URLs: `.planning/research/STACK.md`.

| Capa | Elección | Versión | Nota |
|------|----------|---------|------|
| Runtime | Node LTS | `24.21.0` | ⚠ entra en mantenimiento 2026-10-20; re-pin a 26 tras 2026-10-28 |
| Lenguaje | TypeScript | 7.0.2 | ⚠ ecosistema de tooling **UNVERIFIED** → fallback 6.x |
| API | Fastify | 5.12.5 | `@fastify/rate-limit` 11.2.0 · `cors` 11.3.0 · `helmet` 13.1.1 · `cookie` 11.1.2 · `multipart` 10.1.2 ⚠ |
| ORM | Drizzle | 0.45.3 + kit 0.31.11 | Elegido sobre Kysely porque genera migraciones SQL **revisables** |
| BD | PostgreSQL | **18.6** | Sustituye al "16" ilustrativo de `R-15` |
| Esquema | Zod | 4.6.5 | `z.toJSONSchema()` nativo. `zod-to-json-schema` está **oficialmente deprecado** |
| Panel | React + Vite | 19.3.0 + 8.3.2 | Sin librerías de estado: `fetch` + hooks |
| Auth | `@node-rs/argon2` + `jose` | 2.2.1 + 6.2.12 | Binarios musl precompilados → sin `node-gyp` en la imagen |
| Build | esbuild | 0.28.2 | ⚠ **un formato por llamada** → IIFE + ESM = dos builds; el chunk anotador es una **segunda entrada** |
| Sanitización | `sanitize-html` | 2.18.0 | El panel usa nodos de texto de React, nunca HTML |
| e2e | Playwright | 1.63.0 | chromium + firefox + **webkit** (requerido) |
| Imágenes | `node` / `nginx` / `postgres` | `24.21.0-alpine3.24` / `130.5-alpine3.24` / `18.6-alpine3.24` | Tags completos, no canasta mutante |

### 9.5 Qué **no** se usa (y por qué)

| Descartado | Motivo |
|-----------|--------|
| `html2canvas` | ≈ 50 KB gzipped — solo ya excede todo el presupuesto del core (`D-04`) |
| `html-to-image` / serialización SVG como captura **principal** | 8–14 KB y fallos silenciosos en imágenes cross-origin, `<video>`, WebGL, fuentes (`D-08`) |
| `fabric.js` / `konva` | ≈ 85 KB / ≈ 45 KB gzipped (`D-05`) |
| Desenfoque gaussiano | Lineal, parcialmente invertible por deconvolución (`D-06`) |
| `zod-to-json-schema` | Deprecado por su propio mantenedor |
| `argon2` (nativo npm) | Ejecuta `node-gyp-build` en install — el dolor que queremos evitar |
| Redis para rate limiting | Exigiría un **cuarto contenedor** → violaría `INV-03` |
| `dotenv` | Node 24 ya tiene `--env-file` estable |
| Prisma / TypeORM / Knex | Capa pesada innecesaria frente a `drizzle-orm` + `pg` |
| Frameworks de test / cobertura de cobertura | `R-12`: política del propietario |
| `dangerouslySetInnerHTML` + DOMPurify | Reabre la superficie XSS que `SEC-05` está cerrando |

### 9.6 Despliegue

| Servicio | Imagen | Rol |
|----------|--------|-----|
| `db` | `postgres:18.6-alpine3.24` | Persistencia + volumen de adjuntos |
| `api` | `node:24.21.0-alpine3.24` | Ingesta, API admin, purga. **Único** contenedor con montado el volumen de blobs |
| `panel` | `nginx:1.30.5-alpine3.24` | SPA estática **y reverse proxy de `/api` → `api`** (`A-10`: mismo origen es obligatorio para `SameSite=Lax`) |

Exactamente tres servicios (`INV-03`). Sin secretos en el repositorio; `.env.example` como única guía (`SEC-04`).

---

## 10. Fuentes y trazabilidad

| Documento | Aporta |
|-----------|--------|
| `documentation/mission-brief.md` | RF-01…08, RNF-01…03, CA-01…05, no-goals, envelope de autonomía + §6 Enmienda |
| `documentation/mentorship-pack.md` | INV-01…03, SEC-01…06, objetivos de calidad + §6 Enmienda |
| `documentation/ase-instructions.md` | Marco C-B-D-C, artefactos de coordinación, mitigación de paradojas |
| `documentation/resolution-record.md` | Registro R-01…R-17, enmiendas A-01…A-13, dead-ends D-01…D-08, abiertas Q-01…Q-07 |
| `documentation/continuity-pack.md` | Estado de sesión, preguntas abiertas, caminos muertos |
| `.planning/PROJECT.md` | Qué es esto, valor núcleo, restricciones, decisiones clave |
| `.planning/REQUIREMENTS.md` | 70 requisitos v1, 17 v2, 13 exclusiones, historias, AC, DoD |
| `.planning/ROADMAP.md` | 7 fases, criterios de éxito, riesgos por fase, trazabilidad 70/70 |
| `.planning/research/` | STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY |
| `AGENTS.md` | Guía de ejecución y política de verificación `R-12` |

### Decisiones abiertas que este PRD **no** cierra

| ID | Abierta | Dónde se resuelve |
|----|---------|-------------------|
| Q-05 | Política de IP de la universidad para Apache-2.0 | Puerta de release |
| Q-07 | Rotación de clave: gracia vs corte instantivo | `/gsd-plan-phase 5` |
| — | Re-pin Node 24 → 26 | Tras 2026-10-28 |
| — | `@fastify/multipart` ↔ Fastify 5 y ecosistema TS 7 | *Smoke-test* Fase 1 |
| — | **Modelo de datos (apartado 8)** | Consultation Request Pack |
| — | Revisión legal RGPD antes de afirmar cumplimiento | Antes de publicar |
| — | Baseline TypeScript: 7.x vs 6.x (ecosistema de tooling UNVERIFIED, `RSK-14`) | Gate en la Fase 1: smoke-test de `drizzle-kit`/`tsx`/plugins de Vite; si hay fricción → baseline 6.x |

---
*PRD definido: 2026-10-05*
*Última actualización: 2026-10-05 tras la inicialización del proyecto (modo `MODE: CONSULT`)*
