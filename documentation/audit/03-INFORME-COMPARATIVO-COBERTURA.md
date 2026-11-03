<p align="center">
  <img src="../img/banner-etsii.png" alt="Universidad de Sevilla — Escuela Técnica Superior de Ingeniería Informática" width="460" />
</p>

<p align="center">
  <sub><b>Trabajo Fin de Grado · Ingeniería del Software</b></sub><br />
  <sub>Watchbug SDK &nbsp;·&nbsp; Nerea Jiménez Adorna &nbsp;·&nbsp; Rafael Segura Gómez</sub>
</p>

---

# Documento 3 — Informe comparativo y auditoría de cobertura

| | |
|---|---|
| **Proyecto** | Watchbug SDK |
| **Fecha** | 2026-11-03 |
| **Objeto** | Comparar la suite manual del Documento 2 (67 casos) con los tests planificados/ejecutados en `.planning` |
| **Base documental** | `03-08-CONVERSION-LEDGER.md`, `01/02/03-VERIFICATION.md`, `01/02/03-UAT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md` |
| **Suites comparadas** | UAT manual original (16 ítems) · e2e final (90 filas / 14 journeys / 279 instancias) · baseline e2e (148 declaraciones / 453 instancias) · Vitest (168) · VRT (2) |
| **Resultado de la comparación** | Doc. 2 tiene **más casos que el UAT original (+51, +319 %)** pero **menos unidades que la suite automatizada (−193, −74 %)**, con **más amplitud de requisitos (70/70 vs 41/70)** |
| **Modo** | Auditoría documental; no se ha ejecutado ninguna suite |

---

## 0. Resumen ejecutivo

La comparación no admite una respuesta binaria («más» o «menos») porque las dos suites **no cuentan lo mismo**:

- El **UAT original** es un conjunto de **16 comprobaciones de cierre de fase** (4 en Fase 1, 5 en Fase 2, 7 en Fase 3). El Documento 2 diseña **67 casos**, es decir, **51 más (+319 %)**. La razón es simple: el UAT original verificaba que la fase estaba *viva*, no que cada requisito tuviera un recorrido de aceptación.
- La **suite e2e final** tiene **90 declaraciones** agrupadas en **14 journeys** y **279 instancias** en tres motores. El Documento 2 tiene **67 casos**: **23 menos que las declaraciones (−25,6 %)** y **212 menos que las instancias (−76 %)**, pero **53 más que los journeys (+379 %)**. La causa es la unidad de medida: un caso manual agrupa varios pasos y aserciones que la suite automatizada separa en filas.
- El **baseline histórico** llegó a **148 declaraciones / 453 instancias**. Frente a él, el Documento 2 tiene **81 declaraciones menos (−54,7 %)** y **386 instancias menos (−85,2 %)**.
- La **taxonomía completa** suma **260 unidades automatizadas** (90 e2e + 168 Vitest + 2 VRT) o **449 instancias** si se cuentan los tres motores. El Documento 2 tiene **193 unidades menos (−74,2 %)** o **382 instancias menos (−85,1 %)**.
- **Pero** el Documento 2 cubre **70/70 requisitos**, mientras que la suite automatizada cubre **41/70** (las fases 1–3). Las fases 4–7 no tienen ningún test planificado; el Documento 2 aporta **21 casos prospectivos** para ellas.

**Lectura correcta:** el Documento 2 es **más ancho y menos profundo**; la suite automatizada es **más profunda y más estrecha**. No son intercambiables. El primero sirve para aceptación de producto y descubrimiento de gaps; la segunda, para regresión y evidencia a nivel de artefacto.

---

## 1. Qué contemplaba la planificación original

### 1.1 No existe un «test plan» único

`.planning` no contiene un documento llamado `TEST-PLAN.md` ni una matriz requisito→test centralizada. La cobertura original está **distribuida** en cuatro lugares:

| Artefacto | Qué aporta |
|---|---|
| `ROADMAP.md` § Phase Details | Objetivos y 34 criterios de éxito de fase, sin IDs de test |
| `01/02/03-PLAN.md` § `must_haves` | Verdades verificables por plan, con evidencia esperada |
| `01/02/03-VERIFICATION.md` | Veredicto y evidencia de cada *must-have*; cita filas e2e o archivos de test |
| `03-08-CONVERSION-LEDGER.md` | La única trazabilidad fila a fila: 148 declaraciones originales y su disposición final |
| `01/02/03-UAT.md` | 16 comprobaciones manuales de cierre, sin matriz de requisitos |

**Consecuencia de auditoría:** la trazabilidad existe, pero es **reconstructiva**. Para saber qué test cubre qué requisito hay que cruzar `REQUIREMENTS.md`, `ROADMAP.md`, los `VERIFICATION.md` y el ledger. No hay una fuente única que responda «¿qué prueba cubre INT-04?» en una línea.

### 1.2 UAT manual original: 16 ítems

| Fase | Ítems | Contenido |
|---|---:|---|
| Fase 1 | 4 | Reinicio interrumpido, burst de rate limit, primer arranque limpio, revisión visual del panel |
| Fase 2 | 5 | Captura real, revisión visual vs UI-SPEC, disposición de CR-03, `lang`, cierre de WINDOWS #5 |
| Fase 3 | 7 | Captura real, irreversibilidad de máscara, CR-01, HG-01, truncación 280, wrap ES, firma D8 |
| **Total** | **16** | **Cierre de fase, no aceptación requisito a requisito** |

**Cobertura:** los 16 ítems no están trazados a REQ-IDs. Fase 3 sí incluye mediciones potentes (100 % de relleno opaco, 58× menos densidad de bordes), pero son **verificaciones puntuales**, no una suite.

### 1.3 Suite automatizada: evolución

| Momento | Declaraciones | Instancias | Motores | Notas |
|---|---:|---:|---:|---|
| Fase 1 | 44 | 132 | 3 | 44 filas × 3 |
| Fase 2 | 105 | 315 | 3 | 105 por motor |
| Fase 3 pre-refactor | 148 (+4 generadas) | 453 | 3 | Monolito e2e |
| Baseline del ledger | **148** | **453** | 3 | 4 declaraciones generadas por loops |
| Fase 3 post-03-08 | **90** | **279** | 3 | 14 journeys, 93 instancias por motor |
| Vitest final | — | **168** | 1 | 59 unit + 65 integration + 26 contract + 18 packaging |
| VRT | — | **2** | 1 | Baselines del widget hostil |

**Reconciliación del ledger:**

```
148 declaraciones baseline
  = 90 kept-in-journey
  + 57 converted (unit/integration/contract/packaging)
  +  1 justified-redundant
  = 148
```

El ledger contiene **153 ids** porque cinco filas del tracer se re-listaron en batches posteriores; la reconciliación `153 − 5 = 148` está auditada en el propio documento.

### 1.4 Tope estructural de e2e

R-19 impone **≤ 20 core user journeys**. La suite usa **14** (J-01…J-14); J-15…J-20 están reservados para Fases 4–7. La comprobación es un test que falla (`tests/packaging/journey-cap.test.ts`), no una convención.

---

## 2. Método de comparación

### 2.1 Unidades

| Unidad | Qué mide | Uso |
|---|---|---|
| **Caso manual (Doc. 2)** | Un recorrido E2E con pasos, resultado esperado y aceptación humana | Comparación principal |
| **Declaración e2e** | Un `test()` de Playwright | Comparación de granularidad |
| **Instancia e2e** | Una ejecución de una declaración en un motor | Comparación de esfuerzo |
| **Test Vitest** | Un `it()` unit/integration/contract/packaging | Comparación de profundidad |
| **UAT original** | Una comprobación de cierre de fase | Comparación de esfuerzo manual |

### 2.2 Reglas

- Un caso manual puede cubrir **varios requisitos** y varios pasos; no se descompone en filas.
- No se comparan porcentajes de cobertura de código: R-19 prohíbe expresamente la métrica de cobertura como gate.
- No se cuenta un caso prospectivo como «cobertura ejecutada»; se cuenta como **cobertura planificada**.
- Las cifras de la suite automatizada se toman de `.planning`, no de `documentation/`, para evitar mezclar fuentes.

### 2.3 Advertencia de equivalencia

Comparar 67 casos manuales con 90 declaraciones e2e es como comparar **67 guiones de aceptación** con **90 aserciones**: el primero puede contener 5-10 aserciones internas. Por eso el informe ofrece **tres comparaciones** (UAT, e2e, taxonomía completa) y no una sola.

---

## 3. Comparación cuantitativa

### 3.1 Tabla maestra

| Referencia | Unidades | Doc. 2 | Diferencia | % | Lectura |
|---|---:|---:|---:|---:|---|
| UAT manual original | 16 | 67 | **+51** | **+319 %** | Doc. 2 multiplica por 4,2 la aceptación manual |
| Journeys e2e finales | 14 | 67 | **+53** | **+379 %** | Doc. 2 es mucho más granular que un journey |
| Declaraciones e2e finales | 90 | 67 | **−23** | **−25,6 %** | Doc. 2 agrupa pasos |
| Instancias e2e finales (3 motores) | 279 | 67 | **−212** | **−76,0 %** | Doc. 2 no replica por motor |
| Baseline de declaraciones | 148 | 67 | **−81** | **−54,7 %** | Doc. 2 es casi la mitad |
| Baseline de instancias | 453 | 67 | **−386** | **−85,2 %** | Doc. 2 no busca regresión masiva |
| Taxonomía completa (unidades) | 260 | 67 | **−193** | **−74,2 %** | 90 e2e + 168 Vitest + 2 VRT |
| Taxonomía completa (instancias) | 449 | 67 | **−382** | **−85,1 %** | 279 e2e + 168 Vitest + 2 VRT |
| Requisitos cubiertos | 41 / 70 | 70 / 70 | **+29** | **+70,7 %** | Doc. 2 incluye fases 4–7 |
| Tests de fases 4–7 | 0 | 21 | **+21** | **∞** | No había planificación |

### 3.2 Por fase

| Fase | Requisitos | Tests automatizados | Casos Doc. 2 (aprox.) | Comentario |
|---|---:|---:|---:|---|
| 1 | 10 | 132 instancias + integración/contract | 11 | Doc. 2 agrupa la ingesta en 8 casos |
| 2 | 18 | 315 instancias | 14 | Widget, captura y T1 |
| 3 | 13 | 279 instancias + 168 Vitest | 19 | El grueso del camino del reportero |
| 4 | 7 | **0** | **6** | Prospectivo |
| 5 | 9 | **0** | **7** | Prospectivo |
| 6 | 10 | **0** | **9** | Prospectivo, 3 parciales |
| 7 | 3 | **0** | **3** | Prospectivo |
| **Total** | **70** | **~260 unidades** | **67** | |

> La suma por fase no es exacta porque un caso puede cubrir requisitos de dos fases (p. ej. TC-F-01 cubre ENR-06 de Fase 1 y CA-01). La tabla es indicativa, no una partición.

### 3.3 Por prioridad

| Prioridad | Casos | % | Qué concentra |
|---|---:|---:|---|
| P1 | 27 | 40,3 % | Camino feliz, masking, ingesta, auth, triaje básico |
| P2 | 25 | 37,3 % | ESM, i18n, adjunto, undo, filtros, proyectos |
| P3 | 12 | 17,9 % | Fallback, DPR, borrado, comentarios, backup |
| P4 | 3 | 4,5 % | WebP→PNG, recursión de consola, borrado de proyecto |

### 3.4 Por automatización

| Valoración | Casos | % |
|---|---:|---:|
| Sí | 62 | 92,5 % |
| Parcial | 4 | 6,0 % |
| No | 1 | 1,5 % |

**Lectura:** la suite manual es, en su mayoría, **automatizable**. Eso no significa que deba automatizarse entera: los 4 «Parcial» y el «No» son precisamente los que aportan juicio humano (primera ejecución, pixelación visual, Lighthouse, restore, picker real).

---

## 4. Comparación cualitativa

### 4.1 Qué aporta el Documento 2 que no estaba

| Aportación | Evidencia | Valor |
|---|---|---|
| **Cobertura de fases 4–7** | 21 casos prospectivos | Convierte objetivos en escenarios verificables |
| **Trazabilidad explícita REQ→caso** | Matriz de 70 filas | Responde «¿qué prueba cubre INT-04?» en una línea |
| **Negativos y controles** | Luhn inválido, JWT lookalike, no-imagen, origin no allowlisted, 401 en cada ruta | Evita pruebas vacuas |
| **Aceptación de producto** | Revisión visual, primera ejecución, restore | Lo que la suite automatizada no juzga |
| **Prioridad y ROI** | 27 P1 / 25 P2 / 12 P3 / 3 P4 | Permite ejecutar por riesgo |
| **Criterio de automatización** | 62/4/1 | Evita automatizar lo que no aporta |

### 4.2 Qué hace mejor la suite original

| Fortaleza | Evidencia | Por qué el Doc. 2 no la sustituye |
|---|---|---|
| **Tres motores** | 279 instancias | El Doc. 2 es agnóstico de motor |
| **Artefacto a nivel de bytes** | CA-02, J-04, J-05 | El Doc. 2 describe el paso, no ejecuta el decode |
| **Regresión continua** | 90 filas + 168 Vitest | El Doc. 2 es de aceptación puntual |
| **Contratos y packaging** | 26 contract + 18 packaging | El Doc. 2 los cubre como resultado, no como unidad |
| **VRT** | 2 baselines | El ojo humano no detecta un desplazamiento de 1 px |
| **Ledger sin pérdidas** | 148 disposiciones | El Doc. 2 no reemplaza la reconciliación histórica |

### 4.3 Cobertura por módulo

| Módulo | Cobertura original | Cobertura Doc. 2 | Veredicto |
|---|---|---|---|
| Integración/entrega | Script tag, ESM, compose, env | A-01…A-05 | ✅ Fuerte |
| Widget/aislamiento | J-01, J-14, VRT | B-01…B-04 | ✅ Fuerte; matriz CSS finita |
| i18n | J-12 + unit | B-05, B-06 | ✅ Fuerte; persistencia ambigua |
| Captura | J-02/J-03/J-08/J-09 + UAT real | C-01…C-07 | ✅ Fuerte; picker real sólo manual |
| Anotación | J-05/J-06 | D-01…D-06 | ✅ Fuerte |
| Enmascarado | J-04/J-05 + CA-02 | E-01…E-07 | ✅ El área mejor cubierta; umbral subjetivo |
| Revisión | J-02 | E-08 | ✅ |
| Contrato/payload | 26 contract + F-01 | F-01…F-06 | 🟡 F-02…F-06 sin implementar |
| Transporte/ingesta | 65 integration + hostile | G-01…G-08 | ✅ Fuerte; ING-02 ausente |
| Auth/proyectos | **0** | H-01…H-07 | 🔴 Laguna total |
| Triaje/retención | **0** (+ purga quick) | I-01…I-09 | 🔴 Laguna total, 3 parciales |
| Rendimiento/release | `check:size`, packaging | J-01…J-04 | 🟡 PRF-05 y DEP-04 ausentes |
| Seguridad transversal | Unit/integration/artifact | E, G, H | ✅ Fuerte; límites documentados |

---

## 5. Lagunas de cobertura por área

### 5.1 Fases 4–7: la laguna estructural

| Área | Qué falta | Evidencia | Impacto |
|---|---|---|---|
| Fase 4 — enriquecimiento | No hay `04-*-PLAN.md`; ENR-01…05 e INT-03/04 sin test | `ROADMAP.md` Phase 4, `Plans: TBD` | 7 requisitos sin criterio operacional |
| Fase 5 — auth/proyectos | No hay `05-*-PLAN.md`; CA-05 sin prueba | `ROADMAP.md` Phase 5, `Plans: TBD` | El release gate no puede estar verde |
| Fase 6 — triaje/retención | No hay `06-*-PLAN.md`; TRI-04…10 sin prueba | `ROADMAP.md` Phase 6, `Plans: TBD` | 10 requisitos sin aceptación |
| Fase 7 — resiliencia/release | No hay `07-*-PLAN.md`; ING-02/PRF-05/DEP-04 sin prueba | `ROADMAP.md` Phase 7, `Plans: TBD` | El cierre del TFG depende de trabajo no planificado |

**Conclusión:** no es que el Documento 2 «añada» 21 casos porque sí; es que **rellena un vacío que la planificación no había cubierto**. Ese vacío es el hallazgo más importante de esta auditoría.

### 5.2 Auth y proyectos: cobertura cero

- No existe ningún test de login, logout, 401, cookie, rotación, CRUD o borrado de proyecto.
- La quick task `261014-m3w` añadió rate limit y paginación a la lectura, pero **dejó las lecturas sin autenticar** por decisión registrada (`defer to Phase 5`).
- `CA-05` es, por tanto, **no verificable** y el gate de release de Fase 7 no puede aprobarse.

### 5.3 Triaje y retención: cobertura cero con una excepción

- No hay tests de lista, filtros, detalle, estados, comentarios, borrado ni contadores.
- La purga TTL tiene implementación (`apps/api/src/purge.ts` citado en `03-VERIFICATION.md`) y una quick task, pero **no** tiene prueba de aceptación: el SUMMARY declara `requirements-completed: []` y difiere la prueba con pila real.
- `purge_runs` se promete en `ROADMAP.md` Fase 6 SC5, pero la implementación documentada **sólo escribe logs**; no hay tabla ni artefacto consultable. Es una laguna de criterio, no sólo de test.

### 5.4 Resiliencia y release: cobertura cero

- `ING-02` no tiene prueba de unload/offline; el reintento actual es en memoria de lane 1.
- `PRF-05` no tiene método Lighthouse, baseline ni tolerancia.
- `DEP-04` no tiene procedimiento de backup/restore ni prueba de restauración.
- El release gate se describe como «una suite Playwright CA-01…CA-05» en Fase 7, pero R-19 lo amplió a seis tipos; el texto del roadmap sigue parcialmente desactualizado.

### 5.5 Contrato y payload: cobertura fuerte en lo construido, ciega en lo pendiente

- `ENR-06` y CA-01 están cubiertos por 26 tests de contrato y por J-02/F-01.
- `ENR-01…05` no tienen test: no hay captura de consola, metadatos, `appVersion`, `custom` ni opt-out.
- La condicionalidad «bug exige logs» **no está en el esquema**; se confía en Fase 4. Un `bug` sin logs podría validar el esquema actual.

### 5.6 Captura y enmascarado: el área más madura, con límites honestos

- 315 instancias en Fase 2 y 279 en Fase 3, con artefacto decodificado, anillo de 1 px, DPR 1/1.25/2/3 y no-resurrección.
- Límites declarados: shadow roots cerrados y iframes cross-origin no se escanean (AR-01); el fallback WebP→PNG se cubre con stub porque WebKit de esta plataforma codifica WebP real (A-14).
- El umbral de «irreversibilidad» no es una fórmula: el UAT mide 100 % de relleno y 58× menos densidad de bordes, pero no hay un criterio numérico de aceptación repetible.

---

## 6. Ambigüedades y contradicciones documentales

| # | Ambigüedad / contradicción | Evidencia | Severidad | Efecto en la cobertura |
|---|---|---|---|---|
| A-01 | **PRJ-04 es v1 en REQUIREMENTS/ROADMAP, pero PROJECT lo declara fuera de alcance** | `REQUIREMENTS.md` línea 126; `ROADMAP.md` línea 160; `PROJECT.md` línea 50 | 🔴 Alta | No se sabe si la rotación debe probarse |
| A-02 | **Q-07 sin decidir: gracia vs corte instantáneo** | `STATE.md` línea 179; `ROADMAP.md` línea 170 | 🔴 Alta | Bloquea el criterio de TC-H-04 |
| A-03 | **CA-03 Lighthouse sin método, baseline ni tolerancia** | `REQUIREMENTS.md` línea 25; `ROADMAP.md` línea 199 | 🟠 Media | PRF-05 no es medible de forma reproducible |
| A-04 | **CA-01 condicional no está en el esquema; «obligatorio» no distingue campo presente de array no vacío** | `REQUIREMENTS.md` línea 23; `ROADMAP.md` línea 65 | 🟠 Media | Un bug sin logs (o con array vacío) podría validar |
| A-05 | **TRI-09 borra identidad; Fase 6 SC4 dice que el borrado alcanza el screenshot** | `REQUIREMENTS.md` línea 118; `ROADMAP.md` línea 182 | 🔴 Alta | Alcance de borrado ambiguo y sensible a RGPD |
| A-06 | **`purge_runs` prometido vs purga que sólo loguea** | `ROADMAP.md` línea 183; `261014-m3v-SUMMARY.md` líneas 37-46 | 🟠 Media | El criterio «evidenciado en purge_runs» no se cumple |
| A-07 | **Purga de identidad no anonimiza el screenshot** | `ROADMAP.md` línea 187 | 🟠 Media | RET-01 podría no cumplir la promesa de anonimización |
| A-08 | **WDG-06: override en `localStorage` (CONTEXT) vs sesión en memoria (STATE)** | `03-CONTEXT.md` línea 57; `STATE.md` línea 140 | 🟠 Media | La prueba de persistencia no sabe qué exigir |
| A-09 | **ROADMAP Fase 7 aún dice que WebKit cubre WebP→PNG; A-14 lo corrige** | `ROADMAP.md` línea 202; `REQUIREMENTS.md` línea 38 | 🟡 Baja | Deriva documental |
| A-10 | **PROJECT declara «unit tests» fuera de alcance; R-19 los admite** | `PROJECT.md` línea 51; `AGENTS.md` Testing & QA | 🟡 Baja | Deriva documental; confunde al evaluador |
| A-11 | **CA-05 no define qué rutas son públicas** | `REQUIREMENTS.md` línea 27 | 🟠 Media | El test de 401 puede ser vacuo o incorrecto |
| A-12 | **CAP-05 se prueba en el techo (4000×4000); el downscale por encima se afirma en fuente** | `STATE.md` línea 118 | 🟡 Baja | La prueba no cubre el path de reducción superior |
| A-13 | **A-12: 45+25+14=84 > 80 KB; v1 mide 24,4 pero el escenario sigue en el gate** | `ROADMAP.md` línea 65; `03-VERIFICATION.md` línea 352 | 🟠 Media | El presupuesto de v2 no está resuelto |
| A-14 | **ING-02 «exactamente una vez» vs at-least-once + dedupe por idempotencia** | `ROADMAP.md` líneas 196-202 | 🟠 Media | La prueba de unload necesita una semántica clara |
| A-15 | **PRV-05 no cubre shadow roots cerrados ni iframes cross-origin** | `02-UAT.md` línea 35; AR-01 | 🟠 Media | La garantía es acotada y debe declararse |
| A-16 | **El tope de 20 journeys no aplica al Doc. 2 (67 casos)** | `ROADMAP.md` línea 202; `AGENTS.md` | 🟡 Baja | No se pueden mapear 1:1 sin romper el cap |

### 6.1 Las tres contradicciones que más importan

1. **PRJ-04 / Q-07.** Es el único caso en que un requisito v1 y el alcance del proyecto se contradicen de forma directa. No es un detalle de test: afecta a la planificación de Fase 5 y a la seguridad operativa (rotar una clave embebida en hosts ya desplegados).
2. **TRI-09 / RET.** «Borrar la identidad» no equivale a «borrar el screenshot». Si la imagen sigue mostrando el nombre o el correo, el reporte no está anonimizado. La Fase 6 lo insinúa en SC4, pero el requisito TRI-09 no lo exige; la prueba puede pasar y la promesa de privacidad seguir rota.
3. **`purge_runs`.** Se promete evidencia consultable y la implementación documentada sólo produce logs. O se crea la tabla/artefacto, o se rebaja el criterio; no se puede mantener la ambigüedad.

---

## 7. Reconciliación de conteos: por qué 67 no es «poco»

### 7.1 Identidad aritmética

```
67 casos manuales
  = 42 ejecutables hoy
  +  4 parciales (RET-01/02/03, DEP-03)
  + 21 prospectivos (Fases 4–7)

90 declaraciones e2e
  = 79 sdk.spec.ts
  +  9 hostile.spec.ts
  +  2 ingest.spec.ts
  = 14 journeys
  = 93 instancias por motor × 3 = 279

168 tests Vitest
  = 59 unit + 65 integration + 26 contract + 18 packaging

2 baselines VRT
```

### 7.2 Por qué el Doc. 2 tiene menos unidades que la suite automatizada

| Causa | Explicación | Ejemplo |
|---|---|---|
| **Agregación** | Un caso manual contiene varios pasos y aserciones | TC-E-02 cubre JWT, Bearer, `key=`, Luhn válido, Luhn inválido y dos tarjetas: 6 filas e2e en un caso |
| **Sin réplica por motor** | El Doc. 2 es agnóstico; la suite corre 3 motores | 90 filas e2e → 279 instancias; el Doc. 2 no triplica |
| **Capa distinta** | Contract/packaging/unit no se reescriben como E2E manual | 26 contract + 18 packaging + 59 unit quedan como evidencia automatizada |
| **Foco en aceptación** | El Doc. 2 no busca regresión de cada borde | 57 filas convertidas viven en capas baratas |

### 7.3 Por qué el Doc. 2 tiene más unidades que el UAT original

| Causa | Explicación |
|---|---|
| **El UAT era de cierre** | 4/5/7 ítems verificaban que la fase estaba viva, no cada requisito |
| **Cobertura de 70 requisitos** | El Doc. 2 asigna al menos un caso a cada REQ |
| **Fases 4–7** | 21 casos que el UAT no podía tener porque las fases no existían |
| **Negativos explícitos** | El UAT original se centraba en caminos felices y defectos conocidos |

---

## 8. Recomendaciones

### 8.1 P0 — antes de planificar Fase 4

| # | Acción | Por qué |
|---|---|---|
| 1 | Crear una **matriz única REQ→test** para fases 4–7, con IDs de caso y capa (unit/integration/contract/VRT/packaging/e2e) | Hoy la trazabilidad es reconstructiva |
| 2 | Resolver **PRJ-04 y Q-07**: ¿es v1?, ¿gracia o corte? | Requisito y alcance se contradicen |
| 3 | Definir el **método de CA-03/PRF-05**: baseline, throttling, repeticiones, mediana | Sin método no hay criterio |
| 4 | Decidir el **alcance de TRI-09**: identidad sola o identidad + artefacto | Afecta a RGPD y a la prueba |
| 5 | Resolver **`purge_runs`**: tabla/artefacto o rebajar el criterio | El SC5 no es satisfacible hoy |

### 8.2 P1 — durante Fases 4–5

| # | Acción | Por qué |
|---|---|---|
| 6 | Decidir si CA-01 se refuerza en el esquema o se documenta como validación runtime | Evita un bug sin logs válido |
| 7 | Fijar la **persistencia del override i18n** (sesión vs almacenamiento propio) | A-08 |
| 8 | Declarar la **lista de rutas públicas** de CA-05 | A-11 |
| 9 | Actualizar `PROJECT.md` (unit tests), `ROADMAP.md` (WebKit) y el bloque generado de `AGENTS.md` | Deriva documental |
| 10 | Convertir el Doc. 2 en **suite de aceptación manual** con propietario y cadencia, separada del cap de 20 journeys | No debe competir con R-19 |

### 8.3 P2 — durante Fases 6–7

| # | Acción | Por qué |
|---|---|---|
| 11 | Definir un **umbral objetivo de irreversibilidad** para fill/pixelate | Hoy es juicio humano |
| 12 | Documentar la **interacción backup vs retención** | Un backup puede resucitar datos purgados |
| 13 | Añadir pruebas de **closed shadow root / iframe cross-origin** o declarar la limitación en la documentación de seguridad | A-15 |
| 14 | Resolver la **aritmética A-12** (84 > 80) antes de cualquier adaptador v2 | El escenario sigue en el gate |
| 15 | Añadir un caso de **multi-tab flush** a ING-02 | El roadmap lo menciona y no está probado |

---

## 9. Conclusión

**¿El Documento 2 arroja más o menos casos que la planificación original?**

- **Más que el UAT manual:** 67 vs 16 (**+319 %**). El UAT era una smoke test de cierre; el Documento 2 es una suite de aceptación.
- **Menos que la suite automatizada:** 67 vs 90 declaraciones (**−25,6 %**), 168 Vitest y 279 instancias. No es una regresión de cobertura: es otra unidad de medida y otra capa.
- **Más amplitud:** 70/70 requisitos frente a 41/70; 21 casos para fases que hoy tienen **cero** tests.
- **Menos profundidad:** no replica tres motores, no decodifica bytes en cada paso, no ejecuta contract/packaging/VRT.

**El hallazgo no es el número, es la distribución:** el proyecto tiene una cobertura automatizada **excelente en el camino del reportero** y **vacía en el camino del desarrollador**. El Documento 2 hace visible ese desequilibrio y lo convierte en 67 escenarios ejecutables. La prioridad inmediata no es añadir más casos manuales, sino **planificar las fases 4–7 con criterios operacionalizados, resolver las contradicciones de alcance y mantener las dos suites separadas pero trazables**.

**Veredicto:** suite manual **suficiente y bien priorizada para aceptación**, insuficiente como sustituto de la regresión automatizada; planificación original **madura en lo construido, incompleta en lo pendiente y ambigua en seis decisiones críticas**.

---

*Auditoría documental basada exclusivamente en `.planning/` · 2026-11-03*
