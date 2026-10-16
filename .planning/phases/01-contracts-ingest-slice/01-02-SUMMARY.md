---
phase: 01-contracts-ingest-slice
plan: 02
subsystem: api
tags: [ingest-hardening, multipart, image-re-encode, sharp, path-traversal, blob-serving, e2e]

# Dependency graph
requires:
  - phase: 01-01
    provides: compose stack, CA-01 ingest chain, FsStorage, hardened blob route, 39-row e2e baseline, the zero-dep structural backend this plan supersedes
provides:
  - "layered ING-06 body caps: Content-Length pre-read + streaming byte counter + multipart limits + semantic 2 MB check"
  - "pre-codec structure guard (PNG/WebP chunk walk: metadata dropped, ANIM/ANMF and trailing data rejected)"
  - "P1-D-10 root re-encode backend: sharp@0.35.5 (same format in/out, metadata stripped, timeout + limitInputPixels)"
  - "C-4 naming proof: traversal-shaped client filenames rejected 400, stored keys remain server-generated"
  - "e2e/hostile.spec.ts — 9 hostile/serving rows × chromium, firefox, webkit"
affects: [01-03, 01-04, 01-05]

# Actuals (#2632) — pairs with the plan's `estimate`
actuals:
  tokens: 24905
  tasks: 3
  commits: 4
  plan_head_before: eb3be39dc81de707bc805d53207279030340adfd
  plan_head_after: e08e11c3c0dcf33000ba779103f5c9ef5aa1e70a

# Tech tracking
tech-stack:
  added: ["sharp 0.35.5 — apps/api only, owner-approved at the Task 1 blocking-human gate; musl prebuilds verified in package-lock for node:24-alpine"]
  patterns:
    - "cheap guards first, codec last: sniff → structure → guard → re-encode, no hostile byte reaches libvips"
    - "layered caps, each layer asserted by its own e2e row so a pass can never be satisfied by the wrong layer"
    - "one module owns the whole receive policy (caps.ts) so parser limits and body gates cannot drift"

key-files:
  created:
    - apps/api/src/ingest/caps.ts
    - apps/api/src/ingest/structure.ts
    - e2e/hostile.spec.ts
    - e2e/fixtures/{hostile.svg,polyglot-gif-html.gif,decode-bomb.png}
    - .gitattributes
    - .planning/phases/01-contracts-ingest-slice/01-02-red-evidence.json
  modified:
    - apps/api/src/ingest/harden.ts
    - apps/api/src/routes/incidents.ts
    - apps/api/src/app.ts
    - apps/api/src/index.ts
    - apps/api/package.json
    - package-lock.json
    - documentation/continuity-pack.md

key-decisions:
  - "P1-D-10 backend = sharp@0.35.5 (owner, Task 1 gate) — a root re-encode is the control; the structural strip moved to structure.ts as a pre-codec guard and no longer claims to be one"
  - "multipart fieldSize raised from the research's 4 KB to MAX_META_BYTES (64 KB): a contract-sized note (5,000 chars) could never parse at 4 KB, and busboy truncates fields silently"
  - "busboy runs with preservePath: true so the C-4 rule sees the raw filename — the default basename() rewrite would have turned the traversal attempt into 'passwd.png' and hidden it"
  - "the socket byte counter polls the connection position instead of attaching a 'data' listener, which would resume the request stream before multipart pipes it"

requirements-completed: [ING-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Layered size caps — Content-Length pre-read, streaming counter at MAX_BODY_BYTES, multipart parser limits, semantic 2 MB check (ING-06)"
    requirement: ING-06
    verification:
      - kind: e2e
        ref: "e2e/hostile.spec.ts — ING-06 layer 1 / layer 2 / layer 2b / layer 3 / semantic-cap rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "Image control stack — magic-byte sniff, structure guard (metadata dropped, animation and trailing data rejected), decode-bomb header guard, sharp root re-encode"
    requirement: ING-06
    verification:
      - kind: e2e
        ref: "e2e/hostile.spec.ts#C-3 (SVG, GIF/HTML polyglot, decode bomb) + e2e/ingest.spec.ts (accepted PNG/WebP round-trip)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Traversal-proof naming — hostile client filenames rejected 400, stored keys stay server-generated and unobservable (C-4)"
    requirement: ING-06
    verification:
      - kind: e2e
        ref: "e2e/hostile.spec.ts#C-4 traversal-shaped filenames + blob header/fixed-name row"
        status: pass
    human_judgment: false
  - id: D4
    description: "Hardened blob serving — five inert headers, DB-resolved keys only, 404 for unknown ids"
    requirement: ING-06
    verification:
      - kind: e2e
        ref: "e2e/hostile.spec.ts#C-3/C-4 blob header row + unknown-id 404 row"
        status: pass
    human_judgment: false
  - id: D5
    description: "sharp@0.35.5 pinned in apps/api only, installed inside the api image, SDK size lanes untouched"
    requirement: ING-06
    verification:
      - kind: other
        ref: "grep '\"sharp\": \"0.35.5\"' apps/api/package.json + npm run check:size + npm run verify (66/66)"
        status: pass
    human_judgment: false

metrics:
  duration: 40min
  completed: 2026-10-12
status: complete
---

# Phase 1 Plan 2: Hostile-Submission Hardening Summary

**Layered ING-06 caps, a pre-codec structure guard and the owner-approved `sharp@0.35.5`
root re-encode now stop hostile submissions before they reach disk** — oversized
bodies 413 (Content-Length pre-read *and* a streaming counter that destroys the
stream), SVG/polyglot/decode-bomb/traversal-shaped names 400, accepted images
re-encoded in their own format with metadata stripped, and blobs served only
through DB-resolved keys with the full inert header set. The suite went from
**39/39 to 66/66** (27 hostile/serving rows on chromium + firefox + webkit);
`check:size`, `check:compose`, `npm run build` and `npm run lint` all pass.

## Performance

- **Duration:** 40 min (executor time; Task 1's human gate was completed before this run)
- **Started:** 2026-10-12T18:17:57Z
- **Completed:** 2026-10-12T18:58Z
- **Tasks:** 3
- **Files modified:** 16 (15 in the plan diff + `deferred-items.md`)

## Accomplishments

- **Task 1 (continuation):** the P1-D-10 gate was already closed — `sharp@0.35.5`
  adopted by the owner with the rationale in `documentation/continuity-pack.md` §8.3;
  the legitimacy check was *not* re-opened.
- **Task 2 (TDD, RED → GREEN):** `caps.ts` (Content-Length pre-read, streaming
  byte counter at `MAX_BODY_BYTES`, multipart receive policy, tmp-file receive
  with guaranteed unlink, C-4 filename rule, parser→structured-413 mapping),
  `structure.ts` (PNG/WebP chunk walk), `harden.ts` (sharp re-encode),
  `routes/incidents.ts` (ordered chain + semantic cap + filename rule).
- **Task 3:** the serving proof — all five inert headers asserted, fixed ASCII
  `Content-Disposition`, no `storageKey`/`projectId` leak, unknown id → 404 with
  the shared body shape; `check:compose` still proves the volume reaches `api` only.
- **Orphaned work reconciled:** the interrupted agent's untracked
  `e2e/hostile.spec.ts` + three fixtures were read against the Task 2/3 specs,
  kept where they held, extended (chunked streaming-counter row, paced writes,
  the two Task 3 serving rows) and committed — not re-created, not clobbered.

## Task Commits

Each task was committed atomically:

1. **Task 1: [CONSULTATION + LEGITIMACY] P1-D-10 backend** - `9327fa6` (docs) — recorded before Task 2 installed anything
2. **Task 2 (RED): hostile-submission e2e rows + fixtures** - `1d0599e` (test)
3. **Task 2 (GREEN): layered caps, structure guard, sharp re-encode** - `8f54c79` (feat)
4. **Task 3: hardened-blob serving rows** - `e08e11c` (test)

**Plan metadata:** *(this commit)*

## Files Created/Modified

- `apps/api/src/ingest/caps.ts` — **new**: the whole layered-caps layer (pre-read,
  streaming counter, receive policy, filename rule, error mapping).
- `apps/api/src/ingest/structure.ts` — **new**: pre-codec PNG/WebP container walk;
  metadata chunks dropped, `ANIM`/`ANMF` rejected, trailing data past the declared
  File Size rejected, CRCs verified.
- `apps/api/src/ingest/harden.ts` — rewritten: `sharp` decode → `png()`/`webp()`
  re-encode, metadata stripped by default, `timeout({ seconds: 5 })` +
  `limitInputPixels` as the T-01-08 processing guard. Signature unchanged
  (`hardenImage(bytes) → { bytes, ext, w, h }`), now `async`.
- `apps/api/src/routes/incidents.ts` — ordered chain (sniff → structure → guard →
  harden), semantic `MAX_ENCODED_IMAGE_BYTES` 413, client-filename 400, `onRequest`
  body-cap hook, tmp-file receive.
- `apps/api/src/app.ts`, `apps/api/src/index.ts` — register the receive policy from
  `caps.ts` (single source for the parser limits).
- `apps/api/package.json` + `package-lock.json` — `sharp@0.35.5` (exact, apps/api only).
- `e2e/hostile.spec.ts` + `e2e/fixtures/{hostile.svg,polyglot-gif-html.gif,decode-bomb.png}` —
  the C-3/C-4/ING-06 group (9 rows).
- `.gitattributes` — `e2e/fixtures/* -text` so `core.autocrlf` can never rewrite the
  byte-exact fixtures (the polyglot GIF has no NUL byte and git misdetects it as text).
- `documentation/continuity-pack.md` — P1-D-10 decision record (Task 1).

## Decisions Made

- **Sharp is the only hardening backend.** The zero-dep structural strip/rebuild
  moved to `structure.ts` and is documented as a *guard*: it never decodes, it
  drops metadata and rejects animation/trailing data, but a decoder-differential
  polyglot survives it — which is exactly why P1-D-10 mandates the re-encode.
- **`fieldSize: MAX_META_BYTES`, not 4 KB.** The plan's action text carried the
  research's 4 KB figure; at 4 KB a legitimate `note` (up to 5,000 chars) is
  silently truncated by busboy and can never parse. Raised to the contract's own
  64 KB; the aggregate is still bounded (8 × 64 KB + 4 MB ≪ 5 MB).
- **`preservePath: true`.** busboy's default `basename()` turned
  `../../../etc/passwd.png` into `passwd.png` before the route could see it —
  the C-4 rule (reject the shape, loudly) was unreachable without it.
- **Poll, don't sniff, the socket.** The streaming counter samples
  `socket.bytesRead` on an interval; attaching a `'data'` listener to the request
  stream would resume it before multipart pipes it and drop bytes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A Fastify `onRequest` hook must be async, or every POST stalls**
- **Found during:** Task 2, first green-build e2e run (all POSTs hung, GETs fine)
- **Issue:** `bodyCaps` was a synchronous hook. Fastify's hook runner only advances
  the chain when the hook returns a thenable, so `undefined` left the lifecycle
  parked between `onRequest` and the handler — no response, no error, no log.
- **Fix:** `export async function bodyCaps(...): Promise<void>` plus a comment
  stating why it must stay async.
- **Files modified:** `apps/api/src/ingest/caps.ts`
- **Verification:** curl probes answered in 43 ms; full suite 66/66
- **Committed in:** `8f54c79`

**2. [Rule 1 - Bug] multipart `fieldSize: 4096` made `MAX_META_BYTES` unreachable**
- **Found during:** Task 2 (the wave-1 handoff flagged it; confirming it against
  `@fastify/multipart`'s truncation behaviour during implementation)
- **Issue:** busboy truncates fields at `fieldSize` without raising, and a
  truncated JSON field can never parse — every contract-sized `meta` would 400.
- **Fix:** `fieldSize: MAX_META_BYTES` (64 KB) in the receive policy.
- **Files modified:** `apps/api/src/ingest/caps.ts` (values), `apps/api/src/app.ts` (import)
- **Verification:** 66/66 e2e (the suite's own meta rows still pass); `npm run lint`
- **Committed in:** `8f54c79`

**3. [Rule 1 - Bug] busboy hid the traversal filename from the rule built to reject it**
- **Found during:** Task 2, live probe of the C-4 row (returned 201)
- **Issue:** without `preservePath`, the parser `basename()`s the filename, so the
  hostile shape never reached `validateClientFilename`.
- **Fix:** `preservePath: true` in `MULTIPART_RECEIVE_OPTIONS`, documented in `caps.ts`.
- **Files modified:** `apps/api/src/ingest/caps.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`
- **Verification:** C-4 row → 400 on all three browsers
- **Committed in:** `8f54c79`

### Scope additions (outside `files_modified`, documented here)

- **`apps/api/src/app.ts` / `apps/api/src/index.ts`** — the plan puts the multipart
  limits in `caps.ts`, so the composition root (and the P1-D-09 smoke path) must
  import them from there; the local `MULTIPART_LIMITS` copies were removed rather
  than left to drift.
- **`.gitattributes`** — `e2e/fixtures/* -text`; without it the committed polyglot
  GIF is rewritten with CRLF on the next checkout on this machine (git detects it
  as text — no NUL byte).
- **`package-lock.json`** — regenerated by the `sharp` install.
- **`.planning/phases/01-contracts-ingest-slice/01-02-red-evidence.json`** — the
  persisted RED record for `gsd_run check tdd-red-evidence`.
- **`.planning/phases/01-contracts-ingest-slice/deferred-items.md`** — two
  out-of-scope discoveries logged, not fixed (scope boundary).

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs) + 5 documented scope additions
**Impact on plan:** all three were required for the plan's own acceptance criteria to
hold; no scope creep into payload schema (CA-01 untouched), SDK size lanes untouched.

## TDD Gate Compliance (Task 2, `tdd="true"`)

- **RED:** `npx playwright test e2e/hostile.spec.ts --project=chromium --reporter=junit`
  → exit 1, 7 tests / 2 pass / 5 fail, every failing assertion on a planned
  `<behavior>` row. Record: `.planning/phases/01-contracts-ingest-slice/01-02-red-evidence.json`,
  verdict **`RED_EVIDENCE_OK`** (`target_test_failed`) — GREEN authorized.
- **GREEN:** `feat(01-02)` `8f54c79` — hostile group green, full suite 66/66.
- **REFACTOR:** none needed; no `refactor(01-02)` commit (allowed — REFACTOR is optional).
- Commit sequence present: `test(01-02)` → `feat(01-02)` ✓.

## Verification Results

| Check | Command | Result |
| --- | --- | --- |
| hostile group, 3 browsers | `npm run verify -- e2e/hostile.spec.ts` | **27/27 passed** |
| full suite (39 baseline + 27) | `npm run verify` | **66/66 passed** |
| size gate (SDK lanes) | `npm run check:size` | PASSED (worst-case 84 > 80 KB still printed) |
| compose gate (C-4 volume) | `npm run check:compose` | PASSED — 3 services, volume only in `api` |
| build | `npm run build` | PASSED |
| typecheck | `npm run lint` | PASSED |

## Issues Encountered

- **The streaming-counter row initially failed with `ECONNRESET`.** The raw-socket
  client treated a connection reset *while writing* as fatal before it had read the
  response, and it wrote 32 MB fast enough to finish before the counter's first
  sample. Fixed in the test: writes are paced (1 MB / 10 ms) so the abort is
  genuinely mid-flight, and a reset during the write no longer discards a response
  that already arrived.
- **Two deferred, out-of-scope discoveries** are in
  [`deferred-items.md`](./deferred-items.md): the `meta` + `Content-Type:
  application/json` → `"[object Object]"` 400 (pre-existing from 01-01, would
  break the documented `curl` onboarding), and 4 moderate `npm audit` advisories in
  `drizzle-kit`'s dev-only esbuild chain (fix = breaking downgrade → owner call).
- **`hardenImage` is now `async`** (sharp has no synchronous encode). The seam's
  contract shape is unchanged, so no caller outside this plan exists to break.

## Known Stubs

None — no placeholder values, no data-less components, no skipped or `todo` tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **01-03 (rate limits + CORS)** picks up `app.ts` where the structured error mapper
  already understands 429; the caps layer it builds on is `caps.ts`.
- **01-04 (panel)** can rely on the blob route's inert headers and the fixed
  `Content-Disposition` name.
- **Open items carried forward:** the two `deferred-items.md` entries above; the
  `meta` JSON-content-type one should be fixed before P1-D-07's onboarding `curl`
  is written into the panel's empty state.

## Self-Check: PASSED

- Created files all exist on disk (11/11: `caps.ts`, `structure.ts`, `harden.ts`,
  `e2e/hostile.spec.ts`, 3 fixtures, `.gitattributes`, red-evidence record,
  `deferred-items.md`, this SUMMARY).
- All four plan commits exist in the repository: `9327fa6` (Task 1), `1d0599e` (RED),
  `8f54c79` (GREEN), `e08e11c` (Task 3).
- Every `<acceptance_criteria>` re-checked: Task 2 (caps `Content-Length` + counter,
  7 hostile rows, `structure.ts` `ANIM` + `File Size`, `"sharp": "0.35.5"`,
  hostile group green on 3 browsers) and Task 3 (5 inert headers, random-uuid 404
  row, `path.resolve` delegation, `STORAGE_KEY_REGEX` before file access).
- Plan `<verification>` re-run: `npm run verify` **66/66**, `npm run check:compose`
  PASSED, `npm run check:size` PASSED.
- `commits: 4` measured from the ledger (`eb3be39..HEAD`), not narrated.

---
*Phase: 01-contracts-ingest-slice*
*Completed: 2026-10-12*
