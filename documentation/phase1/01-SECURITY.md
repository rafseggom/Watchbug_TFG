<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 1 — Seguridad: *Contracts & Ingest Slice*

| | |
|---|---|
| **Fase** | 1 — *Contracts & Ingest Slice* |
| **Estado** | ✅ `verified` |
| **Amenazas abiertas** | `threats_open: 0` |
| **Nivel ASVS** | 1 |
| **Fecha** | 2026-10-13 |

> Resumen ejecutivo del `01-SECURITY.md` de planificación: fronteras de confianza, registro de amenazas, riesgos aceptados y pista de auditoría.

---

## 1. Fronteras de confianza

Consolidadas de los bloques `<threat_model>` de los cuatro PLAN.md.

| Frontera | Descripción | Datos que cruzan |
|---|---|---|
| Cliente no confiable → `POST /api/incidents` | Cuerpo multipart + `X-Project-Key` + `Idempotency-Key` (cliente sintético; el SDK real llega en Fase 2) | Texto del reporte, bytes de imagen, logs de consola, metadatos de entorno |
| Cuerpo multipart → borde de ingesta | Ficheros hostiles, streams sobredimensionados, `Content-Length` mentiroso, nombres hostiles | Bytes de imagen + campos multipart |
| Cliente → preHandlers de ingesta | Cabecera de clave, identidad IP (`X-Forwarded-For`), `Origin` | Cabeceras de identidad |
| Imagen → decodificación | Abuso de dimensión/códec antes de cualquier trabajo de píxeles | Bytes de imagen en crudo |
| Artefacto almacenado → navegador (ruta de blob) | Bytes endurecidos servidos al navegador del desarrollador desde el origen del panel | Bytes de imagen + MIME declarado |
| Panel → `/api/*` vía proxy nginx | Superficie de lectura (lista + blob), deliberadamente sin autenticar (DEP-03 completa en Fase 5) | Lista/detalle, bytes de imagen |
| Texto almacenado → DOM del panel | La frontera clásica de XSS almacenado (C-3) | Título/descripción/logs de consola |
| Proxy inverso (nginx) → api | Identidad reenviada — la confianza se configura, nunca se asume | `X-Forwarded-For` |
| `.env` / compose → arranque del API | Configuración del operador; debe fallar ruidosamente si está mal (SEC-04) | URL de BD, clave de proyecto, allowlist CORS, flag trust-proxy, TTLs |
| Registro npm / Docker Hub → build | Cadena de suministro del conjunto fijado (17 pines npm + 3 imágenes) | Código fuente, imágenes base |
| Panel → `GET /api/setup` | Expone la clave pública write-only al navegador del propio operador | Clave de proyecto |
| Bundle del panel → red | La promesa auto-hospedada: sin egreso a terceros | Ninguno (egreso solo a su propia API) |

---

## 2. Registro de amenazas (18/18 cerradas)

| ID | Cat. | Componente | Sev. | Disposición | Mitigación | Estado |
|---|---|---|---|---|---|---|
| T-01-01 | S | Gate de clave de `POST /api/incidents` | alta | mitigar | Lookup de `projects` sembrado al arrancar sobre `X-Project-Key` (P1-D-01/03); 401 estructurado; nada almacenado en fallo | cerrada |
| T-01-02 | I | Configuración / arranque (`config.ts`) | alta | mitigar | SEC-04: toda config de `.env` vía `--env-file`; `.env.example` comprometido; fail-fast (P1-D-02) con mensaje exacto | cerrada |
| T-01-03 | T | Texto del reporte → render del panel | alta | mitigar | Doble control C-3: `sanitize-html` allowlist vacía al escribir + render solo de nodos de texto React | cerrada |
| T-01-04 | I | Metadatos de imagen (PII EXIF) | media | mitigar | `harden()` antes de escribir a disco; sharp elimina metadatos por defecto; chunks `eXIf/tEXt/zTXt/iTXX/tIME` descartados tras IEND | cerrada |
| T-01-05 | D | Ruta de recepción multipart | alta | mitigar | `limits` explícitos (`files:1` / 4 MB parte / fields 8 / fieldSize 4 KB / headerPairs 1 KB / parts 16) con `throwFileSizeLimit: true` | cerrada |
| T-01-SC | T | Instalaciones npm/Docker | alta | mitigar | Gate de legitimidad `blocking-human` sobre cada paquete e imagen (17 npm + 3 Docker); `sharp` superó su propio checkpoint en 01-02 | cerrada |
| T-01-06 | T | Ingesta de imagen (SVG/políglota) | alta | mitigar | Allowlist de magic-byte + estructura PNG/WebP; SVG rechazado incondicionalmente (P1-D-11); `harden()` obligatorio (P1-D-10) | cerrada |
| T-01-07 | T | Manejo de claves/rutas de `Storage` | alta | mitigar | Claves `randomUUID()` generadas por servidor; nombres traversal rechazados; cada ruta `path.resolve`-da y asertada dentro de `blobsRoot` | cerrada |
| T-01-08 | D | Ruta de decodificación | alta | mitigar | Guarda de dimensión desde cabeceras antes de decodificar: `MAX_IMAGE_DIM` (8192/lado) y `MAX_IMAGE_PIXELS` (16 MP), más guarda de tiempo del códec en `sharp` | cerrada |
| T-01-09 | D | Recepción multipart (topes agregados) | alta | mitigar | Pre-lectura `Content-Length` + contador streaming + límites del parser + manejo `truncated` → 413 estructurado con tmp desenlazado | cerrada |
| T-01-10 | I | Respuesta de la ruta de blob | media | mitigar | Cabeceras inertes: `nosniff`, `Content-Disposition: attachment`, `CSP: default-src 'none'; sandbox`, `CORP: same-origin`, caché privada; MIME desde allowlist de BD; 404 en claves desconocidas | cerrada |
| T-01-11 | S | Derivación de clave de rate-limit | alta | mitigar | `trustProxy` configurado explícitamente desde `WATCHBUG_TRUST_PROXY` (nunca `true` a ciegas); caveats de spoofing/NAT en `.env.example` | cerrada |
| T-01-12 | D | Rate limits de ingesta (H-7) | alta | mitigar | Tres limitadores compuestos (por clave 10/min, por IP 30/min, por proyecto 2000/día) con 429 + `retry-after`; límites antes de cualquier escritura | cerrada |
| T-01-13 | S | Manejo de origen CORS (ING-08) | media | mitigar | Allowlist `WATCHBUG_CORS_ORIGINS` aplicada a la presencia de `Origin`; orígenes no permitidos → 403; clientes sin `Origin` aceptados (Pitfall 9) | cerrada |
| T-01-14 | I | Respuestas 401 | baja | mitigar | Un 401 uniforme para clave ausente/malformada/desconocida — sin oráculo de existencia | cerrada |
| T-01-15 | T | Render de campos del reporte | alta | mitigar | Render solo de nodos de texto React + puerta de sumidero a nivel de fuente: **0** `dangerouslySetInnerHTML`/`innerHTML` en `apps/panel/src`; aserciones DOM en ING-07 | cerrada |
| T-01-16 | I | Exposición del projectKey en `GET /api/setup` | baja | mitigar | Devuelve solo `{ projectKey }`; la clave es la capacidad pública write-only por diseño; despliegue en loopback; Fase 5 reemplaza el onboarding con auth real | cerrada |
| T-01-17 | T | Afirmaciones de producto (privacidad/cumplimiento) | baja | **aceptar** | La contención de afirmaciones es el control: esta fase no hace ninguna afirmación de auth, anonimización ni RGPD — ver AR-01 | cerrada |

*Severidad: crítica > alta > media > baja — solo las amenazas abiertas en o por encima de `security_block_on` (`alta`) cuentan para `threats_open`.*
*Disposición: mitigar (implementación exigida) · aceptar (riesgo documentado) · transferir (terceros).*

**Método de verificación.** `security_asvs_level: 1` con `register_authored_at_plan_time: true` (los cuatro PLAN.md llevan un bloque `<threat_model>` parseable) y `threats_open: 0` — aplica el cortocircuito L1: cada mitigación se confirmó **presente en el fichero citado** (profundidad de grep, `file:line`), no por un auditor spawneado. L1 confirma presencia, no colocación en frontera ni traza extremo a extremo; esa evidencia más profunda vive en la suite e2e a nivel de artefacto y en `01-REVIEW.md`/`01-REVIEW-FIX.md`.

Ninguno de los cuatro SUMMARY.md tiene sección `## Threat Flags`, así que no hay banderas no registradas que reconciliar.

---

## 3. Registro de riesgos aceptados

| ID | Ref. amenaza | Justificación | Aceptado por | Fecha |
|---|---|---|---|---|
| **AR-01** | T-01-17 | Esta fase no hace ninguna afirmación de auth, anonimización ni cumplimiento RGPD en la UI ni en los docs. La contención de afirmaciones es el control; revisar cuando aterricen Fase 5 (auth) y Fase 6, junto a la revisión legal pendiente M-1/Q-05. | propietario | 2026-10-13 |
| **AR-02** | residual-ING-06 | Un cliente que sube un cuerpo sobredimensionado **a plena velocidad** aún puede perder el 413 de la pre-lectura ante un reset de socket (`ECONNABORTED`). El cuerpo sigue siendo rechazado — es un defecto de diagnosticabilidad/UX, no un bypass — pero tal cliente puede no saber por qué. `lingerBeforeClose()` (`ed20ec3`) cerró el caso paced/e2e (15/15 dirigidas, 132/132 suite) pero no el de plena velocidad. Aceptado 2026-10-13; enfoques rechazados registrados como dead-ends **D-09** y **D-10** en `resolution-record.md` §3. No re-investigar sin petición expresa. | propietario | 2026-10-13 |

*Los riesgos aceptados no reaparecen en futuras ejecuciones de auditoría.*

---

## 4. Pista de auditoría de seguridad

| Fecha | Amenazas totales | Cerradas | Abiertas | Ejecutado por |
|---|---|---|---|---|
| 2026-10-13 | 18 | 18 | 0 | orquestador — pasada L1 (cortocircuito ASVS 1; auditor no requerido) |

---

## 5. Firma

- [x] Todas las amenazas tienen disposición (mitigar / aceptar / transferir)
- [x] Riesgos aceptados documentados en el registro
- [x] `threats_open: 0` confirmado
- [x] `status: verified` fijado en el frontmatter

**Aprobación:** verificado 2026-10-13

---

## 6. Relación con la revisión de código

Los dos hallazgos críticos de `01-REVIEW.md` fueron **defectos reales de los controles de seguridad** (bypass de las tres dimensiones de ING-05) y se **corrigieron** en `01-REVIEW-FIX.md` con evidencia RED→GREEN:

- **CR-01** — buckets por clave/día sobre la cabecera cruda mientras el gate la recortaba → normalización idéntica (`projectKeyOf`).
- **CR-02** — `trustProxy=true` hacía falseable el limitador por IP → lista de confianza (`127.0.0.1/8,::1/128,172.16.0.0/12`) + nginx sobrescribe `X-Forwarded-For`.

Ambos quedan **pinzados por filas de regresión e2e**. Ver `01-REVIEW.md` y `01-VERIFICATION.md`.

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **AR-0x** | Riesgo aceptado (*Accepted Risk*) |
| **ASVS** | *Application Security Verification Standard* (OWASP) |
| **C-3 / C-4** | Clases de peligro: C-3 XSS/inyección en render; C-4 path traversal / ficheros |
| **CORP** | *Cross-Origin-Resource-Policy* (cabecera) |
| **CSP** | *Content-Security-Policy* (cabecera) |
| **D-09 / D-10** | Dead-ends registrados (enfoques rechazados) |
| **DEP-03** | Requisito de despliegue (blob servido solo por API autenticada) |
| **EXIF** | Metadatos de imagen (incl. PII de cámara) |
| **H-7** | Peligro de investigación: abuso de ingesta |
| **ID / IDOR** | Identificador; *Insecure Direct Object Reference* |
| **ING-0x** | Requisito de ingesta (*ingest*) |
| **INV-0x** | Invariante arquitectónico no negociable |
| **L1** | Nivel 1 de verificación de seguridad (cortocircuito ASVS) |
| **M-1** | Punto del registro ligado a retención de datos |
| **MIME** | Tipo de contenido declarado |
| **NAT** | *Network Address Translation* (IP de salida compartida) |
| **P1-D-xx** | Decisión de implementación local de la Fase 1 |
| **PII** | *Personally Identifiable Information* (datos personales) |
| **Q-05** | Pregunta abierta sobre política de propiedad intelectual |
| **RGPD** | Reglamento General de Protección de Datos |
| **SEC-0x** | Requisito de seguridad |
| **STRIDE** | Taxonomía de amenazas (Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation) |
| **T-01-xx** | Identificador de amenaza de la Fase 1 |
| **TFG** | Trabajo Fin de Grado |
| **TTL** | *Time To Live* (vida útil antes de purga) |
| **XFF** | `X-Forwarded-For` (cabecera de IP reenviada) |
| **XSS** | *Cross-Site Scripting* |
