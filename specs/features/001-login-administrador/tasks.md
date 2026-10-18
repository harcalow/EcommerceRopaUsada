---[x] |[x] |[x] |
id: 001
diseno: ./diseno.md
estado: pendiente # pendiente | en-curso | completada  (no requiere aprobación humana)
---

# Tareas 001 — Login de administrador (incluye la base técnica)

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecha

- **Orden:** el de los commits de la rama `feature/001-login-administrador`.
- **Un PR por hito:** el siguiente hito parte de `main` con el anterior fusionado.
- **Contrato primero:** en cada hito con API, la primera tarea define o actualiza el contrato en `packages/contracts`; la web y la API dependen de ella, no de la implementación.
- **Cubre:** `RF`, `CA` y `CB` de [`spec.md`](spec.md); `RT` de [`diseno.md`](diseno.md#requisitos-técnicos-de-base-rt-xxx).
- **Agentes:** `backend-dev` (API, paquetes no visuales, CI, Docker) y `frontend-dev` (web, UI, E2E). `qa-tester` y `revisor` intervienen en la etapa 6 (`/verificar`).

---

## Hito 0 — Base existente (hecha; antes en la 000)
| ID | Tarea | Agente | Cubre | Depende de | Estado |
|----|-------|--------|-------|------------|--------|
| B-01 | Archivos raíz del monorepo (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.editorconfig`, `.gitignore`) | backend-dev | RT-001 (estructura) | — | [x] |
| B-02 | Estructura hexagonal de `apps/api` (módulos y `shared/`) + skill `nestjs-hexagonal` | backend-dev | RT-002 (capas) | B-01 | [x] |
| B-03 | Estructura de `apps/web` (`src/{app,features,shared}`) + skill `nextjs-app-router` | frontend-dev | — | B-01 | [x] |
| B-04 | Estructura de `apps/mobile` + skill `expo-router-mvvm` (no se usa en esta funcionalidad) | frontend-dev | — | B-01 | [x] |
| B-05 | `packages/{contracts,api-client,ui-tokens,config}` con README de propósito | backend-dev | RT-004 (estructura) | B-01 | [x] |
| B-06 | Docker: `docker-compose.yml` (postgres, storage, mailpit; perfil `apps`), Dockerfiles multi-stage, `.dockerignore`, `docker/postgres/init/`, `.env.example` + skill `docker-dev` | backend-dev | RT-017 (infraestructura) | B-02, B-03 | [x] |
| B-07 | `CLAUDE.md` raíz con estructura, skills y comandos | orquestador | — | B-01…B-06 | [x] |

No se rehacen. Las tareas siguientes las **completan** (dependencias, apps reales, healthchecks).

---

## Hito 1 — Base y calidad · PR «feat(001): hito 1 — workspace, apps, contrato, errores, BD y CI»
| ID | Tarea | Agente | Cubre | Depende de | Estado |
|----|-------|--------|-------|------------|--------|
| T-01 | **Arranque del workspace:** versiones verificadas, `turbo` y `typescript` como `devDependencies` raíz, `package.json` `@perchados/*` de `config`, `contracts` y `api-client`, presets compartidos (tsconfig, ESLint, Vitest), scripts raíz, instalación y `pnpm-lock.yaml` | backend-dev | RT-001, RT-002, RT-003 | Hito 0 | [x] |
| T-02 | **Contrato v1 base:** `problemSchema`, `PROBLEM_TYPES` (tipos del hito 1), esquemas de health, registro y generación de `openapi/v1.json` | backend-dev | RT-004, RT-005, RT-016 | T-01 | [x] |
| T-03 | `packages/api-client`: generación con `openapi-typescript`, `createApiClient` (`openapi-fetch`), middleware de correlación y `contract:check` | frontend-dev | RT-004 | T-02 | [x] |
| T-04 | Generar `apps/api` (NestJS) sobre la estructura hexagonal: versionado `/v1`, Vitest + SWC, reglas de capas en ESLint, puerto configurable | backend-dev | RT-001, RT-002, RT-005 | T-01 | [x] |
| T-05 | Configuración de la API validada con Zod (`loadConfig`, `AppConfig`) y variables nuevas en `.env.example` | backend-dev | RT-007 | T-04 | [x] |
| T-06 | Correlación (`X-Correlation-Id`) y logs JSON con `nestjs-pino` + `sanitize()` | backend-dev | RT-006, RNF Seguridad | T-05 | [x] |
| T-07 | Errores `problem+json` (`ProblemException`, filtro global, body-parser, 404 fuera de `/v1`) + `ZodValidationPipe`/`@ZodBody` + `no-store` | backend-dev | RT-005 | T-02, T-06 | [x] |
| T-08 | Prisma 7 + `adapter-pg` (conexión perezosa), migración `roles_y_cuentas` (con `username`, `username_key`, `failed_attempts`, `locked_until` y el rol `admin`), scripts `db:migrate*` y `createTestApp` con BD de pruebas | backend-dev | RT-008, RF-018 (modelo), RF-019 (rol), RF-023 (modelo), CB-002 (clave) | T-05 | [x] |
| T-09 | *Runner* de semillas idempotente y transaccional (`db:seed`), sin pasos de producción todavía | backend-dev | RT-009 | T-08 | [x] |
| T-10 | `HealthModule`: `GET /v1/health` público, tiempo máximo de 2 s y caché de 2 s | backend-dev | RT-016 | T-02, T-07, T-08 | [x] |
| T-11 | Pruebas de contrato con Ajv contra `v1.json` + prueba de cobertura de rutas | backend-dev | RT-004 | T-03, T-10 | [x] |
| T-12 | Generar `apps/web` (Next.js App Router): configuración de servidor validada en `instrumentation.ts` (incluye `ADMIN_CONTACT_EMAIL`), ruta `/healthz`, `not-found` | frontend-dev | RT-001, RT-002, RT-007 | T-01 | [x] |
| T-13 | Clientes de API de la web (`server-client`, `browser-client`, `ApiConfigProvider`) y regla de ESLint «sin `fetch` directo a la API» | frontend-dev | RT-004 | T-03, T-12 | [x] |
| T-14 | **Docker con las apps reales:** healthchecks, `depends_on`, volumen de `node_modules`, *polling*, `standalone`, etapa `prod` sin root | backend-dev | RT-016, RT-017 | T-10, T-13 | [x] |
| T-15 | CI `.github/workflows/ci.yml`: jobs `calidad` y `seguridad` + script de migraciones inmutables | backend-dev | RT-008, RT-020 | T-11, T-14 | [x] |

## Hito 2 — Autenticación (API) · PR «feat(001): hito 2 — contrato auth, hash, sesión, guards, límites y login»
⚠️ **Revisión humana obligatoria** (autenticación, permisos y datos de cuentas).

| ID | Tarea | Agente | Cubre | Depende de | Estado |
|----|-------|--------|-------|------------|--------|
| T-16 | **Contrato auth:** `usernameSchema`, `loginPasswordSchema`/`passwordInputSchema`, `LoginRequest`, `SessionInfo`, rutas `login`, `session` y `logout`, tipos `auth/*`, `rate-limit-exceeded` y `auth/account-locked`; regenerar documento y cliente | backend-dev | RF-001, RF-003, RF-015, RF-016, CA-002, CA-014, CA-015, CB-001, CB-014, CB-015, CB-016 | Hito 1 | [x] |
| T-17 | Puerto `Clock` + `PasswordHasher` con `Argon2idPasswordHasher` (NFC, `verifyDummy`, rehash), mínimos OWASP en la configuración y `bench:hash` | backend-dev | RF-018, RT-010, RT-021 | T-16 | [x] |
| T-18 | Paso de semilla `admin-inicial` (`HaroldAdmin` con rol `admin` desde `ADMIN_INITIAL_PASSWORD`) | backend-dev | RF-018, RF-019, CA-017 | T-09, T-17 | [x] |
| T-19 | Migración `sesiones` + dominio `Session` + `SessionRepository` + casos de uso `OpenSession`, `ValidateSession` (incluye `account.status`) y `RevokeSession` | backend-dev | RF-020, RT-011, CA-018 (dominio), CB-012 (dominio) | T-17 | [x] |
| T-20 | `SessionGuard` global (privado por defecto) + `@Public`, `@CurrentSession`, escritor de cookies y endpoints `GET /v1/auth/session` y `POST /v1/auth/logout` | backend-dev | RF-011, RF-012, RF-020, RT-011, RT-013, CA-011 (API), CA-018, CB-012, CB-017, CB-018 | T-19 | [x] |
| T-21 | `RolesGuard` + `@Roles` contra el rol leído de la BD | backend-dev | RF-023, RT-013 | T-20 | [x] |
| T-22 | `CsrfGuard` (token sincronizador + `Origin`) y CORS con lista cerrada y credenciales | backend-dev | RT-012 | T-20 | [x] |
| T-23 | Límite de peticiones: migración `limite_peticiones_y_bloqueo` (`rate_limit_counter`, `login_attempt_unknown`), `PostgresThrottlerStorage`, throttlers `global`/`strict`, `@StrictRateLimit`, `TRUST_PROXY`, 429 + `Retry-After` | backend-dev | RT-014 | T-16, T-20 | [x] |
| T-24 | **Dominio del bloqueo y repositorios:** `LoginLock` (5 fallos → 30 min, vencimiento, contador nuevo), incremento atómico en `account`, imitación en `login_attempt_unknown` | backend-dev | RF-008, RF-009, RF-017, CA-007, CA-008, CA-016, CB-004, CB-005, CB-006, CB-013 | T-23 | [x] |
| T-25 | **Caso de uso `LogIn` y `POST /v1/auth/login`:** búsqueda por `username_key`, `verifyDummy`, rol `admin`, apertura de sesión, `@StrictRateLimit`, eventos de auditoría | backend-dev | RF-001, RF-004, RF-008, RF-009, RF-017, RF-023, CA-001, CA-003, CA-007, CA-008, CA-016, CA-017, CA-019, CB-001 a CB-006, CB-012, CB-013, RT-021 | T-18, T-21, T-22, T-24 | [x] |
| T-26 | Cabeceras de seguridad de la API (helmet) + prueba de la lista blanca de rutas públicas + pruebas de contrato de las rutas auth | backend-dev | RT-004, RT-013, RT-015 | T-25 | [x] |

## Hito 3 — Interfaz web · PR «feat(001): hito 3 — tokens, componentes, pantalla de login y panel»
| ID | Tarea | Agente | Cubre | Depende de | Estado |
|----|-------|--------|-------|------------|--------|
| T-27 | `packages/ui-tokens`: `tokens.ts`, generación de `tokens.css`, pares de contraste + prueba, preset de Stylelint con `declaration-strict-value` | frontend-dev | RT-018, RNF Accesibilidad (contraste) | Hito 1 | [x] |
| T-28 | `packages/ui-web` base (`VisuallyHidden`, `Spinner`, foco global, `vitest-axe`) + fuentes y `tokens.css` en `apps/web/src/app/layout.tsx` | frontend-dev | RT-018 | T-27 | [x] |
| T-29 | Button | frontend-dev | RF-014, RT-018, CA-013 (componente) | T-28 | [x] |
| T-30 | TextField | frontend-dev | RF-003, RT-018, CA-002 (componente) | T-28 | [x] |
| T-31 | PasswordField (con `notice`) | frontend-dev | RF-005, RF-006, RT-018, CA-004, CB-008 | T-30 | [x] |
| T-32 | Link | frontend-dev | RF-007, RT-018 | T-28 | [x] |
| T-33 | Alert | frontend-dev | RF-004, RF-008, RF-020, RT-018 | T-28 | [x] |
| T-34 | Cabeceras y CSP con nonce en la web (`proxy.ts`), `no-store` y redirección optimista de `/panel/**` sin cookie | frontend-dev | RF-011, RT-015 | Hito 1 | [x] |
| T-35 | Pantalla `/login`: maquetación según el mockup (panel de marca, encabezado, pie informativo), responsive, sin registro ni credenciales de prueba; redirección al panel con sesión válida | frontend-dev | RF-010, RF-021, RF-022, CA-009, CB-011, RNF Responsive | T-29 a T-33, T-16 | [x] |
| T-36 | `LoginForm`: validación con los esquemas del contrato, errores por campo, Bloq Mayús, envío con el cliente, estados de carga, error genérico, bloqueo, sin conexión, 429 y 5xx | frontend-dev | RF-001, RF-003, RF-004, RF-006, RF-008, RF-014, RF-015, RF-016, CA-002, CA-003, CA-005, CA-007, CA-013, CA-014, CA-015, CB-001, CB-007, CB-008, CB-009 | T-35 | [x] |
| T-37 | «¿Olvidaste tu contraseña?»: desplegable con el correo del responsable (`ADMIN_CONTACT_EMAIL`) y enlace `mailto:` | frontend-dev | RF-007, CA-006 | T-35 | [x] |
| T-38 | Panel `/panel`: `requireAdminSession()` (layout y página), «Próximamente, estamos trabajando», `LogoutButton`, `SessionWatcher`, aviso de sesión caducada en `/login`, `/` → `/panel` | frontend-dev | RF-002, RF-011, RF-012, RF-020, CA-001, CA-010, CA-011, CA-018, CB-012, CB-017, CB-018 | T-34, T-36 | [x] |

## Hito 4 — E2E y cierre · PR «feat(001): hito 4 — E2E del login, accesibilidad y CI»
| ID | Tarea | Agente | Cubre | Depende de | Estado |
|----|-------|--------|-------|------------|--------|
| T-39 | Playwright: configuración, `BasePage`, `LoginPage`, `PanelPage`, fixture `test` con `accounts` y acceso a la BD de pruebas, reporter de inestables, script `test:e2e` | frontend-dev | RT-019 | Hito 3 | [x] |
| T-40 | E2E del login: un test por escenario (`CA-001` a `CA-019`) y por CB de interfaz (`CB-001`, `CB-002`, `CB-007`, `CB-011`, `CB-017`, `CB-018`) | frontend-dev | Todos los CA; CB citados; RT-019 | T-39 | [x] |
| T-41 | E2E de accesibilidad y responsive: axe en cada estado de `/login` y en `/panel`, 360 px, zoom del 200 %, `forcedColors`; medición de Lighthouse de `/login` anotada en el PR | frontend-dev | RNF Accesibilidad, RNF Responsive, RT-018, RT-021 | T-39 | [x] |
| T-42 | Job `e2e` en la CI (máximo 1 reintento solo en CI, informe como artefacto) | backend-dev | RT-019, RT-020 | T-40, T-41, T-15 | [x] |
| T-43 | Cierre: `registro-componentes.md`, skills `api-rest-conventions` y `prisma-datos`, README de `ui-tokens` y `ui-web`, propuesta de comandos para `CLAUDE.md` | backend-dev | DoD (componentes registrados) | T-42 | [x] |

## Hito 5 — Correcciones de la revisión de la etapa 6 · PR «fix(001): hito 5 — IP del cliente web → API (RT-022) y lint de `contracts/client` (ADR-012)»
⚠️ **Revisión humana obligatoria** (límite de peticiones de auth, secreto interno web → API y sesión del panel).

Sin tarea de contrato: las cabeceras internas `X-Perchados-Internal-Token` y `X-Perchados-Client-Ip` no forman parte del contrato público ni de OpenAPI (RT-022 f); `contract:check` no debe cambiar.

| ID | Tarea | Agente | Cubre | Depende de | Estado |
|----|-------|--------|-------|------------|--------|
| T-44 | **Entorno:** `INTERNAL_API_SECRET` y `WEB_TRUST_PROXY_HOPS` en `.env.example`, `docker-compose.yml` (a `api` y `web`; el secreto con `${INTERNAL_API_SECRET:?…}`) y la CI (secreto generado por ejecución) | backend-dev | RT-022, RT-017, RT-020 | Hito 4 | [x] |
| T-45 | **Configuración y logs de la API:** `INTERNAL_API_SECRET` (obligatoria, ≥ 32) y `production` + `TRUST_PROXY=false` → inválida en `env.schema.ts`; `X-Perchados-Internal-Token` oculto en los logs; `createTestApp` con secreto de prueba | backend-dev | RT-022 (e, f), RT-007, RT-006 | T-44 | [x] |
| T-46 | **IP del límite en la API:** `resolveTrackerIp` (`timingSafeEqual` sobre SHA-256, `net.isIP`, agrupación IPv6 /64) y `RateLimitGuard.getTracker()`; integración de RT-022 | backend-dev | RT-022 (c, d), RT-014 | T-45 | [x] |
| T-47 | **Configuración del servidor web:** `INTERNAL_API_SECRET` (obligatoria, ≥ 32) y `WEB_TRUST_PROXY_HOPS` (entero ≥ 0, por defecto `0`; `production` + `0` → inválida) en `server-env.ts` | frontend-dev | RT-022 (e), RT-007 | T-44 | [x] |
| T-48 | **`resolveClientIp`** en `apps/web/src/shared/api/client-ip.ts` (`server-only`): entrada `n`-ésima por la derecha de `X-Forwarded-For` | frontend-dev | RT-022 (a) | T-47 | [x] |
| T-49 | **`createServerApiClient`:** deja de reenviar `X-Forwarded-For`; envía siempre `X-Perchados-Internal-Token` y `X-Perchados-Client-Ip` solo con IP resuelta | frontend-dev | RT-022 (a, b), RT-014 | T-46, T-48 | [x] |
| T-50 | **Lint de ADR-012:** `no-restricted-imports` en `apps/web/eslint.config.mjs` para `apps/web/src/**`, que solo permite `@perchados/contracts/client` | frontend-dev | RT-004 (excepción ADR-012), RT-021 | Hito 4 | [x] |

---

## Detalle

### Hito 1

#### T-01 — Arranque del workspace
- **Contexto:** hoy `pnpm test` falla con «turbo not found»: el `package.json` raíz no tiene dependencias ni existe lockfile.
- **Archivos previstos:**
  - `package.json` raíz: `devDependencies` `turbo`, `typescript`, `@perchados/config` (`workspace:*`); scripts `db:migrate`, `db:migrate:deploy`, `db:seed`, `contract:generate`, `contract:check`, `test:e2e`.
  - `turbo.json`: tareas `contract:generate` (con `outputs`), `contract:check`, `db:*` y `test:e2e` (sin caché).
  - `tsconfig.base.json`: `noUncheckedIndexedAccess` y banderas estrictas.
  - `packages/config/{package.json, tsconfig/*.json, eslint/*.js, vitest/*.ts}`.
  - `packages/contracts/package.json` y `packages/api-client/package.json` (esqueleto con `tsup`).
  - README de `packages/*`: de `@repo/*` a `@perchados/*`, y «Capa 002 (fundaciones)» / «Capa 001/002» → «001 (base técnica)».
  - `pnpm-lock.yaml`.
- **Versiones:** consultar Context7 y fijar versiones exactas de TypeScript, Turborepo, ESLint 9 + typescript-eslint, Vitest + `@vitest/coverage-v8`, tsup y Zod 4. Anotar en el PR las que difieran del diseño.
- **Cómo se verifica por sí sola:**
  - `pnpm install --frozen-lockfile` funciona.
  - `pnpm lint`, `pnpm typecheck` y `pnpm test` terminan con 0 sobre los paquetes vacíos (ya no aparece «turbo not found»).
  - Un error de tipos o de lint de muestra hace fallar el comando con archivo y línea.
  - Una cobertura de muestra por debajo del 80 % hace fallar `test` con el paquete y el porcentaje.

#### T-02 — Contrato v1 base
- **Archivos previstos:** `packages/contracts/src/{common/problem.ts, common/problem-types.ts, health/health.schemas.ts, v1/registry.ts, index.ts}`, `scripts/generate-openapi.ts` y `openapi/v1.json`.
- **Cómo se verifica por sí sola:**
  - Unitarias de los esquemas (objetos estrictos; un campo extra se rechaza).
  - `pnpm contract:generate` produce un OpenAPI 3.x válido con `GET /v1/health` (200 y 503) y el esquema `Problem`.

#### T-03 — Cliente de API
- **Archivos previstos:** `packages/api-client/src/{generated/v1.ts, client.ts, middleware/correlation.ts}` y el script `contract:check`.
- **Cómo se verifica por sí sola:**
  - Unitaria de `createApiClient` con un `fetch` falso.
  - Cambiar un esquema sin regenerar hace fallar `contract:check` con un mensaje claro.

#### T-04 — Generar `apps/api`
- **Archivos previstos:** `apps/api/{package.json, nest-cli.json, tsconfig*.json, vitest.config.ts, eslint.config.js, src/main.ts, src/app.module.ts}`. Se respetan `src/modules/*` y `src/shared/`.
- **Versiones:** NestJS 11 con Context7; la CLI se ejecuta en una carpeta temporal y se copia lo necesario sin sobrescribir la estructura.
- **Cómo se verifica por sí sola:**
  - `pnpm dev` arranca la API en `API_PORT`.
  - Una prueba de `no-restricted-imports` falla si `domain/` importa `@nestjs/*` o `infrastructure/`.
  - Con el puerto ocupado, el log nombra el puerto y el proceso sale con código 1.

#### T-05 — Configuración de la API
- **Archivos previstos:** `apps/api/src/shared/config/{env.schema.ts, load-config.ts, config.module.ts}` y `.env.example` (añadir las variables del diseño, conservando las existentes; los comentarios «spec 002» / «specs 001 y 002» pasan a «spec 001»).
- **Cómo se verifica por sí sola:** unitarias: falta `DATABASE_URL`, URL mal formada, `SESSION_TTL_HOURS` igual a 0, negativo o con texto, `CORS_ALLOWED_ORIGINS` ausente. En todos los casos sale con ≠ 0, nombra la variable y la salida no contiene el valor.

#### T-06 — Correlación y logs
- **Archivos previstos:** `apps/api/src/shared/correlation/correlation-id.middleware.ts` y `apps/api/src/shared/logging/{logger.module.ts, sanitize.ts}`.
- **Cómo se verifica por sí sola:**
  - Unitarias de `sanitize` (anidado, mayúsculas, `newPassword`, `token`) y del validador del id (más de 128 caracteres o caracteres no permitidos → id nuevo).
  - Integración capturando stdout: mismo id en la cabecera y en todas las líneas; reutilización del id válido; contraseña de prueba, cookie y `Authorization` ocultos; `LOG_LEVEL=warn` sin líneas `info`.

#### T-07 — Errores y validación
- **Archivos previstos:** `apps/api/src/shared/errors/{problem.exception.ts, problem-details.filter.ts, mappers/*}`, `apps/api/src/shared/validation/{zod-validation.pipe.ts, zod-body.decorator.ts}`, `apps/api/src/shared/http/no-store.interceptor.ts` y `apps/api/test/helpers/test-routes.controller.ts`.
- **Cómo se verifica por sí sola:** integración: `/health` → 404 `problem+json`; cuerpo sin `name` → 400 con `errors[].path = "name"` sin ejecutar el controlador; 500 sin traza (el log `error` sí la tiene); JSON inválido → 400; cuerpo grande → 413; error del body-parser con `correlationId`.

#### T-08 — Base de datos
- **Archivos previstos:** `apps/api/{prisma.config.ts, prisma/schema.prisma, prisma/migrations/*_roles_y_cuentas/}`, `apps/api/src/shared/database/{prisma.service.ts, database.module.ts}` y `apps/api/test/helpers/{test-app.factory.ts, db.ts}`.
- **Cómo se verifica por sí sola:**
  - `pnpm db:migrate:deploy` dos veces sobre BD vacía: la segunda no aplica nada y termina con 0.
  - Integración: existe el rol `admin`/«administrador»; dos cuentas con `username_key` iguales violan la unicidad; una cuenta se crea con estado `ACTIVE`, `failed_attempts = 0` y solo un hash.
  - La API arranca con PostgreSQL detenido.

#### T-09 — Semilla
- **Archivos previstos:** `apps/api/prisma/seed/{runner.ts, steps/index.ts}`, script `db:seed` y pruebas con pasos ficticios.
- **Cómo se verifica por sí sola:** integración: dos ejecuciones crean los datos una vez y la salida no contiene valores sensibles; si falta la variable, sale con ≠ 0, la nombra y la BD queda sin cambios.

#### T-10 — Healthcheck
- **Archivos previstos:** `apps/api/src/modules/health/{application/check-health.use-case.ts, application/ports/database-probe.ts, infrastructure/prisma-database.probe.ts, interface/health.controller.ts}`.
- **Cómo se verifica por sí sola:** unitarias con *probe* falso (lento → 503 en ≤ 3 s; caché de 2 s); integración: 200 con BD, 503 sin hosts ni mensajes con un *probe* a un puerto cerrado, recuperación sin reiniciar.

#### T-11 — Pruebas de contrato
- **Archivos previstos:** `apps/api/test/contract/{contract-matcher.ts, health.contract.test.ts, route-coverage.test.ts}`.
- **Cómo se verifica por sí sola:** las respuestas 200 y 503 validan; un campo extra inyectado hace fallar el matcher; una ruta de Nest sin entrada en el documento hace fallar la cobertura de rutas.

#### T-12 — Generar `apps/web`
- **Archivos previstos:** `apps/web/{package.json, next.config.ts, tsconfig.json, eslint.config.js, vitest.config.ts}` y `apps/web/src/{instrumentation.ts, shared/config/server-env.ts, app/layout.tsx, app/healthz/route.ts, app/not-found.tsx}`.
- **Versiones:** Next.js y React con Context7; `create-next-app` en una carpeta temporal, integrado respetando `src/{app,features,shared}`.
- **Cómo se verifica por sí sola:** unitarias de `server-env` (falta `API_INTERNAL_URL`, URL inválida o `ADMIN_CONTACT_EMAIL` no válido → mensaje con el nombre, sin el valor); `pnpm dev` arranca la web en `WEB_PORT`.

#### T-13 — Clientes de API en la web
- **Archivos previstos:** `apps/web/src/shared/api/{server-client.ts, browser-client.ts, api-config-provider.tsx}` y la regla `no-restricted-globals` (`fetch` fuera de `shared/api`).
- **Cómo se verifica por sí sola:** unitarias de ambos clientes con `fetch` falso (reenvío de `Cookie`, `X-Correlation-Id` y `X-Forwarded-For` en el del servidor); renombrar `status` en el contrato de health y regenerar hace fallar `typecheck` de la web (se demuestra en el PR y se revierte).

#### T-14 — Docker con las apps reales
- **Archivos previstos:** `apps/api/Dockerfile`, `apps/web/Dockerfile` (su comentario «Se validará al generar la app (spec 002)» se elimina al quedar validados), `docker-compose.yml`, `.dockerignore` y la skill `docker-dev` si cambia alguna convención.
- **Cómo se verifica por sí sola:** `docker compose --profile apps up -d` → `api` y `web` en `healthy`, y un cambio en `apps/api/src` se refleja sin reconstruir; etapa `prod`: `/v1/health` en 200, la web responde y `whoami` ≠ `root`; al parar `postgres`, `api` pasa a `unhealthy`.

#### T-15 — Integración continua
- **Archivos previstos:** `.github/workflows/ci.yml` (jobs `calidad` y `seguridad`) y `scripts/ci/check-migrations-immutable.mjs` con su prueba unitaria.
- **Cómo se verifica por sí sola:** prueba unitaria del script (migración modificada, borrada o renombrada → falla); pipeline en verde en el PR del hito, también si solo cambia `specs/`; PR de demostración (error de tipos, secreto de prueba con formato reconocible, migración alterada) cerrados sin fusionar, con el resultado anotado en el PR del hito.

### Hito 2

#### T-16 — Contrato auth
- **Archivos previstos:** `packages/contracts/src/auth/{username.ts, login.schemas.ts, session.schemas.ts}`, `common/password.ts`, `common/problem-types.ts`, `v1/registry.ts`; `openapi/v1.json` y el cliente regenerados.
- **Cómo se verifica por sí sola:** unitarias de los esquemas con los mensajes exactos de la spec:
  - Vacíos → «Escribe tu usuario» / «Escribe tu contraseña» (CA-002).
  - `Harold1`, `Harold_Admin`, `Harold Admin` → «El usuario solo puede tener letras» (CA-014); `Ñandú` y `José` aceptados (CB-014); `"  lucia  "` → `lucia` (CB-001).
  - 7 caracteres → «La contraseña debe tener al menos 8 caracteres» (CA-015); 8 aceptados (CB-015); `Perch@ 2026` aceptada (CB-016); más de 128 rechazada.
  - `contract:check` en verde.

#### T-17 — Hash de contraseñas
- **Archivos previstos:** `apps/api/src/shared/time/{clock.port.ts, system.clock.ts}`, `apps/api/src/modules/auth/application/ports/password-hasher.ts`, `apps/api/src/modules/auth/infrastructure/argon2id-password-hasher.ts`, ampliación de `env.schema.ts` y script `bench:hash`.
- **Cómo se verifica por sí sola:** unitarias: dos hashes distintos sin la contraseña en claro; `Perch@ 2026` verifica y `perch@ 2026` no; parámetros bajo el mínimo OWASP → configuración inválida; emojis y textos largos; `verifyDummy` con duración comparable a `verify`. El resultado de `bench:hash` (objetivo 100–500 ms) se anota en el PR.

#### T-18 — Semilla de `HaroldAdmin`
- **Archivos previstos:** `apps/api/prisma/seed/steps/admin-inicial.step.ts` y su registro en `steps/index.ts`.
- **Cómo se verifica por sí sola:** integración con una contraseña de prueba en el entorno de la prueba:
  - Tras la semilla existe el rol «administrador», `HaroldAdmin` es la única cuenta, tiene ese rol y `password_hash` es un hash argon2id que no contiene la contraseña (CA-017).
  - Ejecutarla dos veces no duplica nada; con el hash cambiado a mano, una segunda ejecución no lo sobrescribe.
  - Sin `ADMIN_INITIAL_PASSWORD`, o con menos de 8 caracteres, sale con ≠ 0 nombrando la variable y sin crear datos.

#### T-19 — Sesión: dominio y casos de uso
- **Archivos previstos:** `prisma/migrations/*_sesiones/`, `apps/api/src/modules/auth/{domain/session.ts, application/ports/{session.repository.ts, token-generator.ts}, application/{open-session,validate-session,revoke-session}.use-case.ts, infrastructure/{prisma-session.repository.ts, crypto-token-generator.ts}}`.
- **Cómo se verifica por sí sola:** unitarias con `Clock` falso y repositorio en memoria: 7 h 59 min válida, 8 h 00 min caducada (CA-018); un nuevo `OpenSession` revoca la sesión previa; la caducidad se calcula desde `createdAt` persistido; cuenta `DISABLED` → no autenticada (CB-012). Integración del repositorio contra PostgreSQL.

#### T-20 — Guard de sesión y endpoints
- **Archivos previstos:** `apps/api/src/modules/auth/interface/{guards/session.guard.ts, decorators/{public,current-session}.ts, session-cookie.ts, auth.controller.ts}`.
- **Cómo se verifica por sí sola:** integración: atributos de la cookie y valor sin id, rol ni contraseña; `GET /session` 200 con sesión, 401 `auth/session-expired` a las 8 h (CA-018) y 401 `auth/unauthenticated` con cookie inventada (nunca 500); tras `logout` la copia de la cookie da 401 y las cookies se borran (CA-011 API, CB-018); dos sesiones de la misma cuenta: cerrar una no afecta a la otra; logout idempotente sobre sesión caducada; ruta sin declarar → 401.

#### T-21 — Guard por rol
- **Archivos previstos:** `apps/api/src/modules/auth/interface/{guards/roles.guard.ts, decorators/roles.ts}`.
- **Cómo se verifica por sí sola:** integración con la ruta de prueba `@Roles('admin')`: sin sesión 401; rol de prueba distinto de `admin` 403; `admin` 200. Cambiar el rol en BD cambia el resultado sin abrir sesión nueva (RF-023).

#### T-22 — CSRF y CORS
- **Archivos previstos:** `apps/api/src/modules/auth/interface/guards/csrf.guard.ts` y `apps/api/src/shared/http/cors.ts`.
- **Cómo se verifica por sí sola:** integración: `logout` sin `X-CSRF-Token` → 403 y la sesión sigue válida; con token → 204; GET sin token → 200; `POST` con `Origin` no permitido → 403 y sin cabecera CORS.

#### T-23 — Límite de peticiones
- **Archivos previstos:** `prisma/migrations/*_limite_peticiones_y_bloqueo/` y `apps/api/src/shared/rate-limit/{rate-limit.module.ts, postgres-throttler.storage.ts, strict-rate-limit.decorator.ts}`.
- **Cómo se verifica por sí sola:** integración con límites reducidos por configuración: N+1 → 429 con `Retry-After` y otra IP (con `TRUST_PROXY`) sigue atendida; ruta estricta con 5 → la sexta 429 y las demás rutas disponibles; sin `TRUST_PROXY`, `X-Forwarded-For` se ignora; `/v1/health` no consume el límite; el contador persiste tras recrear la app.

#### T-24 — Dominio del bloqueo y repositorios
- **Archivos previstos:** `apps/api/src/modules/users/{domain/{account.ts, account-status.ts, login-lock.ts}, application/ports/{account.repository.ts, unknown-login-attempts.repository.ts}, infrastructure/{prisma-account.repository.ts, prisma-unknown-login-attempts.repository.ts}}`.
- **Cómo se verifica por sí sola:**
  - Unitarias de `LoginLock` con `Clock` falso: 4 fallos → no bloqueada; 5.º → bloqueada 30 min (CA-007); acierto → contador 0 (CA-008); a los 30 min se desbloquea y el contador vuelve a 0 (CA-016); tras el desbloqueo hacen falta otros 5 fallos (CB-013); un intento durante el bloqueo no lo alarga (CB-005).
  - Integración del incremento atómico: 10 fallos concurrentes sobre la misma cuenta dejan el contador coherente y un único bloqueo (CB-006).
  - Integración de `login_attempt_unknown`: 5 fallos con un usuario inexistente producen el mismo resultado observable que con una cuenta real, sin crear filas en `account` (CB-004).

#### T-25 — `LogIn` y `POST /v1/auth/login`
- **Archivos previstos:** `apps/api/src/modules/auth/application/log-in.use-case.ts`, ampliación de `auth.controller.ts`, eventos de auditoría y `apps/api/test/integration/login.test.ts`.
- **Cómo se verifica por sí sola:** integración con cuentas de prueba creadas por factories:
  - «lucia» con su contraseña → 200, cookies y `GET /session` con rol `admin` (CA-001); `HaroldAdmin` sembrado con la contraseña de prueba entra (CA-017).
  - Contraseña incorrecta y usuario inexistente → mismo 401 `auth/invalid-credentials`, mismo cuerpo salvo `correlationId` (CA-003, CB-003).
  - Cuenta sin rol `admin` y credenciales válidas → 401 genérico (CA-019); cuenta `DISABLED` → 401 genérico.
  - Bloqueo: 4 fallos + 5.º → 423 con `lockedMinutesRemaining = 30`, y con la contraseña correcta sigue 423 (CA-007, CB-005); contador a 0 tras entrar con 3 fallos previos (CA-008); `locked_until` en el pasado → entra y contador 0 (CA-016).
  - `"  LUCIA  "` entra (CB-001, CB-002).
  - Un 400 de validación no incrementa el contador.
  - Los logs contienen `auth.login.failed`/`auth.login.locked` con `accountId` y sin el usuario tecleado ni la contraseña.
  - Con los parámetros de hash de producción, el login tarda ≤ 1 s (RT-021).

#### T-26 — Cabeceras, rutas públicas y contrato auth
- **Archivos previstos:** `apps/api/src/shared/http/security-headers.ts`, `apps/api/test/integration/public-routes.test.ts` y `apps/api/test/contract/auth.contract.test.ts`.
- **Cómo se verifica por sí sola:** CSP `default-src 'none'`, `nosniff`, `Referrer-Policy`, HSTS solo en `production` y sin `X-Powered-By`; las rutas `@Public` son exactamente `health`, `auth/login` y `auth/logout`; las respuestas de `login`, `session` y `logout` (incluidos 401, 423 y 429) validan contra `v1.json`.

### Hito 3

#### T-27 — Tokens de marca
- **Archivos previstos:** `packages/ui-tokens/{package.json, src/tokens.ts, src/contrast.ts, src/contrast-pairs.ts, scripts/build-css.ts}` y `packages/config/stylelint/`.
- **Cómo se verifica por sí sola:** unitarias: todos los pares cumplen 4,5:1 (texto) o 3:1 (bordes de control) y «blanco sobre naranja» se detecta como inválido; Stylelint falla ante un hex literal en un `.module.css`.

#### T-28 — Base de `ui-web` y marca en la web
- **Archivos previstos:** `packages/ui-web/{package.json, vitest.config.ts, src/internal/*, src/styles/focus.css}` y `apps/web/src/app/layout.tsx` (`next/font`, `tokens.css`, `transpilePackages`, `ApiConfigProvider`).
- **Cómo se verifica por sí sola:** unitaria de `VisuallyHidden`; el layout aplica `--font-sans` y `lang="es"`.

#### T-29 a T-33 — Componentes
- **Archivos previstos:** por componente, `packages/ui-web/src/<Componente>/{<Componente>.tsx, .module.css, .test.tsx, index.ts}`.
- **Cómo se verifica cada uno por sí solo:** Testing Library + `user-event` + `vitest-axe` en cada estado (normal, foco, error, deshabilitado y carga, si aplica):
  - **Button (T-29):** en carga, ni clic, ni Enter, ni Espacio disparan la acción; `aria-busy`; estado anunciado; conserva el nombre; `min-height` ≥ 24 px; texto largo sin desbordar; `prefers-reduced-motion`.
  - **TextField (T-30):** `aria-invalid`, `aria-describedby` con el error, región `polite`, icono `aria-hidden`, la etiqueta enfoca el campo; etiqueta vacía → error en desarrollo.
  - **PasswordField (T-31):** oculto por defecto; el conmutador cambia el `type` y el nombre («Mostrar contraseña» / «Ocultar contraseña») y el foco se mantiene (CA-004); pegar y `autocomplete` aceptados (CB-008); `notice` asociado y anunciado.
  - **Link (T-32):** interno con `next/link`, `mailto:` con `<a>`, subrayado y foco visible.
  - **Alert (T-33):** rol según la variante y prefijo de texto oculto.

#### T-34 — Cabeceras de la web y redirección optimista
- **Archivos previstos:** `apps/web/src/proxy.ts` (o `middleware.ts` según la versión) y su prueba unitaria.
- **Cómo se verifica por sí sola:** unitaria: nonce distinto por petición; `connect-src` incluye `API_PUBLIC_URL`; `frame-ancestors 'none'`; `/panel` sin cookie de sesión → redirección a `/login`; `/panel/**` con `Cache-Control: no-store`.

#### T-35 — Pantalla `/login` (maquetación)
- **Archivos previstos:** `apps/web/src/app/login/{page.tsx, page.module.css}`, `apps/web/src/features/auth-login/BrandShowcase.tsx`, `apps/web/public/brand/*.svg` y `apps/web/src/shared/auth/get-session.ts`.
- **Cómo se verifica por sí sola:**
  - Unitarias: no hay enlace ni botón de registro; aparece el texto de RF-021; la página no contiene credenciales de ejemplo (`admin`, `perchados2026`, `HaroldAdmin`) (CA-009, RF-022).
  - Unitaria de la página con sesión válida → `redirect('/panel')` (CB-011).
  - Manual con el MCP de Playwright: comparación con el mockup a 360 px y en escritorio; formulario primero en pantallas estrechas.

#### T-36 — `LoginForm`
- **Archivos previstos:** `apps/web/src/features/auth-login/{LoginForm.tsx, LoginForm.module.css, LoginForm.test.tsx, use-caps-lock.ts, login-messages.ts}`.
- **Cómo se verifica por sí sola:** unitarias con cliente de API falso:
  - Envío vacío → los dos errores junto a sus campos, foco en el primero y ninguna llamada (CA-002); `Harold1` y contraseña de 7 → errores sin llamada (CA-014, CA-015).
  - 401 → «Usuario o contraseña incorrectos» (CA-003); 423 → «Demasiados intentos. Vuelve a intentarlo en 30 minutos» (CA-007).
  - Durante el envío el botón está en carga y un segundo envío no llama a la API (CA-013).
  - Bloq Mayús activo al escribir → aviso; al desactivarlo desaparece (CA-005, CB-009).
  - Error de red o *timeout* → «No hay conexión, inténtalo de nuevo» y el usuario se conserva (CB-007).
  - 429 y 500 → sus mensajes; 200 → `router.replace('/panel')`.

#### T-37 — «¿Olvidaste tu contraseña?»
- **Archivos previstos:** `apps/web/src/features/auth-login/ForgotPasswordDisclosure.tsx` y su prueba.
- **Cómo se verifica por sí sola:** unitaria: `aria-expanded` cambia; se muestra el texto para escribir al responsable y el correo configurado con un enlace `mailto:`; no hay campos de formulario ni llamadas a la API (CA-006).

#### T-38 — Panel, cierre de sesión y caducidad
- **Archivos previstos:** `apps/web/src/app/panel/{layout.tsx, page.tsx, page.module.css}`, `apps/web/src/app/page.tsx`, `apps/web/src/shared/auth/require-admin-session.ts` y `apps/web/src/features/admin-panel/{ComingSoon.tsx, LogoutButton.tsx, SessionWatcher.tsx}`; aviso `motivo=sesion-caducada` en `/login`.
- **Cómo se verifica por sí sola:** unitarias:
  - `requireAdminSession()`: 200 `admin` → continúa; 401 `session-expired` → `/login?motivo=sesion-caducada`; 401/403 → `/login`.
  - `ComingSoon` muestra «Próximamente, estamos trabajando» (CA-001).
  - `LogoutButton` llama a `logout` con `X-CSRF-Token` y navega con `location.replace('/login')` (CA-011).
  - `SessionWatcher` con 401 al volver a la pestaña o desde bfcache → navega al login (CB-017, CB-018).
  - `/login?motivo=sesion-caducada` muestra «Tu sesión ha caducado. Vuelve a iniciar sesión» (CA-018).

### Hito 4

#### T-39 — Base de Playwright
- **Archivos previstos:** `apps/web/playwright.config.ts` y `apps/web/e2e/{pages/{BasePage.ts, LoginPage.ts, PanelPage.ts}, fixtures/{test.ts, accounts.ts, db.ts}, reporters/flaky-summary.ts}`.
- **Cómo se verifica por sí sola:** una prueba de humo abre `/login` con `LoginPage` y `data-testid`; el informe HTML la muestra con su ID; `retries` = 1 solo con `CI`; prueba unitaria del reporter (un resultado `flaky` → «inestable» en el resumen); el fixture crea y limpia sus cuentas.

#### T-40 — E2E del login
- **Archivos previstos:** `apps/web/e2e/tests/{login.spec.ts, panel.spec.ts}`.
- **Cómo se verifica por sí sola:** un test por escenario, titulado con su ID, contra web + API + BD de pruebas:
  - `login.spec.ts`: CA-001, CA-002, CA-003, CA-004, CA-005, CA-006, CA-007, CA-008, CA-009, CA-013, CA-014 (tres ejemplos), CA-015, CA-016, CA-017 (`HaroldAdmin` con la contraseña de prueba del entorno de CI), CA-019, CB-001, CB-002, CB-007 (`page.route` abortado) y CB-011.
  - `panel.spec.ts`: CA-010, CA-011 (incluye «Atrás»), CA-018 (el fixture mueve `expires_at`), CB-017 y CB-018 (dos pestañas).

#### T-41 — Accesibilidad, responsive y rendimiento
- **Archivos previstos:** `apps/web/e2e/tests/login-a11y.spec.ts`.
- **Cómo se verifica por sí sola:**
  - axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) sin violaciones en `/login` (inicial, errores de campo, error genérico, bloqueo, Bloq Mayús, desplegable abierto, sesión caducada) y en `/panel`.
  - Recorrido solo con teclado (Tab, Enter) del formulario completo.
  - 360 px y zoom del 200 % sin desplazamiento horizontal ni solapes; `forcedColors: 'active'` con bordes y foco visibles.
  - Lighthouse de `/login` (perfil móvil): LCP, CLS, INP/TBT y JS inicial anotados en el PR dentro del presupuesto.

#### T-42 — E2E en la CI
- **Archivos previstos:** `.github/workflows/ci.yml` (job `e2e`).
- **Cómo se verifica por sí sola:** el job en verde en el PR, con el informe HTML como artefacto y como máximo 1 reintento.

#### T-43 — Cierre
- **Archivos previstos:** `specs/02-memoria/registro-componentes.md` (todo lo de «Reutilización» del diseño), `.claude/skills/api-rest-conventions/SKILL.md` y `.claude/skills/prisma-datos/SKILL.md` (añadidas a `skills:` de `backend-dev`), README de `packages/ui-tokens` y `packages/ui-web`, y la propuesta de comandos para `CLAUDE.md` (la aplica el orquestador).
- **Cómo se verifica por sí sola:** las skills tienen ejemplos ✅/❌; el registro incluye cada componente con ruta y ejemplo de uso.

### Hito 5

Todas las pruebas nuevas se nombran con `RT-022` (o `ADR-012` en T-50). Context7 antes de usar `node:crypto`, `node:net`, `server-only`, `headers()` de Next.js y `no-restricted-imports` de ESLint 9.

#### T-44 — Entorno: variables nuevas
- **Archivos previstos:**
  - `.env.example`: `INTERNAL_API_SECRET=` vacío, con el comentario «generar con `openssl rand -base64 32`; mismo valor en api y web»; `WEB_TRUST_PROXY_HOPS=0`.
  - `docker-compose.yml`: `INTERNAL_API_SECRET: ${INTERNAL_API_SECRET:?…}` en `api` y `web`; `WEB_TRUST_PROXY_HOPS` en `web`.
  - `.github/workflows/ci.yml`: paso que genera un secreto aleatorio por ejecución (enmascarado con `::add-mask::`) y lo exporta a los jobs que arrancan la API o la web (pruebas y `e2e`).
- **Cómo se verifica por sí sola:**
  - `docker compose config` sin `INTERNAL_API_SECRET` falla nombrando la variable; con ella, `api` y `web` la reciben.
  - El job de la CI en verde; el valor del secreto no aparece en el log del job (aparece `***`).
  - Ningún valor real del secreto queda versionado (gitleaks en verde).

#### T-45 — Configuración y logs de la API
- **Archivos previstos:** `apps/api/src/shared/config/env.schema.ts` (+ `load-config.spec.ts`), `apps/api/src/shared/logging/sanitize.ts` (+ `sanitize.spec.ts`), `apps/api/test/helpers/test-app.factory.ts` (secreto de prueba exportado como constante para las pruebas que lo envían).
- **Cómo se verifica por sí sola:**
  - Unitarias de configuración: falta `INTERNAL_API_SECRET` → inválida y nombra la variable sin su valor; 31 caracteres → inválida; 32 → válida; `APP_ENV=production` con `TRUST_PROXY=false` → inválida; `production` con `TRUST_PROXY=1` → válida; `ci`/`local` con `false` → válida.
  - Unitaria de `sanitize`: la cabecera `x-perchados-internal-token` (cualquier capitalización) se oculta.
  - Toda la suite de la API sigue en verde con `createTestApp`.

#### T-46 — IP del límite en la API
- **Archivos previstos:** `apps/api/src/shared/rate-limit/{client-ip.ts, client-ip.spec.ts, rate-limit.guard.ts, rate-limit.client-ip.integration.spec.ts}`; registro de `resolveTrackerIp` en `specs/02-memoria/registro-componentes.md`.
- **Cómo se verifica por sí sola:**
  - Unitarias de `resolveTrackerIp`: token correcto + IP válida (IPv4 e IPv6) → esa IP (IPv6 agrupada por /64); token ausente, vacío, de otra longitud o erróneo → `req.ip`; token correcto + valor no IP (`abc`, vacío, lista con coma, espacios) → `req.ip`; varias cabeceras repetidas → `req.ip`.
  - Integración con `createTestApp` y límites reducidos, todas por el mismo socket de supertest:
    - Sin token y con token erróneo, variar `X-Perchados-Client-Ip` no cambia el cubo: N+1 → 429 (la cabecera se ignora).
    - Con token válido, IP A agota su cubo (N+1 → 429 con `Retry-After`) e IP B sigue en 200; también en el límite estricto de `POST /v1/auth/login`.
    - Con token válido y valor no IP → se cuenta en el cubo de `req.ip`.
    - Capturando stdout: el valor del token no aparece en ninguna línea de log.
  - Las pruebas existentes de `TRUST_PROXY` (`rate-limit.integration.spec.ts`, `rate-limit.trust-proxy.integration.spec.ts`) siguen en verde sin cambios.
  - El token no exime de sesión ni de CSRF: una ruta privada con token válido y sin cookie → 401.

#### T-47 — Configuración del servidor web
- **Archivos previstos:** `apps/web/src/shared/config/server-env.ts` (+ `server-env.test.ts`).
- **Cómo se verifica por sí sola:**
  - Unitarias: falta `INTERNAL_API_SECRET` o < 32 caracteres → inválida y nombra la variable sin su valor; `WEB_TRUST_PROXY_HOPS` ausente → `0`; `-1`, `1.5` o texto → inválida; `APP_ENV=production` con `0` → inválida; `production` con `1` → válida.
  - El módulo importa `server-only` (prueba que lo comprueba).

#### T-48 — `resolveClientIp`
- **Archivos previstos:** `apps/web/src/shared/api/{client-ip.ts, client-ip.test.ts}`; registro en `specs/02-memoria/registro-componentes.md`.
- **Cómo se verifica por sí sola:**
  - Unitarias: saltos `0` → sin IP aunque haya cabecera; `1` con `"a, b"` → `b`; `2` con `"a, b, c"` → `b`; más saltos que entradas → sin IP; cabecera ausente o vacía → sin IP; entradas con espacios → se recortan; entrada no IP → sin IP; IPv6 válida → esa IP.
  - El módulo importa `server-only`.

#### T-49 — `createServerApiClient` con la IP del cliente
- **Archivos previstos:** `apps/web/src/shared/api/{server-client.ts, server-client.test.ts}`; actualización de su entrada en `specs/02-memoria/registro-componentes.md`.
- **Cómo se verifica por sí sola:**
  - Unitarias (con `fetch` simulado): una petición entrante con `X-Forwarded-For` falso no lo reenvía nunca; con IP resuelta envía `X-Perchados-Internal-Token` y `X-Perchados-Client-Ip`; sin IP resuelta envía solo el token; sigue reenviando `Cookie` y `X-Correlation-Id` válido.
  - El secreto no llega al navegador: tras `pnpm --filter web build` con un secreto marcador, el marcador no aparece en los archivos estáticos del cliente (comprobación por script, anotada en el PR).
  - `pnpm test:e2e` sigue en verde (login y panel por SSR con `WEB_TRUST_PROXY_HOPS=0`).

#### T-50 — Lint de `@perchados/contracts/client` (ADR-012)
- **Archivos previstos:** `apps/web/eslint.config.mjs` (`no-restricted-imports` con `paths`/`patterns` para `@perchados/contracts` y sus subrutas salvo `/client`, aplicado a `src/**`; `e2e/**` no se restringe).
- **Cómo se verifica por sí sola:**
  - Un archivo de muestra temporal en `apps/web/src` que importa `@perchados/contracts` hace fallar `pnpm lint` con archivo, línea y un mensaje que remite a ADR-012; se borra antes del commit (resultado anotado en el PR).
  - Un import de `@perchados/contracts/client` en `src` y de la entrada principal en `e2e/**` pasan el lint.
  - `pnpm lint` en verde sobre el código actual.

---

## Definición de hecho (común a todas las tareas)
- [ ] Cumple los CA, CB y RT que cubre, con pruebas nombradas con su ID (`CA-0xx`/`CB-0xx`/`RT-0xx`).
- [ ] Pruebas escritas junto al código y en verde; cobertura ≥ 80 % de líneas en el paquete tocado.
- [ ] `pnpm lint` y `pnpm typecheck` sin errores.
- [ ] Sin secretos, sin `any`/`@ts-ignore` injustificados, sin `TODO` sin tarea y sin código comentado.
- [ ] Los componentes reutilizables nuevos se registran en `specs/02-memoria/registro-componentes.md`.
- [ ] Las dependencias nuevas tienen la versión verificada con Context7 y anotada en el PR.
- [ ] Un commit pequeño y descriptivo por tarea.

## Trazabilidad (comprobación de cobertura)
- **RF:** RF-001 a RF-012, RF-014 a RF-023 (la spec no tiene RF-013), todos asignados.
- **CA:** CA-001 a CA-011 y CA-013 a CA-019, todos con prueba de API o de componente y con E2E en T-40.
- **CB:** CB-001 a CB-009 y CB-011 a CB-018 (la spec no tiene CB-010), todos asignados.
- **RT:** RT-001 a RT-022, todos asignados (RT-022 y la regla de lint de ADR-012 en el hito 5).
- **Recuento:** 7 tareas de base (B-01 a B-07) + 50 tareas (T-01 a T-50) en 5 hitos; el hito 5 recoge las correcciones de la revisión de la etapa 6.
