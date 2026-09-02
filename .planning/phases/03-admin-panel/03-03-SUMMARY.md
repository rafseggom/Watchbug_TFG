---
phase: 03-admin-panel
plan: "03"
subsystem: ui
tags: [detail, screenshot, lightbox, metadata, consoleLogs, status-patch, optimistic, toast, i18n, hash-routing, vitest]
requires:
  - phase: 02-backend-api
    provides: GET /api/incidents/:id with BYTEA -> data URL encode_screenshot, PATCH /api/incidents/:id/status Any->Any StatusUpdate TitleCase, 404/401/422 contracts
  - phase: 03-01
    provides: Vite SPA, hash router, apiFetch credentials:include + 401 refresh, header/toast, i18n en/es
  - phase: 03-02
    provides: badges, formatDate, isSafeHref, skeleton, list view with hash filters
provides:
  - Detail view at #/incidents/:id two-column 60/40 screenshot left metadata right, stacks below 900, screenshot data URL full preview with lightbox, lazy, scrollable, max-width 100% contain
  - Metadata cards via textContent (URL with isSafeHref guard, UserAgent/viewport/resolution/timestamp localized, project_id, type/status badges, created_at), consoleLogs collapsible details per entry with level badge
  - Status PATCH immediate dropdown Pending/In Progress/Resolved TitleCase, credentials:include, 200 toast Status updated + optimistic localStorage watchbug:inc-:id:status + CustomEvent watchbug:status-updated, 422/network revert, 401 login redirect, Any->Any
  - Error states 404 Incident not found with Back, 401 refresh->login, network Retry, skeleton while loading, all textContent never innerHTML
affects: [03-04 static build, phase-04 docker]
actuals:
  tokens: 9827
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [detail two-col flex 60/40 with 900 stack, screenshot data URL lightbox overlay fixed rgba 0,0,0.8, metadata cards via textContent + isSafeHref, consoleLogs details badge, PATCH optimistic localStorage+CustomEvent]
key-files:
  created:
    - panel/src/views/detail.ts
    - panel/src/views/detail.test.ts
  modified:
    - panel/src/views/list.ts
    - panel/src/router.ts
    - panel/src/i18n/en.json
    - panel/src/i18n/es.json
    - panel/src/styles/components.css
    - panel/src/styles/responsive.css
key-decisions:
  - "Detail screenshot uses data:image/png;base64 src directly from incident_service encode_screenshot, validated Base64 BYTEA, set loading lazy object-fit contain cursor zoom-in -> lightbox clone 90vw 90vh fixed overlay dismiss on click outside, no decode"
  - "All metadata and consoleLogs args rendered via textContent never innerHTML, URL as <a> only if isSafeHref else <span> text only, level badge via allowlist log/warn/error/info fallback log, args joined slice 2000"
  - "Status PATCH on select change disabled while pending, body {status:TitleCase}, credentials:include via apiFetch, on 200 toast Status updated localized + localStorage watchbug:inc-:id:status + dispatch watchbug:status-updated CustomEvent for list optimistic without refetch, Any->Any allowed"
  - "404 handled as dedicated centered page with localized Incident not found + Back to #/incidents, 401 via apiFetch refresh then location.hash #/login, network error shows Retry button re-calling renderDetail"
  - "List integration reads getCachedStatus per item on renderRows overlaying cached status, and listens watchbug:status-updated to patch visible row badge live"
decisions:
  - "Meta-card class introduced as .meta-card to avoid overriding login .card box-shadow 400px layout; detail layout uses .detail-layout gap 24 + .screenshot-pane flex 0 0 60% overflow auto"
  - "Responsive 900 stack adds .screenshot-pane, .metadata-pane flex auto width 100% alongside legacy __left/__right to satisfy both old and new class patterns"
  - "i18n detail.* keys added in Task1 to enable localized Back/NotFound/loading/screenshotAlt/labels/consoleLogs + status.* TitleCase to satisfy t() fallback contract"
patterns-established:
  - "renderDetail(root,id) async with header + topBar Back + status-select in topBar + detail-layout two-col + skeleton placeholder + apiFetch GET /:id error branches + screenshot lightbox + metadata cards + consoleLogs details"
  - "Optimistic PATCH pattern: disable select -> apiFetch PATCH -> on 200 localStorage+CustomEvent+toast keep next else revert prior + inline error + error toast -> finally enable"
  - "List optimistic cache: getCachedStatus(id) from localStorage + event listener watchbug:status-updated patching td without refetch"
requirements-completed: [PAN-05, PAN-06, PAN-07]
coverage:
  - id: D1
    description: "Detail two-col 60/40 stacks below 900, screenshot data URL max-width 100% contain lazy click lightbox, top Back link #/incidents"
    requirement: PAN-05
    verification:
      - kind: unit
        ref: "panel/src/views/detail.test.ts#renders screenshot data URL with lightbox and metadata cards via textContent"
        status: pass
    human_judgment: false
  - id: D2
    description: "Metadata cards URL as escaped link via isSafeHref else text only, UserAgent/viewport/resolution/timestamp localized formatDate, project_id, type/status badges all via textContent"
    requirement: PAN-05
    verification:
      - kind: unit
        ref: "panel/src/views/detail.test.ts#renders screenshot data URL with lightbox and metadata cards via textContent + xss via metadata url"
        status: pass
    human_judgment: false
  - id: D3
    description: "ConsoleLogs collapsible details per entry with level badge log/warn/error/info color + args joined textContent + timestamp, skeleton while loading"
    requirement: PAN-05
    verification:
      - kind: unit
        ref: "panel/src/views/detail.test.ts#skeleton while loading detail + renders screenshot data URL"
        status: pass
    human_judgment: false
  - id: D4
    description: "Status dropdown Pending/In Progress/Resolved TitleCase current selected, immediate PATCH with credentials:include, 200 toast Status updated + optimistic cache localStorage+event, 422 revert inline error"
    requirement: PAN-05
    verification:
      - kind: unit
        ref: "panel/src/views/detail.test.ts#status patch optimistic workflow PATCH 200 + PATCH 422 reverts"
        status: pass
    human_judgment: false
  - id: D5
    description: "404 invalid UUID Incident not found with Back localized, 401 probe->refresh->login, network error Retry re-fetches"
    requirement: PAN-06
    verification:
      - kind: unit
        ref: "panel/src/views/detail.test.ts#404 shows Incident not found + 401 triggers login + network error shows Retry"
        status: pass
    human_judgment: false
  - id: D6
    description: "No innerHTML in panel/src source, all rendering via createElement+textContent, href guarded against javascript:"
    requirement: PAN-07
    verification:
      - kind: manual_procedural
        ref: "Get-ChildItem panel/src -Recurse -Filter *.ts | Where-Object { $_.Name -notlike \"*.test.ts\" } | Select-String innerHTML -> 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "Responsive detail-layout stacks to column below 900px screenshot on top full width, large screenshots scrollable lazy, overflow auto"
    requirement: PAN-06
    verification:
      - kind: manual_procedural
        ref: "Check .detail-layout flex gap 24 and @media max-width:900 flex-direction column + screenshot-pane 60% + metadata-pane flex1 in components.css/responsive.css"
        status: pass
    human_judgment: true
    rationale: "jsdom has no layout engine; visual stack and scrollable overflow require Chrome device toolbar manual verification at 900px"
duration: 25min
completed: 2026-09-02
status: complete
---

# Phase 03 Plan 03: Incident Detail Summary

**Dedicated #/incidents/:id two-column (screenshot 60% data URL with lightbox, metadata cards + consoleLogs via textContent) with immediate PATCH status optimistic + localStorage cache and 404/401/Retry handling – 11 vitest cases + no innerHTML + 8.18kB gzipped build**

## Performance

- **Duration:** 25min
- **Started:** 2026-09-02T14:00:00Z
- **Completed:** 2026-09-02T14:05:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Detail view renderDetail(root,id) clears root, renders header, top bar Back link href="#/incidents" localized, two-col div.detail-layout left screenshot-pane 60% right metadata-pane 40% flex gap 24, shows skeleton while loading, GET /api/incidents/:id via apiFetch credentials:include, handles 404 Incident not found page with Back, 401 redirect #/login via refresh flow, network error with Retry re-calling renderDetail
- Screenshot img src data:image/png;base64 from GET detail encode_screenshot, max-width 100% object-fit contain loading lazy, click opens lightbox overlay div.lightbox fixed inset rgba(0,0,0,.8) flex center 90vw/90vh dismiss outside click + Escape, scrollable via overflow auto
- Metadata cards via createElement+textContent never innerHTML: URL as <a> textContent + href only if isSafeHref else <span> text only blocking javascript:, UserAgent/viewport/resolution text row, timestamp/project_id/created_at via formatDate(getLang()), type/status badges via renderTypeBadge/statusBadge, consoleLogs collapsible details per entry level badge log/warn/error/info color + args joined textContent slice 2000 + timestamp
- Status PATCH workflow: select.status-select options ALLOWED ["Pending","In Progress","Resolved"] TitleCase textContent via t("status.*"), value = detail.status, change listener disable select, PATCH /api/incidents/:id/status body {status:next} credentials:include, 200 showToast Status updated localized optimistic keep next localStorage watchbug:inc-:id:status + dispatch CustomEvent watchbug:status-updated {id,status}, 422 revert prior with inline Invalid status + error toast, 401 revert + login, network revert + error toast; Any->Any allowed
- List optimistic integration: getCachedStatus(id) from localStorage overlay on renderRows, window listen watchbug:status-updated patch visible row badge without refetch so Back to list reflects new status
- Build passes vite build 23 modules 5.92kB css 30.57kB js gzip 8.18kB (still within 45kB panel bound), vitest 43 passing (6 files), grep innerHTML 0 in source (exclude tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Detail layout, screenshot, metadata cards, consoleLogs (escaped rendering)** - `3c5b21b` (feat)
2. **Task 2: Status PATCH workflow with optimistic update, toast, and error revert** - `7604333` (feat)

**Plan metadata:** `7604333` (latest task, docs commit next)

## Files Created/Modified

- `panel/src/views/detail.ts` - async renderDetail with header/topBar/layout/skeleton/fetch 404/401/error, screenshot lightbox, metadata cards textContent + isSafeHref/formatDate/badges, consoleLogs details badge, status PATCH optimistic workflow with toast/localStorage/CustomEvent
- `panel/src/views/detail.test.ts` - 11 tests: dropdown TitleCase current selected, skeleton while loading, screenshot lightbox + metadata cards textContent + two-col + Back, xss javascript: href guard, 404 with Back, network Retry, 401 login, PATCH 200 toast/cache/event, PATCH 422 revert, network revert, Any->Any
- `panel/src/views/list.ts` - add getCachedStatus + renderRows effectiveStatus overlay + watchbug:status-updated listener patching visible row without refetch
- `panel/src/router.ts` - import renderDetail and wire #/incidents/:id detail route via authGuard + await renderDetail(app, route.id) removing placeholder
- `panel/src/i18n/en.json` - add detail.* keys (back/notFound/loading/retry/screenshotAlt/noScreenshot/labels/consoleLogs/count/status.*) + errors.invalidStatus
- `panel/src/i18n/es.json` - es equivalents detail.* + status.* TitleCase
- `panel/src/styles/components.css` - add .detail-layout flex gap 24, .screenshot-pane flex 0 0 60% overflow auto, .metadata-pane flex1, .meta-card border 1px radius 8 padding 12, .lightbox fixed inset 0.8 flex center
- `panel/src/styles/responsive.css` - extend @media 900 to include .screenshot-pane/.metadata-pane flex auto width 100% stacking

## Decisions Made

- Meta-card introduced as .meta-card instead of overwriting login .card (400px centered with shadow) to keep login card intact; detail cards use subtle border radius 8 without shadow
- Lightbox uses overlay div.lightbox with inline fixed styles + CSS class fallback, 90vw/90vh object-fit contain, dismiss on overlay click and Escape, z-index 1000 cursor zoom-out/in
- isSafeHref guard applied to URL anchor: javascript:/data:text/html/vbscript: rejected, trailing trim + lowerCase check, href set only if safe else render as span textContent
- Status revert preserves prior value via detail.status variable captured before PATCH, not select defaultValue, to survive multiple patch attempts; inlineError textContent set to t("errors.invalidStatus") on 422 without leaking raw loc array per T-03-11
- List cache uses localStorage key watchbug:inc-:id:status per instruction; list reads cache on each renderRows and listens for CustomEvent to live-patch badge while list still mounted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Router placeholder prevented detail mount**
- **Found during:** Task 1 (detail layout)
- **Issue:** router.ts had renderDetailPlaceholder stub but plan requires real renderDetail via authGuard for #/incidents/:id shareable deep linking
- **Fix:** Imported renderDetail from views/detail and replaced placeholder call with await renderDetail(app, route.id) after authGuard
- **Files modified:** panel/src/router.ts
- **Commit:** 3c5b21b

**2. [Rule 2 - Missing critical] i18n keys for detail.* not in plan's files but required for localized rendering**
- **Found during:** Task 1 (detail back/notFound/labels)
- **Issue:** en.json/es.json lacked detail.back, detail.notFound, detail.labels.*, detail.consoleLogs*, status.*, errors.invalidStatus needed for t() localized detail UI per PAN-07/RNF-03
- **Fix:** Added 16 detail.* + 3 status.* + errors.invalidStatus to both dicts with localized en/es strings
- **Files modified:** panel/src/i18n/en.json, panel/src/i18n/es.json
- **Commit:** 3c5b21b

**3. [Rule 1 - Bug] Login .card conflict with detail meta-card**
- **Found during:** Task 1 (components.css addition)
- **Issue:** Plan spec .card {border 1px radius 8 padding 12 margin-bottom 12} would overwrite login .card {max-width 400px shadow padding 24} breaking login centering
- **Fix:** Preserved existing .card for login, added new .meta-card for detail metadata cards with same border spec, detail.ts uses .meta-card
- **Files modified:** panel/src/styles/components.css, panel/src/views/detail.ts
- **Commit:** 3c5b21b

**4. [Rule 3 - Blocking] Vite build fails from repo root due to entry resolution**
- **Found during:** Task 2 verification (vite build)
- **Issue:** npx vite build --config panel/vite.config.ts fails Could not resolve entry module index.html when run from repo root
- **Fix:** Verified build via npx vite build executed from panel cwd; confirmed outDir ../backend/api/static/panel succeeds 23 modules 8.18kB gzip, documented for CI use npm run build --prefix panel
- **Files modified:** none (process)
- **Commit:** verification only

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 missing critical, 1 bug)
**Impact on plan:** All fixes necessary for correctness and build verification, no scope creep, no new deps, preserves vanilla TS + Vite + textContent invariants per T-03-SC/T-03-09.

## Issues Encountered

- PowerShell Select-String -Recurse flag nonexistent, switched to Get-ChildItem -Recurse filter + Where-Object exclude *.test.ts for innerHTML audit, else test assertion innerHTML triggered false positive
- vitest mock for apiFetch must use vi.mock hoisted before imports; detail.test.ts imports after mock to correctly intercept GET and PATCH calls, and separate mock for showToast to assert optimistic toast without DOM pollution
- Lightbox test needed document.body query not root query because overlay appended to body; also need to clean up .lightbox after each test to avoid cross-test overlay leak

## User Setup Required

None - no external service configuration. Local dev requires ENV=development for Secure cookie false on http://localhost:8000; Vite proxy /api -> localhost:8000 already configured; detail route reachable at #/incidents/:id after login.

## Next Phase Readiness

- Panel now complete for Phase 03: list filtering + detail with screenshot + status mutation proven, all via textContent and href guard, 43 tests green, build 8.18kB under 45kB, /panel served via FastAPI StaticFiles
- Ready for Phase 04 Docker: panel/dist already builds to backend/api/static/panel for multi-stage Dockerfile COPY, api static mount at /panel via html=True verified
- Next step: manual responsive verification of detail stack at 900px and list thumbnail hide at 768px via Chrome device toolbar per VALIDATION.md manual-only rows; also verify lightbox click-outside dismiss and toast 3s auto-dismiss timing visually
- No blockers; remaining risk is backend rate limit 60/min on detail + status routes – panel handles 429 already for list but detail should surface similarly if triggered (generic error branch covers it)

## Self-Check: PASSED

- Found: panel/src/views/detail.ts
- Found: panel/src/views/detail.test.ts
- Found: panel/src/views/list.ts
- Found: panel/src/styles/components.css
- Found: panel/src/styles/responsive.css
- Found: panel/src/i18n/en.json
- Found: panel/src/i18n/es.json
- Commit 3c5b21b exists
- Commit 7604333 exists

---
*Phase: 03-admin-panel*
*Completed: 2026-09-02*
