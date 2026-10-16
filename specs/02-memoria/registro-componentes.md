# Registro de componentes (caché de componentes)

**Regla:** antes de crear algo, búscalo aquí y en Engram. Si creas algo reutilizable, añádelo en la misma tarea y guarda una memoria `componente/<nombre>`.
El `revisor` rechaza el código duplicado cuando ya existía un equivalente.

Formato: **Nombre** · `ruta` · propósito · ejemplo de uso mínimo.

## UI web (`apps/web`, `packages/ui-*`)
| Nombre | Ruta | Propósito | Uso |
|--------|------|-----------|-----|

## UI mobile (`apps/mobile`)
| Nombre | Ruta | Propósito | Uso |
|--------|------|-----------|-----|

## Servicios y casos de uso (`apps/api`)
| Nombre | Ruta | Propósito | Uso |
|--------|------|-----------|-----|

## Utilidades y contratos compartidos (`packages/*`)
| Nombre | Ruta | Propósito | Uso |
|--------|------|-----------|-----|
| problemSchema, PROBLEM_TYPES | packages/contracts/src/common/ | Error RFC 9457 estricto y catálogo de tipos | Respuestas de error de toda la API (T-07) |
| problemShape | packages/contracts/src/common/problem.ts | Campos base para extender el problema con extensiones (checks, lockedMinutesRemaining) | Esquemas de error con extensión |
| createV1Registry, buildOpenApiDocument | packages/contracts/src/v1/registry.ts | Registro de esquemas y rutas; genera openapi/v1.json con pnpm contract:generate | Cada endpoint nuevo se registra aquí |

## Pruebas: page objects, selectores estables y fixtures
| Nombre | Ruta | Propósito | Uso |
|--------|------|-----------|-----|
