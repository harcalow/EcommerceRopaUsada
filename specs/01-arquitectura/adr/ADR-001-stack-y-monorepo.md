---
id: ADR-001
estado: propuesta   # propuesta | aceptada | reemplazada por ADR-XXX
fecha: 2026-10-15
---

# ADR-001 — Stack tecnológico y monorepo TypeScript

## Contexto
El producto necesita tres clientes de una misma lógica de negocio: una web con buen SEO (catálogo y fichas de prendas indexables), apps nativas para iOS y Android, y una API que las sirva a ambas.
El proyecto se desarrolla 100% con agentes de IA, así que importan especialmente:
- Contratos compartidos que hagan fallar la compilación cuando un cliente y la API no coinciden.
- Convenciones claras sobre dónde va cada cosa.
- Un ecosistema con abundante documentación.

## Opciones consideradas
1. **Monorepo TypeScript: Next.js + NestJS + Expo (React Native).**
   - Pros: un solo lenguaje; tipos y esquemas compartidos entre back, web y mobile; SEO con renderizado en servidor; un solo código para iOS y Android; es el ecosistema donde los modelos de IA rinden mejor.
   - Contras: React Native no alcanza el rendimiento nativo puro (irrelevante para un ecommerce).
2. **Flutter (web + mobile) + backend aparte.**
   - Pros: una sola UI para todas las plataformas.
   - Contras: la web de Flutter tiene un SEO deficiente (crítico en ecommerce) y obliga a usar dos lenguajes, sin contratos compartidos.
3. **Repositorios separados por aplicación.**
   - Contras: contratos duplicados, versiones desincronizadas y más contexto disperso para los agentes.

## Decisión
Monorepo TypeScript (opción 1):

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js LTS (24) |
| Gestor de paquetes / monorepo | pnpm workspaces + Turborepo |
| Web | Next.js (App Router) |
| Mobile | React Native + Expo (Expo Router, EAS Build) |
| Backend | NestJS (API REST + OpenAPI) |
| Base de datos | PostgreSQL + Prisma |
| Contratos | Zod en `packages/contracts`; cliente tipado generado desde OpenAPI |
| Estado en clientes | TanStack Query (estado del servidor) + Zustand (estado local) |
| Testing | Vitest/Jest (unitarias), Playwright (e2e web) |

### Arquitectura por aplicación
- **`apps/api`:** monolito modular con arquitectura hexagonal en cada módulo (`domain`, `application`, `infrastructure`, `interface`). Sin microservicios en el MVP.
- **`apps/web`:** organización por funcionalidad (`features/<nombre>`). Server Components para catálogo y fichas (SEO/ISR); Client Components solo donde hay interacción. Sin lógica de negocio: consume la API.
- **`apps/mobile`:** organización por funcionalidad con Expo Router. MVVM ligero: la pantalla pinta y un hook actúa como view-model. Sin lógica de negocio: consume la API.
- **Reservar o vender una prenda única** es siempre una operación atómica en la base de datos.

## Consecuencias
- ➕ Un cambio en un contrato rompe la compilación de los clientes afectados en lugar de fallar en producción.
- ➕ Los agentes `backend-dev` y `frontend-dev` comparten lenguaje, herramientas y convenciones.
- ➖ Toda la plataforma depende del ecosistema Node.js.
- ➖ La lógica de negocio solo vive en la API: comprar y publicar requieren conexión. El offline de la app se limita a la caché de lectura y a los estados sin conexión (ADR-006).
- Las versiones exactas de cada herramienta se fijarán al instalarlas, consultando `context7`.
