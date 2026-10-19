---
name: nestjs-hexagonal
description: Convenciones de apps/api (NestJS hexagonal). Úsala al crear o modificar módulos, casos de uso, puertos, adaptadores, controladores, DTOs, errores problem+json, el módulo payments o lógica de concurrencia sobre prendas únicas.
user-invocable: false
---

# NestJS hexagonal en `apps/api`

Los ejemplos son de documentación, no código del repositorio.

## Estructura

```
apps/api/src/
  modules/<modulo>/{domain,application,infrastructure,interface}/
  shared/            errores (ProblemException), Money, config, logger
```
Módulos: `catalog`, `inventory`, `cart`, `orders`, `users`, `media`, `payments`.

## Responsabilidad y reglas de dependencia

| Capa | Contiene | Puede importar |
|------|----------|----------------|
| `domain` | Entidades, value objects, reglas, errores de dominio | Solo `domain` propio y `shared` puro |
| `application` | Casos de uso y **puertos** (interfaces) | `domain`, `shared` |
| `infrastructure` | Implementa puertos: repositorios Prisma, adaptadores externos | `application`, `domain`, librerías |
| `interface` | Controladores REST y DTOs (esquemas Zod de `packages/contracts`) | `application`, `packages/contracts` |

Sentido único: `interface → application → domain` e `infrastructure → application/domain`. El dominio nunca importa NestJS, Prisma, Zod ni SDKs. Un módulo no importa las capas internas de otro: solo su caso de uso público o un puerto.

```ts
// ❌ Dominio acoplado al framework y al ORM
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
export class Garment { constructor(private prisma: PrismaClient) {} }

// ✅ Dominio puro; el acceso a datos es un puerto en application
export class Garment {
  private constructor(readonly id: string, private status: GarmentStatus) {}
  reserve(): void {
    if (this.status !== 'available') throw new GarmentNotAvailableError(this.id);
    this.status = 'reserved';
  }
}
// application/ports/garment.repository.port.ts
export interface GarmentRepository {
  findById(id: string): Promise<Garment | null>;
}
```

## Nombres de archivos
kebab-case con sufijo de rol:
- `garment.entity.ts`, `money.value-object.ts`
- `reserve-garment.use-case.ts`
- `garment.repository.port.ts` (puerto), `prisma-garment.repository.ts` (adaptador)
- `garments.controller.ts`, `garments.module.ts`
- DTOs: se importan de `packages/contracts`; no se redefinen en la API.
- Prueba: `<archivo>.spec.ts` **junto al código**; integración de endpoints: `<controlador>.e2e-spec.ts` junto al controlador.

## Interface: controladores y DTOs

- Rutas bajo `/v1/...` (un cambio incompatible exige `/v2` con convivencia).
- Validar entradas con el esquema Zod de `packages/contracts`; el contrato se define antes de implementar.
- El controlador solo traduce HTTP a caso de uso; no tiene lógica de negocio.

```ts
// ❌ Sin versión, sin validación, lógica en el controlador
@Controller('garments')
class GarmentsController {
  @Post() create(@Body() b: any) { return this.prisma.garment.create({ data: b }); }
}

// ✅
@Controller('v1/garments')
class GarmentsController {
  @Post()
  async create(@Body(new ZodPipe(createGarmentSchema)) dto: CreateGarmentDto) {
    return this.createGarment.execute(dto);
  }
}
```

## Errores `problem+json`
Toda respuesta de error es `application/problem+json` con `type`, `title`, `status`, `detail` y `correlationId`; sin trazas internas. Los errores de dominio se traducen en un filtro global.

```ts
// ❌
res.status(500).send('algo falló');
// ✅
throw new ProblemException({ type: 'garment/not-available', title: 'Prenda no disponible', status: 409 });
```

## Concurrencia en prendas únicas
Cada prenda existe una sola vez: nunca puede venderse dos veces.
- La reserva es un `UPDATE` atómico condicionado al estado; se comprueban las filas afectadas.
- Nada de leer y luego escribir sin condición ni transacción.
- La reserva tiene expiración; el pago aprobado la confirma.

```ts
// ❌ Condición de carrera: dos compradores pasan la comprobación
const g = await prisma.garment.findUnique({ where: { id } });
if (g.status === 'available') await prisma.garment.update({ where: { id }, data: { status: 'reserved' } });

// ✅ Atómico, parametrizado
const { count } = await prisma.garment.updateMany({
  where: { id, status: 'available' },
  data: { status: 'reserved', reservedUntil },
});
if (count === 0) throw new GarmentNotAvailableError(id);
```

## Módulo `payments` (ADR-002)
- Puerto `PaymentGateway` en `application/ports/payment-gateway.port.ts`, con tipos propios (`PaymentStatus`, `Money = { amountMinor, currency }`).
- Adaptadores en `infrastructure/adapters/{mercadopago,fake}/`. El SDK del proveedor solo existe dentro de su adaptador.
- El adaptador activo se elige con `PAYMENT_PROVIDER`; `fake` para desarrollo y pruebas.
- Checkout por redirección (`checkoutUrl`); webhooks en `POST /v1/payments/webhooks/:provider`, firma verificada por el adaptador y deduplicados por ID de evento.
- Crear pagos con clave de idempotencia; timeouts explícitos; reintentos con backoff y jitter solo en operaciones idempotentes; un fallo sostenido registra log `error` con `integration` y `correlationId`.
- Una suite de pruebas de contrato se ejecuta contra todos los adaptadores.

```ts
// ❌ SDK y estados del proveedor en el caso de uso
import { MercadoPagoConfig } from 'mercadopago';
if (payment.status === 'approved_by_mp') order.pay();

// ✅ El caso de uso depende del puerto y de estados propios
constructor(@Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway) {}
const session = await this.gateway.createCheckout({ ...input, idempotencyKey: order.id });
```

## Cómo añadir un módulo nuevo
1. Crear `modules/<modulo>/{domain,application,infrastructure,interface}/`.
2. Definir/actualizar el contrato en `packages/contracts` antes del endpoint.
3. Dominio primero, luego casos de uso y puertos, luego adaptadores, al final el controlador.
4. Registrar un `<modulo>.module.ts` que enlace puertos con adaptadores y añadirlo al módulo raíz.
5. Pruebas unitarias del dominio y casos de uso (con dobles de los puertos) y de integración de los endpoints, junto al código.
6. Migración Prisma versionada si cambia el esquema (nunca se edita una ya fusionada).
7. Registrar lo reutilizable en `specs/02-memoria/registro-componentes.md`.

## Transversales
- Rate limiting global por IP y estricto en auth, checkout y webhooks.
- Logs JSON con nivel e id de correlación, sin datos personales.
- Consultas parametrizadas; sin secretos en el código.
- Sin `any`, sin código comentado, sin `TODO` sin tarea.
