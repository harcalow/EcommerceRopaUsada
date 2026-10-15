---
estado: borrador
---

# Roadmap de entrega

Estrategia: primero las capas horizontales que bloquean la primera rebanada; después las rebanadas verticales por valor y riesgo. Ver la skill `estrategia-entrega`.

## Capas horizontales
| Nº | Capa | Estado |
|----|------|--------|
| 000 | Estructura base del monorepo + Docker | en especificación |
| — | Generación de apps (NestJS, Next.js, Expo) + CI (lint, typecheck, pruebas, umbral de cobertura, escaneo de dependencias y secretos) + skills oficiales | propuesta |
| — | Contrato de API: OpenAPI desde `packages/contracts`, versionado `/v1`, errores `problem+json`, rate limiting | propuesta |
| — | Manejo de errores, logging estructurado (JSON, nivel, id de correlación, sin datos sensibles), alertas y configuración | propuesta |
| — | Cliente de base de datos (Prisma) y migraciones versionadas + MCP PostgreSQL de solo lectura | propuesta |
| — | Autenticación | propuesta |
| — | Design system base (web y mobile), accesible (WCAG 2.2 AA) y con presupuesto de rendimiento | propuesta |
| — | Framework de pruebas E2E: Page Objects (Playwright), flujos Maestro (móvil), fixtures, reportes y reintentos controlados | propuesta |
| — | Resiliencia de integraciones: cliente HTTP con timeouts, reintentos con backoff, idempotencia y alertas | propuesta |
| — | Móvil: conectividad, caché de lectura persistida y permisos en contexto | propuesta |
| — | Almacenamiento de imágenes (puerto S3) | propuesta |
| — | Pasarela de pagos: puerto + adaptadores fake y Mercado Pago (ADR-002) | propuesta |

> No todas tienen que estar listas antes de la primera rebanada: solo las que esa rebanada necesite.

## Rebanadas verticales
> Pendiente de la visión de producto (`specs/00-vision/producto.md`).

| Prioridad | Rebanada | Valor | Riesgo | Capas requeridas | Estado |
|-----------|----------|-------|--------|------------------|--------|
