# Phase 1: SDK Core - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Client widget with Shadow DOM isolation, capture engine, canvas editor, and transport. Developers inject a single script tag, initialize with `window.Watchbug.init()`, and capture bugs with screenshots, metadata, and console logs — fully isolated from the host application.

</domain>

<decisions>
## Implementation Decisions

### SDK Entry & Lifecycle
- **D-01:** `init({ key, autoSanitize, language })` — single call injects floating button, starts console.log interception, hooks window.onerror. No auto-capture on load. — **Reversibility:** costly — Changing init signature breaks all existing integrations
- **D-02:** Floating circle icon button, fixed bottom-right corner (like Intercom/Crisp). Two variants: "Report Bug" and "Send Feedback" — separate buttons to distinguish capture behavior. — **Reversibility:** reversible
- **D-03:** Consent API: `Watchbug.setConsent(boolean)` — runtime toggle that pauses/resumes all capture (window.onerror, console interception, screenshot). Developer-controlled. — **Reversibility:** reversible
- **D-04:** Auto-capture errors via `window.onerror` — uncaught errors stored in buffer, included in next report payload. — **Reversibility:** reversible

### Canvas Editor UX
- **D-05:** Full-screen overlay on button click — takes entire viewport for clear annotation focus. — **Reversibility:** reversible
- **D-06:** Top toolbar with tools: pencil (freehand), arrow, text, mask rectangle, mask paint, send button. Clean horizontal layout. — **Reversibility:** reversible
- **D-07:** Submit flow: click Send → capture screenshot + metadata → POST to backend → success toast. No preview step. — **Reversibility:** reversible
- **D-08:** On network failure: show retry button + save draft locally so user can retry later. — **Reversibility:** reversible
- **D-09:** Masking tools: both rectangle brush (draw rectangle → pixelate all pixels inside) and freehand paint (paint mask strokes) available in toolbar. Destructive pixel-level masking before Base64 encoding. — **Reversibility:** irreversible — pixel masking is destructive by design

### Bundle Architecture
- **D-10:** Rollup as build tool — good tree-shaking, native ESM output, smallest possible bundle for SDK use case. — **Reversibility:** reversible
- **D-11:** Both languages (en/es) bundled in single file — no network requests for i18n, toggle at runtime via config. — **Reversibility:** reversible
- **D-12:** Single self-contained `<script>` tag output — UMD/IIFE format, no ES module requirement. Developer copies CDN URL. — **Reversibility:** reversible
- **D-13:** CDN-hosted script URL for distribution (e.g., jsDelivr, unpkg, or self-hosted). Developer adds `<script src="...">`. — **Reversibility:** reversible

### Console Log Capture
- **D-14:** Auto-redact suspected secrets (API keys, tokens, passwords) before storing console logs. Regex patterns for common secret formats. — **Reversibility:** reversible
- **D-15:** Configurable ring buffer via init options, default ~50-100 entries. Low default for memory-constrained devices. — **Reversibility:** reversible
- **D-16:** Intercept `console.log`, `console.warn`, `console.error`, `console.info` — all four methods. — **Reversibility:** reversible
- **D-17:** Console logs always included in report payload — no developer toggle needed. — **Reversibility:** reversible

### Agent's Discretion
- CDN hosting provider selection (jsDelivr vs unpkg vs self-hosted) — agent can choose based on project needs
- Redaction regex patterns — agent designs appropriate patterns for API keys, tokens, passwords
- Canvas editor color scheme / theme — agent decides consistent styling
- Floating button icon design (bug icon vs feedback icon) — agent implements appropriate icons
- Draft persistence mechanism (localStorage vs IndexedDB) — agent chooses based on data size
- Rollup config details (output format, minification, sourcemaps) — agent configures optimally

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Full requirement definitions (SDK-01 through TRN-03 for Phase 1)
- `.planning/ROADMAP.md` — Phase definition, success criteria, dependency graph

### Security & Architecture
- `documentation/mission-brief.md` — Non-goals, autonomy envelope, acceptance criteria (CA-01 through CA-05)
- `documentation/mentorship-pack.md` — Invariants: Shadow DOM isolation, clean namespace, auto-sanitization, destructive masking, no host credentials, XSS protection, rate limiting

### Project
- `.planning/PROJECT.md` — Core value proposition, constraints (≤45KB, i18n, self-hosted), context

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing code — greenfield project. All code will be created from scratch in this phase.

### Established Patterns
- No established patterns — this phase defines the project's foundational patterns for future phases.

### Integration Points
- Phase 2 (Backend API): SDK sends reports to `/api/incidents` — transport layer in this phase defines the payload schema that Phase 2 must receive
- Phase 3 (Admin Panel): Incident data structure defined here will be consumed by the admin panel

</code_context>

<specifics>
## Specific Ideas

- Floating button style: similar to Intercom/Crisp chat widgets — familiar UX pattern for end users
- Two-button approach ("Report Bug" vs "Send Feedback") makes incident type distinction clear from the start
- Full consent control via `setConsent()` supports GDPR compliance without developer workaround
- Local draft persistence ensures reports aren't lost on network failure — important for self-hosted deployments with unreliable networks

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 1-SDK Core*
*Context gathered: 2026-08-30*
