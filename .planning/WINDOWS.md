---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-10-12T17:24:59.165Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | apps/api/src/app.ts | 23 | multipart fieldSize 4096 vs contract MAX_META_BYTES 65536 (plan-internal inconsistency deferred to 01-02) | open |  | 2026-10-12T17:24:59.165Z |  |

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
  }
]
````
