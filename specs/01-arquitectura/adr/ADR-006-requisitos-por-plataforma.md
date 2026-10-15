---
id: ADR-006
estado: propuesta   # propuesta | aceptada | reemplazada por ADR-XXX
fecha: 2026-10-15
---

# ADR-006 — Requisitos transversales por tipo de componente

## Contexto
La app combina cuatro tipos de componente:
- Web frontend (Next.js).
- API (NestJS).
- Móvil (Expo).
- Integraciones externas (Mercado Pago, almacenamiento S3, email).

Cada tipo tiene riesgos propios que una Definition of Done genérica no cubre. Se evaluó un catálogo de recomendaciones por tipo de app para decidir cuáles aplican.

## Evaluación
| Tipo | Aplica | Decisión |
|------|--------|----------|
| Web frontend | Sí | Se adopta completo |
| API / backend | Sí | Se adopta completo |
| Móvil | Sí | Se adopta, con un alcance de offline acotado (ver abajo) |
| Integraciones externas | Sí | Se adopta completo |
| Framework de automatización de pruebas | Parcial | Se adoptan sus prácticas para la capa de pruebas E2E (no es un producto) |
| Datos / IA con RAG | No | Sin funciones de IA en el producto. **Disparador:** si se añade una (p. ej. descripciones de prendas generadas desde fotos), se aplicarán: versionado de prompts, evals con casos fijos, costo por consulta, trazas de cada llamada y guardrails |
| App que expone agentes a usuarios | No | Los usuarios no interactúan con agentes. El uso interno de agentes ya lo regulan ADR-004 y ADR-005 |

## Decisión
Los requisitos se detallan como checklist en la skill `requisitos-plataforma`, que cargan `arquitecto`, `backend-dev`, `frontend-dev`, `qa-tester` y `revisor`. En resumen:

### Web
- Design system como capa horizontal.
- **WCAG 2.2 AA** y responsive (360 px → escritorio) en la Definition of Done.
- Verificación visual con el MCP de Playwright.
- **Presupuesto de rendimiento** (móvil, p75):
  - LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.
  - JS inicial ≤ 200 KB gzip por ruta pública.
  - Imágenes de prendas en formatos modernos (AVIF/WebP) y con tamaños adaptados.

### API
- **Contrato OpenAPI antes de implementar.** Los esquemas viven en `packages/contracts` (Zod → OpenAPI); el cliente se genera a partir de ellos.
- **Versionado en la ruta:** `/v1`. Un cambio incompatible exige una versión nueva y un periodo de convivencia.
- **Errores uniformes:** formato `application/problem+json` (RFC 9457) con `type`, `title`, `status`, `detail`, `correlationId`.
- **Migraciones de BD versionadas** (Prisma Migrate), aplicadas en CI y nunca editadas una vez fusionadas.
- **Rate limiting:** global por IP y más estricto en autenticación, checkout y webhooks. Los valores se fijan en el diseño de cada capa.
- **Pruebas de contrato:** la API cumple su OpenAPI y los clientes usan el cliente generado.

### Móvil
- **Red lenta y sin conexión (alcance MVP):**
  - Detección de conectividad y estados "sin conexión".
  - Caché de lectura del catálogo ya visto y reintentos con backoff.
  - **No** se compra ni se publica sin conexión. Esto precisa la consecuencia de ADR-001 sobre el offline.
- **Permisos mínimos:**
  - Cámara y galería solo al publicar una prenda, y pedidas en contexto.
  - Notificaciones con opt-in.
  - Sin ubicación salvo que una spec lo justifique.
- **Pruebas en emuladores y dispositivos reales:** E2E móvil con **Maestro** (flujos YAML, compatible con Expo), propuesto a confirmar en la capa "Generación de apps".
- **Tamaño del binario:** presupuesto de descarga ≤ 40 MB por plataforma, medido en cada build de EAS.

### Integraciones externas (pagos, almacenamiento, email)
- **Mocks o sandbox del proveedor:**
  - Adaptadores `fake` para pruebas y desarrollo.
  - Sandbox de Mercado Pago para la integración.
  - El emulador S3 y Mailpit en Docker (ADR-003).
- **Reintentos con backoff exponencial y jitter** solo en operaciones idempotentes, con *timeouts* explícitos.
- **Idempotencia:** claves de idempotencia en la creación de pagos y webhooks deduplicados por ID de evento.
- **Alertas** cuando una integración falla de forma sostenida. La herramienta se decide en la capa "Errores, logging y configuración" [POR ACLARAR].

### Pruebas E2E (prácticas de framework de automatización)
- La entrada es la spec: un escenario Gherkin equivale a una o más pruebas con el ID `CA-xxx` o `CB-xxx`.
- **Page Object** como capa horizontal (web) y flujos reutilizables (Maestro).
- **Datos de prueba separados del código** (`fixtures/`, factories).
- **Selectores estables:** `data-testid` o roles accesibles; nunca selectores CSS frágiles.
- **Reportes legibles por negocio:** HTML de Playwright agrupado por escenario Gherkin.
- **Ejecución paralela y reintentos controlados:** máximo 1 reintento, solo en CI. Una prueba que pasa al reintentar se reporta como **inestable** y se corrige; no se oculta.

## Consecuencias
- ➕ Los riesgos propios de cada plataforma se verifican en cada rebanada, no al final.
- ➕ Contract-first: web y mobile pueden avanzar en paralelo a la API con el cliente generado.
- ➖ Más trabajo por rebanada (accesibilidad, contrato, pruebas de contrato y E2E móvil).
- Nuevas capas horizontales en el roadmap: framework de pruebas E2E y resiliencia de integraciones.
- Los umbrales (rendimiento, binario, rate limits) son iniciales y se revisan con datos reales.
