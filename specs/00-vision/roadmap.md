---
estado: borrador
---

# Roadmap de entrega

Estrategia (ADR-010, 15-10-2026): el proyecto tiene **una sola funcionalidad**, la 001. La base técnica que necesita ya no es una capa horizontal separada: forma parte del diseño y de las tareas de la 001, recortada a lo que el login y la Definition of Done requieren. Ver la skill `estrategia-entrega`.

## Funcionalidad única: 001 — Login de administrador
| Hito | Contenido | Estado |
|------|-----------|--------|
| 0 — Base existente | Estructura del monorepo, Docker Compose (postgres, storage, mailpit), Dockerfiles, `.env.example`, skills de convenciones | hecho |
| 1 — Base y calidad | Workspace con Turborepo instalado, apps NestJS y Next.js, contrato Zod → OpenAPI `/v1` → cliente, `problem+json`, logs JSON con correlación, configuración validada, Prisma y migraciones, semilla, healthcheck, Docker con las apps y CI | en diseño |
| 2 — Autenticación (API) | Hash argon2id, sesión en servidor, guards por rol y CSRF, límite de peticiones, bloqueo tras 5 fallos, `POST /v1/auth/login` y `HaroldAdmin` | en diseño |
| 3 — Interfaz web | Tokens de marca, componentes accesibles del login, pantalla de login y panel «Próximamente» | en diseño |
| 4 — E2E y cierre | Playwright por escenario Gherkin, accesibilidad, job E2E en CI y registro de componentes | en diseño |

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
