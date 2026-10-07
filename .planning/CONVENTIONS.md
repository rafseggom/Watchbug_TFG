## Conventions

### Reutilización primero (Clean Code)
Antes de escribir código nuevo, buscar primero la implementación existente (grafo de código / grep) → reutilizar o extender cuando la semántica coincida, en lugar de escribir desde cero. DRY sobre la lógica de dominio, con `packages/contracts` como fuente única de verdad. Excepciones: nunca forzar la reutilización si rompería los puertos `R-02`, el presupuesto cero-deps del SDK (`RNF-04`/`PRF-04`) o cualquier invariante `SEC`/`INV`; cruzar workspaces solo vía `packages/contracts`. Resolución `R-18` en `documentation/resolution-record.md`.
