---
phase: 03-report-composer-annotation-editor-lazy
plan: 02
subsystem: api
tags: [jpeg, ingest, magic-bytes, exif, sharp, decode-bomb, cap-02, playwright, p3-d-14]

requires:
  - phase: 01-foundation
    provides: the PNG/WebP ingest stack (sniff/structure/guard/harden), compose stack, e2e postIncident harness
  - phase: 03-report-composer-annotation-editor-lazy
    provides: "03-01's migration 0001 (CHECK admits image/jpeg), CONTENT_TYPE_BY_EXT Record<ImageExt,string> + derived EXT_BY_CONTENT_TYPE inverse, nullable-screenshot lane"
provides:
  - "JPEG lane end-to-end: 3-byte FF D8 FF sniff -> documented pass-through structure arm -> SOF header dimension guard -> sharp autoOrient + jpeg(quality:80) re-encode -> stored image/jpeg -> hardened blob-route headers"
  - "ImageExt = 'png' | 'webp' | 'jpeg' with STORAGE_KEY_REGEX / IMAGE_EXTENSIONS / isImageExt widened in step"
  - "Decode-bomb and truncation refusal rows proving the guard answers before any decoder"
  - "EXIF Orientation = 6 proof: stored frame swaps 80x40 -> 40x80 and no Exif segment survives"
  - "Three committed JPEG fixtures + their browser-only emitters in make-fixtures.mjs"
affects: [03-04-text-only-composer-attach, 06-triage-retention, verify-work-03]

actuals:
  tokens: 10328   # chars/4 over the realized apps+packages+e2e diff (measured from the plan commit range)
  tasks: 3
  commits: 3      # MEASURED via git rev-list ${plan_head_before}..HEAD at authoring time

plan_head_before: e3d9073c6c497db300dc6d3110144bfd7edb35d0
plan_head_after: 3ac533023aef29a1f45237f9bcf7f4f86cb3988b

tech-stack:
  added: []
  patterns:
    - "exhaustive switch(ext) with never-guard default + fail-closed unreachable arm — replaces every binary ternary in the ingest stages"
    - "artifact-level header assertions on served bytes (magic prefix, SOF dims via test-side twin walker, no-Exif substring) + browser createImageBitmap decode as the orientation proof"
    - "round-trip admission of the engine's own output proves the 3-byte sniff signature without a unit test"

key-files:
  created:
    - e2e/fixtures/valid-64x64.jpg
    - e2e/fixtures/oversize-64mp.jpg
    - e2e/fixtures/rotated-exif-80x40.jpg
  modified:
    - packages/contracts/src/types.ts
    - apps/api/src/ports.ts
    - apps/api/src/ingest/sniff.ts
    - apps/api/src/ingest/guard.ts
    - apps/api/src/ingest/structure.ts
    - apps/api/src/ingest/harden.ts
    - apps/api/src/routes/incidents.ts
    - e2e/make-fixtures.mjs
    - e2e/ingest.spec.ts

key-decisions:
  - "Oversize fixture takes the plan-sanctioned synthetic-SOF route: a real 64x64 chromium JPEG whose SOFn is re-declared 8000x8192 — the guard reads only the header, so no 64 MP browser canvas (memory-flaky) is ever needed"
  - "Non-E0 admission is proven by re-submitting the served libvips bytes (FF D8 FF DB) back through the route — round-trip at the artifact level, no unit test"
  - "validateStructure's JPEG arm returns the bytes unchanged with the full written rationale (no entropy-scan walker; the sharp re-encode is the control; the header guard precedes it) — the unreachable default FAILS CLOSED rather than passing"
  - "Truncated-header refusal relies on assertDecodeSafe's existing fail-closed null -> 400 contract (message interpolates ext.toUpperCase() — already reads 'the JPEG header is missing or unreadable'), so guard.ts messages were not touched"

requirements-completed: [CAP-02]  # server half; shared-ID gate #2388: CAP-02 is also declared by sibling 03-04 (client attach), so it stays unmarked in REQUIREMENTS.md until 03-04's SUMMARY exists

coverage:
  - id: D1
    description: "JPEG ingests to 201, stores content_type image/jpeg (never the ternary's silent image/webp), and the blob route serves the full hardened header set (content-type, nosniff, attachment filename screenshot.jpeg, sandbox CSP, CORP) over bytes that start FF D8 FF and decode at 64x64"
    requirement: CAP-02
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#JPEG: a real JPEG ingests, stores image/jpeg and the blob route serves it as a JPEG"
        status: pass
      - kind: e2e
        ref: "npm run verify -- e2e/ingest.spec.ts (chromium+firefox+webkit, 69/69)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Decode-bomb posture: a >16 MP JPEG refused 400 naming MAX_IMAGE_PIXELS with no row and no blob written; a truncated header refused 400 naming the unreadable JPEG header; a side above MAX_IMAGE_DIM refused 400 naming MAX_IMAGE_DIM — all before sharp runs"
    requirement: CAP-02
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#JPEG decode-bomb: a >16 MP JPEG is rejected before sharp"
        status: pass
      - kind: e2e
        ref: "e2e/ingest.spec.ts#JPEG header: a truncated JPEG is rejected"
        status: pass
      - kind: e2e
        ref: "e2e/ingest.spec.ts#JPEG boundary: a side above MAX_IMAGE_DIM is rejected"
        status: pass
    human_judgment: false
  - id: D3
    description: "EXIF orientation survives the re-encode, metadata does not: the 80x40 Orientation=6 fixture is stored 40x80 and served with no Exif substring (the proof autoOrient actually runs)"
    requirement: CAP-02
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#JPEG orientation: an EXIF-rotated photo is stored upright without its EXIF segment"
        status: pass
    human_judgment: false
  - id: D4
    description: "Allowlist widened, not loosened: SVG and the committed polyglot GIF are still refused 400 and the refusal copy now names PNG, WebP and JPEG"
    requirement: CAP-02
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#format allowlist: SVG and GIF are still rejected and the copy names JPEG"
        status: pass
    human_judgment: false
  - id: D5
    description: "Structural discipline (the plan's three prohibition statements): every container is an explicit switch arm with a never-exhaustiveness guard, no binary ternary survives in the ingest stages, the magic-byte gate remains the only admission test, and the JPEG pass-through carries its written rationale"
    requirement: CAP-02
    verification:
      - kind: other
        ref: "npm --prefix apps/api run typecheck (exit 0) + grep: zero 'ext === .png. ?' ternaries in guard/structure/harden, case 'jpeg' + never = ext in all three"
        status: pass
    human_judgment: true
    rationale: "The plan's must_haves.prohibitions mark these three statements verification: judgment — the e2e rows and greps prove the behavior and the shape at commit time, but the standing 'never hand-write a JPEG walker / never trust declared Content-Type' invariants are code-review properties for the phase verifier to re-confirm."
  - id: D6
    description: "Storage key grammar admits the third extension: <projectId>/<shard>/<uuid>.(png|webp|jpeg) — Storage.put never throws on a jpeg key and the blob route streams it back"
    requirement: CAP-02
    verification:
      - kind: e2e
        ref: "e2e/ingest.spec.ts#JPEG: ... (201 => put succeeded) + the round-trip re-submission of stored libvips bytes (second 201)"
        status: pass
      - kind: integration
        ref: "apps/api/src/ports.ts:24 STORAGE_KEY_REGEX .(webp|png|jpeg)$; uuid+shard grammar byte-identical elsewhere (C-4 path-safety assert unchanged)"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-28
status: complete
---

# Phase 03 Plan 02: JPEG Lane (CAP-02 Server Leg) Summary

**JPEG is a first-class container end to end: admitted on the three magic bytes `FF D8 FF`, bounded by its own SOF header before any decoder, re-encoded through sharp with `autoOrient` and metadata stripped, stored `image/jpeg` through the one ext→MIME map, and served with the identical hardened header set as PNG/WebP — with every ingest stage converted from binary ternary to an exhaustive `switch (ext)`.**

## Performance

- **Duration:** ~17 min (start 17:34:50Z, completion 17:51Z + close-out)
- **Started:** 2026-10-28T17:34:50Z
- **Completed:** 2026-10-28T17:51:28Z (tasks; metadata commit immediately after)
- **Tasks:** 3 (1 tracer + 2 auto)
- **Files modified:** 12 (3 fixtures created, 9 modified) + this SUMMARY

## Accomplishments
- **Tracer (Task 1):** one container crossed all five ingest stages — `ImageExt` + `'jpeg'`, 3-byte sniff (deliberately NOT `FF D8 FF E0`: libvips output starts `FF D8 FF DB`), SOF dimension walker, documented pass-through structure arm, `autoOrient: true` + `pipeline.jpeg({ quality: 80 })`, `jpeg: 'image/jpeg'` into `CONTENT_TYPE_BY_EXT` (the derived inverse map picks it up automatically; 03-01's ternary elimination held), `STORAGE_KEY_REGEX`/`IMAGE_EXTENSIONS`/`isImageExt` widened with the uuid+shard grammar byte-identical.
- **Boundaries (Task 2):** decode-bomb 400 naming `MAX_IMAGE_PIXELS` stores no row and no blob (volume + list counts unchanged); truncated header → structured 400 "the JPEG header is missing or unreadable", never a 500, never a decode; synthetic 9000×100 SOF proves `MAX_IMAGE_DIM` is the independent arm; SVG + committed polyglot GIF still rejected, refusal copy now names PNG, WebP and JPEG.
- **Orientation (Task 3):** the 80×40 `Orientation = 6` fixture is stored 40×80 and served with **no `Exif` substring** — the row that proves `autoOrient` runs (without it the tag is stripped and the photo is permanently sideways). Both rationale docblocks (structure.ts file header + harden.ts next to the option) now say in writing why the walker does not exist and why the option must not be removed.
- Full chromium ingest suite green after every task (18 → 23 rows), and `npm run verify -- e2e/ingest.spec.ts` green on **all three engines** (69/69): the API lane is engine-neutral exactly as the plan predicted.

## Task Commits

Each task was committed atomically:

1. **Task 1: JPEG end-to-end tracer** - `3019a94` (feat: sniff/guard/structure/harden/routes/ports/types + fixture + row)
2. **Task 2: decode-bomb + truncation boundaries** - `9465b47` (test: oversize fixture + 4 boundary rows)
3. **Task 3: EXIF orientation + written rationales** - `3ac5330` (test: rotated fixture + orientation row + docblocks)

**Plan metadata:** this SUMMARY's commit (docs: complete plan).

## Files Created/Modified
- `packages/contracts/src/types.ts` — `ImageExt = 'png' | 'webp' | 'jpeg'` + updated doc comment (CA-01 meta schema untouched — no schema regeneration; `reportSchema` never referenced `ImageExt`)
- `apps/api/src/ports.ts` — `STORAGE_KEY_REGEX` admits `.jpeg`; `IMAGE_EXTENSIONS`/`isImageExt` include it
- `apps/api/src/ingest/sniff.ts` — 3-byte `FF D8 FF` arm + docblock rewritten (JPEG no longer "rejected unconditionally")
- `apps/api/src/ingest/guard.ts` — `readJpegDimensions` SOF walker (standalone-marker rules, first SOFn, `null` on any malformed walk); `readDimensions` now an exhaustive switch; `assertDecodeSafe` caps untouched per plan
- `apps/api/src/ingest/structure.ts` — `switch (ext)` with the JPEG pass-through arm + full written rationale (inline and file docblock)
- `apps/api/src/ingest/harden.ts` — `autoOrient: true` (with never-remove rationale), `switch (ext)` + `jpeg({ quality: 80 })`, sniff-null copy names JPEG
- `apps/api/src/routes/incidents.ts` — `jpeg: 'image/jpeg'` in the one ext→MIME map (inverse derives automatically); sniff-null 400 copy names PNG, WebP and JPEG
- `e2e/make-fixtures.mjs` — three new browser-only emitters (valid JPEG, SOF-re-declared oversize, APP1-Exif-inserted rotated), each asserting its produced bytes
- `e2e/fixtures/valid-64x64.jpg`, `oversize-64mp.jpg`, `rotated-exif-80x40.jpg` — committed fixtures
- `e2e/ingest.spec.ts` — `jpegHeaderDims` test-side twin walker, `servedImageDims` browser-decode helper, 6 new rows

## Decisions Made
- Oversize fixture via synthetic SOF (plan-sanctioned): a real encoder output with the frame re-declared 8000×8192 — memory-flaky 64 MP canvas avoided; both sides ≤ 8192 so the PIXELS arm (not DIM) answers.
- Non-E0 sniff acceptance proven by round-trip re-submit of the served libvips bytes — artifact-level, R-12-compliant, no unit test.
- `jpegHeaderDims` in the spec deliberately mirrors the guard's walk rules so a drift between test reader and server reader fails loudly.
- The `default:` arms differ by contract: `guard.ts`/`harden.ts` throw `TypeError` (operational impossibility surfaces as 500-adjacent), `structure.ts` returns a structured `ok: false` (fail-closed refusal) — both compile-time unreachable while `ImageExt` is closed; neither silently passes.

## Deviations from Plan

None — plan executed exactly as written. (Two execution notes, not deviations: the Task-2 `guard.ts` file entry shipped zero further changes because Task 1's walker already established the boundaries the rows assert, and the plan's "Do not touch assertDecodeSafe's caps" was honored; the oversize/truncation fixtures take the two authoring routes the plan text itself offered.)

## Authentication Gates
None occurred.

## Issues Encountered
- None affecting the artifact. (One transient test-authoring slip — a mis-indexed APP1 assertion inside `make-fixtures.mjs` — was corrected before its first run; no committed file ever carried it.)

## User Setup Required
None — no external service configuration required.

## Threat Surface Notes
No surface beyond the plan's `<threat_model>` register: no new endpoints, no new file-access patterns, no schema change (the CHECK widening was 03-01's `0001`). All six threat IDs (T-03-03, -10, -11, -12, -13, -SC) mitigated as planned and evidenced in the coverage block; zero dependencies installed.

## Next Phase Readiness
- 03-04 (composer + attach) can consume the server JPEG lane: the client "attach a JPEG" proof will assert a WebP/PNG payload on the wire (the SDK never sends JPEG — unchanged by this plan).
- Verifier notes for the three `verification: judgment` prohibitions: `grep "ext === 'png' ?" apps/api/src/ingest/` must stay empty and the exhaustive switches keep their `never` guards.
- Known interim-red rows in `e2e/sdk.spec.ts` (41 Phase-2 one-shot rows, migrated by 03-07) were untouched and out of scope, per dispatch.

## Self-Check: PASSED
- All 12 changed/created files exist on disk (git status clean apart from the pre-existing CRLF-noise `schema/report.schema.json` and the untracked `watchbugus-fun/` playground, neither of this plan).
- All 3 task commits (`3019a94`, `9465b47`, `3ac5330`) are ancestors of HEAD; `commits: 3` measured from the on-disk ledger `e3d9073..HEAD`.
- Verification re-runs at close-out: `-g "JPEG"` chromium 6/6, full file chromium 23/23, `npm run verify -- e2e/ingest.spec.ts` 69/69 across chromium+firefox+webkit, api typecheck exit 0.

---
*Phase: 03-report-composer-annotation-editor-lazy*
*Completed: 2026-10-28*
