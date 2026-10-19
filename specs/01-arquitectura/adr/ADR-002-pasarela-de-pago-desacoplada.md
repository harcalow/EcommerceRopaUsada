---
id: ADR-002
estado: aceptada   # propuesta | aceptada | reemplazada por ADR-XXX
aprobacion: dueño (Harold) el 2026-10-15, aplicada por el orquestador con su autorización explícita en el chat
fecha: 2026-10-15
---

# ADR-002 — Pasarela de pago desacoplada (Mercado Pago como primer proveedor)

## Contexto
La pasarela inicial será **Mercado Pago**, pero el negocio quiere poder cambiarla o añadir otras (Stripe, Wompi, PayU…) sin reescribir la aplicación.
El acoplamiento a un proveedor suele colarse por cuatro vías:
1. Su SDK se usa directamente en la lógica de negocio.
2. Sus estados de pago se guardan tal cual.
3. Los clientes web o mobile integran sus componentes visuales.
4. Sus webhooks se procesan sin traducirlos.

## Opciones consideradas
1. **Integración directa con el SDK de Mercado Pago.**
   - Pros: es lo más rápido al principio.
   - Contras: cambiar de proveedor obliga a tocar casos de uso, base de datos, web y mobile.
2. **Puerto + adaptadores (arquitectura hexagonal).**
   - Pros: el proveedor queda confinado en un adaptador; cambiarlo implica escribir otro adaptador y modificar la configuración.
   - Contras: una capa de abstracción adicional.
3. **Agregador de pagos de terceros.**
   - Contras: añade otra dependencia y otro coste, y sigue acoplando al agregador.

## Decisión
Opción 2. En el módulo `payments` de `apps/api`:

### Puerto (contrato propio, sin tipos del proveedor)
```ts
// application/ports/payment-gateway.port.ts  (contrato orientativo)
interface PaymentGateway {
  readonly provider: string;                                   // "mercadopago", "stripe"…
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>; // URL de pago + referencia externa
  getPayment(providerReference: string): Promise<PaymentSnapshot>;
  parseWebhook(headers: Record<string, string>, rawBody: Buffer): Promise<PaymentEvent>; // verifica la firma
  refund(providerReference: string, amount?: Money): Promise<RefundResult>;
}
```

### Reglas
1. **Estados propios.** El dominio usa `PaymentStatus` (`pending`, `approved`, `rejected`, `cancelled`, `refunded`). Cada adaptador traduce los estados del proveedor.
2. **Dinero propio.** `Money = { amountMinor: integer, currency: ISO-4217 }`. Nunca se usan decimales flotantes ni el formato del proveedor.
3. **Persistencia neutral.** El pago se guarda con `provider` + `provider_reference` + estado interno. La respuesta cruda del proveedor solo se conserva en un campo de auditoría.
4. **Checkout por redirección.** La API devuelve una `checkoutUrl`:
   - La web redirige a ella.
   - La app la abre en el navegador del sistema.
   - **Ni la web ni la app incluyen el SDK del proveedor.**
   - Los componentes embebidos (p. ej. Bricks) quedan fuera del MVP.
5. **Webhooks por proveedor.** Ruta `POST /payments/webhooks/:provider`: el adaptador verifica la firma y traduce el aviso a un `PaymentEvent` interno. El aviso es idempotente: procesar el mismo evento dos veces no tiene efecto.
6. **Selección por configuración.** La variable `PAYMENT_PROVIDER=mercadopago` determina qué adaptador se inyecta.
7. **Adaptador falso.** Un `FakePaymentGateway` para desarrollo local y pruebas, sin depender de credenciales.
8. **Pruebas de contrato.** Una misma suite de pruebas se ejecuta contra todos los adaptadores; un adaptador nuevo debe pasarla.

### Cómo añadir o cambiar de proveedor
1. Crear `infrastructure/adapters/<proveedor>/` que implemente `PaymentGateway`.
2. Hacer que pase la suite de pruebas de contrato.
3. Registrarlo en el módulo y cambiar `PAYMENT_PROVIDER`.
4. Sin cambios en dominio, casos de uso, base de datos, web ni mobile.

## Consecuencias
- ➕ Cambiar de pasarela es un trabajo acotado a un adaptador.
- ➕ Las pruebas no dependen de Mercado Pago (se usa el adaptador falso).
- ➖ No se aprovechan funciones exclusivas del proveedor salvo que se modelen en el puerto.
- ➖ La experiencia de checkout por redirección es algo menos integrada que un formulario embebido.
- [POR ACLARAR] País y moneda de operación; si es marketplace, pagos divididos entre vendedores (afectaría al puerto).
