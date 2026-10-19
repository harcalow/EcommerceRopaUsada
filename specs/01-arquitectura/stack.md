---
estado: borrador
---

# Stack tecnológico

> Derivado de ADR-001 a ADR-009. Cómo se usa cada pieza en el proyecto: `specs/features/001-login-administrador/diseno.md` (base técnica, ADR-010).

| Capa | Tecnología | ADR |
|------|------------|-----|
| Runtime | Node.js LTS (24) | ADR-001 |
| Monorepo | pnpm workspaces + Turborepo | ADR-001 |
| Frontend web | Next.js (App Router) | ADR-001 |
| Mobile (iOS / Android) | React Native + Expo (Expo Router, EAS Build) | ADR-001 |
| Backend | NestJS — monolito modular hexagonal | ADR-001 |
| Base de datos | PostgreSQL + Prisma | ADR-001 |
| Contratos compartidos | Zod → OpenAPI `/v1` (contract-first) + cliente tipado generado; errores `problem+json` | ADR-001, ADR-006 |
| Estado en clientes | TanStack Query + Zustand | ADR-001 |
| Almacenamiento de imágenes | API S3 (emulador en local; proveedor real por definir) | ADR-003 |
| Pagos | Puerto `PaymentGateway`; primer adaptador: Mercado Pago | ADR-002 |
| Autenticación | Sesión en servidor (PostgreSQL) con cookie opaca HttpOnly + CSRF sincronizador; hash argon2id (`@node-rs/argon2`) — propuesta | ADR-007 |
| Logging, configuración y límite de peticiones | pino (`nestjs-pino`), configuración validada con Zod, `@nestjs/throttler` con almacén PostgreSQL — propuesta | ADR-008 |
| Generación de contrato y cliente | `@asteasolutions/zod-to-openapi` → `openapi-typescript` + `openapi-fetch` — propuesta | ADR-008 |
| Design system web | `@perchados/ui-tokens` (TS → variables CSS) + `@perchados/ui-web` (CSS Modules, HTML nativo); Plus Jakarta Sans + IBM Plex Mono — propuesta | ADR-009 |
| Testing | Vitest en todo el monorepo (unitarias, integración y contrato con Ajv), axe (vitest-axe, @axe-core/playwright), Playwright (E2E web), Maestro (E2E móvil, a confirmar) | ADR-001, ADR-006, ADR-008, ADR-009 |
| CI | GitHub Actions; gitleaks y `pnpm audit` — propuesta | ADR-008 |
| Contenedores | Docker Compose (dev) + Dockerfiles multi-stage (prod) | ADR-003 |
| Despliegue | [POR ACLARAR] — cualquier hosting de contenedores | ADR-003 |
