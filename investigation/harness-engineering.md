---
sidebar_position: 2
title: "Guía de Harness Engineering"
description: "Cómo construir entornos fiables para que los agentes de IA trabajen de forma consistente"
---

Source: [GitHub - walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering)

Los modelos son potentes pero seguirán fallando en las tareas si no tienen un arnés de seguridad, un entorno potente que le evite errores, a su alrededor. 

```text
                    EL PATRÓN DEL HARNESS
                    =====================
    Tú --> das tarea --> Agente lee archivos del harness --> Agente ejecuta
                                                                  |
                                                        el harness gobierna cada paso:
                                                        |
                                                        +--> Instrucciones: qué hacer, en qué orden
                                                        +--> Alcance:       una funcionalidad a la vez, sin excederse
                                                        +--> Estado:        registro de progreso, lista de funcionalidades, historial git
                                                        +--> Verificación:  tests, lint, verificación de tipos, pruebas de humo
                                                        +--> Ciclo de vida: inicio al arrancar, estado limpio al finalizar
                                                        |
                                                        v
                                                   El agente se detiene solo cuando
                                                   la verificación pasa
```

## Lo que realmente significa Harness Engineering

No se trata de escribir mejores prompts para que el modelo "acierte" más y no falle. Se trata de construirle un arnés de seguridad dentro del cual debe operar el modelo.

Un harness tiene 5 subsistemas:

```text
    ┌─────────────────────────────────────────────────────────────────┐
    │                        EL HARNESS                               │
    │                                                                 │
    │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
    │   │ Instrucciones │  │   Estado     │  │   Verificación       │ │
    │   │              │  │              │  │                      │ │
    │   │ AGENTS.md    │  │ progress.md  │  │ tests + lint         │ │
    │   │ CLAUDE.md    │  │ feature_list │  │ verif. de tipos      │ │
    │   │ feature_list │  │ git log      │  │ pruebas de humo      │ │
    │   │ docs/        │  │ handoff ses. │  │ pipeline e2e         │ │
    │   └──────────────┘  └──────────────┘  └──────────────────────┘ │
    │                                                                 │
    │   ┌──────────────┐  ┌──────────────────────────────────────┐   │
    │   │   Alcance    │  │       Ciclo de Vida de Sesión        │   │
    │   │              │  │                                      │   │
    │   │ una func.    │  │ init.sh al inicio                    │   │
    │   │ a la vez    │  │ checklist de estado limpio al final   │   │
    │   │ definición   │  │ nota de entrega para sig. sesión     │   │
    │   │ de hecho     │  │ commit solo cuando es seguro reanudar│   │
    │   └──────────────┘  └──────────────────────────────────────┘   │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
    El MODELO decide qué código escribir.
    El HARNESS gobierna cuándo, dónde y cómo lo escribe.
    El harness no hace al modelo más inteligente.
    Hace que la salida del modelo sea fiable.
```

Cada subsistema tiene una única responsabilidad:

- **Instructions** — Le dicen al agente qué hacer, en qué orden y qué leer antes de comenzar. No un archivo gigante, eso nos consumiría todos los tokens; una estructura de divulgación progresiva que el agente navega según lo necesite.
- **State** — Rastrea qué se ha hecho, qué está en progreso y qué sigue. Se persiste en disco para que la siguiente sesión continúe exactamente donde la anterior se quedó.
- **Verification** — Solo un conjunto de tests que pasan cuenta como evidencia. El agente no puede declarar victoria sin pruebas ejecutables.
- **Scope** — Limita al agente a una funcionalidad a la vez. Sin excederse. Sin dejar tres cosas a medias. Sin reescribir la lista de funcionalidades para ocultar trabajo inacabado.
- **Session Lifecycle** — Inicializar al inicio. Limpiar al final. Dejar una ruta de reinicio limpia para la siguiente sesión.

---

## Inicio Rápido:

La idea es simple: en lugar de solo escribir prompts, dale a tu agente un conjunto de archivos estructurados que definan qué hacer, qué se ha hecho y cómo verificar el trabajo. Estos archivos viven dentro de tu repositorio, así que cada sesión comienza desde el mismo estado.

```text
    RAÍZ DE TU PROYECTO
    ├── AGENTS.md              <-- el manual de operación del agente
    ├── CLAUDE.md              <-- (alternativa, si usas Claude Code)
    ├── init.sh                <-- ejecuta install + verify + start
    ├── feature_list.json      <-- qué funcionalidades existen, cuáles están listas
    ├── claude-progress.md     <-- qué pasó en cada sesión
    └── src/                   <-- tu código real
```

Plantillas iniciales en la [Biblioteca de Recursos](https://walkinglabs.github.io/learn-harness-engineering/en/resources/). Colócalas en tu proyecto. Eso es todo. Cuatro archivos, y tus sesiones de agente ya serán significativamente más estables que ejecutándolas solo con prompts.

## El Ciclo de Vida de la Sesión del Agente

**La sesión del agente debe seguir un ciclo de vida estructurado, no un libre intercambio.** Así es como se ve:

```text
    CICLO DE VIDA DE LA SESIÓN DEL AGENTE
    =====================================
    ┌──────────────────────────────────────────────────────────────────┐
    │  INICIO                                                         │
    │                                                                  │
    │  1. Agente lee AGENTS.md / CLAUDE.md                            │
    │  2. Agente ejecuta init.sh (install, verify, health check)      │
    │  3. Agente lee claude-progress.md (qué pasó la última vez)      │
    │  4. Agente lee feature_list.json (qué está listo, qué sigue)    │
    │  5. Agente revisa git log (cambios recientes)                   │
    │                                                                  │
    │  SELECCIONAR                                                     │
    │                                                                  │
    │  6. Agente elige exactamente UNA funcionalidad pendiente        │
    │  7. Agente trabaja solo en esa funcionalidad                    │
    │                                                                  │
    │  EJECUTAR                                                        │
    │                                                                  │
    │  8. Agente implementa la funcionalidad                          │
    │  9. Agente ejecuta verificación (tests, lint, verif. de tipos)  │
    │  10. Si la verificación falla: corregir y volver a ejecutar     │
    │  11. Si la verificación pasa: registrar evidencia               │
    │                                                                  │
    │  CERRAR                                                          │
    │                                                                  │
    │  12. Agente actualiza claude-progress.md                        │
    │  13. Agente actualiza feature_list.json                         │
    │  14. Agente registra qué sigue roto o sin verificar             │
    │  15. Agente hace commit (solo cuando es seguro reanudar)        │
    │  16. Agente deja una ruta de reinicio limpia para la sig. sesión│
    │                                                                  │
    └──────────────────────────────────────────────────────────────────┘
    El harness gobierna cada transición en este ciclo de vida.
    El modelo decide qué código escribir en cada paso.
    Sin el harness, el paso 9 se convierte en "el agente dice que se ve bien."
    Con el harness, el paso 9 es "los tests pasan, el lint está limpio, los tipos verifican."
```

--- 
