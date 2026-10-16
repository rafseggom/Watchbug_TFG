---
phase: "01"
slug: contracts-ingest-slice
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-13"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

Consolidated from the `<threat_model>` blocks of `01-01`, `01-02`, `01-03` and `01-04` PLAN.md.

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Untrusted client → `POST /api/incidents` | multipart body + `X-Project-Key` + `Idempotency-Key` (synthetic client this phase; the real SDK arrives in Phase 2) | report text, image bytes, console logs, environment metadata |
| Untrusted multipart body → ingest edge | hostile files, oversized streams, lying `Content-Length`, hostile filenames | image bytes + multipart fields |
| Untrusted client → ingest preHandlers | key header, client IP identity (`X-Forwarded-For`), `Origin` header | identity headers |
| image ingest → decode | dimension/codec abuse before any pixel work | raw image bytes |
| Stored artifact → browser (blob route) | hardened image bytes served to a developer's browser from the panel origin | image bytes + declared MIME |
| Browser panel → `/api/*` via nginx proxy | read surface (list + blob), deliberately unauthenticated this phase (DEP-03 completes Phase 5) | report list/detail, image bytes |
| Stored report text → panel DOM | the classic stored-XSS boundary (C-3) | report title/description/console logs |
| Reverse proxy (nginx) → api | forwarded client identity — trust must be configured, never assumed | `X-Forwarded-For` |
| `.env` / compose → API boot | operator-supplied configuration; must fail loud rather than run misconfigured (SEC-04) | DB URL, project key, CORS allowlist, trust-proxy flag, TTLs |
| npm registry / Docker Hub → build | supply chain for the pinned dependency set (17 npm pins + 3 images) | source code, base images |
| Panel → `GET /api/setup` | exposes the public write-only project key to the operator's own browser | project key |
| Panel bundle → network | the self-hosted promise: no third-party egress | none (egress to own API only) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | S | `POST /api/incidents` key gate | high | mitigate | Boot-seeded `projects` lookup on `X-Project-Key` (P1-D-01/03); structured 401; nothing stored on miss — `apps/api/src/routes/incidents.ts:41,90`, `apps/api/src/boot/seed.ts:81` | closed |
| T-01-02 | I | config / boot (`apps/api/src/config.ts`) | high | mitigate | SEC-04: all server config from `.env` via Node `--env-file`, no `dotenv`; `.env.example` committed (113 lines); fail-fast boot (P1-D-02) with the exact missing-variable message — `config.ts:10,13` | closed |
| T-01-03 | T | report text → panel render | high | mitigate | Double control (C-3): `sanitize-html` empty allowlist on write + React text-node-only rendering — `apps/api/src/ingest/sanitize.ts:1,33` (`allowedTags: []`, `allowedAttributes: {}`) | closed |
| T-01-04 | I | stored image metadata (EXIF PII) | medium | mitigate | `harden()` runs before disk write; sharp strips all metadata by default and ancillary chunks (`eXIf`, `tEXt`, `zTXt`, `iTXX`, `tIME`) are dropped after IEND — `harden.ts:25,27,28`, `structure.ts:13,14` | closed |
| T-01-05 | D | multipart receive path | high | mitigate | `@fastify/multipart` explicit `limits` (files 1 / 4 MB part / fields 8 / fieldSize 4 KB / headerPairs 1 KB / parts 16) with `throwFileSizeLimit: true` — `apps/api/src/ingest/caps.ts:29,30` | closed |
| T-01-SC | T | npm/Docker installs | high | mitigate | Package-legitimacy gate at `gate="blocking-human"` covering every pinned package and image (17 npm + 3 Docker); `sharp` cleared its own checkpoint in 01-02 — `01-01-SUMMARY.md § Package gate (Task 1)`, `continuity-pack.md` (P1-D-10) | closed |
| T-01-06 | T | image ingest (SVG/polyglot) | high | mitigate | PNG/WebP magic-byte + structural allowlist; SVG rejected unconditionally (P1-D-11); mandatory `harden()` stage (P1-D-10) — `apps/api/src/ingest/sniff.ts:7,8` | closed |
| T-01-07 | T | `Storage` key/path handling | high | mitigate | Server-generated `randomUUID()` keys (client value never reaches a path); traversal-shaped filenames rejected and otherwise metadata-only; every path `path.resolve`-d and asserted inside `blobsRoot`/`root` — `apps/api/src/storage/fs-storage.ts:1,13,18,52,70` | closed |
| T-01-08 | D | decode path | high | mitigate | Header-dimension guard before any decode: `MAX_IMAGE_DIM` (8192/side) and `MAX_IMAGE_PIXELS` (16 MP), plus a processing-time codec guard in the `sharp` path — `apps/api/src/ingest/guard.ts:86,90` | closed |
| T-01-09 | D | multipart receive (aggregate caps) | high | mitigate | Content-Length pre-read + streaming counter + parser limits + `truncated` handling → structured 413 with tmp unlinked (Pitfalls 1–2) — `apps/api/src/ingest/caps.ts:11,23` | closed |
| T-01-10 | I | blob route response | medium | mitigate | Inert header set: `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment`, `CSP: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: same-origin`, private cache; MIME from DB allowlist, 404 on unknown keys — `apps/api/src/routes/incidents.ts:411,413,414,415` | closed |
| T-01-11 | S | rate-limit key derivation | high | mitigate | `trustProxy` configured explicitly from `WATCHBUG_TRUST_PROXY` (default `false`, never blanket `true`); spoofing/NAT caveats documented in `.env.example` — `apps/api/src/app.ts:50`, `config.ts:46,47` | closed |
| T-01-12 | D | ingest rate limits (H-7) | high | mitigate | Three composed limiters (per key 10/min, per IP 30/min, per project 2000/day) with structured 429 + `retry-after`; limits run before any write — `apps/api/src/plugins/rate-limit.ts:42,63,129,131,133` | closed |
| T-01-13 | S | CORS origin handling (ING-08) | medium | mitigate | `WATCHBUG_CORS_ORIGINS` env allowlist enforced on `Origin` presence; non-allowlisted browser origins get 403; no-`Origin` clients accepted by documented design (Pitfall 9) — `apps/api/src/plugins/cors.ts:6,7` | closed |
| T-01-14 | I | 401 responses | low | mitigate | One uniform 401 body for missing / malformed / unknown keys — no key-existence oracle — `apps/api/src/routes/incidents.ts:41,90` | closed |
| T-01-15 | T | panel rendering of report fields | high | mitigate | React text-node-only rendering plus a source-level sink gate: **0** `dangerouslySetInnerHTML` / `innerHTML` hits across `apps/panel/src`; DOM-level e2e assertions in ING-07 | closed |
| T-01-16 | I | `GET /api/setup` projectKey exposure | low | mitigate | Returns only `{ projectKey }`; the key is the public write-only capability by design (never gates reads); loopback-bound deployment; Phase 5 replaces onboarding with real auth — `apps/api/src/routes/setup.ts:5,9` | closed |
| T-01-17 | T | product claims (privacy/compliance) | low | accept | Claim restraint is the control: this phase makes no auth, anonymisation or RGPD claim anywhere in UI or docs. Legal review pending M-1/Q-05 — see AR-01 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (`high`) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Verification method.** `workflow.security_asvs_level: 1` with `register_authored_at_plan_time: true` (all four PLAN.md files carry a parseable `<threat_model>` block) and `threats_open: 0` — the L1 short-circuit applies, so each mitigation was confirmed **present in the cited file** (grep-level depth, cited `file:line`) rather than by a spawned auditor. L1 confirms presence, not boundary placement or end-to-end trace; deeper placement/trace evidence for this phase lives in the artifact-level e2e suite (`npm run verify`, CA-01…CA-05) and in `01-REVIEW.md` / `01-REVIEW-FIX.md`.

No `## Threat Flags` section exists in any of the four SUMMARY.md files, so there are no executor-reported unregistered flags to reconcile.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-17 | This phase makes no auth, anonymisation or RGPD compliance claim anywhere in the UI or docs. Claim restraint is the control; revisit when Phase 5 (auth) and Phase 6 land, alongside the pending legal review M-1/Q-05. | owner | 2026-10-13 |
| AR-02 | residual-ING-06 | A client uploading an **over-cap body at full speed** can still lose the Content-Length pre-read's 413 to a socket reset (`ECONNABORTED`). The body is still rejected — this is a diagnosability/UX defect, not a bypass — but such a client may not learn why. `lingerBeforeClose()` (`ed20ec3`) closed the paced/e2e case (15/15 targeted, 132/132 suite) but not the full-speed case. Owner accepted 2026-10-13; rejected approaches recorded as dead-ends **D-09** and **D-10** in `resolution-record.md` §3. Do not re-investigate without an explicit request. | owner | 2026-10-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-13 | 18 | 18 | 0 | orchestrator — L1 pass (ASVS 1 short-circuit; auditor not required) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-13
