# Convenciones del proyecto

> Convenciones acordadas del proyecto Watchbug. Se añaden aquí las reglas que **no** viven en `.planning/` pero que todo agente debe respetar al trabajar en el repo o en GitHub.
>
> Las convenciones de código y estructura de `AGENTS.md` siguen mandando sobre las de este fichero en caso de solape.

---

## Cierre de issues y sincronización con GitHub

**Decisión del propietario, 2026-10-10** (detalle y procedimiento: `documentation/continuity-pack.md` §6.5; referencia viva: `documentation/management.md` §8).

### 1. Las issues se cierran por fase, no por plan

Las issues de una fase **se cierran juntas, al completarse la fase** — nunca por plan. Una fase es una prueba e2e completa según la Definition of Done del PRD; un plan individual no lo es.

### 2. Nunca se cierra sin evidencia

Regla de oro: **implementar → verificar → cerrar**. Cierre solo con `npm run verify` y `npm run check:size` en verde, y los commits + `VERIFICATION.md` como comentario en la issue. Un estado del tablero **nunca adelanta** al código verificado.

### 3. Los REQ-IDs repartidos entre planes señalan que no toca cerrar

Cuando los REQ-IDs que cita una issue **se reparten entre varios planes** (caso típico: una issue de hardening cuyo alcance toca el plan de ingesta, el de gatekeeping y el de sanitización), eso es una **señal de que la issue no se cierra hasta que la fase esté completa y todos sus REQ-IDs estén cubiertos** — no un atajo para cerrarla antes.

En la práctica: mientras la fase siga en marcha, **avanza el estado** de la issue (`In Progress`, `Testing/Review`) según los planes ya completados, y **déjala sin cerrar**. Se cierra con el resto de la fase (regla 1).

> Origen: regla añadida el 2026-10-12 a partir del caso de la issue `#9` de la Fase 1, cuyo alcance (`ING-04`…`ING-08`) abarca tres planes. Redactada para ser consistente con la regla 1, no para sustituirla.

### 4. Las habilitadoras sin REQ-ID se cierran con el plan que las consume

Una issue habilitadora que no cita ningún REQ-ID (p. ej. el monorepo y el size gate de la Fase 1) se cierra con el plan que la consume, al completarse la fase.
