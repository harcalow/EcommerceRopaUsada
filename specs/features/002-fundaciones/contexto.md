---
id: 002
titulo: Fundaciones de web y API
tipo: horizontal
---

# Contexto 002 — Fundaciones de web y API

## Idea original
La spec 001 (login de administrador) es la primera rebanada vertical y necesita una base técnica que aún no existe. El dueño decidió (15-10-2026) agrupar esas capas base en una sola funcionalidad horizontal, **002 Fundaciones**, que va después de la 000 (estructura y Docker) y antes de la 001.

## Lo que ya existe
- **000 (pendiente de aprobación):** monorepo pnpm + Turborepo con carpetas `apps/` y `packages/`, Docker Compose (postgres, storage, mailpit) y Dockerfiles. **No genera las apps.**
- **ADR-001:** NestJS hexagonal, Next.js App Router, Prisma + PostgreSQL, Zod → OpenAPI, TanStack Query.
- **ADR-006:**
  - Contrato primero (`/v1`) y errores `problem+json`.
  - Migraciones versionadas y rate limiting.
  - WCAG 2.2 AA y presupuesto de rendimiento.
  - Logs JSON con id de correlación.
- **ADR-004 (catálogo de skills):** las skills `nestjs-hexagonal`, `nextjs-app-router` y `docker-dev` llegan con la 000. `api-rest-conventions` y `prisma-datos` llegan con las capas de errores y de base de datos, que ahora forman parte de esta 002.
- La marca Perchados está definida en el mockup de la 001 (`specs/features/001-login-administrador/mockup-login.png`):
  - Azul primario intenso y acentos naranja, verde agua y rosa.
  - Tipografía sans geométrica en negrita para los títulos y monoespaciada para las etiquetas.
  - Botones redondeados.
- **Entorno:** Node.js 24 instalado; Docker Desktop instalándose.

## Memoria relevante
Sin entradas todavía.

## Clasificación
- **Tipo:** horizontal. No aporta valor visible al usuario final; la usan todas las rebanadas.
- **Capas horizontales previas requeridas:** 000.
- **Agrupa estas capas del roadmap:**
  - Generación de apps y CI.
  - Contrato de API.
  - Errores, logging y configuración.
  - Cliente de base de datos y migraciones.
  - Autenticación (solo el mecanismo de sesión y el hash, no las pantallas).
  - Design system base (solo web).
- **No incluye:**
  - La app móvil (Expo): se generará cuando llegue la primera rebanada móvil.
  - El almacenamiento de imágenes y la pasarela de pagos.
  - El framework E2E completo: aquí solo se configura Playwright con un primer Page Object base.

## Riesgos y dudas iniciales
- **Elección del mecanismo de sesión** (cookie con sesión en servidor frente a JWT) y del algoritmo de hash. Lo decide un ADR en el diseño.
- **Alcance grande para una sola funcionalidad.** Hay que mantener cada tarea pequeña y verificable.
- **CI en GitHub Actions:** requiere el repositorio remoto (ya existe).
