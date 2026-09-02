---
phase: 03
slug: admin-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-02
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 + jsdom 25.0.1 |
| **Config file** | panel/vitest.config.ts (Wave 0 installs); root vitest.config.ts exists |
| **Quick run command** | `vitest run --config panel/vitest.config.ts` |
| **Full suite command** | `vitest run --config panel/vitest.config.ts && vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `vitest run --config panel/vitest.config.ts`
- **After every plan wave:** Run `vitest run --config panel/vitest.config.ts && npm run build --prefix panel`
- **Before `/gsd-verify-work`:** Full suite must be green + `test -f backend/api/static/panel/index.html`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PAN-01, PAN-07 | — | textContent audit via grep | unit | `vitest run --config panel/vitest.config.ts -t "hash parser"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PAN-02, PAN-07 | T-03-02 | credentials:include + 401→inline error | unit | `vitest run --config panel/vitest.config.ts -t "auth guard"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | PAN-03, PAN-04, PAN-06 | — | filter hash↔query + pagination disabled states | unit | `vitest run --config panel/vitest.config.ts -t "list"` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | PAN-03, PAN-07 | T-03-01 | textContent badges, has_screenshot placeholder | unit | `vitest run --config panel/vitest.config.ts -t "xss"` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | PAN-05, PAN-07 | T-03-01 | detail screenshot data URL + metadata cards + consoleLogs | unit | `vitest run --config panel/vitest.config.ts -t "detail"` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 3 | PAN-05 | T-03-03 | PATCH status Any→Any optimistic + 422 revert | unit | `vitest run --config panel/vitest.config.ts -t "status patch"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `panel/package.json` — Vite + TS scaffold, scripts dev/build/preview/test, type module
- [ ] `panel/vite.config.ts` — outDir ../backend/api/static/panel, base "./", proxy /api
- [ ] `panel/tsconfig.json` — strict, target ES2020, moduleResolution bundler
- [ ] `panel/index.html` — SPA shell #app
- [ ] `panel/src/i18n/en.json` + `es.json` — flat keys
- [ ] `panel/vitest.config.ts` — environment jsdom
- [ ] `panel/src/utils/hash.test.ts` — parseHash/buildHash round-trip
- [ ] `panel/src/api.test.ts` — apiFetch credentials:include + refresh retry
- [ ] `panel/src/i18n/index.test.ts` — t(key) + persist
- [ ] `npm install --prefix panel` — install dev deps (vite 6.3.5, typescript 5.5)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Responsive breakpoints 768/900 (table collapses, detail stacks) | PAN-06 | jsdom has no layout engine | Open /panel in Chrome, resize to 768 and 900, verify list hides thumbnail, detail stacks |
| Lightbox zoom on detail screenshot click | PAN-05 | Overlay animation + click-outside | Open detail with screenshot, click image → overlay visible, click outside → closes |
| Toast auto-dismiss timing | D-07 | Visual timing | Trigger status change → toast "Status updated" visible 3s then fades |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
