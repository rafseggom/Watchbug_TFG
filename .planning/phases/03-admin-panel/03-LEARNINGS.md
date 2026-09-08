---
phase: 03
phase_name: "Admin Panel"
project: "Watchbug SDK"
generated: "2026-09-08"
counts:
  decisions: 8
  lessons: 4
  patterns: 6
  surprises: 2
missing_artifacts: []
---

# Phase 03 Learnings: Admin Panel

## Decisions

### Hash Routing, Not History API
Use `location.hash` + `hashchange` event for routing instead of History API (`pushState`).

**Rationale:** Panel is served as a static SPA from FastAPI's `/panel` mount. Hash routing avoids server-side fallback configuration — any 404 returns `index.html` naturally.
**Source:** 03-01-SUMMARY.md

---

### Vite base "./", Not "/"
Set `base: "./"` in Vite config so all asset paths are relative.

**Rationale:** Panel is mounted at `/panel` subpath in production. Absolute `/` paths would break when served from a subdirectory.
**Source:** 03-01-SUMMARY.md

---

### probe+refresh Auth Guard
Auth guard first probes `GET /api/incidents?size=1`. On 401, attempts `POST /api/auth/refresh`. On success, retries probe. On failure, redirects to login.

**Rationale:** The guard never reads the HttpOnly cookie directly (JavaScript can't). Probing an authenticated endpoint is the only way to verify session validity.
**Source:** 03-01-SUMMARY.md

---

### Plain CSS Variables, Not Preprocessor
Use plain CSS custom properties (variables) instead of Sass/Less.

**Rationale:** Vite handles CSS natively; adding a preprocessor dependency for a small panel is overkill. CSS variables are sufficient for theming.
**Source:** 03-01-SUMMARY.md

---

### Hash Query for Filter State
Filter state (type, status, page) synced to `#/incidents?type=Bug&status=Pending,In Progress&page=2` via `URLSearchParams`.

**Rationale:** Shareable/bookmarkable URLs; no React state management needed. Filter changes reset page to 1.
**Source:** 03-02-SUMMARY.md

---

### Optimistic Status PATCH with Revert
Status select change fires `PATCH /api/incidents/:id/status` immediately. On success, updates `localStorage` + dispatches `CustomEvent`. On 422/401/network error, reverts to previous value.

**Rationale:** Immediate feedback feels faster; revert on error is safe since the backend is the source of truth.
**Source:** 03-03-SUMMARY.md

---

### textContent Only, No innerHTML
All DOM manipulation uses `createElement` + `textContent`/`createTextNode`. Zero `innerHTML` in production code (verified via grep).

**Rationale:** PAN-07 requirement: all user content rendered as escaped text. Prevents Stored XSS from incident metadata/notes.
**Source:** 03-03-SUMMARY.md

---

### Badge Sanitize with Allowlist Fallback
`sanitizeClass(name)` maps known values to allowed CSS classes; unknown values fall back to `badge--unknown`.

**Rationale:** Prevents class injection XSS from user-controlled status/type values.
**Source:** 03-02-SUMMARY.md

---

## Lessons

### FastAPI StaticFiles Mount Requires trailing slash Handling
`app.mount("/panel", StaticFiles(directory=panel_dir, html=True))` serves `index.html` for `/panel` but assets at `/panel/assets/*` need relative `./` paths (hence Vite `base: "./"`).

**Context:** Common pitfall when mounting SPAs at subpaths.
**Source:** 03-01-SUMMARY.md

---

### 401 Refresh Must Use Exact Path
The refresh endpoint cookie is scoped to `/api/auth`. The `fetch` for refresh must use the exact path `/api/auth/refresh` — not a relative path — to include the cookie.

**Context:** Cookie `path` attribute is strict; `/api/auth/refresh` != `/api/auth` path scope.
**Source:** 03-01-SUMMARY.md

---

### jsdom Cannot Layout CSS
jsdom doesn't compute CSS layout — media queries, flexbox, grid are not applied in tests. Responsive CSS must be verified via `Select-String` (grep) on source, not DOM assertions.

**Context:** Responsive behavior is manually verified in browser; tests only confirm CSS rules exist.
**Source:** 03-03-SUMMARY.md

---

### optimistic Updates Need Event Dispatch
Status changes dispatch `CustomEvent("watchbug:status-updated")` so the list view can patch visible rows without refetching. `localStorage` serves as cross-tab communication.

**Context:** SPA without real-time backend needs client-side event system for intra-app reactivity.
**Source:** 03-03-SUMMARY.md

---

## Patterns

### Hash Router with URLSearchParams
```typescript
export function parseHash() {
  const [path, query] = location.hash.slice(1).split('?');
  return { path, params: new URLSearchParams(query) };
}
```
Simple hash-based routing without framework dependency.

**When to use:** Lightweight SPAs where framework routing is overkill.
**Source:** 03-01-SUMMARY.md

---

### apiFetch with Auto-Refresh
```typescript
async function apiFetch(url, opts) {
  let res = await fetch(url, { credentials: 'include', ...opts });
  if (res.status === 401) {
    const refresh = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (refresh.ok) res = await fetch(url, { credentials: 'include', ...opts });
    else { location.hash = '#/login'; throw new Error('unauthorized'); }
  }
  return res;
}
```

**When to use:** SPAs with JWT cookie auth that need transparent token refresh.
**Source:** 03-01-SUMMARY.md

---

### Optimistic Update with localStorage Sync
```typescript
select.onchange = async () => {
  const prev = select.value;
  select.value = newStatus;
  const res = await apiFetch(`/api/incidents/${id}/status`, { method: 'PATCH', body: JSON.stringify({status: newStatus}) });
  if (!res.ok) { select.value = prev; showToast('error'); return; }
  localStorage.setItem(`watchbug:inc-${id}:status`, newStatus);
  window.dispatchEvent(new CustomEvent('watchbug:status-updated', { detail: { id, status: newStatus } }));
};
```

**When to use:** Forms where immediate UI feedback is preferred over server-confirmed updates.
**Source:** 03-03-SUMMARY.md

---

### CSS Badge with Sanitize Fallback
```typescript
function sanitizeClass(name: string): string {
  const allowed = ['Bug', 'Feedback', 'Pending', 'In Progress', 'Resolved'];
  return allowed.includes(name) ? `status-${name.toLowerCase().replace(/\s+/g, '-')}` : 'badge--unknown';
}
```

**When to use:** Rendering user/server-controlled values as CSS class names.
**Source:** 03-02-SUMMARY.md

---

### Vite Subpath Mount Config
```typescript
export default defineConfig({
  base: "./",  // relative paths for subpath mount
  build: { outDir: "../backend/api/static/panel", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:8000" } }
});
```

**When to use:** Building a SPA that will be served from a subpath in production.
**Source:** 03-01-SUMMARY.md

---

### Hash Query Shareable Filters
```typescript
function buildHash(path: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
```

**When to use:** Filter states that should be shareable via URL.
**Source:** 03-02-SUMMARY.md

---

## Surprises

### 43 Tests With Zero Framework
The entire panel (hash router, auth, i18n, login, list, detail, status PATCH) was built with vanilla TypeScript — no React/Vue/Svelte — and achieved 43 passing tests.

**Impact:** Proves lightweight SPA architecture is viable for admin panels; no framework overhead.
**Source:** 03-VERIFICATION.md

---

### InnerHTML Grep Was Zero
Grep for `innerHTML` in production `panel/src` files (excluding tests) returned 0 hits. Every DOM insertion uses `textContent`/`createTextNode`.

**Impact:** Strong XSS guarantee; pattern is enforceable via CI lint rule.
**Source:** 03-VERIFICATION.md
