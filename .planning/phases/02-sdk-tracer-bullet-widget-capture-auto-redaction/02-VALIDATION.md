---
phase: "2"
slug: "sdk-tracer-bullet-widget-capture-auto-redaction"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-17"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `02-RESEARCH.md` § Validation Architecture (2026-10-17). R-12 in force:
> **e2e and property assertions only** — one Playwright suite + `npm run check:size` +
> `node scripts/gate.mjs`. No unit tests, no coverage tooling (owner policy, stated twice).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.63.0 (`@playwright/test`) |
| **Config file** | `playwright.config.ts` (exists — 3 engine projects: chromium, firefox, webkit; `workers: 1`; global-setup health gate) |
| **Quick run command** | `npx playwright test e2e/sdk.spec.ts --project=chromium` |
| **Full suite command** | `npm run verify` (+ `npm run check:size`, `node scripts/gate.mjs`) |
| **Estimated runtime** | ~measured at first Wave-0 run (Phase 1 baseline: `npm run verify` is the full 3-engine suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test e2e/sdk.spec.ts --project=chromium` (fast lane) + `npm run check:size`
- **After every plan wave:** Run `npm run verify` (all three engines) + `npm run check:size` + `node scripts/gate.mjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~one chromium-project spec run (measure at first Wave-0 run; keep the fast lane under 30 s or narrow it to the touched CA row)

---

## Per-Task Verification Map

> **Seeded before plans exist** (plan-phase step 5.5). Task IDs / Plan / Wave columns are filled
> when `02-NN-PLAN.md` files are written; requirement rows below are the contract the plans MUST
> carry. Source: `02-RESEARCH.md` § Validation Architecture (Phase Requirements → Test Map).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | INT-01 | — | async script tag boots widget, nothing else leaks | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INT-02 | T-2-* | `Watchbug.init({projectKey,…})` drives a landed report | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INT-05 | — | ESM import boots widget | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WDG-01 | — | launcher opens the flow | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WDG-02 | T-2-* | hostile CSS cannot hide/restyle the widget (CA-04) | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WDG-03 | T-2-* | zero host CSS/JS/class/var leakage | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WDG-04 | — | exactly one global, no prototype patching | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WDG-05 | — | widget renders above all hostile content | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CAP-01 | — | capture via browser prompt (stubbed seam per engine) | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CAP-04 | T-2-* | widget absent from capture bytes | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CAP-05 | — | ≤16 MP / ≤2 MB; HiDPI frame never blank | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PRV-01 | T-2-* | password fields flat-filled in encoded bytes | e2e artifact | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PRV-02 | T-2-* | token/card patterns (Luhn) flat-filled in encoded bytes | e2e artifact | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PRV-03 | T-2-* | `[data-watchbug-sensitive]` flat-filled in encoded bytes | e2e artifact | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PRV-05 | T-2-* | no cookies/storage/auth headers leave the browser | e2e + static | `npx playwright test e2e/sdk.spec.ts` + `node scripts/gate.mjs sdk-no-host-storage` | ✅ (gate) / ❌ e2e row | ⬜ pending |
| TBD | TBD | TBD | PRV-06 | — | URL query/fragment stripped (path-only) | e2e | `npx playwright test e2e/sdk.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PRF-01 | — | injected core ≤ 45 KB gz | size gate | `npm run check:size` | ✅ | ⬜ pending |
| TBD | TBD | TBD | PRF-04 | — | zero runtime npm dependencies | static gate | `node scripts/gate.mjs sdk-runtime-deps` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/sdk.spec.ts` (or extension of the existing single suite — R-12: keep one test artifact) — the CA-01…CA-04 rows above
- [ ] `e2e/fixtures/hostile-host.html` + fixture loader via Playwright `page.route` fulfilment at the panel origin (Pitfall 4: the panel's `location /` CSP `default-src 'self'` would silently neuter inline hostile styles and make CA-04 pass vacuously)
- [ ] `SHADOW_MODE=open` build variant wiring in `packages/sdk/scripts/build.mjs` [VERIFIED: `SHADOW_MODE: JSON.stringify('closed')` is hardcoded at build.mjs:37] + module-scoped root registry (R-14)
- [ ] Two-tier capture stub seam (Pitfall 2): `canvas.captureStream()` fake-`getDisplayMedia` for chromium/firefox; `CaptureSource`-level `ImageData` stub for Playwright-webkit (WinCairo: no `navigator.mediaDevices`, no `captureStream`)
- [ ] Forced-PNG `toBlob` stub row for M-3 (Pitfall 3: this platform's Playwright-webkit encodes real WebP — the repo's "webkit exercises the R-11 PNG fallback" premise is false here; see OQ-2)
- [ ] `scripts/gate.mjs` exemption/wording strategy for the redaction pattern catalog (Pitfall 1: `sdk-no-host-storage` will collide with `document.cookie|localStorage|…` literals in the C-5 catalog; `sdk-single-encode-sink` forces exactly one textual `toBlob` call site)
- [ ] *(No framework install needed — Playwright 1.63.0 + all browsers are present.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `getDisplayMedia` picker flow on a real tab | CAP-01 | Browser picker is not reliably automatable; Playwright stubs the seam | Open the fixture over HTTPS/localhost, click the launcher, confirm the picker appears, select This Tab, confirm the report lands |
| Real-Safari WebP→PNG silent fallback | M-3 / R-11 | Real Safari is not on this host (Playwright-webkit encodes real WebP here) | On macOS Safari, file a report; sniff `blob.type` in devtools console — expect `image/png` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s (fast lane, chromium project)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
