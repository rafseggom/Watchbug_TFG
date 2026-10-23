---
schema_version: 1
open_count: 4
waived_count: 0
fixed_count: 0
total_count: 4
last_updated: 2026-10-23T20:36:55.379Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | apps/api/src/app.ts | 23 | multipart fieldSize 4096 vs contract MAX_META_BYTES 65536 (plan-internal inconsistency deferred to 01-02) | open |  | 2026-10-12T17:24:59.165Z |  |
| 2 | 01 | fixme | apps/api/src/routes/incidents.ts | 104 | meta part sent with Content-Type application/json stringifies to [object Object] and 400s (pre-existing from 01-01; would break P1-D-07's onboarding curl) - see 01-contracts-ingest-slice/deferred-items.md | open |  | 2026-10-12T19:00:15.843Z |  |
| 3 | 02 | stub | packages/sdk/src/index.ts | 114 | enterFlow() restores the host instead of running the capture pipeline; seam 02-02 Task 1 fills | open |  | 2026-10-23T20:36:46.302Z |  |
| 4 | 02 | stub | packages/sdk/src/widget/status-panel.ts | 176 | render(view) contract complete but only idle is rendered at mount; state callback + Escape/auto-dismiss land in 02-02 Task 2 | open |  | 2026-10-23T20:36:55.379Z |  |

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
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-23T20:36:46.302Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 4,
    "kind": "stub",
    "phase": "02",
    "file": "packages/sdk/src/widget/status-panel.ts",
    "line": 176,
    "description": "render(view) contract complete but only idle is rendered at mount; state callback + Escape/auto-dismiss land in 02-02 Task 2",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-23T20:36:55.379Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
