<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 1 — Investigación: *Contracts & Ingest Slice*

| | |
|---|---|
| **Fase** | 1 — *Contracts & Ingest Slice* |
| **Investigación** | 2026-10-11 |
| **Alcance** | 10 requisitos (DEP-01/02, ENR-06, ING-01, ING-03…ING-08) |
| **Estado** | Todas las preguntas abiertas resueltas; supuestos A1–A9 registrados |

> Resumen ejecutivo del `01-RESEARCH.md` de planificación. Condensa el hallazgo técnico central, los 9 patrones, los 9 peligros, el conjunto de constantes, la auditoría de legitimidad de paquetes, los supuestos y la arquitectura de validación.

---

## 1. Resumen

La Fase 1 es el *bootstrap* greenfield más el trazador de ingesta sintética: esqueleto de monorepo, el contrato oficial único (`packages/contracts` → `schema/report.schema.json`), el conjunto vinculante de constantes, un `docker-compose.yml` de tres servicios, un `POST /api/incidents` endurecido que almacena un reporte sintético en PostgreSQL + volumen de ficheros, una ruta de blob endurecida y un panel mínimo de dos columnas.

Los elementos más arriesgados se conocen y aterrizan primero: el smoke-test `@fastify/multipart` ↔ Fastify 5 (P1-D-09), la puerta de herramientas TS 7.x (Q-08) y la consulta de dependencia del re-encode P1-D-10.

### El hallazgo técnico más importante

> **`@fastify/multipart` analiza los cuerpos multipart con un parser de streaming dedicado que NO pasa por el `bodyLimit` de Fastify.** El `bodyLimit` solo siembra el `fileSize` por fichero (1 MiB por defecto); **no** se aplica como límite agregado sobre todo el payload multipart.

Consecuencia: el tope de 5 MB de cuerpo (H-7) **no puede** fijarse con una sola opción de Fastify. El plan **debe** combinar: (a) rechazo por pre-lectura de `Content-Length`, (b) un contador de bytes en streaming que aborta a mitad de subida, y (c) `limits` explícitos (`files: 1`, `fileSize`, `fields`, `fieldSize`, `headerPairs`, `parts`) cuyo producto acota el agregado. Esto convierte la «pre-lectura + contador» del ROADMAP en el **único** control agregado.

El mapeo `@fastify/multipart` ↔ Fastify 5 (el punto marcado UNVERIFIED en el stack) tiene tres evidencias independientes: los `devDependencies` del propio plugin fijan `fastify: ^5.0.0`, construye sobre `fastify-plugin@^6` y `@fastify/busboy@^3`, y la tabla de compatibilidad de `@fastify/rate-limit` (`>=10.x` ↔ `^5.x`) confirma la convención. El smoke-test (P1-D-09) sigue corriendo primero, pero ahora se espera que pase.

### Recomendación principal

Secuenciar la fase **risk-first**: (1) smoke-test multipart + puerta de herramientas TS 7.x en un commit mínimo de andamiaje; (2) la consulta de re-encode (P1-D-10) como checkpoint humano antes de escribir el endpoint; (3) contratos → compose/env → borde de ingesta → Storage → panel → e2e. Implementar la ingesta como la **cadena ordenada**:

```
Content-Length gate → rate limits → CORS → multipart limits → Zod validate (contracts)
→ key check → magic-byte + structural check → decode-bomb guard → re-encode
→ Storage.put (tmp→fsync→rename) → idempotent INSERT → replay-safe response
```

---

## 2. Mapa de responsabilidades arquitectónicas

| Capacidad | Nivel primario | Nivel secundario | Razón |
|---|---|---|---|
| Contrato + conjunto de constantes (`packages/contracts`) | Build/Contratos (paquete hoja) | — | Fuente única (R-15/R-18); el API importa Zod en runtime, el panel tipos, el SDK solo tipos/constantes |
| Endpoint de ingesta | API / Backend | — | La frontera de confianza vive en el servidor; los clamps de cliente son UX |
| Topes de abuso + rate limiting + allowlist CORS | API / Borde | nginx `client_max_body_size` (pre-filtro grueso) | Guarda más barata cerca del cable; control preciso en la app |
| Endurecimiento de imagen | API / Backend | — | Nunca confiar en el MIME declarado; el servidor es el control |
| Saneado de texto (pasada 1) | API / Backend | Navegador (pasada 2) | Doble control C-3 |
| Almacenamiento de blobs | BD / Almacenamiento (volumen FS en `api`) | — | R-04; volumen solo en `api`; rutas derivadas por servidor |
| Servido de blobs (cabeceras) | API / Backend | — | R-04: nunca ficheros estáticos; resolución solo por BD |
| Idempotencia / dedup | BD / Almacenamiento (restricción UNIQUE) | API (respuesta replay) | La BD es la única autoridad que sobrevive reinicios |
| Lista + detalle del panel | Navegador (SPA React) | API (endpoints de lectura) | Escapado en render; SPA estática tras nginx (INV-03) |
| Configuración del servidor | API / Backend (arranque) | Compose | SEC-04; P1-D-02 fail-fast |
| Columnas TTL | BD / Almacenamiento | API (calculadas al insertar) | M-1/A-02: los retrofits son migraciones = triggers de consulta |
| Gate de tamaño + aserción de compose | Build/CI | — | A-12/M-2 + C-4; gates en scripts, no en tests (R-12) |

---

## 3. Stack verificado (pines de esta fase)

> Fuente: `.planning/research/STACK.md` (todo `VERIFIED` contra npm/Docker Hub el 2026-10-05) + re-verificación de sesión de `@fastify/multipart`, `@fastify/rate-limit`, esbuild/Playwright/sharp.

| Paquete | Versión | Propósito | Por qué |
|---|---|---|---|
| `fastify` | 5.12.5 | Borde del API (R-15) | El ecosistema de plugins *es* el seam HTTP; pino incorporado |
| `@fastify/multipart` | 10.1.2 | Recepción `multipart/form-data` | La forma de cable CA-01 es FormData; ver el hueco de `bodyLimit` |
| `@fastify/rate-limit` | 11.2.0 | Límites por capas SEC-05 | Compat `>=10.x`↔`^5.x`; `retry-after` por defecto; limitadores manuales |
| `@fastify/cors` | 11.3.0 | Allowlist de origen ING-08 (A-11) | Allowlist dirigida por env, sin cambio de esquema |
| `@fastify/helmet` | 13.1.1 | Endurecimiento de respuestas | Defensa en profundidad barata |
| `drizzle-orm` / `drizzle-kit` | 0.45.3 / 0.31.11 | SQL tipado sobre `pg` + migraciones revisables | Solo Drizzle emite migraciones SQL |
| `pg` | 8.23.1 | Driver PostgreSQL | Slot R-15 |
| `zod` | 4.6.5 | Contrato CA-01 + `z.toJSONSchema()` | Conversión nativa a JSON Schema; `zod-to-json-schema` deprecado |
| `sanitize-html` | 2.18.0 | Saneado de ingesta (pasada 1) | Saneador maduro con allowlist |
| `react` / `react-dom` / `vite` / `@vitejs/plugin-react` | 19.3.0 / 19.3.0 / 8.3.2 / 6.1.2 | Panel mínimo | El escapado de nodos de texto de React es medio SEC-05 gratis |
| `typescript` | 7.0.2 (fallback 6.x — Q-08) | Solo tipos; esbuild transpila | TS 7 = port nativo a Go |
| `esbuild` | 0.28.2 | Doble build del SDK + bundling del API | Un formato por llamada a `build()` |
| `@playwright/test` | 1.63.0 | La suite única `npm run verify` (R-12) | Proyectos chromium + firefox + webkit |
| `sharp` (candidato) | 0.35.x | Re-encode del servidor (P1-D-10) | **Solo tras la consulta del propietario**; marcado SUS por el seam de legitimidad («demasiado nuevo») |
| PostgreSQL (imagen) | `postgres:18.6-alpine3.24` | Servicio `db` | Major estable actual |
| Node (imagen) | `node:24.21.0-alpine3.24` | `api` + build del panel | LTS activo hasta 2026-10-20 (re-pin a 26 después) |

### Alternativas consideradas y descartadas

| En vez de | Podría usarse | Compromiso |
|---|---|---|
| `@fastify/multipart` | JSON con base64 | **Rechazado** (+33 % de cable; base64 es paso 3 con consulta expresa — cambio de CA-01) |
| `@fastify/multipart` | Parser de boundary propio | Solo fallback paso 2 de P1-D-08 |
| `drizzle-orm` | `kysely` 0.29.6 | Kysely no tiene generador de migraciones |
| Store in-memory | Redis | **Rechazado** — sería un 4.º contenedor, viola INV-03 |
| `sharp` re-encode | Strip/rebuild sin dependencias | No mata políglotas decoder-differential |
| `zod-to-json-schema` | — | **Deprecado** por su mantenedor (nov 2025) |
| `dotenv` | Node `--env-file` | Estable en Node 24 |
| Framework de tests unitarios | — | **Abolido por R-12** |

---

## 4. Conjunto de constantes vinculante (A-06)

Un único módulo `packages/contracts/src/constants.ts` (TS plano, **cero import de Zod**) guarda cada límite. El esquema Zod importa de ahí para validar, el API para forzar en el borde, el SDK como valores planos (inlineados en build — cero bytes de Zod).

| Constante | Valor | Punto de aplicación | Código | Fuente |
|---|---|---|---|---|
| `MAX_BODY_BYTES` | 5 MB | Pre-lectura `Content-Length` + contador streaming + nginx | 413 | SUMMARY |
| `MAX_IMAGE_PART_BYTES` | 4 MB | `limits.fileSize` del parser multipart | 413 | SUMMARY |
| `MAX_ENCODED_IMAGE_BYTES` | 2 MB (duro) | Comprobación semántica tras leer la parte | 413 | resolution-record A-06 |
| `MAX_IMAGE_PIXELS` | 16.777.216 (16 MP) | Parseo de cabeceras **antes** de decodificar | 400/413 | PITFALLS + P1-D-10 |
| `MAX_IMAGE_DIM` | 8192 px por lado | Parseo de cabeceras antes de decodificar | 400 | PITFALLS |
| `MAX_META_BYTES` | 64 KB serializado | Comprobación semántica de la parte `meta` | 400/413 | SUMMARY |
| `limits` multipart | `files:1`, `fields:8`, `fieldSize:4096`, `headerPairs:1024`, `parts:16` | Parser | 400/413 | PITFALLS |
| `MAX_CONSOLE_TOTAL_BYTES` | 48 KB | Esquema (lo puebla la Fase 4) | 400 | resolution-record A-06 |
| Topes de entrada de consola | 100 drop-oldest, 2048/msg, 1024/arg, profundidad 3, stack 8192 | Constantes de esquema ahora, clamp SDK después | 400 | SUMMARY |
| Topes de texto | title 200, nota 5000, `user.name` 120, `user.email` 254, `user.id` 64, URL 2048, Enricher 512 | Zod (`maxLength`) | 400 | SUMMARY |
| Rate limits | 10/min por clave, 30/min por IP, 2000/día por proyecto | `@fastify/rate-limit` (in-memory) | 429 + `Retry-After` | SUMMARY |
| Columnas TTL | identidad 30 d, artefactos 90 d | Migración Drizzle inicial | — | resolution-record M-1 |

> ⚠ **Dos números «imagen» coexisten deliberadamente:** 4 MB es el tope del *parte multipart* (guarda del parser); 2 MB es el tope semántico de la *imagen codificada* (A-06 «duro»). Se resuelve como **add-alongside** (ver §7).

---

## 5. Los 9 patrones de arquitectura

| # | Patrón | Esencia |
|---|---|---|
| **1** | **Constantes en `packages/contracts`, clamps solo UX** | Un módulo de constantes; el esquema, el borde y los clamps del panel lo importan. «Client clamps are UX only, server caps are the control» (R-18) |
| **2** | **Endurecimiento de imagen: sniff → structure → guard → re-encode** | Magic bytes (nunca MIME declarado) → parseo estructural (allowlist de chunks) → guarda de bomba de decodificación desde cabeceras → re-encode obligatorio (P1-D-10). SVG rechazado incondicionalmente (P1-D-11) |
| **3** | **`Storage` a prueba de traversal (seam #6)** | Claves UUIDv4 generadas por servidor `projectId/<xx>/<uuid>.<ext>`; `path.resolve` + aserción de prefijo; resolución solo por BD; volumen solo en `api`; orden put → insert |
| **4** | **Migración Drizzle inicial — columnas TTL desde el día uno** | `projects` + `incidents` con `UNIQUE (project_id, idempotency_key)`, `storage_key`, `content_type`, `type`, `status`, `created_at`, `identity_purge_at`/`artifact_purge_at`. Seed idempotente de la clave `wkbt_` con muestreo por rechazo |
| **5** | **Ingesta idempotente con replay (ING-03)** | `INSERT … ON CONFLICT DO NOTHING RETURNING` sobre `(project_id, idempotency_key)`; duplicados devuelven 200 con el `id` almacenado. Ausencia de `Idempotency-Key` → 400 |
| **6** | **Rate limiting por capas (ING-05)** | `global: false` + tres limitadores `createRateLimit()` (por IP, por clave, por día); in-memory (INV-03); `trustProxy` explícito |
| **7** | **Sanear al escribir, escapar al render (ING-07)** | Pasada 1: `sanitize-html` con allowlist vacía. Pasada 2: solo nodos de texto React, nunca `dangerouslySetInnerHTML` |
| **8** | **`check:size` multi-artefacto (A-12/M-2)** | Tres carriles + total: core ≤ 45 KB gz, editor ≤ 25 KB, adaptador ≤ 14 KB, total ≤ 80 KB, con el peor caso `45+25+14 = 84 > 80 KB` **impreso visiblemente** |
| **9** | **Ruta de blob endurecida (sin promesa de auth)** | Resolución por `:id` parametrizado; cabeceras `nosniff` + `attachment` + `CSP: default-src 'none'; sandbox` + `CORP: same-origin`; nombre ASCII fijo; desconocido → **404, no 400** |

### Anti-patrones a evitar

- Confiar en `bodyLimit` de Fastify para el tope multipart.
- Aceptar el `Content-Type` declarado por el cliente para imágenes.
- Hacer `toBuffer()` antes de las guardas de tamaño/dimensión.
- Dejar que nombres del cliente lleguen a `path.*`.
- `req.file()` sin consumir el stream (la promesa nunca se resuelve).
- Suponer el orden de campos en multipart (poner `meta` antes de `image`).
- Renderizar campos del panel con cualquier sumidero HTML.
- Testear unitariamente los contratos «porque son puros» (R-12).
- Añadir Redis/microservicios para el estado de rate-limit (INV-03).
- Saltarse la consulta P1-D-10 y añadir `sharp` en silencio.

---

## 6. Los 9 peligros comunes

| # | Peligro | Cómo evitarlo |
|---|---|---|
| **1** | `bodyLimit` no acota multipart | Componer pre-lectura + contador streaming + `limits` explícitos + nginx |
| **2** | `file.truncated` almacena una imagen cortada | Mantener `throwFileSizeLimit: true`; mapear `RequestFileTooLargeError` → 413; unlink del tmp |
| **3** | Validación que confía en cabeceras/MIME (políglota/SVG/EXIF) | Allowlist PNG+WebP, parseo estructural, re-encode, tres cabeceras de blob, fixtures hostiles ya |
| **4** | Bombas de decodificación sin comprobar dimensión previa | Parsear IHDR/VP8X antes de decodificar; rechazar >16 MP o >8192 px; `timeout()` si hay `sharp` |
| **5** | Rate limits de una sola dimensión o IP falseable | Límites por capas; `trustProxy` explícito; caveat NAT; los tres configurables por env |
| **6** | Idempotencia «comprobar-luego-insertar» (carrera) | `UNIQUE (project_id, idempotency_key)` + `ON CONFLICT DO NOTHING` + replay |
| **7** | Columnas TTL diferidas a Fase 6 | Columnas TTL en la migración inicial; TTLs documentados en `.env.example` |
| **8** | Fricción de herramientas TS 7.x (Q-08) | Smoke-test de herramientas en el primer commit de andamiaje; fallback a 6.x registrado |
| **9** | El curl de onboarding rompe la allowlist de origen | Aplicar la allowlist **solo** cuando hay cabecera `Origin`; aceptar clientes sin `Origin` |

---

## 7. Preguntas abiertas (RESUELTAS)

| # | Pregunta | Resolución |
|---|---|---|
| **1** | Dependencia de re-encode (P1-D-10) | **01-02 Tarea 1**: consulta `checkpoint:human-verify` decidió `sharp` re-encode; `hardenImage()` como módulo plano para que cualquier backend encaje |
| **2** | Puerta de herramientas TS 7.x (Q-08) | **01-01 Tarea 2 Paso 0**: `drizzle-kit generate` + `tsx` + `vite build` corren antes de cualquier código de ingesta; resultado en `continuity-pack.md`. **PASS** bajo TS 7.0.2 (no se tomó el fallback 6.x) |
| **3** | Semántica del tope de imagen: 2 MB vs 4 MB | **01-02 `assumption_delta_decision` = `add-alongside`**: `MAX_ENCODED_IMAGE_BYTES` (2 MB, contrato) + `MAX_IMAGE_PART_BYTES` (4 MB, guarda del parser) como constantes distintas; filas e2e asertan 413 en ambas capas |
| **4** | Durabilidad de la cuota diaria | **01-03 Supuesto marcado #2**: el limitador in-memory se queda (INV-03 prohíbe Redis); caveat best-effort documentado en `.env.example` |
| **5** | Exposición de la superficie de lectura en Fase 1 | **01-01 Tarea 2 Paso 3**: puertos publicados solo en `127.0.0.1`; exposición declarada en el PR; revisada en Fase 5 con `AuthProvider` |
| **6** | Política de ausencia de `Idempotency-Key` | **400 cuando falta** (la cabecera es parte de la forma de cable CA-01 y `idempotency_key` es `NOT NULL`) |

---

## 8. Supuestos registrados

| # | Supuesto | Riesgo si es falso |
|---|---|---|
| **A1** | «32 bytes aleatorios en base62» = 32 **caracteres** base62 (≈190 bits) con muestreo por rechazo | Bajo — la forma `wkbt_` está fijada igualmente |
| **A2** | Comportamiento de `sharp` (metadatos eliminados, mismo formato, `timeout`) | Bajo — las afirmaciones están citadas; la *adopción* está consultada |
| **A3** | Forma de la API de `sanitize-html` | Bajo — fallaría en el primer `verify` |
| **A4** | Nombres de opción de `@fastify/cors` para la allowlist | Bajo — confirmar contra su README al implementar |
| **A5** | Topes por capas: 4 MB parser + 2 MB semántico | Medio-bajo — si hay un solo número, elegir 2 MB (el de contrato) |
| **A6** | Nombres de columnas Drizzle (`snake_case`, `timestamptz`, `status` sembrado `'pending'`) | Bajo — discreción del agente |
| **A7** | Layout e2e de Fase 1 (ficheros por grupo CA, fixtures hostiles) | Bajo — discreción del agente |
| **A8** | La invocación es `docker compose` (sin guion) | Bajo — documentar ambas |
| **A9** | Los endpoints de lectura salen **sin autenticar** (DEP-03 completa en Fase 5) | Medio — mitigado por binding a loopback + declaración en el PR |

---

## 9. Auditoría de legitimidad de paquetes

Ejecutada vía el seam `package-legitimacy`. ⚠ **Caveat del seam:** todo paquete que publicó una release en el último mes se marca `SUS` con la razón única `"too-new"` — la señal depende de la *fecha de la última release*, no de la antigüedad. Todas las filas salvo `sharp` tienen repositorio upstream oficial y millones de descargas semanales → falso positivo de cadencia.

| Paquete | Antigüedad | Descargas/sem | Repo | Veredicto | Disposición |
|---|---|---|---|---|---|
| `fastify` | ~10 a | 15,3 M | github.com/fastify/fastify | SUS (`too-new`) | Aprobado (pin A-09 + repo oficial); checkpoint humano en Wave 0 |
| `@fastify/multipart` | ~8 a | 3,0 M | github.com/fastify/fastify-multipart | SUS (`too-new`) | Aprobado; smoke-test P1-D-09 primer commit |
| `@fastify/rate-limit` | ~8 a | 3,5 M | github.com/fastify/fastify-rate-limit | SUS (`too-new`) | Aprobado |
| `@fastify/cors` | ~9 a | 7,2 M | github.com/fastify/fastify-cors | SUS (`too-new`) | Aprobado |
| `@fastify/helmet` | ~8 a | 2,7 M | github.com/fastify/fastify-helmet | SUS (`too-new`) | Aprobado |
| `@fastify/cookie` | ~9 a | 3,5 M | github.com/fastify/fastify-cookie | SUS (`too-new`) | Aprobado |
| `drizzle-orm` / `drizzle-kit` | ~5 a | 27,8 M / 22,8 M | github.com/drizzle-team/drizzle-orm | SUS (`too-new`) | Aprobado |
| `pg` | ~14 a | 64,6 M | github.com/brianc/node-postgres | SUS (`too-new`) | Aprobado |
| `sanitize-html` | ~12 a | 11,9 M | github.com/apostrophecms | SUS (`too-new`) | Aprobado |
| `zod` | ~7 a | 341,7 M | github.com/colinhacks/zod | SUS (`too-new`) | Aprobado |
| `@playwright/test` | ~5 a | 75,7 M | github.com/microsoft/playwright | SUS (`too-new`) | Aprobado |
| **`sharp`** | ~12 a | 115,9 M | github.com/lovell/sharp | SUS (`too-new`) | **Marcado — checkpoint humano dedicado (también trigger de P1-D-10) antes de instalar** |
| `esbuild` | ~7 a | 303,3 M | github.com/evanw/esbuild | OK | Aprobado (`postinstall` estándar) |
| `pngjs` | ~11 a | 70,3 M | github.com/pngjs/pngjs | OK | Aprobado (candidato al camino PNG sin dependencias) |

**Paquetes retirados por veredicto [SLOP]:** ninguno. El gate humano de Wave 0 aprobó exactamente **17 pines npm + 3 imágenes**; cinco paquetes `@types/*` solo-tipos se añadieron después vía el gate explícito **A-13**.

---

## 10. Arquitectura de validación

> `nyquist_validation` está activo. **R-12 prevalece:** no hay framework de tests unitarios, ni tests por función, ni umbrales de cobertura. Toda la verificación automatizada vive en la suite Playwright única + las puertas de build.

| Propiedad | Valor |
|---|---|
| Framework | `@playwright/test` 1.63.0 (el ÚNICO) |
| Config | `playwright.config.ts` — proyectos chromium + firefox + webkit |
| Comando rápido | `npm run check:size` |
| Comando de suite completa | `npm run verify` |
| Puertas de build | `check:size` (A-12 multi-artefacto), `check:compose` (aserción C-4) |

### Mapa requisito → test

| Req | Comportamiento | Tipo | Comando |
|---|---|---|---|
| DEP-01 | `docker compose up` arranca api+panel+db; el panel proxya `/api` | e2e | `npm run verify` |
| DEP-02 | Clave ausente/placeholder → boot fail-fast con mensaje exacto | e2e | `npm run verify` |
| ENR-06 | El reporte almacenado valida contra `schema/report.schema.json` | e2e | `npm run verify` |
| ING-01 | `FormData` sintético aterriza como fila + imagen en el volumen | e2e | `npm run verify` |
| ING-03 | Reintento con la misma `Idempotency-Key` → una fila, mismo id | e2e | `npm run verify` |
| ING-04 | Clave ausente/inválida → 401 estructurado | e2e | `npm run verify` |
| ING-05 | Límites por clave + IP + cuota diaria → 429 + `Retry-After` | e2e | `npm run verify` |
| ING-06 | Cuerpo/imagen sobredimensionados → 413; SVG/políglota → 400; traversal → 400 | e2e | `npm run verify` |
| ING-07 | XSS almacenado saneado; el panel renderiza texto inerte | e2e | `npm run verify` |
| ING-08 | `Origin` no permitido rechazado; allowlist y sin-`Origin` aceptados | e2e | `npm run verify` |
| RNF-01/CA-03 | Carriles de tamaño + escenario 84>80 visible | gate | `npm run check:size` |
| INV-03/C-4 | Volumen de blobs solo en `api` | gate | `npm run check:compose` |

**Carencias de Wave 0:** `playwright.config.ts` (3 proyectos), esqueleto de suite con grupos CA-01…CA-05, `e2e/fixtures/` (válidos + hostiles), `scripts/check-size.mjs`, `scripts/check-compose.mjs`, workspaces raíz + shells. **Ningún framework de tests unitarios (R-12).**

---

## 11. Dominio de seguridad (ASVS nivel 1)

| Categoría ASVS | Aplica | Control estándar |
|---|---|---|
| V2 Autenticación | parcial (solo escritura) | Clave write-only `wkbt_` como *capacidad*, nunca lectura. Auth real en Fase 5 |
| V3 Gestión de sesión | no | Fase 5 (cookie `__Host-`, TTL ≤ 8 h) |
| V4 Control de acceso | sí (parcial) | Comprobación de clave en POST (401); ruta de blob endurecida pero sin auth hasta Fase 5 |
| V5 Validación de entrada | sí | Esquema Zod cerrado, topes por capas, allowlist PNG/WebP, guarda de bomba, `sanitize-html` |
| V6 Criptografía | sí (ligera) | `crypto.randomBytes`/`randomUUID` (muestreo por rechazo); Argon2id en Fase 5 |

### Patrones de amenaza conocidos

| Patrón | STRIDE | Mitigación |
|---|---|---|
| XSS almacenado por texto (C-3) | Tampering/Elevation | `sanitize-html` + render solo de nodos de texto |
| XSS vía imagen: SVG, políglotas, sniffing | Tampering | Allowlist magic-byte + estructura, SVG rechazado, re-encode, cabeceras de blob |
| Path traversal / lectura arbitraria (C-4) | Info disclosure | Claves UUIDv4 de servidor, resolución por BD, regex + aserción de prefijo, volumen solo en `api`, 404 no 400 |
| DoS de ingesta: bombas de cuerpo/payload/decodificación (H-7) | DoS | Pre-lectura + contador, `limits`, guarda de 16 MP, rate limits, `trustProxy` explícito |
| Abuso/enumeración de clave (H-7) | Elevation | Rate limits por clave + IP; la clave autentica solo escritura; 401 sin oráculo |
| Inyección de cabecera por nombres | Tampering | `Content-Disposition` ASCII fijo; nombres del cliente nunca llegan a cabeceras/rutas |
| Retención de PII EXIF/metadatos (M-1/C-3) | Info disclosure | Re-encode/eliminación de metadatos; columnas TTL desde la primera migración |
| Carreras de idempotencia → datos personales duplicados | Repudiation | `UNIQUE (project_id, idempotency_key)` + replay |

---

## 12. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-0x / A-xx** | Amendment del registro de decisiones (`documentation/resolution-record.md`) |
| **A1…A9** | Supuestos de investigación (Assumptions Log) |
| **ASVS** | *Application Security Verification Standard* (OWASP) |
| **CA-0x** | Criterio de Aceptación del proyecto |
| **C-3 / C-4** | Clases de peligro: C-3 XSS/inyección en render; C-4 path traversal / ficheros |
| **CRLF** | *Carriage Return + Line Feed* (par de fin de línea) |
| **DEP-0x** | Requisito de despliegue (*deployment*) |
| **e2e** | *End-to-end* (prueba de extremo a extremo) |
| **ENR-0x** | Requisito de enriquecimiento (*enrichment*) |
| **EXIF / XMP** | Metadatos embebidos en imágenes (EXIF de cámara, XMP de Adobe) |
| **H-7 / H-9** | Peligros de investigación (H-7 abuso de ingesta; H-9 límites de transporte) |
| **IHDR / VP8X** | Cabeceras de dimensión de PNG / contenedor extendido WebP |
| **ING-0x** | Requisito de ingesta (*ingest*) |
| **INV-0x** | Invariante arquitectónico no negociable |
| **M-1 / M-2** | Puntos del registro ligados a retención (M-1) y al gate de tamaño (M-2) |
| **MIME** | *Multipurpose Internet Mail Extensions* (tipo de contenido declarado) |
| **MP** | Megapíxel |
| **P1-D-xx** | Decisión de implementación local de la Fase 1 |
| **PII** | *Personally Identifiable Information* (datos personales) |
| **Q-0x** | Pregunta abierta del registro |
| **R-xx** | Decisión/regla del registro global |
| **RNF-xx** | Requisito no funcional |
| **SEC-0x** | Requisito de seguridad |
| **STRIDE** | Taxonomía de amenazas (Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation) |
| **SUS / SLOP** | Veredictos del seam de legitimidad (sospechoso / descartado) |
| **TFG** | Trabajo Fin de Grado |
| **TTL** | *Time To Live* (vida útil antes de purga) |
| **UNVERIFIED** | Afirmación aún no verificada contra fuente autoritativa |
| **XSS** | *Cross-Site Scripting* |
