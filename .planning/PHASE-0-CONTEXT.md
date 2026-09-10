# Phase 0 — CONTEXT.md: Docusaurus Documentation Site

## Goal
Set up a Docusaurus documentation site on a `docusaurus` branch (from `develop`) that serves project investigation/reference documentation with a clean sidebar UI similar to bibliografia.html.

## Decisions Made

### 1. Location
- Docusaurus config + content lives in `docs/` directory on the `docusaurus` branch
- Branch: `docusaurus` (created from `develop`)

### 2. File Migration Plan

**Move to `investigation/` (general/reference docs):**
| File | Source | Notes |
|------|--------|-------|
| `bibliografia.md` | `documentation/bibliografia.md` | v1.4.0 — already latest |
| `code-health-report.md` | `documentation/code-health-report.md` | Audit output |
| `Learnings.md` | `documentation/Learnings.md` | English version |
| `v1.0-retrospective.md` | `documentation/v1.0-retrospective.md` | Spanish version |
| `GSD.md` | External (`C:\Users\Dekker\Mi unidad\TFG\Info general y consultas\`) | ASE conversation summary |
| `gsd-wiki.md` | External (same path) | GSD reference wiki |
| `harness-engineering.md` | External (same path) | Harness Engineering guide |

**Stay in `documentation/` (ASE coordination artifacts):**
- `ase-instructions.md`
- `continuity-pack.md`
- `mentorship-pack.md`
- `mission-brief.md`

### 3. Language
- Spanish as primary language
- English secondary (bilingual with `i18n` if Docusaurus supports it cleanly, otherwise Spanish-only)

### 4. Deployment
- GitHub Pages via GitHub Actions
- URL: `username.github.io/watchbug-tfg/` (or custom)

## Content Structure (Sidebar)

```
Investigación
├── Recursos de Ingeniería de IA
│   ├── Bibliografía (bibliografia.md)
│   └── Guía de Harness Engineering (harness-engineering.md)
├── GSD (Get Ship Done)
│   ├── GSD — Resumen (GSD.md)
│   └── GSD — Wiki de Referencia (gsd-wiki.md)
├── Historial del Proyecto
│   ├── Aprendizajes v1.0 (Learnings.md)
│   ├── Retrospectiva v1.0 (v1.0-retrospective.md)
│   └── Code Health Report (code-health-report.md)
```

## Constraints
- investigation/ is new — doesn't exist yet
- documentation/ stays untouched (agent files remain)
- Docusaurus must not interfere with sdk/, panel/, backend/ builds
- Branch is isolated — no changes to develop
