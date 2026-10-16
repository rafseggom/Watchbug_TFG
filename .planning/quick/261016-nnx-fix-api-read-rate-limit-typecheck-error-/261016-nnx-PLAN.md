---
phase: 261016-nnx
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/api/src/plugins/rate-limit.ts
requirements: ["SEC-05"]
autonomous: true

must_haves:
  truths:
    - "`npm run lint` — the repo's `typecheck --workspaces` and the exact step of CI job 'Build + typecheck' that is currently red — exits 0 with zero diagnostics at apps/api/src/plugins/rate-limit.ts:94 and :95 (today it reports TS2339 on `isExceeded` and on `ttlInSeconds`)."
    - "The guard in `createReadRateLimit` narrows the `createRateLimit()` return union by its `isAllowed` discriminant BEFORE reading `isExceeded` / `ttlInSeconds`, so those two reads are reachable only for the `isAllowed: false` variant."
    - "Runtime admission behaviour is unchanged and provably so: a counted request at or under the per-IP maximum still passes to the handler (no 429 on the first read of a fresh window — the exact regression 62195bb fixed), and an exceeded request still answers a structured 429 carrying an integer `retry-after` of at least 1."
    - "The ingest path is untouched: `createIngestRateLimit`, `resolveIngestRateLimits` and `retryAfterSeconds` keep their current bodies, so the ING-05 429 shapes asserted in e2e/hostile.spec.ts stay byte-identical."
    - "No error-suppression construct was substituted for narrowing, and no unit test was added (R-12: this repo has no unit-test suite and never will)."
  artifacts:
    - "apps/api/src/plugins/rate-limit.ts — `createReadRateLimit`'s preHandler guard reads `if (ipStatus.isAllowed || !ipStatus.isExceeded) return;` on the line that currently reads `if (!ipStatus.isExceeded) return;`, and the explanatory comment immediately above it no longer reads as though `isAllowed` is never consulted."
  key_links:
    - "`app.createRateLimit()` return type (node_modules/@fastify/rate-limit/types/index.d.ts:15-31) ↔ the guard in `createReadRateLimit` (line 94) ↔ the `isExceeded` / `ttlInSeconds` reads (lines 94-95). Break the narrowing and the CI typecheck goes red again — this is the exact link CI is failing on today."
    - "`createReadRateLimit` guard ↔ e2e/read-surface.spec.ts:25 row, whose under-limit assertion (`expect(res.status()).toBe(200)`) plus its fresh-IP assertion are the runtime-semantics guard: they fail if the guard ever inverts back to gating on `isAllowed` alone."
---

<objective>
Repair the type-level regression introduced by commit 62195bb in `createReadRateLimit` (apps/api/src/plugins/rate-limit.ts) so CI job "Build + typecheck" is green again, without changing one byte of runtime behaviour.

Purpose: `62195bb` correctly changed the read limiter's gate from `if (ipStatus.isAllowed) return;` to `if (!ipStatus.isExceeded) return;` — gating on `isAllowed` alone 429'd the very first read of a fresh window (measured: 429 on request #1 after a container restart, cascading into 46 suite failures) because in `@fastify/rate-limit` v11 `applyRateLimit()` returns `isAllowed: true` ONLY for allow-listed keys, while every counted request comes back `isAllowed: false` with `isExceeded: current > max`. That runtime fix is right and stays. But `app.createRateLimit()` is typed as a discriminated union whose `isAllowed: true` arm carries neither `isExceeded` nor `ttlInSeconds`, so the unguarded read of those properties no longer typechecks. The runtime behaviour of the current line is already correct; only the type level regressed.

Output: one narrowed guard in `apps/api/src/plugins/rate-limit.ts`; `npm run lint` green.

Scope notes: one file, one guard, plus a comment correction so the code and its rationale do not contradict. No dependency, no env var, no contract change, no schema change, no e2e change, no CHANGELOG. `createIngestRateLimit` (which already compiles, because it writes `!x.isAllowed && x.isExceeded` and thereby narrows) is the proven pattern to mirror, and it must not be refactored — e2e/hostile.spec.ts asserts its ING-05 429 shapes and CR-01 bucket semantics verbatim.

No tracer task (deliberate, `--no-tracer` rationale): the vertical slice this code belongs to already exists and is proven end-to-end — `createReadRateLimit` was wired through the composition root into both GET routes and given a passing Playwright row in quick task 261014-m3w, and the runtime fix already shipped in 62195bb. A tracer bullet would add no architectural information; this is a type-level repair inside an already-proven slice.
</objective>

<execution_context>
@C:/Users/Dekker/.config/opencode/gsd-core/workflows/execute-plan.md
@C:/Users/Dekker/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@AGENTS.md

# The failing file — `createReadRateLimit` at 76-104 is the only thing in scope; its guard is line 94
@apps/api/src/plugins/rate-limit.ts
# The union type that produces TS2339 — lines 15-31 (createRateLimit signature)
@node_modules/@fastify/rate-limit/types/index.d.ts
# The runtime-semantics guard: row at line 25 asserts under-limit reads return 200 and fresh IPs are not blocked
@e2e/read-surface.spec.ts
# The ING-05 429-shape / CR-01 rows that pin the POST limiters this plan must not disturb (~543-834)
@e2e/hostile.spec.ts
# CI job "Build + typecheck" — the red step is `npm run lint`
@.github/workflows/ci.yml

## Decided (do not revisit)
- The runtime gate introduced by 62195bb is CORRECT and stays: `isExceeded` (not `isAllowed`) is the counted-request pass/fail test. Only the type narrowing is being added.
- R-12: e2e + property assertions ONLY — no unit tests, no coverage thresholds. Verification is `npm run lint` plus the one existing `npm run verify` suite.
- Keep the 429 body shape, the `retry-after` header and the `RATE_LIMIT_PER_IP_PER_MIN` message text exactly as they are.
- No new dependencies, no new env vars, no new files (R-18 reuse-first).

## Key mechanical facts verified during planning
- **The two CI errors reproduce locally, byte-identical to CI.** `npm run lint` (root) = `npm run typecheck --workspaces --if-present` = `tsc -p tsconfig.json` per workspace, and `.github/workflows/ci.yml` job "Build + typecheck" step "Typecheck (tsc --noEmit, per workspace)" runs exactly `npm run lint`. Current output: `src/plugins/rate-limit.ts(94,19): error TS2339: Property 'isExceeded' does not exist on type '{ isAllowed: true; key: string; } | { isAllowed: false; … }'` and `src/plugins/rate-limit.ts(95,67): error TS2339: Property 'ttlInSeconds' does not exist on type …`. Exit code 1.
- **The preferred one-line form compiles.** Verified out-of-tree with `tsc --noEmit --strict` against a minimal reproduction of the same two-arm union: `if (status.isAllowed || !status.isExceeded) return;` then `status.ttlInSeconds` exits 0. TypeScript narrows the right operand of `||` by the falsy left discriminant, and narrows the code after the `if` to the `isAllowed: false` arm (both terms false ⇒ `isAllowed` false).
- **`isAllowed: true` is unreachable for this factory today, so the guard is semantics-preserving.** node_modules/@fastify/rate-limit/index.js returns `{ isAllowed: true, key }` from exactly one place — the `allowList` branch (lines 258-273). `createReadRateLimit` configures `{ max: maxPerMinute, timeWindow: '1 minute', keyGenerator: (req) => req.ip }` and no `allowList`, so `isAllowed` is always `false` and `ipStatus.isAllowed || !ipStatus.isExceeded` reduces to today's `!ipStatus.isExceeded`. The added left term is defensive (it becomes load-bearing only if an `allowList`/`ban` is ever configured on this factory) and it is what makes the type legal.
- **The other arm's field set is exactly** `key, max, timeWindow, remaining, ttl, ttlInSeconds, isExceeded, isBanned` (types/index.d.ts:20-30) — `ttlInSeconds` at line 95 is the second, and only other, property read that needs the narrowing.
- **`retryAfterSeconds(ttlInSeconds)` is a pure exported helper** (lines 67-69, `Math.max(1, Math.ceil(ttlInSeconds))`) and takes a plain `number`; it needs no change.
- **Commit 62195bb touched exactly this file plus the two e2e specs** (+8/-1 in rate-limit.ts) — it added lines 88-93's comment and rewrote line 94. The comment was written for a guard that never mentioned `isAllowed`, hence the comment correction in Task 1.
- **Working tree note:** branch `gsd/phase-1-contracts-ingest`; the untracked `documentation/phase1/*` artefacts and the deleted `documentation/phase1/INFORME-ANALISIS.md` are pre-existing and OUT of scope — the executor must stage only `apps/api/src/plugins/rate-limit.ts`.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Narrow the rate-limit union in createReadRateLimit (one-line guard + comment correction)</name>
  <files>apps/api/src/plugins/rate-limit.ts</files>
  <action>In apps/api/src/plugins/rate-limit.ts, inside the `readRateLimit` preHandler returned by `createReadRateLimit`, change the guard on line 94 from `if (!ipStatus.isExceeded) return;` to the union-narrowing form `if (ipStatus.isAllowed || !ipStatus.isExceeded) return;`.

Why this exact form: `byIp` is `app.createRateLimit({ max: maxPerMinute, timeWindow: '1 minute', keyGenerator: (req) => req.ip })`, whose return value is typed in node_modules/@fastify/rate-limit/types/index.d.ts lines 15-31 as the discriminated union `{ isAllowed: true; key: string } | { isAllowed: false; key; max; timeWindow; remaining; ttl; ttlInSeconds; isExceeded; isBanned }`. `isExceeded` and `ttlInSeconds` exist on the `isAllowed: false` arm only, so line 94's bare read of `isExceeded` and line 95's read of `ipStatus.ttlInSeconds` (inside the `retryAfterSeconds(...)` call) both fail with TS2339 because nothing narrowed the union first. The new left-hand term tests the `isAllowed: true` arm out first, so TypeScript narrows `ipStatus` to the `isAllowed: false` arm for the code after the `if` (and for the right operand of the `||`). This mirrors the pattern `createIngestRateLimit` already compiles with — `!keyStatus.isAllowed && keyStatus.isExceeded` at lines 155-160 — so mirror it rather than inventing a different narrowing style (a separate `if (ipStatus.isAllowed) return;` line above would also compile; the single-line `||` form is preferred as the smaller diff).

Do NOT suppress the error instead of narrowing: no `@ts-expect-error`, no `as`, no `any`, no non-null assertion, and do not widen `byIp`'s inferred return type or add an explicit annotation that erases the union. A suppression would silence a real contract boundary — it would stop the compiler from flagging the day the plugin starts returning `isAllowed: true` for a counted request — while leaving the admission gate effectively untyped. The narrowing guard IS the fix.

Do NOT change runtime behaviour. Leave `reply.header('retry-after', String(retryAfterSeconds(ipStatus.ttlInSeconds)))` and the whole `reply.code(429).send({ statusCode: 429, error: 'Too Many Requests', message: 'rate limit exceeded: RATE_LIMIT_PER_IP_PER_MIN …' })` block (lines 95-102) byte-identical, and leave `retryAfterSeconds` (lines 67-69) and `resolveIngestRateLimits` (lines 54-60) untouched. Do NOT touch `createIngestRateLimit` (lines 113-172) or its three limiter constructions — e2e/hostile.spec.ts pins its 429 shapes and its CR-01 NBSP bucket behaviour. The guard is provably equivalent to today's line: `applyRateLimit()` in node_modules/@fastify/rate-limit/index.js returns `isAllowed: true` only from the `allowList` branch (lines 258-273), which this factory does not configure, so `isAllowed` is always `false` here and the new condition reduces to `!ipStatus.isExceeded`. The added term is defensive, and it is exactly what makes the type legal.

Then correct the explanatory comment directly above the guard (lines 88-93) so it stops contradicting the code: it currently reads as though `isAllowed` is never consulted. Keep its substance — in `@fastify/rate-limit` v11 `applyRateLimit()` returns `isAllowed: true` only for allow-listed keys, every counted request comes back `isAllowed: false` with `isExceeded: current > max`, and gating on `isAllowed` alone 429s the first read of a fresh window (measured: 429 on request #1 after a container restart). Add one sentence clarifying that the `isAllowed` term in this guard is the allow-list short-circuit while `!isExceeded` remains the counted-request pass/fail test. Do not reflow or rewrite the rest of the file's prose.

Stage only apps/api/src/plugins/rate-limit.ts (the untracked documentation/phase1/* files in this working tree are unrelated). No dependency, env var, schema, contract or e2e change. Do not add a unit test — R-12 makes the existing Playwright row the semantics guard.</action>
  <verify><automated>npm run lint</automated></verify>
  <reversibility>rating="reversible" — a one-line guard plus a comment; no persisted state, no wire contract, no behaviour delta, and reverting restores only the TS2339 (no data or migration consequence).</reversibility>
  <done>`npm run lint` exits 0 (it currently exits 1 with TS2339 at rate-limit.ts:94 and :95), the guard reads `if (ipStatus.isAllowed || !ipStatus.isExceeded) return;`, the `retry-after` header and 429 body are unchanged, `createIngestRateLimit` is untouched, no error-suppression construct was used, and the only modified file is apps/api/src/plugins/rate-limit.ts.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| compile-time union type → runtime admission gate | The `@fastify/rate-limit` union exists only in the type system; the guard that reads it is the actual admit-or-429 decision for every unauthenticated GET on the read surface |
| code edit → ingest 429 contract | `apps/api/src/plugins/rate-limit.ts` is one shared module: an edit aimed at the read factory can regress the three POST limiters that live in the same file |
| package installs → CI supply chain | Any dependency added to make a typecheck pass crosses the package-legitimacy boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261016-nnx-01 | Denial of Service | `createReadRateLimit` guard, apps/api/src/plugins/rate-limit.ts:94 | low | mitigate | Narrow by runtime discriminant (`ipStatus.isAllowed \|\| !ipStatus.isExceeded`) rather than silencing the error. An error-suppression construct would keep the type error quiet without keeping the gate honest, letting the 429-on-first-read regression that 62195bb fixed ship unnoticed. Guarded by e2e/read-surface.spec.ts:25 — its under-limit `expect(res.status()).toBe(200)` and its fresh-IP `200` assertion both fail if the guard inverts back to gating on `isAllowed` alone. |
| T-261016-nnx-02 | Repudiation | shared module `apps/api/src/plugins/rate-limit.ts` — ingest limiters at lines 113-172 | low | mitigate | Change is scoped to `createReadRateLimit` alone; `createIngestRateLimit`'s already-compiling `!x.isAllowed && x.isExceeded` pattern is mirrored, not refactored, and no helper signature is altered (`retryAfterSeconds`, `resolveIngestRateLimits` untouched), so hostile.spec.ts's ING-05 429-shape and CR-01 bucket rows stay byte-identical. |
| T-261016-nnx-SC | Tampering | npm/pip/cargo installs | high | mitigate | This plan installs nothing. The fix is a one-line edit to an existing source file using the already-present `@fastify/rate-limit` types; no `[ASSUMED]` or `[SUS]` package enters the tree, so the package-legitimacy gate is trivially satisfied and no install checkpoint is required. |
</threat_model>

<verification>
1. `npm run lint` — the exact CI step that is red. Root `lint` = `npm run typecheck --workspaces --if-present` → `tsc -p tsconfig.json` in each workspace; `.github/workflows/ci.yml` job "Build + typecheck", step "Typecheck (tsc --noEmit, per workspace)" runs precisely this. Today: exit 1 with TS2339 at apps/api/src/plugins/rate-limit.ts:94 and :95. Required: exit 0, no diagnostics in apps/api. This is the task's `<automated>` command and the primary gate.
2. Runtime-semantics regression check (optional; needs the compose stack): with the stack healthy at http://127.0.0.1:8080/api/health after `docker compose up -d --build`, run `npm run verify -- e2e/read-surface.spec.ts --project=chromium`. Row 1 (line 25) hammers one forwarded IP and fails if a counted request under the maximum does not return 200, asserts the 429 carries an integer `retry-after` of at least 1, and asserts a fresh IP still reads 200. Per R-12 this Playwright row is the only correct form of semantics test here — do not add a unit test.
3. `node scripts/gate.mjs` and `npm run check:compose` — CI's other static gates; no file this plan touches falls inside their scope, so they must simply stay green.
4. `git diff --stat` — the diff is confined to `apps/api/src/plugins/rate-limit.ts` (1 file; ~1 insertion plus ~1 deletion for the guard, plus the comment sentence).
</verification>

<success_criteria>
- CI job "Build + typecheck" is green: `npm run lint` exits 0 with zero diagnostics in apps/api.
- `createReadRateLimit` narrows the union by its `isAllowed` discriminant; no error-suppression construct is used in place of narrowing, and the `retry-after` header and 429 body shape are unchanged.
- Runtime admission behaviour is unchanged: a counted request at or under the per-IP maximum passes, an exceeded request answers a structured 429 with an integer `retry-after` of at least 1, and an allow-listed key (were one ever configured) passes via the first term.
- The ingest limiters, their ING-05 429 contract and the CR-01 bucket semantics are untouched; no unit test added (R-12); the diff is a single file.
</success_criteria>

<output>
Write `.planning/quick/261016-nnx-fix-api-read-rate-limit-typecheck-error-/261016-nnx-SUMMARY.md` when done.
</output>
