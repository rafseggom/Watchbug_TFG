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

