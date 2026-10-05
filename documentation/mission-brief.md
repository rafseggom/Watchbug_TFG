# MISSION BRIEF: Watchbug SDK (MVP Core)

## 1. Executive Summary & Goals
Watchbug es un SDK de reporte de errores y feedback visual de código abierto y auto-hospedable (self-hosted). Permite a los desarrolladores e integradores inyectar un widget ligero en sus aplicaciones web para capturar incidencias junto con metadatos del entorno, y gestionarlas desde un panel de administración centralizado desplegable en sus propios sistemas.

### Primary Goal
Desarrollar la primera versión funcional (MVP) de Watchbug, que consta de:
1. Un script cliente inyectable y aislado (Widget + Motor de captura).
2. Una API/Backend ligera de recepción y almacenamiento de reportes.
3. Un Panel Web de gestión de incidencias auto-hospedable.
4. Autenticación básica del panel mediante credenciales (usuario/contraseña) o token estático configurado por variables de entorno (.env), con emisión de sesiones basadas en JWT (JSON Web Tokens) o cookies HttpOnly.

---

## 2. Non-Goals (Declarar el NO)
El agente NO debe implementar ni diseñar arquitectura para lo siguiente en este ciclo de desarrollo:
- Integraciones con plataformas de terceros (Jira, GitHub Issues, Slack, Trello).
- Grabación de vídeo o reconstrucción de sesión (estilo LogRocket/FullStory).
- Motor de análisis de errores por Inteligencia Artificial.
- Gamificación o sugerencias automáticas de resolución de bugs.
- Servicios de suscripción, pasarelas de pago o multi-tenancy SaaS gestionado por nosotros.
- Integración OAuth2 con proveedores de terceros (Google, GitHub, SSO empresarial).

---

## 3. Autonomy Envelope (Límites de Autonomía del Agente)

### Decisiones Autónomas (El agente ejecuta sin consultar):

- Implementación de algoritmos de difuminado/pixelado en el frontend.
- Selección de librerías auxiliares internas para el renderizado del lienzo o canvas, siempre que respeten el límite de peso.

### Decisiones Restringidas (Requieren pause y Consultation Request):
- Alteración de la interfaz pública del SDKcliente (métodos de inicialización global).
- Adición de dependencias que hagan superar el límite de 45 KB gzipped en el script del cliente.
- Modificación de la estrategia de aislamiento CSS/DOM del widget.
- Diseño interno de las tablas/colecciones de la base de datos y endpoints REST secundarios.
- Diseño de la arquitectura de la aplicación.
- Lenguajes de programación a usar para ser lo más generalistas para el usuario posible.
- Formación del JSON y formateo de los datos extraídos, concretando qué datos pueden ser o no sensibles.


---

## 4. Requisitos Funcionales y No Funcionales

### Requisitos Funcionales (RF)
- **RF-01 (Captura de Entorno e Incidencia):** Al accionar el botón de reporte, el sistema debe capturar el estado visual del navegador y recolectar metadatos del sistema (URL, User-Agent, resolución, registros de la consola JS).
- **RF-02 (Feedback Positivo/General):** Permitir el envío de comentarios o sugerencias sin obligar a adjuntar logs de errores de la consola.
- **RF-03 (Edición Visual y Privacidad RGPD):** El editor de capturas debe ofrecer herramientas de dibujo (lápiz, flechas, texto) y una herramienta de enmascaramiento/pixelado para ocultar datos sensibles antes del envío.
- **RF-04 (Protección Automática de Datos):** El script debe omitir automáticamente el contenido de inputs con `type="password"`, atributos de credenciales o elementos marcados con `data-watchbug-sensitive`.
- **RF-05 (Persistencia y Almacenamiento):** Empaquetar el reporte (imagen + JSON de metadatos) y enviarlo mediante HTTP al backend de Watchbug vinculado.
- **RF-06 (Panel de Gestión):** Interfaz web protegida para visualizar el listado de incidencias, filtrar por tipo (Bug / Feedback), cambiar estados (Pendiente, En Proceso, Resuelto) y examinar los metadatos recolectados.
- **RF-07 (Autenticación del Panel):** Sistema de acceso al panel mediante credenciales simples (usuario/contraseña) o Token/PIN de proyecto configurable en el entorno del servidor.
- **RF-08 (Despliegue Self-Hosted):** El backend y el panel deben poder levantarse mediante una única configuración de orquestación de contenedores (`docker-compose`).

### Requisitos No Funcionales (RNF)
- **RNF-01 (Rendimiento del Script):** El script incrustable no debe superar los 45 KB (gzipped) y debe cargarse de forma asíncrona sin bloquear el hilo principal de renderizado del cliente.
- **RNF-02 (Aislamiento Total):** El widget debe ser completamente inmune al CSS/JS de la web anfitriona y no debe contaminar los estilos ni las variables globales de dicho sitio.
- **RNF-03 (Internacionalización - i18n):** Interfaz del widget y del panel disponible en Inglés y Español.

---

## 5. Criterios de Aceptación basados en Propiedades (Invariantes)

- **CA-01 (Integridad del Payload):**
  - *Propiedad:* Todo reporte enviado por el SDK debe validar contra el esquema JSON oficial. Los `consoleLogs` son obligatorios en bugs y opcionales en feedback.
  - *Verificación:* Pruebas de integración API validando el esquema del payload JSON.

- **CA-02 (Enmascarado y Opacidad en Canvas):**
  - *Propiedad:* Al aplicar áreas de enmascaramiento en el editor, los píxeles de la región seleccionada deben reemplazarse permanentemente por bloques de color sólido o difuminado irreversible en el canvas final antes de la codificación en Base64/PNG.
  - *Verificación:* Test unitario del componente de canvas evaluando la alteración de la matriz de píxeles (`ImageData`).

- **CA-03 (Desempeño y Carga Ligera):**
  - *Propiedad:* El bundle compilado distribuible del SDK cliente no debe exceder 45 KB comprimido (gzipped). Su inyección en una página de prueba no debe reducir la puntuación de rendimiento de Lighthouse en más de 2 puntos.
  - *Verificación:* Tarea de CI/CD con `bundlesize` o script de inspección de peso en el paso de `build`.

- **CA-04 (Aislamiento de Estilos y DOM):**
  - *Propiedad:* Modificar reglas CSS globales en la página anfitriona (ej. `button { display: none !important; }`) no debe alterar la visibilidad ni el layout del widget de Watchbug.
  - *Verificación:* Test E2E inyectando el script en un HTML con estilos agresivos y comprobando la interactividad del botón flotante.

- **CA-05 (Consistencia de Autenticación en Rutas):**
  - *Propiedad:* Cualquier petición no autenticada a las rutas de la API del panel (`/api/incidents/*`) debe retornar un código de estado `401 Unauthorized`.
  - *Verificación:* Pruebas de endpoints probando peticiones sin cabeceras/tokens válidos.

---

## 6. Enmienda (2026-10-05) — Decisiones restringidas resueltas

> Registro completo, con alternativas rechazadas y evidencia: `documentation/resolution-record.md`.
> Estado de sesión y caminos sin salida: `documentation/continuity-pack.md`.

Se deja constancia de que **`AGENTS.md` no es un documento rector** (R-16): es andamiaje heredado de una configuración anterior y será regenerado por el flujo de trabajo. Los documentos rectores son este *Mission Brief*, el *Mentorship Pack* y las *ASE Instructions*.

### 6.1 Decisiones del §3 (Autonomy Envelope)

| Decisión restringida | Resolución |
|---------------------|-----------|
| Diseño de la arquitectura de la aplicación | **R-02** — hexagonal pragmático: puertos en 8 costuras (`CaptureSource`, `Redactor`, `Enricher`, `Annotator`, `Transport`, `Storage`, `AuthProvider`, `WidgetHost`), módulos planos en el resto |
| Lenguajes de programación | **R-15** — TypeScript extremo a extremo (monorepo npm workspaces: `packages/contracts`, `packages/sdk`, `apps/api`, `apps/panel`, PostgreSQL) |
| Formación del JSON y datos sensibles | **R-08 / R-09 / R-11** — esquema oficial único en `packages/contracts`; `environment.url` solo con *path* (se descartan *query* y *fragment*); identidad del usuario final `user: {id, name?, email?}` enviada por defecto con *opt-out*; captura en WebP con reserva PNG |
| Esquema de BD y endpoints REST | **R-06** — multi-proyecto mínimo (`id`, `name`, `public_key`) con FK en incidencias |
| Interfaz pública del SDK / aislamiento | **R-14** — Shadow DOM `mode:'closed'` en producción, flag de build `SHADOW_MODE` para el bundle E2E |

### 6.2 Presupuesto RNF-01 — presupuesto por niveles (R-01)

RNF-01 se interpreta por niveles, sin elevar su límite superior:

| Nivel | Límite (gzipped) | Imposición |
|-------|------------------|-----------|
| `watchbug.js` — core inyectado | **≤ 45 KB** (duro) | `npm run check:size`, falla la build |
| Cada *chunk* diferido (editor de anotación, adaptadores opcionales) | ≤ 25 KB | ídem |
| Carga total del cliente en ejecución | ≤ 80 KB | ídem |

El editor de anotación **debe** ser un *chunk* diferido. La promesa de RNF-01 es «no costar nada a la página anfitriona»: nada bloquea el hilo principal, por lo que la afirmación de Lighthouse de CA-03 (caída ≤ 2 puntos) sigue siendo defendible.

### 6.3 Alcance de la entrega (R-03)

Este repositorio contiene **únicamente el código del producto**. La *memoria* del TFG y la documentación de usuario son vías paralelas, fuera de este *roadmap*.

### 6.4 Verificación (R-12)

Únicamente **E2E y aserciones de propiedad** sobre CA-01…CA-05, más el *gate* `check:size`. No se construirá una batería de pruebas unitarias ni existirán umbrales de cobertura — ver §6.1 del *Mentorship Pack*.

CA-02 conserva íntegramente su propiedad; solo cambia su método de verificación (§6.2 del *Mentorship Pack*). Derivado de SEC-02 se añade **R-13: el desenfoque gaussiano queda prohibido** como primitiva de enmascarado por ser parcialmente invertible.

### 6.5 Sin recortes por calendario (R-17)

El horizonte de entrega es «cuando esté terminado, completo y bien hecho». El alcance se recorta por **coherencia**, nunca por presión de calendario. Todas las puertas de calidad del *Mentorship Pack* siguen siendo obligatorias.

⚠ **Pendiente antes de hacer público el repositorio (Q-05):** confirmar la política de propiedad intelectual de la universidad respecto a la licencia **Apache-2.0** (R-07).