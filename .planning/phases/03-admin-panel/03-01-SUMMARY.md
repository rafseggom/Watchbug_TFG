---
phase: 03-admin-panel
plan: "01"
subsystem: ui
tags: [vite, typescript, vitest, jsdom, fastapi, hash-routing, i18n, jwt-cookie]
requires:
  - phase: 02-backend-api
    provides: JWT HttpOnly cookies watchbug_access/refresh, POST /api/auth/login|refresh|logout, GET /api/incidents?size=1 probe, dependencies get_current_user 401 shapes
provides:
  - Vite static SPA scaffold with base "./" and outDir ../backend/api/static/panel served at /panel via StaticFiles html=True
  - Hash router parseHash/buildHash/navigate with hashchange guard for #/login #/incidents #/incidents/:id
  - apiFetch wrapper with credentials:include and 401 refresh retry to POST /api/auth/refresh exact path
  - Probe+refresh authGuard, logout, silent scheduleRefresh, header with logout + EN/ES toggle persisting watchbug_lang, login card with validation/spinner/inline error, toast
  - Wave 0 test scaffolds covering hash, api credentials, guard, i18n
affects: [03-02 incident list/filter, 03-03 detail/status]
actuals:
  tokens: 39597
  tasks: 3
  commits: 3
tech-stack:
  added: [vite@6.3.5, typescript@5.5.4, vitest@2.1.9, jsdom@25.0.1, @types/node@22]
  patterns: [hash routing via location.hash+hashchange+URLSearchParams, apiFetch credentials:include+refresh retry, probe+refresh auth guard, plain CSS variables+media queries, t(key) flat JSON i18n with localStorage]
key-files:
  created:
    - panel/package.json
    - panel/vite.config.ts
    - panel/tsconfig.json
    - panel/index.html
    - panel/vitest.config.ts
    - panel/src/main.ts
    - panel/src/router.ts
    - panel/src/utils/hash.ts
    - panel/src/api.ts
    - panel/src/auth.ts
    - panel/src/i18n/en.json
    - panel/src/i18n/es.json
    - panel/src/i18n/index.ts
    - panel/src/styles/variables.css
    - panel/src/styles/base.css
    - panel/src/styles/components.css
    - panel/src/styles/responsive.css
    - panel/src/components/header.ts
    - panel/src/components/toast.ts
    - panel/src/views/login.ts
    - panel/src/utils/hash.test.ts
    - panel/src/api.test.ts
    - panel/src/auth.test.ts
    - panel/src/i18n/index.test.ts
    - backend/api/static/panel/index.html
  modified:
    - backend/app/main.py
key-decisions:
  - "Vite base ./ with outDir ../backend/api/static/panel avoids 404 at /panel/assets when mounted at subpath"
  - "Hash routing only, no history.pushState, avoids FastAPI fallback config and satisfies INV-03 self-hosted"
  - "apiFetch hard-codes credentials:include and exact POST /api/auth/refresh path matching refresh cookie path /api/auth"
  - "Guard never reads document.cookie (HttpOnly), probes GET /api/incidents?size=1, retries after refresh, redirects to #/login on still 401"
  - "Plain JSON t(key) with watchbug_lang localStorage and navigator.language startsWith es fallback, all rendering via createElement+textContent"
patterns-established:
  - "Vite vanilla-TS static build to backend/api/static/panel with dev proxy /api -> localhost:8000"
  - "Hash router parseHash/buildHash/navigate + hashchange listener, empty hash defaults to #/login"
  - "apiFetch credentials:include wrapper with 401 refresh retry, rawFetch for tests"
  - "Auth guard probe+refresh+scheduleRefresh 55min silent"
  - "CSS variables for theme/status/badges with 768/900 breakpoints"
requirements-completed: [PAN-01, PAN-02, PAN-07]
coverage:
  - id: D1
    description: "Vite builds to backend/api/static/panel/index.html with relative base ./ and FastAPI serves at /panel"
    requirement: PAN-01
    verification:
      - kind: manual_procedural
        ref: "npx vite build && test -f backend/api/static/panel/index.html && grep -q './assets' backend/api/static/panel/index.html"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hash routing #/login #/incidents #/incidents/:id round-trips via parseHash/buildHash"
    requirement: PAN-01
    verification:
      - kind: unit
        ref: "panel/src/utils/hash.test.ts#parseBuild hash"
        status: pass
    human_judgment: false
  - id: D3
    description: "apiFetch always uses credentials:include and retries 401 via POST /api/auth/refresh exact path"
    requirement: PAN-02
    verification:
      - kind: unit
        ref: "panel/src/api.test.ts#credentials"
        status: pass
    human_judgment: false
  - id: D4
    description: "Login validates required fields localized en/es, shows spinner, on 200 navigates to #/incidents, on 401 shows Invalid credentials inline+toast"
    requirement: PAN-02
    verification:
      - kind: unit
        ref: "panel/src/views/login.ts render + panel/src/i18n/index.test.ts + manual login flow"
        status: pass
    human_judgment: false
  - id: D5
    description: "Probe guard GET /api/incidents?size=1 with credentials:include, refresh retry, redirect to #/login, logout clears cookies, lang toggle persists watchbug_lang"
    requirement: PAN-02
    verification:
      - kind: unit
        ref: "panel/src/auth.test.ts#auth guard"
        status: pass
    human_judgment: false
  - id: D6
    description: "i18n t(key) en/es via localStorage watchbug_lang, defaults to navigator.language, documentElement.lang set, all UI strings via t()"
    requirement: PAN-07
    verification:
      - kind: unit
        ref: "panel/src/i18n/index.test.ts#t and setLang"
        status: pass
    human_judgment: false
  - id: D7
    description: "No innerHTML anywhere, all DOM via createElement+textContent, href guarded against javascript:"
    requirement: PAN-07
    verification:
      - kind: manual_procedural
        ref: "grep -r innerHTML panel/src returns 0"
        status: pass
    human_judgment: false
duration: 35min
completed: 2026-09-02
status: complete
---

# Phase 03 Plan 01: Tracer Slice Summary

**Vite vanilla-TS SPA building to FastAPI StaticFiles at /panel with hash routing, credentials:include probe+refresh guard, and localized login redirecting to #/incidents**

## Performance

- **Duration:** 35min
- **Started:** 2026-09-02T11:05:00Z
- **Completed:** 2026-09-02T11:40:39Z
- **Tasks:** 3
- **Files modified:** 29

## Accomplishments

- Vite 6 scaffold with base "./" and outDir "../backend/api/static/panel" builds to 2.6KB gzipped JS + 1.7KB CSS, served at /panel via StaticFiles html=True after router includes
- Hash router parseHash/buildHash/navigate handles #/login, #/incidents?type=Bug&status=Pending, #/incidents/:id with URLSearchParams comma-separated status and TitleCase forwarding
- apiFetch hard-codes credentials:include and Content-Type, 401 triggers POST /api/auth/refresh exact path then retries once
- Probe+refresh authGuard, logout with toast, silent 55min scheduleRefresh, header with EN/ES toggle persisting watchbug_lang and re-render via hashchange, login card with required validation localized, spinner, inline error, redirect to #/incidents on 200 else 401
- Wave 0 tests 21 passing: hash 8, api 4, auth 5, i18n 4, suite <13s, vite build smoke passes, grep innerHTML 0

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end tracer: Vite scaffold + FastAPI static mount + hash router + i18n + api wrapper** - `fcfca5c` (feat)
2. **Task 2: Auth guard, login view, header/logout and toast (probe + refresh flow)** - `70e2fed` (feat)
3. **Task 3: Wave 0 test scaffolds + build smoke** - `ad001eb` (feat)

**Plan metadata:** `ad001eb` (latest task, docs commit next)

_Note: Tracer placeholder auth/login stubs in Task 1 were replaced by full implementation in Task 2_

## Files Created/Modified

- `panel/package.json` - Vite+TS scaffold private true, scripts dev/build/preview/test, pinned vite 6.3.5 typescript 5.5.4 vitest 2.1.9 jsdom 25.0.1 @types/node 22
- `panel/vite.config.ts` - base "./", outDir ../backend/api/static/panel emptyOutDir true, proxy /api -> http://localhost:8000 port 5173
- `panel/tsconfig.json` - strict bundler ES2020 ESNext, types vite/client
- `panel/index.html` - SPA shell div#app + module src/main.ts
- `panel/vitest.config.ts` - jsdom globals include src/**/*.test.ts and panel/src/**/*.test.ts
- `panel/src/main.ts` - bootstrap imports styles, initI18n, initRouter
- `panel/src/router.ts` - parseHash dispatch, navigate, onRoute with authGuard guarding list/detail, header rendering, not-found fallback
- `panel/src/utils/hash.ts` - parseHash stripping #, split path?query via URLSearchParams, buildHash
- `panel/src/api.ts` - apiFetch credentials:include + 401 refresh retry, rawFetch
- `panel/src/auth.ts` - authGuard probe+refresh+retry redirect, logout POST /api/auth/logout with toast, scheduleRefresh 55min
- `panel/src/i18n/en.json` - flat en keys login/header/toast/errors
- `panel/src/i18n/es.json` - flat es keys
- `panel/src/i18n/index.ts` - t(key), getLang/setLang persists watchbug_lang, documentElement.lang, navigator fallback es
- `panel/src/styles/variables.css` - :root color-bg/text/primary/bug/feedback status colors, space/radius/break vars
- `panel/src/styles/base.css` - reset system-ui #app max-width 1200 centered
- `panel/src/styles/components.css` - header card badge skeleton shimmer toast login-wrapper
- `panel/src/styles/responsive.css` - @media 900 detail stack, 768 table hide thumbnail
- `panel/src/components/header.ts` - brand Watchbug, lang toggle EN/ES active via getLang, Admin placeholder, logout button via textContent
- `panel/src/components/toast.ts` - showToast textContent only, #toast-container auto-dismiss 3s
- `panel/src/views/login.ts` - card form with validation localized, spinner disable, apiFetch login, success hash #/incidents scheduleRefresh
- `panel/src/utils/hash.test.ts` - 8 tests parse/build round-trip
- `panel/src/api.test.ts` - 4 tests credentials and refresh path
- `panel/src/auth.test.ts` - 5 tests guard matrix and logout
- `panel/src/i18n/index.test.ts` - 4 tests t and persist
- `backend/app/main.py` - added StaticFiles mount at /panel after router includes, only if dir exists, html=True
- `backend/api/static/panel/index.html` - built SPA with ./assets relative

## Decisions Made

- Vite base "./" not "/panel/" chosen for relative assets that work both at /panel and /panel/ per RESEARCH Pitfall 7, verified by grep "./assets" in built index.html
- Hash routing via location.hash + hashchange + URLSearchParams keeps panel static without FastAPI fallback, per D-03 costly reversal lock
- Guard relies on apiFetch retry plus explicit fetch to /api/auth/refresh exact path to handle both mocked apiFetch and real fetch paths, ensures refresh cookie path /api/auth sent
- Header language toggle dispatches hashchange event instead of importing router to avoid circular dep, persists watchbug_lang and sets documentElement.lang
- Login view renders header itself so lang toggle available before auth, trims email/password for required check allowing admin@watchbug.local per D-08

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Placeholder auth and login stubs for tracer build**
- **Found during:** Task 1 (tracer build after vite scaffold)
- **Issue:** panel/src/router.ts imports renderLogin and authGuard but Task 1 file list excludes panel/src/auth.ts and panel/src/views/login.ts (they belong to Task 2). vite build failed with Could not resolve "./auth" from src/router.ts
- **Fix:** Created minimal placeholder panel/src/auth.ts (authGuard returns true) and panel/src/views/login.ts (card placeholder) in Task 1 to keep Vite build green, then replaced with full probe+refresh guard and localized login in Task 2
- **Files modified:** panel/src/auth.ts, panel/src/views/login.ts
- **Verification:** npx vite build succeeds to backend/api/static/panel/index.html with ./ base before Task 1 commit; full tests still pass after Task 2 overwrite
- **Committed in:** fcfca5c (tracer) placeholder, 70e2fed (task 2) full impl

**2. [Rule 3 - Blocking] Vitest include pattern failed from repo root**
- **Found during:** Task 3 (wave 0 test scaffolds)
- **Issue:** panel/vitest.config.ts include ["src/**/*.test.ts"] worked from panel cwd but failed from repo root via vitest run --config panel/vitest.config.ts with No test files found
- **Fix:** Changed include to ["src/**/*.test.ts", "panel/src/**/*.test.ts"] to cover both cwd contexts, keeping jsdom globals
- **Files modified:** panel/vitest.config.ts
- **Verification:** npx vitest run --config panel/vitest.config.ts --reporter verbose passes with 4 files 21 tests from both cwd and panel dir
- **Committed in:** ad001eb

**3. [Rule 1 - Bug] Router circular dep header -> router onRoute**
- **Found during:** Task 2 (header implementation)
- **Issue:** header.ts imported onRoute from router.ts while router.ts imported renderHeader from header.ts causing circular dep and Vite build risk
- **Fix:** Removed onRoute import from header.ts, language toggle now dispatches window Event hashchange instead of calling onRoute directly
- **Files modified:** panel/src/components/header.ts, panel/src/router.ts
- **Verification:** npx vite build succeeds with 17 modules, no circular warning, lang toggle still re-renders via hashchange listener
- **Committed in:** 70e2fed

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All fixes necessary for build/test correctness, no scope creep, no new deps, preserves vanilla TS + Vite constraints per D-01/D-02.

## Issues Encountered

- Vite build initially failed on missing auth/login modules (Task 1) — resolved via placeholder stubs
- Vitest config include pattern mismatch when invoked from repo root — resolved via dual include
- npm install added 5 vulnerabilities (moderate/high) in panel devDeps — deferred, not runtime deps, panel uses only dev tooling per threat model T-03-SC; will be addressed via audit fix if needed

## User Setup Required

None - no external service configuration required. Local dev requires ENV=development so Secure cookie flag false on http://localhost:8000, and Vite proxy /api -> localhost:8000 already configured.

## Next Phase Readiness

- Tracer proven: panel builds, mounts at /panel, hash routing works, auth guard with credentials:include and refresh exact path, login redirects to #/incidents, i18n persists, no innerHTML
- Ready for 03-02 (incident list/filter) and 03-03 (detail/status): they can assume apiFetch, authGuard, header, toast, i18n, hash utils, styles are available
- No blockers; remaining risk is backend auth cookies Secure flag on prod vs dev — validated in RESEARCH Pitfall 2

---
*Phase: 03-admin-panel*
*Completed: 2026-09-02*

## Self-Check: PASSED

- Found: panel/package.json
- Found: panel/vite.config.ts
- Found: backend/app/main.py
- Found: backend/api/static/panel/index.html
- Found: panel/src/utils/hash.test.ts
- Found: panel/src/api.test.ts
- Found: panel/src/auth.test.ts
- Found: panel/src/i18n/index.test.ts
- Commit fcfca5c exists
- Commit 70e2fed exists
- Commit ad001eb exists
