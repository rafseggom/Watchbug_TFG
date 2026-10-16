<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 1 — Verificación: *Contracts & Ingest Slice*

| | |
|---|---|
| **Fase** | 1 — *Contracts & Ingest Slice* |
| **Verificado** | 2026-10-13 (re-verificación sobre HEAD `182dd69`) |
| **Estado** | ✅ `passed` |
| **Puntuación** | **40/40** verdades verificadas |
| **Comportamiento no verificado** | `behavior_unverified: 0` |
| **Validación Nyquist** | `nyquist_compliant: true` |

> Consolidación de `01-VERIFICATION.md` + `01-VALIDATION.md` + `COVERAGE.md`.

---

## 1. Objetivo de la fase y método

**Objetivo:** «Un desarrollador puede arrancar el stack auto-hospedado y empujar un reporte (imagen + metadatos) por la red hacia un almacenamiento endurecido y validado por esquema que se renderiza en un panel mínimo — el contrato, el conjunto de constantes y la puerta de tamaño existen desde el día uno.»

**Historia (MVP):** *Como* desarrollador auto-hospedador, *quiero* arrancar el stack Watchbug y empujar un reporte por la red hacia un almacenamiento endurecido y validado por esquema que se renderiza en un panel mínimo, *para que* la columna vertebral de ingesta quede probada de extremo a extremo en mi propia infraestructura y ni el reporte ni su captura salgan nunca de ella.

**Re-verificación:** sí. El informe previo (`human_needed`, 38/40) quedó obsoleto porque los ficheros fuente cambiaron después: la ronda de correcciones de `01-REVIEW` (CR-01/CR-02 + WR-01…WR-06), el fix de linger de la pre-lectura ING-06 (`ed20ec3`), la re-verificación de seguridad y el UAT humano completado. Este informe re-ejecuta cada puerta contra el **estado actual en disco** y lo supera.

Todas las puertas se re-ejecutaron **en el propio proceso del verificador** contra un stack reconstruido desde el árbol actual (daemon Docker arrancado en frío por el verificador):

| Puerta | Comando | Resultado |
|---|---|---|
| Arranque en frío | `docker compose up -d --build` | ✅ PASS — `db Started → Waiting → Healthy → api Starting → panel Starting` (orden por healthcheck); `/api/health` → `{"status":"ok"}` |
| Build (4 workspaces) | `npm run build` | ✅ PASS — `schema/report.schema.json` re-emitido byte-idéntico |
| Typecheck | `npm run lint` | ✅ PASS, exit 0 |
| Puerta de tamaño | `npm run check:size` | ✅ PASS — `45 + 25 + 14 = 84 KB > 80 KB` impreso (A-12/M-2) |
| Puerta de compose | `npm run check:compose` | ✅ PASS — 3 servicios, volumen solo en `api` |
| Suite e2e (R-12) | `npm run verify` | ✅ **132/132** en 3 navegadores, 5,8 min |
| Comprobación runtime WR-06 | `docker exec watchbug-api-1 id` | ✅ PASS — `uid=1000(node)` |

Más 4 sondas de comportamiento en vivo y comprobaciones estáticas de cableado/anti-patrón sobre cada fichero cambiado.

---

## 2. Verdades observables (40/40)

### 01-01 Walking Skeleton (16 verdades)

| # | Verdad | Estado |
|---|---|---|
| 1 | Un `docker compose up` → el panel lista un reporte publicado (DEP-01) | ✓ VERIFICADA |
| 2 | Toda configuración desde `.env`; clave ausente/vacía/placeholder falla el arranque nombrando variable + fichero (DEP-02) | ✓ VERIFICADA |
| 3 | Reporte sintético → exactamente una fila, imagen bajo clave generada por servidor en volumen api-only (ING-01) | ✓ VERIFICADA |
| 4 | Cada reporte almacenado valida contra `schema/report.schema.json` (ENR-06) | ✓ VERIFICADA |
| 5 | Reintento con misma `Idempotency-Key` → un reporte, mismo id (ING-03) | ✓ VERIFICADA |
| 6 | `check:size` fuerza los carriles + imprime el escenario 84 KB; `check:compose` falla si no hay 3 servicios y volumen api-only | ✓ VERIFICADA |
| 7 | Re-ejecución tras arranque interrumpido: db healthy antes que api; e2e sobre stack fresco | ✓ VERIFICADA *(era ⚠️; cerrada conductualmente)* |
| 8 | Clave vacía ≡ clave ausente (mensaje idéntico); placeholder rechazado | ✓ VERIFICADA |
| 9 | Ajustes opcionales vacíos → defaults documentados (30/90/10/30/2000), nunca 0/ilimitado | ✓ VERIFICADA |
| 10 | Precedencia de config determinista y documentada | ✓ VERIFICADA |
| 11 | Frontera de título inclusiva: 200 puntos de código almacenados, 201 → 400 | ✓ VERIFICADA |
| 12 | `meta` ausente/vacío → 400; campos ausentes → 400 nombrando los campos | ✓ VERIFICADA |
| 13 | Fallos multi-campo listados en orden de declaración del esquema, estable entre repeticiones | ✓ VERIFICADA |
| 14 | Misma presentación dos veces → una fila, mismo id (201 luego 200) | ✓ VERIFICADA |
| 15 | Par concurrente con una clave → exactamente una fila vía `UNIQUE (project_id, idempotency_key)` | ✓ VERIFICADA |
| 16 | `Idempotency-Key` ausente → 400 estructurado, nada almacenado | ✓ VERIFICADA |

### 01-02 Endurecimiento hostil (8 verdades)

| # | Verdad | Estado |
|---|---|---|
| 1 | Cuerpo > `MAX_BODY_BYTES` (5 MB) → 413 por pre-lectura **y** contador streaming (ING-06) | ✓ VERIFICADA |
| 2 | Parte > 4 MB → 413 en el parser; codificada > 2 MB → 413 semántico; parte truncada nunca almacenada | ✓ VERIFICADA |
| 3 | SVG/políglota rechazados 400; metadatos + chunks de animación y datos colgantes rechazados/descartados | ✓ VERIFICADA |
| 4 | Bomba de decodificación rechazada desde cabeceras antes de decodificar (`w*h > 16.777.216` o dim > 8192) | ✓ VERIFICADA |
| 5 | Cada imagen aceptada pasa `hardenImage()` antes de escribir: metadatos eliminados, formato de salida = entrada | ✓ VERIFICADA |
| 6 | Nombre de fichero hostil → 400; claves siempre generadas por servidor (C-4) | ✓ VERIFICADA |
| 7 | La ruta de blob sirve solo claves resueltas por BD con las 5 cabeceras inertes, nombre ASCII fijo, 404 (nunca 400) para ids desconocidos | ✓ VERIFICADA |
| 8 | *(respaldo)* Subida sobredimensionada abortada sin bufferizar; tmp parciales desenlazados; subidas concurrentes no acumulan memoria | ✓ VERIFICADA |

### 01-03 Control de acceso (8 verdades)

| # | Verdad | Estado |
|---|---|---|
| 1 | Clave ausente/desconocida/malformada → mismo 401 estructurado, sin oráculo, nada almacenado (ING-04) | ✓ VERIFICADA |
| 2 | Peticiones paralelas con clave inválida → cada una su 401, sin fila | ✓ VERIFICADA |
| 3 | Tres capas compuestas (10/clave/min, 30/IP/min, 2000/proyecto/día), configurables por env, 429 + `Retry-After` (ING-05) | ✓ VERIFICADA |
| 4 | Frontera inclusiva: exactamente max pasan, max+1 → 429, ventana resetea | ✓ VERIFICADA |
| 5 | `Retry-After` = techo a segundos enteros, mín 1, nunca 0/fraccionario | ✓ VERIFICADA |
| 6 | Ráfaga concurrente no puede exceder el máximo de ventana (incrementar-antes-de-decidir) | ✓ VERIFICADA *(era ⚠️; cerrada por UAT test 2)* |
| 7 | `Origin` presente → aceptado solo si está en allowlist; si no 403 sin almacenar; sin `Origin` aceptado (ING-08) | ✓ VERIFICADA |
| 8 | Ráfaga mixta permitido/no-permitido → decisiones independientes por petición | ✓ VERIFICADA |

### 01-04 Seguridad de texto y primera experiencia (8 verdades)

| # | Verdad | Estado |
|---|---|---|
| 1 | Cada string de usuario saneado al ingerir y renderizado inerte (ING-07, SEC-05) | ✓ VERIFICADA |
| 2 | Preservador de texto: `2 < 3 & 4 > 1` se conserva literal; el marcado se elimina | ✓ VERIFICADA |
| 3 | Título de longitud cero → 400; opcionales ausentes almacenados `null` | ✓ VERIFICADA |
| 4 | Topes inclusivos en el límite; la salida saneada nunca excede su tope | ✓ VERIFICADA |
| 5 | El saneado preserva el orden documental del texto superviviente | ✓ VERIFICADA |
| 6 | *(respaldo)* El saneado es puro por petición: envíos hostiles concurrentes independientes, sin fugas cruzadas | ✓ VERIFICADA |
| 7 | Español por defecto con `navigator.language` que empieza por `es`; selector persistido en `watchbug.lang` entre recargas (P1-D-05) | ✓ VERIFICADA |
| 8 | Estado vacío = curl copiable con la clave real; ejecutarlo literalmente registra un reporte real (P1-D-07) | ✓ VERIFICADA |

**Puntuación: 40/40.** Las 2 verdades que el informe previo dejó ⚠️ están ahora cerradas conductualmente.

---

## 3. Prohibiciones (must-NOTs)

| # | Enunciado | Estado |
|---|---|---|
| P1 (01-01) | El payload almacenado permanece de forma cerrada — campos desconocidos rechazados 400, nunca almacenados | ✓ VERIFICADA |
| P2 (01-01) | El contrato nunca exporta/permite una primitiva de enmascarado invertible o débil | ✓ VERIFICADA |
| P3 (01-04) | Ninguna petición de red a terceros desde panel/API | ✓ VERIFICADA |

---

## 4. Criterios de éxito del ROADMAP

| SC | Criterio | Estado |
|---|---|---|
| 1 | Arrancar API/panel/db con un `docker-compose up`; todo ajuste desde `.env.example` comprometido | ✓ VERIFICADO |
| 2 | Reporte sintético por HTTP → fila BD + imagen en volumen bajo clave de servidor, listado en panel mínimo | ✓ VERIFICADO |
| 3 | Cada reporte valida contra `schema/report.schema.json`; misma clave de idempotencia → exactamente un reporte | ✓ VERIFICADO |
| 4 | Un envío hostil no puede almacenarse: claves/tamaño/SVG/políglota/traversal → 401/413/429/400; texto saneado y renderizado inerte | ✓ VERIFICADO |
| 5 | Límites por clave y por IP (+ cuota diaria, 429 + `Retry-After`); solo orígenes en allowlist | ✓ VERIFICADO |

---

## 5. Cobertura de requisitos (10/10)

| Requisito | Plan | Estado | Evidencia |
|---|---|---|---|
| DEP-01 | 01-01 | ✓ SATISFECHO | Filas de `deploy.spec`; `check:compose` PASS; arranque en frío |
| DEP-02 | 01-01 | ✓ SATISFECHO | 4 filas de `deploy.spec`; config fail-fast |
| ENR-06 | 01-01 | ✓ SATISFECHO | `ingest.spec:85` + bordes de `validate-meta` |
| ING-01 | 01-01 | ✓ SATISFECHO | `ingest.spec:85` 201 + round-trip de imagen |
| ING-03 | 01-01 | ✓ SATISFECHO | `ingest.spec:156/170/189`; índice único; replay acotado al proyecto (fix WR-01) |
| ING-04 | 01-03 | ✓ SATISFECHO | `hostile.spec:479/513`; sonda en vivo P-A |
| ING-05 | 01-03 | ✓ SATISFECHO | `hostile.spec:647/660/673` + filas de regresión CR-01/CR-02; UAT test 2 |
| ING-06 | 01-02 | ✓ SATISFECHO | 5 filas por capas + sonda P-C |
| ING-07 | 01-04 | ✓ SATISFECHO | 7 filas ING-07 |
| ING-08 | 01-03 | ✓ SATISFECHO | `hostile.spec:880/903` |

**Requisitos huérfanos:** ninguno. `DEP-03` sigue mapeado a Fase 5 (blob solo por API autenticada) — correcto para Fase 1, no una carencia.

---

## 6. Traza de flujo de datos (Nivel 4)

| Artefacto | Variable | Origen | ¿Datos reales? | Estado |
|---|---|---|---|---|
| `panel/src/api.ts` → `App.tsx` | estado `incidents` | `fetch('/api/incidents')` → nginx → Fastify → PostgreSQL | Sí | ✓ FLUYENDO |
| `ReportDetail` imagen | `incidentImageUrl(id)` | `GET …/:id/image` → `storage_key` BD → `FsStorage.stream()` | Sí | ✓ FLUYENDO |
| `EmptyState` curl | `fetchSetup()` | `GET /api/setup` → clave sembrada de `.env` | Sí (fila de curl ejecutado verde) | ✓ FLUYENDO |
| Ruta de escritura | multipart `meta` + `image` | validado → endurecido → `Storage.put` → fila `incidents` | Sí | ✓ FLUYENDO |
| Strings del panel | diccionarios i18n | `i18n.ts` en/es | Sí | ✓ FLUYENDO |

Sin sumideros de datos hardcodeados; sin stubs `return []`/`return null` en la ruta de render.

---

## 7. Verificación de enlaces clave

| De | A | Vía | Estado |
|---|---|---|---|
| Forma de cable CA-01 | `routes/incidents.ts` (parseo multipart) | política de recepción `caps.ts` (`preservePath:true`, límites de contrato) | CABLEADO |
| `constants.ts` → `maxLength` Zod → aplicación API | `schema.ts` importa todo tope de `constants.ts` (R-18) | `validate-meta`/`incidents.ts` | CABLEADO |
| `incidents.storage_key` → fs-storage → `GET …/image` solo-por-BD | `incidents.ts:380` select → `storage.stream()` | `STORAGE_KEY_REGEX` + aserción de prefijo | CABLEADO |
| `panel fetch('/api/…')` → nginx → `api:3000` | `api.ts` fetches relativos | `nginx.conf` (también **sobrescribe** XFF, fix CR-02) | CABLEADO |
| `.env WATCHBUG_PROJECT_KEY` → seed → lookup `X-Project-Key` → e2e + curl onboarding | `boot/seed.ts` `onConflictDoNothing` | misma clave leída por ambos | CABLEADO |
| `.env WATCHBUG_TRUST_PROXY` → `readTrustProxy` → `trustProxy` → identidad del limitador por IP | XFF sobrescrito por nginx → primer hop no confiable | filas CR-02 | CABLEADO |

---

## 8. Comprobaciones puntuales de comportamiento

| # | Comportamiento | Resultado | Estado |
|---|---|---|---|
| 1 | Arranque en frío con orden por healthcheck | db → healthy → api, en orden | ✓ PASS |
| 2 | Build de todos los workspaces | exit 0, esquema re-emitido idéntico | ✓ PASS |
| 3 | Typecheck | exit 0 | ✓ PASS |
| 4 | Carriles de tamaño + impresión del peor caso | PASS, `45+25+14 = 84 KB > 80 KB` | ✓ PASS |
| 5 | Compose 3 servicios, volumen api-only | PASS | ✓ PASS |
| 6 | Suite e2e completa | **132/132** | ✓ PASS |
| 7 | Clave desconocida → 401 uniforme, nada almacenado | 401 uniforme; lista sin cambios | ✓ PASS |
| 8 | `meta` ausente → 400 nombrando el campo | 400 estructurado | ✓ PASS |
| 9 | `Content-Length` 9 MB → 413 con el texto de pre-lectura (fix linger) | 413 correcto | ✓ PASS |
| 10 | Contenedor del API no privilegiado (WR-06) | `uid=1000(node)` | ✓ PASS |

**Efectos secundarios declarados:** las sondas 7–9 son rutas de fallo que no almacenan nada — el conteo de la lista fue idéntico antes y después. Ningún fichero del repo modificado.

---

## 9. Escaneo de anti-patrones

| Alcance | Patrón | Resultado |
|---|---|---|
| Todo el código de la fase | `TBD`/`FIXME`/`XXX` | **Ninguno** |
| Mismo alcance | `TODO`/`HACK`/`PLACEHOLDER` | Solo los tres *mensajes/guardas* de placeholder-key (comportamiento correcto, no stubs) |
| `apps/panel/src` | `dangerouslySetInnerHTML`/`innerHTML` | **0 ocurrencias** (también asertado por fila de suite) |
| Manifiestos | `jest`/`vitest`/`mocha`/`ava`, `dotenv`, `zod-to-json-schema` | **Ninguno** (R-12/STACK) |
| `apps/api/src`, `packages/sdk/src`, `scripts` | `Math.random` | **Ninguno** (la aleatoriedad es `crypto.randomBytes`) |
| panel/API/SDK | destinos de red a terceros | Ninguno (Prohibición P3) |

---

## 10. Estrategia de validación (Nyquist)

> **Política R-12 (del propietario, enunciada dos veces):** «NO HAGAS UN MONTÓN DE TESTS. Solo los e2e necesarios, no tests unitarios.» No hay suite unitaria, ni tests por función, ni umbrales de cobertura. Los dos artefactos de la superficie de verificación son `npm run check:size` y **una** suite Playwright (`npm run verify`, CA-01…CA-05 en chromium + firefox + webkit).

| Propiedad | Valor |
|---|---|
| Framework | `@playwright/test` 1.63.0 (solo e2e — R-12) |
| Config | `playwright.config.ts` — 3 proyectos: chromium + firefox + webkit |
| Comando rápido | `npm run check:size` |
| Comando de suite completa | `npm run verify` |
| Duración observada | ~4,5 min (123 tests × 3 navegadores; incluye la espera de 65 s de la cuota diaria ING-05) |

**Tasa de muestreo:** `check:size` tras cada commit de tarea; `verify` tras cada ola; suite verde antes de `/gsd-verify-work`; latencia máx. de feedback 120 s (presupuesto por tarea).

**Mapa requisito → test (los 11 asertos W0):** cada requisito (DEP-01/02, ENR-06, ING-01/03…08, RNF-01/CA-03) tiene una fila `W0-<REQ>` verde en `npm run verify` o en `check:size`/`check:compose`. Ver §5.

**Verificaciones solo manuales:**

| Comportamiento | Por qué manual | Instrucciones |
|---|---|---|
| `docker-compose up` arranca api+panel+db desde un checkout limpio con solo `.env` copiado | El bootstrap de contenedores depende del entorno | `cp .env.example .env && docker-compose up -d` y abrir el panel |

**Auditoría de validación 2026-10-12:** requisitos en el mapa: 11; carencias (MISSING + PARTIAL): **0**; resueltas: 0; escaladas a manual-only: 0 nuevas; filas verdes: 11/11. No se spawneó auditor ni se generaron tests porque no había carencias y R-12 prohíbe añadir tests más allá de la suite única.

---

## 11. Hallazgos de revisión resueltos desde el informe previo

- **Los 8 hallazgos críticos/warning están CORREGIDOS** (CR-01, CR-02, WR-01…WR-06) con evidencia RED→GREEN comprometida y presentes en el código actual. La suite ganó 3 filas de regresión (`hostile.spec:764/800/814`), verdes. Ver `01-REVIEW.md`.
- **Fix de linger de la pre-lectura ING-06** (`ed20ec3`): la sonda P-C confirmó que el 413 de pre-lectura ahora sobrevive con su texto.
- **Aún abiertos (info, fuera del alcance `critical_warning`):** IN-01…IN-05 (ver `01-REVIEW.md`).
- **Riesgo aceptado AR-02** (`01-SECURITY.md`): un cliente a plena velocidad puede perder el 413 ante reset de socket; el cuerpo sigue rechazado; aceptado, no reabierto.
- **`01-SECURITY.md`:** `threats_open: 0`, 18/18 cerradas, `verified`.

**Elementos arrastrados:** `deferred-items.md` — 4 avisos `npm audit` dev-only en la cadena esbuild de `drizzle-kit`; re-pin de la imagen Node 24 tras 2026-10-20; `package-lock` a mano.

---

## 12. Verificación humana

**Ninguna pendiente.** Los 4 ítems del informe previo se completaron en `01-UAT.md` (2026-10-13, **4/4 pass, 0 issues**):

1. Reinicio del compose tras arranque interrumpido — pass.
2. Ráfaga paralela sobre un límite por clave pequeño — pass.
3. Ergonomía del primer arranque desde checkout limpio — pass.
4. Comprobación visual del panel (dos columnas, tokens light/dark, selector de idioma, estado vacío) — pass.

---

## 13. Resumen de carencias

**Sin carencias.** Las 40 verdades son VERIFICADAS; todos los artefactos existen, son sustantivos, están cableados y con datos fluyendo; los 6 enlaces clave están cableados; los 10 requisitos están satisfechos sin huérfanos; las 3 prohibiciones verificadas; sin marcadores de deuda, sin stubs, sin dependencias prohibidas. El objetivo de la fase está observablemente alcanzado. **Estado: `passed`.**

---

## 14. Cobertura de API externa

No hay integración de API externa en esta fase: construye la propia API de ingesta (`POST /api/incidents`) y el panel de Watchbug. Solo se consume `fetch`/`getDisplayMedia` del navegador, a partir de las fases posteriores del SDK. El detector disparó sobre el término de superficie `sdk` en la cabecera del ROADMAP — el propio nombre del producto, no una integración de terceros. Sin matriz de capacidades para esta fase.

---

## 15. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-12 / M-2** | Puntos del registro ligados al gate de tamaño multi-artefacto |
| **CA-0x** | Criterio de Aceptación del proyecto |
| **C-3 / C-4** | Clases de peligro: C-3 XSS/inyección en render; C-4 path traversal / ficheros |
| **CR-xx / WR-xx / IN-xx** | Hallazgos de revisión: crítico / warning / info |
| **DEP-0x** | Requisito de despliegue (*deployment*) |
| **e2e** | *End-to-end* (prueba de extremo a extremo) |
| **ENR-06** | Requisito de enriquecimiento: validar contra el esquema JSON único |
| **ING-0x** | Requisito de ingesta (*ingest*) |
| **INV-0x** | Invariante arquitectónico no negociable |
| **MISSING / PARTIAL** | Estados de carencia de validación (falta / parcial) |
| **MVP** | *Minimum Viable Product* |
| **Nyquist** | Estrategia de muestreo que exige cobertura de cada requisito |
| **P1-D-xx** | Decisión de implementación local de la Fase 1 |
| **P-A / P-B / P-C** | Sondas en vivo de la verificación (401 / meta ausente / 413 pre-lectura) |
| **R-08 / R-12 / R-18** | Reglas del registro: `url` sin query; verificación e2e; DRY de constantes |
| **RED / GREEN** | Fases de TDD: prueba que falla / implementación que la hace pasar |
| **RNF-01** | Requisito no funcional: presupuesto de tamaño por capas |
| **SC** | *Success Criterion* (criterio de éxito del ROADMAP) |
| **SEC-05** | Requisito de seguridad: saneado XSS + rate limiting |
| **TFG** | Trabajo Fin de Grado |
| **TTL** | *Time To Live* (vida útil antes de purga) |
| **UAT** | *User Acceptance Testing* (pruebas de aceptación de usuario) |
| **W0** | Fila de verificación del artefacto Wave 0 que prueba un requisito |
| **XFF** | `X-Forwarded-For` (cabecera de IP reenviada) |
