---
name: memoria-engram
description: Reglas de la memoria de largo plazo del proyecto con Engram (qué se guarda y qué no, tipos, títulos, topic_key para actualizar sin duplicar, revisión periódica). Úsalo al guardar, actualizar o revisar memorias.
user-invocable: false
---

# Memoria con Engram

Engram guarda **lo que el agente no debe volver a descubrir ni volver a equivocarse**.

**División de responsabilidades:**
| Dónde | Qué contiene |
|-------|--------------|
| `CLAUDE.md` | Reglas estables |
| Engram | Lo aprendido y cambiante |
| `specs/` | Qué se construye |
| `specs/02-memoria/` | La parte de la memoria que debe versionarse para el equipo |

## Qué se guarda
| Qué | Tipo Engram | Prefijo de `topic_key` | Ejemplo de título |
|-----|-------------|------------------------|-------------------|
| Decisión de arquitectura y su porqué | `architecture` / `decision` | `decision/` | "Reserva de prenda con UPDATE atómico (ADR-001)" |
| Convención descubierta | `pattern` | `convencion/` | "La API devuelve errores con formato problem+json" |
| Bug resuelto con su causa raíz | `bugfix` | `bug/` | "Doble venta: faltaba la condición status=available" |
| Componente reutilizable y dónde vive | `pattern` | `componente/` | "GarmentCard en packages/ui (web y mobile)" |
| Configuración del entorno | `config` | `config/` | "Mailpit expone la UI en el puerto 8025" |
| Resumen de sesión | — | — | Con `mem_session_summary`: qué se hizo y qué quedó pendiente |

**Formato del contenido:** qué es → por qué → dónde (rutas) → cómo aplicarlo. Breve.

## Qué NO se guarda
- Contraseñas, tokens, claves, datos personales o datos de clientes.
- Código completo (ya está en el repositorio) ni logs crudos.
- Suposiciones no verificadas.
- Lo que ya está en `CLAUDE.md`, una skill, una spec o un ADR: en ese caso se guarda solo la referencia.

## Actualizar, no duplicar
1. Antes de guardar, busca (`mem_search`) si el tema ya existe.
2. Si existe, guarda con el **mismo `topic_key`** (Engram actualiza la observación) o usa `mem_update` con su ID.
3. Si no sabes qué `topic_key` usar, pide uno con `mem_suggest_topic_key`.
4. Si una decisión cambia, actualiza la memoria indicando "REEMPLAZADA por …" y la referencia al nuevo ADR.

## Cuándo
| Momento | Acción | Quién |
|---------|--------|-------|
| Inicio de sesión | Contexto cargado automáticamente (hook SessionStart) | — |
| Inicio de tarea | `mem_search` de lo relacionado | Cada subagente |
| Durante | `mem_save` en el momento de cada decisión o descubrimiento | Quien lo descubre |
| Cierre de tarea | Guardar lo aprendido con título, tipo y `topic_key` | El subagente |
| Antes de compactar o cerrar sesión | Resumen mecánico (hooks); el razonado con `mem_session_summary` | Hooks + orquestador |
| Fin de cada rebanada vertical | Revisar (`mem_review`), corregir y borrar lo obsoleto (`mem_delete`) | `documentador` |
