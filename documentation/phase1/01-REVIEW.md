<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 1 — Revisión de código: *Contracts & Ingest Slice*

| | |
|---|---|
| **Fase** | 1 — *Contracts & Ingest Slice* |
| **Revisión** | 2026-10-13 · profundidad *standard* |
| **Ficheros revisados** | 75 (5 artefactos binarios de fixtures saltados) |
| **Hallazgos** | 13 — 2 críticos · 6 warning · 5 info |
| **Corregidos** | **8/8** críticos + warnings (evidencia RED→GREEN) |
| **Abiertos** | 5 (info, fuera del alcance de corrección) |

> Consolidación de `01-REVIEW.md`, `01-REVIEW-FIX.md` y `01-REVIEW-DISPOSITION.md`.

---

## 1. Resumen

El alcance de 78 rutas (contratos → cadena de ingesta → almacenamiento → rutas/plugins del API → panel → compose/e2e/gates) se leyó de extremo a extremo a profundidad estándar, juzgado contra los invariantes de AGENTS.md/mentorship-pack (SEC-04/05, R-04, R-13, INV-03, R-12).

La propia cadena de ingesta está **bien ordenada** (guardas baratas → códec → saneado → almacenamiento), el manejo de rutas es generado por servidor con doble validación, el oráculo del 401 es genuinamente uniforme y la pasada de saneado es sólida. Pero las puertas no podían ver **dos bypasses de rate-limit**, ambos confirmados empíricamente contra este runtime: las tres dimensiones de ING-05/SEC-05 eran falseables — los buckets por clave/día mediante una asimetría de normalización de la clave (CR-01), el bucket por IP mediante `X-Forwarded-For` controlado por el cliente bajo la configuración `trustProxy=true` que los docs y la suite exigían (CR-02).

También se encontró: un lookup de replay no acotado al proyecto (bug latente cross-tenant al llegar el CRUD de proyectos en Fase 5), el tope de 2 MB de A-06 aplicado solo a la imagen de *entrada* (el re-encode almacenado podía excederlo), una fuga de blobs huérfanos ante fallo de BD, un `.env.example` cuyos valores de rate-limit hacían fallar el quickstart documentado, una carrera de doble envío entre el watcher del 413 y el handler, y el contenedor del API corriendo como root.

**Observaciones de alcance (no hallazgos):** la superficie de lectura (`GET /api/incidents`, `GET /api/setup`) es no autenticada por diseño (DEP-03/T-01-16, Fase 5); los jobs de purga TTL (A-02), las transiciones de estado, el CRUD de proyectos y el widget/SDK son fases posteriores; la ausencia de tests unitarios es política del propietario (R-12); `GET /api/incidents` no está paginado ni acotado por proyecto (rendimiento/alcance, Fases 5/6).

---

## 2. Hallazgos y disposición

| ID | Severidad | Título | Disposición |
|---|---|---|---|
| **CR-01** | crítica | Buckets por clave/día sobre la cabecera cruda mientras el gate la recorta — bypass de cuota por relleno de cabecera | ✅ corregido |
| **CR-02** | crítica | `trustProxy=true` hace falseable el limitador por IP — `req.ip` es la entrada izquierda controlada por el cliente de `X-Forwarded-For` | ✅ corregido |
| **WR-01** | warning | Lookup de replay no acotado al proyecto — id cross-tenant incorrecto en conflicto | ✅ corregido |
| **WR-02** | warning | El tope semántico de 2 MB de A-06 solo se comprueba en la entrada — el re-encode almacenado nunca se re-acota | ✅ corregido |
| **WR-03** | warning | Blob escrito antes del insert sin limpieza — ficheros huérfanos en cualquier fallo de BD | ✅ corregido |
| **WR-04** | warning | Los valores de rate-limit de `.env.example` hacen fallar el quickstart documentado en `npm run verify` | ✅ corregido |
| **WR-05** | warning | El watcher del 413 en streaming compite con el handler — doble `reply.send` y logs falsos de 500 | ✅ corregido |
| **WR-06** | warning | El contenedor del API corre como root | ✅ corregido |
| **IN-01** | info | El parseo del cuerpo corre antes del preHandler de rate-limit — hasta 1 MB de JSON parseado antes de cualquier limitador | ⬜ abierto |
| **IN-02** | info | La ruta de blob abre el stream de lectura antes de validar el tipo de contenido almacenado | ⬜ abierto |
| **IN-03** | info | El documento HTML del panel se sirve sin CSP | ⬜ abierto |
| **IN-04** | info | La regla `url` solo-ruta de R-08 no se aplica en ningún sitio del servidor | ⬜ abierto |
| **IN-05** | info | La rama `BodyCapExceeded` es inalcanzable *y* destruye el socket antes de enviar la respuesta | ⬜ abierto |

---

## 3. Detalle de los hallazgos críticos

### CR-01 — Bypass de cuota por relleno de cabecera

**Fichero:** `apps/api/src/plugins/rate-limit.ts:80` (vs. `routes/incidents.ts:124` y `:83`).

El limitador agrupaba por `String(req.headers['x-project-key'] ?? '')` — el valor **crudo** — mientras el gate hace `raw.trim()`. `String.prototype.trim()` elimina espacios que el parser HTTP de Node **no** elimina: un byte `0xA0` (NBSP) en `X-Project-Key` llega intacto y `'\u00a0wkbt_…'.trim()` produce una clave válida. Así, una petición rellenada con N NBSP es **aceptada** pero contada en un **bucket fresco** por relleno, para `RATE_LIMIT_PER_KEY_PER_MIN` y `RATE_LIMIT_PER_PROJECT_PER_DAY`. Como la clave es pública (servida por `GET /api/setup`), cualquier cliente puede acuñar buckets ilimitados.

**Corrección aplicada:** `projectKeyOf` normaliza exactamente como el gate ING-04 (`raw.trim()` + `PROJECT_KEY_PATTERN.test`), de modo que una variante rellenada de una clave válida cae en su bucket y todo valor no-forma-clave comparte **un solo** bucket `''`.

**Evidencia RED→GREEN:** RED `4c68f28` (la variante NBSP no era limitada → 401 en vez de 429) → GREEN `5cacef1` (fila pasa, `Retry-After` entero).

### CR-02 — Limitador por IP falseable vía `X-Forwarded-For`

**Fichero:** `apps/panel/nginx.conf:23` + `apps/api/src/app.ts:47` + `.env.example:86-93`.

Con `trustProxy: true`, Fastify resuelve `req.ip` desde la entrada **izquierda** de `X-Forwarded-For` (verificado: `XFF: "203.0.113.7, 198.51.100.9"` → `req.ip = 203.0.113.7`). nginx usa `$proxy_add_x_forwarded_for`, que **añade** en lugar de sobrescribir, así que cualquier cliente que aporte su propio XFF ve su valor forjado elegido como clave del bucket. Combinado con CR-01, las **tres** dimensiones de ING-05 eran falseables con dos cabeceras.

**Corrección aplicada (opciones 1+2 de la revisión):**
1. nginx: `proxy_set_header X-Forwarded-For $remote_addr;` — **sobrescribir**, nunca añadir.
2. `WATCHBUG_TRUST_PROXY` ahora parsea `true | false | lista-de-confianza` (`config.ts` `readTrustProxy`). Con una lista, `@fastify/proxy-addr` resuelve `req.ip` desde la **primera entrada no confiable** hacia fuera (el hop asertado por el proxy) en vez de la izquierda atacante. Entradas inválidas → fallo ruidoso al construir Fastify.
3. `.env.example` entrega el valor funcional `127.0.0.1/8,::1/128,172.16.0.0/12`.

**Evidencia RED→GREEN:** RED `458278c` (dos filas fallan contra `trustProxy=true` + nginx aditivo) → GREEN `f2a8f4e`.

**Residual documentado:** un cliente **de loopback** aún puede elegir su bucket con una sola entrada XFF — es la entrada de confianza deliberada para herramientas locales/tests. Todas las demás rutas quedan cerradas.

---

## 4. Detalle de los hallazgos warning

| ID | Corrección aplicada | Commit |
|---|---|---|
| **WR-01** | El `SELECT` de replay es ahora `WHERE project_id = ? AND idempotency_key = ?`, espejo del índice único. Sin fila RED (bug latente, no construible e2e hasta el CRUD de Fase 5) | `453539f` |
| **WR-02** | Tras `hardenImage()`, `hardened.bytes.length > MAX_ENCODED_IMAGE_BYTES` devuelve el mismo 413 estructurado **antes** de `storage.put`. *Corregido: requiere verificación humana* (sin fila RED: payload dependiente del encoder) | `d8990a3` |
| **WR-03** | El insert se envuelve en `try/catch`; en fallo se borra el blob recién escrito antes de relanzar; el borrado del path de replay es best-effort con log. *Corregido: requiere verificación humana* (control de flujo) | `4d8bf75` |
| **WR-04** | **Diagnóstico: los valores de ejemplo eran el defecto, la validación era correcta.** Solo se cambiaron los valores: `.env.example` entrega `1200/600/2000` — la configuración con que se produjo la evidencia verde de la fase — con un bloque de comentario que explica ambas restricciones y apunta a los defaults de producción (`10/30/2000`) | `7e8ee09` |
| **WR-05** | Tres guardas: el watcher incluye `reply.sent` antes de enviar; el catch de la ruta `if (reply.sent) return;` y clasifica los abortos de stream como `failure(413, …)`; `app.setErrorHandler` comprueba `reply.sent` antes de un segundo envío. Confirmado: grupo ING-06 5/5 y **cero** líneas `[watchbug] unhandled error` en los logs | `8b5fb45` |
| **WR-06** | La etapa runtime hace `mkdir -p /data && chown node:node /data` y `USER node` (uid 1000); sin `chown -R /app` (todo bajo `/app` es de solo lectura). Volumen local migrado en sitio una vez. Verificado: `id` → `uid=1000(node)`; escritura en `/data` OK; suite 132/132 con contenedor no-root | `b67fd54` |

---

## 5. Hallazgos informativos abiertos (deliberadamente fuera de alcance `critical_warning`)

| ID | Descripción | Por qué se deja abierto |
|---|---|---|
| **IN-01** | El parseo del cuerpo corre antes del preHandler de rate-limit; hasta 1 MB de JSON se parsea antes de cualquier limitador. Impacto bajo hoy; relevante antes de que la Fase 4 añada payloads de consola | No incumple ningún criterio de aceptación |
| **IN-02** | La ruta de blob abre el stream antes de validar el tipo de contenido; la rama es inalcanzable hoy, pero si dispara fuga un descriptor | Inalcanzable bajo la restricción CHECK actual |
| **IN-03** | El documento HTML del panel se sirve sin CSP. Solo defensa en profundidad (no hay sumidero HTML hoy, y la suite lo pinza) | El freno XSS más barato que queda para una página que renderiza texto atacante |
| **IN-04** | La regla `url` solo-ruta de R-08 no se aplica server-side; un llamador directo puede persistir un `?token=` en la superficie de lectura no autenticada | Enforcement delegado al SDK de Fase 2 |
| **IN-05** | La rama `BodyCapExceeded` es inalcanzable (los límites multipart acotan por debajo de `MAX_BODY_BYTES`) y destruye el socket antes de enviar la respuesta — código defensivo muerto con orden de flush invertido | Disparará el día que cambie un tope |

Ninguno incumplió un criterio de aceptación del plan. Ver `01-VERIFICATION.md` § «Hallazgos de revisión».

---

## 6. Puertas tras la corrección

| Puerta | Resultado |
|---|---|
| `npm run build` | ✅ PASS |
| `npm run lint` (tsc, 4 workspaces) | ✅ PASS — 0 errores |
| `npm run check:size` | ✅ PASS |
| `npm run check:compose` | ✅ PASS |
| `npm run verify` | ✅ **132/132** (baseline 123 + 3 filas de regresión × 3 navegadores), corrido dos veces |

Las correcciones se ejecutaron en un **worktree aislado** (`gsd-reviewfix/01-16948`, desde `gsd/phase-1-contracts-ingest` @ `443088b`), no en el checkout principal.

**Sin triggers de consulta:** sin cambio de esquema de `/api/incidents` (CA-01), sin cambio de `window.Watchbug.init()`, sin cambio de Shadow DOM, sin dependencia nueva, **sin migración de BD**.

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **ACAO** | *Access-Control-Allow-Origin* (cabecera CORS) |
| **CA-01** | Criterio de Aceptación: esquema JSON único del reporte |
| **C-3 / C-4** | Clases de peligro: C-3 XSS/inyección en render; C-4 path traversal / ficheros |
| **CR-xx / WR-xx / IN-xx** | Hallazgos de revisión: crítico / warning / info |
| **CSP** | *Content-Security-Policy* (cabecera) |
| **DEP-03** | Requisito de despliegue (blob solo por API autenticada) |
| **e2e** | *End-to-end* (prueba de extremo a extremo) |
| **IDOR** | *Insecure Direct Object Reference* |
| **ING-0x** | Requisito de ingesta (*ingest*) |
| **INV-0x** | Invariante arquitectónico no negociable |
| **NBSP** | *Non-Breaking Space* (espacio duro, byte `0xA0`) |
| **OWS** | *Optional Whitespace* (espacios opcionales en cabeceras HTTP) |
| **RED / GREEN** | Fases de TDD: prueba que falla / implementación que la hace pasar |
| **R-08** | Regla del registro: `url` sin query ni fragmento |
| **R-12** | Regla del registro: verificación solo e2e + gates |
| **R-13** | Regla del registro: primitiva de enmascarado (relleno opaco plano) |
| **SEC-05** | Requisito de seguridad: saneado XSS + rate limiting |
| **TFG** | Trabajo Fin de Grado |
| **TTL** | *Time To Live* (vida útil antes de purga) |
| **XFF** | `X-Forwarded-For` (cabecera de IP reenviada) |
| **XSS** | *Cross-Site Scripting* |
