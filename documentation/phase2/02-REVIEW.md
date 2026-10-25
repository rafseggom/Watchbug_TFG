<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Fase 2 — Revisión de código: *SDK Tracer Bullet: Widget, Capture & Auto-Redaction*

| | |
|---|---|
| **Fase** | 2 — *SDK Tracer Bullet: Widget, Capture & Auto-Redaction* |
| **Revisado** | 2026-10-24 (primer pase) · 2026-10-24 (pase de regresión) |
| **Ficheros** | 21 (primer pase) · 10 (regresión) |
| **Hallazgos** | **15** — 5 críticos · 5 avisos · 5 informativos |
| **Estado** | **15 / 15 resueltos** — 0 abiertos, 0 diferidos, 0 omitidos |

> Este documento consolida y resume `02-REVIEW.md`, `02-REVIEW-FIX.md` y `02-REVIEW-DISPOSITION.md`. Es un resumen ejecutivo, no una copia literal.

---

## 1. Resumen

La revisión se hizo en **dos tandas** y esa es la parte importante de la historia:

1. **Primer pase** (`02-REVIEW.md`, profundidad *standard*, 21 ficheros): 9 hallazgos — 3 críticos, 3 avisos, 3 informativos. Las propiedades estructurales del pipeline se sostenían (el puerto sólo puede producir `ImageData`, `redact` precede al sumidero único, un error de redacción corta antes de codificar y enviar, `credentials:'omit'` es la única forma de credenciales, la clave de idempotencia se acuña una vez y se reutiliza en el reintento automático **y** en el manual). **Los defectos estaban en el *alcance* de esos controles, no en su orden** — y dos de los tres críticos contradecían amenazas que el registro daba por cerradas.
2. **Pase de regresión** (`02-REVIEW-FIX.md`, 10 ficheros): revisó **la propia remediación** y encontró **6 defectos nuevos introducidos por los arreglos** — 2 críticos, 2 avisos, 2 informativos. Los seis se cerraron.

**Resultado:** 15/15 resueltos. La lección registrada es que una remediación de seguridad necesita su propio pase adversarial: dos de los arreglos de la primera tanda introdujeron fallos peores que los que corregían.

---

## 2. Hallazgos y disposición

### Primer pase — `02-REVIEW.md`

| ID | Severidad | Título | Estado |
|---|---|---|---|
| **CR-01** | critical | El POST del informe vuelve a filtrar la query string de la página en la cabecera `Referer` | ✅ `c2d7a50` |
| **CR-02** | critical | El patrón de tarjeta se salta una tarjeta válida si los dígitos están pegados: dos tarjetas adyacentes no enmascaran nada | ✅ `7c9b299` |
| **CR-03** | critical | El escaneo del DOM termina en el light DOM del documento superior: sombras e iframes de mismo origen nunca se redactan | ✅ `0c6565f` |
| **WR-01** | warning | La geometría de la máscara se recoge **después** de capturar el frame, no con él | ✅ `0c6565f` |
| **WR-02** | warning | El endpoint por defecto del build ESM es el origen de la **página**, no el del script cargado | ✅ `0c6565f` |
| **WR-03** | warning | La clave de idempotencia cae a `Date.now()` + `Math.random()` en todo contexto no seguro | ✅ `0c6565f` |
| **IN-01** | info | El stub `beyond-cap` asigna el canvas antes de su propio retorno «sin canvas» | ✅ `0c6565f` |
| **IN-02** | info | `truncateReason` corta unidades UTF-16 y puede partir un par sustituto | ✅ `0c6565f` |
| **IN-03** | info | La aserción de igualdad de bytes de P2-D-03 es vacua en WebKit | ✅ `0c6565f` |

### Pase de regresión — `02-REVIEW-FIX.md`

| ID | Severidad | Título | Estado |
|---|---|---|---|
| **FX-01** | critical | La salida «sin CSPRNG» devolvía sin `host.restore()`: el widget quedaba muerto para la sesión | ✅ `12a5049` |
| **FX-02** | critical | El mapa de marcos era sólo traslación: un `transform` CSS colocaba la máscara sobre otros píxeles (fail-open silencioso) | ✅ `12a5049` |
| **FX-03** | warning | `endpoint: null` (forma típica de un JSON) esquivaba la comprobación estricta y caía a `location.origin` | ✅ `12a5049` |
| **FX-04** | warning | La validación de la clave cubría el `.env` pero no `HostFixtureOptions.projectKey` | ✅ `12a5049` |
| **FX-05** | info | La cirugía de bytes corrompió seis guiones largos en comentarios de `redactor.ts` (mojibake) | ✅ `12a5049` |
| **FX-06** | info | El truncado por `MAX_SCAN_DEPTH` era un salto silencioso | ✅ `12a5049` |

**Total: 15/15 resueltos.** Nada quedó abierto, diferido ni omitido.

---

## 3. Detalle de los hallazgos críticos

### CR-01 — Fuga de la query string por `Referer`

**Qué pasaba:** el `fetch` fijaba `credentials:'omit'` y las dos cabeceras del contrato, pero **no** `referrerPolicy`. El navegador añadía un `Referer` derivado de la política del **documento anfitrión**; por defecto (`strict-origin-when-cross-origin`) en una petición del mismo origen viaja la URL **completa, con query**. Y el mismo origen es justo la forma documentada del SDK. Así, `?token=…&code=…&session=…` salía del navegador en cada informe: exactamente lo que R-08 existe para impedir y PRV-06 afirmaba resuelto.

**Por qué importaba:** el esquema y `meta.url` sí estaban limpios, pero el control se quedaba a medias en la cabecera. Peor: la fila PRV-05 allowlisteaba `referer` como cabecera estándar y la fila PRV-06 sólo miraba `meta.url`, así que **ningún test podía detectarlo**.

**Arreglo:** `referrerPolicy: 'no-referrer'` en el mismo `fetch`, con el razonamiento escrito al lado (la política del anfitrión es entrada no confiable). La fila PRV-06 pasa a exigir la **ausencia** de `referer` y deja de contarlo como cabecera segura.

### CR-02 — Dos tarjetas válidas pegadas no se enmascaraban

**Qué pasaba:** el patrón de tarjeta trataba un espacio o guion como separador y **pegaba** la tarjeta a los dígitos siguientes; el match codicioso se cortaba a 19 dígitos. La validación Luhn recibía un núcleo pegado, fallaba, y `regex.exec()` avanzaba `lastIndex` hasta el **final** del match fallido: nunca se probaba una interpretación más corta.

Reproducible con el propio regex del fichero:

| Texto | ¿Enmascarado? |
|---|---|
| `4111111111111111 4242424242424242` (dos válidas) | **no** |
| `4111-1111-1111-1111 5454-…` | **no** |
| `4111111111111111 1234` | **no** |
| `4111111111111111-2026` | **no** |
| `4111111111111111` (aislada) | sí |

**Arreglo:** `luhnValidCardRun` valida **grupos separados** y **uniones de grupos adyacentes** de 13–19 dígitos. Se descartó explícitamente recorrer sub-ventanas arbitrarias: los prefijos de 14 y 15 dígitos del lookalike bloqueado son ellos mismos Luhn-válidos, así que esa vía rompería el control negativo que la suite fija. Se añadió una fila e2e con las dos tarjetas pegadas.

### CR-03 — El escáner no atravesaba sombras ni iframes

**Qué pasaba:** las tres rutas de detección (`querySelectorAll` sensible, `querySelectorAll` de valores y `TreeWalker` de texto) estaban acotadas al light DOM del documento superior. Ni atraviesan una raíz de sombra ni llegan al `contentDocument` de un iframe. Por tanto, un `input[type=password]` o un bloque `data-watchbug-sensitive` dentro de una **sombra abierta** (Lit/Stencil son comunes) o de un **iframe de mismo origen** (pagos/login embebidos) se pintaba sin enmascarar; sus píxeles sí viajan con la pestaña.

**Por qué era crítico:** no lo cubría AR-01, que está acotado a **iframes de origen cruzado**. Las sombras abiertas y los iframes de mismo origen **sí** son alcanzables: el escáner simplemente no miraba. El registro declaraba `threats_open: 0` sobre una cobertura no examinada.

**Arreglo:** recorrido recursivo por **todo** root alcanzable — light DOM, `element.shadowRoot` (sólo raíces abiertas) e `iframe.contentDocument`/`frame.contentDocument` — con traducción de coordenadas por el origen de la caja del marco y cota de anidamiento `MAX_SCAN_DEPTH = 8`. Lo inaccesible (sombras cerradas, iframes de origen cruzado) queda declarado como limitación. Filas e2e nuevas con secreto en sombra abierta **y** en iframe desplazado.

---

## 4. Detalle de los avisos

### WR-01 — La máscara se medía después del frame

La lectura de píxeles ocurre dentro de `capture()`, pero los rects se recogían después de la sonda, del `restore` y de un recorrido completo del DOM. Cualquier desplazamiento de layout en esa ventana (una animación `rAF`, un re-render, un scroll) movía el secreto fuera de su máscara. El redondeo hacia fuera (±1 px) no absorbe una traslación animada de un frame.

**Arreglo:** el puerto `Redactor` separa `collect()` de `redact(image, rects?)`, y el pipeline mide los rects **dentro del gancho `beforeRead`**, en el mismo instante en que se leen los píxeles. Si un `CaptureSource` no invocara `beforeRead`, `redact` vuelve a medir: degrada a la medida posterior, **nunca** a bytes sin redactar.

### WR-02 — El endpoint por defecto del ESM era el origen de la página

`document.currentScript` es `null` en un módulo, así que la constante cae a `document.baseURI`: en una integración ESM de origen cruzado los informes van al origen de la **app**, no al de Watchbug (CORS/404 tras la escalera completa de reintentos).

**Arreglo (lectura estricta):** el endpoint por defecto es **siempre** `location.origin`. Si el origen del script difiere del del documento y no se pasa `endpoint`, `init()` **lanza** con un mensaje accionable en vez de adivinar. En la lane ESM no se dispara (no hay script clásico), que es lo correcto. **Decisión del propietario (2026-10-25): se mantiene el lanzamiento; la alternativa blanda queda cerrada.** Es un cambio de interfaz pública registrado como disparador de consulta en su momento.

### WR-03 — Clave de idempotencia no criptográfica

`crypto.randomUUID` exige contexto seguro; en HTTP plano —la audiencia principal— la clave era `Date.now()` + `Math.random()`, ~41 bits y sin forma UUID. Una colisión devuelve la respuesta almacenada por otro en lugar de registrar el informe: un envío perdido en silencio.

**Arreglo:** UUID v4 construido con `crypto.getRandomValues` (que **sí** existe en contexto inseguro). Si no hay CSPRNG **no se emite petición**: el flujo termina en el estado visible `capture`. Este arreglo es el que introdujo FX-01.

---

## 5. Los seis defectos de la remediación (pase de regresión)

| ID | Qué introdujo el arreglo | Cómo se cerró |
|---|---|---|
| **FX-01** | La salida «sin CSPRNG» devolvía sin restaurar el host; el launcher ya lo había ocultado, así que el estado terminal se pintaba dentro de un host `display:none`: **widget muerto para la sesión** | `host.restore()` en esa salida + fila `WR-03 guard` que quita las dos entradas del CSPRNG, dispara el gesto y exige que el host vuelva a estar visible y que no salga ninguna petición |
| **FX-02** | El mapa de marcos era sólo traslación: un `transform` CSS en un marco o ancestro colocaba la máscara sobre otros píxeles (**fail-open silencioso**) | El mapa queda custodiado: un marco cuya ruta no sea traslación pura, o cuyo tamaño renderizado difiera del de layout, se **rechaza** y el flujo falla en cerrado. Fila `S-7 guard` con un marco rotado |
| **FX-03** | `endpoint: null` (forma realista de config JSON) esquivaba la comprobación de `undefined` y caía por `??` a `location.origin` | Un `endpoint` que no sea cadena es error duro **antes** de las dos decisiones; se aserta dentro de la fila S-8 |
| **FX-04** | La validación de la clave cubría el `.env` pero no `HostFixtureOptions.projectKey` | Los dos caminos pasan por `fixtureKey()`, con la misma forma canónica |
| **FX-05** | La cirugía de bytes corrompió seis guiones largos en comentarios de `redactor.ts` | Restaurados; barrido de mojibake sobre los 10 ficheros limpio |
| **FX-06** | El truncado por `MAX_SCAN_DEPTH` era un **salto silencioso**, contra la propia afirmación del módulo | El exceso de profundidad **lanza**: un subárbol al que no se desciende sacaría sus secretos sin enmascarar |

El mismo pase declaró **sano el resto**: traducción y corrección de *realm* en roots anidados, caminata única del contenido *slotted*, propagación *fail-closed*, población de `measured.rects` y su interacción con el reintento y la idempotencia, la lane ESM, los tres refactors de complejidad y el tripwire de build.

---

## 6. Puertas tras la corrección

| Comando | Resultado |
|---|---|
| `npm run verify` | **309/309** (chromium + firefox + webkit; eran 297 antes de la remediación) |
| `npm run lint` | limpio (`tsc` por workspace) |
| `npm run check:size` | core **9,4** · lazy 0,3 · adapter 0,3 · runtime **10,1 KB gz** sobre 45 / 25 / 14 / 80 |
| `node scripts/gate.mjs` | 3 passed, 0 failed, 0 skipped |
| `npm run check:compose` | exactamente tres servicios |
| `stopthatslop check --pack ts` | `gate_finding_count: 0`, **exit 0** |

**Filas nuevas de la remediación (4):** `S-7 / PRV-02` (sombra abierta + iframe), `S-8` (script de origen cruzado sin endpoint se niega; con endpoint publica exactamente ahí), `S-7 guard` (marco rotado rechazado, cero POST), `WR-03 guard` (sin CSPRNG falla a la vista y el host sigue usable). **Filas modificadas (2):** `fail-closed` (orden real de la tier *seam* tras WR-01) y `P2-D-03` (no vacuidad explícita en bytes).

**Delta de presupuesto:** `watchbug.js` pasó de 8745 a 9628 B gz (8,54 → 9,40 KB), menos de una cuarta parte del tope de 45 KB. Cero dependencias nuevas. *(Cifras finales tras la UAT: **315/315**, core **9,3** / runtime **10,0 KB gz**.)*

---

## 7. Decisiones del propietario (2026-10-25)

| Decisión | Resolución | Efecto |
|---|---|---|
| Mantener el `init()` estricto o suavizarlo a aviso con caída a `location.origin` | **Mantener el lanzamiento** | El disparador de consulta por cambio de interfaz pública queda cerrado |
| Mapear marcos escalados/rotados con matrices completas o rechazarlos | **Rechazo fail-closed como backlog deliberado** | No es un olvido ni una regresión; si un integrador lo necesita, el paso es `scale = box.width / offsetWidth` con guarda de escala no uniforme |

---

## 8. Leyenda de siglas y abreviaturas

| Sigla | Significado |
|---|---|
| **CR-xx** | Hallazgo crítico de la revisión |
| **CSPRNG** | Generador de números pseudoaleatorios criptográficamente seguro |
| **FX-xx** | Defecto introducido por la remediación (pase de regresión) |
| **IN-xx** | Hallazgo informativo |
| **P2-D-xx** | Decisión de implementación local de la Fase 2 |
| **PRV-xx** | Requisito de privacidad y enmascarado |
| **R-08** | Decisión de URL sólo ruta |
| **SEC-xx** | Invariante de seguridad |
| **T1** | Momento de redacción automática en la captura |
| **WR-xx** | Hallazgo de aviso (*warning*) |
| **e2e** | Prueba de extremo a extremo |
