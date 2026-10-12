---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-10-12T19:00:15.843Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | apps/api/src/app.ts | 23 | multipart fieldSize 4096 vs contract MAX_META_BYTES 65536 (plan-internal inconsistency deferred to 01-02) | open |  | 2026-10-12T17:24:59.165Z |  |
| 2 | 01 | fixme | apps/api/src/routes/incidents.ts | 104 | meta part sent with Content-Type application/json stringifies to [object Object] and 400s (pre-existing from 01-01; would break P1-D-07's onboarding curl) - see 01-contracts-ingest-slice/deferred-items.md | open |  | 2026-10-12T19:00:15.843Z |  |

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
  }
]
````
