<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 2 — Verificación: *SDK Tracer Bullet: Widget, Capture & Auto-Redaction*

| | |
|---|---|
| **Fase** | 2 — *SDK Tracer Bullet: Widget, Capture & Auto-Redaction* |
| **Verificado** | 2026-10-25 |
| **Verdades** | **38 / 38** (5 criterios del ROADMAP + 33 de los planes) |
| **Requisitos** | **18 / 18** |
| **Suite** | **315 / 315** en chromium + firefox + webkit |
| **Estado** | `passed` — 0 fallos, 0 comprobaciones humanas pendientes |

> Este documento consolida y resume `02-VERIFICATION.md`, `02-VALIDATION.md`, `COVERAGE.md` y `02-UAT.md`. Es un resumen ejecutivo, no una copia literal.

---

## 1. Objetivo de la fase y método

**Objetivo:** que un usuario final abra el widget en cualquier página anfitriona, capture la pestaña actual con los datos sensibles destruidos **antes** de que nada salga del navegador, y archive un informe que se renderiza en el panel.

**Método:** verificación *goal-backward* sobre las verdades de los cinco planes, con la **única** suite Playwright (R-12) como evidencia de comportamiento, más `check:size` y `gate.mjs`. Las afirmaciones de los SUMMARY se trataron como **claims** y se re-derivaron de la fuente y de ejecuciones reales.

**Línea base de evidencia (HEAD `7012d3a`):**

| Comprobación | Comando | Resultado |
|---|---|---|
| Suite completa | `npm run verify` (stack arriba, `/api/health` → ok) | **297 passed, 0 failed, 0 flaky** (8,2 min) |
| Puerta de tamaño | `npm run check:size` | PASSED — core 8,5/45, lazy 0,3/25, adapter 0,3/14, runtime 9,2/80 KB gz |
| Gate estático | `node scripts/gate.mjs` | 3 passed, 0 failed, 0 skipped |
| Árbol de trabajo | `git status --porcelain` | limpio salvo ruido LF/CRLF en `schema/report.schema.json` |

**Evidencia vigente (2026-10-25, cierre):** `npm run verify` **315/315** (7,2 min), `check:size` core **9,3** / runtime **10,0 KB gz**, `gate.mjs` 3/3, `check:compose` OK, `stopthatslop` 0 findings. La UAT real pasó en chromium y firefox; el único defecto que encontró (falso «blank» en páginas escasas) se corrigió con un barrido denso y su fila de regresión.

---

## 2. Verdades observables (38/38)

### Criterios de éxito del ROADMAP (5)

| # | Verdad | Estado | Evidencia |
|---|---|---|---|
| **SC-1** | Una etiqueta async o un import ESM + `init()` dan un widget funcional | ✓ | `e2e/sdk.spec.ts` INT-01/INT-05 (×3 motores); `index.ts` valida opciones |
| **SC-2** | El widget aguanta CSS hostil, se dibuja encima y no filtra nada | ✓ | WDG-02 (5 variantes + control CA-04), WDG-03, WDG-05 ×4, WDG-04 (delta de globales = 1) |
| **SC-3** | Captura por prompt, sin el widget, ≤16 MP / ≤2 MB, sin blanco en HiDPI | ✓ | CAP-01/04/05; constantes de contratos; escalera de codificación |
| **SC-4** | Password, patrones y `data-watchbug-sensitive` rellenos en **cada byte** que sale | ✓ (acotado y ampliado) | Filas de artefacto PRV-01/02/03 + H-1; CR-03 corregido: ahora sombras abiertas e iframes de mismo origen también se escanean |
| **SC-5** | Sin cookies/storage/auth, URL sólo ruta, ≤45 KB, cero deps runtime | ✓ | PRV-05/06, `credentials:'omit'` + `no-referrer`, `check:size`, `sdk-runtime-deps` |

### Ola 02-01 (3 verdades)

| # | Verdad | Estado |
|---|---|---|
| P1-T1 | Una `<script src async>` arranca el widget; el global IIFE es `window.Watchbug` | ✓ |
| P1-T2 | El snapshot global difiere en exactamente una propiedad; prototipos intactos; IIFE +1 / ESM +0 | ✓ |
| P1-T3 | Artefactos e2e `watchbug.e2e.{js,mjs}` con nombres distintos; `check:size` sólo mide los de producción | ✓ (hoy emitidos en `dist/e2e/`) |

### Ola 02-02 (12 verdades)

| # | Verdad | Estado |
|---|---|---|
| P2-T1 | Un gesto lleva a un informe que aterriza en el panel (201 + fila) | ✓ |
| P2-T2 | El build ESM arranca el mismo widget y añade cero globales | ✓ |
| P2-T3 | `<button>` real de 48×48 en la raíz; el clic inicia el flujo; deshabilitado en vuelo | ✓ |
| P2-T4 | La matriz hostil no rompe el widget, con control que prueba que cada regla aplicó | ✓ |
| P2-T5 | Tras init y flujo completo el anfitrión no ganó estilos, clases ni custom properties | ✓ |
| P2-T6 | El widget gana a un modal hostil de z-index máximo y el flujo completa | ✓ |
| P2-T7 | Un elemento hostil en las coordenadas del widget no captura su hit target ni traga clics del anfitrión | ✓ |
| P2-T8 | Página vacía → lanzador a 24 px, el clic inicia el flujo | ✓ |
| P2-T9 | Empate de z-index resuelto por orden DOM; re-append tras reemplazar `documentElement` | ✓ |
| P2-T10 | Copy en vuelo `Capturando… → Enviando… → Reintentando (n de 3)` con spinner 12×12; lanzador deshabilitado | ✓ |
| P2-T11 | Todo fallo terminal pinta titular + pista + `Try again`/`Dismiss`; nunca se envía un blanco en silencio | ✓ |
| P2-T12 | *(backstop)* El motivo del servidor se trunca a 240 caracteres con elipsis en el panel de 320 px | ✓ |

### Ola 02-03 (6 verdades)

| # | Verdad | Estado |
|---|---|---|
| P3-T1 | Un gesto lleva a la costura de captura real (stub por motor) y produce un `ImageData` crudo | ✓ |
| P3-T2 | La captura nunca contiene el widget: oculto antes del prompt, restaurado tras el frame, fallo ruidoso si no está oculto | ✓ |
| P3-T3 | Clamps ≤16 MP, ≤2 MB (objetivo 800 KB), DPR ≤2, HiDPI no blanco | ✓ |
| P3-T4 | Frame uniforme o por encima del tope aborta antes de cualquier petición | ✓ |
| P3-T5 | Superficie no-pestaña rechazada en voz alta, nada enviado | ✓ |
| P3-T6 | Fallback WebP→PNG detectado por `blob.type`; parte PNG aceptada con 201 | ✓ (provocado por stub; A-14) |

**Prohibición de la ola:** «nunca un fallback de enviar de todos modos» → **sostenida**: el pipeline retorna antes de codificar/enviar ante error de redacción, superficie no-pestaña o frame en blanco; la fila `fail-closed` aserta cero intentos de POST.

### Ola 02-04 (6 verdades)

| # | Verdad | Estado |
|---|---|---|
| P4-T1 | Valores de `input[type=password]` rellenos con α=255 antes de codificar; sin píxeles originales ni en el anillo de 1 px | ✓ |
| P4-T2 | JWT / bearer / asignaciones / tarjeta Luhn enmascaran el nodo completo; controles negativos sobreviven | ✓ |
| P4-T3 | `data-watchbug-sensitive` enmascarado en el rect completo, redondeado hacia fuera | ✓ |
| P4-T4 | Geometría bitmap desde la primera máscara: DPR 1 / 1,25 / 2 / 3 sin fuga de caracteres de borde | ✓ |
| P4-T5 | Al coincidir, se enmascara el elemento o nodo completo (sobre-enmascarar es preferible) | ✓ |
| P4-T6 | Un error de redacción no envía nada y aterriza en fallo ruidoso | ✓ |

**Prohibición de la ola:** «la única primitiva automática es destrucción opaca plana (α 255) quemada antes de codificar; sin desenfoque, sin overlay, sin relleno semitransparente» → **sostenida**: `redactor.ts` escribe RGB 0/0/0 + α=255 directamente en `ImageData`; grep no encuentra `blur(`, overlays ni máscaras CSS; `sdk-single-encode-sink` PASS.

### Ola 02-05 (6 verdades)

| # | Verdad | Estado |
|---|---|---|
| P5-T1 | Centinelas en cookies/storage/cabecera de auth nunca llegan al informe; sólo `X-Project-Key` + `Idempotency-Key` | ✓ |
| P5-T2 | `meta.url` sólo ruta: query y fragmento eliminados por el SDK (y re-recortados por el esquema) | ✓ |
| P5-T3 | `check:size` prueba core ≤45 KB con el widget completo; el artefacto e2e nunca se mide como producción | ✓ |
| P5-T4 | Cero dependencias runtime; contratos sólo tipos/constantes (Zod borrado) | ✓ |
| P5-T5 | `title` = `document.title` truncado a 200 puntos de código; `type:'bug'`; meta por mapeo explícito | ✓ |
| P5-T6 | Cero peticiones a terceros: sólo la base configurada de la API | ✓ |

---

## 3. Prohibiciones (must-NOT) — veredicto global

| Prohibición | Veredicto | Evidencia |
|---|---|---|
| Nunca transmitir una captura que no se pudo redactar destructivamente | **Sostenida** | `pipeline.ts` retorna antes de codificar/enviar; fila `fail-closed` con cero POST |
| Nunca una primitiva de enmascarado reversible o meramente visual | **Sostenida** | Relleno plano directo en `ImageData`; grep sin `blur`/overlay; gate del sumidero único |
| Nunca mover el núcleo de privacidad a un chunk perezoso por presupuesto | **Sostenida** | Todo el flujo es alcanzable sólo desde el entry core; `check:size` mide el core completo |
| Enmascarado del usuario en el editor | **Fuera de alcance** | Pertenece a la Fase 3 (T2/T3) |

---

## 4. Criterios de éxito del ROADMAP

Los cinco criterios quedan evidenciados en las olas 2–5 (ver §2). El único matiz registrado históricamente fue de **alcance**, no de cumplimiento: la frase «en la captura que el usuario ve» de SC-4 no tenía superficie propia en la Fase 2 (el envío es directo; la revisión previa es PRV-07, Fase 3). Con la corrección de CR-03, la cobertura del escáner pasó de «sólo light DOM» a «todo root alcanzable», que es estrictamente más de lo que SC-4 exigía.

---

## 5. Cobertura de requisitos (18/18)

La unión de `requirements:` de los cinco planes es **exactamente** el conjunto de 18 IDs de la fase; `REQUIREMENTS.md` mapea los mismos 18 a la Fase 2. **0 huérfanos, 0 IDs no planificados.**

| ID | Ola | Descripción | Estado | Evidencia |
|---|---|---|---|---|
| INT-01 | 02-01 | Etiqueta async, sin paso de build | ✓ | Filas INT-01; `globalName` IIFE |
| INT-02 | 02-02 | `init()` con clave pública y opciones → informe | ✓ | Fila INT-02 (201 real + fila en panel) |
| INT-05 | 02-02 | Consumo como módulo ES | ✓ | Fila INT-05 (cero globales) |
| WDG-01 | 02-02 | Apertura desde lanzador flotante | ✓ | Filas WDG-01 |
| WDG-02 | 02-02 | CSS hostil no rompe el widget | ✓ | WDG-02 ×5 + CA-04 |
| WDG-03 | 02-02 | Cero fugas de estilos/clases/variables | ✓ | WDG-03 (enumeración de `--wb-`) |
| WDG-04 | 02-01 | Un global, sin parchear prototipos | ✓ | WDG-04 |
| WDG-05 | 02-02 | Se dibuja sobre todo | ✓ | WDG-05 ×4 |
| CAP-01 | 02-03 | Captura por prompt del navegador | ✓ | CAP-01 ×2; picker real = humano #1 |
| CAP-04 | 02-03 | La captura nunca contiene el widget | ✓ | CAP-04 |
| CAP-05 | 02-03 | ≤16 MP / ≤2 MB sin blanco en HiDPI | ✓ | CAP-05 ×4 |
| PRV-01 | 02-04 | Password excluido automáticamente | ✓ | Fila de artefacto PRV-01 |
| PRV-02 | 02-04 | Credenciales/tokens/tarjetas redactados | ✓ | PRV-02 ×6 con controles negativos |
| PRV-03 | 02-04 | `data-watchbug-sensitive` redactado | ✓ | Fila de artefacto PRV-03 |
| PRV-05 | 02-05 | Nunca lee ni transmite credenciales del anfitrión | ✓ | PRV-05 + gate estático |
| PRV-06 | 02-05 | Query/fragmento eliminados | ✓ | PRV-06 sobre bytes crudos |
| PRF-01 | 02-05 | Script inyectado ≤45 KB gz | ✓ | `check:size` |
| PRF-04 | 02-05 | Cero dependencias runtime | ✓ | `sdk-runtime-deps` |

**Fuera del conjunto de requisitos de la fase (no son carencias):** WDG-06/RNF-03 y CAP-02/CAP-03/PRV-04/PRV-07 → Fase 3; ENR-01…05, INT-03/04 → Fase 4; PRF-02/03 → Fase 3; ING-02/PRF-05/DEP-04 → Fase 7.

---

## 6. Traza de flujo de datos (Nivel 4)

| Artefacto | Variable | Origen | ¿Datos reales? | Estado |
|---|---|---|---|---|
| Lanzador → estados del panel | `StatusView` desde `createCaptureFlow.onView` | Resultados reales de captura/encode/envío | Sí — éxito, reintento, rechazo y fallo se manejan con resultados vivos | ✓ |
| Meta del informe | `buildMeta(document, location)` | `document.title` + `location.pathname` del anfitrión | Sí — contrastado con los valores que fija el test | ✓ |
| Parte de imagen | `encodeLadder(imageData)` | Píxeles reales de la costura de captura | Sí — decodificada y asertada píxel a píxel | ✓ |
| Fila del panel (cláusula del objetivo) | `GET /api/incidents` | PostgreSQL vía el stack compose | Sí — INT-02 lee la fila por nginx tras el 201 | ✓ |
| Rects de máscara | `collectMaskRects(document)` en tiempo de redacción | DOM vivo en el clic | Sí — los controles negativos prueban discriminación, no una lista estática | ✓ |

---

## 7. Verificación de enlaces clave

| Desde | Hacia | Vía | Estado |
|---|---|---|---|
| Define `SHADOW_MODE` | `attachShadow({mode})` → registro de raíces que lee Playwright | `build.mjs` (prod `closed`, e2e `open`), `host.ts`, costura | ✓ |
| Lista `!important` inline del host | Tiers de `check:size` por nombre de fichero | `host.ts` ↔ `check-size.mjs` | ✓ |
| Handler del lanzador | `getDisplayMedia` con activación transitoria | `launcher.ts` → flujo → `pipeline.ts` sin `await` previo | ✓ |
| `init({projectKey,endpoint})` | `X-Project-Key` → clave sembrada en Fase 1 | `index.ts` → `lane1.ts` | ✓ |
| Costura `ImageData` | Relleno destructivo → sumidero único | `pipeline.ts` → `lane1.ts` | ✓ |
| `range.getClientRects()` | `toBitmapRect()` | `fillRects` en `redactor.ts` | ✓ |
| Catálogo de patrones | Familias del scrubber C-5 (Fase 4) | `patterns.ts` documenta la alineación | ✓ (contrato; C-5 aún no existe) |
| `MASK_ALPHA_OPAQUE` | Bucle de relleno | `redactor.ts` ← `constants.ts` (255) | ✓ |
| `sdk-no-host-storage` | Fila de centinelas PRV-05 | Mitad estática + dinámica de SEC-03 | ✓ |
| Tiers por nombre | Nombres `watchbug.e2e.*` | `check-size.mjs` + `build.mjs` | ✓ |
| Bloque runtime de `packages/sdk` | Regla `sdk-runtime-deps` → imports sólo tipo | `gate.mjs` + `index.ts` | ✓ |
| `Idempotency-Key` acuñada una vez | Misma clave en reintentos → índice único de Fase 1 | `pipeline.ts`, `lane1.ts` | ✓ |
| `buildMeta()` | `reportSchema` `z.strictObject` | `lane1.ts` → `packages/contracts` | ✓ |

---

## 8. Comprobaciones puntuales de comportamiento

| Comportamiento | Comando | Resultado |
|---|---|---|
| Suite única (todas las filas, 3 motores) | `npm run verify` | **315 passed / 0 failed** |
| Presupuesto con el widget completo | `npm run check:size` | **PASSED** (core 9,3/45 KB gz) |
| Gates estáticos | `node scripts/gate.mjs` | 3 passed, 0 failed, 0 skipped |
| Artefactos e2e emitidos | `ls packages/sdk/dist` | `watchbug.js/.mjs`, `dist/e2e/watchbug.e2e.*`, annotator + dom-serialize |
| Cobertura de filas por requisito (enumeración, no ejecución) | conteo de títulos `test(` + log | **54 filas de fase por motor** tras la remediación (51 definiciones `test()`, algunas parametrizadas); los 18 IDs tienen ≥1 fila nombrada |
| Regresión de la fase previa (01, 40/40) | misma ejecución | `ingest`, `hostile`, `deploy`, `read-surface` en verde |

**Sondas:** no existen `scripts/*/tests/probe-*` ni los planes declaran sondas; las comprobaciones equivalentes (`check:size`, `gate.mjs`, `verify`) se ejecutaron directamente.

---

## 9. Escaneo de anti-patrones

| Fichero | Patrón | Severidad | Impacto |
|---|---|---|---|
| — | Marcadores de deuda (`TBD`/`FIXME`/`XXX`) en 15 ficheros de implementación + 4 e2e | ✅ ninguno | — |
| `strings.ts` | Coincidencias de «placeholder» | ℹ️ info | Falso positivo: sustitución `{placeholder}` de `t()`, no un stub |
| `capture/redact/transport` | `return null` | ✅ ninguno | Salidas tempranas guardadas (costura, rect de área cero, 201 sin cuerpo JSON) |
| `schema/report.schema.json` | Cambio sin confirmar en el árbol | 📋 aviso | `git diff` vacío (sólo LF→CRLF); artefacto regenerado, sin delta de comportamiento |

Sin stubs, copy de relleno, handlers que sólo hacen `console.log` ni datos vacíos en ninguna ruta de render. El único «Known Stub» del 02-01 (`onRetry`) quedó cerrado y se ejercita en la fila P2-D-03.

---

## 10. Estrategia de validación (Nyquist)

| Propiedad | Valor |
|---|---|
| Estado | `validated` · `nyquist_compliant: true` · `wave_0_complete: true` |
| Framework | Playwright 1.63.0, 3 proyectos, `workers: 1`, health gate |
| Carril rápido | 27,1 s medidos (presupuesto 30 s) |
| Suite completa | 7,2 min |
| Requisitos en el mapa | 18 |
| Brechas (MISSING + PARTIAL) | **0** |
| Filas verdes | **18 / 18** |

**Por qué no se generaron tests:** Step 3 encontró cero brechas; cada requisito ya mapea a un artefacto automatizado verde. R-12 prohíbe añadir tests más allá de la suite única, así que rellenar una brecha habría significado crear el framework que el propietario rechazó dos veces. **No se modificó ni un fichero de fuente o de test por esta auditoría.**

**Sólo manual:** el flujo real del selector del sistema (`getDisplayMedia` no es automatizable de forma fiable) y el fallback WebP→PNG del Safari real (no hay Safari en este host; se cubre con el stub PNG forzado).

---

## 11. Hallazgos de revisión resueltos desde el informe previo

| Hallazgo | Severidad | Disposición | Confirmación en fuente |
|---|---|---|---|
| CR-01 fuga por `Referer` | critical | corregido | `referrerPolicy:'no-referrer'` en `lane1.ts`; fila PRV-06 exige ausencia de `referer` |
| CR-02 tarjetas pegadas | critical | corregido | `luhnValidCardRun` valida grupos y uniones adyacentes; fila e2e dedicada |
| CR-03 escáner sólo light DOM | critical | **corregido** (antes abierto) | `collectScanRoots` recorre sombras abiertas e iframes de mismo origen; fila `S-7 / PRV-02` |
| WR-01 geometría tardía | warning | corregido | Rects medidos dentro de `beforeRead` |
| WR-02 endpoint ESM/página | warning | corregido | Endpoint por defecto = origen del documento; origen cruzado sin `endpoint` **lanza** |
| WR-03 clave no criptográfica | warning | corregido | UUID v4 desde `getRandomValues`; sin CSPRNG no hay petición |
| IN-01 stub asigna canvas antes del retorno | info | corregido | Retorno izado por encima del canvas |
| IN-02 corte UTF-16 | info | corregido | Corte por puntos de código |
| IN-03 igualdad de bytes vacua en WebKit | info | corregido | No vacuidad donde el payload es observable + condición de motor declarada en la fila |
| FX-01…FX-06 | 2 críticos, 2 avisos, 2 info | corregidos | Ver `02-REVIEW.md` §5 |

---

## 12. Verificación humana (UAT)

`02-UAT.md` arrancó en `testing` con **5 ítems**; cerró en **`complete` con 5/5** el 2026-10-25:

| # | Ítem | Resultado |
|---|---|---|
| 1 | Captura real sin stub en chromium y firefox (selector del sistema) | ✅ **pasada**: picker real, frame capturado, host oculto, 201, fila en el panel y máscaras negras planas en el informe |
| 2 | Pase visual/interacción contra `02-UI-SPEC.md` | ✅ **pasada**: manual idle/`Capturing…`/`Sending…`/`Report sent ✓` + máscaras; matriz de estados completa en `02-UI-REVIEW.md` (**22/24 PASS**, 0 BLOCK) |
| 3 | Disposición de CR-03 | ✅ **resuelto por código** (`0c6565f`), no diferido |
| 4 | Disposición de F-08 (atributo `lang`) | ✅ **corregido**: `lang="en"` en la raíz de contenido + fila e2e `F-08` |
| 5 | Cerrar o aceptar `WINDOWS.md` #5 | ✅ **cerrado**: criterio de release corregido en `REQUIREMENTS.md` + `gsd-tools windows fixed 5` |

**Hallazgo de la UAT y corrección.** La primera captura real (página blanca con un `<h1>`) abortó con `The capture came back blank.`: la sonda muestreaba 9 puntos fijos al 25/50/75 % y ninguno tocaba el título. Era un **falso positivo funcional** que bloqueaba páginas legítimamente escasas. Se sustituyó por un **barrido denso de uniformidad** (un frame sólo es «blank» si todos sus píxeles son idénticos; ~47 ms en el peor caso de 16 MP) y se añadió la fila de regresión `P2-D-12: a sparse but real page … is not blank`. Las filas de frame uniforme y de área por encima del tope siguen verdes: la garantía de «nunca enviar un blanco» no se debilitó.

**Resultado UAT:** 5/5, 0 fallos de producto abiertos.

---

## 13. Resumen de carencias

**Ninguna verdad fallida.** Las 38 verdades (5 del ROADMAP + 33 de los planes) se apoyan en artefactos cableados y en evidencia de ejecución real: 315/315 filas en tres motores, `check:size` PASSED y `gate.mjs` 3/3. Los 18 requisitos están contabilizados con fila nombrada o gate; 0 huérfanos; la fase 1 no muestra regresión.

**La fase está `passed`.** No quedan comprobaciones humanas bloqueantes. Los elementos diferidos por diseño (i18n, revisión previa al envío, chunk del anotador) pertenecen a fases posteriores del roadmap, no son carencias de esta. Siguen siendo del **operador**, no de la fase: repetir la sonda de cookie de WebKit en otro host, escribir la guía de integración (fase 5+) y comprobar una capa CSP externa en otro despliegue.

---

## 14. Cobertura de API externa

**No aplica.** La fase construye el SDK de navegador de Watchbug y consume sólo APIs de plataforma (`getDisplayMedia`, canvas) más el endpoint de ingesta propio de la Fase 1 (`POST /api/incidents`). No se integra ningún servicio, SDK ni API de terceros. La sonda de detección devolvió `detected: false` en tiempo de plan y la declaración se mantiene como seguro para la re-ejecución al sellar.

---

## 15. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **A-14** | Enmienda que corrige la premisa webkit/WebP |
| **CA-xx** | Criterio de aceptación basado en propiedades |
| **CAP-xx** | Requisito de captura |
| **CR-xx** | Hallazgo crítico de la revisión |
| **DPR / DSF** | *Device Pixel Ratio* / *Device Scale Factor* |
| **FX-xx** | Defecto introducido por la remediación |
| **H-1** | Peligro de mala registración de la geometría |
| **IN-xx** | Hallazgo informativo |
| **INT-xx** | Requisito de integración |
| **M-6** | Requisito de fallo ruidoso |
| **Nyquist** | Criterio de muestreo de validación (ninguna tarea sin verificación cercana) |
| **PRF-xx** | Requisito de rendimiento y presupuesto |
| **PRV-xx** | Requisito de privacidad y enmascarado |
| **UAT** | *User Acceptance Testing* — verificación humana |
| **WDG-xx** | Requisito del widget |
| **WR-xx** | Hallazgo de aviso |
| **e2e** | Prueba de extremo a extremo |
