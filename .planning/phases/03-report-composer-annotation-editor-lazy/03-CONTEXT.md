# Phase 3: Report Composer & Annotation Editor (lazy) - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Phase Boundary

An end user can compose a complete bug report or plain feedback — capture **or attach** an image, annotate it (freehand / arrows / rectangles / text), destructively mask anything sensitive, review it, and file it — with the editor fetched lazily on gesture (≤ 25 KB gz) and the whole widget UI in English or Spanish.

The composer **replaces** the Phase 2 one-shot shortcut (P2-D-01: auto-generated `title` + fixed `type:'bug'` → send) with a real form, and mounts onto the widget shell that Phase 2 already fixed (`status-panel` for in-flight states, closed shadow root, single `window.Watchbug`). The C-2 `Annotator` port contract and the T2/T3 masking order are **architecture-locked in ROADMAP** and are not reopened here — this phase only decides *how the user experiences* them.

Requirements in scope: **CAP-02, CAP-03, ANN-01, ANN-02, ANN-03, ANN-04, ANN-05, ANN-06, PRV-04, PRV-07, WDG-06, PRF-02, PRF-03** (13).

Explicitly NOT in this phase (they complete later, per ROADMAP): console-log capture, environment metadata and identity privacy (ENR-01…05, INT-03/INT-04 → Phase 4); admin auth, projects and key rotation (Phase 5); triage actions and TTL purge (Phase 6); the IndexedDB durability lane (ING-02 → Phase 7).

</domain>

<decisions>
## Implementation Decisions

> Local decision IDs are prefixed `P3-D-` to avoid collision with the global `D-01…D-08` register in `documentation/resolution-record.md`.

### Flujo del composer
- **P3-D-01:** **Captura directa → formulario.** El clic del lanzador captura inmediatamente (conserva la activación transitoria de P2-D-05 y el camino rápido actual). Si la captura va bien, se abre el formulario con la imagen ya tomada; si falla, el formulario abre en modo degradado (P3-D-13). — **Reversibility:** costly — es el esqueleto de flujo sobre el que se montan editor, revisión y adjuntar; cambiarlo después re-cablea toda la interacción del widget.
- **P3-D-02:** **Título auto-rellenado editable.** Se rellena con `document.title` truncado a 200 códigos de punto (igual que hoy), editable; enviar queda bloqueado solo si lo deja vacío (el contrato exige título no vacío). Sustituye el atajo P2-D-01 y resuelve la nota del propietario *"Recordar arreglar este hardcode"*. — **Reversibility:** reversible.
- **P3-D-03:** **Toggle bug/feedback en el formulario** (control segmentado, por defecto `bug`, coincidiendo con el label del lanzador «Report a bug»). Coincide con el `z.enum(['bug','feedback'])` del contrato. — **Reversibility:** reversible.
- **P3-D-04:** **El composer es un overlay grande** (centrado/casi a pantalla completa, dentro del Shadow DOM) que sustituye al panel de estado de 320 px durante la fase de composición. El `status-panel` actual queda reservado para estados en vuelo (`Capturing…`, `Sending…`, `Retrying…`). — **Reversibility:** costly — es la forma del armazón del widget que aloja título/tipo/nota + previsualización + editor; el panel de estado es el único otro `view` del renderer actual.

### Editor de anotación
- **P3-D-05:** **Botón «Anotar» → editor a pantalla completa** dentro del Shadow DOM, con paleta de herramientas y un botón «Listo» para volver al formulario. Anotar es **opcional** (se puede enviar sin anotar); la previsualización del formulario es la puerta de entrada. — **Reversibility:** reversible.
- **P3-D-06:** **Barra vertical de iconos** a la izquierda (mano alzada, flecha, rectángulo, texto, máscara), una herramienta activa a la vez; el botón deshacer queda aparte en la misma barra. — **Reversibility:** reversible.
- **P3-D-07:** **Tinta de un solo color** (el color de acento del widget). Cero UI de selección de color. — **Reversibility:** reversible.
- **P3-D-08:** **Etiquetas de texto (ANN-04): clic → escribir → Enter** (texto inline sobre el canvas, confirmado con Enter o clic fuera). Sin modal. — **Reversibility:** reversible.

### Máscara e irreversibilidad
- **P3-D-09:** **Confirmación de máscara solo la primera vez.** La primera máscara de la sesión muestra el aviso «la máscara es permanente y no se puede deshacer»; las siguientes se hornean al soltar sin re-confirmar. Las máscaras siguen siendo no-deshacibles (T2). — **Reversibility:** costly — relaja el «explicit confirm modal» de C-2 a una confirmación por sesión; volver a confirmación por máscara (o a undo de máscara, que es decisión de privacidad §3) toca la interacción de máscara y su UX de irreversibilidad. *(Decisión del propietario — registrada como dato.)*
- **P3-D-10:** **Pixelación opt-in como toggle dentro de la herramienta de máscara** («Relleno / Pixelar»), relleno opaco plano (α=255) por defecto. R-13 exige pixelación opt-in en bloque ≥ `max(8 px, 2× cap-height)`, grid-snapped. — **Reversibility:** reversible.
- **P3-D-11:** **Deshacer (ANN-06): botón + Ctrl/Cmd+Z, por trazo.** Deshace un trazo de anotación a la vez (mano alzada, flecha, rectángulo o texto), **nunca** una máscara. Pila acotada (últimos ~20 trazos). — **Reversibility:** reversible.
- **P3-D-12:** **Sin «borrar todas las anotaciones»** — solo deshacer por trazo. Las máscaras ya horneadas se conservan siempre. — **Reversibility:** reversible.

### Degradación, adjuntar y revisión
- **P3-D-13:** **Composer degradado con ambas salidas (CAP-03).** Si la captura falla (sin `getDisplayMedia`, denegada, en blanco o sobredimensionada), el composer abre igual con un aviso «captura no disponible» en la zona de imagen y dos acciones: **«Adjuntar imagen»** (selector de archivo) o **«Continuar solo con texto»** (formulario título/tipo/nota sin imagen). Nunca un panel de error muerto. — **Reversibility:** reversible.
- **P3-D-14:** **Adjuntar acepta PNG + WebP + JPEG (CAP-02).** Resuelve P1-D-11 (JPEG se reconsideraba en Fase 3). ⚠ **Implica ampliar el allowlist del servidor** (`apps/api/src/ingest/sniff.ts` / `harden.ts`) de PNG+WebP a PNG+WebP+JPEG, y P1-D-12 (re-encode a mismo formato) necesita una rama JPEG (JPEG→JPEG o JPEG→WebP). El planner debe tratar esta ampliación como cambio de superficie de seguridad C-3/C-4. — **Reversibility:** costly — toca el allowlist del servidor (control de seguridad) y la lógica de re-encode; revertirlo es quitar JPEG de cliente y servidor.
- **P3-D-15:** **La imagen adjunta entra en el mismo flujo de anotación/revisión** que la captura: se muestra en el composer, se puede anotar y enmascarar (T2/T3), revisar y enviar, con la escalera de downscale/tope de tamaño. La auto-redacción DOM (T1) **no aplica** a un adjunto (no hay DOM que escanear), pero las máscaras manuales sí. — **Reversibility:** reversible.
- **P3-D-16:** **Pantalla de revisión distinta antes de enviar (PRV-07).** Muestra la imagen final (anotaciones y máscaras ya aplanadas) + título/tipo/nota resumidos, con botones «Editar» (vuelve al editor/formulario) y «Enviar». Hace explícito el momento «esto es lo que se va a enviar» (importante con máscaras irreversibles). — **Reversibility:** reversible.

### the agent's Discretion
El propietario cerró la discusión tras las 4 áreas («Nada, continua») sin profundizar en tres sub-decisiones. Latitud técnica libre para research/planner, siguiendo patrones ya fijados:
- **i18n (WDG-06):** auto-detectar `navigator.language` (`es*` → español, resto → inglés) + override manual. La colocación del selector (launcher vs composer) y la persistencia siguen el patrón P1-D-05 (selector persistido en `localStorage`). Los diccionarios `en`/`es` viven en el chunk lazy, nunca en core; la forma de enchufe es el mapa `strings.ts` de P2-D-04 (`stringsEs` + resolver).
- **Carga lazy (PRF-02):** cuándo se descarga el chunk del editor (prefetch al capturar vs bajo demanda al pulsar «Anotar») y el estado de carga visible. Ambos válidos; el presupuesto (≤ 25 KB chunk, ≤ 80 KB runtime total) es duro.
- **Formulario solo-texto (CAP-03):** la forma mínima exacta sin imagen (título/tipo/nota, sin zona de imagen). Nota del campo: `textarea` opcional ≤ `MAX_NOTE_CHARS` (contrato ya fijado).

Además: descomposición en módulos/ficheros del editor, grosor de trazo exacto, profundidad exacta de la pila de undo, y la estructura concreta de las aserciones e2e de CA-02.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & acceptance
- `.planning/ROADMAP.md` § Phase 3 — goal, 5 success criteria, the 13 requirements, and the Rationale/Risks paragraph (⚠ **C-2 `Annotator` contract**: one flattened bitmap, masks baked destructively at T2, non-undoable, single `toBlob` sink; **T3 export order**: flatten ink → re-bake masks LAST → re-run T1 → fresh `toBlob`; H-1 bitmap/device-pixel geometry at DPR 1/1.25/2/3; H-4/H-5 `DisplayMediaCapture` → `ManualFileCapture` + mandatory capture-less degradation; R-13/A-01 user masking; A-12/M-2 size arithmetic)
- `.planning/REQUIREMENTS.md` — CAP-02, CAP-03, ANN-01…ANN-06, PRV-04, PRV-07, WDG-06, PRF-02, PRF-03 definitions + traceability table

### Decisions & invariants (governing)
- `documentation/resolution-record.md` — R-01 (tiered size budget), R-02 (exactly 8 ports; reserved ports are seams only), R-12 (e2e-only verification), R-13/A-01 (flat opaque fill α=255 is the only automatic primitive; pixelation opt-in ≥ 8 px; **no gaussian blur, no CSS overlays**), R-14 (`SHADOW_MODE` build flag), R-15 (TypeScript end-to-end), R-17 (no calendar descoping), R-18 (single binding constant set), A-05 (`capture()` returns raw `ImageData`, never a Blob), A-06 (binding caps), A-08 (DOM-serialize adapter is v2). **§5 governs on conflict.**
- `documentation/mentorship-pack.md` — INV-01 (shadow DOM closed / no leakage), INV-02 (single `window.Watchbug`), INV-03 (three services), SEC-01/02/05, RNF-01/02/03 — all quality gates are hard.
- `documentation/mission-brief.md` — goal, non-goals (*Declare the No*), autonomy envelope and consultation triggers.
- `documentation/continuity-pack.md` — session state and branch-per-phase + PR policy.

### Contracts & constants (single source of truth)
- `packages/contracts/src/schema.ts` — CA-01 wire contract: `type: enum['bug','feedback']`, `title` (1..`MAX_TITLE_CHARS`, non-empty), `note` (optional ≤ `MAX_NOTE_CHARS`), `url` (path-only), `user` (Phase 4).
- `packages/contracts/src/constants.ts` — `MAX_NOTE_CHARS`, `MAX_TITLE_CHARS`, `MAX_ENCODED_IMAGE_BYTES` (2 MB), `MAX_IMAGE_PIXELS` (16 MP), `MAX_IMAGE_DIM` (8192), `MASK_ALPHA_OPAQUE` (255), `MASK_PIXELATION_MIN_BLOCK_PX` (8).

### Research evidence (locked inputs)
- `.planning/research/STACK.md` — verified pins and the "What NOT To Use" rejection list (`html2canvas`, `fabric.js`/`konva`, gaussian blur, `dotenv`, unit-test frameworks).
- `.planning/research/SUMMARY.md` — settled capture chain, encode targets (≤ 800 KB → hard 2 MB), retry constants, M-3 `blob.type` sniff.
- `.planning/research/ARCHITECTURE.md` — `WidgetHost` isolation, the 8 port seams, ingest request shape.

### Existing code (Phase 2 output) — reusable assets & integration points
- `packages/sdk/src/capture/pipeline.ts` — `runCaptureFlow` (hide → capture → redact T1 → encode → send); the one-shot flow the composer replaces/extends.
- `packages/sdk/src/capture/capture-source.ts` — `CaptureSource` seam + `DisplayMediaCapture`; `ManualFileCapture` is the second adapter (H-4/H-5).
- `packages/sdk/src/image/encode.ts` — `encodeLadder` + the single `encodeOnce` sink (the C-2 `encodeFinal()` must route through this one call site).
- `packages/sdk/src/redact/geometry.ts` / `patterns.ts` / `redactor.ts` — T1 auto-redaction; `geometry` holds the bitmap/device-pixel mask math reused for user masks.
- `packages/sdk/src/strings.ts` — the P2-D-04 `strings` map + `t()` resolver; Phase 3 adds `stringsEs` + locale resolver.
- `packages/sdk/src/widget/host.ts` / `launcher.ts` / `status-panel.ts` — the widget shell the composer mounts onto.
- `packages/sdk/src/annotator.ts` — the lazy-editor lane stub (build/size shell only) to fill.
- `packages/sdk/scripts/build.mjs` — the multi-lane dual-format build; the annotator lane is already an entry point.
- `scripts/check-size.mjs` — the RNF-01/PRF-02/PRF-03 gate (45 / 25 / 80 KB tiers).
- `e2e/` + `playwright.config.ts` — the one Playwright suite (chromium + firefox + webkit) and its artifact-level assertion style; **CA-02 lands here** (intercept outgoing request, decode image, assert masked-region original pixels absent incl. boundaries).

### Project entry point
- `AGENTS.md` — C-B-D-C control framework, consultation triggers, dev commands.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/sdk/src/strings.ts` — the `strings` map + `t()` resolver; the i18n (WDG-06) shape plugs in here (add `stringsEs` + a locale resolver, never in core).
- `packages/sdk/src/image/encode.ts` — `encodeLadder` and the single `encodeOnce` sink; the editor's `encodeFinal()` **must** route through this one call site (C-2, `grep`-gated on `toBlob|toDataURL|convertToBlob`).
- `packages/sdk/src/redact/geometry.ts` — the bitmap/device-pixel mask geometry (H-1) reused for user masks (T2/T3) and tested at DPR 1/1.25/2/3.
- `packages/sdk/src/widget/status-panel.ts` — the state-machine renderer; the composer is a new larger view alongside it (the panel stays for in-flight states).
- `packages/sdk/src/annotator.ts` — the lazy-editor lane stub to fill with the real hand-rolled canvas editor.

### Established Patterns
- **Shadow DOM `mode:'closed'` (R-14):** production closed, an e2e-only `open` bundle so Playwright can pierce the root.
- **T1 redaction ordering (A-05/SEC-02):** `CaptureSource.capture()` returns raw `ImageData`; masking runs destructively before any encode — structurally no unmasked bytes exist.
- **Single encode sink (C-2):** the canvas encode API appears exactly once in `packages/sdk/src`; the quality ladder is a loop *around* `encodeOnce`.
- **No HTML sink (T-02-01/SEC-05):** the SDK renders text via `textContent` / `createElementNS` only, never `innerHTML` — the composer/editor must follow this.
- **Verification (R-12):** one Playwright suite + `check:size`, e2e and property assertions only — no unit tests, no coverage thresholds.
- **Commit/docs:** `commit_docs: true`; plan files follow `03-NN-PLAN.md`.

### Integration Points
- `window.Watchbug.init()` → launcher → `runCaptureFlow` — the flow-entry seam where the composer replaces the one-shot send (P2-D-01 → P3-D-01/02/03).
- POST `/api/incidents` — multipart `{ meta, image }` via lane-1 plain `fetch` with `X-Project-Key` + `Idempotency-Key` (server-deduped).
- `packages/sdk/scripts/build.mjs` — the annotator lane is already an entry point; Phase 3 fills its source instead of adding build plumbing.
- `apps/api/src/ingest/sniff.ts` + `harden.ts` — the format allowlist must expand PNG+WebP → PNG+WebP+JPEG for P3-D-14 (server-side security surface).
- `scripts/check-size.mjs` — PRF-02/PRF-03 asserted against the real emitted annotator chunk + runtime total.

</code_context>

<specifics>
## Specific Ideas

- **El composer es el reemplazo del atajo one-shot de la Fase 2**, no un añadido lateral: el formulario (título editable, tipo, nota) y el overlay grande sustituyen al `status-panel` como superficie de composición, y el panel de estado queda solo para los estados en vuelo.
- **La confirmación de máscara es por sesión, no por máscara** (P3-D-09) — decisión deliberada del propietario que relaja el «explicit confirm modal» de C-2 a un aviso de una sola vez; la irreversibilidad sigue intacta (T2).
- **Adjuntar (CAP-02) es un camino de primera clase, no un parche**: PNG+WebP+JPEG, mismo flujo de anotación/revisión, y la ampliación del allowlist del servidor es parte del trabajo (no un cambio incidental).
- **i18n del widget (WDG-06) sigue el patrón del panel (P1-D-05)**: auto-detección + override manual persistido, diccionarios en el chunk lazy.

</specifics>

<deferred>
## Deferred Ideas

- **Host-configurable redaction rules** — the `Redactor` port stays an unused seam in v1; a public rules API would be a public-interface change (consultation trigger) if ever added.
- **Optional DOM-serialization `CaptureSource`** — v2 (A-08); its size scenario stays in `check:size` but no adapter is built.
- **Mask-undo / per-mask confirmation** — any future mask-undo is a §3-adjacent privacy decision requiring a Consultation Request Pack (C-2). The owner's once-per-session confirmation (P3-D-09) is the v1 stance.
- No todos matched this phase (`todo.match-phase 3` → 0).

</deferred>

---

*Phase: 3-Report Composer & Annotation Editor (lazy)*
*Context gathered: 2026-10-28*
