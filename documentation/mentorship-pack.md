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

**Regla de ejecución:** Después de cada intento fallido, **antes** de intentar la siguiente cosa, escribir al continuity-pack. No esperar al final de la tarea. No agrupar varios dead-ends en un solo momento. Cada dead-end se registra inmediatamente tras el fracaso.

**Trigger concreto (el agente DEBE ejecutar esto):**
```
Si algo falla o se descarta:
1. Documentar en documentation/continuity-pack.md (formato más abajo)
2. Luego sí, continuar con el siguiente intento
```

**Formato por cada dead-end:**
```markdown
### Dead-End: [qué intentaste]
- **What**: [librería/patrón/enfoque probado]
- **Why rejected**: [razón específica — no "no funcionó", sino POR QUÉ]
- **Evidence**: [test result, error message, measurement]
- **Phase**: [fase número]
- **Date**: [fecha ISO]
```

**Qué documentar (incluyendo pero no limitado a):**
1. **Librerías/Dependencias evaluadas y rechazadas:** (Nombre, versión, motivo de rechazo: peso, licencia, falta de mantenimiento).
2. **Algoritmos o patrones de código ineficientes:** (Pruebas de rendimiento fallidas, bloqueo del hilo principal, alta latencia).
3. **Fallos de Aislamiento o Compatibilidad:** (Técnicas CSS/JS que no funcionaron en navegadores específicos o dentro del Shadow DOM).
4. **Pruebas de infraestructura fallidas:** (Configuraciones de BD, Docker o red que generaron errores de concurrencia o persistencia).
5. **Cualquier cambio de dirección técnica** que un agente futuro podría querer evitar repetir.

**Ubicación del archivo:** `documentation/continuity-pack.md` (relativo a la raíz del proyecto).

**Anti-patrón:** NOdocumentar dead-ends al final de la ejecución de una tarea. El contexto se pierde, los detalles se olvidan, y el siguiente agente repite el mismo error.

### 5.2 Disparadores de Consulta Obligatoria (Consultation Triggers)
El agente **debe pausar la ejecución autónoma** y generar un **Consultation Request Pack** cuando detecte cualquiera de los siguientes escenarios:
- **Contratos de API:** Necesidad de modificar la interfaz pública de inicialización del SDK (`window.Watchbug`) o el esquema JSON del endpoint `/api/incidents`.
- **Esquema de Datos:** Propuesta de cambio estructural en el modelo de base de datos o estrategia de migraciones.
- **Brecha de Presupuesto (RNF):** Imposibilidad de implementar una característica funcional sin superar el límite de 45 KB gzipped.
- **Estrategia de Persistencia de Archivos:** Selección del método de almacenamiento binario para las capturas en el backend (DB vs FileSystem local vs S3/MinIO).
- **Licencias y Seguridad:** Incorporación de dependencias con licencias no permisivas o incertidumbre sobre la sanitización de datos RGPD en casos límite.