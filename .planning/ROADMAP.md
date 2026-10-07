# Roadmap: Watchbug SDK

## Overview

Seven vertical MVP slices take Watchbug from an empty repository to a shippable, self-hosted bug-reporting SDK. Phase 1 proves the spine — a report crosses the wire into hardened, schema-validated storage and renders in a minimal panel. Phase 2 fires the first *real* tracer bullet: widget → capture → destructive auto-redaction → POST → panel, with the two architecture-loaded decisions (`WidgetHost` isolation, redaction ordering T1) fixed at first build. Phases 3–4 complete the reporter experience (composer, lazy annotation editor with irreversible masking T2/T3, full payload with console/env/identity) and Phases 5–6 complete the developer experience (secure admin access, projects + key rotation, triage, retention lifecycle). Phase 7 makes reports survive unload and flaky networks exactly once and proves the release gate end to end. Every v1 requirement maps to exactly one phase; unit tests are abolished by R-12 — verification is one Playwright suite (CA-01…CA-05 on chromium/firefox/webkit) plus `npm run check:size`.

## Phase Summary

| Phase | Goal | Requirements | Success Criteria |
|-------|------|--------------|------------------|
| 1 — Contracts & Ingest Slice | A developer starts the self-hosted stack and a report (image + metadata) crosses the wire into hardened, schema-validated storage and renders in a minimal panel | DEP-01, DEP-02, ENR-06, ING-01, ING-03, ING-04, ING-05, ING-06, ING-07, ING-08 | 5 |
| 2 — SDK Tracer Bullet: Widget, Capture & Auto-Redaction | An end user opens the widget, captures the tab with sensitive data destructively masked, and files it into the panel — first real slice | INT-01, INT-02, INT-05, WDG-01…05, CAP-01, CAP-04, CAP-05, PRV-01…03, PRV-05, PRV-06, PRF-01, PRF-04 | 5 |
| 3 — Report Composer & Annotation Editor (lazy) | An end user composes a complete bug report or feedback — attach/capture, annotate, irreversibly mask, review — with a lazy editor in en/es | CAP-02, CAP-03, ANN-01…06, PRV-04, PRV-07, WDG-06, PRF-02, PRF-03 | 5 |
| 4 — Report Payload & Enrichment | Every report carries bounded console logs, environment metadata and host context, with bug/feedback semantics and identity privacy enforced | ENR-01…05, INT-03, INT-04 | 5 |
| 5 — Secure Admin Access & Projects | A developer securely accesses their self-hosted panel and manages projects and public keys, with every panel API route locked down | TRI-01…03, PRJ-01…05, DEP-03 | 5 |
| 6 — Triage & Data Lifecycle | A developer triages reports end to end and the deployment honours its retention promises (TTL purges, erasure reaching blobs) | TRI-04…10, RET-01…03 | 5 |
| 7 — Resilience & Release Closeout | Reports survive unload and flaky networks exactly once, and the release gate is proven on a clean `docker-compose up` | ING-02, PRF-05, DEP-04 | 4 |

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Contracts & Ingest Slice** - Monorepo, official schema + constant set, 3-service compose, and a hardened ingest endpoint that stores a synthetic report and renders it in a minimal panel
- [ ] **Phase 2: SDK Tracer Bullet: Widget, Capture & Auto-Redaction** - One script tag, isolated widget, tab capture with destructive auto-redaction (T1), first real report in the panel
- [ ] **Phase 3: Report Composer & Annotation Editor (lazy)** - Report form, capture fallback chain, pen/arrow/rect/text/mask editor with irreversible masking (T2/T3), review-before-send, en/es
- [ ] **Phase 4: Report Payload & Enrichment** - Console ring buffer, env metadata, host context and identity privacy completing the RF-01/RF-02 payload
- [ ] **Phase 5: Secure Admin Access & Projects** - Single-admin JWT auth, 401 enforcement, project CRUD + key rotation, authenticated blob serving
- [ ] **Phase 6: Triage & Data Lifecycle** - List/filter/inspect/state transitions/comments/delete/erase plus TTL purge jobs with `purge_runs`
- [ ] **Phase 7: Resilience & Release Closeout** - Idempotent durability queue across unload, Lighthouse budget proof, backup/restore, full CA-01…CA-05 release gate

## Phase Details

### Phase 1: Contracts & Ingest Slice
**Goal:** A developer can start the self-hosted stack and push a report (image + metadata) across the wire into hardened, schema-validated storage that renders in a minimal panel — the contract, the constant set and the size gate exist from day one.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** DEP-01, DEP-02, ENR-06, ING-01, ING-03, ING-04, ING-05, ING-06, ING-07, ING-08
**Success Criteria** (what must be TRUE):
  1. A developer can start API, panel and database with one `docker-compose up` and configure every server setting from the committed `.env.example` without editing code.
  2. A developer can send a synthetic report with a screenshot over HTTP and see it land as a database row with its image on the filesystem volume under a server-generated key, listed in a minimal panel page.
  3. Every report that lands validates against the single published `schema/report.schema.json`, and a retried submission with the same idempotency key creates exactly one report.
  4. A hostile submission cannot get stored: missing/invalid project keys, oversized bodies and images, SVG/polyglot files and traversal-style names are rejected with structured 401/413/429/400 responses, and user text is stored sanitised and renders inert.
  5. The ingest endpoint throttles per project key and per IP (with a daily per-project quota, 429 + `Retry-After`) and accepts reports only from allowlisted origins.
**Plans:** TBD (3–5 plans)
**UI hint**: yes
**Rationale / Risks:** This merges the research "contracts & skeleton" and "ingest slice" rows deliberately: a contracts-only phase would be a horizontal layer, while the synthetic tracer (fixture upload → row → image in the browser) is the smallest *end-to-end* proof that TB-1→TB-2→TB-5 holds. **C-3/C-4 land here, at first ingest** — webp/png magic-byte allowlist with SVG rejected unconditionally (SVG is an active text format = image-borne XSS), re-encode on ingest where feasible to kill polyglots/EXIF, `nosniff` + `Content-Disposition: attachment` + `CSP: default-src 'none'; sandbox` on blobs, and path-traversal-proof `Storage` from the first line: server-generated UUIDv4 keys at `projectId/<xx>/<uuid>.<ext>`, tmp→fsync→rename writes, DB-lookup-only key resolution (the request never names a file), volume mounted **only** in `api` with a CI compose assertion. **H-7:** layered caps in the reconciled A-06 constant set (5 MB body, 4 MB part, 64 KB meta, `Content-Length` pre-read plus streaming counter, decode-bomb header guard) — the schema constants live in `packages/contracts` so client clamps stay UX-only. **A-12/M-2:** `check:size` ships in Phase 1 with an explicit **multi-artifact scenario** (core + lazy editor + optional-adapter lanes) so the 45+25+14 = 84 KB > 80 KB worst case is visible from day one. **M-1/A-02:** TTL columns (identity + artifacts) exist in the initial Drizzle migration — retrofits are migrations = consultation triggers. ENR-06 delivers schema *validation*; CA-01's console-conditional clause completes in Phase 4 with ENR-01/02. DEP-03's "served only through the **authenticated** API" completes in Phase 5 once auth exists — this phase ships the hardened blob route but makes no auth claim. ⚠ UNVERIFIED: `@fastify/multipart` ↔ Fastify 5 mapping — smoke-test here; base64-in-JSON fallback is a contract change = consultation trigger.

### Phase 2: SDK Tracer Bullet: Widget, Capture & Auto-Redaction
**Goal:** An end user can open the Watchbug widget on any host page, capture the current tab with sensitive data destructively masked before anything leaves the browser, and file a report that renders in the panel — the first real vertical slice.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** INT-01, INT-02, INT-05, WDG-01, WDG-02, WDG-03, WDG-04, WDG-05, CAP-01, CAP-04, CAP-05, PRV-01, PRV-02, PRV-03, PRV-05, PRV-06, PRF-01, PRF-04
**Success Criteria** (what must be TRUE):
  1. A developer adds Watchbug with one async script tag — no build step — or imports it as an ES module, calls `Watchbug.init({ projectKey, ... })`, and their end user gets a working floating widget.
  2. An end user can open the widget from its floating launcher even when the host page ships hostile global CSS; the widget renders above all host content and leaks no styles, classes, variables or globals into the page (exactly one global, no prototype patching).
  3. An end user can capture the current tab via the browser capture prompt; the capture never contains the widget itself and is downscaled to fit ≤ 16 MP and ≤ 2 MB without going blank on HiDPI displays.
  4. Password fields, credential/token/payment-card patterns and `data-watchbug-sensitive` elements are already flat-filled in the capture the end user sees and in every encoded byte that leaves the browser.
  5. The outgoing report contains no host cookies, storage or auth headers and only a path-only URL, and the injected script stays ≤ 45 KB gzipped with zero runtime npm dependencies.
**Plans:** TBD (3–5 plans)
**UI hint**: yes
**Rationale / Risks:** **⚠ Architecture-loaded decision #1 — `WidgetHost` isolation must be right at first build** (H-2/H-3; a retrofit is a rewrite of every style): inline `!important` on the host element (outranks document `!important`), host appended as the last child of `document.documentElement`, `:host { all: initial }` first then explicit re-declaration of every needed property, px-only units (zero `rem`), no `part`/`::theme`, `--wb-` custom properties declared locally, `<style>` inside the shadow root (not `adoptedStyleSheets`), and the `SHADOW_MODE=open` e2e build with a module-scoped root registry so Playwright can pierce closed roots (R-14). **⚠ Architecture-loaded decision #2 — redaction ordering starts here (T1):** auto-redact runs destructively on `ImageData` at capture, *before the editor ever displays the image*; T2/T3 complete in Phase 3. Per A-05, `CaptureSource.capture()` returns raw `ImageData`, never a Blob — a Blob-returning port would let unmasked encoded bytes exist before `Redactor` runs (structural SEC-02). R-13/A-01: **flat opaque fill (α=255) is the only automatic primitive** — no blur, no CSS overlays, no semi-transparent fills (C-1). H-1: mask geometry lives in bitmap/device-pixel space from the very first mask (HiDPI misregistration leaks edge characters). Transport is lane 1 only: plain `fetch` with idempotency-keyed bounded retry — **never** `keepalive`/`sendBeacon` for image-bearing reports (H-9, 64 KiB spec cap); the IndexedDB durability lane lands in Phase 7 (ING-02). M-3: detect the silent WebP→PNG fallback by sniffing `blob.type`. H-4/H-5: capture-degradation UX (manual attach, text-only filing, visible failure state) ships with the composer in Phase 3 — until then capture errors must surface loudly, never as a silently blank image (M-6). C-5 groundwork: the payload is a closed schema and the `document.cookie|localStorage|sessionStorage|Authorization|Bearer |credentials:` grep gate lands in `packages/sdk` now. PRF-01/PRF-04 enforce 45 KB / zero-deps at the gate; PRF-03's total-budget proof waits for the editor chunk (Phase 3). Research flag: the hostile-CSS belt-and-braces set needs one spike against a real fixture in this phase.

### Phase 3: Report Composer & Annotation Editor (lazy)
**Goal:** An end user can compose a complete bug report or plain feedback — capture or attach an image, annotate it, destructively mask anything sensitive, review it, and file it — with the editor fetched on gesture and the whole widget UI in English or Spanish.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** CAP-02, CAP-03, ANN-01, ANN-02, ANN-03, ANN-04, ANN-05, ANN-06, PRV-04, PRV-07, WDG-06, PRF-02, PRF-03
**Success Criteria** (what must be TRUE):
  1. An end user whose capture fails or is unavailable (iOS included) sees a clear failure state — "screenshot unavailable — send anyway?" — can file text-only feedback, and a blank capture is never sent silently.
  2. An end user can attach an image from their device instead of capturing.
  3. An end user can draw freehand, arrows and rectangles and add text labels on the capture.
  4. An end user can mask a region with an opaque fill that is destroyed at the pixel level and is unrecoverable from the encoded image — undecipherable even by later annotation strokes — while undo removes annotation strokes only (masks are deliberately irreversible).
  5. An end user reviews and edits the capture before sending and uses the whole widget form and editor in English or Spanish (auto-matched to browser language, manual override), while the lazy editor chunk stays ≤ 25 KB gzipped and the total runtime payload ≤ 80 KB.
**Plans:** TBD (3–5 plans)
**UI hint**: yes
**Rationale / Risks:** **⚠ C-2 — the `Annotator` port contract is fixed here and is non-negotiable:** exactly **one flattened working bitmap**; no undo stack over pre-mask state (each undo entry *is* an unmasked copy), no layer-stack export, no offscreen base layer; masks are baked **destructively at stroke completion (T2)** and are **not undoable** (explicit confirm modal — any future mask-undo is a §3-adjacent privacy decision requiring a Consultation Request Pack); annotations are vector ink flattened onto the already-masked bitmap; and there is a **single `toBlob` sink** (`encodeFinal()` — grep gate: `toBlob|toDataURL|convertToBlob` appears exactly once in the SDK). **T3 export order is an invariant:** flatten ink → **re-bake all masks as the LAST pixel operation** → re-run auto rules (T1) → fresh `toBlob`. An annotation stroke must physically be incapable of leaking masked pixels. The CA-02 e2e lands here: intercept the outgoing request, decode the image, assert the masked region's original pixel values are absent **including at region boundaries**. H-1: mask/stroke geometry in bitmap space, tested at DPR 1/1.25/2/3 and non-integer zoom. **H-4/H-5 (mandatory, per A-05):** the capture chain is `DisplayMediaCapture` → `ManualFileCapture` (both ship in v1; DOM-serialization stays v2 per A-08); the file-attach path is designed here, not bolted on, and capture-less degradation with a user-visible failure state is required (iOS has no `getDisplayMedia`; Safari's 16,777,216-px canvas cap silently blanks captures). R-13/A-01 user masking: flat opaque fill is the default; block pixelation is opt-in only at block ≥ `max(8 px, 2× cap-height)`, grid-snapped outward, α=255, with a fresh lossy re-encode after destruction. i18n dictionaries live in the lazy chunk (never in core). A-12/M-2: with core + editor the v1 worst case is ≤ 70 KB — `check:size` proves PRF-02/PRF-03 against the real emitted chunks. Research flags: spike mask-undo UX and HiDPI coordinate behaviour here.

### Phase 4: Report Payload & Enrichment
**Goal:** Every report carries the evidence a developer needs to reproduce the bug — bounded console logs, environment metadata and host-supplied context — with bug/feedback semantics and identity privacy enforced end to end.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** ENR-01, ENR-02, ENR-03, ENR-04, ENR-05, INT-03, INT-04
**Success Criteria** (what must be TRUE):
  1. A bug report always reaches the backend with console logs attached, and a feedback report can be filed without them (CA-01's conditional clause green).
  2. Every report carries URL path, user agent, viewport, display resolution, devicePixelRatio, language, timezone and timestamp.
  3. Console capture stays bounded — drop-oldest ring buffer, per-message/per-arg and total byte caps, "N earlier messages dropped" surfaced — and never recurs on the SDK's own logging.
  4. Host-supplied `user`, `appVersion` and `custom` init context ride on every report.
  5. With `privacy: { userIdentity: false }`, no end-user identity leaves the browser.
**Plans:** TBD (3–5 plans)
**Rationale / Risks:** **C-5 is the critical pitfall here:** console logs and serialized errors are a secrets exfiltration channel (tokens in messages, `Request` headers dragged along by serialized errors). Controls, all mandatory: a **closed payload schema** (no free-form bag), a secret scrubber at push time (JWT-shape, `Bearer`, `key=`, Luhn-shaped card runs), eager serialization at capture time (drop object references), never send `document.referrer` (origin at most), and the CI grep gate (`document.cookie|localStorage|sessionStorage|Authorization|Bearer |credentials:` in `packages/sdk`) — SEC-03 by payload, not just by header. **H-6:** re-entrancy guard on the patched `console` (recursion freezes tabs) + bounded drop-oldest ring buffer + `droppedCount`. The A-06 binding constant set is authoritative: 100 entries, 2,048/1,024 chars, 8,192-char stack field, 48 KB total console buffer (chosen so a metadata-only flush stays ≤ 60 KB). R-09 is *bound*: identity only rides when the host supplies `user` (SEC-03 forbids the SDK from discovering it) and `privacy.userIdentity !== false` (INT-04). Note the scope seam: INT-03's `custom` is **init-scoped context riding every report** (v1) and is distinct from ANN-V2-03's per-report custom report fields (v2). ENR-01/ENR-02 complete CA-01 whose schema landed in Phase 1.

### Phase 5: Secure Admin Access & Projects
**Goal:** A developer can securely log into their self-hosted panel, manage projects and their public write-only keys (including rotation), and view stored screenshots — with every panel API route locked to the authenticated admin.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** TRI-01, TRI-02, TRI-03, PRJ-01, PRJ-02, PRJ-03, PRJ-04, PRJ-05, DEP-03
**Success Criteria** (what must be TRUE):
  1. An admin can log in with credentials from `.env` and get a JWT session cookie, and log out so the session is invalidated.
  2. Every panel API route returns 401 Unauthorized to missing or invalid credentials (CA-05 green).
  3. An admin can create a project and obtain its public write-only key, rename it, delete it together with its reports, and select the active project.
  4. An admin can rotate a project's public key under explicit, decided semantics (see Q-07 below).
  5. An admin views stored screenshots only through the authenticated API — blobs are never exposed as static files and every fetch is path-safe.
**Plans:** TBD (3–5 plans)
**UI hint**: yes
**Rationale / Risks:** **⚠ Decision that MUST be resolved at `/gsd-plan-phase 5`, not improvised during execution — Q-07 (key rotation, PRJ-04 is v1):** a `public_key` is embedded in already-shipped host script initialisations, so rotation must choose deliberately between a **grace period** (old key keeps accepting writes for a bounded window) and **instant cut-off** (reports from un-redeployed hosts start failing immediately). This is security- and ops-sensitive: the plan must state the chosen semantics, the panel affordance (e.g. old-key countdown), and the migration story for host pages. SEC-06/M-4: single admin from `.env` (R-05), Argon2id (`@node-rs/argon2`), JWT TTL ≤ 8 h in a `__Host-` / `HttpOnly` / `Secure` / `SameSite=Lax` cookie, **all mutations POST/PATCH/DELETE** (no state-changing GET), `Origin` verification on cookie-authenticated mutations, and a documented TLS story (plain-HTTP demos silently drop `Secure` cookies — a loudly-warned dev flag is required). **A-10:** `apps/panel`'s nginx **must reverse-proxy `/api` → `api`** so panel and API are same-origin — without it `SameSite=Lax` cookie auth is broken by design; still exactly three compose services (INV-03 holds). **DEP-03 completes here (C-4 pass 2):** DB-lookup-only blob resolution, `^[a-z0-9]{2}\/[a-f0-9-]{36}\.(webp|png)$` key shape + `path.resolve` prefix assertion, unknown key → 404, `nosniff` + `CSP: default-src 'none'; sandbox` + `CORP: same-origin` + `Content-Disposition: attachment`, volume mounted only in `api` (CI compose assertion). PRJ-05's project delete must cascade to reports **and their blobs**. Research confirms the reserved `AuthProvider` (static bearer) and `Storage` (S3/MinIO) adapters remain seams only — never built in v1.

### Phase 6: Triage & Data Lifecycle
**Goal:** A developer can triage reports end to end — find, inspect and state-manage them — and the deployment honours its retention promises: TTL purges and erasure reach the artifacts, not just the identity fields.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** TRI-04, TRI-05, TRI-06, TRI-07, TRI-08, TRI-09, TRI-10, RET-01, RET-02, RET-03
**Success Criteria** (what must be TRUE):
  1. An admin can list reports filtered by type, status and project and see counts per status, type and project on the triage screen.
  2. An admin can open a report and see its screenshot, console logs and collected metadata, with hostile user text rendered inert.
  3. An admin can move a report through Pending / In Progress / Resolved, reopen it, and keep internal comments on it.
  4. An admin can delete a report or erase its end-user identity immediately, with erasure reaching the stored screenshot on disk.
  5. Identity fields purge automatically after N days (default 30) and whole reports — screenshot, console logs, metadata — after M days (default 90), both `.env`-configurable and evidenced in `purge_runs`.
**Plans:** TBD (3–5 plans)
**UI hint**: yes
**Rationale / Risks:** **C-3 pass 2 — output encoding is the primary XSS control** now that panel views render every user string (title, note, console messages, URL, user fields): React text nodes, **zero `dangerouslySetInnerHTML`** anywhere in `apps/panel`, with the hostile fixtures (`"><img src=x onerror=…>`, `javascript:`, BOM'd strings, polyglot GIF) asserted in the one Playwright suite. **M-1/A-02 (RET-01/02) — retention covers artifacts, not just identity:** the screenshot and console logs are themselves personal data, so purging `user.*` does not anonymise a report; identity TTL 30 d, full incident TTL 90 d (A-07), `.env`-configurable (RET-03), the purge is an evidenced job (`purge_runs`), and manual erasure/deletion (TRI-08/09) deletes `Storage` blobs too. The backup-vs-erasure story must be documented honestly (Phase 7 owns the backup procedure); integration docs carry an RGPD Art. 13 notice snippet + Art. 28 DPA template — **not legal advice; flag to the supervisor before any compliance claim**. Scope discipline: labels/assignees (TRI-V2-01), similar-report hints (TRI-V2-02), trends (TRI-V2-03), panel-configurable TTLs (TRI-V2-04) and bulk ops (TRI-V2-06) are v2 — counts and filters only (A-08). TRI-05's screenshot view reuses Phase 5's authenticated blob route.

### Phase 7: Resilience & Release Closeout
**Goal:** A report survives tab unload and flaky networks exactly once, the client provably costs the host page almost nothing, and the release gate — schema, size, isolation, irreversibility, 401s — is green on a clean machine.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements:** ING-02, PRF-05, DEP-04
**Success Criteria** (what must be TRUE):
  1. An end user who closes the tab or loses the network right after filing still has the report delivered exactly once — with a visible retrying state, never a silent drop.
  2. A developer measures a Lighthouse performance drop of ≤ 2 points when Watchbug is injected into the hostile host fixture.
  3. A developer can back up and restore the deployment by copying the data volume and dumping the database.
  4. From a clean machine, `docker-compose up` with only `.env.example` as a guide brings up three working services and the release gate is green: the one Playwright suite (CA-01…CA-05) passes on chromium, firefox and webkit and `check:size` passes every artifact against its tier — with no secret anywhere in the repository. *(Backed by the Definition of Done / Release criteria rather than a single REQ-ID — intentional.)*
**Plans:** TBD (3–5 plans)
**Rationale / Risks:** **H-9 lane 2 (ING-02) is a v1 blocker, not polish:** `keepalive`/`sendBeacon` are spec-capped at 64 KiB and can never carry a screenshot (A-03), so durability is an **IndexedDB queue** (meta + Blob, post-C-5-scrubbed and R-08-stripped bytes only) flushed on `pageshow`/visibility with the **same idempotency key**, server-deduped on `UNIQUE (project_id, idempotency_key)` with response replay, entries destroyed after success or a bounded TTL, queue capped in count and bytes, `localStorage`/`sessionStorage` never used (grep-gated). The lane must also ship an explicit fallback when IndexedDB is unavailable — an in-memory queue plus a visible retry state, never a silent drop — and must document that multi-tab flushes are deduplicated server-side by the idempotency key. The navigate-away e2e ("submit, immediately `page.goto`, assert stored **or** visibly retrying") joins the one suite. PRF-05's Lighthouse measurement runs against the hostile host fixture (CA-03). **A-12/M-2 closeout:** resolve the 45+25+14 = 84 KB > 80 KB worst-case arithmetic against **real** `check:size` numbers — v1 ships core + editor only (≤ 70 KB); the optional `DomSerializeCapture` lane is v2 (A-08) but its scenario stays in the size gate, and if real measurements breach a tier the lazy-chunk budget is revisited here (a one-line change to one tier). **C-4 closeout:** the CI compose assertion that the blob volume is mounted **only** in `api`. **R-12 release gate:** one Playwright suite ≈20 assertions mapping 1:1 to CA-01…CA-05 across chromium + firefox + **webkit** (webkit exercises the WebP→PNG fallback, firefox the no-`ImageCapture` path) plus `check:size` — **no unit tests, no coverage thresholds, ever**. M-4: document the TLS story; H-8: re-test ad-blocker/filter-list behaviour at release (lists drift) and keep neutral paths (`/api/incidents`, `/w.js`) with loud failure; Q-05 remains the release gate for going public (Apache-2.0 + `NOTICE`, repo private until the institution's IP policy is confirmed). Do **not** design against `fetchLater()` (unverified). Research flags: verify the mobile capture matrix (the iOS-absence claim is LOW-tier) and filter-list matching here.

## Coverage Validation

Requirement → phase mapping. **Every v1 requirement maps to exactly one phase.**

| Phase | Requirements mapped | Count |
|-------|--------------------|-------|
| Phase 1 | DEP-01, DEP-02, ENR-06, ING-01, ING-03, ING-04, ING-05, ING-06, ING-07, ING-08 | 10 |
| Phase 2 | INT-01, INT-02, INT-05, WDG-01, WDG-02, WDG-03, WDG-04, WDG-05, CAP-01, CAP-04, CAP-05, PRV-01, PRV-02, PRV-03, PRV-05, PRV-06, PRF-01, PRF-04 | 18 |
| Phase 3 | CAP-02, CAP-03, ANN-01, ANN-02, ANN-03, ANN-04, ANN-05, ANN-06, PRV-04, PRV-07, WDG-06, PRF-02, PRF-03 | 13 |
| Phase 4 | ENR-01, ENR-02, ENR-03, ENR-04, ENR-05, INT-03, INT-04 | 7 |
| Phase 5 | TRI-01, TRI-02, TRI-03, PRJ-01, PRJ-02, PRJ-03, PRJ-04, PRJ-05, DEP-03 | 9 |
| Phase 6 | TRI-04, TRI-05, TRI-06, TRI-07, TRI-08, TRI-09, TRI-10, RET-01, RET-02, RET-03 | 10 |
| Phase 7 | ING-02, PRF-05, DEP-04 | 3 |
| **Total** | | **70 / 70** |

- v1 requirements: **70**
- Mapped to exactly one phase: **70**
- Duplicated across phases: **0**
- Unmapped (orphans): **0**

**✓ 100% requirement coverage asserted.** v2 requirements (17) and the 13 explicit exclusions remain out of the roadmap by design; R-02's reserved ports (`Storage`→S3/MinIO, `AuthProvider`→bearer, `CaptureSource`→DOM-serialize) stay seams only — no adapter work is planned.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Contracts & Ingest Slice | 0/TBD | Not started | - |
| 2. SDK Tracer Bullet: Widget, Capture & Auto-Redaction | 0/TBD | Not started | - |
| 3. Report Composer & Annotation Editor (lazy) | 0/TBD | Not started | - |
| 4. Report Payload & Enrichment | 0/TBD | Not started | - |
| 5. Secure Admin Access & Projects | 0/TBD | Not started | - |
| 6. Triage & Data Lifecycle | 0/TBD | Not started | - |
| 7. Resilience & Release Closeout | 0/TBD | Not started | - |
