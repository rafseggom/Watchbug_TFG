# Phase 3: Admin Panel - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Teams can log in, browse incidents with visual screenshots, filter and search, and manage issue status through a responsive web interface. The panel is a **static SPA** served from `api/static/panel/` via FastAPI (PAN-01), authenticated via JWT HttpOnly cookies from Phase 2, consuming paginated `GET /api/incidents?page&size&type&status` and `PATCH /api/incidents/:id/status` plus `GET /api/incidents/:id` detail. Success is verified by: login redirects to list, paginated table with thumbnails and badges filterable by Bug/Feedback and status, detail with full screenshot + metadata + status dropdown that persists, and responsive desktop/tablet with XSS-escaped rendering. Out of scope: Docker orchestration (Phase 4), SDK widget changes, backend API contract changes, third-party integrations, real-time/WebSocket, OAuth/SSO.

</domain>

<decisions>
## Implementation Decisions

### Panel Stack & Build Pipeline
- **D-01:** Stack is **Vanilla TypeScript + Vite** — no framework runtime (React/Vue rejected to keep bundle small and consistent with SDK's vanilla TS + Rollup approach). Vite builds to static output. i18n bundled as simple JSON dictionaries `en.json`/`es.json` loaded at runtime, mirroring SDK's single-file en/es bundling per RNF-03. — **Reversibility:** costly — Switching to React/Vue requires rewriting all views, components, and build config, and would affect Phase 4 multi-stage Dockerfile (Node builder choice)
- **D-02:** Styling is **plain CSS with CSS variables** — no Tailwind or framework. Variables for colors/spacing/theme, media queries for tablet breakpoints. Keeps panel lightweight, self-hosted with no extra build deps, easy to audit for XSS-safe rendering. — **Reversibility:** reversible
- **D-03:** Routing is **hash routing (`#/login`, `#/incidents`, `#/incidents/:id`) with a single `index.html`** — no server fallback needed. FastAPI serves `api/static/panel/` as static files; any unknown path still serves `index.html` via hash, so no FastAPI history-fallback config required. Hash query string (`#/incidents?type=Bug&status=Pending`) preserves shareable/bookmarkable filter state. — **Reversibility:** costly — Changing to History API (`/login`, `/incidents/:id`) requires FastAPI to add a catch-all fallback to `index.html` and CORS/cookie path adjustments
- **D-04:** Source layout is **`panel/` at repo root** as sibling to `sdk/` and `backend/` — structure `panel/src/`, `panel/dist/` (Vite output), built output copied/synced to `backend/api/static/panel/` for FastAPI static mount. Keeps Python and JS concerns separated, aligns with existing repo sibling convention from ARCHITECTURE.md. — **Reversibility:** one-way — Moving source location breaks import paths, Vite config, and Phase 4 Dockerfile COPY layers; requires migration of build scripts

### Login & Session Flow
- **D-05:** Login form is **centered card with email/password + Remember-ish behavior via refresh token + loading spinner**. Submit does `fetch POST /api/auth/login` with `credentials: 'include'`, disables button and shows spinner while pending. On 200 redirects to `#/incidents`; on 401 shows localized inline error "Invalid credentials" (en/es). "Remember" is implicit via 7-day refresh cookie from Phase 2 — no extra checkbox state needed beyond using refresh flow; the UI may label it as keeping session. — **Reversibility:** reversible
- **D-06:** Auth guard uses **probe + auto-refresh pattern** due to HttpOnly cookies (JS cannot read JWT per D-01 Phase 2). On app boot and on each navigation to protected routes, attempt `GET /api/incidents?size=1` with `credentials: 'include'`; if 401, try `POST /api/auth/refresh` (refresh cookie path `/api/auth`); if refresh succeeds retry original request; if still 401 redirect to `#/login`. Also schedule silent refresh before 1h access expiry if user stays active. This respects Phase 2's 1h access + 7d refresh, `watchbug_access`/`watchbug_refresh` cookies, `SameSite=Lax`, `Secure` toggle by ENV. — **Reversibility:** reversible — Guard strategy is JS-only; swapping to redirect-on-any-401 is local change
- **D-07:** Logout and error messaging: **header logout button + toast + inline errors**. Top header shows current user email (fetched via `GET` probe or decoded minimal user info if endpoint added, else placeholder) and a Logout button. Logout does `POST /api/auth/logout` with `credentials: 'include'` which clears both cookies via `Max-Age=0` (Phase 2 D-04), then redirects to `#/login` and shows toast "Logged out". Auth errors show both inline under the form and as toast for visibility; all messages via i18n JSON (en/es). — **Reversibility:** reversible
- **D-08:** Login validation is **simple required-field check, not strict EmailStr**, to allow `admin@watchbug.local` (.local domain rejected by Pydantic EmailStr in Phase 2 D-02). Frontend checks non-empty email/password, shows localized "Email required" / "Password required". Language toggle **EN/ES** lives in header, persists in `localStorage` key `watchbug_lang`, defaults to `navigator.language` (`es` if starts with `es`, else `en`), applies immediately to all views including login. — **Reversibility:** reversible

### Incident List & Filtering UX
- **D-09:** List layout is **responsive table with thumbnail column + type/status badges**. Columns: Type badge (Bug red/orange, Feedback blue), Status pill (Pending yellow/amber, In Progress blue, Resolved green), Date (localized via `Intl.DateTimeFormat` per RNF-03), Preview (40px thumbnail placeholder icon when `has_screenshot:true`; list endpoint excludes BYTEA per Phase 2 Pitfall 7 — uses `has_screenshot` boolean, not actual bytes — so no image decode on list). Row click navigates to `#/incidents/:id`. Header row sticky, table horizontally scrollable on narrow tablet. All cell text rendered via `textContent` per PAN-07. — **Reversibility:** reversible
- **D-10:** Pagination and filtering: **Prev/Next + page info + two dropdowns synced to hash URL**. Footer shows "Page 1 of N (Total 42)" using backend `{items, total, page, size, pages}` (D-09 Phase 2). Prev disabled on page 1, Next disabled on last page. Filter bar has Type dropdown (All / Bug / Feedback) and Status dropdown (All / Pending / In Progress / Resolved); selecting resets to page 1, updates hash query (`#/incidents?type=Bug&status=Pending` or `status=Pending,In%20Progress` for multiples) so links are shareable/bookmarkable and directly drive `?type&status` query params (case-insensitive for type, exact for status per Phase 2). Page size fixed to backend default 20 for v1 (see D-12). — **Reversibility:** reversible — Filter UI is local; changing to chips/numbered pages touches only panel state and hash parsing
- **D-11:** Empty/loading/error states: **skeleton rows + empty illustration + escaped rendering**. Loading shows 5 skeleton shimmer rows. Empty (total=0) shows illustration/icon + localized "No incidents yet" / "No results for this filter" with a Clear Filters button. Error (network/401) shows inline error + Retry button that re-fetches with `credentials: 'include'`. All user-controlled fields (notes, consoleLogs, metadata strings) rendered via `textContent`/`innerText` never `innerHTML`, as backend already `html.escape`'d at ingest per SEC-03/PAN-07 — double defense. — **Reversibility:** reversible
- **D-12:** Responsive and page size: **fixed size 20, CSS-responsive table**. `size` is not user-selectable for v1 to keep scope tight (backend enforces `size ≤100` → 422 if exceeded). Table uses CSS: desktop `table-layout: auto`, tablet `<768px` collapses to stacked cards or hides thumbnail column and truncates User-Agent with ellipsis, keeps Type/Status badges visible. Breakpoint at `900px` for two-column→stack on detail, `768px` for list compaction — satisfies PAN-06 desktop+tablet. — **Reversibility:** reversible

### Detail View & Status Workflow
- **D-13:** Detail view is **dedicated hash route `#/incidents/:id` with two-column layout**. Left pane: large screenshot `img src="data:image/png;base64,..."` from `GET /api/incidents/:id` detail endpoint (which re-encodes BYTEA per Phase 2 `encode_screenshot`); image `max-width: 100%`, `object-fit: contain`, click to open lightbox/overlay zoom. Right pane: metadata cards (URL as escaped link, User-Agent, viewport/resolution, timestamp localized, project_id, type/status badges), consoleLogs collapsible section, notes. Top has Back to list link and status dropdown. Hash route gives shareable direct links. — **Reversibility:** costly — Changing to modal overlay would remove deep linking and require lifting detail state into list, affecting shareability
- **D-14:** Status workflow is **immediate PATCH on dropdown change + toast + optimistic list update**, leveraging Phase 2's Any→Any status transition (no state-machine enforcement). Selecting a new status triggers `PATCH /api/incidents/:id/status` with `{status: "Resolved"}` and `credentials: 'include'`; on 200 show toast "Status updated" (localized), optimistically update local detail state and cached list entry so returning to list reflects new status without refetch; on error (422 invalid status, 401, network) show inline error and revert dropdown to prior value. Valid values strictly "Pending" | "In Progress" | "Resolved" per `StatusUpdate` schema. — **Reversibility:** reversible — Could add explicit Save button later without breaking contract
- **D-15:** Metadata rendering is **formatted cards + collapsible consoleLogs, all escaped**. Metadata fields displayed as labeled rows/cards, not raw JSON `<pre>` — URL rendered as `<a>` with `textContent` + `href` set after escaping check (no `javascript:`), User-Agent/resolution/timestamps as text rows, payload passthrough fields enumerated. ConsoleLogs (required for Bug, optional for Feedback per TRN-04) shown as collapsible list per entry: level badge (`log`/`warn`/`error`/`info` color) + `args` joined as `textContent` + timestamp. Screenshot data URL is not user HTML — safe for `img src`. Never use `innerHTML`/`v-html`. — **Reversibility:** reversible
- **D-16:** Detail responsive and error handling: **stack to single column on tablet + dedicated 404/401 handling**. Desktop two columns (screenshot left 60%, metadata right 40%); below `900px` stack vertically (screenshot on top, metadata below, both full width). Large screenshots are scrollable within container and lazy-loaded. Missing incident (GET 404 or invalid UUID) shows localized "Incident not found" page with Back to list button. 401 during detail fetch triggers same probe→refresh→login flow as D-06. Network error shows Retry. — **Reversibility:** reversible

### Agent's Discretion
- Exact Vite config (`vite.config.ts` outDir, base path, dev server proxy for `/api` to `localhost:8000`) — agent picks idiomatic Vite defaults aligned with FastAPI mount.
- CSS variable naming/theming (light vs dark, badge colors hex values) — agent chooses accessible palette meeting WCAG contrast.
- Toast implementation (custom div vs lightweight lib) — must keep panel bundle small; agent prefers vanilla toast component.
- i18n library choice (simple JSON + helper `t(key)` vs `i18next` micro) — plain JSON with helper is sufficient for two languages; agent may use minimal helper.
- Table vs card exact breakpoint pixel values (768px vs 900px) — agent fine-tunes for PAN-06 tablet verification.
- ConsoleLogs display limit (truncate after N entries with Show more) — agent decides pagination within detail.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` — Phase 3 definition, goal, success criteria (5 items), requirements PAN-01..07, dependencies on Phase 2, UI hint yes, execution order 1→4
- `.planning/REQUIREMENTS.md` — Full definitions for PAN-01 (static SPA in api/static/panel/), PAN-02 (login redirect), PAN-03 (paginated table with type/status/date/preview), PAN-04 (filter bar Bug/Feedback + status), PAN-05 (detail with screenshot+metadata+status), PAN-06 (desktop+tablet responsive), PAN-07 (escaped text no raw HTML), traceability matrix, v2 deferred items
- `.planning/PROJECT.md` — Core value (lightweight isolated widget), constraints (i18n en+es, self-hosted single docker-compose, security posture, no OAuth/SSO scope)

### Security & Architecture
- `documentation/mission-brief.md` — Non-goals, RF-06 (Panel: list/filter/status/metadata), RF-07 (auth via creds + JWT/HttpOnly), RF-08 (docker-compose), RNF-03 (i18n), CA-05 (401 on unauth /api/incidents/*), RF-05 (persist image+JSON)
- `documentation/mentorship-pack.md` — INV-03 (agnostic containers, single docker-compose.yml), SEC-04 (zero secrets in code, .env only), SEC-05 (Stored XSS sanitize before store+render, rate limiting), SEC-06 (bcrypt, JWT HttpOnly/SameSite/Secure)

### Stack & Research (Phase 2 baseline)
- `.planning/phases/02-backend-api/02-RESEARCH.md` — Locked stack FastAPI+Pydantic v2+SQLAlchemy async+asyncpg+Alembic+PyJWT+bcrypt+slowapi, patterns for lifespan, Pydantic Settings, async models, JWT HttpOnly cookie (1h+7d, jti/sub/exp/iat, HS256), bcrypt cost12, split CORS, slowapi in-memory, XSS html.escape, 100KB guard — informs panel API contract
- `.planning/phases/02-backend-api/02-CONTEXT.md` — Locked decisions D-01..D-16: JWT via HttpOnly cookies `watchbug_access`/`watchbug_refresh`, 1h/7d TTL, seeded admin from .env/Admin local handling, public POST /api/incidents with X-Project-Key vs JWT-protected GET/PATCH, pagination `?page&size` → {items,total,page,size,pages} max 100, filtering `?type&status` comma-separated, BYTEA LargeBinary (no filesystem), Any→Any status, split CORS (open ingest vs allowlist admin with null rejection), slowapi limits, XSS sanitize before JSONB, health public
- `.planning/phases/02-backend-api/02-VERIFICATION.md` — Truth evidence that panel integrates against: POST 201 shape, GET paginated shape, PATCH Any→Any, 401 on unauth, 413, CORS null 403, rate limit 429, project key headers, BYTEA exclusion on list vs data URL on detail, health public
- `.planning/phases/01-sdk-core/01-CONTEXT.md` — SDK locked decisions D-01..D-17 (Shadow DOM closed, window.Watchbug.init, console buffer, consent API) and i18n both langs bundled — panel i18n follows same en/es approach
- `.planning/phases/01-sdk-core/01-RESEARCH.md` — Payload schema (Bug requires consoleLogs), transport `credentials: 'omit'` + `X-Watchbug-Key` — panel uses `credentials: 'include'` contrast

### Project Context & Backend Contract (scouted code — MANDATORY to read before planning)
- `backend/app/main.py` — FastAPI lifespan, `create_app` gates docs, middleware stack NullOriginMiddleware → IngestCorsMiddleware → CORSMiddleware (allowlist `cors_origins_list`, credentials true) → SlowAPIMiddleware, mounts routers health/incidents/auth — panel will add static mount `api/static/panel/`
- `backend/app/config.py` — Settings(BaseSettings) fields: DATABASE_URL, JWT_SECRET, ADMIN_EMAIL/ADMIN_PASSWORD, CORS_ORIGINS, DOCS_ENABLED, MAX_PAYLOAD_BYTES=102400, DEFAULT_PROJECT_API_KEY, ENV (Secure toggle) — panel reads CORS origins for dev proxy
- `backend/app/routers/incidents.py` — POST public 201 before size guard, project key resolve, validation TRN-04, CORS echo for ingest; GET paginated protected `Depends(get_current_user)` page ge1 size le100, `parse_type_filter`/`parse_status_filter` 422 on invalid; GET /{id} detail re-encodes BYTEA; PATCH /{id}/status Any→Any with StatusUpdate 422 loc shape
- `backend/app/routers/auth.py` — POST /api/auth/login|refresh|logout with `watchbug_access` (1h, path /) + `watchbug_refresh` (7d, path /api/auth) HttpOnly Lax Secure, bcrypt verify, jwt HS256 with `sub/jti/exp/iat` + `type: refresh`
- `backend/app/dependencies.py` — `get_current_user` reads `watchbug_access` cookie → jwt.decode HS256 allowlist → 401 not authenticated/token expired/invalid token → DB user lookup — panel guard must handle these 401 shapes
- `backend/app/schemas/incident.py` — IncidentCreate (type normalized Bug/Feedback, consoleLogs required for Bug/TRN-04, metadata url/userAgent/timestamp required), IncidentOut (has_screenshot), IncidentOutDetail (screenshot data URL), StatusUpdate (Pending/In Progress/Resolved)
- `backend/app/utils/pagination.py` — parse_type_filter (case-insensitive bug→Bug), parse_status_filter, `load_only` excluding screenshot for list (Pitfall 7), `ceil(total/size)`, `order_by(created_at.desc())`
- `backend/app/utils/sanitize.py` — html.escape quote True + event-handler/javascript: stripping, recursive sanitize_payload — panel double-defends with textContent
- `backend/app/services/incident_service.py` — decode_screenshot validate True, encode_screenshot data URL, to_incident_out (inspect unloaded to avoid lazy BYTEA), to_incident_detail
- `.env.example` — All 13 Settings fields documented, DATABASE_URL asyncpg, CORS_ORIGINS allowlist, ENV dev vs prod Secure, DOCS_ENABLED gating

### Tooling & Standards
- `sdk/package.json` / `sdk/rollup.config.mjs` / `vitest.config.ts` — Established frontend tooling: TypeScript + Rollup + Vitest + jsdom for SDK; panel will parallel with Vite + TS + Vitest for consistency
- `package.json` (root) — Root vitest/jsdom exists, scripts `test:unit` — panel can reuse or add `panel/package.json`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Backend static contract:** `backend/app/main.py` already creates FastAPI app with lifespan and middleware stack — panel only needs `app.mount("/panel", StaticFiles(directory="api/static/panel", html=True), name="panel")` or `app.add_middleware` for SPA fallback; no new server needed. Follow existing `create_app()` pattern.
- **i18n pattern from SDK:** `sdk/src/` bundles `en`/`es` dictionaries in a single file and toggles at runtime via `config.language` — panel can copy this plain-dict `t(key)` helper; no i18next dep needed.
- **XSS sanitization double defense:** `backend/app/utils/sanitize.py` already `html.escape`s before JSONB storage; panel must render via `textContent`/`innerText` never `innerHTML` (PAN-07) — no bleach/nh3 dep needed.
- **Pagination/filter types:** `backend/app/utils/pagination.py` exports `ALLOWED_TYPES`, `ALLOWED_STATUSES`, `TYPE_NORMALIZE`, `parse_*` — panel can mirror these constants for dropdown values and hash→query mapping.
- **Screenshot data URL:** `backend/app/services/incident_service.py:encode_screenshot` returns `data:image/png;base64,...` — panel can use directly as `img.src` without extra decode.

### Established Patterns
- **TypeScript + Vite + Vitest + jsdom** is not yet established for panel but SDK established TS + Rollup + Vitest + jsdom (greenfield will become new pattern); keep TS `strict` and `vitest` for panel unit tests as in sdk root.
- **Pydantic Settings from `.env` + `.env.example`** is locked for backend; panel dev proxy must read same `CORS_ORIGINS` for local dev (`VITE_API_BASE` or proxy `/api` → `http://localhost:8000`).
- **JWT HttpOnly cookie only (no Authorization header)** per D-01 Phase 2: panel must use `fetch(..., {credentials: 'include'})` for every `/api` call; never set `Authorization` header. `Secure` flag toggles by `ENV==production` (http localhost vs https prod).
- **SQLAlchemy async BYTEA deferred on list** (`load_only` excludes screenshot): panel list must not expect `screenshot` field — use `has_screenshot` boolean for placeholder icon; detail alone has `screenshot` data URL.
- **Payload shape:** `IncidentCreate` enforces `type` TitleCase Bug/Feedback, `consoleLogs` required for Bug (CA-01/TRN-04), `metadata.url/userAgent/timestamp` required — panel detail can assume these fields exist when rendering.

### Integration Points
- **Panel → POST /api/auth/login|refresh|logout** with `credentials: 'include'`: login sets cookies, refresh reissues `watchbug_access`, logout clears both — panel auth guard probes these before rendering protected views.
- **Panel → GET /api/incidents?page&size&type&status** with `credentials: 'include'` + `Depends(get_current_user)`: paginated filtered list drives table; 401 → refresh/login, 422 → invalid filter toast, 429 → Retry-After handling — panel must map these per Phase 2 verification.
- **Panel → GET /api/incidents/:id** and **PATCH /api/incidents/:id/status** with `credentials: 'include'`: detail fetch and status mutation; PATCH body `{status}` Any→Any; panel must show toast + optimistic update.
- **FastAPI static mount → Docker Phase 4:** `panel/dist` → `backend/api/static/panel/` must be COPY'd in multi-stage Dockerfile (Node builder → Python production) per DEP-02 — keep `panel/` sibling so Dockerfile can `COPY panel/dist /app/api/static/panel` without secret leakage (SEC-04).

</code>

<specifics>
## Specific Ideas

- Hash routing chosen explicitly to avoid requiring FastAPI history fallback configuration for self-hosted single-container simplicity (satisfies INV-03 agnostic infra).
- Vanilla TS + Vite keeps panel self-hosted and lightweight with minimal dependencies, mirroring SDK's vanilla Web Component philosophy and avoiding React/Vue runtime weight for a simple table→detail admin use case.
- Panel source at repo root `panel/` (not inside `backend/`) preserves clean separation between Python backend and JS frontend, matches existing `sdk/` + `backend/` sibling convention and simplifies Phase 4 `docker-compose.yml` named volumes.
- Table uses status badges with semantic colors (Bug vs Feedback, Pending yellow / In Progress blue / Resolved green) and 40px thumbnail placeholder for `has_screenshot` since list excludes BYTEA for OOM prevention.
- Pagination synced to hash query string so filtered views are bookmarkable/shareable and directly map to backend `?type&status` comma-separated contract (e.g., `status=Pending,In Progress`).
- Immediate status PATCH without explicit Save button reduces friction for the single-admin self-hosted flow (validated during Phase 2 discussion that Any→Any simplifies Panel dropdown).
- All rendering via `textContent` with no `innerHTML` — double defense with backend `html.escape` per SEC-03/PAN-07; even screenshot `img src` is a data URL not user HTML.
- Language toggle persists in `localStorage` (`watchbug_lang`) and derives default from `navigator.language`, consistent with SDK's runtime language switch (`init({language})`).
- Loading skeletons and empty illustrations were explicitly requested for perceived performance, not just spinner-only.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Future-phase items remain correctly tracked in REQUIREMENTS.md v2 (NET-01/02 network capture, BRD-01/02 breadcrumbs, NTF-01/02 email/webhook notifications, INT-01/02 error grouping/duplicate detection, STR-01/02 filesystem/MinIO + WebP compression) and Phase 4 Docker (DEP-01..05). No new deferred ideas emerged from this discussion.

</deferred>

---

*Phase: 03-Admin Panel*
*Context gathered: 2026-09-02*
