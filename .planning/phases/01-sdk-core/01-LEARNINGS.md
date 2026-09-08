---
phase: 01
phase_name: "SDK Core"
project: "Watchbug SDK"
generated: "2026-09-08"
counts:
  decisions: 12
  lessons: 6
  patterns: 8
  surprises: 3
missing_artifacts:
  - "01-UAT.md"
---

# Phase 01 Learnings: SDK Core

## Decisions

### Closed Shadow DOM with connectedCallback for ARIA
Use `mode: 'closed'` Shadow DOM and set ARIA attributes in `connectedCallback` instead of constructor to avoid jsdom constructor attribute error.

**Rationale:** jsdom throws when setting attributes during custom element construction; `connectedCallback` is the safe lifecycle hook.
**Source:** 01-01-SUMMARY.md

---

### adoptedStyleSheets with `<style>` Fallback
Use `adoptedStyleSheets` API for CSS injection with a `<style>` fallback for jsdom compatibility.

**Rationale:** `adoptedStyleSheets` is the modern standard but jsdom doesn't support it; fallback ensures tests pass while production uses the optimal path.
**Source:** 01-01-SUMMARY.md

---

### Root package.json Required for Vitest
Project root needs its own `package.json` for vitest to work alongside `sdk/package.json`.

**Rationale:** Plan only listed `sdk/package.json` but vitest at project root requires a root manifest. Discovered during implementation.
**Source:** 01-01-SUMMARY.md

---

### canvas.toDataURL with SecurityError Catch
Use `canvas.toDataURL` with tainted canvas `SecurityError` catch and timeout race — keeps bundle small vs `html2canvas`.

**Rationale:** `html2canvas` adds ~40KB; Canvas API is native and sufficient for viewport-only capture (CAP-01 invariant). The SecurityError catch handles cross-origin tainted canvases gracefully.
**Source:** 01-02-SUMMARY.md

---

### Console Timestamps as ISO Strings
Store console timestamps as ISO strings (not numbers) per D-14 redaction spec; normalize legacy `_pushConsoleEntry` via `Date` conversion for backward compat.

**Rationale:** ISO strings are human-readable in the admin panel and JSON-serializable without transformation.
**Source:** 01-02-SUMMARY.md

---

### Patch ConsoleBuffer.add for Consent
Patch `ConsoleBuffer.add` to respect consent flag instead of stopping interception — preserves original methods while honoring `setConsent(false)`.

**Rationale:** Stopping interception loses the ability to restart; patching `add` allows toggling consent without re-wrapping console methods.
**Source:** 01-02-SUMMARY.md

---

### Per-Tool Factory Functions
Use per-tool factory functions (`createPencilTool` etc.) returning plain Tool objects — keeps tools stateless and testable without class overhead.

**Rationale:** Factory pattern avoids `this` binding issues and makes each tool independently testable.
**Source:** 01-03-SUMMARY.md

---

### Destructive Masking via getImageData/putImageData
Mask sensitive regions via `getImageData` → modify `Uint8ClampedArray` → `putImageData` before Base64 encoding. No CSS overlays.

**Rationale:** CSS overlays are reversible (inspect element reveals original); pixel mutation is permanent and satisfies SEC-02 invariant.
**Source:** 01-03-SUMMARY.md, 01-SECURITY.md

---

### credentials:'omit' on All SDK Fetches
All `fetch()` calls in the SDK use `credentials: 'omit'` — never sends host app cookies/tokens.

**Rationale:** SEC-03 invariant: SDK must never leak host authentication. Only `X-Watchbug-Key` (public write-only) is sent.
**Source:** 01-04-SUMMARY.md, 01-SECURITY.md

---

### Exponential Backoff Retry
Retry uses `baseDelay * 2^attempt` exponential backoff, default maxRetries 3, baseDelay 1000ms.

**Rationale:** Exponential backoff prevents thundering herd on transient failures; 3 retries covers most transient issues without infinite loops.
**Source:** 01-04-SUMMARY.md

---

### Keep IIFE + ESM Dual Output
Keep primary IIFE output with `name: Watchbug` and second ESM output — single self-contained script tag per D-12.

**Rationale:** IIFE for `<script>` tag consumers (zero config), ESM for bundler consumers (tree-shaking). Both needed for maximum compatibility.
**Source:** 01-05-SUMMARY.md

---

### E2E Tests Use _getShadowRoot Hook
E2E tests use jsdom with `_getShadowRoot` hook — closed `shadowRoot` null check proves INV-01, while hook provides isolated content access for assertions.

**Rationale:** Closed Shadow DOM returns null on `element.shadowRoot`; the hook is a test-only escape hatch that doesn't compromise production isolation.
**Source:** 01-05-SUMMARY.md

---

## Lessons

### Root package.json Was Not in Plan
The plan only specified `sdk/package.json` but vitest at project root required a root `package.json` with test scripts. This was discovered during Plan 01 execution and required adding the file retroactively.

**Context:** Planning gap — the SDK and project root are separate npm scopes.
**Source:** 01-01-SUMMARY.md

---

### jsdom Limitations Require Workarounds
jsdom doesn't support `adoptedStyleSheets`, `canvas.getContext('2d')` throws `NotImplemented`, and custom element constructors can't set attributes. Each required fallback paths or test-only hooks.

**Context:** jsdom is the only viable headless DOM for vitest; these limitations are inherent.
**Source:** 01-01-SUMMARY.md, 01-03-SUMMARY.md

---

### Bundle Size Gate Caught Issues Early
The `check-size.js` script with `process.exit(1)` on exceed enforced the 45KB limit from day one. Final bundle: 8.85KB gzipped (81% headroom).

**Context:** Without the gate, dependencies could creep in unchecked.
**Source:** 01-05-SUMMARY.md

---

### Consent API Requires Two-Layer Control
Consent needs to control both the console wrapper (via `isEnabled` callback) AND the buffer's `add` method (for direct `onerror`/`_pushConsoleEntry` paths). Single-layer control misses edge cases.

**Context:** `setConsent(false)` must block ALL capture paths, not just the wrapped console methods.
**Source:** 01-04-SUMMARY.md

---

### Screenshot Capture Is Placeholder
`captureScreenshot()` fills a white rectangle instead of capturing actual DOM content. Real DOM capture requires `html2canvas` or similar (adds ~40KB). This is the most significant functional gap in v1.

**Context:** Trade-off: bundle size (8.85KB) vs functionality (real screenshots). Deferred to v2.
**Source:** 01-02-SUMMARY.md, v1.0-MILESTONE-AUDIT.md

---

### ConsoleEntry Schema Mismatch
SDK sends `{ level, message, timestamp }` but backend originally expected `{ level, args: list[str], timestamp }`. Fixed by making both fields optional in the backend schema.

**Context:** API contract drift between SDK and backend development teams (same team, different phases).
**Source:** v1.0-MILESTONE-AUDIT.md

---

## Patterns

### Closed Shadow DOM Isolation
Widget renders inside `this.attachShadow({mode:'closed'})`. Host CSS/JS cannot access widget internals. Styles injected via `adoptedStyleSheets` with `<style>` fallback.

**When to use:** Any embeddable widget that must be immune to host page CSS/JS interference.
**Source:** 01-01-SUMMARY.md

---

### Single Global Entry Point
SDK exposes exactly one `window.Watchbug` object with `init()`, `setConsent()`, `getConsoleLogs()`. No prototype pollution, no other globals.

**When to use:** Any browser-injected library that must not pollute the host's global namespace.
**Source:** 01-01-SUMMARY.md, 01-SECURITY.md

---

### Ring Buffer with Eviction
`createConsoleBuffer(maxEntries)` stores entries in an array, shifts oldest when full. `getAll()` returns a copy.

**When to use:** Bounded memory capture for logs/events where oldest entries are least valuable.
**Source:** 01-02-SUMMARY.md

---

### Secret Redaction Patterns
7 regex patterns (password, token, api_key, secret, authorization, Bearer, JWT) applied to console messages before buffering. 500-char truncation.

**When to use:** Any client-side logging that might capture sensitive values from host app console output.
**Source:** 01-02-SUMMARY.md, 01-SECURITY.md

---

### Event Batching with Lazy Flush
`EventBatcher` queues reports, flushes at `batchSize` threshold or `flushIntervalMs` timer. `isEnabled` callback respects consent.

**When to use:** Network senders that should batch small payloads to reduce HTTP requests.
**Source:** 01-02-SUMMARY.md

---

### Destructive Canvas Masking
`maskRegion(ctx, x, y, w, h, mode)` → `getImageData` → mutate `Uint8ClampedArray` → `putImageData`. Modes: solid gray, 8x8 pixelate. Irreversible.

**When to use:** Any canvas-based capture where sensitive regions must be permanently obscured before encoding/sharing.
**Source:** 01-03-SUMMARY.md, 01-SECURITY.md

---

### credentials:'omit' Pattern
All SDK `fetch()` calls use `credentials: 'omit'` to prevent sending host app cookies/tokens. Only the public `PROJECT_KEY` is sent via header.

**When to use:** Any third-party script making cross-origin requests from within a host page.
**Source:** 01-04-SUMMARY.md, 01-SECURITY.md

---

### localStorage Draft Persistence
Failed reports saved to `localStorage` with `watchbug_draft_` prefix. `retryDraft(key)` re-sends and removes on success.

**When to use:** Client-side resilience for critical payloads that must not be lost on network failure.
**Source:** 01-04-SUMMARY.md

---

## Surprises

### Bundle Came in at 8.85KB (Not 45KB)
Final gzipped bundle was 8.85KB — 81% under the 45KB limit. All functionality (Shadow DOM, capture, editor, transport, i18n) fits in a remarkably small package.

**Impact:** No dependency budget pressure for v2 features; plenty of room for `html2canvas` or other additions.
**Source:** 01-05-SUMMARY.md

---

### E2E Aggressive CSS Test Was Key Proof
The `* { display: none !important }` CSS injection test became the definitive proof of Shadow DOM isolation — more convincing than any unit test.

**Impact:** Established the pattern: prove invariants via adversarial E2E tests, not just happy-path unit tests.
**Source:** 01-05-SUMMARY.md

---

### window.onerror Chaining Complexity
Preserving the previous `window.onerror` handler while adding Watchbug's capture required careful chaining with `@ts-ignore` for TypeScript. More complex than expected.

**Impact:** Added ~30 lines of careful handler management. Would benefit from a utility in v2.
**Source:** 01-04-SUMMARY.md
