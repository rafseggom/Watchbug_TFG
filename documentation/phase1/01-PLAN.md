<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 1 — Plan: *Contracts & Ingest Slice*

| | |
|---|---|
| **Fase** | 1 — *Contracts & Ingest Slice* |
| **Rama** | `gsd/phase-1-contracts-ingest` |
| **Olas** | 4 planes (`01-01` … `01-04`), secuenciales |
| **Requisitos** | DEP-01, DEP-02, ENR-06, ING-01, ING-03…ING-08 (10) |
| **Modo** | `mvp` — verificación *goal-backward* contra el resultado y los 5 criterios de éxito |

> Este documento fusiona los cuatro `01-0N-PLAN.md` en un único plan-resumen ejecutivo. El detalle literal de tareas vive en los ficheros de planificación originales.

---

## 1. Objetivo de la fase

> **Como** desarrollador auto-hospedador, **quiero** arrancar el stack Watchbug y empujar un reporte (imagen + metadatos) por la red hacia un almacenamiento endurecido y validado por esquema que se renderiza en un panel mínimo, **para que** la espina de ingesta quede probada de extremo a extremo sobre mi propia infraestructura y ni el reporte ni su captura salgan nunca de ella.

**Valor de la fase:** probar cada *seam* arquitectónico sobre el que se construyen las 6 fases restantes, con código real y un camino e2e ejecutable; y aterrizar el contrato + el gate de tamaño + la aserción de compose desde el día uno.

---

## 2. Las cuatro olas

| Ola | Plan | Rebanada (slice) | Requisitos | Depende de | Tareas |
|-----|------|------------------|------------|------------|--------|
| **1** | `01-01` | Walking Skeleton: la cadena completa funciona una vez | DEP-01, DEP-02, ENR-06, ING-01, ING-03 | — | 3 |
| **2** | `01-02` | Rechazo de envíos hostiles (hardening C-3/C-4) | ING-06 | 01-01 | 3 |
| **3** | `01-03` | Gatekeeping de ingesta (clave, rate limit, CORS) | ING-04, ING-05, ING-08 | 01-02 | 3 |
| **4** | `01-04` | Seguridad de texto + i18n + onboarding curl | ING-07 | 01-03 | 3 |

### Orden risk-first (decidido)

1. **Smoke-test multipart + gate de tooling TypeScript** en un commit mínimo de andamiaje (P1-D-09, Q-08).
2. **Consulta de re-encode (P1-D-10)** como checkpoint humano antes de escribir el endpoint de ingesta.
3. Luego: `contracts` → `compose/env` → borde de ingesta → `Storage` → panel → e2e.

---

## 3. Detalle por ola

### Ola 1 — `01-01` Walking Skeleton

**Objetivo:** monorepo npm-workspaces, el contrato único oficial (`packages/contracts` → `schema/report.schema.json`) con el conjunto de constantes A-06 y las constantes de masking R-13, el `docker-compose.yml` de tres servicios, y un flujo de reporte real de extremo a extremo: `POST /api/incidents` (multipart `meta` + `image`) validado contra el contrato, imagen almacenada por el adaptador `Storage` a prueba de traversal, inserción idempotente, y renderizado en un panel de dos columnas.

**Tareas:**
- **T1 (checkpoint humano, bloqueante):** puerta de legitimidad de dependencias — aprobar el set fijado (17 pins npm + 3 imágenes) antes de instalar.
- **T2 (tracer):** un reporte sintético de extremo a extremo. Step 0 = smoke multipart + gate de tooling TS; Steps 1–6 = `contracts`, armazón SDK, compose/env, `apps/api`, panel, gates + suite.
- **T3 (auto, bloqueante):** generar y aplicar la migración Drizzle inicial a la BD de desarrollo viva.

**Verdades clave (must_haves):** un `docker compose up` → el panel lista un reporte; fail-fast de config; una fila `incidents` con imagen en el volumen api-only; validación contra `schema/report.schema.json`; replay idempotente (201 → 200, mismo id); `check:size` imprime el peor caso 45+25+14 = 84 KB > 80 KB; `check:compose` exige 3 servicios y volumen solo en `api`; bordes de empty/ordering/concurrency; `Idempotency-Key` ausente → **400**.

### Ola 2 — `01-02` Rechazo de envíos hostiles

**Objetivo:** endurecer el borde de ingesta contra cargas hostiles (ING-06 + criterio de éxito 4): caps de tamaño por capas (pre-lectura de `Content-Length` + contador de streaming + límites multipart + chequeo semántico de 2 MB), la pila de control de imagen (sniff de magic bytes → validación estructural de chunks → guard de decode-bomb → etapa obligatoria de harden), la prueba de almacenamiento a prueba de traversal y la respuesta de blob endurecida.

**Tareas:**
- **T1 (consulta + legitimidad, bloqueante):** decidir el backend de re-encode P1-D-10 (`sharp` vs strip/rebuild estructural sin dependencias).
- **T2 (TDD):** rechazo de payloads hostiles — caps por capas + pila de control de imagen.
- **T3 (auto):** ruta de blob endurecida + prueba de storage a prueba de traversal.

**Decisión clave:** `sharp@0.35.5` adoptado por el propietario (decode→re-encode, metadata eliminada, timeout + `limitInputPixels`); el strip estructural pasó a `structure.ts` como *guard* pre-codec.

### Ola 3 — `01-03` Gatekeeping de ingesta

**Objetivo:** completar los controles de entrada: chequeo de project key con 401 uniforme (ING-04), rate limiting de tres capas con 429 + `Retry-After` (ING-05, SEC-05), y allowlist de orígenes dirigida por env con la regla "Origin presente" (ING-08, A-11).

**Tareas:**
- **T1 (TDD):** gate de project key — 401 uniforme, nada almacenado.
- **T2 (TDD):** rate limits por capas — por key, por IP, por proyecto/día con `Retry-After`.
- **T3 (TDD):** allowlist de orígenes — `WATCHBUG_CORS_ORIGINS` con regla "Origin presente".

**Decisión clave:** los máximos e2e se ajustan a `1200/600/2000` (solo `.env` local) para que cada dimensión sea demostrable; los valores de producción (`10/30/2000`) quedan intactos.

### Ola 4 — `01-04` Seguridad de texto + primera experiencia

**Objetivo:** cerrar ING-07 como doble control C-3 — `sanitize-html` pase 1 sobre cada cadena de usuario en ingesta, render solo por nodos de texto React pase 2 en el panel, probado a nivel de artefacto — y terminar la experiencia del panel: i18n `en`/`es` con detección por `navigator.language` y selector persistido (P1-D-05), y el estado vacío con `curl` pre-rellenado con el project key real (P1-D-07).

**Tareas:**
- **T1 (TDD):** sanear cada cadena de usuario al escribir (ING-07 pase 1).
- **T2 (TDD):** prueba de inercia en render — el panel muestra el texto como texto (ING-07 pase 2).
- **T3 (auto):** primera experiencia — i18n en/es + estado vacío con curl de onboarding.

**Decisión clave:** decode de entidades **guardado** (no en bloque): `toPlainText` decodifica los re-escapes solo cuando el valor decodificado no puede reabrir una etiqueta; los caps cuentan **puntos de código Unicode** (semántica Zod 4.6.5).

---

## 4. Modelo de amenazas (STRIDE, resumen)

Consolidado de los bloques `<threat_model>` de los cuatro planes. 18 amenazas registradas, todas `mitigate` salvo la de claims de producto (`accept`). Detalle completo en `01-SECURITY.md`.

| ID | Cat. | Componente | Sev. | Mitigación (resumen) |
|----|------|------------|------|----------------------|
| T-01-01 | S | Gate de project key en POST | alta | Lookup de `projects` seedeado; 401 estructurado; nada almacenado |
| T-01-02 | I | Config / boot | alta | SEC-04: config desde `.env`; fail-fast (P1-D-02) |
| T-01-03 | T | Texto de reporte → render panel | alta | Doble control: `sanitize-html` en escritura + nodos de texto React |
| T-01-04 | I | Metadatos de imagen (EXIF PII) | media | `harden()` elimina metadata antes de disco; columnas TTL |
| T-01-05 | D | Ruta de recepción multipart | alta | Límites explícitos del plugin + `throwFileSizeLimit` |
| T-01-06 | T | Ingesta de imagen (SVG/polígloto) | alta | Magic bytes + allowlist estructural; SVG rechazado; harden |
| T-01-07 | T | Manejo de clave/ruta de `Storage` | alta | Claves UUID generadas por servidor; `path.resolve` + aserción |
| T-01-08 | D | Ruta de decode | alta | Guard de dimensiones de cabecera (16 MP / 8192) antes de decode |
| T-01-09 | D | Recepción multipart (caps agregados) | alta | Pre-lectura + contador streaming + límites → 413; tmp eliminado |
| T-01-10 | I | Respuesta de ruta de blob | media | Set de headers inertes; MIME desde BD; 404 en claves desconocidas |
| T-01-11 | S | Derivación de clave de rate limit | alta | `trustProxy` explícito; caveats de spoofing/NAT documentados |
| T-01-12 | D | Rate limits de ingesta (H-7) | alta | Tres limitadores compuestos; 429 + `Retry-After` |
| T-01-13 | S | Manejo de origen CORS (ING-08) | media | Allowlist env sobre presencia de `Origin`; 403 si no está |
| T-01-14 | I | Respuestas 401 | baja | Cuerpo 401 uniforme — sin oráculo de existencia de clave |
| T-01-15 | T | Render de campos de reporte | alta | Nodos de texto React + gate de sink a nivel de fuente |
| T-01-16 | I | Exposición de projectKey en `/api/setup` | baja | Solo `{ projectKey }`; clave pública de escritura; bind loopback |
| T-01-17 | T | Claims de producto (privacidad) | baja | Restricción de claims; sin afirmaciones de RGPD (AR-01) |
| T-01-SC | T | Instalaciones npm/Docker | alta | Puerta de legitimidad de paquetes (17 npm + 3 imágenes) |

---

## 5. Verificación y criterios de éxito

**Comandos:**
1. `npm run build` — los cuatro workspaces compilan limpio.
2. `npm run check:size` — lanes RNF-01 verdes; escenario 84>80 impreso (A-12).
3. `npm run check:compose` — 3 servicios; volumen de blob solo en `api` (INV-03/C-4).
4. `npm run verify` — la suite Playwright única en chromium + firefox + webkit.
5. **Manual (UAT):** `cp .env.example .env`, `npm run key:gen` → `WATCHBUG_PROJECT_KEY`, `docker compose up -d` desde checkout limpio.

**Criterios de éxito:**
- Un `docker compose up` arranca api + panel + db; toda configuración desde `.env`.
- Un reporte sintético aterriza como una fila con imagen en el volumen api-only bajo clave generada por servidor y se renderiza; un reenvío con una `Idempotency-Key` crea exactamente un reporte.
- Cada reporte almacenado valida contra `schema/report.schema.json`; contrato, constantes y gate de tamaño existen desde el día uno.

---

## 6. Supuestos señalados (del plan)

1. **Fila sonda ING-01 sin clasificar** queda `unresolved` — su comportamiento se entrega y prueba en e2e, pero la forma sin clasificar no derivó predicado; se cierra en `/gsd-verify-work`.
2. **A1 (lectura de entropía de clave):** P1-D-03 "32 bytes en base62 (≈190 bits)" se implementó como **32 caracteres base62** (~190 bits) vía `crypto.randomBytes` con rejection sampling. Si el propietario quería 32 bytes crudos (256 bits → 43 chars), solo cambian el regex de formato y `gen-key.mjs`.
3. **Superficie de lectura sin autenticar por alcance explícito** (A9/Q5): lista + blob abiertos hasta Fase 5; mitigado por bind loopback; la exposición se declara en el PR (T-01-01).

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|-------|-------------|
| **A-0x** | Amendment del registro de decisiones |
| **CA-0x** | Criterio de Aceptación del proyecto |
| **C-3 / C-4** | Clases de peligro: C-3 XSS/inyección; C-4 path traversal |
| **DEP-0x** | Requisito de despliegue |
| **e2e** | End-to-end |
| **ENR-0x** | Requisito de enriquecimiento |
| **H-7 / H-9** | Peligros de la investigación |
| **ING-0x** | Requisito de ingesta |
| **INV-0x** | Invariante arquitectónico |
| **M-1 / M-2** | Puntos de retención (M-1) y gate de tamaño (M-2) |
| **P1-D-xx** | Decisión de implementación local de la Fase 1 |
| **Q-xx** | Pregunta abierta de la investigación |
| **R-xx** | Decisión/regla del registro global |
| **RNF-xx** | Requisito no funcional |
| **SEC-0x** | Requisito de seguridad |
| **STRIDE** | Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation |
| **T-01-xx** | Amenaza del registro STRIDE de la fase |
| **TDD** | Test-Driven Development (RED → GREEN → REFACTOR) |
| **TTL** | Time To Live |
| **UAT** | User Acceptance Testing |
