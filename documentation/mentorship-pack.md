# MENTORSHIP PACK: Watchbug SDK

## 1. Architectural Invariants (Invariantes Arquitectónicas)

### INV-01: Aislamiento Total del Widget (Shadow DOM)
- El widget cliente debe encapsularse obligatoriamente dentro de un **Shadow DOM** (`mode: 'open'` o `'closed'`) mediante Web Components o Custom Elements.
- Ninguna regla CSS de la aplicación anfitriona debe romper el diseño ni el comportamiento del widget.
- El widget no debe inyectar hojas de estilo ni clases en el `document.head` o `document.body` global del cliente.

### INV-02: Limpieza del Espacio de Nombres Global
- El SDK cliente solo podrá exponer un único punto de entrada global en `window` (ej. `window.Watchbug`) o consumirse mediante exportación ES Module.
- Prohibida la modificación o sobreescritura de prototipos nativos (`Array.prototype`, `Object.prototype`, etc.).

### INV-03: Arquitectura Self-Hosted y Contenedores
- El backend y el panel de administración deben ser completamente agnósticos al proveedor de infraestructura.
- La configuración de despliegue principal debe ser un único archivo `docker-compose.yml` que levante el servicio API, el panel estático y la base de datos persistente.

---

## 2. Privacy & Security Policies (Invariantes de Privacidad y RGPD)

### SEC-01: Sanitización Automática de Inputs
- Durante la captura visual o recolección del DOM, el motor del SDK debe omitir o enmascarar automáticamente:
  - Elementos `<input type="password">`.
  - Atributos con valores de contraseñas, tokens o tarjetas de crédito.
  - Elementos marcados explícitamente con el atributo HTML `data-watchbug-sensitive`.

### SEC-02: Destrucción de Datos Sensibles en Canvas
- La herramienta de enmascaramiento/difuminado (*blur*) debe aplicar la modificación directamente sobre la matriz de píxeles (`ImageData`) de la imagen antes de codificarla en Base64/PNG.
- No se permite "tapar" datos mediante capas CSS superpuestas; la imagen procesada final enviada a la API debe tener el área sensible alterada de forma irreversible.

### SEC-03: No Envíos de Credenciales del Anfitrión
- El SDK cliente **nunca** debe adjuntar cookies de sesión, tokens Bearer de la aplicación anfitriona ni cabeceras de autorización de la web cliente en las peticiones enviadas al servidor de Watchbug.

---

## 3. Code & Testing Quality Targets (Estándares de Calidad y Verificación)

### Presupuesto de Rendimiento y Tamaño
- **Límite de Bundle:** El script compilado del SDK cliente inyectable debe tener un tamaño $\le 45\text{ KB}$ gzipped.
- **Carga No Bloqueante:** Debe inicializarse de forma asíncrona sin bloquear la ejecución del hilo principal de renderizado (*main thread*).

### Reutilización primero (Clean Code)
Antes de escribir código nuevo, buscar primero la implementación existente (grafo de código / grep) → reutilizar o extender cuando la semántica coincida, en lugar de escribir desde cero. DRY sobre la lógica de dominio, con `packages/contracts` como fuente única de verdad. Excepciones: la reutilización nunca se fuerza si rompería los puertos `R-02`, el presupuesto cero-deps del SDK o cualquier invariante `SEC`/`INV`; cruzar workspaces solo vía `packages/contracts`. Resolución `R-18` (no cambia la política de verificación `R-12`).

### Cobertura de Pruebas y Comandos Deterministas
Todo desarrollo producido por el agente debe ser acompañado por baterías de pruebas asociadas a los siguientes niveles:

1. **Pruebas Unitarias:**
   - Cobertura obligatoria sobre utilidades de formato de fechas, manipulador de matriz de píxeles del canvas y formateadores i18n.
   - *Comando de verificación:* `npm run test:unit`

2. **Pruebas de Integración y API:**
   - Validación estricta del esquema JSON del payload recibido en los endpoints `/api/incidents`.
   - *Comando de verificación:* `npm run test:integration`

3. **Pruebas End-to-End y Aislamiento:**
   - Inyección del script en un entorno HTML aislado con reglas CSS agresivas (`* { display: none !important; }`) para verificar que el widget flotante sigue siendo funcional e interactivo.
   - *Comando de verificación:* `npm run test:e2e`

4. **Verificación de Peso:**
   - *Comando de verificación:* `npm run check:size` (debe fallar la build si el script supera los 45 KB gzipped).

---

## 4. Security & Secret Management Invariants (Invariantes de Seguridad)

### SEC-04: Gestión Estricta de Secretos y Configuración
- **Cero secretos en código:** Ninguna clave privada, secreto JWT, contraseña de base de datos o token de API debe estar hardcodeado en el código fuente ni en repositorios.
- **Configuración mediante `.env`:** Toda la configuración sensible del backend debe leerse exclusivamente a través de variables de entorno mediante un archivo `.env` (con su correspondiente `.env.example` documentado).
- **Aislamiento de credenciales del SDK:** El SDK cliente inyectado en webs de terceros solo usará un `PROJECT_KEY` público de solo escritura para el envío de eventos, jamás claves privadas de administración.

### SEC-05: Protección de API y Prevención de Abusos
- **Sanitización contra Stored XSS:** Todos los datos recibidos en el payload (logs de consola, notas del usuario, títulos) deben sanitizarse antes de ser almacenados y renderizados en el Panel de Administración.
- **Limitación de tasa (Rate Limiting):** El endpoint de recepción de incidencias (`/api/incidents`) debe incluir protección contra sobrecarga (Rate Limiting por IP/Project Key) para evitar ataques de denegación de servicio o inundación de la base de datos.
- **Protección CORS:** La API del backend debe configurar correctamente las cabeceras CORS para permitir la ingesta desde sitios clientes autorizados, bloqueando peticiones no permitidas hacia la API de administración.

### SEC-06: Seguridad en la Autenticación del Panel
- **Almacenamiento seguro de contraseñas:** Si se utiliza autenticación por usuario/contraseña, la contraseña debe encriptarse utilizando algoritmos seguros de hashing de contraseñas (ej. bcrypt o Argon2). Nunca almacenar texto plano.
- **Protección de Sesión:** Los tokens JWT emitidos para el panel deben tener un tiempo de expiración (TTL) definido y transmitirse mediante cabeceras autorizadas o cookies seguras (`HttpOnly`, `SameSite`, `Secure`).

--- 

## 5. Operational Guardrails & Consultation Protocol

### 5.1 Protocolo de Registro de Caminos Sin Salida (Dead-Ends)
El agente debe documentar en el **Continuity Pack** (`dead-ends`) cualquier enfoque técnico descartado durante la ejecución, incluyendo:
1. **Librerías/Dependencias evaluadas y rechazadas:** (Nombre, versión, motivo de rechazo: peso, licencia, falta de mantenimiento).
2. **Algoritmos o patrones de código ineficientes:** (Pruebas de rendimiento fallidas, bloqueo del hilo principal, alta latencia).
3. **Fallos de Aislamiento o Compatibilidad:** (Técnicas CSS/JS que no funcionaron en navegadores específicos o dentro del Shadow DOM).
4. **Pruebas de infraestructura fallidas:** (Configuraciones de BD, Docker o red que generaron errores de concurrencia o persistencia).

### 5.2 Disparadores de Consulta Obligatoria (Consultation Triggers)
El agente **debe pausar la ejecución autónoma** y generar un **Consultation Request Pack** cuando detecte cualquiera de los siguientes escenarios:
- **Contratos de API:** Necesidad de modificar la interfaz pública de inicialización del SDK (`window.Watchbug`) o el esquema JSON del endpoint `/api/incidents`.
- **Esquema de Datos:** Propuesta de cambio estructural en el modelo de base de datos o estrategia de migraciones.
- **Brecha de Presupuesto (RNF):** Imposibilidad de implementar una característica funcional sin superar el límite de 45 KB gzipped.
- **Estrategia de Persistencia de Archivos:** Selección del método de almacenamiento binario para las capturas en el backend (DB vs FileSystem local vs S3/MinIO).
- **Licencias y Seguridad:** Incorporación de dependencias con licencias no permisivas o incertidumbre sobre la sanitización de datos RGPD en casos límite.

---

## 6. Enmienda (2026-10-05) — Política de verificación y cierre de disparadores

> Registro completo con evidencia y alternativas rechazadas: `documentation/resolution-record.md`.

### 6.1 Derogación de §3.1 (Pruebas Unitarias) — Resolución R-12

Por decisión explícita y reiterada del propietario: **no se construirá ninguna batería de pruebas unitarias.** Quedan derogados el nivel `npm run test:unit`, sus coberturas obligatorias (formateadores de fechas, manipulador de matriz de píxeles, formateadores i18n) y cualquier umbral de cobertura.

La §3 se sustituye por **verificación por propiedades**:

| Comando | Sustituye a | Qué verifica |
|---------|-------------|--------------|
| `npm run check:size` | §3.4 (sin cambios) | RNF-01 / CA-03 — límite de peso por niveles. Es un *gate* de build, no una suite |
| `npm run verify` | §3.2 + §3.3, re-scopados | CA-01…CA-05 — **una única** suite E2E (Playwright), ≈20 aserciones |

No se escribirán tests de formateadores, de i18n, ni tests por función.

### 6.2 Cambio del método de verificación de CA-02 — Resolución R-12

La **propiedad** de CA-02 no cambia en absoluto. Cambia su método de verificación:

- ~~Test unitario del componente de canvas sobre la matriz de píxeles (`ImageData`).~~
- **Nuevo:** el flujo E2E real abre el widget, aplica una máscara, **intercepta la petición HTTP saliente**, decodifica la imagen adjunta y comprueba que los valores de píxel originales de la región enmascarada están **ausentes en los bytes codificados**.

Esto demuestra la *irreversibilidad* exigida por SEC-02 sobre el artefacto que realmente abandona el navegador: evidencia estrictamente más fuerte con menos código.

### 6.3 Restricción de seguridad derivada de SEC-02 — Resolución R-13

**El desenfoque gaussiano queda prohibido** como primitiva de enmascarado: es una operación lineal y parcialmente invertible por deconvolución, luego no altera los datos de forma irreversible. Solo se admite:

- relleno de color sólido, o
- pixelación por promedio de bloques con **tamaño de bloque ≥ 8 px**.

La prohibición de §SEC-02 sobre capas CSS superpuestas se mantiene sin cambios.

### 6.4 Disparadores de consulta del §5.2 — cerrados como resoluciones

| Disparador | Resolución |
|-----------|-----------|
| Estrategia de persistencia de archivos | **R-04** — volumen de sistema de archivos tras el puerto `Storage`. Los binarios se sirven **solo** por la API autenticada, nunca como estáticos (evita *path traversal*) |
| Licencias y seguridad | **R-07** — Apache-2.0 (con cesión explícita de patentes) |
| Esquema de datos / endpoints | **R-06** — multi-proyecto mínimo (`id`, `name`, `public_key`) |
| Contrato de API / interfaz pública del SDK | **R-15** — `packages/contracts` como esquema oficial único para CA-01 |
| Brecha de presupuesto RNF | **R-01** — presupuesto por niveles: 45 / 25 / 80 KB gz |
| Estrategia de aislamiento CSS/DOM | **R-14** — `mode:'closed'` + flag de build `SHADOW_MODE` para el bundle E2E |
| Autenticación del panel (SEC-06) | **R-05** — administrador único desde `.env`, Argon2id + JWT en cookie `HttpOnly` / `SameSite` / `Secure` con TTL |

Los disparadores siguen **vigentes** para cualquier decisión futura que no esté cubierta por estas resoluciones.

### 6.5 Retención de datos personales — Resolución R-10

Con **R-09** el panel almacena datos personales (`user.id`, `user.name`, `user.email`) aportados por el anfitrión. En consecuencia:

- Los campos de identidad se **purgen automáticamente** a los **N días** (por defecto 30, configurable en `.env`); el informe se conserva anonimizado.
- El administrador puede en cualquier momento eliminar un informe completo o borrar sus campos de identidad de forma inmediata.
- Debe informarse al interesado conforme al art. 13 RGPD en la documentación de integración del SDK.