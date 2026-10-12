---
phase: 01-contracts-ingest-slice
plan: 04
subsystem: panel
tags: [sanitization, stored-xss, ing-07, c3-double-control, i18n, onboarding, empty-state, e2e, tdd]

# Dependency graph
requires:
  - phase: 01-03
    provides: ordered ingest chain with all gates live (caps → multipart → Zod → project-key → three rate limiters → origin allowlist → magic bytes → structure → dim guard → re-encode → Storage), hostile.spec.ts group at 48 rows, structured error mapper, e2e-tuned .env maxima, the deferred meta JSON-content-type defect (expires here)
provides:
  - "ING-07 C-3 double control complete: `sanitize-html` pass 1 over every user string (markup removed, plain text round-trips literally, control characters stripped, cap re-validation) + React text-node-only pass 2 with a source-level sink gate"
  - "P1-D-05 panel i18n: hand-rolled en/es dictionaries (Spanish typed against English keys), `navigator.language` detection, `watchbug.lang` persistence, `LanguageSwitcher`"
  - "P1-D-07 onboarding empty state: `buildOnboardingCurl(origin, projectKey)` + `GET /api/setup` → `{ projectKey }`, with an e2e row that executes the emitted curl verbatim"
  - "the `meta` + `Content-Type: application/json` → `\"[object Object]\"` defect fixed (01-02/01-03 deferral closed)"
affects: [01-verify-phase, phase-2 widget, phase-4 enrichment, phase-5 auth (replaces the setup endpoint's onboarding role)]

# Actuals (#2632) — pairs with the plan's `estimate`
actuals:
  tokens: 17270
  tasks: 3
  commits: 5
  plan_head_before: e307b2638fc67d127a61a3556e927cfb7ca354ee
  plan_head_after: ba499f382768e1c618ac47eeda48f92f2f096f86

# Tech tracking
tech-stack:
  added: ["none — sanitize-html 2.18.0 (already pinned in apps/api) wired across all user fields; i18n dictionaries hand-rolled per STACK.md (no i18n dependency)"]
  patterns:
    - "toPlainText: strip markup (sanitize-html, empty allowlist) → decode the renderer's re-escapes only when the decoded value cannot re-open a tag → strip C0/C1/DEL/BOM controls"
    - "source-level sink gate as a suite row: the no-`dangerouslySetInnerHTML`/`innerHTML` rule is asserted inside e2e/hostile.spec.ts, not only by a shell grep"
    - "empty-state e2e via `page.route` interception of `GET /api/incidents` (the shared stack is never genuinely empty; the component, `/api/setup` and the emitted command stay real)"

key-files:
  created:
    - apps/panel/src/i18n.ts
    - apps/panel/src/components/EmptyState.tsx
    - apps/panel/src/components/LanguageSwitcher.tsx
    - apps/api/src/routes/setup.ts
    - .planning/phases/01-contracts-ingest-slice/01-04-red-evidence-task1.json
    - .planning/phases/01-contracts-ingest-slice/01-04-red-evidence-task2.json
  modified:
    - apps/api/src/ingest/sanitize.ts
    - apps/api/src/routes/incidents.ts
    - apps/api/src/app.ts
    - apps/panel/src/App.tsx
    - apps/panel/src/api.ts
    - apps/panel/src/components/ReportList.tsx
    - apps/panel/src/components/ReportDetail.tsx
    - e2e/hostile.spec.ts
    - e2e/ingest.spec.ts
    - .planning/phases/01-contracts-ingest-slice/deferred-items.md

key-decisions:
  - "Entity decode is guarded, not blanket: `toPlainText` decodes sanitize-html's re-escapes (so `2 < 3 & 4 > 1` round-trips literally) only when the decoded value contains no tag-open (`<` + letter/`/`/`!`/`?`); an entity-encoded payload (`&lt;img …&gt;`, `&#60;img …&#62;`, `<title><img …></title>`) stays escaped so no markup-shaped text ever reaches storage"
  - "Validation order kept as validate → sanitise → re-validate: raw caps reject over-cap input early, the post-sanitise re-validation guarantees a stored value never exceeds the cap it validated against (a sanitising-wider value like 200 `&` now stores as exactly 200 characters instead of 400ing)"
  - "Text caps count Unicode code points, not UTF-16 units — Zod 4.6.5's `maxLength` semantics (probe-verified), which is also what the published JSON Schema `maxLength` means; the plan's must_have parenthetical was wrong and the e2e pins the real contract (ASCII boundary identical under both)"
  - "The empty-state 'empty database' rows intercept `GET /api/incidents` with `[]`: the suite shares one growing stack, and intercepting only the list keeps `/api/setup`, the component and the emitted command real"
  - "`GET /api/setup` returns only `{ projectKey }` — the public write-only capability (H-7/DEP-03), no rate limiter of its own (constant config string), Phase 5 replaces its onboarding role with auth (T-01-16)"
  - "The onboarding snippet's `Idempotency-Key` is generated once per mount (memoised), so re-renders don't reshuffle the copyable text and each fresh paste yields a fresh report"

requirements-completed: [ING-07]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "ING-07 pass 1 — every user string (title, note, url, user.id/name/email) sanitised on write: markup removed, plain text preserved literally, control chars stripped, caps re-validated"
    requirement: ING-07
    verification:
      - kind: e2e
        ref: "e2e/hostile.spec.ts#ING-07 pass 1 (5 rows, 3 browsers) in `npm run verify` 123/123"
        status: pass
    human_judgment: false
  - id: D2
    description: "ING-07 pass 2 — render-side inertness: payloads render as literal text, zero payload-attributable elements, no HTML sink anywhere in apps/panel/src"
    requirement: ING-07
    verification:
      - kind: e2e
        ref: "e2e/hostile.spec.ts#ING-07 pass 2 DOM row + source sink-gate row (3 browsers) in `npm run verify` 123/123"
        status: pass
    human_judgment: false
  - id: D3
    description: "P1-D-05 — en/es dictionaries, navigator.language detection (es-ES context → Spanish), manual switch persisted in watchbug.lang across reload"
    requirement: ING-07
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#P1-D-05 language defaults … survives reload (3 browsers)"
        status: pass
    human_judgment: false
  - id: D4
    description: "P1-D-07 — empty state renders the copy-paste curl with the real seeded key and CA-01 wire shape; the emitted snippet runs verbatim (spawned curl → 201 → appears after reload)"
    requirement: ING-07
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#P1-D-07 key endpoint / curl shape / curl runs verbatim (3 browsers)"
        status: pass
    human_judgment: false
  - id: D5
    description: "`meta` part with `Content-Type: application/json` (the curl -F shape) ingests 201 — 01-02's deferred `\"[object Object]\"` defect closed"
    requirement: ING-07
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#P1-D-07: a meta part sent with Content-Type: application/json ingests (3 browsers)"
        status: pass
    human_judgment: false

metrics:
  duration: 45min
  completed: 2026-10-12
status: complete
---

# Phase 1 Plan 4: Text Safety & First-Run Experience Summary

**C-3 double control closed end-to-end: `sanitize-html` pass 1 stores every user
string as markup-free literal text (plain text round-trips exactly, control
characters stripped, caps re-validated) and the panel renders it as inert React
text nodes under a source-level sink gate — while the panel speaks en/es with
`navigator.language` detection and `watchbug.lang` persistence, and its empty
state converts a fresh instance into a first report via a pre-filled `curl`
that e2e executes verbatim.** Full suite **87/87 → 123/123** across chromium +
firefox + webkit; `check:size`, `check:compose`, `npm run build` and
`npm run lint` all green.

## Performance

- **Duration:** 45 min
- **Started:** 2026-10-12T20:38:31Z
- **Completed:** 2026-10-12T21:24Z
- **Tasks:** 3 (Tasks 1–2 `tdd="true"`, full RED → GREEN each; Task 3 plain auto)
- **Files modified:** 16 (15 in the plan diff + this SUMMARY)

## Accomplishments

- **Task 1 (RED → GREEN):** `toPlainText` rewritten into a three-pass
  sanitiser — markup stripped by `sanitize-html` (empty allowlist), the
  renderer's re-escapes decoded back to literal text **only when the decoded
  value cannot re-open a tag** (so `2 < 3 & 4 > 1` stores as those exact 13
  characters while `&lt;img …&gt;` / `&#60;img …&#62;` / `<title><img …>`
  stay escaped), and C0/C1/DEL/BOM control characters stripped in the same
  pass (shared helper for Phase 4's console fields). Five ING-07 rows prove it
  at artifact level: markup-free storage for the img-onerror / script /
  javascript: / UTF-7 / BOM payloads, exact plain-text round-trip,
  `<b>a</b><i>b</i>` → `ab`, zero-length title → 400 with absent optionals
  stored `null`, cap boundary inclusive (ASCII 200/201 and astral code-point
  boundary) with 200 `&` storing as exactly 200 characters. The same GREEN
  commit closes 01-02/01-03's deferred defect: a `meta` part arriving as a
  JSON-parsed object (`curl -F 'meta={…}'`) is re-stringified instead of
  `String()`ing into `"[object Object]"`.
- **Task 2 (RED → GREEN):** render-side proof — a DOM row stores four hostile
  payloads, loads the panel and asserts their text is visible literally, the
  detail image takes only the blob-route URL, and `img[src="x"]`, `[onerror]`,
  inline `script`, `iframe` and `javascript:` anchors are all **zero** (queries
  against the live DOM, not regex over HTML); plus a source-level sink-gate row
  requiring zero `dangerouslySetInnerHTML`/`innerHTML` occurrences under
  `apps/panel/src` — which is exactly what failed pre-implementation (the
  literal sat in `ReportDetail`'s header comment) and is now cleared.
- **Task 3:** `GET /api/setup` → `{ projectKey }` (one field, T-01-16);
  `i18n.ts` with en/es dictionaries (Spanish typed against English keys, so a
  missing translation is a compile error), `detectLang`, `watchbug.lang`
  read/write; `LanguageSwitcher` in the app chrome; `EmptyState` with
  `buildOnboardingCurl(origin, projectKey)` rendered as copyable text. Five
  ingest rows: the key endpoint through nginx, the empty-state curl carrying
  the seeded `wkbt_` key and the CA-01 wire shape, **the emitted curl spawned
  and run verbatim against the stack (201, then visible after reload)**, the
  JSON-content-type meta shape, and language detection + persistence.

## Task Commits

Each task was committed atomically (TDD tasks: RED → GREEN; REFACTOR not needed):

1. **Task 1 (RED): ING-07 pass-1 sanitisation rows** - `840be33` (test)
2. **Task 1 (GREEN): plain-text sanitisation pass + meta JSON fix** - `ddaef5a` (feat)
3. **Task 2 (RED): render-side inertness rows + sink gate** - `57a0c37` (test)
4. **Task 2 (GREEN): sink-gate cleared, DOM row race fixed** - `18a0820` (feat)
5. **Task 3: en/es i18n + onboarding-curl empty state** - `ba499f3` (feat)

**Plan metadata:** *(this commit)*

## Files Created/Modified

- `apps/api/src/ingest/sanitize.ts` — three-pass `toPlainText`
  (strip → guarded decode → control strip) applied by `sanitizeMeta` to
  title, note, url, user.id/name/email; `stripControlChars` exported for reuse.
- `apps/api/src/routes/incidents.ts` — meta part re-stringified when multipart
  JSON-parses it (the `curl -F` shape).
- `apps/api/src/routes/setup.ts` — **new**: `GET /api/setup` → `{ projectKey }`.
- `apps/api/src/app.ts` — registers the setup route next to `/api/health`.
- `apps/panel/src/i18n.ts` — **new**: `en`/`es` dictionaries, `t()`,
  `detectLang()`, `readStoredLang()`/`storeLang()` (`watchbug.lang`),
  `initialLang()`.
- `apps/panel/src/components/EmptyState.tsx` — **new**: `buildOnboardingCurl`
  (POST origin, `X-Project-Key`, generated `Idempotency-Key`, `-F 'meta={…}'`,
  `-F 'image=@screenshot.png'`) + the reload line, fetched key from
  `/api/setup`, rendered as `<pre><code>` text.
- `apps/panel/src/components/LanguageSwitcher.tsx` — **new**: labelled select
  (English / Español endonyms).
- `apps/panel/src/App.tsx` — language state (manual switch persists), header
  switcher, `EmptyState` when the list is empty, all strings via `t()`.
- `apps/panel/src/api.ts` — `fetchSetup()`.
- `apps/panel/src/components/ReportList.tsx` / `ReportDetail.tsx` — `lang`
  prop, every label/status/type/alt string through the dictionary; the inline
  "No reports yet." moved into `EmptyState`.
- `e2e/hostile.spec.ts` — +7 rows (5 ING-07 pass 1, 2 pass 2) with a
  `postMeta`/`storedRow` helper.
- `e2e/ingest.spec.ts` — +5 rows (key endpoint, empty state, executed curl,
  JSON-content-type meta, language detection/persistence).
- `.planning/phases/01-contracts-ingest-slice/01-04-red-evidence-task{1,2}.json`
  — persisted RED records, both verdict `RED_EVIDENCE_OK`.
- `.planning/phases/01-contracts-ingest-slice/deferred-items.md` — the meta
  JSON defect marked RESOLVED with its commits.

## Decisions Made

- **Guarded entity decode (see frontmatter key-decisions).** Blanket decoding
  would store raw markup for entity-encoded attacks and `<title>` RCDATA
  payloads (probe-verified against sanitize-html 2.18.0); blanket escaping
  fails the must-have `2 < 3 & 4 > 1` round-trip. The tag-shape check is the
  narrow rule that satisfies both.
- **Validate → sanitise → re-validate kept** (rather than the plan's prose
  "sanitise first"): the post-sanitise re-validation is what guarantees "a
  sanitised value never exceeds the cap it was stored under", and every stated
  acceptance criterion holds without reordering the ingest chain.
- **Caps follow Zod 4.6.5 = Unicode code points**, probe-verified: the plan's
  "JavaScript string length" premise is factually wrong for astral input, and
  enforcing code units at the edge would diverge from the published
  `schema/report.schema.json` `maxLength` (CA-01 is the contract).
- **Empty-state rows intercept only the list request** — deterministic "empty
  database" on a shared stack while every other artifact stays real.
- **`documentation/img/` (untracked PNGs) left untouched** — appeared during
  this run, not produced by any task here (out of scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The deferred `meta` + `Content-Type: application/json` → `"[object Object]"` 400**
- **Found during:** Task 1 (hard carry-forward from plans 01-02/01-03 — the
  deferral explicitly expired with this plan's P1-D-07 onboarding curl).
- **Issue:** `@fastify/multipart` JSON-parses the field into an object and the
  route did `String(part.value)` → `"[object Object]"` → 400, so the
  onboarding snippet `curl -F 'meta={…}'` could never work.
- **Fix:** `metaRaw = typeof part.value === 'string' ? part.value : JSON.stringify(part.value)`
  in the multipart loop (no CA-01 schema change — the wire contract is
  untouched; only the parser-object case is normalised back to JSON text).
- **Files modified:** `apps/api/src/routes/incidents.ts`; rows in
  `e2e/ingest.spec.ts`.
- **Verification:** JSON-content-type row 201 on all three browsers; the
  emitted-curl row runs the real command → 201 → visible after reload;
  hostile group still 69/69.
- **Committed in:** `ddaef5a` (code), `ba499f3` (rows).

**2. [Rule 1 - Bug] Plan premise: "caps count Unicode code units (JavaScript string length — the Zod maxLength semantics)" is false**
- **Found during:** Task 1 (the RED row `emoji×100 + 'a'` expected 400; the
  stack answered 201).
- **Issue:** Zod 4.6.5 `.max(200)` counts **code points** (probe: 101 astral
  characters accepted, 201 rejected) — identical to code units for BMP input
  but not for emoji. Enforcing code units would make the API reject payloads
  the published JSON Schema `maxLength` accepts (contract divergence).
- **Fix:** the e2e row pins the real contract semantics — 200 emoji = at cap
  (201st code point → 400), ASCII 200/201 unchanged — with a comment stating
  the counting rule. No schema, constant or runtime change.
- **Files modified:** `e2e/hostile.spec.ts`.
- **Verification:** hostile group 69/69; `npm run lint` clean.
- **Committed in:** `840be33` (rows, before the GREEN run).

### Scope additions (outside `files_modified`, documented here)

- **`.planning/phases/01-contracts-ingest-slice/01-04-red-evidence-task{1,2}.json`**
  — the persisted RED records for `gsd_run check tdd-red-evidence` (both
  `RED_EVIDENCE_OK`).
- **`ReportList.tsx` / `ReportDetail.tsx` under Task 3** — they are in the
  plan's frontmatter `files_modified`, and Task 3's action explicitly routes
  every string in them through the dictionary; Task 2 had already touched
  `ReportDetail`'s header comment.
- **`deferred-items.md`** — entry 1 marked RESOLVED with its commits.
- **WebKit wait in the Task 2 DOM row** (`await expect(page.locator('aside
  button').first()).toBeVisible()` before the body snapshot) — committed with
  the Task 2 GREEN.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug) + 4 documented scope additions
**Impact on plan:** both auto-fixes were required for the plan's own must-haves (the onboarding curl and the cap-boundary truth); no scope creep — no new dependencies, no CA-01 schema change, no production rate-limit changes, SDK lanes untouched.

## TDD Gate Compliance (Tasks 1–2, `tdd="true"`)

- **Task 1 RED:** `npx playwright test e2e/hostile.spec.ts --project=chromium -g "ING-07" --reporter=junit`
  → exit 1, 5 tests / 4 failing on planned behavior (entity round-trip, exact
  plain-text storage, sanitising-wider cap, control-char 500). Record:
  `01-04-red-evidence-task1.json`, verdict **`RED_EVIDENCE_OK`**
  (`target_test_failed`). GREEN: `ddaef5a`, 5/5 then hostile **69/69**.
- **Task 2 RED:** same file `-g "ING-07 pass 2"` → exit 1, the named source
  sink-gate target failed on its planned assertion (`ReportDetail.tsx` carried
  the `dangerouslySetInnerHTML` literal). Record:
  `01-04-red-evidence-task2.json`, verdict **`RED_EVIDENCE_OK`**. The DOM row
  passed already — investigated per tdd.md "feature may already exist":
  pass-2 text-node rendering has been in place since 01-01, so the DOM row is
  the regression guard for behavior that exists, and the genuinely failing
  target (the sink gate) authorized GREEN. Record discloses this explicitly.
  GREEN: `18a0820`.
- **REFACTOR:** none needed; no `refactor(01-04)` commit (allowed — optional).
- Commit sequence present: `test(01-04)` ×2 → `feat(01-04)` ×3 (gate grep
  returns exactly 2 RED + 3 GREEN).

## Verification Results

| Check | Command | Result |
| --- | --- | --- |
| hostile group incl. ING-07 rows, 3 browsers | `npm run verify -- e2e/hostile.spec.ts` | **69/69 passed** |
| ingest group incl. empty-state/i18n rows, 3 browsers | `npm run verify -- e2e/ingest.spec.ts` | **36/36 passed** |
| full suite (87 baseline + 36 new) | `npm run verify` | **123/123 passed** |
| size gate (SDK lanes) | `npm run check:size` | PASSED |
| compose gate (INV-03 / C-4 volume) | `npm run check:compose` | PASSED |
| build | `npm run build` | PASSED |
| typecheck | `npm run lint` | PASSED |
| HTML sink gate (plan `<verification>` #4) | grep `dangerouslySetInnerHTML`/`innerHTML` under `apps/panel/src` | clean (0 hits) |

Acceptance criteria re-checked per task: hostile rows assert the markup-free
stored form via `GET /api/incidents`, the exact `2 < 3 & 4 > 1` round-trip and
`ab` document order, zero-length title → 400 with absent note/user → `null`;
`sanitizeMeta` call sites cover title/note/user.name/user.email (and url/id via
`clean()`); DOM row asserts literal text + zero injected elements + blob-only
`img.src`; sink gates clean; `i18n.ts` source assertions (en dict, `es` typed
against it, `watchbug.lang` read/write); `/api/setup` asserted through nginx;
language switch changes a visible string and survives reload; full suite green
on chromium + firefox + webkit.

## Issues Encountered

- **WebKit raced the panel fetch** in the Task 2 DOM body snapshot (saw
  "Loading…" instead of rows) — fixed with an explicit wait for the first list
  button before snapshotting; 69/69 after.
- **Task 2's DOM rows passed before implementation** (pass 2 already existed);
  handled as documented under TDD Gate Compliance — the source sink gate was
  the honest RED target and it genuinely failed.
- **Untracked `documentation/img/{banner-etsii.png,logo-us.png}` appeared
  mid-run** (timestamps inside this session's window, not produced by any
  command or artifact of this plan) — left untouched and uncommitted per the
  scope boundary; whoever created them should claim or remove them.

## Known Stubs

None — no placeholder values, no data-less components, no skipped or `todo`
tests (stub scan over the whole plan diff is clean; the two grep hits are
pre-existing fail-loud `.env` placeholder-key guards in the e2e specs).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 01 is complete (4/4 plans)** — ready for the orchestrator's phase
  verification (`/gsd-verify-work 01`): hostile-submission success criterion's
  final clause ("user text is stored sanitised and renders inert") is proven at
  artifact level, and P1-D-05/P1-D-07 are delivered exactly as locked.
- Carried forward unchanged: the 4 dev-only `drizzle-kit` audit advisories
  (not this plan's), DEP-03's unauthenticated read surface (Phase 5), and the
  A-12/M-2 worst-case size arithmetic (Phase 7).
- Phase 5 note: `GET /api/setup`'s onboarding role should be re-examined when
  real auth lands (T-01-16's recorded mitigation).

## Self-Check: PASSED

- Created files all exist on disk (6/6: `routes/setup.ts`, `i18n.ts`,
  `EmptyState.tsx`, `LanguageSwitcher.tsx`, 2 RED-evidence records) plus this
  SUMMARY.
- All five plan commits exist in the repository: `840be33`, `ddaef5a`,
  `57a0c37`, `18a0820`, `ba499f3` (`git rev-parse --verify` → FOUND ×5).
- Every `<acceptance_criteria>` re-checked (see Verification Results).
- Plan `<verification>` re-run: `npm run verify` **123/123**, `check:size`
  PASSED, `check:compose` PASSED, sink grep clean.
- TDD gate greps: `test(01-04)` ×2, `feat(01-04)` ×3; both RED records verdict
  `RED_EVIDENCE_OK`.
- `commits: 5` measured from the ledger (`e307b26..HEAD`), not narrated.

---
*Phase: 01-contracts-ingest-slice*
*Completed: 2026-10-12*
