---
phase: 02-sdk-tracer-bullet-widget-capture-auto-redaction
artifact: UI-REVIEW
pillars: 6
score: 22
max_score: 24
verdict: pass
audited_at: "2026-10-24"
baseline: 02-UI-SPEC.md
---

# Phase 2 — UI Review (Retroactive 6-Pillar Audit)

> Visual audit of the implemented widget surfaces — floating launcher + status panel — against the
> authoritative design contract `02-UI-SPEC.md`. Graded 1–4 per pillar with file:line evidence and
> one live-capture probe pass.

---

## Scope

**Audited (this phase's UI):**

| Surface | Source |
|---------|--------|
| Floating launcher (WDG-01) | `packages/sdk/src/widget/launcher.ts` |
| Floating status panel (P2-D-02, CA-04 dialog) | `packages/sdk/src/widget/status-panel.ts` |
| Isolation host + token layer (`WidgetHost` adapter) | `packages/sdk/src/widget/host.ts` |
| Locked copy map + `t()` | `packages/sdk/src/strings.ts` |
| Mount, CSS composition, state wiring | `packages/sdk/src/index.ts` |

**Explicitly out of scope:** `apps/panel` (React SPA) — **no phase-02 commit touches it**:
`git log --grep="02-0"` returns 30 commits, `git log --grep="02-0" -- apps/panel` returns **zero**.
The panel's most recent changes on this branch come from separate quick-batch commits (`261014-*`)
and phase 01, not from phase 02. `02-UI-SPEC.md` § Scope locks the panel out of this phase (lines 28–30).

---

## Method & Evidence

1. **Contract read in full:** `02-UI-SPEC.md` (geometry, palette, typography, spacing, motion,
   accessibility, interaction/state, copywriting) — treated as authoritative.
2. **Source audit** of the five widget files above, line by line, against every contract clause.
3. **Live probe pass** (throwaway `e2e/tmp-ui-*.spec.ts`, chromium, **8/8 green, file deleted
   afterwards — no repository residue**): booted the open-mode `watchbug.e2e.js` bundle on the real
   fixture + hostile fixture, drove the widget into `idle`, `capturing`/`sending`, `retrying`,
   `sent` and all `failed*` states, and read computed styles out of the shadow root. Screenshots and
   JSON dumps were written to the session scratch dir
   (`C:\Users\Dekker\AppData\Local\Temp\opencode\ui-review-02\`, not committed).
   The e2e bundle differs from production only in `SHADOW_MODE` (R-14, `scripts/build.mjs`), so CSS,
   geometry and copy are identical to the shipped artifact.
4. **Contrast arithmetic** computed from the shipped token values (WCAG 2.2 relative luminance).
5. **Copy diff:** automated key+value comparison of `strings.ts` against the UI-SPEC copy block —
   **14 keys / 14 keys, 0 missing, 0 extra, 0 value mismatches.**
6. **Scope check:** `git status` before/after; the audit added nothing to the repo.

Permanent-suite evidence cited below is the phase's own one Playwright suite
(`npm run verify` — 294/294 across chromium + firefox + webkit, per `02-05-SUMMARY.md`).

---

## Score Summary

**Phase 02 — Overall: 22 / 24**

| Pillar | Score | Headline |
|--------|-------|----------|
| Copywriting | 3/4 | Byte-exact locked copy; widget is EN-only while the product is EN+ES (deferred by contract) |
| Visuals | 4/4 | Geometry measured contract-exact; hostile-CSS matrix green; motion observed live |
| Color | 4/4 | Token discipline + reserved-use enforcement; every text pair ≥ 4.57:1 |
| Typography | 4/4 | Exactly 3 sizes / 2 weights / px-only, measured in the live shadow root |
| Spacing | 4/4 | 4-px scale honored everywhere, all measured values match the contract |
| Experience Design | 3/4 | Full state machine + a11y contract implemented; missing `lang`, no permanent motion/focus rows |

**Verdict: PASS.** No BLOCK-level findings. Two MAJOR findings (F-01, F-08) — both in the
locale/accessibility axis, both one-line-or-contract-tracked, neither a violation of INV-01, INV-02
or RNF-02.

---

## Findings Register

| ID | Pillar | Severity | Finding | Evidence |
|----|--------|----------|---------|----------|
| F-01 | Copywriting | MAJOR (contract-deferred) | Widget copy is English-only while RNF-03 requires EN+ES and the panel already ships both locales. Locked out of this phase (WDG-06, Phase 3) — but RNF-03 cannot be signed off until it lands, and today a Spanish user gets an ES panel + an EN widget | `strings.ts:11-27` (no `es` map); `apps/panel/src/i18n.ts:58,99`; `02-UI-SPEC.md:28-30,253-255`; AGENTS.md RNF-03 |
| F-02 | Copywriting | MINOR | `status.rejected` has no `*.hint` key. A contract 4xx whose `message` is empty/absent renders headline + buttons with **zero** explanation — thinner than every other failure class (all of which guarantee a hint) | `strings.ts:24` (no rejected hint); `status-panel.ts:348-355` |
| F-03 | Visuals | MINOR | `.panel` has no `max-height`/`overflow`. It is bottom-anchored at `88px` and grows upward, so `top = 100vh − 88 − height`. Measured: at a 300 px viewport with a 4-line reason the panel top sits at **13.3 px**; a maximal 240-char reason (~230 px tall) clips off-screen below ≈320 px viewport height (embedded iframes, landscape phones) | `status-panel.ts:51-72` (no max-height/overflow); scratch `short-300.json` (`top: 13.29`, `height: 199.73`, `viewport: 300`) |
| F-04 | Color | MINOR | Panel border `#d6dae1` is **1.40:1** against a white host page; the secondary button's `#eef0f4` fill is 1.06:1 against the white panel. Not a formal WCAG 1.4.11 failure (component identity is carried by text), but the panel/button boundaries on a white page rest on the soft shadow alone. Value is contract-locked → fix belongs in the spec, not the code | `status-panel.ts:60,120`; `host.ts:76,75`; `02-UI-SPEC.md:138` |
| F-05 | Color | MINOR | Two color literals outside the `--wb-*` map, against `02-UI-SPEC.md:155-156` ("zero hardcoded colors in component code"): `color: #1b1f26` duplicates `--wb-color-ink`, and the elevation is a raw `rgba()` | `host.ts:69`; `status-panel.ts:63` |
| F-06 | Typography | MINOR (spec-side) | The contract contradicts itself on the retry counter: the Body row makes in-flight status text 15 px/600, the Label row lists the "retry counter" as 13 px/400. Implementation renders `Retrying (1 of 3)…` as body text — **measured 15 px/600** — following the Body row. Resolve the spec text | `02-UI-SPEC.md:118-120`; `status-panel.ts:76-83,325-330`; scratch `retrying.json` |
| F-07 | Spacing | INFO (spec-side) | `02-UI-SPEC.md:101` says the tokens are declared `--wb-space-1…6`, but its own table lists 7 values (xs…3xl). The implementation declares **7** (`--wb-space-1…7`), i.e. it follows the table. No defect; the spec's prose is wrong | `02-UI-SPEC.md:89-99,101`; `host.ts:85-91` |
| F-08 | Experience | MAJOR | No `lang` on widget content. `:host, .wrap { all: initial }` clears the inherited `lang`, and `setAttribute('lang', …)` appears **nowhere** in `packages/sdk/src` (grep, 0 matches). Assistive tech may apply the host document's or the user's default language to English strings — mispronunciation on a `lang="es"` page, worse once `es` ships | `host.ts:60`; grep result across `packages/sdk/src` |
| F-09 | Experience | MINOR | `prefers-reduced-motion` (UI-SPEC:234) and the `:focus-visible` ring (UI-SPEC:240) have **no permanent e2e row** — the suite only source-asserts the media branch (`02-01-SUMMARY.md` D5 labels it "source assertions"). This audit verified both live once: reduced-motion → `animation: none` on panel **and** spinner; keyboard focus → `2px solid rgb(47,111,235) offset 2px`. The throwaway probe was deleted; add one permanent row each | `status-panel.ts:155-158`; `launcher.ts:46-49`; `02-UI-SPEC.md:234,240`; scratch `reduced-motion.json`, `focus.json` |
| F-10 | Experience | MINOR | The document-level Escape handler calls `preventDefault()` on **every** Escape while a terminal panel is open. A-7 sanctions the listener (and teardown removes it), but unconditionally swallowing Escape's default is a global effect the host did not opt into. Impact is low (Escape's default action is usually nil); dropping the `preventDefault` removes the surface entirely | `status-panel.ts:244-248,250-255`; `02-UI-SPEC.md:245-246,334` |
| F-11 | Experience | INFO | No cancel affordance while in flight; the launcher is disabled/dimmed instead. Spec-locked re-entrancy (`one report per gesture`) — recorded so it is not mistaken for a gap at verify-work | `02-UI-SPEC.md:214-215`; `launcher.ts:50-53`; `sdk.spec.ts:840,888` |
| F-12 | Visuals | INFO | Fixed `right/bottom: 24px` placement can cover host-page corner UI. Configurability is explicitly deferred (A-4) and is a **consultation trigger** when it lands, since `init()` is public | `02-UI-SPEC.md:331`; `launcher.ts:26-27` |

### BLOCK-level findings

**None.** No contract clause of `02-UI-SPEC.md` is materially violated, and no AGENTS.md invariant
(INV-01 closed shadow root, INV-02 single global, RNF-02 host CSS isolation) is weakened by any
finding above. Nothing blocks `/gsd-verify-work 02`.

---

## Pillar Detail

### 1. Copywriting — 3/4

**What works:**

- **Contract fidelity is exact.** Automated diff of `strings.ts` against `02-UI-SPEC.md` lines 258–274:
  14/14 keys, zero value mismatches. Every visible string flows through `t()`; no literal copy exists
  in component code (`status-panel.ts` imports `t` at line 16 and calls it at 209, 212, 320–349;
  `launcher.ts:118`).
- **Voice is consistent and actionable.** Every failure pairs a plain-language headline with
  `Nothing was sent.` + a concrete next step (`strings.ts:17-24`) — exactly the "loud, never silent"
  contract (M-6 / P2-D-12). Sentence case, real apostrophes (`Couldn't`), typographic ellipses (`…`)
  and em-dashes are used correctly throughout.
- **Untrusted text is bounded:** server reasons render via `textContent`, truncated at 240 chars on a
  word boundary with an ellipsis (`status-panel.ts:19,162-168,352`) — live-verified: the 4-line reason
  in `05-failed-rejected-long-reason.png` ends `them to…` inside the 320 px panel.

**Why not 4:** F-01 (EN-only widget against an EN+ES product) and F-02 (rejected state can render
without any explanatory hint).

### 2. Visuals — 4/4

**Measured against the contract (live, chromium, 1280×720 unless noted):**

| Contract item (`02-UI-SPEC.md`) | Measured | Result |
|---|---|---|
| Launcher 48×48, radius 24, `right/bottom 24px` | 48×48, `24px`, insets 24/24 | ✓ |
| Panel `right:24px; bottom:88px`, `width: min(320px, 100vw−48px)`, padding 16, radius 8 | 320 wide, bottom 88 (24+48+16), padding `16px`, radius `8px` | ✓ |
| Panel entrance `opacity + translateY(4px→0)` 120 ms | `wb-panel-in 0.12s ease-out`; mid-flight `rect.bottom=636` vs settled `632` (the 4 px travel) | ✓ |
| Spinner 12×12, 700 ms linear | CSS `12px` + `wb-spin 0.7s linear` (bounding box read 16 px — rotated bbox, not layout) | ✓ |
| Action buttons 36 px tall, 8 px gap, right-aligned; retry accent-filled | height `36px`, `gap: 8px`, right-aligned, retry `#2f6feb` | ✓ |
| Focus ring 2 px / 2 px offset | keyboard focus → `2px solid rgb(47,111,235) offset 2px` | ✓ |
| Hostile host CSS cannot hide/break the widget | `variant: 'display'` (`* {display:none!important}`) → host `display: block; position: fixed; z-index: 2147483647` | ✓ |
| One shadow `<style>`, no `rem`/`em`, no `part`, no `adoptedStyleSheets` | `stylesheetCount: 1`; unit grep → only `100vw` (contract-mandated); no `::part`/`adoptedStyleSheets` matches | ✓ |
| Narrow viewport clamp | 360 px viewport → panel width **312** = 360−48 | ✓ |
| Launcher dimmed while panel open | `opacity: 0.6` + `disabled` (visible in every terminal screenshot) | ✓ |

Isolation is also proven by the phase's own suite: the hostile matrix (`display`, `fontsize`,
`unset`, `transform`, `zindex`, `adjacent`, `empty`) runs with non-vacuous control assertions
(`sdk.spec.ts:1078-1093,1111+`), and the closed production bundle keeps the inline contract under
`*:not(html):not(body) {display:none!important}` (`sdk.spec.ts:1095-1109`).

**Screenshots (session scratch, not committed):** `01-idle-launcher.png`, `04-failed-capture.png`,
`06-retrying.png`, `07-sent.png`, `08-narrow-360.png`, `09-short-viewport-300.png` — the widget reads
as a single coherent system: circular accent launcher, white card, red terminal headline with `✕`,
green `✓` on success, dimmed launcher behind every open panel.

**Why not a perfect record:** F-03 (no vertical bound on the panel) is a real edge case for short
viewports; graded MINOR because the contract never specified one and the common desktop range is safe.

### 3. Color — 4/4

- **Token discipline:** every color lives in `--wb-*` custom properties declared once on the shadow
  wrapper (`host.ts:74-84`); component CSS references only `var(--wb-*)`. Panel palette mirrors
  `apps/panel/src/tokens.css` (P1-D-06) as required — measured live: surface `#ffffff`, accent
  `#2f6feb`, danger `#b3261e`, muted `#5b6472`.
- **Reserved-use enforcement verified by grep:** accent appears in exactly four roles — launcher fill
  (`launcher.ts:35`), primary action fill (`status-panel.ts:130`), focus ring (`launcher.ts:47`,
  `status-panel.ts:136`), spinner arc (`status-panel.ts:144`). Destructive appears in exactly two —
  failure headline (`status-panel.ts:88`) and `✕` glyph (`status-panel.ts:91`). Nothing else.
- **Contrast (computed from shipped tokens):**

| Pair | Ratio | Requirement |
|---|---|---|
| Body ink `#1b1f26` on `#ffffff` | 16.53:1 | AA ✓ (spec claimed ≥12:1) |
| Muted hint `#5b6472` on `#ffffff` | 5.98:1 | AA ✓ (spec claimed ≥4.5:1) |
| Launcher glyph `#ffffff` on `#2f6feb` | 4.57:1 | AA ✓ (reproduces the spec's 4.57 exactly) |
| On accent hover `#2962cf` / active `#2456b8` | 5.61 / 6.78 | AA ✓ |
| Danger headline `#b3261e` on `#ffffff` | 6.54:1 | AA ✓ |
| Success glyph `#1e7a46` on `#ffffff` | 5.35:1 | AA ✓ |
| Focus ring `#2f6feb` vs page | 4.57:1 | ≥3:1 ✓ |
| Dismiss label `#1b1f26` on `#eef0f4` | 14.49:1 | AA ✓ |

- **No host-inherited color:** `all: initial` + explicit `color` on the wrapper (`host.ts:60,69`);
  `currentColor` from the host never reaches widget text.
- **Fixed light palette** on dark host pages is Assumption A-3 (locked, `02-UI-SPEC.md:330`) —
  a white card on a dark page still has ≥12:1 internal contrast, so it degrades gracefully; a
  `prefers-color-scheme` variant is additive in Phase 3 alongside i18n.

Deduction is nil at pillar level: F-04/F-05 are logged as minors (boundary softness + two literals),
neither is a formal AA failure nor a visual inconsistency a user can perceive.

### 4. Typography — 4/4

- **Exactly 3 sizes, exactly 2 weights — measured:** in-flight/terminal headline `15px/600` (spec Body),
  terminal headline `19px/600` with `line-height: 22.8px` (=1.2), hints/reason/buttons `13px/400`
  (buttons `600`, `line-height: 13px`), body line-height `22.5px` (=1.5), hint line-height `18.2px`
  (=1.4). No fourth size or third weight appears anywhere.
- **px-only:** unit grep over the widget CSS matches only `100vw` (which the contract itself mandates
  for the width clamp). Zero `rem`/`em` → a hostile `html {font-size: 4px}` cannot reach the widget
  (matrix row `fontsize` green, `sdk.spec.ts:1078+`).
- **Font stack** re-declared after `all: initial`: `system-ui, -apple-system, 'Segoe UI', Roboto,
  sans-serif` measured on `.wrap`, launcher, panel, headline, hint and buttons. No `@font-face`, no
  external font request (RNF-01 size budget intact: core **8.5 KB gz / 45 KB**, `02-05-SUMMARY.md`).
- **Ink is re-declared, never `currentColor`** from the host (`host.ts:69`).

Deduction: F-06 only — a spec-internal contradiction about the retry counter's size, resolved by the
implementation in favour of the Body row and verified live at 15 px/600.

### 5. Spacing — 4/4

- **Scale is honored and confined:** `--wb-space-1…7` = 4/8/16/24/32/48/64 declared on the inner
  wrapper only — never on `:host`, never on `document` (`host.ts:85-91`).
- **Measured:** panel padding `16px`; hint/reason `margin-top: 8px`; action row `margin-top: 8px`,
  `gap: 8px`; head `gap: 4px`; viewport insets 24/24; panel↔launcher gap 16 (= 88 − 48 − 24);
  buttons `height: 36px; padding: 0 16px`; launcher `48×48`, `margin/padding: 0`.
- **Documented exceptions only:** 48 px target (WCAG 2.2 AA ≥24 px), 36 px buttons, 2/2 focus ring —
  all three and no others (UI-SPEC:103-107).
- **All values are multiples of 4**; no stray 6/12/20 px spacing values exist (the `6px` button radius
  and `1px` border are shape tokens, not spacing).

Deduction: none beyond the INFO note F-07 (spec prose says `…1…6` while its own table lists 7 values).

### 6. Experience Design — 3/4

**State machine & feedback (contract: Interaction & State):**

- Every UI-SPEC state renders: `idle` (launcher only, panel `data-hidden=true` — measured width 0),
  `capturing`, `sending`, `retrying {n}/{max}`, `sent`, `failed{capture,blank,network,rejected}`
  (`status-panel.ts:281-370`). The suite asserts the exact progression
  `Capturing… → Sending… → Retrying (1 of 3)… → Report sent ✓` in order (`sdk.spec.ts:859-863`).
- **Never silent (M-6):** every failure renders headline + hint + `Try again`/`Dismiss` and the suite
  asserts **zero** POST attempts in the same breath (`sdk.spec.ts:719-810`).
- **Re-entrancy:** launcher `disabled` + dimmed while a panel is open; re-armed on dismiss
  (`index.ts:128-131`; asserted `sdk.spec.ts:840,888`).
- **Terminal affordances:** 5 s auto-dismiss on `sent` and `Escape`-dismiss of a terminal panel are
  both e2e-covered (`sdk.spec.ts:924-971`); the `keydown` listener exists only while a terminal
  panel is visible and is removed on `destroy()` (`status-panel.ts:250-255,375-381`) — A-7 honored.

**Accessibility (measured / grep-verified):**

- Real `<button>`s with `aria-label="Report a bug"` (measured on the focused element), 48×48 launcher
  and 36 px actions — all ≥ 24×24 (WCAG 2.2 AA).
- Text container `role="status" aria-live="polite"` (measured `role: status, live: polite`); terminal
  failure headline additionally `role="alert"` (asserted at `sdk.spec.ts:736,761,784,882,1927`).
- **No focus stealing:** `.focus(` appears nowhere in `packages/sdk/src`; focus moves only on Tab
  (tree order: launcher → actions).
- Spinner and `✕` glyph `aria-hidden="true"` (`status-panel.ts:189,192`).
- Motion: entrance + spinner verified live, and **frozen under `prefers-reduced-motion: reduce`**
  (`animation: none` measured for both) — but only in this audit's throwaway probe (F-09).

**Robustness:** hostile-CSS matrix with non-vacuous controls, Escape teardown, timer teardown on
re-render (`status-panel.ts:286-289`), `textContent`-only rendering (no HTML sink anywhere in the SDK).

**Why 3/4:** F-08 (no `lang` — a concrete AT defect class) and F-09 (two contract items with no
permanent regression row) are both cheap to fix and both would be silent regressions later.

---

## Re-audit Triggers

Re-run this audit when any of the following lands: Phase 3 i18n (`stringsEs` + locale resolver +
`lang` attribute — F-01/F-08), the composer/annotator surfaces, any change to `02-UI-SPEC.md`
geometry/palette, or a `prefers-color-scheme` variant (A-3).

---

## Artifact Integrity

- **Files modified by this audit:** `.planning/phases/02-sdk-tracer-bullet-widget-capture-auto-redaction/02-UI-REVIEW.md` — **only this file.**
- **Throwaway probe:** `e2e/tmp-ui-audit.spec.ts` created, run (8/8 green, chromium), then **deleted**
  before returning; `git status --short` shows no audit residue in the repository (only the
  pre-existing `schema/report.schema.json` stat noise, untracked `watchbugus-fun/`, and the sibling
  capability step's `02-SECURITY.md`).
- **No commits made** — the orchestrator serializes commits after all capability steps return.
- **Scratch evidence** (screenshots + JSON dumps + contrast/copy-diff scripts) lives in
  `C:\Users\Dekker\AppData\Local\Temp\opencode\ui-review-02\` and is intentionally outside the repo.

---

## ▶ Next Up

**Phase 02: UI audit complete — 22/24, PASS, no BLOCK findings**

`/clear` then:

`/gsd-verify-work 02`

---

**Also available:**
- `/gsd-code-review 02` — bug/security review of the same phase diff
- `/gsd-extract-learnings 02` — harvest decisions and patterns before closing the phase
