<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Documento 1 — Informe de cobertura de requisitos (GAP Analysis)

| | |
|---|---|
| **Proyecto** | Watchbug SDK |
| **Fecha de auditoría** | 2026-11-03 |
| **Fuente de verdad** | `.planning/` exclusivamente |
| **Universo auditado** | 70 requisitos v1 · 5 criterios de aceptación (CA-01…CA-05) · 6 historias de usuario (US-1…US-6) · 7 fases · 34 criterios de éxito de fase |
| **Fases cerradas** | Fase 1 (2026-10-13), Fase 2 (2026-10-25) y Fase 3 (2026-11-03) |
| **Fase en curso** | Fase 4 — *Report Payload & Enrichment* (en planificación, 0 planes) |
| **Estado global declarado** | 41/70 requisitos completos (58,6 %) · 15/34 criterios de fase · 2/5 CA completos |
| **Estado observado** | 4 requisitos más con evidencia parcial fuera de fase (RET-01, RET-02, RET-03, DEP-03) |
| **Modo** | Auditoría documental. No se ha leído, ejecutado ni inferido código fuente. |

---

## 0. Resumen ejecutivo

| Indicador | Valor | Lectura |
|---|---:|---|
| Requisitos v1 completos | **41 / 70 (58,6 %)** | Fases 1–3 cerradas; fases 4–7 sin empezar |
| Requisitos pendientes | **29 / 70 (41,4 %)** | 25 sin evidencia de implementación y 4 con evidencia parcial adelantada |
| Criterios de éxito de fase cumplidos | **15 / 34 (44,1 %)** | 5 de Fase 1 + 5 de Fase 2 + 5 de Fase 3; 19 pendientes |
| Criterios de aceptación globales | **2 completos, 2 parciales, 1 no cumplido** | CA-02 y CA-04 completos; CA-01 y CA-03 parciales; CA-05 no cumplido |
| Historias de usuario | **2 completas, 3 parciales, 1 no iniciada** | US-1 y US-3 completas; US-5 no iniciada |
| Fases con plan y verificación | **3 / 7** | Fases 4–7 no tienen `PLAN.md` ni `VERIFICATION.md` |
| Deuda documental detectada | **9 contradicciones o ambigüedades relevantes** | Ver §7; se detallan en el Documento 3 |

**Conclusión de una frase:** el proyecto ha cerrado de forma verificable el **camino del reportero** (captura, anotación, enmascarado destructivo, revisión, envío e ingesta endurecida) y el **despliegue base**, pero todavía no ha construido el **camino del desarrollador** (autenticación, proyectos, triaje, retención) ni el **cierre de resiliencia y release**.

### Hallazgos principales

1. **La Fase 3 cierra el núcleo del producto.** Con 74/74 *must-haves* verificados, 7/7 UAT y 90 filas e2e agrupadas en 14 *journeys*, el flujo US-1/US-3 (capturar → anotar → enmascarar → revisar → enviar) está completo y probado a nivel de artefacto.
2. **CA-02 y CA-04 son los dos únicos criterios globales plenamente demostrados.** CA-01 queda a medias porque la cláusula «consoleLogs obligatorio para bug» pertenece a Fase 4; CA-03 queda a medias porque el presupuesto de tamaño está cerrado pero la caída Lighthouse ≤ 2 puntos es PRF-05/Fase 7.
3. **CA-05 no se cumple hoy.** No existe autenticación de panel: todas las rutas de lectura siguen abiertas. El roadmap lo difiere a Fase 5 y la propia Fase 1 lo declara fuera de alcance, pero el criterio global sigue rojo.
4. **DEP-03 está transitoriamente incumplido.** La ruta de blobs endurecida existe desde Fase 1, pero «servida solo a través de la API autenticada» no puede ser cierto hasta Fase 5. Es una desviación declarada, no un olvido.
5. **La retención tiene trabajo adelantado no verificado.** La quick task `261014-m3v` implementó la purga TTL (RET-01/RET-02) y `261014-m3w` protegió la superficie de lectura, pero el propio SUMMARY declara `requirements-completed: []` y difiere la prueba con pila real. El estado oficial de RET-01/02/03 sigue «Pending».
6. **Las fases 4–7 son intención, no plan.** Existen objetivos y criterios de éxito en `ROADMAP.md`, pero no hay `PLAN.md`, ni matriz requisito→test, ni criterios operacionalizados. Es la mayor laguna de cobertura del proyecto.

---

## 1. Método, fuentes y límites

### 1.1 Fuentes utilizadas

| Fuente | Uso en este informe |
|---|---|
| `.planning/REQUIREMENTS.md` | Universo de 70 requisitos, 5 CA, 6 US, trazabilidad declarada y *Definition of Done* |
| `.planning/ROADMAP.md` | Fases, objetivos, criterios de éxito (SC), dependencias, riesgos y estado de planes |
| `.planning/STATE.md` | Estado real de transición, decisiones acumuladas, bloqueos y deuda conocida |
| `.planning/WINDOWS.md` | Registro de defectos cross-fase; `open_count: 0`, 9 ventanas corregidas |
| `.planning/phases/01…03/**` | `PLAN`, `SUMMARY`, `VERIFICATION`, `UAT`, `COVERAGE`, `CONTEXT` y ledger de conversión |
| `.planning/quick-batches/261014-m3u/**` | Trabajo adelantado fuera de fase (purga TTL, superficie de lectura, CSP, path-only) |

### 1.2 Reglas de conteo

- **Requisito completo:** marcado `[x]` en `REQUIREMENTS.md` **y** respaldado por una `VERIFICATION.md` de fase con *must-haves* veredictados.
- **Requisito parcial:** existe implementación documentada, pero no hay verificación de aceptación de fase o falta una condición del enunciado.
- **Requisito pendiente:** sin evidencia de implementación en `.planning`.
- **Criterio de fase:** cada fila «Success Criteria» de `ROADMAP.md` § Phase Details. Se cuentan 5+5+5+5+5+5+4 = **34**.
- **CA global:** los cinco criterios de `REQUIREMENTS.md` § Acceptance Criteria. No se confunden con los criterios de fase.

### 1.3 Límites

- No se ha inspeccionado código, base de datos, contenedores ni artefactos de build. Todas las afirmaciones son **documentales**.
- Los números de suite se toman de `VERIFICATION.md`, `UAT.md` y `03-08-CONVERSION-LEDGER.md`; no se han re-ejecutado.
- Cuando `.planning` contiene dos afirmaciones incompatibles, se señalan ambas y se marca la contradicción; no se resuelve por preferencia del auditor.
- La quick task `261014-m3v` declara verificación diferida; por tanto, su implementación **no** se eleva a «completa».

---

## 2. Inventario y estado global

### 2.1 Requisitos por fase

| Fase | Nombre | Requisitos | Completos | Pendientes | Planes | Estado |
|---|---|---:|---:|---:|---:|---|
| 1 | Contracts & Ingest Slice | 10 | **10** | 0 | 4/4 | ✅ Cerrada 2026-10-13 |
| 2 | SDK Tracer Bullet: Widget, Capture & Auto-Redaction | 18 | **18** | 0 | 5/5 | ✅ Cerrada 2026-10-25 |
| 3 | Report Composer & Annotation Editor (lazy) | 13 | **13** | 0 | 8/8 | ✅ Cerrada 2026-11-03 |
| 4 | Report Payload & Enrichment | 7 | 0 | **7** | 0/TBD | ⏳ En planificación |
| 5 | Secure Admin Access & Projects | 9 | 0 | **9** | 0/TBD | ⬜ No iniciada |
| 6 | Triage & Data Lifecycle | 10 | 0 | **10** | 0/TBD | ⬜ No iniciada |
| 7 | Resilience & Release Closeout | 3 | 0 | **3** | 0/TBD | ⬜ No iniciada |
| **Total** | | **70** | **41** | **29** | **17/17 cerradas** | **43 % de fases** |

### 2.2 Criterios de aceptación globales

| ID | Propiedad | Estado observado | Justificación documental |
|---|---|---|---|
| **CA-01** | Todo reporte enviado valida contra el esquema JSON oficial; `consoleLogs` obligatorio en `bug`, opcional en `feedback` | 🟡 **Parcial** | La validación de esquema está cerrada (ENR-06, Fase 1). La cláusula condicional de `consoleLogs` se completa en Fase 4 (ENR-01/02). `ROADMAP.md` lo dice expresamente en la justificación de Fase 1 |
| **CA-02** | Píxeles enmascarados sustituidos por relleno opaco plano, irreversible, antes de codificar | ✅ **Completo** | T1 en Fase 2 + T2/T3 en Fase 3; prueba a nivel de bytes decodificados con anillo de 1 px, tinta posterior y matriz DPR. `03-UAT.md` mide relleno 100 % `rgb(0,0,0)` α255 sobre 84 000 px |
| **CA-03** | Distribuible ≤ 45 KB gz; caída Lighthouse ≤ 2 puntos | 🟡 **Parcial** | Tamaño cerrado en Fase 3 (core 17,2/45 · lazy 6,8/25 · runtime 24,4/80). Lighthouse/PRF-05 es Fase 7 y no tiene método definido |
| **CA-04** | CSS hostil no altera visibilidad ni layout del widget | ✅ **Completo** | J-14: matriz de CSS hostil con control no vacuo, 5 variantes + bundle cerrado, 3 motores. `02-VERIFICATION.md` SC-2 y `03-VERIFICATION.md` |
| **CA-05** | Toda petición no autenticada a rutas de panel devuelve 401 | 🔴 **No cumplido** | No existe autenticación hasta Fase 5. La superficie de lectura se protegió con rate limit y paginación (quick `261014-m3w`), no con auth |

### 2.3 Historias de usuario

| US | Descripción | Estado | Motivo |
|---|---|---|---|
| **US-1** | Reportero captura, anota, enmascara y envía | ✅ Completa | Fases 2–3, 14 journeys, UAT real-picker |
| **US-2** | Reportero envía sugerencia sin logs ni captura obligatorios | 🟡 Parcial | El envío text-only existe (CAP-03, Fase 3), pero la semántica `feedback` sin logs es Fase 4 (ENR-02) |
| **US-3** | Reportero revisa y edita antes de enviar; sus datos sensibles no salen | ✅ Completa | PRV-07 + T1/T2/T3 + revisión del artefacto exacto (Fase 3) |
| **US-4** | Desarrollador integra con un script tag sin coste medible | 🟡 Parcial | Script tag, ESM y widget funcionan; «sin coste medible» exige PRF-05/Lighthouse (Fase 7) |
| **US-5** | Desarrollador entra en su panel y triaja reportes | ⬜ No iniciada | Fases 5 y 6 |
| **US-6** | Desarrollador ejecuta todo en su infraestructura, sin fuga de datos | 🟡 Parcial | `docker compose` y auto-hosting funcionan (Fase 1), pero retención, borrado y backup no están cerrados (Fases 6–7) |

---

## 3. Lo que se ha hecho

> Esta sección desglosa, fase por fase, los requisitos y criterios cubiertos. No repite el detalle de implementación: cita la evidencia documental que lo sostiene.

### 3.1 Fase 1 — Contracts & Ingest Slice (cerrada 2026-10-13)

**Objetivo:** arrancar la pila autohospedada y hacer cruzar un reporte (imagen + metadatos) por la red hasta almacenamiento endurecido y validado por esquema, visible en un panel mínimo.

| Requisito | Estado | Evidencia |
|---|---|---|
| DEP-01 | ✅ | `docker compose up -d --build` observado; exactamente 3 servicios; `/api/health` OK |
| DEP-02 | ✅ | `.env.example` completo; fail-fast con variable nombrada; defaults 30/90/10/30/2000 |
| ENR-06 | ✅ | Reporte almacenado validado contra `schema/report.schema.json`; emisión byte-idéntica |
| ING-01 | ✅ | POST 201, fila en BD, imagen en volumen, render en panel |
| ING-03 | ✅ | Misma `Idempotency-Key` → 200 con mismo id y una sola fila; índice único DB |
| ING-04 | ✅ | Clave ausente/desconocida/malformada → 401 uniforme, sin oráculo, sin escritura |
| ING-05 | ✅ | Límites por clave/IP/día, 429 + `Retry-After`, frontera inclusiva y concurrencia |
| ING-06 | ✅ | 5 MB cuerpo / 4 MB parte / 2 MB codificado; pre-lectura + contador de streaming |
| ING-07 | ✅ | Sanitización en ingesta, texto plano preservado, render inerte en panel |
| ING-08 | ✅ | Allowlist de `Origin`; 403 sin escritura; sin `Origin` aceptado |

**Criterios de éxito de fase: 5/5.**

| SC | Criterio | Estado |
|---|---|---|
| 1 | Arranque con un `docker-compose up` y configuración desde `.env.example` | ✅ |
| 2 | Reporte sintético → fila + imagen en volumen + panel mínimo | ✅ |
| 3 | Validación contra esquema y idempotencia exacta | ✅ |
| 4 | Rechazo de envíos hostiles (401/413/429/400) y texto inerte | ✅ |
| 5 | Throttling por clave/IP/día y allowlist de orígenes | ✅ |

**Criterios globales cubiertos:** CA-01 solo en su mitad de esquema (ENR-06). No se reclama CA-02/03/04/05.

**Evidencia de cierre:** `01-VERIFICATION.md` 40/40 *must-haves*, 132/132 e2e, `check:size` PASS, `check:compose` PASS, `01-UAT.md` 4/4, `01-SECURITY.md` `threats_open: 0`, `WINDOWS.md` 9/9 corregidas.

**Límites y desviaciones declaradas:**
- `DEP-03` no se reclama: la ruta de blobs está endurecida, pero la autenticación llega en Fase 5.
- La cláusula de `consoleLogs` de CA-01 no se reclama: llega en Fase 4.
- La prueba de concurrencia de rate limit se cerró por UAT humano, no por aserción automatizada.

---

### 3.2 Fase 2 — SDK Tracer Bullet: Widget, Capture & Auto-Redaction (cerrada 2026-10-25)

**Objetivo:** abrir el widget en cualquier página, capturar la pestaña con datos sensibles enmascarados destructivamente antes de que nada salga del navegador y archivar el reporte en el panel.

| Requisito | Estado | Evidencia |
|---|---|---|
| INT-01 | ✅ | Un `<script async>` arranca `window.Watchbug`; build IIFE |
| INT-02 | ✅ | `init({ projectKey })` monta lanzador y flujo; reporte real 201 |
| INT-05 | ✅ | Build ESM arranca el mismo widget; cero propiedades añadidas a `window` |
| WDG-01 | ✅ | Lanzador 48×48 en Shadow DOM; clic inicia flujo |
| WDG-02 | ✅ | Matriz de CSS hostil con control; no oculta/reescribe/rompe |
| WDG-03 | ✅ | Cero fugas de estilos, clases o custom properties al documento host |
| WDG-04 | ✅ | Exactamente un global; prototipos nativos intactos |
| WDG-05 | ✅ | Gana el concurso de apilamiento; z-index, DOM order y re-apendizado |
| CAP-01 | ✅ | Gesto → `getDisplayMedia` → frame no blanco → 201 |
| CAP-04 | ✅ | Host oculto antes de capturar; píxeles del widget ausentes del artefacto |
| CAP-05 | ✅ | ≤16 MP, ≤2 MB, DPR clamp 2, HiDPI no blanco |
| PRV-01 | ✅ | `input[type=password]` enmascarado en rect completo, artefacto decodificado |
| PRV-02 | ✅ | JWT, Bearer, asignaciones `key=/token=/secret=/password=`, tarjetas Luhn |
| PRV-03 | ✅ | `data-watchbug-sensitive` enmascarado a rect completo |
| PRV-05 | ✅ | Centinelas en cookies/storage/auth no aparecen en la petición |
| PRV-06 | ✅ | `meta.url` solo path; query y fragmento eliminados |
| PRF-01 | ✅ | Core 9,3/45 KB gz |
| PRF-04 | ✅ | Cero dependencias npm de runtime; contracts solo tipos |

**Criterios de éxito de fase: 5/5.** `02-VERIFICATION.md` 38/38 *must-haves*, 315/315 e2e, `check:size` PASS, `gate.mjs` 3/3, `02-UAT.md` 5/5.

**Criterios globales cubiertos:** CA-04 completo; CA-02 en su capa T1 (auto-redacción); CA-03 en su mitad de tamaño. No se reclama CA-01 (console), CA-05 (auth) ni la capa T2/T3 de CA-02 (se completó en Fase 3).

**Límites declarados:**
- No hay revisión antes de enviar: el flujo es one-shot; PRV-07 es Fase 3.
- La captura en blanco se detecta con sonda de uniformidad; una página real y dispersa expuso un falso positivo que se corrigió y se cubrió con regresión.
- El fallback WebP→PNG no se reproduce de forma natural en WebKit de esta plataforma (A-14); se cubre con stub forzado a PNG.

---

### 3.3 Fase 3 — Report Composer & Annotation Editor (lazy) (cerrada 2026-11-03)

**Objetivo:** componer un reporte completo o feedback plano, capturar o adjuntar, anotar, enmascarar destructivamente, revisar y enviar, con editor lazy y UI EN/ES.

| Requisito | Estado | Evidencia |
|---|---|---|
| CAP-02 | ✅ | Adjuntar PNG/WebP/JPEG; mismo flujo; rechazo de no-imagen y oversize |
| CAP-03 | ✅ | Estado degradado con dos salidas; text-only llega a 201 real; panel sin `<img>` roto |
| ANN-01 | ✅ | Mano alzada sigue el trazo |
| ANN-02 | ✅ | Flecha con eje y cabeza más ancha |
| ANN-03 | ✅ | Rectángulo con cuatro bordes e interior intacto |
| ANN-04 | ✅ | Texto clic→escribir→Enter; vacío no dibuja; no-ASCII literal |
| ANN-05 | ✅ | Máscara opaca; toggle Relleno/Pixelar; confirmación solo la primera vez |
| ANN-06 | ✅ | Undo por trazo; nunca deshace máscara; Ctrl/Cmd+Z |
| PRV-04 | ✅ | Destrucción de píxeles + anillo; no resucita con tinta; DPR 1/1.25/2/3 |
| PRV-07 | ✅ | Revisión muestra el artefacto exacto; Editar vuelve; Enviar un solo POST |
| WDG-06 | ✅ | Core y editor EN/ES; auto-detección y override; sin storage host |
| PRF-02 | ✅ | Lazy 6,8/25 KB gz con suelo 2 KB; una sola carga |
| PRF-03 | ✅ | Runtime 24,4/80 KB gz sobre artefactos reales |

**Criterios de éxito de fase: 5/5.** `03-VERIFICATION.md` 74/74 *must-haves*, 90 filas e2e / 14 journeys / 279 instancias, 168 tests Vitest (59 unit + 65 integration + 26 contract + 18 packaging), 2 baselines VRT, `03-UAT.md` 7/7.

**Criterios globales cubiertos:** CA-02 completo (T2/T3 + T1); CA-03 en su mitad de tamaño; CA-01 sigue parcial; CA-05 sigue no cumplido.

**Límites y deudas declaradas:**
- `IN-01` (info): Ctrl+Z sigue activo con el diálogo de confirmación de máscara abierto. Sin evidencia de ruptura de integridad.
- `IN-02` (info): el gate de *single encode sink* reporta SKIP si el sink desaparece, hasta el modo STRICT de Fase 7.
- Candidato de endurecimiento abierto: el SDK asume `frame = viewport × DPR` sin guardia de desajuste; una rotura de registro desplazaría máscaras en silencio. Se decide en Fase 4/7.
- El harness de UAT con viewport emulado desplazó las máscaras; no fue defecto de producto. La regla correctiva vive en `continuity-pack.md` §11 / D-11.

---

### 3.4 Trabajo adelantado fuera de fase (quick batches)

| Quick task | Qué adelanta | Requisito afectado | Estado de aceptación |
|---|---|---|---|
| `261014-m3v` | Purga TTL programada: identidad a NULL y borrado de fila + blob | RET-01, RET-02 | ⚠ Implementado, `requirements-completed: []`, prueba con pila real diferida |
| `261014-m3w` | Rate limit de lectura por IP + paginación keyset | Refuerza ING-05/SEC-05, no cierra auth | ✅ Verificado por e2e de la época; sin auth |
| `261014-m3x` | Panel: `AbortSignal`, `try/catch` de JSON, load-more | Calidad/abuso, sin REQ propio | ✅ |
| `261014-m3y` | CSP del panel + R-08 path-only en el contrato | SEC-05, PRV-06 | ✅ |
| `261014-m3z` | `AbortSignal` en API + `sharp` lazy | Calidad/arranque | ✅ |
| `261014-m40` | Conectar `stopthatslop` a CI | Proceso | ❌ Descartado por el propietario |

**Lectura de auditoría:** este trabajo mejora la postura real del sistema, pero **no cambia el estado oficial de las fases 5/6/7**. Un requisito no se considera cerrado por una quick task si no tiene criterio de aceptación de fase, verificación y trazabilidad actualizada.

---

## 4. Lo que NO se ha hecho

> Cada fase pendiente se describe con sus requisitos, sus criterios de éxito y lo que falta para poder considerarla cerrada. No se especula con fechas.

### 4.1 Fase 4 — Report Payload & Enrichment (7 requisitos, 0 planes)

**Requisitos pendientes:** ENR-01, ENR-02, ENR-03, ENR-04, ENR-05, INT-03, INT-04.

| SC | Criterio de éxito | Estado | Qué falta |
|---|---|---|---|
| 1 | Bug siempre con logs; feedback sin logs | ⬜ | Captura de consola, buffer y serialización; contrato condicional |
| 2 | URL, UA, viewport, pantalla, DPR, idioma, timezone, timestamp | ⬜ | `Enricher` y payload cerrado |
| 3 | Buffer acotado, drop-oldest, límites por mensaje/arg/total, «N earlier messages dropped», sin recursión | ⬜ | Anillo de 100 entradas, 2 048/1 024 chars, 8 192 de stack, 48 KB total |
| 4 | `user`, `appVersion`, `custom` de init en cada reporte | ⬜ | Contexto init-scoped; `custom` no es ANN-V2-03 |
| 5 | `privacy: { userIdentity: false }` no deja salir identidad | ⬜ | Sólo identidad aportada por el host; SEC-03 prohíbe descubrirla |

**Riesgos documentados:** C-5 (logs como canal de exfiltración), scrubber de secretos, serialización eager, nunca `document.referrer`, grep gate de `document.cookie|localStorage|sessionStorage|Authorization|Bearer |credentials:`.

**Cobertura de pruebas actual:** 0. No hay `04-*-PLAN.md`, ni filas e2e, ni tests unit/integration para esta fase. La suite vigente no puede probar ENR-01…05 ni INT-03/04.

### 4.2 Fase 5 — Secure Admin Access & Projects (9 requisitos, 0 planes)

**Requisitos pendientes:** TRI-01, TRI-02, TRI-03, PRJ-01, PRJ-02, PRJ-03, PRJ-04, PRJ-05, DEP-03.

| SC | Criterio de éxito | Estado | Qué falta |
|---|---|---|---|
| 1 | Login con credenciales de `.env`, cookie JWT, logout invalidante | ⬜ | Argon2id, JWT TTL ≤ 8 h, cookie `__Host-`/`HttpOnly`/`Secure`/`SameSite=Lax` |
| 2 | Toda ruta de panel devuelve 401 sin credenciales | ⬜ | Middleware de auth y política de rutas públicas |
| 3 | CRUD de proyecto, clave pública, rename, delete con reportes, selección activa | ⬜ | Modelo de proyectos, panel y cascada |
| 4 | Rotación de clave con semántica decidida | ⬜ | **Q-07 sin resolver**: gracia vs corte instantáneo |
| 5 | Blobs solo por API autenticada y path-safe | ⬜ | Cierre de DEP-03; hoy la ruta existe sin auth |

**Riesgos documentados:** Q-07, `@node-rs/argon2` con nombres de opción sin verificar, TLS/`Secure` en demo HTTP, proxy nginx same-origin, borrado de proyecto debe borrar blobs.

**Cobertura de pruebas actual:** 0. CA-05 no puede aprobarse. Las rutas de lectura están rate-limited y paginadas, pero siguen siendo anónimas.

### 4.3 Fase 6 — Triage & Data Lifecycle (10 requisitos, 0 planes)

**Requisitos pendientes:** TRI-04, TRI-05, TRI-06, TRI-07, TRI-08, TRI-09, TRI-10, RET-01, RET-02, RET-03.

| SC | Criterio de éxito | Estado | Qué falta |
|---|---|---|---|
| 1 | Lista filtrada por tipo/estado/proyecto y contadores | ⬜ | UI de triaje y consultas |
| 2 | Detalle con screenshot, logs y metadatos, texto hostil inerte | ⬜ | Detalle completo y render seguro |
| 3 | Pending / In Progress / Resolved, reopen y comentarios internos | ⬜ | Máquina de estados y modelo de comentarios |
| 4 | Borrar reporte o borrar identidad, con borrado del blob | ⬜ | Borrado alcanza almacenamiento; alcance de TRI-09 ambiguo |
| 5 | TTL identidad 30 d y reporte completo 90 d, configurable, evidenciado en `purge_runs` | 🟡 Parcial | Purga implementada en quick task; `purge_runs` no existe como tabla y la prueba real está diferida |

**Riesgos documentados:** XSS de salida (React text nodes, cero `dangerouslySetInnerHTML`), retención de artefactos no sólo identidad, borrado manual alcanza blobs, backup vs borrado, aviso RGPD Art. 13 y DPA (no asesoría legal).

**Cobertura de pruebas actual:** 0 pruebas de triaje. La purga tiene e2e diferida y `requirements-completed: []`. RET-03 tiene knobs `.env` desde Fase 1, pero no verificación de fase.

### 4.4 Fase 7 — Resilience & Release Closeout (3 requisitos, 0 planes)

**Requisitos pendientes:** ING-02, PRF-05, DEP-04.

| SC | Criterio de éxito | Estado | Qué falta |
|---|---|---|---|
| 1 | Reporte sobrevive unload/red flaky exactamente una vez, con estado «retrying» visible | ⬜ | Cola IndexedDB, flush en `pageshow`/visibility, misma idempotency key, dedupe servidor, fallback si IndexedDB no existe |
| 2 | Lighthouse baja ≤ 2 puntos con el fixture hostil | ⬜ | Método de medición, baseline, throttling, repeticiones |
| 3 | Backup/restore copiando volumen y dump de BD | ⬜ | Procedimiento y prueba |
| 4 | `docker-compose up` limpio + gate CA-01…CA-05 en 3 motores + `check:size` + cero secretos | ⬜ | Cierre de release; CA-05 sigue rojo hasta Fase 5 |

**Riesgos documentados:** `keepalive`/`sendBeacon` limitados a 64 KiB, cola IndexedDB con TTL y tope, dedupe `UNIQUE (project_id, idempotency_key)`, never `localStorage`, multi-tab, A-12 (45+25+14 = 84 > 80), volumen montado sólo en `api`.

**Cobertura de pruebas actual:** 0. No hay plan, ni prueba de unload, ni medición Lighthouse, ni restore.

### 4.5 Requisitos transversales que siguen abiertos

| Requisito | Fase | Por qué no está cerrado |
|---|---|---|
| ING-02 | 7 | Sólo existe reintento en memoria de lane 1; no hay cola durable |
| PRF-05 | 7 | Sin medición Lighthouse ni método acordado |
| DEP-04 | 7 | Sin procedimiento de backup/restore |
| DEP-03 | 5 | Ruta endurecida, pero sin autenticación |
| TRI-02 / CA-05 | 5 | Sin auth de panel |
| RET-01/02/03 | 6 | Implementación parcial adelantada, sin aceptación de fase |
| PRJ-04 | 5 | Requisito v1, pero `PROJECT.md` lo declara fuera de alcance y Q-07 sigue abierto |

---

## 5. Matriz completa requisito → fase → estado

> **Leyenda:** ✅ completo · 🟡 parcial observado · ⬜ pendiente. La columna «Declarado» reproduce `REQUIREMENTS.md`; «Observado» incorpora la evidencia documental de este informe.

### 5.1 Integración

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| INT-01 | 2 | ✅ | ✅ | Script async + IIFE, `02-VERIFICATION` SC-1 |
| INT-02 | 2 | ✅ | ✅ | `init()` + 201 real, J-02 |
| INT-03 | 4 | ⬜ | ⬜ | Contexto init `user/appVersion/custom`; sin plan |
| INT-04 | 4 | ⬜ | ⬜ | `privacy.userIdentity:false`; sin plan |
| INT-05 | 2 | ✅ | ✅ | ESM, cero globales añadidos |

### 5.2 Widget, aislamiento e i18n

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| WDG-01 | 2 | ✅ | ✅ | Lanzador 48×48, J-01 |
| WDG-02 | 2 | ✅ | ✅ | CSS hostil, J-14 |
| WDG-03 | 2 | ✅ | ✅ | Cero fugas, J-14 |
| WDG-04 | 2 | ✅ | ✅ | Un global, prototipos intactos, J-01 |
| WDG-05 | 2 | ✅ | ✅ | Apilamiento y hit-testing, J-14 |
| WDG-06 | 3 | ✅ | ✅ | EN/ES core + editor, J-12 |

### 5.3 Captura

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| CAP-01 | 2 | ✅ | ✅ | `getDisplayMedia`, J-02/J-03 + UAT real |
| CAP-02 | 3 | ✅ | ✅ | Adjunto PNG/WebP/JPEG, J-07; servidor JPEG |
| CAP-03 | 3 | ✅ | ✅ | Degradado + text-only 201, J-07 |
| CAP-04 | 2 | ✅ | ✅ | Widget ausente del artefacto, J-03 |
| CAP-05 | 2 | ✅ | ✅ | 16 MP / 2 MB / HiDPI, J-08 |

### 5.4 Anotación

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| ANN-01 | 3 | ✅ | ✅ | Freehand, J-06 |
| ANN-02 | 3 | ✅ | ✅ | Flecha, J-06 |
| ANN-03 | 3 | ✅ | ✅ | Rectángulo, J-06 |
| ANN-04 | 3 | ✅ | ✅ | Texto, vacío y no-ASCII, J-06 |
| ANN-05 | 3 | ✅ | ✅ | Máscara + Relleno/Pixelar, J-05 |
| ANN-06 | 3 | ✅ | ✅ | Undo por trazo, nunca máscara, J-05/J-06 |

### 5.5 Privacidad y enmascarado

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| PRV-01 | 2 | ✅ | ✅ | Password, J-04 |
| PRV-02 | 2 | ✅ | ✅ | JWT/Bearer/asignaciones/Luhn, J-04 |
| PRV-03 | 2 | ✅ | ✅ | `data-watchbug-sensitive`, J-04 |
| PRV-04 | 3 | ✅ | ✅ | Fill/pixelate destructivo, CA-02, J-05 |
| PRV-05 | 2 | ✅ | ✅ | Sin cookies/storage/auth, J-11 |
| PRV-06 | 2 | ✅ | ✅ | Path-only URL, J-11 |
| PRV-07 | 3 | ✅ | ✅ | Review del artefacto exacto, J-02 |

### 5.6 Payload y enriquecimiento

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| ENR-01 | 4 | ⬜ | ⬜ | Sin captura de consola |
| ENR-02 | 4 | ⬜ | ⬜ | Text-only existe, semántica feedback sin logs no |
| ENR-03 | 4 | ⬜ | ⬜ | Sin metadatos de entorno completos |
| ENR-04 | 4 | ⬜ | ⬜ | `appVersion` no viaja aún |
| ENR-05 | 4 | ⬜ | ⬜ | Sin buffer ni límites de consola |
| ENR-06 | 1 | ✅ | ✅ | Esquema oficial validado |

### 5.7 Transporte e ingesta

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| ING-01 | 1 | ✅ | ✅ | Multipart 201 |
| ING-02 | 7 | ⬜ | ⬜ | Reintento en memoria, no durabilidad |
| ING-03 | 1 | ✅ | ✅ | Idempotencia y concurrencia |
| ING-04 | 1 | ✅ | ✅ | 401 uniforme por clave |
| ING-05 | 1 | ✅ | ✅ | Límites por clave/IP/día |
| ING-06 | 1 | ✅ | ✅ | Caps de cuerpo/parte/imagen |
| ING-07 | 1 | ✅ | ✅ | Sanitización + render inerte |
| ING-08 | 1 | ✅ | ✅ | Allowlist de `Origin` |

### 5.8 Panel y triaje

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| TRI-01 | 5 | ⬜ | ⬜ | Sin login |
| TRI-02 | 5 | ⬜ | ⬜ | Sin auth; CA-05 rojo |
| TRI-03 | 5 | ⬜ | ⬜ | Sin logout |
| TRI-04 | 6 | ⬜ | ⬜ | Lista sin filtros de tipo/estado/proyecto |
| TRI-05 | 6 | ⬜ | ⬜ | Detalle parcial en panel, sin logs |
| TRI-06 | 6 | ⬜ | ⬜ | Sin estados |
| TRI-07 | 6 | ⬜ | ⬜ | Sin comentarios |
| TRI-08 | 6 | ⬜ | ⬜ | Sin borrado de reporte |
| TRI-09 | 6 | ⬜ | ⬜ | Sin borrado de identidad |
| TRI-10 | 6 | ⬜ | ⬜ | Sin contadores |

### 5.9 Proyectos

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| PRJ-01 | 5 | ⬜ | ⬜ | Sólo seed de `.env`, no CRUD |
| PRJ-02 | 5 | ⬜ | ⬜ | Sin proyecto activo |
| PRJ-03 | 5 | ⬜ | ⬜ | Sin rename |
| PRJ-04 | 5 | ⬜ | ⬜ | Sin rotación; contradicción de alcance y Q-07 |
| PRJ-05 | 5 | ⬜ | ⬜ | Sin delete en cascada |

### 5.10 Retención

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| RET-01 | 6 | ⬜ | 🟡 | Purga TTL quick `m3v`; verificación diferida |
| RET-02 | 6 | ⬜ | 🟡 | Purga TTL quick `m3v`; verificación diferida |
| RET-03 | 6 | ⬜ | 🟡 | TTLs `.env` desde Fase 1 + intervalo de purga; sin aceptación de fase |

### 5.11 Despliegue y operaciones

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| DEP-01 | 1 | ✅ | ✅ | 3 servicios, cold start |
| DEP-02 | 1 | ✅ | ✅ | `.env.example` + fail-fast |
| DEP-03 | 5 | ⬜ | 🟡 | Ruta de blob endurecida, sin auth |
| DEP-04 | 7 | ⬜ | ⬜ | Sin backup/restore |

### 5.12 Presupuesto de rendimiento

| Req | Fase | Declarado | Observado | Evidencia / nota |
|---|---|---|---|---|
| PRF-01 | 2 | ✅ | ✅ | Core 9,3 → 17,2/45 KB gz |
| PRF-02 | 3 | ✅ | ✅ | Lazy 6,8/25 KB gz + suelo 2 KB |
| PRF-03 | 3 | ✅ | ✅ | Runtime 24,4/80 KB gz |
| PRF-04 | 2 | ✅ | ✅ | Cero dependencias runtime |
| PRF-05 | 7 | ⬜ | ⬜ | Sin Lighthouse |

---

## 6. Criterios de aceptación: evidencia y pendientes

| CA | Evidencia de lo hecho | Lo que falta | Fase |
|---|---|---|---|
| CA-01 | Contrato Zod + JSON Schema emitido; validación en ingesta; rechazo de campos desconocidos; C-5 | Condicionalidad `consoleLogs` bug/feedback y scrubbing de secretos | 4 |
| CA-02 | T1 auto-redacción + T2/T3 máscaras; artefacto decodificado; anillo 1 px; no resurrección; DPR matrix | Nada funcional; sólo falta el umbral objetivo de irreversibilidad (ver §7) | 3 |
| CA-03 | `check:size` en CI; tiers 45/25/80; reporte de peor caso 84 KB | Medición Lighthouse ≤ 2 puntos y su método | 7 |
| CA-04 | Matriz hostil con control, 5 variantes, bundle cerrado, 3 motores, VRT | Cobertura de variantes CSS no enumeradas (limitación de diseño) | 2 |
| CA-05 | Rate limit de lectura + paginación (mitigación, no autenticación) | Auth de panel, 401 uniforme, rutas públicas definidas | 5 |

---

## 7. Gaps y ambigüedades que afectan a la cobertura

> El análisis detallado y las recomendaciones están en el **Documento 3**. Aquí se resumen los que impactan directamente en la completitud de requisitos.

| # | Gap / ambigüedad | Severidad | Impacto en cobertura |
|---|---|---|---|
| G-01 | Fases 4–7 sin `PLAN.md` ni criterios operacionalizados | 🔴 Alta | 29 requisitos sin matriz requisito→test |
| G-02 | CA-05 no cumplido y sin fecha funcional hasta Fase 5 | 🔴 Alta | El release gate no puede estar verde |
| G-03 | PRJ-04: requisito v1 vs `PROJECT.md` que declara la rotación fuera de alcance | 🔴 Alta | Requisito y alcance se contradicen |
| G-04 | Q-07 (semántica de rotación) sin decidir | 🔴 Alta | Bloquea planificación de Fase 5 |
| G-05 | CA-03 Lighthouse sin método, baseline ni tolerancia | 🟠 Media | PRF-05 no es medible hoy |
| G-06 | CA-01 condicional no está en el esquema; se confía en Fase 4 | 🟠 Media | Un `bug` sin logs podría validar el esquema |
| G-07 | TRI-09 (identidad) vs Fase 6 SC4 (borrado alcanza screenshot) | 🟠 Media | Alcance de borrado ambiguo y sensible a RGPD |
| G-08 | RET-01/02/03 con implementación adelantada y verificación diferida | 🟠 Media | Estado oficial y realidad difieren |
| G-09 | `purge_runs` prometido en Fase 6 SC5, pero la purga implementada sólo logs | 🟠 Media | Criterio de evidencia no satisfacible sin cambio |
| G-10 | WDG-06: override persistido en `localStorage` (CONTEXT) vs sesión en memoria (STATE) | 🟡 Baja | Prueba de i18n no sabe qué persistencia exigir |
| G-11 | ROADMAP Fase 7 aún dice que WebKit cubre el fallback WebP→PNG; A-14 lo corrige | 🟡 Baja | Deriva documental; no cambia código |
| G-12 | `PROJECT.md` sigue declarando «unit tests» fuera de alcance; R-19 los admite | 🟡 Baja | Deriva documental; puede confundir al tribunal |

---

## 8. Conclusión

La cobertura de requisitos es **buena en lo construido y estructuralmente incompleta en lo planificado**:

- **Lo construido (fases 1–3) está por encima de la media documental:** 41/70 requisitos cerrados con verificación de fase, 15/15 criterios de éxito, 40/40 + 38/38 + 74/74 *must-haves*, 16/16 UAT manuales y un ledger que justifica cada fila de test histórica. El núcleo de valor — captura fiel, enmascarado destructivo, revisión y auto-hospedaje — está demostrado a nivel de artefacto.
- **Lo no construido (fases 4–7) no tiene plan ejecutable:** 29 requisitos, 19 criterios de fase y 3 de los 5 CA dependen de fases que sólo existen como objetivos. La ausencia de `PLAN.md` no es un detalle de proceso: impide asignar criterios de aceptación, tests y evidencia.
- **Hay cuatro estados «parciales» que la trazabilidad oficial no refleja:** RET-01, RET-02, RET-03 y DEP-03 tienen trabajo real, pero no aceptación de fase. El proyecto debe decidir si los eleva con verificación o los mantiene como deuda declarada.
- **La deuda documental es manejable pero visible:** contradicciones en PRJ-04, `PROJECT.md` vs R-19, ROADMAP vs A-14 y la persistencia de i18n. Ninguna rompe el producto, pero todas degradan la auditabilidad del TFG.

**Veredicto:** el proyecto está **en el 43 % de fases cerradas y el 58,6 % de requisitos completos**, con el camino del reportero terminado y el camino del desarrollador pendiente. La siguiente decisión de mayor impacto no es escribir más tests: es **planificar las fases 4–7 con criterios operacionalizados y resolver las contradicciones de alcance**.

---

*Auditoría documental basada exclusivamente en `.planning/` · 2026-11-03*
