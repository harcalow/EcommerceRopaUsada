---
name: revision-seguridad
description: Checklist de revisión de código del proyecto (OWASP Top 10, cero deuda técnica, reutilización de componentes, capas y revisión humana obligatoria). Úsalo al revisar un diff en la etapa de verificación.
user-invocable: false
---

# Checklist de revisión: seguridad y cero deuda técnica

## Seguridad (OWASP Top 10)
| # | Riesgo | Qué comprobar en este proyecto |
|---|--------|--------------------------------|
| A01 | Control de acceso roto | Autenticación y autorización en **cada** endpoint; un vendedor solo edita sus prendas; un comprador solo ve sus pedidos |
| A02 | Fallos criptográficos | Sin secretos en el código; HTTPS; contraseñas con hash adaptativo; nunca datos de tarjeta |
| A03 | Inyección | Consultas parametrizadas (Prisma, sin `$queryRawUnsafe` con entrada del usuario); validación con Zod en el borde |
| A04 | Diseño inseguro | Reserva atómica de prendas únicas; webhooks idempotentes; límites de tamaño en las subidas |
| A05 | Configuración insegura | CORS acotado; cabeceras de seguridad; errores sin trazas internas hacia el cliente |
| A06 | Componentes vulnerables | Versiones fijadas en el lockfile; sin dependencias nuevas sin justificar |
| A07 | Fallos de autenticación | Expiración y rotación de tokens; rate limiting en login |
| A08 | Integridad de datos | Firma verificada en los webhooks de pago (ADR-002) |
| A09 | Fallos de logging | Logs JSON con nivel e id de correlación, **sin datos sensibles** |
| A10 | SSRF | URLs externas (p. ej. de imágenes) validadas contra una lista permitida |

**Revisión humana obligatoria:** si el diff toca autenticación, pagos, permisos o datos personales, márcalo como `⚠️ REVISIÓN HUMANA OBLIGATORIA` con las rutas afectadas.

## Cero deuda técnica (bloqueantes 🔴)
- `TODO` o `FIXME` sin tarea asociada (`TODO(T-xx)`).
- Código comentado.
- `any`, `@ts-ignore`, o `eslint-disable` sin justificación (`-- motivo`).
- **Duplicación:** ya existía un componente equivalente en `specs/02-memoria/registro-componentes.md` o en el código.
- Funciones gigantes (más de ~40 líneas o más de 3 niveles de anidación) o archivos con más de una responsabilidad.
- **Violación de capas:**
  - `domain` importa de `infrastructure` o de un framework.
  - Un cliente web o mobile contiene lógica de negocio o el SDK de un proveedor de pagos.
- Desviaciones de la spec o el diseño, o código que no corresponde a ninguna tarea.
- Un componente reutilizable nuevo que no se registró en `registro-componentes.md`.
- Faltan pruebas de lo nuevo:
  - Unitarias para la lógica.
  - De integración para la API.
  - E2E para los flujos críticos.

## Ejemplos
```ts
// ❌ Bloqueante: inyección y sin autorización
app.get('/garments/:id', (req) => db.$queryRawUnsafe(`SELECT * FROM garment WHERE id = ${req.params.id}`));

// ✅ Correcto: validación, autorización y consulta parametrizada vía caso de uso
@UseGuards(AuthGuard)
@Get(':id')
get(@Param() params: GarmentIdDto, @CurrentUser() user: User) {
  return this.getGarment.execute({ id: params.id, requesterId: user.id });
}
```
