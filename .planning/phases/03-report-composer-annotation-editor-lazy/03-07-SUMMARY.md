---
phase: 03-report-composer-annotation-editor-lazy
plan: 07
subsystem: e2e-suite-migration + size/budget gates
tags: [playwright, composer, completeComposer, check-size, gate, prf-02, prf-03, suite-migration]

# Dependency graph
requires:
  - phase: 03-report-composer-annotation-editor-lazy
    plan: 03-03
    provides: the composer/review DOM contract the walk pierces, the enumerate-41 interim-red handoff, encode-at-Review-entry
  - phase: 03-report-composer-annotation-editor-lazy
    plan: 03-04
    provides: the degraded composer (already re-pointed here — 03-04 deviation 3 — so 03-07's failure-row scope is verification-only)
  - phase: 03-report-composer-annotation-editor-lazy
    plan: 03-05
    provides: the lazy lane + check-size max-of-twins/floor base, sdk-lazy-lane-purity gate, the 4-rule set closed to 5 here
  - phase: 03-report-composer-annotation-editor-lazy
    plan: 03-06
    provides: the DPR integer-coordinate mask harness (untouched by the migration — mask rows already walked), the permanently-mounted mask alertdialog (whose census broke ANN-04)
  - phase: 02-capture-redaction-privacy-core
    provides: the 41 Phase-2 one-shot rows, the artifact-level assertion helpers (analyzeRedaction, expectMaskedAndTargeted, expectNoRequest, readOutgoingImage) — all preserved
provides:
  - "completeComposer(page, options?) — the assertion-free composer walk every migrated row uses (composer -> optional prefill check -> fields -> Review -> review -> Send -> return at request-issued)"
  - "the full widget suite on the composer flow: 41 migrated one-shot rows, zero deleted, zero skipped, 453-test count unchanged"
  - "scripts/check-size.mjs final form: fixed lane order, max-of-twins lazy ceiling, anti-inline floor as its own verdict, every twin printed"
  - "scripts/gate.mjs five-rule set incl. sdk-no-html-sink; honest sdk-single-encode-sink wording"
  - "the phase's release-gate evidence: npm run verify 453/453 on chromium + firefox + webkit"
affects: [verify-work-03, phase-4-enrichment, phase-7-release-closeout]

# Actuals (#2632)
actuals:
  tokens: 6064   # chars/4 over the realized diff (24,258 chars, 5 files, 211+/35-)
  tasks: 3
  commits: 9     # MEASURED via git rev-list ${plan_head_before}..HEAD at authoring time

plan_head_before: 0d2dbe9c1a69cf6c75043421a2a0a697326f31ae
plan_head_after: 432b24b24f115d19f0a9c9c4620ff8db708ba960

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "one shared composer walk (completeComposer) for every migrated row — bespoke per-row editors are how assertions get quietly weakened (research F4)"
    - "walk returns at the observable request-issued edge (data-wb-screen === 'status', rendered synchronously by deliver()); the caller keeps its own terminal assertion"
    - "modal censuses count OPEN dialogs ([role=dialog/alertdialog][data-shown=true]) — permanently-mounted hidden dialogs belong to other tools"
    - "static gates count comment tokens: prose is worded around the forbidden token (02-04 Pitfall 1 precedent), never exempted"

key-files:
  created: []
  modified:
    - e2e/helpers/composer.ts
    - e2e/sdk.spec.ts
    - scripts/check-size.mjs
    - scripts/gate.mjs
    - packages/sdk/src/widget/launcher.ts

key-decisions:
  - "completeComposer never waits for 'Report sent' — callers keep terminal assertions; optional prefill assertions (expectPrefilledTitle/expectDefaultType) are DOM-copy checks, not pixel/request/terminal-copy ones"
  - "heavy rows pass a walk `timeout` (45 s for the two CAP-05 artifact frames, 30 s for the H-1 matrix) — a wait budget, no tier or threshold was touched"
  - "P2-D-01 now pins the prefill on BOTH surfaces: the composer DOM (walk option) and the wire (existing meta assertions)"
  - "sdk-no-html-sink also forbids outerHTML (same hazard class as the plan's three tokens; zero hits in the lane)"
  - "the six capture-failure rows needed no 03-07 edit — 03-04 deviation 3 already re-pointed them at the degraded composer; this plan verified the assertions stand (8 degraded-zone waits incl. both actions + expectNoRequest)"

requirements-completed: [PRF-02, PRF-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "All 41 Phase-2 one-shot rows walk the composer through the shared helper and still pass: nothing deleted, renamed away, or skipped — the row count is unchanged and every row keeps its artifact assertion"
    verification:
      - kind: e2e
        ref: "npm run verify — 453 passed (9.0 min), 0 failed, 0 skipped; e2e/sdk.spec.ts 91/91 on chromium + 91/91 firefox + 91/91 webkit"
        status: pass
      - kind: other
        ref: "npx playwright test --list — Total: 453 tests in 5 files / 273 in e2e/sdk.spec.ts, identical to the pre-migration baseline; no .skip/.fixme/.only markers in the file"
        status: pass
    human_judgment: false
  - id: D2
    description: "PRV-01/02/03 + P2-D-08 + S-7 + card + H-1 (DPR 1/1.25/2/3) rows keep their decoded-bytes assertions byte-identical after the walk (analyzeRedaction / expectMaskedAndTargeted / readOutgoingImage untouched)"
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#PRV-02 family 7/7 chromium + 7/7 firefox (tracer); H-1 4/4 + PRV-01/03/P2-D-08 3/3 chromium; whole set inside the 453-pass full run on three engines"
        status: pass
    human_judgment: false
  - id: D3
    description: "The capture-failure rows assert the degraded composer (notice composer.image.none + failure-distinct hint + Attach image + Continue with text only) and still hold zero requests before the user chooses — verified in place from 03-04's re-point"
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#CAP-03 blank / P2-D-12 oversize / OQ-1 / CAP-01-rejected / S-7 guard / fail-closed (expectZoneState degraded x8 sites) — all green in the 453-pass run on three engines"
        status: pass
    human_judgment: false
  - id: D4
    description: "The meta rows hold after the composer: P2-D-01 asserts the prefilled code-point-clamped title on the composer surface AND the wire, default type bug; P2-D-03 retry keeps one stored report, one Idempotency-Key, byte-identical resent parts, and the locked Capturing→Sending→Retrying→Sent headline sequence through the walk"
    verification:
      - kind: e2e
        ref: "e2e/sdk.spec.ts#P2-D-01 + P2-D-03 x2 + UI-SPEC backstop + A-5/A-7 — green on chromium (family runs) and inside the 453-pass full run on all three engines"
        status: pass
    human_judgment: false
  - id: D5
    description: "PRF-02 proven on emitted artifacts: lazy lane gates max(.js 6.6 / .mjs 6.3 KB gz) ≤ 25 with the ≥ 2 KB anti-inline floor reported as its own verdict (min twin 6.3), and the laziness rows count zero chunk requests before Annotate / exactly one after, on three engines"
    verification:
      - kind: other
        ref: "npm run build && npm run check:size — SIZE OK core 16.9/45, lazy 6.6/25 (max of .js 6.6 / .mjs 6.3), lazy-floor OK min twin 6.3 >= 2, adapter 0.3/14, runtime 23.8/80, PASSED exit 0"
        status: pass
      - kind: e2e
        ref: "e2e/sdk.spec.ts#PRF-02 lazy x2 — green in the 453-pass full run (chromium + firefox + webkit)"
        status: pass
    human_judgment: false
  - id: D6
    description: "PRF-03 proven on the real artifacts: runtime total (core + lazy + adapter) 23.8 KB gz ≤ 80 KB on the emitted dist files, with the A-12/M-2 worst-case note kept verbatim"
    verification:
      - kind: other
        ref: "npm run check:size — runtime 23.8 KB gz / 80 KB (core + lazy + adapter), PASSED"
        status: pass
    human_judgment: false
  - id: D7
    description: "All five static gates report one verdict: sdk-runtime-deps, sdk-no-host-storage, sdk-single-encode-sink (message no longer claims the sink is pending), sdk-lazy-lane-purity, and the new sdk-no-html-sink"
    verification:
      - kind: other
        ref: "node scripts/gate.mjs — 5 passed, 0 failed, 0 skipped; sink census shows exactly one toBlob (encode.ts:79); html-token census clean over 25 source files"
        status: pass
    human_judgment: false
  - id: D8
    description: "The three plan prohibitions (no row deleted/renamed/skipped; no vacuous migration — every row still asserts its artifact; the size gate never relaxed) hold as standing never-assertions"
    verification: []
    human_judgment: true
    rationale: "The plan marks all three must_haves.prohibitions verification: judgment — this run proves them at commit time (count guard, untouched helpers, byte-identical thresholds 45/25/80), but the standing never-claims are code-review properties for the phase verifier"

duration: 48 min
completed: 2026-10-28
status: complete
---

# Phase 03 Plan 07: Suite Migration + Budget Closure Summary

**The 41 Phase-2 one-shot rows all walk the composer through one shared `completeComposer` helper — zero deletions, zero skips, 453 tests × 3 engines green — and PRF-02/PRF-03 are closed on the emitted artifacts: lazy max-twin 6.6/25 KB with the 6.3 KB floor verdict, runtime 23.8/80 KB, five static gates one verdict.**

## Performance

- **Duration:** ~48 min (started 2026-10-28T21:26:35Z, completed 2026-10-28T22:14:38Z)
- **Tasks:** 3 (1 tracer + 2 auto)
- **Files modified:** 5 (0 created, 5 modified)
- **Full suite:** 453 passed in 9.0 min (workers: 1, chromium + firefox + webkit)
- **Estimate miss (#2632):** plan estimated 76,000 tokens (confidence low); the realized diff measures ~6,100 tokens (chars/4). The migration was insertions of one helper call per row family, not rewrites — exactly the mechanical shape the plan's "one helper, one walk" design intended.

## Accomplishments

- **Tracer (Task 1, `e55e914`):** authored `completeComposer(page, options?)` in `e2e/helpers/composer.ts` in its final assertion-free form — waits for the open-mode composer, optionally asserts the prefilled title and default segment, applies `title`/`note`/`type` only when provided, walks `Review report → section.review → Send report`, and returns once the request is issued (the observable `data-wb-screen === 'status'` switch `deliver()` renders synchronously at send-click). No pixel, request-count or terminal-copy lives in the helper. Then migrated the redaction family through it: `runRedactionRow` plus the standalone PRV-02 Luhn-card row; the family verified 7/7 chromium + 7/7 firefox before any expansion (⚡ tracer gate, auto-continue per end-of-phase mode).
- **Task 2 (six commits):** migrated the remaining 34 one-shot rows family by family — tracer/metrics (INT-02, CAP-01, CAP-04, CAP-05 ×4 incl. the DPR sub-describes, M-3; `4e18da1`), redaction artifacts (PRV-05, PRV-06; `81ef14d`), the H-1 matrix (`runHidpiMaskRow`; `88a9903`), isolation/globals (WDG-02 matrix ×4, WDG-03, WDG-05 ×3; `ea40d90`), meta (P2-D-01 — now also pinning the 200-code-point prefill + `bug` default on the composer surface; self-hosted; S-8; `3e218d4`), transport/status (P2-D-03 retry + 400 rows, UI-SPEC backstop, A-5/A-7 both legs, P2-D-12 sparse; `7f7e26c`). **Total migrated: 41 = the enumerated interim-red count from 03-03.** No row deleted, renamed or skipped; the shared `INCIDENT_POST_RE`/`interceptIncidentPosts`/`collectHeadlines` conventions kept. The six capture-failure rows' degraded-composer re-point (P2-D-12 ×2, CAP-01-rejected, OQ-1, S-7 guard, fail-closed) was already landed by 03-04 deviation 3 — this plan verified it: all eight `expectZoneState(page,'degraded')` sites assert the notice + both actions + `expectNoRequest`, and the WR-03 no-CSPRNG row correctly keeps the panel (its exit is pre-stage, not a captureNote).
- **Task 3 (`432b24b`):** closed the budget on artifacts — `check-size.mjs` final form (fixed lane order core → lazy → floor → adapter → runtime; lazy gates `max(.js, .mjs)` against 25 KB with every twin printed; the ≥ 2 KB anti-inline floor as its **own verdict row** on the min twin; the A-12/M-2 worst-case note verbatim). `gate.mjs` now reports the five-rule set as one verdict: added `sdk-no-html-sink` (token census over `packages/sdk/src` for innerHTML/outerHTML/insertAdjacentHTML/document.write — outerHTML is the plan's three plus the same hazard class) and re-pointed the `sdk-single-encode-sink` zero-sink message from "pending (Phase 3)" to an honest build-defect naming.

### Budget table (the plan requires these recorded)

| Lane | Before Phase 3 (measured 2026-10-28 baseline) | After (this plan's run) | Tier | Verdict |
|------|-----------------------------------------------|-------------------------|------|---------|
| core (`watchbug.js` / `.mjs`) | 9.3 / — KB gz | **16.9 / 16.7 KB gz** | ≤ 45 | PASS |
| lazy (`watchbug-annotator.js` / `.mjs`) | 0.3 KB (build stub) | **6.6 / 6.3 KB gz**, gate = max 6.6 | ≤ 25 | PASS |
| lazy floor (min twin) | n/a (pre-floor) | **6.3 KB gz** | ≥ 2 | PASS — editor really is in the chunk |
| adapter (`watchbug-dom-serialize.js` / `.mjs`) | 0.3 KB (stub seam) | **0.3 / 0.1 KB gz** | ≤ 14 | PASS |
| runtime total (core + lazy + adapter) | 10.0 KB | **23.8 KB** | ≤ 80 | PASS |

No tier was raised anywhere; the only edits to the gate were *which* artifact the lazy lane measures and *how* the floor prints.

## Task Commits

Each task committed atomically (Task 2 as the plan's per-family sequence):

1. **Task 1: tracer — `completeComposer` + redaction family** — `e55e914` (test)
2. **Task 2, family tracer/metrics** — `4e18da1` (test)
3. **Task 2, family redaction artifacts** — `81ef14d` (test)
4. **Task 2, family H-1 matrix** — `88a9903` (test)
5. **Task 2, family isolation/globals** — `ea40d90` (test)
6. **Task 2, family meta** — `3e218d4` (test)
7. **Task 2, family transport/status** — `7f7e26c` (test)
8. **Task 2, ANN-04 census regression fix** — `86dd18f` (test, deviation Rule 1)
9. **Task 3: budget closure (check-size + 5-gate set)** — `432b24b` (chore)

**Plan metadata:** this SUMMARY's commit (docs: complete plan).

## Files Created/Modified

- `e2e/helpers/composer.ts` — `completeComposer()` + `CompleteComposerOptions` authored in final form; helper docblock updated
- `e2e/sdk.spec.ts` — 41 migrated rows (the helper call is the only shape change); P2-D-01 gained the composer-surface prefill assertion; ANN-04 modal census counts open dialogs
- `scripts/check-size.mjs` — final lane report (own floor verdict, both twins printed); limits untouched
- `scripts/gate.mjs` — `sdk-no-html-sink` added; `sdk-single-encode-sink` message honesty; five rules reported as one verdict
- `packages/sdk/src/widget/launcher.ts` — docblock re-worded off the now-counted HTML token (no behavior change; comments are counted by this repo's gate discipline)

## Decisions Made

- Walk exit at `data-wb-screen === 'status'`: the only non-asserting observable that the request is in flight (`deliver()` renders the sending state synchronously at the Send click). Callers keep terminal assertions, so no row passes because the helper navigated instead of sent.
- Heavy rows carry the walk inside their existing timeout budget (`timeout:` option: 45 s CAP-05 artifact rows, 30 s H-1); measured worst-case rows actually ran 1.2–2.0 s on chromium and ≤2.6 s on webkit — the headroom stays as insurance, not a threshold change.
- `expectNoRequest`'s 600 ms settle window and every pixel threshold were kept byte-identical (acceptance criterion 6).
- The failure-rows scope collapsed to verification (03-04 deviation 3 had already migrated them) — re-editing would have churned green rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ANN-04's modal census counted a mounted-but-hidden dialog (pre-existing regression)**
- **Found during:** Task 2 (the plan's full-chromium verification — the row is a 03-05 artifact, not a migrated row)
- **Issue:** 03-06 Task 2 permanently mounts the once-per-session mask alertdialog (`role="alertdialog"`, `data-shown="false"`); ANN-04's raw `[role=dialog], [role="alertdialog"]` census counted it and failed on all three engines. It was invisible to 03-06 because its verification ran the mask scope, not the label rows.
- **Fix:** count only OPEN dialogs (`[data-shown="true"]`) — the same visibility hook the ANN-05 rows themselves assert on. The claim ("the text tool opens no modal", P3-D-08) keeps teeth: a label flow that opens a modal renders it shown.
- **Files modified:** e2e/sdk.spec.ts
- **Verification:** ANN-04 91/91 inside the full-file chromium run, and again ×3 engines in the 453-pass `npm run verify`.
- **Committed in:** `86dd18f`

**2. [Rule 3 - Blocking] launcher.ts docblock spelled the now-counted HTML token**
- **Found during:** Task 3 (adding `sdk-no-html-sink`)
- **Issue:** the new gate runs this repo's established token census (comments included, per 02-04 Pitfall 1 and 03-03's "no new code spells the counted tokens" discipline); launcher.ts:15's comment spelled the forbidden token, so a strict gate could only pass by wording.
- **Fix:** reworded the comment to "never an HTML-parse sink (T-02-01: textContent/createElement only)". No gate exemption was added (02-04 precedent).
- **Files modified:** packages/sdk/src/widget/launcher.ts
- **Verification:** `node scripts/gate.mjs` — 5 passed / 0 failed / 0 skipped.
- **Committed in:** `432b24b`

**3. [Rule 2 - Missing Critical] `sdk-no-html-sink` also forbids outerHTML**
- **Found during:** Task 3
- **Issue:** the plan lists three tokens; `outerHTML` is the identical parse sink in reverse (assignment or read-back both re-open the HTML surface SEC-05/T-02-01 close).
- **Fix:** added the fourth token to the census (zero hits — the lane was checked before committing).
- **Files modified:** scripts/gate.mjs
- **Verification:** gate green with the arm active; a hand-checked census over all 25 source files.
- **Committed in:** `432b24b`

**4. [Rule 3 - Interpretation] Task 1's verify scope dictated migrating the standalone card row too**
- **Found during:** Task 1 (tracer)
- **Issue:** the tracer's `<verify>` selects `-g "PRV-02"`, which includes the standalone PRV-02 Luhn-card row that does NOT share `runRedactionRow`; leaving it unmigrated would fail the tracer gate for a reason the plan's own action text ("change runRedactionRow") did not anticipate.
- **Fix:** the card row's inline body took the same one-line walk insertion (its pixel assertions untouched) — same family, same edit shape.
- **Files modified:** e2e/sdk.spec.ts
- **Verification:** PRV-02 7/7 chromium + 7/7 firefox (the plan's exact verify commands).
- **Committed in:** `e55e914`

**5. [Scope correction - plan premise] The six failure-row re-points and the probeWidget additions were already owned by 03-04**
- **Found during:** Task 2 (planning the "rows whose SURFACE changed" batch)
- **Issue:** 03-07-PLAN Task 2 re-lists `P2-D-12`/`CAP-01 rejected`/`OQ-1`/`fail-closed` re-points and "add the probeWidget fields the migrated rows need" as 03-07 work; 03-04 deviation 3 had already re-pointed the six rows, and the probe fields those rows read already exist (`composerState/NoticeHeading/NoticeHint/AttachVisible/ContinueVisible` + friends).
- **Fix:** verification instead of edit — all eight degraded waits assert `.composer[data-wb-state="degraded"]` (via `expectZoneState`), both actions and zero-requests; no probe field was needed by any migrated row (none added, none removed). The 41-row migration count is unchanged by this.
- **Files modified:** none (inspection only)
- **Verification:** degraded rows green in the 453-pass full run on all three engines.

**6. [Cosmetic] WDG-01 rode in the tracer/metrics commit**
- **Found during:** Task 2 (commit staging)
- **Issue:** its edit (walk before the `Sending…` in-flight probe) was made in the first editing batch, before the family split could stage it separately; the plan lists WDG-01 under isolation/globals.
- **Fix/impact:** none needed — the row is fully verified; the ledger records the family it landed in, not the family it was planned for.

---

**Total deviations:** 6 (1 bug regression fixed, 2 critical-function/security-rule items, 1 plan-verify-scope interpretation, 1 plan-premise correction (no-op edits), 1 cosmetic). **Impact on plan:** every deviation preserves the plan's contracts; the only touched product file was a comment re-word; the 41-row / zero-deletion / untouched-thresholds truths and all three prohibitions stayed intact. No scope growth.

## Issues Encountered

- None beyond the deviations above. The interim-red story closed exactly as the wave contract predicted: the 41 failures were all pre-send headline waits; every one was repaired by inserting the walk, and none required touching an assertion. The `--list` count guard (453 total / 273 sdk.spec) never moved across the whole migration.

## Verification Log (plan-level)

1. `npm run build && npm run check:size` — PASS: core 16.9 KB / 45; lazy 6.6 / 25 (max of .js 6.6 / .mjs 6.3); lazy-floor >= 2 KB own verdict — OK (min twin 6.3); adapter 0.3 / 14; runtime 23.8 / 80; `check:size PASSED`.
2. `node scripts/gate.mjs` — PASS: 5 rules, 5 passed / 0 failed / 0 skipped; sink rule reports the single `encode.ts:79 toBlob` and no longer claims the sink is pending.
3. `npm run verify` — PASS: **453 passed (9.0 min)** — chromium, firefox and webkit, 0 failed, 0 skipped; `e2e/sdk.spec.ts` 91/91 per engine.
4. `npx playwright test --list` — 453 total / 273 in sdk.spec.ts — identical to the pre-migration baseline (no row deleted rather than migrated).

## Security / Threat Surface

- **T-03-27** mitigated as designed: one shared helper, zero deletions, pixel/request helpers byte-identical; the count guard ran before and after.
- **T-03-28** mitigated: 45/25/80 limits untouched — the only edit was which artifact the lazy lane measures plus the floor's own verdict line.
- **T-03-29** re-proven: the PRF-02 laziness rows ran in the full suite on all three engines (green).
- **T-03-SC:** zero dependencies installed. The new `sdk-no-html-sink` gate closes T-02-01/SEC-05 statically over the whole lane. **No threat flags beyond the plan's register.**

## Known Stubs

None introduced — `completeComposer` is wired by every migrated row, and this plan wired nothing that depends on later plans.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 3 is plan-complete (7/7).** Success criteria 1–5 of the roadmap phase are all suite-proven; the real-picker manual UAT (03-VALIDATION "Manual-Only Verifications") still belongs to `/gsd-verify-work 03` together with the human-judgment coverage entries (D8 here, plus 03-04/05/06's prohibition entries).
- The suite is the only verification surface Phase 4 rows will extend: every new meta field rides the same composer walk and the same intercepted-meta assertions.
- Release-gate note for Phase 7: runtime 23.8 KB of the 80 KB tier with the full editor + both locales shipped; the core tier sits at 37.5 % — the A-12/M-2 arithmetic stays visible in every `check:size` run.

---

*Phase: 03-report-composer-annotation-editor-lazy*
*Completed: 2026-10-28*

## Self-Check: PASSED

- All 5 key-files verified present on disk at authoring time (`composer.ts`, `sdk.spec.ts`, `check-size.mjs`, `gate.mjs`, `launcher.ts`).
- All 9 task commits verified as ancestors of HEAD (`e55e914`, `4e18da1`, `81ef14d`, `88a9903`, `ea40d90`, `3e218d4`, `7f7e26c`, `86dd18f`, `432b24b`); `commits: 9` measured from the on-disk ledger `0d2dbe9..HEAD`, matching the frontmatter.
- Plan-level verification re-run at HEAD: full `npm run verify` 453/453 green on three engines (9.0 min); `check:size` PASSED; `gate.mjs` 5/5; `npm run lint` exit 0.
