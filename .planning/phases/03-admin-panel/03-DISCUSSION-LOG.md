# Phase 3: Admin Panel - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 3-admin-panel
**Areas discussed:** Panel stack & build pipeline, Login & session flow, Incident list & filtering, Detail view & status workflow

---

## Panel stack & build pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Vanilla TS + Vite | Lightweight, no framework runtime, fastest load, consistent with SDK vanilla approach. Vite builds to dist → copied to api/static/panel/. i18n via simple JSON dict (en/es like SDK). | ✓ |
| React + Vite + TypeScript | Component model for table/detail, larger runtime (~40KB), richer ecosystem, needs React build to static. | |
| Vue 3 + Vite | Lightweight reactivity, SFCs, similar build output to static. | |

**User's choice:** Vanilla TS + Vite (Recommended)
**Notes:** User confirmed most areas should be discussed after initial explanation.

| Option | Description | Selected |
|--------|-------------|----------|
| Plain CSS + CSS variables | No framework, variables for theme, media queries for tablet. Keeps bundle tiny, self-hosted, easy to maintain. i18n as JSON files loaded at runtime. | ✓ |
| Tailwind CSS | Utility classes, fast prototyping, needs build step, larger CSS until purged. | |
| You decide | Agent picks optimal styling/i18n approach within constraints. | |

**User's choice:** Plain CSS + CSS variables (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Hash routing + single index.html | No server config: #/login, #/incidents, #/incidents/:id. Vite builds to panel/dist → FastAPI mounts api/static/panel/. Simple for self-hosted. | ✓ |
| History API + FastAPI fallback | /login, /incidents/:id need FastAPI to serve index.html on 404 fallback — more config. | |
| Multi-page (separate HTML per view) | login.html, list.html, detail.html — no SPA routing, full reloads. | |

**User's choice:** Hash routing + single index.html (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| panel/ at repo root | Repo root panel/ with Vite (panel/src, panel/dist). Build copies to backend/api/static/panel/. Consistent with sdk/ and backend/ siblings. | ✓ |
| frontend/panel/ nested | frontend/panel/ — deeper nesting, same build to static. | |
| Inside backend/api/static/panel/src | Source lives inside backend — mixes Python and JS concerns. | |

**User's choice:** panel/ at repo root (Recommended)

---

## Login & session flow

| Option | Description | Selected |
|--------|-------------|----------|
| Simple form + redirect + inline errors | Centered card with email/password, submit → POST /api/auth/login with credentials:include, on 200 redirect to #/incidents, on 401 show 'Invalid credentials' inline. No extra features. | |
| Form + remember + loading spinner | Adds remember checkbox (extends refresh) and spinner/disabled button during submit. | ✓ |
| You decide | Agent designs login UX within PAN-02 + JWT HttpOnly constraints. | |

**User's choice:** Form + remember + loading spinner

| Option | Description | Selected |
|--------|-------------|----------|
| Probe GET /api/incidents on load + auto-refresh | On app boot and each nav, try GET with credentials:include. If 401, try POST /api/auth/refresh; if still 401 redirect to #/login. Silent refresh before expiry. | ✓ |
| Redirect to login on any 401 | No refresh attempt — any 401 goes straight to login. Simpler but more logouts. | |
| You decide | Agent picks guard strategy within Phase 2 1h access + 7d refresh contract. | |

**User's choice:** Probe GET /api/incidents on load + auto-refresh (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Header logout button + toast errors | Top header has user email + Logout. POST /api/auth/logout clears cookies, redirect to login. Auth errors as inline form error + toast. Messages in en/es JSON. | ✓ |
| Sidebar logout + inline only | Logout in sidebar nav, errors only inline under form, no toast. | |
| You decide | Agent places logout and chooses error pattern. | |

**User's choice:** Header logout button + toast errors (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Simple required check + language toggle in header | No strict EmailStr on frontend (allow .local); show 'Email required' / 'Password required' localized. Language toggle EN/ES persists in localStorage, defaults to browser lang. | ✓ |
| Strict HTML5 email validation | Use type=email pattern, may reject .local — needs override. | |
| You decide | Agent handles login validation + i18n toggle. | |

**User's choice:** Simple required check + language toggle in header (Recommended)

---

## Incident list & filtering UX

| Option | Description | Selected |
|--------|-------------|----------|
| Table + thumbnail column + status badges | Responsive table: Type badge (Bug/Feedback color), Status pill (Pending yellow, In Progress blue, Resolved green), Date (localized), 40px thumbnail placeholder/icon (has_screenshot). Click row → detail. Pagination footer. | ✓ |
| Card grid | Cards per incident with large preview — more visual but denser. | |
| Compact list with icon only | No thumbnail, icon indicates has screenshot — fastest but less visual. | |

**User's choice:** Table + thumbnail column + status badges (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Prev/Next + page info + filter dropdowns synced to hash URL | Footer shows 'Page 1 of N (Total 42)' + Prev/Next. Two dropdowns: Type (All/Bug/Feedback) + Status (All/Pending/In Progress/Resolved). Selecting filters resets to page 1, updates hash query for shareable links. | ✓ |
| Numbered pages + chips | 1 2 3 ... + removable filter chips — more complex. | |
| Infinite scroll | Load more on scroll — not matching Phase 2 page/size contract. | |

**User's choice:** Prev/Next + page info + filter dropdowns synced to hash URL (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton rows + empty illustration + escaped text | Loading: 5 skeleton rows. Empty: illustration + 'No incidents yet' (localized). Error: retry button. All user fields rendered via textContent (no raw HTML) per PAN-07, sanitized at ingest. | ✓ |
| Spinner only + plain empty text | Center spinner, simple 'No results' text — minimal. | |
| You decide | Agent designs states within XSS escaped constraint. | |

**User's choice:** Skeleton rows + empty illustration + escaped text (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 20 with CSS responsive table | 20 per page (backend default) not user-selectable for v1. Table collapses to stacked rows <768px, thumbnails hide on tablet narrow. Simple, satisfies PAN-06. | ✓ |
| Selectable 10/20/50 | Dropdown to change size — more flexibility, needs extra state. | |
| You decide | Agent picks responsive + size handling. | |

**User's choice:** Fixed 20 with CSS responsive table (Recommended)

---

## Detail view & status workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated hash route #/incidents/:id with two-column layout | Click row → #/incidents/:id. Left: large screenshot (data:image/png;base64 from detail endpoint) with zoom/lightbox. Right: metadata cards (URL, User-Agent, viewport, timestamp), consoleLogs, status dropdown. Back to list. | ✓ |
| Modal overlay on list | Popup modal over list — no route, faster but breaks shareable links. | |
| Full page with tabs | Tabs for Screenshot / Metadata / Logs — more clicks. | |

**User's choice:** Dedicated hash route #/incidents/:id with two-column layout (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate PATCH on dropdown change + toast + optimistic list update | Select new status → PATCH /api/incidents/:id/status with credentials:include, on 200 show toast 'Status updated', update local state, reflect in list on back. On error show inline error and revert. Any→Any allowed. | ✓ |
| Explicit Save button | Change dropdown then click Save — extra step, prevents accidental change. | |
| You decide | Agent picks status UX within Any→Any constraint. | |

**User's choice:** Immediate PATCH on dropdown change + toast + optimistic list update (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Formatted cards + collapsible consoleLogs, all escaped | Metadata as labeled cards: URL (link escaped), User-Agent, resolution, timestamps localized. ConsoleLogs as collapsible list (level badge + args textContent). Screenshot with max-width 100% + click to zoom. All via textContent/innerText, never innerHTML. | ✓ |
| Raw JSON viewer | Show payload JSONB as formatted <pre> — dev-friendly but less polished. | |
| You decide | Agent chooses display within XSS + i18n constraints. | |

**User's choice:** Formatted cards + collapsible consoleLogs, all escaped (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Stack to single column on tablet + 404 page | Desktop two-column, tablet <900px stack: screenshot on top, metadata below. Large screenshots scrollable + lazy. 404 → 'Incident not found' with back to list. 401 during detail fetch → refresh or login. | ✓ |
| You decide | Agent handles responsive + errors. | |
| Side-by-side always | Keep two columns even on tablet — horizontal scroll. | |

**User's choice:** Stack to single column on tablet + 404 page (Recommended)

---

## Agent's Discretion

No explicit "You decide" selections in this session — user made concrete choices for all areas. Discretion covers: Vite config details, CSS variable palette, toast implementation, i18n helper (plain JSON `t()`), exact breakpoint tuning, consoleLogs truncation limit.

## Deferred Ideas

None — discussion stayed within phase scope. v2 items (NET/BRD/NTF/INT/STR) remain in REQUIREMENTS.md v2. Phase 4 Docker (DEP-01..05) deferred as planned.

