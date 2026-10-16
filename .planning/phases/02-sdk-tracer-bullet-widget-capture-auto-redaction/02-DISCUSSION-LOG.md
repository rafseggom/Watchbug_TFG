# Phase 2: SDK Tracer Bullet: Widget, Capture & Auto-Redaction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-16
**Phase:** 2-SDK Tracer Bullet: Widget, Capture & Auto-Redaction
**Areas discussed:** Flujo del widget y del envío, El widget fuera de la captura, Alcance de la auto-redacción, Fidelidad vs tamaño de la captura

> Format note: Área 1 was discussed one question per turn (default mode). At the owner's request, Áreas 2–4 were presented as a single batch in one `question` call (8 questions) and answered in sequence — the tool has no literal tab UI, so the batch is the closest available form.

---

## Flujo del widget y del envío

**Q1 — ¿Cómo se dispara el envío y qué metadatos lleva `title`/`type`?**

| Option | Description | Selected |
|--------|-------------|----------|
| Envío directo, title autogenerado | Un clic captura y envía; `title` = `document.title` (≤200), `type: 'bug'` | ✓ |
| Formulario mínimo antes de enviar | Pide tipo y título en un paso intermedio | |
| Solo captura, sin envío automático | El usuario envía desde un panel de revisión | |

**User's choice:** Envío directo, title autogenerado
**Notes:** El owner pidió anotar el "hardcode" de `title`/`type` para revisarlo en fases posteriores (→ Fase 3, composer). El composer llega en Fase 3.

---

**Q2 — ¿Cómo se gestiona el gesto y la retroalimentación al usuario?**

| Option | Description | Selected |
|--------|-------------|----------|
| Un gesto + panel de estado | El clic es la activación; `getDisplayMedia` en el mismo handler; panel «Capturando… → Enviando… → resultado» | ✓ |
| Dos pasos (abrir → capturar) | El widget abre y luego pide un segundo clic para capturar | |
| Sin panel, solo toast | Feedback efímero fuera del Shadow DOM | |

**User's choice:** Un gesto + panel de estado
**Notes:** El panel es también el *dialog content* que CA-04 debe asertar bajo CSS hostil.

---

**Q3 — ¿Qué se reintenta y cómo?**

| Option | Description | Selected |
|--------|-------------|----------|
| Solo transitorios | Reintento en red/timeout/5xx/429 (3 intentos, backoff 1/4/10 s ±25 %, misma `Idempotency-Key`); 4xx fallan de inmediato | ✓ |
| Reintentar todo | Reintento también en 400/401/403/413 | |
| Sin reintento automático | Solo botón manual | |

**User's choice:** Solo transitorios
**Notes:** Los 4xx de contrato muestran el motivo del servidor + botón «Reintentar» manual.

---

**Q4 — ¿Cómo tratamos los textos del widget, dado que la i18n (WDG-06) es Fase 3?**

| Option | Description | Selected |
|--------|-------------|----------|
| Mapa `strings` ID→inglés, sin i18n | Un `strings.ts` en el carril core; sin locale, sin conmutador, sin `es` | ✓ |
| Literales en inglés inline | Texto junto a su uso, sin archivo de strings | |
| en + es completos ya | Adelanta RNF-03 y WDG-06 a la Fase 2 | |

**User's choice:** Mapa `strings` ID→inglés, sin i18n
**Notes:** Convierte la extracción de la Fase 3 en un no-op (solo añadir `es` + resolver). RNF-01 intacto.

*More questions? → Next area. (El owner pidió agrupar el resto en un solo lote.)*

---

## El widget fuera de la captura

**Q5 — ¿Qué estrategia impide que el widget aparezca en la captura? (CAP-04)**

| Option | Description | Selected |
|--------|-------------|----------|
| Ocultar y restaurar el host | Ocultar el host del Shadow DOM síncronamente antes de `getDisplayMedia`; restaurar tras `getImageData` | ✓ |
| `selfBrowserSurface: 'exclude'` | Excluir la pestaña actual en el selector (incompatible con `preferCurrentTab`, Chromium-only) | |
| Enmascarar el rectángulo en bitmap | Mapear el bbox del widget a espacio bitmap y rellenarlo | |

**User's choice:** Ocultar y restaurar el host
**Notes:** Funciona sin importar la superficie elegida, no deja huecos y no depende de `preferCurrentTab`. Las otras dos opciones se descartaron por incompatibilidad de selector o por autocontradecirse con la ocultación.

---

**Q6 — ¿Cómo se garantiza CAP-04 en el pipeline, no solo de palabra?**

| Option | Description | Selected |
|--------|-------------|----------|
| Invariante asertada + fail loudly | El pipeline exige el host oculto antes de `drawImage`/`getImageData`; si no, estado de error visible | ✓ |
| Confiar en el orden de llamadas | Contrato implícito ocultar → capturar → restaurar, sin aserción | |
| Verificar solo en e2e | Sin aserción en runtime; solo la suite Playwright | |

**User's choice:** Invariante asertada + fail loudly
**Notes:** Coherente con M-6 (fallo ruidoso) y R-12 (evidencia a nivel de artefacto).

---

## Alcance de la auto-redacción

**Q7 — ¿Qué ancho tiene el catálogo de patrones en v1? (PRV-02)**

| Option | Description | Selected |
|--------|-------------|----------|
| Catálogo alineado con C-5 | JWT, `Bearer`, `key=/token=/secret=/password=`, tarjetas por Luhn, `input[type=password]`, `[data-watchbug-sensitive]` | ✓ |
| Mínimo | Solo password + tarjeta Luhn + marca `data-watchbug-sensitive` | |
| Amplio | Añade email, teléfono e IBAN | |

**User's choice:** Catálogo alineado con C-5
**Notes:** Coherencia C-5↔PRV-02; cubre el vector real (tokens pegados en texto) sin OCR y sin disparar falsos positivos.

---

**Q8 — ¿Qué región se enmascara cuando coincide un patrón?**

| Option | Description | Selected |
|--------|-------------|----------|
| Elemento/nodo completo | Rectángulo completo del elemento/nodo, redondeado hacia fuera en espacio bitmap (H-1) | ✓ |
| Solo la subcadena coincidente | Rango exacto de la coincidencia (más preciso, mayor riesgo de fuga por bordes) | |
| Elemento + valor de inputs | Elemento completo para inputs, rango preciso para nodos de texto | |

**User's choice:** Elemento/nodo completo
**Notes:** Conservador: ningún carácter de la coincidencia queda en el borde. Acepta cubrir texto vecino inocuo.

---

**Q9 — ¿Política de falsos positivos y reglas del host en v1?**

| Option | Description | Selected |
|--------|-------------|----------|
| Conservador, sin reglas del host | Enmascarar de más; el host solo marca con `data-watchbug-sensitive`; `Redactor` queda como seam | ✓ |
| Preciso, con reglas del host v1 | `init({ redaction: { extraPatterns, allowPatterns } })` desde v1 | |
| Conservador, con reglas del host v1 | Igual que arriba, solo añadir patrones del host | |

**User's choice:** Conservador, sin reglas del host
**Notes:** Cero cambios de interfaz pública. Un falso positivo es inocuo; un falso negativo es una fuga.

---

## Fidelidad vs tamaño de la captura

**Q10 — ¿Dónde y cómo se aplica la reducción? (CAP-05)**

| Option | Description | Selected |
|--------|-------------|----------|
| Escalera en cliente | clamp DPR 2 → ≤16 MP → WebP q0.8 → re-encode q0.6/0.5 → downscale 0.75× hasta cumplir | ✓ |
| Una codificación, servidor 413 | q0.8 y dejar que el servidor rechace si supera 2 MB | |
| Sin límite en cliente | Resolución/calidad nativas; solo caps del servidor | |

**User's choice:** Escalera en cliente
**Notes:** El servidor conserva su hard cap (413) como control, pero no se alcanza por diseño.

---

**Q11 — ¿Qué parámetros concretos de calidad y tamaño fijamos?**

| Option | Description | Selected |
|--------|-------------|----------|
| Objetivo 800 KB, tope 2 MB | WebP q0.8 base; objetivo ≤800 KB; tope duro 2 MB (`MAX_ENCODED_IMAGE_BYTES`) | ✓ |
| Objetivo 2 MB, menos pasos | Una codificación q0.8; bajar solo si supera 2 MB | |
| q0.9 fija, sin objetivo | Calidad alta fija; reducir solo por área | |

**User's choice:** Objetivo 800 KB, tope 2 MB
**Notes:** Coherente con el research y con la constante A-06 del servidor.

---

**Q12 — ¿Cómo detectamos una captura en blanco? (M-6)**

| Option | Description | Selected |
|--------|-------------|----------|
| Sonda de 9 píxeles | Tras `getImageData`, muestrear 9 píxeles; varianza ~0 o área excedida → abortar con error visible | ✓ |
| Heurística por tamaño | Rechazar si el blob codificado es anómalamente pequeño | |
| Sin detección en Fase 2 | Diferir a la Fase 3 con el estado de degradación completo | |

**User's choice:** Sonda de 9 píxeles
**Notes:** Causa conocida: el cap de área de canvas de Safari. M-6 exige fallo ruidoso ya.

*More questions? → Cierre de las 4 áreas.*

---

## the agent's Discretion

No gray area was answered with "you decide". Residual technical latitude left to research/planning: DOM-walk strategy for locating pattern matches and computing bounding boxes, module/file decomposition, concrete esbuild entry layout for the three lanes, `SHADOW_MODE` flag plumbing, the exact e2e structure of the CA-01/CA-04/CA-05 assertions, and retry/backoff implementation details.

## Deferred Ideas

- **`title`/`type` hardcoded** (P2-D-01) — revisit in Fase 3 with the composer. Owner's note: *"Recordar arreglar este 'hardcode' si es necesario en fases posteriores."*
- **Full capture-degradation UX** (manual attach, text-only filing, failure state) — H-4/H-5, Fase 3.
- **i18n en/es** — WDG-06/RNF-03, Fase 3; the P2-D-04 `strings` map is the shape it plugs into.
- **Host-configurable redaction rules** — `Redactor` stays a seam in v1.
- **Optional DOM-serialization `CaptureSource`** — v2 (A-08).
