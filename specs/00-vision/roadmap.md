---
estado: borrador
---

# Roadmap de entrega

Estrategia (ADR-010, 15-10-2026): el proyecto tiene **una sola funcionalidad**, la 001. La base técnica que necesita ya no es una capa horizontal separada: forma parte del diseño y de las tareas de la 001, recortada a lo que el login y la Definition of Done requieren. Ver la skill `estrategia-entrega`.

## Funcionalidad 001 — Login de administrador: **cumplida** (2026-10-18)
Verificación: APROBADO CON OBSERVACIONES, sin bloqueantes. Cierre aprobado por el dueño con las observaciones de abajo.

| Hito | Contenido | Estado |
|------|-----------|--------|
| 0 — Base existente | Estructura del monorepo, Docker Compose (postgres, storage, mailpit), Dockerfiles, `.env.example`, skills de convenciones | hecho |
| 1 — Base y calidad | Workspace con Turborepo, apps NestJS y Next.js, contrato Zod → OpenAPI `/v1` → cliente, `problem+json`, logs JSON con correlación, configuración validada, Prisma y migraciones, semilla, healthcheck, Docker con las apps y CI | hecho |
| 2 — Autenticación (API) | Hash argon2id, sesión en servidor, guards por rol y CSRF, límite de peticiones, bloqueo tras 5 fallos, `POST /v1/auth/login` y `HaroldAdmin` | hecho |
| 3 — Interfaz web | Tokens de marca, componentes accesibles del login, pantalla de login y panel «Próximamente» | hecho |
| 4 — E2E y cierre | Playwright por escenario Gherkin, accesibilidad, job E2E en CI y registro de componentes | hecho |
| 5 — Correcciones de la etapa 6 | IP del cliente web → API (RT-022, ADR-011) y lint de `@perchados/contracts/client` (ADR-012) | hecho |

## Siguiente paso
**Pendiente de visión de producto.** No hay funcionalidad activa. Cuando el dueño defina la siguiente idea, se empieza con `/explorar <idea>`. La tabla de abajo recoge candidatas, sin orden aprobado.

## Seguimiento de la 001
No son tareas de otra spec. Se atienden junto a la siguiente funcionalidad que toque el área, o como rebanada propia si el dueño lo pide.

| Pri. | Pendiente | Dónde |
|------|-----------|-------|
| 🟡 | `TRUST_PROXY=0` pasa la regla de producción (equivale a `false`) | `apps/api/src/shared/config/env.schema.ts` |
| 🟡 | Falta prueba con IPv4 mapeada (`::ffff:a.b.c.d`); posible contador único en `::/64` | `apps/api/src/shared/rate-limit/client-ip.ts` |
| 🟡 | El serializador `req` de los logs registra IP (`remoteAddress`, `x-forwarded-for`, `x-perchados-client-ip`) y user-agent. Recomendación: lista blanca `id`/`method`/`url` sin query. Decisión de diseño RT-006 pendiente del dueño | `apps/api/src/shared/logging/logger.module.ts` |
| 🟡 | Hook `useLoginForm` de ~70 líneas y comentario inexacto sobre el timeout | `apps/web/src/features/auth-login/use-login-form.ts` |
| 🔵 | Literal `'auth/account-locked'` duplicado: usar `PROBLEM_TYPES.accountLocked` | apps/api y packages/contracts |
| 🔵 | `;` suelto en el archivo de problemas (`pnpm format`) | `packages/contracts/src/common/problem.ts` |
| 🔵 | `requireAdminSession` hace dos llamadas a `/v1/auth/session` por carga (valorar `cache()` de React) | `apps/web/src/shared/auth/require-admin-session.ts` |
| 🔵 | RT-007 y RT-018: añadir el ID a los nombres de las pruebas | pruebas de la 001 |
| 🔵 | RT-015: falta prueba web de CSP con nonce | `apps/web` |
| Dep. | Aviso moderado GHSA-rgwj-5xj2-c3m3 en `mysql2` ≤ 3.23.0 (transitivo de Prisma). Subir el override de 3.22.0 a 3.23.1 con el script de candado | `package.json` (override) |
| Manual | Lighthouse en móvil; verificación de T-14 (Docker en modo dev) | — |
| Config | `.env` necesita `INTERNAL_API_SECRET` (≥ 32) y `WEB_TRUST_PROXY_HOPS` | `.env` local |
| Proceso | Mejoras de la retrospectiva: pendientes de decisión del dueño | `specs/02-memoria/retrospectiva-001-proceso.md` |

## Pendiente para funcionalidades futuras (fuera de la 001)
| Tema | Estado |
|------|--------|
| Alertas por fallos sostenidos | propuesta |
| Design system mobile | propuesta |
| Framework E2E completo: factories por dominio, flujos Maestro (móvil), regresión visual | propuesta |
| Resiliencia de integraciones: cliente HTTP con timeouts, reintentos con backoff, idempotencia | propuesta |
| Móvil: conectividad, caché de lectura persistida y permisos en contexto | propuesta |
| Almacenamiento de imágenes (puerto S3) | propuesta |
| Pasarela de pagos: puerto + adaptadores fake y Mercado Pago (ADR-002) | propuesta |

> Cuando llegue una funcionalidad nueva, su diseño reutiliza la base de la 001 y, si necesita infraestructura nueva, la incluye como requisitos técnicos (ADR-010).
