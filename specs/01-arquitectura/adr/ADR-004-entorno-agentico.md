---
id: ADR-004
estado: propuesta   # propuesta | aceptada | reemplazada por ADR-XXX
fecha: 2026-10-15
---

# ADR-004 — Entorno agéntico: plugins, MCP, skills y hooks

## Contexto
Cada plugin, servidor MCP o skill que se carga consume contexto del agente. El entorno debe incluir **solo lo que el proyecto usa** y garantizar mediante controles automáticos (hooks) la seguridad, la validación en tiempo real, la trazabilidad, la memoria entre sesiones y el cumplimiento del flujo SDD.

## Opciones consideradas
1. **Entorno mínimo y declarado en el repositorio:** `.claude/settings.json` y `.mcp.json` versionados, con hooks propios en Python.
   - Pros: reproducible para todo el equipo y auditable.
   - Contras: los hooks propios hay que mantenerlos.
2. **Instalar todo lo disponible "por si acaso".**
   - Contras: contexto saturado, superficie de ataque mayor y conflictos entre herramientas.
3. **Usar solo plugins de terceros para los hooks** (p. ej. el plugin de Engram).
   - Contras: el plugin de Engram requiere `jq` y `curl` en Windows y no cubre PreCompact ni las reglas SDD.

## Decisión
Opción 1.

### Plugins (marketplace oficial `claude-plugins-official`)
| Plugin | Estado | Motivo |
|--------|--------|--------|
| `claude-code-setup` | habilitado | Recomienda automatizaciones a medida del código |
| `typescript-lsp` | habilitado | Diagnósticos de TypeScript en tiempo real (requiere el binario `typescript-language-server`) |
| `skill-creator` | habilitado | Crear las skills propias cuando no exista una oficial |
| `security-guidance` | a evaluar | Al llegar las capas de autenticación y pagos |
| `code-review` / `pr-review-toolkit` | a evaluar | Cuando el flujo de PR en GitHub esté activo; hoy lo cubre el agente `revisor` |
| `claude-md-management` | no | Se solapa con `/archivar` |

### Servidores MCP (`.mcp.json`)
| MCP | Cuándo | Estado |
|-----|--------|--------|
| **Engram** (`engram mcp`) | Siempre: memoria persistente entre sesiones | configurado; requiere instalar el binario |
| **Context7** | Siempre: documentación actualizada de librerías | configurado; requiere Node.js |
| **Playwright** | Web: pruebas e2e y verificación visual | configurado; requiere Node.js |
| **GitHub** (remoto oficial) | Leer historias, crear PRs y enlazar tareas | configurado; requiere `GITHUB_PERSONAL_ACCESS_TOKEN` |
| **PostgreSQL** | Consultar esquemas y datos de prueba | se añade en la capa "Cliente de base de datos"; solo lectura y solo local |

**Reglas:**
- Solo MCP de fuentes confiables (oficiales o del autor de la herramienta).
- Credenciales por variables de entorno, nunca en `.mcp.json`.
- Permisos mínimos: token de GitHub de grano fino, limitado a este repositorio, con contenido, issues y pull requests.
- Revisión de los MCP en cada `/archivar` de una capa horizontal: se retira lo que no se use.

### Skills
- **Primero las oficiales** del autor del framework; si no existen, se crean con `skill-creator`.
- **Una skill por tema**, con ejemplos de código ✅ correcto y ❌ incorrecto. La skill dice *cómo se hace en este proyecto*; `CLAUDE.md` solo la referencia.

| Skill | Origen | Se incorpora en |
|-------|--------|-----------------|
| `expo` (plugin `expo/skills`) | Oficial de Expo | Capa "Generación de apps" |
| Skills de `playwright-cli install --skills` | Oficial de Playwright | Capa "Generación de apps" |
| `react-best-practices` (`vercel-labs/agent-skills`) | Vercel Labs | Capa "Generación de apps" |
| `nestjs-hexagonal` | Propia (no hay oficial) | 000 |
| `nextjs-app-router` | Propia (no se encontró una oficial) | 000 |
| `expo-router-mvvm` | Propia (complementa la oficial de Expo) | 000 |
| `docker-dev` | Propia | 000 |
| `api-rest-conventions` | Propia | Capa "Manejo de errores, logging y configuración" |
| `prisma-datos` | Propia (no se encontró una oficial) | Capa "Cliente de base de datos" |
| `pasarela-pagos` | Propia (ADR-002) | Capa "Pasarela de pagos" |
| `playwright-e2e` | Propia (convenciones sobre la oficial) | Capa "Generación de apps" |

### Hooks (`.claude/settings.json` → `.claude/hooks/*.py`)
| Evento | Hook | Objetivo |
|--------|------|----------|
| SessionStart | `inicio_sesion.py` | Carga el contexto de Engram y el estado SDD |
| UserPromptSubmit | `recordatorio_fase.py` | Recuerda la etapa SDD actual para no saltar etapas |
| PreToolUse (Bash/PowerShell/Read/Grep/Glob) | `guardia_comandos.py` | Bloquea `rm -rf`, `git push --force` y la lectura de `.env` y secretos |
| PreToolUse (Write/Edit) | `guardia_escritura.py` | Sin spec no hay código; solo el humano aprueba; regla de la etapa 2 |
| PostToolUse (Write/Edit) | `validar_archivo.py` | Formato, lint y typecheck del archivo editado |
| PostToolUse (todas) | `registrar_traza.py` | Una línea JSONL en `logs/agent/` (sin contenido sensible) |
| Stop / SubagentStop | `pruebas_afectadas.py` | Corre las pruebas afectadas; si fallan, el agente no termina (máximo 3 intentos) |
| PreCompact / SessionEnd | `guardar_sesion.py` | Guarda el resumen de la sesión en Engram |

Los hooks se escriben en **Python** (disponible hoy en el entorno) y no hacen nada mientras no exista lo que validan. Por ejemplo, el lint no actúa hasta que se instalen las dependencias.

## Consecuencias
- ➕ Validación en tiempo real y cero deuda técnica garantizados por hooks, no por la memoria del agente.
- ➕ El contexto se carga bajo demanda: skills por tema y MCP mínimos.
- ➖ Python es requisito del entorno de desarrollo, además de Node.js y Docker.
- ➖ El hook de Stop alarga el cierre de cada turno con cambios de código (lo que tarden las pruebas afectadas).
- Requisitos de instalación: Engram, Node.js 24 LTS, Docker Desktop, `typescript-language-server` y el token de GitHub.
