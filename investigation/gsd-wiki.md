---
sidebar_position: 2
title: "GSD — Wiki de Referencia"
description: "Conceptos, comandos y flujos del sistema GSD (GitHub-based Software Development)"
---

# GSD Core: Wiki de referencia rápida

Una selección de conceptos, comandos y flujos del sistema GSD (GitHub-based Software Development).

---

## ¿Qué es GSD?

**GSD Core** es un sistema de coordinación entre humanos e IA que lleva un proyecto desde una idea vacía hasta un pull request listo para revisar. Su distintivo principal es que **no intenta escribir toda la app de una vez**, sino que corre un **loop repetible de cinco pasos** usando **sub-agentes frescos** que descarta después de cada tarea para evitar que el contexto se degrade.

### Por qué importa

La calidad de trabajo con IA decae cuando el contexto crece sin límite ("context rot"). GSD la mantiene usando agentes descartables que heredan memoria de archivos compartidos (`.planning/`), no del historial del chat.

---

## El loop central: Discuss → Plan → Execute → Verify → Ship

Cada fase del roadmap recorre el mismo ciclo de cinco pasos:

```
💬 Discuss (2–4 min)
   ↓
📐 Plan (1–5 min)
   ↓
⚙️  Execute (2–6 min)
   ↓
✅ Verify (1–3 min)
   ↓
🚀 Ship (<1 min)
   ↓
[→ siguiente fase]
```

| Paso | Comando | Propósito | Output |
|------|---------|----------|--------|
| **Discuss** | `/gsd-discuss-phase` | Captura decisiones de implementación | `.planning/phases/NN-NAME/NN-CONTEXT.md` |
| **Plan** | `/gsd-plan-phase` | Divide la fase en tareas atómicas verificables | `.planning/phases/NN-NAME/NN-XX-PLAN.md` (una por tarea) |
| **Execute** | `/gsd-execute-phase` | Sub-agentes escriben código y hacen commit | `.planning/phases/NN-NAME/NN-XX-SUMMARY.md` + commits |
| **Verify** | `/gsd-verify-work` | Valida que los requisitos se cumplan en realidad | `.planning/phases/NN-NAME/NN-UAT.md` |
| **Ship** | `/gsd-ship` | Abre un pull request con evidencia de verificación | PR en GitHub |

### Principios clave del loop

1. **Discuss antes de Plan:** Las decisiones pequeñas tomadas al inicio evitan replans costosos después.
2. **Sub-agentes frescos por cada tarea:** No reutiliza contexto—cada executor comienza con 200k tokens limpios.
3. **Shared memory en `.planning/`:** Los archivos `MD` sobreviven `/clear` y permiten que agentes reutilicen decisiones previas.
4. **Verify antes de Ship:** "El código fue escrito" ≠ "el código funciona". La verificación lo demuestra.
5. **Una fase a la vez:** El roadmap divide el trabajo; corre el loop completo una fase por vez.

---

## Research: investigar antes de planificar

Cuando planificas una fase, GSD ofrece la opción de **investigar primero**:

```
Research before planning Phase 1: Core CLI?
  → Skip research (para capacidades bien entendidas)
  → Run research (para tecnología nueva, arquitectura incierta)
```

### Cuándo investigar

| Caso | Recomendación |
|------|---|
| "Sé exactamente cómo construir esto" | Skip research |
| "Necesito verificar si la lib X existe o cómo usarla" | Run research |
| "No sé si TypeScript puede hacer Z" | Run research |
| "Arquitectura compleja, muchas opciones" | Run research |
| Prototipo rápido o PoC | Skip research |

**Research += 1–2 min + tokens**, pero evita malplanes que luego necesitan replans costosos.

---

## Waves y ejecución paralela

Durante `/gsd-execute-phase N`, GSD agrupa tareas independientes en **waves**:

```
Wave 1 (paralelo):
  [Sub-agent A] → 01-01-PLAN.md   ✓ committed
  [Sub-agent B] → 01-02-PLAN.md   ✓ committed

Wave 2 (paralelo):
  [Sub-agent C] → 01-03-PLAN.md   ✓ committed

[Verifier] Checking phase completeness...
  REQ-01 ✓  REQ-02 ✓  REQ-03 ✓  Status: PASS
```

**Ventajas:**
- Cada sub-agente comienza con contexto fresco (200k tokens limpios)
- Tareas independientes corren en paralelo → más rápido
- Cada tarea genera su propio commit → reversible de forma independiente

---

## Cómo funciona SUMMARY.md y Plan-Checker

Después de que un sub-agente ejecuta un `NN-XX-PLAN.md`:

1. Escribe `NN-XX-SUMMARY.md` con:
   - Qué fue construido (archivos creados/modificados)
   - Hash del commit
   - Salida del `verify command` (si lo hay)

2. Un **plan-checker** lee el SUMMARY y verifica:
   - ¿Toca los archivos correctos?
   - ¿El verify command pasó?
   - ¿El commit es limpio (sin cambios sin stagear)?

3. Si algo falla, GSD detecta y propone un **fix plan** automático.

**Clave:** La verificación es **automática y cerrada** por tarea—no espera al usuario en Execute, solo en Verify.

---

## Verify: el checkpoint interactivo

`/gsd-verify-work N` transforma los SUMMARY.md en **checkpoints** que tú validas:

```
### CHECKPOINT 1: Add a to-do

Running `node todo.js add "buy milk"` creates a pending item without errors.

---

Type `pass` or describe what's wrong.
```

**Opciones:**
- Escribe `pass` → checkpoint guardado, siguiente
- Escribe una descripción del problema → GSD diagnostica, crea fix plan, re-ejecuta, vuelve a preguntar

**Resultado:** `NN-UAT.md` con todas tus respuestas (evidencia de verificación en el PR).

---

## Ship y Pull Request

`/gsd-ship N` genera un PR con estructura:

```markdown
## Summary
Phase 1: Core CLI implementation

## Changes
- Added todo.js with add/list/done commands
- Created todos.json handler
- Implemented --all flag for listing completed items

## Requirements Addressed
- CLI-01: add command ✓
- CLI-02: list command ✓
- CLI-03: done command ✓
- CLI-04: --all flag ✓

## Verification
All checkpoints passed (see 01-UAT.md)

## Key Decisions
- Done items marked in-place with "done" flag
- Completed items hidden by default
```

**Nota:** El PR no hace merge automático—es para revisión humana. Tú o un reviewer hacen merge.

---

## Concepto: Atomic commits por tarea

Cada tarea genera **un commit atómico**:

```
abc1234 Phase 01: Task 01-01 — todo.js helpers (read/write)
def5678 Phase 01: Task 01-02 — CLI commands (add, list, done)
ghi9012 Phase 01: Task 01-03 — --all flag and edge cases
```

**Beneficio:** Si una tarea más tarde se identifica como problemática, se puede hacer `git revert <hash>` de forma quirúrgica, sin afectar las otras.

---

## Concepto: Roadmap y State tracking

### ROADMAP.md
Capturado durante `/gsd-new-project`:

```
| # | Phase      | Goal                        | Requirements  |
|---|------------|-----------------------------|---------------|
| 1 | Core CLI   | add / list / done commands  | CLI-01…CLI-04 |
| 2 | Data export| export to CSV, JSON         | EXP-01…EXP-02 |
| 3 | Config file| custom data location        | CFG-01        |
```

### STATE.md
Actualizado después de cada comando, te dice:
```
Current phase: 1 (pending)
Completed phases: —
Status: Discuss → Plan → [Execute] (in progress)
Next step: /gsd-verify-work 1
```

Nunca te perderás; `STATE.md` siempre te dice dónde estás y qué sigue.

---

## Cuándo usar GSD

| Caso | Recomendación |
|------|---|
| Proyecto nuevo, roadmap claro | ✅ Ideal |
| Proyecto existente (brownfield) | ✅ Con onboarding |
| Cambios pequeños (1–2 commits) | ❌ Overhead innecesario |
| Experimentación rápida / PoC | ⚠️ Solo si planeas iterar |
| Código crítico, arquitectura compleja | ✅ Quality model profile |
| Team coordinado (multi-agente) | ✅ Loop estructura coordinación |

---

## La estructura de `.planning/` — memoria compartida

Estos archivos son GSD's **shared memory**, creados durante `/gsd-new-project`:

```
.planning/
  PROJECT.md              ← Tu descripción + requisitos iniciales
  REQUIREMENTS.md         ← Cada capacidad v1 como REQ-ID
  ROADMAP.md              ← Fases, objetivos, criterios de éxito
  STATE.md                ← Dónde estás ahora (session memory)
  config.json             ← Configuración del workflow
  phases/
    01-core-cli/
      01-CONTEXT.md       ← Decisiones de implementación (Discuss output)
      01-01-PLAN.md       ← Tarea 1: qué hace, archivos, verify command
      01-02-PLAN.md       ← Tarea 2
      01-01-SUMMARY.md    ← Qué ejecutó Executor A + commit hash
      01-02-SUMMARY.md    ← Qué ejecutó Executor B + commit hash
      01-VERIFICATION.md  ← Cobertura de requisitos: PASS/FAIL
      01-UAT.md           ← Respuestas de verificación del usuario
    02-phase-2/
      ...
```

**Clave:** Estos archivos son el puente entre agentes. No son decoración; sin ellos, cada agente tendría que reinventar las decisiones previas.

---

## Comandos principales

### Inicialización
```bash
# Instalar GSD en tu proyecto (flag --local para proyecto solo)
npx @opengsd/gsd-core@latest --claude --local

# Abrir Claude Code (agente de runtime)
# --dangerously-skip-permissions omite confirmaciones por archivo (solo en repos descartables)
claude --dangerously-skip-permissions
claude  # Sin flags: pide confirmación en cada archivo (recomendado en producción)
```

### Loop principal (Discuss → Plan → Execute → Verify → Ship)
```
/gsd-new-project           # Crea PROJECT.md, REQUIREMENTS.md, ROADMAP.md + roadmapper
/gsd-discuss-phase N       # Captura decisiones previas a la planificación
/gsd-plan-phase N          # Divide fase N en tareas atómicas
/gsd-execute-phase N       # Ejecuta todas las tareas de fase N en waves
/gsd-verify-work N         # Verifica que fase N cumple requisitos (checkpoint interactivo)
/gsd-ship N                # Abre PR con evidencia de fase N
/clear                     # Limpia contexto (previo a cada fase, evita context rot)
```

### Monitoreo y control
```
/gsd-progress --next       # Detecta la siguiente fase a ejecutar
/gsd-progress              # Muestra estado general: fases completadas, en curso, pendientes
/gsd-validate N            # Valida que los planes de fase N son ejecutables sin errores sintácticos
```

### Opciones en decisiones
Durante `/gsd-discuss-phase` y `/gsd-plan-phase`, GSD pregunta:
```
Research before planning Phase N: <capability>?
  → Skip research (para proyectos bien entendidos)
  → Run research (para tecnología nueva o decisiones complejas)
```

---

## Flujo cuando algo falla

Si `/gsd-verify-work N` detecta un fallo:

1. GSD **diagnostica** el problema leyendo logs y código
2. Crea un **fix plan** (similar a un `NN-XX-PLAN.md` normal)
3. Pides confirmar el fix plan
4. **Re-ejecuta** `/gsd-execute-phase N` (aplica el fix)
5. **Vuelves a verificar** `/gsd-verify-work N`

No hay necesidad de empezar de cero—el sistema detecta, planifica y corrige.

---

## Flags y configuración

### Durante instalación
```bash
# Instalación local (proyecto solo)
npx @opengsd/gsd-core@latest --claude --local

# Instalación global (CLI disponible en toda la máquina)
npm install -g @opengsd/gsd-core
gsd init --claude
```

### En `config.json` (creado en .planning/)
```json
{
  "model": "claude-3-5-sonnet",
  "workflow": "standard",
  "research_enabled": true,
  "parallel_execution": true,
  "auto_verify": false
}
```

---

## Opciones de modelo (Model Profiles)

GSD puede configurarse en tres tiers:

| Tier | Uso | Token budget | Calidad | Velocidad |
|------|-----|--------------|---------|-----------|
| **Quality** | Código crítico, arquitectura compleja | ∞ (full research) | ⭐⭐⭐ Alta | Lento |
| **Balanced** | Mayoría de proyectos (default) | 200k tokens | ⭐⭐ Media | Normal |
| **Budget** | Prototipado rápido, proyectos simples | 100k tokens | ⭐ Básica | Rápido |

Configurable en `/gsd-new-project` o en `config.json`.

---

## Opciones avanzadas

### Re-ejecutar una tarea específica
```
# Si una tarea falló en una onda, sin re-ejecutar todo
/gsd-execute-task NN-XX-PLAN.md
```

### Generar commit atomici por tarea
GSD automáticamente crea un commit por tarea (ve en `.planning/NN-XX-SUMMARY.md`). Cada commit es verificable y reversible de forma independiente.

### Troubleshooting de instalación
```bash
# Si los comandos /gsd-* no se reconocen
# → Reinicia Claude Code (no solo reload, cierre y reapertura completa)

# Si el directorio .claude/ no aparece
# → Verifica que la instalación completó: npx @opengsd/gsd-core@latest --claude --local
# → Revisa permisos en tu directorio de proyecto

# Si GSD spawns "researchers" y parece atascado
# → Espera 1–5 min; la investigación es normal
# → Si realmente está colgado, /clear y re-intenta
```

---

## Conceptos clave

### Phase (Fase)
Una **slice vertical** del roadmap que pasa por el loop completo. Típicamente una capacidad entregable: "Core CLI", "API Auth", "Admin Dashboard".

### Wave (Onda)
Un **lote de tareas independientes** que Execute corre en paralelo. Cada tarea en una onda recibe su propio sub-agente.

### Sub-agent (Sub-agente)
Un **agente descartable y con contexto fresco** que GSD spawns para una tarea específica (research, execution). Escribe en `.planning/` antes de cerrarse.

### Context rot (Degradación de contexto)
La **calidad de trabajo se reduce** conforme el chat crece sin límite. GSD la evita usando agentes frescos + shared memory en archivos, no en chat history.

### Requirement (REQ-ID)
Una **capacidad observable única** que el roadmap debe cubrir. Ej: `CLI-01: add command`, `AUTH-02: JWT refresh`.

### Success Criteria
**Comportamientos observables** que una fase debe entregar, verificados en el paso Verify.

---

## Flujo de inicio típico (resume del "Your first project")

1. **`/gsd-new-project`** → responde preguntas, aprueba roadmap
2. **`/clear`** + **`/gsd-discuss-phase 1`** → captura cómo construir, no solo qué
3. **`/gsd-plan-phase 1`** → atomiza en tareas con verify commands
4. **`/gsd-execute-phase 1`** → sub-agentes escriben código, hacen commit
5. **`/gsd-verify-work 1`** → validas cada checkpoint interactivamente
6. **`/gsd-ship 1`** → abre PR con resumen + verificación
7. **Repeat 2–6 para la siguiente fase**

---

## Por qué este diseño funciona

| Problema tradicional | Solución GSD |
|---|---|
| El chat se llena y pierde calidad | Sub-agentes frescos por tarea; `.planning/` lleva memoria |
| Planes que no tocan la realidad | Discuss captura decisiones; Verify prueba el trabajo antes de ship |
| Falta de coordinación en multi-agente | Loop estructurado + shared memory en `.planning/` |
| No sabes dónde estás después de `/clear` | STATE.md + ROADMAP.md te dicen el estado actual |
| Código que "se ve bien" pero no funciona | Verify es un paso separado, no una afirmación |

---

## Glossario mini

| Término | Significado |
|---|---|
| **Runtime** | Tu herramienta de IA (Claude Code, VS Code Copilot, etc.) |
| **Loop** | Discuss → Plan → Execute → Verify → Ship |
| **Phase** | Una slice vertical del roadmap |
| **`.planning/`** | Directorio de memoria compartida entre agentes |
| **REQ-ID** | Identificador de requisito único (ej: CLI-01) |
| **Wave** | Lote de tareas independientes ejecutadas en paralelo |
| **Verify command** | Script o comando que prueba si una tarea está completa |
| **UAT** | User Acceptance Testing—tu validación de que funciona |
| **Sub-agent** | Agente descartable con contexto fresco (200k tokens) que GSD spawns para una tarea |
| **Context rot** | Degradación de calidad conforme el chat crece sin límite |
| **Shared memory** | Archivos `.planning/` que sobreviven `/clear` y se reutilizan |
| **Atomic commit** | Un commit por tarea, reversible de forma independiente |
| **SUMMARY.md** | Output de un sub-agente: qué construyó, commit hash, verify result |
| **Fix plan** | Plan generado cuando Verify detecta un fallo; se re-ejecuta luego |
| **Plan-checker** | Sub-agente que valida que cada plan es ejecutable y coherente |
| **Roadmapper** | Sub-agente que convierte requisitos en fases (corre en `/gsd-new-project`) |
| **Flags** | Opciones de línea de comandos (ej: `--local`, `--dangerously-skip-permissions`) |

---

## Principios subyacentes: por qué GSD está diseñado así

### 1. Evitar context rot (degradación de contexto)
**Problema:** Un chat largo pierde calidad conforme acumula historial.  
**Solución:** Sub-agentes frescos + shared memory en `.planning/`.  
**Resultado:** Cada agente comienza con 200k tokens limpios; decisiones previas heredadas de archivos, no del chat.

### 2. Tomar decisiones temprano, replanes baratos
**Problema:** Planificar sin entender cómo construir = plans incorrectos.  
**Solución:** Discuss explícitamente captura "cómo" antes de "qué".  
**Resultado:** Plan es correcto a la primera; sin replans costosos.

### 3. Verificación es un paso separado
**Problema:** "El código se ve bien" ≠ "funciona".  
**Solución:** Verify es su propio paso, interactivo y verificable.  
**Resultado:** No abres PR hasta que evidencia real demuestra que funciona.

### 4. Atomicidad = reversibilidad
**Problema:** Un commit gigante que hace de todo es difícil de debuggear o revertir.  
**Solución:** Un commit por tarea, cada uno verificable por su verify command.  
**Resultado:** Si algo falla después, la cirugía es chirúrgica (`git revert <hash>`).

### 5. Roadmap divide el trabajo
**Problema:** "Construir la app entera" es cognitivamente costoso.  
**Solución:** Fase por fase, cada una recorre el loop completo.  
**Resultado:** Reducción de complejidad percibida; feedback temprano.

---

## Patrones comunes

### Patrón: Multi-fase product
```
/gsd-new-project
  ↓
/clear + /gsd-discuss-phase 1
/gsd-plan-phase 1
/gsd-execute-phase 1
/gsd-verify-work 1
/gsd-ship 1
  ↓
/clear + /gsd-discuss-phase 2
/gsd-plan-phase 2
/gsd-execute-phase 2
/gsd-verify-work 2
/gsd-ship 2
  [repeat para fase 3, 4, ...]
```

### Patrón: Fix plan por fallo en Verify
```
/gsd-verify-work 1
  → Fallo en checkpoint X
  ↓
GSD auto-diagnostica y propone fix plan
  ↓
[Apruebas el fix]
  ↓
/gsd-execute-phase 1  (aplica solo el fix)
  ↓
/gsd-verify-work 1    (re-verifica)
```

### Patrón: Monitoreo de progreso
```
/gsd-progress                  # Estado general
/gsd-progress --next           # Detecta siguiente fase
# (También: abre .planning/STATE.md para contexto manual)
```

---

## Diferencias vs. "chat tradicional"

| Aspecto | Chat tradicional | GSD |
|---|---|---|
| **Contexto** | Un chat, crece sin límite | Sub-agentes frescos + `.planning/` |
| **Decisiones** | Resueltas interactivamente durante code gen | Capturadas en Discuss, antes de planning |
| **Verificación** | "El código se ve bien" | Verify es un paso separado y interactivo |
| **Commits** | Uno grande al final | Uno por tarea, atomico |
| **Memory** | Historial del chat (ruidoso) | Archivos `.planning/` (limpio y reutilizable) |
| **Multi-agente** | Difícil de coordinar | Loop estructurado + shared memory |
| **Escalabilidad** | Degrada conforme crece | Lineal: fases independientes |

---

## Recursos

- **Docs oficial:** https://github.com/open-gsd/gsd-core
- **Tu primer proyecto:** `your-first-project.md` en docs (30–45 min, to-do CLI)
- **Onboarding existente:** Cómo traer GSD a un repo brownfield
- **Context engineering:** Por qué los sub-agentes frescos son críticos
- **Model profiles:** Tiers de calidad (quality/balanced/budget)
- **Security model:** Permisos y confianza en agentes

---

## Resumen en una línea

**GSD es un sistema que divide el trabajo en fases, corre cada fase por el mismo loop (Discuss → Plan → Execute → Verify → Ship), usa agentes frescos para evitar que el contexto se degrade, y guarda decisiones en archivos compartidos para que el siguiente agente no reinvente nada.**
