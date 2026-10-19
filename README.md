# Ecommerce de Ropa Usada

Plataforma de compra y venta de ropa de segunda mano con **web**, **API** y **apps móviles (iOS y Android)**, construida **100% con agentes de IA** siguiendo **Spec-Driven Development (SDD)**.

> **Estado:** la arquitectura agéntica, la estructura del monorepo y Docker están listos. Todavía no hay código de aplicación.
> - Las decisiones técnicas están en ADR-001 a ADR-010.
> - Única funcionalidad: `001-login-administrador`, que incluye la base técnica (ADR-010).

---

## Cómo se construye este proyecto

Ninguna línea de código se escribe sin una especificación aprobada. Un **agente orquestador** coordina a **8 subagentes especializados** a lo largo de **7 etapas**. El humano aprueba en los puntos clave.

| # | Etapa | Comando | Subagente | Entregable | Aprobación humana |
|---|-------|---------|-----------|------------|-------------------|
| 1 | Explorar | `/explorar <idea>` | `explorador` | `contexto.md` | — |
| 2 | Especificar | `/especificar <NNN>` | `analista-specs` | `spec.md` (requisitos, Gherkin, casos borde) | ✅ |
| 3 | Diseñar | `/disenar <NNN>` | `arquitecto` | `diseno.md` + ADR | ✅ |
| 4 | Planificar tareas | `/tareas <NNN>` | `arquitecto` | `tasks.md` | — |
| 5 | Implementar | `/implementar <NNN> [T-xx]` | `backend-dev` / `frontend-dev` | Código + pruebas | — |
| 6 | Verificar | `/verificar <NNN>` | `qa-tester` + `revisor` | Pruebas, lint, typecheck, revisión de seguridad | ⚠️ en auth, pagos y datos personales |
| 7 | Archivar | `/archivar <NNN>` | `documentador` | Memoria y estado `cumplida` | — |

**Reglas clave:**
- **La spec manda.** Si la implementación revela que la spec es incorrecta, se vuelve a la etapa 2; no se parchea el código.
- **Entrega:** una carpeta de funcionalidad por requerimiento del dueño, de punta a punta; la base técnica que necesite va en su propio diseño (ADR-010).
- **Cero deuda técnica:** una funcionalidad no se da por terminada sin cumplir la Definition of Done. Los hooks lo hacen cumplir.

## Stack propuesto

| Capa | Tecnología |
|------|------------|
| Monorepo | pnpm workspaces + Turborepo (TypeScript en todo el proyecto) |
| Web | Next.js (App Router) con SEO y accesibilidad WCAG 2.2 AA |
| Móvil | React Native + Expo (iOS y Android) |
| API | NestJS: monolito modular con arquitectura hexagonal, OpenAPI `/v1` contract-first |
| Datos | PostgreSQL + Prisma (migraciones versionadas) |
| Pagos | Puerto `PaymentGateway` desacoplado; primer proveedor **Mercado Pago**, sustituible |
| Infraestructura | Docker Compose (desarrollo) + Dockerfiles multi-stage (producción) |
| Pruebas | Vitest/Jest, pruebas de contrato, Playwright (web), Maestro (móvil) |

## Equipo de agentes

| Agente | Rol | Modelo | ¿Escribe código? |
|--------|-----|--------|------------------|
| Orquestador | Delega, integra y verifica | Opus | No (lo impide un hook) |
| `explorador` | Lee y resume el contexto existente | Haiku | No |
| `analista-specs` | Specs funcionales | Opus | No |
| `arquitecto` | Diseño, tareas y ADR | Opus | No |
| `backend-dev` | API, datos, integraciones, infraestructura | Sonnet | Sí |
| `frontend-dev` | Web y móvil | Sonnet | Sí |
| `qa-tester` | Pruebas desde los escenarios Gherkin | Sonnet | Solo pruebas |
| `revisor` | Revisión de código y seguridad (OWASP) | Opus | No (solo lectura) |
| `documentador` | Memoria, registro de componentes y cierre | Haiku | No |

## Controles automáticos (hooks)

| Evento | Qué hace |
|--------|----------|
| `SessionStart` | Carga la memoria de Engram y el estado SDD del proyecto |
| `UserPromptSubmit` | Recuerda la etapa SDD actual y trae memorias relacionadas |
| `PreToolUse` | Bloquea `rm -rf`, `git push --force` y la lectura de secretos; impide escribir código sin spec, autoaprobar documentos y escribir fuera del ámbito de cada agente |
| `PostToolUse` | Formatea, lintea y hace typecheck del archivo editado; detecta deuda técnica; registra cada acción en `logs/agent/` |
| `Stop` / `SubagentStop` | Corre las pruebas afectadas; si fallan, el agente no da la tarea por terminada |
| `PreCompact` / `SessionEnd` | Guarda el resumen de la sesión en Engram |

## Estructura del repositorio

```
CLAUDE.md                 Constitución del proyecto (reglas para todos los agentes)
.mcp.json                 Servidores MCP: Engram, Context7, Playwright, GitHub
.claude/
  agents/                 8 subagentes (objetivo, entradas, salida, herramientas, modelo)
  skills/                 Flujo SDD y conocimiento bajo demanda (dominio, specs, ADR,
                          seguridad, requisitos por plataforma, memoria…)
  hooks/                  Controles automáticos (Python)
  settings.json           Permisos, plugins y registro de hooks
specs/
  00-vision/              Visión de producto, roadmap y glosario
  01-arquitectura/        Stack y ADR-001 … ADR-006
  02-memoria/             Aprendizajes y registro de componentes reutilizables
  features/NNN-nombre/    contexto.md, spec.md, diseno.md, tasks.md
  _plantillas/            Plantillas oficiales
```

## Decisiones de arquitectura

| ADR | Decisión |
|-----|----------|
| [ADR-001](specs/01-arquitectura/adr/ADR-001-stack-y-monorepo.md) | Stack tecnológico y monorepo TypeScript |
| [ADR-002](specs/01-arquitectura/adr/ADR-002-pasarela-de-pago-desacoplada.md) | Pasarela de pago desacoplada (Mercado Pago como primer adaptador) |
| [ADR-003](specs/01-arquitectura/adr/ADR-003-docker.md) | Docker para desarrollo y despliegue |
| [ADR-004](specs/01-arquitectura/adr/ADR-004-entorno-agentico.md) | Entorno agéntico: plugins, MCP, skills y hooks |
| [ADR-005](specs/01-arquitectura/adr/ADR-005-equipo-de-agentes.md) | Equipo de agentes, modelos y permisos |
| [ADR-006](specs/01-arquitectura/adr/ADR-006-requisitos-por-plataforma.md) | Requisitos por plataforma (web, API, móvil, integraciones, E2E) |

## Requisitos para trabajar en el proyecto

- [Claude Code](https://claude.com/claude-code).
- Python 3 (hooks).
- Node.js 24 LTS.
- Docker Desktop (con WSL2 en Windows).
- [Engram](https://github.com/Gentleman-Programming/engram) (memoria persistente).
- `typescript-language-server`.
- Variable de entorno `GITHUB_PERSONAL_ACCESS_TOKEN` para el MCP de GitHub: token de grano fino, limitado a este repositorio.

## Próximos pasos

1. Aceptar ADR-010 (`estado: aceptada`).
2. Reaprobar la spec y aprobar el diseño de `001-login-administrador` (`estado: aprobada`).
3. Ejecutar `/implementar 001` desde T-01 (arranque del workspace).
4. Redactar la visión de producto (`specs/00-vision/producto.md`) y priorizar los siguientes requerimientos en el roadmap.

## Licencia

[Apache 2.0](LICENSE)
