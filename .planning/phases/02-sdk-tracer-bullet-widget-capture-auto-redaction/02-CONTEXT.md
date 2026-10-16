# Phase 2: SDK Tracer Bullet: Widget, Capture & Auto-Redaction - Context

**Gathered:** 2026-10-16
**Status:** Ready for planning

<domain>
## Phase Boundary

The first real vertical slice: an end user opens the Watchbug widget on any host page (added via one async script tag with no build step, or consumed as an ES module), captures the current tab through the browser's screen-share picker, and files a report whose screenshot already had sensitive data **destructively masked at capture time on raw `ImageData` (T1)** — then sees it render in the panel. This phase fixes the two architecture-loaded decisions at first build: **`WidgetHost` isolation** (H-2/H-3 — a retrofit is a rewrite of every style) and **redaction ordering T1** (A-05 — no encoded bytes may exist before `Redactor` runs). The injected core stays ≤ 45 KB gzipped with zero runtime npm dependencies.

Requirements in scope: **INT-01, INT-02, INT-05, WDG-01, WDG-02, WDG-03, WDG-04, WDG-05, CAP-01, CAP-04, CAP-05, PRV-01, PRV-02, PRV-03, PRV-05, PRV-06, PRF-01, PRF-04** (18).

Explicitly NOT in this phase (they complete later, per ROADMAP): the report composer, review-before-send, manual image attach and the text-only failure UX (CAP-02/CAP-03 → Phase 3); the lazy annotation editor and its T2/T3 masking, and the user-facing "mask" tool (ANN-01…06, PRV-04/PRV-07 → Phase 3); the whole-widget i18n en/es (WDG-06 → Phase 3); console-log capture, environment metadata and identity privacy (ENR-01…05, INT-03/INT-04 → Phase 4); admin auth, projects and key rotation (Phase 5); triage and TTL purge (Phase 6); the IndexedDB durability lane and the release gate (Phase 7).

</domain>

<decisions>
## Implementation Decisions

> Local decision IDs are prefixed `P2-D-` to avoid collision with the global `D-01…D-10` register in `documentation/resolution-record.md`.

### Flujo del widget y del envío (Área 1)
- **P2-D-01:** **Envío directo con `title` autogenerado.** Un clic del lanzador captura y envía en un solo paso: `title` = `document.title` truncado a `MAX_TITLE_CHARS` (200) y `type: 'bug'` fijos. No hay formulario ni elección de tipo en esta fase (el composer llega en Fase 3). — **Reversibility:** reversible — la Fase 3 introduce el formulario y sustituye este atajo; el `title`/`type` fijos quedan anotados como idea diferida.
- **P2-D-02:** **Un gesto + panel de estado.** El clic del lanzador **es** la activación transitoria: el lanzador se oculta y `getDisplayMedia` se llama en el mismo handler. El widget abre entonces un **panel flotante de estado** dentro de su Shadow DOM que muestra «Capturando…» → «Enviando…» → resultado. Ese panel es también el *dialog content* que CA-04 debe asertar bajo CSS hostil. — **Reversibility:** costly — el panel de estado es la forma del armazón del widget sobre la que la Fase 3 monta el composer; cambiarlo después toca toda la UI del widget.
- **P2-D-03:** **Reintento solo de transitorios.** Se reintenta automáticamente **solo** en fallos transitorios (red, timeout, 5xx, 429): 3 intentos con backoff 1/4/10 s ±25 % y la **misma `Idempotency-Key`** en todos. Los 4xx de contrato (400/401/403/413) fallan de inmediato mostrando el motivo del servidor, con un botón manual «Reintentar». El panel muestra «Enviando…» → «Reintentando (n/3)…» → «Enviado ✓». — **Reversibility:** reversible — los parámetros de reintento son un conjunto acotado (research: 3 intentos, 1/4/10 s ±25 %, timeout 15 s) y la `Idempotency-Key` ya es contrato de Fase 1.
- **P2-D-04:** **Mapa `strings` ID→inglés, sin i18n.** Los textos visibles (lanzador, panel, mensajes de error/reintento) viven en un único `strings.ts` del carril core, con claves por ID y valores en inglés. Sin detección de locale, sin conmutador y sin `es` en esta fase (i18n es WDG-06/Fase 3). La forma establecida permite que la Fase 3 añada el mapa `es` y un resolver sin refactor. — **Reversibility:** reversible — añadir el segundo idioma es aditivo y local a la capa de strings.

### El widget fuera de la captura (Área 2)
- **P2-D-05:** **Ocultar y restaurar el host del widget.** De forma síncrona dentro del handler del gesto, y antes de llamar a `getDisplayMedia`, se oculta el host del Shadow DOM (estilo inline); se restaura tras obtener el `ImageData`. No se usa `selfBrowserSurface: 'exclude'` (es mutuamente excluyente con `preferCurrentTab` y Chromium-only) ni enmascarado del bbox del widget en el bitmap (si el widget está bien oculto no hay nada que enmascarar, y el relleno borraría zona legítima de la página). — **Reversibility:** costly — el orden de la cadena de captura (ocultar → pedir permiso → tomar frame → restaurar) queda fijado aquí y es el que sostiene CAP-04 y T1.
- **P2-D-06:** **Invariante asertada en el pipeline.** El `CaptureSource`/pipeline comprueba que el host del widget está oculto justo antes de `drawImage`/`getImageData`; si no lo está, la captura falla con estado de error visible (fallo ruidoso, M-6) en lugar de producir un frame contaminado. La garantía vive en el código, no en el orden de llamadas ni solo en la e2e. — **Reversibility:** reversible — es una aserción interna; añadirla o quitarla no cambia contratos.

### Alcance de la auto-redacción (Área 3)
- **P2-D-07:** **Catálogo de patrones alineado con el scrubber C-5.** Las mismas familias que define el scrubber de secretos de la Fase 4: forma JWT (`eyJ…`), `Bearer <token>`, asignaciones `key=/token=/secret=/password=`, secuencias tipo tarjeta validadas por **Luhn**, más `input[type=password]` (PRV-01) y elementos `[data-watchbug-sensitive]` (PRV-03). La detección opera sobre el DOM (valores de inputs y texto de nodos → bbox → máscara); el SDK no hace OCR. — **Reversibility:** costly — el catálogo define la postura de privacidad y es lo que la e2e de irreversibilidad (CA-02) prueba; ampliarlo o recortarlo cambia qué sale del navegador.
- **P2-D-08:** **Granularidad = elemento / nodo de texto completo.** Cuando un patrón coincide, se enmascara el rectángulo completo del elemento (input) o del nodo de texto que lo contiene, redondeado **hacia fuera** en espacio bitmap/device-pixel (H-1). Se prioriza no filtrar caracteres por el borde sobre la precisión visual: enmascarar de más es seguro. — **Reversibility:** costly — la geometría en espacio bitmap es la base que la Fase 3 reutiliza para las máscaras del usuario (T2/T3).
- **P2-D-09:** **Política conservadora, sin reglas del host en v1.** Ante la duda se enmascara de más. El host solo puede marcar con `data-watchbug-sensitive` (PRV-03) u ocultar vía `input[type=password]` (PRV-01); **no** se añade API pública de redacción personalizada en v1 y el puerto `Redactor` queda como seam (R-02). Un falso positivo es inocuo; un falso negativo es una fuga. — **Reversibility:** reversible — añadir reglas del host en el futuro es aditivo, aunque sería un cambio de interfaz pública (disparador de consulta).

### Fidelidad vs tamaño de la captura (Área 4)
- **P2-D-10:** **Escalera de reducción determinista en el cliente.** Una sola pasada antes de enviar: clamp de `devicePixelRatio` a 2 → reducir para ≤ `MAX_IMAGE_PIXELS` (16 MP) → codificar WebP q0.8 → si supera el tope, re-encode q0.6 → q0.5 y downscale 0.75× hasta cumplir. El servidor conserva su hard cap (2 MB → 413) como control, pero no se alcanza por diseño. — **Reversibility:** costly — la escalera define cuándo existen bytes codificados y en qué orden ocurre respecto a T1 (SEC-02); reordenarla toca la cadena de captura completa.
- **P2-D-11:** **Objetivo ≤ 800 KB, tope duro 2 MB alineado con `MAX_ENCODED_IMAGE_BYTES`.** Base WebP q0.8; el objetivo de salida es ≤ 800 KB (research) y el tope duro 2 MB coincide con la constante A-06 del servidor. — **Reversibility:** reversible — son constantes; ajustarlas es local.
- **P2-D-12:** **Sonda de 9 píxeles contra la captura en blanco.** Tras `getImageData`, se muestrean 9 píxeles distribuidos; si la varianza es ~0 (todo negro/blanco uniforme) o el canvas excede el área soportada, la captura se aborta con estado de error visible («no se pudo capturar»), **nunca** se envía una imagen en blanco en silencio (M-6). La causa conocida es el cap de área de canvas de Safari (16.777.216 px). — **Reversibility:** reversible — es una comprobación local; puede endurecerse en la Fase 3 con el estado de degradación completo.

### the agent's Discretion
Ningún área quedó marcada como "decide tú" por el propietario — todas las decisiones discutidas tienen elección explícita. Queda latitud técnica libre para research/planning en: la estrategia exacta de recorrido del DOM para localizar coincidencias y calcular bounding boxes, la descomposición en módulos/ficheros, la disposición concreta de entradas esbuild para los tres carriles, el cableado de la bandera `SHADOW_MODE`, la estructura concreta de las aserciones e2e de CA-01/CA-04/CA-05, y los detalles de implementación del reintento/backoff.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & acceptance
- `.planning/ROADMAP.md` § Phase 2 — goal, 5 success criteria, the 18 requirements, and the Rationale/Risks paragraph (WidgetHost isolation H-2/H-3, T1 redaction ordering + A-05, H-1 bitmap/device-pixel geometry, H-9 lane 1 only, M-3 `blob.type` sniff, H-4/H-5 + M-6 loud capture failure, C-5 groundwork)
- `.planning/REQUIREMENTS.md` — INT-01, INT-02, INT-05, WDG-01…WDG-05, CAP-01, CAP-04, CAP-05, PRV-01, PRV-02, PRV-03, PRV-05, PRV-06, PRF-01, PRF-04 definitions + traceability table

### Decisions & invariants (governing)
- `documentation/resolution-record.md` — R-01 (tiered size budget), R-02 (exactly 8 ports; reserved ports are seams only), R-11 (WebP q≈0.8 with silent PNG fallback), R-12 (e2e-only verification), R-13/A-01 (flat opaque fill α=255 is the only automatic primitive; no blur, no CSS overlay), R-14 (`SHADOW_MODE` build flag), R-15 (TypeScript end-to-end), R-17 (no calendar descoping), R-18 (single binding constant set), A-05 (`capture()` returns raw `ImageData`, never a Blob), A-06 (binding caps). **§5 governs on conflict.**
- `documentation/mentorship-pack.md` — INV-01 (shadow DOM closed / no leakage), INV-02 (single `window.Watchbug`, no prototype patching), INV-03 (three services), SEC-01/02/03/05, RNF-01/02/03 — all quality gates are hard.
- `documentation/mission-brief.md` — goal, non-goals (*Declare the No*), autonomy envelope and consultation triggers.
- `documentation/continuity-pack.md` — session state and branch-per-phase + PR policy.

### Contracts & constants (single source of truth)
- `packages/contracts/src/constants.ts` — A-06 caps the SDK clamps against: `MAX_ENCODED_IMAGE_BYTES` (2 MB), `MAX_IMAGE_PIXELS` (16 MP), `MAX_IMAGE_DIM` (8192 px), `MAX_TITLE_CHARS` (200), `MASK_ALPHA_OPAQUE` (255), `MASK_PIXELATION_MIN_BLOCK_PX` (8).
- `packages/contracts/src/schema.ts` — the wire contract (`strictObject{ type, title, note, url, user }`); `url` strips query/fragment (PRV-06). The SDK imports it **types-only** so Zod never ships.

### Research evidence (locked inputs)
- `.planning/research/SUMMARY.md` — the settled capture chain (Q-06 resolution), transport lanes (H-9 lane 1 only), encode targets (≤ 800 KB → hard 2 MB; q0.8 → 0.6 → 0.5 → downscale 0.75×), retry constants (3 attempts, backoff 1/4/10 s ±25 %, 15 s timeout), DPR clamp 2, the 9-pixel blank probe, `track.stop()` in `finally`, and M-3 `blob.type` content sniff.
- `.planning/research/STACK.md` — verified pins and the "What NOT To Use" rejection list (`html2canvas`, `fabric.js`/`konva`, gaussian blur, `dotenv`, unit-test frameworks, `bundlesize`); esbuild accepts one `format` per `build()` call → the dual IIFE+ESM output is two calls.
- `.planning/research/ARCHITECTURE.md` — `WidgetHost` isolation strategy, the 8 port seams, the ingest request shape (`FormData { meta, image }` + `X-Project-Key` + `Idempotency-Key`).

### Existing code (Phase 1 output) — reusable assets & integration points
- `packages/sdk/scripts/build.mjs` — the 6-call dual-format build over three lanes; `SHADOW_MODE` is currently hardcoded to `'closed'` → Phase 2 must add the `'open'` e2e flag (R-14).
- `packages/sdk/src/index.ts` — the core-lane stub (`WATCHBUG_VERSION = '0.1.0'`) this phase grows into `window.Watchbug`.
- `apps/api/src/routes/incidents.ts` — the ingest endpoint this phase POSTs to (multipart `{ meta, image }`, `X-Project-Key`, `Idempotency-Key`, server-deduped).
- `scripts/check-size.mjs` — the RNF-01/PRF-01 gate (45 / 25 / 14 / 80 KB tiers).
- `e2e/hostile.spec.ts` + `playwright.config.ts` — the one Playwright suite (chromium + firefox + webkit) and its raw-socket, artifact-level assertion style; extend this suite rather than adding a new one (R-12).
- `apps/panel` — already renders type/title/url/user + image, so the "renders in the panel" half of the slice needs no new panel code.
- `.env.example` — `WATCHBUG_CORS_ORIGINS` defaults to the panel origin only (127.0.0.1:8080 / localhost:8080) → serve the host fixture same-origin through nginx to avoid a CORS/`.env` change.

### Project entry point
- `AGENTS.md` — C-B-D-C control framework, consultation triggers, dev commands.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/sdk/src/index.ts` — the core-lane entry the widget bootstraps from; `window.Watchbug.init()` is built here.
- `packages/sdk/scripts/build.mjs` — the dual-format builder is functional; Phase 2 adds source files into the existing lanes rather than new build plumbing (`SHADOW_MODE=open` needs wiring).
- `packages/contracts` (`constants.ts`, `schema.ts`) — imported **types-only**; the constants are inlined at build time so no Zod ships to the client.
- `e2e/` + `playwright.config.ts` — the suite and its artifact-level assertion helpers already exist; new CA assertions are added to the same suite.
- `apps/panel` render path — proves a landed report without new panel work.

### Established Patterns
- **Shadow DOM build-time flag (R-14):** production `closed`, an e2e-only `open` bundle so Playwright can pierce the root.
- **T1 redaction ordering (A-05):** `CaptureSource.capture()` returns raw `ImageData`, never a Blob — masking runs destructively on `ImageData` before any encode, so structurally no unmasked bytes exist.
- **Single constant set (A-06/R-18):** SDK clamps import from `packages/contracts`; client clamps are UX-only, server caps are the control.
- **Verification (R-12):** one Playwright suite + `check:size`, e2e and property assertions only — no unit tests, no coverage thresholds.
- **Commit/docs:** `commit_docs: true`; plan files follow `02-NN-PLAN.md`.

### Integration Points
- `window.Watchbug.init({ projectKey, ... })` — the public entry (also consumed as an ES-module export, INT-05); the widget boots from it.
- POST `/api/incidents` — multipart via lane-1 plain `fetch` (never `keepalive`/`sendBeacon` for image-bearing reports) with `X-Project-Key` and `Idempotency-Key`.
- The host fixture page is served **same-origin** through the panel's nginx `/api` proxy so `WATCHBUG_CORS_ORIGINS` needs no change; a different-host fixture would need an `.env` edit.
- The C-5 groundwork grep gate lands in `packages/sdk` now: `document.cookie|localStorage|sessionStorage|Authorization|Bearer |credentials:`.

</code_context>

<specifics>
## Specific Ideas

- **The status panel is a two-for-one:** it is the end user's progress feedback *and* the "dialog content" that the hostile-CSS e2e (CA-04) asserts survives. Under hostile host CSS with a closed shadow root, a floating status panel is the proof that the widget renders above all host content.
- **Risk-first sequencing:** because `WidgetHost` isolation is architecture-loaded (H-2/H-3, a retrofit rewrites every style) and the `SHADOW_MODE=open` flag is what makes it testable, the e2e fixture + the open-mode build should exist early in the phase, before the capture pipeline is finished.
- **Redaction ordering is the load-bearing idea:** the whole value proposition ("neither the report nor its screenshot ever leaves the developer's own infrastructure") rests on T1 — auto-redaction happens on `ImageData` before anything is encoded, so there is never a moment where unmasked bytes could be transmitted.

</specifics>

<deferred>
## Deferred Ideas

- **`title`/`type` hardcoded (P2-D-01)** — the auto-generated title and fixed `type: 'bug'` are a Phase 2 shortcut. Owner's note: *"Recordar arreglar este 'hardcode' si es necesario en fases posteriores."* Revisit in **Phase 3**, when the composer lets the end user choose bug vs feedback and edit the title.
- **Full capture-degradation UX** (manual image attach via `ManualFileCapture`, text-only filing, the "screenshot unavailable — send anyway?" state) — H-4/H-5, mandatory but shipped with the composer in **Phase 3**. Until then, capture errors surface loudly only (never a silent blank image).
- **i18n en/es** for the widget — WDG-06/RNF-03, **Phase 3**; the P2-D-04 `strings` map is the shape it plugs into, and the dictionaries live in the lazy chunk, never in core.
- **Host-configurable redaction rules** — the `Redactor` port stays an unused seam in v1; a public rules API would be a public-interface change (consultation trigger) if ever added.
- **Optional DOM-serialization `CaptureSource`** — v2 (A-08); its size scenario stays in `check:size` but no adapter is built.
- No todos matched this phase (`todo.match-phase 2` → 0).

</deferred>

---

*Phase: 2-SDK Tracer Bullet: Widget, Capture & Auto-Redaction*
*Context gathered: 2026-10-16*
