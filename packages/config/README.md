# @perchados/config

Configuración compartida del monorepo.

## Propósito
Evitar duplicar configuración de herramientas entre apps y paquetes.

## Qué contiene
- ESLint, TypeScript (extiende `tsconfig.base.json`), Prettier.
- Configuración de pruebas (Vitest/Jest).

## Quién lo usa
- `apps/*` y `packages/*`.

## Reglas
- ✅ Cada app o paquete extiende la configuración de aquí.
- ❌ No copiar configuración entre proyectos.
- ❌ No suprimir reglas de lint sin justificación.

## Capa en que se rellena
001 (base técnica), cuando se instalen las herramientas (ADR-001).
