---
name: api-rest-conventions
description: Convenciones REST de apps/api verificadas en la 001: contrato primero (zod-to-openapi, contract:generate/check), /v1, errores problem+json (ProblemException, catálogo PROBLEM_TYPES, extensions), validación con @ZodBody, guards globales y su orden (RateLimit, Session, Roles, Csrf), decoradores @Public/@OriginOnly/@StrictRateLimit/@SkipRateLimit/@Roles, lista blanca de rutas públicas, PENDING_ROUTES, cabeceras de seguridad, correlación, logs sin secretos y pruebas de contrato con ContractMatcher. Úsala al crear o modificar cualquier endpoint de apps/api.
user-invocable: false
---

# Convenciones REST en `apps/api`

Complementa `nestjs-hexagonal` (capas) y `requisitos-plataforma` (sección API). Los ejemplos son documentación, no código del repositorio. Antes de crear algo busca en `specs/02-memoria/registro-componentes.md`.

## 1. Contrato primero
El esquema vive en `packages/contracts` (Zod 4 + `@asteasolutions/zod-to-openapi`) y se define **en la primera tarea**, antes del controlador.
1. Esquemas en `packages/contracts/src/<área>/*.schemas.ts` (importan `../common/zod-openapi`); se registran con `registry.register(...)` y `registry.registerPath(...)` en `src/v1/registry.ts`.
2. `pnpm contract:generate` regenera `packages/contracts/openapi/v1.json` y los tipos de `packages/api-client/src/generated/v1.ts`; se versionan ambos.
3. `pnpm contract:check` falla si cualquiera está desactualizado (lo ejecuta el job `calidad` de CI).
4. La API importa los esquemas de `@perchados/contracts`; **no redefine DTOs**. La web usa la entrada ligera `@perchados/contracts/client` (sin `zod-to-openapi`).
5. Toda ruta documentada debe existir y viceversa: `test/contract/route-coverage.spec.ts`. Mientras una ruta esté documentada pero sin implementar, se lista en `PENDING_ROUTES` (`{ 'POST /v1/x': 'T-nn' }`) y **cada tarea borra su entrada al implementarla** (una pendiente que ya existe hace fallar la prueba).

```ts
// ❌ DTO propio en la API, ruta sin registrar en el contrato
class CreateXDto { name: string }
// ✅ El esquema nace en contracts, se registra y se genera
registry.registerPath({ method: 'post', path: '/v1/x', request: { body: ... }, responses: { 201: ..., 400: problemResponse } });
// pnpm contract:generate && pnpm contract:check
```

## 2. Versionado y arranque
- Todo bajo `/v1` (`configureApp` aplica versionado por URI, `DEFAULT_API_VERSION`). `@Controller('auth')` ya sale como `/v1/auth`; **no** pongas `v1/` en el decorador. Un cambio incompatible: `@Controller({ path, version: '2' })` y convivencia.
- `configureApp(app, { bodyLimitKb, corsAllowedOrigins, trustProxy, hsts })` registra, en este orden: `trust proxy`, cabeceras de seguridad (helmet; la opción es `hsts`), correlación, CORS, límite de cuerpo (`bodyLimitKb`), filtro `problem+json`, `NoStoreInterceptor` y versionado URI. Las pruebas usan `createTestApp`, que pasa por el mismo `configureApp`.

## 3. Errores `problem+json`
- Todo error es `application/problem+json` con `type`, `title`, `status`, `detail` y `correlationId`; `Cache-Control: no-store`. El 5xx se registra con traza pero **no** se expone.
- El `type` sale del catálogo `PROBLEM_TYPES` (`@perchados/contracts`): `validation-error`, `auth/invalid-credentials`, `auth/unauthenticated`, `auth/session-expired`, `auth/forbidden`, `auth/csrf-invalid`, `auth/account-locked`, `rate-limit-exceeded`, `not-found`, `internal-error`, `health/unavailable`… Un tipo nuevo se añade **al catálogo y a `PROBLEM_DEFAULTS`** (estado, título, detalle) y al contrato.
- Campos extra con `extensions` (no pisan los base): `new ProblemException({ type: PROBLEM_TYPES.accountLocked, extensions: { lockedMinutesRemaining: 12 } })`. Declara la extensión en el esquema de la respuesta del contrato.
- Los casos de uso devuelven resultados tipados; el **controlador** los traduce a `ProblemException` (el dominio no conoce HTTP).

```ts
// ❌ Respuesta ad hoc, mensaje que revela si la cuenta existe
throw new HttpException('El usuario no existe', 404);
// ✅ Mismo problema para todos los fallos de credenciales
throw new ProblemException({ type: PROBLEM_TYPES.invalidCredentials });
```

## 4. Validación de entradas
`@ZodBody(schema)` valida el cuerpo con el esquema de contracts. Si falla: 400 `validation-error` con `errors[]` por campo (**sin valores**, nunca la contraseña). Cuerpos mal formados o demasiado grandes los resuelve el filtro (`malformed-request`, `payload-too-large`).

```ts
// ❌ @Body() any y sin validar
@Post('login') login(@Body() body: any) {}
// ✅
@Post('login') login(@ZodBody(loginRequestSchema) body: LoginRequest) {}
```

## 5. Guards globales y decoradores
Los cuatro son `APP_GUARD` registrados en `AuthModule` **en este orden** (no lo alteres):

| # | Guard | Qué hace | Decorador |
|---|-------|----------|-----------|
| 1 | `RateLimitGuard` | Límite `global` por IP (`RATE_LIMIT_GLOBAL_PER_MIN`) y `strict` por IP y ruta (`RATE_LIMIT_AUTH_PER_MIN`); 429 con `Retry-After` | `@StrictRateLimit()` activa el estricto; `@SkipRateLimit()` exime (health) |
| 2 | `SessionGuard` | **Privado por defecto**: sin `@Public()` exige sesión válida (401 `auth/unauthenticated` o `auth/session-expired`) y adjunta `request.authSession` | `@Public()` (import de `shared/http/public.decorator`, no de auth); `@CurrentSession()` |
| 3 | `RolesGuard` | Con `@Roles(...)` compara el rol **leído de la BD en cada petición**; falla cerrado; 403 `auth/forbidden` | `@Roles(ADMIN_ROLE_CODE)` |
| 4 | `CsrfGuard` | En POST/PUT/PATCH/DELETE: `Origin` fuera de `CORS_ALLOWED_ORIGINS` → 403 `auth/csrf-invalid`; con sesión vigente exige `X-CSRF-Token` (comparación en tiempo constante) | `@OriginOnly()` omite el token y conserva la comprobación de Origin (solo login) |

- Una ruta nueva del panel: **no pongas nada de sesión**, solo `@Roles(ADMIN_ROLE_CODE)`; el token CSRF ya se exige.
- Un endpoint sensible a fuerza bruta lleva `@StrictRateLimit()` (login, logout; checkout y webhooks cuando existan).
- **Lista blanca de rutas públicas:** `test/integration/public-routes.spec.ts` (`EXPECTED_PUBLIC_ROUTES`) enumera exactamente `AuthController.login`, `AuthController.logout` y `HealthController.get`. Añadir un `@Public()` exige decisión de diseño y editar esa lista a propósito (RT-013, OWASP A01).
- Las cookies las gestiona `SessionCookies` (`perchados_sid` HttpOnly, `perchados_csrf` legible por JS; `__Secure-` y `Secure` fuera de development/test). No escribas cookies a mano.

```ts
// ❌ Ruta de admin pública "temporalmente" y comprobación de rol a mano
@Public() @Get('stats') stats(@Req() r) { if (r.user.role !== 'admin') ... }
// ✅ Privada por defecto; rol por decorador
@Roles(ADMIN_ROLE_CODE) @Get('stats') stats(@CurrentSession() s: ValidSession) {}
```

## 6. Cabeceras de seguridad y caché
- `securityHeaders` (helmet): CSP `default-src 'none'; frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, COOP/CORP `same-origin`, sin `X-Powered-By`; HSTS solo con `hsts: true` (producción).
- `Cache-Control: no-store` en toda respuesta (interceptor + filtro). CORS: lista cerrada, credenciales, `maxAge` 600.
- Detrás de un proxy, `TRUST_PROXY` decide qué IP ve el límite de peticiones; por defecto `false`.

## 7. Correlación y logs
- `X-Correlation-Id`: se reutiliza si cumple `^[A-Za-z0-9._-]{1,128}$` (`CORRELATION_ID_PATTERN` de contracts); si no, UUID. `req.id` es el `correlationId` del problema y de cada log.
- Logs pino JSON de una línea con `level`, `time`, `msg`, `correlationId`. `sanitize()` oculta password/token/cookie/authorization/secret a cualquier profundidad; **nunca** registres usuario, contraseña, token de sesión ni cookies. La auditoría registra `event`, `reason` y `accountId`.
- Una integración externa que falla registra `error` con `integration` y `correlationId`.
- Las pruebas que inspeccionan logs usan `createTestApp` (`t.records()`); una app por archivo (el logger raíz de pino es compartido).

```ts
// ❌
logger.info(`login de ${username} con ${password}`);
// ✅
this.audit.record({ name: 'auth.login.failed', reason: 'invalid-credentials' });
```

## 8. Pruebas de contrato y de integración
- Integración: `createTestApp()` (app real contra la BD de la ejecución) + `supertest` sobre `t.server`; `beforeEach(t.reset)`, `afterAll(t.close)`.
- Contrato: `ContractMatcher` (`test/contract/contract-matcher.ts`) valida con Ajv estado, `content-type`, cuerpo y cabeceras contra `openapi/v1.json`. Cada ruta nueva prueba **todas** sus respuestas documentadas (éxito y problemas 400/401/403/429…).
- Los tiempos se controlan con un `Clock` falso o moviendo columnas en la BD; nunca `sleep`.

```ts
const res = await request(t.server).post('/v1/auth/login').send(body);
expect(res.status).toBe(401);
expect(matcher.check({ method: 'post', path: '/v1/auth/login',
  response: { status: 401, headers: res.headers, body: res.body } })).toEqual([]);
```

## Checklist de un endpoint nuevo
1. Esquema + `registerPath` en contracts → `pnpm contract:generate` → `pnpm contract:check`.
2. Quitar su entrada de `PENDING_ROUTES` si estaba.
3. Controlador fino con `@ZodBody`; decoradores de guard correctos; caso de uso en `application`.
4. Errores solo con `ProblemException` + `PROBLEM_TYPES`.
5. Pruebas de integración y de contrato de cada respuesta; actualizar la lista blanca solo si añade una ruta pública (con aprobación).
6. Registrar lo reutilizable en `registro-componentes.md`.
