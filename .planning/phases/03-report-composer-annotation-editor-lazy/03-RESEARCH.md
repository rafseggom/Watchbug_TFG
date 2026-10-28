# Phase 3: Report Composer & Annotation Editor (lazy) — Research

**Researched:** 2026-10-28
**Domain:** Vanilla-TS canvas annotation editor + destructive masking + lazy chunk loading inside a closed Shadow DOM; plus a server-side image allowlist expansion
**Confidence:** HIGH (stack/architecture/security-surface), MEDIUM (JPEG structural control strategy, attachment decode-bomb posture)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

> Local decision IDs are prefixed `P3-D-` to avoid collision with the global `D-01…D-08` register in `documentation/resolution-record.md`.

**Flujo del composer**
- **P3-D-01:** **Captura directa → formulario.** El clic del lanzador captura inmediatamente (conserva la activación transitoria de P2-D-05 y el camino rápido actual). Si la captura va bien, se abre el formulario con la imagen ya tomada; si falla, el formulario abre en modo degradado (P3-D-13). — **Reversibility:** costly — es el esqueleto de flujo sobre el que se montan editor, revisión y adjuntar; cambiarlo después re-cablea toda la interacción del widget.
- **P3-D-02:** **Título auto-rellenado editable.** Se rellena con `document.title` truncado a 200 códigos de punto (igual que hoy), editable; enviar queda bloqueado solo si lo deja vacío (el contrato exige título no vacío). Sustituye el atajo P2-D-01 y resuelve la nota del propietario *"Recordar arreglar este hardcode"*. — **Reversibility:** reversible.
- **P3-D-03:** **Toggle bug/feedback en el formulario** (control segmentado, por defecto `bug`, coincidiendo con el label del lanzador «Report a bug»). Coincide con el `z.enum(['bug','feedback'])` del contrato. — **Reversibility:** reversible.
- **P3-D-04:** **El composer es un overlay grande** (centrado/casi a pantalla completa, dentro del Shadow DOM) que sustituye al panel de estado de 320 px durante la fase de composición. El `status-panel` actual queda reservado para estados en vuelo (`Capturing…`, `Sending…`, `Retrying…`). — **Reversibility:** costly — es la forma del armazón del widget que aloja título/tipo/nota + previsualización + editor; el panel de estado es el único otro `view` del renderer actual.

**Editor de anotación**
- **P3-D-05:** **Botón «Anotar» → editor a pantalla completa** dentro del Shadow DOM, con paleta de herramientas y un botón «Listo» para volver al formulario. Anotar es **opcional** (se puede enviar sin anotar); la previsualización del formulario es la puerta de entrada. — **Reversibility:** reversible.
- **P3-D-06:** **Barra vertical de iconos** a la izquierda (mano alzada, flecha, rectángulo, texto, máscara), una herramienta activa a la vez; el botón deshacer queda aparte en la misma barra. — **Reversibility:** reversible.
- **P3-D-07:** **Tinta de un solo color** (el color de acento del widget). Cero UI de selección de color. — **Reversibility:** reversible.
- **P3-D-08:** **Etiquetas de texto (ANN-04): clic → escribir → Enter** (texto inline sobre el canvas, confirmado con Enter o clic fuera). Sin modal. — **Reversibility:** reversible.

**Máscara e irreversibilidad**
- **P3-D-09:** **Confirmación de máscara solo la primera vez.** La primera máscara de la sesión muestra el aviso «la máscara es permanente y no se puede deshacer»; las siguientes se hornean al soltar sin re-confirmar. Las máscaras siguen siendo no-deshacibles (T2). — **Reversibility:** costly — relaja el «explicit confirm modal» de C-2 a una confirmación por sesión; volver a confirmación por máscara (o a undo de máscara, que es decisión de privacidad §3) toca la interacción de máscara y su UX de irreversibilidad. *(Decisión del propietario — registrada como dato.)*
- **P3-D-10:** **Pixelación opt-in como toggle dentro de la herramienta de máscara** («Relleno / Pixelar»), relleno opaco plano (α=255) por defecto. R-13 exige pixelación opt-in en bloque ≥ `max(8 px, 2× cap-height)`, grid-snapped. — **Reversibility:** reversible.
- **P3-D-11:** **Deshacer (ANN-06): botón + Ctrl/Cmd+Z, por trazo.** Deshace un trazo de anotación a la vez (mano alzada, flecha, rectángulo o texto), **nunca** una máscara. Pila acotada (últimos ~20 trazos). — **Reversibility:** reversible.
- **P3-D-12:** **Sin «borrar todas las anotaciones»** — solo deshacer por trazo. Las máscaras ya horneadas se conservan siempre. — **Reversibility:** reversible.

**Degradación, adjuntar y revisión**
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

### Deferred Ideas (OUT OF SCOPE)

- **Host-configurable redaction rules** — the `Redactor` port stays an unused seam in v1; a public rules API would be a public-interface change (consultation trigger) if ever added.
- **Optional DOM-serialization `CaptureSource`** — v2 (A-08); its size scenario stays in `check:size` but no adapter is built.
- **Mask-undo / per-mask confirmation** — any future mask-undo is a §3-adjacent privacy decision requiring a Consultation Request Pack (C-2). The owner's once-per-session confirmation (P3-D-09) is the v1 stance.
- No todos matched this phase (`todo.match-phase 3` → 0).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAP-02 | An end user can attach an image from their device instead of capturing | §Attachment path (`ManualFileCapture`); §Lazy loading; F1 (JPEG allowlist expansion — 6 API call-sites + 1 migration) |
| CAP-03 | An end user sees a clear failure state when capture is unavailable and can still file text-only feedback | §Flow refactor (`pipeline.ts` split); §Degraded composer; existing `blankProbe` semantics |
| ANN-01 | Freehand drawing | §Editor architecture — vector stroke list + `pointerdown/move/up` on one canvas |
| ANN-02 | Arrows | §Editor architecture — line + filled head, 12 px head |
| ANN-03 | Rectangles | §Editor architecture — `strokeRect` |
| ANN-04 | Text labels | §Editor architecture — `fillText` (no DOM, no XSS sink); canvas font parse fallback |
| ANN-05 | Opaque mask | §Destructive masking (T2) — post-mask **patch** stored, re-baked after every stroke |
| ANN-06 | Undo annotation strokes only | §Undo model — redraw base + remaining strokes + mask patches; masks never popped |
| PRV-04 | Masked region unrecoverable from the encoded image | §CA-02 assertion strategy — reuse `analyzeRedaction` / `expectMaskedAndTargeted`; magenta-marker non-vacuity |
| PRV-07 | Review and edit before send | §Composer/review state machine; encode-at-Review |
| WDG-06 | English or Spanish, auto-matched + manual override | §i18n design (and the core-vs-lazy dictionary split conflict) |
| PRF-02 | Each lazy chunk ≤ 25 KB gz | §Measured budget (lazy lane is 0.3 KB today) + lazy-load assertion row |
| PRF-03 | Total runtime payload ≤ 80 KB gz | §Measured budget (core 9.3 + lazy 0.3 = 10.0 KB) |

</phase_requirements>

---

## Summary

Phase 3 is a **client-architecture phase with one genuinely dangerous server-surface change**. Four findings dominate planning:

1. **The size budget is not the risk.** Measured today with `node scripts/check-size.mjs`: core **9.3 KB gz / 45**, lazy **0.3 KB / 25**, runtime **10.0 KB / 80**. There is ~35 KB of core headroom and ~24.7 KB of lazy headroom. A hand-rolled five-tool canvas editor plus two locale dictionaries will fit with large margin; PRF-02/PRF-03 are *already mechanically gated* by `scripts/check-size.mjs` (it budgets `watchbug-annotator.js` at 25 KB today). The remaining work is content plus one **behavioural** assertion: the chunk is not fetched before `Annotate image` is clicked.

2. **The lazy chunk cannot be loaded with a bundler-assisted `import()`.** VERIFIED empirically in this repo with `esbuild@0.28.2`: a *string-literal* `import()` is inlined by `bundle: true` unless `splitting` is on, and `splitting` "currently only works with the `esm` output format" — so the IIFE core would inline the editor and blow the 45 KB tier. A **non-analyzable** `import(variableUrl)` is preserved verbatim in *both* formats (verified output below), and works from a classic script. That gives one loading code path for both lanes. It also means the chunk must be an **ES module** (`.mjs`), because `import()` always loads its target as a module — which is what keeps `WDG-04` ("exactly one global") trivially true, unlike script-tag injection of an IIFE chunk with a `globalName`.

3. **Phase 3 breaks ~30 existing e2e rows.** Every row that assumes the Phase-2 one-gesture `click → POST` contract now has to walk `composer → Review report → Send report`. The capture-failure rows additionally move from `status-panel` copy to the degraded composer. This is mechanical but it is the single largest schedule item in the phase and must be one dedicated plan task with a shared helper, not scattered edits.

4. **JPEG is a server-security change, and the client never actually sends JPEG.** `ManualFileCapture` → `ImageData` → `encodeLadder` means the SDK re-encodes every attachment to WebP or PNG before it leaves the browser (C-2's single sink guarantees it). So JPEG support is (a) an *input* format on the client, and (b) a *server allowlist* change reachable only by a non-SDK caller. Because the server change touches a **DB CHECK constraint**, it requires a **migration**, and `AGENTS.md` states "A migration is a consultation trigger". There is also a latent correctness bug waiting in the obvious implementation: `incidents.ts:321` maps everything non-PNG to `image/webp`, so a naive `'jpeg'` extension would store JPEG bytes under a WebP MIME type — which the existing CHECK constraint would happily accept.

**Primary recommendation:** Build the editor as a *single-canvas, vector-stroke, patch-rebaked* module in the lazy lane, load it with one `import(variableUrl)` path resolved from `document.currentScript.src` (IIFE) or `import.meta.url` (ESM), keep `encodeLadder` as the only encode sink (the editor returns `ImageData`, never a blob), and split the phase into: (W1) flow refactor + composer + degraded state + i18n core dictionary, (W2) editor chunk + masking + CA-02, (W3) attach + JPEG server surface + migration checkpoint, (W4) e2e migration of the Phase-2 rows + lazy-load proof + size gate.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Report form state (title/type/note) | Browser / Client (SDK core) | — | No server round-trip until Send; `MAX_*_CHARS` are UX clamps, the API is the control (A-06). |
| Capture (tab) | Browser / Client (`DisplayMediaCapture`) | — | Locked Phase 2; requires transient activation, so it must stay in the click's own task (P2-D-05). |
| Image attach (file → pixels) | Browser / Client (`ManualFileCapture`) | — | The file never leaves the device; the port already returns raw `ImageData` (A-05). |
| Annotation (5 tools) | Browser / Client (**lazy chunk**) | — | Canvas-only; zero DOM text sink (SEC-05); 25 KB tier (PRF-02). |
| Destructive masking (T2/T3) | Browser / Client | — | SEC-02/R-13: pixels must be destroyed *before* any encode. Server-side masking is structurally impossible under this contract. |
| Final encode | Browser / Client (**core**, `encodeLadder`) | — | C-2 single `toBlob` sink, grep-gated in `scripts/gate.mjs`. |
| i18n copy | Browser / Client (core for form/status, lazy for editor) | — | Bulk dictionaries live in the lazy chunk (ROADMAP), but the form must localise without it — see Open Question OQ-1. |
| Image format allowlist / decode / re-encode | **API / Backend** | — | TB-2 boundary. Client clamps are UX only. |
| `content_type` constraint | **Database / Storage** | API | `incidents_content_type_check` is the enforcement point for what the blob route may serve. |

---

## Standard Stack

**No new dependencies — by constraint, not preference.** `gate.mjs` rule `sdk-runtime-deps` permits only `@watchbug/contracts`, and `PRF-04` forbids any runtime npm dependency in the SDK. Everything this phase adds is platform API plus hand-written TypeScript.

### Core (client, zero bytes added to `node_modules`)

| Surface | API / Module | Purpose | Why standard |
|---|---|---|---|
| Editor canvas | `HTMLCanvasElement` + `CanvasRenderingContext2D` (`drawImage`, `stroke`, `fill`, `fillText`, `getImageData`, `putImageData`) | The whole editor | D-05 closed `fabric.js`/`konva`; STACK.md rejects them at ≈85 KB / ≈45 KB gz. Raw canvas is the only path under 25 KB. |
| Pointer input | `pointerdown` / `pointermove` / `pointerup` + `setPointerCapture` | Drag-to-draw, drag-to-mask | Single unified event family across mouse/touch/pen; matches the UI-SPEC's pointer-primary canvas. |
| File decode | `createImageBitmap(File)` | Attachment → bitmap | Baseline "Widely available"; accepts `Blob`/`File` directly, so no `FileReader` and no `img.onload` plumbing. `imageOrientation` **defaults to `from-image`**, i.e. EXIF orientation is applied for free. |
| Lazy load | `import(variableUrl)` | Fetch the editor chunk | Works from a classic script *and* a module; preserved verbatim by esbuild (verified); no global, no `globalName` (WDG-04). |
| Locale detect | `navigator.language` | WDG-06 auto-match | `es*` → `es`, else `en`. No `Intl` formatter machinery (`t()` stays placeholder-only). |
| Server re-encode | `sharp@0.35.5` (**already installed**) | JPEG branch | `sharp(buf, { autoOrient: true }).jpeg()` — see F1. |

### Supporting

| Item | Version | Purpose | When to use |
|---|---|---|---|
| `scripts/check-size.mjs` | in-repo | PRF-02/PRF-03 gate | Already budgets `watchbug-annotator.js` at 25 KB and the runtime total at 80 KB. Needs one change: gate the **shipped** artifact (see §Lazy loading). |
| `scripts/gate.mjs` | in-repo | `sdk-single-encode-sink` (C-2) | Must stay green; the lazy chunk may not contain the string `toBlob`/`toDataURL`/`convertToBlob`, comments included. |
| `@playwright/test` | 1.63.0 | The one suite | All new assertions land here (R-12). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| One canvas + vector stroke list | Two canvases (base + ink overlay) composited at export | Rejected: an ink overlay is a *layer stack*, which C-2/A-04 explicitly forbids ("no layer-stack export"). It also makes "masks win any overlap" a composite-ordering assumption instead of a pixel fact. |
| `import(variableUrl)` | `<script src>` injection for the IIFE lane | Works, but the injected IIFE chunk must hand its entry back without a global (only via `document.currentScript` back-channels) and reintroduces the `globalName` question against WDG-04. Rejected. |
| Whole-bitmap `getImageData` per mask stroke | Rect-restricted `getImageData(x,y,w,h)` + `putImageData` | The restricted read is the recommendation — same guarantee, O(rect) instead of O(frame). |
| Re-deriving mask pixels on every redraw | Store the **post-mask patch** per mask | Rejected re-derivation: re-filling a rect on top of later ink re-blacks the rect but a pixelated mask would re-average *ink-contaminated* pixels and drift between preview and export. The patch contains only destroyed pixels, so it is not a "pre-mask layer" (C-2) and reproduces the export exactly. |
| Server-side JPEG structural walker | Rely on the `sharp` root re-encode as the JPEG control | See F1 — recommended, with an explicit written rationale; `structure.ts` already documents that it "never claims to be the control on its own". |

**Installation:** none. `sharp@0.35.5` is already a dependency of `apps/api`.

---

## Package Legitimacy Audit

**No packages are installed by this phase.** The SDK adds zero dependencies (PRF-04, enforced by `gate.mjs sdk-runtime-deps`); `apps/api` already pins `sharp@0.35.5`, `fastify@5.12.5` and the `@fastify/*` set from `STACK.md`. No `npm install` step exists in any Phase-3 plan, so no registry lookup, no `postinstall` inspection and no `checkpoint:human-verify` install gate is required.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — (none added) | — | — | — | — | — | Not applicable |

*If a planner is tempted to add any editor/asset dependency: it is a PRF-04 violation and a Consultation Request Pack, not a research question.*

---

## Architecture Patterns

### System Architecture Diagram

```
                    host page (TB-1, untrusted)
                              │
              <script async src="…/watchbug.js">
                              │  onload → Watchbug.init({ projectKey })
                              ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  CORE LANE  (watchbug.js | .mjs, ≤45 KB gz, 9.3 KB today)    │
        │                                                              │
        │  index.ts ── screen router (NEW) ──┬─ status-panel (P2)      │
        │                                    │   in-flight/terminal    │
        │                                    ├─ composer.ts   (NEW)    │
        │                                    └─ review.ts     (NEW)    │
        │                                                              │
        │  capture/pipeline.ts ── SPLIT (NEW) ─────────────────────┐   │
        │    runCaptureStage()  capture → blankProbe → T1 redact   │   │
        │    encodeFinal()      flatten → rebake masks → T1 again  │   │
        │                       → encodeLadder  (single toBlob)    │   │
        │                       ▲                                  │   │
        │  image/encode.ts ─────┘                                  │   │
        │  redact/geometry.ts  (reused: toBitmapRect/transformFor) │   │
        │  strings.ts  en + es for core surfaces (+ locale resolver)│  │
        └──────────────────────────────────────────────────────────┼───┘
                              │  Annotator.open(base: ImageData)  │
                              │  returns { img: ImageData, masks } │
                              │  load = import(new URL('watchbug-   │
                              │         annotator.mjs', baseUrl))   │
                              ▼                                    │
        ┌──────────────────────────────────────────────┐            │
        │  LAZY LANE (watchbug-annotator.mjs, ≤25 KB)   │            │
        │  toolbar · canvas · 5 tools · undo · mask     │            │
        │  confirm (once/session) · en+es editor copy   │            │
        │  → returns flattened ImageData + mask list    │            │
        └──────────────────────────────────────────────┘            │
                              │                                     │
                              ▼                                     ▼
                       composer → review ──────────────► POST /api/incidents
                                                          (multipart meta+image)
                                                                    │
                    ┌───────────────────────────────────────────────┘
                    ▼
   apps/api  sniff(magic) → [structure] → guard(dims) → harden(sharp re-encode)
             → sanitize+validate meta → Storage.put → INSERT (content_type CHECK)
                                                                       │
                                                                       ▼
                                                            PostgreSQL + volume
```

Trace the primary use case: gesture → capture → T1 → composer → editor → mask → review → single encode → multipart POST → five ingest stages → row.

### Recommended Project Structure (SDK additions)

```
packages/sdk/src/
├── index.ts                  # + screen router wiring (idle|status|composer|editor|review)
├── strings.ts                # + stringsEs (core surfaces) + setLocale()/currentLocale()
├── strings.editor.ts         # en+es for editor.* / mask.*  (imported ONLY by the lazy lane)
├── annotator.ts              # LAZY ENTRY: Annotator port + canvas adapter (replaces the stub)
├── annotator/                # (lazy-lane internals; any split is executor's discretion)
│   ├── canvas-layer.ts       # tool state machine, pointer→bitmap mapping, redraw
│   ├── tools.ts              # freehand | arrow | rect | text | mask
│   ├── masks.ts              # patch store, fill/pixelate primitives, rebake()
│   └── editor-dom.ts         # toolbar, top bar, confirm dialog (createElement only)
├── capture/
│   ├── pipeline.ts           # SPLIT into runCaptureStage() + encodeFinal() + send()
│   └── manual-file.ts        # NEW: ManualFileCapture (second CaptureSource adapter)
├── image/encode.ts           # export a fitToCaps(w,h) helper (no DPR clamp)
└── widget/
    ├── composer.ts           # NEW: overlay, segmented toggle, title, note, image zone
    ├── review.ts             # NEW: flattened image + summary + Edit/Send
    └── status-panel.ts       # unchanged; only in-flight + terminal send states
```

```
apps/api/src/
├── ingest/sniff.ts     # + JPEG magic (FF D8 FF)
├── ingest/structure.ts # + jpeg branch (recommend: documented pass-through)
├── ingest/guard.ts     # + JPEG SOF dimension walker
├── ingest/harden.ts    # + autoOrient + .jpeg() branch
├── routes/incidents.ts # + CONTENT_TYPE_BY_EXT.jpeg, + ext→MIME ternary, + error copy
└── db/schema.ts        # + 'image/jpeg' in incidents_content_type_check  ⚠ MIGRATION
```

### Pattern 1: Split the pipeline at the pixel boundary, not at the widget boundary

**What:** Today `runCaptureFlow` is one linear function ending in `deliver(...)` (`capture/pipeline.ts:191-285`). Phase 3 needs the *same* ordering with a human in the middle.
**When to use:** always — this is the phase's spine.
**Shape:**

```ts
// capture/pipeline.ts (refactored)
export async function runCaptureStage(deps): Promise<CaptureOutcome>
//   CaptureOutcome =
//     | { ok: true; image: ImageData; t1: BitmapRect[] }   // already T1-redacted
//     | { ok: false; failure: 'capture' | 'blank' }
export async function encodeFinal(image: ImageData, t1: readonly BitmapRect[], masks: readonly MaskPatch[]): Promise<EncodedImage>
//   order is the invariant: T1(no-op re-apply) → user masks LAST → encodeLadder
```

`CaptureOutcome.t1` holds **bitmap-space** rects, computed at the pixel-read instant with the transform of *that* frame — never re-derived from the live viewport at export time (a resize or zoom between capture and export would otherwise move every mask).

**Why it matters:** the pipeline is the only place where "no encoded byte exists before redaction" is structurally true (`A-05`: `capture()` returns `ImageData`, never a `Blob`). Splitting must preserve that: the composer and the editor both handle `ImageData`, and `encodeLadder` stays the only producer of a `Blob`.

### Pattern 2: Editor canvas = one bitmap-sized canvas, CSS-fitted; map pointers with the existing geometry module

**What:** Put the canvas in the DOM at its **display** size (`style.width/height` = the contain-fit rect, px), leave `canvas.width/height` at the **bitmap** size. Pointer → bitmap then reduces to the exact shape `geometry.ts` already implements.
**Why:** it makes DPR and non-integer zoom fall out of arithmetic rather than a special case, and it reuses `transformFor` / `toBitmapRect` (R-18) instead of a second geometry implementation.

```ts
// annotator/canvas-layer.ts
const box = canvas.getBoundingClientRect();
const t = transformFor(canvas.width, canvas.height, box.width, box.height);
const rect = toBitmapRect(
  { left: e.clientX - box.left, top: e.clientY - box.top,
    right: e.clientX - box.left, bottom: e.clientY - box.top },
  t, canvas.width, canvas.height,
);
```

For freehand points (not rects) the same scale applies per axis: `bx = Math.round(px * t.scaleX)`.

**Stroke width:** logical 3 px must be converted once: `strokePx = 3 * t.scaleX` (equivalently `3 * canvas.width / box.width`). That single expression covers DPR 1 / 1.25 / 2 / 3 and browser zoom, which is exactly the H-1 matrix the e2e already runs.

**Caveat — do not reuse `transformFor` against the *viewport*.** `transformFor(frameW, frameH, viewportW, viewportH)` is correct only when the frame covers the whole viewport (the capture case). In the editor, pass the *canvas's own CSS box* as the "viewport", never `window.innerWidth/innerHeight`.

### Pattern 3: Masks are patches, re-baked after every stroke (T2 + T3 in one mechanism)

**What:** Each completed mask stroke produces a *post-mask patch*: `{ rect: BitmapRect, pixels: ImageData }` where `pixels` was produced by reading the region **after** the destructive fill/pixelate. Export = `drawImage(base)` → replay strokes → `putImageData(patch)` for each mask, in creation order.
**Why:** it satisfies three requirements at once and each is checkable:
- **T2** (bake at stroke completion) — the patch is read from the canvas immediately after the fill, so the working canvas never holds recoverable source pixels in that region.
- **C-2** ("no pre-mask state") — the patch contains only *destroyed* pixels, never the originals. This is the line: an undo stack over pre-mask state is forbidden; a post-mask patch is not.
- **T3** (masks are the LAST pixel operation) — replaying patches after strokes means annotation ink physically cannot sit on top of a mask, in the preview *or* in the export.

Run `rebakeMasks()` after **every** stroke commit (not only at export). With rect-sized patches this is microseconds and it makes "undecipherable even by later annotation strokes" true continuously, not only at the last moment.

**Two primitives, one switch:**
- `fill` (default): constant `rgb(0,0,0)`, α 255 — identical to T1's `MASK_RGB` (`redact/redactor.ts:44`, `const MASK_RGB = { r: 0, g: 0, b: 0 } as const;`), so a user mask reads visually as the same redaction automatic masking produces.
- `pixelate` (opt-in): block size `Math.max(MASK_PIXELATION_MIN_BLOCK_PX, Math.ceil(2 * capHeightPx))` (`MASK_PIXELATION_MIN_BLOCK_PX` = `8`), region snapped **outward** to the block grid, every block replaced by its mean, α forced to 255.

**Compute `capHeightPx` rather than assuming it.** `TextMetrics.actualBoundingBoxAscent` on `"H"` at the label font size (15 px) gives the real cap height in a few lines; a hard-coded constant would be an unverified assumption about the platform font.

### Pattern 4: Lazy load = one non-analyzable `import()` in both formats

**What:**
```ts
// index.ts (or widget/loader.ts)
const CORE_URL = LOADING_SCRIPT_URL        // captured at module eval, IIFE only
  ?? (typeof import.meta !== 'undefined' ? import.meta.url : undefined); // ESM only
const CHUNK_URL = new URL('watchbug-annotator.mjs', CORE_URL).href;
const mod = await import(/* non-analyzable */ anchor(CHUNK_URL)) as AnnotatorModule;
```
where the specifier reaches `import()` through a variable (`anchor` is an identity that stops esbuild constant-folding, or simply assign to a `let`).

**Verified output (esbuild 0.28.2, this repo):**
- `format: 'esm'` → `var t=globalThis.__U;async function a(){return await import(t)}` — preserved.
- `format: 'iife'` → `async function y(){return await import(p)}` — preserved **and valid in a classic script**.
- `format: 'iife'` + `import.meta.url` → `function f(){return _.url}` where `_={}` → **`undefined`**. This is the confirmed reason `index.ts` already records in its comment that `import.meta.url` "cannot survive the IIFE lane".

**Consequences the planner must encode:**
- The shipped lazy artifact is the **`.mjs`**; the IIFE twin of the lazy lane is not loadable by this mechanism. Either keep emitting it (harmless, but then gate both) or stop emitting it. Recommendation: **gate the max of the two in `check-size.mjs`** so neither can silently drift, and load the `.mjs`.
- The specifier must be an **absolute URL**: in a classic script, `import()` resolves relative to the *document* base URL, not the script. Build it with `new URL(..., CORE_URL)`.
- CSP: the host's `script-src` must allow the SDK origin. It almost always does (the core already loaded from there), and `'strict-dynamic'` permits dynamically imported scripts. This is a **documented integration limit** for nonce-only policies — do not try to test it.
- Load failure → re-enable `Annotate image` and show an inline error. No new state machine branch beyond that.

### Pattern 5: Screen router in core, `StatusView` untouched

```ts
type Screen =
  | { kind: 'idle' }
  | { kind: 'status'; view: StatusView }              // Phase 2 panel, unchanged
  | { kind: 'composer'; draft: Draft }
  | { kind: 'editor' }
  | { kind: 'review'; draft: Draft; encoded: EncodedImage };

interface Draft {
  type: 'bug' | 'feedback';
  title: string;
  note: string;
  image: ImageData | null;   // T1-redacted, possibly user-annotated/masked
  t1: BitmapRect[];          // bitmap-space T1 rects for the export re-apply
  masks: MaskPatch[];        // post-mask patches (survive editor round-trips)
  locale: 'en' | 'es';
  captureNote: 'ok' | 'denied' | 'blank' | 'oversize' | 'none'; // degraded copy choice
}
```

`StatusPanel.render()` keeps its `StatusView` union (`widget/status-panel.ts:31-37`) verbatim. Only `index.ts`'s wiring changes: `onView` now feeds the router, and the router decides whether the panel or a new overlay owns the screen. This is the smallest possible diff to Phase-2 code and keeps all existing `status.*` rows meaningful.

### Pattern 6: `ManualFileCapture` as the second `CaptureSource` adapter

```ts
// capture/manual-file.ts
export function createManualFileCapture(fallback: CaptureSource): CaptureSource {
  return {
    async capture(request) {
      // `beforeRead` is meaningless for a file (no DOM↔bitmap registration),
      // so it is invoked for seam-compatibility and its throw still aborts.
      request.beforeRead();   // must run *after* the frame exists -> see Note
      ...
    },
  };
}
```

**Note:** the H-4/H-5 chain is *not* "try display capture, then silently fall through to a file picker". The UI-SPEC's flow is explicit: capture failure → **degraded composer** → the *user* chooses `Attach image` or `Continue with text only` (P3-D-13). So `ManualFileCapture` is a **user-invoked** adapter, not an automatic fallback inside `capture()`. Model it as a standalone `CaptureSource` the composer calls when the user picks a file; do **not** wrap `DisplayMediaCapture` with it — wrapping would make a denied capture silently pop a file dialog, and CAP-03's whole point is a *visible* failure state.

Decode path:
```ts
const bitmap = await createImageBitmap(file);          // EXIF orientation applied by default
const fit = fitToCaps(bitmap.width, bitmap.height);    // MAX_IMAGE_DIM + MAX_IMAGE_PIXELS only
const c = document.createElement('canvas');
c.width = fit.width; c.height = fit.height;
const ctx = c.getContext('2d', { willReadFrequently: true })!;
ctx.imageSmoothingQuality = 'high';
ctx.drawImage(bitmap, 0, 0, fit.width, fit.height);
const image = ctx.getImageData(0, 0, fit.width, fit.height);
bitmap.close();
```

**Do not reuse `initialDimensions()` from `image/encode.ts` verbatim** — it starts with the `devicePixelRatio > 2` clamp (`encode.ts:133-138`), which is correct for a *captured* frame and wrong for a file (a file's pixel grid has nothing to do with the display). Export a `fitToCaps(w,h)` that applies only `MAX_IMAGE_DIM` and `MAX_IMAGE_PIXELS`, and have `initialDimensions` call it after the DPR clamp.

### Anti-Patterns to Avoid

- **Reusing `toBitmapRect` against `window.innerWidth/innerHeight` inside the editor.** It will appear to work at DPR 1 on a maximised window and fail everywhere else.
- **Reading the whole 16 MP frame into a fresh `ImageData` per mask stroke.** Restrict `getImageData` to the drag rect.
- **A `mask undo`.** Popping a mask patch is a §3-adjacent privacy change and needs a Consultation Request Pack (C-2). The undo stack pops strokes only, and `masks` is a separate append-only array.
- **Putting `toBlob`/`toDataURL`/`convertToBlob` in the lazy chunk, even in a comment.** `scripts/gate.mjs:134` counts text: `const SINK = /\b(?:toBlob|toDataURL|convertToBlob)\b/g;` across every `packages/sdk/src` file.
- **`innerHTML`, `insertAdjacentHTML`, `document.write`** anywhere in the composer/editor — T-02-01 (`textContent` / `createElement` / `createElementNS` only).
- **Persisting the locale override.** `gate.mjs sdk-no-host-storage` fails on the literal `localStorage`. UI-SPEC A-1 already resolved this to in-memory.
- **`prefetch`ing the editor at capture time.** UI-SPEC A-2 rejects it, and the PRF-02 row would then be meaningless.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| CSS-px → bitmap-px registration | A second transform implementation | `redact/geometry.ts` `transformFor` + `toBitmapRect` (already outward-rounding, already fail-closed on non-finite input) | H-1 is already proven at DPR 1/1.25/2/3 by four existing e2e rows; a second implementation inherits none of that evidence. |
| Image dimension capping | A new cap ladder | `MAX_IMAGE_DIM` / `MAX_IMAGE_PIXELS` from `@watchbug/contracts/constants`, plus the existing clamp logic factored into `fitToCaps` | A-06/R-18: one binding constant set. |
| The final encode | Anything in the lazy chunk | `encodeLadder` in core (single `toBlob` sink) | C-2 + `gate.mjs sdk-single-encode-sink`. |
| JPEG decode/re-encode on the server | A JPEG structural parser | `sharp(buf, { autoOrient: true }).jpeg({ quality: 80 })` | See F1. A hand-rolled JPEG walker is where the polyglot bugs live. |
| Locale string plumbing | An i18n runtime | `strings` + `stringsEs` maps and the existing `t(id, vars?)` (`strings.ts:36`) | `t()` is placeholder-only by design (P2-D-04); RNF-03 needs two locales, not a formatter. |
| Mask confirmation dialog | A modal framework | A `div[role="alertdialog"]` + focus trap of ~20 lines | One dialog in the whole product. |
| Canvas font string | Trusting `context.font = '... system-ui ...'` | Assign, then read back and verify; fall back to `'15px sans-serif'` on mismatch | Canvas `font` is parsed by the *CSS font shorthand* grammar and silently ignored on failure (the context keeps its previous value). A silent fallback here means 15 px labels rendering as 10 px. |

**Key insight:** every "hard" problem this phase has is already solved somewhere in the repository — geometry, caps, encode, copy, pointer-free DOM building. The genuinely new code is the tool state machine and the mask primitives. Budget the plan accordingly: the *integration* and the *test migration* dominate.

---

## Critical Research Findings

### F1 — JPEG allowlist expansion: seven call-sites, one migration, one latent bug

P3-D-14 locks "attach accepts PNG + WebP + JPEG" and states the server allowlist expansion is part of the work. Reading the actual code, the expansion is not one file — it is seven, and one of them is a schema migration.

| # | File | Current state (verbatim) | Required change |
|---|---|---|---|
| 1 | `packages/contracts/src/types.ts:15` | `export type ImageExt = 'png' \| 'webp';` | add `'jpeg'` |
| 2 | `apps/api/src/ingest/sniff.ts:16-23` | PNG signature + `RIFF`/`WEBP` check, else `null` | add the 3-byte JPEG prefix check |
| 3 | `apps/api/src/ingest/structure.ts:160` | `const stripped = ext === 'png' ? stripPng(buf) : stripWebp(buf);` | see "structural control" below |
| 4 | `apps/api/src/ingest/guard.ts:69` | `return ext === 'png' ? readPngDimensions(buf) : readWebpDimensions(buf);` | add an SOF-marker walker |
| 5 | `apps/api/src/ingest/harden.ts:101-104` | `ext === 'png' ? await pipeline.png()… : await pipeline.webp()…` | add `pipeline.jpeg()` + `autoOrient` |
| 6 | `apps/api/src/routes/incidents.ts:53` | `const CONTENT_TYPE_BY_EXT: Record<string, string> = { png: 'image/png', webp: 'image/webp' };` | add `jpeg: 'image/jpeg'` |
| 7 | `apps/api/src/routes/incidents.ts:321` | `contentType: hardened.ext === 'png' ? 'image/png' : 'image/webp',` | **latent bug** — see below |
| 8 | `apps/api/src/routes/incidents.ts:463` | `const ext = row.contentType === 'image/webp' ? 'webp' : row.contentType === 'image/png' ? 'png' : null;` | add the `image/jpeg` arm |
| 9 | `apps/api/src/routes/incidents.ts:246` | `'image is neither PNG nor WebP (magic bytes); SVG, GIF and HTML are never accepted'` | update the client-facing copy |
| 10 | `apps/api/src/db/schema.ts:53` | `check('incidents_content_type_check', sql`${t.contentType} in ('image/webp', 'image/png')`),` | **add `'image/jpeg'` → new Drizzle migration** |

**The latent bug (finding #7).** `incidents.ts:321` is a binary ternary: anything that is not `'png'` becomes `'image/webp'`. Add `'jpeg'` to `ImageExt` and to `sniff.ts` *without* touching this line and JPEG bytes are stored with `content_type = 'image/webp'` — which the CHECK constraint **accepts**. The blob route then serves `Content-Type: image/webp` and `Content-Disposition: attachment; filename="screenshot.webp"` over JPEG bytes. `nosniff` means the browser will not guess, so the panel shows a broken image. Replace both ternaries with a single `Record<ImageExt, string>` lookup so the mapping cannot drift again.

**The migration is a consultation trigger.** `AGENTS.md`: *"Migrations | `drizzle-kit` generated, committed and reviewable. A migration is a consultation trigger."* Adding `'image/jpeg'` to a CHECK constraint is `ALTER TABLE incidents DROP CONSTRAINT / ADD CONSTRAINT`, i.e. a migration. P3-D-14 sanctions the *outcome*, so the planner should not re-litigate the decision — but it **must** either (a) insert an explicit `checkpoint:human-verify` before the migration task, or (b) record in the plan that P3-D-14 is the owner's approval of this specific migration. Recommendation: (a) plus a pointer to P3-D-14, because the consultation trigger is about the *artifact* being reviewed, not about the *decision* being re-made.

**Structural control for JPEG (recommendation, MEDIUM confidence).** PNG and WebP get a hand-written container walker (`structure.ts`) that drops metadata chunks and rejects trailing data. A JPEG equivalent is substantially harder: after `SOS` the entropy-coded scan data has no length field, so a walker must parse markers with byte-stuffing rules (`FF 00` escapes), handle restart intervals, and cope with progressive scans and the multi-picture (MPO) shape that some phone cameras emit. A buggy walker is worse than no walker. `structure.ts`'s own docblock already states it is *"a guard, not the hardening backend"* and that *"only a real decode → re-encode reduces it to the pixels one decoder actually produced"* (`harden.ts:9-14`). Recommendation: for `ext === 'jpeg'`, have `validateStructure` return the bytes unchanged with a written rationale, and let `harden.ts`'s root re-encode be the control. The pre-decode guards that actually bound resource use are **kept**: `guard.ts` dimension caps run before sharp, and sharp runs with `limitInputPixels: MAX_IMAGE_PIXELS`, `failOn: 'warning'` and a 5 s `timeout` (`harden.ts:94-99`).

**`autoOrient` is mandatory and is NOT sharp's default.** [VERIFIED from the installed `sharp@0.35.5` typings, `node_modules/sharp/lib/index.d.ts:983-988`]:
```
/**
 * Auto-orient based on the EXIF `Orientation` tag, if present.
 * Mirroring is supported and may infer the use of a flip operation.
 *
 * Using this option will remove the EXIF `Orientation` tag, if any.
 */
autoOrient?: boolean | undefined;
```
Without it a phone photo with `Orientation = 6` is decoded in raw sensor order; sharp's default metadata stripping then discards the tag, and the stored artifact is permanently sideways with no way to recover the intended orientation. Two ways to apply it, both in 0.35: the constructor option `sharp(buf, { autoOrient: true, ... })` or `.autoOrient()`. The constructor form is a one-line change to the existing call at `harden.ts:94` and covers all three formats harmlessly.

**JPEG output defaults** [VERIFIED from `node_modules/sharp/lib/index.d.ts:1367-1385`]: `JpegOptions.quality` "integer 1-100 (optional, default 80)", `chromaSubsampling` "Set to '4:4:4' to prevent chroma subsampling when quality <= 90 (optional, default '4:2:0')", `progressive` default `false`.

**Chroma-subsampling warning for the CA-02 story.** A JPEG→JPEG re-encode at the default 4:2:0 averages chroma over 2×2 luma blocks. At a mask boundary a saturated source colour therefore bleeds *chroma* into the black fill's edge pixels. This does not weaken the destruction guarantee (no source *luma* survives) but it can perturb a strict RGB-distance assertion at the boundary. Two mitigations, both cheap: assert the mask **interior** strictly and the **1-px ring** loosely (the existing `expectMaskedAndTargeted` already takes exactly this shape, with `minInteriorBlack = 0.98` and `ringBlack < 0.5`), and/or set `chromaSubsampling: '4:4:4'` on the JPEG branch at the cost of a somewhat larger artifact.

**JPEG magic bytes — the exact signature matters.** [VERIFIED empirically, `sharp@0.35.5` in this repo]: `sharp(...).jpeg({quality:80}).toBuffer()` on this platform begins `ff d8 ff db 00 43 00 06 04 05 06 05` and ends `… 80 f4 ff d9`. The third byte is **not** always `e0`: JFIF files start `FF D8 FF E0`, Exif files `FF D8 FF E1`, and libjpeg's default output here starts `FF D8 FF DB` (SOI followed directly by DQT). A sniffer keyed on `FF D8 FF E0` would reject sharp's own output. Use the 3-byte prefix `FF D8 FF`.

**Why the client never sends JPEG (and why that reframes the risk).** `ManualFileCapture` returns `ImageData` (A-05), and the only `Blob` producer in the SDK is `encodeLadder`, which chooses WebP (or PNG on the M-3 fallback). Therefore the wire format from the SDK is always PNG/WebP, and the server's JPEG branch is reachable **only by a non-SDK caller** (a direct API client). Consequences:
- CAP-02's e2e proof of "attach" is *client-side*: attach a JPEG, walk to Send, decode the outgoing image and assert it is the same picture. It will be WebP/PNG on the wire.
- The server JPEG path needs its **own direct-HTTP rows in `e2e/ingest.spec.ts`** (the file already has a `valid-64x64.webp` / `valid-64x64.png` fixture pair and a `polyglot-gif-html.gif` negative fixture — add `valid-64x64.jpg` via `e2e/make-fixtures.mjs`, which already drives `sharp`).
- The JPEG rows must cover: 201 with `content_type = 'image/jpeg'`; the blob route serving `image/jpeg` + `nosniff` + `attachment`; a >16 MP JPEG rejected by `guard.ts` **before** sharp; and SVG/GIF still rejected with the updated copy.

**Decode-bomb guard for JPEG (`guard.ts`).** A JPEG's dimensions live in a `SOFn` marker (`0xC0`–`0xCF`, excluding `C4`/`C8`/`CC`), payload `[precision:1][height:2 BE][width:2 BE]`. Walking to the first `SOFn` means stepping marker segments (`FF xx` + 2-byte big-endian length, honouring `FF D8`, `FF D9`, `FF 01`, and `FF D0`–`FF D7` which carry no length). ~25 lines. Without it, `assertDecodeSafe` throws a hard 400 for every JPEG (`readDimensions` returns `null` → *"the JPEG header is missing or unreadable"*), so this call-site cannot be skipped silently — but it fails in the *wrong direction* (rejects legitimate files), which is why it must be in the same task as `sniff.ts`.

### F2 — CA-02 assertion strategy: the machinery already exists, reuse it

The repository already implements exactly the assertion CA-02 asks for, for T1 auto-masks. `e2e/sdk.spec.ts` has:

- `analyzeRedaction(page, bytes, { viewport, masked, control })` — decodes the outgoing bytes **inside the page that produced them** (`createImageBitmap` + canvas + `getImageData`), maps a CSS rect into decoded-bitmap space with the frame/viewport scale, and counts pixels into four buckets: inside the rect, its 1-px-shrunk interior, the 1-px *ring* outside it, and a control region.
- `expectMaskedAndTargeted(report)` — the destruction proof:
  ```ts
  expect(report.insideMagenta, 'zero original pixels inside the masked rect (CA-02)').toBe(0);
  expect(report.ringMagenta, 'zero original pixels on the 1-px boundary ring (CA-02)').toBe(0);
  expect(report.interiorBlack / report.interiorPixels, …).toBeGreaterThanOrEqual(minInteriorBlack); // 0.98
  expect(report.insideBlack / report.insidePixels, …).toBeGreaterThanOrEqual(0.9);
  expect(report.ringBlack / report.ringPixels, …).toBeLessThan(0.5);
  expect(report.controlBlack / report.controlPixels, …).toBeLessThan(0.2);
  expect(report.controlDistinct, …).toBeGreaterThanOrEqual(2);
  ```
  with `isMagenta` = squared RGB distance from `#ff00ff` ≤ `14400` (i.e. 120 per channel) and `isBlack` = `max(r,g,b) <= 24`.
- **Non-vacuity mechanism:** the capture stub paints a solid `#ff00ff` rect over `[data-capture-marker]`'s viewport rect, using the *same outward rounding* the redactor uses. A masked row therefore proves destruction ("zero magenta inside"), and the negative-control rows prove the analysis can *find* magenta when nothing masks.

**What Phase 3 must add, and nothing more:**
1. Reuse the marker mechanism as the CA-02 fixture: paint a magenta marker, drive a **user mask drag** over exactly that marker, then decode and call the same `expectMaskedAndTargeted`. That gives destruction proof with zero new pixel-analysis code.
2. Compute the *expected* bitmap rect from the drag. Both sides should use the same written-out formula, independently of the SDK (that independence is what makes the assertion non-vacuous, exactly as `readMaskRect` is independent of `redactor.ts`):
   ```
   box      = canvas.getBoundingClientRect()
   scaleX   = canvas.width  / box.width      scaleY = canvas.height / box.height
   bitmapX  = round(cssXrelativeToCanvas * scaleX)
   ```
   Drive the drag with `page.mouse` at the corresponding *viewport* coordinates and assert on the mapped bitmap rect.
3. Add the "later stroke" proof that criteria 4 adds beyond CA-02: after masking, draw a freehand stroke **across** the masked region, then decode and re-run `expectMaskedAndTargeted`. Because T3 replays the mask patch last, the ink must be *under* the black — the assertion needs no new code, only a second drag.
4. Lossy-encode tolerance. The existing thresholds already survive one lossy generation (WebP q0.8 and PNG). They also survive the JPEG boundary effect described in F1 because the interior is asserted at 0.98 and the ring only has to be "< 0.5 black".

**One structural note:** because the SDK always re-encodes to WebP/PNG, the CA-02 decode never sees JPEG. Assertions about JPEG artefacts belong to `ingest.spec.ts`, not to the widget rows.

### F3 — i18n: "dictionaries in the lazy chunk, never in core" cannot be satisfied literally

The ROADMAP states *"i18n dictionaries live in the lazy chunk, never in core"*. The UI-SPEC's string map has ~45 new keys, of which `composer.*` (17), `review.*` (6), `mask.confirm.*` (4), `i18n.*` (3) and the `status.*`/`action.*` set belong to **core** surfaces. The composer must render localised copy **before** the editor chunk is ever fetched — indeed in the degraded case it may never be fetched at all (A-2: load on demand at `Annotate image`). Putting every dictionary in the lazy chunk would make the "whole widget form … in English or Spanish" (WDG-06) conditional on a download that the user may never trigger.

**Resolution (recommended):** split by *surface*, which is what "never in core" is really protecting (the lazy chunk is supposed to carry the editor's bulk, not the form's labels):
- `strings.ts` (core): `strings` (en, existing) + `stringsEs` for **launcher, status, action, composer, review, mask.confirm, i18n** keys; plus `setLocale()` / `locale()` and `t()` reading the current locale. Size cost measured against 35.7 KB of core headroom: ~50 keys × 2 locales ≈ **1.5–2 KB gz**.
- `strings.editor.ts` (lazy only): `editor.*` (en+es) — `editor.title/done/loading/canvas.label/tool.*/mask.mode.label/mask.fill/mask.pixelate`. ~12 keys × 2 ≈ **0.3 KB gz**.
- The editor receives `locale: 'en' | 'es'` from core in `Annotator.open()`, so the two dictionaries can never disagree.

Record this as an explicit interpretation of the locked sentence in the plan (and, if the checker disagrees, as a documented deviation). It is the only reading under which WDG-06 and A-2 are simultaneously satisfiable.

**Locale plumbing:**
- Resolve once at `init()`: `const detected = (navigator.language ?? '').toLowerCase().startsWith('es') ? 'es' : 'en'`.
- Replace `content.setAttribute('lang', 'en')` (`widget/host.ts:150`) with the resolved locale, and update it whenever the override changes. The existing row `F-08: the widget content declares lang="en" …` stays green under Playwright's default `en-US` locale and becomes the natural place to add the `es-ES` twin (`test.use({ locale: 'es-ES' })`).
- Override: a compact EN/ES pair in the composer header (UI-SPEC A-7); on change, re-render the active surface and re-set `lang`. **Session-scoped in memory** — `localStorage` would fail `gate.mjs sdk-no-host-storage` and SEC-03.

### F4 — e2e blast radius: ~30 rows assume the Phase-2 one-gesture contract

`e2e/sdk.spec.ts` is 116 KB and most rows end with `clickLauncher(page)` → `waitForHeadline(page, 'Report sent ✓')`. Phase 3 inserts a form between the two. The affected families (from the row index):

| Family | Rows | What changes |
|---|---|---|
| Tracer / metrics | `INT-02`, `CAP-01`, `CAP-04`, `CAP-05` (×4 incl. DPR sub-describes), `M-3` | add `→ Review report → Send report` |
| Redaction artefacts | `PRV-01`, `PRV-02` (×7), `PRV-03`, `PRV-05`, `PRV-06`, `P2-D-08`, `H-1` (×4) | same, via `runRedactionRow` / `runHidpiMaskRow` (one edit each) |
| Isolation / globals | `WDG-02` matrix, `WDG-03`, `WDG-05` (×4), `WDG-01` | same, plus the launcher's disabled semantics now span the composer |
| Meta | `P2-D-01` (auto-title + `type: 'bug'`), `self-hosted` | `P2-D-01` still passes (prefill = `document.title` truncated; default type = `bug`) **provided** the composer prefills and does not rewrite |
| Failure states | `P2-D-12` (×3), `CAP-01 rejected prompt`, `OQ-1`, `fail-closed` | **behavioural change**: these now assert the *degraded composer*, not the 404-style `status.*` failure panel |
| Transport | `P2-D-03` (×2 retry rows) | add the composer walk; the retry semantics themselves are unchanged |

**Recommendation:** one helper, `completeComposer(page)` in a new `e2e/helpers/composer.ts` (or appended to `capture-stubs.ts`), that: waits for the composer, optionally asserts the prefilled title/type, clicks `Review report`, waits for review, clicks `Send report`. Then one dedicated plan task applies it to every row — do not interleave it with feature tasks, or the RED/GREEN story becomes unreadable.

**Two helper bugs to fix at the same time:**
- `e2e/helpers/host-fixtures.ts:47` — `BundleName` is a closed union of four core bundles; add the annotator chunk names.
- `e2e/helpers/host-fixtures.ts:204-209` — `serveBundle` 404s *any* bundle whose basename differs from the one requested:
  ```ts
  if (requested !== bundle) {
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'unknown fixture bundle' });
    return;
  }
  ```
  The lazy `import()` of `/__e2e/bundles/watchbug-annotator.mjs` will therefore 404 and every editor row will fail with "editor failed to load" instead of the thing under test. Change the route to serve a **set** of bundles (the requested core plus its sibling chunk).

### F5 — What "one flattened working bitmap" costs in memory

C-2 permits exactly one working bitmap. The editor needs (a) the canvas being drawn on, (b) something to redraw *from* on undo. Keeping (a) as a canvas and (b) as an `ImageBitmap` created once via `createImageBitmap(imageData)` gives redraw = `drawImage(baseBitmap,0,0)` + replay strokes + `putImageData(patch)`s, with no `ImageData` retained. At the 16 MP contract ceiling that is ~64 MB of canvas + ~64 MB of bitmap; typical captures are ~1 MP. If `createImageBitmap` fails (low-end GPU / texture limit), fall back to retaining the `ImageData` — the same destroy-only data, just CPU-side.

`imageData` handed to the editor is **already T1-redacted** and may already contain user mask patches from a previous editor round-trip (Review → Edit report → Annotate). Keeping `masks: MaskPatch[]` on the `Draft` across round-trips is what makes "Edit report" lossless without a second full bitmap copy.

**Note the memorised base is post-mask**, so it satisfies A-04's prohibition. The prohibition is on *pre-mask* state; there is none anywhere in this design.

### F6 — Degraded-capture copy: keep the diagnostic distinction

The UI-SPEC provides one degraded notice (`composer.image.none` = "Capture unavailable" / "Captura no disponible" + hint). The Phase-2 `status.*` map already carries *distinct* diagnostics for the three capture failures:
- `status.captureFailed` / `.hint` (denied / no API)
- `status.blankCapture` / `.hint` (uniform frame)
- (oversize falls into the blank bucket today via `blankProbe`'s `reason: 'oversize'`)

Recommendation: the image-zone **heading** is always `composer.image.none`, and the **hint** is chosen from the existing `status.*.hint` matching the failure. No new keys, the diagnostic value survives, and the three existing `P2-D-12`/`CAP-01`/`OQ-1` rows can be re-pointed at the composer with a copy change only.

**Do not run `blankProbe` on an attachment.** P2-D-12 exists to catch a *failed capture*; a user may legitimately attach a mostly-uniform image. Applying the probe to attachments would be a false rejection.

---

## Common Pitfalls

### Pitfall 1: The editor chunk inlined into core by a literal `import()`
**What goes wrong:** `import('./annotator.ts')` with `bundle: true` and no `splitting` gets inlined into the core bundle. Core jumps from 9.3 KB toward 20 KB and `watchbug-annotator.js` becomes an empty shell — PRF-02 then passes vacuously while the injected script carries the editor's bytes.
**Why it happens:** esbuild documents `splitting` as *"still a work in progress. It currently only works with the `esm` output format"* — so for the IIFE lane there is no splitting, and esbuild inlines what it can resolve.
**How to avoid:** route the specifier through a variable (verified to be preserved verbatim, both formats). Add a guard to the plan: after the build, assert `watchbug.js` gzip size did **not** move by more than the composer's own weight, and assert the editor chunk is non-trivial (`> 2 KB gz`) — a chunk that shrank to nothing means the code moved into core.
**Warning signs:** `check:size` reports a tiny lazy lane while core grows; the lazy-load assertion row never sees a request for the chunk.

### Pitfall 2: `import.meta.url` in the IIFE lane
**What goes wrong:** `new URL('watchbug-annotator.mjs', import.meta.url)` yields `new URL(x, undefined)` → throws, or resolves against the document origin if the code is sloppy.
**Why it happens:** VERIFIED in this repo — esbuild compiles `import.meta.url` in `format:'iife'` to a property read on an empty object, i.e. `undefined`. `index.ts:66-70` already records the consequence for the ESM/IIFE split.
**How to avoid:** capture `document.currentScript?.src` at module evaluation (the existing `LOADING_SCRIPT_URL`) for the IIFE lane, `import.meta.url` for ESM, then `new URL('watchbug-annotator.mjs', base).href`. Fail loudly with the inline load-error state if neither resolves.

### Pitfall 3: The e2e route 404s the annotation chunk
**What goes wrong:** the editor never opens and every editor row fails with a load error. **Why:** `host-fixtures.ts:204-209` fulfils only the exact basename requested. **How to avoid:** serve a set of bundles per fixture; keep the 404 for genuinely unknown names so the guard stays meaningful. **Warning signs:** a burst of 404s to `/__e2e/bundles/watchbug-annotator.mjs` in the Playwright trace.

### Pitfall 4: Storing a pre-mask copy "for undo"
**What goes wrong:** a snapshot of the canvas taken *before* a mask is applied is a recoverable copy of the secret sitting in memory, and C-2/A-04 calls that out by name ("no undo stack over pre-mask state … each undo entry *is* an unmasked copy").
**Why it happens:** the "obvious" undo is `history.push(getImageData())` before each mutation.
**How to avoid:** strokes are vector; undo is a *redraw* (base + remaining strokes + mask patches). Masks are never on the undo stack. Only post-mask patches are stored.

### Pitfall 5: `pointerup` outside the canvas never fires
**What goes wrong:** a drag that ends over the toolbar leaves the tool in "drawing" state; the next click starts a stroke from the old origin.
**How to avoid:** `canvas.setPointerCapture(e.pointerId)` on `pointerdown`, release on `pointerup`/`pointercancel`; also treat `pointercancel` as "abort the in-progress stroke" (do not commit it).

### Pitfall 6: `context.font` silently ignored
**What goes wrong:** text labels render at 10 px sans-serif instead of 15 px accent ink. **Why:** canvas parses `font` with the CSS *font shorthand* grammar and silently keeps the previous value on a parse failure — no exception, no console warning. **How to avoid:** assign, read back, compare a marker (e.g. `ctx.font.includes('15px')`); on mismatch reassign `'15px sans-serif'`. Verify on all three engines — font-family parsing differs.

### Pitfall 7: Mask geometry against the wrong coordinate space
**What goes wrong:** masks land a few percent off; the leak is at the *edges*, which the ring assertion catches only if the drag is generous.
**Why:** `toBitmapRect` with the *viewport* transform while the canvas is letterboxed inside the editor's canvas area.
**How to avoid:** one mapping authority. Every pointer coordinate goes through the canvas's own `getBoundingClientRect()`; nothing else is allowed to compute a scale. Run the H-1 matrix (DPR 1 / 1.25 / 2 / 3) against the editor, not only against T1.

### Pitfall 8: The JPEG `content_type` ternary
**What goes wrong:** JPEG stored as `image/webp`; the blob route serves the wrong MIME; the panel shows a broken image; no test catches it because the CHECK constraint accepts `image/webp`.
**How to avoid:** replace *both* ternaries (`incidents.ts:321` and `:463`) with a single `Record<ImageExt, string>` and add the DB row assertion `content_type = 'image/jpeg'` to the ingest JPEG row. **Warning sign:** a JPEG ingest test that asserts `201` without reading the stored/Served `Content-Type`.

### Pitfall 9: Losing EXIF orientation on a JPEG re-encode
**What goes wrong:** phone photos land sideways, permanently (the tag is stripped by the re-encode). **Why:** sharp does not auto-orient unless asked.
**How to avoid:** `autoOrient: true` in the `sharp(buf, {…})` options so it applies to every format. Client-side this is already handled: `createImageBitmap`'s default `imageOrientation` is `from-image`.

### Pitfall 10: Re-toasting the same stroke after undo
**What goes wrong:** undo redraws the base but keeps the canvas's current transform/composite state (`globalAlpha`, `setLineDash`, `strokeStyle` leaking between tools), so replayed strokes look different from the originals.
**How to avoid:** every replay starts with an explicit state declaration (`ctx.setTransform(1,0,0,1,0,0)`, `globalAlpha = 1`, `setLineDash([])`, `lineWidth`, `strokeStyle`, `lineCap`, `lineJoin`). Store those six values **on the stroke record**, so a stroke is a self-contained description, not a function of ambient state.

### Pitfall 11: Two `Escape` listeners fighting
**What goes wrong:** `Escape` in the composer both discards the draft *and* dismisses the status panel, or leaks a listener across unmounts.
**Why:** `status-panel.ts:264-275` installs a document-level `keydown` and removes it on teardown (A-7). The composer/review/dialog each need the same discipline.
**How to avoid:** one listener per mounted surface, registered on mount and removed on unmount; assert in a row that opening the composer twice does not double-handle `Escape`. The mask dialog is the exception: while it is open it owns `Escape` (= `Not now`) and the editor must not also act on it.

### Pitfall 12: `hideSync()` while the composer is mounted
**What goes wrong:** a `Try again`/re-capture from inside the composer hides the whole host, and if the capture then fails, the new composer renders into a `display:none` host — invisible. This is exactly the FX-01 bug Phase 2 fixed for the failure panel.
**How to avoid:** the `finally { host.restore() }` in `runCaptureStage` must run on every path (it already does at `pipeline.ts:234-237`); keep it when splitting, and add a row that a re-capture from the composer is visibly observable.

### Pitfall 13: Assuming `maxlength` enforces `MAX_TITLE_CHARS` / `MAX_NOTE_CHARS`
**What goes wrong:** the cap is code-point based on the wire (Zod 4 `.max()` counts code points — Phase 1 decision, 01-04) while the `maxlength` attribute counts UTF-16 units. An emoji-heavy title is cut short of 200 code points by the attribute; a naive JS clamp can split a surrogate pair.
**How to avoid:** the Phase-2 precedent (`buildMeta`, `[...title].slice(0, MAX_TITLE_CHARS).join('')` at `lane1.ts:94`) and `truncateReason`'s code-point loop (`status-panel.ts:167-178`). Use the same idiom in the composer, and keep `maxlength` as a UX hint larger than the true cap (or omit it).

---

## Code Examples

### The single sink, unchanged — the editor must route here

```ts
// packages/sdk/src/image/encode.ts:73-87  (verbatim, the ONLY toBlob site)
function encodeOnce(pngOrWebpCanvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    pngOrWebpCanvas.toBlob(
      (blob) => {
        if (blob === null) { reject(new Error('the canvas produced no image')); return; }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}
```

`encodeFinal()` in core is therefore:

```ts
export async function encodeFinal(
  image: ImageData,
  t1: readonly BitmapRect[],           // bitmap-space, measured at capture time
  masks: readonly MaskPatch[],         // post-mask patches, creation order
): Promise<EncodedImage> {
  // order is the invariant (T3): T1 re-apply (idempotent) → user masks LAST
  fillBitmapRects(image, t1, MASK_RGB, MASK_ALPHA_OPAQUE);
  for (const patch of masks) putPatch(image, patch);
  return encodeLadder(image);          // single sink; never a toBlob here
}
```

### Mask patch: destructive bake + rebake

```ts
// annotator/masks.ts — no toBlob/toDataURL/convertToBlob anywhere in this file
export function bakeMask(
  ctx: CanvasRenderingContext2D,
  rect: BitmapRect,
  mode: 'fill' | 'pixelate',
  blockPx: number,
): MaskPatch {
  const r = mode === 'pixelate' ? snapOutward(rect, blockPx) : rect;
  const w = r.right - r.left;
  const h = r.bottom - r.top;
  const region = ctx.getImageData(r.left, r.top, w, h);   // O(rect), not O(frame)
  if (mode === 'pixelate') blockAverage(region, blockPx); else solidFill(region);
  ctx.putImageData(region, r.left, r.top);                // destroyed NOW (T2)
  return { rect: r, pixels: region };                     // post-mask data only
}
```

`solidFill` writes `{r:0,g:0,b:0,a:255}` — the same triple as `redactor.ts`'s `MASK_RGB` and `MASK_ALPHA_OPAQUE`. `blockAverage` must force `a = 255` on every block (R-13/A-01: "alpha forced to 255").

### Stroke records (self-contained, replayable)

```ts
type Stroke =
  | { tool: 'freehand'; points: number[]; width: number; ink: string }
  | { tool: 'arrow';    from: [number, number]; to: [number, number]; width: number; ink: string }
  | { tool: 'rectangle';from: [number, number]; to: [number, number]; width: number; ink: string }
  | { tool: 'text';     at: [number, number]; text: string; size: number; ink: string };
```

`ink` and `width` are resolved at *creation* time from the CSS custom property and the canvas scale, so a later locale/theme change can never restyle history. Ink source: `getComputedStyle(mount).getPropertyValue('--wb-color-accent')` with the literal `#2f6feb` as fallback — that keeps `--wb-color-accent` (`widget/host.ts:77`) the single source of truth without duplicating the hex in the lazy chunk.

### Lazy load

```ts
// widget/loader.ts (core)
let cached: Promise<AnnotatorModule> | null = null;

export function loadAnnotator(coreUrl: string | undefined): Promise<AnnotatorModule> {
  if (cached !== null) return cached;
  const base = coreUrl;
  if (base === undefined) return Promise.reject(new Error('the annotator chunk URL cannot be resolved'));
  const href = new URL('watchbug-annotator.mjs', base).href;
  // Non-analyzable on purpose: a literal specifier is inlined into the core
  // bundle (esbuild splitting is esm-only), which would blow the 45 KB tier.
  const specifier: string = href;
  cached = (import(specifier) as Promise<AnnotatorModule>).catch((error: unknown) => {
    cached = null;                      // a transient 404 must be retryable
    throw error;
  });
  return cached;
}
```

### e2e: the reusable CA-02 body

```ts
// reuse analyzeRedaction / expectMaskedAndTargeted from e2e/sdk.spec.ts as-is
const report = await analyzeRedaction(page, await readOutgoingImage(page), {
  viewport: FULL_VIEWPORT,
  masked: markerViewportRect,      // the [data-capture-marker] rect
  control: REDACTION_CONTROL_RECT,
});
expectMaskedAndTargeted(report);   // insideMagenta === 0, ringMagenta === 0, interior black ≥ 0.98
```

The only new code is the drag: map `markerViewportRect` → editor-canvas coordinates → `page.mouse.down/move/up`.

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| `import()` + webpack code splitting for a lazy widget chunk | `import(variableUrl)` with a runtime-resolved absolute URL | n/a — esbuild splitting is ESM-only, and the IIFE lane has no splitting | One loader path serves both formats; the chunk must be `.mjs`. |
| `<img>` + `FileReader` to load a picked file | `createImageBitmap(file)` | Baseline for years; `imageOrientation` now defaults to `from-image` | ~0 bytes of plumbing and EXIF orientation for free. |
| `toDataURL` for canvas export | `toBlob` | ES2015+ | `toBlob` is the SDK's only sink; `toDataURL` also trips the C-2 gate. |
| Alpha-composited CSS overlay as "redaction" | Destructive `ImageData` mutation before encode | SEC-02 / R-13 | The only primitive that survives a "save the image" attack. |
| Gaussian blur / block pixelation as default masking | Flat opaque fill default, pixelation opt-in ≥ `max(8 px, 2×cap-height)` | A-01 | Published deconvolution and HMM attacks recover blurred *and* pixelated text at UI font sizes. |

**Deprecated / do not use:** `html2canvas` (D-04), `fabric.js`/`konva` (D-05), `zod-to-json-schema`, any unit-test framework or coverage threshold (R-12), `localStorage` from the SDK (SEC-03 + grep gate), `toDataURL` (C-2 gate).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A hand-rolled 5-tool editor + toolbar DOM + editor dictionaries fits inside 25 KB gz | Summary, PRF-02 | Low. The whole Phase-2 core (capture+transport+4 redaction families) is 9.3 KB; 24.7 KB of lazy headroom remains. Mitigated by `check:size` running on every build. |
| A2 | The e2e can drive canvas strokes with `page.mouse` on all three engines because the e2e bundle's shadow root is open | F2, Validation | Medium. Playwright pierces open roots today (the whole suite depends on it), but pointer-capture + canvas rendering is a new interaction surface. If an engine misbehaves, fall back to `dispatchEvent(new PointerEvent(...))` on the canvas element. |
| A3 | A JPEG structural walker can be skipped in favour of the `sharp` root re-encode | F1 | Medium. `harden.ts` already argues the re-encode is the control; PNG/WebP still get the extra guard, so JPEG is the *weaker* lane. If the owner wants parity, budget a walker as a separate plan task and expect it to be the riskiest code in the phase. |
| A4 | A user-chosen attachment is not a meaningful decode-bomb vector (the picker is user-initiated and the input lives in a closed shadow root the host cannot reach) | F1 / attachment | Low-medium. A hostile page could in principle attempt a synthetic `drop`; the widget does not listen for drops, so the surface is the picker only. Mitigation if challenged: add the JPEG/PNG/WebP header pre-read before decode. |
| A5 | `context.font` needs a read-back verification after assignment | Pitfall 6 | Low. Worst case the verification is redundant. |
| A6 | Chroma subsampling (4:2:0) can perturb a strict per-channel assertion at a JPEG mask boundary | F1 | Low — the assertion shape already tolerates it. |
| A7 | Core-surface Spanish copy costs ≈ 1.5–2 KB gz | F3 | Low. Headroom is 35.7 KB. |
| A8 | `Annotator.open()` should encode at Review entry, not at Send | Pattern 5 / PRV-07 | Low. Either satisfies PRV-07; encoding at Review makes the review literally the artifact and keeps `Send report` network-only. |
| A9 | `import()` of a same-directory `.mjs` is permitted under realistic host CSPs | Pattern 4 | Medium for nonce-only `script-src` without `'strict-dynamic'`. Not testable in the fixture (CSP-free). Must be documented as an integration limit, not "fixed". |

**Everything else in this document is tagged with an in-repo file+line, a verified tool output, or an authoritative doc citation.**

---

## Open Questions (RESOLVED)

> All five are closed. The disposition line under each names the plan (and task) that carries the decision; the plans are the binding record from here on.

1. **OQ-1 — i18n dictionary placement (blocking for the plan's Shape).**
   - What we know: ROADMAP says "i18n dictionaries live in the lazy chunk, never in core"; WDG-06 says the whole *form* must be localised; A-2 says the chunk loads only at `Annotate image`.
   - What's unclear: whether a split (core = form/status/review copy, lazy = editor copy) is accepted as satisfying the ROADMAP sentence.
   - Recommendation: adopt the split (F3), state the interpretation explicitly in the plan, and note it as a deviation candidate for the plan-checker. This is the only reading where WDG-06 and A-2 hold simultaneously.
   - **RESOLVED — split adopted.** Core carries launcher/status/action/composer/review/mask-confirm copy plus the locale resolver; the lazy chunk carries `editor.*` only. Recorded in ROADMAP § Phase 3 ("as interpreted by 03-03") and implemented by 03-03 Task 1/Task 3 + 03-05 Task 3. The four `mask.confirm.*` keys stay in core and reach the lazy dialog through `AnnotatorOpenOptions.maskConfirm` (03-05), so the chunk never inlines the dictionary.

2. **OQ-2 — Is the JPEG CHECK-constraint migration pre-approved by P3-D-14, or does it need its own checkpoint?**
   - What we know: `AGENTS.md` lists "A migration is a consultation trigger"; P3-D-14 locks the JPEG outcome and names the server allowlist as part of the work.
   - Recommendation: include an explicit `checkpoint:human-verify` on the migration task that cites P3-D-14 and shows the generated SQL. Cost is one pause; the alternative is an unapproved schema change.
   - **RESOLVED — checkpoint required.** 03-01 Task 1 is a blocking `checkpoint:decision` that approves the generated `0001` artifact (nullable screenshot + `image/jpeg` CHECK widening) before `db:migrate`; 03-02 consumes the widened allowlist and changes no schema.

3. **OQ-3 — Degraded-capture copy: one notice or the three existing diagnostics?**
   - Recommendation: heading `composer.image.none` + hint chosen from `status.captureFailed.hint` / `status.blankCapture.hint` (F6). No new keys.
   - **RESOLVED — one notice, existing diagnostic hints.** Implemented by 03-04 Task 3 (`data-wb-state="degraded"`, `.composer-notice`, hint selected from `captureNote`, both actions).

4. **OQ-4 — Editor-load-failure copy.** The UI-SPEC has no key for "the editor failed to load"; it only says the button re-enables "with the attach-error style".
   - Recommendation: add two keys (`editor.load.error`, `editor.load.error.hint`) in both locales (≈90 bytes) and record the addition as an extension of the UI-SPEC's string map. Reusing `composer.attach.error` would tell the user the wrong thing ("that file can't be attached").
   - **RESOLVED — both keys added, in core.** 03-03 Task 1 adds `editor.loading`, `editor.load.error` and `editor.load.error.hint` (they render while no chunk exists); 03-05 Task 1 wires the loading/error states and the row that asserts the button re-enables.

5. **OQ-5 — Does `PRF-02`'s gate track the shipped `.mjs` or the legacy `.js` twin?**
   - What we know: `scripts/check-size.mjs:33` budgets `watchbug-annotator.js`; the loader must fetch the `.mjs`.
   - Recommendation: gate the **max** of the two files so neither can drift, and print both (the gate already prints the ESM twin as a delta).
   - **RESOLVED — max of the twins plus a floor.** 03-05 Task 3 makes the lazy lane gate `Math.max(gzKb('.js'), gzKb('.mjs'))` against 25 KB with a `>= 2 KB` anti-inline floor; 03-07 Task 3 restates it in the final five-rule closure.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node | build + gate + suite | ✓ | 24.x (root `engines.node >= 24`) | — |
| `esbuild` | dual-lane build | ✓ | 0.28.2 | — |
| `sharp` | JPEG re-encode (API) | ✓ | 0.35.5 (already a dependency of `apps/api`) | — |
| `@playwright/test` | the one suite | ✓ | 1.63.0 | — |
| Playwright browsers (chromium/firefox/webkit) | the one suite | ✓ (suite ran 132/132 green at Phase 1 close per STATE.md) | 1.63.0 | — |
| Docker compose stack (`api`/`panel`/`db`) | `globalSetup` fails loud if `/api/health` is silent on `127.0.0.1:8080` | ✓ (required for `npm run verify`) | postgres 18.6 / nginx 1.30.5 / node 24.21.0 | — |
| `node:zlib` | `check:size` | ✓ (built-in) | — | — |
| Canvas 2D + `createImageBitmap` + `pointer*` | editor | ✓ all three engines | Baseline | — |
| `getDisplayMedia` | capture tier | ✓ chromium/firefox; ✗ iOS/Safari-without-support | — | **The degraded composer is the fallback** (P3-D-13) — it is a product requirement, not an environment gap |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `getDisplayMedia` on iOS — deliberately covered by the attach/text-only path, which is why CAP-03 is in this phase rather than deferred.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section applies. **R-12 is the controlling policy**: *e2e and property assertions only* — there is no unit-test framework to add, and no coverage threshold exists or will exist. The phase's verification surface is exactly two artifacts:

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `@playwright/test` 1.63.0 (the single suite, `playwright.config.ts`) |
| Config file | `playwright.config.ts` — 3 projects (`chromium`, `firefox`, `webkit`), `workers: 1`, `fullyParallel: false`, `globalSetup` requires the compose stack on `127.0.0.1:8080` |
| Quick run command | `npx playwright test e2e/sdk.spec.ts -g "ANN-" --project=chromium` |
| Full suite command | `npm run verify` (all three projects) |
| Size gate | `npm run check:size` (must be run after `npm run build`) |
| Static gates | `npm run gate` (must keep `sdk-single-encode-sink`, `sdk-no-host-storage`, `sdk-runtime-deps` green) |
| Direct-ingest rows | `npx playwright test e2e/ingest.spec.ts -g "JPEG"` |

### Phase Requirements → Test Map

Every row is an artifact-level assertion: it decodes the bytes that left the browser, reads the HTTP response, or reads the emitted bundle. No function-boundary tests.

| Req ID | Behaviour | Test Type | Automated command | File Exists? |
|--------|-----------|-----------|-------------------|--------------|
| CAP-03 | Capture denied → degraded composer with notice + both actions → text-only filing reaches a real `201` | e2e (real stack) | `npx playwright test e2e/sdk.spec.ts -g "CAP-03" --project=chromium` | ❌ Wave 0 |
| CAP-03 | A blank/uniform capture never posts: zero `POST /api/incidents` before the user chooses | e2e | `… -g "P2-D-12"` (existing rows, re-pointed at the composer) | ✅ edit |
| CAP-03 | A capture-less browser (no `getDisplayMedia`) still lets text-only feedback file | e2e | `… -g "CAP-03 no-API"` | ❌ Wave 0 |
| CAP-02 | Attach PNG → outgoing image decodes at the attached picture's dimensions and is non-blank | e2e | `… -g "CAP-02 attach"` | ❌ Wave 0 |
| CAP-02 | Attach WebP and JPEG → same; JPEG on the wire is WebP or PNG (single encode sink) | e2e | `… -g "CAP-02 attach"` | ❌ Wave 0 |
| CAP-02 | Attach rejects a non-image / oversized-pixel file with the inline error, no request | e2e | `… -g "CAP-02 reject"` | ❌ Wave 0 |
| CAP-02 (server) | Direct `POST` of a real JPEG → `201`, stored `content_type = 'image/jpeg'`, blob route serves `image/jpeg` + `nosniff` + `attachment; filename="screenshot.jpeg"` | e2e (API) | `npx playwright test e2e/ingest.spec.ts -g "JPEG"` | ❌ Wave 0 |
| CAP-02 (server) | A >16 MP JPEG is rejected **before** sharp; SVG/GIF still rejected with updated copy | e2e (API) | `-g "JPEG"` | ❌ Wave 0 |
| ANN-01 | Freehand drag → decoded image carries accent-ink pixels along the dragged path and none off it | e2e | `… -g "ANN-01"` | ❌ Wave 0 |
| ANN-02 | Arrow drag → ink at tail, at head, and a head wider than the shaft | e2e | `… -g "ANN-02"` | ❌ Wave 0 |
| ANN-03 | Rectangle drag → ink on the four edges, interior unchanged | e2e | `… -g "ANN-03"` | ❌ Wave 0 |
| ANN-04 | Text label → ink inside the anchor box; `Enter` and click-outside both confirm; no modal | e2e | `… -g "ANN-04"` | ❌ Wave 0 |
| ANN-05 | Mask drag → flat opaque fill inside the rect, control region untouched | e2e | `… -g "ANN-05"` | ❌ Wave 0 |
| ANN-06 | Two strokes then one undo → only the first stroke's ink survives; a mask is never removed | e2e | `… -g "ANN-06"` | ❌ Wave 0 |
| PRV-04 | **CA-02**: mask over a magenta marker → `insideMagenta === 0` **and** `ringMagenta === 0`; interior black ≥ 0.98; control region intact | e2e | `… -g "PRV-04"` | ❌ Wave 0 |
| PRV-04 | A freehand stroke drawn **across** the masked region cannot resurrect pixels: re-run the same assertions after the stroke | e2e | `… -g "PRV-04 stroke"` | ❌ Wave 0 |
| PRV-04 | Pixelate mode → no original marker colour survives inside the block grid | e2e | `… -g "PRV-04 pixelate"` | ❌ Wave 0 |
| PRV-04 | DPR 1 / 1.25 / 2 / 3 editor mask rows (H-1 geometry in the editor, not only T1) | e2e ×4 | `… -g "PRV-04 DPR"` | ❌ Wave 0 |
| PRV-07 | Review renders the flattened image + type/title/note; `Edit report` returns to the composer with state intact; `Send report` posts exactly once | e2e | `… -g "PRV-07"` | ❌ Wave 0 |
| WDG-06 | Default locale: `.wrap[lang]` matches the resolved locale, EN copy rendered | e2e | `… -g "WDG-06"` (extends the existing `F-08` row) | ✅ edit |
| WDG-06 | `test.use({ locale: 'es-ES' })` → auto-detected Spanish copy + `lang="es"` on launcher, status, composer, review | e2e | `… -g "WDG-06 es"` | ❌ Wave 0 |
| WDG-06 | Manual EN/ES override switches visible copy **and** `lang`, in both directions | e2e | `… -g "WDG-06 override"` | ❌ Wave 0 |
| WDG-06 | Editor chrome localises too (toolbar aria-labels + `Done`) after `Annotate image` | e2e | `… -g "WDG-06 editor"` | ❌ Wave 0 |
| PRF-02 | Chunk ≤ 25 KB gz | size gate | `npm run build && npm run check:size` | ✅ |
| PRF-02 | **Laziness**: zero requests for `watchbug-annotator.mjs` while the composer is open; exactly one after `Annotate image` | e2e | `… -g "PRF-02 lazy"` | ❌ Wave 0 |
| PRF-03 | Runtime total ≤ 80 KB gz | size gate | `npm run check:size` | ✅ |

### Sampling Rate

- **Per task commit:** `npm run build && npm run check:size && npm run gate` (seconds) plus the single spec file for the touched area, one project.
- **Per wave merge:** `npm run verify` (all three projects) — this is the wave gate.
- **Phase gate:** full suite green on chromium **+ firefox + webkit** and `check:size` PASS before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `e2e/helpers/composer.ts` — `waitForComposer`, `setTitle`, `setNote`, `setType`, `reviewAndSend`, `completeComposer` (used by the ~30 migrated rows **and** every new row).
- [ ] `e2e/helpers/editor.ts` — `selectTool`, `dragOnCanvas(bitmapFrom, bitmapTo)`, `undo`, `done`, and the canvas→viewport mapping (the one authority; documented beside the SDK's mapping, never imported from it).
- [ ] `e2e/helpers/host-fixtures.ts` — extend `BundleName` and `serveBundle` to serve the sibling annotator chunk (currently 404s it).
- [ ] `e2e/fixtures/valid-64x64.jpg` (and a >16 MP JPEG) generated by `e2e/make-fixtures.mjs`, which already drives `sharp`.
- [ ] The composer/editor/review DOM contracts (class names, `data-*` hooks) must be **decided before the first e2e row is written** — the open-mode root is the only query surface.
- [ ] No framework install needed. No unit-test files. No coverage config — those are prohibited by R-12.

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in the client; admin auth is Phase 5. |
| V3 Session Management | no | The SDK holds no session. `credentials: 'omit'` is already asserted (`lane1.ts:148`). |
| V4 Access Control | partial | The widget only writes with the public `project_key` (SEC-03). Masking is *the* access control over pixels, and it is enforced client-side by construction (A-05: no `Blob` can exist before redaction). |
| V5 Input Validation | **yes** | Two independent boundaries: (a) the SDK clamps title/note to code-point caps and whitelists the attachment formats via magic bytes it never trusts; (b) the API re-validates everything — `sniffImage` on magic bytes only (never the declared `Content-Type`), `assertDecodeSafe` on header dimensions before any decoder, `sharp` with `limitInputPixels` + `failOn: 'warning'` + a 5 s timeout, then Zod re-validation after sanitisation. |
| V6 Cryptography | no | Nothing new. Argon2id/JWT are Phase 5. |
| V7 Error Handling & Logging | partial | Fail closed on the redaction path (unchanged, `T-02-10`); the new editor-load failure must be a visible, recoverable state, never a silent no-op. |
| V8 Data Protection | **yes** | R-13/SEC-02: destructive pixel mutation before encode; no blur, no CSS overlay, no semi-transparent fill; masks are not undoable; no pre-mask copy anywhere in the editor's data model. |
| V12 Files & Resources | **yes** | New: user-supplied file input. Validate by magic bytes, cap by header dimensions, downscale before allocating a canvas. |
| V14 Configuration | partial | The lazy chunk URL must derive from the core bundle's own URL (or `import.meta.url`), never from a page-supplied string — otherwise a hostile page could redirect the editor load. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| The host page reads the pre-mask pixels out of the widget (via `innerHTML`, a global, a prototype patch, or a `Blob` it can intercept) | Information disclosure | Closed shadow root (INV-01); one global (INV-02); no prototype patching; **no `Blob` exists until after redaction** (A-05); the only `Blob` producer is `encodeLadder` (C-2 gate). |
| Redaction defeat: a later annotation stroke or an undo restores masked pixels | Tampering / Information disclosure | Masks are post-mask **patches** replayed **last** (T3); undo replays strokes only; no pre-mask snapshot exists. |
| Image-borne XSS via an attachment (SVG, HTML polyglot, GIF+HTML) | Tampering | Client: `accept` is a hint only, so the client validates magic bytes and rejects non-PNG/WebP/JPEG before decode. Server: unchanged magic-byte allowlist (SVG still rejected unconditionally) + `sharp` root re-encode + `nosniff` + `Content-Disposition: attachment` + `CSP: default-src 'none'; sandbox` on the blob route. |
| Decode bomb (a small file that expands to a huge bitmap) | DoS | Server: header dimension guard **before** sharp (`MAX_IMAGE_DIM`, `MAX_IMAGE_PIXELS`) plus `limitInputPixels` and `timeout`. Client: decode, then immediately `fitToCaps` before allocating the working canvas; attachment is user-picked (A4). |
| Carrier / polyglot payload hidden after the image end marker | Tampering | PNG: trailing data after `IEND` rejected. WebP: bytes past the declared File Size rejected. JPEG: **no walker** — the `sharp` re-encode is the control (A3, explicit rationale required in code). |
| EXIF/GPS metadata smuggled to the developer's server | Information disclosure | Server strips metadata by default (sharp's documented default) and the PNG/WebP walkers drop metadata chunks; JPEG relies on the re-encode. Client-side, the attachment is re-encoded from `ImageData`, which carries no metadata at all. |
| A hostile page redirecting the lazy chunk load to attacker code | Spoofing / Elevation | Chunk URL derived only from `document.currentScript.src` / `import.meta.url`; never from `init()` options, never from a `data-` attribute. |
| Server-supplied error text rendered into the widget | Tampering (XSS) | `textContent` only (T-02-01); `truncateReason` caps at 240 chars. The composer must follow the same rule. |
| Locale override leaking into host storage | Information disclosure (SEC-03) | In-memory only; `gate.mjs sdk-no-host-storage` would fail on `localStorage`. |

---

## Sources

### Primary (HIGH confidence)
- `packages/sdk/scripts/build.mjs:50-54` — `LANE_ENTRIES` already contains `{ name: 'lazy-editor', entry: 'src/annotator.ts', out: 'watchbug-annotator' }`.
- `scripts/check-size.mjs:31-35` — `{ name: 'lazy', file: 'watchbug-annotator.js', limitKb: 25 }` and `RUNTIME_TOTAL_KB = 80`.
- Measured gate output, 2026-10-28: `core 9.3 KB gz / 45 · lazy 0.3 KB / 25 · adapter 0.3 KB / 14 · runtime 10.0 KB / 80`.
- `scripts/gate.mjs:126-156` — `sdk-single-encode-sink`, `const SINK = /\b(?:toBlob|toDataURL|convertToBlob)\b/g;`, `if (sinks > 1) fail`.
- `scripts/gate.mjs:92-124` — `sdk-no-host-storage` forbidden list (`document.cookie`, `localStorage`, `sessionStorage`, `Authorization`, `Bearer `) plus the `credentials:`-must-be-`omit` rule.
- `packages/sdk/src/image/encode.ts:73-87` — `encodeOnce`, the single `toBlob` site; `:128-159` `initialDimensions` (DPR clamp + `MAX_IMAGE_DIM` + `MAX_IMAGE_PIXELS`).
- `packages/sdk/src/redact/geometry.ts:55-83` — `toBitmapRect` (outward rounding, fail-closed) and `transformFor`.
- `packages/sdk/src/redact/redactor.ts:44` — `const MASK_RGB = { r: 0, g: 0, b: 0 } as const;`; `:290-317` `fillRects`.
- `packages/sdk/src/capture/pipeline.ts:64-82` `blankProbe`; `:191-285` the one-shot flow to be split; `:234-237` `finally { host.restore(); }`.
- `packages/sdk/src/capture/capture-source.ts:30-32` the `CaptureSource` seam (returns `ImageData`, never a `Blob`).
- `packages/sdk/src/widget/host.ts:150` — `content.setAttribute('lang', 'en');` (the F-08 literal Phase 3 replaces); `:74-92` the `--wb-*` tokens.
- `packages/sdk/src/widget/status-panel.ts:31-37` `StatusView`; `:264-275` document-level `Escape` discipline.
- `packages/sdk/src/strings.ts:11-44` — `strings` map + `t()`.
- `packages/sdk/src/transport/lane1.ts:34-38` — `ReportMeta { type: 'bug'; title: string; url: string }` (needs `type: 'bug'|'feedback'` and `note?`).
- `packages/sdk/src/index.ts:62-80` — `LOADING_SCRIPT_URL` captured from `document.currentScript` at module evaluation.
- `packages/contracts/src/constants.ts:23-25,38-39,62-63` — `MAX_IMAGE_PIXELS = 16_777_216`, `MAX_IMAGE_DIM = 8192`, `MAX_TITLE_CHARS = 200`, `MAX_NOTE_CHARS = 5_000`, `MASK_ALPHA_OPAQUE = 255`, `MASK_PIXELATION_MIN_BLOCK_PX = 8`.
- `packages/contracts/src/types.ts:15` — `export type ImageExt = 'png' | 'webp';`
- `packages/contracts/src/schema.ts:38-69` — `type: z.enum(['bug','feedback'])`, `note` optional/nullable, `url` path-only transform.
- `apps/api/src/ingest/sniff.ts:12-25`, `structure.ts:34-43,158-163`, `guard.ts:27-70`, `harden.ts:75-110` — the five-stage ingest image stack.
- `apps/api/src/routes/incidents.ts:53`, `:246`, `:321`, `:463` — the four JPEG-touching call-sites.
- `apps/api/src/db/schema.ts:52` — `check('incidents_content_type_check', sql\`${t.contentType} in ('image/webp', 'image/png')\`)`.
- `e2e/sdk.spec.ts:82-109` `analyzeImagePixels`; `:1487-1548` `readMaskRect`; `:1581-1672` `analyzeRedaction`; `:1675-1713` `expectMaskedAndTargeted` / `expectStillVisible`.
- `e2e/helpers/host-fixtures.ts:47` `BundleName`; `:195-217` `serveBundle` (the 404 that breaks the lazy load).
- `e2e/helpers/capture-stubs.ts:49-122` `PAINT_FRAME` (magenta marker paint); `:428-474` `installCaptureStub` / `readOutgoingImage`.
- `node_modules/sharp/lib/index.d.ts:983-1003` — `SharpOptions.autoOrient`, `failOn`, `limitInputPixels` docs; `:1367-1385` — `JpegOptions` (`quality` default 80, `chromaSubsampling` default `'4:2:0'`).
- Empirical, `sharp@0.35.5` in this repo (2026-10-28): `.jpeg({quality:80})` output begins `ff d8 ff db …` and ends `… ff d9`.
- Empirical, `esbuild@0.28.2` in this repo (2026-10-28): `import(variable)` preserved in both `esm` and `iife`; `import.meta.url` survives `esm` and compiles to `{}.url` (i.e. `undefined`) in `iife`.
- **esbuild docs** — https://esbuild.github.io/api/ § Splitting: *"Code splitting is still a work in progress. It currently only works with the `esm` output format."*; § Non-analyzable imports: *"Non-analyzable imports (will not be bundled): `import(\`pkg/${foo}\`)`"*.
- **MDN** — https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap : Baseline "Widely available"; `imageOrientation` **`from-image`: "Image oriented according to EXIF orientation metadata, if present (default)."**
- **sharp docs** — https://sharp.pixelplumbing.com/api-operation/ : `autoOrient()` "Auto-orient based on the EXIF `Orientation` tag, then remove the tag."; `rotate()` "if no angle is provided, `.autoOrient()` will be called."
- `AGENTS.md` — "Migrations … A migration is a consultation trigger"; R-12 testing policy; INV-01/02, SEC-01…06, RNF-01/02/03.
- `documentation/resolution-record.md` §5 — A-01 (masking primitive amended), A-05 (capture chain + mandatory degradation), A-06 (binding constants), A-12 (size-gate worst case), A-04 (Annotator contract).
- `.planning/ROADMAP.md` § Phase 3 — the C-2/T2/T3/R-13 paragraph (verbatim invariants).
- `.planning/research/ARCHITECTURE.md` — the `Annotator` port signature `open(base: ImageData): Promise<{ img: ImageData; masks: readonly Mask[]; note?: string }>` and the Q-04 redaction-ordering finding.

### Secondary (MEDIUM confidence)
- Chroma-subsampling bleed at a JPEG mask boundary (reasoned from `chromaSubsampling`'s documented default, not measured).
- The claim that a JPEG structural walker is disproportionately risky versus the `sharp` re-encode (engineering judgement; `harden.ts`'s own docblock supports the premise).
- Canvas `font` shorthand silently retaining the previous value on a parse failure (widely observed behaviour; asserted defensively with a read-back rather than relied upon).

### Tertiary (LOW confidence)
- Whether `createImageBitmap` can OOM on a crafted 100 MP+ PNG in each engine. Not measured; the plan should not depend on either answer (A4).

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — no new dependencies; every API used is either already in the repo, Baseline, or verified against the installed typings.
- Architecture (editor data model, lazy loading, masking order): **HIGH** — the lazy-load mechanics were verified by building with the repo's own esbuild; the masking model is a direct transcription of A-04/T2/T3.
- JPEG server surface: **HIGH** on the call-site inventory and the `autoOrient` requirement (read from the installed typings); **MEDIUM** on the skip-the-walker recommendation and the decode-bomb posture.
- Pitfalls: **HIGH** — 9 of 13 are grounded in a specific file+line in this repo.
- Test migration blast radius: **MEDIUM-HIGH** — the row families are enumerated from the spec's own test index; the exact count of edits depends on how many rows can share `runRedactionRow` / `runHidpiMaskRow`.

**Research date:** 2026-10-28
**Valid until:** 2026-11-27 (30 days) for the architecture; **re-verify the measured size numbers on the day the first plan executes** — they are the baseline the PRF-02/PRF-03 argument rests on.

