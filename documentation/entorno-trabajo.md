# Entorno de trabajo — informe de instalación

Informe completo del entorno de desarrollo instalado en esta máquina, con instrucciones
breves de instalación para replicarlo en una máquina nueva. Inventario verificado; este
documento contiene únicamente nombres o referencias genéricas de variables de entorno —
nunca contraseñas, tokens ni valores secretos (ver sección 11).

## 1. Base del sistema

| Componente | Versión observada | Instalación |
|---|---|---|
| Sistema operativo | Windows | — |
| Node.js | v24.11.1 | Instalador oficial desde nodejs.org (LTS 24) |
| npm | 11.6.2 | Se instala junto con Node.js |
| Git | 2.40.1.windows.1 | Git for Windows (git-scm.com) |
| Docker | 29.2.1 | Docker Desktop para Windows |
| Python | 3.14.0 | Instalador oficial desde python.org |
| OpenCode CLI | v2.2.4 | `npm i -g @opencode/cli` (ver sección 2) |

Comprobaciones rápidas en una máquina nueva:

```bash
node -v        # v24.11.1
npm -v         # 11.6.2
git --version  # 2.40.1.windows.1
docker --version
python --version
opencode --version
```

## 2. Paquetes npm globales

Siete paquetes instalados globalmente con `npm i -g`:

| Paquete | Versión | Comando de instalación |
|---|---|---|
| `@opencode/cli` | 2.2.4 | `npm i -g @opencode/cli@2.2.4` |
| `context-mode` | 1.0.169 | `npm i -g context-mode@1.0.169` |
| `agent-browser` | 0.39.1 | `npm i -g agent-browser@0.39.1` |
| `@google/gemini-cli` | 0.41.2 | `npm i -g @google/gemini-cli@0.41.2` |
| `firebase-tools` | 15.34.0 | `npm i -g firebase-tools@15.34.0` |
| `create-react-app` | 5.0.1 | `npm i -g create-react-app@5.0.1` |
| `nodemon` | 3.0.1 | `npm i -g nodemon@3.0.1` |

Listado completo de lo instalado en una máquina: `npm ls -g --depth=0`.

## 3. Servidores MCP

Fuente de verdad: el archivo de configuración de OpenCode
`C:/Users/Dekker/.config/opencode/opencode.json`. Cuatro servidores declarados:

| Nombre | Habilitado | Tipo | Comando o URL | Notas |
|---|---|---|---|---|
| `context-mode` | Sí | local | `node cli.bundle.mjs` | Servidor local activo. |
| `gsd` | Sí | local | `npx -y -p @opengsd/gsd-core gsd-mcp-server --no-prompts` | Servidor local activo; proporcionado por GSD Core (sección 5). |
| `codebase-memory-mcp` | Sí | local (ejecutable) | Ejecutable local v0.12.1 | Instalado con el `install.ps1` publicado en GitHub (DeusData/codebase-memory-mcp); auto-actualización con `codebase-memory-mcp update`. |
| `github` | **No (deshabilitado)** | remoto | `https://api.githubcopilot.com/mcp/` | Cabecera `Authorization: Bearer` configurada con la variable de entorno del token de GitHub. El nombre ni el valor de esa variable se reproducen en este documento: se definen en la configuración local de OpenCode, nunca en el repositorio. |

## 4. Plugins y hooks de OpenCode

Directorio `C:/Users/Dekker/.config/opencode/plugins/`:

- `gsd-core.js` — plugin del runtime GSD.
- `cbm-augment.ts` — augment de codebase-memory.
- `gsd-statusline/tui.tsx` — statusline / TUI de GSD.
- `hooks/` — hooks gestionados por GSD; la registry de hooks se guarda en
  `managed-hooks-registry.cjs`.

En una máquina nueva se copian estos archivos al mismo directorio tras instalar GSD Core
(sección 5), ya que el plugin `gsd-core.js` pertenece a esa instalación.

## 5. Instalación de GSD Core

- **Versión:** v1.19.0, instalada en `C:/Users/Dekker/.config/opencode/gsd-core/`.
- **Instalación:** `npx @opengsd/gsd-core` y seleccionar el runtime **OpenCode** cuando lo
  pregunte.
- **Contenido:** 72 skills `gsd-*`, ~78 comandos `/gsd-*` y los agentes GSD.
- **Estado de instalación:** `gsd-install-state.json` y `gsd-file-manifest.json` dentro del
  directorio de GSD.
- **Perfil:** `full` (archivo `.gsd-profile`).

## 6. Skills no-GSD

### 6.1 `~/.config/opencode/skills/` — 6 skills

| Skill | Notas |
|---|---|
| `codebase-memory` | Reglas de uso del grafo de conocimiento de codebase-memory. |
| `security-audit` | Auditoría de seguridad. |
| `pr-lens` | Usa `npx @coldtea/pr-lens-cli@latest` bajo demanda; no requiere instalar nada aparte. |
| `eli5` | Explicaciones simples. |
| `cyclomatic-complexity` | Análisis de complejidad ciclomática. |
| `informe-analisis` | Custom Watchbug: genera `documentation/phase<N>/NN-INFORME-ANALISIS.md`. |

Instalación en una máquina nueva: copiar las seis skills a
`~/.config/opencode/skills/`.

### 6.2 `~/.agents/skills/` — ~65 skills (directorio cross-agent)

Directorio compartido entre agentes, con su fichero `.skill-lock.json`, gestionado con el
CLI `skills`: `npx skills add`, `npx skills find`, `npx skills update`.

Skills conocidas y sus orígenes:

| Skills | Origen (GitHub) | Comando de instalación |
|---|---|---|
| `find-skills` | `vercel-labs/skills` | `npx skills add vercel-labs/skills` |
| `show-me` | `humanlayer/skills` | `npx skills add humanlayer/skills` |
| `frontend-design` | `anthropics/skills` | `npx skills add anthropics/skills` |
| `apple-design` | `emilkowalski/skills` | `npx skills add emilkowalski/skills` |
| `accessibility` + familia `web-quality-*` | `addyosmani/web-quality-skills` | `npx skills add addyosmani/web-quality-skills` |
| `branch-pr`, `btw`, `chained-pr`, `code-optimizer`, `judgment-day`, `lint`, `handoff`, `sdd-*`, `skill-creator`, … | `gentleman-programming` (GitHub) | `npx skills find gentleman-programming` y añadir el repositorio localizado con `npx skills add <owner/repo>` — skills con licencia **Apache-2.0** |
| `react-best-practices`, `review`, `web-design-guidelines` | `vercel` (GitHub) | `npx skills find vercel` y añadir el repositorio localizado con `npx skills add <owner/repo>` |
| `userinterface-wiki`, `verify-before-complete` | `raphael-salaja` (GitHub) | `npx skills find raphael-salaja` y añadir el repositorio localizado con `npx skills add <owner/repo>` |
| `sumup-phase` | Custom Watchbug (local) | Copiar el skill al directorio; no procede de un repo público |
| `_shared/` | Material compartido del propio directorio | Se replica copiando el directorio completo |

> **Licencia:** las skills de `gentleman-programming` están bajo **Apache-2.0** — revisar
> esa licencia antes de redistribuirlas.

### 6.3 `~/.codex/skills/`

Skills del sistema de Codex CLI más `codebase-memory`. Se replican copiando el directorio
en una máquina nueva.

## 7. Agentes personalizados

Agentes propios (no GSD) en `C:/Users/Dekker/.config/opencode/agents/`:

- `codebase-memory.md`
- `codebase-memory-auditor.md`
- `codebase-memory-scout.md`

El AGENTS.md global (`C:/Users/Dekker/.config/opencode/AGENTS.md`) inyecta las reglas
*graph-first* de codebase-memory: consultar primero el grafo de conocimiento
(`search_graph`, `trace_path`, `get_code_snippet`) antes que grep/glob, con los niveles de
evidencia Scout / Verify / Auditor.

## 8. Navegadores de Playwright

Los tres motores están preinstalados en `%LOCALAPPDATA%\ms-playwright`:

- **chromium**
- **firefox**
- **webkit** (obligatorio: ejerce el path de fallback WebP→PNG y el render
  engine-divergente)

Instalación en una máquina nueva, desde la raíz del monorepo:

```bash
npx playwright install
```

## 9. Tooling del proyecto

Instalado en la raíz del monorepo (workspaces npm) mediante `npm install`.

**devDependencies (raíz `package.json`):**

| Paquete | Versión |
|---|---|
| `@playwright/test` | 1.63.0 |
| `vitest` | 5.0.5 |
| `typescript` | 7.0.2 |
| `tsx` | 4.23.15 |

**Scripts disponibles:**

- `npm run verify` — suite Playwright (CA-01…CA-05, tres motores).
- `npm run test:*` — taxonomía de pruebas (unit, integration, contract, vrt, packaging).
- `npm run check:size` — gate de tamaño RNF-01 (presupuestos gz).
- `npm run check:compose` — forma del `docker-compose.yml` (INV-03).

## 10. Checklist de replicación en una máquina nueva

Orden de instalación; cada paso remite a la sección que lo detalla:

1. **Base del sistema** — instalar Node.js, Git, Docker, Python y OpenCode CLI → ver
   **sección 1**.
2. **Paquetes npm globales** — instalar los 7 paquetes con `npm i -g` → ver **sección 2**.
3. **GSD Core** — `npx @opengsd/gsd-core` eligiendo el runtime OpenCode → ver
   **sección 5**.
4. **Servidores MCP** — declarar los 4 servidores en `opencode.json` → ver **sección 3**.
5. **Plugins y hooks de OpenCode** — restaurar `plugins/` (incluido `hooks/`) → ver
   **sección 4**.
6. **Agentes personalizados** — copiar los 3 agentes codebase-memory y el AGENTS.md global
   con las reglas graph-first → ver **sección 7**.
7. **Skills no-GSD** — poblar `~/.config/opencode/skills/`, `~/.agents/skills/`
   (`npx skills add owner/repo`) y `~/.codex/skills/` → ver **sección 6**.
8. **Navegadores de Playwright** — `npx playwright install` → ver **sección 8**.
9. **Tooling del proyecto** — `npm install` en la raíz del monorepo y comprobar los
   scripts → ver **sección 9**.
10. **Notas de seguridad** — revisar la política de secretos antes de trabajar → ver
    **sección 11**.

## 11. Notas de seguridad

- **SEC-04: cero secretos en el repositorio.** Toda configuración sensible vive en
  variables de entorno, nunca en el código ni en la documentación.
- **No incluir contraseñas, tokens ni claves privadas** en este ni en ningún documento del
  repositorio; referenciar únicamente **nombres o referencias genéricas de variables de
  entorno**.
- Las credenciales tipo `service.json` y los valores de token viven en `.env` o en la
  configuración local de cada herramienta — **nunca** en la documentación.
- El `.env.example` del repositorio es la referencia canónica de variables de entorno del
  proyecto.
- El servidor MCP remoto de GitHub se autentica con una cabecera `Authorization: Bearer`
  basada en la variable de entorno del token de GitHub; su nombre literal y su valor quedan
  fuera de este documento.
