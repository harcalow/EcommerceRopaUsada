---
id: ADR-008
estado: aceptada   # propuesta | aceptada | reemplazada por ADR-XXX
aprobacion: dueño (Harold) el 2026-10-15; reaceptada el 2026-10-17 en el chat tras añadir la nota de excepciones del audit
fecha: 2026-10-15
---

# ADR-008 — Herramientas transversales de API, pruebas y CI

## Contexto
La 002 (hitos 1 y 2) necesita fijar varias herramientas que usarán todas las rebanadas:
- Logging JSON con correlación y saneado.
- Validación de la configuración.
- El flujo Zod → OpenAPI → cliente tipado.
- Un ejecutor de pruebas con cobertura.
- Un limitador de peticiones que no se eluda reiniciando.
- Los escaneos de secretos y de dependencias, con excepciones que caducan.

ADR-001 y ADR-006 fijan el marco (NestJS, Zod, OpenAPI, Vitest/Jest, GitHub Actions), no las librerías concretas. Las versiones se verifican con Context7 al instalar.

## Opciones consideradas
| Tema | Opciones | Elegida y porqué |
|------|----------|------------------|
| Logging | **pino (`nestjs-pino`)** · winston · logger de Nest | pino: JSON de una línea nativo, el más rápido, `redact` integrado, contexto por petición con AsyncLocalStorage. winston necesita más configuración para lo mismo |
| Configuración | **Zod propio** · `@nestjs/config` + Joi · envalid | Zod ya está en el stack: un solo lenguaje de esquemas, mensajes controlados (nombre sin valor) y reutilizable en la web |
| Validación de entradas | **Pipe propio sobre Zod** · `nestjs-zod` · class-validator | Unas 30 líneas, sin acoplarse a `@nestjs/swagger`. class-validator duplicaría los esquemas |
| Zod → OpenAPI | **`@asteasolutions/zod-to-openapi`** · `nestjs-zod` + swagger · OpenAPI escrito a mano | Mantiene `packages/contracts` independiente de Nest y genera `openapi/v1.json` versionado |
| Cliente tipado | **`openapi-typescript` + `openapi-fetch`** · orval · openapi-generator | Solo tipos más ≈ 6 KB de runtime (presupuesto de JS). Orval genera más código y más dependencias |
| Contrato en pruebas | **Ajv contra `v1.json`** · jest-openapi | Ajv es estándar y está mantenido; las alternativas están poco mantenidas o atadas a Jest |
| Ejecutor de pruebas | **Vitest en todo el monorepo** (`unplugin-swc` para los decoradores de Nest) · Jest en la API + Vitest en la web | Un solo ejecutor, configuración y cobertura (`v8`) compartidas desde `packages/config` |
| Límite de peticiones | **`@nestjs/throttler` + almacén PostgreSQL propio** · almacén en memoria · Redis | La memoria se reinicia y no escala a varias réplicas (CB-022). Redis sería un servicio más en Docker. PostgreSQL ya existe: UPSERT atómico con la hora de la BD |
| Secretos | **gitleaks (CLI)** · trufflehog · GitHub secret scanning | La CLI es gratuita, escanea todos los commits del PR y redacta la salida; la *action* oficial exige licencia en organizaciones |
| Dependencias | **`pnpm audit --audit-level high`** + excepciones con caducidad · osv-scanner · Dependabot | Nativo de pnpm, sin herramientas extra. La caducidad de 30 días se valida con un script sobre `security/audit-exceptions.yaml` |

**Excepciones del audit (2026-10-16):** el job `seguridad` ejecuta `pnpm audit --audit-level high`. Excepción GHSA-vfj7-8cjw-p6xm (`braces`, solo dev, sin parche) aprobada por Harold el 2026-10-16, a revisar el 2026-11-16 (ver `.github/audit-exceptions.md`; se usa `pnpm.auditConfig.ignoreGhsas` en lugar de `security/audit-exceptions.yaml`). Parches forzados con `pnpm.overrides`: `deepmerge-ts` 8.0.0 y `mysql2` 3.22.0.

## Decisión
Las opciones elegidas en la tabla. Detalle de uso en `specs/features/002-fundaciones/diseno.md`.

## Consecuencias
- ➕ Zod es la fuente única de entrada, configuración y contrato. Un cambio de contrato rompe el `typecheck` de la web.
- ➕ Sin servicios nuevos en Docker.
- ➖ Una escritura en PostgreSQL por petición limitada. Si el tráfico lo exige, se cambia el almacén por Redis tras la misma interfaz `ThrottlerStorage`, con un ADR nuevo.
- ➖ NestJS con Vitest necesita SWC para los metadatos de los decoradores (configuración en el preset).
- La herramienta de alertas (ADR-006) sigue aplazada, por decisión del dueño, a la capa de resiliencia de integraciones.
