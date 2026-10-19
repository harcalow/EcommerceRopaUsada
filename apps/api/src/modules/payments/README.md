# Módulo `payments`

Pasarela de pago desacoplada (ADR-002). El dominio y los casos de uso dependen del puerto `PaymentGateway` (`application/ports/`), nunca de un proveedor. Los adaptadores viven en `infrastructure/adapters/`: `mercadopago` (primer proveedor) y `fake` (desarrollo y pruebas, sin credenciales).

## Cómo añadir un proveedor nuevo
1. Crear `infrastructure/adapters/<proveedor>/` con una clase que implemente `PaymentGateway`. El SDK del proveedor solo se importa ahí.
2. Traducir estados y dinero del proveedor a `PaymentStatus` y `Money` propios; verificar la firma en `parseWebhook`.
3. Usar clave de idempotencia al crear pagos, timeouts explícitos y reintentos con backoff solo en operaciones idempotentes.
4. Hacer que el adaptador pase la suite de pruebas de contrato compartida.
5. Registrarlo en el módulo y poner `PAYMENT_PROVIDER=<proveedor>`.
6. Documentar sus variables en `.env.example`.

No deben cambiar el dominio, los casos de uso, la base de datos, la web ni la app móvil. Convenciones completas: skill `nestjs-hexagonal`.
