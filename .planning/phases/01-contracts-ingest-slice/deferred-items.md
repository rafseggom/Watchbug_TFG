# Deferred Items — Phase 01 (Contracts & Ingest Slice)

Out-of-scope discoveries logged by executors. They are **not** fixed in the
plan that found them (scope boundary of the deviation rules) — each entry says
who should own the fix and why it was left alone.

Entries are appended newest-last within each run.

---

## 2026-10-12 — plan 01-02 (hostile-submission hardening)

**1. `meta` sent with `Content-Type: application/json` parses to `"[object Object]"` → 400**
- **Found during:** Task 2 (probing the ingest edge with `curl -F` while debugging the traversal row).
- **Issue:** `@fastify/multipart` runs `secureJSON.parse` on any field whose
  `Content-Type` starts with `application/json` and yields an **object**;
  `apps/api/src/routes/incidents.ts` then does `String(part.value)`, which
  produces `"[object Object]"`, and `validateMeta` rejects it with
  `meta is not valid JSON`. `curl -F 'meta={...}'` sets that content type
  automatically for JSON-looking values, so the documented onboarding `curl`
  (P1-D-07's empty-state snippet) would fail against a correct server.
- **Why deferred:** pre-existing from plan 01-01 and not caused by this plan's
  changes; the e2e suite (which sends the field as a plain string) passes 66/66,
  so nothing here is blocking. Scope boundary says log, don't fix.
- **Suggested fix (one line, in the loop 01-02 already restructured):**
  `const metaRaw = typeof part.value === 'string' ? part.value : JSON.stringify(part.value);`
  plus an e2e row that sends `meta` with `Content-Type: application/json`.
- **Suggested owner:** plan 01-04 (panel/curl onboarding) or a small `01-05`
  fix-up — it is a client-experience bug, not a security one (the rejected
  payload is never stored).
- **RESOLVED in plan 01-04** (Task 1, commit `ddaef5a`): the meta part is
  re-stringified when multipart JSON-parses it
  (`typeof part.value === 'string' ? … : JSON.stringify(part.value)`), with an
  e2e row that sends `meta` with `Content-Type: application/json` (201) and a
  row that executes the empty state's emitted onboarding `curl` verbatim
  against the stack (`e2e/ingest.spec.ts`, commit `ba499f3`).

**2. `npm audit`: 4 moderate advisories in `drizzle-kit`'s dev-only `esbuild` chain**
- **Found during:** Task 2 (`npm install sharp@0.35.5` prints the audit summary).
- **Issue:** `drizzle-kit` → `@esbuild-kit/esm-loader` → `esbuild <= 0.24.2`
  (GHSA-67mh-4wv8-2f99, dev-server request sniffing). Runtime packages and the
  shipped images are unaffected; the vulnerable code path (esbuild's dev
  server) is never started here.
- **Why deferred:** the only offered fix is `npm audit fix --force`, which
  downgrades `drizzle-kit` to `0.18.1` — a tooling/architecture change that
  needs an owner decision (Rule 4), and `drizzle-kit` is a pinned, verified
  STACK.md dependency.
- **Suggested owner:** a future dependency-upgrade run (`/gsd-quick` or a
  dedicated plan) that re-verifies `drizzle-kit` against STACK.md first.

**3. Recorded as context, not a defect: `@fastify/busboy` basenames filenames by default.**
`preservePath: true` (added in `caps.ts` this plan) is what makes the C-4
"reject the traversal-shaped name" rule observable; whoever touches multipart
registration later must keep that option or the rule silently becomes a no-op.
