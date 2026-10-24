---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Report POST re-leaks the page's query string in the `Referer` header (external: prv06-referrer)"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "Card pattern silently skips a valid card once the digit run is glued to neighbouring digits - two adjacent valid cards mask nothing (external: card-glue-fn)"
  - id: CR-03
    severity: critical
    disposition: fixed
    title: "The DOM scan stops at the top document's light DOM - shadow roots and same-origin iframes are never redacted (external: scanner-coverage)"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Mask geometry is collected after the frame is captured, not with it"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The ESM build's default endpoint is the *page* origin, not the loading script's"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Idempotency key falls back to `Date.now()` + `Math.random()` on every non-secure context"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "The `beyond-cap` seam stub allocates the canvas before its own \"canvas-free\" return"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "`truncateReason` cuts UTF-16 units and can split a surrogate pair"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "The P2-D-03 byte-equality assertion is vacuous on WebKit"
open: 0
fixed: 9
total: 9
recorded: 2026-10-24T18:30:00.000Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | `c2d7a50` fix(02): send report with referrerPolicy no-referrer (review CR-01) |
| CR-02 | critical | fixed | `7c9b299` fix(02): validate card digit groups so glued runs mask (review CR-02) |
| CR-03 | critical | fixed | `0c6565f` fix(02): close the code-review findings and the analysis backlog — was `deferred` 2026-10-24 and taken up again in the same day's remediation run |
| WR-01 | warning | fixed | `0c6565f` — `Redactor.collect()` / `redact(image, rects)`, rects measured inside `beforeRead` |
| WR-02 | warning | fixed | `0c6565f` — default endpoint is the document origin; cross-origin script requires `endpoint` |
| WR-03 | warning | fixed | `0c6565f` — v4 UUID from `crypto.getRandomValues`, no CSPRNG is a visible failure |
| IN-01 | info | fixed | `0c6565f` — beyond-cap return hoisted above the canvas allocation |
| IN-02 | info | fixed | `0c6565f` — `truncateReason` cuts by code points inside the same UTF-16 cap |
| IN-03 | info | fixed | `0c6565f` — non-vacuity guard where the payload is observable; engine conditionality stated in-row |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved.

**Status: 9 / 9 resolved.** Nothing is open, skipped or deferred.

## Verification of the fixes (2026-10-24, HEAD `0c6565f`)

| Check | Result |
|---|---|
| `npm run verify` | **303/303** on chromium + firefox + webkit (was 297; +2 new rows, +4 from the 3-engine matrix) |
| `npm run lint` | clean (tsc per workspace) |
| `npm run check:size` | `9.8 KB gz / 80 KB` runtime; per-lane tiers 45/25/14 held |
| `node scripts/gate.mjs` | 3 passed, 0 failed, 0 skipped |
| `npm run check:compose` | exactly three services |
| `stopthatslop check --pack ts` | `gate_finding_count: 0`, `exit 0` |

New evidence rows added by this remediation:

- **`S-7 / PRV-02`** — a secret inside an OPEN shadow root and a secret inside a
  same-origin iframe both mask in the decoded bytes. Each carries a light-DOM
  marker sized at the secret's *browser-measured* laid-out rect, so a wrong mask
  rect shows up as surviving marker pixels rather than passing vacuously.
- **`S-8`** — a cross-origin loading script without `endpoint` refuses to init
  and mounts nothing; the same bundle with an explicit endpoint mounts and posts
  to exactly that base.

## Second ledger — `02-REVIEW-FIX.md` (regression pass over the remediation)

A separate `gsd-code-reviewer` pass reviewed the remediation commit `0c6565f` itself and
found six defects **introduced by the fixes**. All six are closed in `12a5049`. These IDs
(`FX-`) never collide with the first review's; `02-REVIEW-FIX.md` is their report of record.

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| FX-01 | critical | fixed | `12a5049` — the no-CSPRNG exit now calls `host.restore()`, and row `WR-03 guard` drives that path and asserts the host is visible again |
| FX-02 | critical | fixed | `12a5049` — a frame whose path is not a pure translation is REFUSED (fail closed, OQ-1 precedent); row `S-7 guard` drives a rotated same-origin frame to a loud failure with zero POSTs |
| FX-03 | warning | fixed | `12a5049` — a non-string `endpoint` (e.g. `null` from a JSON config) is a hard `TypeError` taken before the S-8 cross-origin check; asserted in the S-8 row |
| FX-04 | warning | fixed | `12a5049` — `HostFixtureOptions.projectKey` goes through the same shape validation as the `.env` key (`fixtureKey()`) |
| FX-05 | info | fixed | `12a5049` — six corrupted comment em-dashes in `redactor.ts` restored |
| FX-06 | info | fixed | `12a5049` — `MAX_SCAN_DEPTH` exhaustion now throws instead of silently skipping a subtree |

**Status: 6 / 6 resolved.** Combined with the first ledger: **15 / 15 resolved.**

Known scope decision recorded by the FX-02 fix: the frame map supports **pure translation
only**. A scaled or rotated same-origin frame is refused loudly rather than mapped — correct
and fail-closed, but stricter than strictly necessary for pure `scale`, which *could* be mapped
exactly. That extension is deliberate backlog, not an oversight.

## Notes

Note 1: REVIEW.md authored these findings as `#### <ID>:` (h4) headings, one level deeper than the
gate's expected `### <ID>:` shape, so the automated row builder matched none of them and reported
a 9-finding shortfall. Rows were recorded by hand from the review's own headings and section
severities on 2026-10-24; counts match REVIEW.md frontmatter (3/3/3, total 9).

Note 2: REVIEW.md is the **immutable review of record** — it is not rewritten when findings are
fixed. Resolution is tracked here and, with the full narrative of what changed and why, in
`documentation/phase2/02-INFORME-ANALISIS.md` section 8. The first-pass narratives stay in
REVIEW.md and in git history (`4325046`).
