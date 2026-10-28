---
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
reviewed: 2026-10-24T17:55:38Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - documentation/resolution-record.md
  - e2e/deploy.spec.ts
  - e2e/fixtures/hostile-host.html
  - e2e/helpers/capture-stubs.ts
  - e2e/helpers/host-fixtures.ts
  - e2e/sdk.spec.ts
  - packages/sdk/scripts/build.mjs
  - packages/sdk/src/capture/capture-source.ts
  - packages/sdk/src/capture/pipeline.ts
  - packages/sdk/src/globals.d.ts
  - packages/sdk/src/image/encode.ts
  - packages/sdk/src/index.ts
  - packages/sdk/src/redact/geometry.ts
  - packages/sdk/src/redact/patterns.ts
  - packages/sdk/src/redact/redactor.ts
  - packages/sdk/src/strings.ts
  - packages/sdk/src/transport/lane1.ts
  - packages/sdk/src/widget/host.ts
  - packages/sdk/src/widget/launcher.ts
  - packages/sdk/src/widget/status-panel.ts
  - playwright.config.ts
findings:
  critical: 3
  warning: 3
  info: 3
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-10-24T17:55:38Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Full read of all 21 in-scope files, cross-referenced against `02-SECURITY.md`'s
threat register, `.planning/REQUIREMENTS.md` (PRV-01…06, CAP-01…05), `scripts/gate.mjs`
and the e2e rows that pin each claim. The pipeline's structural security properties
hold: `CaptureSource` can only yield `ImageData`, `redactor.redact()` runs strictly
before the single encode sink, a redaction error short-circuits before encode/send
(T-02-10 fail-closed), `credentials: 'omit'` is the only credentials form, the
idempotency key is minted once per logical report and reused across the automatic
retry loop *and* the manual `pendingSend` retry, and host/launcher/panel isolation
matches the inline-`!important` contract the hostile-CSS matrix asserts.

The defects are all in the *reach* of those controls rather than in their ordering:
three ways unmasked or unintended data still reaches the wire (a `Referer` header
that re-opens the R-08 query-string hole; a card-pattern false negative that is
reproducible today; a DOM scan that stops at the top document's light DOM), plus
three robustness gaps in geometry timing, the ESM endpoint default and the
idempotency-key fallback. Two of the three criticals contradict threats the phase
already registered as *closed* (T-02-08, T-02-12), so this is not speculative
hardening — the register over-claimed.

## Narrative Findings (AI reviewer)

### Critical

#### CR-01: Report POST re-leaks the page's query string in the `Referer` header (external: prv06-referrer)

**File:** `packages/sdk/src/transport/lane1.ts:141-150`
(also `e2e/sdk.spec.ts:1967-1988`, `e2e/sdk.spec.ts:2108-2111`, `e2e/sdk.spec.ts:2193-2199`)

**Issue:** `fetch(...)` sets `credentials: 'omit'`, `X-Project-Key` and
`Idempotency-Key`, but no `referrerPolicy`. The browser therefore attaches a
`Referer` derived from the *host document's* referrer policy, and the platform
default (`strict-origin-when-cross-origin`) sends the **full URL including the query
string** on a same-origin request. Same-origin is the SDK's documented default shape:
`defaultEndpoint()` is the loading script's origin (`index.ts:80-87`), and the
ad-blocker guidance explicitly recommends neutral same-origin paths (`/w.js`,
`/api/incidents`).

So `?token=…&code=…&session=…` leaves the browser on every report — exactly what
R-08 exists to prevent ("Stripping is a blunt, total mitigation"), and exactly what
PRV-06 claims as done ("query strings and fragments are stripped **before
transmission**"). The SDK strips `meta.url` (`lane1.ts:95`) but not the header the
browser composes. `02-SECURITY.md` closed **T-02-12** ("URL query/fragment leaking
tokens into meta") on `location.pathname` alone, and **T-02-11** ("only two headers
ride") — both claims are false at the wire: `BROWSER_STANDARD_HEADERS` in the PRV-05
row even allowlists `referer` (line 1979), and the PRV-06 row only asserts `meta.url`,
never the intercepted headers, so no test can catch this. Fragments are never sent in
`Referer` (spec), so the leak is the query half — which is the half R-08 names
(`?token=`, `?code=`, `?session=`). The API's own `Referrer-Policy: same-origin`
response header does not help: a response policy governs documents *served from* that
origin, not requests *made to* it from a host page.

**Fix:**

```ts
// lane1.ts — inside the fetch init, next to credentials: 'omit'
response = await fetch(`${options.apiBase}/api/incidents`, {
  method: 'POST',
  headers: {
    'X-Project-Key': options.projectKey,
    'Idempotency-Key': options.idempotencyKey,
  },
  body: form,
  credentials: 'omit',
  // R-08: the query string must not leave the browser in a *header* either —
  // the host page's Referrer-Policy is untrusted input (TB-1).
  referrerPolicy: 'no-referrer',
  signal: controller.signal,
});
```

Harden the suite so it cannot regress silently: in the PRV-06 row assert
`expect(calls[0].headers['referer'] ?? '').not.toContain('token=secret')` (or that
the header is absent), and stop treating `referer` as unconditionally safe in the
PRV-05 allowlist. Re-open T-02-11/T-02-12 in `02-SECURITY.md` until the header is
asserted.

---

#### CR-02: Card pattern silently skips a valid card once the digit run is glued to neighbouring digits — two adjacent valid cards mask nothing (external: card-glue-fn)

**File:** `packages/sdk/src/redact/patterns.ts:69` and `packages/sdk/src/redact/patterns.ts:95-97`
(plus the retry loop at `packages/sdk/src/redact/redactor.ts:65-74`)

**Issue:** `CARD_SHAPE = /\b(?:\d[ -]?){12,18}\d/g` treats a single space or dash as a
card separator, so it happily *glues* a card to whatever digits follow it, and the
greedy match caps at 19 digits. `luhnValidCardRun()` then strips non-digits and calls
`luhnValid()` on the whole glued core — which returns `false` outright for a core
longer than 19 digits, and fails by checksum for a glued core of ≤19. On validation
failure `regex.exec()` advances `lastIndex` to the **end** of the failed match (the
`match.index + 1` branch only fires for zero-length matches), so no shorter or later
interpretation of the digits inside that span is ever tried.

Reproducible with the file's own regex + validator (executed, not reasoned):

| text node | masked today |
|---|---|
| `4111111111111111 4242424242424242` (two valid cards) | **no** |
| `4111-1111-1111-1111 5454-5454-5454-5454` | **no** |
| `4111111111111111 1234` | **no** |
| `4111111111111111-2026` | **no** |
| `4111111111111111` (isolated) | yes |

This is precisely the failure mode the threat register says is closed: **T-02-08**
(severity *critical*, disposition *mitigate/closed*) rests on "card shape gated by
hand-rolled `luhnValid()`", and P2-D-09 states "a false negative is a leak". The
e2e row (`PRV-02: a Luhn-valid card sequence masks while its Luhn-invalid lookalike
stays visible`) only exercises *isolated* cards, so the suite is green over the hole.
Since one validated match masks the whole text node, a single fix here also covers the
whole-node granularity guarantee (P2-D-08).

**Fix:** validate *separator-delimited digit groups* and adjacent-group
concatenations instead of one glued core. Verified against both locked behaviours
(the valid card masks, the `4242424242424241` lookalike stays visible) and all four
leaking inputs above:

```ts
/** Luhn each digit group, plus adjacent-group joins of 13–19 digits — a greedy
 *  match may glue a card to trailing digits or to a neighbouring card. */
function luhnValidCardRun(match: string): boolean {
  const groups = match.split(/[^0-9]+/).filter((group) => group.length > 0);
  const candidates: string[] = [...groups];
  for (let start = 0; start < groups.length; start += 1) {
    let joined = '';
    for (let at = start; at < groups.length && joined.length + groups[at].length <= 19; at += 1) {
      joined += groups[at];
      if (joined.length >= 13) candidates.push(joined);
    }
  }
  return candidates.some((run) => luhnValid(run));
}
```

Do **not** "fix" this by enumerating arbitrary sub-windows of the match: I checked,
and the 14- and 15-digit prefixes of the locked lookalike (`42424242424242` /
`424242424242424`) are themselves Luhn-valid, so a window walk breaks the P2-D-07
negative-control rule the e2e pins. Add an e2e row for the glued form
(`4111111111111111 4242424242424242` in one text node, marker painted, zero original
pixels in the rect) so T-02-08's closure is evidence-backed.

---

#### CR-03: The DOM scan stops at the top document's light DOM — shadow roots and same-origin iframes are never redacted (external: scanner-coverage)

**File:** `packages/sdk/src/redact/redactor.ts:85`, `redactor.ts:91-93`, `redactor.ts:103`

**Issue:** all three detection routes are scoped to one document's light DOM:
`doc.querySelectorAll(SENSITIVE_SELECTOR)` (line 85), `doc.querySelectorAll(VALUE_SCAN_SELECTOR)`
(line 91) and `doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT)` (line 103).
Neither `querySelectorAll` nor `TreeWalker` pierces a shadow root, and neither ever
reaches an `iframe`'s document. Consequently:

- a password field (PRV-01) or `data-watchbug-sensitive` block (PRV-03) inside a host
  page's **open shadow root** — Lit/Stencil/Polaris-style components are common — is
  never matched, so it is painted into the frame unmasked;
- **same-origin iframes** (payment/auth embeds served from the app's own origin) are
  fully reachable via `frame.contentDocument` but are never scanned, while their
  pixels *are* captured with the tab;
- closed shadow roots are genuinely unreachable, which is a documentable limit.

This is **not** covered by the phase's one accepted risk: `AR-01`/`T-02-14` is scoped
to *"cross-origin* iframe pixels … cannot reach third-party documents". Same-origin
documents and open shadow roots *are* reachable — the scanner simply doesn't look.
SEC-01/PRV-01…03 are stated unconditionally, and 02-SECURITY.md never registered this
surface, so nothing owns it.

**Fix:** make traversal recursive and per-document; a wrong-side failure must stay
fail-closed (the existing T-02-10 `try/catch` in `pipeline.ts:225-230` already
converts a traversal error into a loud no-send, so aggressive traversal is safe by
construction):

```ts
function walk(root: Document | ShadowRoot, visit: (node: Node) => void): void {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    visit(element);
    if (element.shadowRoot !== null) walk(element.shadowRoot, visit); // open roots only
  }
  for (const frame of Array.from(root.querySelectorAll('iframe, frame'))) {
    const doc = (frame as HTMLIFrameElement).contentDocument; // null cross-origin
    if (doc !== null) walk(doc, visit);
  }
}
```

Apply the same recursion to the `TreeWalker` (walk each reachable root's text nodes)
and to the structural/value selectors. Document closed-shadow-root and
cross-origin-iframe reach as limitations next to OQ-3/AR-01. At minimum, register the
gap in `02-SECURITY.md` — today the register claims T-02-08/T-02-10 close the
"redaction outcome" boundary while the scanner's *coverage* is unexamined.

---

### Warnings

#### WR-01: Mask geometry is collected after the frame is captured, not with it

**File:** `packages/sdk/src/capture/pipeline.ts:194-200` and `pipeline.ts:226`

**Issue:** the pixel read happens inside `capture.capture()` (the adapter calls
`beforeRead()` → `drawImage` → `getImageData`), but `redactor.redact(image)` runs
afterwards — after `blankProbe`, after `host.restore()`, and after the full
`collectMaskRects` DOM walk. The comment at `redactor.ts:78-79` claims rects are
collected "as the user saw it when they clicked"; the real invariant is weaker: they
reflect the DOM **after** the frame existed. Any layout shift inside that window — a
rAF/CSS-transform animation on a `data-watchbug-sensitive` block, a re-render, a
scroll — makes the mask land on the wrong pixels while the original secret pixels
leave the browser. The window is milliseconds, not seconds (the frame is drawn after
the picker grants), so this is probability-gated — but outward rounding (`geometry.ts`
±1 px) does not absorb a one-frame animated translation, and no e2e can observe it
because the stubs paint synthetic frames.

**Fix:** collect the rects inside the pipeline's `beforeRead()` hook — the same tick
as the pixel read, while the assertion already runs there:

```ts
let rects: RectLike[] | null = null;
image = await capture.capture({
  beforeRead: () => {
    if (!host.isHidden()) throw new PipelineInvariantError('the widget host was visible at pixel-read time');
    rects = collectMaskRects(document); // same instant as the pixels we are about to read
  },
});
// ...
fillRects(image, rects!, { width: window.innerWidth, height: window.innerHeight });
```

(`collectMaskRects` is already exported from `redactor.ts`; this needs a thin
`Redactor.redactRects(image, rects)` variant rather than the current
`redact(image)`-does-both shape.) Note the widget itself is `display:none` at that
instant and lives in a shadow root, so the early collection cannot mask the widget.

---

#### WR-02: The ESM build's default endpoint is the *page* origin, not the loading script's

**File:** `packages/sdk/src/index.ts:63-66` and `index.ts:80-87` (doc claim at `index.ts:39-42`)

**Issue:** `LOADING_SCRIPT_URL` is read from `document.currentScript`, which the HTML
spec sets to `null` for module scripts ("`document`'s `currentScript` attribute is
null" — MDN: "returns the script element … that isn't a JavaScript module"). So in the
`watchbug.mjs` lane the constant is *always* `undefined` and `defaultEndpoint()`
falls back to `document.baseURI`'s origin. The public doc comment promises the
"origin of the loading script, i.e. the developer's own deployment". For a cross-origin
ESM integration (import the module from the Watchbug server, run the app elsewhere)
reports are posted to `<app origin>/api/incidents` — wrong origin, CORS/404, and the
user only sees a generic "Couldn't send the report" after the full retry schedule. The
e2e cannot catch it because the fixture imports the bundle from the same origin as the
API.

**Fix:** mirror the pattern already used for `SHADOW_MODE` (`build.mjs:41-45`) — a
per-format `define` so the IIFE build never parses the branch:

```ts
// build.mjs (esm roles): define: { ...shared.define, LOADING_SCRIPT_URL_EXPR: 'import.meta.url' }
const LOADING_SCRIPT_URL: string | undefined = (() => {
  const script = document.currentScript;              // classic scripts only
  if (script instanceof HTMLScriptElement && script.src.length > 0) return script.src;
  if (typeof __SCRIPT_URL__ !== 'undefined' && __SCRIPT_URL__) return __SCRIPT_URL__; // esm build
  return undefined;
})();
```

If that is not worth the build complexity now, at minimum correct the doc comment on
`WatchbugInitOptions.endpoint` to state that the **ESM lane defaults to the document
origin** and that cross-origin integrations must pass `endpoint` explicitly.

---

#### WR-03: Idempotency key falls back to `Date.now()` + `Math.random()` on every non-secure context

**File:** `packages/sdk/src/capture/pipeline.ts:127-133`

**Issue:** `crypto.randomUUID` is `[SecureContext]`-gated, so on plain-HTTP
deployments (LAN/self-hosted docker-compose over an IP or http hostname — a primary
target audience) the key is `` `wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}` ``:
~41 bits from a non-CSPRNG, and not UUID-shaped. The whole suite assumes the UUID
contract (`e2e/sdk.spec.ts:322`, `:847` assert `/^[0-9a-f-]{36}$/`) but runs on
`127.0.0.1`, which *is* a secure context — so the fallback is unreachable by the tests
and unverified. The API accepts it (only required + ≤256 chars,
`apps/api/src/routes/incidents.ts:146-154`), so nothing fails loudly; the cost is
weaker uniqueness behind `UNIQUE (project_id, idempotency_key)` — a collision turns
into a *replayed* response for a different logical report, i.e. a silently dropped
submission — plus a contract shape that drifts from CA-01 on exactly the deployments
this product targets.

**Fix:** `crypto.getRandomValues` **is** available in insecure contexts, so build a
UUID from it before falling back:

```ts
function newIdempotencyKey(): string {
  const source = typeof crypto === 'undefined' ? undefined : crypto;
  if (source !== undefined && typeof source.randomUUID === 'function') return source.randomUUID();
  if (source !== undefined && typeof source.getRandomValues === 'function') {
    const bytes = source.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

The `Math.random` line stays only as a last resort for engines with no WebCrypto at
all. Assert the UUID shape once in a non-localhost-protocol context if one is ever
available; today the shape assertion is vacuous for that reason.

---

### Info

#### IN-01: The `beyond-cap` seam stub allocates the canvas before its own "canvas-free" return

**File:** `e2e/helpers/capture-stubs.ts:341-347`

**Issue:** the comment says the oversize `ImageData` is "allocated without a canvas so
no engine-side canvas cap can preempt the probe that must reject it", but
`canvas.width = 4700; canvas.height = 3600` (16,920,000 px — above Safari's
16,777,216 px area cap) runs *before* the injected `beyondCapReturn`. On an engine
that returns `null` from `getContext` above the cap, the stub throws
`capture seam: a 2D canvas is unavailable` and the row lands in the capture-failed
state instead of the blank state it asserts. It evidently passes on this host's
WinCairo WebKit, but the fixture contradicts its own documented intent.

**Fix:** hoist the `beyondCap` early-return above the canvas creation:

```ts
const width = ${widthExpr};
const height = ${heightExpr};
${beyondCapReturn}   // return before any canvas exists
const canvas = document.createElement('canvas');
// ...
```

---

#### IN-02: `truncateReason` cuts UTF-16 units and can split a surrogate pair

**File:** `packages/sdk/src/widget/status-panel.ts:162-168`

**Issue:** `text.slice(0, max - 1)` can land between a high and low surrogate when a
server reason is non-BMP-heavy and the tail has no space, producing a lone surrogate
rendered as `�` in the panel. It is also inconsistent with the title path, which
deliberately clamps by *code points* to match the Zod cap (`lane1.ts:90-94`).

**Fix:** clamp by code points, matching `buildMeta`:

```ts
const chars = [...text];
if (chars.length <= max) return text;
const cut = chars.slice(0, max - 1);
const lastSpace = cut.lastIndexOf(' ');
return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).join('')}…`;
```

(`e2e/sdk.spec.ts:916` asserts `reasonLength <= 240` in UTF-16 units; the code-point
form still satisfies it for ASCII and only ever shortens for non-BMP input.)

---

#### IN-03: The P2-D-03 byte-equality assertion is vacuous on WebKit

**File:** `e2e/sdk.spec.ts:852-857`

**Issue:** `multipartPart(calls[n].buffer, 'image')` relies on `postDataBuffer()`, and
the suite documents that Playwright's WebKit omits blob-backed FormData payloads
(`e2e/sdk.spec.ts:283-287`, deviation 2). On webkit both buffers are empty subarrays,
so `expect(image1).toEqual(image0)` compares `∅ ≡ ∅` and "the retry resends the same
encoded bytes (P2-D-03)" is proven only on chromium/firefox. The `meta` part and the
shared `idempotency-key` header *are* asserted on all three engines, so the row's core
claim survives — but the strongest assertion looks cross-engine while partly not.

**Fix:** make the gap explicit rather than silently green — branch the row on
`browserName` and, on webkit, assert the byte-equality via the fetch-boundary recorder
(`readOutgoingImage`) across attempts, or state in-row that the payload half is
engine-conditional and rely on the header + `meta` equality there.

---

_Reviewed: 2026-10-24T17:55:38Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
