# Agent Instructions

> **This file is the entry point for any agent working on this project.**
> Read it fully once. For detailed governing documents, see the referenced files in `documentation/`.

---

## Agentic Software Engineering (ASE) — How We Work

This project operates under the **ASE paradigm**. Every task must follow the **C-B-D-C** control framework.

### Core Axiom
> Producing code is not the bottleneck; trust, evidence, and intention alignment are.

**Rule Zero:** Never guess ambiguous intent or rush into writing code.

---

### The 4 Control Points (C-B-D-C)

| Phase | Action |
|-------|--------|
| **Contract** | Explicitly define goals, non-goals (*Declare the No*), constraints, and property-based acceptance criteria before editing code. |
| **Bound** | Respect scope boundaries, timeboxes, iteration limits, and file-access envelopes. |
| **Delegate with Evidence** | Execute with autonomy on the method, but always return a structured evidence pack (test logs, static analysis, benchmarks). |
| **Converge & Record** | Land verified changes, discard throwaway experiments, and update durable records. |

---

### Coordination Artifacts (Read These)

| Artifact | File | Purpose |
|----------|------|---------|
| **Mission Brief** | `documentation/mission-brief.md` | Task spec: Goal, Non-Goals, Plan, Autonomy Envelope, Acceptance Properties |
| **Mentorship Pack** | `documentation/mentorship-pack.md` | Institutional rules: architectural invariants, quality targets, security policies |
| **Workflow Runbook** | (TBD) | Executable SOP: step-by-step gates, commands, validation rules |
| **Continuity Pack** | `documentation/continuity-pack.md` | State across resets: progress, open questions, **dead-ends** (failed paths) |
| **Consultation Request Pack** | (output) | Generated when hitting autonomy limits: decision, options, trade-offs, evidence, recommendation |
| **Merge-Readiness Pack** | (output) | Generated on completion: scope-to-proof map, verification logs, change manifest, rollback plan |
| **Resolution Record** | (output) | Durable record of approved decisions and architectural trade-offs |

---

### Paradox Mitigation Rules (Guardrails)

| Paradox | Rule |
|---------|------|
| **Anti-Eagerness** | If under-specified: `Ask Before You Build`. Present draft Mission Brief; confirm before modifying files. |
| **Anti-Context Overload** | Keep active working sets minimal. Load-on-demand context cards. Invariants > formatting prefs. |
| **Anti-Tunnel Vision** | Validate global system properties, boundary interfaces, operational readiness—not just local file correctness. |
| **Anti-Amnesia** | Read **Continuity Pack** and **Resolution Records** at session start. Record rejected attempts in dead-ends log. |

---

### Standard Interaction Commands

| Command | Purpose |
|---------|---------|
| `MODE: PLAN` | Generate/update Mission Brief and Conceptual Plan. **Do not edit production code.** |
| `MODE: EXECUTE` | Implement within autonomy envelope; run deterministic checks. |
| `MODE: CONSULT` | Pause. Generate Consultation Request Pack for out-of-bounds decisions. |
| `MODE: CLOSEOUT` | Run full verification suites; generate Merge-Readiness Pack. |

---

## Project Overview (Watchbug SDK)

Open-source, self-hosted error reporting & visual feedback SDK. Injects a lightweight widget into web apps to capture issues with environment metadata. Backend API for ingestion/storage + web admin panel. Deployable via single `docker-compose.yml`.

---

## Invariants & Non-Negotiables (From Mentorship Pack)

> **Full details:** `documentation/mentorship-pack.md`

| Invariant | Requirement |
|-----------|-------------|
| **INV-01: Total Widget Isolation** | Shadow DOM (`mode: 'closed'`). Zero global CSS/JS leakage. |
| **INV-02: Clean Global Namespace** | Single `window.Watchbug` entry point. No prototype pollution. |
| **INV-03: Self-Hosted Containers** | Single `docker-compose.yml` for API, panel, DB. |
| **SEC-01: Auto-Sanitization** | Mask `input[type=password]`, `data-watchbug-sensitive`, card patterns. |
| **SEC-02: Destructive Canvas Masking** | Pixel alteration on `ImageData` before Base64 — no CSS overlays. |
| **SEC-03: No Host Credentials** | SDK never sends host app cookies/tokens. Only `PROJECT_KEY` (public). |
| **SEC-04: Zero Secrets in Code** | `.env` only. `.env.example` committed. |
| **SEC-05: XSS Sanitization + Rate Limiting** | All user fields sanitized. `/api/incidents` rate-limited per IP + key. |
| **SEC-06: Secure Auth** | bcrypt/Argon2. JWT short TTL, HttpOnly/SameSite/Secure cookies. |
| **RNF-01: Bundle ≤45 KB gzipped** | Async load, no main-thread blocking. |
| **RNF-02: Total Isolation** | Host CSS cannot break widget. |
| **RNF-03: i18n** | English + Spanish. |

---

## Consultation Triggers (Pause & Ask)

> **Full autonomy envelope:** `documentation/mission-brief.md#3`

Stop autonomous work and request human decision when:
- Changing public SDK init interface (`window.Watchbug.init()`)
- Adding deps that push SDK >45 KB gzipped
- Modifying Shadow DOM isolation strategy
- DB schema changes / migrations
- Choosing blob storage (FS vs S3/MinIO vs DB)
- Adding non-permissive licenses or uncertain GDPR edge cases

---

## Continuity Pack — Write As You Go

When you hit a dead end (rejected library, failed approach, incompatible pattern), **write it down immediately** in `documentation/continuity-pack.md` before trying the next thing.

**Timing rule:** AFTER the failure, BEFORE the next attempt. Not at the end of the task. Not batched. Each dead-end is a separate entry written in the moment.

**Executor-specific:** This applies to the gsd-executor agent during task execution. The executor has this as a hard constraint in its agent definition. If the executor encounters a failed approach (e.g., a library that doesn't work, a pattern that breaks Shadow DOM isolation, a test that consistently fails), it MUST:
1. Write the dead-end to `documentation/continuity-pack.md`
2. Then continue with the next approach

Format for each dead-end:

```markdown
### Dead-End: [what you tried]
- **What**: [library/pattern/approach]
- **Why rejected**: [specific reason — not "it didn't work", but WHY]
- **Evidence**: [test result, error message, measurement]
- **Phase**: [which phase]
- **Date**: [when]
```

This is your logbook. The next agent (or you after a session reset) reads it to avoid re-exploring failed paths. Without it, context is lost and time is wasted.

**File location:** `documentation/continuity-pack.md` (relative to project root).
