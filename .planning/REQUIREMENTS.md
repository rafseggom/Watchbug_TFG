# Requirements: Watchbug SDK

**Defined:** 2026-10-05
**Core Value:** When a bug report lands, the developer can reproduce the bug from it — and neither the report nor its screenshot ever leaves the developer's own infrastructure.

**Scope source:** `documentation/mission-brief.md` RF-01…08 · `.planning/research/FEATURES.md` · `.planning/research/SUMMARY.md` · `documentation/resolution-record.md` §2 + §5 amendments.

## User Stories

- **US-1 (Reporter).** As an end user of a web app, I click a floating button, capture what I'm looking at, scribble an arrow at the broken element, black out my own account number, and file a bug — so the developer sees exactly what I saw.
- **US-2 (Reporter, feedback).** As an end user, I send a suggestion without being forced to attach console logs or a screenshot.
- **US-3 (Reporter, privacy).** As an end user, I can see and edit the capture before it is sent, and I know my password fields and anything my app marks as sensitive never leave the page.
- **US-4 (Developer, integration).** As a developer, I add one async script tag and `Watchbug.init({ projectKey })` and get a working widget, with no build step and no measurable cost to my page.
- **US-5 (Developer, triage).** As a developer, I log into my own panel, filter to open bugs, and see the screenshot, console errors and environment needed to reproduce each one.
- **US-6 (Developer, ownership).** As a developer, I run the entire stack on my own machine with `docker-compose up`, and no user data leaves my infrastructure.

## Acceptance Criteria

These are the property-level invariants from `mission-brief.md` §5. Each must be demonstrated by the e2e suite (R-12) or the size gate.

| ID | Property | Verification (amended per R-12) |
|----|----------|--------------------------------|
| CA-01 | Every sent report validates against the single official JSON schema. `consoleLogs` mandatory for `bug`, optional for `feedback`. | Schema contract assertions against `schema/report.schema.json`, driven through the real ingest path |
| CA-02 | Masked pixels are replaced by **flat opaque fill**, irreversibly, in the final canvas **before** Base64/PNG encoding. | e2e applies a mask, **intercepts the outgoing request**, decodes the attached image and asserts the region's original pixel values are absent from the encoded bytes |
| CA-03 | Compiled distributable ≤ 45 KB gzipped (core) per R-01 tiers. Lighthouse performance drop ≤ 2 points. | `npm run check:size` + a Lighthouse run against the hostile-CSS fixture |
| CA-04 | Hostile host CSS (e.g. `button { display: none !important }`) cannot alter the widget's visibility or layout. | e2e injects the SDK into a fixture with aggressive global CSS and asserts launcher interactivity and dialog content |
| CA-05 | Any unauthenticated request to panel API routes returns `401 Unauthorized`. | Endpoint assertions with missing and invalid credentials |

## Definition of Done

A requirement is **Complete** when:

1. It is implemented within the constraints in `PROJECT.md` and `resolution-record.md` §5.
2. It is covered by an assertion in the single e2e suite **or** by `npm run check:size` — no other test artefact is created (R-12).
3. Its security-sensitive behaviour is verified at the **artifact level** (encoded bytes, HTTP response, stored row), not at a function boundary.
4. It is committed, and the change is reflected in `.planning/ROADMAP.md` traceability.

**Release criteria:** `npm run check:size` passes · the e2e suite passes CA-01…CA-05 on all three Playwright browser projects (chromium, firefox, **webkit** — webkit exercises the WebP→PNG fallback, firefox the no-`ImageCapture` path) · `docker-compose up` brings up three working services from a clean machine using only `.env.example` as a guide · no secret exists in the repository.

---

## v1 Requirements

### Integration

- [ ] **INT-01**: A developer can add Watchbug to a web app with a single async script tag and no build step
- [ ] **INT-02**: A developer can initialise Watchbug with a public project key and options via `window.Watchbug.init()`
- [ ] **INT-03**: A developer can attach `user`, `appVersion` and `custom` context at init and have it ride on every report
- [ ] **INT-04**: A developer can turn off end-user identity collection with `privacy: { userIdentity: false }`
- [ ] **INT-05**: A developer can consume Watchbug as an ES module instead of a global

### Widget & Isolation

- [ ] **WDG-01**: An end user can open the widget from a floating launcher button
- [ ] **WDG-02**: Hostile host CSS (e.g. `* { display: none !important }`) cannot hide, restyle or break the widget
- [ ] **WDG-03**: The widget never leaks styles, classes or CSS variables into the host document
- [ ] **WDG-04**: The host page gains exactly one global (`window.Watchbug`) and no native prototype is modified
- [ ] **WDG-05**: The widget renders above all host content regardless of host stacking context or layout
- [ ] **WDG-06**: An end user can use the widget in English or Spanish, auto-matched to browser language with a manual override

### Capture

- [ ] **CAP-01**: An end user can capture a screenshot of the current tab via the browser's capture prompt
- [ ] **CAP-02**: An end user can attach an image from their device instead of capturing
- [ ] **CAP-03**: An end user sees a clear failure state when capture is unavailable and can still file text-only feedback
- [ ] **CAP-04**: A capture never contains the Watchbug widget itself
- [ ] **CAP-05**: Captures are downscaled to fit ≤ 16 MP and ≤ 2 MB without going blank on HiDPI displays

### Annotation

- [ ] **ANN-01**: An end user can draw freehand on the capture
- [ ] **ANN-02**: An end user can draw arrows
- [ ] **ANN-03**: An end user can draw rectangles
- [ ] **ANN-04**: An end user can add text labels
- [ ] **ANN-05**: An end user can mask a region with an opaque fill
- [ ] **ANN-06**: An end user can undo annotation strokes (masks are deliberately irreversible)

### Privacy & Masking

- [ ] **PRV-01**: `input[type=password]` values are excluded from the capture automatically
- [ ] **PRV-02**: Credential, token and payment-card patterns are redacted automatically
- [ ] **PRV-03**: Elements marked `data-watchbug-sensitive` are redacted automatically
- [ ] **PRV-04**: A masked region is destroyed at the pixel level and is unrecoverable from the encoded image
- [ ] **PRV-05**: The SDK never reads or transmits host cookies, storage or auth headers
- [ ] **PRV-06**: URL query strings and fragments are stripped before transmission
- [ ] **PRV-07**: An end user can review and edit the capture before it is sent

### Payload & Enrichment

- [ ] **ENR-01**: A bug report always carries console logs (CA-01)
- [ ] **ENR-02**: A feedback report can be filed without console logs (RF-02, CA-01)
- [ ] **ENR-03**: Reports carry URL path, user agent, viewport, screen resolution, devicePixelRatio, language, timezone and timestamp
- [ ] **ENR-04**: Reports carry the host-supplied application version
- [ ] **ENR-05**: Console capture is bounded and cannot recurse on the SDK's own logging
- [ ] **ENR-06**: Every report validates against the single published JSON schema (CA-01)

### Transport & Ingestion

- [ ] **ING-01**: A report (image + metadata) reaches the configured backend over HTTP (RF-05)
- [ ] **ING-02**: A report survives page unload and transient network failure via a durable retry queue
- [ ] **ING-03**: A retried submission does not create a duplicate report
- [ ] **ING-04**: The API rejects ingestion without a valid project key
- [ ] **ING-05**: The API rate-limits per IP and per project key (SEC-05)
- [ ] **ING-06**: The API rejects oversized bodies and images
- [ ] **ING-07**: The API sanitises all user-supplied text before storage and before panel rendering (SEC-05)
- [ ] **ING-08**: The API accepts ingestion only from allowlisted origins

### Panel & Triage

- [ ] **TRI-01**: An admin can log in with credentials from `.env` and get a JWT session cookie (SEC-06)
- [ ] **TRI-02**: Any unauthenticated panel API request returns `401 Unauthorized` (CA-05)
- [ ] **TRI-03**: An admin can log out and the session is invalidated
- [ ] **TRI-04**: An admin can list reports filtered by type, status and project
- [ ] **TRI-05**: An admin can view a report's screenshot, console logs and collected metadata
- [ ] **TRI-06**: An admin can set a report to Pending / In Progress / Resolved and reopen it
- [ ] **TRI-07**: An admin can add internal comments to a report
- [ ] **TRI-08**: An admin can delete a report
- [ ] **TRI-09**: An admin can erase a report's end-user identity immediately (RGPD Art. 18)
- [ ] **TRI-10**: An admin can see report counts per status, type and project

### Projects

- [ ] **PRJ-01**: An admin can create a project and obtain its public write-only key
- [ ] **PRJ-02**: An admin can select the active project
- [ ] **PRJ-03**: An admin can rename a project
- [ ] **PRJ-04**: An admin can rotate a project's public key
- [ ] **PRJ-05**: An admin can delete a project and its reports

### Retention

- [ ] **RET-01**: End-user identity fields are purged automatically after N days (default 30)
- [ ] **RET-02**: Whole reports (screenshot, console logs, metadata) are purged automatically after M days (default 90)
- [ ] **RET-03**: A developer can configure both TTLs in `.env`

### Deployment & Operations

- [ ] **DEP-01**: A developer can start API + panel + database with one `docker-compose up` (INV-03)
- [ ] **DEP-02**: A developer can configure every server setting from `.env` using the committed `.env.example` (SEC-04)
- [ ] **DEP-03**: Screenshot blobs live on a filesystem volume and are served only through the authenticated API (R-04)
- [ ] **DEP-04**: A developer can back up and restore by copying the data volume and dumping the database

### Performance Budget

- [ ] **PRF-01**: The injected script is ≤ 45 KB gzipped; the build fails otherwise (RNF-01)
- [ ] **PRF-02**: Each lazy chunk is ≤ 25 KB gzipped (R-01)
- [ ] **PRF-03**: Total runtime client payload is ≤ 80 KB gzipped (R-01)
- [ ] **PRF-04**: The client SDK ships zero runtime npm dependencies (R-01)
- [ ] **PRF-05**: Injecting Watchbug lowers Lighthouse performance by ≤ 2 points (CA-03)

---

## v2 Requirements

Deferred to a future release. Tracked, not in the current roadmap.

### Capture & Annotation

- **CAP-V2-01**: Full-page / scrolling capture
- **CAP-V2-02**: Third capture adapter using DOM serialization (`DomSerializeCapture`)
- **ANN-V2-01**: Crop tool
- **ANN-V2-02**: Step numbering / callout badges
- **ANN-V2-03**: Host-supplied custom allowlisted fields on reports

### Enrichment

- **ENR-V2-01**: Network error capture (failed XHR/fetch) — needs URL-stripping plus a schema change
- **ENR-V2-02**: User breadcrumb trail
- **ENR-V2-03**: Full offline-first queue UX (the v1 durability queue is transport-only)

### Triage

- **TRI-V2-01**: Labels and assignees
- **TRI-V2-02**: Duplicate / similar-report hints (word-overlap heuristic only — no AI)
- **TRI-V2-03**: Time-series trend analytics
- **TRI-V2-04**: Panel-configurable retention TTLs
- **TRI-V2-05**: Multi-user accounts, roles and audit trail
- **TRI-V2-06**: Bulk operations on reports

### Deployment & Adapters

- **DEP-V2-01**: S3/MinIO `Storage` adapter
- **DEP-V2-02**: Static bearer-token `AuthProvider` adapter for CI/automation
- **DEP-V2-03**: Project key-usage analytics and abuse dashboards

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Third-party integrations (Jira, GitHub Issues, Slack, Trello) | `mission-brief.md` §2 non-goal. R-02 reserves the seam; no adapter will be built. |
| Video recording / session replay | §2 non-goal. Also incompatible with RNF-01's 45 KB budget. |
| AI error analysis | §2 non-goal. |
| Gamification / automatic bug-fix suggestions | §2 non-goal. |
| Managed multi-tenant SaaS, subscriptions, payment gateways | §2 non-goal. Excludes the *hosting model*, not R-06's multiple projects per install. |
| OAuth2 / SSO with third-party providers | §2 non-goal. |
| Multi-user panel accounts and roles | R-05 — single admin by design. Avoids a whole AUTH family (signup, email verification, password reset, SMTP). |
| Unit-test suites and coverage thresholds | R-12 — owner policy. Verification is e2e + property assertions only. |
| TFG *memoria* and user documentation site | R-03 — parallel track. |
| Mobile / non-web SDKs | Web-first. |
| CSS overlay or gaussian-blur masking | SEC-02 + R-13 — a security prohibition, not a scope choice. Reversible by deconvolution. |
| SVG or arbitrary-file attachments | Image-borne XSS (research C-3). PNG and WebP only. |
| Reading host cookies, `localStorage` or auth headers | SEC-03 — hard invariant. |

---

## Traceability

Which phases cover which requirements. **Updated during roadmap creation** — every v1 requirement maps to exactly one phase (see `.planning/ROADMAP.md` § Coverage Validation).

| Requirement | Phase | Status |
|-------------|-------|--------|
| INT-01 | Phase 2 | Pending |
| INT-02 | Phase 2 | Pending |
| INT-03 | Phase 4 | Pending |
| INT-04 | Phase 4 | Pending |
| INT-05 | Phase 2 | Pending |
| WDG-01 | Phase 2 | Pending |
| WDG-02 | Phase 2 | Pending |
| WDG-03 | Phase 2 | Pending |
| WDG-04 | Phase 2 | Pending |
| WDG-05 | Phase 2 | Pending |
| WDG-06 | Phase 3 | Pending |
| CAP-01 | Phase 2 | Pending |
| CAP-02 | Phase 3 | Pending |
| CAP-03 | Phase 3 | Pending |
| CAP-04 | Phase 2 | Pending |
| CAP-05 | Phase 2 | Pending |
| ANN-01 | Phase 3 | Pending |
| ANN-02 | Phase 3 | Pending |
| ANN-03 | Phase 3 | Pending |
| ANN-04 | Phase 3 | Pending |
| ANN-05 | Phase 3 | Pending |
| ANN-06 | Phase 3 | Pending |
| PRV-01 | Phase 2 | Pending |
| PRV-02 | Phase 2 | Pending |
| PRV-03 | Phase 2 | Pending |
| PRV-04 | Phase 3 | Pending |
| PRV-05 | Phase 2 | Pending |
| PRV-06 | Phase 2 | Pending |
| PRV-07 | Phase 3 | Pending |
| ENR-01 | Phase 4 | Pending |
| ENR-02 | Phase 4 | Pending |
| ENR-03 | Phase 4 | Pending |
| ENR-04 | Phase 4 | Pending |
| ENR-05 | Phase 4 | Pending |
| ENR-06 | Phase 1 | Pending |
| ING-01 | Phase 1 | Pending |
| ING-02 | Phase 7 | Pending |
| ING-03 | Phase 1 | Pending |
| ING-04 | Phase 1 | Pending |
| ING-05 | Phase 1 | Pending |
| ING-06 | Phase 1 | Pending |
| ING-07 | Phase 1 | Pending |
| ING-08 | Phase 1 | Pending |
| TRI-01 | Phase 5 | Pending |
| TRI-02 | Phase 5 | Pending |
| TRI-03 | Phase 5 | Pending |
| TRI-04 | Phase 6 | Pending |
| TRI-05 | Phase 6 | Pending |
| TRI-06 | Phase 6 | Pending |
| TRI-07 | Phase 6 | Pending |
| TRI-08 | Phase 6 | Pending |
| TRI-09 | Phase 6 | Pending |
| TRI-10 | Phase 6 | Pending |
| PRJ-01 | Phase 5 | Pending |
| PRJ-02 | Phase 5 | Pending |
| PRJ-03 | Phase 5 | Pending |
| PRJ-04 | Phase 5 | Pending |
| PRJ-05 | Phase 5 | Pending |
| RET-01 | Phase 6 | Pending |
| RET-02 | Phase 6 | Pending |
| RET-03 | Phase 6 | Pending |
| DEP-01 | Phase 1 | Pending |
| DEP-02 | Phase 1 | Pending |
| DEP-03 | Phase 5 | Pending |
| DEP-04 | Phase 7 | Pending |
| PRF-01 | Phase 2 | Pending |
| PRF-02 | Phase 3 | Pending |
| PRF-03 | Phase 3 | Pending |
| PRF-04 | Phase 2 | Pending |
| PRF-05 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 70 total
- Mapped to phases: 70 (Phase 1: 10 · Phase 2: 18 · Phase 3: 13 · Phase 4: 7 · Phase 5: 9 · Phase 6: 10 · Phase 7: 3)
- Duplicated across phases: 0
- Unmapped: 0 ✓ (100% coverage)

---
*Requirements defined: 2026-10-05*
*Last updated: 2026-10-05 after initial definition*
