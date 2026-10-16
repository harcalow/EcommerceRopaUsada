---
estado: borrador
---

# Roadmap de entrega

Estrategia: primero las capas horizontales que bloquean la primera rebanada; después las rebanadas verticales por valor y riesgo. Ver la skill `estrategia-entrega`.

## Capas horizontales
| Nº | Capa | Estado |
|----|------|--------|
| 000 | Estructura base del monorepo + Docker | en especificación |
| 002 | **Fundaciones de web y API** (agrupa, solo para web y API, las capas siguientes marcadas con «→ 002»). Bloquea a la 001 | en especificación |
| → 002 | Generación de apps (NestJS, Next.js) + CI (lint, typecheck, pruebas, umbral de cobertura, escaneo de dependencias y secretos) + skills oficiales | en especificación (Expo queda pendiente) |
| → 002 | Contrato de API: OpenAPI desde `packages/contracts`, versionado `/v1`, errores `problem+json`, rate limiting | en especificación |
| → 002 | Manejo de errores, logging estructurado (JSON, nivel, id de correlación, sin datos sensibles) y configuración | en especificación (alertas pendientes) |
| → 002 | Cliente de base de datos (Prisma) y migraciones versionadas | en especificación (MCP PostgreSQL de solo lectura pendiente) |
| → 002 | Autenticación base: hash, sesión con caducidad absoluta y revocable, CSRF, guard por rol | en especificación |
| → 002 | Design system base web, accesible (WCAG 2.2 AA) y con presupuesto de rendimiento | en especificación (mobile pendiente) |
| → 002 | Base E2E web: Playwright, Page Object base, `data-testid` | en especificación |
| — | Alertas por fallos sostenidos | propuesta |
| — | Design system mobile | propuesta |
| — | Framework de pruebas E2E completo: fixtures, factories, flujos Maestro (móvil), reportes | propuesta |
| — | Resiliencia de integraciones: cliente HTTP con timeouts, reintentos con backoff, idempotencia y alertas | propuesta |
| — | Móvil: conectividad, caché de lectura persistida y permisos en contexto | propuesta |
| — | Almacenamiento de imágenes (puerto S3) | propuesta |
| — | Pasarela de pagos: puerto + adaptadores fake y Mercado Pago (ADR-002) | propuesta |

> No todas tienen que estar listas antes de la primera rebanada: solo las que esa rebanada necesite.

## Rebanadas verticales
> Pendiente de la visión de producto (`specs/00-vision/producto.md`).

| Prioridad | Rebanada | Valor | Riesgo | Capas requeridas | Estado |
|-----------|----------|-------|--------|------------------|--------|
| 1 | 001 — Login de administrador | Alto: da acceso al panel que gestiona catálogo y pedidos | Medio (seguridad) | 000, 002 | en especificación |
