---
id: 000
diseno: ./diseno.md
estado: pendiente
---

# Tareas 000 — Estructura base del monorepo

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecha

| ID | Tarea | Agente | Cubre | Depende de | Estado |
|----|-------|--------|-------|------------|--------|
| T-01 | Archivos raíz del monorepo | backend-dev | RF-001, RF-006, CB-003 | — | [ ] |
| T-02 | Estructura de `apps/api` + módulo `payments` + skill `nestjs-hexagonal` | backend-dev | RF-002, RF-003 | T-01 | [ ] |
| T-03 | Estructura de `apps/web` + skill `nextjs-app-router` | frontend-dev | RF-002 | T-01 | [ ] |
| T-04 | Estructura de `apps/mobile` + skill `expo-router-mvvm` | frontend-dev | RF-002 | T-01 | [ ] |
| T-05 | `packages/*` con README de propósito | backend-dev | RF-001 | T-01 | [ ] |
| T-06 | Docker: compose, Dockerfiles, `.dockerignore` + skill `docker-dev` | backend-dev | RF-004, RF-005, RF-006, CB-001, CB-002, CB-004 | T-02, T-03 | [ ] |
| T-07 | Actualizar `CLAUDE.md` raíz (estructura, referencias a skills, comandos) | orquestador | RF-002 | T-01…T-06 | [ ] |

## Cómo se verifica cada tarea
- **T-01, T-05:** existen los archivos; JSON y YAML válidos (CA-001).
- **T-02 a T-04:** existe el árbol del diseño; cada skill tiene ejemplos ✅/❌ y está precargada en su subagente (CA-002, CA-003).
- **T-06:** el YAML es válido; las variables cuadran con `.env.example` (CA-006); hay etapas `dev` y `prod` con usuario no root (CA-005); `docker compose config` si Docker está disponible (CA-004).
- **T-07:** `CLAUDE.md` sigue por debajo de 200 líneas y refleja la nueva estructura.

## Definición de hecho (común)
- [ ] Ninguna dependencia instalada; sin `node_modules` ni lockfile.
- [ ] Sin lógica de negocio.
- [ ] Cumple los CA y CB que cubre.
