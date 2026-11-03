# Phase 3: Report Composer & Annotation Editor (lazy) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-28
**Phase:** 3-Report Composer & Annotation Editor (lazy)
**Areas discussed:** Flujo del composer, Editor de anotación, Máscara e irreversibilidad, Degradación/adjuntar/revisión

---

## Flujo del composer

### Orden del flujo tras el clic del lanzador

| Option | Description | Selected |
|--------|-------------|----------|
| Captura directa → formulario | El clic captura inmediatamente (conserva la activación transitoria de P2-D-05); si va bien abre el formulario con la imagen, si falla abre en modo degradado. | ✓ |
| Formulario primero → elegir capturar o adjuntar | El clic abre el formulario con dos acciones «Capturar» / «Adjuntar»; la captura ocurre al pulsar «Capturar». | |

**User's choice:** Captura directa → formulario (Recomendado)
**Notes:** Fija el esqueleto del flujo sobre el que se montan editor, revisión y adjuntar.

### Comportamiento del campo título

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-rellenado editable | Relleno con `document.title` truncado (200 códigos de punto), editable; enviar bloqueado solo si vacío. | ✓ |
| Vacío obligatorio | El usuario escribe el título siempre antes de enviar. | |

**User's choice:** Auto-rellenado editable (Recomendado)

### Elección del tipo (bug vs feedback)

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle bug/feedback en el form | Control segmentado en el formulario, por defecto `bug`. | ✓ |
| Menú de dos opciones en el lanzador | El lanzador abre un menú de dos entradas antes de capturar. | |

**User's choice:** Toggle bug/feedback en el form (Recomendado)

### Tamaño/presentación del composer

| Option | Description | Selected |
|--------|-------------|----------|
| Overlay grande | Panel/overlay centrado o casi a pantalla completa dentro del Shadow DOM; el panel de estado queda para estados en vuelo. | ✓ |
| Panel compacto (~320px) | El composer se mantiene compacto como el panel de estado. | |

**User's choice:** Overlay grande (Recomendado)

---

## Editor de anotación

### Entrada y disposición del editor

| Option | Description | Selected |
|--------|-------------|----------|
| Botón «Anotar» → editor a pantalla completa | La previsualización del formulario abre el editor a pantalla completa con paleta + «Listo». Anotar es opcional. | ✓ |
| Editor inline en el formulario | La imagen del formulario es directamente editable con la paleta superpuesta. | |

**User's choice:** Botón «Anotar» → editor a pantalla completa (Recomendado)

### Presentación de las herramientas

| Option | Description | Selected |
|--------|-------------|----------|
| Barra vertical de iconos | Herramientas a la izquierda, una activa a la vez; deshacer aparte. | ✓ |
| Barra horizontal superior | Herramientas en una barra superior. | |

**User's choice:** Barra vertical de iconos (Recomendado)

### Color de la tinta

| Option | Description | Selected |
|--------|-------------|----------|
| Un solo color (acento) | Toda la tinta usa el color de acento del widget. | ✓ |
| Paleta de 3-4 colores | Mini paleta para elegir color. | |

**User's choice:** Un solo color (acento) (Recomendado)

### Introducción de etiquetas de texto (ANN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Clic → escribir → Enter | Texto inline sobre el canvas, confirmado con Enter o clic fuera. | ✓ |
| Campo/modal de texto | Se abre un campo/modal para escribir el texto. | |

**User's choice:** Clic → escribir → Enter (Recomendado)

---

## Máscara e irreversibilidad

### Frecuencia de confirmación de la máscara (T2)

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmar cada máscara | Modal de confirmación en cada arrastre de máscara antes de hornear. | |
| Confirmar solo la primera vez | Solo la primera máscara de la sesión muestra el aviso; las siguientes se hornean al soltar. | ✓ |

**User's choice:** Confirmar solo la primera vez
**Notes:** Desviación deliberada de la recomendación (confirmar cada máscara). Relaja el «explicit confirm modal» de C-2 a un aviso por sesión; la irreversibilidad (T2) se mantiene.

### Exposición de la pixelación opt-in (R-13)

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle en la herramienta de máscara | Toggle interno «Relleno / Pixelar» dentro de la herramienta; relleno por defecto. | ✓ |
| Herramienta «Pixelar» aparte | Una sexta herramienta en la paleta. | |

**User's choice:** Toggle en la herramienta de máscara (Recomendado)

### Funcionamiento del deshacer (ANN-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Botón + Ctrl/Cmd+Z, por trazo | Deshace un trazo de anotación a la vez, nunca una máscara; pila acotada. | ✓ |
| Solo botón, sin atajo | Sin atajo de teclado. | |

**User's choice:** Botón + Ctrl/Cmd+Z, por trazo (Recomendado)

### Reinicio rápido de anotaciones

| Option | Description | Selected |
|--------|-------------|----------|
| Solo deshacer por trazo | Sin «borrar todo»; deshacer trazo a trazo. | ✓ |
| Añadir «borrar todas las anotaciones» | Botón que quita todos los trazos pero conserva las máscaras. | |

**User's choice:** Solo deshacer por trazo (Recomendado)

---

## Degradación, adjuntar y revisión

### Estado de captura no disponible (CAP-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Composer degradado con ambas salidas | El composer abre con aviso + «Adjuntar imagen» / «Continuar solo con texto». | ✓ |
| Panel de elección previo | Panel compacto de error con dos botones antes del composer. | |

**User's choice:** Composer degradado con ambas salidas (Recomendado)

### Formatos de adjuntar (CAP-02)

| Option | Description | Selected |
|--------|-------------|----------|
| PNG + WebP + JPEG | Resuelve P1-D-11; implica ampliar el allowlist del servidor. | ✓ |
| Solo PNG + WebP | Coherente con la captura; JPEG aplazado. | |

**User's choice:** PNG + WebP + JPEG (Recomendado)

### Flujo del adjunto

| Option | Description | Selected |
|--------|-------------|----------|
| Mismo flujo de anotación/revisión | El adjunto se muestra, anota, enmascara (T2/T3), revisa y envía. T1 no aplica (sin DOM). | ✓ |
| Enviar adjunto sin anotar | El adjunto se envía tal cual con el formulario. | |

**User's choice:** Mismo flujo de anotación/revisión (Recomendado)

### Pantalla de revisión (PRV-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Pantalla de revisión distinta | Imagen final aplanada + resumen + «Editar»/«Enviar». | ✓ |
| El formulario es la revisión | Sin paso separado; «Enviar» envía directamente. | |

**User's choice:** Pantalla de revisión distinta (Recomendado)

---

## the agent's Discretion

El propietario cerró la discusión («Nada, continua») sin profundizar en: i18n del widget (WDG-06, sigue P1-D-05), carga lazy del editor (PRF-02), y el formulario solo-texto exacto (CAP-03). Detalles técnicos: descomposición de módulos del editor, grosor de trazo, profundidad de la pila de undo, estructura de aserciones e2e CA-02.

## Deferred Ideas

- Host-configurable redaction rules (v1: seam sin usar).
- DOM-serialize `CaptureSource` (v2, A-08).
- Mask-undo / confirmación por máscara (decisión de privacidad §3 → Consultation Request Pack).
