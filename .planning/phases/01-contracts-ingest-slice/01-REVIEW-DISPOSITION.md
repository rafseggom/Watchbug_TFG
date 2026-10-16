---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Per-key and per-day rate-limit buckets are keyed on the raw header while the gate trims it — quota bypass by header padding"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "`trustProxy=true` (the documented/verified deployment setting) makes the per-IP limiter spoofable — `req.ip` is the client-controlled leftmost X-Forwarded-For entry"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Idempotent-replay lookup is not scoped to the project — wrong (cross-tenant) id on conflict"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "A-06's 2 MB semantic cap is checked only on the input — the stored re-encode is never re-capped"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Blob written before insert with no cleanup — orphaned files accumulate on any DB failure"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "`.env.example`'s shipped rate-limit values make the documented quickstart fail `npm run verify`"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "The streaming-413 watcher races the route handler — double `reply.send` and false 500 logs"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "The API container runs as root"
  - id: IN-01
    severity: info
    disposition: open
    title: "Body parsing runs before the rate-limit preHandler — up to 1 MB of JSON is parsed before any limiter"
  - id: IN-02
    severity: info
    disposition: open
    title: "Blob route opens the read stream before validating the stored content type"
  - id: IN-03
    severity: info
    disposition: open
    title: "The panel HTML document ships without a CSP"
  - id: IN-04
    severity: info
    disposition: open
    title: "R-08's path-only `url` rule is not enforced anywhere server-side"
  - id: IN-05
    severity: info
    disposition: open
    title: "The `BodyCapExceeded` branch is unreachable *and* destroys the socket before the reply is sent"
open: 5
total: 13
recorded: 2026-10-13T00:00:33.508Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | REVIEW-FIX.md |
| CR-02 | critical | fixed | REVIEW-FIX.md |
| WR-01 | warning | fixed | REVIEW-FIX.md |
| WR-02 | warning | fixed | REVIEW-FIX.md |
| WR-03 | warning | fixed | REVIEW-FIX.md |
| WR-04 | warning | fixed | REVIEW-FIX.md |
| WR-05 | warning | fixed | REVIEW-FIX.md |
| WR-06 | warning | fixed | REVIEW-FIX.md |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
