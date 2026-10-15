---
name: requisitos-plataforma
description: Checklist de requisitos por tipo de componente (web, API, móvil, integraciones externas y pruebas E2E): accesibilidad WCAG, presupuesto de rendimiento, OpenAPI y versionado, errores uniformes, migraciones, rate limiting, offline, permisos, binario, reintentos e idempotencia. Úsalo al diseñar, implementar, probar o revisar.
user-invocable: false
---

# Requisitos por plataforma (ADR-006)

Aplica **solo las secciones de las plataformas que toca la tarea**. Cada punto forma parte de la Definition of Done.

## Web (`apps/web`)
- [ ] Usa los componentes del design system; nada de estilos ad hoc si ya existe el componente.
- [ ] **WCAG 2.2 AA:**
  - HTML semántico y `alt` descriptivo en las fotos de las prendas.
  - Contraste ≥ 4.5:1 y foco visible.
  - Navegable por teclado.
  - Formularios con `label` y errores anunciados.
- [ ] **Responsive:** funciona desde 360 px hasta escritorio, mobile-first.
- [ ] **Presupuesto de rendimiento** (móvil, p75):
  - LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.
  - JS inicial ≤ 200 KB gzip por ruta pública.
  - Imágenes con `next/image`, AVIF/WebP y tamaños declarados.
- [ ] Verificación visual con el MCP de Playwright en los flujos tocados.

```tsx
// ❌ Imagen sin alt ni tamaño, y botón que no es botón
<img src={g.photo} /> <div onClick={buy}>Comprar</div>
// ✅
<Image src={g.photo} alt={`${g.title}, talla ${g.size}, estado ${g.condition}`} width={400} height={500} />
<Button onPress={buy} data-testid="garment-buy">Comprar</Button>
```

## API (`apps/api`)
- [ ] **Contrato primero:** el esquema (Zod en `packages/contracts` → OpenAPI) se define o actualiza en la **primera tarea**, antes de implementar el endpoint.
- [ ] **Versionado** en la ruta `/v1/...`. Un cambio incompatible exige `/v2` y convivencia; nunca se rompe `/v1`.
- [ ] **Errores uniformes:** `application/problem+json` con `type`, `title`, `status`, `detail` y `correlationId`. Sin trazas internas.
- [ ] **Migraciones versionadas** (Prisma Migrate): una por cambio de esquema; una migración fusionada no se edita nunca.
- [ ] **Rate limiting:** global por IP y estricto en auth, checkout y webhooks (valores en `diseno.md`).
- [ ] **Pruebas de contrato:** las respuestas validan contra el esquema; los clientes usan `packages/api-client`.
- [ ] Paginación por cursor en los listados (catálogo).

```ts
// ❌ Error ad hoc, sin versión ni correlación
res.status(500).send('algo falló');
// ✅
throw new ProblemException({ type: 'garment/not-available', title: 'Prenda no disponible', status: 409 });
// → 409 application/problem+json { type, title, status, detail, correlationId }
```

## Móvil (`apps/mobile`)
- [ ] **Red lenta y sin conexión:**
  - Detección de conectividad con un estado "sin conexión" visible.
  - Caché de lectura (TanStack Query persistido) del catálogo ya visto.
  - Reintentos con backoff.
  - Nunca se compra ni se publica sin conexión: la acción se bloquea con un mensaje claro.
- [ ] **Permisos mínimos:**
  - Cámara y galería solo al publicar, pedidas en contexto y con una explicación.
  - Notificaciones con opt-in.
  - Sin ubicación salvo que la spec lo pida.
  - El permiso denegado tiene un camino alternativo.
- [ ] **Pruebas en emulador o dispositivo:** los flujos críticos con Maestro (iOS y Android).
- [ ] **Tamaño del binario:** descarga ≤ 40 MB por plataforma. Una dependencia nativa nueva se justifica en `diseno.md`.
- [ ] Accesibilidad: `accessibilityLabel` y tamaños táctiles ≥ 44 pt.

```tsx
// ❌ Pide la cámara al abrir la app
useEffect(() => { Camera.requestCameraPermissionsAsync(); }, []);
// ✅ La pide en contexto, al tocar "Añadir foto", con un camino alternativo si se deniega
const onAddPhoto = async () => { const { granted } = await requestCamera(); granted ? openCamera() : openGallery(); };
```

## Integraciones externas (pagos, almacenamiento, email)
- [ ] Detrás de un **puerto** con un adaptador `fake` para pruebas (ADR-002); sandbox del proveedor para la integración.
- [ ] **Timeouts** explícitos en toda llamada externa.
- [ ] **Reintentos** con backoff exponencial y jitter, **solo** en operaciones idempotentes y con un máximo definido.
- [ ] **Idempotencia:** clave de idempotencia al crear pagos; webhooks deduplicados por ID de evento.
- [ ] **Alertas:** el fallo sostenido de la integración genera un log de nivel `error` con `integration` y `correlationId`, y una alerta.

```ts
// ❌ Reintento ciego de una operación no idempotente
for (let i = 0; i < 5; i++) await mp.createPayment(order);
// ✅
await gateway.createCheckout({ ...input, idempotencyKey: order.id }); // reintentos con backoff dentro del adaptador
```

## Pruebas E2E
- [ ] Cada escenario Gherkin tiene su prueba, nombrada con `CA-xxx` o `CB-xxx`.
- [ ] **Page Objects** (web) y flujos reutilizables (Maestro) del registro de componentes; si se crean nuevos, se registran.
- [ ] **Datos de prueba fuera del código de prueba** (`fixtures/`, factories); cada prueba crea y limpia sus datos.
- [ ] **Selectores estables:** `data-testid` o roles accesibles. Nunca clases CSS ni XPath posicional.
- [ ] **Paralelas y aisladas.** Máximo 1 reintento, solo en CI. Una prueba que pasa al reintentar se reporta como **inestable** y se abre una tarea para corregirla.
- [ ] Reporte HTML legible por negocio, agrupado por escenario.

```ts
// ❌ Selector frágil y datos embebidos
await page.click('.btn.btn-primary:nth-child(2)'); await page.fill('#email', 'ana@test.com');
// ✅
const checkout = new CheckoutPage(page);
await checkout.payWith(buyers.default);   // fixture
await expect(page.getByTestId('order-confirmed')).toBeVisible();
```
