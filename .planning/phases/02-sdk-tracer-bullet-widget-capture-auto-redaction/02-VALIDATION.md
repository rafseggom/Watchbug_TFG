---
phase: "2"
slug: "sdk-tracer-bullet-widget-capture-auto-redaction"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-17"
validated: "2026-10-24"
---

> **Superseded by R-19 (2026-10-29):** this document predates the six-type test taxonomy.
> Every "no unit tests / never unit tests / DONT MAKE A BUNCH OF TESTS / no other test
> artefact" statement in it is a **historical record of R-12 as it stood then** — not current
> policy. Current policy lives in `AGENTS.md` → *Testing & QA* and `.planning/REQUIREMENTS.md`
> (R-19 amends R-12; artifact-level security evidence and the no-coverage-vanity rule survive).


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
| **Config file** | `playwright.config.ts` (3 engine projects: chromium, firefox, webkit; `workers: 1`; global-setup health gate on `127.0.0.1:8080`) |
| **Quick run command** | `npx playwright test e2e/sdk.spec.ts --project=chromium` |
| **Full suite command** | `npm run verify` (+ `npm run check:size`, `node scripts/gate.mjs`) |
| **Observed runtime (2026-10-24)** | fast lane (chromium, `sdk.spec.ts`) **27.1 s**; three engines on `sdk.spec.ts` **1.8 min**; full suite `npm run verify` **7.2 min** |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test e2e/sdk.spec.ts --project=chromium` (fast lane) + `npm run check:size`
- **After every plan wave:** Run `npm run verify` (all three engines) + `npm run check:size` + `node scripts/gate.mjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** fast lane measured at **27.1 s** — inside the seeded 30 s budget, no narrowing needed

---

## Per-Task Verification Map

> **Status refresh 2026-10-24 (validate-phase §6, State A).** The seed left every row `TBD` /
> `⬜ pending` because it was written before execution. Filled from the five `02-NN-PLAN.md`
> frontmatters (`requirements:` + `wave:`) and re-asserted against a **currently green** run of
> each row's command on 2026-10-24 (evidence in the Validation Audit at the bottom).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-INT-01 | 02-01 | 1 | INT-01 | — | async script tag boots widget, nothing else leaks | e2e | `npx playwright test e2e/sdk.spec.ts` (`INT-01:` ×2) | ✅ | ✅ green |
| 02-01-WDG-04 | 02-01 | 1 | WDG-04 | T-02-04 | exactly one global, no prototype patching | e2e | `npx playwright test e2e/sdk.spec.ts` (`WDG-04:` ×1) | ✅ | ✅ green |
| 02-02-INT-02 | 02-02 | 2 | INT-02 | T-2-* | `Watchbug.init({projectKey,…})` drives a landed report | e2e | `npx playwright test e2e/sdk.spec.ts` (`INT-02:` ×1) | ✅ | ✅ green |
| 02-02-INT-05 | 02-02 | 2 | INT-05 | — | ESM import boots widget, zero window properties added | e2e | `npx playwright test e2e/sdk.spec.ts` (`INT-05:` ×1) | ✅ | ✅ green |
| 02-02-WDG-01 | 02-02 | 2 | WDG-01 | — | launcher opens the flow, 48×48 button, disabled while panel open | e2e | `npx playwright test e2e/sdk.spec.ts` (`WDG-01:` ×1) | ✅ | ✅ green |
| 02-02-WDG-02 | 02-02 | 2 | WDG-02 | T-02-02 | hostile CSS cannot hide/restyle the widget (CA-04) | e2e | `npx playwright test e2e/sdk.spec.ts` (`WDG-02:` ×5 incl. closed-bundle row + `CA-04:` control ×1) | ✅ | ✅ green |
| 02-02-WDG-03 | 02-02 | 2 | WDG-03 | T-02-04 | zero host CSS/JS/class/var leakage across a full flow | e2e | `npx playwright test e2e/sdk.spec.ts` (`WDG-03:` ×1) | ✅ | ✅ green |
| 02-02-WDG-05 | 02-02 | 2 | WDG-05 | — | widget renders above all hostile content (modal, painted overlay, z-tie, `documentElement` replacement) | e2e | `npx playwright test e2e/sdk.spec.ts` (`WDG-05:` ×4) | ✅ | ✅ green |
| 02-03-CAP-01 | 02-03 | 3 | CAP-01 | — | capture via browser prompt (stubbed seam per engine) + rejected prompt renders `failed{capture}` | e2e | `npx playwright test e2e/sdk.spec.ts` (`CAP-01:` ×2) | ✅ | ✅ green |
| 02-03-CAP-04 | 02-03 | 3 | CAP-04 | T-2-* | widget absent from capture bytes (inline `display:none` + zero accent pixels) | e2e | `npx playwright test e2e/sdk.spec.ts` (`CAP-04:` ×1) | ✅ | ✅ green |
| 02-03-CAP-05 | 02-03 | 3 | CAP-05 | — | ≤16 MP / ≤2 MB; HiDPI frame never blank; DPR clamp | e2e | `npx playwright test e2e/sdk.spec.ts` (`CAP-05:` ×4) | ✅ | ✅ green |
| 02-04-PRV-01 | 02-04 | 4 | PRV-01 | T-2-* | password fields flat-filled in encoded bytes (+1 px ring) | e2e artifact | `npx playwright test e2e/sdk.spec.ts` (`PRV-01:` ×1) | ✅ | ✅ green |
| 02-04-PRV-02 | 02-04 | 4 | PRV-02 | T-2-* | token/card patterns (Luhn) flat-filled in encoded bytes; Luhn-invalid control survives | e2e artifact | `npx playwright test e2e/sdk.spec.ts` (`PRV-02:` ×5) | ✅ | ✅ green |
| 02-04-PRV-03 | 02-04 | 4 | PRV-03 | T-2-* | `[data-watchbug-sensitive]` flat-filled in encoded bytes | e2e artifact | `npx playwright test e2e/sdk.spec.ts` (`PRV-03:` ×1) | ✅ | ✅ green |
| 02-05-PRV-05 | 02-05 | 5 | PRV-05 | T-2-* | no cookies/storage/auth headers leave the browser | e2e + static | `npx playwright test e2e/sdk.spec.ts` (`PRV-05:` ×1, sentinel scan of every header + every request byte) + `node scripts/gate.mjs sdk-no-host-storage` | ✅ | ✅ green (both) |
| 02-05-PRV-06 | 02-05 | 5 | PRV-06 | — | URL query/fragment stripped (path-only) | e2e | `npx playwright test e2e/sdk.spec.ts` (`PRV-06:` ×1) | ✅ | ✅ green |
| 02-05-PRF-01 | 02-05 | 5 | PRF-01 | — | injected core ≤ 45 KB gz | size gate | `npm run check:size` | ✅ | ✅ green |
| 02-05-PRF-04 | 02-05 | 5 | PRF-04 | — | zero runtime npm dependencies | static gate | `node scripts/gate.mjs sdk-runtime-deps` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Supporting rows outside the 18 requirement rows** (also green on all three engines): `M-3:` (forced-PNG encode → R-11/A-14), `P2-D-12:` ×2 (blank-frame aborts), `OQ-1:` (non-tab surface refused), `P2-D-03:` ×2 (retry idempotency / contract-400 fail-fast), `UI-SPEC backstop` + `UI-SPEC A-5/A-7` (240-char truncation, auto-dismiss, Escape), `H-1:` ×4 (mask geometry at DPR 1/1.25/2/3), `P2-D-08:`, `fail-closed:`, `P2-D-01:`, `self-hosted:` (zero third-party requests).

---

## Wave 0 Requirements

- [x] `e2e/sdk.spec.ts` (one suite — R-12) — 49 rows on chromium, 147 on three engines, covering every CA/requirement row above
- [x] `e2e/fixtures/hostile-host.html` + fixture loader via Playwright `page.route` fulfilment at the panel origin (Pitfall 4) — `openHostileFixture()` in `e2e/helpers/host-fixtures.ts`; `CA-04:` control row proves the hostile rules actually apply (non-vacuous)
- [x] `SHADOW_MODE` build variant wiring in `packages/sdk/scripts/build.mjs` [build.mjs:44 `closed` for production, :89 `open` for the `watchbug.e2e.*` lane] + module-scoped root registry (R-14) — `check:size` gates only the production filenames
- [x] Two-tier capture stub seam (Pitfall 2) — `e2e/helpers/capture-stubs.ts`; all 49 rows green on chromium **and** webkit (WinCairo has no `navigator.mediaDevices`), firefox exercised separately
- [x] Forced-PNG `toBlob` stub row for M-3 (Pitfall 3 / OQ-2) — `M-3:` row passes on all three engines; premise correction recorded in `resolution-record.md` A-14
- [x] `scripts/gate.mjs` exemption/wording strategy (Pitfall 1) — all three rules PASS with **no exemption**: `sdk-single-encode-sink` resolves to `encode.ts:75`, `sdk-no-host-storage` clean across 15 SDK source files
- [x] *(No framework install needed — Playwright 1.63.0 + all browsers present.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `getDisplayMedia` picker flow on a real tab | CAP-01 | Browser picker is not reliably automatable; Playwright stubs the seam | Open the fixture over HTTPS/localhost, click the launcher, confirm the picker appears, select This Tab, confirm the report lands |
| Real-Safari WebP→PNG silent fallback | M-3 / R-11 | Real Safari is not on this host (Playwright-webkit encodes real WebP here — A-14) | On macOS Safari, file a report; sniff `blob.type` in devtools console — expect `image/png`. Automation coverage is the forced-PNG `M-3:` row |

*No new manual-only rows were added by the 2026-10-24 audit — nothing was escalated.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (15 tasks across 02-01…02-05, each carrying `npm run build` / `check:size` / `gate.mjs` / `sdk.spec.ts` rows)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every plan wave closed on a three-engine `sdk.spec.ts` run)
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30 s (fast lane, chromium project — measured 27.1 s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated — 2026-10-24

---

## Validation Audit 2026-10-24

Run by `/gsd-validate-phase 2` (State A: the seeded `02-VALIDATION.md` existed with
`status: draft` — the dispatch brief described State B, but the file was present, so the
audit-and-refresh path applied).

| Metric | Count |
|--------|-------|
| Requirements in map | 18 (INT-01/02/05, WDG-01…05, CAP-01/04/05, PRV-01/02/03/05/06, PRF-01/04) |
| Gaps found (MISSING + PARTIAL) | **0** |
| Resolved | 0 (nothing to fill) |
| Escalated to manual-only | 0 new — the two pre-existing rows (real picker, real Safari) stand unchanged |
| Rows verified green | 18 / 18 |

**Why no auditor was spawned and no tests were generated:** Step 3 found zero gaps. Every
phase-2 requirement already maps to a real, currently-green automated artefact (evidence per row
in the map above). R-12 forbids adding tests beyond the one e2e suite, so filling a gap here would
have meant creating a test framework the owner has explicitly rejected twice; no row was added or
weakened, and **no source or test file was modified by this audit.**

**Evidence commands (all run 2026-10-24 against the live compose stack):**

| # | Command | Result |
|---|---------|--------|
| 1 | `npm run check:size` | **PASSED**, exit 0 — core 8.5/45, lazy 0.3/25, adapter 0.3/14, runtime 9.1/80 KB gz (PRF-01) |
| 2 | `node scripts/gate.mjs` | **PASSED**, exit 0 — 3 passed, 0 failed, 0 skipped (`sdk-runtime-deps` / `sdk-no-host-storage` / `sdk-single-encode-sink`) (PRF-04, PRV-05 static half) |
| 3 | `npx playwright test e2e/sdk.spec.ts --project=chromium` | **49 passed**, exit 0, 27.1 s |
| 4 | `npm run verify -- e2e/sdk.spec.ts` | **147 passed** (49 × chromium/firefox/webkit), exit 0, 1.8 min |
| 5 | `npm run verify` (full suite) | **312 passed**, exit 0, 7.2 min |

**Full-suite note:** the 312 includes 18 rows of `e2e/tmp-ui-audit.spec.ts`, a throwaway spec
written concurrently by the sibling UI-review capability step (it did not exist when this audit
began). 312 − 18 = **294**, exactly the phase-closing `npm run verify` count recorded in
`02-05-SUMMARY.md` — the two numbers agree, so no pre-existing row regressed.

**Seed items resolved since 2026-10-17:**
- The seeded `PRV-05` row read `✅ (gate) / ❌ e2e row` — the e2e sentinel row now exists and is green on all three engines; both halves are ✅.
- Seeded `File Exists ❌ W0` / `Status ⬜ pending` on all 18 rows → refreshed from the executed plans.

**Observed vs seeded estimate:** the seeded fast-lane budget was "keep under 30 s"; measured 27.1 s.
Full-suite runtime 7.2 min (294 phase rows at phase close), dominated by the phase-1 ING-05
daily-quota wait — not flaky, not watch-mode.
