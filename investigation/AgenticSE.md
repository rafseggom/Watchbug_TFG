---
sidebar_position: 2
title: "AgenticSE — Apuntes de Estudio"
description: "Apuntes completos y guía de referencia basada en el libro de Ahmed E. Hassan"
---

# Agentic Software Engineering: Apuntes Completos de Estudio y Guía de Referencia
**Basado en la obra de Ahmed E. Hassan (2026)**
*Manual de ingeniería para la construcción de software confiable con colaboradores estocásticos a escala masiva.*

---

## INTRODUCCIÓN GENERAL Y FILOSOFÍA DEL PARADIGMA

La Ingeniería de Software atraviesa un punto de inflexión histórico. Durante décadas, el cuello de botella fundamental en la creación de software ha sido la **capacidad de redacción manual de código** (la velocidad a la que un ser humano puede teclear instrucciones ejecutables). Con el advenimiento de los Modelos de Lenguaje de Gran Escala (LLM, por sus siglas en inglés: *Large Language Models*) y de los **agentes autónomos de desarrollo** (sistemas de IA capaces de planificar, ejecutar herramientas, modificar archivos, compilar y corregir su propio trabajo de manera iterativa), dicho cuello de botella se ha desplazado drásticamente.

Hoy en día, **producir código ya no es el problema**. El recurso verdaderamente escaso y crítico es la **atención humana**, la **alineación de la intención**, la **coordinación de cambios en paralelo** y la **garantía de confiabilidad**. 

Como afirmó Fred Brooks en su célebre ensayo *No Silver Bullet* ("No hay bala de plata"), la dificultad sustancial del software no reside en la complejidad accidental (escribir la sintaxis, compilar o configurar herramientas), sino en la **complejidad esencial**: especificar los requisitos, definir los límites del sistema, comunicarse con claridad, mantener la integridad conceptual y gestionar el cambio en el tiempo. Las herramientas agente aceleran la producción exponencialmente, pero si no se rodean de un sistema de ingeniería riguroso, solo consiguen multiplicar la velocidad a la que generamos caos e inconsistencias.

De esta premisa nace la célebre máxima del libro: **"Un tonto con una herramienta sigue siendo un tonto"**. La ingeniería no consiste en esperar a que aparezca una herramienta mágica o un agente perfecto que jamás cometa errores, sino en **diseñar un sistema que garantice resultados confiables a partir de componentes propensos al fallo**.

---

## GLOSARIO PEDAGÓGICO DE TÉRMINOS CLAVE

Para facilitar el estudio y evitar bloqueos con vocabulario técnico o de alto nivel, a continuación se definen los términos fundamentales que estructuran toda la disciplina:

* **Estocástico (*Stochastic*)**: Que depende del azar o de probabilidades; es decir, un sistema no determinista donde ante una misma entrada se pueden obtener salidas ligeramente distintas. *Ejemplo: Los modelos de IA son colaboradores estocásticos porque sus respuestas varían probabilísticamente.*
* **Determinista (*Deterministic*)**: Un proceso que, dada una entrada específica, produce **siempre e indefectiblemente el mismo resultado exacto**. *Ejemplo: Un compilador o una suite de pruebas unitarias son herramientas deterministas.*
* **Falibilidad (*Fallibility*)**: La capacidad, riesgo o posibilidad intrínseca que tienen las personas, las herramientas o los sistemas de cometer errores, equivocarse o fallar.
* **Agente IA (*AI Agent / AI Teammate*)**: Un modelo de IA equipado con un bucle de razonamiento (*ReAct loop*) y acceso a herramientas (terminal, linters, git, compiladores) para ejecutar tareas complejas de forma autónoma.
* **Artefacto de Coordinación (*Coordination Artifact*)**: Documento o paquete de datos estructurado (habitualmente en Markdown o JSON) que sirve como interfaz formal entre humanos y agentes para definir intenciones, límites, evidencias y decisiones.
* **Arnés de Agente (*Agentic Harness*)**: Entorno de ejecución o marco de trabajo (como Claude Code, Cursor o Gemini CLI) que conecta el modelo de IA con las herramientas del sistema operativo o del IDE.
* **Linter**: Herramienta de análisis estático de código que comprueba automáticamente que las reglas de estilo y los errores sintácticos o de seguridad comunes se respeten.
* **RAG (*Retrieval-Augmented Generation*)**: Técnica que busca información relevante en una base de datos de conocimiento y la inyecta en la ventana de contexto del modelo de IA antes de responder.
* **Pruebas de Propiedad (*Property-Based Testing*)**: Técnica de verificación en la que no se comprueba un único valor concreto, sino que se define una regla o invariante que debe cumplirse para cualquier entrada válida posible.
* **Matriz o Grafo Acíclico Dirigido (DAG)**: Estructura lógica en la que las tareas están conectadas en una secuencia de dependencias sin bucles infinitos.
* **Cadena de Proveniencia / Trazabilidad (*Provenance / Audit Trail*)**: Registro inmutable que permite reconstruir exactamente quién hizo qué cambio, con qué herramientas, bajo qué decisiones y con qué pruebas.

---

## PARTE I: EL ESPECTRO Y LA EVOLUCIÓN DE LA INGENIERÍA DE SOFTWARE

### 1. El Espectro del Desarrollo de Software
El libro distingue tres modalidades o filosofías de trabajo con IA:

1. **Vibe Coding ("MS Paint")**:
   * *Objetivo*: Velocidad pura de creación y exploración libre.
   * *Métrica de éxito*: "Funciona para mí en este momento".
   * *Uso ideal*: Prototipos desechables, scripts personales, exploración de ideas rápidas.
   * *Limitación*: Es frágil, indocumentado e imposible de mantener en sistemas reales o equipos grandes.
2. **Vibe Engineering ("MS Paint Pro")**:
   * *Objetivo*: Mantener la agilidad del *vibe coding* añadiendo la estructura mínima necesaria para que el resultado sea duradero.
   * *Métrica de éxito*: "Funciona, puedo explicar por qué y otra persona puede hacerlo evolucionar".
   * *Prácticas*: Manejo básico de errores, higiene de seguridad, comentarios de diseño.
3. **Agentic Software Engineering ("Photoshop")**:
   * *Objetivo*: Confianza y robustez a escala masiva cuando la producción de código se multiplica por 100x.
   * *Métrica de éxito*: "Cumple la especificación bajo restricciones explícitas y con evidencia de verificación auditable".
   * *Uso ideal*: Sistemas empresariales, software crítico, grandes proyectos en equipo.

### 2. Las Tres Eras de la Ingeniería de Software (SE 1.0 $
ightarrow$ SE 2.0 $
ightarrow$ SE 3.0)

* **SE 1.0 (La Era Manual)**:
  * *Postura*: Basada en código hecho a mano.
  * *Rol Humano*: El desarrollador escribe cada línea de código, ejecuta las herramientas y realiza todas las fases del ciclo de vida.
  * *Cuello de botella*: La velocidad de tecleo y el pensamiento manual.
* **SE 2.0 (La Era de los Copilotos)**:
  * *Postura*: Asistencia por completado de código.
  * *Rol Humano*: El desarrollador sigue impulsando el bucle micro (escribe el prompt, lee la sugerencia, la acepta o la rechaza línea a línea). El peso cognitivo sigue recayendo en la persona.
* **SE 3.0 (La Era Agéntica - Agentic SE)**:
  * *Postura*: El agente de IA es un **compañero de equipo estocástico** (*stochastic teammate*).
  * *Rol Humano*: Arquitecto de intenciones, definidor de límites de riesgo, mentor y auditor de evidencias.
  * *Cambio fundamental*: La atención humana se libera del micro-bucle de tecleo y pasa a dirigir la orquestación a alto nivel.

---

## PARTE II: LOS 4 PILARES Y LOS 7 ARTEFACTOS DE COORDINACIÓN

Para que la colaboración agéntica sea segura y escalable, la interacción debe pasar de ser una conversación informal en un chat a estructurarse mediante **4 Pilares** y **7 Artefactos de Coordinación**.

### Los 4 Pilares del Sistema Agéntico
1. **Actores (*Actors*)**: Humanos y Agentes de IA colaborando en el mismo plano.
2. **Procesos (*Process*)**: Flujos de trabajo programables con puertas de verificación obligatorias.
3. **Herramientas (*Tools*)**: Entornos diferenciados para humanos (plano de mando) y para agentes (plano de ejecución).
4. **Artefactos (*Artifacts*)**: Los paquetes de información estructurada que sirven de interfaz entre los actores.

---

### Los 7 Artefactos Fundamentales de Coordinación

```
+-------------------------------------------------------------------------+
|                         ARTEFACTOS DE COORDINACIÓN                      |
+-------------------------------------------------------------------------+
|  HUMANO (Intención y Reglas)           AGENTE (Ejecución y Evidencias)  |
|                                                                         |
|  1. Mission Brief (Misión)            5. Consultation Request Pack      |
|  2. Mentorship Pack (Reglas/Guía)        (Consulta de Escalado)         |
|  3. Workflow Runbook (SOP/Pasos)      6. Merge-Readiness Pack           |
|  4. Continuity Pack (Estado/Handoff)     (Paquete para Merge)          |
|                                                                         |
|                       DURADERO / REGISTRO PROYECTO                      |
|                       7. Resolution Record (Decisión)                   |
+-------------------------------------------------------------------------+
```

#### 1. Mission Brief (Autor: Humano | Ámbito: Tarea específica)
Es la definición formal de la orden de trabajo. No es un *prompt* suelto, sino un contrato de autonomía.
* **Contenido**: Objetivo claro, no-objetivos (*Declare the No*), restricciones, plan conceptual (estrategia, no pasos rígidos), referencias a contexto, criterios de aceptación basados en propiedades y la **envolvente de autonomía** (qué puede decidir el agente y qué debe escalar).

#### 2. Continuity Pack (Autor: Humano / Agente | Ámbito: Sesión / Transición)
Preserva el estado de la misión cuando se resetea la ventana de contexto o se cambia de agente.
* **Contenido**: Resumen del estado actual, decisiones tomadas, preguntas abiertas, evidencia acumulada y la **lista de callejones sin salida** (para que un agente nuevo no vuelva a explorar caminos fallidos con renovada confianza).

#### 3. Mentorship Pack (Autor: Humano | Ámbito: Duradero / Proyecto)
Es el libro de reglas de la organización ("Mentorship-as-Code"). Define la cultura técnica y las normas tribales del equipo.
* **Contenido**: Convenciones de arquitectura, patrones preferidos, manejo de contexto, límites de seguridad y principios de diseño.
* **Regla de oro**: Debe enseñar *qué aspecto tiene la calidad*, no cómo debe pensar cognitivamente el agente.

#### 4. Workflow Runbook (Autor: Humano | Ámbito: Proceso / Reutilizable)
Es el procedimiento operativo estándar (SOP: *Standard Operating Procedure*). Define los pasos del desarrollo con sus puertas de control (*gates*).
* **Contenido**: Comandos ejecutables, análisis estático obligatorio, pruebas requeridas, disparadores de escalado y requisitos de preparación para el *merge*.

#### 5. Consultation Request Pack (Autor: Agente | Ámbito: Escalado puntual)
Es el paquete estructurado que genera el agente cuando se topa con un límite de su envolvente de autonomía (por ejemplo, cambiar un esquema de base de datos o añadir una dependencia).
* **Contenido**: Enunciado de la decisión en una frase, opciones analizadas, pros y contras, impacto/riesgo, pruebas realizadas y una **recomendación clara** con una pregunta concisa.

#### 6. Merge-Readiness Pack (Autor: Agente | Ámbito: Entrega de tarea)
Es el paquete que entrega el agente al terminar la misión para demostrar que el trabajo está listo para integrarse.
* **Contenido**: Mapa de requisitos versus pruebas, registro de cambios, archivo de exploración, plan de mitigación/rollback y un **manifiesto legible por máquina** (*Machine-Readable Manifest*) con checksums e identificadores.

#### 7. Resolution Record (Autor: Humano / Agente Supervisor | Ámbito: Duradero)
El registro oficial e inmutable de una decisión tomada tras una consulta o una revisión de *merge*.
* **Contenido**: Opción elegida, justificación, restricciones derivadas y los cambios que deben retrolimentarse hacia el *Mentorship Pack* o el *Workflow Runbook*.

---

## PARTE III: APROVECHANDO LAS FORTALEZAS DE LOS AGENTES (CLUSTERS Y PATRONES)

Los agentes poseen capacidades únicas que cambian la economía del trabajo de software. Hassan organiza estas capacidades en **4 Clusters de Fortalezas** e introduce patrones de interacción prácticos para explotarlas:

```
+-------------------------------------------------------------------------+
|                  CLUSTERS DE CAPACIDADES DEL AGENTE                     |
+-------------------------------------------------------------------------+
| Cluster A: Incansable y Sin Juicio   | Cluster B: Gran Comunicador     |
| - Infinite Iterations, Bounded Loop  | - Sloppy In, Clean Out          |
| - Beyond Done (Regla del Boy Scout)  | - Show, Don't Tell             |
|                                      | - Zoomable Synthesis            |
+--------------------------------------+----------------------------------+
| Cluster C: Amplio Conocimiento       | Cluster D: Coste de Replicación  |
| - Role Casting                       |   Casi Cero                      |
| - Devil's Advocate                   | - Parallel Decomposition         |
|                                      | - Disposable Bets, Evidence Dec. |
+-------------------------------------------------------------------------+
```

### Cluster A: Incansable y Sin Juicio (*Tireless and Non-judgmental*)
* **Fortaleza**: Los agentes no se fatigan, no se frustran, no tienen ego ni sufren el desgaste social de repetir tareas aburridas. Además, construyen espontáneamente herramientas auxiliares (*jigs* o plantillas de prueba) para verificar su propio trabajo.
* **Patrones**:
  1. *Infinite Iterations, Bounded Loop (Iteraciones Infinitas, Bucle Acotado)*: Utilizar la paciencia infinita del agente para pulir un resultado en múltiples pases, acotando el bucle con un límite explícito de iteraciones y criterios de parada claros para evitar el desgaste humano.
  2. *Beyond Done (Más allá de lo terminado / Regla del Boy Scout)*: No conformarse con que el código pase los tests. Utilizar al agente para mejorar la nomenclatura, eliminar duplicados, reforzar pruebas y actualizar la documentación justo antes de cerrar la tarea.

### Cluster B: Gran Comunicador (*Strong Communicator*)
* **Fortaleza**: Capacidad excepcional para traducir ideas humanas desordenadas en especificaciones estructuradas, cambiar entre diferentes representaciones (texto, tablas, diagramas) y sintetizar grandes volúmenes de información.
* **Patrones**:
  1. *Sloppy In, Clean Out (Entrada Desordenada, Salida Limpia)*: Pasar notas de voz con errores, borradores o capturas al agente para que las transforme en un *Mission Brief* perfecto y estructurado con supuestos explicitados antes de empezar a programar.
  2. *Show, Don't Tell (Muestra, No Parlotees)*: Exigir al agente que traduzca discusiones abstractas en diagramas de secuencia, tablas de decisión o máquinas de estado. Las discrepancias estructurales se detectan mucho mejor visualmente.
  3. *Zoomable Synthesis (Síntesis Escalable)*: Mantener la información del proyecto a tres niveles de zoom: 1 línea (estado rápido), 1 párrafo (narrativa general) y 1 página (registro completo con enlaces a evidencias).

### Cluster C: Amplio Conocimiento del Mundo (*Wide Knowledge of the World*)
* **Fortaleza**: Acceso a un volumen enciclopédico de conocimiento sobre lenguajes, frameworks, patrones, seguridad y operaciones, junto con la habilidad de cambiar de perspectiva instantáneamente.
* **Patrones**:
  1. *Role Casting (Asignación de Roles)*: Pedir al agente que simule ser un especialista concreto (por ejemplo, "Actúa como Ingeniero de Seguridad" o "Actúa como Administrador de Base de Datos") para evaluar el diseño y generar listas de comprobación específicas desde esa perspectiva.
  2. *Devil's Advocate (El Abogado del Diablo)*: Ordenar explícitamente al agente que critique el plan actual, encuentre los tres supuestos más frágiles y proponga la prueba más pequeña para validar o refutar cada uno.

### Cluster D: Coste de Replicación Cercano a Cero (*Replication Cost Near Zero*)
* **Fortaleza**: Crear ramas paralelas, probar hipótesis alternativas o generar diez variantes de una solución cuesta únicamente unos céntimos de computación.
* **Patrones**:
  1. *Parallel Decomposition (Descomposición en Paralelo)*: Dividir un gran objetivo en sub-tareas independientes asignadas a distintos agentes en entornos aislados, definiendo las costuras (*seams*) y las reglas de integración antes de ejecutar.
  2. *Disposable Bets, Evidence Decides (Apuestas Desechables, la Evidencia Decide)*: Generar 2 o 3 prototipos independientes para resolver un problema complejo y utilizar un test discriminatorio objetivo para elegir el ganador o fusionar lo mejor de cada uno.

#### Los 4 Puntos de Control para todos los Patrones
Cada patrón se mantiene seguro si se aplica la fórmula **C-B-D-C**:
1. **Contrato (*Contract*)**: Criterios de aceptación y restricciones claras.
2. **Límite (*Bound*)**: Acotación de alcance, tiempo e iteraciones.
3. **Delegación con Evidencia (*Delegate with evidence*)**: Autonomía en el método exigiendo un paquete de pruebas.
4. **Convergencia y Registro (*Converge and record*)**: Seleccionar el resultado, descartar lo sobrante y actualizar la verdad oficial.

---

## PARTE IV: PROTEGIENDO EL SISTEMA (LAS 4 PARADOJAS)

A pesar de sus fortalezas, los agentes de IA presentan patrones de fallo sistemáticos. Hassan los cataloga en **4 Paradojas**:

### 1. La Paradoja de la Avidez (*The Eagerness Paradox*)
* *Lema*: "Cuanto más rápido nos movemos, menos entendemos".
* *Analogía*: El equipo de mecánicos de Fórmula 1 que cambia las ruedas de un coche de manera impecable y a velocidad récord... pero en el coche equivocado.
* *Descripción*: El agente tiende a lanzarse a escribir código de inmediato ante peticiones ambiguas para mostrar progreso, asumiendo detalles no especificados en lugar de hacer preguntas aclaratorias.
* *Solución*: **Mission Engineering** (Alineación previa de la intención, *Ask Before You Build*, pruebas de propiedad).

### 2. La Paradoja del Contexto (*The Context Paradox*)
* *Lema*: "Cuanta más información proporcionamos, menos eficazmente se utiliza".
* *Analogía*: El conductor que pega todo el código de circulación en el parabrisas para no cometer infracciones y termina chocando porque no puede ver la carretera.
* *Descripción*: Inyectar toneladas de reglas y documentos en la ventana de contexto provoca saturación, contradicciones y pérdida de prioridad. El agente empieza a aplicar reglas irrelevantes u olvida las restricciones críticas.
* *Solución*: **Context Engineering** (Tarjetas de contexto pequeñas, presupuestos de contexto, aislamiento de exploraciones).

### 3. La Paradoja de la Visión de Túnel (*The Tunnel Vision Paradox*)
* *Lema*: "Cuanto más perfectamente ejecutamos a nivel local, más fallamos a nivel global".
* *Analogía*: El carpintero que fabrica una silla artesanal perfecta, pero diseñada para usarse en un escritorio de pie.
* *Descripción*: El agente resuelve el problema local del archivo o la función de forma impecable (los tests unitarios pasan), pero destruye la arquitectura global, rompe interfaces de otros módulos o genera deuda técnica a futuro.
* *Solución*: **Orchestration & Integration Engineering** (Definir propiedades a nivel de sistema, pruebas de integración y planificación previa de cambios).

### 4. La Paradoja del Aprendizaje (*The Learning Paradox*)
* *Lema*: "Cuanta más experiencia acumulamos, menos recordamos".
* *Analogía*: El desarrollador del "Día de la Marmota", que llega cada mañana a la oficina habiendo olvidado absolutamente todo lo aprendido el día anterior.
* *Descripción*: La IA no posee memoria biológica duradera entre sesiones. Los descubrimientos y correcciones de hoy se evaporan mañana al abrir un nuevo chat, repitiendo los mismos errores con renovada confianza.
* *Solución*: **Externalización de la Memoria** (*Mentorship Packs* versionados, *Resolution Records* y tarjetas de contexto persistentes).

---

## PARTE V: DISCIPLINAS DE INGENIERÍA DE PLATAFORMA PARA FLOTAS DE AGENTES

Cuando se pasa de un único agente a docenas o cientos de agentes ejecutándose en paralelo dentro de una organización, se requieren **disciplinas de plataforma**:

### 1. Assurance Engineering (Ingeniería de Garantía)
Engloba la **Ingeniería de Misión** (diseño riguroso de *Mission Briefs*) e **Ingeniería de Contexto** (gestión de la memoria de trabajo). Su función es convertir las afirmaciones de la IA en evidencias verificables mediante pruebas objetivas.

### 2. Coordination Engineering (Ingeniería de Coordinación)
Evita colisiones entre agentes que trabajan en el mismo repositorio. Introduce la **planificación de la integración previa a la ejecución**, los paquetes de consulta asíncronos y los **flujos de trabajo de agentes en tubería (*pipelines*)** donde un agente pasa el testigo a otro mediante contratos de transferencia formalizados.

### 3. Workbench Engineering (Ingeniería del Entorno de Trabajo)
Establece la separación tajante entre dos planos:
* **Human Workbench (Plano de Mando Humano)**: Un centro de control orientado a la toma de decisiones, gestión de buzones de entrada (*inbox* de paquetes de consulta y *merge*), visualización de riesgos y auditoría de evidencias.
* **Agent Workbench (Plano de Ejecución del Agente)**: Un entorno optimizado para máquinas, con herramientas sintácticas, análisis estático, herramientas de búsqueda semántica y bucles de retroalimentación deterministas súper rápidos.

### 4. Capability Engineering (Ingeniería de Capacidades)
Trata la calibración de los agentes de IA de forma análoga a la gestión de personal: evaluación de competencias, asignación de roles, exámenes de cualificación y matrices de escalado. Garantiza que solo los agentes certificados asuman misiones de alto riesgo.

### 5. Trust Engineering (Ingeniería de la Confianza)
Establece la gobernanza a velocidad de máquina. Define el **dial de autonomía** (desplazar el nivel de permisos de un agente según su rendimiento previo) y gestiona las **Tres Listas de Materiales (BOMs - Bills of Materials)**:
1. *Software BOM (SBOM)*: Qué componentes de software componen el producto.
2. *Prompt/Context BOM*: Qué instrucciones, reglas y contexto exactos moldearon la respuesta de la IA.
3. *Process/Provenance BOM*: Qué herramientas, comandos y decisiones condujeron al resultado final.

### 6. Language Engineering (Ingeniería del Lenguaje)
Defiende que en la era agéntica, la **lectura de código y la auditoría semántica son las actividades dominantes**. Promueve el uso de sintaxis de requisitos claras como **EARS** (*Easy Approach to Requirements Syntax*) y lenguajes que garanticen seguridad por construcción (*safety-by-construction*), haciendo que el código fuente sea el "nuevo binario" y el significado del negocio suba un nivel de abstracción.

---

## RESUMEN DE EJECUCIÓN Y CONCLUSIÓN

1. **La Ingeniería de Software no ha muerto**: Se ha vuelto más vital que nunca. Pasa de ser la disciplina de "escribir código" a ser la disciplina de **asegurar la confiabilidad de sistemas construidos por colaboradores estocásticos**.
2. **De la intuición a la evidencia**: *Vibe coding* es excelente para explorar, pero Agentic SE es indispensable para construir software seguro y duradero.
3. **Estructura mediante artefactos**: Los 7 artefactos (*Mission Brief, Continuity Pack, Mentorship Pack, Workflow Runbook, Consultation Request Pack, Merge-Readiness Pack, Resolution Record*) son las superficies de control que garantizan que el caos no se expanda.
4. **Gobierno y evolución**: Aplica el principio de *C-B-D-C* (Contrato, Límite, Delegación con evidencia, Convergencia) para exprimir las fortalezas de la IA sin caer en sus 4 paradojas.