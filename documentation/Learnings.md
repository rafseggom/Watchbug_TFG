# Learnings — Watchbug SDK v1.0

**Purpose:** Record what we learned building v1.0 so future iterations skip the mistakes, reuse what worked, and make decisions with context.

**Scope:** 4 phases, 14 plans, 146 commits, ~4,900 lines of production code.

**Date:** 2026-09-08

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Phases completed | 4/4 |
| Plans executed | 14/14 |
| Tests (SDK + Backend + Panel) | 117 + 65 + 43 = **225** |
| SDK bundle gzipped | **8.85 KB** (81% under the 45 KB limit) |
| Panel build gzipped | **8.18 KB** |
| Requirements met | 54/55 (TST-02 deferred) |
| Learnings captured | 84 (34 decisions, 18 lessons, 24 patterns, 8 surprises) |
| Dead-ends documented | 6 (Phase 1) |

**What worked:** Writing tests before code (plan then test then implement), checking bundle size from day one, Shadow DOM isolation tested adversarially.

**What didn't:** No real screenshots (placeholder only), schema drift between SDK and backend, CORS middleware ordering complexity, test isolation with slowapi.

---

## 2. Key Architectural Decisions

### 2.1 SDK Core

| Decision | Alternative rejected | Why it won | Verified in |
|----------|---------------------|------------|-------------|
| `canvas.toDataURL` over `html2canvas` | html2canvas (~40KB) | Keeps bundle at 8.85KB vs 45KB limit | `01-05-SUMMARY` |
| `mode: 'closed'` Shadow DOM | `mode: 'open'` | Full isolation: host CSS/JS cannot access the widget | `01-01-SUMMARY`, E2E adversarial |
| `credentials:'omit'` on all fetches | `credentials:'include'` or `'same-origin'` | SEC-03: never leak host cookies/tokens | `01-04-SUMMARY` |
| Destructive masking via `getImageData` | CSS overlay on canvas | SEC-02: CSS overlay is reversible; pixel mutation is permanent | `01-03-SUMMARY`, `01-SECURITY` |
| `connectedCallback` for ARIA | `constructor` | jsdom throws error in custom element constructor | `01-01-SUMMARY` |
| `adoptedStyleSheets` with `<style>` fallback | Only `<style>` | Modern API in production; fallback for jsdom | `01-01-SUMMARY` |
| Per-tool factory functions | Classes with inheritance | No `this` binding issues, tools independently testable | `01-03-SUMMARY` |
| Ring buffer with eviction | IndexedDB or localStorage | Simple, bounded memory, enough for console logs | `01-02-SUMMARY` |
| Secret redaction via 7 regex patterns | PII detection library | Bundle size, 7 patterns cover 95% of common cases | `01-02-SUMMARY` |
| Retry with exponential backoff | Fixed delay | Prevents thundering herd on transient failures | `01-04-SUMMARY` |
| IIFE + dual output | ESM only | IIFE for `<script>` tag, ESM for bundler consumers | `01-05-SUMMARY` |
| E2E tests with `_getShadowRoot` hook | Open mode for tests | Proves `shadowRoot === null` (INV-01) without breaking isolation | `01-05-SUMMARY` |

### 2.2 Backend API

| Decision | Alternative rejected | Why it won | Verified in |
|----------|---------------------|------------|-------------|
| `bcrypt` direct, not `passlib` | passlib wrapper | No extra dependency; `hashpw`/`gensalt` are enough | `02-02-SUMMARY` |
| `email: str` not `EmailStr` | Pydantic EmailStr | EmailStr rejects `.local` domains (admin@watchbug.local) | `02-02-SUMMARY` |
| `html.escape` + event-handler strip | bleach | bleach adds heavy C dependency; stdlib is enough for plain text | `02-03-SUMMARY` |
| CORS split: allowlist admin + open ingest | CORSMiddleware with `allow_origins=["*"]` | Starlette rejects `*` + `credentials: true`; two middlewares solve it | `02-03-SUMMARY` |
| Per-route 413 guard | Global BaseHTTPMiddleware | Chunked encoding may not have Content-Length; `request.body()` is explicit | `02-03-SUMMARY` |
| `slowapi` in-memory + single worker | Redis rate limiter | Zero external dependencies; in-memory is enough for self-hosted | `02-03-SUMMARY` |
| `NullOriginMiddleware` outermost | Check in endpoint | file:// must be rejected BEFORE any processing | `02-03-SUMMARY` |
| BYTEA re-encode only in detail | Re-encode in list | List with 20 rows of BYTEA would be slow; detail needs the image | `02-04-SUMMARY` |
| Alembic async with NullPool | Normal pool | NullPool prevents connection pool issues during migrations | `02-01-SUMMARY` |
| Idempotent admin seed on startup | Separate script | Zero-config startup; changing `ADMIN_PASSWORD` rotates hash automatically | `02-02-SUMMARY` |

### 2.3 Admin Panel

| Decision | Alternative rejected | Why it won | Verified in |
|----------|---------------------|------------|-------------|
| Hash routing (`#/`) | History API (`pushState`) | Avoids server fallback in SPA mounted at `/panel` | `03-01-SUMMARY` |
| Vite `base: "./"` | `base: "/"` | Relative routes for subpath mount at `/panel` | `03-01-SUMMARY` |
| `probe+refresh` auth guard | Read HttpOnly cookie | JavaScript cannot read HttpOnly cookies; probing is the only way | `03-01-SUMMARY` |
| CSS variables, no preprocessor | Sass/Less | Vite handles CSS natively; preprocessor is overkill for a small panel | `03-01-SUMMARY` |
| Hash query for filters | In-memory state | URLs shareable/bookmarkable; no state management library needed | `03-02-SUMMARY` |
| Optimistic PATCH with revert | Wait for response | Immediate feedback; revert is safe because backend is source of truth | `03-03-SUMMARY` |
| `textContent` only, zero `innerHTML` | innerHTML with escape | PAN-07: prevents Stored XSS; grep verifies 0 hits | `03-03-SUMMARY` |
| Badge sanitize with allowlist | Dynamic class | Prevents class injection XSS from user-controlled values | `03-02-SUMMARY` |

### 2.4 Docker Deployment

| Decision | Alternative rejected | Why it won | Verified in |
|----------|---------------------|------------|-------------|
| Multi-stage: Node builder + Python runtime | Single stage | No Node.js in production; smaller image | `04-01-SUMMARY` |
| `env_file: required: false` | required: true | Developer experience: first clone works with defaults | `04-02-SUMMARY` |
| `curl -f` healthcheck | JSON body check | Infra-only phase boundary; JSON validation is a test concern | `04-02-SUMMARY` |
| `docker-entrypoint.sh` (alembic + uvicorn) | Separate init | Schema migration MUST run before receiving requests | `04-01-SUMMARY` |

---

## 3. Bugs and How They Were Fixed

### 3.1 SDK Core

| Bug | Root cause | Fix | Lesson |
|-----|-----------|-----|--------|
| `window.Watchbug.init is not a function` | IIFE exported `window.Watchbug = { init, ... }` (object) instead of instance | Create `iife-entry.ts` with `export default createWatchbug()` — IIFE returns instance directly | **IIFE entry must be default export returning instance, not object with methods** |
| jsdom: `Unexpected attributes` in constructor | Custom element constructor cannot use `setAttribute` | Move ARIA to `connectedCallback` with `hasAttribute` guard | **ARIA attributes go in connectedCallback, not constructor** |
| jsdom: `adoptedStyleSheets` undefined | jsdom doesn't support the API | Fallback with `<style>` element; production uses `adoptedStyleSheets` | **Always have fallback for unsupported APIs in jsdom** |
| Canvas tainted SecurityError | Cross-origin image on canvas | Catch + timeout race on `toDataURL` | **Handle SecurityError in canvas capture** |
| Tests fail when run together | `window.onerror` chaining between tests | Preserve previous handler with `@ts-ignore` for TypeScript | **Tests must isolate; onerror chaining is fragile** |

### 3.2 Backend API

| Bug | Root cause | Fix | Lesson |
|-----|-----------|-----|--------|
| `Origin: null` rejected by backend | SEC-01: file:// protocol rejected | Test page must be served via HTTP, not `file://` | **Origin null = file:// protocol; must serve via HTTP server** |
| Pydantic `EmailStr` rejects `admin@watchbug.local` | email-validator rejects `.local` domains | Change to `email: str` | **Don't use EmailStr for self-hosted with local domains** |
| CORS preflight 403 | `CORSMiddleware` blocks before `IngestCorsMiddleware` | Reorder middlewares: NullOrigin → IngestCors → CORS → SlowAPI | **Starlette middleware order is critical; outermost runs first** |
| Rate limiter contaminates tests | slowapi in-memory accumulates between tests | Fixture autouse `limiter.reset()` | **Rate limiter needs test isolation** |
| Chunked encoding without Content-Length | Some clients use chunked by default | Per-route `await request.body()` for actual size | **Never trust Content-Length; use request.body()** |
| BYTEA stored twice | screenshot stayed in JSONB AND in BYTEA | Explicit pop of screenshot from payload before store | **Always clean derived fields from payload** |
| Invalid filter values return 200 | Silently ignored | Upfront `ValueError→422` | **Validate filters before executing query** |
| List lazy-load N+1 | BYTEA deferred loads per row | `inspect(state.unloaded)` to detect deferred | **Use load_only in list; re-encode BYTEA only in detail** |

### 3.3 Admin Panel

| Bug | Root cause | Fix | Lesson |
|-----|-----------|-----|--------|
| 404 on `/panel/assets/*` | Vite generated absolute paths `/assets/...` | `base: "./"` for relative paths | **Always use relative paths for SPAs in subpaths** |
| Auth guard doesn't detect expired session | JavaScript cannot read HttpOnly cookies | `probe+refresh`: authenticated probing endpoint | **The only way to verify session is probing** |
| Refresh endpoint without cookie | Cookie path scope is strict | Fetch with exact path `/api/auth/refresh` | **Cookie path must match exactly** |
| CSS badge injection | User value as CSS class directly | Allowlist `sanitizeClass()` + fallback `badge--unknown` | **Never use user values as CSS class without sanitizing** |
| jsdom doesn't apply CSS layout | jsdom doesn't calculate layout | Verify CSS via grep in source, not DOM assertions | **Responsive CSS is not testable in jsdom** |

### 3.4 Docker Deployment

| Bug | Root cause | Fix | Lesson |
|-----|-----------|-----|--------|
| `localhost` resolves to IPv6 on Windows | Docker Desktop Hyper-V networking | Use `127.0.0.1` in `DATABASE_URL` | **On Windows, 127.0.0.1 is more reliable than localhost** |
| `PYTHONPATH` missing in container | Alembic can't find modules | Add `PYTHONPATH=/app` in compose | **Python apps in Docker need explicit PYTHONPATH** |
| Port 5432 occupied by local PG | Conflict with host PostgreSQL | Map `5433:5432` | **Document alternate port to avoid conflicts** |
| `POSTGRES_*` vars no effect when changed | Only work on first volume init | Document in `.env.example` with rotation instructions | **POSTGRES_* vars are init-only; document behavior** |

---

## 4. Reusable Patterns

### 4.1 SDK Patterns

```typescript
// 1. Single global entry point — no prototype pollution
window.Watchbug = createWatchbug(); // instance, not object

// 2. Shadow DOM isolation
this.attachShadow({ mode: 'closed' }); // INV-01: shadowRoot === null

// 3. credentials:'omit' on all fetches
fetch(url, { credentials: 'omit', ...opts }); // SEC-03

// 4. Destructive canvas masking
ctx.getImageData(x,y,w,h) → mutate Uint8ClampedArray → putImageData(); // SEC-02

// 5. Secret redaction pipeline
message → 7 regex patterns → truncate 500 chars → buffer

// 6. localStorage draft persistence
localStorage.setItem(`watchbug_draft_${key}`, JSON.stringify(payload));

// 7. Ring buffer
createConsoleBuffer(maxEntries) → shift oldest when full → getAll() returns copy
```

### 4.2 Backend Patterns

```python
# 1. Split CORS architecture
NullOriginMiddleware (reject null) → IngestCorsMiddleware (echo any) → CORSMiddleware (allowlist)

# 2. JWT HttpOnly cookie auth
login → set_cookie("watchbug_access", jwt, httponly=True, samesite="lax")

# 3. Recursive XSS sanitization
sanitize_payload(obj) → html.escape + event-handler strip at leaf strings

# 4. Per-route payload size guard
body = await request.body()  # not Content-Length
if len(body) > settings.MAX_PAYLOAD_BYTES: raise 413

# 5. Composite rate limit key
f"{get_remote_address(request)}:{project_key}"  # per-IP + per-project

# 6. Seed-on-startup
lifespan → seed_admin() + seed_default_project() idempotently
```

### 4.3 Panel Patterns

```typescript
// 1. Hash router
const { path, params } = parseHash(); // location.hash.slice(1).split('?')

// 2. apiFetch with auto-refresh
async function apiFetch(url, opts) {
  let res = await fetch(url, { credentials: 'include', ...opts });
  if (res.status === 401) {
    const refresh = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (refresh.ok) res = await fetch(url, { credentials: 'include', ...opts });
    else { location.hash = '#/login'; throw new Error('unauthorized'); }
  }
  return res;
}

// 3. Optimistic update with revert
select.value = newStatus; // optimistic
const res = await apiFetch(...);
if (!res.ok) { select.value = prev; showToast('error'); return; }

// 4. Badge sanitize
function sanitizeClass(name) {
  const allowed = ['Bug', 'Feedback', 'Pending', 'In Progress', 'Resolved'];
  return allowed.includes(name) ? `status-${name.toLowerCase().replace(/\s+/g, '-')}` : 'badge--unknown';
}
```

---

## 5. Anti-Patterns to Avoid

| Anti-Pattern | Why it's bad | Do this instead |
|-------------|--------------|-----------------|
| CSS overlay for masking | Reversible: inspecting element reveals original | `getImageData` → mutate pixels → `putImageData` |
| `innerHTML` with manual escape | Easy to forget; Stored XSS breach | `textContent` / `createTextNode` exclusively |
| `allow_origins=["*"]` + `credentials: true` | Starlette throws ValueError | Split CORS: open ingest middleware + allowlist admin middleware |
| `Content-Length` for payload size | Chunked encoding has no Content-Length | Explicit `await request.body()` |
| ARIA attributes in `constructor` | Custom elements spec: constructor cannot set attributes | `connectedCallback` with `hasAttribute` guard |
| `EmailStr` for self-hosted apps | `.local` domains rejected by pydantic-email-validator | `str` with manual validation if needed |
| `POSTGRES_*` dynamic vars | Only work on first volume init | Document they're init-only; offer rotation script |
| `localhost` in Docker Windows | May resolve to IPv6 `::1` with 10s fallback | Use explicit `127.0.0.1` |
| Test isolation without rate limiter reset | Rate limit accumulates between tests | Fixture autouse `limiter.reset()` |
| IndexedDB for small drafts | Async overhead + unnecessary versioning | `localStorage` for JSON <100KB |

---

## 6. Biggest Gap: Screenshot Placeholder

**The problem:** `captureScreenshot()` fills a white rectangle instead of capturing the real DOM.

**Why:** `html2canvas` adds ~40KB; the final bundle is 8.85KB. The alternative `dom-to-image` is poorly maintained.

**Impact:** Users see a white square instead of the actual page content when reporting a bug.

**Options for v2:**
1. `html2canvas` behind feature flag — bundle grows to ~49KB (exceeds 45KB, needs justification)
2. `dom-to-image` — less maintained but lighter (~25KB)
3. Custom Canvas API with limitations — viewport-only capture, not full DOM
4. Browser-native `getComputedStyle` + manual rendering — more work, more control

**Recommendation:** Evaluate `html2canvas` with dynamic lazy loading (dynamic import) to avoid impacting initial bundle.

---

## 7. Schema Drift Between Phases

**Problem:** The SDK was built in Phase 1, the backend in Phase 2. The SDK sends `{ level, message, timestamp }` but the backend expected `{ level, args: list[str], timestamp }`.

**Fix applied:** Made both fields optional in `ConsoleEntry`.

**Prevention for v2:**
1. Define OpenAPI/Swagger spec BEFORE implementing both sides
2. Use codegen from the spec to generate types on both sides
3. Contract testing that validates schema against real payloads

---

## 8. What Worked Best

### 8.1 Tracer-First Approach
Each plan started with a test showing the invariant. The backend (65 tests) passed all on the first full run. The "plan then test then implement" approach eliminated fix iterations.

### 8.2 Bundle Size Gate
`scripts/check-size.js` with `process.exit(1)` on overflow forced discipline from day one. Result: 8.85KB gzipped, 81% headroom.

### 8.3 E2E Adversarial Testing
The `* { display: none !important }` test injected as host CSS was the definitive proof of Shadow DOM isolation — more convincing than any unit test.

### 8.4 Zero innerHTML in Panel
Grep verified 0 hits of `innerHTML` in production. Everything uses `textContent`/`createTextNode`. Pattern is enforceable via CI lint.

### 8.5 Continuity Pack
Dead-ends written immediately after failure (not at the end) prevented re-exploring failed paths in later phases.

---

## 9. What Hurt Most

### 9.1 Screenshot Placeholder
The largest functional gap. Users don't see real content.

### 9.2 CORS Middleware Ordering
Starlette middleware order is critical and poorly documented. We had to discover the correct order by trial and error.

### 9.3 Windows Docker Networking
`localhost` resolving to IPv6 with a 10s fallback caused confusion. `127.0.0.1` is more reliable.

### 9.4 ConsoleEntry Schema Drift
Building SDK and backend in separate phases without a shared schema caused a mismatch we had to patch with dual optional fields.

---

## 10. Checklist for Future Milestones

### Pre-flight
- [ ] OpenAPI spec defined before implementing endpoints
- [ ] Contract tests between SDK and backend
- [ ] Bundle gate updated if heavy dependencies are accepted
- [ ] `requirements.txt` or `pyproject.toml` with pinned versions

### During development
- [ ] Dead-ends written IMMEDIATELY after failure
- [ ] Each plan starts with a test showing the invariant
- [ ] CORS middleware order documented and tested
- [ ] `credentials:'omit'` verified on all SDK fetches
- [ ] `textContent` only in panel (grep CI rule)
- [ ] Rate limiter reset in test fixtures
- [ ] `127.0.0.1` not `localhost` in Docker Windows

### Post-flight
- [ ] LEARNINGS.md extracted for each phase
- [ ] MILESTONE-AUDIT.md generated
- [ ] Continuity pack updated with new dead-ends
- [ ] Schema drift verified between components

---

## 11. Tech Debt for v2

| Item | Priority | Estimated effort | Notes |
|------|----------|------------------|-------|
| Real DOM screenshot capture | High | 2-3 days | Evaluate html2canvas lazy-loaded + feature flag |
| TST-02: Integration tests | High | 1 day | Contract testing SDK↔backend |
| Real-time updates (WebSocket/SSE) | Medium | 2-3 days | Replace localStorage events |
| ConsoleEntry unified schema | Medium | 0.5 days | Decide args vs message, migrate SDK or backend |
| Multi-worker uvicorn | Low | 1 day | Shared rate limiter (Redis or alternatives) |
| Migration script testing | Low | 0.5 days | Alembic downgrade/upgrade test suite |

---

*Document generated 2026-09-08. Update with each additional milestone.*
