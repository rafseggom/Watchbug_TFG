# Pitfalls Research

**Domain:** Error reporting & visual feedback SDK (self-hosted, Shadow DOM widget)
**Researched:** 2026-08-29
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Shadow DOM Closed Mode Breaks Debugging and Accessibility Tools

**What goes wrong:**
Using `mode: 'closed'` for Shadow DOM prevents `element.shadowRoot` from returning anything useful — the shadow root is inaccessible from outside. This makes the widget invisible to browser DevTools' DOM inspector, breaks accessibility tree traversal for screen readers, and prevents automated testing tools from querying widget internals. Developers can't debug the widget during integration, and users relying on assistive technology can't interact with it.

**Why it happens:**
The mentorship pack mandates `mode: 'closed'` for maximum isolation, but the practical tradeoffs aren't documented. Developers choose closed mode for security (preventing host JS from accessing widget internals) without realizing it creates a debuggability black hole.

**How to avoid:**
- Use `mode: 'closed'` only for the outer container that holds the widget's DOM tree, but expose internal elements via ARIA attributes and a programmatic API (`window.Watchbug.getState()`, `window.Watchbug.inspect()`) for debugging.
- Add a `__DEBUG__` flag that opens the shadow root during development.
- Ensure all interactive elements inside the Shadow DOM have proper ARIA roles and labels so screen readers can navigate them regardless of shadow root accessibility.
- For Playwright/E2E tests, use `page.locator()` with CSS selectors scoped to the shadow DOM, not `element.shadowRoot`.

**Warning signs:**
- E2E tests can't find widget elements after injection
- Accessibility audits show the widget is invisible to screen readers
- Developers report inability to inspect widget DOM in DevTools
- Integration tests require workarounds like `document.querySelector('*')` hacks

**Phase to address:**
Phase 1 (SDK Core) — must be decided at architecture time, not retrofitted.

---

### Pitfall 2: Canvas Screenshot Memory Explosion on Large Pages

**What goes wrong:**
Calling `html2canvas` or a similar DOM-to-canvas library on a page with thousands of DOM nodes, large images, or complex CSS generates a massive `ImageData` object. A 1920×1080 screenshot at 4 bytes per pixel is ~8 MB of raw pixel data. If the page has high-DPI content or the user is on a 4K display, this doubles or quadruples. The `toDataURL('image/png')` call then Base64-encodes this, inflating it by 33%, producing a ~14 MB string that gets serialized into the incident payload. This can cause:
- Browser tab freeze for 2-5 seconds during capture
- `Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvas` errors if any cross-origin image is present
- OOM crashes on low-memory mobile devices
- Incident payloads that exceed API body size limits

**Why it happens:**
DOM-to-canvas libraries like `html2canvas` walk the entire DOM tree and render it pixel by pixel. They don't have built-in size limits or downscaling. Cross-origin images taint the canvas if CORS headers aren't properly set on the image source, making `toDataURL` throw a SecurityError.

**How to avoid:**
- Implement viewport-only capture (use `window.innerWidth`/`innerHeight` to limit the capture region) rather than full-page capture.
- Downscale to a maximum resolution (e.g., cap at 1280px width) before encoding.
- Use `canvas.toBlob()` instead of `toDataURL()` — it's async and avoids holding the full Base64 string in memory simultaneously.
- Set `crossOrigin="anonymous"` on images and verify the server sends CORS headers, OR catch tainted canvas errors and fall back to a metadata-only report.
- Add a hard timeout (500ms) to the capture process — if it hasn't completed, abort and send a partial report with just metadata.

**Warning signs:**
- Users report the page "freezes" when they click the feedback button
- Console shows `SecurityError: Tainted canvases may not be exported`
- API logs show incident payloads > 5 MB
- Mobile users experience tab crashes

**Phase to address:**
Phase 2 (Capture Engine) — must be built correctly from the start; retrofitting size limits is painful.

---

### Pitfall 3: Destructive Canvas Masking Applied to Wrong Layer

**What goes wrong:**
The masking/blurring tool draws CSS overlays (positioned `<div>` elements with `filter: blur()`) on top of sensitive areas in the canvas editor, but these overlays are NOT applied to the underlying pixel data. When the user clicks "Submit," the SDK calls `canvas.toDataURL()` on the original, unmasked canvas — sending the unmasked screenshot to the server. The sensitive data (passwords, credit cards, personal info) is transmitted in cleartext.

**Why it happens:**
CSS blur overlays are visually identical to pixel-level blur but operate on a completely different layer. The canvas element's `toDataURL()` reads from its own bitmap buffer, not from CSS-painted overlays. This is a classic confusion between visual presentation and data representation.

**How to avoid:**
- Use `canvas.getContext('2d').getImageData()` to read pixel data, apply Gaussian blur or pixelation directly to the `ImageData.data` array, then `putImageData()` back onto the canvas.
- Never use DOM elements or CSS filters for masking — they are purely visual.
- Add a verification step: after masking, re-read the masked region and compare it against a "should be blurred" pattern to confirm the data was actually altered.
- The masking API must be on the canvas context, not on a wrapper div.

**Warning signs:**
- Security audit reveals CSS overlays being used for masking
- `getImageData()` on the masked region returns unblurred pixel values
- User screenshots show unmasked content when opened in an image viewer (outside the widget)

**Phase to address:**
Phase 2 (Capture Engine) — this is a security-critical invariant (SEC-02).

---

### Pitfall 4: SDK Captures Console Logs Containing Secrets

**What goes wrong:**
The SDK intercepts `console.log()`, `console.error()`, and `console.warn()` to add breadcrumbs to the incident report. Host applications often log sensitive data: API keys in configuration objects, JWT tokens in auth flows, database connection strings in error handlers, user PII in form validation. These all get captured and sent to the Watchbug backend.

**Why it happens:**
Developers log anything useful for debugging, including secrets. The SDK's console hook sees every log call indiscriminately. There's no built-in filtering mechanism.

**How to avoid:**
- Apply a redaction filter on captured console messages before storing them as breadcrumbs. Match patterns: `password`, `secret`, `token`, `api_key`, `authorization`, `Bearer`, credit card regexes, email patterns.
- Truncate long log messages (e.g., > 500 chars) to prevent payload bloat.
- Never capture `console.dir()` or `console.table()` output of complex objects — these can contain nested sensitive data.
- Provide a configuration option: `Watchbug.init({ captureConsole: false })` to disable console capture entirely.
- Log a development-mode warning when console capture is enabled: "Console capture is active — ensure no secrets are logged."

**Warning signs:**
- Host app developers report API keys appearing in incident reports
- Security review reveals `Authorization` headers in captured breadcrumbs
- Incident payloads contain credit card patterns or SSN formats

**Phase to address:**
Phase 2 (Capture Engine) — must be built into the console hook from day one.

---

### Pitfall 5: SDK Sends Host App Cookies and Tokens

**What goes wrong:**
The SDK's `fetch()` or `XMLHttpRequest` calls to the Watchbug backend inherit the host page's cookies (same-origin requests include cookies by default). This means the host app's session cookies, CSRF tokens, and any other credentials are attached to the incident submission request. If the Watchbug backend is on a different domain, this is prevented by CORS, but if the backend is on the same origin (e.g., self-hosted on the same domain), cookies flow through.

**Why it happens:**
Browser cookie behavior is automatic and non-obvious. `fetch()` includes credentials by default for same-origin requests. Developers forget that the SDK runs in the host app's context.

**How to avoid:**
- Always use `fetch(url, { credentials: 'none' })` or `fetch(url, { credentials: 'omit' })` for all SDK network requests.
- Use a dedicated subdomain or path prefix for the Watchbug backend that doesn't share cookies with the host app.
- Add a runtime assertion in development: if `document.cookie` contains non-empty values and `credentials` is not `'none'`, log a warning.

**Warning signs:**
- Watchbug backend logs show session cookies in request headers
- Host app session appears in Watchbug incident payloads
- Security audit reveals credential leakage path

**Phase to address:**
Phase 1 (SDK Core) — must be set correctly for all network requests from the start.

---

### Pitfall 6: CORS Wildcard on Ingest Endpoint Enables Abuse

**What goes wrong:**
The backend API's `/api/incidents` endpoint uses `Access-Control-Allow-Origin: *` to allow any website to submit incidents. This enables:
- DDoS attacks: anyone can flood the endpoint with fake incidents
- Data exfiltration: an attacker's page can use the endpoint as a free logging service
- Cost amplification: storage fills up with junk data

**Why it happens:**
Developers set `*` for CORS during development ("it works!") and forget to tighten it for production. The ingest endpoint is intentionally public (SDKs need to submit from any origin), so the line between "public API" and "abusable API" gets blurred.

**How to avoid:**
- Accept the `Origin` header on the backend and validate against a configurable allowlist of trusted origins.
- Rate-limit per IP and per project key (as specified in SEC-05).
- Require the `PROJECT_KEY` as a query parameter or header — this is already write-only and public, but it gives the backend a key to rate-limit against.
- Block `null` origin requests (attackers use sandboxed iframes to generate `Origin: null`).
- For the admin panel endpoints, use strict CORS with credentials — only allow the panel's own origin.

**Warning signs:**
- Backend logs show incident submissions from unexpected origins
- Spike in incident count without corresponding user activity
- Storage usage grows faster than expected

**Phase to address:**
Phase 3 (Backend API) — must be configured correctly before deployment.

---

### Pitfall 7: Docker Compose DB Volume Not Persisting Data

**What goes wrong:**
The `docker-compose.yml` uses an anonymous volume or bind-mounts to a host directory that gets recreated on `docker compose down -v`. PostgreSQL data is lost on every restart. Worse, the entrypoint script sees an empty PGDATA directory and runs `initdb`, creating a fresh database next to the orphaned data.

**Why it happens:**
Docker's `-v` flag removes named volumes. Anonymous volumes are tied to the container lifecycle. Bind mounts to empty directories trigger PostgreSQL's init logic. Developers test with `docker compose down` and assume data persists.

**How to avoid:**
- Use a named volume for PostgreSQL data: `volumes: postgres_data:` in `docker-compose.yml`.
- Never use `docker compose down -v` in any workflow that touches real data.
- Add a startup guard: check for `PG_VERSION` file in the data directory before allowing PostgreSQL to start. Refuse to initialize if the directory looks fresh in an environment where data should exist.
- Document that `docker compose down` preserves data, `docker compose down -v` destroys it.
- Pin the PostgreSQL image tag to a specific minor version (e.g., `postgres:16.3`) to avoid unexpected major version changes.

**Warning signs:**
- `docker compose up` after `down` shows empty database
- PostgreSQL logs show `LOG: database system was not properly shut down`
- `initdb` runs on startup when it shouldn't

**Phase to address:**
Phase 4 (Deployment) — must be correct from the first `docker-compose.yml`.

---

### Pitfall 8: PostgreSQL Major Version Upgrade Breaks Container

**What goes wrong:**
Changing the PostgreSQL image tag from `postgres:15` to `postgres:17` in `docker-compose.yml` and restarting causes a fatal error: the data directory format is incompatible with the new binary. Under pressure, teams delete the volume and start fresh, losing all incident data.

**Why it happens:**
Docker image tags look like version numbers but are just labels. `postgres:17` pulls the latest 17.x, which may have a different data format than 15.x. PostgreSQL refuses to start when the data directory was written by a different major version.

**How to avoid:**
- Pin to a specific major.minor tag: `postgres:15.3-bookworm`.
- Document the upgrade path: use `pg_dump`/`pg_restore` or `pg_upgrade` for major version changes.
- Never upgrade PostgreSQL by just changing the image tag.
- Add a startup script that checks `PG_VERSION` against the expected version and halts if mismatched.

**Warning signs:**
- PostgreSQL container exits immediately with `FATAL: data directory has wrong ownership` or `LOG: incompatible data directory`
- `docker logs` shows version mismatch errors

**Phase to address:**
Phase 4 (Deployment) — document in deployment guide.

---

### Pitfall 9: Incident Payload Lacks Schema Validation, Enables Stored XSS

**What goes wrong:**
The backend API accepts the incident payload and stores it in PostgreSQL without validating the JSON schema. Malicious or malformed payloads can include:
- JavaScript in console log messages: `<script>alert('xss')</script>`
- HTML in user notes or titles
- Enormous payloads that exhaust database storage
- Missing required fields that cause errors when the admin panel renders the incident

**Why it happens:**
Pydantic models with `model_config = ConfigDict(extra='allow')` silently accept extra fields. Developers forget to sanitize string fields before storage. The admin panel renders incident content as raw HTML instead of escaped text.

**How to avoid:**
- Use strict Pydantic models with `extra='forbid'` for the incident payload.
- Sanitize all string fields (console logs, user notes, titles) against XSS before storage — strip HTML tags, escape special characters.
- Set maximum field lengths: console log messages ≤ 10KB, user notes ≤ 5KB, URL ≤ 2048 chars.
- Set a maximum total payload size (e.g., 100KB) at the API level.
- Render all user-generated content as escaped text in the admin panel, never as raw HTML.
- Use Content-Security-Policy headers on the admin panel.

**Warning signs:**
- Admin panel shows alert boxes or broken layouts from malicious input
- Database storage grows faster than expected
- API accepts payloads with missing required fields without 422 errors

**Phase to address:**
Phase 3 (Backend API) — validation must be in place before any data is stored.

---

### Pitfall 10: PII Capture Without Consent Mechanism

**What goes wrong:**
The SDK captures screenshots, console logs, and metadata that may contain personal data: user names in form fields, email addresses in DOM content, IP addresses in network logs, screen recordings showing personal information. Under GDPR, this constitutes processing personal data that requires a lawful basis (consent or legitimate interest) and data minimization. The SDK has no mechanism for end-users to opt out of data capture.

**Why it happens:**
Error reporting SDKs are designed to capture everything useful for debugging. GDPR requires collecting only what's necessary. These goals conflict. Developers focus on the developer experience (capture everything!) without considering the end-user's privacy rights.

**How to avoid:**
- Provide a `Watchbug.setConsent(granted: boolean)` API that the host app can call based on its own consent flow.
- When consent is not granted, the SDK captures only anonymous metadata (URL, user-agent, screen size) — no screenshots, no console logs, no DOM content.
- Implement data minimization: mask `input[type=password]`, elements with `data-watchbug-sensitive`, and credit card patterns by default (already specified in SEC-01).
- Add a configurable retention period — incidents older than N days should be automatically deleted.
- Document the data processing purpose: "diagnosing software defects" — not profiling, not analytics, not marketing.
- Provide a `Watchbug.deleteMyData(userId)` endpoint for right-to-erasure requests.

**Warning signs:**
- Privacy audit reveals screenshots contain email addresses or names
- No consent mechanism exists in the SDK API
- Incident data has no retention policy
- No mechanism for end-users to request data deletion

**Phase to address:**
Phase 1 (SDK Core) — consent API must be part of the public interface from day one.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `html2canvas` without size limits | Fast to implement, works for small pages | Memory explosions, tab freezes on complex pages | Never — always add viewport capping |
| CSS overlays for masking instead of pixel manipulation | Visually identical, easy to implement | Security violation — sensitive data leaks in `toDataURL()` | Never — violates SEC-02 invariant |
| `Access-Control-Allow-Origin: *` on ingest | "It just works" during development | DDoS vector, data exfiltration channel | Only during local development |
| Anonymous Docker volumes for PostgreSQL | Quick to set up, no naming decisions | Data loss on container recreation | Never for production |
| Skipping `credentials: 'omit'` on SDK fetch | "It works" when backend is cross-origin | Credential leakage when backend moves to same origin | Never |
| Logging full request objects in error handlers | Maximum debug info | Secrets in logs — CWE-532 | Never |
| Storing raw PNG Base64 without compression | Simple implementation | 33% payload inflation, API body limits | Never — use WebP or JPEG with quality parameter |
| No `size-limit` CI check | Faster CI pipeline | Bundle bloat goes unnoticed, SDK exceeds 45KB limit | Never |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PostgreSQL via Docker | Using `localhost` as DB host inside container | Use service name: `DB_HOST=postgres` |
| PostgreSQL via Docker | Publishing port 5432 to host | Keep DB on internal bridge network only |
| PostgreSQL via Docker | Using `docker compose down -v` in production workflows | Named volumes, never use `-v` with real data |
| FastAPI CORS | Setting `allow_origins=["*"]` with `allow_credentials=True` | Explicit origin allowlist, never wildcard with credentials |
| FastAPI CORS | Reflecting `Origin` header without validation | Validate against allowlist, block `null` origin |
| Static file serving | Serving admin panel from same origin as API | Separate origins or strict path-based routing |
| JWT authentication | Long-lived tokens for admin panel | Short TTL (15min), refresh token pattern |
| Rate limiting | In-memory rate limiting across multiple containers | Use Redis or database-backed rate limiting |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No payload size limits on ingest API | Storage grows 10x faster than expected incident count | Validate payload size at API level (100KB max) | ~1000 incidents/day |
| Base64 PNG screenshots in every incident | API payloads 2-5 MB each, slow transfers | Use JPEG with quality=0.8 or WebP, cap at 1280px width | ~500 incidents/day |
| In-memory rate limiting | Rate limits reset on container restart, inconsistent across replicas | Use Redis or PostgreSQL-backed rate limiting | Multiple container instances |
| No incident deduplication | Same error creates hundreds of identical incidents | Hash (error_type + stack_trace + url) for dedup | ~10K active users |
| Synchronous screenshot capture | UI freezes during capture, users abandon | Async capture with Web Worker or offscreen canvas | Pages with > 5000 DOM nodes |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| SDK captures `Authorization` headers from host app | Credential leakage to Watchbug backend | SDK never reads request headers from host app |
| Console hook captures `console.dir(process.env)` | Full environment variable dump in incident reports | Redact sensitive patterns in captured console messages |
| Admin panel renders incident notes as HTML | Stored XSS — attacker submits `<script>` in feedback note | Escape all user content, use CSP headers |
| `PROJECT_KEY` used as authentication for admin endpoints | Public key grants admin access | PROJECT_KEY is write-only for ingest; admin uses separate JWT auth |
| Screenshot contains credit card visible in form | PII in stored screenshots | Auto-mask payment fields before screenshot capture |
| CORS `null` origin allowed on ingest endpoint | Sandboxed iframe bypasses origin check | Block `null` origin, validate against allowlist |
| No rate limiting on auth endpoint | Brute-force attacks on admin panel | Rate-limit `/api/auth/login` per IP |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Widget blocks page content when open | Users can't interact with underlying page | Use `position: fixed` with high z-index and click-through for non-widget area |
| Screenshot capture freezes page for 2+ seconds | Users think the page is broken | Show a subtle loading indicator during capture, use async capture |
| No feedback after submitting incident | Users don't know if submission succeeded | Show success toast with incident ID, allow viewing submitted report |
| Widget doesn't close on Escape key | Accessibility violation, frustrated users | Handle `keydown` for Escape to close widget |
| i18n not loaded before widget renders | Widget shows English strings to Spanish users | Load locale strings before rendering, show loading state if not ready |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Shadow DOM Isolation:** Widget renders correctly — but verify with `* { display: none !important; }` in host CSS (hostile CSS test per mentorship pack).
- [ ] **Canvas Masking:** Blur effect shows visually — but verify with `getImageData()` that pixels are actually altered (not just CSS overlay).
- [ ] **Console Capture:** Console logs appear in incidents — but verify sensitive patterns are redacted, not captured raw.
- [ ] **CORS Configuration:** Widget submits from host page — but verify from a different origin that the ingest endpoint rejects unauthorized requests.
- [ ] **Docker Compose:** Stack starts successfully — but verify data persists after `docker compose down && docker compose up` (without `-v`).
- [ ] **Rate Limiting:** Endpoint responds to requests — but verify that 100 rapid requests from the same IP get rate-limited.
- [ ] **Bundle Size:** SDK builds and loads — but verify with `npm run check:size` that gzipped output is ≤ 45 KB.
- [ ] **JWT Auth:** Login works — but verify that expired tokens are rejected and refresh flow works.
- [ ] **i18n:** Widget shows translated strings — but verify all user-visible strings go through i18n, no hardcoded English.
- [ ] **Payload Validation:** API accepts valid payloads — but verify that malformed payloads return 422, not 500.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Shadow DOM closed mode breaks testing | LOW | Add `__DEBUG__` flag, expose internal API for test queries |
| Canvas memory explosion | MEDIUM | Add viewport capping, switch to `toBlob()`, add size limits retroactively |
| CSS masking instead of pixel masking | HIGH | Rewrite masking to use `getImageData`/`putImageData` — CSS overlays must be removed |
| Console log secret capture | HIGH | Add redaction filter to existing hook, retroactively scrub stored incidents |
| CORS wildcard on ingest | LOW | Change to explicit allowlist, add rate limiting |
| Docker data loss | HIGH | Recover from backup if available, otherwise data is lost |
| Stored XSS in incidents | MEDIUM | Sanitize existing data, add escaping to admin panel rendering |
| PII in screenshots | HIGH | Delete affected incidents, add auto-masking to capture pipeline |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Shadow DOM closed mode breaks debugging | Phase 1 (SDK Core) | E2E test with hostile CSS + accessibility audit |
| Canvas memory explosion | Phase 2 (Capture Engine) | Memory profiling during capture, 4K display test |
| Destructive masking applied to wrong layer | Phase 2 (Capture Engine) | `getImageData()` verification after masking |
| Console log secret capture | Phase 2 (Capture Engine) | Unit tests with sensitive pattern inputs |
| SDK sends host credentials | Phase 1 (SDK Core) | Verify `credentials: 'omit'` on all fetch calls |
| CORS wildcard abuse | Phase 3 (Backend API) | Attempt cross-origin submission from unauthorized origin |
| Docker data loss | Phase 4 (Deployment) | Data persistence test across container restarts |
| PostgreSQL version upgrade | Phase 4 (Deployment) | Document upgrade procedure, test on staging |
| Stored XSS via incidents | Phase 3 (Backend API) | Submit `<script>` in incident payload, verify escaped rendering |
| PII capture without consent | Phase 1 (SDK Core) | Test with consent denied, verify no screenshots captured |
| No payload size limits | Phase 3 (Backend API) | Submit oversized payload, verify 413 response |
| No rate limiting | Phase 3 (Backend API) | Send 100 rapid requests, verify 429 after threshold |

## Sources

- AuditBuffet Pattern Catalog: Secrets in error messages (2026-04)
- SystemsHardening: Frontend RUM Security, Grafana Faro (2026-05)
- OWASP: Testing Cross Origin Resource Sharing
- Blendbyte: Stack Traces and Personal Data GDPR (2026-08)
- CNIL: Recommendation on mobile applications (2025-05)
- Bugnet: Crash Reporting and GDPR for Indie Developers (2026-03)
- cr0x.net: Docker Postgres Container Pitfalls (2025-11)
- Ardent Performance: Challenges of Postgres Containers (2024-12)
- selfhosting.sh: Docker Networking for Self-Hosting (2025-11)
- Controlled Rollout Systems: Minimizing Bundle Size with Tree-Shakable SDKs (2026-05)
- PkgPulse: Package Size Optimization and Tree Shaking 2026 (2026-03)
- OneUptime: Reducing OpenTelemetry Browser SDK Bundle Size (2026-02)

---
*Pitfalls research for: error reporting & visual feedback SDK (Watchbug)*
*Researched: 2026-08-29*
