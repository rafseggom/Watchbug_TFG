# CONTINUITY PACK — Watchbug SDK

State preserved across session resets. Read this at the start of every session (ASE §4D, *Anti-Amnesia*).

**Last updated:** 2026-10-05 — after the initial Consultation round, before `.planning/` generation.

---

## 1. Current progress

| Step | Status |
|------|--------|
| Consultation round (restricted decisions) | ✓ Complete — see `resolution-record.md` |
| Governing-document reconciliation | ✓ Complete — `## Enmienda` blocks appended |
| `.planning/PROJECT.md` | ○ Not started |
| `.planning/config.json` | ○ Not started |
| Research (stack / features / architecture / pitfalls) | ○ Not started |
| `.planning/REQUIREMENTS.md` | ○ Not started |
| `.planning/ROADMAP.md` | ○ Not started |
| Phase 1 planning | ○ Not started |

**Next action:** `/gsd-new-project` Step 3 (Deep Questioning) → PROJECT.md → config → research → requirements → roadmap. The questioning phase is largely satisfied by `resolution-record.md`; remaining gaps are listed in §3.

---

## 2. Governing context

- **Mission Brief** — `documentation/mission-brief.md` (RF-01…08, RNF-01…03, CA-01…05, non-goals, autonomy envelope)
- **Mentorship Pack** — `documentation/mentorship-pack.md` (INV-01…03, SEC-01…06, RNF budgets, verification commands, consultation triggers)
- **ASE Instructions** — `documentation/ase-instructions.md` (C-B-D-C, coordination artifacts, paradox mitigations)
- **Resolution Record** — `documentation/resolution-record.md` (R-01…R-17, D-01…D-08, Q-01…Q-06)

⚠ `AGENTS.md` is **non-authoritative** (R-16). It is stale scaffolding and will be regenerated.

---

## 3. Open questions

Full detail in `resolution-record.md` §4.

- **Q-01** — Override window on R-14 (Shadow DOM + build flag) and R-15 (TypeScript end-to-end) is open until the next interaction.
- **Q-02** — Console-log payload caps. Unbounded console capture is a cheap DoS vector past per-IP rate limiting.
- **Q-03** — Retention N (default 30 days) confirmation; whether it is panel-configurable.
- **Q-04** — Is `public_key` rotation UI v1 or v2? Leaning v2.
- **Q-05** — University IP policy must be confirmed before the repo is public (Apache-2.0, R-07).
- **Q-06** — Default `CaptureSource` adapter: `getDisplayMedia` (≈1 KB, pixel-perfect, raises a share sheet) vs DOM serialization (8–14 KB, silent failure modes). Unscheduled; decide at phase planning with a spike if needed.

---

## 4. Dead-ends

Failed or rejected paths. **Do not re-explore.** Full rationale in `resolution-record.md` §3.

| ID | Rejected path |
|----|---------------|
| D-01 | Treating `AGENTS.md` as governing |
| D-02 | Reading `npm run test:*` vs `pytest` as a contradiction (disjoint layers) |
| D-03 | Single 45 KB whole-project budget (superseded by R-01 tiering) |
| D-04 | `html2canvas` for capture (≈50 KB gzipped) |
| D-05 | `fabric.js` / `konva` for the annotator (≈85 KB / ≈45 KB gzipped) |
| D-06 | Gaussian blur as the masking primitive (partially invertible) |
| D-07 | Python 3.10 as a target (EOL October 2026) |
| D-08 | SVG `foreignObject` DOM serialization as *primary* capture path |

---

## 5. Standing constraints for any future session

1. **R-12 is owner-stated policy, not a preference.** E2E and property assertions only. No unit-test suite, no coverage targets. Do not reintroduce them.
2. **R-17 is owner-stated policy.** No calendar-driven descoping. Cut scope by coherence only.
3. **R-13 is a security invariant derived from SEC-02.** Masking = solid fill or block pixelation ≥8 px. Never gaussian blur, never CSS overlay.
4. **Consultation triggers still bind** (`mentorship-pack.md` §5.2, `mission-brief.md` §3). Anything touching the SDK public interface, the `/api/incidents` schema, the isolation strategy, DB schema, or new non-permissive dependencies requires a Consultation Request Pack before code changes.
5. **Non-goals are hard** (`mission-brief.md` §2). R-02's reserved ports are *seams only* — building a Jira/GitHub/Slack adapter, session replay, or AI triage is out of scope even though the seam exists.
