# Watchbug SDK

## What This Is

Watchbug is an open-source, self-hostable bug-reporting and visual-feedback SDK. A developer adds one script tag to their web app; their end users get a floating widget that screenshots the current page, lets them annotate it, mask anything sensitive, and file it as a bug or as plain feedback — together with console logs and environment metadata. The developer then triages those reports in a self-hosted admin panel, deployed as containers.

It exists for developers who want Marker.io / Sentry-style user feedback **without** sending their users' data to a third-party SaaS and without the weight of session-replay tooling. Primary audience: developers and integrators self-hosting their own tooling. Secondary audience: the degree committee evaluating this as a TFG.

## Core Value

**When a bug report lands, the developer can reproduce the bug from it — and neither the report nor its screenshot ever leaves the developer's own infrastructure.**

Every prioritisation trade-off resolves against this sentence. Capture fidelity and metadata completeness serve the first clause; self-hosting, destructive masking and the no-host-credentials rule serve the second. When they conflict, the second clause wins — a report that leaks is worse than a report that is thin.

## Requirements

### Validated

- ✓ A developer can self-host the entire stack with a single `docker compose up` (RF-08, INV-03) — Phase 1
  (cold `docker compose up -d --build` observed db → healthy → api ordering; exactly three services; `npm run verify` 132/132 green)
- ✓ An end user can annotate a capture with drawing, arrows, text and a masking tool before sending (RF-03) — Phase 3
  (ANN-01…06: lazy editor fetched on gesture, freehand/arrow/rectangle/text, stroke-bounded undo, destructive masks; 14 e2e journeys + editor unit/integration rows; real-picker UAT item 4)
- ✓ Sensitive data is masked **automatically and irreversibly** before anything leaves the browser (RF-04, SEC-01, SEC-02, R-13) — Phase 3
  (T1 auto-redaction from Phase 2 + T2/T3 editor masks; artifact-level proof in `03-UAT.md` item 2: fill region = 100 % `rgb(0,0,0)` α255 over 84 000 px, opt-in pixelation = uniform 30 px blocks with 58× less edge detail than untouched text)
- ✓ Widget and panel are available in English and Spanish (RNF-03) — Phase 3
  (WDG-06: locale resolver, whole core surface + editor chrome in EN/ES, session-scoped manual override with no host storage)
- ✓ The client respects the tiered size budget and never blocks the main thread (RNF-01, CA-03, R-01) — Phase 3
  (lazy editor lane + runtime tier closed on emitted artifacts: core 17.2/45, lazy 6.8/25 with a 2 KB floor, runtime 24.4/80 KB gz; async script tag)

### Active

- [ ] A developer can add Watchbug to any web app with one script tag and get a working floating widget (RF-01, RNF-01, RNF-02)
- [ ] An end user can file a bug report carrying an annotated screenshot, console logs and environment metadata (RF-01, RF-03)
- [ ] An end user can file plain feedback without being forced to attach console logs (RF-02)
- [ ] The report (image + JSON metadata) is transmitted over HTTP and persisted by the backend (RF-05, CA-01)
- [ ] A developer can authenticate to the panel and triage reports: list, filter by bug/feedback, change state (Pending / In Progress / Resolved), inspect collected metadata (RF-06, RF-07, SEC-06)
- [ ] The widget is immune to hostile host CSS and never contaminates the host page's styles or globals (RNF-02, INV-01, INV-02, CA-04)
- [ ] Unauthenticated requests to panel API routes return `401 Unauthorized` (CA-05)
- [ ] A deployment can hold multiple projects, each with its own public write-only key (R-06)

### Out of Scope

- **Third-party integrations** (Jira, GitHub Issues, Slack, Trello) — `mission-brief.md` §2 non-goal. R-02 reserves the seam; no adapter ships.
- **Video recording / session replay** (LogRocket, FullStory style) — non-goal. This is also what keeps RNF-01 achievable.
- **AI error analysis** — non-goal.
- **Automatic bug-fix suggestions / gamification** — non-goal.
- **Managed multi-tenant SaaS, subscriptions, payment gateways** — non-goal. The exclusion is on the *hosting model*; R-06's multiple projects per self-hosted install is not excluded.
- **OAuth2 / SSO with third parties** (Google, GitHub, enterprise) — non-goal. Ties into the non-goal above.
- **Multi-user panel accounts, roles, organisations** — R-05. Single admin by design; a whole AUTH feature family (signup, email verification, password reset, SMTP) exists only to serve it.
- **`public_key` rotation UI** — Q-04, deferred. Rotation is possible via the schema; the UI is not v1.
- **Coverage thresholds** — R-12/R-19. Coverage is not a gate; unit, integration, contract, VRT and packaging suites are in scope per the six-type taxonomy.
- **TFG *memoria* and user documentation site** — R-03. Parallel track, separate deliverable.
- **Mobile app / non-web SDKs** — web-first. The widget is a browser artifact.

## Context

- **Provenance.** This is a TFG (Trabajo de Fin de Grado). The repository previously held scaffolding from an unrelated setup; it was cleared and the project starts from zero source code. `documentation/` holds the governing packs (`mission-brief`, `mentorship-pack`, `ase-instructions`) and the ASE records (`resolution-record`, `continuity-pack`).
- **Prior decisions are recorded, not assumed.** Consult `documentation/resolution-record.md` (R-01…R-19, D-01…D-10 dead-ends; §4 records which questions remain open — only Q-05 and Q-08) and `documentation/continuity-pack.md` before re-opening anything.
- **`AGENTS.md` is not a governing document** (R-16). It is regenerated by the workflow and describes the project as built.
- **The hard technical problems are known and are the interesting part:** destructive canvas masking that is genuinely irreversible (R-13); total widget isolation under hostile CSS (INV-01/02); and a client bundle that fits a tiered 45/25/80 KB gzipped budget while shipping an annotation editor and two locales.
- **Two known traps, already rejected:** `html2canvas` (≈50 KB gzipped) and `fabric.js`/`konva` (≈85 / ≈45 KB gzipped) each exceed the budget alone. Capture and annotation must be hand-rolled or near-dependency-free (D-04, D-05).
- **Gaussian blur is not a masking primitive** (D-06) — it is linear and partially invertible by deconvolution. Only solid fill or block pixelation ≥8 px satisfy SEC-02's "irreversible".
- **Open items:** Q-05 (degree-awarding institution's IP policy before the repo is public) and Q-08 (TS 7.0.2 baseline fallback) remain open. Q-02, Q-03, Q-04 and Q-06 were closed by A-06/A-07/A-08/A-05 — see `resolution-record.md` §4 and §5.
- **Phase 1 shipped (2026-10-13).** Contracts + ingest slice is complete and verified: `packages/contracts` (Zod 4, JSON Schema emit), `apps/api` (Fastify 5 ingest with layered hostile-submission hardening), Postgres via Drizzle, and a minimal panel behind nginx — all three compose services, cold-start verified. Ingest requires a `WATCHBUG_PROJECT_KEY`; the admin surface and auth arrive in Phase 5. Deferred: dev-only `npm audit` advisories in `drizzle-kit`'s esbuild chain (see `.planning/phases/01-contracts-ingest-slice/deferred-items.md`).
- **Phase 3 shipped (2026-11-03).** The reporter experience is complete: composer (capture / attach / text-only degraded state), lazy annotation editor (freehand, arrow, rectangle, text, destructive mask with Fill default and opt-in Pixelate), review-before-send showing the exact outgoing blob, and EN/ES across core + editor. Verification regenerated at `74/74` must-haves after the 03-08 six-type suite refactor; UAT `7/7` on the real display-picker path (`.planning/phases/03-report-composer-annotation-editor-lazy/03-UAT.md`). Console logs, environment metadata and identity privacy arrive in Phase 4.

## Constraints

- **Architecture** (R-02): pragmatic hexagonal — ports at exactly 8 seams (`CaptureSource`, `Redactor`, `Enricher`, `Annotator`, `Transport`, `Storage`, `AuthProvider`, `WidgetHost`), plain modules elsewhere. Reserved ports are seams only; no out-of-scope adapter will be built to fill them.
- **Stack** (R-15): TypeScript end-to-end in an npm-workspaces monorepo (`packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel`) with PostgreSQL and Docker. Chosen so CA-01's *single* official JSON schema is structurally true rather than a convention.
- **Client size** (RNF-01, CA-03, R-01): tiered gzipped budget — injected `watchbug.js` ≤ **45 KB** (hard), each lazy chunk ≤ **25 KB**, total runtime payload ≤ **80 KB**. Enforced by `npm run check:size`, failing CI.
- **Isolation** (INV-01, INV-02, R-14): Shadow DOM `mode:'closed'` in production (build-time `SHADOW_MODE` flag emits an e2e-only bundle). Exactly one global entry point, `window.Watchbug`, or an ES-module export. No native prototype patching. No stylesheets or classes injected into host `head`/`body`.
- **Privacy** (SEC-01, SEC-02, R-13): mask `input[type=password]`, credential/token/card values, and `[data-watchbug-sensitive]`. Masking operates destructively on `ImageData` **before** encode. Solid fill or block pixelation ≥8 px only. **No CSS overlays. No gaussian blur.**
- **Host credentials** (SEC-03): the SDK never reads or transmits host cookies, `localStorage`, `sessionStorage`, Bearer tokens or auth headers. Only the public write-only `project_key` leaves the browser.
- **Secrets** (SEC-04): zero secrets in code. All server configuration via environment variables from `.env`, with a documented, committed `.env.example`.
- **API hardening** (SEC-05): sanitise all user-supplied fields against stored XSS before storage *and* before panel rendering; rate-limit `/api/incidents` per IP and per project key; scope CORS to authorised client origins and block unauthorised access to admin APIs.
- **Panel auth** (SEC-06, R-05): Argon2id (bcrypt acceptable fallback), JWT with a defined TTL in `HttpOnly` / `SameSite=Lax` / `Secure` cookies. Single admin provisioned from `.env`.
- **Deployment** (INV-03): one `docker-compose.yml`, exactly three services — `api`, static `panel`, persistent `db`. Provider-agnostic. Attachments on a filesystem volume, served **only** through the authenticated API (R-04).
- **Personal data** (R-09, R-10): `user: {id, name?, email?}` is host-supplied and sent by default with `privacy: { userIdentity: false }` as opt-out. Identity fields auto-purge after N days (default 30, configurable); reports persist anonymised. RGPD Art. 13 notice belongs in integration docs.
- **Verification** (R-19, amending R-12): a **six-type taxonomy** — unit, integration, contract, VRT, packaging, and e2e — each with its own runner and command (`AGENTS.md` → *Testing & QA*). E2E is structurally capped at ≤20 core user journeys (J-01..J-20) and runs on chromium + firefox + webkit; `npm run test:all` runs every type and `check:size` still gates the build. Security evidence stays at the artifact level; coverage % is not a gate.
- **Scope discipline** (R-17): no calendar-driven descoping. Scope is cut by coherence only. All Mentorship Pack quality gates remain hard.
- **License** (R-07): Apache-2.0. ⚠ Pending confirmation of the degree-awarding institution's IP policy (Q-05) before the repository is made public.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| R-01 Tiered client size budget (45 / 25 / 80 KB gz) | Keeps the hard 45 KB line on what is actually injected; the editor is fetched on gesture and never on the critical path | — Pending |
| R-02 Pragmatic hexagonal, 8 ports | Turns irreversible architecture into "which adapter ships by default" | — Pending |
| R-03 This repo owns code only | Keeps roadmap phases shippable-software-shaped | — Pending |
| R-04 Filesystem volume behind `Storage` | Preserves INV-03's three-service promise literally | ✓ Phase 1 |
| R-05 Single admin from `.env` | Satisfies SEC-06 in full; keeps AUTH small | — Pending |
| R-06 Multiple projects, minimal | §2's SaaS exclusion is about hosting model, not project count | — Pending |
| R-07 Apache-2.0 | Permissive + patent grant; viral licenses make an embedded SDK unusable | — Pending |
| R-08 URL path only | Query strings carry tokens; stripping is a total mitigation, a denylist is not | — Pending |
| R-09 Identity on by default, opt-out | Owner direction; bound to host-supplied `user` since SEC-03 forbids deriving it | — Pending |
| R-10 Purge identity after N days + manual delete | RGPD Art. 5(1)(e) | — Pending |
| R-11 WebP q≈0.8 + PNG fallback | ~5× storage/bandwidth saving over PNG | — Pending |
| R-12 E2E / property verification only | Owner directive, stated twice | ✓ Phase 1 |
| R-13 Masking = solid fill or block pixelation ≥8 px | Gaussian blur is partially invertible by deconvolution | — Pending |
| R-14 Shadow DOM `closed` + build-time test flag | Full CA-04 assertability at zero runtime cost | — Pending |
| R-15 TypeScript end-to-end | One source of truth for CA-01's official schema | ✓ Phase 1 |
| R-16 `AGENTS.md` non-authoritative | Stale scaffolding from a previous setup | ✓ Good |
| R-17 No calendar-driven descoping | Owner direction: done when complete and well made | ✓ Good |
| R-18 Reuse-first code creation | Search the codebase for an existing implementation before writing a new one; single source of truth for masking maths, limits and validation | ✓ Good |
| R-19 Six-type test taxonomy (amends R-12) | Unit/integration/contract/VRT/packaging added so each behaviour fails in the cheapest layer that can prove it; e2e reserved for ≤20 core journeys. Artifact-level security evidence and no coverage thresholds kept | ✓ Phase 3 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions **and** to `documentation/resolution-record.md`
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

**Cross-cutting:** dead-ends discovered during execution go to `documentation/continuity-pack.md` §4 (ASE *Anti-Amnesia*), and any decision that touches a `mission-brief.md` §3 restricted item requires a Consultation Request Pack first.

---
*Last updated: 2026-11-08 — doc-consistency sync (R-18/R-19 into Out of Scope, Context and Key Decisions); content baseline Phase 3 (2026-11-03).*
