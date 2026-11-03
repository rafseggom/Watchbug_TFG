# Phase 3: Report Composer & Annotation Editor (lazy) — Pattern Map

**Mapped:** 2026-10-28
**Files analysed:** 38 (24 new/modified SDK + contracts + API, 9 verification, 5 supporting)
**Analogs found:** 33 / 38 (5 have no direct analog — all inside the new canvas editor)
**Analog scope:** `packages/sdk/src/**`, `packages/sdk/scripts/**`, `packages/contracts/src/**`, `apps/api/src/**`, `apps/api/drizzle/**`, `apps/panel/src/**` (i18n only), `e2e/**`, `scripts/**` — every path below is `git ls-files`-tracked (verified).
**Measured baseline (2026-10-28, `node scripts/check-size.mjs`):** core 9.3 / lazy 0.3 / adapter 0.3 → runtime 10.0 KB gz (tiers 45 / 25 / 14 → 80).

> ⚠ **Path correction for the brief:** there is no `apps/api/src/ingest/incidents.ts`. The route controller is `apps/api/src/routes/incidents.ts` (459 lines) and the ingest stages live in `apps/api/src/ingest/{sniff,structure,guard,harden}.ts`. Plan against those paths.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/sdk/src/widget/composer.ts` *(new)* | component (view) | event-driven (form) | `packages/sdk/src/widget/status-panel.ts` | **exact** (role + flow) |
| `packages/sdk/src/widget/review.ts` *(new)* | component (view) | render-once | `packages/sdk/src/widget/status-panel.ts` | **exact** (role + flow) |
| `packages/sdk/src/widget/loader.ts` *(new)* | utility (async singleton) | lazy load (dynamic import) | `packages/sdk/src/image/encode.ts` (`preferredMimeType`) | role-match |
| `packages/sdk/src/index.ts` *(modify)* | entry + screen router | event-driven | itself (`init`, flowRef) | exact |
| `packages/sdk/src/widget/host.ts` *(modify: `lang`)* | component (isolation) | n/a | itself `:144-150` | exact |
| `packages/sdk/src/widget/launcher.ts` *(modify: locale label, disabled span)* | component | event-driven | itself | exact |
| `packages/sdk/src/strings.ts` *(modify: `stringsEs` + resolver)* | config (dictionary) | transform | `apps/panel/src/i18n.ts` | **exact** |
| `packages/sdk/src/strings.editor.ts` *(new, lazy-only)* | config (dictionary) | transform | `packages/sdk/src/strings.ts` + panel `i18n.ts` | role-match |
| `packages/sdk/src/annotator.ts` *(stub → lazy entry)* | entry + component | event-driven (pointer) + transform | `image/encode.ts` (canvas) + `status-panel.ts` (DOM) | partial |
| `packages/sdk/src/annotator/canvas-layer.ts` *(new)* | utility | event-driven | `redact/geometry.ts` + `capture-source.ts:readFrame` | partial |
| `packages/sdk/src/annotator/tools.ts` *(new)* | utility | transform | `redact/geometry.ts` | partial |
| `packages/sdk/src/annotator/masks.ts` *(new)* | utility | transform (pixel mutation) | `redact/redactor.ts:fillRects` | **exact** (flow) |
| `packages/sdk/src/annotator/editor-dom.ts` *(new)* | component | event-driven | `widget/status-panel.ts` + `widget/launcher.ts` (SVG) | role-match |
| `packages/sdk/src/capture/pipeline.ts` *(split)* | service (orchestration) | request-response | itself | exact |
| `packages/sdk/src/capture/manual-file.ts` *(new)* | adapter (2nd `CaptureSource`) | file I/O → `ImageData` | `capture/capture-source.ts` + `image/encode.ts` canvas helpers | role-match |
| `packages/sdk/src/image/encode.ts` *(modify: `fitToCaps`)* | utility (single sink) | file I/O (encode) | itself | exact |
| `packages/sdk/src/redact/geometry.ts` *(export reuse)* | utility | transform | itself | exact |
| `packages/sdk/src/redact/redactor.ts` *(export `MASK_RGB`/`fillBitmapRects`)* | utility | transform | itself | exact |
| `packages/sdk/src/transport/lane1.ts` *(modify `ReportMeta`)* | service | request-response | itself | exact |
| `packages/sdk/scripts/build.mjs` *(verify/keep lanes)* | build config | batch | itself | exact |
| `packages/contracts/src/types.ts` *(+`'jpeg'`)* | model (type) | n/a | itself `:15` | exact |
| `packages/contracts/src/constants.ts` *(likely unchanged; verify)* | config | n/a | itself | exact |
| `apps/api/src/ingest/sniff.ts` *(+JPEG magic)* | ingest stage | transform | itself | exact |
| `apps/api/src/ingest/structure.ts` *(+JPEG branch)* | ingest stage | transform | itself (`validateStructure`) | exact |
| `apps/api/src/ingest/guard.ts` *(+SOFn walker)* | ingest stage | transform | itself (`readWebpDimensions` structure) | exact |
| `apps/api/src/ingest/harden.ts` *(+`jpeg()`/`autoOrient`)* | ingest stage | transform | itself `:94-104` | exact |
| `apps/api/src/routes/incidents.ts` *(4 sites → `Record<ImageExt,string>`)* | controller | request-response | itself | exact |
| `apps/api/src/db/schema.ts` *(CHECK + jpeg)* | model | n/a | itself `:53` | exact |
| `apps/api/drizzle/0001_*.sql` *(new migration)* | migration | batch | `0000_grey_the_santerians.sql` | exact |
| `e2e/helpers/composer.ts` *(new)* | test helper | UI walk | `e2e/helpers/capture-stubs.ts` (`waitForHeadline`, `probeWidget`) | role-match |
| `e2e/helpers/editor.ts` *(new)* | test helper | pointer drag | `capture-stubs.ts` probes + `sdk.spec.ts:readMaskRect` | role-match |
| `e2e/helpers/host-fixtures.ts` *(modify: `BundleName`, `serveBundle`)* | test helper | static file serving | itself `:47`, `:195-218` | exact |
| `e2e/helpers/capture-stubs.ts` *(reuse/extend)* | test helper | event-driven | itself | exact |
| `e2e/sdk.spec.ts` *(~30 rows migrated)* | test | e2e | itself | exact |
| `e2e/ingest.spec.ts` *(+JPEG rows)* | test | e2e (API) | itself `:148-165` | exact |
| `e2e/make-fixtures.mjs` *(+`valid-64x64.jpg`)* | tooling | file I/O | itself `:20-59` | exact |
| `scripts/check-size.mjs` *(gate max of `.js`/`.mjs`)* | config (gate) | batch | itself `:31-35`, `:60-69` | exact |
| `scripts/gate.mjs` *(optional new rule)* | config (gate) | static analysis | itself (`RULES` array) | exact |

---

## Pattern Assignments

### 1. `packages/sdk/src/widget/composer.ts` (component, event-driven) — **the single most important analog**

**Analog:** `packages/sdk/src/widget/status-panel.ts`

This is a *perfect* role+flow match: a vanilla-TS view module that (a) exports one `CSS` template literal, (b) has a `create*()` factory taking a handlers object, (c) returns `{ element, render, destroy }`, (d) writes every string through `t()`, (e) has zero HTML sink, (f) owns a document-level `Escape` listener with strict teardown. Copy its skeleton, not its copy.

**Module shape / public surface** (`status-panel.ts:39-49`):
```ts
export interface StatusPanelHandlers {
  /** Same-turn `Try again` (a capture retry needs the click's activation). */
  onRetry: () => void;
  onDismiss: () => void;
}

export interface StatusPanel {
  readonly element: HTMLElement;
  render(view: StatusView): void;
  destroy(): void;
}
```

**CSS-in-TS convention** (`status-panel.ts:51-72`, concatenated into the one shadow `<style>` at `index.ts:152`):
```ts
export const PANEL_CSS = `
.panel {
  position: fixed;
  right: var(--wb-space-4);
  bottom: 88px;
  box-sizing: border-box;
  width: min(320px, calc(100vw - 48px));
  ...
  animation: wb-panel-in 120ms ease-out;
}
`;
```
→ `COMPOSER_CSS` / `REVIEW_CSS` follow the same contract: only `--wb-*` tokens (declared `host.ts:74-92`), px only, hover/active via precomputed tokens, `@media (prefers-reduced-motion: reduce)` block at the end (`status-panel.ts:155-158`).

**DOM construction — the `el()` helper and the "no HTML sink" rule** (`status-panel.ts:190-237`):
```ts
function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  if (className.length > 0) node.className = className;
  return node;
}

export function createStatusPanel(handlers: StatusPanelHandlers): StatusPanel {
  const panel = el('section', 'panel');
  panel.setAttribute('data-hidden', 'true');

  const text = el('div', 'text');
  text.setAttribute('role', 'status');
  text.setAttribute('aria-live', 'polite');
  ...
  const retryButton = el('button', 'action action--primary');
  retryButton.setAttribute('type', 'button');
  retryButton.textContent = t('action.retry');
```
Every user-visible string is `textContent`; server text likewise (`status-panel.ts:327-330`). T-02-01/SEC-05 forbids `innerHTML`/`insertAdjacentHTML`/`document.write` anywhere in the composer/editor — `scripts/gate.mjs` does not (yet) catch it, so it is a review rule.

**`Escape` discipline — one listener per mounted surface** (`status-panel.ts:255-275`, teardown `:401-407`):
```ts
let escapeListening = false;

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  handlers.onDismiss();
};

const setEscapeListening = (listening: boolean): void => {
  if (listening === escapeListening) return;
  escapeListening = listening;
  if (listening) document.addEventListener('keydown', onKeyDown);
  else document.removeEventListener('keydown', onKeyDown);
};

destroy(): void {
  clearDismissTimer();
  setEscapeListening(false);
  retryButton.removeEventListener('click', onRetry);
  dismissButton.removeEventListener('click', onDismiss);
  panel.remove();
}
```
The composer registers on mount, removes on unmount; the **mask dialog** additionally owns `Escape` while open (research Pitfall 11).

**Re-render → don't rebuild.** `render()` mutates existing nodes and resets state (`status-panel.ts:360-396`). The composer should do the same: title/note inputs are *state*, so `render()` must not recreate them (focus loss) — set `.value` only when it differs.

**Text clamping, code points (P3-D-02 / Pitfall 13)** (`status-panel.ts:167-178`, `lane1.ts:94`):
```ts
export function truncateReason(text: string, max: number = MAX_REASON_CHARS): string {
  if (text.length <= max) return text;
  const cut: string[] = [];
  let units = 0;
  for (const char of text) {
    if (units + char.length > max - 1) break;
    cut.push(char);
    units += char.length;
  }
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).join('')}…`;
}
```
Reuse the idiom for title prefill: `[...document.title ?? ''].slice(0, MAX_TITLE_CHARS).join('')` (as `buildMeta` does at `lane1.ts:94`), and treat `maxlength` as a *hint only* (it counts UTF-16 units).

**Reuse, don't reinvent:** the composer's image zone preview renders through `encodeLadder` only when it needs a Blob; for the `<canvas>` preview draw the `ImageData` directly (`putImageData`), never `toDataURL` (C-2 gate).

---

### 2. `packages/sdk/src/widget/review.ts` (component, render-once)

**Analog:** same `status-panel.ts` skeleton. Differences to encode in the plan:
- It takes an *already encoded* artifact (`EncodedImage` from `encode.ts:41-47`) plus the `Draft`; it never mutates.
- It renders the flattened image by decoding the blob back (`createImageBitmap(blob)` → `drawImage` — the e2e's `analyzeImagePixels` at `sdk.spec.ts:82-109` is the reference for "decode what will be sent"); do **not** reach for `URL.createObjectURL`+`<img>` if a canvas suffices, and revoke any object URL you do create on `destroy()`.
- Focus moves to `Edit report` on open (UI-SPEC a11y).
- Long-note backstop: truncate the *display* copy to 280 chars with the `truncateReason` idiom above; the full note still goes on the wire.

---

### 3. `packages/sdk/src/widget/loader.ts` (utility, lazy load)

**Analog:** `packages/sdk/src/image/encode.ts:89-103` — the memoised async singleton with retry-on-failure, which is exactly the caching discipline a chunk loader needs.

```ts
let webpSupported: boolean | null = null;

async function preferredMimeType(): Promise<string> {
  if (webpSupported === null) {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const produced = await encodeOnce(probe, WEBP_MIME, 0.8);
    const bytes = new Uint8Array(await produced.arrayBuffer());
    webpSupported =
      sniffImageType(produced.type) === WEBP_MIME && hasWebpMagic(bytes);
  }
  return webpSupported ? WEBP_MIME : PNG_MIME;
}
```

**URL resolution analog** — `packages/sdk/src/index.ts:61-80`:
```ts
const LOADING_SCRIPT_URL: string | undefined = (() => {
  const script = document.currentScript;
  return script instanceof HTMLScriptElement && script.src.length > 0 ? script.src : undefined;
})();

function loadingScriptOrigin(): string | null {
  if (LOADING_SCRIPT_URL === undefined) return null;
  try {
    return new URL(LOADING_SCRIPT_URL).origin;
  } catch {
    return null;
  }
}
```
`LOADING_SCRIPT_URL` is module-private today — export it (or pass `LOADING_SCRIPT_URL` into the loader from `init()`) rather than reading `document.currentScript` again at load time (it is `null` by then). ESM lane: `import.meta.url` (compiles to `undefined` under `format:'iife'` — verified in research Pattern 4). The specifier must be a **variable**, and the URL **absolute**, or esbuild inlines the chunk into core (Pitfall 1) / resolves it against the *document*.

---

### 4. `packages/sdk/src/index.ts` (entry + screen router, modify)

**Analog:** itself. The wiring to preserve is `init()` at `:141-181`:

```ts
export function init(options: WatchbugInitOptions): void {
  if (mounted !== null) return;

  const config = resolveOptions(options);
  const host = mountHost(`${HOST_CSS}\n${LAUNCHER_CSS}\n${PANEL_CSS}`);

  const flowRef: { current: CaptureFlow | null } = { current: null };
  const launcher = createLauncher({
    hide: () => host.hideSync(),
    onActivate: () => flowRef.current?.start(),
  });
  const panel: StatusPanel = createStatusPanel({
    onRetry: () => flowRef.current?.retry(),
    onDismiss: () => {
      panel.render({ kind: 'idle' });
      launcher.setDisabled(false);
    },
  });

  const flow = createCaptureFlow({ host, launcher, config, onView: (view) => panel.render(view) });
  flowRef.current = flow;

  panel.render({ kind: 'idle' });
  host.content.appendChild(launcher.element);
  host.content.appendChild(panel.element);
  mounted = { host, launcher, panel, config };
}
```

Phase 3 changes, minimally:
- `mountHost(\`${HOST_CSS}\n${LAUNCHER_CSS}\n${PANEL_CSS}\n${COMPOSER_CSS}\n${REVIEW_CSS}\`)` — one `<style>` element only (`host.ts:48-52` forbids a second stylesheet / `adoptedStyleSheets`).
- The `flowRef` indirection stays (it exists exactly so the launcher/panel can be constructed before the flow); add a screen union (`Screen` from research Pattern 5) and let `onView` route: `status.*` → panel, everything else → the new overlays.
- `flowRef.current?.start()` must remain a **synchronous, no-`await`** call in the click handler (`launcher.ts:121-128`).

---

### 5. `packages/sdk/src/widget/host.ts` (modify: `lang`) — one-line change, keep the mechanism

**Analog:** itself `:144-150`:
```ts
const content = document.createElement('div');
content.className = 'wrap';
// F-08: `all: initial` clears the inherited `lang`, so without this the widget
// copy would be annotated with the host page's (or the user's default)
// language ... the declared language is pinned to `en` here; that resolver
// replaces this literal with the resolved locale, not the mechanism.
content.setAttribute('lang', 'en');
```
Replace the literal with the resolved locale, and re-set it on override. `WatchbugHost` (`:107-122`) gains either a `setLang(lang)` method or the caller mutates `content.lang` — prefer the method so the attribute can never drift from the dictionary in use.

---

### 6. `packages/sdk/src/strings.ts` (config, modify) — plug shape is already declared

**Analog:** `apps/panel/src/i18n.ts` — the typed two-dictionary resolver whose `es` map is a `Record<StringKey, string>`, so a missing translation is a **compile error**, not a silent fallback (`i18n.ts:22-100`):
```ts
export type Lang = 'en' | 'es';
const en = { reports: 'Reports', /* … */ } as const;
export type StringKey = keyof typeof en;
const es: Record<StringKey, string> = { reports: 'Reportes', /* … */ };

export const STRINGS: Record<Lang, Record<StringKey, string>> = { en, es };

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[lang][key];
}

export function detectLang(
  navigatorLanguage: string | undefined = globalThis.navigator?.language,
): Lang {
  return (navigatorLanguage ?? '').toLowerCase().startsWith('es') ? 'es' : 'en';
}
```
Constraints on the *widget* version:
- **No `localStorage`** (`i18n.ts:102-119` does it for the panel; `gate.mjs:100-106` forbids the literal in `packages/sdk/src`, and SEC-03 forbids host storage). Session-scoped in memory — UI-SPEC A-1.
- Keep `t(id, vars?)` placeholder-only (`strings.ts:36-44`) — do **not** grow plural/`Intl` machinery:
```ts
export function t(id: StringId, vars?: Record<string, string | number>): string {
  const template: string = strings[id];
  if (vars === undefined) return template;
  let out = template;
  for (const [name, value] of Object.entries(vars)) {
    out = out.split(`{${name}}`).join(String(value));
  }
  return out;
}
```
- `StringId` is `keyof typeof strings` (`strings.ts:30`). Adding `stringsEs: Record<StringId, string>` makes an EN key without its ES twin a type error. Adding `locale` state means `t()` reads the active locale — every existing call site keeps its signature (14 `t('…')` call sites in `status-panel.ts` / `launcher.ts` today; a locale change therefore needs a **re-render**, not a re-lookup, which is why each view already exposes `render()`).

---

### 7. `packages/sdk/src/strings.editor.ts` (new, lazy-only dictionary)

**Analog:** `strings.ts` (shape) + `i18n.ts` (typed twin). It is imported **only** from `annotator.ts` (and its internals), never from `index.ts`, or the editor copy lands in core. Enforce in the plan: after the build, `strings.editor.ts` content must not appear in `watchbug.js` (Pitfall 1's warning sign, same class of failure).
Keys: `editor.title/done/loading/canvas.label/tool.*/mask.mode.label/mask.fill/mask.pixelate` + the two `editor.load.error` keys (research OQ-4).

---

### 8. `packages/sdk/src/annotator.ts` (lazy entry: stub → real editor)

**Current stub (verbatim, `annotator.ts:1-16`):**
```ts
/**
 * Lazy editor lane (RNF-01 lane 2 — ≤ 25 KB gz, loaded on demand).
 * ...
 * Emitted as its own entry point so the core lane never carries editor bytes
 * (esbuild splitting works for ESM only; the IIFE build loads this lane by
 * script-tag injection instead).
 */
export const ANNOTATOR_LANE = 'lazy-editor' as const;
```
It is already an esbuild entry (`build.mjs:50-54`) and already size-budgeted (`check-size.mjs:31-35`) — Phase 3 adds **no build plumbing**, only source.

**Analogs to compose:**
- Canvas creation/2D context/`willReadFrequently`: `image/encode.ts:105-116` (`createCanvas`, `context2d` — the latter throws when 2D is unavailable; copy that fail-closed shape).
- Frame → `ImageData` plumbing: `capture-source.ts:198-226` (`readFrame`) — how an existing module turns a bitmap-ish source into raw pixels.
- Output: return `ImageData` + `MaskPatch[]` to core; **never** a `Blob` and never the string `toBlob|toDataURL|convertToBlob` (not even in a comment) — `gate.mjs:134`.

**Contract to export (from research Pattern 5 / ARCHITECTURE `Annotator` port):**
```ts
export interface AnnotatorModule {
  open(base: ImageData, options: {
    locale: 'en' | 'es';
    masks: readonly MaskPatch[];      // round-trip from a previous Edit
  }): Promise<{ img: ImageData; masks: readonly MaskPatch[] }>;
}
```
`Note: no analog edge — this is the one genuinely new module in the phase.`

---

### 9. `packages/sdk/src/annotator/masks.ts` (utility, destructive pixel transform) — **exact flow match**

**Analog:** `packages/sdk/src/redact/redactor.ts:289-317` (`fillRects`) — the repo's only destructive pixel mutator, and the authority for the mask colour:

```ts
/** The fill colour. Flat, opaque, and the only masking primitive (R-13). */
const MASK_RGB = { r: 0, g: 0, b: 0 } as const;        // :44

/** Paint each rect into the bitmap. Pure, synchronous, destructive. */
export function fillRects(
  image: ImageData,
  rects: readonly RectLike[],
  viewport: { width: number; height: number },
): number {
  if (rects.length === 0) return 0;
  const transform = transformFor(image.width, image.height, viewport.width, viewport.height);
  const { data, width, height } = image;
  let masked = 0;

  for (const rect of rects) {
    const target = toBitmapRect(rect, transform, width, height);
    if (target === null) continue;
    masked += 1;
    for (let y = target.top; y < target.bottom; y += 1) {
      let index = (y * width + target.left) * 4;
      for (let x = target.left; x < target.right; x += 1) {
        data[index] = MASK_RGB.r;
        data[index + 1] = MASK_RGB.g;
        data[index + 2] = MASK_RGB.b;
        data[index + 3] = MASK_ALPHA_OPAQUE;
        index += 4;
      }
    }
  }
  return masked;
}
```

Phase 3 differences (from research Pattern 3 / Code Examples):
- `bakeMask()` operates on a **canvas ctx** with a **rect-restricted** `getImageData(x,y,w,h)` — not the whole frame — and stores the **post-mask** region as `MaskPatch { rect, pixels }`.
- `MASK_RGB` and `MASK_ALPHA_OPAQUE` must remain the *same* constants: export them from `redactor.ts` (or import `MASK_ALPHA_OPAQUE` from `@watchbug/contracts/constants:62` and add one exported `MASK_RGB`) so "user mask reads as the same redaction" is structural (UI-SPEC A-6).
- `pixelate`: block `Math.max(MASK_PIXELATION_MIN_BLOCK_PX, Math.ceil(2 * capHeightPx))` (`constants.ts:63`), snap **outward**, force `a = 255`.
- **Never** store a pre-mask copy (Pitfall 4). Only patches.

---

### 10. `packages/sdk/src/annotator/canvas-layer.ts` (utility, pointer → bitmap)

**Analog:** `packages/sdk/src/redact/geometry.ts` — the single geometry authority, outward rounding, fail-closed on non-finite input:

```ts
export interface BitmapRect {                     // :24-29 (half-open)
  left: number; top: number; right: number; bottom: number;
}
export interface BitmapTransform { scaleX: number; scaleY: number; }   // :31-34

export function toBitmapRect(                     // :55-70
  rect: RectLike,
  transform: BitmapTransform,
  width: number,
  height: number,
): BitmapRect | null {
  if (!allFinite(rect)) {
    throw new Error('toBitmapRect: non-finite rect (refusing to guess a mask region)');
  }
  const left = Math.max(0, Math.floor(rect.left * transform.scaleX));
  const top = Math.max(0, Math.floor(rect.top * transform.scaleY));
  const right = Math.min(width, Math.ceil(rect.right * transform.scaleX));
  const bottom = Math.min(height, Math.ceil(rect.bottom * transform.scaleY));
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom };
}

export function transformFor(                     // :73-83
  frameWidth: number, frameHeight: number,
  viewportWidth: number, viewportHeight: number,
): BitmapTransform {
  return {
    scaleX: viewportWidth > 0 ? frameWidth / viewportWidth : 1,
    scaleY: viewportHeight > 0 ? frameHeight / viewportHeight : 1,
  };
}
```

**In the editor, the "viewport" argument is the canvas's own `getBoundingClientRect()`** — never `window.innerWidth/innerHeight` (Pitfall 7 / research Pattern 2 caveat). Pointer capture discipline (`setPointerCapture` on `pointerdown`, `pointercancel` = abort, not commit) is new code (Pitfall 5).

---

### 11. `packages/sdk/src/annotator/tools.ts` + `editor-dom.ts`

**`tools.ts`** (stroke records + per-tool replay): no direct analog for the state machine; the *rendering primitives* come from the canvas API. Follow research's self-contained stroke record (each stroke carries `width`/`ink`, Pitfall 10) and resolve `ink` once via `getComputedStyle(mount).getPropertyValue('--wb-color-accent')` with `#2f6feb` fallback — the token is declared at `widget/host.ts:77`.

**`editor-dom.ts`** (toolbar / top bar / dialog):
- Buttons + SVG glyphs: `packages/sdk/src/widget/launcher.ts:70-112` — the only hand-rolled inline-SVG builder in the repo:
```ts
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K, attributes: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}
```
- Button/a11y/hover/focus CSS: `LAUNCHER_CSS` (`launcher.ts:23-54`) and `.action` / `.action--primary` (`status-panel.ts:113-138`) — reuse those class shapes (36 px secondary, accent primary, 2 px/2 px focus ring).
- The 44×44 toolbar buttons and 2 px `:focus-visible` ring are UI-SPEC exceptions — write them as component CSS, not tokens.

---

### 12. `packages/sdk/src/capture/pipeline.ts` (split into stages)

**Analog:** itself. The ordering is the security property (`pipeline.ts:1-17` docblock); splitting must not move any step across the pixel boundary.

**Shape today (`:191-285`)** — the exact sequence to preserve:
```ts
async function runFromGesture(): Promise<void> {
  try {
    host.hideSync();
    launcher.setDisabled(true);
    pendingSend = null;
    onView({ kind: 'capturing' });
    ...
    const measured: { rects: RectLike[] | null } = { rects: null };
    let image: ImageData | null = null;
    try {
      image = await capture.capture({
        beforeRead: () => {
          if (!host.isHidden()) {
            throw new PipelineInvariantError('the widget host was visible at pixel-read time');
          }
          measured.rects = redactor.collect();
        },
      });
    } catch {
      onView({ kind: 'failed', failure: 'capture' });
    } finally {
      host.restore();                       // :234-237 — every path, FX-01
    }

    if (image === null) return;

    const probe = blankProbe(image);
    if (probe.blank) { onView({ kind: 'failed', failure: 'blank' }); return; }

    try { redactor.redact(image, measured.rects ?? undefined); }   // FAIL CLOSED
    catch { onView({ kind: 'failed', failure: 'capture' }); return; }

    let encoded: EncodedImage;
    try { encoded = await encode(image); }
    catch { onView({ kind: 'failed', failure: 'capture' }); return; }

    await deliver({ blob: encoded.blob, filename: filenameFor(encoded.mimeType),
                    meta: buildMeta(document, location), idempotencyKey });
  } finally { running = false; }
}
```
Split into `runCaptureStage()` (returns `{ok:true,image,t1}` | `{ok:false,failure}` — **already T1-redacted**, `t1` in bitmap space measured at the read instant) + `encodeFinal()` (in core, single sink) + `deliver()`. Keep `blankProbe` (`:64-82`) exactly as is, and keep `blankProbe` **off** the attachment path (research F6).

**Failure → degraded composer:** the three `onView({kind:'failed'})` capture branches become `captureNote: 'denied' | 'blank' | 'oversize'` on the draft; copy still comes from the existing `status.*.hint` keys (F6) — no new keys needed.

**Retry / idempotency:** `newIdempotencyKey()` (`:131-144`) and `deliver()` (`:171-189`) are unchanged; the key stays minted once per report, before capture.

---

### 13. `packages/sdk/src/capture/manual-file.ts` (2nd `CaptureSource`, file I/O)

**Analog:** `packages/sdk/src/capture/capture-source.ts` — same interface, plus the canvas read pattern.

**Seam (verbatim, `:19-32`)** — a second adapter must implement exactly this, returning `ImageData`:
```ts
export interface CaptureRequest {
  beforeRead: () => void;   // invoked immediately before the pixel read; throws to abort
}
export interface CaptureSource {
  capture(request: CaptureRequest): Promise<ImageData>;
}
```

**Canvas → `ImageData` (verbatim, `:210-221`)**:
```ts
const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
const context = canvas.getContext('2d', { willReadFrequently: true });
if (context === null) throw new CaptureUnavailableError('a 2D canvas is unavailable');

request.beforeRead();
context.drawImage(video, 0, 0);
return context.getImageData(0, 0, width, height);
```

**Helpers to reuse:** `image/encode.ts:105-126` (`createCanvas`, `context2d`, `scaledCopy` with `imageSmoothingQuality = 'high'`) — but **not** `initialDimensions()` verbatim (it starts with the DPR clamp at `:133-138`, wrong for a file). Export `fitToCaps(w,h)` applying only `MAX_IMAGE_DIM` + `MAX_IMAGE_PIXELS` (`:141-153`) and have `initialDimensions` call it after the clamp.

**Error class:** reuse `CaptureUnavailableError` (`:35-40`) so the composer's failure branch stays one `instanceof` check; do **not** wrap `DisplayMediaCapture` with the file adapter (research Pattern 6 — CAP-03 needs a *visible* failure, not a silent file dialog).

**Client format gate (SEC-05/V12):** `accept` is a hint; validate magic bytes (`FF D8 FF` for JPEG, the PNG signature, `RIFF`+`WEBP`) before `createImageBitmap`, and reject oversize *after* header-derived dims. The server's sniff is the mirror image of this (`sniff.ts:12-25`) — same three prefix checks, so the two rules cannot drift conceptually.

---

### 14. `packages/sdk/src/image/encode.ts` (modify: export `fitToCaps`; keep the single sink)

**Analog:** itself — and this file is a **do-not-touch-the-invariant** zone.

```ts
// :69-87 — the ONLY call site of the canvas encode API in packages/sdk/src
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
`encodeFinal(image, t1, masks)` lives **here** (or in core next to it) and calls `encodeLadder(image)` — never `encodeOnce` directly, never a second `toBlob`:

```ts
export async function encodeFinal(
  image: ImageData,
  t1: readonly BitmapRect[],        // bitmap-space, measured at capture time
  masks: readonly MaskPatch[],      // post-mask patches, creation order
): Promise<EncodedImage> {
  fillBitmapRects(image, t1, MASK_RGB, MASK_ALPHA_OPAQUE);   // T1 re-apply (idempotent)
  for (const patch of masks) putPatch(image, patch);          // user masks LAST (T3)
  return encodeLadder(image);                                 // single sink
}
```
Gate check after the change: `node scripts/gate.mjs sdk-single-encode-sink` must still print **one** sink (`gate.mjs:134-153` counts the literal text, comments included).

---

### 15. `packages/sdk/src/redact/geometry.ts` / `redactor.ts` (export reuse)

Both stay behaviourally identical. Needed exports:
- `geometry.ts`: `BitmapRect` (`:24-29`), `transformFor` (`:73-83`), `toBitmapRect` (`:55-70`) — already exported.
- `redactor.ts`: `MASK_RGB` (`:44`, currently module-private → export), `fillRects` (`:290-317`) → add a bitmap-space sibling `fillBitmapRects(image, rects: BitmapRect[], rgb, alpha)` so `encodeFinal` never needs a viewport.
- `createDomRedactor` (`:324-337`) is unchanged: T1 must still run at capture, and again on export for an attachment-less capture.

---

### 16. `packages/sdk/src/transport/lane1.ts` (modify `ReportMeta`)

**Analog:** itself. Only the type changes; the wire mechanics are fixed.

```ts
/** The CA-01 `meta` shape the SDK sends — explicit fields only, never a spread. */
export interface ReportMeta {
  type: 'bug';           // → 'bug' | 'feedback'   (P3-D-03)
  title: string;
  url: string;
  // + note?: string                         (P3-D-02/CAP-03, ≤ MAX_NOTE_CHARS)
}
```
`buildMeta` (`:85-97`) becomes the *prefill* helper (title from `document.title`, code-point clamp, `location.pathname` only). `postOnce` (`:131-177`) keeps `credentials: 'omit'` and `referrerPolicy: 'no-referrer'` — `gate.mjs:107-119` enforces the credentials rule. `filenameFor` (`:100-102`) is unchanged (SDK still only emits WebP/PNG).

---

### 17. `packages/contracts/src/types.ts` (add `'jpeg'`) and `constants.ts`

```ts
/** Accepted image container — PNG and WebP only (P1-D-11; SVG rejected unconditionally). */
export type ImageExt = 'png' | 'webp';       // types.ts:15  →  'png' | 'webp' | 'jpeg'
```
`constants.ts` needs **no change** — `MASK_ALPHA_OPAQUE` (`:62`), `MASK_PIXELATION_MIN_BLOCK_PX` (`:63`), `MAX_TITLE_CHARS` (`:38`), `MAX_NOTE_CHARS` (`:39`), `MAX_IMAGE_DIM` (`:25`), `MAX_IMAGE_PIXELS` (`:23`) are all already there. Don't restate a bound in the composer/editor; import it (R-18).

---

### 18. `apps/api/src/ingest/sniff.ts` (+ JPEG magic)

**Analog:** itself (`:12-25`) — the pattern is "one signature check per container, else `null`":
```ts
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function sniffImage(bytes: Uint8Array): ImageExt | null {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF'
      && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}
```
Add `if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';`
⚠ `FF D8 FF` — **not** `FF D8 FF E0` (research F1: sharp's own output starts `FF D8 FF DB`; Exif starts `E1`). Update the docblock (`:3-10` currently says JPEG is rejected unconditionally).

---

### 19. `apps/api/src/ingest/structure.ts` (+ JPEG branch)

**Analog:** itself, and specifically the *shape* of `validateStructure` (`:153-163`):
```ts
export function validateStructure(bytes: Uint8Array, ext: ImageExt): StructureResult {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const stripped = ext === 'png' ? stripPng(buf) : stripWebp(buf);
  if ('error' in stripped) return { ok: false, message: `image rejected: ${stripped.error}` };
  return { ok: true, bytes: stripped.bytes };
}
```
The `ext === 'png' ? … : …` binary shape is exactly the bug class to avoid here: make it a switch over `ImageExt` with an explicit `jpeg` arm returning `{ ok: true, bytes: buf }` **plus the written rationale** (research F1/A3: no walker; `harden.ts` is the control; `:22-26` docblock already concedes "a guard, not the hardening backend"). A `default` must never silently pass.

---

### 20. `apps/api/src/ingest/guard.ts` (+ JPEG SOF dimension walker)

**Analog:** itself — `readPngDimensions` (`:27-31`) / `readWebpDimensions` (`:33-64`) are the "walk the header, return `{width,height} | null`" contract; the SOFn walker slots in as a third reader:
```ts
/** Header-derived dimensions, or `null` when the container header is unusable. */
export function readDimensions(bytes: Uint8Array, ext: ImageExt): { width: number; height: number } | null {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return ext === 'png' ? readPngDimensions(buf) : readWebpDimensions(buf);   // :69 → switch
}
```
Keep `assertDecodeSafe` (`:72-102`) untouched: the fail-closed contract is "`null` → structured 400 before any decoder", and the message uses `ext.toUpperCase()` (`:78`) so it already reads "the JPEG header is missing or unreadable". Without the walker every JPEG gets a 400 — a wrong-direction failure, hence same task as `sniff.ts` (research F1).

---

### 21. `apps/api/src/ingest/harden.ts` (+ `jpeg()` and `autoOrient`)

**Analog:** itself `:93-106` — the pipeline options are the security envelope; add to them, don't replace them:
```ts
const pipeline = sharp(buf, {
  limitInputPixels: MAX_IMAGE_PIXELS,
  failOn: 'warning',
  // + autoOrient: true   ← mandatory, NOT sharp's default (EXIF Orientation)
}).timeout({ seconds: HARDEN_TIMEOUT_SECONDS });

const { data, info } =
  ext === 'png'
    ? await pipeline.png().toBuffer({ resolveWithObject: true })
    : await pipeline.webp().toBuffer({ resolveWithObject: true });
```
Become a `switch (ext)` with `pipeline.jpeg({ quality: 80 })` (sharp's documented default quality is 80; consider `chromaSubsampling: '4:4:4'` per research F1) and a `never`-style exhaustiveness check. Also update the sniff-null message at `:81` and the `:21-23` docblock ("same format in, same format out" now includes JPEG→JPEG).

---

### 22. `apps/api/src/routes/incidents.ts` (controller, 4 sites → one map)

**Analog:** itself. The fix is to **replace two ternaries with the existing `Record`**, which already exists at `:52-53`:
```ts
/** Server-side ext→MIME allowlist — the stored value never decides its own response headers. */
const CONTENT_TYPE_BY_EXT: Record<string, string> = { png: 'image/png', webp: 'image/webp' };
```

Sites to change:
- `:53` → add `jpeg: 'image/jpeg'`; prefer tightening the type to `Record<ImageExt, string>`.
- `:321` — **the latent bug**: `contentType: hardened.ext === 'png' ? 'image/png' : 'image/webp',` → `contentType: CONTENT_TYPE_BY_EXT[hardened.ext]` (a JPEG stored as `image/webp` is *accepted* by the CHECK constraint; nothing catches it).
- `:463` — `const ext = row.contentType === 'image/webp' ? 'webp' : row.contentType === 'image/png' ? 'png' : null;` → derive from the same map (invert it once, module-level) so the two mappings cannot drift.
- `:246` — client-facing copy `'image is neither PNG nor WebP (magic bytes); SVG, GIF and HTML are never accepted'` → include JPEG.

Blob route headers stay as-is (`:475-483`): `Content-Type`, `nosniff`, `attachment; filename="screenshot.${ext}"`, `CSP default-src 'none'; sandbox`, `CORP same-origin`. The `${ext}` name makes `screenshot.jpeg` fall out of the map for free.

Stage order in the handler is the contract (`:241-273`) — sniff → structure → guard → harden; no JPEG byte may reach sharp before `assertDecodeSafe`.

---

### 23. `apps/api/src/db/schema.ts` + `apps/api/drizzle/0001_*.sql` (migration)

**Analog:** `schema.ts:48-56` and the committed `0000_grey_the_santerians.sql`:
```ts
(t) => [
  uniqueIndex('incidents_project_idempotency_unique').on(t.projectId, t.idempotencyKey),
  check('incidents_type_check', sql`${t.type} in ('bug', 'feedback')`),
  check('incidents_content_type_check', sql`${t.contentType} in ('image/webp', 'image/png')`),   // ← + 'image/jpeg'
  check('incidents_status_check', sql`${t.status} in ('pending', 'in_progress', 'resolved')`),
  index('incidents_project_created_idx').on(t.projectId, t.createdAt),
]
```
```sql
-- 0000_grey_the_santerians.sql:19 (the artifact the owner reviews)
CONSTRAINT "incidents_content_type_check" CHECK ("incidents"."content_type" in ('image/webp', 'image/png')),
```
Generated by `drizzle-kit` from `apps/api/drizzle.config.ts` (`schema: './src/db/schema.ts'`, `out: './drizzle'`, `strict: true`) — **never hand-written**. `AGENTS.md`: a migration is a consultation trigger → the plan must carry `checkpoint:human-verify` showing the generated SQL and citing P3-D-14 (research OQ-2). The `0001_*_snapshot.json` + `_journal.json` entries are part of the artifact.

---

## Shared Patterns (apply across every plan)

### S-1. The single encode sink (C-2) — non-negotiable
**Source:** `packages/sdk/src/image/encode.ts:69-87`; enforced by `scripts/gate.mjs:126-155`.
```js
const SINK = /\b(?:toBlob|toDataURL|convertToBlob)\b/g;   // gate.mjs:134 — counts TEXT, comments included
if (sinks > 1) return fail([...`${sinks} encode sinks found`]);
```
Applies to: `annotator.ts` + every `annotator/*` module, `widget/composer.ts`, `widget/review.ts`, `pipeline.ts`, `encode.ts`. The editor returns `ImageData`; core encodes once, at Review (`encodeFinal`). A second sink fails the gate — a *comment* mentioning `toBlob` fails it too.

### S-2. No HTML sink (T-02-01 / SEC-05)
**Source:** `widget/status-panel.ts:190-237` (`el()` + `textContent`), `widget/launcher.ts:70-112` (`createElementNS`), `status-panel.ts:327-330` (server text via `textContent`).
Apply to: composer, review, editor DOM, mask dialog. Never `innerHTML`, `insertAdjacentHTML`, `document.write`, and never `dangerouslySetInnerHTML`-equivalents.

### S-3. Fail closed on the redaction path (T-02-10)
**Source:** `capture/pipeline.ts:256-264`:
```ts
try {
  redactor.redact(image, measured.rects ?? undefined);
} catch {
  onView({ kind: 'failed', failure: 'capture' });
  return;   // nothing encoded, nothing sent
}
```
Apply to: `runCaptureStage` (unchanged), `encodeFinal`'s T1 re-apply, and the editor's `bakeMask` (a geometry throw must abort the mask, never apply a guessed region — `geometry.ts:61-63` already throws on non-finite).

### S-4. Host-storage and credentials bans (SEC-03)
**Source:** `scripts/gate.mjs:92-124` (`document.cookie`, `localStorage`, `sessionStorage`, `Authorization`, `Bearer `; `credentials:` must be `omit`).
Consequence: the locale override is **in-memory only** (UI-SPEC A-1). Do not copy `apps/panel/src/i18n.ts:102-119`'s `localStorage` persistence into the widget — the panel may, the SDK may not.

### S-5. Transient activation is a same-task invariant
**Source:** `widget/launcher.ts:121-128` — no `await`, no microtask between `hide()` and `onActivate()`. And `pipeline.ts:191-198` mints the idempotency key and hides the host *before* `capture.capture()`.
Apply to: any re-capture path from inside the composer (Pitfall 12), and the new "Try again" wiring. Post-capture flows (composer, editor, review, send) are free to be async.

### S-6. Style + layout tokens
**Source:** `widget/host.ts:59-94` (`--wb-color-*`, `--wb-space-1..7`, px-only, `all: initial` reset), `status-panel.ts:51-159` (component CSS + reduced-motion block), `launcher.ts:23-54` (button states).
Every new CSS string is appended to the single `<style>` in `index.ts:152`. No second stylesheet, no `adoptedStyleSheets`, no `rem`/`em`, no hardcoded colours, no webfont.

### S-7. i18n lookup
**Source:** `packages/sdk/src/strings.ts:11-44` (`t()` placeholder-only) + `apps/panel/src/i18n.ts:22-100` (typed ES twin).
Every visible string in composer/review/editor comes from a dictionary key; no literals in component code. Dictionary split: core = launcher/status/action/composer/review/mask.confirm/i18n; lazy = `editor.*` (`strings.editor.ts`).

### S-8. Shared e2e harness
**Source:** `e2e/helpers/capture-stubs.ts` — the whole instrumentation vocabulary Phase 3 rows need:
- `clickLauncher(page)` `:510-513` — trusted click at the launcher's fixed coordinates (a real hit-test, so a buried host fails rather than passes).
- `waitForHeadline(page, '…')` `:588-598` — shadow-root text polling.
- `probeWidget(page)` `:543-585` — one shape for every shadow-root read (`shadowRoot ?? null`, `.panel`, `.headline`, `launcherDisabled`…). **Add composer/review/editor fields to this probe** rather than writing bespoke `page.evaluate` blocks per row.
- `collectHeadlines(page)` `:606-622` — MutationObserver sequence capture for short-lived states.
- `readOutgoingImage(page)` `:462-474` — WebKit-safe outgoing bytes via the `fetch` wrapper (`OUTGOING_RECORDER` `:156-183`), because Playwright's WebKit returns 0-byte blob parts.
- `installCaptureStub(page, browserName, opts)` `:428-455` — two tiers (`media` = fake `getDisplayMedia` + `captureStream`; `seam` = raw `ImageData` on the host element, only in the open build, `capture-source.ts:52-56`).
- `forcePngEncode(page)` `:483-495` — the M-3 fallback provocation.
- `PAINT_FRAME` `:49-122` — the magenta `#ff00ff` marker painted at `[data-capture-marker]`'s rect with the redactor's own outward rounding. **This is the CA-02 fixture**: a user mask over that marker reuses `expectMaskedAndTargeted` unchanged.

### S-9. CA-02 assertion reuse (do not write new pixel analysis)
**Source:** `e2e/sdk.spec.ts` — `analyzeRedaction` `:1581-1672`, `expectMaskedAndTargeted` `:1675-1699`:
```ts
expect(report.insideMagenta, 'zero original pixels inside the masked rect (CA-02)').toBe(0);
expect(report.ringMagenta, 'zero original pixels on the 1-px boundary ring (CA-02)').toBe(0);
expect(report.interiorBlack / report.interiorPixels, 'the mask interior must be the flat opaque fill')
  .toBeGreaterThanOrEqual(minInteriorBlack);      // 0.98 (0.9 where the DPR-2 clamp resamples)
expect(report.insideBlack / report.insidePixels).toBeGreaterThanOrEqual(0.9);
expect(report.ringBlack / report.ringPixels).toBeLessThan(0.5);
expect(report.controlBlack / report.controlPixels).toBeLessThan(0.2);
expect(report.controlDistinct).toBeGreaterThanOrEqual(2);
```
Thresholds `isMagenta` = squared distance from `#ff00ff` ≤ 14400; `isBlack` = `max(r,g,b) ≤ 24` (`:1614-1620`). New work is only the **drag** and the independent bitmap-rect formula (mirror of `readMaskRect` `:1487-1548`'s "written out independently of the SDK" discipline).

### S-10. Request interception convention
**Source:** `sdk.spec.ts:35` + `interceptIncidentPosts` `:112-135`; `ingest.spec.ts:33` — **one shared RegExp per route**, because `page.unroute` matches by source+flags and an inline duplicate silently leaks the mock into the next row. New composer rows reuse `INCIDENT_POST_RE` and `interceptIncidentPosts`, never a local regex.

---

## Verification-specific assignments

### `e2e/helpers/composer.ts` (new) — the ~30-row migration tool
**Analog:** `e2e/helpers/capture-stubs.ts` (`probeWidget` / `waitForHeadline` shapes). Contract the whole suite depends on (research F4):
```ts
// waitForComposer → (optionally assert prefilled title/type) → setNote/setType
//   → click 'Review report' → waitForReview → click 'Send report'
export async function completeComposer(page: Page, options?: { title?: string; note?: string; type?: 'bug' | 'feedback' }): Promise<void>
```
**Prerequisite (blocks every editor/composer row):** decide the DOM contract (`data-*` hooks / class names) *before* the first row is written — the open shadow root is the only query surface (research Wave-0 gap).

### `e2e/helpers/editor.ts` (new)
**Analog:** `probeWidget` (`capture-stubs.ts:543-585`) for reads + `readMaskRect` (`sdk.spec.ts:1487-1548`) for the "independent mapping" discipline. Exports `selectTool`, `dragOnBitmap(canvasRect, from, to)`, `undo`, `done`, and the canvas→viewport mapping. The mapping must be **written independently** and documented beside the SDK's `geometry.ts` usage — never imported from it (that independence is what keeps CA-02 non-vacuous).

### `e2e/helpers/host-fixtures.ts` (modify — **two known bugs**)
```ts
export type BundleName = 'watchbug.js' | 'watchbug.mjs' | 'watchbug.e2e.js' | 'watchbug.e2e.mjs';   // :47 — closed union
```
→ must accept the annotator chunk names (`.mjs` at minimum — that is what `import()` fetches — plus the `.js` twin if it stays emitted).

```ts
async function serveBundle(page: Page, bundle: BundleName): Promise<Buffer> {
  ...
  await page.route(BUNDLE_ROUTE, async (route) => {
    const requested = new URL(route.request().url()).pathname.split('/').pop();
    if (requested !== bundle) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'unknown fixture bundle' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: bundleBytes });
  });
  return bundleBytes;
}                                                                // :195-218
```
→ change the single-bundle comparison into a **set**: serve the requested core bundle *and its sibling chunk(s)* (`watchbug-annotator.mjs` / `.js`), keeping the 404 for genuinely unknown names (the guard must stay meaningful). Also note `bundlePath()` `:32-34` routes `watchbug.e2e*` to `dist/e2e/` and everything else to `dist/` — the annotator chunk lives in `dist/` (built by `build.mjs:50-54`, not the e2e block), so no path change is needed for it.

### `e2e/ingest.spec.ts` (add JPEG rows)
**Analog:** the WebP row (`:148-165`) — the whole shape is 18 lines and asserts status, MIME, and magic bytes:
```ts
test('webp fixture ingests and serves image/webp', async ({ request }) => {
  const idem = `e2e-webp-${randomUUID()}`;
  const created = await postIncident(request, { key: KEY, idempotencyKey: idem,
    meta: { ...META, title: 'WebP upload path' }, bytes: webp, filename: 'shot.webp', mime: 'image/webp' });
  expect(created.status).toBe(201);
  const image = await request.get(`/api/incidents/${created.body.id as string}/image`);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/webp');
  const bytes = Buffer.from(await image.body());
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
});
```
JPEG rows must additionally assert the **blob header set** (`content-type: image/jpeg`, `nosniff`, `attachment; filename="screenshot.jpeg"`) as the PNG row does (`:138-142`) — a 201-only assertion is exactly the hole that lets Pitfall 8 through.

### `e2e/make-fixtures.mjs` (+`valid-64x64.jpg`)
**Analog:** itself `:20-59` — a one-shot chromium script that draws a 64×64 two-tone canvas and writes the encoded bytes:
```js
const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
const buf = await blob.arrayBuffer();
let binary = '';
new Uint8Array(buf).forEach((b) => { binary += String.fromCharCode(b); });
return btoa(binary);
...
writeFileSync(join(outDir, 'valid-64x64.png'), Buffer.from(pngBase64, 'base64'));
writeFileSync(join(outDir, 'valid-64x64.webp'), Buffer.from(webpBase64, 'base64'));
```
Chromium's canvas will produce `image/jpeg` (`toBlob(cb, 'image/jpeg', 0.9)`) — no sharp needed here, and it keeps the script browser-only. It *is* worth asserting `blob.type === 'image/jpeg'` in the script (as the WebP branch already does at `:49`). An oversize (>16 MP) JPEG fixture also comes from this script or from a synthetic SOF header.

### `scripts/check-size.mjs` (gate the max of `.js`/`.mjs`)
**Analog:** itself:
```js
const LANES = [
  { name: 'core', file: 'watchbug.js', limitKb: 45 },
  { name: 'lazy', file: 'watchbug-annotator.js', limitKb: 25 },        // :31-35
  { name: 'adapter', file: 'watchbug-dom-serialize.js', limitKb: 14 },
];
...
const esmFile = lane.file.replace(/\.js$/, '.mjs');                    // :60-69 — printed, not gated
```
Change `lazy` to `Math.max(gzKb(.js), gzKb(.mjs))` against the 25 KB limit (research OQ-5): the loader fetches the `.mjs`, so that is the artifact users download; gating the max means neither twin can drift. Keep the runtime-total row (`:76-81`) and the A-12/M-2 honesty note (`:83-86`) untouched.

### `scripts/gate.mjs` (optional new rule — only if the plan wants a structural guard)
**Analog:** the `RULES` array itself (`:63-157`) — a rule is `{ id, title, ref, run() → pass|fail|skip }`, walked by `walk(dir)` over `packages/sdk/src` with `readLines`. A `sdk-no-html-sink` rule (`/innerHTML|insertAdjacentHTML|document\.write/`) and a `sdk-lazy-lane-purity` rule (no `strings.editor` / `annotator` identifiers in `watchbug.js`) would be the two cheap additions that make S-2 and the dictionary split mechanically true rather than review-enforced. **No behavioural change is needed for the existing three rules** — but `sdk-single-encode-sink`'s message and its `sinks === 0` skip branch (`:151-153`, "lands with the Annotator (Phase 3)") becomes stale and should be updated once `encodeFinal` exists.

### `e2e/sdk.spec.ts` (migrate ~30 rows — one dedicated plan task)
**Analog:** itself. The five families and their shared row bodies (research F4):
- `runRedactionRow` (`:1716-1759`) — `clickLauncher` → `waitForHeadline('Report sent ✓', 20_000)` becomes `clickLauncher` → `completeComposer` → `waitForHeadline`; **one edit each**, ~7 rows + `H-1`×4 via `runHidpiMaskRow` (`:2122-2157`).
- `P2-D-01` (auto-title) still passes *provided* the composer prefills `document.title` (code-point-clamped) and defaults `type: 'bug'`.
- Failure rows `P2-D-12` ×3 / `CAP-01 rejected prompt` / `OQ-1` / `fail-closed` move from the `status.*` failure panel to the **degraded composer** (`composer.image.none` + `status.*.hint`), and keep asserting `expectNoRequest` (`:743`) — nothing is posted until the user chooses.
- `F-08` (`:244-259`) becomes the locale row: `content.getAttribute('lang')` must equal the resolved locale, and `test.use({ locale: 'es-ES' })` is the natural twin.
- Do **not** interleave this migration with feature tasks — the RED/GREEN story is unreadable otherwise.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/sdk/src/annotator.ts` (canvas editor core) | component | event-driven | No canvas-editor or drawing-surface code exists anywhere in the repo (D-05 closed `fabric.js`/`konva`). Use research Pattern 2 + Code Examples. |
| `packages/sdk/src/annotator/canvas-layer.ts` | utility | event-driven | Pointer state machine / `setPointerCapture` discipline is new. Only the *geometry* has an analog. |
| `packages/sdk/src/annotator/tools.ts` | utility | transform | Stroke-record model + replay order is new (research: self-contained stroke records, Pitfall 10). |
| `packages/sdk/src/annotator/editor-dom.ts` (toolbar/dialog) | component | event-driven | No modal/alertdialog exists in the SDK. Reuse `launcher.ts` SVG + `status-panel.ts` button CSS, write the focus trap (~20 lines). |
| `packages/sdk/src/widget/loader.ts` (dynamic `import()`URL resolution) | utility | lazy load | No dynamic import or chunk loader exists (the lazy lane was a build-only stub). Only the *memoised-singleton* shape has an analog (`encode.ts:89-103`). |

---

## Metadata

**Analog search scope:** `packages/sdk/src/**`, `packages/sdk/scripts/**`, `packages/contracts/src/**`, `apps/api/src/**` + `apps/api/drizzle/**`, `apps/panel/src/**` (i18n only), `e2e/**`, `scripts/**`, `playwright.config.ts`, `apps/api/drizzle.config.ts`.
**Files read for excerpts:** 27 source/verification files (full or targeted non-overlapping ranges); every cited path verified `git ls-files`-tracked.
**Not consulted (no analog value):** `packages/sdk/src/redact/patterns.ts` (Phase 2 T1 catalog), `apps/api/src/ingest/caps.ts`, `apps/api/src/plugins/*`, `apps/api/src/storage/fs-storage.ts`, `e2e/hostile.spec.ts`, `e2e/read-surface.spec.ts`, `e2e/deploy.spec.ts`.
**Pattern extraction date:** 2026-10-28.

**Plan-level hazards this map surfaces:**
1. `apps/api/src/ingest/incidents.ts` does not exist — it is `apps/api/src/routes/incidents.ts`.
2. `incidents.ts:321` is a live latent bug: adding `'jpeg'` to the union without touching it stores JPEG bytes as `image/webp`, which the CHECK constraint accepts.
3. `host-fixtures.ts:195-218` 404s the annotator chunk — no editor row can pass until it serves a set.
4. `gate.mjs:134` counts the encode-API string **in comments** — the lazy lane must not even name it.
5. `check-size.mjs:31-35` gates the `.js` twin while the loader fetches the `.mjs`; gate the max or the shipped artifact is unbudgeted.
