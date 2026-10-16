---
phase: 261016-nnx
plan: 1
subsystem: api
tags: [rate-limit, typescript, typecheck, sec-05, ci]
status: complete
type: quick
requirements: ["SEC-05"]
dependency_graph:
  requires:
    - "@fastify/rate-limit v11 discriminated return union (node_modules/@fastify/rate-limit/types/index.d.ts:15-31)"
    - "apps/api/src/plugins/rate-limit.ts createReadRateLimit (quick task 261014-m3w, runtime fix 62195bb)"
  provides:
    - "createReadRateLimit narrowing by the isAllowed discriminant — CI 'Build + typecheck' green"
  affects:
    - "apps/api/src/plugins/rate-limit.ts"
tech-stack:
  added: []
  patterns:
    - "discriminated-union narrowing mirrored from createIngestRateLimit (!x.isAllowed && x.isExceeded)"
key-files:
  created: []
  modified:
    - apps/api/src/plugins/rate-limit.ts
decisions:
  - "Narrow by runtime discriminant instead of @ts-expect-error/as/any (T-261016-nnx-01): a suppression would keep the gate untyped and let the 429-on-first-read regression ship unnoticed."
  - "Single-line `ipStatus.isAllowed || !ipStatus.isExceeded` preferred over a separate `if (ipStatus.isAllowed) return;` line — smaller diff, same narrowing."
  - "Comment corrected (not rewritten) so the prose stops implying isAllowed is never consulted; the isAllowed term is documented as the allow-list short-circuit plus the narrowing."
metrics:
  duration: "~10 min"
  tasks: 1
  files: 1
  completed: 2026-10-16
actuals:
  tokens: 2300
  tasks: 1
  commits: 1
commits: 1
plan_head_before: af4401dd50590f9c9a368315115b85ea40dd7f6f
plan_head_after: bc775abf609cd6f83761085399a7cdb940cf1215
---

# Phase 261016-nnx Plan 1: Fix the API read rate-limit typecheck error Summary

Narrowed `createReadRateLimit`'s guard by the `@fastify/rate-limit` return union's `isAllowed` discriminant so `isExceeded` / `ttlInSeconds` typecheck again — CI's "Build + typecheck" job is green, with zero runtime behaviour change.

## What Was Done

Commit `62195bb` correctly fixed the read limiter's runtime gate (`isAllowed` alone 429'd the first read of a fresh window) but left a type-level regression: `app.createRateLimit()` returns a discriminated union whose `isAllowed: true` arm carries neither `isExceeded` nor `ttlInSeconds`, so the bare read of those properties produced TS2339 at `rate-limit.ts:94` and `:95`.

One guard was changed and its explanatory comment corrected:

```diff
-    if (!ipStatus.isExceeded) return;
+    // Here the `isAllowed` term is the allow-list short-circuit (it also narrows
+    // the return union, whose `isAllowed: true` arm carries no `isExceeded`),
+    // while `!isExceeded` remains the counted-request pass/fail test.
+    if (ipStatus.isAllowed || !ipStatus.isExceeded) return;
```

TypeScript narrows the right operand of `||` by the falsy left discriminant and narrows the code after the `if` to the `isAllowed: false` arm (both terms false ⇒ `isAllowed` false), which is exactly the shape `createIngestRateLimit` already compiles with (`!x.isAllowed && x.isExceeded`). The form is provably semantics-preserving: `applyRateLimit()` returns `isAllowed: true` only from the `allowList` branch, which this factory does not configure, so the added term is a defensive allow-list short-circuit that becomes load-bearing only if an `allowList`/`ban` is ever added here.

## Deviations from Plan

None - plan executed exactly as written.

The one judgement call the plan already sanctioned: the comment's third added sentence was folded in without reflowing the surrounding prose (the plan's action said "Add one sentence clarifying… Do not reflow or rewrite the rest of the file's prose").

## Verification Evidence

| Gate | Before | After |
|------|--------|-------|
| `npm run lint` (the red CI step) | exit 1 — `src/plugins/rate-limit.ts(94,19): error TS2339` and `(95,67): error TS2339` | **exit 0**, zero diagnostics in `apps/api` |
| `node scripts/gate.mjs` | — | exit 0 — 2 passed, 0 failed, 1 skipped |
| `npm run check:compose` | — | exit 0 — exactly three services; attachments volume only in `api` |
| `git diff --stat` | — | 1 file changed, 4 insertions(+), 1 deletion(-) |

The TS2339 errors were reproduced locally byte-identical to CI before the fix, and the full `npm run lint` (all four workspaces, `tsc -p tsconfig.json` each) exits 0 after it.

Not run: `npm run verify -- e2e/read-surface.spec.ts` (verification item 2, optional — requires the compose stack healthy at `http://127.0.0.1:8080/api/health`). The plan marks it optional; the change is a type-level narrowing whose runtime condition is provably equivalent to the committed `!ipStatus.isExceeded`. Row 1 of `e2e/read-surface.spec.ts` remains the semantics guard for anyone running the full suite.

## Threat Model Disposition

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-261016-nnx-01 | mitigate | Narrowed by runtime discriminant; no error-suppression construct used. The gate stays honest and the CI error stays visible if the union ever gains a counted-request `isAllowed: true` arm. |
| T-261016-nnx-02 | mitigate | Change scoped to `createReadRateLimit` alone. `createIngestRateLimit`, `resolveIngestRateLimits` and `retryAfterSeconds` are byte-identical, so the ING-05 429 shapes and CR-01 bucket semantics asserted in `e2e/hostile.spec.ts` are untouched. |
| T-261016-nnx-SC | mitigate | Nothing installed. No `[ASSUMED]` / `[SUS]` package entered the tree. |

## Known Stubs

None. No stub pattern was introduced; the change is a type narrowing plus a comment correction.

## Self-Check: PASSED

- `apps/api/src/plugins/rate-limit.ts` — FOUND (modified, guard reads `if (ipStatus.isAllowed || !ipStatus.isExceeded) return;`)
- commit `bc775ab` — FOUND (`bc775abf609cd6f83761085399a7cdb940cf1215`, 1 file changed, 4 insertions, 1 deletion)
- `npm run lint` exit 0 — CONFIRMED
- worktree/scope: only `apps/api/src/plugins/rate-limit.ts` staged; pre-existing `documentation/phase1/*` changes left untouched
