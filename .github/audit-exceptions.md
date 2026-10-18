# Excepciones de `pnpm audit`

El job `seguridad` de CI ejecuta `pnpm audit --audit-level high`. Las excepciones se declaran en `package.json` (`pnpm.auditConfig.ignoreGhsas`) y se documentan aquí. JSON no admite comentarios, por eso el detalle vive en este archivo.

| Aviso | Paquete | Ruta | Motivo | Aprobó | Revisión |
|-------|---------|------|--------|--------|----------|
| GHSA-vfj7-8cjw-p6xm | `braces <=3.0.3` | `apps/web > @next/eslint-plugin-next > fast-glob > braces` | Sin versión parcheada. Solo herramienta de lint en desarrollo; no se ejecuta en producción ni con entrada no confiable. | Harold (dueño), 2026-10-16 | 2026-11-16 |

Al revisar: si existe parche o la ruta desaparece, quitar el GHSA de `ignoreGhsas` y esta fila.

## Parches forzados (`pnpm.overrides`, 2026-10-16)

- `deepmerge-ts` 8.0.0 (publicada 2026-08-16) por GHSA-ggr8-5vv4-36mx. Vía `prisma > @prisma/config`.
- `mysql2` 3.22.0 (publicada 2026-04-10) por GHSA-3f6p-5ww8-9rcr. Vía `prisma`.

Retirar los overrides cuando Prisma suba sus propias dependencias a versiones parcheadas.
