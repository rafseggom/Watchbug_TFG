# Phase 03: Admin Panel — Pattern Map

**Phase:** 03 - admin-panel
**Generated:** 2026-09-02
**Source files:** CONTEXT.md + RESEARCH.md + backend/app/main.py + sdk/ analogs

## File Classification

| File to Create/Modify | Role | Data Flow | Closest Analog | Pattern Source |
|-----------------------|------|-----------|----------------|----------------|
| `panel/package.json` | Config | — | `sdk/package.json:1-28` (rollup+ts+vitest) | Mirror sdk's type:module, scripts, devDeps |
| `panel/vite.config.ts` | Config | — | `sdk/rollup.config.mjs:1-28` (Rollup build) | Vite defineConfig with outDir/proxy/base (RESEARCH Pattern 1) |
| `panel/tsconfig.json` | Config | — | `sdk/tsconfig.json` (strict) | strict + bundler moduleResolution |
| `panel/index.html` | Entry | — | `sdk/index.html` (if exists) or Vite vanilla-ts template | Single #app shell |
| `panel/src/main.ts` | Bootstrap | imports router, auth, i18n | `sdk/src/index.ts:1-30` (init + widget mount) | Mount router on hashchange |
| `panel/src/router.ts` | Router | location.hash → parseHash → view | `sdk/src/widget/index.ts` (lifecycle) | hashchange + URLSearchParams parse |
| `panel/src/api.ts` | Service | fetch credentials:include → JSON | `sdk/src/transport/sender.ts` (fetch with retry) | Swap credentials:omit → credentials:include + refresh retry |
| `panel/src/auth.ts` | Service | probe GET size=1 → refresh | `backend/app/routers/auth.py:21-58` (login) + `backend/app/dependencies.py` (401) | Probe+refresh guard |
| `panel/src/i18n/en.json` + `es.json` + `index.ts` | i18n | t(key) + localStorage | `sdk/src/widget/i18n.ts` (en/es dict) | Plain JSON dict helper |
| `panel/src/styles/variables.css` + `base.css` + `components.css` + `responsive.css` | Styles | CSS vars + media queries | `sdk/src/widget/styles.css` (if exists) | Plain CSS vars, no Tailwind |
| `panel/src/components/header.ts` | Component | auth + lang | `sdk/src/widget/components/` (header) | Header with logout + lang toggle |
| `panel/src/components/toast.ts` | Component | showToast | `sdk/src/widget/toast.ts` | Vanilla div toast |
| `panel/src/components/badges.ts` | Component | renderType/Status badge | `backend/app/utils/pagination.py` ALLOWED_* | Badge via textContent |
| `panel/src/components/skeleton.ts` | Component | shimmer rows | — (greenfield) | Simple CSS shimmer |
| `panel/src/views/login.ts` | View | POST login → hash | `backend/app/routers/auth.py:21-58` | Form + spinner + inline error |
| `panel/src/views/list.ts` | View | GET list → table | `backend/app/routers/incidents.py:97-136` + `backend/app/utils/pagination.py` | Table + filter hash sync + Prev/Next |
| `panel/src/views/detail.ts` | View | GET detail → PATCH status | `backend/app/services/incident_service.py:encode_screenshot` + `backend/app/schemas/incident.py` StatusUpdate | Detail 2-col + screenshot + status dropdown |
| `panel/src/utils/hash.ts` | Util | parseHash/buildHash | — (greenfield) | Hash ↔ query 1:1 mapping |
| `panel/src/utils/format.ts` | Util | formatDate via Intl | `sdk/src/utils/format.ts` | Intl.DateTimeFormat |
| `panel/vitest.config.ts` | Config | — | `sdk/vitest.config.ts` + root `vitest.config.ts` | jsdom env |
| `backend/app/main.py` | Modify | mount StaticFiles | `backend/app/main.py:96-139` create_app() | Add app.mount("/panel", StaticFiles(..., html=True)) after router includes |

## No Analog Found

| File | Why No Analog | Fallback Pattern |
|------|---------------|------------------|
| `panel/src/utils/hash.ts` | No existing hash router in SDK/backend | RESEARCH Pattern 2 — 30 lines MDN hashchange + URLSearchParams |
| `panel/src/components/skeleton.ts` | SDK widget has no skeleton | Simple CSS `@keyframes shimmer` + 5 tr.placeholder |

## Shared Patterns

### Authentication (HttpOnly cookie, credentials:include, refresh path)
- **Analog:** `backend/app/routers/auth.py:16-18 _is_secure()` + `backend/app/routers/auth.py:38-55 set_cookie` + `backend/app/dependencies.py` get_current_user
- **Applies to:** `panel/src/api.ts`, `panel/src/auth.ts`, `panel/src/views/login.ts`, `panel/src/views/detail.ts`
- **Excerpt:** `response.set_cookie(key="watchbug_access", httponly=True, secure=secure, samesite="lax", max_age=3600, path="/")` and `request.cookies.get("watchbug_access")` → 401 not authenticated
- **Panel must:** Use `credentials:"include"` on every fetch; POST refresh to `/api/auth/refresh` exactly (path `/api/auth` cookie).

### XSS Sanitization (html.escape before JSONB + textContent in panel)
- **Analog:** `backend/app/utils/sanitize.py` → `html.escape(value, quote=True)` + event-handler regex stripping
- **Applies to:** All `panel/src/views/*.ts` rendering + `panel/src/components/*.ts`
- **Excerpt:** `escaped = html.escape(value, quote=True); escaped = _EVENT_HANDLER_RE.sub("", escaped)`
- **Panel must:** `el.textContent = value` never `innerHTML`; guard `javascript:` href scheme.

### Pagination/Filtering Constants
- **Analog:** `backend/app/utils/pagination.py` → `ALLOWED_TYPES={"Bug","Feedback"}`, `ALLOWED_STATUSES={"Pending","In Progress","Resolved"}`, `TYPE_NORMALIZE`, `parse_type_filter`, `parse_status_filter`, `pages = ceil(total/size)`
- **Applies to:** `panel/src/views/list.ts`, `panel/src/utils/hash.ts`, `panel/src/components/badges.ts`
- **Excerpt:** `pages = -(-total // size)` (ceil) and `type_normalized = type.title() if type.lower() in ...`
- **Panel must:** Mirror constants for dropdown values; forward hash query directly to `?type&status`; compute footer pages from backend response, not recomputed differently.

### TypeScript + Vitest + jsdom Setup
- **Analog:** `sdk/package.json:18-27` devDeps (typescript, vitest, jsdom) + `sdk/vitest.config.ts` (environment jsdom) + root `vitest.config.ts`
- **Applies to:** `panel/tsconfig.json`, `panel/vitest.config.ts`, all panel `*.test.ts`
- **Excerpt:** `vitest.config.ts: { test: { environment: "jsdom", globals: true }}`
- **Panel must:** Reuse same `strict` tsconfig and jsdom test env; `vitest run --config panel/vitest.config.ts`.

## Provenance Notes

- All backend analogs verified by reading source this session (main.py:96-139, auth.py:21-58, incidents.py:97-136, sanitize.py, pagination.py, incident_service.py).
- SDK analog `sdk/package.json:1-28` and `sdk/rollup.config.mjs:1-28` are the closest frontend build analogs; Vite replaces Rollup but shares config shape.
- No analog for hash routing — RESEARCH Pattern 2 is the source.
