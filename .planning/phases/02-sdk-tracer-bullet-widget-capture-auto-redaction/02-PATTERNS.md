# Phase 2: SDK Tracer Bullet: Widget, Capture & Auto-Redaction - Pattern Map

**Mapped:** 2026-10-17
**Files analyzed:** 18 new/modified (14 new, 4 modified)
**Analogs found:** 11 / 18 (exact 4 · role-match 2 · partial 5 · none 7)

**Tracked-source gate (#3645):** every analog path below was verified with `git ls-files` (14/14 tracked). No mirror paths emitted.

> **Reading note for the planner:** this is the first phase that writes browser-side DOM/canvas code in the repo, so the SDK's *widget/capture/redaction/image* modules have no same-role analog anywhere — their "patterns" are the locked RESEARCH Code Examples plus the **hard constraints encoded in `scripts/gate.mjs`** (which the executor WILL trip if ignored). Where the pattern source is research rather than code, the file is listed in **No Analog Found** and the fallback is cited explicitly. The e2e and build/script half of the phase, by contrast, has exact Phase-1 analogs.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/sdk/src/index.ts` (mod) | config/bootstrap (entry) | event-driven | `packages/sdk/src/index.ts` itself + `packages/sdk/scripts/build.mjs:47-50` | role-match |
| `packages/sdk/src/strings.ts` | utility (dictionary) | transform | `packages/contracts/src/constants.ts` (export style only) | partial-match |
| `packages/sdk/src/widget/host.ts` | component (custom element = `WidgetHost` adapter) | event-driven | — (first DOM module in repo) | none |
| `packages/sdk/src/widget/launcher.ts` | component | event-driven | — | none |
| `packages/sdk/src/widget/status-panel.ts` | component (state machine view) | event-driven | — | none |
| `packages/sdk/src/capture/capture-source.ts` | service (`CaptureSource` port + `DisplayMediaCapture` adapter) | streaming | `packages/sdk/src/capture/dom-serialize.ts` (the other `CaptureSource` adapter) | role-match |
| `packages/sdk/src/capture/pipeline.ts` | service (orchestrator) | transform | — (ordering contract: RESEARCH Code Example) | none |
| `packages/sdk/src/redact/redactor.ts` | service (`Redactor` port impl) | transform | — | none |
| `packages/sdk/src/redact/patterns.ts` | utility (pattern catalog + Luhn) | transform | — (gate-constrained; see Pitfall 1) | none |
| `packages/sdk/src/redact/geometry.ts` | utility (CSS-px → bitmap mapping) | transform | — | none |
| `packages/sdk/src/image/encode.ts` | utility/service (encode ladder) | transform | `e2e/make-fixtures.mjs:39-54` (`toBlob` + `blob.type` sniff precedent) | partial-match |
| `packages/sdk/src/transport/lane1.ts` | service (HTTP client) | request-response | `e2e/ingest.spec.ts:48-71` `postIncident` + `apps/api/src/routes/incidents.ts` (the contract it calls) | partial-match |
| `packages/sdk/scripts/build.mjs` (mod) | config (build script) | file-I/O | itself (`LANE_ENTRIES`/`FORMAT_ROLES`/`define`) | exact |
| `scripts/gate.mjs` (mod — Pitfall 1 exemption) | config (static gate) | file-I/O | itself (`RULES` array) | exact |
| `playwright.config.ts` (mod — OQ-2 comment correction only) | config | — | itself | exact |
| `e2e/sdk.spec.ts` (new CA-01…CA-05 rows) | test | request-response | `e2e/hostile.spec.ts` | exact |
| `e2e/fixtures/hostile-host.html` | test fixture | — | `e2e/ingest.spec.ts:287-290` (`page.route` fulfilment) | partial-match |
| `e2e` capture-stub + fixture-loader helpers (two-tier stub, forced-PNG `toBlob` stub) | test utility | transform | `e2e/make-fixtures.mjs` (`page.evaluate` + canvas) | partial-match |

---

## Pattern Assignments

### `packages/sdk/src/index.ts` (config/bootstrap, event-driven) — MODIFY

**Analog:** its own current content + `packages/sdk/scripts/build.mjs:47-50` (how the IIFE global is wired).

**Current module style + doc-comment convention to preserve** (lines 1-16, entire file):
```typescript
/**
 * Core lane (RNF-01 lane 1 — the injected `watchbug.js`, hard budget 45 KB gz).
 *
 * **Build/size shell only.** Widget behavior (capture, annotation host,
 * redaction, transport, `WidgetHost`) is Phase-2 scope; this lane exists now so
 * the size gate, the IIFE/ESM dual build and the `SHADOW_MODE` flag are real
 * from day one (A-12/M-2, INV-01/INV-02).
 *
 * The IIFE build exposes exactly one global — `window.Watchbug` (INV-02: no
 * prototype patching, no host styles, single entry point).
 */

/** Bundle identity, surfaced on the IIFE global for support/debug. */
export const WATCHBUG_VERSION = '0.1.0';

export default { WATCHBUG_VERSION };
```

**Global wiring it grows into** (`build.mjs:47-50` — the IIFE global *is* the module namespace, so `init()` must be a named export to appear on `window.Watchbug`):
```javascript
const FORMAT_ROLES = [
  { format: 'iife', ext: '.js', globalName: 'Watchbug' },
  { format: 'esm', ext: '.mjs' },
];
```

**Pattern to copy:** keep the file-top invariant-citing doc comment (rewrite the "Phase-2 scope" sentence — it is now this phase), export `init()` as a **named** export (INT-02 `window.Watchbug.init()`, INT-05 the same function via ESM), and keep the default export object as the global's shape. `init()` options validation is hand-rolled (RESEARCH: "init config is hand-rolled validated (Zod types-only)") — no Zod at runtime.

---

### `packages/sdk/scripts/build.mjs` (config, file-I/O) — MODIFY (`SHADOW_MODE` wiring, R-14)

**Analog:** itself. This is the exact code the change touches.

**`define` block to parameterize** (lines 28-39):
```javascript
const shared = {
  bundle: true,
  minify: true,
  metafile: true,
  target: ['es2020'],
  logLevel: 'warning',
  define: {
    // INV-01: production bundles use a closed shadow root. `define` values must
    // be valid JS expressions, hence the quotes.
    SHADOW_MODE: JSON.stringify('closed'),
  },
};
```

**Lane/format matrix that must stay intact** (lines 41-66):
```javascript
const LANE_ENTRIES = [
  { name: 'core', entry: 'src/index.ts', out: 'watchbug' },
  { name: 'lazy-editor', entry: 'src/annotator.ts', out: 'watchbug-annotator' },
  { name: 'optional-adapter', entry: 'src/capture/dom-serialize.ts', out: 'watchbug-dom-serialize' },
];
// ...
for (const lane of LANE_ENTRIES) {
  for (const role of FORMAT_ROLES) {
    const outfile = join(dist, `${lane.out}${role.ext}`);
    await build({ ...shared, entryPoints: [join(here, '..', lane.entry)], outfile,
      format: role.format, ...(role.globalName ? { globalName: role.globalName } : {}) });
```

**Pattern to copy:** add the `SHADOW_MODE` variant by parameterizing `shared.define.SHADOW_MODE` per build (e.g. a `--shadow=open` argv flag or an extra open-mode core build emitting `watchbug.e2e.js`), never by editing the lane matrix. **Constraint:** `check-size.mjs` gates `watchbug.js` by name (see below) — an open-mode artifact must get a distinct filename so it can never be the gated production bundle. The new SDK source files are picked up automatically (they import from `src/index.ts`; no `LANE_ENTRIES` change needed).

---

### `packages/sdk/src/strings.ts` (utility, transform) — NEW

**Analog:** export-shape only from `packages/contracts/src/constants.ts` (an `as const`-style frozen map with a doc comment citing the governing decision). No dictionary module exists yet.

**Style to copy from** (`constants.ts:55-63` — declarative, doc-commented, no imports):
```typescript
// --- Masking contract (R-13 / A-01 / SEC-02) -----------------------------
/**
 * Flat opaque fill (alpha 255) is the **only** automatic masking primitive.
 * ...
 */
export const MASK_ALPHA_OPAQUE = 255;
export const MASK_PIXELATION_MIN_BLOCK_PX = 8;
```

**Content contract:** RESEARCH Code Example (locked against `02-UI-SPEC.md` Copywriting Contract) — `strings` map `'launcher.label' | 'status.capturing' | … 'action.dismiss'`, `export type StringId = keyof typeof strings`, plus a `t()` that does `{placeholder}` replacement only. Phase 3 adds `stringsEs` + resolver with no core refactor — so no locale logic here (P2-D-04).

---

### `packages/sdk/src/widget/host.ts` (component, event-driven) — NEW — **architecture-loaded (H-2/H-3)**

**Analog:** none in repo (first DOM module). Pattern source: RESEARCH **Pattern 1** (empirically probed on all 3 engines) + `02-UI-SPEC.md` (authoritative). The only code-level analog is the `SHADOW_MODE` define (`build.mjs:34-38` above) and the file-header convention of `packages/sdk/src/capture/dom-serialize.ts:1-12`:
```typescript
/**
 * Optional capture-adapter lane (RNF-01 lane 3 — ≤ 14 KB gz, loaded on demand).
 *
 * **Build/size shell only.** D-08 closed DOM serialization (`html-to-image`,
 * SVG `foreignObject`) as the *primary* capture path ...
 */
```

**Core pattern to implement (RESEARCH Pattern 1, verbatim shape):**
```ts
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
// shadow <style>: ':host, .wrap { all: initial }' then re-declare (px-only)
```

**Must also carry (P2-D-05/06, UI-SPEC):** synchronous `hide()`/`restore()` (inline `display:none`), `isHidden()` assertion hook for the pipeline, MutationObserver re-append, module-scoped shadow-root registry for the `SHADOW_MODE=open` e2e build (Pitfall 10). **Anti-patterns:** `adoptedStyleSheets`, `rem`/`em`, `part`, `::theme`, any host-document stylesheet.

---

### `packages/sdk/src/widget/launcher.ts` + `packages/sdk/src/widget/status-panel.ts` (components, event-driven) — NEW

**Analog:** none. Pattern source: RESEARCH **Pattern 4** + `02-UI-SPEC.md` (authoritative — do not contradict). Key contract the planner must put in plan actions:

- Launcher: real `<button>` 48×48; the click handler **synchronously** hides the host and calls `getDisplayMedia` (Pitfall 5: any `await` before `getDisplayMedia` loses transient activation → `InvalidStateError`).
- Status panel state machine: `idle → capturing → sending → retrying (n of 3) → sent | failed{Capture,Blank,Network,Rejected}`; copy via `strings.ts` + `t()`; server reasons rendered with **`textContent`** truncated to 240 chars (UI-SPEC A-6) — **never `innerHTML`** (SEC-05, Pitfall 9); `Escape` listener document-level, removed on teardown (UI-SPEC A-7); manual "Try again" button only for transient exhaustion and contract 4xx (P2-D-03).

---

### `packages/sdk/src/capture/capture-source.ts` (service, streaming) — NEW

**Analog:** `packages/sdk/src/capture/dom-serialize.ts` (full file, 12 lines — quoted above) — the *other* `CaptureSource` adapter behind the same R-02 seam; its header documents the port's contract ("kept it as an optional `CaptureSource` adapter behind R-02's seam. The primary path stays `getDisplayMedia` + canvas"). **Match: role-match** — same port, different adapter, currently a stub.

**Contract to implement:** the port type `CaptureSource.capture()` returns **raw `ImageData`, never a Blob** (A-05 — this is structural, enforced by the type). `DisplayMediaCapture` = `getDisplayMedia({ video: true, preferCurrentTab: true })` → `<video>` → `drawImage` frame grab; `track.stop()` in `finally`; surface verification `track.getSettings().displaySurface === 'browser'` with loud failure otherwise (RESEARCH Pattern 3 / OQ-1). Firefox/Safari lack `preferCurrentTab` — users pick a tab manually; the surface check is what protects redaction validity (Pitfall 7).

---

### `packages/sdk/src/capture/pipeline.ts` (service, transform) — NEW

**Analog:** none. Ordering is the contract (RESEARCH Code Example, locked by P2-D-05/06/10/12 + A-05):
```ts
host.hideSync();                       // P2-D-05: inline display:none, BEFORE getDisplayMedia
let stream: MediaStream;
try {
  stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true });
} catch (err) { host.restore(); ui.fail('status.captureFailed'); return; }  // M-6 loud
try {
  const track = stream.getVideoTracks()[0];
  const frame = await grabFrame(video, track);          // loadedmetadata → play → drawImage
  if (!host.isHidden()) throw new Error('widget host not hidden at grab time');  // P2-D-06 invariant
  const { imageData, scale } = toClampedImageData(frame); // DPR clamp 2, ≤ MAX_IMAGE_PIXELS
  if (blankProbe(imageData)) { ui.fail('status.blankCapture'); return; }       // P2-D-12
  redactor.redact(imageData, collectMaskRects(document, scale));               // T1 destructive
  const blob = await encodeLadder(imageData);           // single toBlob sink (gate!)
  await transport.send(blob, buildMeta(), { idempotencyKey });                // lane 1
} catch (err) { ui.fail(mapFailure(err)); }
finally { track?.stop(); host.restore(); }
```
**Error handling pattern:** every failure path is a **loud terminal UI state** (M-6) — never a silently blank image, never "send unredacted" (Pitfall 7).

---

### `packages/sdk/src/redact/redactor.ts`, `patterns.ts`, `geometry.ts` (service/utility, transform) — NEW

**Analog:** none for code; the constant-consumption pattern is `packages/contracts/src/constants.ts:62` (`MASK_ALPHA_OPAQUE = 255`) — imported as a **value** from `@watchbug/contracts/constants` (see Shared Patterns: constants are Zod-free and inline into the bundle).

- `redactor.ts`: `Redactor` port impl (seam only, R-02; no host rules, P2-D-09) — DOM scan (input values + text nodes → bboxes) then destructive flat fill α=255 on the `ImageData`. R-13: flat opaque fill is the **only** automatic primitive — no blur, no CSS overlay, no semi-transparent fills.
- `patterns.ts`: P2-D-07 catalog — JWT shape (`eyJ…`), `Bearer <token>`, `key=/token=/secret=/password=` assignments, Luhn-validated card sequences (~15 lines hand-rolled; no dependency, PRF-04). **Gate-collision trap (Pitfall 1):** `scripts/gate.mjs:100-118` fails on any line containing `Bearer\s` etc. — write the pattern as `/Beare[r]\s+[A-Za-z0-9._-]+/`, word SEC-03 comments without literal tokens, or add the narrow enumerated exemption (see `gate.mjs` entry below).
- `geometry.ts`: H-1 mapping — `scale = canvas.width / window.innerWidth` (tab capture = viewport only), round **outward** (floor origin, ceil extent) in bitmap space (P2-D-08 over-masking is safe; Pitfall 6 misregistration leaks edge characters).

---

### `packages/sdk/src/image/encode.ts` (utility, transform) — NEW

**Analog (partial):** `e2e/make-fixtures.mjs:39-54` — the repo's only browser-canvas encode + sniff precedent:
```javascript
const webpBase64 = await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  // ...
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp'));
  if (blob.type !== 'image/webp') throw new Error(`expected image/webp, got ${blob.type}`);
  const buf = await blob.arrayBuffer();
```

**Hard constraint (Pitfall 8 / gate):** `scripts/gate.mjs:134-148` allows **one textual `toBlob|toDataURL|convertToBlob` occurrence** across all of `packages/sdk/src`:
```javascript
const SINK = /\b(?:toBlob|toDataURL|convertToBlob)\b/g;
// ...
if (sinks > 1) { /* FAIL: masked pixels must be re-baked as the LAST pixel operation before a single encode */ }
```
→ the ladder (q0.8 → 0.6 → 0.5 → downscale 0.75×, P2-D-10/11) must be a **loop around one call site** (RESEARCH Code Example `encode.ts`). M-3: sniff `blob.type` after encode (silent PNG fallback), cache the capability once at startup via a 1×1 probe. Targets: ≤ 800 KB output goal, `MAX_ENCODED_IMAGE_BYTES` (2 MB) hard — server keeps 413 as control.

---

### `packages/sdk/src/transport/lane1.ts` (service, request-response) — NEW

**Analog (partial — wire shape):** `e2e/ingest.spec.ts:48-71` `postIncident` — the exact multipart + header shape the client must produce:
```typescript
async function postIncident(
  request: import('@playwright/test').APIRequestContext,
  opts: { key: string; idempotencyKey: string | null; meta: unknown; bytes?: Buffer; filename?: string; mime?: string },
): Promise<PostResult> {
  const form = {
    meta: JSON.stringify(opts.meta),
    image: { name: opts.filename ?? 'shot.png', mimeType: opts.mime ?? 'image/png', buffer: opts.bytes ?? png },
  };
  const headers: Record<string, string> = { 'X-Project-Key': opts.key };
  if (opts.idempotencyKey !== null) headers['Idempotency-Key'] = opts.idempotencyKey;
  const res = await request.post('/api/incidents', { multipart: form, headers });
  return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
}
```

**Server contract it must conform to** (`apps/api/src/routes/incidents.ts`, integration target):
```typescript
const MAX_IDEMPOTENCY_KEY_CHARS = 256;                                    // :50
const CONTENT_TYPE_BY_EXT: Record<string, string> = { png: 'image/png', webp: 'image/webp' }; // :53
const raw = req.headers['x-project-key'];                                 // :128
const idempotencyKey = req.headers['idempotency-key'];                    // :146
return reply.code(201).send({ id: inserted[0].id });                      // :359
```
**Error-body shape to parse for the panel reason** (`:110-111` — the `reasonOf(res)` source):
```typescript
function badRequest(reply: FastifyReply, message: string): FastifyReply {
  return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message });
}
```

**Core pattern (RESEARCH Code Example, P2-D-03):** one `crypto.randomUUID()` idempotency key per report reused on every retry; `AbortSignal.timeout(15_000)` per attempt; transient (net/timeout/5xx/429) → 3 attempts, backoff 1/4/10 s ±25 %; contract 4xx (400/401/403/413) → immediate `failedRejected` with `message` rendered via `textContent`. **Never** `keepalive`/`sendBeacon` (H-9, 64 KiB cap). Gate trap: `credentials:` key is scanned (`gate.mjs:108`) — only `credentials: 'omit'` is legal; simplest is to omit the key entirely.

---

### `e2e/sdk.spec.ts` (test, request-response) — NEW rows in the ONE suite (R-12)

**Analog (exact):** `e2e/hostile.spec.ts` — same artifact-level style.

**Imports + header convention** (`hostile.spec.ts:1-6`, `36-37`):
```typescript
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
import { connect } from 'node:net';
import { resolve } from 'node:path';
// ...
 * R-12: assertions only, artifact level — status + structured body of the
 * real HTTP response against the running compose stack.
```

**Secret-free key sourcing — copy verbatim** (`hostile.spec.ts:55-66`; duplicated at `ingest.spec.ts:76-85`):
```typescript
function projectKey(): string {
  const envFile = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  const match = /^WATCHBUG_PROJECT_KEY=(.+)$/m.exec(envFile);
  if (!match) throw new Error('.env has no WATCHBUG_PROJECT_KEY — copy .env.example and run npm run key:gen');
  const key = match[1].trim();
  if (key === 'wkbt_00000000000000000000000000000000') {
    throw new Error('.env still holds the placeholder key — generate a real one with npm run key:gen');
  }
  return key;
}
```

**Assertion style — artifact level, one row per layer** (`hostile.spec.ts:18-22` doc + `ingest.spec.ts:232-263` panel row): assert the *real* HTTP response and the *stored/decoded* artifact, never mocks. For PRV-01/02/03 rows: intercept the outgoing request, decode the attached image bytes in-page (`page.evaluate` + `Image` + `getImageData` — see `e2e/make-fixtures.mjs:23-37` for the canvas/base64 round-trip, `ingest.spec.ts:262` for the `naturalWidth` poll), and assert the masked rect's original pixel values are absent. PRV-05 row: seed sentinel cookie/localStorage/`Authorization` values, scan intercepted request bytes + headers for them (plus `node scripts/gate.mjs sdk-no-host-storage`).

---

### `e2e/fixtures/hostile-host.html` + fixture loader + capture stubs (test fixture/utility) — NEW

**Analog (partial):** route fulfilment at the panel origin — `e2e/ingest.spec.ts:287-290`:
```typescript
test('P1-D-07: with an empty list the panel shows the onboarding curl ...', async ({ page }) => {
  await page.route(INCIDENTS_LIST_RE, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.goto('/');
```
and the shared-regex discipline (`ingest.spec.ts:24-33`): one shared `RegExp` constant — `page.unroute` removes a route by source+flags equality, so inline duplicates never unregister.

**Analog (partial):** in-page canvas evaluation — `e2e/make-fixtures.mjs:20-37` (`chromium.launch()` → `page.evaluate` → base64 round-trip → `writeFileSync`).

**Constraints to bake into the plans (Pitfalls 2/3/4):**
- Serve the hostile fixture via `page.route` fulfilment at `http://127.0.0.1:8080/...` (same-origin with `/api`) — **not** from the panel nginx root: `apps/panel/nginx.conf:51` CSP (`default-src 'self'`) neuters inline `<style>`/`<script>` and CA-04 would pass vacuously. Assert in-test that the hostile rule actually applies (e.g. a control element is hidden).
- Two-tier capture stub: chromium+firefox fake `navigator.mediaDevices.getDisplayMedia` returning `canvas.captureStream()`; webkit (no `mediaDevices`, no `captureStream` here) stubs at the `CaptureSource`/`ImageData` seam so probe → redact → encode → transport still runs real.
- M-3 row: force-PNG `toBlob` stub returning PNG-typed bytes; assert the `blob.type` sniff routes to the PNG path and the server accepts (`CONTENT_TYPE_BY_EXT` accepts both). Do **not** write a webkit-row expecting natural PNG fallback (Pitfall 3 — empirically false here).
- Isolation assertions (WDG-02/03/05, CA-04) run against the **closed** production bundle; content/state assertions use the `SHADOW_MODE=open` registry build (Pitfall 10).

---

### `scripts/gate.mjs` (config, file-I/O) — MODIFY if needed (Pitfall 1)

**Analog:** itself — extend `RULES`, never duplicate gates elsewhere (its header: *"Boundary (R-18 reuse-first — do not re-implement what already exists)"*). Rule shape (`gate.mjs:92-124`, `sdk-no-host-storage`):
```javascript
{
  id: 'sdk-no-host-storage',
  title: 'packages/sdk never reads host storage, cookies or credentials',
  ref: 'SEC-03 · C-5 (RSK-19 static grep gate)',
  run() {
    const files = walk(join(repoRoot, 'packages', 'sdk', 'src'));
    const FORBIDDEN = [
      ['document.cookie', /document\.cookie/],
      ['localStorage', /\blocalStorage\b/],
      ['sessionStorage', /\bsessionStorage\b/],
      ['Authorization header', /\bAuthorization\b/],
      ['Bearer token', /Bearer\s/],
    ];
    // `credentials: 'omit'` is the *safe* value and is the only legal form.
    const CREDENTIALS = /credentials\s*:\s*['"]?([A-Za-z]+)/;
```
If the redaction catalog cannot avoid the tokens: add a **narrow, enumerated** file exemption (only `src/redact/patterns.ts`, never `document.cookie`/storage) with a comment explaining the inverse purpose (masking, not reading). Rules report `skip` for missing subjects and `STRICT` flips at Phase 7 — keep new rules in that shape.

---

## Shared Patterns

### 1. Contracts import discipline (R-15/R-18 — Zod never ships)
**Source:** `packages/contracts/package.json` exports + `packages/contracts/src/types.ts:1-9`
**Apply to:** every new `packages/sdk/src/**` file needing caps or report types
```typescript
import type { z } from 'zod';                       // types.ts — erased at compile
import type { reportSchema } from './schema.ts';
export type ReportMeta = z.infer<typeof reportSchema>;
```
- **Types:** `import type { ReportMeta } from '@watchbug/contracts/types'` (erased).
- **Constants:** value imports are SAFE and get inlined by esbuild — `import { MAX_TITLE_CHARS, MAX_IMAGE_PIXELS, MAX_ENCODED_IMAGE_BYTES, MASK_ALPHA_OPAQUE } from '@watchbug/contracts/constants';` (`constants.ts` has zero Zod import by design; subpath exports `./constants|./schema|./types` exist). Precedent for subpath import: `e2e/ingest.spec.ts:7` `import { reportSchema } from '@watchbug/contracts/schema';`.
- **Never** restate a cap locally (`Don't Hand-Roll`, R-18) — except the e2e mirror style of `hostile.spec.ts:47-50` which mirrors with a comment, acceptable only in tests.

### 2. File-top doc comment citing governing invariants
**Source:** `packages/sdk/src/index.ts:1-11`, `packages/sdk/src/capture/dom-serialize.ts:1-9`, `scripts/gate.mjs:2-24`
**Apply to:** every new source file. Cite the invariant IDs (R-xx/INV-xx/SEC-xx/P2-D-xx) the file enforces. **Pitfall 1 caveat:** never write literal `document.cookie` / `localStorage` / `Bearer ` tokens in comments.

### 3. Static-gate compliance for all SDK source (R-12/RSK-19)
**Source:** `scripts/gate.mjs:92-156`
**Apply to:** every file under `packages/sdk/src/`
- `sdk-no-host-storage` (line-based, comment-blind): no `document.cookie`, `localStorage`, `sessionStorage`, `Authorization`, `Bearer\s`; `credentials:` only `'omit'` or absent.
- `sdk-single-encode-sink`: **exactly one** textual `toBlob|toDataURL|convertToBlob` in all of `packages/sdk/src` — the ladder loops around it.
- `sdk-runtime-deps`: `packages/sdk` may declare only `@watchbug/contracts` as runtime dep (already true).

### 4. Structured server error bodies → panel reason
**Source:** `apps/api/src/routes/incidents.ts:110-111` (and `:101-102`, `:441-442`, `:470-471`)
**Apply to:** `transport/lane1.ts` `reasonOf()` and `status-panel.ts` rendering
```typescript
{ statusCode: 400, error: 'Bad Request', message: '...' }   // message is the user-facing reason
```
Render `message` via `textContent`, truncate 240 chars (UI-SPEC A-6). Never `innerHTML` (SEC-05).

### 5. e2e suite conventions (R-12 — the ONE suite)
**Source:** `e2e/hostile.spec.ts:1-136`, `e2e/ingest.spec.ts:24-33`, `playwright.config.ts:15-28`, `e2e/global-setup.ts`
**Apply to:** `e2e/sdk.spec.ts` + helpers
- Extend `e2e/` specs; do not add a new test artifact type. Three projects (chromium/firefox/webkit), `workers: 1`, `globalSetup` health-gates the compose stack.
- Row titles name the requirement ID (`'ING-03: …'`, `'C-4: …'`) — new rows follow: `'CA-01: …'`, `'PRV-02: …'`.
- One shared `RegExp` per intercepted route; `projectKey()` from `.env` (excerpt above); hand-built multipart only when the wire bytes themselves are under test (else Playwright `multipart:` per `ingest.spec.ts:59-69`).
- Per-task sampling: `npx playwright test e2e/sdk.spec.ts --project=chromium` + `npm run check:size`; per-wave: `npm run verify` + `node scripts/gate.mjs`.

### 6. esbuild `define` values are JS expressions
**Source:** `packages/sdk/scripts/build.mjs:34-38`
**Apply to:** the `SHADOW_MODE` wiring change — `JSON.stringify('closed')` style, and any future build flags. Open-mode artifacts get distinct filenames so `check-size.mjs` (`scripts/check-size.mjs:31-35`, gates `watchbug.js`/`watchbug-annotator.js`/`watchbug-dom-serialize.js` by name) can never gate an e2e bundle.

---

## No Analog Found

First-of-kind browser modules — planner should build from RESEARCH Code Examples + `02-UI-SPEC.md` (authoritative for UI), with the gate constraints above as hard limits:

| File | Role | Data Flow | Reason | Pattern source instead |
|------|------|-----------|--------|------------------------|
| `packages/sdk/src/widget/host.ts` | component | event-driven | No DOM/Shadow DOM code exists in the repo | RESEARCH Pattern 1 + `02-UI-SPEC.md` (probed on 3 engines) |
| `packages/sdk/src/widget/launcher.ts` | component | event-driven | No UI components exist | RESEARCH Pattern 4 + UI-SPEC (48×48 `<button>`, synchronous gesture handler — Pitfall 5) |
| `packages/sdk/src/widget/status-panel.ts` | component | event-driven | No state-machine views exist | RESEARCH Pattern 4 + UI-SPEC (states, copy, `textContent` only, A-6/A-7) |
| `packages/sdk/src/capture/pipeline.ts` | service | transform | No pipeline/orchestration code exists | RESEARCH Code Example (ordering = the contract) + P2-D-05/06/12 |
| `packages/sdk/src/redact/redactor.ts` | service | transform | No canvas/ImageData code exists | RESEARCH Pattern 2 + `constants.ts:62` (`MASK_ALPHA_OPAQUE`) |
| `packages/sdk/src/redact/patterns.ts` | utility | transform | No regex-catalog code exists | RESEARCH P2-D-07 catalog + hand-rolled Luhn; Pitfall 1 gate wording |
| `packages/sdk/src/redact/geometry.ts` | utility | transform | No geometry code exists | RESEARCH H-1 mapping (Pitfall 6) + P2-D-08 outward rounding |

---

## Metadata

**Analog search scope:** `packages/sdk/src/**`, `packages/sdk/scripts/**`, `packages/contracts/src/**`, `apps/api/src/routes/**`, `e2e/**`, `scripts/**`, `playwright.config.ts`
**Files scanned:** 14 tracked analog files read/grepped (all verified `git ls-files`); `02-CONTEXT.md`, `02-RESEARCH.md` read in full
**Codebase state:** greenfield client — Phase 1 delivered contracts, ingest, panel, build/gates, e2e; no SDK runtime modules exist yet beyond lane stubs
**Pattern extraction date:** 2026-10-17
