---
id: 002
spec: ./spec.md
estado: aprobada # borrador | aprobada | cumplida
aprobacion: dueño (Harold) el 2026-10-15, aplicada por el orquestador con su autorización explícita en el chat
autor: arquitecto
adr: [ADR-007, ADR-008, ADR-009]
---

# Diseño 002 — Fundaciones de web y API

## Resumen de la solución
Base técnica en **3 hitos** (un PR por hito), sobre la estructura y el Docker de la 000:

| Hito | Contenido | Entregable demostrable |
|------|-----------|------------------------|
| **1 — Base y calidad** | `apps/api` (NestJS) y `apps/web` (Next.js) generadas, ESLint/TypeScript estricto, Vitest con cobertura del 80 %, CI en GitHub Actions con escaneos, contrato Zod → OpenAPI → cliente tipado, `problem+json`, correlación, logs pino, configuración validada con Zod, Prisma + migraciones + semilla, `GET /v1/health` | `pnpm dev` levanta API y web; la CI en verde; `/v1/health` en 200/503 |
| **2 — Seguridad** | Hash argon2id, sesión en servidor con cookie opaca, CSRF por token sincronizador + comprobación de `Origin`, guards por defecto privados y por rol, límite de peticiones con almacén PostgreSQL, cabeceras de seguridad | Pruebas de integración de CA-025 a CA-036 en verde |
| **3 — Interfaz y E2E** | `packages/ui-tokens` (marca Perchados), `packages/ui-web` (Button, TextField, PasswordField, Checkbox, Link, Alert), catálogo `/dev/componentes`, Playwright con Page Object base y prueba de humo | Catálogo navegable; suite E2E y axe en verde |

Principios: lo mínimo que cumple la spec, sin servicios nuevos en Docker (no se añade Redis), HTML nativo en vez de librerías de componentes, y un único lenguaje de esquemas (Zod) para validación, configuración y contrato.

> **Versiones:** Context7 no estaba disponible al diseñar. Las versiones citadas (Next.js 16, NestJS 11, Prisma 7, Zod 4, `@nestjs/throttler` 6, pino 9/10) son las esperadas a octubre de 2026 y **se verifican con Context7 al instalar** (T-xx de cada hito). Si una API difiere (p. ej. `proxy.ts` frente a `middleware.ts` en Next.js, o la firma de `ThrottlerStorage`), se adapta sin cambiar el diseño.

## Cobertura de requisitos
| RF / CB | Cómo se resuelve | Hito |
|---------|------------------|------|
| RF-001, CB-002 | `apps/api` NestJS 11, versionado URI con versión por defecto `1` (`/v1/...`). Puerto `API_PORT` (3001) validado; el error `EADDRINUSE` se registra con el puerto en conflicto y sale con código 1 | 1 |
| RF-002, CB-002 | `apps/web` Next.js App Router; `app/page.tsx` provisional con la marca y el estado de la API (`data-testid="api-status"`). Puerto `WEB_PORT` (`next dev -p`) | 1 (marca final en 3) |
| RF-003 | Scripts raíz ya presentes (`turbo run dev/build/test/lint/typecheck`); cada app y paquete define los suyos. Nuevos: `db:migrate`, `db:migrate:deploy`, `db:seed`, `contract:generate`, `contract:check`, `test:e2e` | 1 |
| RF-004 | Compose perfil `apps`: `api` y `web` con target `dev`, código montado, `node_modules` en volumen con nombre, healthchecks con `node -e fetch(...)`. Etapa `prod` con `next build` standalone y `nest build`, usuario `node` | 1 |
| RF-005 | `tsconfig.base.json` `strict` + `noUncheckedIndexedAccess`; ESLint 9 (flat) con `typescript-eslint` `strictTypeChecked`, `jsx-a11y` en web/ui-web, `no-restricted-imports` para las capas hexagonales | 1 |
| RF-006 | Vitest + `@vitest/coverage-v8` en cada paquete; `thresholds.lines: 80` desde el preset `packages/config/vitest`. Exclusiones: código generado, `*.config.*`, `main.ts`, `*.module.ts`, `prisma/migrations` | 1 |
| RF-007, CB-006, CB-030 | `.github/workflows/ci.yml` (ver «Integración continua»). Sobre el commit de fusión del PR se aplican las migraciones a una BD vacía. Se ejecuta siempre, también en PR solo de `specs/` (la caché de Turborepo lo hace rápido; sin `paths-ignore`, para no dejar checks requeridos en espera) | 1 |
| RF-008, CB-028, CB-029 | Job `security`: gitleaks sobre todos los commits del PR (`--log-opts origin/main..HEAD`, `--redact`) y `pnpm audit --audit-level high`. Excepciones en `security/audit-exceptions.yaml`, validadas por un script (aprobador, fecha y caducidad ≤ 30 días; caducada → falla) y sincronizadas con `pnpm.auditConfig.ignoreGhsas` | 1 |
| RF-009, CB-009 | Esquemas en `packages/contracts` (Zod 4, objetos estrictos). La API valida con `ZodValidationPipe` mediante `@ZodBody/@ZodQuery/@ZodParams`, antes del controlador. JSON mal formado → 400 `malformed-request`; cuerpo > `BODY_LIMIT_KB` → 413 `payload-too-large` | 1 |
| RF-010 | `@asteasolutions/zod-to-openapi` genera `packages/contracts/openapi/v1.json` (versionado). `DocsModule` sirve `/v1/openapi.json` y el visor Scalar `/v1/docs` solo si `API_DOCS_ENABLED=true`; la configuración rechaza `true` con `APP_ENV=production`. Sin el módulo, la ruta no existe → 404 | 1 |
| RF-011 | `openapi-typescript` genera `packages/api-client/src/generated/v1.ts`; `openapi-fetch` como cliente (≈ 6 KB). Regla de ESLint en `apps/web`: prohibido `fetch` directo a la API fuera de `shared/api` | 1 |
| RF-012 | Pruebas de contrato en `apps/api/test/contract` con Ajv contra `v1.json`; prueba de cobertura de rutas (toda ruta de Nest está en el documento); `contract:check` regenera y hace `git diff --exit-code` | 1 |
| RF-013, CB-009, CB-010 | `ProblemDetailsFilter` global: mapea `ProblemException`, `HttpException`, errores de validación, de body-parser y de throttler, y cualquier otro error → 500 `internal-error` con un `detail` genérico. Si no hay id de correlación, el filtro lo genera | 1 |
| RF-014, CB-007, CB-010 | Middleware de correlación registrado con `app.use()` **antes** del body-parser (la app se crea con `bodyParser: false`). Cabecera `X-Correlation-Id`, válida si cumple `^[A-Za-z0-9._-]{1,128}$`; si no, `crypto.randomUUID()`. El valor rechazado no se registra | 1 |
| RF-015, CB-008 | `nestjs-pino`: una línea JSON por evento a stdout, nivel `LOG_LEVEL`. `redact` para las cabeceras `cookie`, `authorization`, `x-csrf-token` y `set-cookie`, más `sanitize()` recursiva (profundidad 6) por claves que cumplan `/pass(word)?\|secret\|token\|cookie\|authorization\|api[-_]?key\|session\|csrf/i` → `"[OCULTO]"`. No se registran cuerpos ni *query strings* | 1 |
| RF-016, CB-003, CB-004 | API: `loadConfig()` con Zod en `main.ts` antes de `NestFactory.create`. Web: `instrumentation.ts` `register()` (runtime `nodejs`). Si falla: imprime `Configuración inválida: <VAR> — <formato esperado>`, sin el valor, y `process.exit(1)` | 1 |
| RF-017, CB-001 | Prisma 7 con `@prisma/adapter-pg` (sin binarios del motor). Conexión perezosa: la API arranca sin la BD y `/v1/health` da 503 hasta que responde, sin reiniciar | 1 |
| RF-018, CB-005 | `apps/api/prisma/migrations`, `pnpm db:migrate:deploy`. CI: `scripts/ci/check-migrations-immutable.mjs` falla si el PR modifica, borra o renombra una migración presente en `origin/main`; `prisma migrate diff --exit-code` detecta la deriva entre esquema y migraciones | 1 |
| RF-019 | `apps/api/prisma/seed/runner.ts`: lista de `SeedStep { name, requiredEnv[], run(tx) }`. Valida **todas** las variables antes de escribir, ejecuta todo en una transacción e imprime solo «creado / ya existía». La 002 no trae pasos de producción (los roles van en la migración); la 001 añade el de `HaroldAdmin` | 1 |
| RF-020, CB-011, CB-012 | Puerto `PasswordHasher` y adaptador `Argon2idPasswordHasher` (`@node-rs/argon2`); parámetros validados contra los mínimos OWASP. Normalización NFC antes de hashear. Longitud máxima de 128 caracteres en el esquema compartido `passwordInputSchema`. `verifyDummy()` usa un hash ficticio calculado al arrancar (ADR-007) | 2 |
| RF-021, CB-013, CB-014 | `OpenSession`: token opaco de 32 bytes aleatorios (base64url); en BD solo se guarda su SHA-256. Cookie `HttpOnly; SameSite=Strict; Path=/; Secure` (salvo `APP_ENV` `development`/`test`). Revoca la sesión previa que traiga la petición. Una cookie inválida → 401 `auth/unauthenticated` | 2 |
| RF-022, CB-004, CB-017 | `expiresAt = createdAt + SESSION_TTL_HOURS` (por defecto 8; admite decimales, mínimo 1 minuto) guardado en BD. `Session.isExpired(now)` con un puerto `Clock` (inyectable en pruebas). Caducada → 401 `auth/session-expired`. Cookie con `Max-Age = TTL + 24 h`, para que el navegador la siga enviando y se pueda distinguir la caducidad | 2 |
| RF-023, CB-015, CB-016 | `POST /v1/auth/logout` (204, idempotente, borra las cookies). `DeactivateAccount` en transacción: `status=DISABLED` + `revokedAt=now()` en todas las sesiones activas. Reactivar no toca `revokedAt` | 2 |
| RF-024, CB-018, CB-019 | `CsrfGuard`: en métodos no seguros (todo salvo GET/HEAD/OPTIONS), (a) un `Origin` presente y no incluido en `CORS_ALLOWED_ORIGINS` → 403, y (b) con sesión resuelta, la cabecera `X-CSRF-Token` debe coincidir (comparación en tiempo constante del SHA-256) con `Session.csrfTokenHash` → si no, 403 `auth/csrf-invalid`. CORS solo con los orígenes configurados y `credentials: true` | 2 |
| RF-025 | Guards globales en orden: `ThrottlerGuard` → `SessionGuard` (privado por defecto; `@Public()` lo exime) → `RolesGuard` (`@Roles('admin')` contra el código del rol leído de BD) → `CsrfGuard` | 2 |
| RF-026 | Modelos `Role` y `Account` (ver «Modelo de datos»). Los roles `admin`/«administrador» y `buyer`/«comprador» se insertan en la migración | **1** (modelo) / 2 (uso) |
| RF-027, CB-020, CB-022 | `@nestjs/throttler` con el throttler `global` (`RATE_LIMIT_GLOBAL_PER_MIN`=100, ventana de 60 s). Almacén `PostgresThrottlerStorage` (UPSERT atómico con la hora de la BD): sobrevive a reinicios y a varias réplicas. IP desde `req.ip` con `trust proxy` = `TRUST_PROXY` (por defecto `false`). 429 `rate-limit-exceeded` + `Retry-After` | 2 |
| RF-028 | Throttler `strict` (`RATE_LIMIT_AUTH_PER_MIN`=10) con `skipIf` cuando la ruta no lleva `@StrictRateLimit()`; se suma al global | 2 |
| RF-029 | `packages/ui-tokens`: `src/tokens.ts` (fuente única) → `dist/tokens.css` (variables CSS) y JS tipado (ver «Tokens de marca») | 3 |
| RF-030, CB-023, CB-025 | `Button` (ver «Componentes web») | 3 |
| RF-031, CB-024 | `TextField` con `label` obligatoria en el tipo y comprobación en desarrollo | 3 |
| RF-032 | `PasswordField` | 3 |
| RF-033 | `Checkbox` nativo | 3 |
| RF-034 | `Link` | 3 |
| RF-035 | `Alert` | 3 |
| RF-036, CB-026, CB-027 | Vitest + Testing Library + `vitest-axe` por estado; contraste con `@axe-core/playwright` sobre el catálogo (jsdom no calcula el contraste). Unidades `rem`, `min-height` en vez de `height`, y `@media (forced-colors: active)` | 3 |
| RF-037 | Ruta `apps/web/src/app/dev/componentes/page.tsx`, `notFound()` salvo `WEB_DEV_TOOLS_ENABLED=true` (la configuración lo rechaza con `APP_ENV=production`) | 3 |
| RF-038 | `apps/web/playwright.config.ts`: `retries: CI ? 1 : 0`, informe HTML + reporter propio `inestables` (estado `flaky` → «inestable» en el resumen de GitHub) | 3 |
| RF-039 | `BasePage` + `HomePage` en `apps/web/e2e/pages`, `testIdAttribute: 'data-testid'`, prueba `CA-048` | 3 |
| RF-040, CB-001, CB-021 | `HealthModule`: `@Public() @SkipThrottle()`, `SELECT 1` con un tiempo máximo de `HEALTH_DB_TIMEOUT_MS` (2000) y el resultado cacheado 2 s (evita usar el healthcheck como vector de carga). 200 `{status:"ok",checks:{database:"up"}}`; 503 `problem+json` `health/unavailable` con `checks.database:"down"` | 1 |

Las NFR de la spec que pedían confirmación quedan así: **CB-021 confirmado** (el healthcheck no consume el límite) y **CI ≤ 15 min confirmado** como objetivo (jobs en paralelo y caché de Turborepo y de pnpm).

## Componentes

### Estructura de carpetas (añadidos sobre la 000)
```
apps/api/
├── prisma.config.ts
├── prisma/{schema.prisma, migrations/, seed/{runner.ts, steps/index.ts}}
├── src/
│   ├── main.ts, app.module.ts
│   ├── shared/
│   │   ├── config/        env.schema.ts, load-config.ts, config.module.ts (AppConfig)
│   │   ├── correlation/   correlation-id.middleware.ts
│   │   ├── logging/       logger.module.ts (nestjs-pino), sanitize.ts
│   │   ├── errors/        problem.exception.ts, problem-details.filter.ts, mappers/
│   │   ├── validation/    zod-validation.pipe.ts, zod-body.decorator.ts
│   │   ├── database/      prisma.service.ts, database.module.ts
│   │   ├── http/          security-headers.ts (helmet), cors.ts, no-store.interceptor.ts
│   │   ├── rate-limit/    rate-limit.module.ts, postgres-throttler.storage.ts, strict-rate-limit.decorator.ts
│   │   └── time/          clock.port.ts, system.clock.ts
│   └── modules/
│       ├── health/        application/check-health.use-case.ts (puerto DatabaseProbe)
│       │                  infrastructure/prisma-database.probe.ts · interface/health.controller.ts
│       ├── docs/          interface/docs.controller.ts (solo si API_DOCS_ENABLED)
│       ├── users/         domain/{account.ts, role.ts, account-status.ts}
│       │                  application/{ports/account.repository.ts, deactivate-account.use-case.ts}
│       │                  infrastructure/prisma-account.repository.ts
│       └── auth/          domain/session.ts
│                          application/ports/{password-hasher.ts, session.repository.ts, token-generator.ts}
│                          application/{open-session, validate-session, revoke-session}.use-case.ts
│                          infrastructure/{argon2id-password-hasher.ts, prisma-session.repository.ts, crypto-token-generator.ts}
│                          interface/{auth.controller.ts, session-cookie.ts,
│                                     guards/{session, roles, csrf}.guard.ts,
│                                     decorators/{public, roles, current-session}.ts}
└── test/{helpers/test-app.factory.ts, helpers/test-routes.controller.ts, integration/, contract/}

apps/web/
├── playwright.config.ts
├── e2e/{pages/{BasePage.ts, HomePage.ts, ComponentCatalogPage.ts}, fixtures/test.ts,
│        tests/{smoke.spec.ts, catalog-a11y.spec.ts}, reporters/flaky-summary.ts}
└── src/
    ├── instrumentation.ts            Validación de la configuración al arrancar
    ├── proxy.ts                      CSP con nonce y cabeceras (middleware.ts si la versión es < 16)
    ├── app/{layout.tsx, page.tsx, not-found.tsx, healthz/route.ts, dev/componentes/page.tsx}
    ├── shared/config/server-env.ts   (server-only)
    ├── shared/api/{server-client.ts, browser-client.ts, api-config-provider.tsx}
    └── features/system-status/ApiStatus.tsx

packages/
├── config/      Presets compartidos: eslint/, tsconfig/, vitest/, stylelint/
├── contracts/   src/{common/problem.ts, common/problem-types.ts, common/password.ts,
│                     health/, auth/, v1/registry.ts, index.ts}
│                scripts/generate-openapi.ts → openapi/v1.json (versionado)
├── api-client/  src/{generated/v1.ts (versionado), client.ts, middleware/{csrf.ts, correlation.ts}}
├── ui-tokens/   src/{tokens.ts, contrast.ts, contrast-pairs.ts}, scripts/build-css.ts → dist/tokens.css
└── ui-web/      src/{Button, TextField, PasswordField, Checkbox, Link, Alert, internal/{VisuallyHidden, Spinner}}/
                 Cada componente: Componente.tsx, Componente.module.css, Componente.test.tsx, index.ts

.github/workflows/ci.yml · scripts/ci/{check-migrations-immutable.mjs, check-audit-exceptions.mjs}
security/audit-exceptions.yaml
```
- **Build de paquetes:** `contracts`, `api-client` y `ui-tokens` se compilan con `tsup` (ESM + CJS + `.d.ts`), porque los consume NestJS (CJS). `ui-web` se publica como código fuente TS y Next.js lo transpila (`transpilePackages`): no tiene paso de build.
- **Scope de nombres de los paquetes (decisión):** `@perchados/*` en todo el monorepo:
  - Apps: `@perchados/api` y `@perchados/web`.
  - Paquetes: `@perchados/contracts`, `@perchados/api-client`, `@perchados/ui-tokens`, `@perchados/ui-web` y `@perchados/config`.
  - Dependencias internas con `"workspace:*"`. Los filtros de pnpm y Turborepo usan ese scope (`pnpm --filter @perchados/api …`).
  - Sustituye al provisional `@repo/*` de los README de la 000.

### Reutilización
El registro de componentes está vacío: no hay nada que reutilizar. Todo lo que se marca abajo se **registra** en `specs/02-memoria/registro-componentes.md` en la tarea que lo crea:
- **API:** `ProblemException`, `ProblemDetailsFilter`, `ZodValidationPipe`/`@ZodBody`, `PrismaService`, `Clock`, `PasswordHasher`, `OpenSession`/`ValidateSession`/`RevokeSession`, `DeactivateAccount`, `@Public`, `@Roles`, `@CurrentSession`, `@StrictRateLimit`, el *runner* de semillas y `createTestApp`.
- **Paquetes:** `problemSchema`, `PROBLEM_TYPES`, `passwordInputSchema` y `createApiClient`.
- **UI y pruebas:** los 6 componentes de `ui-web`, `BasePage`, `HomePage` y el fixture `test`.

### Topología web ↔ API y sesión
- **Navegador → API directo** (`API_PUBLIC_URL`, CORS con credenciales), no a través de un proxy de Next.js. Así la API ve la IP real del cliente para el límite de peticiones y la app móvil usará el mismo camino.
- **Servidor Next → API** por `API_INTERNAL_URL`, reenviando las cabeceras `Cookie`, `X-Correlation-Id` y `X-Forwarded-For`.
- `API_PUBLIC_URL` se lee **en tiempo de ejecución** en `layout.tsx` (servidor) y se pasa al cliente con `ApiConfigProvider`, para no fijarla en el build (evita `NEXT_PUBLIC_*`).
- **Cookies** (detalle en ADR-007): `perchados_sid` (HttpOnly) y `perchados_csrf` (legible por JS, para el patrón sincronizador), ambas `SameSite=Strict`.
  - En local, `localhost:3000` y `localhost:3001` comparten cookies, porque las cookies no distinguen puertos.
  - En producción se exige que web y API compartan dominio registrable (p. ej. `perchados.com` y `api.perchados.com`) con `SESSION_COOKIE_DOMAIN`. Con `Secure`, los nombres llevan el prefijo `__Secure-`.

### Componentes web (`packages/ui-web`)
Todos usan HTML nativo, CSS Modules y solo variables de `ui-tokens`. Iconos de `lucide-react` (importación por icono, *tree-shakeable*), siempre con `aria-hidden`.

| Componente | API (props clave) | Accesibilidad y estados |
|------------|-------------------|-------------------------|
| **Button** | `variant: 'primary' \| 'secondary'`, `loading`, `disabled`, `iconEnd`, `fullWidth`, `type` (por defecto `button`), `loadingLabel` (por defecto «Cargando») | En carga: `aria-disabled="true"` (sigue siendo enfocable), `aria-busy="true"`; `onClick` hace `preventDefault()`, lo que también anula el envío implícito con Enter. El texto queda con `opacity:0` (conserva el ancho y el nombre accesible) y el spinner se superpone con `aria-hidden`. Un hermano `role="status"` visualmente oculto anuncia `loadingLabel`. Altura mínima de 48 px (≥ 24 px, CB-023). El texto se ajusta (`overflow-wrap`). Con `prefers-reduced-motion`, el spinner pasa a un pulso lento de opacidad (CB-025) |
| **TextField** | `label` (**obligatoria** en el tipo), `icon?`, `help?`, `error?`, más los props de `input` (`autoComplete`, `inputMode`…) | `<label htmlFor>` + `useId`; `aria-invalid` si hay error; `aria-describedby` = ayuda + error. El error vive en un contenedor `aria-live="polite"` que existe siempre, para que se anuncie al aparecer. Icono con `aria-hidden`. En desarrollo, una etiqueta vacía lanza un error (CB-024) |
| **PasswordField** | Lo mismo que TextField, más `notice?` (aviso contextual, p. ej. Bloq Mayús en la 001) y `autoComplete` (por defecto `current-password`) | Botón `type="button"` con nombre «Mostrar contraseña» / «Ocultar contraseña» (sin `aria-pressed`, para no duplicar). El foco no se mueve y un `role="status"` oculto anuncia «Contraseña visible / oculta». No bloquea pegar ni el autocompletado. `notice` se asocia con `aria-describedby` y vive en una región `polite` |
| **Checkbox** | `label`, `checked`/`defaultChecked`, `error?`, `disabled` | `<input type="checkbox">` nativo dentro de `<label>` (la etiqueta es clicable y la casilla funciona con Espacio). Apariencia propia con `appearance:none`, área de 24 × 24 px, `aria-invalid` + `aria-describedby` |
| **Link** | `href`, `external?`, `newTab?` | Si `href` empieza por `/`, usa `next/link`; si no, `<a>`. Subrayado por defecto (no solo color). `newTab` → `target="_blank" rel="noopener noreferrer"`, más un icono `aria-hidden` y el texto oculto «(se abre en una pestaña nueva)». Foco con `outline` de 2 px |
| **Alert** | `variant: 'info' \| 'success' \| 'warning' \| 'error'`, `title?`, `children` | `error`/`warning` → `role="alert"`; `info`/`success` → `role="status"`. Icono propio por variante, más un prefijo oculto («Error:», «Aviso:», «Información:», «Éxito:»), para no depender solo del color |

- **Foco global:** `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px }`. Es visible en `forced-colors` y nunca queda oculto (2.4.11).
- **Estados en el catálogo:** normal, foco, error, deshabilitado y carga, a 360 px y en escritorio.

### Tokens de marca (extraídos del mockup; se ajustarán con el manual)
| Token | Valor | Uso |
|-------|-------|-----|
| `color.primary` | `#2E2CF5` | Botón primario, enlaces, etiquetas mono, panel de marca |
| `color.primary-hover` | `#2321C8` | Hover y activo |
| `color.primary-subtle` | `#EEEEFF` | Fondo de `Alert info` |
| `color.on-primary` | `#FFFFFF` | Texto sobre el primario |
| `color.on-primary-muted` | `#D5D5FF` | Texto secundario sobre el primario |
| `color.accent-orange` | `#FF7A1A` | Decorativo; texto encima solo en `ink` |
| `color.accent-teal` | `#3DDBB0` | Decorativo; texto encima solo en `ink` |
| `color.accent-pink` | `#FF8FCB` | Decorativo; texto encima solo en `ink` |
| `color.ink` | `#14142B` | Títulos y texto principal |
| `color.text-muted` | `#5E5E7A` | Texto de cuerpo secundario |
| `color.text-placeholder` | `#6E6E8A` | *Placeholder* |
| `color.border-control` | `#8A8AA3` | Borde de campos y casillas (más oscuro que el del mockup, para cumplir 3:1) |
| `color.border-subtle` | `#E4E4EE` | Separadores decorativos (no son borde de un control) |
| `color.surface` / `surface-subtle` | `#FFFFFF` / `#F4F4F8` | Fondos |
| `color.error` / `error-subtle` | `#C0262D` / `#FDECEC` | Error |
| `color.success` / `success-subtle` | `#166B40` / `#E8F6EE` | Éxito |
| `color.warning` / `warning-subtle` | `#8A4B00` / `#FFF4E5` | Aviso |
| `color.focus` | `#2E2CF5` (`#FFFFFF` sobre el primario) | Anillo de foco |
| `font.sans` | **Plus Jakarta Sans** (variable; 800 títulos, 400/500 cuerpo, 700 botones) | Títulos y cuerpo: geométrica, cercana al mockup |
| `font.mono` | **IBM Plex Mono** 500, mayúsculas, `letter-spacing: 0.12em` | Etiquetas («ACCESO DE ADMINISTRADOR») |
| `radius` | `sm 8` · `md 12` · `lg 16` (campos) · `xl 28` (tarjetas) · `full 9999` (botones, chips) | |
| `space` | Escala de 4 px: `1=4 … 2=8, 3=12, 4=16, 6=24, 8=32, 12=48, 16=64` | |
| `font-size` | `rem`: 0.75 · 0.875 · 1 · 1.125 · 1.5 · 2 · 3 (display) | Zoom del 200 % (CB-026) |

Las fuentes se cargan con `next/font/google`: se descargan en el build y se sirven desde el propio dominio, sin peticiones a Google en tiempo de ejecución, con `display: swap` y subconjunto `latin`. Exponen `--font-sans` y `--font-mono`, que referencian los tokens.

**Contraste (WCAG 2.x, calculado):**

| Par (texto / fondo) | Ratio | Exigido | |
|---------------------|-------|---------|---|
| `on-primary` / `primary` (botón, panel) | 7,5:1 | 4,5 | ✔ |
| `primary` / `surface` (enlaces, etiquetas, botón secundario) | 7,5:1 | 4,5 | ✔ |
| `on-primary-muted` / `primary` | 5,3:1 | 4,5 | ✔ |
| `ink` / `surface` | 18,0:1 | 4,5 | ✔ |
| `text-muted` / `surface` | 6,7:1 | 4,5 | ✔ |
| `text-placeholder` / `surface` | 4,9:1 | 4,5 | ✔ |
| `border-control` / `surface` (borde de control) | 3,4:1 | 3 | ✔ |
| `ink` / `accent-orange` · `accent-teal` · `accent-pink` | 6,9 · 10,3 · 8,6:1 | 4,5 | ✔ |
| `error` / `surface` · `error-subtle` | 5,9 · 5,1:1 | 4,5 | ✔ |
| `success` / `surface` · `success-subtle` | 6,5 · 5,9:1 | 4,5 | ✔ |
| `warning` / `warning-subtle` | 6,3:1 | 4,5 | ✔ |
| `primary` / `primary-subtle` | 6,6:1 | 4,5 | ✔ |
| **Prohibido:** blanco sobre `accent-orange` (2,6:1) | ✘ | | Regla: los acentos nunca llevan texto blanco |

Estos pares viven en `ui-tokens/src/contrast-pairs.ts` y una prueba unitaria los recalcula (CA-038). Un par nuevo sin ratio suficiente hace fallar `test`.

**Solo tokens (CA-037):** Stylelint con `declaration-strict-value` en los CSS Modules de `ui-web` y `apps/web` obliga a usar `var(--…)` (o `inherit`, `currentColor`, `transparent`, `0`) en color, fuente, radio, tamaño de fuente y espaciado.

## Contratos de API
Todos los esquemas viven en `packages/contracts` (objetos estrictos: un campo no declarado es un error de contrato) y se registran en `v1/registry.ts`.

| Método y ruta | Acceso | Petición | Respuestas | Hito |
|---------------|--------|----------|------------|------|
| `GET /v1/health` | Público, sin límite | — | 200 `HealthOk {status:"ok", checks:{database:"up"}}` · 503 `problem+json` `health/unavailable` + `checks:{database:"down"}` | 1 |
| `GET /v1/openapi.json`, `GET /v1/docs` | Público, solo si `API_DOCS_ENABLED` | — | 200 / 404 en producción | 1 |
| `GET /v1/auth/session` | Con sesión | — | 200 `SessionInfo {role: "admin" \| "buyer", expiresAt: ISO-8601}` · 401 | 2 |
| `POST /v1/auth/logout` | Público con sesión opcional (CB-015); CSRF si hay sesión válida | — | 204 + `Set-Cookie` que borra ambas cookies · 403 `auth/csrf-invalid` | 2 |

La 001 añade `POST /v1/auth/login` (con `@StrictRateLimit()`), que usa `OpenSession` y `PasswordHasher`.

**Error común (`problemSchema`, RFC 9457):** `{ type, title, status, detail, correlationId, errors? }`, con `Content-Type: application/problem+json`. `errors[]` = `{ path: "name", message, code }` (mensajes en español con el *locale* `es` de Zod 4).

**Catálogo `PROBLEM_TYPES`** (`type` como referencia URI relativa, exportado para la web):

| `type` | Estado | Cuándo |
|--------|--------|--------|
| `validation-error` | 400 | El esquema rechaza la entrada (incluye `errors[]`) |
| `malformed-request` | 400 | JSON inválido |
| `auth/unauthenticated` | 401 | Sin cookie, o cookie inválida, desconocida o revocada |
| `auth/session-expired` | 401 | Sesión válida pero `now ≥ expiresAt` |
| `auth/forbidden` | 403 | Rol insuficiente |
| `auth/csrf-invalid` | 403 | Falta el token CSRF, no coincide, u `Origin` no permitido |
| `not-found` | 404 | Ruta inexistente (incluida cualquier ruta fuera de `/v1`) |
| `payload-too-large` | 413 | Cuerpo > `BODY_LIMIT_KB` (100) |
| `rate-limit-exceeded` | 429 | Límite superado (+ `Retry-After`) |
| `internal-error` | 500 | Cualquier error no controlado; `detail` genérico |
| `health/unavailable` | 503 | La BD no responde |

**Cabeceras:**
- Petición: `X-Correlation-Id` (opcional) y `X-CSRF-Token`.
- Respuesta: `X-Correlation-Id`, `Retry-After` (429) y `Cache-Control: no-store` en todas las respuestas de la API.
- CORS expone `X-Correlation-Id` y `Retry-After`.

## Modelo de datos
```prisma
enum AccountStatus { ACTIVE DISABLED  @@map("account_status") }

model Role {
  id        String    @id @default(uuid(7)) @db.Uuid
  code      String    @unique @db.VarChar(32)    // "admin", "buyer"
  name      String    @db.VarChar(64)            // "administrador", "comprador"
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  accounts  Account[]
  @@map("role")
}

model Account {
  id           String        @id @default(uuid(7)) @db.Uuid
  roleId       String        @map("role_id") @db.Uuid
  role         Role          @relation(fields: [roleId], references: [id], onDelete: Restrict)
  status       AccountStatus @default(ACTIVE)
  passwordHash String        @map("password_hash")
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt    DateTime      @updatedAt @map("updated_at") @db.Timestamptz(3)
  sessions     Session[]
  @@index([roleId])
  @@map("account")
}

model Session {
  id            String    @id @default(uuid(7)) @db.Uuid
  tokenHash     String    @unique @map("token_hash") @db.Char(64)      // SHA-256 hex del token de la cookie
  csrfTokenHash String    @map("csrf_token_hash") @db.Char(64)
  accountId     String    @map("account_id") @db.Uuid
  account       Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  expiresAt     DateTime  @map("expires_at") @db.Timestamptz(3)
  revokedAt     DateTime? @map("revoked_at") @db.Timestamptz(3)
  @@index([accountId])
  @@index([expiresAt])
  @@map("session")
}

model RateLimitCounter {
  key       String   @id @db.VarChar(255)   // "<throttler>:<ip>[:<ruta>]"
  hits      Int
  expiresAt DateTime @map("expires_at") @db.Timestamptz(3)
  @@index([expiresAt])
  @@map("rate_limit_counter")
}
```

**Migraciones:**
- **Hito 1 — `…_roles_y_cuentas`:** `Role`, `Account` y `INSERT` de los roles `admin`/«administrador» y `buyer`/«comprador» con `ON CONFLICT (code) DO NOTHING`. Los roles son datos de referencia que toda BD necesita, así que van en la migración y no en la semilla.
- **Hito 2 — `…_sesiones`:** `Session`.
- **Hito 2 — `…_limite_peticiones`:** `RateLimitCounter`.

**Frontera con la 001:** añade en una migración propia `username` (único, comparado sin distinguir mayúsculas), `failedAttempts` y `lockedUntil` en `Account`, además del paso de semilla de `HaroldAdmin`.

**Limpieza:**
- Las filas caducadas de `rate_limit_counter` se reutilizan en el UPSERT y se borran de forma oportunista (1 % de los incrementos, `DELETE … WHERE expires_at < now() - interval '1 hour'`).
- Las sesiones caducadas se conservan para poder responder `session-expired`. La purga periódica (p. ej. más de 30 días) queda pendiente de la capa de tareas programadas; el volumen es despreciable en el MVP.

**Consultas clave:**
- Validar una sesión es una sola consulta: `Session` por `tokenHash` + `Account.status` + `Role.code`.
- Desactivar una cuenta: `UPDATE account` + `UPDATE session SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL`, en una sola transacción.

## Configuración (`.env.example`)
**Variables que ya existen en la raíz y se reutilizan:**
- `POSTGRES_*`, `STORAGE_*` y `MAILPIT_*`: infraestructura de la 000, sin cambios.
- `API_PORT=3001` y `WEB_PORT=3000`.
- `DATABASE_URL`.
- `SESSION_TTL_HOURS=8`.
- `ADMIN_INITIAL_PASSWORD` y `ADMIN_CONTACT_EMAIL`: las consume la 001. La 002 solo ofrece el mecanismo de semilla que las valida.

**Variables que añade la 002:** el resto de la tabla.

**No hay secreto de sesión ni de cookie** (`SESSION_SECRET`):
- La cookie lleva un token opaco aleatorio de 256 bits, que no se firma ni se cifra.
- Su validez se comprueba buscando su SHA-256 en la tabla `session`.
- El token CSRF también es aleatorio y se guarda hasheado en la sesión.
- Un secreto de firma solo añadiría otra pieza que rotar, sin ganancia de seguridad (ADR-007). Si más adelante hiciera falta firmar algo (p. ej. enlaces de recuperación de contraseña), se añadirá con su propio ADR.

| Variable | App | Por defecto / validación |
|----------|-----|--------------------------|
| `APP_ENV` | api, web | `development \| test \| ci \| production`. Gobierna los interruptores de seguridad (a diferencia de `NODE_ENV`, que gobierna el build) |
| `API_PORT`, `WEB_PORT` (existentes) | api, web | 3001 / 3000; enteros entre 1 y 65535 |
| `DATABASE_URL` (existente) | api | URL `postgresql://` obligatoria |
| `SESSION_TTL_HOURS` (existente) | api | 8; número **positivo, con decimales**, ≥ 1/60 (1 minuto). Para CA-028 se usa `0.0167` en pruebas. 0, negativo o no numérico → inválida (CB-004) |
| `LOG_LEVEL` | api | `fatal…trace`, por defecto `info` |
| `CORS_ALLOWED_ORIGINS` | api | Lista de URLs separada por comas; obligatoria |
| `TRUST_PROXY` | api | `false` \| número de saltos \| lista de CIDR; por defecto `false` |
| `BODY_LIMIT_KB` | api | 100 |
| `SESSION_COOKIE_DOMAIN` | api | Opcional; obligatoria con `APP_ENV=production` |
| `RATE_LIMIT_GLOBAL_PER_MIN`, `RATE_LIMIT_AUTH_PER_MIN` | api | 100 / 10; enteros > 0 |
| `PASSWORD_HASH_MEMORY_KIB`, `PASSWORD_HASH_ITERATIONS`, `PASSWORD_HASH_PARALLELISM` | api | 19456 / 4 / 1 (se calibran en el hito 2); por debajo del mínimo OWASP para esa `t` → inválida |
| `HEALTH_DB_TIMEOUT_MS` | api | 2000 (≤ 2500 para garantizar los ≤ 3 s) |
| `API_DOCS_ENABLED` | api | `true` fuera de producción; `true` + `production` → inválida |
| `API_INTERNAL_URL`, `API_PUBLIC_URL` | web | URLs obligatorias |
| `WEB_DEV_TOOLS_ENABLED` | web | `false`; `true` + `production` → inválida |

La tarea que crea `.env.example` en la 000 está en curso: la 002 **añade** estas variables en cada hito, sin sustituir el archivo.

## Integración continua (`.github/workflows/ci.yml`)
Disparadores: `pull_request` hacia `main` y `push` a `main`. `concurrency` por rama, con cancelación de la ejecución anterior. Node desde `.nvmrc`, pnpm por `packageManager` y caché del *store* de pnpm y de `.turbo`.

| Job | Pasos (nombres en español, visibles en el PR) | Depende de |
|-----|-----------------------------------------------|------------|
| `calidad` | Instalar (`--frozen-lockfile`) → Lint → Typecheck → Pruebas con cobertura (con un *service* `postgres` para las de integración) → Build → Verificar contrato (`contract:check`) → Migraciones inmutables → Migraciones sobre BD vacía (`db:migrate:deploy` dos veces + `migrate diff --exit-code`) | — |
| `seguridad` | gitleaks (`fetch-depth: 0`, `--redact`, todos los commits del PR) → Excepciones de auditoría vigentes → `pnpm audit --audit-level high` | — |
| `e2e` | Build → API + web con `APP_ENV=ci` y `WEB_DEV_TOOLS_ENABLED=true` → Playwright (chromium escritorio + viewport de 360 px) → sube el informe HTML como artefacto | `calidad` |
| `imagenes` | `docker buildx build --target prod` de api y web (caché `gha`) → arrancar la API y comprobar `/v1/health`, y que `whoami` ≠ `root` | `calidad` |

**Protección de rama (la configura el dueño en GitHub):** los checks `calidad`, `seguridad`, `e2e` e `imagenes` son obligatorios para fusionar.

## Impacto en lo existente
| Elemento | Cambio | Riesgo |
|----------|--------|--------|
| Archivos raíz de la 000 (`package.json`, `turbo.json`, `tsconfig.base.json`) | Nuevos scripts (`db:*`, `contract:*`, `test:e2e`) y tareas de Turborepo (`contract:generate` con `outputs`; `db:*` y `test:e2e` sin caché). Se activan `noUncheckedIndexedAccess` y otras banderas estrictas | Bajo: aún no hay código que compilar |
| `docker-compose.yml` y Dockerfiles (000, en curso) | Healthchecks de api/web, `depends_on: postgres (healthy)`, volumen con nombre para `node_modules` (evita binarios de Windows dentro de Linux), `WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING` para la recarga en caliente en Windows, `prisma generate` en el build y `output: 'standalone'` en Next | Medio: depende de que la 000 haya cerrado sus tareas de Docker. Si no, la 002 las completa en el hito 1 sin cambiar la estructura |
| `.env.example` (000, en curso) | Se añaden las variables de la tabla anterior | Bajo; hay que coordinarse con la tarea en curso |
| Carpetas de módulos de la 000 | Se usan `users`; se añaden `auth`, `health` y `docs`; `shared/` se llena con config, errores… Los demás módulos (`catalog`, `payments`…) quedan intactos | Ninguno |
| `packages/config` (README de la 000) | Pasa a contener los presets de ESLint, tsconfig, Vitest y Stylelint | Ninguno |
| README de `packages/*` de la 000 (usan `@repo/*` como provisional) | Se actualizan a `@perchados/*` en la misma tarea que crea el `package.json` de cada paquete | Ninguno; solo documentación |
| `packages/ui-web` | **Paquete nuevo** (no estaba en la 000). La 000 solo preveía `ui-tokens`; los componentes React web necesitan su propio paquete | Bajo; se documenta en el README raíz |
| `specs/01-arquitectura/stack.md` | Se completan Autenticación, Logging, Pruebas y Design system web, enlazando ADR-007/008/009 | Ninguno |
| `specs/02-memoria/registro-componentes.md` | Altas de todo lo listado en «Reutilización» | Ninguno |
| Skills (ADR-004) | Se crean `api-rest-conventions` (problem+json, `/v1`, guards, validación, rate limit) y `prisma-datos` (migraciones, `@@map` snake_case, `uuid(7)`, semillas) | Ninguno |
| `CLAUDE.md` raíz | Comandos de build, test, e2e, BD y contrato en «Estado actual» | Ninguno |
| Spec 001 | Sin cambios: consume `OpenSession`, `PasswordHasher.verify/verifyDummy`, `@StrictRateLimit`, `@Roles('admin')`, `PROBLEM_TYPES['auth/session-expired']`, `PasswordField` (con `notice` para Bloq Mayús), `Button` (`loading`) y `Alert` | — |

No hay código de aplicación previo, así que no hay riesgo de regresión funcional. Es una funcionalidad horizontal: crear infraestructura es precisamente su objetivo.

## Decisiones técnicas
- **ADR-007 (propuesta) — Sesión y contraseñas:**
  - Sesión en servidor (PostgreSQL) con cookie opaca HttpOnly, en lugar de JWT.
  - Hash argon2id con `@node-rs/argon2`, en lugar de bcrypt.
  - CSRF con token sincronizador ligado a la sesión, más la comprobación de `Origin`.
  - Topología de cookies entre web y API.
- **ADR-008 (propuesta) — Herramientas transversales de la API y de la CI:**
  - pino (`nestjs-pino`) para los logs y Zod para la configuración.
  - `zod-to-openapi`, `openapi-typescript` y `openapi-fetch` para el contrato.
  - Vitest como único ejecutor de pruebas.
  - `@nestjs/throttler` con un almacén PostgreSQL.
  - gitleaks y `pnpm audit` para los escaneos.
- **ADR-009 (propuesta) — Design system web:**
  - `ui-tokens` en TS que genera variables CSS, y CSS Modules.
  - HTML nativo, sin librería de componentes.
  - Plus Jakarta Sans e IBM Plex Mono.
  - Catálogo propio en lugar de Storybook.
  - axe en Vitest y en Playwright.
- **Desviación menor de los hitos, a aprobar:** los modelos `Role`/`Account` (RF-026) entran en el **hito 1**, porque CA-022 necesita al menos una migración real. Su comportamiento (RF-020 a RF-025) sigue en el hito 2.

## Requisitos por plataforma (ADR-006)
**Web**
- Design system propio (`ui-web`); la página inicial y el catálogo solo usan sus componentes.
- WCAG 2.2 AA según la tabla de componentes, el contraste calculado, el foco con `outline` y el área táctil ≥ 24 px (botones de 48 px).
- **Presupuesto:** LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1, JS inicial ≤ 200 KB gzip.
  - Sin librerías de UI ni CSS-in-JS en tiempo de ejecución.
  - `openapi-fetch` pesa ≈ 6 KB.
  - Fuentes autoalojadas con `swap` y `size-adjust` de `next/font` (evita CLS).
  - La página inicial es un Server Component; `ApiStatus` se renderiza en el servidor.
  - El hito 3 mide con Lighthouse (MCP de Playwright, perfil móvil) y anota el resultado en el PR.
- **CSP con nonce** generada en `proxy.ts`: `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' <API_PUBLIC_URL>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`. En desarrollo se añade `'unsafe-eval'`.
- **Otras cabeceras:** `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

**API**
- **Rutas y errores:** `/v1` con contrato en `packages/contracts`; errores `problem+json` según el catálogo anterior.
- **Migraciones:** las 3 descritas.
- **Rate limits:**
  - 100/min por IP (global).
  - 10/min por IP adicional en las rutas `@StrictRateLimit()` (auth; la 001 lo aplica al login; checkout y webhooks lo usarán cuando lleguen).
  - `/v1/health` excluido.
- **Cabeceras con helmet:** `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (relajada solo en `/v1/docs` fuera de producción), HSTS (si `APP_ENV=production`), `nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site` y sin `X-Powered-By`.

**Móvil:** no aplica (fuera de alcance). La sesión opaca se podrá transportar en `Authorization: Bearer` cuando llegue la app (ADR-007), sin cambiar el modelo.

**Integraciones:** no aplica. La única dependencia externa en tiempo de ejecución es PostgreSQL: tiempo máximo de conexión de 2 s en el *pool* de `adapter-pg` y `HEALTH_DB_TIMEOUT_MS`. Las alertas quedan aplazadas (decisión del dueño); los errores se registran en nivel `error` con `correlationId`.

## Seguridad y privacidad
- **A01:** todas las rutas son privadas por defecto (guard global). `@Public` es explícito y lo revisa el `revisor`. Una prueba de integración enumera las rutas públicas y falla si aparece una nueva sin añadirla a la lista blanca de la prueba.
- **A02:**
  - argon2id con parámetros ≥ OWASP.
  - Token de sesión de 256 bits, guardado solo como SHA-256: una fuga de la BD no permite suplantar sesiones.
  - Cookies `Secure` fuera del entorno local.
  - HSTS.
- **A03:** Zod en el borde; Prisma parametrizado. El único SQL crudo (el UPSERT del limitador) usa `$executeRaw` con plantilla etiquetada.
- **A05:**
  - CORS con lista cerrada.
  - Cabeceras de seguridad en la API y en la web.
  - OpenAPI y catálogo desactivados en producción por configuración validada.
  - Errores sin trazas.
- **A07:**
  - Caducidad absoluta de 8 h; revocación inmediata.
  - El identificador de sesión se rota en cada login (CB-014).
  - 10/min en auth.
  - Comparaciones en tiempo constante.
  - `verifyDummy` contra la enumeración de cuentas (CB-011).
- **A09:** logs JSON con `correlationId` y saneado por claves; sin cuerpos ni *query strings*.
- **Secretos:**
  - Solo en variables de entorno.
  - gitleaks en la CI.
  - La semilla nunca imprime valores.
  - La configuración inválida nombra la variable, nunca el valor.
- **Datos personales:** la sesión no guarda IP ni *user agent* (minimización). Si la auditoría de la 001 los necesita, los decidirá su diseño.
- ⚠️ **Revisión humana obligatoria** en el hito 2: `apps/api/src/modules/auth/**`, `apps/api/src/shared/rate-limit/**` y `apps/api/src/shared/http/**`.

## Estrategia de pruebas
| Nivel | Herramienta | Qué cubre (CA / CB) |
|-------|-------------|---------------------|
| Unitarias API | Vitest (+ `unplugin-swc` para los decoradores) | `sanitize()` (CA-019, CB-008), validación de correlación (CB-007), `env.schema` (CA-021, CB-003, CB-004), mapeo de problemas, `Session.isExpired` con un `Clock` falso (CA-027, CA-028, CB-017), `Argon2idPasswordHasher` (CA-025, CB-012; con parámetros reducidos en las pruebas, salvo una que comprueba los de producción), *runner* de semillas con pasos de prueba (CA-023, CA-024) y validación de los mínimos OWASP |
| Integración API | Vitest + `createTestApp` (Nest completo) + supertest + PostgreSQL real (*service* de CI o compose local; BD `perchados_test`, truncado entre pruebas, ejecución secuencial) | CA-001 (404 fuera de `/v1`), CA-011, CA-016, CA-017, CA-018, CA-020, CA-022, CA-026, CA-029 a CA-036, CA-050, CA-051 (el probe apunta a un puerto cerrado), CB-001, CB-009, CB-010, CB-013 a CB-016, CB-018 a CB-022. Las rutas de prueba (`test-routes.controller.ts`: ruta con `name` obligatorio, ruta que lanza, ruta `@Roles('admin')`, ruta `@StrictRateLimit` con límite 5) solo existen en el módulo de prueba |
| Contrato | Ajv + `v1.json` | CA-012, CA-012b, CA-015, cobertura de rutas; `contract:check` (CA-013); CA-014 se demuestra con `typecheck` de la web |
| Unitarias UI | Vitest + Testing Library + `user-event` + `vitest-axe` (jsdom) | CA-039 a CA-045, CA-046 (excepto contraste), CB-023 a CB-025 |
| Tokens | Vitest | CA-038 (pares de contraste), CA-037 (Stylelint en `lint`) |
| E2E | Playwright + `@axe-core/playwright` | CA-002, CA-047, CA-048, CA-049 (con una prueba de muestra controlada por variable que falla en el primer intento, ejecutada en un job manual), CA-046 de contraste en el catálogo, CB-026 (zoom del 200 % con `deviceScaleFactor` y viewport reducido), CB-027 (`forcedColors: 'active'`) |
| CI y Docker (comprobación manual en el PR del hito) | GitHub Actions y Docker | CA-003 a CA-010 y CB-005, CB-006, CB-028 a CB-030, con PR de demostración (migración alterada, secreto de prueba con formato reconocible en una rama desechable, dependencia vulnerable) que se cierran sin fusionar |

- **Cobertura:** 80 % de líneas por paquete. Las pruebas E2E no cuentan para la cobertura.
- **Nombres:** cada prueba lleva en el título el ID `CA-0xx`/`CB-0xx`.

## Riesgos
| Riesgo | Mitigación |
|--------|------------|
| Versiones distintas de las previstas (Next 16 `proxy.ts`, Prisma 7 + `adapter-pg`, Zod 4 con `zod-to-openapi`, firma de `ThrottlerStorage` en throttler 6) | Verificar con Context7 en la primera tarea de cada hito; los cambios de API son locales a un archivo |
| Recarga en caliente lenta o rota con volúmenes de Windows en Docker | Polling en compose; recomendar el repositorio dentro de WSL2; `node_modules` en un volumen con nombre |
| Binarios nativos (`@node-rs/argon2`) compilados para el sistema equivocado | Paquetes precompilados por plataforma; instalación dentro del contenedor; sin `node-gyp` |
| Coste de memoria de argon2 bajo concurrencia | 19 MiB por hash (no 64 MiB); límite de 10/min en auth; calibrar con `pnpm --filter @perchados/api bench:hash` en el hito 2 (objetivo de 100 a 500 ms) |
| Escritura en PostgreSQL por cada petición (limitador) | Volumen del MVP bajo; el healthcheck está exento; si crece, se sustituye el almacén por Redis tras el mismo puerto (`ThrottlerStorage`), con un ADR nuevo |
| Las llamadas del servidor Next a la API comparten IP | `TRUST_PROXY` con la red interna, y la web reenvía `X-Forwarded-For` |
| La CSP con nonce obliga al renderizado dinámico | Aceptable ahora (página inicial y panel dinámicos); se revisa en la rebanada de catálogo (ISR) con un ADR si hay que relajarla |
| Despliegue con web y API en dominios registrables distintos rompería `SameSite=Strict` | Restricción documentada en ADR-007; el despliegue (CD) está fuera de alcance y la tendrá en cuenta |
| Colores aproximados a partir de un PNG | Tokens centralizados; cambiar un valor actualiza todo (CA-037); se ajustan con el manual de marca |
| CI > 15 min | Jobs en paralelo, caché de Turborepo y pnpm, solo chromium en la E2E |
| RF-037 menciona pruebas visuales, pero la regresión visual está fuera de alcance | El catálogo queda listo para las capturas; en la 002 la verificación visual es manual con el MCP de Playwright |

## Decisiones del dueño en la aprobación (15-10-2026)
- **Colores de marca validados** tal como están en la tabla de tokens: primario `#2E2CF5`; acentos `#FF7A1A`, `#3DDBB0` y `#FF8FCB`; texto `#14142B`. Incluye el borde `#8A8AA3`, más oscuro que en el mockup, para cumplir 3:1. Se ajustarán cuando exista un manual de marca.
- **Desviación aceptada:** los modelos `Role` y `Account` se crean en el hito 1 con la primera migración. El comportamiento de autenticación (RF-020 a RF-025) sigue en el hito 2.
