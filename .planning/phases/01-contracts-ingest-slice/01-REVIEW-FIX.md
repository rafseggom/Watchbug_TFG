---
phase: 01-contracts-ingest-slice
fixed_at: 2026-10-12T23:47:59Z
review_path: .planning/phases/01-contracts-ingest-slice/01-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-10-12T23:47:59Z
**Source review:** `.planning/phases/01-contracts-ingest-slice/01-REVIEW.md`
**Iteration:** 1
**Branch:** `gsd-reviewfix/01-16948` (forked from `gsd/phase-1-contracts-ingest` @ `443088b`)

**Summary:**
- Findings in scope: 8 (CR-01, CR-02, WR-01 … WR-06; `fix_scope: critical_warning` — IN-01…IN-05 deliberately untouched)
- Fixed: 8
- Skipped: 0

**Gates (run where the code lives — see "Where verification ran"):**

| Gate | Result |
|---|---|
| `npm run build` | PASS |
| `npm run lint` (tsc, 4 workspaces) | PASS — 0 errors |
| `npm run check:size` | PASS |
| `npm run check:compose` | PASS |
| `npm run verify` | **PASS — 132/132** (baseline 123 + 3 new tests × 3 browsers), run twice: `verify.log` 5.6 m, `verify2.log` 5.4 m |

## Fixed Issues

### CR-01: Per-key/per-day buckets keyed on the raw header while the gate trims it — quota bypass by header padding

**Files modified:** `apps/api/src/plugins/rate-limit.ts` (fix), `e2e/hostile.spec.ts` (RED row)
**Commits:** RED `4c68f28` → GREEN `5cacef1`
**Applied fix:** `projectKeyOf` now normalizes exactly like the ING-04 gate — `raw.trim()` + `PROJECT_KEY_PATTERN.test` — so a padded variant of a valid key lands in that key's bucket, and every non-key-shaped value (missing/garbage/duplicated header) shares ONE `''` bucket instead of minting free buckets.

**RED evidence** (committed first, run against the pre-fix stack):

```
command:   npx playwright test e2e/hostile.spec.ts --project=chromium -g "CR-01" --reporter=junit
exitCode:  1
targetTest: "CR-01: NBSP-padded X-Project-Key shares the padded key's bucket — padding never mints fresh per-key quota"
failure:   expect(received).toBe(expected)
           Expected: 429
           Received: 401
           at expectRateLimited (e2e/hostile.spec.ts:560:22)
           at e2e/hostile.spec.ts:704:3
```

Interpretation: after exactly `perKeyPerMin` plain-key requests filled the bucket, the NBSP-padded (`0xA0` byte sent raw over a socket, byte-accurate) variant was **not** rate-limited — it passed the limiters (fresh bucket) and fell through to the gate (401). That is the bypass. GREEN run after `5cacef1`: row passes (7.1 s), padded variants get 429 + integer `Retry-After`.

### CR-02: `trustProxy=true` makes the per-IP limiter spoofable — `req.ip` = client-controlled leftmost X-Forwarded-For

**Files modified:** `apps/panel/nginx.conf`, `apps/api/src/config.ts`, `apps/api/src/app.ts`, `apps/api/src/plugins/rate-limit.ts`, `.env.example`, `e2e/hostile.spec.ts`
*(plus untracked local `.env`: `WATCHBUG_TRUST_PROXY=true` → `127.0.0.1/8,::1/128,172.16.0.0/12` — see "Local e2e knobs")*
**Commits:** RED `458278c` → GREEN `f2a8f4e`
**Applied fix (review's options 1+2, config story via `.env.example`):**
1. nginx: `proxy_set_header X-Forwarded-For $remote_addr;` — **overwrite**, never append: through the panel edge the header only ever carries an address nginx asserts.
2. `WATCHBUG_TRUST_PROXY` now parses as `true | false | comma-separated trust list` (`config.ts` `readTrustProxy`, type `boolean | string[]` passed to Fastify's `trustProxy`). With a trust LIST, `@fastify/proxy-addr` resolves `req.ip` from the **first untrusted** entry walking outwards from the socket — i.e. the rightmost, proxy-asserted hop — instead of the attacker-controlled leftmost entry (`trustProxy: true` trusted every hop). Invalid entries throw at Fastify construction → boot fails loud.
3. `.env.example` ships the working value `127.0.0.1/8,::1/128,172.16.0.0/12` (loopback = local tooling + the verify suite's direct-to-API rows; `172.16.0.0/12` = the compose nginx hop, without which all proxied traffic would share one bucket), replacing the self-contradicting `false` + "compose sets `true`" comment. `true`/`false` remain valid booleans.

**RED evidence** (both rows committed first, run against pre-fix `trustProxy=true` + appending nginx):

```
command:   npx playwright test e2e/hostile.spec.ts --project=chromium -g "CR-02" --reporter=junit
exitCode:  1   (2 of 2 tests failed)
```
```
1) CR-02 (direct): a forged leftmost X-Forwarded-For entry never becomes req.ip …
   expect(received).toBe(expected) — Expected: 429 / Received: 401
   at expectRateLimited (e2e/hostile.spec.ts:560) → e2e/hostile.spec.ts:734
   → 601 requests with a VARYING forged leftmost entry never tripped the limiter:
     req.ip followed the forged leftmost (fresh bucket per request).

2) CR-02 (proxy): nginx overwrites the client X-Forwarded-For …
   "the forged X-Forwarded-For entry must not survive the nginx edge"
   expect(received).not.toBe(expected) — Expected: not 429 / Received: 429
   at e2e/hostile.spec.ts:757
   → after exhausting the forged identity's bucket, one forged entry through the
     panel edge still landed in it: nginx appended instead of overwriting.
```

GREEN after `f2a8f4e`: both rows pass (3.0 s / 2.9 s), plus the CR-01 row re-run.

**Documented residual:** a **loopback** client can still choose its bucket by supplying a *single* X-Forwarded-For entry — that is the deliberate test-only/local-tooling trust entry: the suite's per-IP isolation rows speak directly to `127.0.0.1:3000` and are indistinguishable from a local process. Every other path is closed: non-trusted sockets ignore the header entirely (it never becomes `req.ip`), and through the panel nginx overwrites it. Multi-entry/leftmost forgery is dead on both edges (proven by the two rows).

### WR-01: Idempotent-replay lookup not scoped to the project

**Files modified:** `apps/api/src/routes/incidents.ts`
**Commit:** `453539f`
**Applied fix:** the replay `SELECT` is now `WHERE project_id = ? AND idempotency_key = ?` (`and(eq(...), eq(...))`), mirroring the `(project_id, idempotency_key)` unique index the conflict is detected on.
**No RED row:** the bug is latent — only one seeded project can exist until Phase 5 project CRUD, so an e2e row cannot construct the two-project conflict it describes without building a tenant layer (explicitly out of scope). Cheap, index-shaped scoping applied as directed.

### WR-02: A-06's 2 MB cap checked only on the input — stored re-encode never re-capped

**Files modified:** `apps/api/src/routes/incidents.ts`
**Commit:** `d8990a3`
**Applied fix:** after `hardenImage()` succeeds, `hardened.bytes.length > MAX_ENCODED_IMAGE_BYTES` now returns the same structured 413 (`failure(413, "re-encoded image is … (MAX_ENCODED_IMAGE_BYTES)")`) **before** `storage.put`.
**No RED row:** a demonstrating payload needs a crafted image that is ≤ 2 MB on input but re-encodes > 2 MB at libvips defaults — that is a fixture-fabrication exercise with encoder-version-dependent flakiness, and R-12 forbids a unit-test harness for it. Status: **fixed: requires human verification** (logic guard added; behavioural proof not e2e-able with the existing fixture set).

### WR-03: Blob written before insert with no cleanup — orphaned files on DB failure

**Files modified:** `apps/api/src/routes/incidents.ts`
**Commit:** `4d8bf75`
**Applied fix:** the insert is wrapped in `try/catch` — on failure the just-written blob is deleted (`storage.delete(key).catch(log)`) before rethrowing; the replay-path `storage.delete(key)` is now best-effort with an ops log (a failed cleanup must not fail the replay — a 500 + retry would only leak a second blob).
**No RED row:** triggering it e2e requires injecting a DB fault mid-insert (killing PG between `put` and `insert`), which is infra fault-injection outside the one-suite/R-12 surface. Status: **fixed: requires human verification** (control-flow change; not observable through the e2e suite).

### WR-04: `.env.example`'s shipped rate-limit values make the documented quickstart fail `npm run verify`

**Files modified:** `.env.example`
**Commit:** `7e8ee09`

**Diagnosis (required: pick a side, don't change both):** **the documented example values are wrong — the validation is right.**

Why the validation is *not* the defect: both `rateLimitConfig()` constraints are genuine preconditions of the rows it guards, not test artifacts:
1. `perIpPerMin >= perKeyPerMin` throws because the per-IP row fires exactly `perIpPerMin` requests **with one shared key** — if `perIp ≥ perKey`, the per-key limiter trips first and the row measures the wrong dimension.
2. The daily row must fire **all** `perProjectPerDay` requests through the same key's *per-minute* bucket inside `test.setTimeout(600_000)` (one 65 s window reset per batch). At the shipped `perKey=10`, `perDay=2000` needs ~200 minutes — **physically impossible within the timeout**. No relaxation of a validation check can fix a wall-clock infeasibility; the review's option (b) ("relax `rateLimitConfig()`/the daily row so the documented defaults pass as-is") is therefore infeasible for the daily row.

So the values were changed (and only the values): `.env.example` now ships `1200 / 600 / 2000` — exactly the configuration the phase's own green evidence was produced with (`01-03-SUMMARY.md`: "e2e rate-limit maxima are 1200/min per key, 600/min per IP, 2000/day (local .env only)… Production defaults (10/30/2000) stay in config/.env.example") — with a comment block stating both constraints and pointing at the production-hardening values (the `constants.ts` set `10 / 30 / 2000`, reachable by setting or emptying the keys). Result: `cp .env.example .env → key:gen → compose up → npm run verify` now runs **verbatim** (quickstart requirement met), and the values the template documents are the values verify exercises (review complaint (b) met). The `rateLimitConfig()` validation was left untouched.

### WR-05: Streaming-413 watcher races the handler — double `reply.send` + false 500 logs

**Files modified:** `apps/api/src/ingest/caps.ts`, `apps/api/src/routes/incidents.ts`, `apps/api/src/app.ts`
**Commit:** `8b5fb45`
**Applied fix (all three guards the review asked for):**
- `watchStreamBytes`: the tick guard now includes `reply.sent` — the watcher never sends over an already-sent reply.
- Route catch: `if (reply.sent) return;` first (the watcher's 413 already won), and when `mapMultipartError` returns `null`, the new `isBodyAbort(err)` (`ERR_STREAM_PREMATURE_CLOSE` / `ABORT_ERR` / `ECONNRESET` / "aborted"/"premature close" messages) answers with `failure(413, "request body aborted at MAX_BODY_BYTES …")` instead of throwing into the 500 branch.
- `app.setErrorHandler`: `if (reply.sent) return;` before the `console.error('[watchbug] unhandled error: …')` + second send.

**Confirmation with the existing layer-2b row:** `ING-06` group run post-fix — **5/5 green** including `layer 2b … → 413` (124 ms), and `docker logs watchbug-api-1` shows **zero** `[watchbug] unhandled error` lines across all runs.
**Honest note:** 4 pre-fix runs of the layer-2b row were attempted to capture a RED log line — the race window was not hit on this host (timing-dependent; the row's own 413 is answered by whichever layer wins and is correct either way), so no pre-fix log RED artifact exists for WR-05. The fix is mechanism-level (every late send guarded, abort classified as 413); the required behavioural confirmation is the layer-2b row staying green, which it does.

### WR-06: The API container runs as root

**Files modified:** `apps/api/Dockerfile`, `.env.example` (storage-section note)
**Commit:** `b67fd54`
**Applied fix:** runtime stage now does `RUN mkdir -p /data && chown node:node /data` (fresh named volumes initialise with this directory's ownership) then `USER node` (stock uid 1000). Deliberately **no** `chown -R /app` — everything under `/app` is read-only for the migration and the server, and a recursive chown would double the image. The **existing** local volume was migrated in place once: `docker exec -u root watchbug-api-1 chown -R node:node /data` (the one-time upgrade path, documented in the Dockerfile comment).

**Verified:** `docker exec watchbug-api-1 id` → `uid=1000(node) gid=1000(node)`; write probe in `/data` as node → `DATA_WRITABLE`; `drizzle-kit migrate` at boot as node → clean; `/api/health` → `{"status":"ok"}`; blob-writing rows green (`C-3/C-4 blob route`, `ING-07 pass 1`); full verify 132/132 with the non-root container (deploy rows unaffected — `check:compose` PASS).

## Skipped Issues

None — all 8 in-scope findings were fixed.

## Where verification ran

**In the isolated worktree** `.claude/worktrees/rf-01-16948-1791846723` (branch `gsd-reviewfix/01-16948`), not the main checkout: `node_modules` was junction-linked from the main checkout, the compose stack was **rebuilt from the worktree sources** (`docker compose up -d --build` run in the worktree), and a worktree copy of the (untracked) `.env` was used. Gate artifacts: `build.log`, `lint.log`, `size.log`, `compose.log`, `verify.log`/`verify2.log` (untracked, left in the worktree). The numbers above are reproducible from the merged branch content; they were **not** run in the main checkout tree itself.

## Deviations & hand-off notes (orchestrator)

1. **Pre-existing uncommitted `.env.example` edit in the MAIN checkout was discarded** (superseded by WR-04). Original diff at session start: the three `WATCHBUG_RATE_LIMIT_*` values changed from `10/30/2000` to **empty**. Empty would make `rateLimitConfig()` throw outright (its regex requires integers), i.e. it could not be a working WR-04 fix; effective server defaults were identical to the constants anyway. **Action needed at merge:** the branch modifies those same lines, so restore the main checkout first with `git checkout -- .env.example`, then fast-forward.
2. **Main checkout `.env` (untracked) was updated** to `WATCHBUG_TRUST_PROXY=127.0.0.1/8,::1/128,172.16.0.0/12` (BOM-safe write) so any stack recreated from the main checkout matches the fix — with the old `true`, the new CR-02 rows would fail.
3. **Local e2e knobs** (untracked `.env`, documented here as required): the only change made by this run is `WATCHBUG_TRUST_PROXY` (above). The rate-limit knobs `1200/600/2000` were already present and unchanged; production defaults in `.env.example` were touched **only** by WR-04 (rate-limit values) and CR-02/WR-06 (trust-list and storage notes), each being the finding that owns that file.
4. **No consultation triggers hit:** no `/api/incidents` payload schema change (CA-01), no `window.Watchbug.init()` change, no Shadow-DOM change, no new dependency, **no DB migration**.
5. Commits were normal (the repository has no configured hooks: `core.hooksPath` unset, no non-sample hooks); nothing was committed with `--no-verify`.

---

_Fixed: 2026-10-12T23:47:59Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
