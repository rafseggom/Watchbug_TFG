# Gantt — Watchbug SDK v1

> ## 🔒 LÍNEA BASE INMUTABLE
> Este documento es el **plan ideal de referencia**, creado el 2026-10-10 antes de empezar a ejecutar.
> **No se edita nunca**: ni fechas, ni alcance, ni barras. Su valor es poder compararse contra la realidad.
> El registro real y la variación viven en `documentation/Gantt-Actual.md` (se crea al cerrar la primera fase — ver `continuity-pack.md` §7).

Cronograma de cierre del proyecto: **10 oct → 31 dic 2026** (12 semanas).

Fuente de verdad de las fases y requisitos: `.planning/ROADMAP.md` · fechas = *due date* de los milestones de GitHub (`Phase 1` … `Phase 7`).
Generado: 2026-10-10 · sincronía GSD ↔ GitHub: `documentation/continuity-pack.md` §6.

---

## 1. Cronograma general

```mermaid
gantt
    title Watchbug SDK v1 - 10 oct 2026 a 31 dic 2026
    dateFormat YYYY-MM-DD
    axisFormat %d %b
    tickInterval 1week
    weekday monday

    section Preparacion
    Investigacion y stack            :done, p1, 2026-10-05, 2026-10-08
    Requisitos y ROADMAP 70/70       :done, p2, 2026-10-05, 2026-10-08
    PRD v1.0 aprobado                :done, p3, 2026-10-05, 2026-10-06
    Gestion GitHub (labels, 47 issues, milestones, kanban) :done, p4, 2026-10-10, 1d

    section Fases del roadmap
    Fase 1 Contracts e Ingest (10 req)      :crit, f1, 2026-10-10, 2026-10-18
    Fase 2 SDK Tracer Bullet (18 req)       :crit, f2, 2026-10-18, 2026-10-31
    Fase 3 Composer y Anotacion (13 req)    :crit, f3, 2026-10-31, 2026-11-13
    Fase 4 Payload y Enrichment (7 req)     :f4, 2026-11-13, 2026-11-22
    Fase 5 Admin Access y Projects (9 req)  :f5, 2026-11-22, 2026-11-30
    Fase 6 Triage y Data Lifecycle (10 req) :f6, 2026-11-30, 2026-12-12
    Fase 7 Resilience y Release (3 req)     :crit, f7, 2026-12-12, 2026-12-24
    Buffer de imprevistos                   :b1, 2026-12-24, 2026-12-31

    section Puertas de decision y riesgo
    Smoke-test multipart y baseline TS (RSK-13, RSK-14) :d1, 2026-10-10, 2026-10-14
    Re-pin Node 24 a 26 tras el 28 oct (RSK-16)         :d2, 2026-10-28, 2026-11-04
    Resolver Q-07 rotacion de clave en plan-phase 5      :d3, 2026-11-15, 2026-11-22
    Resolver Q-05 politica de IP (puerta de release)     :d4, 2026-12-14, 2026-12-20
    Retest ad-blockers y CSP (RSK-15, RSK-23)            :d5, 2026-12-14, 2026-12-24

    section Hitos (milestones GitHub)
    M1 Fase 1 completa   :milestone, m1, 2026-10-18, 0d
    M2 Fase 2 completa   :milestone, m2, 2026-10-31, 0d
    M3 Nucleo verificable :milestone, m3, 2026-11-13, 0d
    M4 Fase 4 completa   :milestone, m4, 2026-11-22, 0d
    M5 Fase 5 completa   :milestone, m5, 2026-11-30, 0d
    M6 Fase 6 completa   :milestone, m6, 2026-12-12, 0d
    M7 Release gate verde :milestone, m7, 2026-12-24, 0d
    Cierre del TFG       :milestone, m8, 2026-12-31, 0d
```

> La línea vertical es **hoy**. Las barras en rojo (`crit`) son las rutas sin margen: si una se retrasa, se come el buffer de Navidad.

---

## 2. Milestones, alcance e issues

| # | Milestone | Vence | Issues | Requisitos | Horas de calendario |
|---|-----------|-------|--------|------------|---------------------|
| 6 | Phase 1 — Contracts & Ingest Slice | **18 oct** | `#5`–`#10` (épica `#45`) | 10 | 8 días |
| 7 | Phase 2 — SDK Tracer Bullet | **31 oct** | `#11`–`#16` (épica `#46`) | 18 | 13 días |
| 8 | Phase 3 — Composer & Annotation *(núcleo verificable)* | **13 nov** | `#17`–`#23` (épica `#47`) | 13 | 13 días |
| 9 | Phase 4 — Payload & Enrichment | **22 nov** | `#24`–`#28` (épica `#48`) | 7 | 9 días |
| 10 | Phase 5 — Secure Admin Access & Projects | **30 nov** | `#29`–`#34` (épica `#49`) | 9 | 8 días |
| 11 | Phase 6 — Triage & Data Lifecycle | **12 dic** | `#35`–`#39` (épica `#50`) | 10 | 12 días |
| 12 | Phase 7 — Resilience & Release Closeout | **24 dic** | `#40`–`#44` (épica `#51`) | 3 + release gate | 12 días |
| — | **Buffer** | **25–31 dic** | — | — | 7 días |

---

## 3. Momentos críticos del calendario

| Fecha | Qué ocurre | Por qué importa |
|-------|------------|------------------|
| **18 oct** | M1 — Fase 1 | Primer hito, 8 días. Aquí se fijan `WidgetHost`, las constantes A-06 y el `check:size` multi-artefacto |
| **20 oct** | Node 24 entra en mantenimiento | `node:24.21.0-alpine3.24` sigue funcionando; solo es fecha límite del plan de re-pin |
| **28 oct** | Node 26 pasa a Active LTS | **Re-pin programado** (`RSK-16`) — ventana `d2` del diagrama, hacerlo en Fase 2, nunca más tarde |
| **31 oct** | M2 — Fase 2 | La más pesada: 18 requisitos, 13 días. Si se descuadra, arrastras todo noviembre |
| **13 nov** | **M3 — núcleo verificable** | Punto de no retorno: un informe real, enmascarado de forma irreversible, llega al panel. Lo anterior es preparación; lo posterior es pulido |
| **15–22 nov** | **Q-07** resuelta en `/gsd-plan-phase 5` | La rotación de clave (`#33`, *blocked*) no puede improvisarse en ejecución |
| **28 oct – 4 nov** | Re-pin Node 24 → 26 | Una sola re-pinned programada, hecha en Fase 2 |
| **14–20 dic** | **Q-05** — política de IP de la universidad | Sin esto **el repo no puede hacerse público** (R-07 Apache-2.0 + NOTICE) |
| **24 dic** | M7 — release gate verde | CA-01…CA-05 en chromium + firefox + webkit, `check:size`, compose limpio, cero secretos |
| **31 dic** | **Cierre TFG** | 7 días de buffer absorben cualquier desviación hasta aquí |

---

## 4. Reglas de lectura

1. **Ejecución estrictamente secuencial** (`ROADMAP.md`): 1 → 2 → 3 → 4 → 5 → 6 → 7. Cada fase depende de la anterior.
2. **Las barras *crit* no tienen margen propio** — su protección es el buffer del 25 al 31 de diciembre.
3. **Las puertas de decisión** (sección 2 del gráfico) no son trabajo, son espera: `#33` y `#44` están en estado `Blocked` del tablero hasta que se resuelvan.
4. **Sincronía al cierre de fase:** al verificar una fase se cierran juntas sus issues, la épica y el milestone (`continuity-pack.md` §6.5).
5. El calendario **no recorta alcance** (R-17): si algo no cabe, se mueve el calendario con el propietario, no se descuenta requisitos.

---
*Última actualización: 2026-10-10*
