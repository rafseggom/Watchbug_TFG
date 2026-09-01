# Phase 1: SDK Core - Research

**Researched:** 2026-08-30
**Domain:** Client SDK with Shadow DOM isolation, capture engine, canvas editor, and transport
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `init({ key, autoSanitize, language })` — single call injects floating button, starts console.log interception, hooks window.onerror. No auto-capture on load. — **Reversibility:** costly — Changing init signature breaks all existing integrations
- **D-02:** Floating circle icon button, fixed bottom-right corner (like Intercom/Crisp). Two variants: "Report Bug" and "Send Feedback" — separate buttons to distinguish capture behavior. — **Reversibility:** reversible
- **D-03:** Consent API: `Watchbug.setConsent(boolean)` — runtime toggle that pauses/resumes all capture (window.onerror, console interception, screenshot). Developer-controlled. — **Reversibility:** reversible
- **D-04:** Auto-capture errors via `window.onerror` — uncaught errors stored in buffer, included in next report payload. — **Reversibility:** reversible
- **D-05:** Full-screen overlay on button click — takes entire viewport for clear annotation focus. — **Reversibility:** reversible
- **D-06:** Top toolbar with tools: pencil (freehand), arrow, text, mask rectangle, mask paint, send button. Clean horizontal layout. — **Reversibility:** reversible
- **D-07:** Submit flow: click Send → capture screenshot + metadata → POST to backend → success toast. No preview step. — **Reversibility:** reversible
- **D-08:** On network failure: show retry button + save draft locally so user can retry later. — **Reversibility:** reversible
- **D-09:** Masking tools: both rectangle brush (draw rectangle → pixelate all pixels inside) and freehand paint (paint mask strokes) available in toolbar. Destructive pixel-level masking before Base64 encoding. — **Reversibility:** irreversible — pixel masking is destructive by design
- **D-10:** Rollup as build tool — good tree-shaking, native ESM output, smallest possible bundle for SDK use case. — **Reversibility:** reversible
- **D-11:** Both languages (en/es) bundled in single file — no network requests for i18n, toggle at runtime via config. — **Reversibility:** reversible
- **D-12:** Single self-contained `<script>` tag output — UMD/IIFE format, no ES module requirement. Developer copies CDN URL. — **Reversibility:** reversible
- **D-13:** CDN-hosted script URL for distribution (e.g., jsDelivr, unpkg, or self-hosted). Developer adds `<script src="...">`. — **Reversibility:** reversible
- **D-14:** Auto-redact suspected secrets (API keys, tokens, passwords) before storing console logs. Regex patterns for common secret formats. — **Reversibility:** reversible
- **D-15:** Configurable ring buffer via init options, default ~50-100 entries. Low default for memory-constrained devices. — **Reversibility:** reversible
- **D-16:** Intercept `console.log`, `console.warn`, `console.error`, `console.info` — all four methods. — **Reversibility:** reversible
- **D-17:** Console logs always included in report payload — no developer toggle needed. — **Reversibility:** reversible

### the agent's Discretion
- CDN hosting provider selection (jsDelivr vs unpkg vs self-hosted) — agent can choose based on project needs
- Redaction regex patterns — agent designs appropriate patterns for API keys, tokens, passwords
- Canvas editor color scheme / theme — agent decides consistent styling
- Floating button icon design (bug icon vs feedback icon) — agent implements appropriate icons
- Draft persistence mechanism (localStorage vs IndexedDB) — agent chooses based on data size
- Rollup config details (output format, minification, sourcemaps) — agent configures optimally

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SDK-01 | Client SDK injectable via single `<script>` tag, loads async without blocking main thread | Standard `<script async>` pattern, IIFE bundle format |
| SDK-02 | Widget renders inside Shadow DOM (`mode: 'closed'`) — immune to host CSS/JS interference | Shadow DOM closed mode with ARIA attributes for accessibility |
| SDK-03 | Single global entry point `window.Watchbug` with `init()` method — no prototype pollution | Custom Element with closed Shadow DOM, single global object |
| SDK-04 | SDK bundle ≤45 KB gzipped — verified in CI with `npm run check:size` | tsup bundler with tree-shaking, IIFE output, minification |
| SDK-05 | All `fetch()` calls use `credentials: 'omit'` — never sends host app cookies/tokens | Explicit `credentials: 'omit'` on all fetch requests |
| SDK-06 | i18n support — widget text available in English and Spanish | Runtime language switching with bundled translations |
| CAP-01 | Screenshot capture via Canvas API — viewport-only, max 1280px width, 500ms timeout | Canvas API with viewport capping, `toBlob()` for memory efficiency |
| CAP-02 | Metadata collection — URL, User-Agent, screen resolution, viewport size, timestamp | Standard browser APIs: `window.location`, `navigator.userAgent`, `screen` |
| CAP-03 | JavaScript console log capture — intercept `console.*` calls with redaction filter for secrets | Console method wrapping with regex-based secret redaction |
| CAP-04 | Auto-sanitization — mask `input[type=password]`, `data-watchbug-sensitive`, credit card patterns | DOM traversal with pattern matching for sensitive elements |
| CAP-05 | Event batching — queue events in memory with configurable flush interval, graceful degradation | In-memory queue with `setInterval` flush, retry on network failure |
| EDT-01 | Drawing tools — pencil (freehand), arrows, text annotations | Canvas 2D context drawing APIs |
| EDT-02 | Destructive pixel masking — `getImageData()` → modify `Uint8ClampedArray` → `putImageData()` before Base64 | Canvas pixel manipulation for irreversible masking |
| EDT-03 | Masking is irreversible — no CSS overlays, pixels permanently altered in canvas before encoding | Direct pixel data modification, not CSS overlays |
| TRN-01 | HTTP/JSON report payload — image (Base64 PNG) + metadata JSON sent to backend API | `fetch()` with `credentials: 'omit'`, JSON payload |
| TRN-02 | Payload validation — client-side schema validation before send, retry on network failure | JSON schema validation, retry logic with exponential backoff |
| TRN-03 | Consent API — `Watchbug.setConsent(boolean)` to control capture behavior per host app requirements | Runtime toggle that pauses/resumes all capture mechanisms |
</phase_requirements>

## Summary

Phase 1 implements the core client SDK for Watchbug, delivering a fully isolated widget that captures bugs with screenshots, metadata, and console logs. The SDK uses Shadow DOM (`mode: 'closed'`) for complete CSS/JS isolation from the host application, Canvas API for screenshot capture and destructive pixel masking, and a transport layer with event batching for reliable delivery. The implementation must stay under 45KB gzipped while providing full functionality including i18n support for English and Spanish.

**Primary recommendation:** Use tsup for bundling (IIFE format), implement Shadow DOM with `adoptedStyleSheets` for style isolation, use Canvas API directly for screenshot capture (avoid html2canvas to stay under size limit), and implement destructive pixel masking via `getImageData()`/`putImageData()`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Widget UI (Shadow DOM) | Browser / Client | — | All widget rendering happens in host browser via injected script |
| Screenshot Capture | Browser / Client | — | Canvas API runs in host browser, no server involvement |
| Canvas Editor | Browser / Client | — | Drawing tools and masking operate on client-side canvas |
| Console Log Capture | Browser / Client | — | Intercepts browser console methods directly |
| Metadata Collection | Browser / Client | — | Uses browser APIs (location, navigator, screen) |
| Event Batching | Browser / Client | — | In-memory queue with client-side flush logic |
| Transport (HTTP) | Browser / Client | API / Backend | Sends reports to backend via fetch() |
| Auto-Sanitization | Browser / Client | — | DOM traversal and pattern matching in host browser |
| i18n | Browser / Client | — | Runtime language switching in widget |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.5+ | Client SDK language | Type safety for Shadow DOM components, ES2020 target ensures broad compatibility |
| tsup | 8.5.1 | Client SDK bundler | esbuild-powered, zero-config, ESM+CJS dual output with .d.ts generation. 8M+ weekly downloads |
| Rollup | 4.x | Alternative bundler | Better tree-shaking for SDK use case, native ESM output |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| html2canvas | 1.4.1 | DOM-to-canvas screenshot capture | Use if custom Canvas API solution is too complex; evaluate bundle size impact |
| dom-to-image | 2.6.0 | Alternative DOM-to-canvas | Lighter than html2canvas; use if html2canvas exceeds size budget |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsup | Rollup | Rollup requires more config but better tree-shaking for SDKs |
| html2canvas | Custom Canvas API | Custom solution smaller bundle but more complex implementation |
| dom-to-image | html2canvas | dom-to-image lighter but less maintained |

**Installation:**
```bash
# Client SDK
npm init -y
npm install -D tsup typescript @types/node

# Optional: if using html2canvas (evaluate bundle size first)
npm install html2canvas
```

**Version verification:** Before writing the Standard Stack table, verify each recommended package exists and is current using the ecosystem-appropriate command:
```bash
npm view tsup version          # Node.js phases
npm view typescript version    # Node.js phases
npm view html2canvas version   # Node.js phases
npm view dom-to-image version  # Node.js phases
```
Document the verified version and publish date. Training data versions may be months stale — always confirm against the correct ecosystem registry.

## Package Legitimacy Audit

> **Required** whenever this phase installs external packages. Run the Package Legitimacy Gate protocol before completing this section.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| tsup | npm | 5+ years | 8.5M/wk | github.com/egoist/tsup | OK | Approved |
| typescript | npm | 10+ years | 273M/wk | github.com/microsoft/TypeScript | OK | Approved |
| html2canvas | npm | 4+ years | 17.8M/wk | github.com/niklasvh/html2canvas | OK | Approved |
| dom-to-image | npm | 7+ years | 400K/wk | github.com/tsayen/dom-to-image | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Packages discovered via WebSearch or training data that have not been verified against an authoritative source are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        HOST WEB APPLICATION                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                  Watchbug Client SDK (≤45KB gz)                   │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │ Widget   │  │ Capture      │  │ Canvas   │  │ Event        │  │  │
│  │  │ (Shadow  │  │ Engine       │  │ Editor   │  │ Batcher      │  │  │
│  │  │  DOM)    │  │ (Screenshot  │  │ (Drawing │  │ (Queue +     │  │  │
│  │  │          │  │  + Metadata) │  │  + Mask) │  │  Flush)      │  │  │
│  │  └──────────┘  └──────────────┘  └──────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ HTTP/JSON (POST /api/incidents)
                                   │ Headers: X-Watchbug-Key, Content-Type
                                   │ credentials: 'omit'
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     WATCHBUG BACKEND (FastAPI)                          │
│  (Phase 2 implementation)                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
sdk/
├── src/
│   ├── index.ts              # Entry point, window.Watchbug init
│   ├── widget/
│   │   ├── ShadowWidget.ts   # Custom Element with Shadow DOM
│   │   ├── styles.ts         # Scoped CSS (adoptedStyleSheets)
│   │   └── i18n.ts           # en/es translations
│   ├── capture/
│   │   ├── screenshot.ts     # Canvas-based screenshot capture
│   │   ├── metadata.ts       # URL, UA, screen, console logs
│   │   └── console.ts        # Console intercept wrapper
│   ├── editor/
│   │   ├── CanvasEditor.ts   # Drawing tools + canvas management
│   │   ├── tools/
│   │   │   ├── pencil.ts     # Freehand drawing
│   │   │   ├── arrow.ts      # Arrow annotations
│   │   │   ├── text.ts       # Text overlay
│   │   │   └── mask.ts       # Destructive pixel masking
│   │   └── sanitizer.ts      # Auto-mask passwords, sensitive data
│   ├── transport/
│   │   ├── batcher.ts        # Event queue + flush logic
│   │   └── sender.ts         # HTTP POST to backend API
│   └── utils/
│       ├── dom.ts            # DOM traversal helpers
│       └── crypto.ts         # PROJECT_KEY handling
├── package.json
├── tsconfig.json
└── tsup.config.ts            # Bundle config (IIFE + ESM)
```

### Pattern 1: Shadow DOM Encapsulation
**What:** Create a closed Shadow DOM root on a custom host element. All widget UI lives inside the shadow tree, invisible to host page JS and immune to host CSS.
**When to use:** Always — this is the core isolation invariant (INV-01).
**Example:**
```typescript
// Source: MDN Web Docs - Using Shadow DOM
class WatchbugWidget extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'closed' });
    
    // Scoped styles via adoptedStyleSheets (efficient, cacheable)
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(WIDGET_CSS);
    shadow.adoptedStyleSheets = [sheet];
    
    // All widget DOM lives here
    shadow.innerHTML = `
      <button id="wb-trigger" aria-label="Report issue">🐛</button>
      <div id="wb-modal" hidden>
        <div id="wb-editor">
          <canvas id="wb-canvas"></canvas>
          <div id="wb-toolbar"></div>
        </div>
        <textarea id="wb-notes" placeholder="Describe the issue..."></textarea>
        <button id="wb-submit">Send Report</button>
      </div>
    `;
  }
}

// Single global entry point (INV-02)
customElements.define('watchbug-widget', WatchbugWidget);
window.Watchbug = {
  init: (config: { projectKey: string; apiUrl: string }) => { /* ... */ }
};
```

### Pattern 2: Destructive Canvas Pixel Masking
**What:** Apply irreversible pixel-level modification to canvas `ImageData` before encoding. Never use CSS overlays — the final PNG must have sensitive data permanently destroyed.
**When to use:** Always when user applies masking in the editor (SEC-02).
**Example:**
```typescript
// Source: MDN Web Docs - Pixel manipulation with canvas
function maskRegion(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  width: number, height: number,
  mode: 'blur' | 'solid' = 'solid'
): void {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data; // Uint8ClampedArray [R,G,B,A, R,G,B,A, ...]
  
  if (mode === 'solid') {
    // Replace all pixels with opaque gray
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;     // R
      data[i + 1] = 128; // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A (fully opaque)
    }
  }
  
  // CRITICAL: putImageData writes permanently to canvas
  ctx.putImageData(imageData, x, y);
}

// After masking, encode to Base64
const maskedDataUrl = canvas.toDataURL('image/png');
// This PNG has the masked region permanently altered
```

### Pattern 3: Event Batching with Graceful Degradation
**What:** Queue incident reports in memory and flush periodically or on user action. Prevents network flooding and handles offline scenarios.
**When to use:** For SDK transport layer — batch reports before sending.
**Example:**
```typescript
// Source: Optimizely Event Batching Documentation
class EventBatcher {
  private queue: IncidentReport[] = [];
  private flushInterval: number;
  
  constructor(
    private apiUrl: string,
    private projectKey: string,
    private batchSize: number = 5,
    private flushMs: number = 3000
  ) {
    this.flushInterval = setInterval(() => this.flush(), flushMs);
  }
  
  enqueue(report: IncidentReport): void {
    this.queue.push(report);
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }
  
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.batchSize);
    try {
      await fetch(`${this.apiUrl}/api/incidents`, {
        method: 'POST',
        credentials: 'omit', // SEC-03: Never send host credentials
        headers: {
          'Content-Type': 'application/json',
          'X-Watchbug-Key': this.projectKey,
        },
        body: JSON.stringify({ incidents: batch }),
      });
    } catch (err) {
      // Re-queue failed reports (up to retry limit)
      this.queue.unshift(...batch);
    }
  }
}
```

### Anti-Patterns to Avoid
- **CSS Overlay Masking:** Using `<div>` with `background-color: gray` positioned over sensitive canvas regions. The underlying canvas pixel data is unchanged. When `canvas.toDataURL()` is called, the original sensitive image is encoded. Must use `getImageData()` → modify `Uint8ClampedArray` → `putImageData()`.
- **Global Style Injection:** Injecting `<style>` tags into `document.head` for widget styling. Breaks INV-01 (total isolation). Use `adoptedStyleSheets` on the Shadow DOM root.
- **Sending Host App Credentials:** SDK reads `document.cookie` or `localStorage` and includes tokens in the report payload. Violates SEC-03. SDK only sends `PROJECT_KEY` (public, write-only).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM-to-canvas screenshot | Custom DOM traversal + Canvas API | html2canvas or dom-to-image | Complex CSS handling, cross-origin images, CSP issues |
| Console log interception | Manual `console.log = function() {...}` | Wrapper pattern with original function reference | Preserves console functionality, handles all call patterns |
| Secret redaction regex | Custom regex for each secret type | Existing regex patterns from security community | Well-tested patterns for AWS, GitHub, Stripe, JWT, etc. |
| Event batching queue | Custom queue with retry logic | Existing batching patterns from telemetry SDKs | Proven patterns for flush intervals, retry, memory management |

**Key insight:** The SDK must stay under 45KB gzipped. Every dependency must be evaluated for bundle size impact. Consider implementing core features (screenshot capture, masking) directly with Canvas API rather than importing heavy libraries.

## Common Pitfalls

### Pitfall 1: Shadow DOM Closed Mode Breaks Debugging and Accessibility
**What goes wrong:** Using `mode: 'closed'` prevents `element.shadowRoot` from returning anything useful — the shadow root is inaccessible from outside. This makes the widget invisible to browser DevTools' DOM inspector, breaks accessibility tree traversal for screen readers.
**Why it happens:** The mentorship pack mandates `mode: 'closed'` for maximum isolation, but the practical tradeoffs aren't documented.
**How to avoid:** Use `mode: 'closed'` only for the outer container. Expose internal elements via ARIA attributes and a programmatic API (`window.Watchbug.inspect()`) for debugging. Add a `__DEBUG__` flag that opens the shadow root during development.
**Warning signs:** E2E tests can't find widget elements; accessibility audits show widget is invisible to screen readers.

### Pitfall 2: Canvas Screenshot Memory Explosion on Large Pages
**What goes wrong:** Calling html2canvas on a page with thousands of DOM nodes generates a massive `ImageData` object. A 1920×1080 screenshot is ~8MB raw pixel data, ~14MB after Base64. Can cause browser tab freeze, tainted canvas errors, OOM crashes.
**Why it happens:** DOM-to-canvas libraries walk the entire DOM tree without built-in size limits.
**How to avoid:** Implement viewport-only capture (use `window.innerWidth`/`innerHeight`), downscale to max 1280px width, use `canvas.toBlob()` instead of `toDataURL()`, add 500ms timeout.
**Warning signs:** Users report page "freezes" when clicking feedback button; console shows `SecurityError: Tainted canvases may not be exported`.

### Pitfall 3: Destructive Canvas Masking Applied to Wrong Layer
**What goes wrong:** Masking tool draws CSS overlays on top of sensitive areas, but these are NOT applied to underlying pixel data. When user clicks "Submit," `canvas.toDataURL()` reads original unmasked canvas.
**Why it happens:** CSS blur overlays are visually identical to pixel-level blur but operate on completely different layer.
**How to avoid:** Use `canvas.getContext('2d').getImageData()` to read pixel data, apply Gaussian blur or pixelation directly to `ImageData.data` array, then `putImageData()` back. Never use DOM elements or CSS filters for masking.
**Warning signs:** Security audit reveals CSS overlays being used for masking; `getImageData()` on masked region returns unblurred pixel values.

### Pitfall 4: SDK Captures Console Logs Containing Secrets
**What goes wrong:** SDK intercepts `console.log()` indiscriminately. Host applications often log sensitive data: API keys, JWT tokens, database connection strings.
**Why it happens:** Developers log anything useful for debugging, including secrets. SDK's console hook sees every log call.
**How to avoid:** Apply redaction filter on captured console messages. Match patterns: `password`, `secret`, `token`, `api_key`, `authorization`, `Bearer`, credit card regexes. Truncate long messages (>500 chars). Never capture `console.dir()` or `console.table()`.
**Warning signs:** Host app developers report API keys appearing in incident reports.

### Pitfall 5: SDK Sends Host App Cookies and Tokens
**What goes wrong:** SDK's `fetch()` calls inherit host page's cookies (same-origin requests include cookies by default). Host app session cookies leak to Watchbug backend.
**Why it happens:** Browser cookie behavior is automatic and non-obvious. `fetch()` includes credentials by default for same-origin requests.
**How to avoid:** Always use `fetch(url, { credentials: 'omit' })` for all SDK network requests. Add runtime assertion in development: if `document.cookie` contains non-empty values and `credentials` is not `'none'`, log warning.
**Warning signs:** Watchbug backend logs show session cookies in request headers.

## Code Examples

### Shadow DOM Widget with Accessibility
```typescript
// Source: MDN Web Docs - Using Shadow DOM
class WatchbugWidget extends HTMLElement {
  private shadow: ShadowRoot;
  
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'closed' });
    
    // Add ARIA attributes for accessibility
    this.setAttribute('role', 'application');
    this.setAttribute('aria-label', 'Watchbug bug reporting widget');
    
    // Inject scoped styles
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(WIDGET_CSS);
    this.shadow.adoptedStyleSheets = [sheet];
    
    // Build widget DOM with ARIA labels
    this.shadow.innerHTML = `
      <div role="dialog" aria-labelledby="wb-title" aria-modal="true">
        <h2 id="wb-title">Report Issue</h2>
        <button aria-label="Close dialog" id="wb-close">×</button>
        <!-- ... -->
      </div>
    `;
  }
}
```

### Console Log Interception with Redaction
```typescript
// Source: Carvis-AI/sanitize-log patterns
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;

const SECRET_PATTERNS = [
  /password['":\s=]+[^\s'"]+/gi,
  /token['":\s=]+[^\s'"]+/gi,
  /api[_-]?key['":\s=]+[^\s'"]+/gi,
  /secret['":\s=]+[^\s'"]+/gi,
  /authorization['":\s=]+[^\s'"]+/gi,
  /Bearer\s+[^\s'"]+/gi,
  /eyJ[A-Za-z0-9-_=]+?\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, // JWT
];

function redactSecrets(message: string): string {
  let redacted = message;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted.substring(0, 500); // Truncate long messages
}

console.log = function(...args: any[]) {
  const redactedArgs = args.map(arg => 
    typeof arg === 'string' ? redactSecrets(arg) : arg
  );
  originalLog.apply(console, redactedArgs);
};
```

### Auto-Sanitization of Sensitive Elements
```typescript
// Source: SEC-01 from mentorship pack
function sanitizeSensitiveElements(root: Document | Element): void {
  // Mask password inputs
  const passwordInputs = root.querySelectorAll('input[type="password"]');
  passwordInputs.forEach(input => {
    const rect = input.getBoundingClientRect();
    // Draw gray rectangle over password field
    maskRegion(ctx, rect.x, rect.y, rect.width, rect.height, 'solid');
  });
  
  // Mask data-watchbug-sensitive elements
  const sensitiveElements = root.querySelectorAll('[data-watchbug-sensitive]');
  sensitiveElements.forEach(element => {
    const rect = element.getBoundingClientRect();
    maskRegion(ctx, rect.x, rect.y, rect.width, rect.height, 'solid');
  });
  
  // Mask credit card patterns (regex-based)
  const creditCardRegex = /\b(?:\d[ -]*?){13,16}\b/g;
  // Apply masking to text nodes containing credit card patterns
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `html2canvas` for screenshots | Custom Canvas API with viewport capping | 2024+ | Smaller bundle, better performance, no CSP issues |
| CSS overlays for masking | Destructive pixel manipulation via `getImageData()`/`putImageData()` | 2023+ | GDPR compliance, irreversible masking |
| `console.log` interception via override | Wrapper pattern preserving original function | 2022+ | Better compatibility, preserves console functionality |
| `toDataURL()` for image encoding | `toBlob()` for async encoding | 2021+ | Better memory efficiency, no Base64 string in memory |

**Deprecated/outdated:**
- `html2canvas` with default settings: memory explosions on complex pages; must add viewport capping
- CSS-based masking: security violation; sensitive data leaks in `toDataURL()`
- `console.log = function() {...}`: breaks console functionality; use wrapper pattern

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this
> section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | html2canvas can be replaced with custom Canvas API to stay under 45KB limit | Standard Stack | May require more implementation effort but reduces bundle size |
| A2 | Destructive pixel masking can be implemented with `getImageData()`/`putImageData()` without performance issues | Architecture Patterns | May need optimization for large canvases |
| A3 | Console log redaction patterns will catch most common secret formats | Common Pitfalls | Some custom secret formats may leak through |
| A4 | Shadow DOM `mode: 'closed'` with ARIA attributes provides adequate accessibility | Common Pitfalls | May need additional accessibility testing |
| A5 | Event batching with in-memory queue is sufficient for v1 (no IndexedDB needed) | Architecture Patterns | Reports in queue lost on page unload; acceptable for error reports |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **html2canvas vs custom Canvas API implementation**
   - What we know: html2canvas is 17.8M weekly downloads, well-maintained, but adds bundle size
   - What's unclear: Whether custom Canvas API implementation can stay under 45KB total bundle
   - Recommendation: Start with custom Canvas API for screenshot capture; evaluate html2canvas only if custom solution is too complex

2. **Draft persistence mechanism (localStorage vs IndexedDB)**
   - What we know: D-08 requires saving drafts locally on network failure
   - What's unclear: Which storage mechanism is more appropriate for draft data size
   - Recommendation: Use localStorage for simplicity; IndexedDB if draft data exceeds 5MB

3. **CDN hosting provider selection**
   - What we know: D-13 requires CDN-hosted script URL
   - What's unclear: Which provider (jsDelivr vs unpkg vs self-hosted) is optimal
   - Recommendation: Use jsDelivr for public CDN; document self-hosted option

## Environment Availability

> Skip this section if the phase has no external dependencies (code/config-only changes).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | SDK build | ✓ | 18+ | — |
| npm | Package management | ✓ | 9+ | — |
| TypeScript | SDK development | ✓ | 5.5+ | — |

**Missing dependencies with no fallback:**
- None — all required tools are available

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (for unit tests) + Playwright (for E2E) |
| Config file | vitest.config.ts (to be created in Wave 0) |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SDK-01 | Async script load | unit | `npm run test:unit -- --testPathPattern=sdk-load` | ❌ Wave 0 |
| SDK-02 | Shadow DOM isolation | e2e | `npm run test:e2e -- --grep="Shadow DOM"` | ❌ Wave 0 |
| SDK-03 | Global namespace | unit | `npm run test:unit -- --testPathPattern=namespace` | ❌ Wave 0 |
| SDK-04 | Bundle size | build | `npm run check:size` | ❌ Wave 0 |
| SDK-05 | credentials: 'omit' | unit | `npm run test:unit -- --testPathPattern=transport` | ❌ Wave 0 |
| SDK-06 | i18n | unit | `npm run test:unit -- --testPathPattern=i18n` | ❌ Wave 0 |
| CAP-01 | Screenshot capture | unit | `npm run test:unit -- --testPathPattern=screenshot` | ❌ Wave 0 |
| CAP-02 | Metadata collection | unit | `npm run test:unit -- --testPathPattern=metadata` | ❌ Wave 0 |
| CAP-03 | Console capture | unit | `npm run test:unit -- --testPathPattern=console` | ❌ Wave 0 |
| CAP-04 | Auto-sanitization | unit | `npm run test:unit -- --testPathPattern=sanitizer` | ❌ Wave 0 |
| CAP-05 | Event batching | unit | `npm run test:unit -- --testPathPattern=batcher` | ❌ Wave 0 |
| EDT-01 | Drawing tools | unit | `npm run test:unit -- --testPathPattern=editor` | ❌ Wave 0 |
| EDT-02 | Destructive masking | unit | `npm run test:unit -- --testPathPattern=mask` | ❌ Wave 0 |
| EDT-03 | Masking irreversible | unit | `npm run test:unit -- --testPathPattern=mask-verify` | ❌ Wave 0 |
| TRN-01 | HTTP payload | unit | `npm run test:unit -- --testPathPattern=transport` | ❌ Wave 0 |
| TRN-02 | Payload validation | unit | `npm run test:unit -- --testPathPattern=validation` | ❌ Wave 0 |
| TRN-03 | Consent API | unit | `npm run test:unit -- --testPathPattern=consent` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:unit`
- **Per wave merge:** `npm run test:e2e`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/` — unit test directory
- [ ] `tests/e2e/` — E2E test directory
- [ ] `vitest.config.ts` — Vitest configuration
- [ ] `playwright.config.ts` — Playwright configuration
- [ ] Framework install: `npm install -D vitest @playwright/test`

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (SDK doesn't handle auth) |
| V3 Session Management | no | — (SDK doesn't manage sessions) |
| V4 Access Control | no | — (SDK only sends public PROJECT_KEY) |
| V5 Input Validation | yes | Client-side schema validation before send |
| V6 Cryptography | no | — (no encryption, only pixel masking) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Screenshot contains sensitive data | Information Disclosure | Auto-sanitization of password fields, credit cards, data-watchbug-sensitive elements |
| Console logs leak secrets | Information Disclosure | Regex-based secret redaction before storage |
| Host app credentials leaked | Information Disclosure | `credentials: 'omit'` on all fetch calls |
| CSS overlay masking bypass | Tampering | Destructive pixel manipulation via getImageData/putImageData |
| Shadow DOM bypass | Tampering | Closed mode with ARIA attributes for accessibility |

## Sources

### Primary (HIGH confidence)
- MDN Web Docs: Shadow DOM (https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) — closed mode, adoptedStyleSheets
- MDN Web Docs: Canvas pixel manipulation (https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas) — getImageData/putImageData patterns
- Optimizely Event Batching Documentation — batch size, flush interval patterns
- Carvis-AI/sanitize-log — secret redaction regex patterns

### Secondary (MEDIUM confidence)
- IssueCapture: Shadow DOM CSS Isolation — real-world widget implementation patterns
- Nolan Lawson: Shadow DOM and accessibility — ARIA challenges and solutions
- DevToolbox: Secret Redactor — common secret patterns and detection

### Tertiary (LOW confidence)
- Various Stack Overflow answers on Canvas API usage
- GitHub repositories for telemetry SDKs with event batching

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - All technologies are mature, well-documented, and have clear rationale
- Architecture: HIGH - Standard patterns with documented examples from official sources
- Pitfalls: HIGH - Well-documented pitfalls with specific prevention strategies

**Research date:** 2026-08-30
**Valid until:** 2026-09-30 (30 days for stable technologies)