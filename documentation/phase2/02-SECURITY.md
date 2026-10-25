<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 2 — Seguridad: *SDK Tracer Bullet: Widget, Capture & Auto-Redaction*

| | |
|---|---|
| **Fase** | 2 — *SDK Tracer Bullet: Widget, Capture & Auto-Redaction* |
| **Auditado** | 2026-10-24 |
| **Amenazas cerradas** | **15 / 15** · `threats_open: 0` |
| **ASVS** | Nivel 1 (registro redactado en tiempo de plan) |
| **Riesgos aceptados** | 1 — `AR-01` |
| **Estado** | `verified` |

> Este documento consolida y resume el `02-SECURITY.md` de la fase. Es un resumen ejecutivo, no una copia literal.

---

## 1. Fronteras de confianza

| Frontera | Descripción | Dato que la cruza |
|---|---|---|
| Página anfitriona hostil → widget | El CSS/JS/DOM del anfitrión es entrada no confiable que el widget debe sobrevivir | Estilos, estructura DOM, cadenas dinámicas |
| Texto dinámico del widget → Shadow DOM | Motivos de rechazo del servidor y títulos controlados por el anfitrión se pintan en el widget | Texto no confiable (debe renderizarse inerte) |
| Widget → documento anfitrión | INV-01/INV-02: nada puede filtrarse de vuelta | Estilos, globales (deben ser cero) |
| Superficie de captura → fotograma | El selector puede devolver cualquier superficie; sólo la pestaña mapea al DOM de la página | Píxeles de pantalla/ventana/pestaña |
| Contenido del DOM → rects de máscara | Formas hostiles o inusuales deciden qué se destruye antes de codificar | Rects de elementos/nodos + coincidencias de patrón |
| Geometría CSS → píxeles del bitmap | La frontera del mapeo H-1, donde una mala registración filtra caracteres | Coordenadas × DPR/zoom |
| Pipeline de captura → bytes codificados | La frontera de SEC-02: ningún byte sin enmascarar puede cruzarla | Píxeles del screenshot |
| Resultado de la redacción → transporte | El fail-open aquí es el único modo de fallo que el valor del producto prohíbe | Los errores de redacción no pueden convertirse en envíos |
| Resultado de la captura → usuario | Los fallos deben ser estados visibles, nunca pérdida silenciosa (M-6) | Estados de fallo |
| Estado del anfitrión → informe saliente | SEC-03: nada de cookies/storage/auth del anfitrión puede viajar | Payload del informe |
| URL/título del anfitrión → meta | Cadenas no confiables deben ser moldeadas por el contrato cerrado antes de salir | `title`, `url` |
| Salida de build → bundle distribuido | Los gates de presupuesto y dependencias se interponen entre el código y la promesa de 45 KB | Bytes del bundle |

---

## 2. Registro de amenazas (15/15 cerradas)

| ID | Categoría | Componente | Severidad | Disposición | Mitigación | Estado |
|---|---|---|---|---|---|---|
| **T-02-01** | T | Texto dinámico en el widget (motivo del servidor, título) | high | mitigar | Toda escritura dinámica es `textContent`; truncado a 240; **cero** literales de sumidero HTML en el SDK | cerrada |
| **T-02-02** | T/D | CSS hostil frente a visibilidad y comportamiento del widget | high | mitigar | Estilo inline `!important` en el host, `all: initial` + re-declaración px en la raíz, raíz cerrada, último hijo de `documentElement` + observadores | cerrada |
| **T-02-03** | I | Bytes de captura sin enmascarar antes de la redacción | critical | mitigar | El puerto devuelve `ImageData` (nunca `Blob`); `redact` precede estrictamente a `encode` | cerrada |
| **T-02-04** | I | Fuga de estilos o globales del widget al anfitrión | medium | mitigar | Un solo `<style>` dentro de la raíz, tokens `--wb-*` locales, un global, sin parchear prototipos, sin `customElements` | cerrada |
| **T-02-05** | I | Superficie de captura no-pestaña (ventana/pantalla) | high | mitigar | Política `displaySurface`: `window`/`screen` lanzan antes de leer un píxel; `undefined` aceptado con salvedad documentada | cerrada |
| **T-02-06** | R/D | Captura en blanco u obsoleta como pérdida de datos | medium | mitigar | Sonda de uniformidad densa (originalmente 9 muestras) + timeout de 10 s; todo fallo aterriza en un estado del panel | cerrada |
| **T-02-07** | T | Ruta de codificación que esquiva el sumidero único o el orden de redacción | high | mitigar | Gate `sdk-single-encode-sink`: exactamente un `toBlob` (`encode.ts:75`), invocado sólo tras `redactor.redact()` | cerrada |
| **T-02-08** | I | Falsos negativos del catálogo de patrones | critical | mitigar | Catálogo P2-D-07 (JWT / bearer / asignaciones / tarjeta) en nodos de texto **y** valores de input; tarjetas por Luhn con uniones de grupos adyacentes; sobre-enmascarado conservador | cerrada |
| **T-02-09** | I | Mala registración de la máscara en HiDPI/zoom | high | mitigar | Un único mapeo en `geometry.ts` derivado del frame real frente al viewport vivo; redondeo sólo hacia fuera | cerrada |
| **T-02-10** | I | Fail-open de la redacción ante error | critical | mitigar | `redact` dentro de un `try/catch` que corta **antes** de codificar y enviar, hacia el estado terminal visible | cerrada |
| **T-02-11** | I | Exfiltración de credenciales del anfitrión en el payload | critical | mitigar | `buildMeta` por campos explícitos (nunca spread), dos cabeceras, `credentials:'omit'` y `referrerPolicy:'no-referrer'`; gate estático + fila de centinelas | cerrada |
| **T-02-12** | I | Query/fragmento de la URL filtrando tokens al meta | high | mitigar | El SDK envía sólo `location.pathname`; el esquema re-recorta como defensa en profundidad; la fila PRV-06 prueba que un `referer` por defecto sí filtraría | cerrada |
| **T-02-13** | I | Crecimiento de la cadena de suministro en el bundle | medium | mitigar | `sdk-runtime-deps` en verde (sólo `@watchbug/contracts`); `import type` de contratos; cero Zod en el cliente | cerrada |
| **T-02-14** | I | Secretos dentro de píxeles de iframes de origen cruzado | medium | **aceptar** | El escáner no alcanza documentos de terceros; sobre-enmascarar no arregla ubicaciones desconocidas. Documentado como limitación (OQ-3) | cerrada |
| **T-02-SC** | T | Instalaciones npm/pip/cargo (legitimidad de paquetes) | high | mitigar | Puerta de legitimidad heredada de la Fase 1; la fase añade **cero** dependencias | cerrada |

*Severidad: critical > high > medium > low. Sólo las amenazas abiertas de severidad ≥ `high` cuentan para `threats_open`.*

---

## 3. Registro de riesgos aceptados

| ID | Amenaza | Justificación | Aceptado por | Fecha |
|---|---|---|---|---|
| **AR-01** | T-02-14 | El contenido de iframes de origen cruzado en una captura de pestaña no puede escanearse desde el DOM, así que los secretos dentro de embeds de terceros viajan en los píxeles. Ningún mecanismo v1 puede enmascarar ubicaciones desconocidas sin un cambio de API pública que dispararía consulta (OQ-3). Se documenta como limitación de integración para la fase 5+. | Propietario | 2026-10-24 |

*Los riesgos aceptados no reaparecen en auditorías futuras.*

---

## 4. Pista de auditoría de seguridad

| Fecha | Amenazas | Cerradas | Abiertas | Ejecutado por |
|---|---|---|---|---|
| 2026-10-24 | 15 | 15 | 0 | `gsd-security-auditor` — pase L1 con lectura completa de fuente (ASVS 1; registro redactado en plan) |

**Método de verificación.** `workflow.security_asvs_level: 1` con `register_authored_at_plan_time: true` (los cinco PLAN llevan bloque `<threat_model>` parseable) y `threats_open: 0`: aplica el atajo L1, y además cada mitigación citada se confirmó **leyendo el fichero de implementación completo**, no sólo con un grep.

**Evidencia de gates (2026-10-24, salida real):**

```
node scripts/gate.mjs
PASS  sdk-runtime-deps        runtime blocks contain only: @watchbug/contracts
PASS  sdk-no-host-storage     15 SDK source file(s) clean of host storage/credential access
PASS  sdk-single-encode-sink  packages/sdk/src/image/encode.ts:75  toBlob
gate.mjs summary: 3 passed, 0 failed, 0 skipped

npm run check:size
SIZE OK   core     9.3 KB gz / 45 KB
SIZE OK   lazy     0.3 KB gz / 25 KB
SIZE OK   adapter  0.3 KB gz / 14 KB
SIZE OK   runtime  10.0 KB gz / 80 KB
check:size PASSED
```

**Cifras vigentes al cierre:** core **9,3 KB gz** y runtime **10,0 KB gz**. Ni la remediación ni las correcciones de cierre añadieron dependencias ni cambiaron los gates; el gate `sdk-single-encode-sink` sigue apuntando al único `toBlob` de `encode.ts`. La sonda de blanco pasó de 9 muestras a un barrido denso (misma garantía, menos falsos positivos) y el `lang` es accesibilidad: ninguno cambia el veredicto de seguridad.

**Sin banderas de amenaza sin registrar:** ninguno de los cinco SUMMARY declara una sección `## Threat Flags`, así que no hay flags del ejecutor que reconciliar. Nota: el XSS portado por imagen en bytes subidos **no** se acuñó aquí a propósito (canon del servidor, C-3/C-4 de la Fase 1, referenciado por el control de orden de T-02-07).

---

## 5. Firma

| Comprobación | Estado |
|---|---|
| Todas las amenazas tienen disposición (mitigar / aceptar / transferir) | ✅ |
| Riesgos aceptados documentados | ✅ |
| `threats_open: 0` confirmado | ✅ |
| `status: verified` en frontmatter | ✅ |

**Aprobación:** verificado 2026-10-24.

---

## 6. Relación con la revisión de código

`02-REVIEW.md` y su remediación (`02-REVIEW-FIX.md`, `02-REVIEW-DISPOSITION.md`) cerraron **15 hallazgos** (9 del primer pase + 6 del pase de regresión) que **endurecen este registro** sin añadir amenazas nuevas:

| Hallazgo | Relación con el registro |
|---|---|
| **CR-01 / CR-02** | CR-01 añade `referrerPolicy:'no-referrer'` a T-02-11 y T-02-12; CR-02 corrige un falso negativo real del catálogo (tarjetas pegadas) que T-02-08 ya cubría en su enunciado |
| **CR-03 → T-02-08** | El escáner pasó de «sólo light DOM» a recorrer también **raíces de sombra abiertas** e **iframes de mismo origen** (`collectScanRoots`, profundidad de roots acotada). AR-01 sigue cubriendo únicamente los iframes de **origen cruzado** |
| **WR-01** | La geometría se mide dentro de `beforeRead`, en el instante de leer píxeles: refuerza T-02-09 y consume el hueco de un desplazamiento de layout entre frame y DOM |
| **WR-02** | El endpoint por defecto pasa a ser el origen del documento; refuerza la frontera «salida de build → bundle» frente a una entrega desde CDN |
| **WR-03** | Toda clave de idempotencia sale de un CSPRNG; sin CSPRNG no se emite petición |
| **FX-02** | Un marco transformado (no traslación pura) se **rechaza** en lugar de mapearse: mismo criterio fail-closed que T-02-05, aplicado a la geometría de marcos anidados |

**Nota de consolidación:** el registro de arriba es el del `02-SECURITY.md` original (2026-10-24). La remediación posterior de CR-03 **amplía la cobertura** de T-02-08 más allá de lo que ese texto describe; el veredicto (`threats_open: 0`, 15/15 cerradas, AR-01 como único riesgo aceptado) no cambia y queda **más estrecho** que antes.

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **AR-xx** | Riesgo aceptado formalmente |
| **ASVS** | *Application Security Verification Standard* (OWASP) |
| **CSPRNG** | Generador de números pseudoaleatorios criptográficamente seguro |
| **DPR** | *Device Pixel Ratio* |
| **H-1** | Peligro de mala registración de la geometría de máscara |
| **INV-xx** | Invariante arquitectónica |
| **M-6** | Requisito de fallo ruidoso, nunca silencioso |
| **OQ-x** | Pregunta abierta del research |
| **SEC-xx** | Invariante de seguridad |
| **STRIDE** | Marco de amenazas (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) |
| **T-02-xx** | Amenaza identificada en la Fase 2 |
| **T1** | Momento de redacción automática en la captura |
| **e2e** | Prueba de extremo a extremo |
