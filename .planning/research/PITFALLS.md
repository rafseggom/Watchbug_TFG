# Pitfalls Research: Watchbug SDK

**Dimension:** Pitfalls — what embeddable bug-reporting / visual-feedback SDKs commonly get wrong
**Scope:** Shadow DOM widget, screenshot capture, destructive masking, annotation editor, browser SDK distribution, self-hosted ingestion API + panel
**Researched:** 2026-10-05
**Overall confidence:** MEDIUM (cross-checked web/academic sources; no primary-source code audit yet)

> **Excluded by instruction:** D-01…D-08 are already-known dead ends and are *not* re-reported as findings. Where a finding sharpens an existing decision (R-08…R-14) it is explicitly framed as a **refinement**, not a rediscovery. Two findings below are refinements of **R-13** and **R-10** and should be read before those decisions are treated as settled.

---

## Summary

Five failure families dominate this product class, in order of how expensive they are to fix late:

1. **Irreversibility theatre.** Redaction that *looks* destroyed but is statistically recoverable, and redaction that *is* destroyed in the visible layer while the original survives in an undo stack, an offscreen base layer, or a second canvas that later gets exported. Both are one-way doors: once a report containing a recoverable secret has left the browser, no code change undoes it. **The safe primitive is flat opaque fill on `ImageData`, and the safe architecture is a single flattened bitmap with no retained originals.**
2. **Isolation half-measures.** Shadow DOM stops selectors; it does not stop inherited properties, CSS custom properties, `rem`, `transform` containing blocks, or `z-index` stacking-context wars. Hostile host CSS (CA-04) is a *test case*, not a hypothetical — plenty of real sites ship `* { … !important }` resets.
3. **Distribution reality.** A `<script>` embedded in third-party pages lives or dies by the host's CSP, the user's ad blocker, and the site's service worker. `getDisplayMedia` adds a hard platform cliff: it does not exist on iOS at all.
4. **Ingestion abuse past the rate limiter.** Per-IP rate limiting is the *first* control, not the whole control. Payload bombs, image decompression bombs, path traversal on the blob volume (R-04), and stored XSS through console logs and images (SEC-05) are all reachable from a legitimate-looking write-only key.
5. **Budget and privacy erosion.** A 45 KB gzipped budget is lost to locale data and transitive dependencies, and a "purge identity after 30 days" policy (R-10) is meaningless if the screenshot and console log still contain the person's name and face.

**Phase-topic convention used below** (map onto real phase names at roadmap time):

| Tag | Phase topic |
|-----|-------------|
| **P-CONTRACTS** | `packages/contracts` schema, payload shape, caps as schema-level constants |
| **P-WIDGET** | Widget shell + `WidgetHost` isolation (INV-01/INV-02) |
| **P-CAPTURE** | `CaptureSource` + `Enricher` telemetry (env, console) |
| **P-EDITOR** | `Redactor` + `Annotator` (masking + annotation editor) |
| **P-INGEST** | `Transport` + API ingestion + `Storage` (blobs) |
| **P-PANEL** | Admin panel, auth, rendering of stored data |
| **P-DEPLOY** | docker-compose, hardening pass, i18n, `check:size` gate |

---

## Critical Pitfalls

### C-1 · Pixelation and blur are reversible for text — R-13's "≥ 8 px block" is not sufficient on its own

**What goes wrong.** The masking tool pixelates or blurs a name, an IBAN, a card number or a token. It is visually unreadable to a casual glance and is treated as destroyed. It is not. Render-and-compare attacks recover pixelated and blurred **text** with near-perfect accuracy: enumerate candidate glyphs in the target font, rasterize, run the exact same block-average/blur transform, and score against the redacted block. Published attacks: HMM-based recovery of mosaiced *and* blurred text (Shacham et al., *On the (In)effectiveness of Mosaicing and Blurring as Tools for Document Redaction* — near-perfect recovery of 18 pt text through a 24 px mosaic); Bishop Fox **Unredacter** (brute-force per-glyph pixelation matching); **Depix** (De Bruijn block matching); Positive Security **Underactor** and their video depixelation work (per-frame averaging of pixelated video to reconstruct a *cleaner* mosaic, then feeding that into the text attacks — averaging attacks work because each frame leaks a slightly different block average). The attacks need only reasonable assumptions: the font family and size (readable from unredacted text elsewhere in the same screenshot) and that the region is text.

**Why it happens.** Block-averaging is a many-to-one transform, but it preserves one mean colour per block. For text at typical UI font sizes (11–16 px) an 8 px block still carries per-glyph stroke energy and letter-position information, and language models close the rest. Blur is strictly worse: Gaussian blur is a linear convolution and is partially invertible by deconvolution *before* the statistical attack is even needed. Two secondary leaks survive even **solid bars**: font-metric under/over-shoot around the bar edges (Naccache & Whelan, Eurocrypt 2004 rump) and residual signal in JPEG compression artifacts (Ho & Chang) if the region is covered by an overlay rather than overwritten and re-encoded.

**Warning signs (early).**
- Any code path where masking is implemented as `ctx.fillRect` over an already-encoded image, a CSS overlay, a second transparent canvas, or a `filter: blur()` — check for `globalAlpha < 1` in the mask brush; partial alpha is an overlay, not a redaction.
- Mask block size expressed in *screen* pixels with no relationship to the surrounding font size.
- The masked region's bounding box not snapped to the block grid, leaving partial blocks at the edges (partial blocks leak a *different* averaging window and are exactly the artifact Unredacter's author used to break a challenge).
- A QA step that only asks "can a human read it?" Run the free public tools against your own output in week one — if `Underactor`/`Unredacter` output is even *partially* legible, so is an attacker's.

**Prevention (concrete).**
1. **Make flat opaque fill the default primitive**, including for the SEC-01 automatic masks (password fields, `[data-watchbug-sensitive]`, card patterns). Pixelation is a *user-facing style choice*, opt-in, never the automatic path.
2. When pixelation is used: block size = `max(8, 2 × measured cap-height of nearby text)` px in **device** pixels, region snapped outward to the block grid, and the fill is the block mean written with **alpha = 255** (no partial alpha anywhere).
3. **Destroy before encode, then re-encode.** Mutate `ImageData` in place and encode from that buffer. Never draw a rectangle "on top" and export a composited layer — the compositor's own output carries compression artifacts that preserve the boundary.
4. Encode lossy (R-11's WebP q≈0.8 is fine) *after* destruction so the codec quantises away any residual gradient; do **not** allow a lossless PNG path for masked images to be the default.
5. Ship an e2e property assertion that decodes the outgoing image and asserts the masked region's pixel variance is ≤ codec noise across the *whole* region (not just its centre), i.e. extend R-12's CA-02 e2e to the region boundaries.

**Severity:** **CRITICAL (security — irreversible data loss / privacy).** This is the core promise of the product ("nothing sensitive leaves the browser in recoverable form").
**Phase that must address it:** **P-EDITOR** (implementation) + **P-CONTRACTS** (mask metadata in schema) + **P-DEPLOY** (the e2e irreversibility assertion as a release gate).

---

### C-2 · Unmasked originals survive into the exported artifact (undo stack / base layer / offscreen snapshot)

**What goes wrong.** The user carefully masks a region, annotates, and hits send. The exported image still contains the original pixels. Typical mechanisms, all seen in real editors:
- **Layer stack export.** The editor keeps a pristine base `ImageBitmap` plus annotation/mask layers and flattens at export — but flattens by drawing layers onto a *copy of the base* in the wrong order, or exports the base layer when the mask layer failed to apply.
- **Undo stack.** Each stroke pushes a full-canvas snapshot (or a `putImageData` copy of the dirty rect) for undo. Undo/redo data is a *complete unmasked original*, and any "export project" or debug dump serialises it. Even without export, it lives in JS heap for the session.
- **Offscreen double buffer.** Masks are applied to a display canvas while the working buffer keeps originals for "re-draw on resize", and the working buffer is the one encoded.
- **Stroke-over-mask ordering.** The user masks a region and then draws an arrow/text over it; if annotation strokes are stored as vector commands replayed onto the base at export, a mask recorded as just another stroke can be *undone* or *z-ordered beneath* a later stroke that doesn't fully cover it — leaving slivers of the original visible around the annotation.

**Why it happens.** Undo and non-destructive editing are correct UX for annotation (arrows, text) and catastrophic for masking. Editors treat both as "strokes" on one stack because it is the simplest model. The privacy requirement is asymmetric: **annotations are reversible, masks are not**, and one stack cannot express that.

**Warning signs (early).**
- One `Stroke[]` / `Command[]` array holding both mask operations and draw operations.
- Any `undo()` that restores pixel data rather than removing the last *annotation*.
- More than one `CanvasRenderingContext2D` or `ImageBitmap` holding screenshot pixels at any time (assert this with a counter in dev builds).
- `toBlob`/`toDataURL`/`convertToBlob` called on any canvas other than the single canonical working canvas.
- Export code that iterates layers.

**Prevention (concrete).**
1. **Two models, one canvas.** *Masking is destructive and non-undoable past an explicit confirm step; annotation is a vector layer.*
   - Keep exactly **one** working `ImageData`/canvas = the screenshot, and apply every mask to it **immediately and irreversibly** (matches SEC-02 literally).
   - Keep annotation strokes as vector commands rendered onto the same canvas as they are drawn, or kept as an overlay that is flattened **onto the already-masked canvas** at export. Masks are never a layer.
2. **Undo stack semantics:** undo pops the last *annotation* stroke only. Masking is confirmed via a modal ("Masks cannot be undone — continue?") and thereafter is out of the undo stack entirely. If product insists on mask-undo, the only safe form is a **bounded, pre-encode** undo that is **explicitly destroyed** on the confirm step and provably never serialized (`bitmap.close()`, drop references, assert zero retained screenshots in the send path).
3. **Single-sink export.** One function `encodeFinal(): Blob` is the only code permitted to call `toBlob`. Add a lint/grep gate: `toBlob|toDataURL|convertToBlob` appears exactly once in the SDK.
4. **Destruction test** (extends R-12's CA-02 e2e): after masking, drive `undo()`, `redo()`, resize, tool-switch and re-render, then send — assert the outgoing bytes still lack the original region pixels. Then assert a heap-side proxy: dev build exposes `Watchbug.__retainedBitmapCount() === 0` at send time.

**Severity:** **CRITICAL (security — defeats SEC-02 / R-13 entirely).**
**Phase that must address it:** **P-EDITOR** (architecture), asserted in **P-DEPLOY** (e2e).

---

### C-3 · Stored XSS and image-borne XSS reach the panel through the report payload (SEC-05)

**What goes wrong.** The ingestion endpoint accepts attacker-controlled strings (title, description, console messages, URL path, user name/email) and attacker-controlled bytes (the screenshot). The panel renders them. Failure modes:
- Console messages containing `<img onerror=…>` / `<script>` / `javascript:` URLs render as HTML in the log viewer → stored XSS executing **in the admin's authenticated session** (the highest-value target in the deployment).
- Markdown-ish or linkified fields turning a `javascript:` URL into a clickable anchor.
- **SVG uploads**: SVG is an *active text format* (can contain `<script>`, `<foreignObject>`, event handlers) and is routinely misclassified as a safe image. Magic-byte sniffers do not classify text-based active formats at all.
- **Polyglot files** (GIF/JPEG that is also valid HTML/JS) served back with a missing or wrong `Content-Type` and no `X-Content-Type-Options: nosniff` → the browser content-sniffs and executes the "image" as HTML on the panel origin.
- Serving blobs inline from the API origin at all means any parser quirk is same-origin with the admin session.

**Why it happens.** Sanitising on *input* alone fails because (a) sanitiser rules lag payloads, and (b) the same data is rendered in multiple contexts (HTML body, attribute, URL, `title=` tooltip) each needing different escaping. Image handling inherits web-server defaults (`Content-Type` sniffed from extension, `Content-Disposition: inline`).

**Warning signs (early).**
- Any `dangerouslySetInnerHTML` / `v-html` / `innerHTML` in the panel — grep for it; the count should be zero or every instance justified and sanitised.
- An allowlist that permits `image/svg`, `text/html`, `application/xhtml`, or `*/*`.
- Blob responses without `X-Content-Type-Options: nosniff` **and** `Content-Disposition: attachment` (or served from a separate sandbox origin).
- Sanitiser applied in the API but panel components that also interpolate into `<style>`, `<script>` or `href`.
- A test fixture containing only benign strings. Add `"><img src=x onerror=alert(1)>`, `{{constructor.constructor('alert(1)')()}}`, `javascript:alert(1)`, UTF-7/UTF-16 BOM'd strings and a polyglot GIF/HTML in the e2e fixtures **now**.

**Prevention (concrete).**
1. **Context-appropriate output encoding is the primary control** (React `textContent`-by-default is fine; Vue must not use `v-html`). Input sanitisation at ingest (SEC-05) is defence in depth, not the main defence. Store raw-but-capped, escape on render.
2. **Allowlist image types to `image/webp` and `image/png` only** (R-11 already narrows this — enforce it as a server-side magic-byte check on the *decoded* result, not the declared MIME). **Reject SVG unconditionally.**
3. Re-encode on ingest where feasible (decode → re-encode WebP/PNG). This destroys polyglots, EXIF and trailing appended payloads in one move. If you skip re-encoding, at minimum verify decoded dimensions match the header and the file has no trailing bytes.
4. Serve blobs with: `Content-Type` from the *verified* type, `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment; filename="…"` (or `inline` only inside a `sandbox=" "` iframe / separate throwaway origin), `Content-Security-Policy: default-src 'none'; sandbox` on the blob response, `Cross-Origin-Resource-Policy: same-origin`.
5. Console log strings are the highest-risk field: length-cap (see C/H-6), strip control chars, and render each log line as text only — never linkified, never HTML.

**Severity:** **CRITICAL (security — stored XSS in admin session).**
**Phase that must address it:** **P-INGEST** (validation, type allowlist, re-encode, headers) + **P-PANEL** (output encoding) + **P-CONTRACTS** (field caps) + **P-DEPLOY** (hostile-fixture e2e).

---

### C-4 · Path traversal / unauthorised blob access on the filesystem volume (R-04 hard requirement)

**What goes wrong.** R-04 puts screenshots on a filesystem volume and requires they are served **only** through the authenticated API. The failure is any route that turns user-influenced input into a filesystem path: `GET /attachments/:id` where `:id` is used as a filename, `../../../etc/passwd`, URL-encoded `%2e%2e%2f`, double-encoded, backslash separators on Windows-ish deployments, NUL truncation (`report.png\0.jpg`), absolute paths, or symlink escape from the mounted volume. A second failure: the volume is *also* mounted into the static panel container or exposed by an nginx `alias` misconfiguration, bypassing the API entirely.

**Why it happens.** Blob IDs are convenient to treat as filenames. Compose files make it trivially easy to mount the same volume twice "for convenience".

**Warning signs (early).**
- Any `fs.readFile(req.params…)` / `path.join(UPLOAD_DIR, req.params.id)` — the ID must never be a path component. Use a server-generated UUID/GUID filename with a fixed extension derived from the *verified* content type.
- The `panel` service listing the attachments volume in `docker-compose.yml`.
- Filenames echoed back in `Content-Disposition` unquoted (header injection via CR/LF in a filename).
- Static file middleware (`@fastify/static`, nginx `root`) pointed anywhere near the blob directory.

**Prevention (concrete).**
1. **Store blobs as `sha256-or-uuid + verified extension`.** The client-supplied name (if any) is metadata in PostgreSQL, never a path. Resolve with `path.resolve` and assert `resolved.startsWith(UPLOAD_ROOT + path.sep)` as a belt-and-braces check.
2. Serve exclusively via the authenticated API route (R-04), with `Content-Disposition` filename built from a sanitised, quoted, ASCII-folded value.
3. Attachments volume mounted **only** into `api`. Panel fetches blobs through the API with the session cookie. Add a compose assertion in CI: grep `docker-compose.yml` and fail if `panel` has a `volumes:` entry for attachments.
4. Fixed-size-ID validation (`^[0-9a-f]{32}\.(webp|png)$`) at the route, reject everything else with 404 (not 400 — do not confirm existence).

**Severity:** **CRITICAL (security — arbitrary file read → container compromise).**
**Phase that must address it:** **P-INGEST** (Storage adapter) + **P-DEPLOY** (compose assertion).

---

### C-5 · Host credentials escape through telemetry despite SEC-03

**What goes wrong.** SEC-03 forbids cookies/tokens in *our requests' headers*. It does not automatically stop secrets travelling **in the payload**:
- Console logs routinely contain tokens: `console.log('token', res.headers.authorization)`, Apollo/Redux devtools logging state with session data, `fetch` wrappers logging URLs with `?access_token=`.
- URL leakage: `environment.url` correctly strips query+fragment (R-08) but **`document.referrer`**, `location.hash`-derived state (OAuth implicit flows), and `history.state` are separate fields an `Enricher` might add "helpfully".
- Screenshot pixels themselves: an on-screen dashboard shows the account holder's name, an admin page shows another user's PII. (Ties to M-1.)
- A generic "collect environment" helper that walks `window`, `localStorage`, `navigator`, or serialized error objects carrying `request` with headers.
- `user-agent`-adjacent fields and client hints are fine; `Sec-Fetch-*`/cookie-derived user IDs are not.

**Why it happens.** The rule is written about *transport headers* but the attack surface is *payload content*, and telemetry code is written to be maximally helpful.

**Warning signs (early).**
- Any `document.cookie`, `localStorage`, `sessionStorage`, `Authorization`, `credentials:` literal in the SDK — grep gate, allowlist zero occurrences (with the exception of the panel's own code).
- An `Enricher` that accepts an arbitrary serialiser closure from the host without a payload contract.
- Error serialisation that walks enumerable properties of arbitrary objects (a `Response` or `Request` will drag headers along).
- Field-level schema allowing free-form `extras: Record<string, unknown>`.

**Prevention (concrete).**
1. **Grep/lint gate in CI** for `document.cookie|localStorage|sessionStorage|Authorization|Bearer |credentials:` in `packages/sdk`. This is cheap and total for the direct-leak class.
2. **Allowlist the payload** in `packages/contracts`: a closed schema, no free-form bag. Extra host data goes through a named `Enricher` returning `{ key, value: string }` pairs capped in length (see constants), and the docs state the host is responsible for its contents.
3. **Secret scrubbing on serialized strings** before they enter the log buffer: regexes for `Bearer\s+\S+`, `(?i)(api[_-]?key|token|secret|password|authorization)\s*[=:]\s*\S+`, JWT shape `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.`, card-number Luhn-shaped digit runs (aligns with SEC-01's card patterns). Replace with `[redacted]`. This is a denylist — acceptable *here* only because the allowlist (2) is the primary control and R-08-style total stripping is applied to the URL field.
4. Never send `document.referrer`; if a referring page is needed, send `new URL(document.referrer).origin` only.

**Severity:** **CRITICAL (security/privacy — violates SEC-03 by payload instead of by header).**
**Phase that must address it:** **P-CAPTURE** (`Enricher` + console capture) + **P-CONTRACTS** (closed schema) + **P-DEPLOY** (grep gate).

---

## High-Severity Pitfalls

### H-1 · Mask rectangles misregister on HiDPI / zoomed viewports

**What goes wrong.** The user drags a mask over a card number. In the editor the mask is stored in CSS pixels on a preview canvas that is itself scaled. The underlying bitmap is `devicePixelRatio`-scaled (or the captured video frame is at native resolution). At export the mask lands 2–15 px off — enough to leave the first or last characters of the secret visible. Blurry preview scaling (the classic "the mask looked fine at 60 % zoom") hides it.

**Why it happens.** Three coordinate spaces get conflated: CSS px (pointer events), preview-canvas px (possibly downscaled), and source-bitmap px (DPR-scaled capture). A single `scale` factor on the context is not enough when the preview is letterboxed.

**Warning signs (early).** Any multiplication by `devicePixelRatio` outside one single named `toBitmapSpace()` helper; pointer coordinates used directly as `ImageData` indices; preview `canvas.width !== canvas.getBoundingClientRect().width * dpr`; no test at `dpr ∈ {1, 1.25, 2, 3}` and at non-integer zoom (Ctrl+80 %).

**Prevention (concrete).**
- One coordinate-transform module (`cssToBitmap(rect)`), unit-free by construction: all mask geometry stored in **bitmap space from the moment the pointerup happens** (convert once, store absolute).
- Snap mask rects outward to integer bitmap pixels **and** to the pixelation block grid (C-1).
- Preview canvas rendered from the working bitmap via `drawImage` with `imageSmoothingEnabled = false` while masking, so the user sees true pixel boundaries.
- e2e property assertion at `deviceScaleFactor: 2` and `3` (Playwright supports it) in the CA-02 test.

**Severity:** HIGH (correctness with privacy consequence — partial disclosure).
**Phase:** **P-EDITOR**, asserted in **P-DEPLOY**.

---

### H-2 · Shadow DOM leaks and isolation failures (INV-01 / INV-02)

**What goes wrong.** The widget is in a shadow root and *still* breaks. Real mechanisms:
- **Inherited properties pierce the boundary.** `color`, `font`, `font-family`, `font-size`, `line-height`, `letter-spacing`, `text-transform`, `text-align`, `visibility`, `direction`, `cursor`, `opacity` (on an ancestor), `writing-mode`, `box-sizing` (via `all`), `-webkit-*` text props. A host rule `body { font: 8px/0.1 Papyrus; letter-spacing: 5px; text-transform: uppercase; }` shrinks or explodes widget text layout.
- **CSS custom properties inherit** (by design). Hosts using design tokens (`--color-primary: hotpink`, or Tailwind v4's `--tw-*` set) will collide with any un-prefixed variable the widget reads with `var(--x, fallback)` — `var()` with fallback still resolves to the host's *invalid-but-present* value and can silently produce an empty declaration (the MDN "invalid variable" trap: `color: var(--text-color)` with `--text-color: 16px` makes the whole declaration invalid at computed-value time).
- **`:host { all: initial }` traps.** The known reset, but: `all` does not reset custom properties (they are inherited, not part of `all` in the way you want) and it *does* reset `display`, `position`, `box-sizing`, `visibility` — so it must be rule #1 followed immediately by explicit re-declaration of every property you actually need. Applied to `*` inside the shadow root it also nukes `::before/::after` content and can be a perf drag on large trees.
- **`::part()` / `::theme()` exposure.** Any `part=` attribute on shadow elements is an intentional styling escape hatch *for the host*; conversely there is no `::theme` in the standard (it's a proposal) — do not rely on it. The trap is shipping `part` on internal elements "for flexibility", which hands the host the ability to break CA-04 legally.
- **`rem` resolves against the host's root font size** — a shadow root has no root element of its own. Host `html { font-size: 62.5% }` or a hostile `html { font-size: 4px }` rescales everything sized in `rem`.
- **`transform`, `filter`, `perspective`, `contain: paint`, `will-change: transform` on a host ancestor** create a containing block for fixed-position descendants, so `position: fixed` widget chrome anchors to that ancestor instead of the viewport (or gets clipped by `overflow: hidden`).
- **`z-index` / stacking-context wars.** The widget host is a single element in the host DOM; anything with a higher stacking context and later paint order covers it. `z-index: 2147483647` is the customary maximum but loses to a topmost modal in the same stacking context painted later, and `pointer-events` from an ancestor can eat clicks.
- **`adoptedStyleSheets` / `CSSStyleSheet` constructor gaps.** Older Safari lacked `AdoptedStyleSheets`/constructable stylesheets; the usual polyfill (`<style>` element per sheet) duplicates CSS and leaks if it appends to `document.head` (violates INV-01's "no stylesheets in host head").
- **Closed-root debugging (R-14).** With `mode: 'closed'`, `element.shadowRoot === null` for everyone including you; a runtime error inside the widget is un-anchored in DevTools and e2e cannot assert. R-14's `SHADOW_MODE` build flag is the right call — but the flag must also gate a small "root registry" (a WeakRef retained in module scope) so the e2e bundle can reach the root.

**Warning signs (early).** Widget text metrics change when you paste `body { font-size: 2px; letter-spacing: 8px; }` into the host fixture; `getComputedStyle(host).getPropertyValue('--color-primary')` non-empty in the fixture; any `part=` in `packages/sdk`; any `rem` unit in widget CSS; `position: fixed` used without a `transform`-ancestor guard; widget CSS referencing `var(--x)` without a fallback *and* without a local definition.

**Prevention (concrete) — belt and braces:**
1. **`:host { all: initial; }` first rule**, then explicitly re-declare on `:host` and a wrapper: `display: block; position: fixed; box-sizing: border-box; visibility: visible; all: initial;` plus full `font` shorthand (`font: 400 14px/1.4 system-ui, sans-serif;`), `color`, `letter-spacing: normal`, `line-height`, `text-transform: none`, `text-align: left`, `direction: ltr`, `cursor: default`, `writing-mode: horizontal-tb`, `font-size: 14px` (px, **never rem**), `font-variant: normal`, `-webkit-font-smoothing: antialiased`, `white-space: normal`, `word-break: normal`, `opacity: 1`, `filter: none`, `transform: none`.
2. **Prefix every custom property** (`--wb-…`) and declare it locally on `:host` with an initial value; never read a bare `var(--x)` without `var(--wb-x, <literal>)`. Do **not** let host tokens drive widget rendering in v1 (no theming surface = no inheritance surface).
3. **Zero `part` attributes.** Zero `::theme`. Document it as a non-goal so nobody adds them "for extensibility".
4. **Everything in px / em-free.** No `rem` anywhere in widget CSS (lint for `rem(` / `rem;` / `rem ` in the SDK stylesheet).
5. **Anchor via `position: fixed` on the *host element* itself** (which lives in the light DOM and is therefore subject to ancestor containing blocks) — mitigate by re-anchoring on `window.resize`/`scroll` using `getBoundingClientRect` and by inserting the host as the **last child of `document.documentElement`** (not `body`), with `z-index: 2147483647`, `pointer-events: none` on the host and `pointer-events: auto` on the inner interactive wrapper. `documentElement` insertion sidesteps most `body` transforms/overflow and modal stacking.
6. **Styles via `<style>` inside the shadow root** (not `adoptedStyleSheets`) for v1: one element, no polyfill, no host-`head` writes (INV-01). Revisit `adoptedStyleSheets` when the compat floor allows.
7. **CA-04 hostile fixture must include, not just `* { display: none !important }`:** `html { font-size: 4px }`, `body { font: 3px/0.5 monospace; letter-spacing: 6px; color: transparent; text-transform: uppercase; direction: rtl; }`, `* { --color-primary: red; --wb-color: red; all: unset; }`, `body > * { transform: rotate(1deg); overflow: hidden; }`, `* { z-index: 999999 !important; position: relative; }`, `body { cursor: none; user-select: none; }`, `img,button { display:none !important; }`.
8. **R-14 build flag ships a module-scoped root handle** so Playwright can pierce closed roots; assert isolation in the e2e bundle *and* assert in the production bundle that `hostEl.shadowRoot === null` (proves `closed` actually shipped).

**Severity:** HIGH (correctness + isolation invariants INV-01/INV-02; CA-04 is a hard acceptance property).
**Phase:** **P-WIDGET** (+ fixture work in **P-DEPLOY**).

---

### H-3 · Hostile host CSS defeats naive widget CSS (CA-04)

**What goes wrong.** Distinct from H-2's *leakage*: here the host actively breaks the widget. `* { display: none !important; }` is CA-04's literal test, but the practical set includes `* { all: unset !important }`, `button { visibility: hidden !important }`, `img { display: none !important }`, universal `!important` resets (Tailwind/preflight-like or CSS "resets gone feral"), `* { pointer-events: none }`, `* { opacity: 0 !important }`, `* { animation: … infinite }`, `@media (prefers-reduced-transparency)`, and `html { filter: grayscale(1) }`. Shadow DOM protects internal selectors but **not** the host element, and `!important` in the *document* wins for the host element's own properties against `:host` rules (document origin `!important` > shadow `:host` normal).

**Why it happens.** Developers assume shadow DOM = total immunity. The boundary stops *selectors*; the host element itself is styled by the document, and inheritable properties flow in.

**Warning signs (early).** Widget invisible when the fixture loads a hostile reset; widget clickable area smaller than its visual area; host element's computed `display` not `block`; no `!important` in the widget's host-level declarations.

**Prevention (concrete) — the defensive set:**
```css
/* document-level, injected as the host element's inline style (inline + !important beats document rules incl. !important) */
:host-el {
  all: initial !important;            /* inline style: wins the host element */
  display: block !important;
  position: fixed !important;
  visibility: visible !important;
  opacity: 1 !important;
  width: auto !important; height: auto !important;
  z-index: 2147483647 !important;
  pointer-events: none !important;    /* host passes through, inner re-enables */
  transform: none !important; filter: none !important; contain: layout style; 
}
```
- Apply the hostile-proof declarations as the host element's **`style` attribute with `!important`** (per CSS cascade, inline `!important` outranks document author `!important`). This is the single highest-leverage trick and it costs ~0.3 KB.
- Inside the shadow root: rule #1 `* { all: initial; box-sizing: border-box; }`, `:host { all: initial; }`, then the explicit re-declaration list from H-2.1. Interactive wrapper re-enables `pointer-events: auto`.
- Do not use `<img>` for the widget button (hostile `img { display:none }`); use a `<canvas>`, CSS-drawn glyph, or inline SVG in the shadow root.
- Re-assert positions on `resize`, `orientationchange`, `scroll` (capture phase) because ancestors' `transform` can move you.
- `user-select: none; -webkit-user-select: none;` and `touch-action: manipulation` inside the widget so host `user-select: none`/gesture CSS doesn't break the editor.

**Severity:** HIGH (CA-04 is a hard acceptance property; failure is visible and embarrassing).
**Phase:** **P-WIDGET**.

---

### H-4 · `getDisplayMedia` as `CaptureSource` — platform cliffs nobody plans for

**What goes wrong.**
- **No iOS/iPadOS support at all** — `getDisplayMedia` is unavailable in every iOS browser (all are WebKit and WebKit does not implement it). A capture flow that assumes it silently loses an entire mobile population.
- **`preferCurrentTab` is Chromium-only** (Chrome/Edge 94+, Opera 80+; **not** Firefox, **not** Safari). Firefox offers no per-tab surface at all, so the share sheet shows "Entire screen / Window" and users routinely share their whole desktop into a bug report — an enormous privacy exposure.
- **`selfBrowserSurface: 'exclude'` and `preferCurrentTab: true` are mutually exclusive** (spec) — a code path that sets both throws or silently degrades.
- **Share-sheet UX**: permission cannot be persisted; every report raises a picker. In `preferCurrentTab` Chromium implementations the "This Tab" surface is *pre-selected* (older Chrome) or must be chosen — user confusion is the norm. The widget and the editor UI are **in the captured frame** (the whole tab is captured) → screenshots contain the Watchbug widget itself and, worse, the editor over the page. `selfBrowserSurface: 'exclude'` prevents *infinite mirror* but does not remove widget chrome from a current-tab capture.
- **Secure context required** (HTTPS or localhost) — a host page served over plain HTTP gets `undefined`/`NotAllowedError`.
- **Permissions-Policy / Feature-Policy**: a host sending `Permissions-Policy: display-capture=()` (or the older `feature-policy: 'display-capture' 'none'`, or simply not-self-listing, which defaults to `()` for cross-origin iframes) blocks it with `NotAllowedError`. The SDK runs in the top-level document normally, but if the host embeds it in an iframe the policy must allow it.
- **HiDPI sizing**: the captured `MediaStream` track's `getSettings().width/height` are *native device* pixels of the surface, while `video.getBoundingClientRect()` is CSS px; drawing `drawImage(video, 0, 0)` into a CSS-sized canvas produces a downscaled image and mask misregistration (H-1). Multi-monitor: a full-screen capture is sized to the *chosen screen's* resolution (5K screens → 5120×2880 frames).
- **Track lifecycle**: you must `track.stop()` after grabbing the frame or the "sharing" indicator stays live and the browser may keep the surface warm; grabbing via `ImageCapture`/`track.grabFrame()` vs drawing the `<video>` element differ in which frame you get (grabFrame is the true native-resolution frame).

**Warning signs (early).** Any code with `getDisplayMedia` and no feature test; no `catch` on `NotAllowedError`/`AbortError`/`InvalidStateError`; no UI copy explaining the picker; drawing `video` without reading `track.getSettings()`; `videoWidth` used as the bitmap width without DPR consideration; capture triggered without a user gesture (transient activation is required).

**Prevention (concrete).**
1. **Feature-detect and degrade**: `if (!navigator.mediaDevices?.getDisplayMedia)` → fall back to a **manual path** (user screenshots themselves and attaches the file via `<input type="file" accept="image/png,image/webp">`, or an optional DOM-serialization `CaptureSource` adapter per D-08). The fallback must be designed now, because iOS is not an edge case.
2. `preferCurrentTab: true` where supported (`'preferCurrentTab' in MediaStreamTrack.prototype`-ish probe or a try/catch with the constraint), and **never** set `selfBrowserSurface` alongside it. On Firefox set `video: { displaySurface: 'browser' }` as a hint and add UI copy: *"choose the browser tab, not your whole screen."*
3. **Hide the widget and editor chrome from the capture** — capture is triggered *after* the editor opens, so the editor is in the frame. Mitigations: (a) capture the frame first and open the editor over it (editor is a DOM overlay, not part of the already-captured bitmap — this is the correct order and also what C-2 requires), (b) set the widget host to `display:none` for the duration of the grab, (c) document that a *tab* capture includes the tab's own UI.
4. Always `track.stop()` in a `finally`, and grab the frame with `track.grabFrame ? await track.grabFrame() : drawImage(video)` to get native resolution; record `getSettings().width/height` and treat those as the bitmap space for H-1.
5. Document the `Permissions-Policy: display-capture=(self)" requirement for hosts that use iframes; detect the `NotAllowedError` and surface an actionable message rather than a silent failure.
6. Requires transient user activation — bind capture to the button click, not to `init()`.

**Severity:** HIGH (correctness + privacy exposure of whole-screen captures + total loss of mobile capture).
**Phase:** **P-CAPTURE** (adapter), user-facing copy in **P-WIDGET**, fallback path in **P-CAPTURE**/**P-EDITOR**. Feeds **Q-06** — the recommendation is `getDisplayMedia` with `preferCurrentTab` where available + file-attach fallback as the shipped pair, DOM serialization as the optional third adapter (D-08 constraints apply).

---

### H-5 · Screenshot size bombs, canvas limits and silent blank captures

**What goes wrong.**
- **Safari/iOS canvas area cap = 16,777,216 px** (4096×4096). Exceed it and `getContext('2d').fillRect` throws/logs *"Canvas area exceeds the maximum limit"* and `getImageData` throws `InvalidStateError: … Requested size was 4097 x 4096. Invalid state.` — i.e. **the canvas is created but unusable**, and the export silently produces a blank/transparent image. Chrome caps at 16384×16384 *area* (268,435,456 px) with 65535 max dimension.
- **DPR multiplication**: a 2560×1440 CSS viewport at DPR 3 is 7680×4320 = 33.2 MP — over Safari's cap before you've drawn anything, and a ~50 MB RGBA `ImageData` allocation on a low-end device.
- **Multiple simultaneous canvases** (base + preview + mask + undo snapshots, see C-2) trip Safari's *total canvas memory* cap ("Total canvas memory use exceeds the maximum limit") which kills *all* canvases in the page, including the host's — a spectacular way to break the host app.
- **Encoding bombs the other way**: a hostile or careless capture pipeline can produce enormous WebP/PNG payloads (large + low-quality setting + noise content = big files) that then blow the transport (H-9) and the API body cap (H-7).

**Warning signs (early).** Any canvas allocation without a size guard; `devicePixelRatio` used uncapped; `toBlob` without a quality/size post-check; no test at 4K and at DPR 3; errors from `getImageData` swallowed by a broad `try/catch`.

**Prevention (concrete) — downscaling policy:**
1. **Compute the bitmap size before allocating**: `scale = min(1, MAX_LONG_EDGE / max(w, h), sqrt(MAX_AREA_PX / (w * h)))`, `MAX_AREA_PX = 16_777_216` (Safari floor) and `MAX_LONG_EDGE = 3840` device px. Draw the source scaled into the bounded canvas in one `drawImage` (browser does the resample).
2. **Clamp DPR to 2** (`dpr = min(devicePixelRatio || 1, 2)`) — beyond 2 the extra pixels cost memory and bytes and do not improve triage readability.
3. **Target output ≤ 2560 px long edge** for the *encoded* image (1920×1080 typical). Store the scale factor + original viewport CSS size in metadata so the panel can annotate coordinates correctly.
4. **One canvas at a time** (C-2). Explicitly `canvas.width = 0; bitmap.close()` on teardown to release memory eagerly — `ImageBitmap` holds GPU/decoded memory until GC.
5. Wrap `getImageData`/`toBlob` in typed `try/catch` that **fails loudly to the user** ("Capture failed on this device — please attach a screenshot instead") rather than sending a blank image. Detect a blank result cheaply: sample 9 pixels; all-equal + full-alpha-0 ⇒ blank ⇒ abort and switch to the file-attach fallback (H-4).
6. **Post-encode byte cap** (see constants): if the blob exceeds it, re-encode at lower quality / smaller edge rather than sending it.

**Severity:** HIGH (correctness — silent blank captures are reported as "the widget does nothing"; memory pressure can crash the host tab).
**Phase:** **P-CAPTURE** (sizing) + **P-EDITOR** (memory discipline) + **P-DEPLOY** (4K/DPR-3 e2e).

---

### H-6 · Console capture: recursion, unbounded memory, and the secret firehose (Q-02)

**What goes wrong.**
- **Re-entrancy**: patching `console.log` and then calling `console.log` (or `JSON.stringify` triggering a `toJSON` that logs, or an error in the serialiser being logged by the patched `console.error`) re-enters the patch → infinite recursion → tab freeze. Sentry-class SDKs all carry an explicit guard for this reason.
- **Unbounded memory**: a chatty page (React dev warnings, WebSocket debug logs, a dev build with hot reload spam) emits thousands of lines/minute. Retaining raw argument references retains entire object graphs — one `console.log(responseObject)` pins a `Response`, its body, headers and any DOM nodes reachable from it. Retention of DOM nodes is the classic leak.
- **Secret leakage** (cross-ref C-5): the app itself logs tokens. Also `console.table`/`console.dir` on a store.
- **Descriptor fragility**: some engines expose `console` methods as accessors (getters) that create a fresh bound function each access; naive `const orig = console.log` + `console.log = wrapped` can throw in strict mode (read-only property) or silently not patch. `console` methods are not guaranteed writable/own properties.
- **Serialization cost**: stringifying large objects on every log line inside the patch is a main-thread hazard (RNF-01 promises no main-thread blocking), and `JSON.stringify` throws on cycles.

**Warning signs (early).** A `for (const m of ['log',…])` loop with no `Object.getOwnPropertyDescriptor` check; no boolean re-entrancy flag; an array with `.push` and no cap; serialization deferred to send time (retains references); `JSON.stringify` without cycle handling.

**Prevention (concrete) — Q-02 answer:**
```ts
let inCapture = false;
const raw = {};                       // saved originals, used for all SDK logging
for (const m of METHODS) {
  const d = Object.getOwnPropertyDescriptor(console, m) ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(console), m);
  const orig = d?.get ? d.get.call(console) : console[m];
  raw[m] = orig;
  const wrapped = (...args) => {
    if (!inCapture) { inCapture = true; try { pushEntry(m, args); } catch {} finally { inCapture = false; } }
    try { orig.apply(console, args); } catch {}
  };
  try { console[m] = wrapped; } catch {}   // read-only engines: degrade to no capture, never throw
}
```
- **Serialize eagerly at capture time** to a plain string (drop the references), depth-limited (3), cycle-safe (WeakSet), per-arg char-capped, with the C-5 secret scrubber applied at push time.
- **Bounded ring buffer, drop-oldest**, with three simultaneous caps (see constants): entry count, per-message chars, total buffer bytes. On overflow increment a `droppedCount` and surface "N earlier messages dropped" in the report — honest telemetry beats silent truncation.
- All SDK-internal logging goes to `raw.*`, never `console.*`.
- Patch only `log, info, warn, error, debug`; skip `trace/assert/table/dir/group*` (low value, high serialization cost). Register `window.addEventListener('error'/'unhandledrejection')` separately (that is where the bug signal actually is).
- Unpatch on teardown (`Watchbug.destroy()`), restoring the saved originals.

**Severity:** HIGH (perf/memory + privacy). Severity of the *secret* sub-case is critical but is owned by C-5.
**Phase:** **P-CAPTURE** (Enricher) + **P-CONTRACTS** (caps as schema constants).

---

### H-7 · Ingestion abuse past per-IP rate limiting (SEC-05, Q-02 sibling)

**What goes wrong.** `@fastify/rate-limit` per IP is necessary and insufficient:
- **IP identity is spoofable behind proxies**: if the limiter keys on `req.ip` without `trustProxy` configured correctly, an attacker sends `X-Forwarded-For` rotations and gets unlimited requests; conversely a mis-set `trustProxy` lets one attacker *frame* another IP (and a university NAT means one shared IP for many legitimate users — 429-ing them all is a self-inflicted outage).
- **Payload bombs**: 10 requests/minute × 50 MB bodies = 500 MB/min of disk and parse CPU. Rate limiting counts requests, not bytes.
- **Decompression / decode bombs**: a 40 KB WebP/PNG whose header declares (or whose decode expands to) 400 MP. PIL has `DecompressionBombWarning` at 89 MP / error at 178 MP for exactly this; Node image decoders have no such default. Server-side decode for re-encoding (C-3) is where this bites.
- **Multipart abuse**: unlimited parts, huge field sizes (a 5 MB title), filename/header CRLF.
- **Storage exhaustion**: the filesystem volume (R-04) has no quota; a flood fills the disk and takes PostgreSQL's WAL down with it.
- **Write-only key enumeration**: `project_key` is public by design (SEC-04) — it authenticates *writes*, so it must not gate any read, and rate limits must be per-key *and* per-IP to stop one leaked key from being a free firehose.

**Warning signs (early).** Body limit configured only at the framework default (1 MB or unset); no `Content-Length` pre-check; no cap on decoded pixels; `trustProxy` default; rate limit keyed on a single dimension; uploads written to disk before validation.

**Prevention (concrete).**
- **Layered limits** (values in the constants table): reverse-proxy/fetch-level body cap → Fastify `bodyLimit` → per-part cap → decoded-pixel cap → per-key rate limit → per-IP rate limit → per-project daily quota → volume quota/alerting.
- Reject on `Content-Length` **before** reading the body (return 413), and enforce a streaming byte counter that aborts mid-upload (bypassable `Content-Length`).
- Read image dimensions from the **header** before decode (WebP VP8/VP8L/VP8X and PNG IHDR give dimensions in the first 32 bytes); reject if `w*h > DECODE_MAX_PX` or `w > MAX_DIM`. Then decode with a hard pixel budget.
- `bodyLimit`, multipart `limits: { fileSize, files: 1, fields: 8, fieldSize, headerPairs }`, and store via a streaming `pipeline` to a temp file → validate → rename (never buffer whole files in RAM).
- Configure `trustProxy` **explicitly** and document the deployment posture; key the limiter on `project_key` (primary) + `clientIP` (secondary); return `429` with `Retry-After`.
- Daily per-project report quota (e.g. 2,000) as the coarse backstop; disk-usage metric + startup warning.

**Severity:** HIGH (security — DoS / availability; and it is the direct answer to Q-02's threat model).
**Phase:** **P-INGEST** (+ caps in **P-CONTRACTS**, proxy config in **P-DEPLOY**).

---

### H-8 · CSP, ad blockers and service workers block the SDK before it runs

**What goes wrong.** The SDK is a third-party script on someone else's origin:
- **`script-src` blocks the loader.** Hosts with `script-src 'self'` or a nonce-based policy (`'nonce-…'`, `'strict-dynamic'`) refuse a raw `<script src="https://watchbug.host/watchbug.js">`. With `'strict-dynamic'`, a nonce'd *loader* can then load us transitively; without it, we need to be on the allowlist or delivered as a first-party script (self-hosted file / same-origin reverse proxy — which *is* our deployment story, an advantage over SaaS).
- **`connect-src` blocks the ingestion POST** — a separate directive. Even if the script loads, the report silently fails. `img-src`/`worker-src`/`blob:` also matter if you use blob URLs or workers (a `blob:` worker needs `worker-src blob:` which falls back to `script-src`).
- **Style/`font-src`** matter if the widget loads webfonts (don't).
- **Ad blockers / EasyList / EasyPrivacy / uBlock Origin**: filter lists block known tracker domains *and* URL path patterns (`/analytics`, `/tracking`, `/rum`, `/log`, `/beacon`) and popular tracker script names. EasyPrivacy explicitly blocks "1st-party tracking, self-hosted trackers and CNAME trackers". A self-hosted instance on a customer domain is *harder* to block by domain but trivially blocked by path or by a generic `*/track/*` rule; a default `watchbug.*` demo domain will be on a list within months.
- **Service workers**: a host's own SW can intercept and drop our `fetch` (or its caching layer can serve a stale/failed response), and `fetch(..., { keepalive })` from inside a page controlled by an SW is subject to the SW's `fetch` handler. Also CSP `connect-src` is evaluated in the page, not the SW (unless the SW has its own CSP).
- **`Referrer-Policy`** affects what our POST's `Referer` carries (good for privacy — but if you log `Referer` server-side you may store a token-bearing URL; see C-5).

**Warning signs (early).** Docs that don't mention CSP at all; loader using `document.write`; no detection of the script having loaded; a single endpoint path named `/track` or `/analytics`; report send errors swallowed.

**Prevention (concrete).**
1. **First-party delivery is the primary mitigation and it is already our model**: the docs instruct hosts to serve `watchbug.js` from their own origin (or their CDN) and point `endpoint` at their own deployment. This defeats domain-based blocking and most CSP policies (`script-src 'self'`, `connect-src 'self'`).
2. **Document the exact CSP hosts must add** if they load cross-origin: `script-src https://<watchbug-host>; connect-src https://<watchbug-host>`, and note `'strict-dynamic'`/nonce implications (the host should nonce the loader tag).
3. **Neutral endpoint paths**: `/api/incidents` (already the contract name — good; keep it). Never `/track`, `/collect`, `/beacon`, `/analytics`, `/rum`. Avoid filenames like `analytics.js`; `watchbug.js` is fine.
4. **Fail loudly, not silently**: after loader execution, `window.Watchbug` must exist; the loader sets a sentinel and the docs give a one-line console check. Report send failures surface in the widget ("could not send — retry"), not only in the network tab.
5. **Service worker coexistence**: send via `fetch` with `keepalive`, and offer `navigator.sendBeacon` fallback on `visibilitychange` (both subject to caps — H-9). Document that a SW with a `fetch` handler must allow our endpoint; detect a swallowed request (send timeout) and surface it.
6. Provide a **snippet-less option**: `import` as an ESM module (R-02 already allows an ES-module export) so bundler-hosted apps ship us as part of their own bundle and inherit their own CSP.

**Severity:** HIGH (availability — the SDK silently does nothing, which reads as "the product is broken").
**Phase:** **P-CAPTURE/Transport in P-INGEST** (fallbacks + failure surfacing) + **P-DEPLOY** (integration docs: CSP recipe, SW note).

---

### H-9 · `fetch keepalive` / `sendBeacon` 64 KB body cap silently drops reports

**What goes wrong.** The `Transport` port defaults to `fetch + keepalive` (R-02). `keepalive` requests are limited to a **64 KiB request body** across all in-flight keepalive requests (the same limit applies to `navigator.sendBeacon`). A screenshot report is 60–800 KB. If the send is triggered during unload (or on a navigation) and the body exceeds the cap, the request is **rejected** (`TypeError`) — and if the code paths are only exercised in tests where the page doesn't navigate, this ships and only real users lose reports.

**Warning signs (early).** `keepalive: true` on the image upload path; `sendBeacon` used with the full payload; no code path that distinguishes "metadata-only flush" from "full report upload"; no e2e that navigates away immediately after submit.

**Prevention (concrete).**
- **Split the transport**: full report (image + JSON) via normal `fetch` **while the tab is alive** — which is the natural case, since the user is sitting in the editor; `keepalive`/`sendBeacon` reserved for a ≤ 60 KB *metadata-only* fallback flush or a "report pending" marker.
- Validate the final encoded size against the cap before choosing the path (H-5's post-encode cap).
- Handle `TypeError` from `keepalive` explicitly by retrying non-keepalive, then telling the user "keep this tab open until the report is sent" with a visible progress state.
- e2e assertion: submit and immediately `page.goto(...)`; assert the API stored the report (or that the widget showed the retry prompt) — never a silent drop.

**Severity:** HIGH (correctness — silent data loss on the product's core action).
**Phase:** **P-INGEST** (`Transport`) + **P-DEPLOY** (e2e).

---

## Medium-Severity Pitfalls

### M-1 · GDPR reality checks on R-09 / R-10 (identity on by default)

**What goes wrong.** Everyone under-collects the obligations here:
1. **The screenshot is personal data**, not just `user.*`. Names, faces, avatars, account numbers, internal URLs and other people's PII are in the pixels and in the console log. **R-10's "purge `user.*` after 30 days, keep the report anonymised" does not anonymise the image or the logs.** The retention policy must cover the attachment and `consoleLogs`, not only the identity columns, or the claim "we anonymise" is false.
2. **"On by default, opt-out" (R-09) needs a lawful basis.** Under GDPR Art. 6, legitimate interest (6(1)(f)) requires a documented **LIA** and an objection mechanism; consent (6(1)(a)) must be freely given — and an SDK that silently ships identity by default inside a third-party site is exactly the fact pattern DPAs push back on. The safer posture: identity is sent only when the host supplies it **and** the host has a legal basis; document this as the host's responsibility and provide the opt-out as a documented, tested flag. (Note: ePrivacy/cookie rules can attach to *reading* data — SEC-03's "never read host cookies" is therefore doing double duty. Keep it absolute.)
3. **Art. 13 information duty** — R-09 correctly says the notice belongs in integration docs. But the *host* is the controller; Watchbug (self-hosted) is their processor. What people get wrong: shipping no Art. 28 **DPA template** and no record-of-processing support, which is what the controller actually needs to lawfully deploy you.
4. **Erasure must reach backups and the volume** (R-04). "Delete the row" leaves the blob on disk and the row in `pg_dump` archives. Manual delete must delete the file too, and the backup story must be documented.
5. **Auto-purge must be a real scheduled job with evidence** — a `purged_at` column and a log line. "We'll run a cron" that nobody verifies is a finding at audit time.
6. **Screenshots of third parties**: the end user reporting a bug may capture *another user's* data (a shared screen, a support agent's view). Masking (C-1) is the mitigation; say so in the user-facing prompt.

**Warning signs (early).** Retention job scoped to `users` table only; no DPA/Art.28 doc; privacy page that says "we store no personal data"; identity fields with no index for the purge query; blob delete not called from the delete-report handler.

**Prevention (concrete).** Extend R-10 to **image + consoleLogs + identity** with separate TTLs (identity 30 d, artifacts 90 d, both configurable, both evidenced in a `purge_runs` table); ship a `DPA` / Art. 28 processor terms template and an Art. 13 notice snippet in the integration docs; make the erasure path delete `Storage` blobs (R-04 adapter must expose `delete`); document backup retention honestly. Flag this as a **refinement of R-10, not a re-decision** — R-10 is right in direction and incomplete in scope.

**Severity:** MEDIUM (regulatory; becomes HIGH the moment the panel holds real user data).
**Phase:** **P-CONTRACTS** (TTL fields) + **P-INGEST** (purge job + blob delete) + **P-PANEL** (manual erase UI) + **P-DEPLOY** (docs).

---

### M-2 · Bundle-budget erosion: the dependencies that quietly eat 45 KB gz

**What goes wrong.** The budget dies by a thousand imports:
- **Locale/ICU data**: `moment` drags **all** locales (~70 languages) unless `IgnorePlugin`/`ContextReplacementPlugin` prunes them; `date-fns` is per-function but a handful of format tokens can pull half the lib; `Intl.*` locale data for `Intl.PluralRules`/`RelativeTimeFormat` is large unless lazily imported per active locale. **Both en + es bundled for i18n (RNF-03) doubles your message catalogue.**
- **`core-js` / polyfill bundles**: `import 'core-js'` is ~20 KB gz of features you cannot tree-shake; per-feature imports are required, and preset-env with `useBuiltIns: 'usage'` can inject polyfills into every module.
- **CSS-in-JS** (styled-components/emotion): runtime + serializer + vendor prefixing (~12–18 KB gz) and **no tree-shaking** of the runtime. Fatal for a 45 KB budget and architecturally wrong inside a shadow root (it wants to write to `document`).
- **Utility libs by root import**: `import _ from 'lodash'` (~24 KB gz full) vs `lodash/debounce` (~1 KB). Same for date/timezone (`moment-timezone` data tables), `uuid` (use `crypto.randomUUID()`), `eventemitter3`-style shims.
- **Transitive deps with `sideEffects` unmarked** defeat tree-shaking entirely; a single `"sideEffects": false`-less deep dependency drags its whole module graph in.
- **Misleading published sizes**: min+gzip of a library is not its *marginal* cost — deep graphs, duplicated helpers and polyfill checks inflate real deltas. Measure the *diff* of `check:size` on every dependency PR, never the library's README number.
- **Dev/verbose builds**: shipping unminified or with `process.env.NODE_TYPE` unreplaced; source maps inlined.

**Warning signs (early).** `npm run check:size` only running at the end of a milestone instead of on every PR (a budget enforced late is a budget missed); size diff not shown per PR; any dependency added without a recorded gz delta in the resolution record (which is a mentorship-pack §5.1 dead-end requirement anyway); `import { x } from 'huge-lib'`; both locales in the core bundle.

**Prevention (concrete).**
- **Zero runtime dependencies in `watchbug.js`** (R-01 already forces this in spirit — make it literal). Hand-roll: ~30 lines of date formatting (`Intl.DateTimeFormat` with `en`/`es` only), a tiny emitter, own debounce.
- **Locale messages as lazy chunk per locale**; load only the active one. Do not bundle an i18n framework — a 30-line key→string map is enough for widget copy.
- esbuild with `format: 'iife'`, `minify: true`, `target: 'es2020'` (R-15's ES2020 is right), `define: { 'process.env.NODE_ENV': '"production"' }`, `treeShaking: true`, `legalComments: 'none'`.
- **`check:size` runs in CI on every PR and prints the per-entrypoint gz delta** (45 / 25 / 80 tiers per R-01). Any PR that grows `watchbug.js` must state the delta in the commit body (fits the merge-readiness pack).
- Keep a `docs/size-ledger.md` mapping each module to its gz cost so an unplanned jump has an owner.

**Severity:** MEDIUM (a hard gate (CA-03) makes this recoverable — but only if the gate runs early and often).
**Phase:** **P-CONTRACTS** (tooling early) + enforced through **P-DEPLOY**.

---

### M-3 · WebP encode is not universal — R-11's fallback must be *detected*, not assumed

**What goes wrong.** `canvas.toBlob(cb, 'image/webp', 0.8)` does not fail on unsupported browsers — **it silently returns a PNG blob** (the spec's "if the type is unsupported, use PNG" behaviour), and some Safari versions have had no WebP *encoder* even where the decoder exists. The server then validates `Content-Type: image/webp` against bytes that are actually PNG (or stores a `.webp` file with PNG bytes), and the C-3 magic-byte check rejects your own legitimate reports. Alternatively a sniffer-based check passes but the byte size is 5× the budget you planned (R-11's storage math assumed WebP).

**Warning signs (early).** `toBlob` called without inspecting `blob.type`; a single hardcoded extension; no e2e on WebKit; size estimates in the docs that assume WebP.

**Prevention (concrete).** After `toBlob`, read `blob.type`; if `blob.type !== 'image/webp'` re-run with `'image/png'` (or accept the PNG) and set the payload's declared format from **`blob.type`**, never from the requested parameter. Server-side: sniff magic bytes and store with the *verified* extension + `Content-Type`. Add a Playwright **WebKit** project so both encoders are exercised.

**Severity:** MEDIUM (interoperability).
**Phase:** **P-EDITOR**/**P-CAPTURE** (encode) + **P-INGEST** (verification) + **P-DEPLOY** (WebKit e2e).

---

### M-4 · `Secure` cookies and CSRF on the self-hosted panel (SEC-06)

**What goes wrong.** SEC-06 mandates `Secure` cookies. On a demo deployment served over plain HTTP (which `docker-compose up` on a LAN or a VPS without TLS produces), the browser **silently refuses to store** the `Secure` cookie → the admin logs in and is immediately logged out again, with no error. Second: JWT-in-cookie auth with `SameSite=Lax` is CSRF-resistant for cross-site POSTs but **not** for top-level GET navigations — any state-changing GET route (`GET /api/incidents/:id/resolve`) is CSRF-able. Third: no CSRF token on the login form enables **login CSRF** (an attacker logs the victim into the attacker's account and harvests what they type).

**Warning signs (early).** Any `GET` route with side effects; `SameSite` unset; no `__Host-`/`__Secure-` cookie prefix; the dev quickstart using `http://`; JWT with no TTL or with a very long one.

**Prevention (concrete).** All mutations are `POST/PATCH/DELETE` (never GET) + `SameSite=Lax` (or `Strict`) + a `Sec-Fetch-Site` check or double-submit CSRF token; cookie `Secure; HttpOnly; SameSite=Lax; Path=/; __Host-` prefix; JWT TTL ≤ 8 h with refresh-on-use; document a TLS requirement (or a documented `WATCHBUG_COOKIE_SECURE=false` dev flag that is loudly warned about) so the demo works and production is safe. Argon2id params documented (memory ≥ 19 MiB, t=2, p=1) with bcrypt fallback per SEC-06.

**Severity:** MEDIUM (security; higher if the panel is internet-exposed).
**Phase:** **P-PANEL**/**P-INGEST** auth + **P-DEPLOY** (TLS docs).

---

### M-5 · Canvas tainting kills the masking path on any DOM-derived capture

**What goes wrong.** If a `CaptureSource` adapter ever draws DOM-derived pixels (the D-08 optional adapter, or a cross-origin `<img>`/`<video>`/CSS `background-image` in a future DOM capture), the canvas becomes **tainted** and `getImageData` throws `SecurityError`. Because masking *must* read `ImageData` (SEC-02), the throw happens at the worst moment — the user has finished annotating and hits send. D-08 already records the silent-failure class; the distinct risk here is a **late, total failure in the redaction path**, and `drawImage` of a tainted source does not warn before the `getImageData` throw.

**Warning signs (early).** Any `new Image()` without `crossOrigin` in the SDK; a `CaptureSource` that is not `getDisplayMedia`/`grabFrame` (which are origin-clean by construction); broad `catch {}` around the send pipeline.

**Prevention (concrete).** For any DOM-based adapter: request `crossOrigin='anonymous'` on every drawn image and **pre-flight a 1×1 `getImageData` probe immediately after first draw** — if it throws, abandon that capture with the file-attach fallback. Keep the primary capture path (`getDisplayMedia` frame → canvas) which is origin-clean. Never let the masking pipeline have an unguarded `getImageData`.

**Severity:** MEDIUM (correctness; confined to non-default adapters).
**Phase:** **P-CAPTURE** (adapter contract).

---

### M-6 · Closed shadow root observability gap (R-14 corollary)

**What goes wrong.** With `mode: 'closed'` (R-14), a runtime error inside the widget has no DOM anchor in DevTools, host-page error monitors attribute it to `watchbug.js:1` with no context, and e2e cannot assert internal state. Teams then quietly ship `open` in production "just for now". R-14's `SHADOW_MODE` build flag prevents that for e2e, but nothing yet covers **production diagnostics**.

**Warning signs (early).** Support threads with "the button is blank" and no way to reproduce; a debug flag that requires a rebuild; error reports with empty stacks.

**Prevention (concrete).** Ship `Watchbug.version` + `Watchbug.diagnostics()` returning a small safe state snapshot (locale, last capture size, last send status, dropped log count) — no user data (C-5) — and have the widget render a visible error state ("Watchbug failed to initialise — see console") instead of nothing. The e2e bundle keeps the `SHADOW_MODE` flag (R-14). Do not add a runtime open/closed switch (that reopens a §3 restricted decision for no production gain).

**Severity:** MEDIUM (operability).
**Phase:** **P-WIDGET** + **P-DEPLOY**.

---

## Recommended Concrete Constants

| Constant | Value | Reasoning |
|---|---|---|
| **Mask primitive (automatic / SEC-01)** | Flat opaque fill, `alpha 255`, single colour `#111827` | Only trivially irreversible primitive. Pixelation preserves per-block means recoverable for text (C-1). |
| **Mask primitive (user tool)** | Block pixelation, opt-in | Matches R-13; must still satisfy block/region rules below. |
| **Pixelation block size** | `max(8, 2 × cap-height)` device px | R-13 floor is 8 px; ≥2× cap-height defeats glyph-energy recovery. 8 px alone is breakable for UI text. |
| **Mask region geometry** | Snapped **outward** to integer bitmap px *and* to the block grid; alpha 255 | Partial blocks at the boundary leak a distinct averaging window (Unredacter's break). |
| **Mask application point** | On `ImageData` before encode, then re-encode lossy | SEC-02 literal; compression then quantises away residual gradient. Overlays prohibited (SEC-02). |
| **Blur** | **Prohibited** | R-13 / D-06. Linear + deconvolution; also HMM-recoverable. |
| **Canvas area guard** | `16,777,216` px (`4096×4096`) hard max | Safari/iOS cap — exceeding it makes `getImageData` throw `InvalidStateError` and yields blank exports. Chrome's cap is higher; use the floor. |
| **Max bitmap long edge** | 3840 device px (target encode 2560) | Covers 4K surfaces; keeps `ImageData` ≤ ~40 MB worst case, far less after DPR clamp. |
| **DPR clamp** | `min(devicePixelRatio, 2)` | Beyond 2: no triage value, linear memory/byte cost, and it multiplies the area bomb. |
| **Encoded image max** | Target ≤ 800 KB; hard cap 2 MB; retry-encode at q 0.6 / 0.5 then downscale 0.75× | Keeps a report well under transport caps (H-9) and API caps (H-7). WebP q 0.8 start per R-11. |
| **Console ring buffer** | 200 entries, drop-oldest | Bounds memory on chatty pages; 200 lines is the useful triage window. |
| **Console per-message / per-arg cap** | 2,048 chars / 1,024 chars, depth 3, cycle-safe | Answers **Q-02**. A 5 MB log line becomes a 2 KB line. Depth 3 covers `{ config: { headers: … } }` shapes without dragging object graphs. |
| **Console total buffer** | 64 KB serialized | Aligns with the `keepalive`/`sendBeacon` 64 KiB cap so a metadata-only flush always fits (H-9). |
| **Console methods patched** | `log, info, warn, error, debug` only | Low value / high serialization cost for `table/dir/group/trace/assert`. |
| **Field caps (payload)** | title 200 chars, description 5,000, `user.name` 120, `user.email` 254, `user.id` 64, URL path 2,048, extra `Enricher` values 512 | Bounds the XSS/DoS surface at the schema level (C-3, H-7) and makes caps enforceable in `packages/contracts`. |
| **Ingestion rate limits** | 10 req/min per `project_key`, 30 req/min per IP, 2,000 reports/day per project | Per-key stops one leaked key; per-IP stops keyless floods; daily quota is the storage backstop. Document the NAT caveat (university/office egress) and allow env tuning. |
| **Ingestion body caps** | `bodyLimit` 5 MB total, 4 MB per file part, 1 KB per header pair, `files: 1`, `fields: 8`, `fieldSize: 4 KB` | A report is image + small JSON; multipart bombs are cut at the parser. Reject on `Content-Length` (413) before reading. |
| **Decoded image cap** | `w,h ≤ 8192` and `w*h ≤ 25,000,000` px, checked from headers before decode | Defeats decompression bombs (PIL warns at 89 MP / errors at 178 MP — be stricter). 25 MP ≈ 100 MB RGBA ceiling. |
| **Image types accepted** | `image/webp`, `image/png` **only**, verified by magic bytes + header dims. **SVG rejected unconditionally** | C-3. SVG is an active text format that magic-byte sniffing misclassifies. Re-encode on ingest where feasible (destroys polyglots/EXIF/trailing data). |
| **Blob serving headers** | verified `Content-Type` + `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment` (or sandboxed iframe) + `CSP: default-src 'none'; sandbox` + `CORP: same-origin` | C-3/C-4. Kills content-sniffing XSS and cross-origin embedding. |
| **Blob filenames on disk** | `<uuid>.<verified-ext>`, validated `^[0-9a-f-]{36}\.(webp\|png)$`; resolved-path prefix assertion | C-4. Client names are metadata only, never paths. |
| **Retry policy** | 3 attempts, backoff 1 s / 4 s / 10 s with ±25 % jitter, per-attempt timeout 15 s; idempotency key = client-generated report UUID; then fail to visible UI state | Idempotency key makes retries safe against duplicates (rate limits make duplicates expensive). No `localStorage` persistence of pending reports (would re-open a C-5/privacy surface); the tab stays open with a visible "retrying" state instead (H-9). |
| **Transport split** | Full report = plain `fetch` while tab alive; `keepalive`/`sendBeacon` only for ≤ 60 KB metadata-only flush | `keepalive` and `sendBeacon` hard-cap request bodies at 64 KiB — larger payloads are rejected outright (H-9). |
| **Retention TTLs** | identity 30 d (R-10), image + `consoleLogs` 90 d, both env-configurable, both evidenced in a `purge_runs` table | M-1. "Anonymised report" is false if pixels/logs still identify someone. |
| **JWT / session** | TTL 8 h, sliding refresh; cookie `__Host-wb_session; HttpOnly; Secure; SameSite=Lax; Path=/` | SEC-06. `__Host-` prefix blocks subdomain cookie injection. |
| **Widget z-index** | `2147483647` (inline `!important` on host) | Maximum `z-index`; inline `!important` outranks document `!important` (H-3). |
| **Budget tiers** | 45 / 25 / 80 KB gz (R-01), enforced per-PR with printed delta | Erosion is invisible without a per-PR diff (M-2). |

---

## Sources & Confidence

Confidence tiers obtained from the `classify-confidence` seam: `websearch` = **LOW** standalone, **MEDIUM** when cross-verified; `webfetch` = **LOW**. Findings below marked **MEDIUM** are cross-checked across ≥ 2 independent sources (cached in the research store). No HIGH claims are made — no primary-source browser-behaviour audit has been run yet.

| # | Finding | Sources | Confidence |
|---|---------|---------|------------|
| C-1 | Blur/pixelation of text is recoverable (HMM, brute-force, video averaging) | Shacham et al., *On the (In)effectiveness of Mosaicing and Blurring as Tools for Document Redaction* (hovav.net/ucsd/dist/redaction.pdf — academic, peer-reviewed venue); Bishop Fox *Never Use Text Pixelation To Redact* + **Unredacter**; Positive Security *Recovering redacted information from pixelated videos* + **Underactor**; **Depix**; Dark Reading coverage | **MEDIUM** (4+ independent cross-checks incl. one academic) |
| C-1 | Solid-bar/font-metric + JPEG-artifact residual leaks | Naccache & Whelan (Eurocrypt 2004 rump), Ho & Chang — as cited in the Shacham et al. paper | **MEDIUM** (single academic secondary citation) |
| C-2 | Undo stack / layer-stack export retains originals | Engineering consensus across editor architectures; no single canonical write-up | **LOW–MEDIUM** (reasoned from first principles + widespread editor patterns; treat as design guidance) |
| C-3 | SVG/polyglot upload XSS; magic bytes miss text formats; `nosniff` + `Content-Disposition` required | PortSwigger Web Security Academy *File upload vulnerabilities*; Invicti *XSS via file upload*; CVE-2026-40262 write-up (magic-byte + missing `nosniff`); Vaadata file-upload hardening; HackerOne phpBB SVG-worm report | **MEDIUM** |
| C-4 | Path traversal on filesystem blob serving | OWASP/class consensus + R-04's own hard requirement | **MEDIUM** (well-established class; specific to our `Storage` adapter) |
| C-5 | Secrets leak via logs/URL/env collectors | SEC-03 framing + common redaction practice | **LOW–MEDIUM** |
| H-1 | DPR/zoom mask misregistration | Canvas coordinate-space semantics; standard CSS/canvas behaviour | **LOW–MEDIUM** (reasoned; verify with the DPR e2e) |
| H-2 | Shadow DOM inheritance, custom props, `all: initial` traps, `rem`, transform containing blocks | web.dev *Shadow DOM v1* (inheritable styles pierce; `all: initial` reset pattern); *Isolating CSS Inheritance* (blog.dwac.dev); MDN CSS custom properties (inheritance + invalid-variable trap + `@property` not applying in shadow roots — Tailwind #167772 confirms `@property` is inert inside shadow roots); *Things Shadow DOM does not isolate* (dev.to — `rem` resolves to host root) | **MEDIUM** (4+ independent, incl. MDN/web.dev primary docs) |
| H-3 | Hostile host CSS / CA-04 defence | Cascade semantics (inline `!important` > document `!important` > `:host` normal) + web.dev guidance | **MEDIUM** |
| H-4 | `getDisplayMedia` cliffs | MDN `getDisplayMedia` (preferCurrentTab non-standard & Chromium-only; `selfBrowserSurface` mutually exclusive with `preferCurrentTab`; permission not persistable); caniuse (`getDisplayMedia` desktop-only; `preferCurrentTab` Chrome/Edge 94+/Opera 80+ only); AddPipe *Screen sharing a single tab*; Chrome screen-sharing-controls docs; CobaltCapture support table (iOS unsupported) | **MEDIUM** (MDN + caniuse + Chromium docs cross-verified) |
| H-5 | Safari 16,777,216 px canvas area cap, `InvalidStateError` on `getImageData`, total-canvas-memory limits | Pqina *Canvas area exceeds the maximum limit* + *Total canvas memory use exceeds the maximum limit*; `canvas-size` test results tables (Chrome 268,435,456 px area / 65,535 dim; Mobile Safari 4096×4096); ngx-extended-pdf-viewer & react-pdf issue reproductions | **MEDIUM** (measured data + multiple reproductions) |
| H-6 | Console patching re-entrancy, bounded buffers, eager serialization | getsentry/sentry-javascript monkey-patching discussion (#946); established SDK practice; general JS memory-leak literature (Auth0 leak classes, nlawson) | **MEDIUM** (pattern consensus) |
| H-7 | Rate limiting insufficient alone; decompression bombs; `trustProxy`; multipart limits | Invicti *Definitive Guide to Application Level DoS*; jacobian.org *Not all attacks are equal*; PIL `DecompressionBombError` (paperless-ngx #416 — 376 MP bomb); Brotli decompression bomb (huntr); rate-limiting practice guides | **MEDIUM** |
| H-8 | CSP / ad blockers / SW blocking third-party scripts | EasyList/EasyPrivacy README (blocks 1st-party & self-hosted trackers, CNAME); CSP `script-src`/`connect-src`/nonce/`strict-dynamic` guidance (Google Tag Manager CSP guide, MDN); cookie-script CMP/adblocker conflict notes; Cloudflare Web Analytics blocked-by-blockers threads | **MEDIUM** |
| H-9 | `keepalive` / `sendBeacon` 64 KiB body cap | Fetch spec `keepalive` limit + `sendBeacon` quota (MDN); well-documented in the beacon literature | **MEDIUM** |
| M-1 | GDPR scope (image = personal data, LIA vs consent, Art. 13/28, erasure in backups) | gdpr-info.eu Art. 6; EDPB *Guidelines 1/2024 on legitimate interest*; gdpr.eu controller/processor definitions; Cookiebot/CMP guidance on embedded third parties | **MEDIUM** (regulatory sources are primary; **not legal advice** — flag for the TFG supervisor if a compliance claim is made) |
| M-2 | Bundle erosion patterns | moment/webpack locale threads (#68603977), luxon tree-shaking (#854); *Don't trust JS library size, min+gzip* (thoughtspile); Codecov/PkgPulse bundle-size guides; Intl locale lazy-loading pattern | **MEDIUM** |
| M-3 | `toBlob('image/webp')` silently falls back to PNG | Canvas spec "if type unsupported, use PNG"; multiple Safari WebP-encode threads (2026 reports of iOS Safari lacking `image/webp` in canvas) | **LOW–MEDIUM** (verify on WebKit in the P-DEPLOY e2e) |
| M-4 | `Secure` cookie on HTTP; GET-mutation CSRF; login CSRF | Cookie spec (`Secure` ignored/dropped on non-secure origins); OWASP CSRF cheat-sheet | **MEDIUM** |
| M-5 | Canvas tainting → `SecurityError` on `getImageData` | Canvas spec origin-clean rules | **MEDIUM** |

**Confidence Assessment by area**

| Area | Level | Reason |
|------|-------|--------|
| Masking / redaction reversibility (C-1, C-2) | MEDIUM | Attacks are published and reproducible; the *architecture* pattern for C-2 is reasoned rather than sourced |
| Isolation (H-2, H-3) | MEDIUM | MDN/web.dev primaries; the belt-and-braces set needs one hostile-fixture spike to confirm |
| Capture platform (H-4, H-5) | MEDIUM | MDN/caniuse/measured canvas-size data; iOS gap is unambiguous |
| Telemetry (H-6, C-5) | MEDIUM | Established SDK practice; scrubbing regexes are a denylist and must sit behind the closed schema |
| Ingestion / panel security (C-3, C-4, H-7, M-4) | MEDIUM | Well-established vulnerability classes; specifics must be re-checked against the actual Fastify/Drizzle versions chosen (R-15 leaves versions open) |
| Distribution (H-8, H-9) | MEDIUM | Spec-level facts (64 KiB cap) are firm; filter-list behaviour drifts over time |
| GDPR (M-1) | MEDIUM | Primary regulatory sources; **flagged as needing human/legal review before any compliance claim** |

**Gaps to address later**
- No spike has confirmed the belt-and-braces CSS set (H-2/H-3) against a real hostile fixture — this is the natural first task of **P-WIDGET**.
- Exact dependency versions (Node, Fastify, Drizzle, Postgres, React) are open per R-15; security guidance for those versions must be re-verified against live docs during phase planning.
- C-2's prevention pattern (mask-as-destructive, annotation-as-vector) has not been validated for *undo UX* with real users — resolve in **P-EDITOR** design, and note that a mask-undo feature is a §3-adjacent privacy decision if proposed.
- M-3 must be measured on WebKit before R-11's storage estimates are relied on.
- Filter-list (EasyList/EasyPrivacy) matching behaviour for self-hosted paths should be re-tested at release time (H-8) — lists change.
