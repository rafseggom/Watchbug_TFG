# Features Research: Bug Reporting & Visual Feedback Tools

**Scope:** feature landscape of in-app bug reporting / visual feedback tools (Marker.io, Usersnap, BugHerd, Sentry User Feedback + Session Replay, Jam.dev, FullStory/LogRocket (scope reference), Instabug, Ruttl, DebugMe, BugMoo (unverified), plus self-hostable/indie: GlitchTip, Sentry self-hosted, Frill, BugPin, Ybug, Noteloop, Feedex, feedback-hub).
**Constraints honoured:** every item below is inside `mission-brief.md` §2. Anything in the non-goal list appears only under Anti-Features. All D-01…D-08 dead-ends are respected (nothing proposes `html2canvas`, `fabric.js`/`konva`, gaussian blur, DOM serialization as *primary* capture, or a Python backend).
**Every feature is phrased as a user capability.** Complexity: S / M / L. Client-bytes impact is against R-01's tiered budget (45 KB core / 25 KB lazy chunk / 80 KB total, gzipped).

## Summary

The category has a very stable core: **capture what the user sees, let them draw on it, attach console + environment context, ship it to a triage list.** Marker.io, Usersnap, BugHerd, Sentry's feedback widget, Ybug, BugPin and Instabug's web SDK all converge on the same five capabilities — automatic screenshot, a small annotation toolbar (pen, arrow, rectangle/highlight, text, hide/mask), console logs + URL/browser/OS/viewport metadata, a bug-vs-feedback distinction, and a status workflow. Anything less than that reads as a toy; anything more is where the products differentiate and where our non-goals cut.

The annotation census is striking: **Usersnap ships exactly 5 tools** (highlight, comment, pen, arrow, hide), **Sentry ships 2 + undo** (highlight, hide, remove — as of SDK v10.10.0), Marker.io names 4 (freehand, arrows, text, blur) with undo/redo, and self-hosted BugPin ships 5 (pen, shapes, arrows, text, privacy blur). The common denominator — pen, arrow, rectangle, text, mask, undo — is the table-stakes set and maps almost exactly onto RF-03. Crop appears in only one product surveyed (Jam) and step numbering in none; both are differentiators at best.

Capture is the sharpest open question (Q-06) and the field gives us clean evidence. Nobody uses raw SVG-`foreignObject` DOM serialization as their headline path — the two real options are **server-side re-rendering** (Marker.io default, Usersnap "prerender", which needs a rendering service we refuse to run and which leaks page URLs to a third party) and **native screen capture via `getDisplayMedia`** (Marker.io `useNativeScreenshot`, Usersnap `nativeScreenshot`, Jam's recorder), which is pixel-perfect and near-free in bytes but raises a browser share sheet and is unsupported on mobile web. A third path — the **browser extension** (BugHerd and Jam are extension-first) — is pixel-perfect and frictionless *after install* but contradicts RF-01's one-script-tag promise. Marker.io's own documentation of server-side-render failures (cross-origin iframes, Shadow DOM, canvas, video, maps, CSP) is almost a line-by-line restatement of our D-08 dead-end — strong independent confirmation.

Privacy posture is where Watchbug can legitimately lead. Competitors "blur" sensitive regions (Marker.io `.mk-mask`, Usersnap `usprivacy`, Instabug private views, Sentry hide tool) — blur is reversible in principle, exactly the flaw R-13 identifies. Destructive masking (solid fill / block pixelation ≥8 px) before encode is a real, cheap, evidence-backed differentiator that costs zero extra bytes. Second: every product's privacy page confirms the widget vendor is a *processor* and the integrator is the *controller* with notice duties — which validates R-09/R-10 (identity retention + purge) as the right shape.

Triage granularity: Marker.io shipped **five statuses** (Open, In Progress, Waiting for Approval, Resolved, Closed) in February 2026, on top of a long-standing three-state trio (Open / Resolved / Archived); indie tools use 3–7 states. RF-06's Pending / In Progress / Resolved is at (not below) the category norm. The table-stakes extras in rough order of prevalence: comments/notes, a reopen action, labels, assignee, then duplicate-linking. Under R-05's single-admin model an assignee field is near-pointless — that is a deliberate, defensible cut.

## Table Stakes

Missing these makes the product feel incomplete in this category. Recommendation and REQ category are in the last column.

### Capture

| Feature (user capability) | Description | Complexity | Client-bytes impact | Dependencies | Recommendation |
|---|---|---|---|---|---|
| An end user can open a floating report button on any page of the host app | One script tag; persistent launcher; survives hostile host CSS | S | ~4–6 KB core (WidgetHost + styles) | Shadow DOM isolation (R-14) | **v1 candidate** — Widget/Deployment |
| An end user can capture what they are looking at with one click and get a screenshot attached | Automatic capture at report time; no file picker, no OS screenshot dance | M (hand-rolled; D-04/D-05 forbid the easy libs) | ~8–14 KB (DOM-serialization adapter) or ~1–3 KB (`getDisplayMedia` adapter); must fit core ≤45 KB | Q-06 `CaptureSource` decision | **v1 candidate** — Capture |
| An end user can file a bug report carrying annotated screenshot, console logs and environment metadata | The Marker.io/Sentry/Instabug common shape; matches RF-01/RF-03 | M | composed of rows below | capture + annotator + enricher | **v1 candidate** — Capture |
| An end user can file plain feedback and choose not to attach console logs | Bug vs feedback distinction; Usersnap/Marker.io both gate logs by report type; RF-02/CA-01 make logs mandatory only for bugs | S | ~0.5 KB (form logic) | payload schema (contracts) | **v1 candidate** — Ingestion |
| An end user can see console errors and warnings of the current page attached to a bug report | Every developer-oriented product ships this (Marker.io, Jam, Usersnap, Ybug, BugPin, Instabug web SDK) | S–M (console ring buffer patched from init) | ~1–2 KB | must install early to hold history (affects init timing, not public API) | **v1 candidate** — Capture |
| An end user can report from a mobile browser (responsive widget and form) | Sentry hides its screenshot button on mobile; Marker.io's widget works on mobile web — the widget itself must not be desktop-only | S | ~0 KB (CSS, in core) | responsive Shadow DOM | **v1 candidate** — Widget |

### Annotation (RF-03)

Census: the median product ships 5 tools. Pen, arrow, rectangle/highlight, text and a hide/mask tool are the set shipped by Usersnap (5), Marker.io (4 + undo/redo), BugPin (5), Toado (6), Ybug (4); Sentry ships only highlight + hide. **Crop: 1 of 8 surveyed (Jam). Step numbering: 0 of 8.** All editor work is the lazy chunk (R-01: 10–16 KB target, ≤25 KB hard).

| Feature (user capability) | Description | Complexity | Client-bytes impact | Dependencies | Recommendation |
|---|---|---|---|---|---|
| An end user can draw freehand on the capture (pen) | Universal in the census | M (canvas editor core) | editor chunk, ~3–4 KB of the 10–16 KB | lazy `Annotator` chunk | **v1 candidate** — Annotation |
| An end user can drop an arrow to point at the problem | Universal; the single most-used tool (point-at-it workflows) | S | ~1 KB | editor chunk | **v1 candidate** — Annotation |
| An end user can draw a rectangle / highlight box around an area | Ships in Usersnap, BugPin, Toado, Ybug; Sentry's "highlight" is this | S | ~1 KB | editor chunk | **v1 candidate** — Annotation |
| An end user can type a text label on the capture | Marker.io, BugPin, Toado, Ybug; RF-03 names text explicitly | M (text input on canvas) | ~2 KB | editor chunk | **v1 candidate** — Annotation |
| An end user can mask/hide a region so its content is unreadable | Ships everywhere as "hide"/"blur"/"redact"; ours must be destructive (R-13: solid fill or block pixelation ≥8 px — competitors' blur would fail SEC-02) | M (ImageData mutation before encode — CA-02) | ~1–2 KB (reuses capture ImageData path) | masking primitive (R-13), encode after mutate (SEC-02) | **v1 candidate** — Annotation/Privacy |
| An end user can undo or remove the last annotation while editing | Marker.io (undo/redo), Sentry (remove), Usersnap (per-item delete) — mistake recovery is table stakes | S | ~0.5 KB | editor chunk | **v1 candidate** — Annotation |
| An end user can crop the capture to the relevant region | Only Jam among 8 surveyed (and Jam pairs crop with a full-page context image) | M | ~1 KB | editor chunk | **v2 candidate** — Annotation (not table stakes; defer) |
| An end user can number steps on the capture | **Not found in any product surveyed.** Appears in offline tools (Figma/markup apps), not this category | M | ~1 KB | editor chunk | **v2 candidate** at most — Annotation (do not treat as table stakes) |

### Privacy (SEC-01/02, RF-04, R-08…R-10)

| Feature (user capability) | Description | Complexity | Client-bytes impact | Dependencies | Recommendation |
|---|---|---|---|---|---|
| An end user's password fields, credential/token/card-shaped values never appear in a capture | Auto-redaction; parity with Marker.io's masking classes and Instabug's private views | S–M (rule pipeline in `Redactor`) | ~1–2 KB | `Redactor` port | **v1 candidate** — Privacy |
| A developer can mark any element `data-watchbug-sensitive` and it never appears in a capture | Direct parity with Marker.io `.mk-mask`/`.mkr-exclude`/`data-marker-nocapture` and Usersnap `usprivacy`; RF-04 names it | S | ~0.5 KB | `Redactor` port | **v1 candidate** — Privacy |
| A developer's reports carry no host cookies, tokens or auth headers ever | SEC-03; every vendor privacy page draws the same line ("only what the reporter submits") | S (by construction — forbid the reads) | 0 | transport discipline | **v1 candidate** — Privacy |
| A developer can strip query strings and fragments from reported URLs | R-08; competitors collect the full URL and rely on masking — stripping is stronger and free | S | ~0.2 KB | payload schema | **v1 candidate** — Privacy |
| A developer can opt out of end-user identity or rely on automatic identity purge after N days | R-09/R-10; Marker.io's model (controller/processor split + retention) confirms this shape is what GDPR-aware integrators expect | M (server-side purge job + admin erase) | 0 (panel/API) | schema `user` + `privacy` flags | **v1 candidate** — Privacy |

### Metadata & Ingestion

The universal metadata set (Marker.io, Usersnap, Jam, Ybug, BugPin, Instabug web SDK, Sentry): **page URL, browser + version, OS, viewport/screen size, timestamp, console logs**. Nearly universal: failed network requests. Jam adds country and network speed. BugHerd adds the pinned element's identity. Nothing surveyed derives the end user's identity silently — name/email are either typed by the reporter (Marker.io, Sentry) or host-supplied.

| Feature (user capability) | Description | Complexity | Client-bytes impact | Dependencies | Recommendation |
|---|---|---|---|---|---|
| A developer receives every report with URL (path), browser, OS, viewport and timestamp | The non-negotiable metadata block of the category | S (`Enricher` default providers) | ~1 KB | `Enricher` port | **v1 candidate** — Ingestion |
| An end user can give a title/description and the report is typed as bug or feedback | Marker.io issue types (Bug/Improvement/custom), Usersnap templates, Voicebox ISSUE/IDEA/PRAISE; RF-02/CA-01 assume the split | S | ~0.5 KB | contracts schema | **v1 candidate** — Ingestion |
| A developer receives the report even if the user closes the tab immediately after sending | `fetch` + `keepalive` (Transport default); BugPin advertises an offline queue as a differentiator — plain keepalive is the table-stakes floor | S | ~0.2 KB | `Transport` port | **v1 candidate** — Ingestion |
| A developer can pass their own metadata (app version, plan, tenant) into `Watchbug.init()` and it rides on every report | Marker.io custom metadata, `jam.metadata()`, Instabug custom attributes — expected by integrators | S | ~0.3 KB | `Enricher` port (host rules), public init interface (restricted-decision trigger if it changes) | **v1 candidate** — Ingestion |
| (Server-side) The API caps console-log volume so a hostile page cannot flood storage | Q-02 is open; real-world caps exist: feedback-hub ships **50 entries, 2 KB/message, 8 KB/stack, 100 KB payload, 10 MB image**; Feedex rate-limits 20/min per IP and 240/min per project — adopt equivalent numbers | S | 0 (API + tiny client clamp) | SEC-05 rate limiting | **v1 candidate** — Ingestion (answers Q-02 with market-tested values) |

### Triage (RF-06, panel)

| Feature (user capability) | Description | Complexity | Client-bytes impact | Dependencies | Recommendation |
|---|---|---|---|---|---|
| A developer can log into the panel with the single admin account and a session that expires | SEC-06 shape (Argon2id + JWT in HttpOnly cookie); universal expectation | M (server) | 0 (panel not size-constrained) | R-05 | **v1 candidate** — Triage |
| A developer can list reports and filter by type (bug/feedback) and status | RF-06 verbatim; Sentry's feedback list and every competitor's inbox do exactly this | M (panel) | 0 | schema indexes | **v1 candidate** — Triage |
| A developer can move a report between Pending, In Progress and Resolved — and reopen it | RF-06's three states match the category floor (Marker.io's canonical trio is Open/Resolved/Archived; its In Progress arrived only in 2026). **Reopen** is universal (Marker.io, Sentry) and costs almost nothing | S (panel) | 0 | none | **v1 candidate** — Triage (keep 3 states; add reopen — see Triage section) |
| A developer can open a report and inspect its screenshot, console logs and all captured metadata | RF-06; the "developer-ready report" is the category's core promise | S–M (panel) | 0 | attachment serving behind auth (R-04) | **v1 candidate** — Triage |
| A developer can delete a report or erase its identity fields immediately | R-10's manual half; Marker.io and Sentry both expose deletion as the GDPR backstop | S (panel + API) | 0 | retention job | **v1 candidate** — Triage/Privacy |
| A developer can filter and sort the report list by date, type and status | Sorting/filtering is table stakes (GlitchTip, Noteloop, all inboxes) | S | 0 | list endpoint | **v1 candidate** — Triage |

### Projects, Deployment, i18n

| Feature (user capability) | Description | Complexity | Client-bytes impact | Dependencies | Recommendation |
|---|---|---|---|---|---|
| A developer can hold several projects in one install, each with its own public write-only key | R-06 minimal; **confirmed table stakes**: Sentry DSN-per-project, GlitchTip unlimited projects even free, BugHerd "unlimited projects", and every indie API (Feedex `pk_`, Noteloop `ntl_`, Voicebox `pk_`) is project-scoped | M | ~0.2 KB (key in snippet) | projects table | **v1 candidate** — Projects |
| A developer can self-host everything with one `docker-compose up`, three services | INV-03; GlitchTip/BugPin prove the expectation ("run on your own server") | S | 0 | R-04 filesystem `Storage` | **v1 candidate** — Deployment |
| An end user and a developer can use widget and panel in English or Spanish | RNF-03; BugPin ships 8 languages and advertises it — i18n is visible marketing in this category | M (2 locale bundles + formatters) | ~2–4 KB (locale data, can be lazy) | i18n plumbing | **v1 candidate** — i18n |
| A developer can copy one snippet with their project key and be live in minutes | The category's universal onboarding (all widget vendors); snippet = script tag + public key | S | 0 | project key | **v1 candidate** — Projects/Deployment |

## Differentiators

Valued but not expected. Ordered by value-per-byte (client-side items first — these are the cheap steals).

| Feature (user capability) | Description | Complexity | Client-bytes impact | Dependencies | Recommendation |
|---|---|---|---|---|---|
| An end user can open the report widget with a keyboard shortcut (and a developer can disable it) | Marker.io ships `keyboardShortcuts: false` config; trivial to add, feels pro | S | ~0.3 KB | public init config (restricted item — keep flag name stable) | **v1 candidate** — Widget (cheapest differentiator in the set) |
| An end user can mask with **solid fill or block pixelation** that is provably irreversible | Competitors all "blur" (Marker.io, Usersnap, Sentry, Toado, BugPin) — reversible in principle. R-13's destructive masking is *better than the category* at zero extra cost, and CA-02 already proves it e2e | S (already required by R-13) | 0 | — | **v1 candidate** — Privacy (positioning gold: "masking that actually destroys the data") |
| A developer's widget reports survive being offline and sync when the connection returns | BugPin advertises "offline-safe" as a headline feature; implementation is a small IndexedDB/localStorage queue through the `Transport` port | M | ~1–1.5 KB | `Transport` port | **v2 candidate** — Ingestion (nice, not expected; first thing to defer) |
| An end user can capture a full-page screenshot in addition to the viewport | Marker.io extension ("capture entire page"), BugPin ("full-page or visible area"), Jam (crop + full-page context). Requires scroll-stitching; failure-prone on infinite-scroll SPAs | L | ~2–4 KB | `CaptureSource` adapter | **v2 candidate** — Capture (the DOM-serialization adapter can grow into this later) |
| A developer can see a failed network request log (4xx/5xx XHR/fetch) with each bug report | Marker.io network logs, Jam "fully inspectable network requests", Ybug "failed network requests", BugPin "failed network requests (4xx/5xx)". Privacy surface grows (URLs carry tokens — cf. R-08) so it needs the same path-only treatment | M | ~2–3 KB | `Enricher` rules + payload schema change (restricted decision!) | **v2 candidate** — Capture/Ingestion (and only with URL-stripping on by default) |
| An end user can see which reports already exist on the current page before filing (duplicate prevention) | BugHerd reviewers "avoid duplicate feedback by viewing feedback left by others"; Marker.io has this planned ("pins on website"). Needs a public read endpoint — a real tension with CA-05's authenticated-API posture | M–L | ~2 KB + server read API | public read API design (security review) | **v2 candidate** — Triage (security-sensitive; not v1) |
| A developer gets a "similar reports" hint when triaging (word-overlap duplicates) | Noteloop ships `/similar` with a word-overlap heuristic — no AI involved, so it stays inside §2's non-goals (it is not "error analysis") | S (server-only) | 0 | list endpoint | **v2 candidate** — Triage (cheap; the no-AI duplicate-linker the category only partly has) |
| An end user can attach a note/comment thread to a report and a developer can keep internal-only notes | Comments are the most common triage extra (Marker.io two-way comments, Usersnap replies, Noteloop `internal` flag, Ybug internal comments). With single-admin (R-05) this degenerates to "notes to self" | M | 0 (panel) | schema | **v2 candidate** — Triage (valuable only once multi-user exists, which is out of scope) |
| A developer can label reports free-form and filter by label | Labels are standard (Usersnap, GlitchTip tags, Noteloop tags) but the third tier of triage extras | S–M | 0 (panel) | schema | **v2 candidate** — Triage |
| A developer can see per-project counts and a simple trend (reports per day, bug vs feedback split, top browsers) | Marker.io and Usersnap sell analytics ("50% faster resolution", "statistics & trends"); Sentry/GlitchTip have full dashboards. Not table stakes — several competitors work fine without it. One SQL query + a sparkline gets 80% of the value | S–M | 0 (panel) | list endpoint | **v2 candidate** — Triage (nice demo for the TFG committee; do not let it bloat v1) |
| A developer can capture the element's CSS selector and computed styles with a click-based report | OverlayQA sells exactly this (DOM selector + computed style values); BugHerd pins to "the exact element". Very valuable for CSS bugs; not expected category-wide | M | ~2–4 KB | capture path | **v2 candidate** — Capture |
| A developer can rotate a project's public key from the panel | Q-04 already parks this as v2; indie APIs all support regeneration ("rotate from the dashboard" — Feedex) | S | 0 (panel) | R-06 schema | **v2 candidate** — Projects (confirms Q-04's leaning) |

## Anti-Features (deliberately NOT building)

| Feature | Reason | Which non-goal it falls under |
|---|---|---|
| Third-party integrations (Jira, GitHub Issues, Slack, Trello, ClickUp, Linear, Asana…) | The whole Marker.io/BugHerd/Ybug pitch is "lands in your tracker". Building adapters would dwarf the product and pull in OAuth flows. R-02 reserves the seams only — the seam is free, the work is out of scope | `mission-brief.md` §2: "Integraciones con plataformas de terceros" |
| Video recording / session replay (LogRocket/FullStory style, Jam recordings, Usersnap 3-min screen recording, BugHerd 1-min video, rrweb DOM replay as in BugMojo) | Would blow RNF-01's 45 KB alone and adds a media-consent + storage problem. Its absence is *the* reason Watchbug stays light; our answer to "what happened before the bug" is console logs + metadata | §2: "Grabación de vídeo o reconstrucción de sesión" |
| AI error analysis (JamGPT, BugHerd auto-tagging/auto-title, Usersnap AI labels & suggested replies, Frill AI drafting, Webvizio AI prompts, BugMojo AI repro summaries) | Explicitly excluded. Note: a plain word-overlap duplicate hint is a heuristic, not AI analysis — that one sits under Differentiators | §2: "Motor de análisis de errores por Inteligencia Artificial" |
| Gamification or automatic bug-fix suggestions (BugMojo "assign to an AI agent", "regression suites that learn", auto-fix PRs) | Explicitly excluded | §2: "Gamificación o sugerencias automáticas de resolución de bugs" |
| Managed multi-tenant SaaS, subscriptions, payment gates, per-seat plans (Marker.io/BugHerd/Usersnap plan tiers) | Explicitly excluded. R-06's multi-project self-hosted install is *not* this — the exclusion is on the hosting model | §2: "Servicios de suscripción, pasarelas de pago o multi-tenancy SaaS gestionado por nosotros" |
| OAuth2 / SSO with third parties (Google/GitHub login, SAML/Okta/Entra as in Frill and Sentry) | Explicitly excluded, and it drags in the account lifecycle that R-05 rejects | §2: "Integración OAuth2 con proveedores de terceros" |
| Multi-user panel accounts, roles, organisations, reporter logins (Marker.io member/guest roles, BugHerd "unlimited reviewers", Ruttl guest accounts) | A whole AUTH family (signup, verification, password reset, SMTP) exists only to serve it. Assignee fields and comment threads also lose their meaning here — both are deferred, not designed around | Out-of-scope list (R-05 single-admin by design) |
| Reporter-facing email notifications (Marker.io "issue received/issue resolved" emails, Sentry alerts to reporters, Frill auto status-update emails) | Requires an SMTP service (a 4th container, breaking INV-03's three-service promise) plus reporter identity storage at scale. v1 informs the developer in-panel only; if ever built, it goes behind an `Enricher`-style seam, not into core | Derived from §2 SaaS/engagement machinery + INV-03 (Deployment invariant) |
| Feature-request voting boards, public roadmaps, changelogs, NPS/CSAT surveys (Frill, Usersnap ratings/surveys) | A different product category (feedback *prioritisation*, not bug *capture*). Scope is cut by coherence (R-17) — this is not the coherent thing | Derived: §2 (SaaS engagement features) + scope coherence |
| Requiring end users to install a browser extension (BugHerd and Jam's primary model) | Pixel-perfect capture is not worth breaking RF-01's "one script tag for your users". An optional *developer-side* tool is a different matter, but no end-user install may ever be required | RF-01 (one script tag; a hard requirement, not a preference) |
| Native mobile SDKs (Marker.io mobile SDK, Instabug mobile core) | The widget is a browser artifact | Out-of-scope list: "Mobile app / non-web SDKs" |
| Unit-test suites / coverage thresholds as a feature of the delivery | Owner policy R-12: e2e + property assertions only | Out-of-scope list: "Unit-test suites" (R-12) |

## Capture Approaches in the Wild

**This is the evidence base for Q-06 (default `CaptureSource` adapter).**

| Approach | Who uses it | How it works | Failure modes (documented by vendors) | Bytes |
|---|---|---|---|---|
| **Server-side re-rendering** | Marker.io *default*; Usersnap "prerender" | The page URL is sent to the vendor's renderer, which re-renders and screenshots it | Marker.io's own help lists: cross-origin iframes, Shadow DOM elements, canvas/WebGL (needs `preserveDrawingBuffer`), `<video>`, maps, CSP-restricted pages, auth-walled content. Usersnap adds "advanced screen rendering options for protected sites" as a workaround product | ~0 KB client |
| **Native screen capture (`getDisplayMedia`)** | Marker.io `useNativeScreenshot: true`; Usersnap `nativeScreenshot: true` ("media-record-API"); Jam's tab/desktop recorder | Browser's screen-capture API grabs the real rendered pixels | Marker.io docs: "you'll need to manually choose the screen or browser tab each time"; not supported on mobile browsers; secure context only. Marker.io's own bug board reports intermittent **gray WebGL regions** from `getDisplayMedia` first frames | ~1–3 KB |
| **Browser extension** | BugHerd (primary and essentially only path), Jam (only path), Marker.io & Usersnap (optional upgrade) | Extension captures locally ("pixel-perfect screenshots generated on your machine" — Marker.io) | Every reporter must install it (Marker.io: "each user must install the extension"); desktop-only | 0 KB page (extension side) |
| **DOM serialization (SVG `foreignObject`, html2canvas-style)** | Presumed Sentry feedback widget internals — **not verified from docs read**; explicitly *not* anyone's headline path | Clone and rasterise the DOM in-page | D-08's list and Marker.io's list agree: silent failures on cross-origin images, video, WebGL, fonts, closed shadow roots | 8–14 KB (and `html2canvas` itself is ≈50 KB — D-04) |

**Findings:**

1. **The market has quietly converged on two answers, and neither is DOM serialization.** For script-tag products the default is re-rendering (server-side) with native screen capture as the accuracy opt-in. For extension products it is local capture. Nobody leads with `foreignObject` — independent confirmation of D-08. (Confidence: MEDIUM — vendor docs agree, but Sentry's internal mechanism could not be verified.)
2. **Marker.io's failure-mode list for re-rendering is our D-08 list verbatim** (iframes, shadow DOM, canvas, video, CSP). This is the strongest external evidence in the whole research that `html-to-image` must stay an optional adapter.
3. **Server-side rendering is closed to us on privacy grounds** before size is even considered: it sends the page URL (behind login, possibly with proprietary state) to a rendering service, and INV-03 has no room for a renderer container. It also contradicts "neither the report nor its screenshot ever leaves the developer's own infrastructure" — the capture would be re-rendered on *our* server at minimum. Not a candidate for the default adapter.
4. **`getDisplayMedia` is the only pixel-perfect, extension-free, all-in-page option**, at ~1–3 KB. Its two documented costs are the share-sheet per report (Marker.io requires manual tab selection each time) and no mobile support. `preferCurrentTab: true` reduces the picker to one pre-selected click but does not remove it (not separately documented by surveyed vendors — confidence LOW). The WebGL-first-frame glitch (Marker.io's bug report) is a real edge case; a one-frame delay/mitigation should be in the adapter's backlog.
5. **Recommendation for Q-06:** default `CaptureSource` = `DisplayMediaCapture` (as R-02 already assumes) with `preferCurrentTab`, **plus a mandatory graceful fallback** — if the picker is dismissed, permission denied, or `getDisplayMedia` is unavailable (mobile web), fall back to the DOM-serialization adapter (D-08's retained optional adapter) or an explicit "report without screenshot" mode (Sentry hides its screenshot button on mobile and still accepts feedback). The fallback is not optional: on mobile web `getDisplayMedia` fails outright, and RF-01's promise is "any web app". Total budget fit: 1–3 KB primary + 8–14 KB lazy fallback adapter = comfortably inside 25 KB lazy / 80 KB total. **Flag for phase planning: the fallback's silent-failure behaviour (D-08) must be surfaced to the user ("screenshot unavailable — send anyway?"), never silently attached as a blank image.**

## Privacy / GDPR Postures Observed

**What real products collect and how they frame it** (all claims cross-checked across at least two first-party pages unless marked):

- **Identity is never derived silently.** Marker.io asks the reporter for name + email (and offers "report without asking for name & email" as a config); Sentry's widget shows name/email fields by default (`showName`/`showEmail` = true) and can pre-fill from an app-set user context; Jam collects only timestamp + country; Instabug shows a configurable disclaimer and email requirement. **R-09's model (host-supplied `user` block, sent unless `privacy.userIdentity: false`) is stricter than the category norm and is safe to keep** — the category evidence says nobody derives identity from cookies/auth headers, matching SEC-03's prohibition.
- **The controller/processor split is universal and is presented as a template for integrators.** Marker.io publishes a DPA (Art. 28 GDPR), a subprocessor list (AWS EU-Ireland hosting), a sample privacy-policy paragraph integrators can paste, and states "you are the Data Controller, Marker.io is your Data Processor". This validates PROJECT.md's plan to put the RGPD Art. 13 notice in integration docs — and suggests shipping a *sample notice paragraph* like Marker.io's is expected behaviour (cheap: docs only, R-03 places docs outside the repo — so this lands in integration docs, not code).
- **Masking/obfuscation controls are standard — but reversible.** Marker.io: `.mk-mask` (blur), `.mk-exclude`/`data-marker-nocapture` (remove from capture), client-side network filtering; Usersnap: `usprivacy` hiding of confidential areas; Instabug: "private views" blacked out *natively before the screenshot is written to disk*; Sentry: highlight + hide tools. **Every one of these blurs or overlays.** Instabug's "black out natively before the file exists" is the only one that matches R-13's irreversibility bar. Watchbug's destructive ImageData masking (solid fill / block pixelation ≥8 px, no CSS overlays, no gaussian blur) is therefore *ahead of the category*, not merely compliant — and it costs zero bytes to say so.
- **Retention and deletion are the GDPR surface.** Marker.io: delete anything, removed from backups within 90 days; session-replay temp data auto-deleted within 15 minutes if unused. GlitchTip: BAA/HIPAA posture for hosted. R-10 (identity auto-purge after N days, manual delete/erase now) matches the shape buyers ask about.
- **Data-minimisation toggles are expected by admins.** Marker.io: "disable optional features like session replay or console logs"; its mobile SDK ships privacy presets (strict/balanced/permissive). A per-project toggle for "collect console logs / collect identity" is table-adjacent; given R-06 explicitly defers per-project settings to v2, the v1 equivalent is the per-report opt-out (`privacy.userIdentity`, bug-vs-feedback log gating) — sufficient.

## Triage Workflow Patterns

**What competitors actually use:**

| Product | Statuses | Extras |
|---|---|---|
| Marker.io (current) | **5**: Open → In Progress → Waiting for Approval → Resolved → Closed; In Progress and Waiting for Approval are per-project toggleable; Waiting for Approval is renameable. Free movement between statuses (reopen supported) | Issue types (Bug / Improvement / custom), one assignee, comments (two-way with integrations), attachments, filters by type/status, email to reporter on resolve |
| Marker.io (until Feb 2026) | **3**: Open / Resolved / Archived | Shows 3 states carried a mature product for years |
| Sentry User Feedback | Unresolved / Resolved (chronological inbox, unresolved on top) | Alerts on new feedback, link to error event + replay, tags |
| GlitchTip | Unresolved / Resolved / Ignored | Tags as filters, sorting, per-project alerts |
| BugHerd | Kanban columns (customisable board) | Assignment, client comms, task board, due dates |
| Noteloop (indie, closest to us) | **7**: open / in_progress / on_hold / feedback / clarify / resolved / archived | priority, category, assignee, tags, similar-duplicates endpoint, comments with internal flag |
| Ruttl | Kanban (To-Do → Completion lists) | assign, priority, deadlines |
| BugPin (self-hosted) | report list + statuses (light triage) | admin/editor created reports, dark mode |

**Conclusions for RF-06 / Q:**

1. **Pending / In Progress / Resolved is the right v1 granularity — at the category floor, not below it.** Marker.io ran Open/Resolved/Archived for years; its 2026 addition of In Progress + Waiting for Approval confirms the 3-state core with optional extras is exactly how the category matures. Naming: "Pending" ≈ "Open"; consider adding **reopen** (move Resolved → Pending) — universal (Marker.io, Sentry) and near-free.
2. **Table-stakes triage extras, ranked by prevalence:** comments/notes (all), reopen (most), labels/tags (most), assignee (all SaaS, pointless under single-admin), duplicate-linking (minority — Marker.io only *plans* it, Noteloop ships a heuristic). Under R-05: assignee is a deliberate cut; comments degrade to internal notes; labels are the first v2 extra; duplicate-linking is a cheap v2 heuristic (no AI — §2-compliant).
3. **Filtering by type + status + date is v1** (already in RF-06). Priority (Noteloop, Ruttl) is v2 — with one admin and a small install, priority lives in the admin's head.
4. **"Waiting for Approval" exists for client-agency workflows** (BugHerd/Ruttl's core market). Watchbug's audience (self-hosting developers) does not need it in v1; if ever added, Marker.io's renameable-middleware pattern is the one to copy.

## Sources & Confidence

Confidence tiers per the seam (`classify-confidence --provider websearch`): **LOW** for single-source unverified, **MEDIUM** for cross-checked (`--verified`). No claim below is asserted at HIGH.

| Source | Used for | Confidence |
|---|---|---|
| help.marker.io (Native browser screenshot rendering, Snippet Configuration, Tips for better screenshot quality, Browser Extensions FAQs, Issue Statuses, Issue Types, Notifications, Mobile SDK overview), marker.io/security, marker.io/privacy, marker.io/dpa, feedback.marker.io boards & changelog | Capture approaches + failure modes (Q-06), annotation tools, metadata set, statuses, GDPR posture | MEDIUM (first-party docs, cross-checked across ≥2 Marker pages and against Usersnap/BugPin for capture claims) |
| help.usersnap.com (Feedback with a screenshot, Screen recording), usersnap.com/features, use-case pages, Firefox listing | 5-tool annotation census, `nativeScreenshot` / media-record API, `usprivacy`, kanban/statistics triage | MEDIUM |
| bugherd.com/features, /chrome-annotation-extension, /extensions, support.bugherd.com, Firefox/Edge listings | Extension-first capture model, pin-to-element metadata, unlimited projects/reviewers, duplicate-avoidance via visible pins | MEDIUM |
| jam.dev + jam.dev/docs (Screenshot, Video Recording, Overview, Recording Links) | Metadata breadth (console, network, user events, country, network speed), `jam.metadata()`, crop + full-page context, annotation-during-recording | MEDIUM |
| docs.sentry.io (User Feedback product page, JS configuration pages, changelog) | Feedback widget fields, `enableScreenshot`/`showName`/`showEmail` defaults, highlight + hide tools (SDK ≥10.10.0), self-hosted support (≥24.4.2), chronological triage | MEDIUM |
| glitchtip.com (pricing, docs) | Self-hostable expectations, unlimited projects, unresolved/resolved/ignored states | MEDIUM |
| github.com/instabug/* (READMEs), instabug-docs.luciq.ai (Repro Steps) | Repro-steps concept, private views, disclaimer/email requirements, web SDK metadata list | MEDIUM |
| github.com/aranticlabs/bugpin, docs.bugpin.io | Closest self-hosted comparable: annotation set (pen/shapes/arrows/text/blur), Shadow DOM isolation, offline queue, 8 locales, 4xx/5xx metadata | MEDIUM |
| ybug.io/features/bug-report-tool, webvizio.com/bug-tracking, overlayqa.com, toado.dev/features | Annotation-tool census cross-checks, failed-network-request metadata, CSS-selector capture concept | MEDIUM |
| docs.noteloop.dev/api-docs, feedex.rianfernando.com docs, feedback-hub.orosa.io/docs, usevoicebox.dev/docs | Per-project public/secret key patterns (Q: multi-project), real-world rate limits and console-log caps (**Q-02 values**: 50 entries × 2 KB/msg, 8 KB/stack; 100 KB payload; 10 MB image; 20/min/IP) | MEDIUM (each indie product cross-checks the pattern; specific numbers are per-product) |
| frill.co | Feedback-board/roadmap/changelog feature family (anti-feature boundary) | MEDIUM |
| ruttl.com, G2 listing | Pixel-pinned comments, kanban, guest commenting | MEDIUM (vendor + review aggregator) |
| debugme.eu via Tracxn/Drupal/G2 listings | DebugMe feature set | **LOW — product is deadpooled; only third-party listings found** |
| "BugMoo" | **Not verified.** bugmoo.net registration lapsed (2022); no product docs exist. Searches resolved to BugMojo and BugPin instead | **LOW / not found — do not cite BugMoo as a competitor in the TFG memoria without independent verification** |
| Sentry's internal screenshot mechanism | Could not be verified from docs read; DOM-serialization inference is marked as unverified in the Capture table | LOW |
| FullStory / LogRocket | Only as session-replay scope references (anti-features); their feature sets were not individually researched since they are excluded by §2 | n/a (deliberate) |

**Gaps / cautions for the synthesiser:**

- The 45 KB budget math assumes R-01's own estimates (editor 10–16 KB lazy, capture 8–14 KB). Competitor byte claims (e.g. Sentry's bundle sizes) were not measured; only the Seam's D-04/D-05 figures are evidence-backed.
- `preferCurrentTab: true` friction-reduction is plausible but not vendor-documented in the surveyed sources (LOW confidence) — verify against MDN/Chrome docs during capture-phase planning.
- Q-02 can be provisionally closed with feedback-hub's published caps as defaults (50 × 2 KB / 8 KB stack / 100 KB payload / 10 MB image), adjusted after a load test.
