<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 2 — Plan: *SDK Tracer Bullet: Widget, Capture & Auto-Redaction*

| | |
|---|---|
| **Fase** | 2 — *SDK Tracer Bullet: Widget, Capture & Auto-Redaction* |
| **Rama** | `gsd/phase-2-sdk-tracer-bullet` |
| **Planificado** | 2026-10-17 |
| **Olas** | 5 (02-01 … 02-05), 15 tareas en total |
| **Requisitos** | 18 — INT-01/02/05, WDG-01…05, CAP-01/04/05, PRV-01/02/03/05/06, PRF-01/04 |
| **Estado** | Ejecutado: 5/5 planes |

> Este documento consolida y resume los cinco planes de ola (`02-01-PLAN.md` … `02-05-PLAN.md`). Es un resumen ejecutivo, no una copia literal.

---

## 1. Objetivo de la fase

**Como** usuario final de cualquier página anfitriona, **quiero** abrir el widget de Watchbug y archivar con un solo gesto un informe respaldado por una captura, **para que** el desarrollador reciba un informe reproducible —con todo lo sensible ya destruido en los píxeles— y ni el informe ni su captura salgan jamás de la infraestructura del propio desarrollador.

La forma de aceptación es un **tracer bullet vertical** (no una capa horizontal): una etiqueta `<script async>` → lanzador → captura de pestaña → redacción destructiva T1 → codificación → `POST /api/incidents` → fila visible en el panel. Cada ola añade profundidad a esa misma rebanada y se verifica en la **única** suite Playwright (R-12), nunca con tests unitarios.

El plan fija en su primera construcción las dos decisiones que cargan arquitectura: **aislamiento `WidgetHost`** (rehacerlo obliga a reescribir todos los estilos) y **orden de redacción T1** (ningún byte codificado puede existir antes de que `Redactor` actúe).

---

## 2. Las cinco olas

| Ola | Plan | Depende de | Requisitos | Tareas | Entrega en una línea |
|---|---|---|---|---|---|
| 1 | 02-01 | — | INT-01, WDG-04 | 3 | Armazón del widget: `init()`, host aislado, lanzador, strings, panel de estado, variante de build `SHADOW_MODE=open` y arnés e2e |
| 2 | 02-02 | 02-01 | INT-02, INT-05, WDG-01/02/03/05 | 3 | Tracer real: un gesto archiva un informe; máquina de estados completa y prueba de aislamiento bajo CSS hostil |
| 3 | 02-03 | 02-02 | CAP-01, CAP-04, CAP-05 | 3 | Fidelidad de captura y fallo honesto: costura por motor, widget ausente, escalera de reducción, sonda de blanco, rechazo de superficie no-pestaña |
| 4 | 02-04 | 02-03 | PRV-01, PRV-02, PRV-03 | 3 | Catálogo T1 completo y prueba a nivel de artefacto, con geometría HiDPI y fail-closed |
| 5 | 02-05 | 02-04 | PRV-05, PRV-06, PRF-01, PRF-04 | 3 | Privacidad del payload y presupuestos: centinelas, URL sólo ruta, ≤ 45 KB, cero dependencias runtime y cierre de la suite |

### Orden risk-first (decidido)

El orden no es el de los requisitos sino el del riesgo:

1. **Aislamiento primero (02-01/02-02).** Es el único trabajo cuyo retroceso reescribe toda la UI. Además el bundle e2e con raíz abierta es lo que hace *testeable* el aislamiento; por eso el fixture hostil y la variante de build existen antes que el pipeline de captura.
2. **Tracer antes que fidelidad (02-02 → 02-03).** Primero se demuestra que el camino completo funciona; después se endurece la captura.
3. **Redacción al final del camino, pero antes de cualquier envío (02-04).** El catálogo se completa cuando ya hay bytes reales que decodificar y asertar.
4. **Presupuestos y cierre al final (02-05).** Los gates de tamaño y dependencias se miden contra el widget completo, no contra un esqueleto.

---

## 3. Detalle por ola

### Ola 02-01 — Armazón del widget y prueba de arranque

**Objetivo:** construir la capa de UI exactamente como la fija `02-UI-SPEC.md` desde la primera vez.

| Tarea | Qué hace |
|---|---|
| 1. Shell del widget | `index.ts` crece a `window.Watchbug` con `init({ projectKey, endpoint? })`; `WatchbugHost` con raíz cerrada y contrato de estilos inline `!important`; lanzador de 48×48 con gesto en el mismo turno; mapa `strings` bloqueado |
| 2. Renderizador del panel | Geometría, copy, spinner de 12×12, glifos, `role="status"`/`role="alert"` y truncado a 240 caracteres; un único `render(state)` como punto de entrada |
| 3. Variante de build + arnés | `SHADOW_MODE=open` con artefactos `watchbug.e2e.*` de nombre distinto; fixtures por `page.route` en el origen del panel; filas `INT-01` y `WDG-04` |

**Entregable clave:** una etiqueta async arranca un widget aislado, con el único global `Watchbug` en el carril IIFE y ninguno en ESM.

### Ola 02-02 — El tracer: un gesto, un informe real

**Objetivo:** disparar la primera bala trazadora por toda la pila cliente.

| Tarea | Qué hace |
|---|---|
| 1. Tracer de extremo a extremo | `runCaptureFlow` en la costura del gesto; pipeline estrictamente ordenado (ocultar → capturar → asertar oculto → restaurar → sonda → redactar → codificar → enviar); transporte lane 1; filas INT-02/INT-05/WDG-01 |
| 2. Máquina de estados y reintento | Todos los estados del UI-SPEC; reintento sólo de transitorios con 1/4/10 s ±25 % y misma `Idempotency-Key`; 4xx de contrato fallan de inmediato; autodescarte a los 5 s y `Escape` |
| 3. Aislamiento bajo CSS hostil | Matriz `display:none!important`, `font-size:4px`, `all:unset`, `transform`, guerra de z-index; controles no vacíos; filas WDG-02/03/05 y CA-04 |

**Entregable clave:** un clic archiva un informe enmascarado que devuelve 201 y aparece en el panel, y el widget sobrevive a todas las probes hostiles sin filtrar nada.

### Ola 02-03 — Fidelidad de captura y fallo honesto

**Objetivo:** cerrar CAP-01/04/05 a nivel de artefacto.

| Tarea | Qué hace |
|---|---|
| 1. Captura por motor + ausencia del widget | Stub de dos niveles (`captureStream` en chromium/firefox, costura `ImageData` en webkit); host oculto en la invocación; cero píxeles del widget en la imagen decodificada |
| 2. Escalera de reducción + HiDPI + M-3 | DPR ≤ 2 → ≤ 16 MP → q0.8/q0.6/q0.5 → 0.75×; HiDPI no blanco; sniff de `blob.type` y parte `.png` aceptada con 201 |
| 3. Sonda de blanco y superficie no-pestaña | Sonda de uniformidad (originalmente 9 muestras 3×3, hoy barrido denso); área por encima del tope de canvas; `displaySurface` `window`/`screen` rechazado en voz alta; prompt rechazado con estado visible |

**Entregable clave:** ningún fallo de captura es silencioso y jamás se envía un fotograma no verificable.

### Ola 02-04 — Catálogo T1 completo y geometría

**Objetivo:** cerrar la privacidad donde de verdad se cierra: en los bytes que salieron del navegador.

| Tarea | Qué hace |
|---|---|
| 1. Una familia de extremo a extremo | JWT `eyJ…` → un rect que cubre el nodo completo → relleno plano → bytes decodificados sin píxeles originales ni en el anillo de 1 px |
| 2. Catálogo P2-D-07 completo | JWT, `Bearer`, asignaciones `key=/token=/secret=/password=`, tarjetas por Luhn, `input[type=password]`, `[data-watchbug-sensitive]`; fila negativa con Luhn inválido |
| 3. Geometría HiDPI y fail-closed | Mismo secreto a DPR 1 / 1.25 / 2 / 3; granularidad de nodo completo; error de redacción ⇒ estado ruidoso y cero POST |

**Entregable clave:** cada familia enmascara de forma destructiva y demostrable, y un fallo de redacción nunca abre una vía a bytes sin enmascarar.

### Ola 02-05 — Privacidad del payload y presupuestos

**Objetivo:** demostrar que el informe que sale no lleva nada del anfitrión y que el presupuesto se sostiene con el widget completo.

| Tarea | Qué hace |
|---|---|
| 1. Prueba de centinelas | Cookies, `localStorage`, `sessionStorage` y cabecera de autorización sembradas; cero apariciones en cabeceras y cuerpo crudo; sólo `X-Project-Key` e `Idempotency-Key` |
| 2. URL sólo ruta y truncado del título | `meta.url = location.pathname`; título a 200 puntos de código; `type: 'bug'`; validación contra el esquema publicado |
| 3. Presupuesto y cierre | `check:size`, `sdk-runtime-deps`, suite completa en tres motores y corrección documentada de la premisa webkit/WebP (A-14) |

**Entregable clave:** los cinco criterios de éxito del ROADMAP quedan evidenciados y la suite cierra en verde sobre chromium, firefox y webkit.

---

## 4. Modelo de amenazas (STRIDE, resumen)

Los cinco planes declaran **16 amenazas** (T-02-01 … T-02-14 más T-02-SC); el registro consolidado vive en `02-SECURITY.md`.

| Amenaza | Categoría | Severidad | Mitigación en una línea |
|---|---|---|---|
| **T-02-01** | T (manipulación) | high | Texto dinámico sólo por `textContent`, truncado a 240 caracteres, sin sumidero HTML |
| **T-02-02** | T/D | high | Estilos inline `!important` en el host, `all: initial` + re-declaración en px, raíz cerrada, último hijo de `documentElement` |
| **T-02-03** | I (divulgación) | critical | El puerto devuelve `ImageData` (nunca `Blob`); `redact` precede estrictamente a `encode` |
| **T-02-04** | I | medium | Un solo `<style>` dentro de la raíz, tokens `--wb-*` locales, un único global, sin parchear prototipos |
| **T-02-05** | I | high | Política `displaySurface`: `window`/`screen` se rechazan antes de leer píxeles |
| **T-02-06** | R/D | medium | Sonda de uniformidad densa + timeout de 10 s; todo fallo termina en estado visible |
| **T-02-07** | T | high | Gate `sdk-single-encode-sink`: exactamente un `toBlob`, siempre después de `redact` |
| **T-02-08** | I | critical | Catálogo P2-D-07 alineado con C-5, tarjetas por Luhn, sobre-enmascarado conservador |
| **T-02-09** | I | high | Una sola geometría bitmap con redondeo hacia fuera (H-1), probada a DPR 1/1.25/2/3 |
| **T-02-10** | I | critical | Fail-closed: cualquier error de redacción corta antes de codificar y enviar |
| **T-02-11** | I | critical | `buildMeta` por campos explícitos, dos cabeceras, `credentials:'omit'` y `no-referrer` |
| **T-02-12** | I | high | Sólo `location.pathname`; el esquema re-recorta como defensa en profundidad |
| **T-02-13** | I | medium | `sdk-runtime-deps` en verde; `import type` de contratos; cero Zod en el bundle |
| **T-02-14** | I | medium | **Aceptada**: los iframes de origen cruzado no pueden escanearse (AR-01) |
| **T-02-SC** | T | high | Puerta de legitimidad de paquetes; la fase instala cero dependencias |

**Fronteras de confianza cubiertas:** página hostil → widget; texto dinámico → Shadow DOM; superficie de captura → fotograma; DOM hostil → rects de máscara; geometría CSS → bitmap; píxeles → bytes codificados; resultado de redacción → transporte; estado del anfitrión → payload saliente; salida de build → bundle distribuido.

---

## 5. Verificación y criterios de éxito

**Comandos de la fase** (idénticos en las cinco olas, sin excepciones):

| Comando | Qué prueba |
|---|---|
| `npm run verify` | La única suite Playwright: CA-01…CA-05 y las filas por requisito, en chromium + firefox + webkit |
| `npm run check:size` | PRF-01/PRF-02/PRF-03 por carriles: 45 / 25 / 14 / 80 KB gzip |
| `node scripts/gate.mjs` | `sdk-runtime-deps`, `sdk-no-host-storage`, `sdk-single-encode-sink` |
| `npm run build` | Emisión de los seis artefactos (tres carriles × IIFE/ESM) más la variante e2e |
| `npm run check:compose` | Exactamente tres servicios y el volumen de adjuntos sólo en `api` |

**Criterios de éxito del ROADMAP y su evidencia:**

| # | Criterio | Olas que lo evidencian |
|---|---|---|
| 1 | Un `<script async>` o un import ESM + `init()` dan un widget funcional | 02-01 (INT-01, WDG-04), 02-02 (INT-02, INT-05) |
| 2 | El widget funciona bajo CSS hostil, se dibuja encima y no filtra nada | 02-02 (WDG-02/03/05, CA-04) |
| 3 | Captura de pestaña sin el widget, ≤ 16 MP / ≤ 2 MB, sin blanco en HiDPI | 02-03 (CAP-01/04/05) |
| 4 | Password, patrones y `data-watchbug-sensitive` ya rellenos en los bytes que salen | 02-04 (PRV-01/02/03, H-1) |
| 5 | Sin cookies/storage/auth del anfitrión, URL sólo ruta, ≤ 45 KB y cero deps runtime | 02-05 (PRV-05/06, PRF-01/04) |

**Prohibiciones declaradas (must-NOT):**

1. **Nunca transmitir una captura que no se pudo redactar de forma destructiva.** Si falla la redacción, la superficie no es una pestaña o falla el mapeo de geometría, el flujo termina en fallo visible y **no se emite petición**. No existe un camino de «enviar de todos modos».
2. **Nunca usar una primitiva de enmascarado reversible o meramente visual.** Sin desenfoque, sin capas superpuestas, sin relleno semitransparente: sólo destrucción opaca plana (α = 255) grabada en el bitmap antes de codificar.
3. **Nunca mover el núcleo de privacidad a un chunk perezoso** para aliviar el presupuesto: la redacción automática no puede depender de que un chunk cargue antes de una captura.

---

## 6. Supuestos señalados (del plan)

| Supuesto | Decisión registrada |
|---|---|
| **Opciones de `init()`** | `{ projectKey, endpoint? }`; `endpoint` es la base de la API. `user`/`privacy` llegan en Fase 4. Cambiarlo después es disparador de consulta |
| **Supuestos A-1…A-8 del UI-SPEC** | Adoptados como contrato aprobado: orden de ocultación, semántica de `Try again`, paleta clara fija, posición fija, autodescarte 5 s, 240 caracteres, listener de `Escape` removible y escala 4/8/16/24/32 |
| **Lectura de P2-D-03** | «3 intentos con backoff 1/4/10 s» se lee como **3 reintentos tras el envío inicial**, de modo que la escalera y el copy «Retrying (n of 3)» encajan. `MAX_RETRIES` es una constante si el propietario prefiere 3 intentos totales |
| **Política de superficie OQ-1** | Rechazar `window`/`screen`; aceptar `displaySurface` indefinido con salvedad documentada para motores antiguos |
| **Umbral de la sonda de blanco (A9)** | Se ajusta contra el fixture para que una pantalla legítimamente de color plano no se rechace |
| **Premisa webkit/WebP (OQ-2)** | Ninguna fila espera un PNG natural de webkit en este host; M-3 se cubre con el stub forzado. La corrección se registra como enmienda (A-14), sin editar R-12 |
| **Techo de remediación PRF-01** | Si el widget se acerca a 45 KB, sólo se recortan comentarios/minificación; mover el núcleo de privacidad está prohibido y cambiar un nivel del presupuesto pertenece a la Fase 7 |
| **Modo de consumo dual (INT-01 + INT-05)** | El export del módulo es la identidad primaria; `window.Watchbug` es su proyección IIFE. Un solo camino de código sirve a ambos cargadores |

---

## 7. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-xx** | Enmienda del registro de decisiones |
| **AR-xx** | Riesgo aceptado formalmente |
| **CA-xx** | Criterio de aceptación basado en propiedades |
| **CAP-xx** | Requisito de captura |
| **DPR** | *Device Pixel Ratio* |
| **H-x** | Identificador de peligro (*pitfall*) del research |
| **INV-xx** | Invariante arquitectónica |
| **INT-xx** | Requisito de integración |
| **P2-D-xx** | Decisión de implementación local de la Fase 2 |
| **PRF-xx** | Requisito de rendimiento y presupuesto |
| **PRV-xx** | Requisito de privacidad y enmascarado |
| **R-xx** | Decisión del registro global |
| **RNF-xx** | Requisito no funcional |
| **SEC-xx** | Invariante de seguridad |
| **STRIDE** | Marco de modelado de amenazas (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) |
| **T-02-xx** | Amenaza identificada en la Fase 2 |
| **T1/T2/T3** | Momentos del enmascarado (T1 automático en captura; T2/T3 son de Fase 3) |
| **WDG-xx** | Requisito del widget |
| **e2e** | Prueba de extremo a extremo |
