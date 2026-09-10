---
sidebar_position: 1
title: "GSD — Resumen"
description: "Resumen de la transición a Agentic Software Engineering y selección de herramientas"
---

28-8: Decidir si usar GSD o RooCode con Ollama, o algun otro gestor de IA. He decidido tirar con GSD, es mas profesional y se ciñe mucho más a las instrucciones, y funciona en local.

La conversación con Gemini:

# Resumen de Transición a Agentic Software Engineering (ASE)

**1. Paradigma y Selección de Herramientas**
*   **Transición:** Se discutió el salto de asistentes de autocompletado estándar hacia un flujo de trabajo ASE basado en el marco C-B-D-C (Contract, Bound, Delegate, Converge).
*   **GetShipDone (GSD) vs. Extensiones IDE:** Se analizó el uso de herramientas CLI (como GSD o Aider) frente a extensiones visuales (como Roo Code o Cline). 
*   **Recomendación:** Utilizar un enfoque combinado. La extensión del editor actúa como el "operador" (interfaz gráfica interactiva), mientras que GSD opera en la terminal integrada como el "motor determinista" que ejecuta y valida el código, asegurando el cumplimiento estricto de las reglas.

**2. Asignación y Especialización de Modelos**
*   **Estrategia:** Para no saturar los recursos de hardware local, se recomendó asignar un rol específico a cada modelo según sus fortalezas.
*   **Distribución:** 
    *   Modelos ligeros y rápidos para autocompletado en línea.
    *   Modelos con gran capacidad de razonamiento para la planificación y orquestación (lectura de artefactos y toma de decisiones).
    *   Modelos especializados en código para la ejecución y refactorización compleja.
    *   Modelos orientados al lenguaje natural para la redacción de documentación.

**3. Arquitectura de Artefactos y Gestión del Contexto**
*   **Ubicación de Documentos:** Se acordó almacenar los artefactos de coordinación (Mission Brief, Mentorship Pack, ASE Instructions, Continuity Pack) en una carpeta dedicada a la documentación dentro del proyecto.
*   **Evitar la Sobrecarga de Contexto (Anti-Context Overload):** 
    *   **Recomendación:** No incluir toda la información del proyecto y del framework en las reglas base del agente de la interfaz. 
    *   **Por qué:** Cargar todo el framework permanentemente satura la ventana de contexto en cada interacción, ralentiza la ejecución y consume memoria innecesariamente.
    *   **Solución:** Utilizar el archivo de reglas del agente exclusivamente como un "enrutador". Se le instruye para que lea los documentos específicos bajo demanda antes de planificar o ejecutar tareas.

**4. Configuración del Entorno y Trabajo en Equipo**
*   **Integración Local:** Se estableció cómo conectar GSD a los modelos locales emulando endpoints estándar, delegando cada fase (planificación, ejecución, revisión) al modelo asignado.
*   **Colaboración:** 
    *   **Recomendación:** Excluir los archivos de perfiles locales de orquestación y los historiales de los agentes del control de versiones.
    *   **Por qué:** Previene conflictos de hardware, incompatibilidad de modelos locales entre miembros del equipo y posibles filtraciones de datos sensibles del entorno de desarrollo.
    *   **Solución:** Mantener las configuraciones del entorno local aisladas mediante exclusiones y compartir únicamente plantillas de configuración.