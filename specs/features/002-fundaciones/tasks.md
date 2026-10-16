---
id: 002
diseno: ./diseno.md
estado: pendiente # pendiente | en-curso | completada  (no requiere aprobación humana)
---

# Tareas 002 — Fundaciones de web y API

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecha

- **Orden:** el de los commits de la rama.
- **Un PR por hito:** el siguiente hito parte de `main` con el anterior ya fusionado.
- **Contrato primero:** en cada hito con API, la primera tarea de API define o actualiza el contrato en `packages/contracts`, y web y API dependen de ella, no de la implementación.

---

## Hito 1 — Base y calidad · PR «feat(002): hito 1 — base, calidad, contrato, BD y healthcheck»
| ID | Tarea | Agente | Cubre | Depende de | Estado |
|----|-------|--------|-------|------------|--------|
| T-01 | Arranque del workspace: versiones verificadas, `package.json` `@perchados/*` de `config`, `contracts` y `api-client`, presets compartidos, instalación y lockfile | backend-dev | RF-003, RF-005, RF-006, CA-003, CA-006, CA-007 | 000 | [ ] |
| T-02 | **Contrato v1 base:** `problemSchema`, `PROBLEM_TYPES` (tipos del hito 1), esquemas de health, registro y generación de `openapi/v1.json` | backend-dev | RF-009, RF-010, RF-013, RF-040, CA-012 (estático) | T-01 | [ ] |
| T-03 | `packages/api-client`: generación con `openapi-typescript`, `createApiClient` (`openapi-fetch`) y `contract:check` | frontend-dev | RF-011, RF-012, CA-013 | T-02 | [ ] |
| T-04 | Generar `apps/api` con la CLI de Nest sobre la estructura hexagonal: versionado `/v1`, Vitest + SWC, reglas de capas en ESLint | backend-dev | RF-001, RF-003, RF-005, CB-002 | T-01 | [ ] |
| T-05 | Configuración de la API validada con Zod (`loadConfig`, `AppConfig`) y variables nuevas en `.env.example` | backend-dev | RF-016, CA-021, CB-003, CB-004 | T-04 | [ ] |
| T-06 | Correlación (`X-Correlation-Id`) y logs JSON con `nestjs-pino` + `sanitize()` | backend-dev | RF-014, RF-015, CA-018, CA-019, CA-020, CB-007, CB-008 | T-05 | [ ] |
| T-07 | Errores `problem+json` (`ProblemException`, filtro global, body-parser, 404) + `ZodValidationPipe`/`@ZodBody` + `no-store` | backend-dev | RF-009, RF-013, CA-001 (404), CA-011, CA-016 (404/400/500), CA-017, CB-009, CB-010 | T-02, T-06 | [ ] |
| T-08 | Prisma 7 + `adapter-pg` (conexión perezosa), migración `roles_y_cuentas`, scripts `db:migrate*` y helper `createTestApp` con BD de pruebas | backend-dev | RF-017, RF-018, RF-026 (modelo), CA-022, CA-034 | T-05 | [ ] |
| T-09 | *Runner* de semillas idempotente y transaccional (`db:seed`) | backend-dev | RF-019, CA-023, CA-024 | T-08 | [ ] |
| T-10 | `HealthModule`: `GET /v1/health` público, tiempo máximo de 2 s, caché de 2 s | backend-dev | RF-040, CA-001, CA-050, CA-051 (API), CB-001 | T-02, T-07, T-08 | [ ] |
| T-11 | `DocsModule` condicional (`/v1/openapi.json`, `/v1/docs`) + pruebas de contrato con Ajv + prueba de cobertura de rutas | backend-dev | RF-010, RF-012, CA-012, CA-012b, CA-015 | T-03, T-10 | [ ] |
| T-12 | Generar `apps/web` con `create-next-app` (App Router), configuración de servidor validada en `instrumentation.ts`, ruta `/healthz` | frontend-dev | RF-002, RF-003, RF-005, RF-016, CB-002, CB-003 | T-01 | [ ] |
| T-13 | Clientes API de la web (`server-client`, `browser-client`, `ApiConfigProvider`), regla «sin `fetch` directo» y página inicial provisional con `ApiStatus` | frontend-dev | RF-002, RF-011, CA-014 | T-03, T-12 | [ ] |
| T-14 | **Validar los Dockerfiles y el compose de la 000 con las apps reales:** healthchecks, volumen de `node_modules`, *polling*, `standalone`, etapa `prod` sin root | backend-dev | RF-004, CA-004, CA-005, CA-051 (Docker), CB-002 | T-10, T-13 | [ ] |
| T-15 | CI `.github/workflows/ci.yml`: jobs `calidad`, `seguridad` e `imagenes`; scripts de migraciones inmutables y de excepciones de auditoría | backend-dev | RF-007, RF-008, RF-018, CA-008, CA-009, CA-010, CB-005, CB-006, CB-028, CB-029, CB-030 | T-11, T-14 | [ ] |
| T-16 | Suite de aceptación del hito 1 y PR de demostración de la CI | qa-tester | CA-003, CA-006 a CA-010, CA-016, CB-005, CB-006, CB-028 a CB-030 | T-15 | [ ] |
| T-17 | Skills `api-rest-conventions` y `prisma-datos`, altas en `registro-componentes.md` y comandos para `CLAUDE.md` | backend-dev | NFR Mantenibilidad | T-16 | [ ] |

## Hito 2 — Seguridad · PR «feat(002): hito 2 — hash, sesión, CSRF, roles, límite de peticiones y cabeceras»
⚠️ **Revisión humana obligatoria** (autenticación y permisos).

| ID | Tarea | Agente | Cubre | Depende de | Estado |
|----|-------|--------|-------|------------|--------|
| T-18 | **Contrato auth:** `SessionInfo`, `GET /v1/auth/session`, `POST /v1/auth/logout`, tipos `auth/*` y `rate-limit-exceeded`, `passwordInputSchema` (máximo 128); regenerar el documento y el cliente | backend-dev | RF-021 a RF-025, RF-027, CB-012 | Hito 1 | [ ] |
| T-19 | Puerto `Clock` + `PasswordHasher` con `Argon2idPasswordHasher` (NFC, `verifyDummy`, rehash), validación de los mínimos OWASP en la configuración y `bench:hash` | backend-dev | RF-020, CA-025, CB-011, CB-012 | T-18 | [ ] |
| T-20 | Migración `sesiones` + dominio `Session` + `SessionRepository` + casos de uso `OpenSession`, `ValidateSession` y `RevokeSession` | backend-dev | RF-021, RF-022, RF-023, CA-027, CA-028 (dominio), CB-014, CB-017 | T-19 | [ ] |
| T-21 | `SessionGuard` global (privado por defecto) + `@Public`, `@CurrentSession`, escritor de cookies y endpoints `session` y `logout` | backend-dev | RF-021, RF-022, RF-023, RF-025, CA-016 (401), CA-026 a CA-029, CA-033, CB-013, CB-014, CB-015 | T-20 | [ ] |
| T-22 | `DeactivateAccount` (revoca todas las sesiones en una transacción) + `AccountRepository` | backend-dev | RF-023, RF-026, CA-030, CA-034 (con argon2id), CB-016 | T-21 | [ ] |
| T-23 | `RolesGuard` + `@Roles` contra el rol leído de la BD | backend-dev | RF-025, CA-032 | T-21 | [ ] |
| T-24 | `CsrfGuard` (token sincronizador + `Origin`) y CORS con lista cerrada y credenciales | backend-dev | RF-024, CA-031, CB-018, CB-019 | T-21 | [ ] |
| T-25 | Límite de peticiones: migración `limite_peticiones`, `PostgresThrottlerStorage`, throttlers `global`/`strict`, `@StrictRateLimit`, `TRUST_PROXY`, 429 + `Retry-After` | backend-dev | RF-027, RF-028, CA-035, CA-036, CB-020, CB-021, CB-022 | T-18, T-21 | [ ] |
| T-26 | Cabeceras de seguridad de la API (helmet; CSP relajada solo en `/v1/docs`) + prueba de la lista blanca de rutas públicas | backend-dev | Decisión «cabeceras de seguridad», NFR Seguridad | T-21 | [ ] |
| T-27 | Cabeceras de seguridad y CSP con nonce en la web (`proxy.ts`) | frontend-dev | Decisión «cabeceras de seguridad», NFR Seguridad | Hito 1 | [ ] |
| T-28 | Suite de aceptación del hito 2 (flujos completos de sesión, roles, CSRF y límite) + pruebas de contrato de las rutas auth | qa-tester | CA-025 a CA-036 | T-22 a T-27 | [ ] |
| T-29 | Ampliar la skill `api-rest-conventions` (guards, `@Public`, `@Roles`, CSRF, límites) y `registro-componentes.md` | backend-dev | NFR Mantenibilidad | T-28 | [ ] |

## Hito 3 — Interfaz y E2E · PR «feat(002): hito 3 — tokens, componentes accesibles, catálogo y Playwright»
| ID | Tarea | Agente | Cubre | Depende de | Estado |
|----|-------|--------|-------|------------|--------|
| T-30 | `packages/ui-tokens`: `tokens.ts`, generación de `tokens.css`, pares de contraste + prueba, preset de Stylelint con `declaration-strict-value` | frontend-dev | RF-029, CA-037, CA-038 | Hito 2 | [ ] |
| T-31 | `packages/ui-web` (base: `VisuallyHidden`, `Spinner`, foco global, `vitest-axe`) + fuentes y tokens en `apps/web` (marca en la página inicial) | frontend-dev | RF-029, RF-002, CA-002 | T-30 | [ ] |
| T-32 | Button | frontend-dev | RF-030, RF-036, CA-039, CB-023, CB-025 | T-31 | [ ] |
| T-33 | TextField | frontend-dev | RF-031, RF-036, CA-040, CB-024 | T-31 | [ ] |
| T-34 | PasswordField | frontend-dev | RF-032, RF-036, CA-041, CA-042 | T-33 | [ ] |
| T-35 | Checkbox | frontend-dev | RF-033, RF-036, CA-043 | T-31 | [ ] |
| T-36 | Link | frontend-dev | RF-034, RF-036, CA-044 | T-31 | [ ] |
| T-37 | Alert | frontend-dev | RF-035, RF-036, CA-045 | T-31 | [ ] |
| T-38 | Catálogo `/dev/componentes` con todos los estados, controlado por `WEB_DEV_TOOLS_ENABLED` | frontend-dev | RF-037, CA-047 | T-32 a T-37 | [ ] |
| T-39 | Playwright: configuración, `BasePage`, `HomePage`, fixture `test`, reporter de inestables y prueba de humo | qa-tester | RF-038, RF-039, CA-048, CA-049 (local) | T-31 | [ ] |
| T-40 | E2E de accesibilidad del catálogo: axe por estado, 360 px, zoom del 200 % y `forced-colors` | qa-tester | RF-036, CA-046, CA-047, CB-026, CB-027 | T-38, T-39 | [ ] |
| T-41 | Job `e2e` en la CI (reintento solo en CI, informe como artefacto) + medición de Lighthouse de la página inicial | backend-dev | RF-007, RF-038, CA-049 (CI), NFR Rendimiento | T-39, T-15 | [ ] |
| T-42 | Cierre: `registro-componentes.md` (UI, page objects, fixture), README de `ui-web` y `ui-tokens`, comandos E2E para `CLAUDE.md` | frontend-dev | NFR Mantenibilidad | T-40, T-41 | [ ] |

---

## Detalle

### Hito 1

#### T-01 — Arranque del workspace
- **Archivos previstos:**
  - `packages/config/{package.json, tsconfig/*.json, eslint/*.js, vitest/*.ts}`.
  - `packages/contracts/package.json` y `packages/api-client/package.json` (esqueleto con `tsup`).
  - Los README de `packages/*`, de `@repo/*` a `@perchados/*`.
  - `turbo.json` (tareas `contract:generate`, `db:*` y `test:e2e`) y `package.json` raíz (scripts del diseño).
  - `pnpm-lock.yaml`.
- **Versiones:** consultar Context7 y fijar versiones exactas: TypeScript, ESLint 9 + typescript-eslint, Vitest + `@vitest/coverage-v8`, tsup, Zod 4. Anotar en el PR las que difieran del diseño.
- **Cómo se verifica por sí sola:**
  - `pnpm install --frozen-lockfile` funciona.
  - `pnpm lint`, `pnpm typecheck` y `pnpm test` terminan con 0 sobre los paquetes vacíos.
  - Un error de tipos o de lint de muestra hace fallar el comando con archivo y línea (CA-006).
  - Una cobertura de muestra por debajo del 80 % hace fallar `test` con el paquete y el porcentaje (CA-007).
- **Definición de hecho:** las comunes. El preset de Vitest exige `lines: 80` y documenta las exclusiones.

#### T-02 — Contrato v1 base
- **Archivos previstos:** `packages/contracts/src/{common/problem.ts, common/problem-types.ts, health/health.schemas.ts, v1/registry.ts, index.ts}`, `scripts/generate-openapi.ts` y `openapi/v1.json`.
- **Cómo se verifica por sí sola:**
  - Pruebas unitarias de los esquemas (objetos estrictos; un campo extra se rechaza).
  - `pnpm contract:generate` produce un OpenAPI 3.x válido, con `GET /v1/health` (200 y 503) y el esquema `Problem` (validado con un parser de OpenAPI en la prueba).

#### T-03 — Cliente de API
- **Archivos previstos:** `packages/api-client/src/{generated/v1.ts, client.ts, middleware/correlation.ts}` y el script `contract:check` en la raíz.
- **Cómo se verifica por sí sola:**
  - Prueba unitaria de `createApiClient` con un `fetch` falso.
  - Cambiar un esquema sin regenerar hace fallar `contract:check` con un mensaje claro (CA-013).

#### T-04 — Generar `apps/api`
- **Archivos previstos:** `apps/api/{package.json, nest-cli.json, tsconfig*.json, vitest.config.ts, eslint.config.js, src/main.ts, src/app.module.ts}`. Se respetan `src/modules/*` y `src/shared/` de la 000.
- **Versiones:** NestJS 11 verificado con Context7; la CLI se ejecuta con `pnpm dlx @nestjs/cli new` en una carpeta temporal y se copia lo necesario, sin sobrescribir la estructura.
- **Cómo se verifica por sí sola:**
  - `pnpm dev` arranca la API en `API_PORT`.
  - Una prueba de `no-restricted-imports` falla si `domain/` importa `@nestjs/*` o `infrastructure/`.
  - Con el puerto ocupado, el log nombra el puerto y el proceso sale con código 1 (CB-002).

#### T-05 — Configuración de la API
- **Archivos previstos:** `apps/api/src/shared/config/{env.schema.ts, load-config.ts, config.module.ts}` y `.env.example` (añadir las variables del diseño, conservando las existentes).
- **Cómo se verifica por sí sola:**
  - Pruebas unitarias: falta `DATABASE_URL` (CA-021), URL mal formada (CB-003) y `SESSION_TTL_HOURS` igual a 0, negativo o con texto (CB-004).
  - En todos los casos se sale con código ≠ 0, se nombra la variable y la salida no contiene el valor.
  - `API_DOCS_ENABLED=true` con `APP_ENV=production` se rechaza.

#### T-06 — Correlación y logs
- **Archivos previstos:** `apps/api/src/shared/correlation/correlation-id.middleware.ts` y `apps/api/src/shared/logging/{logger.module.ts, sanitize.ts}`.
- **Cómo se verifica por sí sola:**
  - Pruebas unitarias de `sanitize` (anidado, mayúsculas, `newPassword`, `token`; CB-008) y del validador del id (más de 128 caracteres o caracteres no permitidos; CB-007).
  - Pruebas de integración que capturan stdout: mismo id en la cabecera y en todas las líneas, reutilización del id válido (CA-018), «Perch@ 2026», la cookie y `Authorization` ocultos (CA-019), y `LOG_LEVEL=warn` sin líneas `info` (CA-020).

#### T-07 — Errores y validación
- **Archivos previstos:**
  - `apps/api/src/shared/errors/{problem.exception.ts, problem-details.filter.ts, mappers/*}`.
  - `apps/api/src/shared/validation/{zod-validation.pipe.ts, zod-body.decorator.ts}` y `apps/api/src/shared/http/no-store.interceptor.ts`.
  - `apps/api/test/helpers/test-routes.controller.ts` (ruta con `name` obligatorio y ruta que lanza).
- **Cómo se verifica por sí sola:** pruebas de integración de:
  - `/health` → 404 `problem+json` (CA-001).
  - Cuerpo sin `name` → 400 con `errors[].path = "name"`, sin ejecutar el controlador (CA-011).
  - 500 sin traza, mientras el log `error` sí la contiene (CA-017).
  - JSON inválido → 400 y cuerpo grande → 413 (CB-009).
  - Error del body-parser con `correlationId` (CB-010).
  - Las filas 404, 400 y 500 de CA-016.

#### T-08 — Base de datos
- **Archivos previstos:**
  - `apps/api/{prisma.config.ts, prisma/schema.prisma, prisma/migrations/*_roles_y_cuentas/}`.
  - `apps/api/src/shared/database/{prisma.service.ts, database.module.ts}`.
  - `apps/api/test/helpers/{test-app.factory.ts, db.ts}`.
- **Cómo se verifica por sí sola:**
  - `pnpm db:migrate:deploy` dos veces sobre una BD vacía: la segunda no aplica nada y termina con 0 (CA-022).
  - Una prueba de integración crea una cuenta con el rol `admin`, estado `ACTIVE` y un hash de muestra (CA-034; se repite con argon2id en T-22).
  - La API arranca con PostgreSQL detenido.

#### T-09 — Semilla
- **Archivos previstos:** `apps/api/prisma/seed/{runner.ts, steps/index.ts}`, el script `db:seed` y pruebas con pasos ficticios.
- **Cómo se verifica por sí sola:** pruebas de integración:
  - Dos ejecuciones crean los datos una sola vez y la salida no contiene valores sensibles (CA-023).
  - Si falta la variable, sale con ≠ 0, la nombra y la BD queda sin cambios (CA-024).

#### T-10 — Healthcheck
- **Archivos previstos:** `apps/api/src/modules/health/{application/check-health.use-case.ts, application/ports/database-probe.ts, infrastructure/prisma-database.probe.ts, interface/health.controller.ts}`.
- **Cómo se verifica por sí sola:**
  - Unitarias con un *probe* falso: lento → 503 en ≤ 3 s; caché de 2 s.
  - Integración: 200 con BD (CA-050); 503 sin hosts ni mensajes con un *probe* apuntando a un puerto cerrado (CA-051).
  - Recuperación sin reiniciar (CB-001).

#### T-11 — Documentación OpenAPI y pruebas de contrato
- **Archivos previstos:** `apps/api/src/modules/docs/interface/docs.controller.ts` y `apps/api/test/contract/{contract-matcher.ts, health.contract.test.ts, route-coverage.test.ts}`.
- **Cómo se verifica por sí sola:**
  - Integración: documento válido fuera de producción (CA-012) y 404 con `APP_ENV=production` (CA-012b).
  - Contrato: las respuestas 200 y 503 validan, y un campo extra inyectado hace fallar el matcher (CA-015).
  - Cobertura de rutas: una ruta de Nest sin entrada en el documento → falla.

#### T-12 — Generar `apps/web`
- **Archivos previstos:** `apps/web/{package.json, next.config.ts, tsconfig.json, eslint.config.js, vitest.config.ts}` y `apps/web/src/{instrumentation.ts, shared/config/server-env.ts, app/layout.tsx, app/healthz/route.ts, app/not-found.tsx}`.
- **Versiones:** Next.js y React verificados con Context7; `create-next-app` en una carpeta temporal y se integra respetando `src/{app,features,shared}` de la 000.
- **Cómo se verifica por sí sola:**
  - Unitarias de `server-env` (falta `API_INTERNAL_URL` o URL inválida → mensaje con el nombre, sin el valor).
  - `pnpm dev` arranca la web en `WEB_PORT`; puerto ocupado → error con el puerto (CB-002).

#### T-13 — Clientes de API en la web y página inicial
- **Archivos previstos:** `apps/web/src/shared/api/{server-client.ts, browser-client.ts, api-config-provider.tsx}`, `apps/web/src/features/system-status/ApiStatus.tsx`, `apps/web/src/app/page.tsx` y la regla de ESLint `no-restricted-globals` (`fetch` fuera de `shared/api`).
- **Cómo se verifica por sí sola:**
  - Unitarias de `ApiStatus` (disponible / no disponible) con un cliente falso.
  - Renombrar `status` en el contrato y regenerar hace fallar `typecheck` de la web (CA-014; se demuestra en el PR y se revierte).

#### T-14 — Docker con las apps reales
- **Archivos previstos:** `apps/api/Dockerfile`, `apps/web/Dockerfile` y `docker-compose.yml` (completar los de la 000), `.dockerignore`, y actualizar la skill `docker-dev` si cambia alguna convención.
- **Cómo se verifica por sí sola:**
  - `docker compose --profile apps up -d`: api y web en `healthy`, y un cambio en `apps/api/src` se refleja sin reconstruir (CA-004).
  - Etapa `prod` de cada imagen: `/v1/health` en 200, la web sirve `/` y `whoami` ≠ `root` (CA-005).
  - Al parar `postgres`, `api` pasa a `unhealthy` (CA-051).

#### T-15 — Integración continua
- **Archivos previstos:** `.github/workflows/ci.yml`, `scripts/ci/{check-migrations-immutable.mjs, check-audit-exceptions.mjs}` (cada uno con su prueba unitaria) y `security/audit-exceptions.yaml` (vacío y con un ejemplo comentado del formato).
- **Cómo se verifica por sí sola:**
  - Pruebas unitarias de los dos scripts: migración modificada → falla (CB-005); excepción caducada o de más de 30 días → falla (CB-028).
  - El pipeline se ejecuta en verde en el PR del hito, también si solo cambia `specs/` (CB-030).

#### T-16 — Aceptación del hito 1 (QA)
- **Qué hace:** revisa que cada CA y CB del hito tenga su prueba nombrada con el ID y completa las que falten. Además, ejecuta PR de demostración que se cierran sin fusionar:
  - Error de tipos o de lint (CA-006, CA-008).
  - Secreto de prueba con formato reconocible, incluido uno borrado en un commit posterior (CA-009, CB-029).
  - Dependencia con un aviso alto (CA-010).
  - Migración alterada (CB-005).
  - Dos migraciones en conflicto (CB-006).
- **Cómo se verifica por sí sola:** informe en el PR del hito con el resultado de cada demostración y la matriz CA → prueba.

#### T-17 — Documentación del hito 1
- **Archivos previstos:**
  - Las skills `.claude/skills/api-rest-conventions/SKILL.md` y `.claude/skills/prisma-datos/SKILL.md`, añadidas a `skills:` de `backend-dev`.
  - `specs/02-memoria/registro-componentes.md`.
  - La propuesta de comandos para `CLAUDE.md` la aplica el orquestador.
- **Cómo se verifica por sí sola:** las skills tienen ejemplos ✅/❌; el registro incluye todo lo de «Reutilización» del diseño que ya existe.

### Hito 2

#### T-18 — Contrato auth
- **Archivos previstos:** `packages/contracts/src/auth/{session.schemas.ts}`, `common/password.ts`, `common/problem-types.ts`, `v1/registry.ts`, y `openapi/v1.json` y el cliente regenerados.
- **Cómo se verifica por sí sola:**
  - Unitarias: `passwordInputSchema` acepta emojis y no ASCII, y rechaza más de 128 caracteres (CB-012).
  - `contract:check` en verde.

#### T-19 — Hash de contraseñas
- **Archivos previstos:** `apps/api/src/shared/time/{clock.port.ts, system.clock.ts}`, `apps/api/src/modules/auth/application/ports/password-hasher.ts`, `apps/api/src/modules/auth/infrastructure/argon2id-password-hasher.ts`, ampliación de `env.schema.ts` y el script `bench:hash`.
- **Cómo se verifica por sí sola:** pruebas unitarias de:
  - Dos hashes distintos, sin la contraseña en claro; verificación correcta con «Perch@ 2026» y fallida con «perch@ 2026» (CA-025).
  - Parámetros por debajo del mínimo OWASP → configuración inválida.
  - Emojis y textos largos (CB-012).
  - `verifyDummy` con una duración comparable a `verify`, con tolerancia (CB-011).
  - El resultado del *benchmark* se anota en el PR.

#### T-20 — Sesión: dominio y casos de uso
- **Archivos previstos:** `prisma/migrations/*_sesiones/`, `apps/api/src/modules/auth/{domain/session.ts, application/ports/{session.repository.ts, token-generator.ts}, application/*.use-case.ts, infrastructure/{prisma-session.repository.ts, crypto-token-generator.ts}}`.
- **Cómo se verifica por sí sola:**
  - Unitarias con un `Clock` falso y un repositorio en memoria: 7 h 59 min es válida y 8 h 00 min está caducada (CA-027); con un TTL de 1 minuto, caducada a los 61 s (CA-028).
  - Un nuevo `OpenSession` revoca la sesión previa (CB-014).
  - La caducidad se calcula desde `createdAt` persistido (CB-017).
  - Integración del repositorio contra PostgreSQL.

#### T-21 — Guard de sesión y endpoints
- **Archivos previstos:** `apps/api/src/modules/auth/interface/{guards/session.guard.ts, decorators/{public,current-session}.ts, session-cookie.ts, auth.controller.ts}` y la ruta protegida de prueba.
- **Cómo se verifica por sí sola:** pruebas de integración de:
  - Los atributos de la cookie y que su valor no contenga el id, el rol ni la contraseña (CA-026).
  - Caducidad con un reloj controlado (CA-027, CA-028).
  - Un cierre de sesión deja la copia de la cookie en 401 y elimina las cookies (CA-029).
  - Una ruta sin declarar responde 401 y `/v1/health` sigue siendo pública (CA-033).
  - Una cookie inventada responde 401, nunca 500 (CB-013).
  - El cierre sobre una sesión caducada es idempotente (CB-015).
  - La fila 401 de CA-016.

#### T-22 — Desactivar cuenta
- **Archivos previstos:** `apps/api/src/modules/users/{domain/*, application/{ports/account.repository.ts, deactivate-account.use-case.ts}, infrastructure/prisma-account.repository.ts}`.
- **Cómo se verifica por sí sola:** pruebas de integración de:
  - Dos sesiones que pasan a 401 tras desactivar la cuenta, y `OpenSession` rechazado después (CA-030).
  - Al reactivar, las sesiones antiguas siguen inválidas (CB-016).
  - Una cuenta creada con un hash argon2id (CA-034 completo).

#### T-23 — Guard por rol
- **Archivos previstos:** `apps/api/src/modules/auth/interface/{guards/roles.guard.ts, decorators/roles.ts}`.
- **Cómo se verifica por sí sola:** integración de la tabla de CA-032: sin sesión 401, `buyer` 403, `admin` 200. Cambiar el rol en la BD cambia el resultado sin abrir una sesión nueva.

#### T-24 — CSRF y CORS
- **Archivos previstos:** `apps/api/src/modules/auth/interface/guards/csrf.guard.ts` y `apps/api/src/shared/http/cors.ts`.
- **Cómo se verifica por sí sola:** pruebas de integración de:
  - POST sin token → 403 `problem+json` sin cambios; con token → procesada (CA-031).
  - GET sin token → 200 (CB-018).
  - `Origin` no permitido → 403, y la cabecera CORS ausente (CB-019).

#### T-25 — Límite de peticiones
- **Archivos previstos:** `prisma/migrations/*_limite_peticiones/` y `apps/api/src/shared/rate-limit/{rate-limit.module.ts, postgres-throttler.storage.ts, strict-rate-limit.decorator.ts}`.
- **Cómo se verifica por sí sola:** pruebas de integración con límites reducidos por configuración:
  - N + 1 → 429 con `Retry-After`, y otra IP (`X-Forwarded-For` con `TRUST_PROXY` activo) sigue atendida (CA-035).
  - Con límite propio de 5, la sexta → 429 y las demás rutas siguen disponibles (CA-036).
  - Sin `TRUST_PROXY`, `X-Forwarded-For` se ignora (CB-020).
  - `/v1/health` no consume el límite (CB-021).
  - El contador persiste tras recrear la app (CB-022).

#### T-26 — Cabeceras de seguridad de la API
- **Archivos previstos:** `apps/api/src/shared/http/security-headers.ts` y `apps/api/test/integration/public-routes.test.ts`.
- **Cómo se verifica por sí sola:** pruebas de integración de:
  - CSP `default-src 'none'`, `nosniff`, `Referrer-Policy`, HSTS solo con `production` y sin `X-Powered-By`.
  - La lista de rutas `@Public` coincide con la lista blanca.

#### T-27 — Cabeceras y CSP de la web
- **Archivos previstos:** `apps/web/src/proxy.ts` (o `middleware.ts` según la versión) y su prueba unitaria.
- **Cómo se verifica por sí sola:**
  - Unitaria: nonce distinto por petición; `connect-src` incluye `API_PUBLIC_URL`; `frame-ancestors 'none'`.
  - Manual: la página inicial carga sin violaciones de CSP en la consola (MCP de Playwright).

#### T-28 — Aceptación del hito 2 (QA)
- **Qué hace:**
  - Completa las pruebas de CA-025 a CA-036 nombradas con su ID, más las de contrato de `session` y `logout`.
  - Revisa el cumplimiento de OWASP A01, A02, A05 y A07 con la skill `revision-seguridad` y lo deja anotado para la revisión humana.
- **Cómo se verifica por sí sola:** matriz CA → prueba en el PR, toda en verde.

#### T-29 — Documentación del hito 2
- **Archivos previstos:** `.claude/skills/api-rest-conventions/SKILL.md` (ampliación) y `specs/02-memoria/registro-componentes.md`.

### Hito 3

#### T-30 — Tokens de marca
- **Archivos previstos:** `packages/ui-tokens/{package.json, src/tokens.ts, src/contrast.ts, src/contrast-pairs.ts, scripts/build-css.ts}` y `packages/config/stylelint/`.
- **Cómo se verifica por sí sola:**
  - Unitarias: todos los pares cumplen 4,5:1 (texto) o 3:1 (bordes de control), y un par de muestra «blanco sobre naranja» se detecta como inválido (CA-038).
  - Stylelint falla ante un hex literal en un `.module.css` (CA-037).

#### T-31 — Base de `ui-web` y marca en la web
- **Archivos previstos:** `packages/ui-web/{package.json, vitest.config.ts, src/internal/*, src/styles/focus.css}` y `apps/web/src/app/{layout.tsx, page.tsx, page.module.css}` (`next/font`, `tokens.css`, `transpilePackages`).
- **Cómo se verifica por sí sola:**
  - Prueba de la página inicial: muestra «Perchados» y usa `--font-sans` y `--color-primary` (CA-002).
  - Prueba unitaria de `VisuallyHidden`.

#### T-32 a T-37 — Componentes
- **Archivos previstos:** por componente, `packages/ui-web/src/<Componente>/{<Componente>.tsx, .module.css, .test.tsx, index.ts}`.
- **Cómo se verifica cada uno por sí solo:** pruebas con Testing Library + `user-event` + `vitest-axe` en cada estado (normal, foco, error, deshabilitado y carga, si aplica):
  - **Button (T-32):** en carga, ni el clic, ni Enter, ni Espacio disparan la acción; tiene `aria-busy` y estado anunciado; conserva el nombre (CA-039); `min-height` ≥ 24 px y texto largo sin desbordar (CB-023); `prefers-reduced-motion` (CB-025).
  - **TextField (T-33):** `aria-invalid`, `aria-describedby` con el error, icono `aria-hidden` y la etiqueta que enfoca el campo (CA-040); el tipo exige `label` y una etiqueta vacía lanza error en desarrollo (CB-024).
  - **PasswordField (T-34):** el conmutador cambia el `type` y el nombre, y el foco se mantiene (CA-041); `paste` y `autocomplete` aceptados (CA-042).
  - **Checkbox (T-35):** Espacio y clic en la etiqueta cambian el estado (CA-043).
  - **Link (T-36):** `newTab` añade el texto oculto y `rel` (CA-044).
  - **Alert (T-37):** el rol según la variante y el prefijo de texto oculto (CA-045).

#### T-38 — Catálogo
- **Archivos previstos:** `apps/web/src/app/dev/componentes/page.tsx` y la ampliación de `server-env.ts` (`WEB_DEV_TOOLS_ENABLED`).
- **Cómo se verifica por sí sola:**
  - Unitaria: con el *flag* en `false`, se llama a `notFound()`.
  - Configuración: `true` + `production` se rechaza.
  - Manual: todos los estados son visibles (CA-047).

#### T-39 — Base de Playwright
- **Archivos previstos:** `apps/web/playwright.config.ts` y `apps/web/e2e/{pages/{BasePage.ts, HomePage.ts, ComponentCatalogPage.ts}, fixtures/test.ts, reporters/flaky-summary.ts, tests/smoke.spec.ts}`.
- **Cómo se verifica por sí sola:**
  - `pnpm test:e2e` en local: la prueba «CA-048 …» abre la página inicial con `HomePage` y `data-testid`, y el informe HTML la muestra con su ID.
  - En local no hay reintentos; una prueba de muestra inestable, activada por variable, aparece como «inestable» con `CI=1` (CA-049).

#### T-40 — Accesibilidad E2E del catálogo
- **Archivos previstos:** `apps/web/e2e/tests/catalog-a11y.spec.ts`.
- **Cómo se verifica por sí sola:**
  - axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) sin violaciones en cada estado, incluido el contraste (CA-046).
  - Catálogo en 404 con el *flag* en `false` (CA-047).
  - Zoom del 200 % / 360 px sin solapes, comprobado con aserciones de cajas (CB-026).
  - Bordes y foco visibles con `forcedColors: 'active'` (CB-027).

#### T-41 — E2E en la CI
- **Archivos previstos:** `.github/workflows/ci.yml` (job `e2e`).
- **Cómo se verifica por sí sola:** el job en verde en el PR, con el informe como artefacto y como máximo 1 reintento (CA-049). La medición de Lighthouse de `/` con perfil móvil (LCP, CLS, JS inicial) se anota en el PR.

#### T-42 — Cierre del hito 3
- **Archivos previstos:** `specs/02-memoria/registro-componentes.md` (los 6 componentes, `BasePage`, `HomePage`, `ComponentCatalogPage` y el fixture `test`), los README de `packages/ui-web` y `packages/ui-tokens`, y la propuesta de comandos E2E para `CLAUDE.md`.

---

## Definición de hecho (común a todas las tareas)
- [ ] Cumple los CA y CB que cubre, con pruebas nombradas con su ID (`CA-0xx`/`CB-0xx`).
- [ ] Pruebas escritas junto al código y en verde; cobertura ≥ 80 % de líneas en el paquete tocado.
- [ ] `pnpm lint` y `pnpm typecheck` sin errores.
- [ ] Sin secretos, sin `any`/`@ts-ignore` injustificados y sin `TODO` sin tarea.
- [ ] Los componentes reutilizables nuevos se registran en `specs/02-memoria/registro-componentes.md`.
- [ ] Las dependencias nuevas tienen la versión verificada con Context7 y anotada en el PR.

## Trazabilidad (comprobación de cobertura)
- **RF:** RF-001…RF-040, todos cubiertos. RF-026 en T-08 y T-22; RF-036 en T-32 a T-37 y T-40.
- **CB:** CB-001…CB-030, todos cubiertos.
  - Hito 1: CB-001 a CB-010 y CB-028 a CB-030.
  - Hito 2: CB-011 a CB-022.
  - Hito 3: CB-023 a CB-027.
- **CA:** CA-001…CA-051, incluido CA-012b, todos asignados. CA-016 se reparte entre T-07 (404/400/500) y T-21 (401). CA-034 se cubre en T-08 y se completa en T-22. CA-051 se reparte entre T-10 (API) y T-14 (Docker).
