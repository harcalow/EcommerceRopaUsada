---
id: NNN
diseno: ./diseno.md
estado: pendiente # pendiente | en-curso | completada  (no requiere aprobación humana)
---

# Tareas NNN — <Título>

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecha

**Tamaño (retrospectiva 001):** entre 6 y 12 tareas por funcionalidad. Una tarea = un **bloque coherente** que un agente
termina en una sesión (p. ej. «caso de uso + endpoint + pruebas» o «componentes de UI del formulario»), no un archivo.
Cada tarea lleva su **ficha completa**: sin ficha, el implementador no arranca.

| ID | Hito | Tarea | Agente | Cubre | Depende de | Estado |
|----|------|-------|--------|-------|------------|--------|
| T-01 | 1 | | backend-dev | RF-001, CA-001 | — | [ ] |
| T-0x | 1 | Pruebas E2E desde el Gherkin (en paralelo con las de implementación) | qa-tester | CA-001… | — | [ ] |

## Contexto de implementación
<Una página para los implementadores; la leen en lugar de todo diseno.md:
módulos y capas tocados, contratos (rutas, DTO, códigos de error), modelo de datos, componentes del
registro que se reutilizan y decisiones (ADR) que restringen la implementación.>

## Hitos
| Hito | Tareas | Cierre (verificación completa) |
|------|--------|--------------------------------|
| 1 | T-01… | `pnpm lint && pnpm typecheck && pnpm test` + E2E del hito + pasada corta del revisor |

## Fichas

### T-01 — <Título>
- **Rutas permitidas** (crear/modificar; fuera de ellas, el agente se detiene y avisa):
  - `apps/api/src/modules/<contexto>/…`
- **Interfaces** (firmas, puertos, DTO y errores ya decididos en el diseño; el agente no las improvisa):
  - `…`
- **Reutiliza** (del registro de componentes): `…`
- **Verificación acotada** (la que corre el agente, con `timeout`):
  - `timeout 600 pnpm --filter <paquete> exec vitest run <carpeta>`
  - `timeout 600 pnpm --filter <paquete> lint && timeout 600 pnpm --filter <paquete> typecheck`
- **Definición de hecho:**
  - [ ] Cumple CA-001 (pruebas nombradas con su ID)
  - [ ] Pruebas junto al código y en verde
  - [ ] Lint y typecheck del paquete sin errores
  - [ ] Sin procesos vivos al entregar
