<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 1 — Arquitectura y patrones: *Contracts & Ingest Slice*

| | |
|---|---|
| **Fase** | 1 — *Contracts & Ingest Slice* |
| **Mapa de patrones** | 2026-10-11 |
| **Ficheros analizados** | 27 (todos nuevos — greenfield) |
| **Análogos encontrados** | 0/27 — el repositorio no contenía código de aplicación |
| **Esqueleto andante** | Entregado por `01-01-PLAN.md` Tarea 2 (`type="tracer"`) |

> Consolidación de `01-PATTERNS.md` (mapa de patrones) y `SKELETON.md` (esqueleto andante).

---

## 1. Modo greenfield: el contrato de patrones

En el momento de la planificación el repositorio contenía **cero código de aplicación** — solo `AGENTS.md`, `documentation/`, `.planning/`, `.github/`, `.vscode/` y `sonar-project.properties`. Por tanto el mapa de patrones no encontró análogos: funciona como **contrato de patrones**, nombrando para cada fichero a crear su rol, su posición en el flujo de datos y la **fuente de patrón vinculante** de la que copiar.

| Fuente | Qué vincula |
|---|---|
| `AGENTS.md` | INV-01..03, SEC-01..06, RNF-01, R-13, **R-12 (solo e2e + gate de tamaño, sin tests unitarios)**, R-15, triggers de consulta |
| `documentation/resolution-record.md` | R-01..R-18 + A-01..A-12 (A-06 constantes, A-10 proxy nginx `/api`, A-12/M-2 `check:size` multi-artefacto) |
| `.planning/research/STACK.md` | Pines verificados + la lista vinculante «What NOT To Use» |
| `01-RESEARCH.md` | Patrones 1–9, ejemplos de código, peligros 1–9 |
| `01-CONTEXT.md` | Decisiones bloqueadas P1-D-01..P1-D-12 |

---

## 2. Decisiones arquitectónicas del esqueleto

| Decisión | Elección | Razón |
|---|---|---|
| **Monorepo** | npm workspaces: `packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel` | R-15 TypeScript extremo a extremo; el esquema único (CA-01) es estructuralmente verdadero |
| **Contrato** | `packages/contracts` (Zod 4.6.5) → `z.toJSONSchema(...)` emite `schema/report.schema.json` comprometido | Fuente única CA-01; el SDK importa solo tipos, Zod nunca llega al navegador (R-01) |
| **Conjunto de constantes** | `packages/contracts/src/constants.ts` — TS plano, cero import de Zod: topes A-06 + constantes de enmascarado R-13 | R-18 DRY: los clamps del cliente son UX; los topes del servidor son el control |
| **API** | Fastify 5.12.5 sobre Node `24.21.0-alpine3.24`; plugins multipart/helmet/cors/rate-limit | Pines verificados (A-09); el stack de plugins es el seam del borde HTTP |
| **Capa de datos** | PostgreSQL `18.6-alpine3.24` + Drizzle 0.45.3 (migraciones generadas por `drizzle-kit`, comprometidas) + `pg` 8.23.1 | Solo Drizzle emite migraciones SQL revisables |
| **Almacenamiento** | Volumen FS montado **solo** en `api`; claves UUIDv4 `projectId/<xx>/<uuid>.<ext>`; tmp→fsync→rename; servido solo por lookup de BD | R-04/C-4: la petición nunca nombra un fichero — el hueco de traversal es inexpresable |
| **Endurecimiento de imagen** | `hardenImage()` como módulo plano en la cadena ordenada (sniff → structure → dim guard → harden → store); backend strip/rebuild sin dependencias primero, re-encode `sharp` tras consulta (P1-D-10) | R-02 fija exactamente 8 puertos — esto es un módulo plano |
| **Auth** | Ninguna en Fase 1 — clave write-only `wkbt_` sembrada idempotentemente desde `.env` (P1-D-01/02/03); auth real en Fase 5 | Alcance de fase; la ruta de blob sale endurecida pero **sin promesa de auth** (DEP-03 completa Fase 5) |
| **Despliegue** | `docker-compose.yml` — exactamente 3 servicios `api`/`panel`/`db` (INV-03); nginx `1.30.5-alpine3.24` proxya `/api/` → `api:3000` (A-10); puertos publicados en `127.0.0.1` | Same-origin requerido para las cookies `SameSite=Lax` de Fase 5; binding a loopback es la postura de exposición de Fase 1 |
| **Layout de directorios** | Workspaces como arriba; API `src/{app,config,ports}.ts`, `src/routes/`, `src/ingest/`, `src/storage/`, `src/db/`, `src/boot/`; panel `src/{App,api,i18n}.ts(x)`, `src/components/`, `src/tokens.css` | Coincide con el mapa de ficheros de `01-PATTERNS.md` |
| **Verificación** | R-12: UNA suite Playwright 1.63.0 + gates `check:size` (RNF-01/A-12) y `check:compose` (C-4) | Política del propietario: **sin tests unitarios, sin umbrales de cobertura** |
| **Contrato de enmascarado** | `MASK_ALPHA_OPAQUE = 255`, `MASK_PIXELATION_MIN_BLOCK_PX = 8` aterrizan en `constants.ts` ya (R-13/A-01) | La decisión de la primitiva de enmascarado aterriza como contrato antes de que exista código de cliente |
| **i18n** | Diccionarios `en`/`es` a mano, autodetección `navigator.language`, selector en `localStorage` del panel (P1-D-05) | RNF-03; cero dependencias |

---

## 3. Capacidad probada de extremo a extremo

> Un desarrollador arranca el stack auto-hospedado de tres servicios con un `docker compose up` y empuja un reporte sintético — imagen + metadatos — por la red hacia un almacenamiento endurecido y validado por esquema que aterriza como fila de PostgreSQL con su imagen en el volumen de ficheros **solo del API**, y se renderiza en una página de panel mínima de dos columnas.

**Historia de usuario (objetivo de fase, encuadre MVP):**
**Como** desarrollador auto-hospedador, **quiero** arrancar el stack Watchbug y empujar un reporte (imagen + metadatos) por la red hacia un almacenamiento endurecido y validado por esquema que se renderiza en un panel mínimo, **para que** la columna vertebral de ingesta quede probada de extremo a extremo en mi propia infraestructura y ni el reporte ni su captura salgan nunca de ella.

### Stack tocado en Fase 1

- [x] Andamiaje de proyecto (npm workspaces, tsconfigs, builds esbuild/Vite, hook de lint Biome, gates)
- [x] Rutas HTTP reales: `GET /api/health`, `POST /api/incidents`, `GET /api/incidents`, `GET /api/incidents/:id/image`, `GET /api/setup`
- [x] Base de datos — escrituras reales (`INSERT … ON CONFLICT DO NOTHING`) y lecturas (lista + lookup de fila de blob) en PostgreSQL
- [x] UI — interacción lista → detalle cableada a la API por el proxy same-origin de nginx
- [x] Despliegue — run documentado de pila completa: `cp .env.example .env && npm run key:gen && docker compose up -d`

---

## 4. Clasificación de ficheros (rol / flujo de datos)

| Fichero nuevo/modificado | Rol | Flujo de datos | Análogo |
|---|---|---|---|
| `package.json` (raíz, workspaces) | config | build | ninguno — greenfield |
| `tsconfig.base.json` + tsconfigs por workspace | config | build | ninguno |
| `docker-compose.yml` | config | despliegue | ninguno |
| `.env.example` | config | despliegue | ninguno |
| `scripts/check-size.mjs` | utilidad (gate) | file-I/O / build | ninguno |
| `scripts/check-compose.mjs` | utilidad (gate) | file-I/O / build | ninguno |
| `playwright.config.ts` | config (arnés de test) | orquestación | ninguno |
| `e2e/*.spec.ts` | test | petición-respuesta (e2e) | ninguno |
| `e2e/fixtures/*` | fixture de test | datos estáticos | ninguno |
| `packages/contracts/src/{constants,schema,types}.ts` | modelo (constantes/esquema/tipos) | transform | ninguno |
| `packages/contracts/scripts/emit-schema.mjs` | utilidad (build) | file-I/O | ninguno |
| `schema/report.schema.json` | config (artefacto publicado) | salida generada | ninguno |
| `packages/sdk/` shell + build | config (solo shell) | build | ninguno |
| `apps/api/src/app.ts` | controlador (raíz de composición) | petición-respuesta | ninguno |
| `apps/api/src/ports.ts` | modelo (interfaces de seam) | contrato | ninguno |
| `apps/api/src/routes/incidents.ts` | controlador (ruta) | petición-respuesta (multipart) | ninguno |
| `apps/api/src/ingest/*` | utilidad (etapas de pipeline) | transform | ninguno |
| `apps/api/src/storage/fs-storage.ts` | servicio (adaptador) | file-I/O | ninguno |
| `apps/api/src/db/schema.ts` + migraciones | modelo / migración | CRUD / DDL | ninguno |
| `apps/api/src/boot/seed.ts` | servicio (arranque) | CRUD | ninguno |
| `apps/api/src/plugins/*` | middleware | petición-respuesta | ninguno |
| `apps/panel/src/{main.tsx,App.tsx}` | componente (shell) | petición-respuesta | ninguno |
| `apps/panel/src/components/*` | componente | petición-respuesta | ninguno |
| `apps/panel/src/{api.ts,i18n.ts,tokens.css}` | servicio / utilidad / config | petición-respuesta / estático | ninguno |

---

## 5. Asignaciones de patrón

> Cada asignación es «sin análogo — copiar del patrón de investigación nombrado».

### `packages/contracts/src/constants.ts` (modelo/constantes)

**Patrón fuente:** RESEARCH Patrón 1 + A-06. TS plano, **cero import de Zod** (seguro para el SDK, R-18 DRY). Incluye el conjunto completo A-06 (§4 de `01-RESEARCH.md`) más las constantes de enmascarado R-13 (`MASK_ALPHA_OPAQUE = 255`, `MASK_PIXELATION_MIN_BLOCK_PX = 8`). Nota los dos números de imagen: 4 MB guarda del parser vs 2 MB tope semántico.

### `packages/contracts/src/schema.ts` + `types.ts` (modelo/validación)

- El esquema Zod importa `constants.ts` para cada `maxLength`/tope — las constantes nunca se duplican en el esquema.
- `types.ts` exporta solo tipos TS; el SDK los consume vía `import type` para que Zod nunca llegue al cliente (R-01).
- La forma de error de respuesta es parte del contrato: cuerpos estructurados `401/400/413/429`.

### `emit-schema.mjs` + `schema/report.schema.json`

Genera el artefacto con `z.toJSONSchema(reportSchema, { target: 'draft-2020-12' })` y lo compromete (contrato revisable). **Nunca** escribirlo a mano; **nunca** añadir `zod-to-json-schema` (deprecado).

### `apps/api/src/app.ts` (controlador/raíz de composición)

- Una raíz de composición por proceso: registra helmet, cors (allowlist por env), rate-limit (`global: false`), multipart con `limits` explícitos, y cablea `routes/incidents.ts`.
- Orden de arranque: env fail-fast (P1-D-02) → conexión BD → seed idempotente del proyecto (P1-D-01) → listen.
- `trustProxy` fijado **explícita y documentadamente** (Pitfall 5) — nunca `true` a ciegas.

### `apps/api/src/routes/incidents.ts` (controlador/ruta)

**Cadena ordenada de ingesta:**
`Content-Length gate → rate limits → CORS → multipart limits → Zod validate → key check → magic-byte + structural → decode-bomb guard → re-encode → Storage.put → idempotent INSERT → replay-safe response`.

**Idempotencia:** `UNIQUE (project_id, idempotency_key)`, duplicados reproducen la respuesta almacenada; ausencia de `Idempotency-Key` → 400.

**Ruta de blob endurecida:** resolución de clave solo por BD, `Content-Type` desde allowlist del servidor, `nosniff` + `Content-Disposition: attachment` con nombre ASCII fijo + `CSP: default-src 'none'; sandbox` + `CORP: same-origin` + caché privada; id desconocido → **404, nunca 400**. Sin promesa de auth en esta fase.

### `apps/api/src/ingest/*` (utilidad/pipeline)

- **`caps.ts`** — pre-lectura de `Content-Length` → 413 + contador de bytes en streaming que destruye el stream pasado `MAX_BODY_BYTES`. **`bodyLimit` no acota multipart** (Pitfall 1): el compuesto es el único control agregado.
- **`sniff.ts`** — solo magic bytes, nunca el MIME declarado: firma PNG `137 80 78 71 13 10 26 10`; WebP `RIFF…WEBP`; lo demás → rechazar (P1-D-11: solo PNG+WebP, SVG incondicional).
- **`structure.ts`** — allowlist de chunks PNG `IHDR/PLTE/IDAT/IEND` (descartar `tEXt/eXIf/zTXt/iTXt/tIME`); allowlist RIFF WebP, rechazar `ANIM/ANMF`, descartar `EXIF/XMP/ICCP`, rechazar datos colgantes más allá del File Size declarado.
- **`guard.ts`** — guarda de bomba de decodificación desde cabeceras **antes de cualquier decodificación**: PNG IHDR w/h o canvas VP8X → rechazar `w*h > MAX_IMAGE_PIXELS` (16 MP) o `w/h > MAX_IMAGE_DIM` (8192).
- **`harden.ts`** — interfaz de re-encode `hardenImage(bytes) → { bytes, ext, w, h }` como **módulo plano** (R-02 fija exactamente 8 seams — esto no es un puerto). Mismo formato entrada/salida (P1-D-12).
- **`sanitize.ts`** — `sanitize-html` con **allowlist vacía** (`allowedTags: []`, `allowedAttributes: {}`).

### `apps/api/src/storage/fs-storage.ts` (servicio/adaptador)

- Forma del puerto (`ports.ts`): `put(bytes, ext, projectId)`, `stream(key)`, `delete(key)`; gramática de clave `^<projectId>/[a-f0-9]{2}/[0-9a-f-]{36}\.(webp|png)$`.
- Claves **generadas por servidor** (`crypto.randomUUID()`); un `put()` que tomara un nombre del cliente expresaría el hueco de traversal que R-04 prohíbe.
- Layout: `/volume/blobs/<projectId>/<uuid[0:2]>/<uuid>.<ext>`, escritura vía `/volume/tmp/<uuid>.part` → `fsync` → `rename()`.
- Cinturón y tirantes: `path.resolve(VOLUME, key)` + aserción de prefijo.
- **Orden escritura/insert:** `Storage.put` **luego** `INSERT … ON CONFLICT DO NOTHING`; en conflicto de idempotencia, borrar el blob recién escrito y reproducir la respuesta.

### `apps/api/src/db/schema.ts` + migraciones + `boot/seed.ts`

- Drizzle 0.45.3; migraciones generadas por `drizzle-kit` en `apps/api/drizzle/`, comprometidas y revisables. ⚠ Una migración es trigger de consulta.
- Tablas: `projects(id, name, public_key)` e `incidents` con `UNIQUE (project_id, idempotency_key)`, `storage_key`, `content_type`, `type`, `status` (sembrado `'pending'`), `created_at`, **columnas TTL desde el día uno** (M-1/A-02): `user_id/user_name/user_email` separables y `identity_purge_at`/`artifact_purge_at`.
- Seed (P1-D-01/02/03): `INSERT … ON CONFLICT DO NOTHING` al arrancar desde `WATCHBUG_PROJECT_KEY`; formato `wkbt_` + 32 chars base62 de `crypto.randomBytes` con **muestreo por rechazo** (el `byte % 62` ingenuo tiene sesgo de módulo).

### `apps/api/src/plugins/*` (middleware)

- **Rate limiting por capas (ING-05)** — store in-memory (sin Redis: INV-03), `429 + Retry-After`, tres limitadores `createRateLimit()`.
- **Allowlist CORS (ING-08, Pitfall 9):** aplicar `WATCHBUG_CORS_ORIGINS` **solo cuando hay cabecera `Origin`**; aceptar clientes sin cabecera (el curl de onboarding de P1-D-07 debe funcionar).

### `apps/panel/src/*` (componentes + servicio + config)

- **Layout de dos columnas desde el día uno** (P1-D-04) — las Fases 5/6 lo extienden, sin rediseño.
- **Tokens CSS con `prefers-color-scheme` light/dark desde el día uno** (P1-D-06) — sin colores hardcodeados.
- **i18n** a mano, autodetección `navigator.language`, selector en `localStorage` (P1-D-05; no toca SEC-03).
- **Estado vacío = onboarding** (P1-D-07): snippet `curl` copiable pre-rellenado con la clave real.
- **Regla de render (SEC-05 pasada 2):** cada campo del reporte se renderiza solo como nodo de texto React. **El conteo de `dangerouslySetInnerHTML` debe ser cero.** Las líneas de consola: solo texto, nunca enlazadas.
- `api.ts` — `fetch` plano contra `/api/...` (same-origin por el proxy nginx, A-10). Sin router/estado/datos de librerías.

### Herramientas raíz

- **`package.json`** — workspaces npm; scripts `build`, `check:size`, `check:compose`, `verify`, `lint`, `dev`. Imagen Node `24.21.0-alpine3.24`; TS 7.0.2 con fallback 6.x; el smoke-test de herramientas se pliega en el primer commit de andamiaje (Pitfall 8; P1-D-09).
- **`docker-compose.yml`** — exactamente 3 servicios (INV-03); el volumen de adjuntos monta **solo** en `api` (C-4); nginx proxya `/api/` → `api:3000` (A-10).
- **`.env.example`** — todo ajuste documentado (DEP-02/SEC-04): URL BD, `WATCHBUG_PROJECT_KEY`, `WATCHBUG_CORS_ORIGINS`, TTLs, knobs de rate-limit, ruta de volumen. Cero secretos en código; env vía `--env-file` (sin `dotenv`).
- **`scripts/check-size.mjs`** — `gzipSync` de `node:zlib`, cero dependencias; carriles core ≤ 45 KB gz / editor ≤ 25 KB / adaptador ≤ 14 KB / total ≤ 80 KB, con el peor caso `45+25+14 = 84 > 80 KB` **impreso visiblemente** (A-12/M-2).
- **`scripts/check-compose.mjs`** — falla si `panel` lista el volumen de adjuntos (C-4).
- **`playwright.config.ts`** — 3 proyectos: chromium + firefox + **webkit** (webkit ejercita el fallback silencioso WebP→PNG de la Fase 2).
- **`e2e/*`** — **el único artefacto de test** (R-12). Estructura mapeada 1:1 a los grupos CA-01…CA-05. Aserciones a nivel de artefacto (p. ej. la fila almacenada valida contra `schema/report.schema.json`).
- **`e2e/fixtures/`** — PNG + WebP válidos **y el conjunto hostil desde el día uno** (Pitfall 3): SVG (debe rechazar), políglota GIF/HTML, nombres con forma de traversal, strings XSS, y un fichero pequeño declarando un canvas enorme (bomba de decodificación).
- **`packages/sdk/` shell** — directorio + cableado esbuild (dos llamadas `build()`: IIFE + ESM) + el carril `check:size` solo. **Cero comportamiento** hasta la Fase 2; cero dependencias de runtime (R-01).

---

## 6. Patrones compartidos

| Patrón | Aplica a | Esencia |
|---|---|---|
| **Política de verificación (R-12)** | TODOS los ficheros | Sin framework unitario, sin tests por función, sin umbrales de cobertura. Verificación = `npm run verify` + gates `check:size`/`check:compose`. Los gates son scripts, no tests |
| **Constantes fuente única (R-18 DRY)** | contracts, api, panel, sdk | Cada tope/tamaño/cuenta/TTL vive una vez en `constants.ts`; el esquema, el borde y los clamps lo importan. Clamps del cliente = UX; topes del servidor = control |
| **Forma de error/respuesta** | todas las rutas del API | Errores JSON estructurados con `statusCode` (401, 400, 413, 429 + `Retry-After`, 404 en blob — nunca 400). Mapear `RequestFileTooLargeError` → 413 y desenlazar tmp parciales |
| **Orden de validación** | cadena de ingesta | Guardas baratas primero, códecs al final. Nunca `toBuffer()` antes de las guardas; nunca dejar que un códec vea entrada que las guardas baratas rechazarían (Pitfalls 1–4) |
| **Aleatoriedad e identidad** | claves, ids, nombres de blob | `crypto.randomUUID()`/`randomBytes` con muestreo por rechazo para base62. Nunca `Math.random`. Nombres de fichero del cliente: solo metadatos, nunca rutas |
| **Secretos y config** | api, compose, e2e | Cero secretos en código (SEC-04): `.env` + `.env.example` comprometido; `--env-file`, sin `dotenv`. Fail loud ante config ausente/placeholder (P1-D-02) |

---

## 7. Sin análogos encontrados

Los 27 ficheros no tenían análogo: el repositorio no contenía código de aplicación. El planificador debía usar las fuentes de patrón de arriba como plantillas vinculantes.

| Grupo de ficheros | Rol | Flujo | Razón |
|---|---|---|---|
| Herramientas raíz (package.json, tsconfigs, compose, .env.example, scripts, playwright.config, e2e) | config / utilidad / test | build, despliegue, file-I/O, e2e | Greenfield — no existe fuente |
| `packages/contracts` | modelo / utilidad | transform | Greenfield |
| `packages/sdk` shell | config | build | Greenfield |
| `apps/api` | controlador / servicio / modelo / middleware / migración | petición-respuesta, file-I/O, CRUD, transform | Greenfield |
| `apps/panel` | componente / servicio / config | petición-respuesta | Greenfield |

---

## 8. Fuera de alcance (diferido a slices posteriores)

- Comportamiento del widget/SDK (script tag, captura, auto-redacción) — **Fase 2**. El shell `packages/sdk` existe solo para el cableado de build y los carriles `check:size`.
- Compositor de reporte, cadena de fallback de captura, editor de anotación — **Fase 3**.
- Buffer circular de consola + enriquecimiento de entorno/host (ENR-01/02) — **Fase 4**.
- Auth de admin, CRUD de proyectos, rotación de claves, servido autenticado de blobs (DEP-03) — **Fase 5**.
- Acciones de triage, comentarios, jobs de purga TTL (`purge_runs`) — **Fase 6**. Las **columnas** TTL existen desde la primera migración (M-1/A-02).
- Cola de durabilidad idempotente (ING-02), prueba Lighthouse, backup/restore — **Fase 7**.
- JPEG en la allowlist de imágenes, adaptador de captura DOM-serialize (v2, A-08).

### Plan de slices posteriores

Cada fase añade un slice vertical sobre este esqueleto sin alterar sus decisiones arquitectónicas:

- **Fase 2:** un usuario final abre el widget en una página hostil, captura la pestaña con datos sensibles destructivamente enmascarados, y registra el primer reporte real.
- **Fase 3:** el usuario final compone un reporte y anota la captura con enmascarado irreversible antes de enviar.
- **Fase 4:** el payload lleva logs de consola, entorno y contexto del host con secretos depurados.
- **Fase 5:** el desarrollador inicia sesión con seguridad y gestiona proyectos y claves; los blobs pasan a autenticados.
- **Fase 6:** el desarrollador hace triage y los TTL de retención purgan identidad y artefactos.
- **Fase 7:** los reportes sobreviven a descargas y redes inestables exactamente una vez, y la puerta de release pasa en un `docker compose up` limpio.

---

## 9. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-0x / A-xx** | Amendment del registro de decisiones (`documentation/resolution-record.md`) |
| **A-06 / A-10 / A-12** | Amendments: conjunto de constantes / proxy nginx `/api` / `check:size` multi-artefacto |
| **CA-0x** | Criterio de Aceptación del proyecto |
| **C-4** | Clase de peligro: path traversal / ficheros |
| **CRUD** | *Create, Read, Update, Delete* |
| **DDL** | *Data Definition Language* (SQL de esquema) |
| **DEP-03** | Requisito de despliegue (blob solo por API autenticada) |
| **ENR-0x** | Requisito de enriquecimiento (*enrichment*) |
| **e2e** | *End-to-end* (prueba de extremo a extremo) |
| **EXIF / XMP / ICCP** | Chunks de metadatos de imagen (cámara / Adobe / perfil de color) |
| **IHDR / VP8X** | Cabeceras de dimensión de PNG / contenedor extendido WebP |
| **ING-0x** | Requisito de ingesta (*ingest*) |
| **INV-0x** | Invariante arquitectónico no negociable |
| **M-1 / M-2** | Puntos del registro ligados a retención (M-1) y al gate de tamaño (M-2) |
| **MIME** | Tipo de contenido declarado |
| **MVP** | *Minimum Viable Product* |
| **P1-D-xx** | Decisión de implementación local de la Fase 1 |
| **RIFF** | Formato contenedor de WebP (*Resource Interchange File Format*) |
| **R-01…R-18** | Reglas del registro global (R-02 puertos, R-12 verificación, R-13 enmascarado, R-15 stack, R-18 DRY) |
| **RNF-01** | Requisito no funcional: presupuesto de tamaño por capas |
| **SEC-0x** | Requisito de seguridad |
| **TFG** | Trabajo Fin de Grado |
| **TTL** | *Time To Live* (vida útil antes de purga) |
| **UUID** | *Universally Unique Identifier* |
