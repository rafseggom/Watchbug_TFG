<p align="center">
  <img src="img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Informe de análisis — rama `gsd/phase-1-contracts-ingest`

| | |
|---|---|
| **Fecha** | 2026-10-13 |
| **HEAD** | `c0142a4` — *ci(01): add the e2e job so CI runs the complete R-12 suite* |
| **Árbol de trabajo** | limpio al empezar y al terminar |
| **Alcance** | 41 ficheros `.ts`/`.tsx` trackeados + `docker-compose.yml`, `.env.example`, `apps/panel/nginx.conf`, `.github/workflows/`, `scripts/`, `e2e/` |
| **Modo** | **Análisis / guidance** — *no se ha modificado ni un solo fichero de código*. Este `.md` es el único artefacto nuevo. |
| **Ejecución del objetivo** | ninguna (sin `npm test`, sin `playwright`, sin red, sin instalar dependencias en Watchbug) |

---

## 0. Resumen ejecutivo

| Lente | Herramienta | Resultado | Veredicto |
|---|---|---|---|
| **Slop** | `stopthatslop check --pack ts` (pack `stopthatslop-ts-node-v1`) | **5 findings gate**, 0 teach-only → `exit 1` | 🟡 3 hallazgos de fiabilidad, 1 de rendimiento; nada crítico |
| **Complejidad** | TS compiler API (script propio, no hay eslint/radon/lizard en el repo) | 255 funciones · media **2,38** · **3** con CC ≥ 16 y **1** con CC = 15 | 🟠 Muy sano en conjunto, con **4 focos concentrados en `apps/api`** |
| **Seguridad** | `security-audit` (modo guidance, source-first) | **6 confirmados**: 1 high · 1 medium · 2 low · 2 informational · **8 `needs_validation`** | 🔴 Un hallazgo high condicionado al despliegue |

**Prioridad de remediación posterior (§5):**

1. **P0 — Superficie de lectura sin autenticar** (`GET /api/incidents` devuelve todos los reportes con `user.email`). Confirmado en fuente; la única barrera actual es el bind a `127.0.0.1` del compose → **verificar alcance antes de exponer nada**.
2. **P0 — Las retentiones TTL no se aplican nunca**: las columnas se escriben y `.env.example` las promete, pero no existe ningún job de purga.
3. **P1 — Slop + gate en CI**: los 5 findings y la ausencia de `stopthatslop check` en los workflows.
4. **P2 — Complejidad**: partir el handler de ingesta (CC 30 / 216 LOC) y `stripPng`/`stripWebp`.

---

## 1. Metodología y límites

### 1.1 Qué se hizo

| # | Acción | Comando / modo |
|---|---|---|
| 1 | Slop | `python -m stopthatslop_cli check --repo-root <repo> --pack ts --format json` |
| 2 | Complejidad | script propio sobre `ts.createSourceFile` (sin typecheck), usando el `typescript` ya instalado en `checkers/tsast` |
| 3 | Seguridad | `security-audit` en **guidance mode**: dos revisiones source-first delegadas (una sobre `apps/api`, otra sobre `packages/* + apps/panel`), consolidación y **verificación manual de todas las citas** del apartado §4.1 y §4.2 por este agente |

### 1.2 Reglas de conteo de complejidad (§3)

`CC = 1 + puntos de decisión`, contando: `if` (incluidos `else if`), `for`/`for in`/`for of`, `while`, `do while`, `case` y `default`, `catch`, ternario `? :`, y los operadores `&&` / `||` (`??` no cuenta). Cada punto de decisión pertenece a la función que lo contiene de forma más interna: **una función anidada se mide aparte y no infla a la externa**. Umbrales del skill: 1-5 *ok* · 6-10 *vigilar* · 11-15 *refactorizar ya* · 15+ *dividir sin discusión*.

### 1.3 Qué NO cubre este informe

- **No es un full audit.** No hay ledger de cobertura, ni oleadas de caza, ni validadores `findings.json`, ni verificación independiente de registros. **No existe ninguna auditoría previa de esta rama**, así que no hay registros que arrastrar ni cobertura acumulada: **una sola pasada, no exhaustiva.**
- **No se ejecutó el código del objetivo** (regla del skill: sin sandbox no se ejecuta código ajeno). Ninguna aseveración de seguridad se apoya en una prueba en vivo.
- **No se ejecutaron los e2e** (`npm run verify`, R-12) ni `npm run gate`; su estado no está evaluado aquí.
- Hechos que viven **fuera** del repo (qué puertos expone el despliegue real, CORS de producción, si la contraseña de DB se cambió, TLS delante de nginx) se clasifican como `needs_validation` (§4.2) y **no tienen severidad**.

---

## 2. Slop de código — `stopthatslop`

**Pack:** `stopthatslop-ts-node-v1` (13 reglas: 9 *checker* gatean, 4 *teach-only* solo enseñan).
**Resultado:** `passed: false`, `gate_finding_count: 5`, `teach_only_finding_count: 0`, `exit 1`.

| # | Regla | Fichero | Mensaje del detector |
|---|---|---|---|
| 1 | `typescript.http.no-fetch-without-abort-timeout` | `apps/api/src/index.ts:105` | `fetch()` sin `AbortSignal` |
| 2 | `typescript.http.no-fetch-without-abort-timeout` | `apps/api/src/index.ts:118` | `fetch()` sin `AbortSignal` |
| 3 | `typescript.performance.no-eager-heavy-dependency-import` | `apps/api/src/ingest/harden.ts:1` | `import sharp from 'sharp'` estático → importarlo perezosamente |
| 4 | `typescript.http.no-fetch-without-abort-timeout` | `apps/panel/src/api.ts:31` | `fetch()` sin `AbortSignal` |
| 5 | `typescript.reliability.no-unguarded-json-parse-on-external-input` | `apps/panel/src/api.ts` | `res.json()` (JSON externo) fuera de `try` |

### 2.1 Lectura

- **Citas 1-2 (`index.ts:105/118`)** y **4 (`api.ts:31`)** verificadas: son el smoke test de arranque y el cliente HTTP del panel. Impacto real: una petición colgada no se cancela (timeout de sesión / memory pressure). **Bajo**, pero es exactamente el tipo de fallo silencioso que el detector busca.
- **Cita 3 (`harden.ts:1`)** — `sharp` importado estáticamente en el módulo de endurecido de imagen. No es solo "bundle pesado": `sharp` arrastra binarios nativos en el arranque de la API. Encaja además con la política de tamaño del proyecto (RNF-01) aplicada al servidor. **El más interesante de los cinco.**
- **Cita 5 (`panel/api.ts`)** — el parser del panel no envuelve la respuesta en `try`. Un 500 con HTML de nginx provocaría una excepción no controlada en la carga del panel. **Bajo.**
- **0 findings en las 4 reglas *teach-only*** (`no-floating-promises`, `no-unvalidated-env-at-module-top-level`, `no-non-null-array-index`, `no-setinterval-without-clear`): esas **no se gatean**, así que su ausencia no es una garantía.

### 2.2 Lo que este lente NO detecta

Solo mira el pack `ts`. No hay en la rama código Python/Go/Java/Kotlin con relevancia, así que no hay más packs que aplicar. **El detector no dice nada sobre seguridad ni sobre complejidad** — por eso los otros dos lentes son necesarios.

### 2.3 Observación de proceso

Ningún workflow de `.github/workflows/` ejecuta `stopthatslop check`. Hoy mismo el `gate` del repo (`scripts/gate.mjs`) no lo incluye. Es un gate disponible y no conectado.

---

## 3. Complejidad ciclomática

**Sin herramienta estándar instalada** (no hay `eslint`, `radon`, `lizard` ni `gocyclo`; el `lint` del repo es `typecheck --workspaces`), así que se aplicó la rama *"count manually, per function, show the count"* mediante un script de análisis estático.

### 3.1 Distribución global

| Funciones | Media CC | Máximo | 1-5 *ok* | 6-10 *vigilar* | 11-15 *ya* | 15+ *dividir* |
|---|---|---|---|---|---|---|
| **255** | **2,38** | **30** | 232 (91%) | 19 | 1 | **3** |

**Veredicto:** el código está muy por encima de la media en salud — 91% de las funciones por debajo de CC 6. El problema no es difuso: **está concentrado en 4 funciones de `apps/api`.**

### 3.2 Hotspots (los que requieren acción)

| CC | LOC | Función | Fichero:línea | Umbral |
|---|---|---|---|---|
| **30** | 216 | handler `POST /api/incidents` (anónimo) | `apps/api/src/routes/incidents.ts:141` | 🔴 15+ → dividir |
| **20** | 55 | `stripPng` | `apps/api/src/ingest/structure.ts:47` | 🔴 15+ → dividir |
| **16** | 49 | `stripWebp` | `apps/api/src/ingest/structure.ts:103` | 🔴 15+ → dividir |
| **15** | 22 | `app.setErrorHandler(...)` | `apps/api/src/app.ts:107` | 🟠 11-15 → refactorizar ya |
| 9 | 32 | `readWebpDimensions` | `apps/api/src/ingest/guard.ts:33` | 🟡 vigilar |
| 9 | 25 | `mapMultipartError` | `apps/api/src/ingest/caps.ts:391` | 🟡 vigilar |
| 8 | 85 | `App` | `apps/panel/src/App.tsx:21` | 🟡 vigilar |
| 8 | 76 | `runMultipartSmoke` | `apps/api/src/index.ts:58` | 🟡 vigilar |
| 8 | 48 | handler `GET /api/incidents/:id/image` | `apps/api/src/routes/incidents.ts:371` | 🟡 vigilar |
| 8 | 26 | `ingestRateLimit` | `apps/api/src/plugins/rate-limit.ts:112` | 🟡 vigilar |

### 3.3 Por fichero (media CC · focos ≥ 6)

| Media | Máx | Funcs | Fichero | Focos |
|---|---|---|---|---|
| **13,3** | 20 | 3 | `apps/api/src/ingest/structure.ts` | `stripPng=20`, `stripWebp=16` |
| **7,0** | 7 | 1 | `apps/api/src/ingest/sniff.ts` | `sniffImage=7` |
| **5,5** | 9 | 4 | `apps/api/src/ingest/guard.ts` | `readWebpDimensions=9`, `assertDecodeSafe=7` |
| **5,1** | 30 | 11 | `apps/api/src/routes/incidents.ts` | handler POST=30, handler GET imagen=8 |
| **4,8** | 15 | 4 | `apps/api/src/app.ts` | `setErrorHandler=15` |
| 4,0 | 8 | 5 | `apps/api/src/index.ts` | `runMultipartSmoke=8` |
| 2,8 | 9 | 31 | `apps/api/src/ingest/caps.ts` | `mapMultipartError=9`, `errorLabel=8`, `errorStatus=7` |
| 1,7 | 7 | 72 | `e2e/hostile.spec.ts` | — (tests, se exclúyen del plan) |

### 3.4 Plan de refactor posterior *(descripción, no aplicado)*

Orden por riesgo, no por tamaño:

1. **`incidents.ts:141` (CC 30 / 216 LOC)** — es *una sola función* que valida el contrato, aplica límites, resuelve idempotencia, sanea, endurece la imagen, decide almacenamiento y persiste. Aplicar **guard clauses** al inicio (errores tempranos `return badRequest(...)`) y **extraer** los bloques que ya están conceptualmente separados: `validateIdempotency`, `normalizeMeta`, `storeArtifact`, `persistIncident`. Objetivo: cada pieza por debajo de CC 10. *Precondición: tiene cobertura e2e (`e2e/ingest.spec.ts`, `e2e/hostile.spec.ts`) — ejecutar `npm run verify` antes y después.*
2. **`structure.ts:47/103` (`stripPng` 20, `stripWebp` 16)** — *table lookup* de chunks/tipos en vez de cadenas de `if`, y un **extract function** por cada tipo de chunk. Es código binario sensible (SEC-02 / defensa contra imágenes hostiles): el refactor debe preservar byte a byte el comportamiento — validate con los fixtures de `e2e/fixtures/`.
3. **`app.ts:107` (CC 15, 22 LOC)** — ya está corto; separar el mapeo de errores conocidos de la respuesta genérica (**named predicates**).
4. **Los 19 de CC 6-10** — *watch*: refactorizar solo si se tocan por otra razón.

---

## 4. Seguridad — `security-audit` (guidance mode)

**Método:** fuente primero. Principio rector: *un candidato sin principal afectado, recurso y resultado concretos no es un hallazgo*. Solo los registros **confirmados** reciben severidad; los `needs_validation` no la tienen.

### 4.1 Hallazgos confirmados

#### 🔴 [HIGH] Ningún endpoint de lectura tiene autenticación — todo el almacén de reportes y todas las capturas se sirven a clientes anónimos

- **Evidencia** (verificada):

  `apps/api/src/routes/incidents.ts:358` — **sin `preHandler`**:
  ```ts
  app.get('/api/incidents', async (_req, reply) => {
    // H-7 / DEP-03: the project key is WRITE-ONLY — it authenticates ingest
    // and is never consulted by a read endpoint (Phase 5's AuthProvider gates
    // reads; until then the read surface is deliberately ungated ...
    const rows = await db.select().from(incidents).orderBy(desc(incidents.createdAt));
    return reply.send(rows.map(toListRow));
  ```
  Contraste — la ruta de escritura **sí** los tiene (`incidents.ts:138-141`):
  ```ts
  app.post('/api/incidents',
    { onRequest: [bodyCaps], preHandler: [deps.ingestRateLimit, deps.originGate, projectKeyGate] },
  ```
  `incidents.ts:429-432` — devuelve identidad del host verbatim: `{ id: row.userId, name: row.userName, email: row.userEmail }`.
  `apps/panel/nginx.conf:18-19` — el panel proxya `/api/` a todo cliente que llegue al panel.
  `e2e/ingest.spec.ts:102` — **el propio test lo demuestra end-to-end sin credenciales**:
  ```ts
  const list = await (await request.get('/api/incidents')).json() as Array<Record<string, unknown>>;
  ```
  `apps/api/package.json` — no hay ninguna dependencia de autenticación (solo `@fastify/*`, `drizzle-orm`, `pg`, `sanitize-html`, `sharp`).

- **Frontera:** cliente de red sin autenticar → `GET /api/incidents`, `GET /api/incidents/:id/image` → control pretendido **SEC-05** (*"unauthorised access to admin APIs blocked"*) y **R-04** (*attachments served only through the authenticated API*) → frontera de lectura de administración → afectado: **todos los reportes de todos los proyectos, incluido `user.email` y las capturas** → resultado: los manejores se ejecutan con cero verificación de credenciales y devuelven el almacén completo.
- **Contra-argumento y por qué no basta:** el código y el compose documentan esto como costura deliberada de fase (DEP-03 → Phase 5) y el bind a loopback (`docker-compose.yml:44`, `:70`) como mitigación. Pero `127.0.0.1` es una **propiedad de ubicación, no un control de acceso**: (a) cualquier proceso o usuario local, y cualquier página del propio navegador vía rebinding DNS (no hay chequeo `Host`/origen en las lecturas), obtiene el almacén; (b) el producto *necesita* abrir esos puertos para que los usuarios finales envíen reportes, y `.env.example` instruye abrir CORS a orígenes de host — que además reciben `Access-Control-Allow-Origin` en **todas** las rutas, incluidas las de lectura (`plugins/cors.ts`).
- **Fix mínimo (descripción):** un único `preHandler` de autorización sobre las rutas de lectura (como mínimo exigir la clave de proyecto y **acotar las filas a ese proyecto**; sesión `AuthProvider` en Phase 5) y registrar CORS en un scope que no conceda orígenes de ingesta sobre las lecturas.
  **Invariante:** *ninguna ruta que devuelva o transmita datos de incidentes almacenados puede ejecutarse sin una comprobación de autenticación/autorización exitosa, y toda lectura está acotada al proyecto del principio autenticado.*
- **Precondición abierta:** ver `needs_validation` §4.2-1 — si la instancia es alcanzable fuera de loopback, la severidad es `high` sin matices; si es estrictamente local, es `medium` con potencial de escalar.

#### 🟡 [MEDIUM] Las retenciones TTL son decorativas — las columnas de purga se escriben pero nunca las lee nadie

- **Evidencia** (verificada): la **única** aparición de las columnas en todo el código es su escritura — `incidents.ts:314-315`:
  ```ts
  identityPurgeAt: new Date(now + config.ttlIdentityDays * DAY_MS),
  artifactPurgeAt: new Date(now + config.ttlArtifactDays * DAY_MS),
  ```
  `apps/api/src/db/schema.ts:40-41` las define. `incidents.ts:297` hace referencia a *"the TTL purge jobs (they purge by row)"* — **esos jobs no existen**: el único `setInterval` del repo es un watchdog en `caps.ts:225`.
  `docker-compose.yml` y los workflows no definen ningún cron/job de purga.
  `.env.example:51-54` promete el control como si funcionara:
  ```
  # Identity fields (user.id/name/email) purge after this many days; the whole
  WATCHBUG_TTL_IDENTITY_DAYS=30
  WATCHBUG_TTL_ARTIFACT_DAYS=90
  ```
- **Frontera:** usuario final cuya PII (`user.email`, nombre, id, píxeles de la captura) se aceptó en `POST /api/incidents` → control declarado **R-09/R-10 / RET-01-02** (límite de retención documentado y configurable) → frontera: la fecha de borrado prometida → afectado: los datos personales de los sujetos y la postura RGPD del proyecto → resultado: **las filas creadas hoy conservarán el email en vivo de forma indefinida**.
- **Contra-argumento y por qué no basta:** "RET-01/02 están previstas para Phase 6, es roadmap, no bug". Pero el fallo está **activo ahora** para cada fila: esquema, migración, claves de configuración y documentación ya prometen el cumplimiento, y el propio material del proyecto lo enuncia como regla (*"we'll run a cron que nadie verifica" es un hallazgo en el momento de la auditoría*).
- **Fix mínimo (descripción):** un módulo de barrido programado/al arranque que (a) anule `user_*` donde `identity_purge_at <= now()` y (b) borre la fila + `Storage.delete(storageKey)` donde `artifact_purge_at <= now()`, dejando constancia.
  **Invariante:** *toda columna llamada `*_purge_at` tiene exactamente una ruta de cumplimiento; el ingesta debe rechazar identidad si se detecta que no hay job de purga (fail-fast) en lugar de aceptar datos que el despliegue prometió borrar.*

#### 🟢 [LOW] Rate limiting con `global: false` deja la superficie de lectura (anónima) sin medir

- **Evidencia** (verificada): `apps/api/src/app.ts:60` — `await app.register(rateLimit, { global: false });`. Los tres limitadores solo se enganchan al POST (`incidents.ts:140`); los GET no llevan `preHandler`. `apps/api/src/db/client.ts` — pool `max: 10`, y la lista es `select()` **sin paginar**.
- **Frontera:** cliente sin autenticar → peticiones repetidas a las lecturas → control pretendido **SEC-05** (*"rate-limit `/api/incidents` per IP and per project key"*, sin calificar por método) → frontera de abuso → afectado: disponibilidad del ingesta y del panel para todos (saturación del pool, volcados de tabla completos) → resultado: las lecturas responden sin límite mientras la escritura se limita en tres dimensiones.
- **Por qué es `low`:** requiere esfuerzo sostenido — que es exactamente por eso que no es `medium`. La cifra sin paginar multiplica el coste por petición.
- **Fix mínimo (descripción):** enganchar el factory existente `createIngestRateLimit` (`plugins/rate-limit.ts:78`) como `preHandler` de los GET y paginar la consulta con `limit` acotado.
  **Invariante:** *toda ruta accesible sin autenticación lleva al menos el limitador por IP, y ningún endpoint de lista devuelve un conjunto sin acotar.*

#### 🟢 [LOW] Lista de reportes sin límite — un principal con cuota de ingesta puede dejar inutilizable el panel del operador

- **Evidencia:** `apps/panel/src/api.ts:37-39`:
  ```ts
  export function fetchIncidents(): Promise<Incident[]> {
    return getJson<Incident[]>('/api/incidents');
  }
  ```
  `apps/panel/src/components/ReportList.tsx:35` — `{incidents.map((incident) => (`; `apps/api/src/routes/incidents.ts:363` — sin `LIMIT` ni cursor.
- **Frontera:** poseedor de la clave de ingesta pública (pública **por diseño**, viaja en cada página host) → hasta `RATE_LIMIT_PER_PROJECT_PER_DAY = 2000` reportes válidos/día durante `TTL_ARTIFACT_DAYS = 90` → control: los límites acotan solo la *escritura* → frontera: disponibilidad compartida del panel → afectado: la pestaña del operador y el tamaño de la respuesta → resultado: `App.tsx` guarda el array completo en estado y `ReportList` mapea cada fila al DOM.
- **Fix mínimo:** lectura acotada en cliente (`limit` + "cargar más") y `LIMIT` + keyset cursor en servidor.

#### ⚪ [INFORMATIONAL] El contrato oficial no implementa la regla R-08 aprobada de `url` path-only

- **Evidencia** (verificada): `packages/contracts/src/schema.ts:31`:
  ```ts
  /** Path of the page the report was filed on (≤ MAX_URL_PATH_CHARS). */
  url: z.string().max(MAX_URL_PATH_CHARS).nullable().optional(),
  ```
  Sin `.refine()` ni transformación; `apps/api/src/ingest/sanitize.ts` solo elimina marcadores/controles. La decisión **R-08** del registro de resolución pide *"path only — query + fragment stripped on ingest"*.
- **Frontera:** cualquier poseedor de la clave pública (y, en Phase 2, el enricher del SDK) → `meta.url = 'https://x.dev/cb?code=SECRET#frag'` → control pretendido R-08, cuyo punto de enforcement es este fichero → afectado: el almacén y todo visor del panel (`ReportDetail.tsx` lo muestra literalmente) → resultado: un URL con query/fragmento valida y se persiste.
- **Por qué ahora es informativo:** hoy ningún emisor envía un `url` con query (el SDK ni siquiera existe aún). **Se vuelve relevante en cuanto se conecte `location.href`** — y ya está registrado como `IN-04` en el disposition de la fase.
- **Fix mínimo:** exigir ruta (empezar por `/`, rechazar `?`, `#`, esquema/host) o hacer `.transform()` que recorte query+fragmento **dentro del schema**, para que SDK e ingesta hereden la regla del único contrato.

#### ⚪ [INFORMATIONAL] El documento del panel se sirve sin Content-Security-Policy

- **Evidencia** (verificada): `apps/panel/nginx.conf:42-45` es toda la política de respuesta del SPA:
  ```
  # The panel never renders report HTML (SEC-05 pass 2, zero
  # dangerouslySetInnerHTML) — tighten the document policy anyway.
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy same-origin always;
  ```
  `apps/panel/index.html` no lleva `<meta http-equiv="Content-Security-Policy">`.
- **Por qué solo informativo:** **no existe hoy ningún sumidero HTML** — verificado: 0 ocurrencias de `dangerouslySetInnerHTML|innerHTML|href=` en `apps/panel/src`, y React escapa por defecto (SEC-05 pasada 2 se sostiene). El propio comentario del config promete una política que no emite, y el gate e2e que lo vigila es una búsqueda de dos subcadenas.
- **Fix mínimo:** una línea en `location /`: `add_header Content-Security-Policy "default-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" always;`

### 4.2 `needs_validation` (8) — hechos fuera del repositorio

Sin severidad. Cada uno con su comprobación segura para el propietario:

| # | Hecho pendiente | Comprobación segura |
|---|---|---|
| 1 | **¿Es la instancia alcanzable más allá de `127.0.0.1`?** El compose publica en loopback (`docker-compose.yml:36`, `:44`, `:70`) | `docker compose port api 3000` / `docker compose port panel 8080`; desde otra máquina `curl -s -o /dev/null -w '%{http_code}' http://<host>:8080/api/incidents` — basta el código HTTP, **sin pegar la respuesta** |
| 2 | **¿Está `WATCHBUG_TRUST_PROXY` definido en el `.env` real?** (`config.ts` lo pone en `false` si falta) | `docker exec $(docker compose ps -q api) printenv WATCHBUG_TRUST_PROXY` — debe ser una lista explícita, **nunca `true`**. Si falta, tras el nginx de panel todos los clientes caen en un único bucket de rate limit |
| 3 | **¿Se cambió la contraseña de desarrollo de la DB?** (`.env.example` envía `WATCHBUG_DB_PASSWORD=watchbug`) | Comparar `grep WATCHBUG_DB_PASSWORD .env` con la plantilla + `docker compose port db 5432` |
| 4 | **¿Cuáles son los `WATCHBUG_CORS_ORIGINS` reales?** Deciden qué orígenes ajenos pueden leer la lista completa desde JS | `docker exec $(docker compose ps -q api) printenv WATCHBUG_CORS_ORIGINS` — cada entrada debe ser un origen propio |
| 5 | **Rebinding DNS del panel** — `nginx.conf:9` es `server_name _;` (acepta cualquier `Host`) y las lecturas no chequean origen | `curl -H "Host: evil.example" http://127.0.0.1:8080/api/incidents` (un 200 confirma el prerequisito) y probar en el navegador real mirando DevTools |
| 6 | **TLS en tránsito** — `nginx.conf:8` es `listen 80;` sin bloque TLS | `curl -sI http://<host>:8080/` vs `https://<host>:8080/` y confirmar cuál sirve el SPA |
| 7 | **¿Añade alguna capa de despliegue un CSP delante de nginx?** | `curl -sI http://<host>:8080/ \| grep -i content-security-policy` |
| 8 | **Alcance real del host de ejecución** — es lo que separa el hallazgo HIGH de `medium` (ver §4.1-1) | la misma comprobación que #1 |

### 4.3 Candidatos examinados y **rechazados** (11)

Conviene tenerlos escritos para que nadie los reabra más tarde:

| Candidato | Por qué NO es un hallazgo |
|---|---|
| `GET /api/setup` devuelve la clave del proyecto | Es la clave **pública, write-only** por diseño (viaja en cada `init()`); solo gatea escrituras ya limitadas en tres dimensiones |
| XSS almacenado vía campos `meta` / `url` con `javascript:` | `ingest/sanitize.ts` elimina marcadores y no re-decodifica entidades que reformen `<`; **y no hay sumidero**: el panel no tiene `href`, `dangerouslySetInnerHTML` ni `window.open` |
| Path traversal en adjuntos | El cliente nunca nombra fichero: clave `randomUUID()` validada contra `STORAGE_KEY_REGEX` (sin `.` ⇒ `..` imposible) + `path.resolve` con prefijo de volumen; los nombres con separadores se rechazan en `caps.ts` |
| XSS vía SVG/HTML/GIF almacenado | Rechazo en cuatro etapas: sniff de magic bytes (solo PNG/WebP) → walk del contenedor verificando CRC → re-encode con `sharp` → serve con `nosniff` + `Content-Disposition: attachment` + `CSP: default-src 'none'; sandbox` |
| Spoof de `X-Forwarded-For` para evadir el limitador | El edge **sobrescribe** el header (`nginx.conf:27`, `$remote_addr` explícitamente no `$proxy_add_x_forwarded_for`) y la API usa lista de confianza en vez de `true` |
| Secretos en código / RNG débil (SEC-04) | Solo `.env.example` trackeado (`.env` ignorado, verificado), `gen-key.mjs` usa `crypto.randomBytes` con rejection sampling, CI ejecuta gitleaks |
| XSS almacenado en el panel (título/nota) | Todo se renderiza como hijo de React (`ReportDetail.tsx`, `ReportList.tsx`); 0 sumideros HTML en todo `apps/panel/src` |
| `incident.url` sin allowlist de esquema → XSS | Solo alcanza `<dd>{value}</dd>`; no hay `<a>`, `href`, `window.open` ni `location.assign` |
| Inyección shell en el snippet de onboarding (`EmptyState.tsx`) | La clave cumple `^wkbt_[0-9A-Za-z]{32}$` validado al arrancar ⇒ sin meta-caracteres; el `origin` es `location.origin`; se imprime como nodo de texto |
| **SEC-03: el SDK lee cookies/storage del host** | `packages/sdk/src/index.ts` **no tiene ni un import** — los tres ficheros del SDK son cascas de tamaño. *Vacuo, no violado* |
| **SEC-02: la máscara no es destructiva antes de codificar** | No existe ruta de codificación (`getImageData|toBlob|blur|pixelat` sin sumideros reales; `encodeFinal()` llega con el Annotator). *Vacuo, no violado* |

### 4.4 Invariantes verificados **sin** hallazgo

- **INV-02** — el IIFE emitido expone `var Watchbug = ...` vía `globalName`; sin *patching* de prototipos nativos.
- **INV-01** — `SHADOW_MODE` se define como `'closed'` en build (`scripts/build.mjs`); aún sin consumidor (Phase 2).
- **RNF-01 (amenaza estructural)** — el panel solo declara `react` + `react-dom`; el SDK no tiene importaciones; `gate.mjs` restringe las deps runtime del SDK. Riesgo latente: un futuro `import` **no-`type`** de `@watchbug/contracts/schema` arrastraría Zod al bundle — hoy no existe.
- **SEC-04** — ver 4.3. CI ejecuta gitleaks con `permissions: contents: read`.
- **R-09/R-10 (mitad del panel)** — `user.{id,name,email}` se renderizan solo como texto; nunca se enlazan ni precargan.

---

## 5. Plan de remediación posterior *(ordenado para más tarde; NO aplicado)*

> **No se ha corregido nada.** Esta sección es el backlog de trabajo futuro, con el fix mínimo ya definido por hallazgo.

| Prioridad | ID | Hallazgo | Fix mínimo | Ficheros | Esfuerzo |
|---|---|---|---|---|---|
| **P0** | S-1 | Lecturas sin autenticación (HIGH, §4.1-1) | `preHandler` de autorización + acotar filas al proyecto autenticado; scope de CORS separado para lecturas | `routes/incidents.ts`, `plugins/cors.ts` | Medio — **requiere Phase 5 (AuthProvider)**; mientras tanto, al menos acotar por proyecto |
| **P0** | S-2 | TTL sin enforcement (MEDIUM, §4.1-2) | Job de barrido programado (null identidad / borrar fila + blob) con constancia | módulo nuevo en `apps/api/src`, `docker-compose`/workflow | Medio |
| **P0** | V-0 | **Verificar §4.2-1 y §4.2-8 antes de exponer el stack** | Comprobaciones de la tabla (solo lectura, sin pegar respuestas) | despliegue | Minuto |
| **P1** | S-3 | Rate limit ausente en lecturas (LOW) | `createIngestRateLimit` como `preHandler` de los GET + `LIMIT` paginado | `routes/incidents.ts` | Bajo |
| **P1** | L-1 | Los 5 findings de `stopthatslop` | `sharp` a import dinámico; `AbortSignal.timeout(...)` en los 3 `fetch`; `try/catch` en `panel/api.ts` | `harden.ts`, `index.ts`, `panel/api.ts` | Bajo |
| **P1** | L-2 | Gate no conectado a CI | Añadir `stopthatslop check --pack ts` a `scripts/gate.mjs` o a `.github/workflows/ci.yml` | `scripts/`, `.github/` | Bajo |
| **P2** | C-1 | `incidents.ts:141` CC 30 / 216 LOC | Guard clauses + extraer `validateIdempotency` / `normalizeMeta` / `storeArtifact` / `persistIncident` | `routes/incidents.ts` | Medio — **ejecutar `npm run verify` antes/después** |
| **P2** | C-2 | `stripPng` 20 / `stripWebp` 16 | Table lookup de chunks + extract por tipo; conservar comportamiento byte a byte | `ingest/structure.ts` | Medio — fixtures `e2e/fixtures/` |
| **P2** | C-3 | `app.ts:107` CC 15 | Separar mapeo de errores conocidos de la respuesta genérica | `app.ts` | Bajo |
| **P3** | S-4 | CSP ausente en el panel (INFO) | Una línea `add_header Content-Security-Policy ...` | `apps/panel/nginx.conf` | Minuto |
| **P3** | S-5 | `url` sin R-08 (INFO) | Exigir ruta / `.transform()` dentro del schema | `packages/contracts/src/schema.ts` | Bajo — **hacerlo antes de que Phase 2 conecte `location.href`** |
| **P3** | S-6 | Lista sin límite en cliente (LOW) | `limit` + "cargar más" en cliente; keyset cursor en servidor | `panel/src/api.ts`, `routes/incidents.ts` | Bajo |

**Secuencia recomendada:** `V-0` (minutos) → `S-1`/`S-2` (seguridad) → `L-1`/`L-2` (deja el gate en rojo visible para todos) → `C-*` (refactor con e2e en verde) → `S-4`/`S-5`.

---

## 6. Limitaciones del informe

1. **Una sola pasada, sin ledger de cobertura.** No existe auditoría previa de esta rama; no hay registros que arrastrar. **Esta pasada no agota el objetivo** — superficies no exploradas en profundidad: `scripts/*.mjs` más allá de `gen-key`/`gate`, internals de `drizzle/`, lógica de `boot/seed.ts`, y todo lo que Phase 2-6 añada.
2. **Modo guidance, no full audit.** Sin fases 1-6, sin `findings.json` ni validadores, sin verificación independiente de registros. Los hallazgos fueron citados y **verificados manualmente contra el árbol en `c0142a4`** por el agente coordinador, pero no pasaron por un verificador independiente fresco.
3. **Source-first absoluto.** Nada se ejecutó: ningún hallazgo se apoya en reproducción en vivo, y todo lo que depende del despliegue real está en §4.2.
4. **Los lentes no se solapan pero no son exhaustivos entre sí.** `stopthatslop` cubre 9 reglas TS gateables; la complejidad cubre las 255 funciones de los 41 ficheros `.ts`/`.tsx`; la seguridad cubrió `apps/api` y `packages/* + apps/panel`.
5. **El gate de `stopthatslop` depende de `checkers/tsast` operativo** (`npm install` hecho en el clon, gitignored). Si se replica en CI, instalarlo ahí también — sin él, los detectores TS devuelven 0 findings **en silencio** (falso verde, comprobado).

---

## 7. Anexo — comandos reproducibles

```bash
# 1. Slop
python -m stopthatslop_cli check --repo-root "E:\Proyectos Github\Watchbug_TFG" --pack ts
python -m stopthatslop_cli check --repo-root ... --pack ts --format json

# 2. Complejidad (script propio, análisis estático, no modifica nada)
node <temp>/cc.mjs $(git ls-files '*.ts' '*.tsx')

# 3. Seguridad — guía aplicada: source-first, sin ejecución del objetivo,
#    sin red, sin instalar dependencias; ver §1.3 para el alcance.
```

*Generado el 2026-10-13 sobre `c0142a4`. Único fichero creado por este análisis: `documentation/INFORME-ANALISIS.md`.*
