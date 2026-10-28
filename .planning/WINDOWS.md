---
schema_version: 1
open_count: 5
waived_count: 0
fixed_count: 3
total_count: 8
last_updated: 2026-10-28T16:47:18.578Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | apps/api/src/app.ts | 23 | multipart fieldSize 4096 vs contract MAX_META_BYTES 65536 (plan-internal inconsistency deferred to 01-02) | open |  | 2026-10-12T17:24:59.165Z |  |
| 2 | 01 | fixme | apps/api/src/routes/incidents.ts | 104 | meta part sent with Content-Type application/json stringifies to [object Object] and 400s (pre-existing from 01-01; would break P1-D-07's onboarding curl) - see 01-contracts-ingest-slice/deferred-items.md | open |  | 2026-10-12T19:00:15.843Z |  |
| 3 | 02 | stub | packages/sdk/src/index.ts | 114 | enterFlow() restores the host instead of running the capture pipeline; seam 02-02 Task 1 fills | fixed |  | 2026-10-23T20:36:46.302Z | 2026-10-24T11:31:55.361Z |
| 4 | 02 | stub | packages/sdk/src/widget/status-panel.ts | 176 | render(view) contract complete but only idle is rendered at mount; state callback + Escape/auto-dismiss land in 02-02 Task 2 | fixed |  | 2026-10-23T20:36:55.379Z | 2026-10-24T11:31:55.926Z |
| 5 | 02 | unmet-truth | .planning/REQUIREMENTS.md | 38 | Release-criteria wording still claims webkit exercises the WebP->PNG fallback; A-14 (02-05) records that this platform encodes real WebP and the plan was not authorised to edit R-12/REQUIREMENTS wording - owner wording delta open | fixed |  | 2026-10-24T14:39:50.992Z | 2026-10-25T14:32:12.543Z |
| 6 | 03 | stub | packages/sdk/src/widget/composer.ts |  | composer annotate/replace buttons have no wired handler yet (optional-handler mount points; wired by 03-05 with the lazy editor) | open |  | 2026-10-28T16:47:16.734Z |  |
| 7 | 03 | stub | packages/sdk/src/widget/composer.ts |  | composer attach/continue-text-only buttons have no wired handler yet (degraded/text-only composer mounts in 03-04) | open |  | 2026-10-28T16:47:17.791Z |  |
| 8 | 03 | stub | packages/sdk/src/capture/pipeline.ts |  | Draft.captureNote is stored but not rendered yet; the degraded composer consumes it in 03-04 (capture failures still show the status panel) | open |  | 2026-10-28T16:47:18.578Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "apps/api/src/app.ts",
    "line": 23,
    "description": "multipart fieldSize 4096 vs contract MAX_META_BYTES 65536 (plan-internal inconsistency deferred to 01-02)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T17:24:59.165Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 2,
    "kind": "fixme",
    "phase": "01",
    "file": "apps/api/src/routes/incidents.ts",
    "line": 104,
    "description": "meta part sent with Content-Type application/json stringifies to [object Object] and 400s (pre-existing from 01-01; would break P1-D-07's onboarding curl) - see 01-contracts-ingest-slice/deferred-items.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T19:00:15.843Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 3,
    "kind": "stub",
    "phase": "02",
    "file": "packages/sdk/src/index.ts",
    "line": 114,
    "description": "enterFlow() restores the host instead of running the capture pipeline; seam 02-02 Task 1 fills",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-23T20:36:46.302Z",
    "resolved_at": "2026-10-24T11:31:55.361Z",
    "milestone": null
  },
  {
    "id": 4,
    "kind": "stub",
    "phase": "02",
    "file": "packages/sdk/src/widget/status-panel.ts",
    "line": 176,
    "description": "render(view) contract complete but only idle is rendered at mount; state callback + Escape/auto-dismiss land in 02-02 Task 2",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-23T20:36:55.379Z",
    "resolved_at": "2026-10-24T11:31:55.926Z",
    "milestone": null
  },
  {
    "id": 5,
    "kind": "unmet-truth",
    "phase": "02",
    "file": ".planning/REQUIREMENTS.md",
    "line": 38,
    "description": "Release-criteria wording still claims webkit exercises the WebP->PNG fallback; A-14 (02-05) records that this platform encodes real WebP and the plan was not authorised to edit R-12/REQUIREMENTS wording - owner wording delta open",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-24T14:39:50.992Z",
    "resolved_at": "2026-10-25T14:32:12.543Z",
    "milestone": null
  },
  {
    "id": 6,
    "kind": "stub",
    "phase": "03",
    "file": "packages/sdk/src/widget/composer.ts",
    "line": null,
    "description": "composer annotate/replace buttons have no wired handler yet (optional-handler mount points; wired by 03-05 with the lazy editor)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T16:47:16.734Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 7,
    "kind": "stub",
    "phase": "03",
    "file": "packages/sdk/src/widget/composer.ts",
    "line": null,
    "description": "composer attach/continue-text-only buttons have no wired handler yet (degraded/text-only composer mounts in 03-04)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T16:47:17.791Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 8,
    "kind": "stub",
    "phase": "03",
    "file": "packages/sdk/src/capture/pipeline.ts",
    "line": null,
    "description": "Draft.captureNote is stored but not rendered yet; the degraded composer consumes it in 03-04 (capture failures still show the status panel)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T16:47:18.578Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
