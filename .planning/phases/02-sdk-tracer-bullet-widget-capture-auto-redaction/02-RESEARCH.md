# Phase 2: SDK Tracer Bullet: Widget, Capture & Auto-Redaction - Research

**Researched:** 2026-10-17
**Domain:** Browser SDK — Shadow DOM isolation, screen capture, canvas redaction/encoding, zero-dependency bundle engineering
**Confidence:** HIGH (isolation + capture mechanics empirically probed on all three Playwright engines this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
*(verbatim from `02-CONTEXT.md` <decisions>)*

- **P2-D-01:** **Envío directo con `title` autogenerado.** Un clic del lanzador captura y envía en un solo paso: `title` = `document.title` truncado a `MAX_TITLE_CHARS` (200) y `type: 'bug'` fijos. No hay formulario ni elección de tipo en esta fase (el composer llega en Fase 3). — **Reversibility:** reversible — la Fase 3 introduce el formulario y sustituye este atajo; el `title`/`type` fijos quedan anotados como idea diferida.
- **P2-D-02:** **Un gesto + panel de estado.** El clic del lanzador **es** la activación transitoria: el lanzador se oculta y `getDisplayMedia` se llama en el mismo handler. El widget abre entonces un **panel flotante de estado** dentro de su Shadow DOM que muestra «Capturando…» → «Enviando…» → resultado. Ese panel es también el *dialog content* que CA-04 debe asertar bajo CSS hostil. — **Reversibility:** costly.
- **P2-D-03:** **Reintento solo de transitorios.** Se reintenta automáticamente **solo** en fallos transitorios (red, timeout, 5xx, 429): 3 intentos con backoff 1/4/10 s ±25 % y la **misma `Idempotency-Key`** en todos. Los 4xx de contrato (400/401/403/413) fallan de inmediato mostrando el motivo del servidor, con un botón manual «Reintentar». El panel muestra «Enviando…» → «Reintentando (n/3)…» → «Enviado ✓». — **Reversibility:** reversible (research: 3 intentos, 1/4/10 s ±25 %, timeout 15 s).
- **P2-D-04:** **Mapa `strings` ID→inglés, sin i18n.** Los textos visibles viven en un único `strings.ts` del carril core, con claves por ID y valores en inglés. Sin detección de locale, sin conmutador y sin `es` en esta fase (i18n es WDG-06/Fase 3). — **Reversibility:** reversible.
- **P2-D-05:** **Ocultar y restaurar el host del widget.** De forma síncrona dentro del handler del gesto, y antes de llamar a `getDisplayMedia`, se oculta el host del Shadow DOM (estilo inline); se restaura tras obtener el `ImageData`. No se usa `selfBrowserSurface: 'exclude'` ni enmascarado del bbox del widget en el bitmap. — **Reversibility:** costly (el orden ocultar → pedir permiso → tomar frame → restaurar queda fijado).
- **P2-D-06:** **Invariante asertada en el pipeline.** El `CaptureSource`/pipeline comprueba que el host del widget está oculto justo antes de `drawImage`/`getImageData`; si no lo está, la captura falla con estado de error visible (fallo ruidoso, M-6). La garantía vive en el código, no en el orden de llamadas ni solo en la e2e. — **Reversibility:** reversible.
- **P2-D-07:** **Catálogo de patrones alineado con el scrubber C-5.** Forma JWT (`eyJ…`), `Bearer <token>`, asignaciones `key=/token=/secret=/password=`, secuencias tipo tarjeta validadas por **Luhn**, más `input[type=password]` (PRV-01) y elementos `[data-watchbug-sensitive]` (PRV-03). La detección opera sobre el DOM (valores de inputs y texto de nodos → bbox → máscara); el SDK no hace OCR. — **Reversibility:** costly.
- **P2-D-08:** **Granularidad = elemento / nodo de texto completo.** Cuando un patrón coincide, se enmascara el rectángulo completo del elemento (input) o del nodo de texto que lo contiene, redondeado **hacia fuera** en espacio bitmap/device-pixel (H-1). Enmascarar de más es seguro. — **Reversibility:** costly (base de las máscaras T2/T3 de la Fase 3).
- **P2-D-09:** **Política conservadora, sin reglas del host en v1.** Ante la duda se enmascara de más. El host solo puede marcar con `data-watchbug-sensitive` (PRV-03) u ocultar vía `input[type=password]` (PRV-01); **no** se añade API pública de redacción personalizada en v1 y el puerto `Redactor` queda como seam (R-02). — **Reversibility:** reversible (añadir reglas sería cambio de interfaz pública = disparador de consulta).
- **P2-D-10:** **Escalera de reducción determinista en el cliente.** Una sola pasada antes de enviar: clamp de `devicePixelRatio` a 2 → reducir para ≤ `MAX_IMAGE_PIXELS` (16 MP) → codificar WebP q0.8 → si supera el tope, re-encode q0.6 → q0.5 y downscale 0.75× hasta cumplir. El servidor conserva su hard cap (2 MB → 413) como control. — **Reversibility:** costly (define cuándo existen bytes codificados respecto a T1/SEC-02).
- **P2-D-11:** **Objetivo ≤ 800 KB, tope duro 2 MB alineado con `MAX_ENCODED_IMAGE_BYTES`.** Base WebP q0.8; objetivo de salida ≤ 800 KB y tope duro 2 MB = constante A-06 del servidor. — **Reversibility:** reversible (constantes).
- **P2-D-12:** **Sonda de 9 píxeles contra la captura en blanco.** Tras `getImageData`, se muestrean 9 píxeles distribuidos; si la varianza es ~0 (todo uniforme) o el canvas excede el área soportada, la captura se aborta con estado de error visible, **nunca** se envía una imagen en blanco en silencio (M-6). Causa conocida: cap de área de canvas de Safari (16.777.216 px). — **Reversibility:** reversible.

### the agent's Discretion
*(verbatim from `02-CONTEXT.md`)*

Ningún área quedó marcada como "decide tú" por el propietario — todas las decisiones discutidas tienen elección explícita. Queda latitud técnica libre para research/planning en: la estrategia exacta de recorrido del DOM para localizar coincidencias y calcular bounding boxes, la descomposición en módulos/ficheros, la disposición concreta de entradas esbuild para los tres carriles, el cableado de la bandera `SHADOW_MODE`, la estructura concreta de las aserciones e2e de CA-01/CA-04/CA-05, y los detalles de implementación del reintento/backoff.

### Deferred Ideas (OUT OF SCOPE)
*(verbatim from `02-CONTEXT.md` <deferred>)*

- **`title`/`type` hardcoded (P2-D-01)** — atajo de Fase 2. Nota del propietario: *"Recordar arreglar este 'hardcode' si es necesario en fases posteriores."* Revisar en **Fase 3** (composer).
- **Full capture-degradation UX** (manual image attach via `ManualFileCapture`, text-only filing, "screenshot unavailable — send anyway?") — H-4/H-5, **Phase 3**. Hasta entonces, los errores de captura se muestran ruidosamente (nunca imagen en blanco silenciosa).
- **i18n en/es** del widget — WDG-06/RNF-03, **Phase 3**; el mapa `strings` de P2-D-04 es la forma en la que se enchufa, y los diccionarios viven en el lazy chunk, nunca en core.
- **Host-configurable redaction rules** — el puerto `Redactor` queda como seam sin usar en v1; una API pública de reglas sería cambio de interfaz pública (disparador de consulta).
- **Optional DOM-serialization `CaptureSource`** — v2 (A-08); su escenario de tamaño sigue en `check:size` pero no se construye adaptador.
- No todos matched this phase (`todo.match-phase 2` → 0).
</user_constraints>

## Project Constraints (from AGENTS.md)

> `./AGENTS.md` read this session. These directives have the same authority as locked decisions.

- **ASE C-B-D-C**: Contract (goals/non-goals/constraints/acceptance before code), Bound (scope/timebox), Delegate with Evidence (evidence packs), Converge & Record. **Rule Zero: never guess ambiguous intent.**
- **INV-01** Shadow DOM `mode: 'closed'` (build-time `SHADOW_MODE` flag emits the e2e-only bundle). Zero global CSS/JS leakage. **INV-02** exactly one global `window.Watchbug`, no prototype patching. **INV-03** three services only.
- **SEC-01** auto-mask `input[type=password]`, credential/token/card patterns, `data-watchbug-sensitive`. **SEC-02** destructive canvas masking — flat opaque fill only, before encode; **no CSS overlays**. **SEC-03** SDK never reads/sends host cookies/storage/tokens — only the public write-only `project_key`. **SEC-05** XSS sanitise on ingest + rate limiting (server, Phase 1). **SEC-06** panel auth (Phase 5).
- **R-13**: flat opaque fill (α=255) is the *only* automatic masking primitive; pixelation opt-in ≥ `max(8px, 2×cap-height)`; **gaussian blur prohibited** (deconvolution-invertible).
- **RNF-01/PRF-01**: injected core ≤ **45 KB gz**, lazy chunk ≤ 25 KB, total ≤ 80 KB; async, never blocking main thread. **PRF-04**: zero runtime npm dependencies in the SDK.
- **R-12 (owner policy, stated twice): "DONT MAKE A BUNCH OF TESTS. Only make e2e as necessary, not unit tests."** One Playwright suite (CA-01…CA-05, ~20 assertions, chromium + firefox + **webkit**) + `npm run check:size`. No unit tests, no coverage thresholds. Security properties asserted at **artifact level** (encoded bytes, HTTP response, stored row).
- **R-15** TypeScript end-to-end; SDK imports contracts **types-only** (Zod never ships).
- **Consultation triggers to respect:** changing `window.Watchbug.init()`, changing the `/api/incidents` payload schema, modifying the Shadow DOM isolation strategy, DB migrations, adding dependencies past the size tier, non-permissive licenses.
- **Dev commands:** `npm install` · `npm run build` · `npm run check:size` · `npm run verify` · `npm run lint` · `docker-compose up -d`. Verification artefact is `npm run verify` (config `test_command` in `.planning/config.json`).
- **GSD workflow enforcement:** plan files follow `02-NN-PLAN.md`; `commit_docs: true` (commit docs, but always write first).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | Add Watchbug with a single async script tag, no build step | IIFE lane already emits `dist/watchbug.js` with `globalName: 'Watchbug'` [VERIFIED: packages/sdk/scripts/build.mjs:47-50]; e2e fixture loads it as `<script src async>`; Pattern 1 |
| INT-02 | Initialise with public project key + options via `window.Watchbug.init()` | Ingest contract verified (`X-Project-Key`, `Idempotency-Key`, multipart `meta`/`image`) [VERIFIED: apps/api/src/routes/incidents.ts:128,146]; init config is hand-rolled validated (Zod types-only) — Code Examples |
| INT-05 | Consume as an ES module instead of a global | ESM twin `dist/watchbug.mjs` already built [VERIFIED: packages/sdk/scripts/build.mjs:47-50]; e2e fixture with `<script type="module">` import |
| WDG-01 | Open the widget from a floating launcher button | UI-SPEC launcher contract (48×48 px, real `<button>`); Pattern 1 host positioning [VERIFIED: probe — inline `!important` survives hostile `*` rules on all 3 engines] |
| WDG-02 | Hostile host CSS cannot hide/restyle/break the widget | Pattern 1 (inline `!important` + `all: initial` + px-only); CA-04 fixture set; probe evidence |
| WDG-03 | Widget never leaks styles/classes/variables into the host | `<style>` inside shadow root only, `--wb-*` local, no `part`; leak e2e assertions (enumeration-based) — Validation Architecture |
| WDG-04 | Exactly one global (`window.Watchbug`), no prototype patching | IIFE `globalName` wiring + gate-style e2e snapshot of `window`/prototypes before vs after |
| WDG-05 | Renders above all host content regardless of stacking context | `position: fixed !important; z-index: 2147483647 !important` [VERIFIED: probe — computed style survives hostile author `!important`]; host as last child of `document.documentElement` |
| CAP-01 | Capture the current tab via the browser capture prompt | Capture chain (Pattern 3): `getDisplayMedia` + video→canvas frame grab; `preferCurrentTab` Chromium-only [CITED: caniuse]; e2e stub seams per engine (Pitfall 2) |
| CAP-04 | A capture never contains the widget itself | P2-D-05 hide/restore + P2-D-06 pipeline assertion; e2e asserts host hidden at stub invocation + decoded image pixels |
| CAP-05 | Downscaled to ≤ 16 MP and ≤ 2 MB, not blank on HiDPI | Ladder P2-D-10/11 against `MAX_IMAGE_PIXELS = 16_777_216` / `MAX_ENCODED_IMAGE_BYTES` [VERIFIED: packages/contracts/src/constants.ts:21-23]; DPR clamp 2; 9-pixel blank probe P2-D-12; `deviceScaleFactor` e2e rows |
| PRV-01 | `input[type=password]` values excluded automatically | Redactor T1 DOM scan (Pattern 2); artifact-level CA-02-style row |
| PRV-02 | Credential/token/payment-card patterns redacted automatically | P2-D-07 catalog + Luhn (Code Examples); artifact-level row |
| PRV-03 | `data-watchbug-sensitive` elements redacted automatically | Same DOM scan pass; artifact-level row |
| PRV-05 | Never reads/transmits host cookies, storage or auth headers | `sdk-no-host-storage` gate already exists [VERIFIED: scripts/gate.mjs:92-124] + e2e sentinel-scan of intercepted request (Pitfall 1) |
| PRV-06 | URL query strings/fragments stripped before transmission | SDK strips at meta build (`stripQueryFragment` pattern) and the schema strips again [VERIFIED: packages/contracts/src/schema.ts:34-36,50-59]; e2e intercept assertion |
| PRF-01 | Injected script ≤ 45 KB gzipped; build fails otherwise | `npm run check:size` core tier 45 KB [VERIFIED: scripts/check-size.mjs:31-37] |
| PRF-04 | Zero runtime npm dependencies | `sdk-runtime-deps` gate [VERIFIED: scripts/gate.mjs:65-89]; workspace `@watchbug/contracts` is types-only |
</phase_requirements>

## Summary

Phase 2 is the first vertical slice through a stack whose server half is already done (Phase 1: hardened multipart ingest, idempotent storage, rendering panel). What remains is all client-side and lives entirely inside the 45 KB-gzip, zero-dependency core lane of `packages/sdk`: a `WidgetHost` custom element with closed shadow root and hostile-CSS-proof hardening, a one-gesture capture chain (`getDisplayMedia` → video frame → clamped canvas → raw `ImageData`), T1 destructive auto-redaction on that `ImageData`, a deterministic WebP encode ladder with silent-fallback sniffing, and a plain-`fetch` transport with idempotency-keyed bounded retry. The two architecture-loaded decisions (WidgetHost isolation, redaction ordering) are fixed at first build, and both were de-risked this session.

**Three findings reshape the plan's verification strategy (all empirical, this session, Playwright 1.63.0 on this Windows host):**

1. **The isolation technique holds on all three engines.** Inline `!important` on the host element beats hostile author `!important` (`* { display: none !important … }` cannot touch `display`, `position`, `z-index`, `color` of an inline-`!important` host), and a closed shadow root with `all: initial` wrapper fully blocks hostile inherited styles. The UI-SPEC isolation contract is implementable exactly as written.
2. **Playwright's WebKit here has NO `navigator.mediaDevices` and NO `canvas.captureStream`** — so the e2e capture stub cannot use the `canvas.captureStream()` trick in the webkit project; it must stub one seam higher (the `CaptureSource`/`ImageData` seam) there. Chromium and Firefox both deliver captureStream frames through `<video>` → `drawImage` correctly (readyState 4, pixels verified).
3. **Playwright's WebKit here encodes real WebP** (magic-byte verified `RIFF…WEBP`) — the repo's documented premise that "webkit exercises the silent WebP→PNG fallback (R-11)" is **false on this platform**. The M-3 fallback coverage must be provoked by stubbing `toBlob` to return PNG bytes, and the docs that assert the webkit premise need a correction note.

A fourth, cheaper finding: the C-5 privacy grep gate **already exists** (`scripts/gate.mjs` → `sdk-no-host-storage`) and is line-based and comment-blind — Phase 2 source code (especially the redaction pattern catalog and SEC-03 doc comments) will collide with it unless the plan words comments carefully or adds a narrow, enumerated exemption. The `sdk-single-encode-sink` rule likewise forces the encode ladder to have exactly **one textual `toBlob` call site**.

**Primary recommendation:** sequence the phase risk-first — Wave 0 delivers the `SHADOW_MODE=open` e2e build + hostile-CSS fixture + the two-tier capture stub seam *before* the capture/redaction pipeline, then land WidgetHost isolation, then the T1 pipeline (capture → probe → redact → encode → transport), and keep every security assertion at the artifact level (decode the bytes that actually left the browser).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Widget rendering + isolation (WDG-01…05) | Browser / Client (closed Shadow DOM) | — | Runs inside the hostile host page; isolation is a browser-tier concern (INV-01/RNF-02) |
| Tab capture (CAP-01/04) | Browser / Client | — | `getDisplayMedia` + `<video>`/canvas are browser APIs; transient activation must be in the gesture handler |
| Auto-redaction T1 (PRV-01/02/03) | Browser / Client | — | Must run destructively on `ImageData` **before any encode** (SEC-02/A-05) — structurally impossible anywhere else |
| Image downscale + encode (CAP-05, M-3) | Browser / Client | — | The ladder runs before transport; the server's 2 MB cap is the *control*, not the design |
| Transport lane 1 (retry, idempotency) | Browser / Client | API / Backend (Phase 1 ingest) | Plain `fetch` to `POST /api/incidents`; server owns dedupe (`Idempotency-Key`) and all caps |
| Wire-contract validation | API / Backend (done, Phase 1) | — | `reportSchema` `z.strictObject` is the single official contract — the SDK conforms, never extends |
| Payload privacy (PRV-05/06) | Browser / Client | API / Backend | SDK never reads host state; schema strips query/fragment as defence in depth |
| Size/dependency budget (PRF-01/04) | Build (scripts) | — | `check:size` + `gate.mjs` gates, not runtime code |
| Landed-report rendering | Browser (panel, done) | — | Phase 1 panel already renders type/title/url/user + image — zero new panel code |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Runtime dependencies: NONE** | — | Entire widget | PRF-04 is a hard requirement; every byte is budget (45 KB core tier). Everything is browser platform APIs + hand-rolled TS. |
| `esbuild` (build-only) | 0.28.2 | Dual IIFE+ESM build over three lanes | Already wired [VERIFIED: packages/sdk/scripts/build.mjs]; one `format` per `build()` call → 6 calls |
| `typescript` (types-only) | 7.0.2 | Type-check (`npm run lint`) | Phase 1 Q-08 gate passed on 7.0.2 — no 6.x fallback needed [CITED: .planning/STATE.md] |
| `@watchbug/contracts` (types-only) | workspace | `constants.ts` values + report types | R-18 single constant set; `import type` erases it from the bundle |

### Supporting (verification only — never shipped)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@playwright/test` | 1.63.0 | The one e2e suite (R-12) | All verification; three engine projects already configured |
| `node:zlib` | Node 24 built-in | `check:size` gzip tiers | Already in place |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Closed Shadow DOM host | cross-origin `<iframe>` host | Stronger isolation, but needs `allow="display-capture"` for `getDisplayMedia`, adds a CSP `frame-src` entry to every host, dies in sandboxed embeds, costs KBs. iframe stays a reserved `WidgetHost` adapter (R-02 seam) [CITED: .planning/research/ARCHITECTURE.md:251] |
| `canvas.captureStream()` e2e stub in all engines | `CaptureSource`-seam stub for webkit | WebKit build here has no `captureStream` [VERIFIED: probe] — a per-engine two-tier stub is the only thing that runs green on all three projects |
| Serving the hostile fixture from the panel nginx root | Playwright `page.route` fulfilment at the panel origin | The `location /` CSP blocks inline `<style>`/`style=` — a fixture served there would have its hostile CSS neutered and CA-04 would pass vacuously [VERIFIED: apps/panel/nginx.conf:51]. Route fulfilment keeps the same origin (originGate-safe) with no CSP; validated in the probe. |

**Installation:** none. This phase installs **zero** new packages (npm, PyPI or otherwise). If the planner is tempted to add one, it is a consultation trigger (size tier) and must clear the Package Legitimacy Gate first.

**Version verification:** No new packages → no registry lookups required. Existing pins verified in `.planning/research/STACK.md` and re-confirmed live this session (esbuild 0.28.2 in `packages/sdk/package.json`, Playwright 1.63.0 executed).

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** PRF-04 (zero runtime npm dependencies) forbids new runtime deps outright; the build/verify toolchain (esbuild 0.28.2, @playwright/test 1.63.0, typescript 7.0.2) was installed and vetted in Phase 1. The `sdk-runtime-deps` gate [VERIFIED: scripts/gate.mjs:65-89] fails the build if any runtime block outside `ALLOWED_RUNTIME_DEPS` appears.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | none installed this phase |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Host page (untrusted, hostile CSS)
  │  <script src="watchbug.js" async>  or  import 'watchbug.mjs'   (INT-01/INT-05)
  ▼
window.Watchbug.init({ projectKey, … })                            (INT-02, INV-02)
  │
  ▼
WidgetHost custom element — LAST child of document.documentElement
  inline !important positioning (fixed, z-index 2147483647, pointer-events:none)
  └── #shadow-root (closed; SHADOW_MODE=open only in e2e build)     (INV-01, R-14)
        <style> :host{all:initial} → wrapper{all:initial + re-declared props, px-only, --wb-*}
        ├── Launcher <button> 48×48  ── one click = transient activation (P2-D-01/02)
        └── StatusPanel  idle→capturing→sending→retrying→sent|failed*  (UI-SPEC state machine)
              │
   gesture handler (synchronous):
   [1] hide host (inline display:none) ──────────── P2-D-05 ─┐
   [2] getDisplayMedia({ video:true, preferCurrentTab:true }) │ (Chromium-only hint;
   [3] <video> srcObject → wait frame → drawImage             │  picker may return any
   [4] ASSERT host hidden (P2-D-06) → else loud failure       │  surface — see Pattern 3)
   [5] restore host ◄─────────────────────────────────────────┘
              │  raw ImageData (A-05: never a Blob)
              ▼
   blank probe: 9-pixel sample, variance ~0 / area > cap → loud abort (P2-D-12, M-6)
              ▼
   Redactor T1 (destructive, on ImageData — BEFORE any encode)  (SEC-02, R-13)
     DOM scan: input[type=password] values · text-node patterns (JWT/Bearer/=key=/Luhn card)
               · [data-watchbug-sensitive]  →  bboxes in CSS px
     map to bitmap space (scale = canvas.width / innerWidth, round OUTWARD, H-1)
     flat fill alpha 255 on every matched rect
              ▼
   Encode ladder (P2-D-10/11): DPR clamp 2 → ≤ MAX_IMAGE_PIXELS → WebP q0.8
     → over 800 KB target? q0.6 → q0.5 → downscale 0.75× (loop)
     M-3: sniff blob.type — silent PNG fallback detection
     [exactly ONE textual toBlob call site — gate.mjs sdk-single-encode-sink]
              ▼
   Transport lane 1 (P2-D-03): fetch POST /api/incidents
     FormData { meta: JSON, image: blob } + X-Project-Key + Idempotency-Key (same key on retries)
     transient (net/timeout/5xx/429) → 3 attempts, backoff 1/4/10 s ±25 %, 15 s timeout
     contract 4xx (400/401/403/413) → immediate loud failure + server reason (textContent!)
              ▼
nginx (panel origin, /api/ proxy — same-origin) → Fastify ingest (Phase 1: caps → key gate →
  schema-validated meta → harden/re-encode → sanitize → store) → PostgreSQL + blob volume
              ▼
apps/panel renders the report (already shipped — no panel work this phase)
```

### Recommended Project Structure

```
packages/sdk/src/
├── index.ts                 # bootstrap: init(), ESM export + IIFE global (INV-02)
├── strings.ts               # P2-D-04 ID→English map + t() placeholder formatter
├── widget/
│   ├── host.ts              # WatchbugHost custom element + WidgetHost adapter:
│   │                        #   inline-!important hardening, shadow <style>, hide/restore,
│   │                        #   MutationObserver re-append, SHADOW_MODE root registry
│   ├── launcher.ts          # 48×48 button, one-gesture entry, disabled while in flight
│   └── status-panel.ts      # UI-SPEC state machine renderer + action buttons + spinner
├── capture/
│   ├── capture-source.ts    # CaptureSource port type (R-02) + DisplayMediaCapture adapter
│   ├── pipeline.ts          # hide-assert → frame grab → blank probe → redact → encode order
│   └── dom-serialize.ts     # existing v2 stub (untouched)
├── redact/
│   ├── redactor.ts          # Redactor port impl: DOM scan → bboxes → destructive fill
│   ├── patterns.ts          # P2-D-07 catalog (JWT/Bearer/assignments/Luhn) — see Pitfall 1
│   └── geometry.ts          # H-1 CSS-px → bitmap-space mapping, outward rounding
├── image/
│   └── encode.ts            # P2-D-10/11 ladder + M-3 blob.type sniff (single toBlob sink)
├── transport/
│   └── lane1.ts             # fetch + FormData + idempotency + P2-D-03 retry/backoff
└── annotator.ts             # Phase 3 stub (untouched)
```

Build lanes stay exactly as Phase 1 built them (6 esbuild calls over 3 lanes × 2 formats) [VERIFIED: packages/sdk/scripts/build.mjs:41-66 `LANE_ENTRIES` / `FORMAT_ROLES`]; Phase 2 adds source files into the existing `src/index.ts` entry and wires the `SHADOW_MODE` variant.

### Pattern 1: WidgetHost isolation (H-2/H-3 — architecture-loaded, fix at first build)

**What:** A custom element appended as the **last child of `document.documentElement`** (minimal ancestor chain; re-appended by a light `MutationObserver` if `documentElement` is replaced), hardened with **inline `!important`** positioning, containing a closed shadow root whose `<style>` element (inside the shadow, **not** `adoptedStyleSheets`) starts with `all: initial` and then explicitly re-declares every used property.

**When to use:** Every widget surface, from the first line of widget CSS. Retrofitting is a rewrite of every style (CONTEXT: "a retrofit is a rewrite of every style").

**Evidence (probe, 2026-10-17, Playwright 1.63.0 chromium + firefox + webkit on Windows):** a host with inline `!important` `display:block; position:fixed; z-index:2147483647; color:rgb(0,0,255)` computed to exactly those values under a hostile `* { display:none !important; position:static !important; z-index:auto !important; color:rgb(255,0,0) !important; font-size:4px !important }` — identical results in all three engines. A closed shadow root with `:host{all:initial}` + `.wrap{all:initial; font-size:15px}` rendered its span at `15px` (hostile `4px` did not leak through inheritance). [VERIFIED: empirical probe 2026-10-17]

**Example (host hardening — shape per UI-SPEC):**
```ts
// packages/sdk/src/widget/host.ts
const HOST_STYLE = [
  'position: fixed !important', 'z-index: 2147483647 !important',
  'right: 24px !important', 'bottom: 24px !important',
  'margin: 0 !important', 'padding: 0 !important', 'border: 0 !important',
  'background: transparent !important', 'width: auto !important', 'height: auto !important',
  'pointer-events: none !important',
].join(';');
host.setAttribute('style', HOST_STYLE);            // inline !important outranks author !important
document.documentElement.appendChild(host);        // last child — minimal ancestor chain
const root = host.attachShadow({ mode: SHADOW_MODE }); // 'closed' prod | 'open' e2e (R-14)
// shadow <style>: ':host, .wrap { all: initial }' then re-declare:
// box-sizing, font-family, font-size, line-height, color, direction, cursor, text-align (px-only)
// Interactive descendants: pointer-events: auto.
```

**Rule set (from UI-SPEC + research, all mandatory):** px-only units (zero `rem`/`em`) · `--wb-*` custom properties on the inner wrapper only · no `part`/`::part`/`::theme` · zero stylesheets/classes in host `head`/`body` · zero external requests · `pointer-events: none` on the host box so it never swallows host clicks.

### Pattern 2: T1 redaction ordering (A-05/SEC-02 — the load-bearing idea)

**What:** `CaptureSource.capture()` returns **raw `ImageData`, never a Blob**. The pipeline is strictly: grab frame → blank probe → Redactor destructively fills matched rects on the `ImageData` → only then encode. Structurally, no unmasked encoded byte can ever exist.

**When to use:** Always; the CA-02-style e2e assertion (decode the outgoing image, assert original pixel values are absent from the masked region) depends on this ordering being true *by construction*.

**Key details:**
- Masks live in **bitmap/device-pixel space** from the first mask (H-1): DOM rects are CSS px; the mapping is `scale = canvas.width / window.innerWidth` (tab capture = viewport-only, no scroll offset), rounded **outward** to whole pixels — over-masking is safe (P2-D-08).
- Flat fill `MASK_ALPHA_OPAQUE = 255` — `"export const MASK_ALPHA_OPAQUE = 255;"` [VERIFIED: packages/contracts/src/constants.ts:62] — the only automatic primitive (R-13: no blur, no CSS overlay, no semi-transparent fills).
- The Redactor port exists as a seam only (R-02); no host-configurable rules in v1 (P2-D-09).

### Pattern 3: Capture chain with surface verification + loud failures

**What:** The gesture handler synchronously hides the host (P2-D-05), calls `getDisplayMedia({ video: true, preferCurrentTab: true })`, waits for a real frame (`loadedmetadata`/`requestVideoFrameCallback` + `play()`), asserts the host is hidden right before `drawImage`/`getImageData` (P2-D-06 — code-level invariant, not call-order hope), restores the host, then probes for a blank frame (P2-D-12). `track.stop()` runs in `finally`. Every failure path is a **loud terminal UI state** (M-6) — never a silently blank image.

**When to use:** Every capture attempt.

**Surface-verification gap the plan must close:** `preferCurrentTab` only *hints*; the user may still share a window or the whole screen, where DOM→pixel mapping is invalid and auto-redaction cannot work. Recommendation (see Open Questions/O-Assumptions): require `track.getSettings().displaySurface === 'browser'` for v1 and fail loudly otherwise (consistent with P2-D-09's conservative policy and CAP-01's "current tab" wording); `preferCurrentTab` is Chromium-only [CITED: caniuse.com/mdn-api_mediadevices_getdisplaymedia_prefercurrenttab_option — Chrome/Edge 94+, Opera 80+ supported; Firefox 2→161 and Safari 3.1→27.2 not supported], so Firefox/Safari users pick a tab manually from the picker.

### Pattern 4: Status panel as state machine + `strings` map (UI-SPEC contract)

**What:** The status panel is both progress feedback and the CA-04 "dialog content". States: `idle → capturing → sending → retrying (n of 3) → sent | failed{Capture,Blank,Network,Rejected}`, exact copy and geometry per `02-UI-SPEC.md` (which is approved and authoritative — do not contradict it). All copy lives in `packages/sdk/src/strings.ts` ID→English (P2-D-04). Server 4xx reasons render via **`textContent`**, truncated to 240 chars (UI-SPEC A-6) — never `innerHTML`. The `Escape` listener is document-level and removed on teardown (UI-SPEC A-7).

### Anti-Patterns to Avoid

- **`adoptedStyleSheets` or `<style>` in the host document:** UI-SPEC mandates a `<style>` element inside the shadow root. Do not modernize this.
- **`rem`/`em`, `part`, `::theme`, host-inherited `color`/`font`:** every one is an isolation leak vector (H-2/H-3).
- **`selfBrowserSurface: 'exclude'`:** mutually exclusive with `preferCurrentTab` and Chromium-only (P2-D-05 explicitly rejects it).
- **Masking the widget's bbox in the bitmap instead of hiding the host:** would erase legitimate page content (P2-D-05).
- **CSS overlays / gaussian blur / semi-transparent fills as masking:** SEC-02/R-13 security prohibitions — blur is deconvolution-invertible.
- **`keepalive`/`sendBeacon` for image-bearing reports:** 64 KiB spec cap — a 60–150 KB screenshot is rejected outright (H-9; lane 2 is Phase 7).
- **`innerHTML` for the server reason or any dynamic text:** XSS surface (SEC-05); the panel renders text nodes only.
- **A second `toBlob` call site:** breaks `sdk-single-encode-sink` [VERIFIED: scripts/gate.mjs:127-155] and C-2's single-sink architecture.
- **Assuming webkit produces the PNG fallback on this platform:** empirically false here (see Pitfall 3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wire contract / caps | Local copies of limits or payload shape | `import type` from `packages/contracts` (values inlined at build) | R-18 single constant set; server caps are the control. `"export const MAX_ENCODED_IMAGE_BYTES = 2 * 1024 * 1024;"`, `"export const MAX_IMAGE_PIXELS = 16_777_216;"`, `"export const MAX_TITLE_CHARS = 200;"` [VERIFIED: packages/contracts/src/constants.ts:21,23,38] |
| Size budget enforcement | Ad-hoc byte counting in CI | `npm run check:size` (45/25/14/80 tiers) | Already exists and gates the build [VERIFIED: scripts/check-size.mjs:31-37] |
| Static privacy/dep policy | New lint config | `node scripts/gate.mjs` (`sdk-runtime-deps`, `sdk-no-host-storage`, `sdk-single-encode-sink`) | Part of the R-12 verification architecture (RSK-19); extend it, don't duplicate it |
| Retry/dedupe semantics | Custom idempotency or queue | `Idempotency-Key` header + server `UNIQUE` dedupe (Phase 1) | ING-03 already server-proven; the client only reuses one key per report |
| Durable offline queue | IndexedDB lane now | Lane 1 only | ING-02 is Phase 7 scope by design (H-9) |
| Widget isolation framework | Custom CSS scoping / iframe wrapper | Closed Shadow DOM + inline `!important` hardening (Pattern 1) | Proven on 3 engines; iframe reserved as a `WidgetHost` adapter |
| Image capture libraries | `html2canvas`, `fabric.js`, `konva` (all rejected, D-04/D-05) | `getDisplayMedia` + raw canvas/`ImageData` | ~50–85 KB each would blow the 45 KB budget; also wrong capture source (DOM snapshot ≠ what the user sees) |
| Luhn / regex catalogs via a dependency | `validator`, `zod` in the SDK | ~15 lines of hand-rolled Luhn + regex catalog in `redact/patterns.ts` | A dependency costs bundle bytes (PRF-04); the catalog is tiny and privacy-critical code should be auditable |
| Test scaffolding | Unit-test framework, coverage tooling | The one Playwright suite + `check:size` + `gate.mjs` | R-12 owner policy, stated twice |

**Key insight:** the SDK is hand-rolled *by decision* (PRF-04/RNF-01), but **nothing project-internal is hand-rolled twice** — contracts, gates, size tiers and the ingest dedupe are all reused from Phase 1.

## Common Pitfalls

### Pitfall 1: `gate.mjs` token collisions with the redaction catalog and doc comments
**What goes wrong:** `sdk-no-host-storage` fails on any line containing `document.cookie`, `\blocalStorage\b`, `\bsessionStorage\b`, `\bAuthorization\b` or `Bearer\s` — **including comments** (the rule scans raw lines) [VERIFIED: scripts/gate.mjs:100-118]. P2-D-07's pattern catalog must match `Bearer <token>` text, and SEC-03 doc comments love to write "never reads document.cookie" — both trip the gate.
**Why it happens:** the gate is line-based and comment-blind by design (cheap, deterministic).
**How to avoid:** (a) word SEC-03 comments generically ("host cookies/storage/auth headers" without the literal tokens); (b) write the `Bearer` pattern as a regex literal (`/Beare[r]\s+[A-Za-z0-9._-]+/` never contains the literal `Bearer` + whitespace the gate regex matches — the char after `Bearer` must not be real whitespace); (c) if unavoidable, add a **narrow, enumerated** exemption to `gate.mjs` (e.g. allow the `Bearer` pattern only in `src/redact/patterns.ts`, never `document.cookie`/storage) with a comment explaining the inverse purpose (masking, not reading).
**Warning signs:** `node scripts/gate.mjs` failing right after the first redaction-file commit.

### Pitfall 2: e2e capture stubbing does not work uniformly across the three engines
**What goes wrong:** the natural stub — return a `canvas.captureStream()` MediaStream from a faked `getDisplayMedia` — is impossible in the webkit project on this host: `navigator.mediaDevices` is **undefined** and `canvas.captureStream` is **not a function** in Playwright's WebKit build [VERIFIED: probe 2026-10-17, secure context http://127.0.0.1:8080]. Chromium and Firefox both work (frames verified: `readyState 4`, drawn pixel `[10,200,10,255]`).
**Why it happens:** Playwright ships WebKit ports (WinCairo/WebKitGTK) that lack the media capture surface real Safari has.
**How to avoid:** two-tier stub. chromium+firefox: fake `navigator.mediaDevices.getDisplayMedia` returning a `canvas.captureStream()` stream (exercises the real video→`drawImage` path). webkit: stub at the `CaptureSource` seam (e2e-only hook that supplies raw `ImageData`) so the **probe → redact → encode → transport** pipeline — where all the security properties live — still runs fully real. Real-prompt behavior cannot be automated anywhere (Chromium's `--auto-select-desktop-capture-*` flags are unreliable in CI) — treat the real picker as manual-only evidence.
**Warning signs:** webkit project timing out in `video.play()` or drawing a blank frame.

### Pitfall 3: The documented "webkit exercises the WebP→PNG fallback" premise is false here
**What goes wrong:** CA rows written to expect a PNG from webkit fail: Playwright's WebKit encodes real WebP (`toBlob(…, 'image/webp')` → `RIFF….WEBP`, magic-verified; type matches magic in all 3 engines) [VERIFIED: probe 2026-10-17]. Real macOS Safari still silently falls back to PNG (MDN semantics), but no engine on this host reproduces it.
**Why it happens:** the WinCairo/WebKitGTK ports have WebP encoders; Safari proper does not (per R-11/M-3 research).
**How to avoid:** cover M-3 by **stubbing `toBlob`** to return PNG-typed bytes in one row and asserting the sniff (`blob.type`) routes to the PNG path and the server accepts it (`CONTENT_TYPE_BY_EXT` accepts both `png` and `webp` [VERIFIED: apps/api/src/routes/incidents.ts:53 `const CONTENT_TYPE_BY_EXT: Record<string, string> = { png: 'image/png', webp: 'image/webp' };`]). Record the correction (playwright.config.ts's comment, REQUIREMENTS release criteria wording) as a deviation/resolution note for the owner — do not silently edit the R-12 policy.
**Warning signs:** a webkit row asserting `blob.type === 'image/png'` from a genuine `toBlob`.

### Pitfall 4: The hostile-CSS fixture must NOT be served under the panel's CSP
**What goes wrong:** `location /` sends `add_header Content-Security-Policy "default-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" always;` [VERIFIED: apps/panel/nginx.conf:51]. With no `style-src`, inline `<style>`/`style=` attributes are **blocked** — a fixture baked into the panel root would have its hostile CSS silently neutered and CA-04 would pass vacuously. Same for inline `<script>` stubs (`script-src` falls back to `default-src`).
**How to avoid:** serve the fixture via Playwright `page.route` fulfilment at the panel origin (`http://127.0.0.1:8080/…`) — same-origin with `/api` (so the origin gate passes: `WATCHBUG_CORS_ORIGINS=http://127.0.0.1:8080,http://localhost:8080` [VERIFIED: .env.example — "WATCHBUG_CORS_ORIGINS=http://127.0.0.1:8080,http://localhost:8080"]), no CSP headers, no deployment changes. **Validated this session** — the probes ran exactly this pattern. Alternative (if a "real" served fixture is wanted): a dedicated `location /e2e/` block in `apps/panel/nginx.conf` without the CSP, with the fixture copied into the panel image — document it as test-only.
**Warning signs:** CA-04 green while the fixture's `<style>` demonstrably can't apply (assert in-test that the hostile rule actually matches, e.g. a control element is hidden).

### Pitfall 5: `getDisplayMedia` requires synchronous transient activation
**What goes wrong:** any `await` (or `setTimeout`) between the click and `getDisplayMedia` loses transient activation → `InvalidStateError` [CITED: developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia — "Transient user activation is required… `InvalidStateError` … not made from code running due to a transient activation"]. P2-D-02's "the launcher click **is** the activation" makes this structural: hide the host and call `getDisplayMedia` synchronously in the handler.
**Warning signs:** capture fails immediately in real browsers but not in stubbed e2e.

### Pitfall 6: HiDPI/DPR geometry misregistration (H-1)
**What goes wrong:** masks computed in CSS px but applied in device px misregister 2–15 px — enough to leak the edge characters of a secret [CITED: .planning/research/SUMMARY.md:45 H-1].
**How to avoid:** one `geometry.ts` module from the very first mask: rects via `range.getClientRects()`/`getBoundingClientRect()`, scale by `canvas.width / window.innerWidth`, round **outward** (floor origin, ceil extent). All re-encode/downscale steps keep masks in the *current* bitmap's space (masks are already burned in before encode, so later downscaling can only shrink them — burn-in order is what makes this safe).
**Warning signs:** e2e artifact rows that mask a known secret but find its edge pixels in the decoded image.

### Pitfall 7: Non-tab capture surfaces invalidate DOM→bitmap mapping
**What goes wrong:** the picker can return a window/screen surface; the captured frame then contains content outside the page at unknown scale, and DOM-derived bboxes are meaningless — auto-redaction would silently miss (a privacy leak, the one failure mode the core value forbids).
**How to avoid:** verify `track.getSettings().displaySurface === 'browser'` and fail loudly otherwise (see Open Questions for the policy decision); never fall back to "send unredacted".

### Pitfall 8: Silent WebP→PNG fallback (M-3) and the encode ladder's single sink
**What goes wrong:** `canvas.toBlob(cb, 'image/webp')` falls back **silently** to PNG — no throw, no null [CITED: .planning/research/STACK.md — MDN `toBlob` semantics]. Detect by sniffing `blob.type` (content sniffing), cache the capability once at startup. Separately, the ladder (q0.8 → 0.6 → 0.5 → downscale) re-encodes repeatedly — but `sdk-single-encode-sink` allows **one textual `toBlob` occurrence** in all of `packages/sdk/src` [VERIFIED: scripts/gate.mjs:134-148 `const SINK = /\b(?:toBlob|toDataURL|convertToBlob)\b/g; … if (sinks > 1)`]. Implement the ladder as a loop around a single call site.

### Pitfall 9: `document.title` and server-reason strings are untrusted input
**What goes wrong:** P2-D-01 sends `document.title` (host-controlled) as `title`; the server sanitises it (Phase 1), but the status panel also renders server 4xx reasons — `innerHTML` there re-opens XSS (SEC-05). The closed schema means the SDK must send **exactly** `type, title, note, url, user` — `z.strictObject` rejects unknown keys [VERIFIED: packages/contracts/src/schema.ts:38-69 — `"export const reportSchema = z.strictObject({"` … `"  type: z.enum(['bug', 'feedback']),"`].
**How to avoid:** `textContent` only; truncate to 240 chars (UI-SPEC A-6); build meta by explicit field mapping, never spread.

### Pitfall 10: Playwright + closed shadow roots
**What goes wrong:** text/label queries can't pierce a closed root; assertions on the status-panel copy would fail against the production bundle.
**How to avoid:** the R-14 `SHADOW_MODE=open` e2e build exposes roots via a module-scoped registry (UI-SPEC) for content/state assertions; run the *isolation* assertions (WDG-02/03/05, CA-04) against the **closed** production bundle where observable (geometry, `elementFromPoint`, computed style of host-page elements). Wire `SHADOW_MODE` as a build flag variant — today it is hardcoded: `"    SHADOW_MODE: JSON.stringify('closed'),"` [VERIFIED: packages/sdk/scripts/build.mjs:37].

## Code Examples

### `strings.ts` (P2-D-04 — the Phase 3 pluggability shape, from UI-SPEC)
```ts
// packages/sdk/src/strings.ts
export const strings = {
  'launcher.label': 'Report a bug',
  'status.capturing': 'Capturing…',
  'status.sending': 'Sending…',
  'status.retrying': 'Retrying ({n} of {max})…',
  'status.sent': 'Report sent ✓',
  'status.captureFailed': "Couldn't capture the screen.",
  'status.captureFailed.hint': 'Nothing was sent. Allow screen sharing, then try again.',
  'status.blankCapture': 'The capture came back blank.',
  'status.sendFailed': "Couldn't send the report.",
  'status.rejected': 'The server rejected the report.',
  'action.retry': 'Try again',
  'action.dismiss': 'Dismiss',
} as const;
export type StringId = keyof typeof strings;
// t(): {placeholder} replacement only — Phase 3 adds stringsEs + resolver, no core refactor
```
[Source: `02-UI-SPEC.md` Copywriting Contract — locked]

### Capture pipeline skeleton (ordering is the contract)
```ts
// packages/sdk/src/capture/pipeline.ts — order: hide → capture → assert → restore → probe → redact → encode
host.hideSync();                       // P2-D-05: inline display:none, BEFORE getDisplayMedia
let stream: MediaStream;
try {
  stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true });
} catch (err) { host.restore(); ui.fail('status.captureFailed'); return; }  // M-6 loud
try {
  const track = stream.getVideoTracks()[0];
  // surface check: displaySurface === 'browser' (see Open Questions OQ-1)
  const frame = await grabFrame(video, track);          // loadedmetadata → play → drawImage
  if (!host.isHidden()) throw new Error('widget host not hidden at grab time');  // P2-D-06 code invariant
  const { imageData, scale } = toClampedImageData(frame); // DPR clamp 2, ≤ MAX_IMAGE_PIXELS
  if (blankProbe(imageData)) { ui.fail('status.blankCapture'); return; }       // P2-D-12, M-6
  redactor.redact(imageData, collectMaskRects(document, scale));               // T1 destructive, flat α=255
  const blob = await encodeLadder(imageData);           // single toBlob call site, M-3 sniff
  await transport.send(blob, buildMeta(), { idempotencyKey });                // lane 1, P2-D-03
} catch (err) { ui.fail(mapFailure(err)); }
finally { track?.stop(); host.restore(); }
```
[Pattern: `02-CONTEXT.md` P2-D-05/06/10/12, `.planning/research/SUMMARY.md` `track.stop()` in `finally`]

### Encode ladder with ONE `toBlob` call site (P2-D-10/11 + M-3 + gate)
```ts
// packages/sdk/src/image/encode.ts
const QUALITIES = [0.8, 0.6, 0.5];
export async function encodeLadder(image: ImageData): Promise<Blob> {
  let canvas = toCanvas(image);
  for (const q of QUALITIES) {
    const blob = await toBlobOnce(canvas, q);            // the ONLY toBlob occurrence in the SDK
    const kind = blob?.type === 'image/png' ? 'png' : 'webp';  // M-3: sniff, never assume
    if (blob && blob.size <= TARGET_BYTES) return blob;  // ≤ 800 KB target (P2-D-11)
  }
  for (let i = 0; i < 3 && blobTooBig(); i++) {
    canvas = downscale(canvas, 0.75);                    // then re-run qualities
    /* … */
  }
  /* hard cap 2 MB is the server's control; client never intentionally exceeds it */
}
// Capability cache at startup: draw 1×1, toBlob(…, 'image/webp'), accept iff blob.type === 'image/webp'
```
[Values: P2-D-10/11 locked; `MAX_ENCODED_IMAGE_BYTES = 2 * 1024 * 1024` [VERIFIED: packages/contracts/src/constants.ts:21]]

### Transport lane 1 with stable idempotency (P2-D-03)
```ts
// packages/sdk/src/transport/lane1.ts
const idempotencyKey = crypto.randomUUID();   // ONE key per report — reused on every retry
for (let attempt = 1; attempt <= 3; attempt++) {
  const res = await fetch('/api/incidents', {
    method: 'POST',
    body: form,                                // FormData: meta (JSON text) + image (Blob)
    headers: { 'X-Project-Key': projectKey, 'Idempotency-Key': idempotencyKey },
    signal: AbortSignal.timeout(15_000),       // per-attempt timeout (research constants)
    // NEVER keepalive/sendBeacon here — 64 KiB cap (H-9)
  });
  if (res.ok) return ui.state('sent');         // 201 { id } [VERIFIED: incidents.ts:359]
  if (res.status >= 500 || res.status === 429) { await backoff(attempt); continue; } // 1/4/10 s ±25 %
  return ui.state('failedRejected', await reasonOf(res));  // 400/401/403/413 — immediate, show reason
}
ui.state('failedNetwork');                     // exhausted → manual "Try again" (UI-SPEC A-2)
```
[Server contract: `Idempotency-Key` required, ≤ 256 chars — `"const MAX_IDEMPOTENCY_KEY_CHARS = 256;"` [VERIFIED: apps/api/src/routes/incidents.ts:50]; header read `"req.headers['x-project-key']"` [VERIFIED: apps/api/src/routes/incidents.ts:128] and `"req.headers['idempotency-key']"` [VERIFIED: apps/api/src/routes/incidents.ts:146]; success `"return reply.code(201).send({ id: inserted[0].id });"` [VERIFIED: apps/api/src/routes/incidents.ts:359]]

### Mask geometry (H-1, P2-D-08)
```ts
// packages/sdk/src/redact/geometry.ts
const scale = canvas.width / window.innerWidth;  // tab capture: frame maps to viewport, no scroll offset
function toBitmapRect(css: DOMRect): MaskRect {
  return {
    x: Math.floor(css.left * scale),
    y: Math.floor(css.top * scale),
    w: Math.ceil(css.width * scale) + Math.floor(css.left * scale) - Math.floor(css.left * scale), // outward
    h: Math.ceil(css.height * scale),
  };
}
// fill: ctx/data loop writing MASK_ALPHA_OPAQUE=255 on every matched rect — destructive, pre-encode
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ImageCapture.grabFrame()` as capture path | `getDisplayMedia` + `<video>`→canvas (ImageCapture optional only) | Q-09 resolution | Firefox has no `ImageCapture` at all [VERIFIED: probe — `imageCapture: false` on firefox + webkit, true on chromium]; the video path works wherever `getDisplayMedia` does |
| Feature-detecting WebP support | Runtime content sniff of `blob.type` after a 1×1 probe encode | R-11 / M-3 | No capability query exists; the fallback is silent |
| Assuming webkit e2e = PNG fallback | Forced-PNG stub for M-3 coverage (Pitfall 3) | this research | Docs claiming the webkit premise need a correction note |
| `adoptedStyleSheets` for shadow styles | `<style>` in the shadow root | UI-SPEC lock | Simpler, universally supported, mandated by the approved contract |

**Deprecated/outdated:** `html2canvas` / `fabric.js` / `konva` (D-04/D-05 rejections — size), gaussian-blur masking (D-06/R-13 — invertible), `zod-to-json-schema` (deprecated by maintainer), unit-test frameworks (R-12), `keepalive`/`sendBeacon` as the image transport (H-9).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | v1 accepts only tab capture (`track.getSettings().displaySurface === 'browser'`); window/screen surfaces fail loudly | Pattern 3 | Firefox/Safari UX where users share desktops by habit; needs owner sign-off (privacy-vs-convenience call) |
| A2 | webkit e2e rows stub the capture at the `CaptureSource`/`ImageData` seam (e2e-only hook), not at `getDisplayMedia` | Pitfall 2 | If the owner wants the webkit project to exercise the real media path, it is impossible on this host's Playwright WebKit — the seam stub is the only option |
| A3 | `gate.mjs` gets a narrow enumerated exemption (or careful wording) for the `Bearer` pattern catalog | Pitfall 1 | If the gate is left untouched and comments collide, `npm run gate` fails the phase |
| A4 | Host fixture served via Playwright `page.route` fulfilment at the panel origin (not baked into the nginx root) | Pitfall 4 | A "real" served fixture needs a dedicated nginx `location /e2e/` without CSP — deployment change, still INV-03-safe |
| A5 | Transform/filter ancestor "fixed-position trap" mitigation (last-child-of-`documentElement` + observer) is carried from research, not re-probed (probe 1's transform case was inconclusive) | Pattern 1 | Low — the mitigation is belt-and-braces; the hostile-CSS fixture spike in this phase will exercise it |
| A6 | Real macOS Safari silently falls back to PNG in `toBlob` (M-3 premise) — untestable on this Windows host | Pitfall 3 | Low — the sniff is correct regardless of which way a given engine goes |
| A7 | Closed-shadow content is asserted via the `SHADOW_MODE=open` registry build, while isolation asserts run against the closed bundle | Pitfall 10 | Low — cosmetic test-structure choice |
| A8 | Retry constants (3 attempts, 1/4/10 s ±25 %, 15 s timeout) and the ≤800 KB→2 MB targets are correct as locked | Code Examples | Low — P2-D-03/P2-D-11 fix them; they are parameterised anyway |
| A9 | Blank-probe rule: 9 distributed pixels, uniform-variance ≈ 0 ⇒ abort | Pattern 3 | Medium-low — the exact threshold is an implementation detail of P2-D-12; too aggressive aborts legitimate solid-color pages (e.g. a blank app screen) — tune with the fixture |
| A10 | `deviceScaleFactor` ≥ 2 contexts in Playwright are a sufficient HiDPI proof for CAP-05 | Validation | Low — combined with synthetic large frames through the capture seam |

## Open Questions (RESOLVED)

> All five questions carry a recorded resolution as of 2026-10-17 (plan revision after checker feedback). Each resolution cites the plan/decision that closes it; nothing below is left open for planning purposes.

1. **OQ-1 — Non-tab capture surfaces (policy). — RESOLVED.** The picker can return window/screen surfaces where DOM→bitmap mapping (and thus auto-redaction) is impossible. *Resolution:* v1 refuses non-`browser` surfaces with the loud `status.captureFailed` state (P2-D-09 conservative; CAP-01 says "current tab"); `displaySurface === undefined` (older engines) is **accepted with a documented caveat**. Closed by plan 02-03 Task 3 (flagged decision "OQ-1 surface policy"; e2e row `OQ-1: …` asserts zero network attempts on a non-tab surface). *Owner-confirmation status:* the planner default is adopted and execution proceeds on it; the Firefox/Safari UX impact is flagged to the owner in 02-03's flagged assumptions — a veto changes one branch in `DisplayMediaCapture` (accept-vs-refuse for `undefined`), not a contract.
2. **OQ-2 — Docs vs probe reality (webkit/WebKit WebP). — RESOLVED.** `playwright.config.ts` and the REQUIREMENTS release criteria state webkit exercises the R-11 PNG fallback; the probe shows Playwright's WebKit encodes real WebP here. *Resolution:* the webkit project stays (it still covers engine-divergent rendering), M-3 is covered by the forced-PNG stub row, and the premise correction is recorded as a `playwright.config.ts` comment fix plus a `documentation/resolution-record.md` amendment note — the R-12 policy itself is not edited. Closed by plan 02-05 Task 3.
3. **OQ-3 — Cross-origin iframe content is not redactable. — RESOLVED (accepted limitation).** A tab capture includes pixels of cross-origin iframes; the DOM scanner cannot reach them, so secrets inside ads/third-party embeds would ride along. *Resolution:* accepted for v1 (threat T-02-14, disposition `accept`, registered in plan 02-04) — P2-D-09's over-masking policy cannot fix unknown locations, and no v1 mechanism exists without a consultation-triggering public-API change. Honest documentation belongs in integration docs (Phase 5+).
4. **OQ-4 — `documentElement` replacement edge cases. — RESOLVED.** *Resolution:* re-append while initialised (the `MutationObserver` strategy in `widget/host.ts`, plan 02-01; asserted by the WDG-05 ordering row in 02-02 Task 3 — including after a `documentElement` replacement), and the UI-SPEC A-7 `Escape` listener is registered with the panel and removed on panel teardown (plan 02-02 Task 2) — no global teardown API is required for that contract. The `Watchbug.destroy()` host-page opt-out is an **additive public-API change and therefore an AGENTS.md consultation trigger** (`window.Watchbug.init()` surface): it is deliberately NOT planned in Phase 2 and is recorded here as a pending owner decision for a later phase (candidate: Phase 3's composer work). Owner confirmation requested in the 02-plan summaries.
5. **OQ-5 — Lighthouse baseline (CA-03/PRF-05). — RESOLVED.** CA-03 wants a Lighthouse run against the hostile-CSS fixture; PRF-05 is Phase 7. *Resolution:* the fixture path and serving mechanism are fixed now and stable — `e2e/fixtures/hostile-host.html` served by `page.route` fulfilment at the panel origin (Pitfall 4: never under the nginx root, whose `location /` CSP would neuter the hostile rules), wired in plans 02-01 (harness) and 02-02 Task 3 (matrix). Phase 7's Lighthouse run consumes the same fixture path; no further Phase 2 work is required.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, gates, e2e | ✓ | v24.11.1 | — |
| npm workspaces | monorepo build | ✓ | 11.6.2 | — |
| Docker + compose | e2e target stack (INV-03) | ✓ | 29.2.1 | — (suite fails loud without it [VERIFIED: e2e/global-setup.ts pattern]) |
| Playwright + chromium | e2e CA rows | ✓ | 1.63.0, all 3 browsers launched in probes | — |
| Playwright + firefox | e2e CA rows | ✓ | 1.63.0 | — |
| Playwright + webkit | e2e CA rows | ✓ | 1.63.0 (WinCairo port — media APIs absent, see Pitfall 2/3) | CaptureSource-seam stub |
| `getDisplayMedia` automation | CAP-01 real-prompt proof | ✗ (not automatable reliably) | — | Stubbed capture seam + manual-only real-prompt evidence |
| git | commits | ✓ | 2.40.1.windows.1 | — |

**Missing dependencies with no fallback:** none blocking. **Missing dependencies with fallback:** real-prompt capture proof (manual evidence), real-Safari WebP→PNG behavior (forced-PNG stub).

## Validation Architecture

> R-12 in force: **e2e and property assertions only**. One Playwright suite (extend the existing `e2e/` specs — no new test artifact types), plus `npm run check:size` and `node scripts/gate.mjs`. No unit tests, no coverage tooling.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.63.0 (`@playwright/test`) |
| Config file | `playwright.config.ts` (exists — 3 engine projects, `workers: 1`, global-setup health gate) |
| Quick run command | `npx playwright test e2e/sdk.spec.ts --project=chromium` |
| Full suite command | `npm run verify` (+ `npm run check:size`, `node scripts/gate.mjs`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INT-01 | async script tag boots widget | e2e (fixture loads `dist/watchbug.js`) | `npx playwright test e2e/sdk.spec.ts` | ❌ Wave 0 |
| INT-02 | `Watchbug.init({projectKey,…})` drives a landed report | e2e (intercept + panel row) | same | ❌ Wave 0 |
| INT-05 | ESM import boots widget | e2e (fixture `<script type="module">` importing `watchbug.mjs`) | same | ❌ Wave 0 |
| WDG-01 | launcher opens flow | e2e | same | ❌ Wave 0 |
| WDG-02 | hostile CSS cannot hide/restyle widget (CA-04) | e2e (fixture matrix: `* { display:none !important }`, `html{font-size:4px}`, `* { all: unset }`, transforms, z-index wars) | same | ❌ Wave 0 |
| WDG-03 | zero host leakage | e2e (enumerate `document.head` styles, host computed-style delta, custom-prop scan) | same | ❌ Wave 0 |
| WDG-04 | exactly one global, no prototype patching | e2e (window/prototype snapshot before vs after) | same | ❌ Wave 0 |
| WDG-05 | renders above all host content | e2e (`elementFromPoint` over a hostile max-z-index modal) | same | ❌ Wave 0 |
| CAP-01 | capture via prompt (stubbed seam per engine) | e2e | same | ❌ Wave 0 |
| CAP-04 | widget absent from capture | e2e (host hidden at stub invocation + decoded image pixel assertion) | same | ❌ Wave 0 |
| CAP-05 | ≤16 MP/≤2 MB, HiDPI non-blank | e2e (synthetic large frame + `deviceScaleFactor: 2` context; decode and assert dims/bytes) | same | ❌ Wave 0 |
| PRV-01 | password fields masked | e2e artifact (decode sent image; original pixels absent in the password rect) | same | ❌ Wave 0 |
| PRV-02 | token/card patterns masked (Luhn) | e2e artifact (same, per pattern family) | same | ❌ Wave 0 |
| PRV-03 | `data-watchbug-sensitive` masked | e2e artifact (same) | same | ❌ Wave 0 |
| PRV-05 | no cookies/storage/auth headers leave | e2e (seed sentinel cookie/localStorage/`Authorization` values; scan intercepted request bytes + headers) + `node scripts/gate.mjs sdk-no-host-storage` | `node scripts/gate.mjs` | ✅ (gate) / ❌ e2e row |
| PRV-06 | URL query/fragment stripped | e2e (intercept; assert `meta.url` path-only) | same | ❌ Wave 0 |
| PRF-01 | ≤45 KB gz core | size gate | `npm run check:size` | ✅ |
| PRF-04 | zero runtime npm deps | static gate | `node scripts/gate.mjs sdk-runtime-deps` | ✅ |

### Sampling Rate
- **Per task commit:** `npx playwright test e2e/sdk.spec.ts --project=chromium` (fast lane) + `npm run check:size`
- **Per wave merge:** `npm run verify` (all three engines) + `npm run check:size` + `node scripts/gate.mjs`
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `e2e/sdk.spec.ts` (or extension of the existing suite) — the CA-01…CA-04 rows above; keep the suite single-artifact per R-12
- [ ] `e2e/fixtures/hostile-host.html` + fixture-page loader (route fulfilment, Pitfall 4)
- [ ] `SHADOW_MODE=open` build variant wiring in `packages/sdk/scripts/build.mjs` [VERIFIED today: `"    SHADOW_MODE: JSON.stringify('closed'),"` at build.mjs:37 is hardcoded] + module-scoped root registry
- [ ] Two-tier capture stub seam (Pitfall 2): captureStream stub (chromium/firefox) + `CaptureSource`-level ImageData stub (webkit)
- [ ] Forced-PNG `toBlob` stub row for M-3 (Pitfall 3)
- [ ] `gate.mjs` exemption/wording strategy for the redaction catalog (Pitfall 1)
- [ ] *(No framework install needed — Playwright 1.63.0 and all browsers are present.)*

## Security Domain

> `security_enforcement` enabled in `.planning/config.json` (ASVS level 1).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no (Phase 5) | — |
| V3 Session Management | no (Phase 5) | — |
| V4 Access Control | yes | Public write-only `project_key` in `X-Project-Key` (server gate Phase 1); client sends it and nothing else |
| V5 Input Validation | yes | Closed wire contract (`z.strictObject` types-only); hand-rolled defensive init-option validation in the SDK; `document.title` capped at `MAX_TITLE_CHARS` (200) [VERIFIED: packages/contracts/src/constants.ts:38 `"export const MAX_TITLE_CHARS = 200;"`] |
| V6 Cryptography | no (client) | Masking irreversibility is SEC-02 pixel destruction (flat α=255), not encryption; server-side crypto is Phase 5 |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sensitive data exfiltrated in screenshot bytes | Information disclosure | T1 destructive redaction **before any encode** (A-05/SEC-02); artifact-level e2e asserts original pixels absent from encoded bytes |
| Host credential theft by the SDK | Information disclosure | SEC-03: never read host cookies/storage/tokens; `sdk-no-host-storage` grep gate + sentinel-scan e2e row (Pitfall 1) |
| XSS via rendered server/host strings | Tampering | `textContent`-only rendering of `document.title`/server reasons; server sanitises ingest (Phase 1, SEC-05) |
| Hostile host page tampers with/obscures the widget | Tampering / DoS | Pattern 1 isolation; loud-failure states (M-6) instead of silent degradation |
| Blank/stale capture as silent data loss | Repudiation/DoS | P2-D-12 nine-pixel probe + visible failure state; `track.stop()` in `finally` |
| Supply-chain slop in the SDK bundle | Information disclosure | PRF-04 zero runtime deps + `sdk-runtime-deps` gate |
| Image-borne XSS (SVG/polyglot uploads) | Tampering | Server-side C-3/C-4 rejections (Phase 1); SDK sends only PNG/WebP canvas output |

## Sources

### Primary (HIGH confidence)
- **Empirical probes (2026-10-17, Playwright 1.63.0 chromium/firefox/webkit on Windows)** — inline `!important` vs hostile author `!important` (all engines pass); closed-shadow `all: initial` isolation; `canvas.captureStream`→`<video>`→`drawImage` frames (chromium/firefox OK, webkit absent); `navigator.mediaDevices`/`getDisplayMedia` presence per engine in a secure context; WebP `toBlob` magic bytes (`RIFF….WEBP` in all three engines here)
- `packages/contracts/src/constants.ts` (Read) — A-06 cap values, verbatim quotes above
- `packages/contracts/src/schema.ts` (Read) — closed report contract, `stripQueryFragment`
- `apps/api/src/routes/incidents.ts` (Read) — ingest header/field contract, `MAX_IDEMPOTENCY_KEY_CHARS`, 201 shape
- `scripts/gate.mjs` (Read) — the three SDK static rules and their exact matching semantics
- `scripts/check-size.mjs` (Read) — 45/25/14/80 tiers
- `apps/panel/nginx.conf` (Read) — same-origin `/api` proxy + the `location /` CSP
- `packages/sdk/scripts/build.mjs` (Read) — lane/format matrix, hardcoded `SHADOW_MODE`
- `02-CONTEXT.md`, `02-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` (Read) — locked decisions, UI contract, requirement definitions

### Secondary (MEDIUM confidence)
- MDN `MediaDevices.getDisplayMedia` (fetched 2026-09-07 revision) — transient activation, unpersisted permission, `preferCurrentTab`/`selfBrowserSurface` semantics [CITED: developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia]
- caniuse `preferCurrentTab` support table (fetched 2026-10-17) — Chromium 94+/Opera 80+ yes; Firefox/Safari no [CITED: caniuse.com/mdn-api_mediadevices_getdisplaymedia_prefercurrenttab_option]
- `.planning/research/SUMMARY.md` / `ARCHITECTURE.md` / `STACK.md` (locked research evidence) — H-1…H-9 pitfalls, WidgetHost strategy, transport lanes, WebP fallback semantics

### Tertiary (LOW confidence)
- jsr.io `@eatsjobs/media-mock` notes — WebKitGTK `<video>`+MediaStream frame-readiness quirks (may or may not apply to Playwright's WinCairo port; superseded by our direct probe for the `captureStream` absence) [CITED: jsr.io/@eatsjobs/media-mock]
- GitHub mdn/browser-compat-data #30654 — anecdotal report that iOS 27 Safari *does* support `getDisplayMedia` (contradicts the old "no mobile support" claim; Phase 7 copy concern only)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — no new packages; existing pins verified in Phase 1 and re-executed this session
- Architecture: **HIGH** — the load-bearing isolation assumptions were empirically confirmed on all three engines; capture/redact ordering is locked by A-05/P2-D-10
- Pitfalls: **HIGH** for the probe-backed ones (webkit gaps, gate collisions, CSP fixture trap); **MEDIUM** for Safari-specific behavior (untestable on this host)

**Research date:** 2026-10-17
**Valid until:** 2026-11-16 (30 days — browser-API surface is stable; the Playwright-WebKit findings are version-bound to 1.63.0 and should be re-probed on any Playwright upgrade)
