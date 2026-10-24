---
phase: "02"
slug: sdk-tracer-bullet-widget-capture-auto-redaction
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-24"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

Consolidated from the `<threat_model>` blocks of `02-01`, `02-02`, `02-03`, `02-04` and `02-05` PLAN.md.

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Hostile host page → widget | the host's CSS/JS/DOM is untrusted input the widget must survive (TB-1) | styles, DOM structure, dynamic strings |
| Widget dynamic text → shadow DOM | server rejection reasons and host-controlled title strings render in the widget | untrusted text (must render inert) |
| Widget → host document | INV-01/INV-02: nothing may leak back into the host page | styles, globals (must be zero) |
| Browser capture surface → frame | the picker can return any surface; only tab frames map to the page DOM | screen/window/tab pixels |
| Host DOM content → mask rects | hostile/unusual DOM shapes decide what gets destroyed before encode | element/text rects + pattern matches |
| CSS-pixel geometry → bitmap pixels | the H-1 mapping boundary where misregistration leaks characters | rect coordinates × DPR/zoom |
| Capture pipeline → encoded bytes | the SEC-02 boundary: no unmasked byte may cross it (also `Raw ImageData → encoded bytes`) | screenshot pixels |
| Redaction outcome → transport | fail-open here is the one failure mode the core value forbids | redaction errors must never become sends |
| Capture outcome → user | failures must be visible states, never silent data loss (M-6) | failure states |
| Host page state → outbound report | SEC-03: nothing from host cookies/storage/auth may ride along | report payload |
| Host-controlled URL/title → meta | untrusted strings must be shaped by the closed contract before they leave | `title`, `url` |
| Build output → shipped bundle | the budget/dependency gates stand between source and the 45 KB promise | bundle bytes |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | T | dynamic text rendering in the widget (server reason, title) | high | mitigate | text-only rendering: every dynamic write is `textContent`; 240-char truncation; no HTML sink literal anywhere under `packages/sdk/src` (grep: 0 `innerHTML`/`insertAdjacentHTML` hits — `launcher.ts:15` mentions it only in a comment) — `packages/sdk/src/widget/status-panel.ts:19,162,352` | closed |
| T-02-02 | T/D | hostile host CSS vs widget visibility/behaviour | high | mitigate | inline `!important` host style (`display: block !important` …), `all: initial` + re-declared px-only properties in the shadow root, closed root, last-child-of-`documentElement` + re-assert observers; production build pins `SHADOW_MODE: 'closed'` — `packages/sdk/src/widget/host.ts:27-46,59-91,136,150-151,175-186`, `packages/sdk/scripts/build.mjs:44` | closed |
| T-02-03 | I | unmasked capture bytes existing before redaction | critical | mitigate | A-05 port type: `capture(): Promise<ImageData>` (no `Blob` in the seam); `pipeline.ts` runs `redactor.redact(image)` strictly before `encode(image)`; `encodeLadder` documented as never seeing a pre-mask pixel — `packages/sdk/src/capture/capture-source.ts:30-32`, `packages/sdk/src/capture/pipeline.ts:216-240`, `packages/sdk/src/image/encode.ts:161-167` | closed |
| T-02-04 | I | widget leaking styles/globals into the host | medium | mitigate | single `<style>` appended **inside** the shadow root only (`root.appendChild(style)` — the only `createElement('style')` in the SDK, no `document.head` write, `adoptedStyleSheets` forbidden in comment), `--wb-*` local tokens, one `window.Watchbug` global, no prototype patching, no `customElements` registration — `packages/sdk/src/widget/host.ts:18-23,74-91,138-140`, `packages/sdk/src/index.ts:7-10` | closed |
| T-02-05 | I | non-tab capture surface (window/screen) | high | mitigate | `displaySurface` policy: `'window'`/`'screen'` and any non-`'browser'` surface throw `CaptureUnavailableError` before any pixel read (nothing sent); `undefined` accepted with documented OQ-1 caveat — `packages/sdk/src/capture/capture-source.ts:148-173` | closed |
| T-02-06 | R/D | silent blank or stale capture as data loss | medium | mitigate | 9-pixel 3×3 `blankProbe` (uniform / empty / oversize → visible `failed: blank` state) + 10 s no-frame timeout in `waitForFrame`; every failure path lands in a panel state — `packages/sdk/src/capture/pipeline.ts:34-87,210-214`, `packages/sdk/src/capture/capture-source.ts:83` | closed |
| T-02-07 | T | encode path bypassing the single sink or the redaction order | high | mitigate | `sdk-single-encode-sink` gate: exactly one `toBlob` call site in the SDK (gate output: `image/encode.ts:75`); ladder invoked only from `pipeline.ts` after `redactor.redact()` — `scripts/gate.mjs` run 2026-10-24, `packages/sdk/src/capture/pipeline.ts:225-240` | closed |
| T-02-08 | I | pattern-catalog false negatives | critical | mitigate | P2-D-07 catalog locked to the four C-5 family groups (JWT / bearer / credential-assignment / card) recorded for both text nodes and input values, card shape gated by hand-rolled `luhnValid()` over **separator-delimited digit groups plus adjacent-group joins of 13–19 digits** (`luhnValidCardRun`) — conservative whole-node over-masking — `packages/sdk/src/redact/patterns.ts:46-69,76-136`, `packages/sdk/src/redact/redactor.ts:99-127`; **evidence:** `e2e/sdk.spec.ts` `PRV-02: a Luhn-valid card sequence masks while its Luhn-invalid lookalike stays visible in the decoded bytes` + `PRV-02: two Luhn-valid cards glued in one text node mask the whole node — zero original pixels in the rect on the decoded bytes` (marker painted, zero original pixels in the rect, artifact-level decode; lookalike row pins P2-D-07), green on chromium + firefox + webkit (`npm run verify -- e2e/sdk.spec.ts`, 150 passed, 2026-10-24). *Note: the glue false-negative (two adjacent valid cards masking nothing) was found by review CR-02 and fixed in `7c9b299` — before that fix this row's closure rested on isolated cards only.* | closed |
| T-02-09 | I | HiDPI/zoom mask misregistration leaking edge characters | high | mitigate | single `geometry.ts` mapping derived from the actual frame vs live viewport (`transformFor`), outward rounding only (floor origin / ceil extent) — used by every mask source through one call — `packages/sdk/src/redact/geometry.ts:37-62`, `packages/sdk/src/redact/redactor.ts:141-147` | closed |
| T-02-10 | I | redaction fail-open on error | critical | mitigate | fail-closed: `redactor.redact(image)` wrapped in `try/catch` that short-circuits **before** encode/send into the loud terminal state (returns at `pipeline.ts:230`); no step in `collectMaskRects`/`fillRects` swallows an error — `packages/sdk/src/capture/pipeline.ts:225-230`, `packages/sdk/src/redact/redactor.ts:22-25,99-131` | closed |
| T-02-11 | I | host credential exfiltration via the report payload | critical | mitigate | explicit-field `buildMeta` (never a spread), only two headers (`X-Project-Key`, `Idempotency-Key`), `credentials: 'omit'` **and `referrerPolicy: 'no-referrer'`** on every POST (review CR-01 fix `c2d7a50` — the host page's own Referrer-Policy is untrusted input per TB-1); static gate `sdk-no-host-storage` PASS (15 SDK source files clean); **evidence:** `e2e/sdk.spec.ts` PRV-05 asserts the intercepted report carries NO `referer` header at all (absence, via `request.allHeaders()`) and dropped `referer` from `BROWSER_STANDARD_HEADERS`, so its mere presence fails the row — green on chromium + firefox + webkit (`npm run verify -- e2e/sdk.spec.ts`, 150 passed, 2026-10-24) — `packages/sdk/src/transport/lane1.ts:33-38,85-97,141-153`, `scripts/gate.mjs` run 2026-10-24 | closed |
| T-02-12 | I | URL query/fragment leaking tokens into meta | high | mitigate | SDK sends `location.pathname` only (query/fragment stripped client-side); schema `stripQueryFragment` transform as defence in depth on the contract; **header half (review CR-01 fix `c2d7a50`):** `referrerPolicy: 'no-referrer'` on the report POST, evidenced by `e2e/sdk.spec.ts` PRV-06 — the row navigates the fixture to `?variant=clean&token=secret#frag`, a non-vacuity probe proves a browser-default same-origin request DOES leak `token=secret` in its `referer` (so the header is observable on every engine), then asserts the SDK's own report carries no `referer` at all — green on chromium + firefox + webkit (`npm run verify -- e2e/sdk.spec.ts`, 150 passed, 2026-10-24) — `packages/sdk/src/transport/lane1.ts:95,149-151`, `packages/contracts/src/schema.ts:34,53` | closed |
| T-02-13 | I | supply-chain/dependency creep inside the shipped bundle | medium | mitigate | `sdk-runtime-deps` gate PASS (runtime block = `@watchbug/contracts` only; `packages/sdk/package.json` adds nothing else); every contracts import in the SDK is `@watchbug/contracts/constants` or `import type` — zero `zod` import under `packages/sdk/src`; `npm run check:size` PASSED (core 8.5/45 KB gz, runtime 9.1/80 KB gz) — `scripts/gate.mjs`, `scripts/check-size.mjs` runs 2026-10-24 | closed |
| T-02-14 | I | secrets inside cross-origin iframe pixels | medium | accept | the DOM scanner cannot reach third-party documents; tab captures include their pixels. Acceptance rationale: over-masking cannot fix unknown locations; documented as integration limitation OQ-3, revisit only via a consultation-triggering public API change — `02-04-PLAN.md:181,209`; see AR-01 | closed |
| T-02-SC | T | npm/pip/cargo installs (package legitimacy) | high | mitigate | package-legitimacy gate carried from Phase 01 (P1-D-10); this phase adds zero dependencies (`packages/sdk/package.json`: workspace dep `@watchbug/contracts` + pinned `esbuild` devDep only) and `sdk-runtime-deps` gate PASS reconfirms it — `01-01-SUMMARY.md § Package gate`, `scripts/gate.mjs` run 2026-10-24 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (`high`) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Verification method.** `workflow.security_asvs_level: 1` with `register_authored_at_plan_time: true` (all five PLAN.md files carry a parseable `<threat_model>` block) and `threats_open: 0` — the L1 short-circuit applies, and each cited mitigation was additionally confirmed by **reading the full implementation file**, not just grepping for a literal (every row above carries `file:line` from a direct source read). Gate evidence is real command output recorded in the audit trail below.

No `## Threat Flags` section exists in any of the five SUMMARY.md files, so there are no executor-reported unregistered flags to reconcile. (Note: image-borne XSS in uploaded bytes was deliberately NOT minted per ADR-550 D6 — it is server-side canon C-3/C-4 owned by Phase 1, referenced by T-02-07's ordering control, `02-03-PLAN.md:216`.)

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-02-14 | Cross-origin iframe content in a tab capture cannot be DOM-scanned; secrets inside third-party embeds ride along in the pixels. No v1 mechanism can mask unknown locations without a consultation-triggering public API change (OQ-3). Documented as an integration limitation for Phase 5+ integration docs. | owner | 2026-10-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-24 | 15 | 15 | 0 | gsd-security-auditor (subagent) — L1 pass w/ full-source reads (ASVS 1 short-circuit; register authored at plan time) |

**Gate evidence (2026-10-24, real output):**

```
node scripts/gate.mjs
PASS  sdk-runtime-deps        runtime blocks contain only: @watchbug/contracts
PASS  sdk-no-host-storage     15 SDK source file(s) clean of host storage/credential access
PASS  sdk-single-encode-sink  packages/sdk/src/image/encode.ts:75  toBlob
gate.mjs summary: 3 passed, 0 failed, 0 skipped
gate.mjs PASSED

npm run check:size
SIZE OK   core     8.5 KB gz / 45 KB
SIZE OK   lazy     0.3 KB gz / 25 KB
SIZE OK   adapter  0.3 KB gz / 14 KB
SIZE OK   runtime  9.1 KB gz / 80 KB
check:size PASSED
```

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-24
