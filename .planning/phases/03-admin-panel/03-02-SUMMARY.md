---
phase: 03-admin-panel
plan: "02"
subsystem: ui
tags: [list, filter, pagination, skeleton, i18n, hash-routing, vitest, jsdom]
requires:
  - phase: 02-backend-api
    provides: JWT HttpOnly cookies, GET /api/incidents?page&size&type&status paginated {items,total,page,size,pages}, parse_type_filter/status 422 contract
  - phase: 03-01
    provides: Vite SPA scaffold, hash router parseHash/buildHash, apiFetch credentials:include, i18n t/getLang, header/toast
provides:
  - Paginated filtered incident list view at #/incidents with hash-synced Type/Status dropdowns driving backend ?type&status (TitleCase, comma-separated), fixed size 20
  - Type/status badge renderers (textContent + allowlist classes), Intl.DateTimeFormat date, isSafeHref guard
  - Skeleton 5-row shimmer, empty illustration with Clear Filters, error with Retry, responsive 768 hide thumbnail, all textContent
affects: [03-03 detail/status]
actuals:
  tokens: 8899
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [hash filter sync via buildHash + URLSearchParams, fixed page size 20 pagination Prev/Next disabled, textContent double-defense, skeleton colSpan shimmer]
key-files:
  created:
    - panel/src/components/badges.ts
    - panel/src/components/skeleton.ts
    - panel/src/utils/format.ts
    - panel/src/utils/sanitize.ts
    - panel/src/views/list.ts
    - panel/src/views/list.test.ts
  modified:
    - panel/src/router.ts
    - panel/src/i18n/en.json
    - panel/src/i18n/es.json
    - panel/src/styles/components.css
    - panel/src/styles/responsive.css
key-decisions:
  - "Badge classes use allowlist fallback badge--unknown + sanitizeClass to prevent class injection from XSS payloads in type/status strings"
  - "Skeleton rows use single td colSpan=4 per row to keep 5 .skeleton count predictable (20 divs would confuse loading assertion), shimmer 1.4s per spec"
  - "List pagination hash sync includes page param (page=1 omitted) so bookmarkable links preserve page + filters; filter change resets to 1"
  - "429 handling appends (429) plus Retry-After to satisfy test and surface rate limit visibly, with toast double-defense"
  - "FormatDate uses Intl.DateTimeFormat(getLang()) with fallback to iso on invalid date, mirroring RNF-03 en/es"
decisions:
  - "Router wiring done in 03-02 Task1 despite files_modified omitting router.ts – Rule 3 blocking fix to make list reachable; no plan change needed"
  - "i18n keys added for list.* and errors.* in Task1 to enable localized list rendering without separate task"
  - "Skeleton created early in Task1 then refined in Task2 to avoid placeholder gap"
metrics:
  duration: 15min
  completed: 2026-09-02
status: complete
---

# Phase 03 Plan 02: Incident Listing Summary

**Paginated incident table with hash-synced Type/Status filters, Prev/Next pagination (size 20), badges/date/preview via textContent, skeleton/empty/error states with retry, and 768 responsive compaction – all verified via 11 vitest cases + vite build 5.53kB**

## Performance

- **Duration:** 15min
- **Started:** 2026-09-02T13:40:00Z
- **Completed:** 2026-09-02T13:55:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- List view renders paginated table 4 cols Type badge Bug #d73a4a/Feedback blue, Status pill yellow/blue/green, Date via Intl.DateTimeFormat(lang), Preview ◉ when has_screenshot else —, row click -> #/incidents/:id, all via createElement+textContent never innerHTML
- Filter bar 2 selects All/Bug/Feedback + All/Pending/In Progress/Resolved TitleCase mirrored from backend ALLOWED_*, selecting resets page 1 updates hash via buildHash shareable (#/incidents?type=Bug&status=Pending) driving ?type&status on backend; filter values restored from hash query on mount
- Footer Page X of N (Total T) with Prev disabled page===1 Next disabled page===pages, page size fixed 20 via buildApiQuery, 422 invalid filter shows inline error + toast, 429 shows Retry-After + 429 + Retry, network error shows Retry re-fetches with credentials:include
- Loading shows 5 skeleton shimmer rows (skeleton.ts colSpan 4), empty total=0 shows 📭 + localized No incidents yet vs No results for this filter with Clear Filters resetting hash to #/incidents, error shows inline + Retry button
- Responsive: table-wrapper overflow-x:auto, @media 768 hides thumbnail col (th/td nth-child 4 + .col-thumbnail) and collapses font 14px + filter-bar wrap; badges remain visible; detail stack 900 already covered
- Tests 11 passing + existing 21 = 32 total green, vite build to ../backend/api/static/panel succeeds (5.53kB gzipped), no innerHTML in source

## Task Commits

Each task was committed atomically:

1. **Task 1: List table + badges + date + preview + pagination wired to API** - `bca8333` (feat)
2. **Task 2: Loading/empty/error states + responsive table CSS** - `1fa29b7` (feat)

**Plan metadata:** `1fa29b7` (latest task, docs commit next)

## Files Created/Modified

- `panel/src/components/badges.ts` - renderTypeBadge/statusBadge via textContent, allowlist classes badge--* + type-*/status-* with sanitizeClass fallback badge--unknown
- `panel/src/utils/format.ts` - formatDate(iso, lang) via Intl.DateTimeFormat with invalid fallback
- `panel/src/utils/sanitize.ts` - isSafeHref rejecting javascript:/data:text/html/vbscript:
- `panel/src/components/skeleton.ts` - renderSkeletonRows(5) 5 tr placeholder each 1 td colSpan4 + div.skeleton shimmer
- `panel/src/views/list.ts` - async renderList with header, filter bar 2 selects, table wrapper 4 cols, tbody, footer pagination, fetchAndRender lifecycle with skeleton/empty/error/row click hash sync, fixed size 20, 422/429 handling, all textContent
- `panel/src/router.ts` - wire list route to renderList(query) via parseHash query (Rule 3 blocking)
- `panel/src/i18n/en.json` - add list.* and errors.* keys en
- `panel/src/i18n/es.json` - add list.* and errors.* keys es
- `panel/src/styles/components.css` - .skeleton shimmer 1.4s, .empty/.error, .table-wrapper, .filter-bar
- `panel/src/styles/responsive.css` - @media 768 hide thumbnail col nth-child 4, font 14px, filter-bar wrap, keep overflow-x
- `panel/src/views/list.test.ts` - 11 tests: table badges/pagination, Feedback dash, filter sync hash, hash reflect on mount, loading 5 skeleton, empty Clear Filters, error retry, 422, 429, responsive wrapper, XSS innerHTML safety

## Decisions Made

- Badge class injection sanitized: only ALLOWED_TYPES/STATUSES get specific color classes, else badge--unknown with sanitized class name to avoid XSS via innerHTML class attribute containing `<script>`
- Skeleton colSpan optimization: single shimmer bar per row keeps predictable 5 skeleton count vs 20 divs (4 per row) which broke loading assertion; fulfills spec s 5 skeleton rows visually
- Pagination hash includes page param when !=1 so Page 2 shareable as #/incidents?page=2&type=Bug; Prev/Next update hash via buildHash and re-fetch
- 429 message appends both Retry-After and (429) status for visibility per test requirement; list.error retry re-fetches same page
- Vite build verified 21 modules, 5.53kB gzipped under 45kB bound, outDir ../backend/api/static/panel relative base still valid

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Router wiring not in files_modified but required for list mount**
- **Found during:** Task 1 (list table + badges)
- **Issue:** Plan task1 files list omits panel/src/router.ts but action says Wire router: list route calls renderList with query object from parseHash. Without wiring, list would remain placeholder and hash navigation would never mount
- **Fix:** Added import renderList and replaced renderListPlaceholder call with await renderList(app, route.query) in router.ts
- **Files modified:** panel/src/router.ts
- **Commit:** bca8333

**2. [Rule 2 - Missing critical] i18n keys for list.* not in plan but required for localized rendering**
- **Found during:** Task 1 (filter bar and footer use t() keys)
- **Issue:** en.json/es.json lacked list.colType etc and errors.invalidFilter; t() would fallback to key string, breaking localized empty/error messages per PAN-07/RNF-03
- **Fix:** Added list.title/filterType/filterStatus/all/col*/pageInfo/prev/next/empty*/clearFilters/retry/loading and errors.invalidFilter/rateLimited to both en/es dicts
- **Files modified:** panel/src/i18n/en.json, panel/src/i18n/es.json
- **Commit:** bca8333

**3. [Rule 1 - Bug] Skeleton 5 rows produced 20 .skeleton divs breaking loading test**
- **Found during:** Task 2 verification (vitest list.test 3 failures)
- **Issue:** Initial skeleton created 4 td per tr each with div.skeleton => 20 skeletons, test expected 5; also prior impl used 1.2s ease-in-out vs spec 1.4s infinite
- **Fix:** Changed to single td colSpan=4 per row with one .skeleton, updated CSS to spec gradient 1.4s infinite
- **Files modified:** panel/src/components/skeleton.ts, panel/src/styles/components.css
- **Commit:** 1fa29b7

**4. [Rule 1 - Bug] Badge class injection via unsanitized type string leaking into innerHTML**
- **Found during:** Task 2 verification (no innerHTML test failed)
- **Issue:** renderTypeBadge used `badge--${type}` directly, so xss payload `<script>alert(1)</script>` rendered class attribute containing raw tag, which appears in innerHTML serialization and constitutes class injection per T-03-05
- **Fix:** Added sanitizeClass and allowlist fallback badge--unknown; only allowed Bug/Feedback and Pending/In Progress/Resolved get specific badge--* classes
- **Files modified:** panel/src/components/badges.ts
- **Commit:** 1fa29b7

**5. [Rule 1 - Bug] 429 handling missing status code in message**
- **Found during:** Task 2 verification (429 test expected 429 in text)
- **Issue:** 429 branch showed rateLimited + Retry-After but not 429 itself, test asserted contains 429 failed
- **Fix:** Append ` (429)` to 429 message alongside Retry-After, matching expected surface
- **Files modified:** panel/src/views/list.ts
- **Commit:** 1fa29b7

---

**Total deviations:** 5 auto-fixed (1 blocking, 1 missing critical, 3 bugs)
**Impact on plan:** All fixes necessary for correctness/security and test verification, no scope creep, no new deps, preserves textContent and credentials:include invariants.

## Issues Encountered

- PowerShell lacked grep/tail, used Get-ChildItem + Select-String for innerHTML audit; source check must exclude *.test.ts to avoid false positive from test assertions
- Vite build from repo root fails Could not resolve entry module index.html; must run from panel cwd via npx vite build (or npm run build --prefix panel) – verified second run succeeds
- Hash filter sync test required async timing with setTimeout 10ms to allow fetchAndRender microtask; pending promise cleanup needed to avoid leak

## User Setup Required

None - no external service configuration. Local dev requires ENV=development for Secure cookie flag false on http://localhost:8000, Vite proxy /api -> localhost:8000 already configured in panel/vite.config.ts.

## Next Phase Readiness

- List view proven: table with badges/date/preview from {items,total,page,size,pages} size 20, row click to detail, Prev/Next disabled states, filter hash shareable driving ?type&status TitleCase, skeleton/empty/error with textContent, responsive 768 hides thumbnail
- Ready for 03-03 detail/status: can assume badges, format, sanitize, skeleton, i18n, hash, apiFetch, header, router, styles are available; detail will add screenshot data URL, metadata cards, status PATCH
- No blockers; remaining risk is backend rate limiting 429 Retry-After header presence – panel surfaces it but backend slowapi config may vary; verify curl -b cookies -s http://localhost:8000/api/incidents?page=1&size=20&type=Bug&status=Pending filtered count matches

## Self-Check: PASSED

- Found: panel/src/views/list.ts
- Found: panel/src/components/badges.ts
- Found: panel/src/components/skeleton.ts
- Found: panel/src/utils/format.ts
- Found: panel/src/utils/sanitize.ts
- Found: panel/src/views/list.test.ts
- Found: panel/src/styles/components.css
- Found: panel/src/styles/responsive.css
- Commit bca8333 exists
- Commit 1fa29b7 exists
