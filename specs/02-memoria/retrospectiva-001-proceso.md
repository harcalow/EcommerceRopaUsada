# Retrospectiva de proceso — 001 Login de administrador

> Estado: **decidida** (2026-10-18): el dueño aprobó aplicar todas las mejoras. Recogido el 2026-10-16 a petición del dueño, durante la etapa 5.

## Coste observado (aproximado)
- ~29 h de reloj desde el arranque del entorno hasta la tarea T-25 (incluye esperas y bloqueos).
- ~60 lanzamientos de subagentes (50–190 k tokens cada uno): varios millones de tokens.
- La primera funcionalidad cargó con toda la base técnica (monorepo, Docker, CI, contrato, design system, E2E, rate limiting): 50 tareas para un login.

## Causas, por impacto
1. **Hook `pruebas_afectadas.py`**: ejecuta `pnpm test` de todo el monorepo (con cobertura y 3 reintentos) al final de cada turno. Con agentes en paralelo chocó con ellos (carpeta `coverage` bloqueada, BD de pruebas compartida, cortes de conexión): decenas de falsos rojos que hubo que investigar.
2. **Entorno lento**: Windows + Git Bash; Docker en una VM WSL de 2 CPU / 2,8 GB con el repo en `/mnt/c` (E/S lenta entre sistemas). Builds de Docker de 20–44 min; conexión a Postgres de hasta 7 s con carga. Context7 sin conexión: versiones verificadas a mano con `npm view`/`npm pack` (y `node_modules` ilegible por política).
3. **Tareas demasiado pequeñas**: cada subagente arranca en frío y relee tasks.md, diseño, skills y registro. 43 tareas = 43+ arranques (p. ej. Button, TextField, Link y Alert por separado).
4. **Retrabajo**: reestructuración de specs (000/002 → 001), `.env.example` perdido y reconstruido, semillas y módulo `users` fuera de la ruta del diseño (el segundo por un error del orquestador al fijar el ámbito), iconos rehechos con `lucide-react`, pruebas frágiles (user-event con retardo), calibración del hash, duplicación de `toUsernameKey`.
5. **Procesos de agentes en segundo plano**: un agente (T-26) dejó trabajo en segundo plano tras entregar y ese proceso repitió ediciones (4 líneas duplicadas, incluido un middleware de seguridad registrado dos veces): la API dejó de compilar y bloqueó T-40. Regla a añadir: ningún agente entrega con procesos vivos.
6. **Pruebas de tiempo sensibles a la carga**: la prueba de integración de RT-021 (p95 del login ≤ 1 s) da ~340–500 ms sola y >1 s cuando el hook coincide con una tanda E2E. En CI no compite, pero en local genera falsos rojos.
7. **Candados huérfanos de Vitest**: cada ejecución con cobertura deja un candado en `%LOCALAPPDATA%\Temp\vitest-coverage-<hash>.lock` con el PID. Si el proceso muere (timeout, agente colgado, reinicio de WSL) el candado queda; cuando Windows reutiliza ese PID, Vitest cree que la carpeta sigue en uso («coverage report directory … already in use»). Explica buena parte de los choques de cobertura de la 001. Arreglo: borrar los candados cuyo PID no sea un `node.exe` de Vitest; conviene automatizarlo en el hook o en un script.
8. **Turbo solapado con el hook**: el hook ejecuta `pnpm test` (que reconstruye `contracts` con tsup `clean`) al final de cada turno; si coincide con una verificación larga en segundo plano, el `lint` de la API ve `contracts/dist` vacío y falla de forma intermitente. Se endureció el grafo de `turbo.json` (lint/typecheck esperan al build de su paquete), pero la causa raíz es el solapamiento: la mejora 1 (hook sin solaparse) lo elimina.
9. **Interrupciones**: ~6 agentes colgados (watchdog de 600 s; causas: comandos sin `timeout`, modo watch, Docker en WSL) y el límite de uso de la sesión.
6. **Verificación duplicada**: cada agente verificaba y el orquestador repetía la verificación completa tras cada tarea.
7. **Entorno no preparado antes de la etapa 5**: faltaban `.env`, Docker operativo, navegadores de Playwright, BD de pruebas aislada y MCP conectados; se resolvió sobre la marcha.

## Mejoras propuestas
| # | Mejora | Impacto | Responsable |
|---|--------|---------|-------------|
| 1 | Hook de pruebas solo sobre lo afectado (`turbo --filter=...[HEAD]`), sin cobertura, con carpeta propia y sin dispararse con subagentes activos | Muy alto | Orquestador (cambio de gobierno: aprobación del dueño) |
| 2 | Repo clonado dentro del sistema de archivos de WSL y WSL con 4 CPU / 6–8 GB | Muy alto (×3–10 en builds y pruebas) | Dueño |
| 3 | Tareas más grandes: un agente por bloque coherente (p. ej. «componentes de UI»), con commit por tarea | Alto (−30–40 % de arranques) | Arquitecto en `/tareas` |
| 4 | Skill `preparar-entorno`: checklist antes de la etapa 5 (`.env`, Docker, MCP, Playwright, BD de pruebas aislada, `.gitattributes`) | Medio | Orquestador |
| 5 | `contexto-implementacion.md` por funcionalidad: resumen del diseño para los agentes | Medio (menos tokens) | Arquitecto |
| 6 | Verificación completa por hito (no por tarea); los agentes verifican su paquete | Medio | Orquestador |
| 7 | Registro de versiones aprobadas en Engram para no reverificar | Bajo-medio | Automático |
| 8 | Reglas anti-bloqueo (`timeout`, nunca watch, sin servidores en primer plano) dentro de la skill `protocolo-subagente` | Bajo-medio | Orquestador |

## Datos medidos (trazas `logs/agent/`, 15 al 18 de octubre de 2026)
- **Agentes:** 80 lanzamientos y 33 correcciones enviadas a agentes en curso.
- **Acciones:** unas 3.500, de las cuales unas 1.660 son comandos de terminal (verificación).
- **Reescrituras:** `diseno.md` 26 veces y `tasks.md` 15 veces.
- **Tareas:** 50, unas 35 de ellas de base técnica.

## Decisión del dueño (2026-10-18) y cambios aplicados
| Mejora | Aplicada en |
|---|---|
| Hook de pruebas solo en SubagentStop de los implementadores y del qa-tester, `--filter=...[HEAD]`, sin cobertura, con candado propio y sin solaparse con otra verificación | `.claude/hooks/pruebas_afectadas.py` |
| Limpieza automática de candados huérfanos de Vitest | Ídem |
| Ficha de tarea: rutas permitidas, interfaces, reutilización y verificación acotada | `specs/_plantillas/tasks.md`, `.claude/agents/{arquitecto,backend-dev,frontend-dev}.md` |
| Tareas por bloque (6 a 12) y agrupadas en hitos | `.claude/skills/tareas`, plantilla |
| «Contexto de implementación» de una página en `tasks.md` | Plantilla, arquitecto, devs |
| Revisión previa del diseño por el revisor (modo diseño) | `.claude/skills/disenar`, `.claude/agents/revisor.md` |
| E2E del qa-tester en paralelo con la implementación | `.claude/skills/implementar`, `.claude/agents/qa-tester.md` |
| Verificación completa y pasada del revisor solo al cerrar cada hito | `.claude/skills/implementar`, `CLAUDE.md` |
| Skill `preparar-entorno` | `.claude/skills/preparar-entorno` |
| Reglas anti-bloqueo | Ya en `protocolo-subagente` § 5 |
| Repo dentro de WSL y más recursos | Pendiente del dueño, guiado por el orquestador |

## Medición de la siguiente funcionalidad
Se medirá contra la 001: horas de reloj, tareas, lanzamientos de agentes, correcciones enviadas y reescrituras de `diseno.md`. Objetivos:
- Entre 6 y 12 tareas.
- Menos de 15 lanzamientos.
- Ninguna vuelta de la etapa 6 a la 3.
