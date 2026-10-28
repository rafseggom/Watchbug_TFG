---
phase: "03"
slug: "report-composer-annotation-editor-lazy"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-28"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> Verified via the secure-phase **L1 short-circuit** (2026-10-28): `threats_open: 0`,
> register authored at plan time (all seven plans carry a parseable `<threat_model>`),
> ASVS level 1 → grep-depth classification is the contracted depth. Every mitigation
> below is additionally proven by the artifact-level e2e row / static gate named in the
> Evidence column, all green in the full `npm run verify` pass at `432b24b`.
> Threat-surface scan: every SUMMARY reports **no threat flags** — zero packages
> installed, zero new network endpoints, zero schema changes beyond the approved
> migration `0001`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Host page ↔ SDK widget | Closed shadow root; composer/editor/review DOM built only from code-owned nodes | Host DOM never receives widget state; capture bytes held only in module-scope `Draft` |
| SDK ↔ API (`POST /api/incidents`) | multipart meta + image; rate-limited per IP and project key | Public write-only `project_key`; post-redaction flattened bitmap; no host credentials (SEC-03) |
| JPEG/attachment input ↔ ingest pipeline | magic-byte allowlist → SOF caps → sharp root re-encode | Untrusted image-borne bytes; EXIF/GPS stripped before storage |
| Lazy lane ↔ loader | `widget/loader.ts` derives chunk URL solely from the LOADING_SCRIPT_URL / import.meta.url | Editor chunk (ESM) — never from init options, data attributes, or baseURI |
| Mask primitives ↔ encode sink | destructive `ImageData` writes, masks-first/T1-last order | Pre-mask pixels never exist in any buffer that reaches the wire (SEC-02) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | I/R | composer degraded path | high | mitigate | failed capture never auto-opens a file dialog, never posts; inert-Review guard + zero-request rows (03-04 SUMMARY) | closed |
| T-03-02 | T | `capture/manual-file.ts` decode | high | mitigate | magic-byte allowlist (PNG/WebP/JPEG only) before decode; dims capped on the bitmap; polyglot GIF refusal row (03-04) | closed |
| T-03-03 | T | `routes/incidents.ts` ext→MIME mapping | high | mitigate | one `CONTENT_TYPE_BY_EXT` map + derived inverse replace both ternaries; JPEG wire row (03-01/03-02) | closed |
| T-03-04 | I/T | `annotator/masks.ts` bake + redact primitives | high | mitigate | rect-restricted read, destructive write, post-mask patch only; CA-02 inside+ring `=== 0` assertions (03-06) | closed |
| T-03-05 | T | canvas-layer mask replay order | high | mitigate | `rebakeMasks()` after every stroke commit + patch-last in `encodeFinal`; cross-stroke resurrection row (03-06) | closed |
| T-03-06 | T | imageless branch in ingest route | high | mitigate | meta-only path skips only image stages; validate→sanitise→re-validate, project-key gate unchanged; CAP-03 rows (03-01) | closed |
| T-03-07 | T | generated migration `0001_*.sql` | high | mitigate | drizzle-kit output only, committed with snapshot+journal, reviewed at the Task 1 checkpoint (owner approved `approve`) before `db:migrate`; widening-only verified live via psql (03-01) | closed |
| T-03-08 | I/D | `purge.ts` artifact sweep with null key | medium | mitigate | null-key guard skips blob delete but deletes the row; no exception path can stall the sweep (03-01) | closed |
| T-03-09 | S/I | blob route deriving ext from content_type | medium | mitigate | single module-scope map pair; unknown value answers 500 with a sanitized message (03-01/03-02) | closed |
| T-03-10 | T | image-borne payload in a JPEG (polyglot/trailing data) | high | mitigate | magic-byte allowlist + sharp root re-encode as the only bytes that persist (03-02) | closed |
| T-03-11 | D | decode bomb via crafted JPEG dimensions | high | mitigate | SOF dimension walker before any decoder + `MAX_IMAGE_PIXELS`/`MAX_IMAGE_DIM`; 400 names the cap, no row/blob (03-02) | closed |
| T-03-12 | I | EXIF/GPS metadata smuggled to the server | medium | mitigate | sharp default metadata stripping + `autoOrient` removes Orientation; served bytes carry no `Exif` substring (03-02) | closed |
| T-03-13 | T | stored-key grammar vs a `jpeg` key | medium | mitigate | `STORAGE_KEY_REGEX` extended with the third extension; `FsStorage.pathFor` keeps its resolve-and-contain check (03-02) | closed |
| T-03-14 | T | composer / review DOM construction | high | mitigate | `el()` + `textContent` + `createElementNS` only; prefill and server reasons as text/input; static grep clean (03-03) | closed |
| T-03-15 | I | `Draft` holding the redacted capture | medium | mitigate | module scope inside the closed shadow root, never on `window`, holds only post-T1 pixels + post-mask patches (03-03) | closed |
| T-03-16 | I | locale override persistence | medium | mitigate | session-scoped module state; `sdk-no-host-storage` gate green; behavior probe asserts zero host-storage keys (03-03) | closed |
| T-03-17 | T | review/send divergence (re-encode after review) | high | mitigate | `encodeFinal` runs exactly once at Review entry; Send transmits that exact blob; PRV-07 single-POST row (03-03) | closed |
| T-03-18 | D | oversized attachment exhausting client decoder | medium | mitigate | dims checked as soon as the bitmap exists; `bitmap.close()` on every path; client refuses before any canvas (03-04) | closed |
| T-03-19 | T | text-only submission skipping meta validation | medium | mitigate | meta-only body validated/sanitised by the same server pipeline; proven against the REAL 201 lane; client cannot add fields (03-04) | closed |
| T-03-20 | S/E | `widget/loader.ts` chunk URL resolution | high | mitigate | URL derived only from LOADING_SCRIPT_URL / `import.meta.url`; never init options, data attrs, baseURI; unresolvable base = rejected promise surfaced inline (03-05) | closed |
| T-03-21 | D/R | editor-load failure path | medium | mitigate | annotate button re-enables with error+hint; memoised promise cleared; retry row green ×3 engines (03-05) | closed |
| T-03-22 | I | second stylesheet / stray global from the lazy lane | medium | mitigate | `EDITOR_CSS` appended once to the existing `data-wb-core` style element; ES-module chunk adds no global — snapshot-diff row (03-05) | closed |
| T-03-23 | T | pointer→bitmap transform using viewport | medium | mitigate | one mapping call site via `canvas.getBoundingClientRect()` + `transformFor`; misplaced ink breaks ANN rows (03-05) | closed |
| T-03-24 | I | undo path exposing pre-mask state | high | mitigate | masks structurally off the undo stack; no pre-mask snapshot exists (`masks.push` only in `bakeRect`, `strokes.pop` only in `undoStroke` + source assertion); mask-undo = privacy decision, deferred (03-06) | closed |
| T-03-25 | T | mask pointer→bitmap mapping | medium | mitigate | one mapping authority (canvas box); committed rect derived independently; DPR 1/1.25/2/3 matrix with 1-px ring (03-06) | closed |
| T-03-26 | T | mask confirmation dialog | medium | mitigate | `role="alertdialog"` + focus trap + Escape owned by the dialog alone while open; Not-now row proves no double-dismiss (03-06) | closed |
| T-03-27 | R/T | migrated `e2e/sdk.spec.ts` rows | high | mitigate | one shared helper (`completeComposer`), no deletions, assertions untouched; `--list` guards the count; pixel/request assertions intact (03-07) | closed |
| T-03-28 | T | `check-size.mjs` thresholds | medium | mitigate | limits unchanged from RNF-01 (45/25/80); only the measured artifact form changed (max of the twins) (03-07) | closed |
| T-03-29 | I | laziness claim without request-level assertion | medium | mitigate | `PRF-02 lazy` row counts bundle requests before/after the click; re-run at closeout (03-07) | closed |

*Status: open · closed — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks — every register entry is dispositioned `mitigate` and the mitigation is present and artifact-proven.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-28 | 29 | 29 | 0 | orchestrator (secure-phase L1 short-circuit: register authored at plan time, threats_open 0, ASVS 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log — none required
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-28
