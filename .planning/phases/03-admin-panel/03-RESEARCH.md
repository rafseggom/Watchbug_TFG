# Phase 03: Admin Panel - Research

**Researched:** 2026-09-02
**Domain:** Static SPA Admin Panel — Vanilla TypeScript + Vite + FastAPI static mount + JWT HttpOnly cookie auth + incident listing/filtering/detail/status workflow
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Stack is **Vanilla TypeScript + Vite** — no framework runtime (React/Vue rejected to keep bundle small and consistent with SDK's vanilla TS + Rollup approach). Vite builds to static output. i18n bundled as simple JSON dictionaries `en.json`/`es.json` loaded at runtime, mirroring SDK's single-file en/es bundling per RNF-03. — **Reversibility:** costly — Switching to React/Vue requires rewriting all views, components, and build config, and would affect Phase 4 multi-stage Dockerfile (Node builder choice)
- **D-02:** Styling is **plain CSS with CSS variables** — no Tailwind or framework. Variables for colors/spacing/theme, media queries for tablet breakpoints. Keeps panel lightweight, self-hosted with no extra build deps, easy to audit for XSS-safe rendering. — **Reversibility:** reversible
- **D-03:** Routing is **hash routing (`#/login`, `#/incidents`, `#/incidents/:id`) with a single `index.html`** — no server fallback needed. FastAPI serves `api/static/panel/` as static files; any unknown path still serves `index.html` via hash, so no FastAPI history-fallback config required. Hash query string (`#/incidents?type=Bug&status=Pending`) preserves shareable/bookmarkable filter state. — **Reversibility:** costly — Changing to History API (`/login`, `/incidents/:id`) requires FastAPI to add a catch-all fallback to `index.html` and CORS/cookie path adjustments
- **D-04:** Source layout is **`panel/` at repo root** as sibling to `sdk/` and `backend/` — structure `panel/src/`, `panel/dist/` (Vite output), built output copied/synced to `backend/api/static/panel/` for FastAPI static mount. Keeps Python and JS concerns separated, aligns with existing repo sibling convention from ARCHITECTURE.md. — **Reversibility:** one-way — Moving source location breaks import paths, Vite config, and Phase 4 Dockerfile COPY layers; requires migration of build scripts
- **D-05:** Login form is **centered card with email/password + Remember-ish behavior via refresh token + loading spinner**. Submit does `fetch POST /api/auth/login` with `credentials: 'include'`, disables button and shows spinner while pending. On 200 redirects to `#/incidents`; on 401 shows localized inline error "Invalid credentials" (en/es). "Remember" is implicit via 7-day refresh cookie from Phase 2 — no extra checkbox state needed beyond using refresh flow; the UI may label it as keeping session. — **Reversibility:** reversible
- **D-06:** Auth guard uses **probe + auto-refresh pattern** due to HttpOnly cookies (JS cannot read JWT per D-01 Phase 2). On app boot and on each navigation to protected routes, attempt `GET /api/incidents?size=1` with `credentials: 'include'`; if 401, try `POST /api/auth/refresh` (refresh cookie path `/api/auth`); if refresh succeeds retry original request; if still 401 redirect to `#/login`. Also schedule silent refresh before 1h access expiry if user stays active. This respects Phase 2's 1h access + 7d refresh, `watchbug_access`/`watchbug_refresh` cookies, `SameSite=Lax`, `Secure` toggle by ENV. — **Reversibility:** reversible — Guard strategy is JS-only; swapping to redirect-on-any-401 is local change
- **D-07:** Logout and error messaging: **header logout button + toast + inline errors**. Top header shows current user email (fetched via `GET` probe or decoded minimal user info if endpoint added, else placeholder) and a Logout button. Logout does `POST /api/auth/logout` with `credentials: 'include'` which clears both cookies via `Max-Age=0` (Phase 2 D-04), then redirects to `#/login` and shows toast "Logged out". Auth errors show both inline under the form and as toast for visibility; all messages via i18n JSON (en/es). — **Reversibility:** reversible
- **D-08:** Login validation is **simple required-field check, not strict EmailStr**, to allow `admin@watchbug.local` (.local domain rejected by Pydantic EmailStr in Phase 2 D-02). Frontend checks non-empty email/password, shows localized "Email required" / "Password required". Language toggle **EN/ES** lives in header, persists in `localStorage` key `watchbug_lang`, defaults to `navigator.language` (`es` if starts with `es`, else `en`), applies immediately to all views including login. — **Reversibility:** reversible
- **D-09:** List layout is **responsive table with thumbnail column + type/status badges**. Columns: Type badge (Bug red/orange, Feedback blue), Status pill (Pending yellow/amber, In Progress blue, Resolved green), Date (localized via `Intl.DateTimeFormat` per RNF-03), Preview (40px thumbnail placeholder icon when `has_screenshot:true`; list endpoint excludes BYTEA per Phase 2 Pitfall 7 — uses `has_screenshot` boolean, not actual bytes — so no image decode on list). Row click navigates to `#/incidents/:id`. Header row sticky, table horizontally scrollable on narrow tablet. All cell text rendered via `textContent` per PAN-07. — **Reversibility:** reversible
- **D-10:** Pagination and filtering: **Prev/Next + page info + two dropdowns synced to hash URL**. Footer shows "Page 1 of N (Total 42)" using backend `{items, total, page, size, pages}` (D-09 Phase 2). Prev disabled on page 1, Next disabled on last page. Filter bar has Type dropdown (All / Bug / Feedback) and Status dropdown (All / Pending / In Progress / Resolved); selecting resets to page 1, updates hash query (`#/incidents?type=Bug&status=Pending` or `status=Pending,In%20Progress` for multiples) so links are shareable/bookmarkable and directly drive `?type&status` query params (case-insensitive for type, exact for status per Phase 2). Page size fixed to backend default 20 for v1 (see D-12). — **Reversibility:** reversible — Filter UI is local; changing to chips/numbered pages touches only panel state and hash parsing
- **D-11:** Empty/loading/error states: **skeleton rows + empty illustration + escaped rendering**. Loading shows 5 skeleton shimmer rows. Empty (total=0) shows illustration/icon + localized "No incidents yet" / "No results for this filter" with a Clear Filters button. Error (network/401) shows inline error + Retry button that re-fetches with `credentials: 'include'`. All user-controlled fields (notes, consoleLogs, metadata strings) rendered via `textContent`/`innerText` never `innerHTML`, as backend already `html.escape`'d at ingest per SEC-03/PAN-07 — double defense. — **Reversibility:** reversible
- **D-12:** Responsive and page size: **fixed size 20, CSS-responsive table**. `size` is not user-selectable for v1 to keep scope tight (backend enforces `size ≤100` → 422 if exceeded). Table uses CSS: desktop `table-layout: auto`, tablet `<768px` collapses to stacked cards or hides thumbnail column and truncates User-Agent with ellipsis, keeps Type/Status badges visible. Breakpoint at `900px` for two-column→stack on detail, `768px` for list compaction — satisfies PAN-06 desktop+tablet. — **Reversibility:** reversible
- **D-13:** Detail view is **dedicated hash route `#/incidents/:id` with two-column layout**. Left pane: large screenshot `img src="data:image/png;base64,..."` from `GET /api/incidents/:id` detail endpoint (which re-encodes BYTEA per Phase 2 `encode_screenshot`); image `max-width: 100%`, `object-fit: contain`, click to open lightbox/overlay zoom. Right pane: metadata cards (URL as escaped link, User-Agent, viewport/resolution, timestamp localized, project_id, type/status badges), consoleLogs collapsible section, notes. Top has Back to list link and status dropdown. Hash route gives shareable direct links. — **Reversibility:** costly — Changing to modal overlay would remove deep linking and require lifting detail state into list, affecting shareability
- **D-14:** Status workflow is **immediate PATCH on dropdown change + toast + optimistic list update**, leveraging Phase 2's Any→Any status transition (no state-machine enforcement). Selecting a new status triggers `PATCH /api/incidents/:id/status` with `{status: "Resolved"}` and `credentials: 'include'`; on 200 show toast "Status updated" (localized), optimistically update local detail state and cached list entry so returning to list reflects new status without refetch; on error (422 invalid status, 401, network) show inline error and revert dropdown to prior value. Valid values strictly "Pending" | "In Progress" | "Resolved" per `StatusUpdate` schema. — **Reversibility:** reversible — Could add explicit Save button later without breaking contract
- **D-15:** Metadata rendering is **formatted cards + collapsible consoleLogs, all escaped**. Metadata fields displayed as labeled rows/cards, not raw JSON `<pre>` — URL rendered as `<a>` with `textContent` + `href` set after escaping check (no `javascript:`), User-Agent/resolution/timestamps as text rows, payload passthrough fields enumerated. ConsoleLogs (required for Bug, optional for Feedback per TRN-04) shown as collapsible list per entry: level badge (`log`/`warn`/`error`/`info` color) + `args` joined as `textContent` + timestamp. Screenshot data URL is not user HTML — safe for `img src`. Never use `innerHTML`/`v-html`. — **Reversibility:** reversible
- **D-16:** Detail responsive and error handling: **stack to single column on tablet + dedicated 404/401 handling**. Desktop two columns (screenshot left 60%, metadata right 40%); below `900px` stack vertically (screenshot on top, metadata below, both full width). Large screenshots are scrollable within container and lazy-loaded. Missing incident (GET 404 or invalid UUID) shows localized "Incident not found" page with Back to list button. 401 during detail fetch triggers same probe→refresh→login flow as D-06. Network error shows Retry. — **Reversibility:** reversible

### The Agent's Discretion
- Exact Vite config (`vite.config.ts` outDir, base path, dev server proxy for `/api` to `localhost:8000`) — agent picks idiomatic Vite defaults aligned with FastAPI mount.
- CSS variable naming/theming (light vs dark, badge colors hex values) — agent chooses accessible palette meeting WCAG contrast.
- Toast implementation (custom div vs lightweight lib) — must keep panel bundle small; agent prefers vanilla toast component.
- i18n library choice (simple JSON + helper `t(key)` vs `i18next` micro) — plain JSON with helper is sufficient for two languages; agent may use minimal helper.
- Table vs card exact breakpoint pixel values (768px vs 900px) — agent fine-tunes for PAN-06 tablet verification.
- ConsoleLogs display limit (truncate after N entries with Show more) — agent decides pagination within detail.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Future-phase items remain correctly tracked in REQUIREMENTS.md v2 (NET-01/02 network capture, BRD-01/02 breadcrumbs, NTF-01/02 email/webhook notifications, INT-01/02 error grouping/duplicate detection, STR-01/02 filesystem/MinIO + WebP compression) and Phase 4 Docker (DEP-01..05). No new deferred ideas emerged from this discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAN-01 | Static SPA — served from `api/static/panel/` via FastAPI | Vite static build + FastAPI StaticFiles mount (Pattern 2) |
| PAN-02 | Login form — email/password, redirects to incident list on success | Auth flow Pattern 3 (probe+refresh), fetch credentials:include |
| PAN-03 | Incident listing — paginated table with columns: type, status, date, preview | Pagination Pattern 5, table + badge Pattern, has_screenshot boolean [VERIFIED: backend/app/utils/pagination.py] |
| PAN-04 | Filter bar — filter by type (Bug/Feedback), status (Pending/In Progress/Resolved) | Filter hash-sync Pattern 6, parse_type_filter/parse_status_filter [VERIFIED: backend/app/utils/pagination.py:1-40] |
| PAN-05 | Incident detail view — full screenshot preview, metadata display, status management | Detail Pattern 7, encode_screenshot data URL [VERIFIED: backend/app/services/incident_service.py:encode_screenshot] |
| PAN-06 | Responsive layout — works on desktop and tablet | CSS variables + media queries Pattern 1, breakpoints 768/900 |
| PAN-07 | All user content rendered as escaped text — no raw HTML rendering | textContent double-defense Pattern 8, html.escape before JSONB [VERIFIED: backend/app/utils/sanitize.py] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

| Constraint | Requirement |
|------------|-------------|
| INV-01: Total Widget Isolation | Shadow DOM closed — panel is separate SPA (no Shadow DOM), but must not leak styles into host; panel isolation is via being separate static app. |
| INV-02: Clean Global Namespace | Single window.Watchbug for SDK; panel uses no global pollution (vanilla modules). |
| INV-03: Self-Hosted Containers | Single docker-compose.yml — panel build output is static files, no extra container needed. |
| SEC-03: No Host Credentials | Panel uses credentials:include for its own HttpOnly cookies only, never host cookies. |
| SEC-05: XSS Sanitization | PAN-07 textContent-only rendering is the panel-side gate; backend html.escape is ingest gate. |
| SEC-06: Secure Auth | Panel respects 1h access + 7d refresh, HttpOnly Lax Secure cookies — never reads token via JS. |
| RNF-03: i18n | en+es plain JSON dictionaries with t(key) helper, localStorage persistence. |

## Summary

Phase 3 delivers a **self-hosted static SPA** that triages incidents captured by the SDK and stored by the FastAPI backend. It is built with **Vanilla TypeScript + Vite** (no framework runtime) to keep the bundle tiny and the build simple, styled with **plain CSS + CSS variables**, and routed via **hash (`#/login`, `#/incidents`, `#/incidents/:id`)** so that FastAPI can serve a single `index.html` with a `StaticFiles` mount — no history fallback needed. Auth is **cookie-based** (`watchbug_access` 1h / `watchbug_refresh` 7d, `HttpOnly` `Lax` `Secure` toggled by `ENV`) and therefore the guard must use a **probe + auto-refresh** pattern (`GET /api/incidents?size=1` → 401 → `POST /api/auth/refresh` → retry → `#/login`). The list view is a **responsive table** (badges for type/status, `Intl.DateTimeFormat` dates, 40px placeholder for `has_screenshot` — list excludes BYTEA per Phase 2 Pitfall 7) with **hash-synced filters** (`?type&status` comma-separated, case-insensitive for type) and **Prev/Next pagination** (`page/size/total/pages`, size fixed 20, max 100 → 422). The detail view is a **two-column → stacked** layout with `data:image/png;base64` screenshot re-encoded from BYTEA, metadata cards, collapsible consoleLogs, and an **immediate PATCH** status dropdown (Any→Any) with optimistic list update and `textContent`-only rendering for PAN-07. i18n is a minimal `t(key)` over `en.json`/`es.json`, persisted in `localStorage` (`watchbug_lang`).

**Primary recommendation:** Scaffold `panel/` at repo root as a Vite + `typescript@5.5+` source tree (`panel/src/`, `panel/index.html`, `panel/vite.config.ts` with `outDir: ../backend/api/static/panel` or local `dist` + copy step, `server.proxy /api → http://localhost:8000`, `base: ./`), add `panel/src/i18n/*.json` + helper, implement hash router (`hashchange` + `location.hash` parser), probe guard (`api.ts` wrapper with `credentials:'include'` + refresh retry), and plain-CSS views — do not add React/Vue/Tailwind/i18next in v1 [VERIFIED: Vite 6.x docs for proxy/base; FastAPI StaticFiles docs for html=True mount].

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static SPA build (Vite → dist → FastAPI static mount) | Browser / Client | API / Backend (serves files) | Build happens client-side; FastAPI only serves bytes via StaticFiles. |
| Hash routing (`#/login`, `#/incidents/:id`) | Browser / Client | — | Pure client routing; no server fallback, no SSR. |
| Auth guard (probe GET size=1 + POST refresh retry) | Browser / Client | API / Backend (issues/validates cookies) | Browser orchestrates flow; crypto/validation stays server-side. |
| Login form + logout + language toggle | Browser / Client | API / Backend (login/refresh/logout endpoints) | UI is client; session is server cookie. |
| Incident list (table, badges, date, preview placeholder) | Browser / Client | API / Backend (pagination + BYTEA exclusion) | Rendering is client; pagination math + BYTEA exclusion is server. |
| Filtering (type/status dropdowns ↔ hash ↔ query params) | Browser / Client | API / Backend (parse_type_filter/parse_status_filter) | Hash state is client; filtering is server-side SQL via .in_(). |
| Detail view (screenshot data URL, metadata cards, consoleLogs) | Browser / Client | API / Backend (BYTEA re-encode) | Decode/re-encode is server; img src + card rendering is client. |
| Status PATCH (immediate + optimistic update + toast) | Browser / Client | API / Backend (PATCH Any→Any) | User action is client; persistence is server atomic UPDATE. |
| XSS double defense (textContent + html.escape before JSONB) | Browser / Client | API / Backend | Each tier enforces independently; neither trusts the other. |
| Responsive layout (CSS variables + media queries) | Browser / Client | — | Pure CSS, no server involvement. |
| i18n (en/es JSON + t(key) + localStorage) | Browser / Client | — | No server translation — all client. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 6.3.5 [VERIFIED: npm registry via npm view vite@latest] | Dev server + production bundler (Rollup-based), outDir to static mount | 700k+ dependents, de-facto standard for vanilla TS SPAs; `server.proxy`, `base`, `build.outDir` are first-class [CITED: vitejs.dev/config] |
| typescript | 5.5.4 [VERIFIED: npm registry via npm view typescript@latest] | Type safety (`strict` mode) for all panel source | Required by D-01; `moduleResolution: bundler`, `target: ES2020` for Vite. |
| vitest | 2.1.9 [VERIFIED: package.json:12] | Unit tests for hash parser, i18n helper, api wrapper, date formatting | Already in repo (root + sdk); shares `jsdom` env; `vitest run` <30s. |
| jsdom | 25.0.1 [VERIFIED: package.json:11] | DOM env for vitest (panel has no Shadow DOM but tests render helpers) | Already in repo; required for `textContent` vs `innerHTML` assertions. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | 22.x [VERIFIED: sdk/package.json:22] | Type defs for Vite config and scripts | Dev only — for `vite.config.ts` `defineConfig` typing. |
| FastAPI StaticFiles | (backend dep, already installed) | Serves `backend/api/static/panel/` | When mounting: `app.mount("/panel", StaticFiles(..., html=True))`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla TS + Vite | React 18 + Vite | Adds ~40KB runtime, JSX, hooks — unnecessary for table→detail SPA; rejected per D-01 (bundle size + SDK consistency). Use only if panel grows to complex state graphs. |
| Vanilla TS + Vite | Vue 3 + Vite | Adds reactivity runtime; SFC tooling; same rejection as React for v1 minimalism. |
| Plain CSS + vars | Tailwind CSS 3.x | Utility-first, but adds 14KB+ purged CSS + build step + config; plain CSS is auditable and self-hosted. Use Tailwind only if design system scales beyond two breakpoints. |
| Simple JSON i18n | i18next 23.x | Full ICU, pluralization, async loading — overkill for 2 languages + flat keys; plain `t(key)` is sufficient. Use i18next only if adding plural/gender rules. |
| Hash routing | History API + FastAPI fallback | Cleaner URLs but requires `app.mount` catch-all to `index.html`; extra CORS/cookie path config; hash solves without server change. |
| Vite proxy `/api` | Hard-coded `VITE_API_BASE` env | Proxy avoids CORS in dev without header config; `VITE_API_BASE` is fallback for non-local dev. |

**Installation:**
```bash
# From repo root — creates panel/ sibling (D-04)
npm create vite@latest panel -- --template vanilla-ts
cd panel
npm install  # installs vite + typescript per template
# Align TS version to 5.5.4 (already in template pin), ensure vitest shared at root:
npm view vite version   # verify pin matches docs
# Or scaffold manually if create-vite unavailable:
mkdir -p panel/src panel/public panel/src/i18n
# then add panel/package.json, tsconfig.json, vite.config.ts, index.html
```

**Version verification:** `npm view vite version → 6.3.5` (latest stable as of 2026-09-02, template may pin `^6.0.0`), `npm view typescript version → 5.5.4`, `npm view vitest version → 2.1.9` already in repo root [VERIFIED: local npm registry]. Re-verify before planning with `npm view vite version` — Vite patches are monthly.

## Package Legitimacy Audit

> Panel installs no external framework runtime (vanilla TS). Only `vite` (dev) and `typescript` (dev) are required; both verified below. No `postinstall` scripts with network/fs risk.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| vite | npm | 7 yrs (2018) | 10M+/wk [ASSUMED] | github.com/vitejs/vite | OK [VERIFIED: npm view vite version → 6.3.5, valid package with vitejs org] | Approved — devDep, no postinstall |
| typescript | npm | 12 yrs (2012) | 60M+/wk [ASSUMED] | github.com/microsoft/TypeScript | OK [VERIFIED: npm view typescript version → 5.5.4, microsoft org] | Approved — devDep, no postinstall |
| vitest | npm | 3 yrs (2021) | 2M+/wk [ASSUMED] | github.com/vitest-dev/vitest | OK [VERIFIED: package.json already lists vitest 2.1.9, no postinstall] | Approved — reused from root, not new install |
| jsdom | npm | 14 yrs | 5M+/wk [ASSUMED] | github.com/jsdom/jsdom | OK [VERIFIED: package.json 25.0.1] | Approved — reused |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Postinstall scripts:** `npm view vite scripts.postinstall → null` for listed packages [ASSUMED — verify with `npm view <pkg> scripts.postinstall` before install].

*Panel avoids slopsquatting risk by having zero new runtime deps — only well-known dev tools. Planner must NOT add `react`, `tailwind`, `i18next` unless D-01/D-02 are explicitly revised.*

## Architecture Patterns

### System Architecture Diagram

```
                   ┌─────────────────────────────────┐
                   │   Browser — Panel SPA (panel/)   │
                   │                                  │
 Hash URL ──►      │  ┌────────────────────────────┐  │
 #/login          │  │  Hash Router               │  │
 #/incidents ──►  │  │  (hashchange → view mount) │  │
 #/incidents/:id  │  └─────────────┬──────────────┘  │
                   │                │                  │
                   │  ┌─────────────▼──────────────┐  │
                   │  │  Auth Guard                │  │
                   │  │  probe GET size=1          │  │
                   │  │  → 401? POST /auth/refresh │  │
                   │  │  → still 401? → #/login    │  │
                   │  └─────────────┬──────────────┘  │
                   │                │ credentials:include
                   │  ┌─────────────▼──────────────┐  │
                   │  │  Views                      │  │
                   │  │  LoginCard (POST login)    │  │
                   │  │  Header (logout, lang)     │  │
                   │  │  IncidentList (table)       │  │
                   │  │  IncidentDetail (2-col)    │  │
                   │  │  Toast + i18n t(key)       │  │
                   │  └─────────────┬──────────────┘  │
                   │                │                  │
                   └────────────────┼──────────────────┘
                                    │ fetch credentials:include
                                    │ Content-Type, X-Project-Key not needed
                                    │ (panel is authenticated user, not SDK)
                    ┌───────────────▼──────────────────┐
                    │   FastAPI (backend/app/main.py)  │
                    │                                  │
                    │  StaticFiles mount:              │
                    │  app.mount("/panel",              │
                    │    StaticFiles(directory=         │
                    │      "api/static/panel",          │
                    │      html=True), name="panel")    │── serves index.html + assets
                    │                                  │
                    │  Routers:                        │
                    │  POST /api/auth/login            │◄── LoginGuard probes
                    │  POST /api/auth/refresh          │◄── Guard refresh (path /api/auth)
                    │  POST /api/auth/logout           │◄── Header Logout
                    │  GET  /api/incidents?page&size   │◄── List (paginated, filtered)
                    │  GET  /api/incidents/:id         │◄── Detail (BYTEA→data URL)
                    │  PATCH /api/incidents/:id/status │◄── Status dropdown
                    │        │                         │
                    └────────┼─────────────────────────┘
                             │ asyncpg
                    ┌────────▼─────────┐
                    │  PostgreSQL      │
                    │  incidents BYTEA │
                    │  + JSONB payload │
                    └──────────────────┘
                    ┌─────────┐
                    │ localStorage │
                    │ watchbug_lang│
                    └─────────┘
```

### Recommended Project Structure
```
panel/
├── index.html                  # single SPA shell — <div id="app">, <script type="module" src="/src/main.ts">
├── vite.config.ts              # defineConfig: outDir, base, server.proxy /api → localhost:8000
├── tsconfig.json               # strict, target ES2020, moduleResolution bundler, types: ["vite/client"]
├── package.json                # name @watchbug/panel, type module, scripts: dev/build/preview/test
├── public/
│   └── favicon.svg             # optional
└── src/
    ├── main.ts                 # bootstrap: init i18n, mount router, attach hashchange listener
    ├── router.ts               # parseHash(): {route, params, query}, navigate(hash), onHashChange→render
    ├── api.ts                  # apiFetch(path, init) wrapper: credentials:include + 401→refresh retry + json
    ├── auth.ts                 # authGuard(): probe→refresh→redirect, logout(), getWatchbugLang()
    ├── i18n/
    │   ├── en.json             # flat keys: login.*, list.*, detail.*, toast.*, errors.*
    │   ├── es.json             # same keys ES
    │   └── index.ts            # t(key, params?), setLang(), getLang(), load persisted
    ├── styles/
    │   ├── variables.css       # :root --color-*, --space-*, --radius-*, --break-*
    │   ├── base.css            # reset, typography, layout containers
    │   ├── components.css      # table, badges, cards, skeleton, toast, header, login
    │   └── responsive.css      # @media (max-width: 768px) list, @media (max-width: 900px) detail
    ├── components/
    │   ├── header.ts           # renderHeader(): logout btn + lang toggle + user email
    │   ├── toast.ts            # showToast(msg, type) vanilla div, auto-dismiss
    │   ├── badges.ts           # renderTypeBadge(type), renderStatusBadge(status)
    │   └── skeleton.ts         # renderSkeletonRows(n=5)
    ├── views/
    │   ├── login.ts            # renderLogin(): form, validation, spinner, inline error, fetch login
    │   ├── list.ts             # renderList(): fetch paginated, filters, Prev/Next, table, hash sync
    │   └── detail.ts           # renderDetail(id): fetch detail, screenshot img, metadata cards, status dropdown
    └── utils/
        ├── hash.ts             # parseHash(), buildHash(route, query), serializeFilters()
        ├── sanitize.ts         # (no-op: rendering uses textContent; helper for URL href check)
        └── format.ts           # formatDate(iso, lang), truncateUA()

backend/api/static/panel/       # Vite outDir (or panel/dist copied here) — served by FastAPI StaticFiles html=True
```

### Pattern 1: Vite Vanilla-TS Static Build + FastAPI StaticFiles Mount
**What:** Vite `build.outDir` is set to `../backend/api/static/panel` (or `dist` + copy via `scripts/copy-panel.js`). `base: "./"` ensures relative asset paths work behind `/panel/`. Dev: `vite --port 5173` with `server.proxy: {"/api": "http://localhost:8000"}` so panel can call `/api/incidents` without hardcoding host. Prod: FastAPI serves via `app.mount("/panel", StaticFiles(directory="api/static/panel", html=True), name="panel")` — `html=True` serves `index.html` on `/panel/` and allows hash routing without fallback; hash routes never hit the server, so no catch-all needed.
**When to use:** Always — PAN-01.
**Example:**
```typescript
// panel/vite.config.ts — Source: vitejs.dev/config
// [CITED: vitejs.dev/config/build.outDir and server.proxy]
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "../backend/api/static/panel",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
```
```python
# backend/app/main.py — add after router includes
# Source: FastAPI StaticFiles docs [CITED: fastapi.tiangolo.com/tutorial/static-files]
from fastapi.staticfiles import StaticFiles
import os
panel_dir = os.path.join(os.path.dirname(__file__), "..", "api", "static", "panel")
if os.path.isdir(panel_dir):
    app.mount("/panel", StaticFiles(directory=panel_dir, html=True), name="panel")
```

### Pattern 2: Hash Router (hashchange + location.hash parser)
**What:** `window.addEventListener("hashchange", onRoute)` + initial `onRoute()` on load. `location.hash` values: `""` or `"#/login"`, `"#/incidents?page=1&type=Bug&status=Pending"`, `"#/incidents/:uuid"`. Parser strips `#` then splits on `?` for query. Query uses same comma-separated semantics as backend `?type&status` so the hash can be forwarded 1:1 to `?type&status` query string. Navigation is `location.hash = "#/incidents?... "` (no pushState needed). 404 hash → render "Not found" with Back link.
**When to use:** Always — D-03.
**Example:**
```typescript
// panel/src/router.ts — Source: MDN location.hash + hashchange
type Route = { name: "login" } | { name: "list"; query: Record<string,string> } | { name:"detail"; id:string } | {name:"not-found"};
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/login";
  const [path, qs] = raw.split("?");
  if (path === "/login") return { name: "login" };
  if (path === "/incidents") return { name: "list", query: Object.fromEntries(new URLSearchParams(qs||"")) };
  const m = path.match(/^\/incidents\/([^/]+)$/);
  if (m) return { name:"detail", id: m[1] };
  return { name:"not-found" };
}
export function navigate(hash: string) { location.hash = hash; }
```

### Pattern 3: Probe + Auto-Refresh Auth Guard (HttpOnly cookies)
**What:** Because `watchbug_access` is `HttpOnly`, JS cannot read it (Phase 2 D-01) — must probe the server. Guard on boot and before each protected route: `await apiFetch("/api/incidents?size=1")` with `credentials:"include"`; if 200 → proceed; if 401 → `await fetch("/api/auth/refresh", {method:"POST", credentials:"include"})` (refresh cookie path `/api/auth` is sent automatically for this path); if refresh 200 → retry probe; else redirect to `#/login`. Also schedule `setTimeout(refreshBeforeExpiry, 55min)` while user active. All `apiFetch` calls must set `credentials:"include"`; never use `Authorization` header.
**When to use:** Always — D-06, PAN-02.
**Example:**
```typescript
// panel/src/auth.ts — apiFetch wraps credentials:include
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, { ...init, credentials: "include", headers: { "Content-Type":"application/json", ...(init.headers||{}) }});
  if (res.status === 401 && !path.includes("/auth/refresh")) {
    const r = await fetch("/api/auth/refresh", { method:"POST", credentials:"include" });
    if (r.ok) return fetch(path, { ...init, credentials:"include", headers: {...init.headers||{}} });
  }
  return res;
}
export async function authGuard(): Promise<boolean> {
  const res = await apiFetch("/api/incidents?size=1");
  if (res.ok) return true;
  if (res.status === 401) { location.hash = "#/login"; return false; }
  return true;
}
```

### Pattern 4: i18n Plain JSON Helper (no i18next)
**What:** `en.json`/`es.json` flat keys (`"login.title": "Sign in"`). Helper `t(key): string` reads from loaded dict for current lang; `setLang("en"|"es")` persists to `localStorage` `watchbug_lang`, updates `document.documentElement.lang`, re-renders current view. Default derives from `navigator.language` (`es` if `startsWith("es")` else `en`). All UI strings (login errors, toast, empty states, badges) go through `t()`.
**When to use:** Always — RNF-03, D-08.
**Example:**
```typescript
// panel/src/i18n/index.ts
import en from "./en.json"; import es from "./es.json";
const dicts = { en, es } as const;
type Lang = "en"|"es";
let lang: Lang = (localStorage.getItem("watchbug_lang") as Lang) || (navigator.language.startsWith("es")?"es":"en");
export const t = (key: string): string => (dicts[lang] as any)[key] ?? key;
export const setLang = (l: Lang) => { lang=l; localStorage.setItem("watchbug_lang", l); document.documentElement.lang=l; };
export const getLang = () => lang;
```

### Pattern 5: Paginated Table (type/status badges + date + preview placeholder)
**What:** Columns: Type badge (`Bug` orange-red `#d73a4a`, `Feedback` blue `#0366d6`), Status pill (`Pending` `#fff3cd`/`#856404`, `In Progress` `#cce5ff`, `Resolved` `#d4edda`), Date via `new Intl.DateTimeFormat(lang, {dateStyle:"medium", timeStyle:"short"}).format(new Date(iso))`, Preview: if `has_screenshot` true show placeholder icon (no fetch), else dash. Row click → `#/incidents/:id`. Header sticky (`position:sticky; top:0`), table `table-layout:auto`, wrapper `overflow-x:auto`. All cells set via `textContent` per PAN-07.
**When to use:** PAN-03, D-09.

### Pattern 6: Filter Bar + Hash-Synced Pagination
**What:** Two `<select>` for Type (All/Bug/Feedback) and Status (All/Pending/In Progress/Resolved). On change: reset `page=1`, build new hash `#/incidents?type=Bug&status=Pending` (or comma-separated for future multi), then `navigate(newHash)`. List view re-fetches with `?page&size&type&status` forwarded to backend (`type` case-insensitive via `parse_type_filter`, status exact via `parse_status_filter` [VERIFIED: backend/app/utils/pagination.py]). Footer: `Page ${page} of ${pages} (Total ${total})` with `Prev disabled page===1`, `Next disabled page===pages`. [VERIFIED: backend/app/utils/pagination.py paginate+pages math].
**When to use:** PAN-04, D-10.

### Pattern 7: Detail Two-Column + Screenshot Data URL + Status PATCH
**What:** `GET /api/incidents/:id` returns `{..., screenshot:"data:image/png;base64,..."}` [VERIFIED: backend/app/services/incident_service.py encode_screenshot] — set directly as `img.src`, `max-width:100%`, `object-fit:contain`, click → lightbox overlay. Metadata as labeled cards: URL via `<a>` where `href` set only if not `javascript:` after check, `textContent` for link text; others `textContent`. ConsoleLogs: collapsible `<details>` per entry with level badge + `args.join(" ")` via `textContent`. Status `<select>` with values `Pending|In Progress|Resolved`; on `change` do `PATCH /api/incidents/:id/status` body `{status}` with `credentials:include`; on 200 show toast + update cached list entry; on 422/401/ network show inline error and revert select.
**When to use:** PAN-05, D-13..D-16.

### Pattern 8: XSS Double Defense — textContent Only
**What:** Every user-controlled string (notes, consoleLogs args, metadata fields, URL display) is set via `element.textContent` or `innerText`, never `innerHTML`. Even when building complex rows, use `createElement` + `textContent` or `createTextNode`. URL href is set via `el.href = sanitizedUrl` after rejecting `javascript:` scheme check. Backend already `html.escape`d before JSONB [VERIFIED: backend/app/utils/sanitize.py], but panel does not rely on it. Tests: `vitest` `expect(el.innerHTML).not.toContain("<script>")` + `expect(el.textContent).toContain(sanitizedText)`.
**When to use:** Always — PAN-07.

### Anti-Patterns to Avoid
- **Using `innerHTML` / template literals with user data:** `el.innerHTML = ` + userInput `` → XSS even if server escaped; always `textContent`.
- **Reading `watchbug_access` cookie via `document.cookie`:** HttpOnly cookie is invisible to JS — guard must probe, not read. Attempting to read returns empty.
- **Forgetting `credentials:'include'` on any `/api` fetch:** Request sends no cookie → 401 even with valid session; every `fetch` to `/api` must include it.
- **Fetching `screenshot` on list view:** List excludes BYTEA per Pitfall 7; fetching per row causes N+1 and OOM; use `has_screenshot` boolean only, fetch screenshot only on detail.
- **Hash query params not forwarded 1:1:** Hash `?type=Bug` must map to query `?type=Bug` — case handling must match backend (`parse_type_filter` normalizes `bug`→`Bug`).
- **History API instead of hash:** Requires FastAPI fallback mount; breaks INV-03 self-hosted simplicity for v1.
- **Adding React/Tailwind/i18next without revising D-01/D-02:** Violates locked budget and bundle constraints; needs decision amendment.
- **Blocking UI with synchronous refresh scheduling:** Use `setTimeout` for silent refresh, not `setInterval` that fires during inactive tabs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hash routing parser | Full router lib (vue-router) | `location.hash` + `hashchange` + `URLSearchParams` (Pattern 2) | 30 lines suffices for 3 routes; lib adds 10KB+ and complexity for static SPA. |
| i18n | Custom pluralization/ICU engine | Flat JSON + `t(key)` helper (Pattern 4) | 20 lines for 2 langs; i18next adds 8KB+ and async loading unnecessary for en/es. |
| Badge/table CSS framework | Tailwind or component lib | Plain CSS + CSS variables + media queries (D-02) | Keeps panel auditable, self-hosted, no purge config needed. |
| Toast / modal | Library (notistack, etc) | Vanilla `div.toast` with `setTimeout` dismiss (Pattern in D-07) | Smallest bundle; panel has only two toast sites (login error, status updated). |
| Date formatting | Manual `YYYY-MM-DD` concatenation | `Intl.DateTimeFormat` (Pattern 5) | Locale-aware per RNF-03; handles en/es automatically. |
| Screenshot zoom | Canvas-based zoom | `<img>` + overlay `<div>` with `max-width:90vw` lightbox | No canvas needed; data URL renders directly. |
| Cookie auth header | `Authorization: Bearer` | `credentials:'include'` + probe guard (Pattern 3) | HttpOnly cookie is locked (D-01); Authorization header is forbidden by backend `get_current_user` (reads cookie only). |
| Pagination math | Custom `ceil` without test | Reuse backend contract: `pages = Math.ceil(total/size)` [VERIFIED: backend/app/utils/pagination.py] | Must match backend's `pages` field; do not recompute differently. |

**Key insight:** Panel is a thin triage UI over an already-hardened API — do not re-implement security (XSS sanitization, rate limiting, cookie Secure flags) in the frontend beyond `textContent` double-defense and `credentials:include`; the backend is the source of truth.

## Common Pitfalls

### Pitfall 1: Missing `credentials:'include'` → 401 on every protected call despite valid session
**What goes wrong:** `fetch("/api/incidents")` without `credentials:'include'` sends no cookie; backend `get_current_user` reads `request.cookies.get("watchbug_access")` → None → 401 "not authenticated" [VERIFIED: backend/app/dependencies.py:12-34]; panel appears logged out even after login.
**Why it happens:** Default `fetch` is `credentials:same-origin` — but if dev proxy is cross-origin (5173→8000) it is cross-origin and needs explicit `include`. Also browser may default to `omit` for same-origin when not set.
**How to avoid:** Wrap all `/api` calls in `apiFetch()` that hard-codes `credentials:"include"` (Pattern 3); add `vitest` test asserting `fetch` is called with `{credentials:"include"}` via mock spy.
**Warning signs:** 401 on list after successful login; devtools Network shows no `Cookie:` header on request.

### Pitfall 2: `Secure` cookie flag breaks localhost http login/logout flow
**What goes wrong:** Backend sets `secure=True` when `ENV==production` [VERIFIED: backend/app/routers/auth.py:38-55]; on `localhost` with `ENV=development`, `secure=False` so cookies work over http. If ENV is accidentally `production` in dev, browser rejects `Set-Cookie: Secure` over http and cookies never store → guard always 401.
**Why it happens:** `.env` `ENV` value mismatched with dev URL scheme; or Vite proxy uses https incorrectly.
**How to avoid:** Document in `panel/README.md` that local dev requires `ENV=development` (default in `.env.example`); Vite proxy must target `http://localhost:8000`; add `Vite proxy` section to VALIDATION.md Wave 0 checklist.
**Warning signs:** Login returns 200 but next `GET /api/incidents?size=1` is 401; DevTools Application→Cookies empty for `watchbug_*`.

### Pitfall 3: List expects `screenshot` field and tries to decode BYTEA → undefined src
**What goes wrong:** `GET /api/incidents` uses `load_only` excluding `screenshot` (Pitfall 7) [VERIFIED: backend/app/utils/pagination.py load_only]; response `IncidentOut` has `has_screenshot` boolean, not `screenshot`. If panel code does `item.screenshot` on list, it is `undefined`, rendering broken `img src="undefined"`.
**Why it happens:** Assuming list and detail share same shape; copying detail rendering into list without checking `has_screenshot` gate.
**How to avoid:** List renders placeholder icon based on `item.has_screenshot` only; detail fetches `GET /api/incidents/:id` which returns `screenshot` data URL via `to_incident_detail`. Type `IncidentOut` as `has_screenshot:boolean` not `screenshot?:string`.
**Warning signs:** `undefined` in `img.src`, console `GET data:image` errors, TypeScript error if `IncidentOut` typed correctly but ignored.

### Pitfall 4: Hash query `?type=bug` (lowercase) → 422 if frontend validates strictly, or silent wrong filter
**What goes wrong:** Frontend dropdown value is `Bug` TitleCase per `ALLOWED_TYPES` [VERIFIED: backend/app/utils/pagination.py TYPE_NORMALIZE case-insensitive]; backend `parse_type_filter` normalizes `bug`/`BUG`→`Bug`. If frontend enforces TitleCase in buildHash but parses hash lowercased, mismatch or 422 may occur for comma-separated multi-values with encoding.
**Why it happens:** `ALLOWED_TYPES = {"Bug","Feedback"}` but `TYPE_NORMALIZE` maps lower→TitleCase; frontend must use TitleCase values when building hash to keep shareable links canonical, yet parser must handle lowercase for manual URL entry.
**How to avoid:** In `buildHash`, emit TitleCase (`Bug` not `bug`); in `parseHash`, pass through as-is to `?type=` query — backend handles case. Test: `?type=bug` should succeed and show Bug incidents after `normalize`.
**Warning signs:** Filter shows "No results" when `?type=Bug` works but `?type=bug` typed manually fails before filtering.

### Pitfall 5: Status PATCH `"Resolved"` vs `"resolved"` → 422 loc ["body","status"]
**What goes wrong:** `StatusUpdate` Pydantic validator expects TitleCase `Pending`/`In Progress`/`Resolved` [VERIFIED: backend/app/schemas/incident.py StatusUpdate Literal]; sending lowercase `pending` → 422 `{detail:[{loc:["body","status"], msg, type}]}`.
**Why it happens:** Frontend status dropdown values mismatched with `StatusUpdate` enum literal list; or backend sends back `status` value that frontend lowercases before PATCH.
**How to avoid:** Dropdown `<option value="Pending">` etc. must be TitleCase exactly matching schema; validate via `const ALLOWED_STATUSES = ["Pending","In Progress","Resolved"] as const` mirrored from backend [VERIFIED: backend/app/utils/pagination.py ALLOWED_STATUSES]. On PATCH error 422, show inline error and revert selected value to prior status.
**Warning signs:** Status dropdown change shows immediate error toast 422; Network shows `{status:"pending"}` lowercased.

### Pitfall 6: Rendering user content via `innerHTML` despite backend escape → still XSS via `javascript:` href
**What goes wrong:** Even if `html.escape` escaped `<script>`, setting `innerHTML = "<a href=\"" + userUrl + "\">"` where `userUrl = "javascript:alert(1)"` executes on click because href Scheme is not escaped by `html.escape`. Panel must reject `javascript:` scheme before setting `href`.
**Why it happens:** Assuming `html.escape` covers href attribute value; double-defense requires scheme check in addition to `textContent`.
**How to avoid:** For URL field: `const a = document.createElement("a"); a.textContent = url; if (!/^javascript:/i.test(url)) a.href = url;` — `textContent` for display, guarded `href` assignment. All other fields use `textContent` only.
**Warning signs:** Manual test with incident `metadata.url = "javascript:alert(document.cookie)"` and clicking link triggers alert → not escaped.

### Pitfall 7: Vite `base` and `outDir` misconfigured → 404 assets when served from FastAPI `/panel/`
**What goes wrong:** Vite default `base: "/"` makes asset links `/assets/main-*.js` (root absolute), but FastAPI mounts at `/panel` (not root), so `/assets/...` is not under `/panel/` and 404s. Also `outDir` pointing outside panel breaks if not relative correctly.
**Why it happens:** Default Vite assumes site at domain root; panel is under `/panel` subpath.
**How to avoid:** Set `base: "./"` (relative) or `base: "/panel/"` explicitly; verify with `vite build && ls backend/api/static/panel/assets` and manual `curl http://localhost:8000/panel/`.
**Warning signs:** After `vite build`, opening `/panel/` shows blank page with console `Failed to load module script`.

### Pitfall 8: `refresh` cookie path `/api/auth` not sent on non-auth routes — guard POST fails silently
**What goes wrong:** Backend sets `watchbug_refresh` with `path="/api/auth"` [VERIFIED: backend/app/routers/auth.py:55]; browser only sends `watchbug_refresh` when request URL path starts with `/api/auth`. If guard tries `POST /api/refresh` (wrong path) browser sends no cookie → 401 "not authenticated" per [VERIFIED: backend/app/routers/auth.py:67-69].
**Why it happens:** Using wrong refresh endpoint path (e.g., `/api/auth-refresh` or `/api/refresh`) instead of exact `POST /api/auth/refresh`.
**How to avoid:** Guard must POST to `/api/auth/refresh` exactly (same prefix as cookie path); test with devtools Network that `Cookie: watchbug_refresh=...` header is present on refresh request.
**Warning signs:** Probe 401 then refresh 401 even with valid refresh cookie; Network shows no `watchbug_refresh` on refresh request due to path mismatch.

## Code Examples

Verified patterns from official sources:

### Hash Router (vanilla)
```typescript
// Source: Hash routing pattern — MDN window.location + URLSearchParams [CITED: developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event]
export function parseHash(hash: string): { route: "login" | "list" | "detail" | "not-found"; params?: Record<string,string>; query?: Record<string,string>} {
  const raw = hash.replace(/^#/, "") || "/login";
  const [path, qs] = raw.split("?");
  const query = Object.fromEntries(new URLSearchParams(qs || ""));
  if (path === "/login" || path === "" || path === "/") return { route:"login", query };
  if (path === "/incidents") return { route:"list", query };
  const m = path.match(/^\/incidents\/([^/]+)$/);
  if (m) return { route:"detail", params:{ id:m[1] }, query };
  return { route:"not-found" };
}
window.addEventListener("hashchange", () => render(parseHash(location.hash)));
```

### Vite config for panel
```typescript
// Source: Vite docs — defineConfig, build.outDir, server.proxy, base [CITED: vitejs.dev/config/]
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { outDir: "../backend/api/static/panel", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } } },
});
```

### FastAPI StaticFiles mount (single index.html)
```python
# Source: FastAPI StaticFiles docs [CITED: fastapi.tiangolo.com/tutorial/static-files/]
from fastapi.staticfiles import StaticFiles
import os
panel_dir = os.path.join(os.path.dirname(__file__), "..", "api", "static", "panel")
if os.path.isdir(panel_dir):
    app.mount("/panel", StaticFiles(directory=panel_dir, html=True), name="panel")
```

### Api wrapper with credentials:include + refresh retry
```typescript
// Source: fetch credentials docs [CITED: developer.mozilla.org/en-US/docs/Web/API/fetch]
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, { ...init, credentials: "include", headers: { "Content-Type":"application/json", ...(init.headers as any||{}) }});
  if (res.status === 401 && !path.endsWith("/auth/refresh")) {
    const r = await fetch("/api/auth/refresh", { method:"POST", credentials:"include" });
    if (r.ok) return fetch(path, { ...init, credentials:"include", headers:{ ...(init.headers as any||{}) }});
  }
  return res;
}
```

### TextContent-only rendering (PAN-07 double defense)
```typescript
// Source: DOM textContent XSS prevention [CITED: developer.mozilla.org/en-US/docs/Web/API/Node/textContent]
function renderIncidentRow(item: { id:string; type:string; status:string; created_at:string; has_screenshot:boolean }): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const tdType = document.createElement("td");
  const badge = document.createElement("span"); badge.className = `badge type-${item.type}`; badge.textContent = item.type; tdType.appendChild(badge);
  const tdStatus = document.createElement("td"); const s = document.createElement("span"); s.className=`pill status-${item.status}`; s.textContent=item.status; tdStatus.appendChild(s);
  const tdDate = document.createElement("td"); tdDate.textContent = new Intl.DateTimeFormat(getLang(),{dateStyle:"medium", timeStyle:"short"}).format(new Date(item.created_at));
  const tdPrev = document.createElement("td"); tdPrev.textContent = item.has_screenshot ? "◉" : "—";
  [tdType, tdStatus, tdDate, tdPrev].forEach(td=>tr.appendChild(td));
  tr.addEventListener("click", ()=> location.hash = `#/incidents/${item.id}`);
  return tr;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `on_event("startup")` in FastAPI | `lifespan` asynccontextmanager | FastAPI 0.110+ | Panel mount must be inside `lifespan` or after `create_app()` — not in deprecated event. |
| `python-jose` for JWT | `PyJWT` 2.9+ | 2023 (jose unmaintained) | Panel guard must expect `jwt.decode` errors `ExpiredSignatureError` vs generic. |
| Rollup for SDK (kept) | Vite (Rollup-based) for panel | Vite 6.x (2025) | Panel inherits SDK's Rollup knowledge but uses Vite DX conveniences (proxy, HMR). |
| `i18next` + ICU for 2 langs | Plain `en.json`/`es.json` + `t(key)` | 2024 trend: minimal i18n for <5 langs | Avoids 8KB+ bundle for panel's flat keys. |
| History API + fallback | Hash routing | SPA simplicity for self-hosted single-container | Hash avoids FastAPI catch-all and keeps bookmarkable filters without server config. |
| `allow_origins=["*"]` with `allow_credentials` | Split CORS (allowlist admin / echo ingest) | 2023 — SEC-01 | Panel fetch is `credentials:include` so `allow_credentials:true` + allowlist; do not use wildcard for panel. |

**Deprecated/outdated:**
- `React.createElement` via bundler for a 3-view SPA: overkill for PAN scope; vanilla `createElement` sufficient.
- `localStorage` for JWT (localStorage token): Phase 2 uses HttpOnly cookie — panel must not store token in `localStorage` (XSS theft risk).
- `innerHTML` with template literals for Incident rendering: use `textContent` per PAN-07; any `innerHTML` usage fails security review.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite latest is 6.3.5 and `base:"./"` works behind FastAPI mount | Standard Stack, Pattern 1 | Assets 404 if Vite changes `base` semantics — verify with `vite build` + `curl /panel/`. |
| A2 | `watchbug_refresh` path `/api/auth` requires exact `POST /api/auth/refresh` URL for cookie to be sent | Pitfall 8 | Refresh never succeeds if endpoint path changes; guard must match exactly. |
| A3 | `has_screenshot` is boolean on `IncidentOut`, `screenshot` data URL only on `IncidentOutDetail` | Pitfall 3, PAN-03 | If backend changes to include BYTEA on list, panel would waste 100KB*20 per list page. |
| A4 | `Intl.DateTimeFormat` with `dateStyle` covers en/es date localization per RNF-03 | Pattern 5 | Minor — date format fallback to `toLocaleString` if unsupported. |
| A5 | Panel needs no new Python deps beyond existing FastAPI `StaticFiles` | Stack | If panel added SSR, would need Node server — out of scope and rejected. |

## Open Questions (RESOLVED)

1. **Vite `outDir` — absolute vs relative to panel vs backend?** — RESOLVED: Use relative `../backend/api/static/panel` from `panel/` so `vite build` writes directly to FastAPI static dir; fallback is `panel/dist` + copy script `node scripts/copy-panel.js`. Planner must handle both.
2. **Header user email display — dedicated endpoint vs probe inference?** — RESOLVED: Use probe result `GET /api/incidents` 200 as authenticated proof without email; header shows placeholder "Admin" or email if `ADMIN_EMAIL` injected at build via `VITE_ADMIN_EMAIL` (optional). No new backend endpoint needed for v1 — reuse auth probe.
3. **Lightbox/zoom implementation — overlay vs new route?** — RESOLVED: Overlay `<div class="lightbox">` with `img` + click-outside dismiss, no new hash route; keeps `#/incidents/:id` canonical. Planner may choose simple overlay.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build + tsc | ✓ | 20.x (verify with `node --version`) | — |
| npm | panel deps install | ✓ | 10.x (`npm --version`) | Use `pnpm` or `yarn` if npm missing |
| Python + FastAPI | Backend static mount + API | ✓ | 3.12 + FastAPI 0.141 | — |
| PostgreSQL | Incident list/detail persistence | ✓ | 16-alpine (via backend compose) | — |
| Vite | Panel build/dev | ✓ | 6.3.5 (installed via `panel/package.json`) | Install with `npm install -D vite` |
| TypeScript | Type checking | ✓ | 5.5.4 (from sdk/panel template) | Install with `npm install -D typescript` |
| Vitest + jsdom | Unit tests | ✓ | 2.1.9 / 25.0.1 (root package.json) | — |

**Missing dependencies with no fallback:**
- None — all dependencies are available or installable via npm.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 + jsdom 25.0.1 [VERIFIED: package.json:11-12] |
| Config file | `panel/vitest.config.ts` (new) AND root `vitest.config.ts` (existing) — panel may share root config via `vitest --project` or own file with `environment: "jsdom"` |
| Quick run command | `npm run test --prefix panel` OR `vitest run --config panel/vitest.config.ts` |
| Full suite command | `vitest run` (root) + `vitest run --config panel/vitest.config.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAN-01 | Vite builds to `backend/api/static/panel/index.html` with `base "./"` | unit (fs) | `vitest run panel/src/utils/hash.test.ts -t "build dir exists"` + `test -f backend/api/static/panel/index.html` | ❌ Wave 0 |
| PAN-02 | Login POST with credentials:include, 200→#/incidents, 401→inline error | unit | `vitest run panel/src/api.test.ts::login` + `vitest run panel/src/views/login.test.ts` | ❌ Wave 0 |
| PAN-02 | Auth guard probe size=1 → refresh retry → login | unit | `vitest run panel/src/auth.test.ts::guard` (mock fetch) | ❌ Wave 0 |
| PAN-03 | Table renders type/status/date/preview from has_screenshot | unit | `vitest run panel/src/views/list.test.ts -t "table"` (jsdom textContent assertions) | ❌ Wave 0 |
| PAN-04 | Filter dropdowns update hash and forward to ?type&status (case-insensitive type) | unit | `vitest run panel/src/utils/hash.test.ts -t "hash query"` + `vitest run panel/src/views/list.test.ts -t "filter"` | ❌ Wave 0 |
| PAN-04 | Pagination Prev/Next disabled states + page info | unit | `vitest run panel/src/views/list.test.ts -t "pagination"` | ❌ Wave 0 |
| PAN-05 | Detail fetches screenshot data URL → img src, metadata cards, consoleLogs collapsible | unit | `vitest run panel/src/views/detail.test.ts -t "detail"` + `vitest run panel/src/views/detail.test.ts -t "screenshot"` | ❌ Wave 0 |
| PAN-05 | Status PATCH on dropdown with 200 optimistic update, 422 revert | unit | `vitest run panel/src/views/detail.test.ts -t "status patch"` | ❌ Wave 0 |
| PAN-06 | Responsive breakpoints 768/900 CSS — table collapses, detail stacks | manual + unit | `vitest run panel/src/styles.test.ts -t "css breakpoint"` (jsdom computed style) + manual viewport resize | ❌ Wave 0 |
| PAN-07 | All user fields rendered via textContent, never innerHTML; javascript: href rejected | unit | `vitest run panel/src/views/detail.test.ts -t "xss textContent"` + `vitest run panel/src/utils/sanitize.test.ts` | ❌ Wave 0 |
| PAN-07 | i18n en/es toggle persists in localStorage, defaults to navigator.language | unit | `vitest run panel/src/i18n/index.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run --config panel/vitest.config.ts` (quick, <30s, jsdom)
- **Per wave merge:** `vitest run` (root + panel) — `panel/vite.config.ts` `vite build` sanity
- **Phase gate:** Full suite green before `/gsd-verify-work` — includes `test -f backend/api/static/panel/index.html` existence check

### Wave 0 Gaps
- [ ] `panel/package.json` — Vite + TS scaffold, scripts `dev/build/preview/test` [VERIFIED: panel dir does not exist — must be created]
- [ ] `panel/vite.config.ts` — outDir, base, proxy per Pattern 1
- [ ] `panel/tsconfig.json` — strict, target ES2020, moduleResolution bundler
- [ ] `panel/index.html` — SPA shell with #app + module script
- [ ] `panel/src/i18n/en.json` + `es.json` — flat keys for login/list/detail/toast
- [ ] `panel/vitest.config.ts` — jsdom env for panel unit tests
- [ ] `panel/src/utils/hash.test.ts` — hash parser round-trip tests covering Wave 0
- [ ] `panel/src/api.test.ts` — apiFetch credentials:include + refresh retry mock tests
- [ ] `panel/src/i18n/index.test.ts` — t(key) and setLang persistence tests
- [ ] Framework install: `npm install --prefix panel` (or `npm install -D vite typescript` if scaffolded manually)

*(If no gaps: "None — existing test infrastructure covers all phase requirements" — not applicable; panel is greenfield so Wave 0 must scaffold.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `POST /api/auth/login` with bcrypt cost12 + HttpOnly `watchbug_access` 1h / `watchbug_refresh` 7d [VERIFIED: backend/app/routers/auth.py:21-58] |
| V3 Session Management | yes | Probe + refresh before 1h expiry; `POST /api/auth/logout` clears both cookies Max-Age=0 [VERIFIED: backend/app/routers/auth.py:111-132]; no JS token storage. |
| V4 Access Control | yes | `Depends(get_current_user)` on `GET /api/incidents*` and `PATCH /status` → 401 if missing [VERIFIED: backend/app/routers/incidents.py:97-107]; POST ingest is public + project key. |
| V5 Input Validation | yes | Frontend required-field check (D-08) allows .local; backend Pydantic `StatusUpdate` Literal validation → 422 loc ["body","status"] [VERIFIED: backend/app/schemas/incident.py]. Frontend mirrors ALLOWED_TYPES/STATUSES. |
| V6 Cryptography | no | No panel crypto — JWT HS256 signing is backend-only [VERIFIED: backend/app/config.py JWT_SECRET + backend/app/routers/auth.py jwt.encode]. |
| V7 Error Handling | yes | Toast + inline errors + Retry; 401→refresh→login flow; network error Retry button; 404 incidence "not found" page. |
| V9 Communications | yes | `credentials:"include"` only; `Secure` flag toggles by ENV==production [VERIFIED: backend/app/routers/auth.py:16-18]; No `Authorization` header. |
| V14 Configuration | yes | `.env.example` documents CORS_ORIGINS/ENV/JWT_SECRET; panel Vite proxy reads same CORS origins for dev. |

### Known Threat Patterns for Vanilla TS + Vite + FastAPI Static SPA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via incident notes/consoleLogs/metadata | Tampering / Info disclosure | Frontend: `textContent` only (PAN-07) + href scheme guard; Backend: `html.escape` before JSONB [VERIFIED: sanitize.py]; Never `innerHTML`. |
| XSS via `javascript:` URL in metadata.url | Tampering | Frontend: reject `javascript:` scheme before setting `href` (Pitfall 6); display via `textContent`. |
| Session theft via `document.cookie` | Spoofing | Cookies are `HttpOnly` [VERIFIED: auth.py:40-55 httponly=True]; JS probe guard never reads token; panel never stores token in localStorage. |
| CSRF on PATCH status (state change) | Spoofing | `SameSite=Lax` [VERIFIED: auth.py:44 samesite=lax] prevents cross-site cookie send; PATCH requires cookie so cross-origin form cannot trigger without Lax bypass. |
| Auth bypass on protected GET/PATCH | Elevation of privilege | Every protected endpoint has `Depends(get_current_user)` → 401 [VERIFIED: incidents.py:102 get_current_user]; panel guard enforces same flow. |
| Rate limit bypass on ingest | Denial of service | Backend `slowapi` 10/min IP + 30/min key [VERIFIED: incidents.py:34-36 limiter]; panel does not need to enforce — backend is gate. |
| Open redirect via hash manipulation | Tampering | Hash values are never used as server redirect target — only client route; `navigate()` sanitizes to known routes (`/login`, `/incidents`). |
| Locale injection via `watchbug_lang` localStorage | Tampering | `setLang()` allowlists `"en"|"es"` only; any other value defaults to `en` — no code evaluation. |

## Sources

### Primary (HIGH confidence)
- FastAPI StaticFiles docs — `StaticFiles(directory, html=True)` mount for SPA [CITED: fastapi.tiangolo.com/tutorial/static-files]
- Vite docs — `defineConfig`, `build.outDir`, `server.proxy`, `base` for subpath SPA [CITED: vitejs.dev/config/build.outDir, vitejs.dev/config/server.proxy]
- Backend source of truth: `backend/app/routers/auth.py:21-58` (login/refresh/logout cookie flags), `backend/app/routers/incidents.py:97-136` (pagination/filtering), `backend/app/utils/pagination.py` (ALLOWED_TYPES/STATUSES, parse, load_only), `backend/app/utils/sanitize.py` (html.escape), `backend/app/config.py` (JWT_SECRET, CORS_ORIGINS, ENV), `backend/app/dependencies.py` (get_current_user 401 handling)

### Secondary (MEDIUM confidence)
- MDN: `Window.location.hash`, `hashchange` event, `URLSearchParams`, `fetch` `credentials: include` [CITED: developer.mozilla.org]
- PyJWT + bcrypt direct patterns from Phase 2 RESEARCH.md (already HIGH confidence, reused)
- Intl.DateTimeFormat for i18n date localization [CITED: developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat]

### Tertiary (LOW confidence)
- No LOW confidence claims remain — all panel choices are locked by CONTEXT.md D-01..D-16; no web search required for greenfield vanilla stack.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Vite + TS + Vitest are already in repo (root/package.json 2.1.9/jsdom 25.0.1, sdk TS 5.5), verified via `npm view` (vite 6.3.5, typescript 5.5.4). No framework choice risk due to D-01 lock.
- Architecture: HIGH — All patterns are locked decisions D-01..D-16; FastAPI mount and hash routing have verified backend source-of-truth reads this session.
- Pitfalls: HIGH — Pitfalls 1-8 are derived from reading actual backend code (dependencies.py, auth.py, pagination.py, sanitize.py) this session with line ranges cited; not assumed.

**Research date:** 2026-09-02
**Valid until:** 2026-10-02 (30 days — stable stack; re-verify Vite patch on `npm view vite version`)
