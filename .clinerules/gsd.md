# GSD Core — Git. Ship. Done.

## 1. Operating Context (ASE)
Before writing code, proposing solutions, or starting any task, you MUST silently read your operating context in the following order:
1. Read `documentation/ase-instructions.md` to understand the C-B-D-C paradigm and your autonomy limits.
2. Read `documentation/mission-brief.md` to align your proposal with the MVP goals.
3. Read `documentation/mentorship-pack.md` to guarantee no architectural or privacy invariants are violated.

You are the primary coordinator in the GUI. When a task requires architectural planning (MODE: PLAN) or heavy refactoring/execution (MODE: EXECUTE), DO NOT do it manually file-by-file. Instead, open the integrated terminal and delegate to the background agents using the appropriate GSD command (e.g., `gsd plan-phase "description"`).

## 2. Standard Execution Rules
- GSD workflows live in `gsd-core/workflows/`. Load the relevant workflow when the user runs a `/gsd-*` command.
- GSD agents live in `agents/`. Use the matching agent when spawning subagents.
- GSD tools are at `gsd-core/bin/gsd-tools.cjs`. Run with `node`.
- Planning artifacts live in `.planning/`. Never edit them outside a GSD workflow.
- Do not apply GSD workflows unless the user explicitly asks for them.
- When a GSD command triggers a deliverable (feature, fix, docs), offer the next step to the user using Cline's ask_user tool after completing it.