# Architecture Research: Watchbug SDK

**Dimension:** Architecture (component boundaries, data flow, build order)
**Researched:** 2026-10-05
**Overall confidence:** MEDIUM-HIGH (structure = reasoning on decided constraints; hazard/precedent claims = cross-checked web sources)
**Mandate:** Validate and refine R-02's 8-port pragmatic hexagonal + R-15 monorepo. Not a redesign.

**Claim labelling:** *(src: …)* = backed by real-world precedent/spec, listed in Sources & Confidence. *(reasoning)* = derived from the project's own constraints (INV/SEC/R-xx) or general engineering reasoning. Confidence tiers per the classify-confidence seam: cross-checked web = MEDIUM; single-source = LOW and labelled as such.

---

## Summary

**R-02's 8-port set is correct as specified.** All eight map to a genuine variation axis (a future second adapter is plausible for every one, and two — `WidgetHost` and `CaptureSource` — already have ≥2 real implementations in the build: open/closed shadow for e2e vs production, and a display-capture/DOM-serialize/manual-upload capture chain). No 9th port is warranted: `Clock` and `Logger` are exactly the "interface ceremony" R-02 warns against — each has one real implementation and zero adapter families (verdict and rebuttals in *Port Interfaces*). One structural refinement: the 8 ports do not all live in one process — **6 are client-side (`CaptureSource`, `Redactor`, `Enricher`, `Annotator`, `Transport`, `WidgetHost`) and 2 are server-side (`Storage`, `AuthProvider`)**. `packages/contracts` is the data seam between the two worlds; it holds *data shapes only, no ports*.

**The safety-critical finding is the redaction-ordering answer (Q-04).** The "annotation leaks the pixels under a mask" bug class is real and well-attested in PDF and image-editor redaction failures *(src: PDF-redaction failure articles; image-redaction articles)*: anything that treats a mask as a *shape/layer above* content — instead of destructive pixel destruction baked **last** — leaks by deleting, moving, re-ordering, or erasing the overlay. Correct ordering: auto-redact (SEC-01) runs on `ImageData` immediately after capture, **before the editor ever displays the image**; user mask strokes bake destructively at stroke completion; at export, annotations flatten first and **all masks are re-baked on top as the final pixel operation**, then a fresh `toBlob` encode. With that order, an annotation stroke physically cannot leak masked pixels — the source pixels no longer exist in the working bitmap where masks were applied, and masks win any overlap with annotation ink.

**The hardest transport constraint found:** a screenshot report **cannot** ride `keepalive`/`sendBeacon` at page unload — both are capped at 64 KiB *(src: WHATWG Fetch Standard keepalive limit; MDN sendBeacon; w3c/beacon#38)*, while a WebP capture is 60–150 KB (R-11's own figures). The `Transport` default adapter must therefore be: plain `fetch` while the page is alive (idempotent, retried with backoff) + an IndexedDB pending queue flushed on next `pageshow`. This refines R-02's "`fetch` + `keepalive`" adapter note without contradicting it.

**Build order:** contracts → ingest slice → minimal SDK tracer bullet. The **earliest end-to-end vertical slice (real gesture → report rendered in panel) lands at the end of the proposed Phase 3**; a synthetic-payload version of the same path is demonstrable at end of Phase 2. Two decisions are "architecture-loaded" and must be right early — the `WidgetHost` host-element strategy (isolating later is a rewrite) and the redaction ordering (leaks are unrecoverable once shipped). Everything else is additive and can be built in any dependency-respecting order.

---

## Component Map

| Component | Responsibility | Talks to | Direction | Trust boundary |
|---|---|---|---|---|
| **Loader snippet** (host-added `<script async>`) | Fetches core, calls `Watchbug.init({ projectKey })`. Key passes via init/data-attr, **never in a URL** (query strings leak into logs/referrers — same reasoning as R-08) *(reasoning)* | SDK core | host → SDK | **TB-1: hostile host page** — everything from the host (config, `user`, custom rules, DOM, its CSS/JS) is untrusted input |
| **SDK core** (`packages/sdk`, ≤45 KB) | Bootstrap, `window.Watchbug`, widget launcher, capture chain, auto-redaction, mask primitives, enrichers (console ring buffer, env metadata), encoder, transport client, retry queue | `CaptureSource`, `Redactor`, `Enricher`, `Transport`, `WidgetHost` ports | core → ports (inward); adapters → ports | TB-1 (runs inside hostile page); sees host DOM for SEC-01 geometry only |
| **Editor chunk** (`Annotator` adapter, lazy ≤25 KB) | Report form (bug/feedback), annotation tools (pencil/arrow/text/mask), flatten + re-bake export | `Annotator` port; loaded via dynamic import from core | core ⇢ chunk (lazy, gesture-triggered) | TB-1; holds raw captured pixels in memory until send |
| **`packages/contracts`** | Single official schema (Zod) + TS types + JSON Schema emit (CA-01). **Types only for the SDK (erased at build); Zod at API edge; inferred types in panel** *(reasoning: Zod runtime in the client would eat ~10+ KB of the 45 KB budget)* | imported by sdk, api, panel | all → contracts (leaf) | n/a (data shapes only) |
| **Ingest edge** (`apps/api`, `POST /api/incidents`) | Multipart receive, rate limit per IP+key (SEC-05), CORS allowlist, body/field caps, Zod validate, text sanitization pass 1 | contracts, `Storage`, DB | edge → core → ports | **TB-2: public internet → API** — write-only `project_key` is the only credential here; the payload is hostile by definition |
| **Panel API** (`apps/api`, `/api/admin/*`) | Auth (login, JWT cookie), incidents CRUD, state transitions, filters, identity erase/delete (R-10), retention purge job, **blob streaming route** | `AuthProvider`, `Storage`, DB | edge → core → ports | **TB-3: admin browser → API** — JWT in HttpOnly/SameSite=Lax/Secure cookie (SEC-06); CSRF: cookie-auth'd mutations verify `Origin` *(reasoning)* |
| **Storage volume** (`Storage` adapter) | Screenshot blobs, filesystem volume. Mounted **only in the `api` container** — never in the panel's static server (R-04 hard requirement) *(reasoning)* | `Storage` port only | api → volume | **TB-4: API → filesystem** — no request input may reach the path builder |
| **PostgreSQL** (`db`) | `projects`, `incidents` (FK project), identity fields kept column-separable for R-10 purge | api only | api → db | internal, compose network |
| **Panel SPA** (`apps/panel`, React+Vite) | Login, project selector (R-06), list/filter by bug/feedback, state change (Pending/In Progress/Resolved), metadata + screenshot inspection, delete/erase, i18n en/es | panel API (authed fetch), blob route | panel → api | **TB-5: stored-XSS boundary** — user text is sanitized at ingest (pass 1) *and* rendered as text/escaped at render (pass 2) (SEC-05) |
| **Compose** (`docker-compose.yml`) | Exactly 3 services: `api`, `panel` (static), `db` + named volume (INV-03) | — | — | provider-agnostic |

Trust boundary summary: **TB-1 (host page ↔ SDK)** is the only boundary where the *attacker is the embedding page itself*; the SDK's answer is containment (closed shadow root, one global, no host-credential reads, redaction before egress). **TB-2** is unauthenticated-by-design (public write-only key) and must be rate-limited and capped. **TB-5** is the stored-XSS boundary and gets a double control (sanitize on write, escape on render) because either one alone has a known bypass class *(src: OWASP CSP/XSS cheat-sheet reasoning)*.

---

## Port Interfaces

**Dependency direction (all 8):** *adapters depend on the port; the application core depends on the port; exactly one composition root per process wires them* (client: `bootstrap.ts`; server: `app.ts`). The core never imports an adapter. `packages/contracts` is a leaf imported by everything but imports nothing. All port files are `interface` + `type` only — **type-only imports erase at build, so ports cost 0 client bytes** *(reasoning)*.

Byte-cheap conventions: no classes, no `abstract`, no generics where a concrete type fits; in-place mutation (`void`) where destruction is the point — the signature itself encodes SEC-02.

### Client-side ports — `packages/sdk/src/ports.ts`

```ts
// ── CaptureSource ── produces raw pixels of current app state.
// Return type is ImageData ON PURPOSE: an adapter returning an encoded Blob
// would let unmasked bytes exist before Redactor runs (SEC-02). Structural enforcement.
export interface CaptureSource {
  readonly id: 'display-media' | 'dom-serialize' | 'manual-upload';
  capture(): Promise<ImageData>;
}

// ── Redactor ── destructive pixel rules. Runs IN PLACE (the name of the game).
// Used twice: auto rules at capture (SEC-01) and mask re-bake at export (Q-04).
export interface Redactor {
  readonly id: string;
  apply(img: ImageData, masks: readonly Mask[]): void;
}
export type Mask =
  | { k: 0; x: number; y: number; w: number; h: number }              // solid fill, α=255 (R-13)
  | { k: 1; x: number; y: number; w: number; h: number; b: 8 | 16 };   // block pixelation, b≥8, grid-aligned (R-13)

// ── Enricher ── extra context providers. Hosts may register more (R-02).
// Default adapters: console ring buffer (RF-01), environment (url path-only per R-08),
// viewport/UA/language, identity (host-supplied `user`, R-09).
export interface Enricher {
  readonly id: string;
  collect(): Record<string, unknown>;   // shallow-merged into `context`; must be sync + cheap
}

// ── Annotator ── the lazy editor (R-01). Owns its canvas while open.
// Returns the FINAL ImageData (annotations flattened, masks re-baked LAST — see Q-04)
// AND the mask list so the pipeline can re-bake defensively at encode time.
export interface Annotator {
  open(base: ImageData): Promise<{ img: ImageData; masks: readonly Mask[]; note?: string }>;
}

// ── Transport ── the only thing allowed to leave the browser (SEC-03).
// `retry: true` marks transient failures (network/429/5xx) for the IndexedDB queue.
export interface Transport {
  send(r: Report): Promise<{ ok: true; id: string } | { ok: false; retry: boolean }>;
}

// ── WidgetHost ── rendering surface (INV-01/R-14). Two real adapters ship:
// closed shadow root (production) and open (SHADOW_MODE=e2e build) — that duality
// is what earns this seam port status despite "one" visual design.
export interface WidgetHost {
  mount(parent: HTMLElement): HostHandle;
  unmount(): void;
}
export type HostHandle = { el: HTMLElement; root: ShadowRoot | null };
```

### Server-side ports — `apps/api/src/ports.ts`

```ts
// ── Storage ── R-04 filesystem by default; S3/MinIO reserved. Keys are
// SERVER-generated (see Storage Layout) — a put() taking a client-supplied
// name would be the path-traversal hole R-04 forbids, so it can't be expressed.
export interface Storage {
  put(bytes: Uint8Array, ext: 'webp' | 'png'): Promise<{ key: string }>;
  stream(key: string): ReadableStream;   // validated: /^[a-z0-9]{2}\/[a-f0-9-]{36}\.(webp|png)$/
  delete(key: string): Promise<void>;
}

// ── AuthProvider ── R-05 single admin (.env, Argon2id, JWT cookie) by default;
// static bearer for CI/automation reserved. Cookie mechanics stay in the route
// layer; the port is credential checking only.
export interface AuthProvider {
  verify(user: string, pass: string): Promise<boolean>;   // Argon2id (SEC-06)
  issue(): string;                                        // JWT with TTL
  check(token: string): { sub: string } | null;
}
```

`Report` (the `Transport` payload) is `packages/contracts`' exported type — not duplicated here.

### Verdict on the proposed 9th port — **NO. 8 stays 8**

| Candidate | Verdict | Why |
|---|---|---|
| `Clock` | **Reject — ceremony** | One real implementation (the system clock). Zero adapter family. Determinism is moot under R-12 (no unit tests; e2e uses real time). If the R-10 retention job ever needs injectable time, pass `now: () => number` as a plain constructor parameter — a function value, not a port with a home, an interface file and a composition-root entry *(reasoning)*. |
| `Logger` | **Reject — ceremony** | A `console`-guarded wrapper module, plain, no seam. **Trap to avoid:** the console-capture ring buffer that fills `consoleLogs` in the payload is *report data*, not logging — and it is already covered by `Enricher`. Do not double-port it *(reasoning)*. |
| `IdGenerator` | Reject | `crypto.randomUUID()` is a one-liner, stdlib *(reasoning)*. |
| `RateLimiter` / `Validator` | Reject | HTTP-edge concerns, not domain seams. R-15 already settles this: *"Fastify's plugin ecosystem is itself the 'plugs' mechanism … at the HTTP edge, complementing R-02's ports in the domain core."* |
| `WidgetHost` — keep? | **Keep (confirm)** | Looks like single-adapter ceremony but isn't: R-14 ships *two* implementations (closed prod / open e2e build), and it is the single place INV-01/CA-04 is enforced. It is also the most likely future variation point (iframe host) — reserved seam, no adapter *(src: embeddable-widget isolation articles for the iframe-vs-shadow tradeoff)*. |
| `CaptureSource` — keep? | **Keep (stronger than assumed)** | Q-06 research shows ≥3 real adapters are needed in v1 itself: `getDisplayMedia` is blocked in cross-origin iframes without `allow="display-capture"` *(src: MDN Permissions-Policy display-capture; W3C screen-capture; HubSpot/Monday/Forge issue reports)* and is absent on mobile browsers *(src: cobaltcapture support matrix, LOW-tier single source — verify during Phase 7)*. |

**Validation verdict:** the 8 seams each have a plausible second adapter or a mandated dual implementation; no seam is speculative beyond R-02's own "reserved" intent; two non-ports (`Clock`, `Logger`) examined and correctly excluded. R-02 is confirmed as decided, with the client/server split refinement above.

---

## End-to-End Data Flow

Ordered trace of one bug report: gesture → capture → redact → annotate → re-redact → encode → transport → validate → store → render. Security control at each step in **bold**.

0. **Integration.** Host adds `<script async src="…/w.js"></script>` + `Watchbug.init({ projectKey, user?, privacy? })`. **Only the write-only public `project_key` enters the browser (SEC-04); the key travels via init/data-attribute, never a URL query string** *(reasoning, same leak class as R-08)*.
1. **Load & mount.** Core parses config (untrusted — schema-validated defensively), mounts the launcher through `WidgetHost` (closed shadow root). **No host cookies/storage/auth headers are ever read (SEC-03); exactly one global `window.Watchbug` (INV-02); zero stylesheet injection into host `head`/`body` (INV-01).**
2. **Gesture.** User clicks the launcher. In parallel: request capture (`CaptureSource` chain) and `import()` the dialog/editor chunk. **Capture happens only on explicit user gesture** (privacy posture; also required for `getDisplayMedia`'s prompt) *(src: MDN getDisplayMedia)*.
3. **Capture.** `getDisplayMedia({ preferCurrentTab: true })` → draw one frame to canvas → `getImageData()` → **stop all media tracks immediately** (kill the capture indicator) *(reasoning)*. DOM-serialize and manual-upload adapters fill the same `capture(): Promise<ImageData>` contract on fallback. **Raw pixels only — no encode has happened yet (SEC-02 structural guarantee via the port's return type).**
4. **Auto-redact (SEC-01).** `Redactor.apply(img, autoMasks)` in place, where `autoMasks` geometry comes from a plain module querying the host DOM at gesture time: `input[type=password]`, `[data-watchbug-sensitive]`, credential/token/card value patterns (R-08's URL stripping happens at enrich time). **Sensitive regions are destroyed before the user ever sees the image — the editor never renders them.**
5. **Annotate.** Editor opens over the already-redacted `ImageData`. Pencil/arrow/text live on an overlay canvas (editable); the mask tool bakes destructively on stroke completion. **Mask primitive: solid fill α=255 or grid-aligned block pixelation ≥8 px (R-13). No CSS overlays, no blur (SEC-02, D-06).**
6. **Re-redact (export flatten).** `annotate → flatten overlay onto working ImageData → re-bake ALL masks on top (last pixel operation) → re-run auto rules (idempotent) `. **This ordering is the leak-prevention invariant — see the dedicated section below.** Result: annotation ink inside a masked region is destroyed (privacy wins over ink, per Core Value clause 2) and source pixels under masks are unrecoverable.
7. **Encode.** Fresh `canvas.toBlob('image/webp', 0.8)` with PNG fallback (R-11). **Fresh encode = no EXIF/tEXt metadata carried over** *(src: image-redaction articles on freshly-encoded output)*; masking happened before encode as CA-02 requires.
8. **Transport.** `FormData { meta: JSON, image: Blob }` via `fetch` with `credentials: 'omit'`, `Idempotency-Key: <crypto.randomUUID()>`, `X-Project-Key: <public key>`. **SEC-03: no host credentials ride along; `meta.context.url` is scheme+origin+path only (R-08); `user` rides only if `privacy.userIdentity !== false` (R-09).** On failure: bounded retry with exponential backoff+jitter on network/429/5xx honoring `Retry-After`; if the page is dying, the payload goes to an **IndexedDB queue flushed on next `pageshow`** — `keepalive`/`sendBeacon` cannot carry a screenshot (64 KiB cap, see *Ingestion API Edge Concerns*) *(src: WHATWG Fetch Standard; MDN sendBeacon)*.
9. **API edge validate.** Order: rate limit (per IP **and** per project key — SEC-05) → CORS allowlist check → body/field caps (`bodyLimit`, multipart limits → 413) → Zod parse against `packages/contracts` (CA-01: `consoleLogs` required for bug, optional for feedback — RF-02) → project-key lookup (write-only: can insert, cannot read — the read APIs demand the admin JWT) → **401/413/429/400 with structured errors**.
10. **Sanitize + store.** Text fields (title, note, console messages) sanitized against stored XSS **on write** (SEC-05 pass 1). `Storage.put()` with server-generated key → `incidents` row (FK project) with identity fields in dedicated columns (R-10 purge targets). **Idempotency: unique `(project_id, idempotency_key)` — duplicates replay the stored response** *(src: idempotency-key guides)*. Response `201 { id }`.
11. **Render in panel.** Admin logs in: **Argon2id verify → JWT with TTL in `HttpOnly`/`SameSite=Lax`/`Secure` cookie (SEC-06)**; cookie-auth'd mutations re-verify `Origin` *(reasoning — CSRF defense-in-depth beyond SameSite)*. List/filter (bug/feedback), state transition (Pending/In Progress/Resolved). Detail view: metadata rendered as escaped text — **never `innerHTML` on user data (SEC-05 pass 2)** — and the screenshot streamed from `GET /api/admin/incidents/:id/image`, **authed (CA-05), `nosniff`, `Content-Security-Policy: default-src 'none'`, content-type from a server-side allowlist** (see *Storage Layout & Blob Serving*).
12. **Retention.** Scheduled job purges `user.*` after N days (R-10, default 30, `.env`-configurable); admin can delete a report entirely or erase identity immediately. **Storage.delete follows the same DB-lookup-only key resolution as serving.**

---

## Redaction Ordering & Masking Primitive

*(Q-04 — safety-critical)*

**Question:** where must the redaction pass run relative to annotation, and can an annotation stroke leak the pixels underneath after the region is masked?

**Answer 1 — ordering.** Redaction runs **three times, at three points**:

| Point | What runs | Why |
|---|---|---|
| **T1 — at capture, before display** | SEC-01 auto rules (destructive, in place) | Sensitive pixels are never rendered in the editor, never held longer than needed, and cannot ride any later code path by accident |
| **T2 — at mask-stroke completion** | The user's mask stroke, baked destructively into the working `ImageData` the moment it is drawn | The masked pixels cease to exist immediately; there is no "mask layer" that could later be reordered, moved, or deleted |
| **T3 — at export, LAST** | Flatten annotation overlay → **re-bake every mask on top** → re-run auto rules → encode | The final pixel operation on every masked region is the mask itself. Nothing — annotation ink, eraser artifacts, overlay artifacts — can sit above it or survive under it |

**Answer 2 — yes, the leak class is real**, and it is one of the most documented failure classes in the redaction literature *(src: PDF-redaction failure articles; image-redaction articles; eDiscovery flatten guidance)*:

- **Layer/overlay redaction.** The canonical failure: draw a black rectangle *over* content. In PDFs this is an annotation; in image editors a layer. The content survives underneath and leaks the moment someone deletes, moves, or reorders the overlay layer. Recurring news-grade incidents (government filings, court exhibits) are exactly this *(src: redaction-failure articles — MEDIUM, multiple independent)*. **Our analogue would be a mask kept as a canvas shape in a command list, flattened at export with a computed z-order.** Any bug in that z-order, any "move the mask" or "delete the mask" feature, or an export path that re-renders from the pristine source + commands, leaks.
- **The eraser variant.** If annotation/mask ink lives on a transparent overlay and the eraser clears pixels to transparent, then an export that composites the overlay over the *original* bitmap re-exposes the original pixels wherever the user erased a mask. Under T2/T3 this variant is impossible: the working bitmap is already destroyed under the mask, and the mask re-bake at T3 runs after the flatten.
- **The under-ink variant (the literal question).** An annotation stroke placed *before* a mask, if masks were non-destructive filters sampled from the source at export: the stroke's ink is composited into the pixelation/fill sample and can partially survive or modulate the mask. With T2/T3 ordering, an annotation stroke *cannot* leak underlying pixels: where a mask was applied, the underlying pixels were replaced in the working bitmap at T2, and at T3 the mask replaces whatever the flatten put there (including annotation ink). The only thing a stroke can "leak" is its own ink, which is user-authored content.
- **The alpha variant.** A mask filled with `rgba(0,0,0,0.5)` (or any α<255, or `filter: blur()`/`ctx.filter`) leaves the underlying pixels partially recoverable — Gaussian blur is even *invertible* (D-06). Hence R-13's primitives only.
- **Metadata variant.** A "redacted" export that reuses an original file container can carry EXIF/text chunks with the very data being masked *(src: image-redaction articles)*. Hence a fresh `toBlob` encode at T3 — nothing to carry over.

**The correct masking primitive** (R-13, sharpened):

1. **Solid fill:** `fillRect` with α=255 over the region — absolutely irreversible. Default.
2. **Block pixelation:** block-averaged `putImageData` of downsampled region blocks, **block size ≥ 8 px, snapped to a fixed grid** (e.g. `x & ~7`). Grid snapping makes re-bake at T3 **idempotent** — pixelating an already-pixelated region on the grid is a no-op, so T3's re-bake cannot degrade the image or re-average annotation ink into view *(reasoning)*.
3. **Not permitted:** gaussian blur (D-06, partially invertible by deconvolution), CSS/`ctx.filter` overlays (SEC-02), semi-transparent fills, "mosaic" with blocks < 8 px (average of 1–4 px blocks preserves glyph shapes), any layer-model mask.

**Verification hook (R-12/CA-02's rewritten method):** the e2e intercepts the outgoing HTTP request, decodes the attached image, and asserts the original pixel values of the masked region are **absent from the encoded bytes** — which T1–T3 make true by construction.

---

## Client Module Split (core 45 KB vs lazy 25 KB)

*(Q-03. Sizes are engineering estimates — `(reasoning)` — to be pinned by `npm run check:size` from Phase 3 on.)*

**Split principle:** everything needed for *instant, zero-interaction availability of the launcher* and for *safe capture* is core; everything needed only after the user opens the dialog is lazy. The gesture that opens the dialog is the lazy-loading boundary. The editor is R-01-mandated lazy; the i18n **dictionaries** ride the lazy chunk too (core keeps only a couple of strings — a full en/es dictionary is ~2–4 KB of pure text) *(reasoning)*.

### Core — `watchbug.js` (injected, ≤ 45 KB gz, hard)

| Module | Est. gz | Notes |
|---|---|---|
| Bootstrap + `window.Watchbug` API (`init`, `identify`, `show`/`hide`, `remove`) | ~2 KB | INV-02: the single global |
| `WidgetHost` adapter: custom element, closed shadow root, launcher button, host-element hardening (inline `!important` positioning, `all: initial` inner reset) | ~3–4 KB | R-14 / CA-04 surface |
| `CaptureSource` #1: display-media (`preferCurrentTab`, 1-frame grab, track teardown) | ~1–2 KB | Q-06 chain entry |
| `Redactor`: SEC-01 geometry collection + mask primitives (fill / grid pixelation) | ~3–4 KB | T1 + T3 re-bake; R-13 primitives only |
| Console ring buffer + `error`/`unhandledrejection` listeners (`Enricher`) | ~2 KB | Caps per Q-02 resolution |
| Environment/identity enrichers (`Enricher`, R-08 path-only URL, R-09 user passthrough) | ~2 KB | |
| Encoder (WebP q≈0.8 + PNG fallback) | ~0.5 KB | R-11 |
| `Transport`: FormData multipart, idempotency key, backoff retry, IndexedDB pending queue, `pageshow` flush | ~4–5 KB | The queue is the keepalive-cap workaround |
| Contracts **type-only** imports | **0 KB** | `import type` erases at build — Zod runtime stays server-side |
| Chunk loader (`import()` plumbing + `SHADOW_MODE` flag branch, tree-shaken in prod) | ~0.5 KB | |
| **Subtotal (with headroom for glue/minif loss)** | **~20–25 KB** | Leaves real margin in the 45 KB line — the budget risk is feature creep here, not the plan *(reasoning)* |

### Lazy chunk 1 — `dialog.js` (on dialog open, ≤ 25 KB gz)

| Module | Est. gz | Notes |
|---|---|---|
| Report form UI (bug/feedback toggle per RF-02, title, note) + shadow-root styles | ~6–8 KB | |
| `Annotator`: canvas tool engine (pencil, arrow, text, mask brush), overlay + working-bitmap model, undo of ink, T2 bake on stroke end | ~10–16 KB | R-01's stated estimate; hand-rolled (D-05) |
| i18n dictionaries en/es + formatter | ~2–3 KB | RNF-03 |
| **Subtotal** | **~18–25 KB** | Tight — the editor is the pressure point |

### Lazy chunk 2 (only if chunk 1 exceeds 25 KB) — `editor-extra.js` / optional adapters

| Module | Est. gz | Notes |
|---|---|---|
| Text tool + font handling, or i18n dictionaries | ~3–6 KB | Split point if needed |
| `CaptureSource` #2: DOM-serialization (D-08's retained optional adapter) | ~8–14 KB | Loaded **only** when the display-capture chain falls through |
| `CaptureSource` #3: manual file upload | ~1–2 KB | Last-resort capture |

**Budget arithmetic (R-01 tiers):** 45 (core) + 25 (dialog) + ≤ 10 residual = **≤ 80 KB total runtime** when only dialog loads; the DOM-serialize adapter is counted against the total only when actually loaded (host opt-in or chain fallback) — `check:size` must gate *every emitted chunk* on its own tier **and** the worst-case total. Flag the worst-case arithmetic (45+25+14 = 84 KB > 80 KB) as a size-gate scenario to resolve in Phase 4–7: either the DOM-serialize adapter replaces (not adds to) budget in the fallback path — acceptable because the editor chunk is then already resident — or the editor chunk must land ≤ 21 KB. *(reasoning; resolve against real `check:size` numbers, flagged in Risks)*.

---

## Hostile Host Page Hazards & Mitigations

*(Q-05/Q-06. TB-1: the host page is a hostile environment — hostile by accident (CSS), by policy (CSP), or by tooling (ad blockers).)*

### What breaks even with closed Shadow DOM (R-14 confirmed, with residual hazards)

Real widget vendors (bug-report widgets included) isolate with Shadow DOM because DOM is shared and styles leak in both directions *(src: dev.to IssueCapture / embeddable-widget articles — MEDIUM)*. `mode:'closed'` is the stronger reading (R-14, confirmed): host scripts and test tooling can't reach the root, so the root reference lives in a closure. Residuals and fixes:

| Hazard | What breaks | Mitigation |
|---|---|---|
| Host stylesheet matches the **host element** (`* { display:none !important }`, `#widget`, tag selectors) and **inherited properties** leak into the shadow tree | Launcher invisible/inline (this is literally CA-04's test) | Critical positioning set as **inline `!important`** on the host element (inline `!important` outranks author `!important`); shadow stylesheet declares `all: initial` on an inner wrapper then re-declares every property it needs (fonts, color, direction) *(src: shadow-DOM isolation articles; cascade is spec)* |
| `transform` / `filter` / `perspective` / `backdrop-filter` / `contain: paint` on an ancestor silently turns `position: fixed` into absolute-positioning-within-that-ancestor | Launcher drifts or disappears on scroll | Append the host as **last child of `document.documentElement`** (minimal ancestor chain), re-append on `documentElement` replacement via light `MutationObserver` *(src: embeddable stacking-context articles; reasoning for the observer)* |
| Host stacking contexts | Launcher renders under host modals | `position: fixed; z-index: 2147483647` inline `!important` on the host *(src: embeddable-widget z-index articles)* |
| Host JS hostile or clumsy (`document.querySelectorAll('*').remove()`, duplicate `Watchbug` loads) | Widget unmounted | Re-mount guard + idempotent `init()`; accept that a determined host script wins — it's their page; document it *(reasoning)* |
| **Closed root not pierceable by Playwright** | CA-04/CA-01 assertions impossible | R-14's `SHADOW_MODE=open` e2e build — confirmed necessary: Playwright's CSS engine pierces *open* shadow roots only *(reasoning from tooling behavior; verify in Phase 7 test plan)* |

**iframe alternative — evaluated and correctly not chosen:** stronger isolation (own CSS/JS world) but: needs `allow="display-capture"` to call `getDisplayMedia` from a cross-origin frame *(src: W3C screen-capture spec; MDN display-capture)*, adds a second origin to every host's CSP (`frame-src`), dies in `sandbox`ed embeds without `allow-same-origin allow-scripts`, and costs KBs. Closed Shadow DOM is right; the iframe remains a reserved `WidgetHost` adapter (R-02's seam pays off here).

### Host-page hazards table (Q-06)

| Hazard | What breaks | Mitigation pattern |
|---|---|---|
| **Ad blockers** | `w.js` or ingest request blocked (filter lists match request URLs/paths and known tracker names — "track", "analytics", "telemetry", "bug" style paths are red flags) | ① Neutral asset and route names (`/w.js`, `/api/incidents` is fine; avoid `/track`, `/events`, `/telemetry`) ② **First-party profile: self-host on the dev's own origin or behind a same-origin reverse proxy** — the natural fit for a self-hosted product and the single most effective mitigation ③ Document an integration fallback note for end users *(src: cookie-script/UserGuiding ad-blocker guidance — CNAME/first-party + rename; MEDIUM)* |
| **CSP `script-src`** | Snippet won't execute | Same-origin/`'self'` first-party profile makes this a non-problem; cross-origin profile: integration docs must state the exact origin to allowlist; support SRI (`integrity` + `crossorigin`) so strict hosts can allowlist safely *(src: MDN script-src; OWASP CSP cheat sheet; reasoning for SRI recommendation)* |
| **CSP `connect-src`** | Widget loads but `fetch` to ingest is blocked | Same-origin reverse proxy (`/api/incidents` same origin) removes the problem; otherwise document the API origin for `connect-src`. `fetch()` is governed by `connect-src` *(src: MDN connect-src / fetch docs — spec-verified)* |
| **`sandbox`ed iframe around the host app** | Without `allow-scripts` nothing runs at all (host's own problem); without `allow-same-origin` storage/origin behavior degrades to opaque origin | Document required flags for embedders of *their* app; if our widget were iframe-based it would also need `allow-same-origin` + `allow-display-capture` — one more argument for shadow DOM *(src: MDN sandbox; web.dev sandboxed iframes)* |
| **`Permissions-Policy` blocking `getDisplayMedia`** | Cross-origin iframe without `allow="display-capture"` → `getDisplayMedia` throws `NotAllowedError`; enterprise Edge policy can disable it entirely; **mobile browsers have no `getDisplayMedia` at all** | **`CaptureSource` fallback chain:** display-media → DOM-serialize (D-08 retained adapter) → manual upload; surface a graceful "attach a screenshot" UI on fallback; integration docs list `allow="display-capture"` for embedders *(src: MDN/W3C display-capture; HubSpot/Monday/Forge reports — real-world; mobile matrix = LOW, verify Phase 7)* |
| `getDisplayMedia` share-sheet UX (Q-06) | Every report raises a browser picker — friction | `preferCurrentTab: true` suppresses the sheet in Chromium-family (preselects current tab) *(src: WICG prefer-current-tab; addpipe article; Chromium-only — Firefox/Safari fall back to the picker)*. This is the reason `CaptureSource` exists as a seam: default adapter choice stays swappable without reopening architecture (Q-06 remains an owner-facing product choice) |

---

## Ingestion API Edge Concerns

*(Q-07. TB-2: unauthenticated-by-design surface — the write-only project key is a capability, not an identity.)*

### Multipart vs base64-in-JSON — **multipart/form-data**

| Criterion | multipart | base64-in-JSON | Verdict |
|---|---|---|---|
| Wire size | raw bytes + ~100–500 B boundary overhead | **+33 %** (4/3 expansion) on every report | multipart wins on the exact artifact we send (60–150 KB WebP) *(src: multiple encoding-comparison articles — cross-checked MEDIUM)* |
| CPU | none extra | encode client-side, decode server-side, every report | multipart |
| keepalive budget (below) | 1.0× bytes | 1.33× bytes | multipart — base64 burns the 64 KiB budget a third faster |
| Schema validation | JSON `meta` part parsed + Zod-validated; image part typed `Blob` | one JSON body | base64 slightly simpler — not worth 33 % *(reasoning)* |

**Shape:** `POST /api/incidents`, `FormData`: `meta` (JSON string, the `packages/contracts` schema) + `image` (`Blob`, `image/webp|png`). Headers: `X-Project-Key`, `Idempotency-Key`. R-11's WebP+PNG choice makes `toBlob` → `Blob` → FormData a straight line; **never base64-encode on the client at all** (CA-02's "before Base64/PNG encode" phrasing is satisfied a fortiori — the only encode is the masked one).

### The 64 KiB wall: `keepalive` / `sendBeacon` cannot carry screenshots

Hard spec numbers *(src: WHATWG Fetch Standard keepalive quota — cross-checked against MDN + w3c/beacon#38 + WebKit bug 168865 — MEDIUM)*:

- `navigator.sendBeacon`: payload limited to **64 KiB (65 536 B)** total queued; larger payloads → `false`, silently lost.
- `fetch(..., { keepalive: true })`: the **sum of in-flight keepalive request bodies per fetch group is capped at 64 KiB**; exceeding it **rejects with a network error**.

A WebP screenshot is 60–150 KB *compressed* (R-11's own estimate) — **above the cap by 1–2.5×, before the JSON part.** So R-02's adapter note "`fetch` + `keepalive`" must be refined to a two-lane `Transport`:

1. **Primary lane (normal operation):** plain `fetch` while the page is alive (user is looking at a "sent ✓" state). Full retry: exponential backoff + jitter, bounded attempts (e.g. 3), only on network error / 429 / 5xx, honoring `Retry-After` *(src: API-retry guides — cross-checked MEDIUM)*.
2. **Durability lane (unload/failure):** persist the pending `Report` (meta + Blob) in **IndexedDB** on failure or `pagehide`, flush the queue on next `pageshow` with the *same* `Idempotency-Key` so a double-delivery is deduped server-side. This is the standard offline-first pattern and is the only way a >64 KiB report survives an unload *(src: beacon-reliability articles on unload delivery being unreliable generally; the IndexedDB-queue resolution is reasoning + established RUM practice)*.
3. **Beacon lane (tiny receipts only):** optional `< 1 KB` "report attempted/failed" receipt via `sendBeacon` on `pagehide` — nice-to-have telemetry, never the payload. Keep or cut freely.

Note also: unload-time delivery is unreliable across platforms in general (mobile especially) *(src: NicJ beacon-in-practice; MEDIUM)* — another reason the queue, not the beacon, is the durability mechanism.

### Idempotency / dedup

Client generates `crypto.randomUUID()` per logical report; **the same key is reused across retries** *(src: idempotency-key guides — cross-checked MEDIUM)*. Server: `UNIQUE (project_id, idempotency_key)`; duplicate insert → return the stored `201 { id }` (replay), no second row/blob. This is what makes lane-1 retries and lane-2 queue flushes safe to overlap.

### Size limits & abuse caps (SEC-05, resolves Q-02's surface)

| Cap | Suggested v1 | Enforced where |
|---|---|---|
| Total request body | ~5 MB (`bodyLimit` → 413) | API edge |
| Image part | 4 MB, content-type allowlist `image/webp`, `image/png` (magic-byte sniff, not just header) | API edge |
| `meta` JSON | 64 KB serialized | API edge |
| Console entries | 100 entries × 1 000 chars (truncated client-side at capture, enforced again server-side) | **both** — client cap is UX/DoS hygiene, server cap is the control (reasoning: never trust the client's truncation) |
| Title / note | 200 / 2 000 chars | both |
| Rate limit | per IP **and** per `project_key` (e.g. 10/min burst 5) via `@fastify/rate-limit` with key = IP+project | API edge (SEC-05 mandates both) |

### CORS & cookie posture (SEC-05, SEC-06)

- **Ingest (`POST /api/incidents`):** `credentials: 'omit'` client-side; CORS allowlist of authorised host origins. R-06's minimal `projects(id, name, public_key)` has **no origins column** — and adding one is a schema change = consultation trigger (mission-brief §3). So v1: `WATCHBUG_CORS_ORIGINS` env allowlist. *(Open question below — don't silently grow the schema.)*
- **Panel API (`/api/admin/*`):** no CORS for browsers other than the panel origin; JWT in `HttpOnly`/`SameSite=Lax`/`Secure` cookie (SEC-06) + **`Origin` verification on cookie-auth'd mutations** (CSRF belt-and-braces beyond SameSite) *(reasoning)*. CA-05: every panel route without a valid JWT → `401`.

---

## Storage Layout & Blob Serving

*(Q-08. R-04 hard requirement: blobs are served only through the authenticated API — never as static files.)*

### Naming: server-generated UUIDv4, not content-hash, never user input

| Option | Verdict | Why |
|---|---|---|
| Original/user-supplied filename | **Forbidden** | User-controlled path components are the classic traversal/overwrite vector; extension spoofing; collisions *(src: upload-security articles; OWASP path-traversal)* |
| Content-hash (SHA-256) | **Not for v1** | Dedup would make R-10 deletion/retention **ref-counted** (two incidents share a blob → "delete this report" becomes "decrement and maybe delete"), and identical screenshots become linkable across incidents. Screenshots are per-report artifacts; dedup wins almost nothing *(reasoning)* |
| **Server-generated UUIDv4** | **Choose** | Unguessable, collision-free, no user input in the path, trivially deletable per incident (R-10), plus `crypto.randomUUID()` costs zero bytes server-side *(src: UUID-naming articles; cross-checked)* |

### Layout (sharded)

```
/volume/blobs/<projectId>/<uuid[0:2]>/<uuid>.<ext>      # ext ∈ {webp, png} — server constant
/volume/tmp/<uuid>.part                                 # write temp, fsync, rename → atomic publish
```

- 2-char prefix shard (`ab/…`) keeps directories small on every filesystem without a DB round-trip to compute the path *(src: sharding practice articles — LOW/MEDIUM; reasoning for choosing 2-char over date sharding: date sharding leaks report timing into the path and complicates retention sweeps — the DB already has timestamps)*.
- `projectId` directory segment is server-derived from the authenticated/validated project (never from a filename).
- Write path: stream to `tmp/` → `fsync` → `rename()` (atomic on POSIX volumes; avoids orphaned partial blobs on crash) *(reasoning)*.

### Serving without a path-traversal hole (the R-04 critical control)

Route: `GET /api/admin/incidents/:id/image` (JWT required — CA-05).

1. **Lookup, don't concatenate:** fetch the incident row by `:id` (parameterised SQL), read its `storage_key` column. **The request never names a file.** A key exists only if it was server-generated at `put()` time.
2. **Validate the key anyway** before it reaches `fs`: `const KEY_RE = /^[a-z0-9]{2}\/[a-f0-9-]{36}\.(webp|png)$/` — reject otherwise (`Storage.stream` enforces the same, so *no* adapter can be handed a hostile key).
3. **Resolve + assert:** `const p = path.resolve(VOLUME, key)` and assert `p.startsWith(path.resolve(VOLUME) + path.sep)` — belt and braces against `..`, encoded separators, NUL bytes, Windows drive-relative tricks (`..%5c`, `..\\`, `C:`) *(src: PayloadsAllTheThings/OWASP traversal classes; Windows-specific bypasses are a known class)*.
4. **Serve safely:** `X-Content-Type-Options: nosniff`; `Content-Type` from a **server allowlist** mapped from the DB enum (never from the request or the file extension alone); `Content-Security-Policy: default-src 'none'; sandbox` on the blob response; `Cache-Control: private, max-age=…` (authed — never `public`). Prevents a stored file from ever executing in the admin's origin *(reasoning, standard hardened-file-serving practice)*.
5. **Mount discipline (compose-level):** the volume is mounted **only** into `api`. The `panel` static server has no volume mount at all — so "serve as static files" is *impossible* by construction, satisfying R-04's hard requirement even against a future config mistake *(reasoning)*.
6. **Delete/retention:** `delete(key)` resolves through the same DB-lookup + regex path; the R-10 purge job deletes identity columns (no blob action) while manual report delete removes row + blob in one transaction-ish (row first, blob sweeper as safety net for crashes) *(reasoning)*.

---

## Suggested Build Order

*(Q-09. Maps 1:1 to roadmap phases. Sizes/gates named where they must start early.)*

**Dependency spine:** `contracts` → everything. `Storage`+DB → ingest → panel render. Widget → annotator. Auth → CA-05. Hardening is last-but-one, with two exceptions that must be right *at first build* (below).

> ⚠ **Architecture-loaded decisions — get right in the phase named or pay rewrite cost later:** ① `WidgetHost` host-element strategy (inline `!important` positioning, `documentElement` append, shadow `all: initial` reset) in Phase 3 — retrofitting isolation after widgets exist is a rewrite of every style; ② redaction ordering T1→T2→T3 in Phases 3–4 — a leak shipped is unrecoverable, and CA-02's e2e assertion depends on the ordering being right by construction. Everything else in this plan is additive.

| Phase | Name | Contents | Blocks / depends on | Demonstrable outcome |
|---|---|---|---|---|
| **1** | Contracts & skeleton | npm-workspaces monorepo (R-15), `packages/contracts` (Zod + types + JSON Schema emit = CA-01's single source), compose with `db`+`api`+`panel` stubs + volume, `.env`/`.env.example` (SEC-04), `check:size` harness stubbed | — | `docker-compose up` runs 3 services; schema artifact emits |
| **2** | Ingest slice (synthetic tracer) | `POST /api/incidents`: multipart → Zod validate → `Storage.put` (UUID key, tmp+rename) → `incidents` row; hardened blob route (JWT-less at this stage behind a stub guard); fixture-driven curl upload; minimal panel list + image render | Phase 1 | **First vertical path demonstrable** (synthetic payload → row → image in a browser) |
| **3** | SDK minimal tracer bullet | `packages/sdk`: bootstrap + `window.Watchbug`, `WidgetHost` (closed shadow, host hardening ⚠), display-capture `CaptureSource`, `Redactor` T1 auto-rules + mask primitives (R-13), encoder (R-11), `Transport` primary lane + idempotency, `SHADOW_MODE` build flag (R-14) | Phases 1–2 | **Earliest real end-to-end slice: gesture → capture → redact → POST → rendered in panel.** Size gate enforced from here on |
| **4** | Annotation editor (lazy chunk) | `Annotator` chunk: form (bug/feedback, RF-02), pencil/arrow/text/mask, overlay+working-bitmap model, **T2 bake + T3 re-bake order (⚠ safety-critical)**, i18n en/es (RNF-03), chunk split if >25 KB | Phase 3 | File an *annotated, auto-redacted* report; CA-02 e2e assertion (pixels absent from outgoing bytes) lands here |
| **5** | Enrichers & payload completion | Console ring buffer + error listeners (with Q-02 caps), environment enricher (R-08 path-only), identity + `privacy.userIdentity` opt-out (R-09), `user` columns purgeable (R-10 shape), consoleLogs-optional-in-feedback (CA-01/RF-02) | Phase 3 (can parallel 4) | Full RF-01/RF-02 payload; CA-01 e2e green |
| **6** | Admin auth & triage | `AuthProvider` (Argon2id + JWT HttpOnly cookie, TTL — SEC-06), login/logout, project selector + key display (R-06), filters (bug/feedback), state transitions, delete report / erase identity (R-10), retention purge job | Phase 2 (5 for identity erase) | RF-06/RF-07 complete; CA-05 e2e (401s) green |
| **7** | Edge hardening & hostile host | Rate limit per IP+key, CORS allowlist, size caps both ends, sanitization double-pass (SEC-05), `Origin` check on panel mutations, blob-route headers (nosniff/CSP), hostile-CSS e2e (CA-04, SHADOW_MODE build), capture fallback chain (DOM-serialize + manual upload), IndexedDB durability lane (64 KiB wall), ad-blocker/CSP integration notes | Phases 3–6 | CA-03/CA-04 green; hostile-host matrix passing |
| **8** | Deployment & verification closeout | Final `docker-compose.yml` (3 services, volume only on `api`), `.env.example` docs, `check:size` + `npm run verify` suite mapping 1:1 to CA-01…CA-05 (≈20 assertions, R-12), RGPD Art. 13 integration-doc note (R-09) | All | Ship-shaped v1 |

**Rationale for the order.** Phases 2–3 are deliberately the smallest *real* tracer bullet: nothing about triage, editing, or i18n is needed to prove "a report crosses TB-1→TB-2→TB-5 intact." Phase 4 before 5 because the mask pipeline is the product's core value and its highest-risk code (rewrite cost argument above); enrichers are pure additive metadata. Auth (6) comes after the ingest path exists because CA-05 needs routes to guard, but before hardening (7) because the blob route's real guard is the JWT. Hardening (7) is late on purpose — controls are cheap to add to correct structure and expensive to bolt onto wrong structure — except the two ⚠ items, which are structural.

---

## Risks & Open Questions

| # | Item | Type | Note |
|---|---|---|---|
| 1 | **Worst-case size arithmetic: 45+25+14 = 84 KB > 80 KB** if the DOM-serialize capture adapter loads alongside the editor | Risk (R-01) | Resolve in Phase 7 against real `check:size` numbers: count optional-adapter bytes only in the fallback scenario where the editor is resident, or cap editor at 21 KB. A `check:size` scenario for "worst realistic combo" is the enforcement mechanism *(reasoning)* |
| 2 | Q-02 console-log caps | Open (from record) | Proposed resolution above (100 × 1 000 chars, capped at both ends). Needs owner sign-off — it shapes the payload schema |
| 3 | CORS origin source for ingest | Open (new) | R-06's minimal schema has no origins column; adding one is a **schema change → consultation trigger**. v1 proposal: `WATCHBUG_CORS_ORIGINS` env allowlist. Decide before Phase 7 |
| 4 | Q-06 default capture adapter | Open (from record) | Research sharpened it: `preferCurrentTab` kills the share sheet in Chromium only *(src: WICG/addpipe)*, `getDisplayMedia` is absent on mobile and blocked in cross-origin iframes without `allow=` *(src: MDN/W3C; issue reports)*. The chain (display-media → DOM-serialize → manual-upload) is the architecture-level answer; which link is *default* is the owner's product choice |
| 5 | `fetchLater()` as a third transport lane | Unverified | Potentially better than the IndexedDB queue for recent Chromium, but quota/behavior details are not spec-verified here — **do not design against it**; the IndexedDB queue is the portable answer |
| 6 | Mobile capture matrix | Low-confidence source | "No mobile browser supports `getDisplayMedia`" is from a single LOW-tier source — verify in Phase 7 before encoding the fallback chain's UX copy |
| 7 | Exact dependency versions (Node, Fastify 5, Drizzle, Postgres 16, React, Vite) | Open (R-15 note) | Explicitly not fixed in R-15; must be pinned against live docs during phase planning, not from this research |
| 8 | Retention N (Q-03) + whether surfaced in panel | Open (from record) | Architecture impact: purge job is a plain module in `apps/api` (schedule via interval + boot sweep); panel surfacing is additive |
| 9 | In-memory pre-mask snapshot for undo of mask strokes | Design note | If mask undo is offered in the editor, it must restore the snapshot and **re-bake all remaining masks in order** (T2 invariant), and the snapshot must never outlive the send call. Simplest safe v1: mask strokes are undoable only as "undo last" with re-bake *(reasoning)* |

---

## Sources & Confidence

Confidence tiers per the classify-confidence seam (websearch/webfetch unverified = LOW; cross-checked `--verified` = MEDIUM). All digests cached via `research-store` (7 entries, 2026-10-05). Spec-level sources (MDN/WHATWG/W3C) corroborate the cross-checked claims but the seam tiers them at MEDIUM; treat spec statements as effectively HIGH.

| Claim area | Sources | Tier |
|---|---|---|
| Redaction failure class (annotation/layer over content leaks; true redaction = destructive pixels in fresh encode) | dev.to "Doing PDF Redaction Right: Why a Black Rectangle Is Not Enough"; docento "PDF Redaction Failures"; lazytools "Why PDF Redactions Fail"; privvert "PDF black rectangles do not work"; Scanly / UseToolSuite image-redaction pages; ediscovery-automation "Preventing Redaction Leakage" (flatten guidance); ZumiLabs annotation-layer article | MEDIUM (cross-checked, multiple independent; news-grade incidents cited within) |
| Shadow DOM widget isolation & residuals (host-element styling, inherited props, stacking, fixed-containing-block) | dev.to "Shadow DOM CSS Isolation" (IssueCapture); dev.to "embed a widget … Shadow DOM" (Yousrie); embeddable.com z-index/stacking FAQ; makerkit "Embeddable React Widgets"; ostefani DOM-isolation notes | MEDIUM (cross-checked) |
| 64 KiB keepalive/sendBeacon caps | WHATWG Fetch Standard (keepalive quota); MDN `navigator.sendBeacon`; w3c/beacon issue #38; WebKit bug 168865; monoid.website keepalive-vs-beacon; NicJ "Beaconing in Practice" (reliability) | MEDIUM (cross-checked; spec-backed) |
| multipart vs base64 (+33 %, ~100–500 B boundary overhead) | dev-brains-ai base64 guide; jsonic file-upload guide; requestly multipart guide; Stack Overflow #18240692 / #47095294; codegenes comparison | MEDIUM (cross-checked) |
| Idempotency keys + retry/backoff | jsonic "JSON Idempotency"; myappapi idempotency keys; apiguide.dev retries; apidog backoff guide; teliaz idempotency post | MEDIUM (cross-checked) |
| Host-page hazards: ad blockers, CSP, sandbox, Permissions-Policy display-capture | MDN `Permissions-Policy: display-capture` + `CSP: script-src`/`connect-src`/`sandbox`; W3C Screen Capture spec; cookie-script & UserGuiding ad-blocker guides; HubSpot/Monday/Atlassian-Forge `display-capture` failure reports; web.dev "Play safely in sandboxed IFrames"; OWASP CSP cheat sheet; MDN fetch (`connect-src` note) | MEDIUM (cross-checked; issue reports = real-world corroboration) |
| Capture UX / `preferCurrentTab` | WICG prefer-current-tab spec; addpipe "Screen Sharing a Single Tab"; caniuse `getDisplayMedia`; cobaltcapture support matrix | MEDIUM except mobile-absence claim = **LOW** (single source — verify Phase 7) |
| Storage naming/sharding/traversal | wildandfreetools UUID naming; utilnode UUID-vs-hash; PayloadsAllTheThings traversal cheatsheet; OWASP path traversal; appsecbrief / decryptiondigest traversal guides | MEDIUM (cross-checked) |
| Port shapes, dependency direction, build order, size estimates, TB map, CSRF/Origin hardening, tmp+rename, compose mount discipline | General reasoning from R-01…R-17 / INV / SEC constraints | labelled inline as *(reasoning)* |

**Not found / gaps:** no high-quality public source describes competitor (Marker.io/Usersnap-class) internals at the port level — vendor architecture claims here are pattern-inference from the embeddable-widget literature, not teardowns. `fetchLater()` quotas unverified (Risk 5). Exact lib versions out of scope for this dimension (Risk 7).

