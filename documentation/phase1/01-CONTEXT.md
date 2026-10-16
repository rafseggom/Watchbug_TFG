<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 1 — Contexto: *Contracts & Ingest Slice*

| | |
|---|---|
| **Fase** | 1 — *Contracts & Ingest Slice* |
| **Rama** | `gsd/phase-1-contracts-ingest` (PR contra `develop`) |
| **Contexto recogido** | 2026-10-11 |
| **Estado** | Listo para planificación → ejecutado (ver `01-SUMMARY.md`) |
| **Requisitos en alcance** | DEP-01, DEP-02, ENR-06, ING-01, ING-03…ING-08 (10) |

> Este documento consolida y resume el `01-CONTEXT.md` de planificación. Es un resumen ejecutivo, no una copia literal.

---

## 1. Frontera de la fase

Un desarrollador puede **arrancar el stack auto-hospedado** (`api` + `panel` + `db`, un solo `docker compose up`) y **empujar un reporte sintético** — imagen + metadatos — por la red hacia un **almacenamiento endurecido y validado por esquema** que se renderiza en un panel mínimo.

El contrato oficial único (`packages/contracts` → `schema/report.schema.json`), el **conjunto de constantes vinculante (A-06)** y la **puerta de tamaño** (`check:size`) existen desde el día uno.

### Fuera de esta fase (según ROADMAP)

- Autenticación / CRUD de proyectos → **Fase 5**
- El widget y el SDK reales → **Fase 2**
- Compositor / anotación → **Fase 3**
- Enriquecimiento de consola + entorno → **Fase 4**
- Acciones de triage y purga TTL → **Fase 6**
- Cola de durabilidad idempotente → **Fase 7**

---

## 2. Requisitos en alcance

| ID | Descripción | Ola |
|----|-------------|-----|
| **DEP-01** | Un `docker compose up` arranca API + panel + BD (INV-03) | 01-01 |
| **DEP-02** | Toda configuración del servidor desde `.env` documentado en `.env.example` (SEC-04) | 01-01 |
| **ENR-06** | Cada reporte valida contra el esquema JSON único publicado (CA-01) | 01-01 |
| **ING-01** | Un reporte (imagen + metadatos) llega al backend por HTTP | 01-01 |
| **ING-03** | Un reenvío reintentado no crea un reporte duplicado | 01-01 |
| **ING-04** | La API rechaza la ingesta sin una project key válida | 01-03 |
| **ING-05** | La API limita por IP y por project key (SEC-05) | 01-03 |
| **ING-06** | La API rechaza cuerpos e imágenes sobredimensionados | 01-02 |
| **ING-07** | La API sanea todo texto del usuario antes de almacenar y de renderizar (SEC-05) | 01-04 |
| **ING-08** | La API solo acepta ingesta desde orígenes en allowlist | 01-03 |

---

## 3. Decisiones de implementación (P1-D-01…P1-D-12)

> Los IDs locales van prefijados `P1-D-` para no colisionar con el registro global `D-01…D-08` de `documentation/resolution-record.md`.

### 3.1 Origen del project key (fase sin auth)

| ID | Decisión | Reversibilidad |
|----|----------|----------------|
| **P1-D-01** | Clave válida vía **seed idempotente desde `.env`**: `.env.example` documenta `WATCHBUG_PROJECT_KEY`; el arranque del API crea la fila `projects` si no existe. La e2e lee la misma variable → determinista. El CRUD real llega en Fase 5. | reversible |
| **P1-D-02** | Si la variable falta o es placeholder → **fail-fast al arrancar** con mensaje que indica exactamente qué falta en `.env`. Nunca una clave predecible en producción (SEC-04, "fail loud"). | reversible |
| **P1-D-03** | Formato: **`wkbt_` + 32 bytes aleatorios en base62 (≈190 bits)**, generada con `crypto`. Prefijo identificable para logs/secret-scanners y rotación futura. | costosa |

### 3.2 Aspecto del panel mínimo

| ID | Decisión | Reversibilidad |
|----|----------|----------------|
| **P1-D-04** | Estructura **lista + panel de detalle en dos columnas** (lista a la izquierda, imagen grande + metadatos a la derecha). Es la forma final del triage de Fase 6 → Fases 5/6 solo añaden filtros/estados/acciones. | costosa |
| **P1-D-05** | Idioma por defecto: **auto-detectar `navigator.language`** (`es*` → español, resto → inglés) + selector manual persistido en `localStorage` del panel (RNF-03; no toca SEC-03). | reversible |
| **P1-D-06** | Base visual: **tokens CSS (color/spacing/tipografía) con `prefers-color-scheme` light/dark desde la Fase 1**, sin estilos hardcodeados. | costosa |
| **P1-D-07** | Estado vacío = **snippet `curl` listo para copiar, pre-rellenado con el project key real** (pega → ejecuta → recargas → ves el reporte). El estado vacío es el onboarding del producto. | reversible |

### 3.3 Plan B de `@fastify/multipart` (UNVERIFIED ↔ Fastify 5)

| ID | Decisión | Reversibilidad |
|----|----------|----------------|
| **P1-D-08** | Orden si el smoke-test falla: **1)** otra versión del plugin sin tocar el contrato; **2)** parser multipart propio (boundary + streams); **3)** JSON+base64 **solo con consulta expresa** (cambio de CA-01 = trigger de consulta). | reversible |
| **P1-D-09** | El smoke-test de multipart es el **primer trabajo de la fase**, antes del endpoint de ingesta: commit mínimo que arranca Fastify y parsea un `FormData` de prueba. | reversible |

### 3.4 Profundidad del hardening C-4

| ID | Decisión | Reversibilidad |
|----|----------|----------------|
| **P1-D-10** | **Re-encode obligatorio en servidor**: cada imagen se re-codifica de raíz antes de escribir a disco (mata políglotos y EXIF), además del sniff de magic bytes, los headers endurecidos de la ruta de blob y el anti decode-bomb (≤16 MP). ⚠ **Cualquier dependencia pesada nueva se consulta al propietario antes de añadirla.** | costosa |
| **P1-D-11** | Allowlist de formatos: **solo PNG + WebP**. JPEG se reconsidera en Fase 3; SVG rechazado incondicionalmente. | reversible |
| **P1-D-12** | Formato de salida tras el re-encode: **mismo formato de entrada** (PNG→PNG, WebP→WebP). | reversible |

**Discreción del agente:** ninguna área quedó como "tú decides". Latitud técnica libre para el investigador/planificador en: mecanismo exacto de seed, forma del esquema Drizzle, descomposición de ficheros/planes, detalles del proxy nginx (A-10) y la estructura concreta de las aserciones e2e de CA.

---

## 4. Referencias canónicas

| Área | Documento | Qué aporta |
|------|-----------|------------|
| Alcance y aceptación | `.planning/ROADMAP.md` § Fase 1, `.planning/REQUIREMENTS.md` | Goal, 5 criterios de éxito, definiciones de requisitos |
| Decisiones e invariantes | `documentation/resolution-record.md` | A-06 (constantes), A-09 (pins), A-10 (proxy nginx `/api`), A-12/M-2 (`check:size` multi-artefacto), R-12, R-13, R-15, R-17 |
| Invariantes y gates | `documentation/mentorship-pack.md` | INV-01..03, SEC-01..06, RNF-01 |
| Objetivo y no-objetivos | `documentation/mission-brief.md` | Goal, "Declarar el NO", envelope de autonomía |
| Política de rama | `documentation/continuity-pack.md` §6.5–§6.6 | Rama por fase + PR contra `develop` con `Closes #N` |
| Evidencia de investigación | `.planning/research/{ARCHITECTURE,STACK,SUMMARY,PITFALLS}.md` | Forma del wire, pins verificados, constantes de retry/dedup, peligros C-3/C-4/H-7/H-9 |
| Punto de entrada | `AGENTS.md` | Marco C-B-D-C, triggers de consulta, comandos |

---

## 5. Estado del código (greenfield)

- **Sin activos reutilizables:** el repositorio contiene solo documentación de planificación. No existe `packages/`, `apps/` ni código fuente. Esta fase crea el esqueleto del monorepo que construyen todas las fases posteriores.
- **Patrón de layout fijado por R-15/STACK.md:** npm workspaces con `packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel`. La Fase 1 crea los cuatro armazones (el SDK queda vacío de comportamiento hasta la Fase 2).
- **Patrón de verificación (R-12):** una suite Playwright mapeada 1:1 a CA-01…CA-05 + `npm run check:size`. **Sin tests unitarios, sin umbrales de cobertura — nunca.**
- **Puntos de integración:** `packages/contracts` emite `schema/report.schema.json`; `apps/api` implementa el primer *seam* servidor (`Storage`); `apps/panel` consume la API vía el proxy nginx `/api` (A-10, base same-origin para cookies de Fase 5); `docker-compose.yml` con exactamente tres servicios (INV-03) + aserción CI de que el volumen de blobs solo monta en `api` (C-4).

---

## 6. Ideas específicas y elementos diferidos

**Específicas:**
- **El estado vacío como onboarding:** la pantalla "sin reportes aún" es la primera experiencia del producto — un `curl` copiable con el project key real.
- **Panel de dos columnas desde el día uno:** elegido deliberadamente para que Fases 5/6 extiendan el mismo layout sin rediseñar.
- **Secuenciación risk-first:** el smoke-test de multipart es deliberadamente el primer commit de la fase.

**Diferidos:**
- Soporte JPEG en la allowlist — revisar en Fase 3 junto a `ManualFileCapture` (A-05).
- Panel y ruta de blob autenticados — el "servido solo a través de la API autenticada" (DEP-03) se completa en Fase 5; esta fase no hace ninguna afirmación de auth.
- Ninguna área marcada "el agente decide"; ningún todo casó con la fase (`todo.match-phase 1` → 0).

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|-------|-------------|
| **A-0x** | Amendment del registro de decisiones (`documentation/resolution-record.md`) |
| **CA-0x** | Criterio de Aceptación del proyecto (contract/acceptance criterion) |
| **C-B-D-C** | Contract → Bound → Delegate with Evidence → Converge & Record (marco de control ASE) |
| **C-3 / C-4** | Clases de peligro: C-3 XSS/inyección en render; C-4 path traversal / ficheros |
| **D-0x** | Decisión global del registro (`resolution-record.md`) |
| **DEP-0x** | Requisito de despliegue (deployment) |
| **e2e** | End-to-end (prueba de extremo a extremo) |
| **ENR-0x** | Requisito de enriquecimiento (enrichment) |
| **H-7 / H-9** | Peligros identificados en la investigación (H-7 abuso de ingesta; H-9 límites de transporte) |
| **ING-0x** | Requisito de ingesta (ingest) |
| **INV-0x** | Invariante arquitectónico no negociable |
| **M-1 / M-2** | Puntos del registro ligados a retención (M-1) y al gate de tamaño (M-2) |
| **P1-D-xx** | Decisión de implementación local de la Fase 1 |
| **R-xx** | Decisión/regla del registro global |
| **RF-xx** | Requisito funcional (Product Requirements Document) |
| **RNF-xx** | Requisito no funcional |
| **SEC-0x** | Requisito de seguridad |
| **TFG** | Trabajo Fin de Grado |
| **TTL** | Time To Live (vida útil de datos antes de purga) |
| **UAT** | User Acceptance Testing (pruebas de aceptación de usuario) |
