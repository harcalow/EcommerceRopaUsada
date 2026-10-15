---
estado: borrador
---

# Stack tecnológico

> Derivado de ADR-001, ADR-002 y ADR-003. Se considera vigente cuando esos ADR estén `aceptada`.

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
| Autenticación | [POR ACLARAR] | — |
| Testing | Vitest/Jest (unitarias), pruebas de contrato, Playwright (E2E web y visual), Maestro (E2E móvil, a confirmar) | ADR-001, ADR-006 |
| Contenedores | Docker Compose (dev) + Dockerfiles multi-stage (prod) | ADR-003 |
| Despliegue | [POR ACLARAR] — cualquier hosting de contenedores | ADR-003 |
