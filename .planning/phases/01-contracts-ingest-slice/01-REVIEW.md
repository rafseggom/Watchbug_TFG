---
phase: 01-contracts-ingest-slice
reviewed: 2026-10-13T00:04:06Z
depth: standard
files_reviewed: 75
files_reviewed_list:
  - .env.example
  - .gitattributes
  - .gitignore
  - CONVENTIONS.md
  - SKELETON.md
  - apps/api/Dockerfile
  - apps/api/drizzle.config.ts
  - apps/api/drizzle/0000_grey_the_santerians.sql
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/drizzle/meta/_journal.json
  - apps/api/package.json
  - apps/api/src/app.ts
  - apps/api/src/boot/seed.ts
  - apps/api/src/config.ts
  - apps/api/src/db/client.ts
  - apps/api/src/db/schema.ts
  - apps/api/src/index.ts
  - apps/api/src/ingest/caps.ts
  - apps/api/src/ingest/guard.ts
  - apps/api/src/ingest/harden.ts
  - apps/api/src/ingest/sanitize.ts
  - apps/api/src/ingest/sniff.ts
  - apps/api/src/ingest/structure.ts
  - apps/api/src/ingest/validate-meta.ts
  - apps/api/src/plugins/cors.ts
  - apps/api/src/plugins/rate-limit.ts
  - apps/api/src/ports.ts
  - apps/api/src/routes/incidents.ts
  - apps/api/src/routes/setup.ts
  - apps/api/src/storage/fs-storage.ts
  - apps/api/tsconfig.json
  - apps/panel/Dockerfile
  - apps/panel/index.html
  - apps/panel/nginx.conf
  - apps/panel/package.json
  - apps/panel/src/App.tsx
  - apps/panel/src/api.ts
  - apps/panel/src/components/EmptyState.tsx
  - apps/panel/src/components/LanguageSwitcher.tsx
  - apps/panel/src/components/ReportDetail.tsx
  - apps/panel/src/components/ReportList.tsx
  - apps/panel/src/i18n.ts
  - apps/panel/src/main.tsx
  - apps/panel/src/tokens.css
  - apps/panel/src/vite-env.d.ts
  - apps/panel/tsconfig.json
  - apps/panel/vite.config.ts
  - docker-compose.yml
  - documentation/continuity-pack.md
  - documentation/management.md
  - documentation/resolution-record.md
  - e2e/deploy.spec.ts
  - e2e/global-setup.ts
  - e2e/hostile.spec.ts
  - e2e/ingest.spec.ts
  - e2e/make-fixtures.mjs
  - package.json
  - packages/contracts/package.json
  - packages/contracts/scripts/emit-schema.mjs
  - packages/contracts/src/constants.ts
  - packages/contracts/src/schema.ts
  - packages/contracts/src/types.ts
  - packages/contracts/tsconfig.json
  - packages/sdk/package.json
  - packages/sdk/scripts/build.mjs
  - packages/sdk/src/annotator.ts
  - packages/sdk/src/capture/dom-serialize.ts
  - packages/sdk/src/index.ts
  - packages/sdk/tsconfig.json
  - playwright.config.ts
  - schema/report.schema.json
  - scripts/check-compose.mjs
  - scripts/check-size.mjs
  - scripts/gen-key.mjs
  - tsconfig.base.json
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-13T00:04:06Z
**Depth:** standard
**Files Reviewed:** 75 (5 binary `e2e/fixtures/*` artifacts in the computed scope were skipped — not text-reviewable; `documentation/*.md` were read as context)
**Status:** issues_found

## Summary

The 78-path scope (contracts → ingest chain → storage → API routes/plugins → panel → compose/e2e/gates) was read end-to-end at standard depth, judged against the AGENTS.md/mentorship invariants (SEC-04/05, R-04, R-13, INV-03, R-12). The ingest chain itself is well-ordered (cheap guards → codec → sanitize → storage), path handling is server-generated with double validation, the 401 oracle is genuinely uniform, and the sanitize pass is solid. The gates (`npm run verify`, `check:size`, `check:compose`) prove behaviour, and they cannot see two rate-limit bypasses that both were empirically confirmed against this runtime: **all three ING-05/SEC-05 limiter dimensions are bypassable** — the per-key/per-day buckets through a key-normalization asymmetry (CR-01), the per-IP bucket through client-controlled `X-Forwarded-For` under the `trustProxy=true` configuration the docs and the e2e suite require (CR-02).

Also found: an idempotent-replay lookup that is not scoped to the project (latent cross-tenant bug once project CRUD lands in Phase 5), the A-06 2 MB cap enforced only on the *input* image (the stored re-encode can far exceed it), an orphaned-blob leak on DB failure, a `.env.example` whose shipped rate-limit values make the documented quickstart fail `npm run verify`, a double-send race between the streaming 413 watcher and the route handler, and the API container running as root.

**Scope observations (per instructions — later phases, NOT findings):** the read surface (`GET /api/incidents`, `GET /api/setup`) is unauthenticated by design (DEP-03/T-01-16, Phase 5); TTL purge jobs (A-02), status transitions, project CRUD, and SDK widget/capture/masking are later phases; absence of unit tests is R-12 owner policy; `GET /api/incidents` is unpaginated and unscoped-by-project (perf/scope, Phase 5/6).

## Narrative Findings (AI reviewer)

### CR-01: Per-key and per-day rate-limit buckets are keyed on the raw header while the gate trims it — quota bypass by header padding

**File:** `apps/api/src/plugins/rate-limit.ts:80` (vs. `apps/api/src/routes/incidents.ts:124` and `:83`)
**Severity:** Critical
**Issue:** The limiter buckets on `String(req.headers['x-project-key'] ?? '')` — the **raw** header value — while the project-key gate does `raw.trim()` and `findProject()` looks up `publicKey.trim()`. `String.prototype.trim()` strips whitespace that Node's HTTP parser does *not* strip: header OWS (SP/HTAB) is removed by the parser, but obs-text bytes survive. Verified empirically against this Node 24 runtime: a `0xA0` (NBSP) byte in `X-Project-Key` reaches `req.headers` intact, and `'\u00a0wkbt_…'.trim()` yields a valid key. So a request padded with N NBSPs is **accepted** (gate trims → pattern matches → project resolves) but counted in a **fresh bucket** per padding, for both `RATE_LIMIT_PER_KEY_PER_MIN` and `RATE_LIMIT_PER_PROJECT_PER_DAY`. Since the key is a public, write-only capability (served verbatim by `GET /api/setup`), any client can mint unlimited distinct buckets — e.g. 1..k NBSP prefixes × suffixes — and the project's daily storage quota (2000) plus the per-key limiter (10/min) fall over. Only the per-IP limiter remains (and it is separately bypassable — CR-02). This defeats SEC-05's "per project key" dimension and ING-05 entirely; the e2e rows cannot catch it because they never vary the key's byte padding.

**Fix:** Normalize once, identically, in both places — and bucket unknown/malformed keys by a shared constant so garbage keys don't get free buckets:

```ts
// plugins/rate-limit.ts
const projectKeyOf = (req: FastifyRequest): string => {
  const raw = req.headers['x-project-key'];
  const key = (typeof raw === 'string' ? raw : '').trim();
  // gate-compatible normalization; everything that cannot be a real key shares one bucket
  return PROJECT_KEY_PATTERN.test(key) ? key : '';
};
```

(Alternatively, validate in the gate *without* `trim()` — i.e. reject any key whose raw value differs from its trimmed form — but then the limiter and gate must still agree byte-for-byte.)

---

### CR-02: `trustProxy=true` (the documented/verified deployment setting) makes the per-IP limiter spoofable — `req.ip` is the client-controlled leftmost X-Forwarded-For entry

**File:** `apps/panel/nginx.conf:23` + `apps/api/src/app.ts:47` + `.env.example:86-93` (published port: `docker-compose.yml:43-46`)
**Severity:** Critical
**Issue:** With `trustProxy: true`, Fastify resolves `req.ip` from the **leftmost** `X-Forwarded-For` entry — verified empirically: `XFF: "203.0.113.7, 198.51.100.9"` → `req.ip = 203.0.113.7`. nginx uses `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`, which **appends** the real client address rather than overwriting — so any client that supplies its own `X-Forwarded-For` gets its forged value chosen as the per-IP bucket key, both through the panel origin and (trivially, single header) at the published `127.0.0.1:3000` API port. Combined with CR-01, **all three** ING-05 dimensions are then bypassable with two headers.

The configuration story is self-contradictory, and both states fail a control:
- `.env.example:93` ships `WATCHBUG_TRUST_PROXY=false`, while its own comment (lines 89-92) claims "The compose deployment sets `true` in `.env`" — `docker-compose.yml:47-55` sets no such variable, and nothing else does. With `false`, every proxied request keys on nginx's container IP, so the whole deployment shares **one** 30/min per-IP bucket (false 429s for legitimate users; `.env.example:71-72` claims the opposite).
- `e2e/hostile.spec.ts:476-479` **requires** `WATCHBUG_TRUST_PROXY=true` in `.env` for its ING-05 rows, and its per-IP rows demonstrate the exploit (raw `X-Forwarded-For` sent directly to the API is honoured). So the verified configuration is precisely the spoofable one.

**Fix:** (1) nginx: `proxy_set_header X-Forwarded-For $remote_addr;` (overwrite, don't append) so the header only ever carries an address nginx asserts; and/or (2) narrow `trustProxy` from `true` to the trusted edge (the api container's view of the nginx/network hop) instead of trusting every hop; (3) make compose set `WATCHBUG_TRUST_PROXY` explicitly instead of letting `.env.example` contradict itself; (4) adjust `hostile.spec.ts`'s rate-limit rows, which currently *depend* on trusting XFF from arbitrary sources — that dependency is the vulnerability. Note for the fixer: with (2), the suite must speak through the proxy (or a dedicated test-only trust entry), or its per-IP isolation rows will break.

---

### WR-01: Idempotent-replay lookup is not scoped to the project — wrong (cross-tenant) id on conflict

**File:** `apps/api/src/routes/incidents.ts:291-295`
**Severity:** Warning
**Issue:** The unique index is `(project_id, idempotency_key)` and the conflict is detected against that pair (line 284), but the replay lookup afterwards is `where(eq(incidents.idempotencyKey, idempotencyKey)).limit(1)` — no `projectId` predicate and no ordering. Idempotency keys are client-chosen (any string ≤ 256 chars), so once two projects exist (R-06 project CRUD is v1 scope per `resolution-record.md` A-08 / Phase 5), a conflict inside project B followed by a same-key row in project A can return **project A's incident id** to project B — a wrong replay id and a cross-tenant id disclosure. Today only one project row can exist (single seeded key), so the bug is latent — but it ships in code whose replay contract (ING-03) is already final.

**Fix:** Scope the lookup to the caller's project (and it costs nothing):

```ts
const existing = await db
  .select({ id: incidents.id })
  .from(incidents)
  .where(and(eq(incidents.projectId, projectId), eq(incidents.idempotencyKey, idempotencyKey)))
  .limit(1);
```

---

### WR-02: A-06's 2 MB semantic cap is checked only on the input — the stored re-encode is never re-capped

**File:** `apps/api/src/routes/incidents.ts:214-221` (check) vs. `:248-264` (unchecked output written to storage)
**Severity:** Warning
**Issue:** `imageBytes.length > MAX_ENCODED_IMAGE_BYTES` guards the bytes the client sent. The artifact that is actually stored is `hardenImage()`'s output — sharp re-encodes with its own defaults (e.g. `pipeline.webp()` at quality 80, PNG at default effort). A valid input well under 2 MB can re-encode to far more: e.g. a 4096×4096 (at the 16 MP / 8192 px guard limits) noisy WebP compressed at a low quality by the attacker is ≤ 2 MB, passes sniff/structure/guard, and is then re-encoded by libvips at default quality into a multi-MB artifact. Nothing downstream bounds it (the blob route streams whatever size it is), so A-06's "2 MB hard" and R-11's storage/bandwidth rationale do not hold for stored artifacts.

**Fix:** Re-check the hardened bytes before `storage.put`, and reject (413, same structured body) when `hardened.bytes.length > MAX_ENCODED_IMAGE_BYTES`:

```ts
if (hardened.bytes.length > MAX_ENCODED_IMAGE_BYTES) {
  return reply.code(413).send(failure(413, `re-encoded image is ${hardened.bytes.length} bytes; the contract allows at most ${MAX_ENCODED_IMAGE_BYTES} (MAX_ENCODED_IMAGE_BYTES)`));
}
```

---

### WR-03: Blob written before insert with no cleanup — orphaned files accumulate on any DB failure

**File:** `apps/api/src/routes/incidents.ts:264-303`
**Severity:** Warning
**Issue:** `storage.put()` runs before `db.insert(...)`. The conflict path carefully deletes the fresh blob (line 290), but any *other* failure after `put` — insert throws (DB down, constraint change, transient connection error), or `storage.delete(key)` itself throws in the replay path — leaves an unreferenced file in the attachments volume forever. The TTL purge jobs (later phase, A-02) purge by `artifact_purge_at` **row**; a rowless blob is invisible to them, so the leak is permanent and grows under exactly the conditions (DB trouble) that make it worst.

**Fix:** Wrap the insert (and the replay delete) in try/catch and `await storage.delete(key).catch(() => {})` before rethrowing, e.g.:

```ts
let inserted;
try {
  inserted = await db.insert(incidents).values({ ... }).onConflictDoNothing(...).returning(...);
} catch (err) {
  await storage.delete(key).catch(() => {});
  throw err;
}
```

---

### WR-04: `.env.example`'s shipped rate-limit values make the documented quickstart fail `npm run verify`

**File:** `.env.example:60-62` vs. `e2e/hostile.spec.ts:528-533` and `:596-621`
**Severity:** Warning (test reliability / documentation)
**Issue:** `SKELETON.md:10-14` documents `cp .env.example .env → npm run key:gen → docker compose up → npm run verify`. The template ships `WATCHBUG_RATE_LIMIT_PER_KEY_PER_MIN=10`, `..._PER_IP_PER_MIN=30`, `..._PER_PROJECT_PER_DAY=2000` (mirroring `packages/contracts/src/constants.ts:47-49`). But `rateLimitConfig()` in `hostile.spec.ts` **throws** when `perIpPerMin >= perKeyPerMin` — `30 >= 10` — so all three ING-05 rows error out on a template-configured stack. Even with the ordering fixed, the per-day row needs `perProjectPerDay ≤ ~9 × perKeyPerMin` to fit its `test.setTimeout(600_000)` at one 65-second window reset per batch, so `2000` cannot complete either. The `.env` that makes the suite green must therefore differ from the template in three undocumented values (and also set `WATCHBUG_TRUST_PROXY=true`, see CR-02), which means: (a) a fresh clone following the documented steps cannot reproduce the phase's own green evidence, and (b) the values the code treats as the "documented defaults" are never actually exercised by verify. `.env` is gitignored, so this drift is invisible to review — exactly the class of defect the gates cannot see.

**Fix:** Either document the e2e-required overrides in `.env.example` next to the three rate-limit keys (e.g. "verify requires per-IP < per-key and a per-day small enough for the 600 s daily row"), or relax `rateLimitConfig()`/the daily row so the documented defaults pass as-is. Whichever is chosen, SKELETON's quickstart must be runnable verbatim.

---

### WR-05: The streaming-413 watcher races the route handler — double `reply.send` and false 500 logs

**File:** `apps/api/src/ingest/caps.ts:154-186` (interval send) vs. `apps/api/src/routes/incidents.ts:179-184` (handler error path)
**Severity:** Warning
**Issue:** `watchStreamBytes` sends its own structured 413 from a `setInterval` callback whenever `socket.bytesRead` passes `MAX_BODY_BYTES`, independent of the route lifecycle. On a chunked or Content-Length-lying body the handler is still inside `for await (const part of req.parts())` when that fires; the socket is then destroyed 250 ms after the response flushes (line 177-181). The in-flight multipart iteration rejects with a premature-close error, `mapMultipartError()` correctly returns `null` (no 4xx status), and the handler `throw`s into `app.setErrorHandler`, which takes the `statusCode === 500` branch (`app.ts:108-111`): it logs `[watchbug] unhandled error: …` for what is actually an expected cap abort, then calls `reply.code(500).send(...)` on a reply the watcher already sent — a second send attempt on an already-sent reply. The client still gets the correct 413 (first send wins), so this is an ops-signal and robustness defect, not a client-visible one — but it fires on a hostile-input path that e2e exercises (`hostile.spec.ts` layer 2b), silently polluting logs with false 500s.

**Fix:** Guard every late send and classify the abort as a client failure instead of a 500: in the watcher, `if (reply.sent) { clearInterval(timer); return; }` before `sendFailure`; in the route catch, treat stream-abort errors (e.g. `ERR_STREAM_PREMATURE_CLOSE` / `'aborted'`) as `failure(413, 'request body aborted at MAX_BODY_BYTES')` so they never reach the 500 branch, and check `reply.sent` in `app.setErrorHandler` before sending.

---

### WR-06: The API container runs as root

**File:** `apps/api/Dockerfile:22-38`
**Severity:** Warning
**Issue:** The runtime stage never drops privileges — no `USER`, no entrypoint chown — so `node dist/index.mjs`, the `drizzle-kit migrate` step, and every request handler run as **root** inside the container, on a box whose whole purpose is storing privacy-sensitive screenshots (R-04/SEC-02). A compromise of the ingest surface (the phase's largest attack surface) yields root in the container instead of an unprivileged uid, which materially raises the blast radius of any future escape-class bug. The `node:24-alpine` image ships an unprivileged `node` user for exactly this.

**Fix:** Create/use the stock `node` user in the runtime stage and make the two writable paths (`WATCHBUG_DATA_DIR` volume, `dist/`) owned by it:

```dockerfile
FROM node:24.21.0-alpine3.24 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
RUN chown -R node:node /app
WORKDIR /app/apps/api
USER node
EXPOSE 3000
CMD ["sh", "-c", "/app/node_modules/.bin/drizzle-kit migrate && node dist/index.mjs"]
```

(Verify the attachments volume at `/data` is writable by uid `node` — named volumes initialise from the image dir ownership, so a `chown` of `/data` in the image or a one-shot root entrypoint that `chown`s then drops is needed.)

---

### IN-01: Body parsing runs before the rate-limit preHandler — up to 1 MB of JSON is parsed before any limiter

**File:** `apps/api/src/app.ts:57` + `apps/api/src/routes/incidents.ts:139`
**Issue:** The chain comment says "caps → rate limits → CORS → key", but `ingestRateLimit` is a **preHandler**, and Fastify's lifecycle runs `preParsing → parsing → preValidation → preHandler`. For `Content-Type: application/json` bodies (the very shape `hostile.spec.ts`'s `postProbe` sends), Fastify's built-in parser consumes and `JSON.parse`s up to the default 1 MB `bodyLimit` *before* the limiter sees the request — unauthenticated CPU/memory work in front of SEC-05's gate. Multipart is unaffected (its parser is lazy, consuming only in the handler after the limiters). Low impact today; worth knowing before Phase 4 adds console-log payloads.
**Fix:** If pre-parse throttling matters, move `ingestRateLimit` (and `originGate`) to `onRequest` next to `bodyCaps`, or raise a dedicated finding at Phase 4 planning; at minimum correct the chain comment in `app.ts`/`incidents.ts`.

### IN-02: Blob route opens the read stream before validating the stored content type

**File:** `apps/api/src/routes/incidents.ts:345-357`
**Issue:** `storage.stream(row.storageKey)` (line 345) executes before the `ext`/`mime` allowlist check (347-357). If the unreachable branch ever fires (row corrupt despite the CHECK constraint), the function returns 500 without destroying the already-opened `createReadStream` — a leaked file descriptor until GC. The ordering also means path work happens before the decision to refuse.
**Fix:** Derive `mime` first, return the 500, and only then call `storage.stream(...)`.

### IN-03: The panel HTML document ships without a CSP

**File:** `apps/panel/nginx.conf:40-41`
**Issue:** Only `X-Content-Type-Options` and `Referrer-Policy` are set for the SPA. The API routes get helmet (and the blob route an explicit `default-src 'none'; sandbox`), but the document where React executes has no `Content-Security-Policy`. There is no HTML-rendering sink today (and `hostile.spec.ts` gates for one), so this is defence-in-depth only — but it is the cheapest remaining XSS brake for a page that renders attacker-supplied report text.
**Fix:** `add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" always;` (tune once Phase 2's widget exists — it runs in a closed shadow root on the *host* page, not here).

### IN-04: R-08's path-only `url` rule is not enforced anywhere server-side

**File:** `packages/contracts/src/schema.ts:31` (and `apps/api/src/ingest/sanitize.ts:85`)
**Issue:** R-08 requires `url` to be query- and fragment-free so `?token=`/`?code=` never reach storage. The schema accepts any string ≤ 2048 and `sanitizeMeta` only strips markup/controls — enforcement is delegated entirely to the Phase-2 SDK. A direct API caller (the key is public by design, and the onboarding curl ships `url: '/'`) can persist a secret-bearing query string into a row that is then served on the unauthenticated read surface.
**Fix:** Enforce path-only on ingest as defence-in-depth (drop query/fragment in `sanitizeMeta`/a small `toPathOnly()` before `reportSchema` re-validation), keeping the SDK-side strip as the primary.

### IN-05: The `BodyCapExceeded` branch is unreachable *and* destroys the socket before the reply is sent

**File:** `apps/api/src/routes/incidents.ts:182`
**Issue:** `if (err instanceof BodyCapExceeded) req.raw.destroy();` runs **before** `reply.code(...).send(...)` on line 183 — destroying the request socket (and with it the response path) before the structured 413 is flushed, the exact ordering `caps.ts:175-181` carefully avoids. The branch is currently unreachable: the multipart limits cap the counted bytes at `MAX_IMAGE_PART_BYTES` (4 MB, one file) + at most 8 × 64 KB meta fields ≈ 4.5 MB < `MAX_BODY_BYTES` (5 MB), and non-`meta` fields are never counted at all (`incidents.ts:159-169`). So it is dead defensive code with inverted flush order that will start firing the day a cap changes.
**Fix:** Delete the `req.raw.destroy()` line (the caps module owns abort ordering), or keep the branch but send the reply first and destroy on `reply.raw.on('finish')`; add a comment that the counter currently cannot exceed the body cap under `MULTIPART_LIMITS`.

---

_Reviewed: 2026-10-13T00:04:06Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
