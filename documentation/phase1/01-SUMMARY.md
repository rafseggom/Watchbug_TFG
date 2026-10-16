<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 1 — Resumen de ejecución: *Contracts & Ingest Slice*

| | |
|---|---|
| **Fase** | 1 — *Contracts & Ingest Slice* |
| **Rama** | `gsd/phase-1-contracts-ingest` |
| **Ejecutada** | 2026-10-12 |
| **Olas** | 4 planes (01-01 … 01-04) |
| **Commits de plan** | 31 (16 + 4 + 6 + 5) |
| **Suite e2e final** | **123/123** en chromium + firefox + webkit |
| **Estado** | ✅ Completa (4/4 planes) |

> Consolidación de `01-01-SUMMARY.md` … `01-04-SUMMARY.md`. Es un resumen ejecutivo, no una copia literal.

---

## 1. Qué se construyó

La fase levanta el **esqueleto andante** completo del producto: un `docker compose up` arranca `db` + `api` + `panel`, y un reporte sintético (imagen + metadatos) cruza la red hasta un **almacenamiento endurecido y validado por esquema** que se renderiza en un panel mínimo de dos columnas. El contrato único (`packages/contracts` → `schema/report.schema.json`), el conjunto de constantes vinculante (A-06) y la puerta de tamaño (`check:size`) existen desde el día uno.

### Ola 01-01 — Walking Skeleton (16 commits)

| Área | Entregado |
|---|---|
| **Contratos (CA-01)** | `constants.ts` con el conjunto A-06 completo **sin importar Zod** (seguro para el SDK); `schema.ts` con `z.strictObject`; `scripts/emit-schema.mjs` emite `schema/report.schema.json` con `z.toJSONSchema` nativo (nunca `zod-to-json-schema`) |
| **Shell del SDK** | 6 artefactos esbuild (IIFE + ESM × core / editor perezoso / adaptador opcional), define `SHADOW_MODE: 'closed'`, cero dependencias de runtime |
| **Stack compose** | Exactamente tres servicios fijados, puertos publicados solo en loopback, proxy same-origin de nginx (A-10), volumen de adjuntos **solo** en `api`, arranque del API aplicando la migración comprometida |
| **API** | `config.ts` fail-fast (clave ausente/vacía/placeholder/malformada → salida no-cero nombrando la variable y `.env`), seed idempotente del proyecto, las cinco etapas ordenadas de ingesta, `FsStorage` (claves generadas por servidor, tmp → fsync → rename, contención de rutas asertada dos veces), rutas CA-01 con idempotencia forzada por BD y cabeceras endurecidas de imagen |
| **Panel** | Tokens de diseño light/dark (sin colores hardcodeados), lista/detalle en dos columnas, render solo con nodos de texto, `fetch` same-origin |
| **Puertas + suite (R-12)** | `check:size` (tres carriles + el peor caso A-12 `45+25+14 = 84 > 80 KB` impreso en cada corrida), `check:compose`, y la suite Playwright única cubriendo DEP-01/DEP-02/ING-01/ING-03/ENR-06 |

### Ola 01-02 — Endurecimiento ante envíos hostiles (4 commits)

| Área | Entregado |
|---|---|
| **Topes ING-06 por capas** | Pre-lectura de `Content-Length` + contador de bytes en streaming + límites del parser multipart + comprobación semántica de 2 MB |
| **Guarda estructural pre-códec** | Recorrido de chunks PNG/WebP: metadatos descartados, `ANIM`/`ANMF` y datos colgantes rechazados |
| **Re-encode raíz (P1-D-10)** | `sharp@0.35.5` (aprobado por el propietario en el gate de la Tarea 1; solo `apps/api`) — mismo formato entrada/salida, metadatos eliminados, `timeout` + `limitInputPixels` |
| **Prueba C-4** | Nombres de fichero con forma de traversal rechazados con 400; las claves almacenadas siguen siendo generadas por servidor |
| **Suite** | `e2e/hostile.spec.ts` — 9 filas hostiles/servicio × 3 navegadores; **39/39 → 66/66** |

### Ola 01-03 — Control de acceso a la ingesta (6 commits)

| Área | Entregado |
|---|---|
| **ING-04 gate de clave** | 401 estructurado **byte-idéntico** para clave ausente/malformada/desconocida; cero escrituras; superficie de lectura intacta (clave write-only, seam DEP-03) |
| **ING-05 rate limiting** | Tres limitadores compuestos (por clave 10/min, por IP 30/min, por proyecto 2000/día) con fronteras inclusivas y `Retry-After` entero ≥ 1; límites antes de cualquier escritura |
| **ING-08 allowlist de origen** | `WATCHBUG_CORS_ORIGINS` con la regla «Origin presente» (403 para orígenes de navegador fuera de la lista; clientes sin `Origin` aceptados) |
| **Suite** | Grupo hostil 9 → 16 filas × 3 navegadores; **66/66 → 87/87** |

### Ola 01-04 — Seguridad de texto y primera experiencia (5 commits)

| Área | Entregado |
|---|---|
| **ING-07 doble control C-3** | `sanitize-html` pasada 1 (todo string de usuario → texto sin marcado, texto plano literal, controles eliminados, tope revalidado) + panel con render solo de nodos de texto bajo una **puerta de sumidero a nivel de fuente** |
| **P1-D-05 i18n** | Diccionarios `en`/`es` hechos a mano (el español tipado contra las claves inglesas), detección `navigator.language`, persistencia `watchbug.lang`, `LanguageSwitcher` |
| **P1-D-07 onboarding** | Estado vacío con `buildOnboardingCurl(origin, projectKey)` + `GET /api/setup` → `{ projectKey }`, con una fila e2e que **ejecuta el curl emitido literalmente** |
| **Deuda cerrada** | El defecto `meta` + `Content-Type: application/json` → `"[object Object]"` (diferido en 01-02/01-03) queda **RESUELTO** en `ddaef5a` |
| **Suite** | **87/87 → 123/123** |

---

## 2. Resultados de verificación (finales)

| Puerta | Comando | Resultado |
|---|---|---|
| Build (4 workspaces) | `npm run build` | ✅ PASS |
| Typecheck | `npm run lint` | ✅ PASS (0 errores) |
| Puerta de tamaño | `npm run check:size` | ✅ PASS — peor caso `45 + 25 + 14 = 84 > 80 KB` impreso (A-12/M-2) |
| Puerta de compose | `npm run check:compose` | ✅ PASS — 3 servicios, volumen solo en `api` |
| Suite e2e (R-12) | `npm run verify` | ✅ **123/123** (chromium + firefox + webkit) |
| Deriva de esquema | `db:generate` | ✅ PASS — «No schema changes» |

> Tras la ronda de correcciones de revisión (`01-REVIEW-FIX.md`) la suite creció a **132/132** (3 filas de regresión CR-01/CR-02). Ver `01-VERIFICATION.md`.

---

## 3. Desviaciones por ola

### 01-01 — 4 autocorregidas

| # | Regla | Problema | Corrección |
|---|---|---|---|
| 1 | Bug | El layout del volumen `postgres:18` en `/var/lib/postgresql/data` fue rechazado en reinicio; además `127.0.0.1:5432` colisionaba | Volumen → `/var/lib/postgresql`; puerto db → `127.0.0.1:5433` (`eb432a5`) |
| 2 | Bug | El API escuchaba en `127.0.0.1` dentro del contenedor → nginx 502 | Nueva variable `WATCHBUG_HOST` (default `127.0.0.1`; compose `0.0.0.0`) (`21d4511`) |
| 3 | Bug | `X-Content-Type-Options` duplicado en dos capas | `proxy_hide_header` en nginx + `config: { helmet: false }` en la ruta de imagen (`21d4511`) |
| 4 | Scope | `rate-limit`/`cors` aterrizaron pronto y rompieron la suite | Retirados; pertenecen a 01-03 por la tabla de artefactos del plan (`21d4511`) |

### 01-02 — 3 autocorregidas

| # | Regla | Problema | Corrección |
|---|---|---|---|
| 1 | Bloqueante | Un hook `onRequest` síncrono de Fastify estanca todos los POST | `bodyCaps` ahora `async` (`8f54c79`) |
| 2 | Bug | `fieldSize: 4096` hacía inalcanzable `MAX_META_BYTES` (busboy trunca en silencio) | `fieldSize: MAX_META_BYTES` (64 KB) (`8f54c79`) |
| 3 | Bug | busboy aplicaba `basename()` y ocultaba el nombre traversal de la regla C-4 | `preservePath: true` (`8f54c79`) |

### 01-03 — 1 autocorregida

| # | Regla | Problema | Corrección |
|---|---|---|---|
| 1 | Bloqueante | Los valores de ejemplo del plan no pueden probar las tres dimensiones (por clave y por día comparten bucket) | Máximos e2e ordenados `1200 / 600 / 2000` en `.env` local (defaults de producción 10/30/2000 intactos) (`6694422`/`6d576ed`) |

### 01-04 — 2 autocorregidas

| # | Regla | Problema | Corrección |
|---|---|---|---|
| 1 | Falta crítico | El defecto `meta` JSON diferido (`"[object Object]"`) rompía el curl de onboarding | Re-stringificar el objeto parseado (`ddaef5a`) |
| 2 | Bug | La premisa «los topes cuentan unidades UTF-16» es falsa: Zod 4.6.5 cuenta **puntos de código** | La fila e2e fija la semántica real; sin cambio de esquema (`840be33`) |

---

## 4. Decisiones clave registradas

| Decisión | Detalle |
|---|---|
| **`sharp` como único backend de endurecimiento** | El strip/rebuild estructural sin dependencias se movió a `structure.ts` como **guarda** pre-códec (no decodifica, descarta metadatos, rechaza animación/datos colgantes) |
| **`fieldSize: MAX_META_BYTES`, no 4 KB** | A 4 KB una nota legítima (hasta 5.000 chars) es truncada en silencio por busboy |
| **`preservePath: true`** | Sin él, la regla C-4 es inalcanzable |
| **Sondear, no escuchar, el socket** | El contador de streaming muestrea `socket.bytesRead`; adjuntar un listener `'data'` reanudaría el stream antes del pipe multipart |
| **Incrementar-antes-de-decidir** | Los tres limitadores incrementan todos los contadores antes de cualquier 429 |
| **Decodificación de entidades con guarda** | `toPlainText` decodifica los re-escapes de sanitize-html **solo** si el valor decodificado no puede reabrir una etiqueta |
| **Orden validar → sanear → revalidar** | La revalidación post-saneado garantiza que un valor almacenado nunca exceda su tope |
| **Topes = puntos de código Unicode** | Semántica de Zod 4.6.5, también lo que significa `maxLength` en el JSON Schema publicado |
| **Estado vacío intercepta solo la lista** | `page.route` sobre `GET /api/incidents` con `[]`; `/api/setup`, el componente y el comando emitido siguen siendo reales |

---

## 5. Cumplimiento de la puerta TDD

Todas las tareas marcadas `tdd="true"` siguen RED → GREEN con evidencia persistida (`verdict: RED_EVIDENCE_OK`):

| Ola | RED | GREEN | REFACTOR |
|---|---|---|---|
| 01-02 | 1 registro | 1 | no necesario |
| 01-03 | 3 registros | 3 | no necesario |
| 01-04 | 2 registros | 3 (una tarea sin TDD) | no necesario |

Los registros viven en `01-0X-red-evidence-taskN.json`. El orden `test(01-0X)` → `feat(01-0X)` se verifica por grep.

---

## 6. Elementos diferidos (no defectos de esta fase)

| Elemento | Estado / Propietario |
|---|---|
| `meta` + `Content-Type: application/json` → `"[object Object]"` | ✅ **RESUELTO** en 01-04 (`ddaef5a`) |
| 4 avisos `npm audit` moderados en la cadena esbuild **dev-only** de `drizzle-kit` | Abierto — el único arreglo ofrecido degrada `drizzle-kit` a `0.18.1` (decisión del propietario) |
| Re-pin de la imagen Node 24 | Programado tras 2026-10-20 (mantenimiento); Node 26 pasa a LTS el 2026-10-28 |
| `package-lock` mantenido a mano | Sin Dependabot |
| Superficie de lectura sin autenticar (DEP-03) | Fase 5 |
| Riesgo aceptado AR-02 (413 de pre-lectura perdido ante reset de socket a plena velocidad) | Aceptado por el propietario 2026-10-13; dead-ends D-09/D-10 |

---

## 7. Autocomprobación

- **Sin stubs conocidos:** ningún valor placeholder, componente sin datos ni test `skip`/`todo` (escaneo de stub limpio en todas las olas).
- **Todos los commits de plan existen** en el repositorio (31 en total).
- **Cada `<acceptance_criteria>` re-verificado** por ola (greps + suite).
- **Métricas medidas del libro mayor**, no narradas: 16 + 4 + 6 + 5 commits; duración total ≈ 3 h 47 min.

---

## 8. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-0x / A-xx** | Amendment del registro de decisiones (`documentation/resolution-record.md`) |
| **CA-0x** | Criterio de Aceptación del proyecto |
| **C-3 / C-4** | Clases de peligro: C-3 XSS/inyección en render; C-4 path traversal / ficheros |
| **CR-xx / WR-xx / IN-xx** | Hallazgos de revisión: crítico / warning / info |
| **DEP-0x** | Requisito de despliegue (*deployment*) |
| **e2e** | *End-to-end* (prueba de extremo a extremo) |
| **ENR-0x** | Requisito de enriquecimiento (*enrichment*) |
| **H-7 / H-9** | Peligros de investigación (H-7 abuso de ingesta; H-9 límites de transporte) |
| **ING-0x** | Requisito de ingesta (*ingest*) |
| **INV-0x** | Invariante arquitectónico no negociable |
| **M-1 / M-2** | Puntos del registro ligados a retención (M-1) y al gate de tamaño (M-2) |
| **P1-D-xx** | Decisión de implementación local de la Fase 1 |
| **R-xx** | Decisión/regla del registro global |
| **RED / GREEN** | Fases de TDD: prueba que falla / implementación que la hace pasar |
| **RF-xx / RNF-xx** | Requisito funcional / no funcional |
| **SEC-0x** | Requisito de seguridad |
| **TFG** | Trabajo Fin de Grado |
| **TTL** | *Time To Live* (vida útil antes de purga) |
| **UAT** | *User Acceptance Testing* (pruebas de aceptación de usuario) |
