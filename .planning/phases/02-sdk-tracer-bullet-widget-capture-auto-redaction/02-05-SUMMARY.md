---
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
plan: 05
subsystem: sdk
tags: [privacy, prv-05, prv-06, prf-01, prf-04, sentinel-scan, path-only-url, title-cap, size-budget, zero-runtime-deps, oq-2, webkit-webp, e2e, full-suite]

# Dependency graph
requires:
  - phase: 01-contracts-ingest-slice
    provides: "the compose stack (`/api/health`, ingest 201), `@watchbug/contracts/constants` (`MAX_TITLE_CHARS`, `MAX_URL_PATH_CHARS`), `reportSchema` (`stripQueryFragment` defence in depth), `scripts/gate.mjs` (`sdk-no-host-storage`, `sdk-runtime-deps`), `check:size` filename-gated tiers, and the one-Playwright-suite conventions"
  - phase: 02-01 (widget shell & boot proof)
    provides: "the open-mode `watchbug.e2e.js` bundle, the fixture harness (`openHostFixture`/`openHostileFixture`, route fulfilment at the panel origin), and the boot/global rows"
  - phase: 02-02 (capture tracer + isolation proof)
    provides: "the credential-free `lane1.ts` transport (`credentials: 'omit'`, explicit `X-Project-Key`/`Idempotency-Key`, explicit-field `buildMeta()` with `location.pathname`), the pass-through interception pattern, and the WebKit `postDataBuffer()` blob-part finding"
  - phase: 02-03 (capture fidelity)
    provides: "the two-tier capture stub with the fetch-boundary outgoing-image recorder (`readOutgoingImage`), `interceptIncidentPosts`, and the `M-3` forced-PNG stub row"
  - phase: 02-04 (redaction catalog)
    provides: "the 45-row-per-plan suite green on three engines (135 rows) as this plan's regression base, plus the Pitfall-1 wording strategy that keeps `sdk-no-host-storage` green"
provides:
  - "PRV-05: a sentinel e2e row that seeds four distinct host-credential sentinels (cookie, localStorage, sessionStorage, authorization-style header), proves each rides the host page's OWN requests, then scans the intercepted report — every header name/value, the raw multipart bytes, and the fetch-boundary image bytes — for zero occurrences, with exactly `X-Project-Key` + `Idempotency-Key` beyond browser-set headers"
  - "PRV-06: a `?token=secret#frag` fixture whose intercepted `meta.url` equals the path exactly (no `?`, `#`, or origin) in the RAW wire bytes, validated against `reportSchema` on top"
  - "P2-D-01: the auto-title proven to be exactly the first 200 **code points** of a 300-character title with `type: 'bug'` — `buildMeta()` now truncates by code point to match the Zod cap semantics"
  - "PRF-01: `check:size` green against the landed widget (core 8.5 KB gz / 45 KB) with `watchbug.e2e.*` structurally outside the gate"
  - "PRF-04: `sdk-runtime-deps` green — `packages/sdk` runtime block is `@watchbug/contracts` only, all value imports from the constants subpath (Zod erased)"
  - "the zero-third-party row: every request the widget page makes stays on the Watchbug origin — the report targets the configured API base and nothing else"
  - "OQ-2 on record: `playwright.config.ts` corrected + `resolution-record.md` amendment A-14 (probe evidence 2026-10-17), R-12 policy untouched"
  - "the phase-closing full-suite run: `npm run verify` 294/294 green across chromium + firefox + webkit (deploy + hostile + ingest + sdk groups)"
affects: [phase-3 annotator composer (replaces the P2-D-01 `type:'bug'` shortcut), phase-4 C-5 scrubber (keeps the same credential-free transport), phase-7 release gate (re-runs PRV/PRF rows + `check:size`), /gsd-verify-work 02]

# Actuals (#2632) — pairs with the plan's `estimate` (40000 tokens / 3 tasks)
actuals:
  tokens: 6307
  tasks: 3
  commits: 5
  plan_head_before: 31a61f33a0092fab0ff43453ad66d2d2acdbc45f
  plan_head_after: 09e729791fef82d56e7bc8945145bf1423075271

# Tech tracking
tech-stack:
  added: ["none — zero new dependencies (RNF-01 / PRF-04); every change is SDK source, e2e rows or documentation"]
  patterns:
    - "SEC-03 by payload: seed per-surface sentinels → prove they ride the host's own traffic (non-vacuity) → scan the widget's request for zero occurrences across ALL three byte-surfaces (intercepted headers, raw multipart buffer, fetch-boundary image blob)"
    - "WebKit cookie blind spot stated, not assumed: Playwright's WebKit exposes no `cookie` header on any intercepted request (probe 2026-10-24), so the cookie provocation asserts on chromium/firefox and the SDK half rests on `credentials: 'omit'` + the static gate"
    - "Code-point truncation as the contract seam: `[...title].slice(0, MAX_TITLE_CHARS).join('')` matches Zod 4 `.max()` semantics (probe-verified: 200 code points = 400 UTF-16 units valid), a UTF-16 `slice` under-truncates non-BMP titles"
    - "RAW-bytes-first wire assertions: `meta` is parsed out of the intercepted multipart buffer BEFORE the schema transform, so 'the SDK sent path-only' is proven independently of `stripQueryFragment` defence in depth"
    - "Data-independent heading assertions: with the shared stack holding real incidents, panel-reading rows must match exact accessible names, never substrings of user data"

key-files:
  created:
    - .planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-05-red-evidence-task2.json
  modified:
    - e2e/sdk.spec.ts
    - packages/sdk/src/transport/lane1.ts
    - playwright.config.ts
    - documentation/resolution-record.md
    - e2e/deploy.spec.ts

key-decisions:
  - "`buildMeta()` truncates the title by CODE POINTS (spread + slice + join), not UTF-16 units: Zod 4's `.max(200)` counts code points (probe-verified in-session), so a 300-emoji title truncated by unit spanned only 150 code points — RED proven on the wire, GREEN sends exactly the first 200"
  - "The PRV-05 body scan is split across two observability surfaces: the intercepted `postDataBuffer()` (complete framing + `meta` on every engine; complete body on chromium/firefox) PLUS `readOutgoingImage()`'s fetch-boundary blob (covers the image on WebKit, which reports 0 bytes for blob-backed parts) — together they cover every byte of the request on every engine"
  - "The Authorization/cookie provocations run against the host page's OWN requests: the row asserts they ride (non-vacuity) before asserting the report carries none — a negative that could never pass vacuously"
  - "Playwright-WebKit exposes no `cookie` request header at all (probe 2026-10-24: `headerValue('cookie')` null even with seeded cookies + `credentials: 'include'`), so the cookie half of the provocation is engine-conditional and documented in-row; this is an observability limit, not an SDK gap"
  - "Cross-row interference fixed at the ambiguous locator, not by sanitising data: `deploy.spec` DEP-01/S-4 now match the app-frame heading with `exact: true` (an incident titled 'Watchbug host fixture' in the real detail pane resolved the substring locator to two elements)"
  - "OQ-2 recorded as amendment A-14 (a note): the corrected premise is stated, the REQUIREMENTS release-criteria wording delta is FLAGGED (WINDOWS ledger, kind `unmet-truth`) and R-12 is not edited — exactly the plan's boundary"

patterns-established:
  - "Sentinel-scan privacy rows: four distinct sentinels, one per credential surface, with host-side positive controls proving each sentinel rides real page traffic"
  - "`interceptedMeta(call)` — parse the `meta` multipart part out of raw intercepted bytes for wire-first assertions (PRV-06, P2-D-01)"
  - "Engine-conditional provocation assertions carry an in-row comment naming the probe date and the observable alternative, so a skipped assert reads as a measured limitation"

requirements-completed: [PRV-05, PRV-06, PRF-01, PRF-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "PRV-05 — sentinel proof: with sentinels seeded in host cookies, web storage and an authorization-style header, the intercepted outgoing report contains NONE of them (every header, raw multipart bytes, fetch-boundary image bytes) and carries only X-Project-Key + Idempotency-Key beyond browser-set headers"
    requirement: PRV-05
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#PRV-05: the intercepted report carries no host cookie, storage or auth material (chromium + firefox + webkit, full `npm run verify` 294 passed)"
        status: pass
      - kind: other
        ref: "`node scripts/gate.mjs sdk-no-host-storage` → PASS (15 SDK source files clean of host storage/credential access)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PRV-06 — meta.url is path-only: a fixture addressed with ?token=secret#frag sends url equal to the path exactly (no query, no fragment, no origin) in the raw wire bytes, and the meta validates against reportSchema; a short title passes through unchanged"
    requirement: PRV-06
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#PRV-06: meta.url is path-only — the query string and fragment never enter the report (3 engines)"
        status: pass
      - kind: other
        ref: "source assertion `packages/sdk/src/transport/lane1.ts` (`url: loc.pathname.slice(0, MAX_URL_PATH_CHARS)`) + in-test `reportSchema.parse` on the intercepted meta"
        status: pass
    human_judgment: false
  - id: D3
    description: "P2-D-01 — the sent title is exactly the first 200 code points of a 300-character title and type is bug, validated against the published contract schema"
    requirement: PRV-06
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#P2-D-01: the auto-title is document.title truncated to the first 200 code points and type is bug (3 engines; RED 150→200 code points, `02-05-red-evidence-task2.json` → RED_EVIDENCE_OK)"
        status: pass
      - kind: other
        ref: "source assertion `lane1.ts` `buildMeta()` (`[...title].slice(0, MAX_TITLE_CHARS).join('')`, literal `type: 'bug'`, no object spread into meta)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Self-hosted promise — the widget makes zero third-party network requests: every request from first navigation through the report flow stays on the Watchbug origin, and the report targets the configured API base"
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#self-hosted: the widget makes zero third-party network requests — only the configured Watchbug API base (3 engines)"
        status: pass
    human_judgment: false
  - id: D5
    description: "PRF-01 — the injected core watchbug.js is within its 45 KB gzipped tier with the full widget landed, and the open-mode watchbug.e2e.* artifacts are never gated as production bundles"
    requirement: PRF-01
    verification:
      - kind: other
        ref: "`npm run check:size` → SIZE OK core 8.5 KB gz / 45 KB, lazy 0.3/25, adapter 0.3/14, runtime 9.1/80, PASSED (LANES in scripts/check-size.mjs gate `watchbug.js`/`watchbug-annotator.js`/`watchbug-dom-serialize.js` by filename — e2e artifacts structurally excluded)"
        status: pass
      - kind: other
        ref: "`npm run build` exit 0 after the lane1 edit"
        status: pass
    human_judgment: false
  - id: D6
    description: "PRF-04 — packages/sdk ships zero runtime npm dependencies beyond @watchbug/contracts, and contracts values are imported from the constants subpath so Zod never ships in the bundle"
    requirement: PRF-04
    verification:
      - kind: other
        ref: "`node scripts/gate.mjs sdk-runtime-deps` → PASS (runtime blocks contain only @watchbug/contracts); `npm run check:size` runtime 9.1/80 KB"
        status: pass
      - kind: other
        ref: "source assertion `packages/sdk/package.json` (dependencies: @watchbug/contracts only) + all four SDK value imports target `@watchbug/contracts/constants`"
        status: pass
    human_judgment: false
  - id: D7
    description: "OQ-2 premise correction — playwright.config.ts no longer claims webkit produces the PNG fallback naturally (states the forced-PNG stub covers M-3), and resolution-record amendment A-14 records both observations with the 2026-10-17 probe date"
    verification:
      - kind: other
        ref: "source assertions: playwright.config.ts lines 6–15 (forced-PNG stub + A-14 reference); documentation/resolution-record.md `### A-14 … (probe evidence 2026-10-17)`; R-12 text and REQUIREMENTS wording untouched (`git diff` shows no change to either)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Phase-closing verification — the one suite is green on all three engines together with build, size gate, static gate and lint"
    verification:
      - kind: e2e
        ref: "`npm run verify` → 294 passed (deploy + hostile + ingest + sdk groups; sdk rows 49 per engine = 147), exit 0"
        status: pass
      - kind: other
        ref: "`npm run build` exit 0; `npm run check:size` PASSED; `node scripts/gate.mjs` 3 passed / 0 failed / 0 skipped; `npm run lint` exit 0"
        status: pass
    human_judgment: false
  - id: D9
    description: "Privacy prohibition (must_haves): the privacy core (capture, redaction, encode ordering) is never moved out of the injected core lane to preserve the size budget — auto-redaction never lives only in a lazily-loaded chunk"
    verification: []
    human_judgment: true
    rationale: "The plan marks this prohibition `verification: judgment`. The size numbers and suite rows are green, but the global claim — no future/lazy-lane deferral of the privacy core anywhere in the SDK — needs human sign-off at verify-work, as the plan requires."

# Metrics
duration: 60min
completed: 2026-10-24
status: complete
---

# Phase 2 Plan 5: Outbound Privacy & Budget-Honesty Closeout Summary

**SEC-03 is now proven by payload, not just by static grep: four host-credential sentinels (cookie, localStorage, sessionStorage, Authorization) are shown riding the host page's own requests and then scanned for ZERO occurrences across every header, the raw multipart bytes and the fetch-boundary image bytes of the intercepted report — which carries exactly `X-Project-Key` + `Idempotency-Key`; `meta.url` ships path-only, the auto-title ships as exactly the first 200 code points (new: `buildMeta()` now truncates by code point to the Zod cap semantics), budgets hold against the real bundle (core 8.5 KB gz of 45 KB, zero runtime npm deps), and the full one-suite run is 294/294 green on chromium + firefox + webkit with the false webkit/WebP premise corrected on record as amendment A-14.**

## Security Property Owned by This Plan

> **With sentinel values seeded in the host page's cookies, web storage and an authorization-style header, the intercepted outgoing report contains NONE of them and carries only `X-Project-Key` + `Idempotency-Key`; `meta.url` is path-only; title truncated to `MAX_TITLE_CHARS`.** The provocations are non-vacuous — the same sentinels are asserted present on the host page's own requests (cookie rides a default same-origin fetch, `Authorization: Bearer …` rides the page's authenticated call) before the widget's request is scanned clean.

## Performance

- **Duration:** ~60 min
- **Started:** 2026-10-24T15:47:43Z
- **Completed:** 2026-10-24T16:47Z
- **Tasks:** 3 (Tasks 1–2 carry `tdd="true"`; see "TDD Gate Compliance")
- **Files modified:** 6 (5 in the plan's scope + `e2e/deploy.spec.ts` cross-row fix), 0 deleted

## Accomplishments

- **Task 1 (`d3a7574`): the sentinel row.** `e2e/sdk.spec.ts` gains `PRV-05:` — seeds four distinct sentinels (context cookie + page cookie, `localStorage`, `sessionStorage`, an `Authorization: Bearer` attempt plus a default-credential same-origin fetch), asserts each provocation rides the host's own intercepted requests (non-vacuity), then intercepts the widget's report and asserts: zero sentinel occurrences in every header name/value, no `authorization`/`cookie` header at all, exactly `['idempotency-key', 'x-project-key']` beyond browser-set headers, zero occurrences in the raw multipart buffer, and zero in the fetch-boundary image bytes (the WebKit `postDataBuffer()` blob-part gap). `lane1.ts` needed **no production change** — 02-02 already shipped `credentials: 'omit'` + explicit headers + explicit-field meta (see TDD Gate Compliance); `node scripts/gate.mjs sdk-no-host-storage` stays PASS.
- **Task 2 (`847ce5c` RED → `bec89b1` GREEN): path-only URL + code-point title cap.** Two rows: `PRV-06:` navigates the fixture to `?token=secret#frag` and asserts the RAW intercepted `meta.url` equals `/__e2e/hostile-host.html` exactly (no `?`, `#`, origin) with `reportSchema.parse` on top; `P2-D-01:` sends a 300-code-point (500 UTF-16-unit) title and asserts the wire title is exactly the first 200 code points with `type: 'bug'`. RED was genuine — `title.slice(0, 200)` counted UTF-16 units and sent **150** code points (`RED_EVIDENCE_OK`); GREEN switches `buildMeta()` to `[...title].slice(0, MAX_TITLE_CHARS).join('')`, matching the Zod cap semantics (probe-verified in-session: Zod accepts 200 code points = 400 UTF-16 units, rejects 300).
- **Task 3 (`b4a4491` test/fix + `09e7297` docs): budget proof, premise correction, full-suite closure.** `check:size` PASSED against the landed widget (core **8.5/45 KB gz**, runtime 9.1/80) with `watchbug.e2e.*` structurally outside the filename-gated LANES; `sdk-runtime-deps` PASS with the manifest's runtime block = `@watchbug/contracts` only and all four SDK value imports from the constants subpath; the new `self-hosted:` row proves zero third-party destinations; `playwright.config.ts` now states this platform's WebKit encodes real WebP and that M-3 is covered by the forced-PNG stub; `documentation/resolution-record.md` gains **A-14** recording both observations (real `RIFF….WEBP` magic, probe 2026-10-17; zero-byte blobs still labelled `image/webp`) and naming magic-byte sniffing the authority — R-12 untouched. The full `npm run verify` then ran **294/294 green** across all four spec groups and three engines after fixing the one cross-row interference it surfaced.

## Task Commits

Each task was committed atomically (TDD RED → GREEN where behavior was missing):

1. **Task 1: PRV-05 host-credential sentinel row** - `d3a7574` (test — no RED; transport already credential-free, investigated per `tdd.md` fail-fast)
2. **Task 2: PRV-06 path-only URL + P2-D-01 title wire-shape rows** - `847ce5c` (test — RED, `RED_EVIDENCE_OK`) + `bec89b1` (feat — GREEN)
3. **Task 3: self-hosted zero-third-party row + deploy heading fix** - `b4a4491` (test)
4. **Task 3: OQ-2 premise correction (config comment + resolution-record A-14)** - `09e7297` (docs)

**Plan metadata:** *(this commit)*

_Measured from the plan ledger `31a61f3..HEAD` → 5 commits (`git rev-list --count`), not narrated._

## Files Created/Modified

- `e2e/sdk.spec.ts` — four new rows (`PRV-05`, `PRV-06`, `P2-D-01`, `self-hosted`) + helpers (`SENTINELS`, `BROWSER_STANDARD_HEADERS`, `interceptedMeta`) and the `reportSchema`/`MAX_TITLE_CHARS`/`HOSTILE_URL` imports.
- `packages/sdk/src/transport/lane1.ts` — `buildMeta()` title truncation now counts code points (spread + slice + join) with the rationale comment; `type`/`url` mapping unchanged.
- `playwright.config.ts` — corrected three-projects header comment (webkit premise → forced-PNG stub + A-14 pointer).
- `documentation/resolution-record.md` — **new amendment A-14** (OQ-2 closed; probe evidence 2026-10-17; owner-flagged REQUIREMENTS wording delta).
- `e2e/deploy.spec.ts` — DEP-01/S-4 heading assertions now `exact: true` (cross-row interference fix; see Deviations 3).
- `02-05-red-evidence-task2.json` — RED evidence record, verified `RED_EVIDENCE_OK`.

## Decisions Made

- **Code-point truncation is the contract seam** (frontmatter key-decision): the plan mandates counting "consistently with the Zod cap semantics"; an in-session probe proved Zod 4 `.max(200)` counts code points, so `[...title].slice(0, 200).join('')` is the correct implementation and the emoji-title row is the only row that can tell the two semantics apart.
- **Two-surface body scan**: intercepted bytes cover framing + `meta` on every engine; `readOutgoingImage()`'s fetch-boundary blob covers the image where WebKit's `postDataBuffer()` reports 0 bytes — no new recorder was written (R-18 reuse of 02-03's).
- **Engine-conditional cookie provocation**: Playwright-WebKit exposes no cookie header at all (probe recorded in-row), so the cookie-rides assertion runs on chromium/firefox while the report-side "no cookie header" and the `credentials: 'omit'` source rule hold everywhere.
- **`exact: true` over data sanitising** for the deploy rows: the shared stack legitimately holds incidents whose titles contain "Watchbug"; asserting the exact app-frame heading is both stronger and data-independent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan premise] Task 1 required no production change — the credential-free transport already shipped in 02-02**
- **Found during:** Task 1 (`PRV-05` row passed on first run against unmodified `lane1.ts`).
- **Issue:** The plan's action says "make the outbound request provably credential-free" — but `credentials: 'omit'`, the two-header construction and the explicit-field meta were all built by 02-02 (`032a66c`). Per `tdd.md` fail-fast ("test passes before implementation — investigate") the behavior was confirmed to already exist.
- **Resolution:** No RED fabricated for Task 1 (02-03 Task 3 / 02-04 Task 2 precedent); the new row *proves* the shipped behavior at the artifact level and the static gate keeps it. `lane1.ts` did change in Task 2 (code-point cap), committed separately.
- **Files modified:** none for this item.
- **Verification:** chromium 46/46 at Task 1 close; three-engine PRV-05 green.

**2. [Rule 1 - Bug] WebKit cookie provocation asserted an unobservable header**
- **Found during:** Task 1 (three-engine PRV-05 run: firefox green, webkit failed "the seeded cookie must ride a default same-origin request", `cookie` header empty).
- **Issue:** The row's non-vacuity control assumed every engine exposes the `cookie` request header; Playwright's WebKit does not (probe: `headerValue('cookie')` null, `allHeaders()` without cookie, even with seeded cookies + `credentials: 'include'` — while `authorization` IS visible).
- **Fix:** the cookie-rides assertion is engine-conditional with the probe-dated comment; the Authorization provocation (observable everywhere) and all four sentinel scans remain unconditional; the `pragma` header webkit adds is whitelisted as browser-set.
- **Files modified:** `e2e/sdk.spec.ts`.
- **Verification:** PRV-05 green on all three engines; chromium full run 48/48.
- **Committed in:** `d3a7574`.

**3. [Rule 3 - Blocking] Full `npm run verify` failed: deploy rows' heading locator resolved to real incident data**
- **Found during:** Task 3 (first full-suite run: 4 failed / 290 passed — `deploy.spec.ts` DEP-01 + S-4 on chromium and firefox; reproduced standalone, so not caused by the new rows).
- **Issue:** `getByRole('heading', { name: 'Watchbug' })` matches substrings; the panel's detail pane renders real incident titles that contain "Watchbug" (e.g. the fixture's default document title), so the locator resolved to two elements and strict mode failed. The shared stack has held such incidents since Phase 2's first persisted report (02-02/02-03 rows), but no plan had re-run the *full* suite since Phase 1.
- **Fix:** both assertions now use `exact: true` — a strictly stronger, data-independent match on the SPA app-frame heading, with the reason written into the code.
- **Files modified:** `e2e/deploy.spec.ts` — **scope note:** outside the plan's `files_modified`, but Task 3's `<action>` explicitly mandates "fix any cross-row interference" and its `<verify>` requires `npm run verify` green; resolved in favor of the task definition (02-04's `pipeline.ts` precedent). No file outside `plan files_modified ∪ tasks/<files>` was touched beyond this one.
- **Verification:** `deploy.spec` 21/21, then full `npm run verify` **294 passed** exit 0.
- **Committed in:** `b4a4491`.

**4. [Scope note] FIRST RED-evidence attempt recorded as `INVALID_RED (zero_tests_discovered)`**
- **Found during:** Task 2 RED persistence: PowerShell's `>` redirected the junit XML as UTF-16, and the checker parsed the mangled bytes as zero tests.
- **Fix:** re-encoded the capture to UTF-8 and regenerated the record → `RED_EVIDENCE_OK`. The RED itself was never in doubt (the row failed on the planned assertion, 150 ≠ 200 code points); only the evidence artifact needed re-encoding.
- **Committed in:** `847ce5c`.

---

**Total deviations:** 4 (1 Rule 1, 1 Rule 3, 1 plan-premise reconciliation, 1 evidence-encoding note).
**Impact on plan:** all in-scope correctness/harness fixes; one out-of-list file (`e2e/deploy.spec.ts`) touched under the plan's own cross-row-interference mandate. No architectural change, no scope creep, zero new dependencies.

## TDD Gate Compliance

Tasks 1–2 carry `tdd="true"`; `workflow.tdd_mode` is `false` and R-12 forbids unit-test suites — so the Playwright rows *are* the test artefact and RED means a failing row, with evidence records verified by `gsd_run check tdd-red-evidence`:

| Task | RED | Evidence | GREEN |
| --- | --- | --- | --- |
| 1 | none — the PRV-05 row passed first run because 02-02 already shipped the credential-free transport; investigated per `tdd.md` fail-fast, no RED fabricated | — | — (no production change; test commit `d3a7574`) |
| 2 | `847ce5c` — P2-D-01 fails: sent title spans 150 code points, expected 200 (UTF-16 slice vs code-point cap) | `02-05-red-evidence-task2.json` → `RED_EVIDENCE_OK` | `bec89b1` |
| 3 | n/a (`type="auto"`, no `tdd`) | — | `b4a4491` + `09e7297` |

Git-log gate greps: `test(02-05):` ×2, `feat(02-05):` ×1, `docs(02-05):` ×1 — both RED and GREEN gate commits present for the task that needed them. No REFACTOR commit (no post-GREEN cleanup warranted).

## Verification Results

| Check | Command | Result |
| --- | --- | --- |
| Workspace build | `npm run build` | exit 0 (re-run after the `lane1.ts` edit — stale `dist/` would silently serve old code to e2e) |
| Size gate (RNF-01) | `npm run check:size` | **PASSED** — core **8.5/45**, lazy 0.3/25, adapter 0.3/14, runtime 9.1/80 KB gz; `watchbug.e2e.*` not gated (filename LANES) |
| Static architecture gate | `node scripts/gate.mjs` | **PASSED** — 3 passed, 0 failed, 0 skipped (`sdk-runtime-deps`, `sdk-no-host-storage`, `sdk-single-encode-sink`) |
| Task 1 gate — chromium | `npx playwright test e2e/sdk.spec.ts --project=chromium` | **46 passed** at Task 1 close (48 after Task 2) |
| Task 1 targeted gate | `node scripts/gate.mjs sdk-no-host-storage` | PASS — 15 SDK source files clean |
| Task 2 gates | chromium 48/48 + `npm run verify -- e2e/sdk.spec.ts` | **144 passed** (48 rows × 3 engines), exit 0 |
| RED evidence (Task 2) | `gsd_run check tdd-red-evidence` | `RED_EVIDENCE_OK` |
| Lint + typecheck (4 workspaces) | `npm run lint` | exit 0 |
| **Phase-closing full suite** | `npm run verify` (deploy + hostile + ingest + sdk, 3 engines) | **294 passed**, exit 0 |

Acceptance criteria re-checked against the source and run log: PRV-05 row asserts zero sentinel hits across headers/raw body/fetch-boundary image **and** the two contract headers (present, passing ×3); `lane1.ts` `buildMeta()` shows literal `type: 'bug'`, `title:`, `url:` assignments and **no** object spread; `sdk-no-host-storage` PASS; PRV-06 asserts `meta.url === '/__e2e/hostile-host.html'` with `?`/`#`/origin absent in RAW bytes; P2-D-01 asserts exactly 200 code points for a 300-character title with `type: 'bug'`; both rows `reportSchema.parse`; `check:size` core 8.5 ≤ 45 with e2e artifacts outside LANES; `packages/sdk/package.json` runtime block = `@watchbug/contracts` only; `playwright.config.ts` states the forced-PNG stub covers M-3 (grep lines 6–15); `resolution-record.md` carries `### A-14 … (probe evidence 2026-10-17)`; `npm run verify` reports every `sdk.spec.ts` row green on chromium, firefox and webkit (49 × 3 = 147 of the 294).

## Issues Encountered

- **Docker Desktop was not running** at start; started from `C:\Users\Dekker\AppData\Local\Programs\DockerDesktop` (the `Program Files` path does not exist on this host) and waited for `http://127.0.0.1:8080/api/health` → `{"status":"ok"}` before any test run. Environment gate satisfied for real, never faked.
- **PowerShell UTF-16 redirect** silently broke the first RED-evidence parse (Deviation 4) — known host quirk; all evidence captures now convert to UTF-8 before the checker reads them.
- **Shell/pin-guard friction (known from 02-03/02-04):** default `bash` is WSL's (`/mnt/e/…`, breaks the `E:/…` pin), so the pin guard + pre-commit assertion + commits all ran through **Git Bash** with commands pre-written to script files; `PIN OK: E:/Proyectos Github/Watchbug_TFG` + `HEAD OK: gsd/phase-2-sdk-tracer-bullet (protected=false)` before every commit.
- **Data-dependent deploy rows** (Deviation 3) were the only suite failure in the full run; fixed at the locator, not by touching the shared stack's data.
- **Pre-existing working-tree noise left untouched:** `schema/report.schema.json` (line-ending-only stat diff, `git diff` empty) and untracked `watchbugus-fun/` — neither staged, per dispatch instructions.

## Known Stubs

None. No placeholder text, hardcoded empty values, skipped tests, TODO/FIXME markers or unrun `<verify>` remain in this plan's diff (stub-pattern grep over the full plan diff: clean). `.planning/WINDOWS.md` gained one entry — **#5, kind `unmet-truth`, phase 02**: the REQUIREMENTS release-criteria wording still claims "webkit exercises the WebP→PNG fallback" — which this plan is explicitly not authorised to edit; it is flagged for the owner (A-14 records the corrected premise; the wording delta is the open item).

## User Setup Required

None — no new environment variable, no external service, no dependency install (zero new packages, PRF-04). The compose stack must be up for `npm run verify` (it answered `/api/health` → `{"status":"ok"}` before every run here).

## Next Phase Readiness

- **Phase 02 is COMPLETE: 5/5 plans summarized.** Ready for `/gsd-verify-work 02` (the UAT harvest includes D9's prohibition judgment calls) and then Phase 3 (annotator/composer) planning.
- **The suite to inherit:** 294 rows across the four groups, 49 sdk rows per engine; new rows should keep the requirement-ID title convention, fulfilled-201 interception where the wire is the subject, and pass-through where the real stack is the subject.
- **Phase 3 note:** the composer replaces the P2-D-01 `type:'bug'` shortcut and may want a non-auto title — `buildMeta()`'s explicit mapping and the 200-code-point cap are the seam it plugs into.
- **Phase 7 note:** A-12/M-2 (45+25+14 = 84 > 80 KB) still prints on every `check:size` run; tier arithmetic remains Phase 7's; the REQUIREMENTS webkit wording delta (WINDOWS #5) should be resolved at the release gate.
- **Budget headroom at phase end:** core 8.5 KB gz of 45 KB (36.5 KB free) before the annotator's 25 KB lazy lane lands.

## Self-Check: PASSED

- All 6 changed files exist on disk (`[ -f ]` ×6 FOUND); none deleted (post-commit deletion checks: only intentional comment/line replacements, 6 deletions total across the plan diff).
- All 5 commits exist (`git log --oneline` FOUND ×5: `d3a7574`, `847ce5c`, `bec89b1`, `b4a4491`, `09e7297`); `commits: 5` measured from the ledger (`31a61f3..HEAD` → `git rev-list --count` = 5), not narrated.
- RED record re-verified: `RED_EVIDENCE_OK` (`02-05-red-evidence-task2.json`).
- Plan `<verification>` re-run at closeout: `npm run verify` **294 passed**, `npm run check:size` **PASSED**, `node scripts/gate.mjs` **3 passed / 0 failed**, `npm run build` exit 0, `npm run lint` exit 0.
- Every `<acceptance_criteria>` re-checked against the source (see Verification Results).

---
*Phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction*
*Completed: 2026-10-24*
