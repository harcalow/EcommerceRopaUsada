---
id: 001
spec: ./spec.md
estado: cumplida # borrador | aprobada | cumplida — aprobada por el dueño (Harold) el 2026-10-18 tras los hallazgos de la etapa 6 (ADR-011, ADR-012); cumplida en /archivar 001 (2026-10-18)
autor: arquitecto
adr: [ADR-001, ADR-003, ADR-006, ADR-007, ADR-008, ADR-009, ADR-010, ADR-011, ADR-012]
---

# Diseño 001 — Login de administrador (incluye la base técnica)

## Resumen de la solución
Por decisión del dueño (15-10-2026, ADR-010 en `propuesta`), la 001 es la **única funcionalidad** del proyecto. Su diseño incluye la base técnica que antes estaba en las horizontales 000 (estructura y Docker) y 002 (fundaciones). La base técnica **no** se añade a `spec.md`: se traza aquí como **requisitos técnicos de base (RT-xxx)**, derivados de los RNF de la spec, de ADR-001 a ADR-009 y de la Definition of Done de `CLAUDE.md`.

La entrega va en **4 hitos** sobre la base ya construida (hito 0). Cada hito tiene su propio PR y es demostrable:

| Hito | Contenido | Entregable demostrable |
|------|-----------|------------------------|
| **0 — Base existente** (hecho) | Archivos raíz del monorepo, estructura de `apps/` y `packages/`, Docker Compose (postgres, storage, mailpit), Dockerfiles multi-stage, `.env.example` y skills de convenciones | `pnpm infra:up` deja la infraestructura en `healthy` |
| **1 — Base y calidad** | Arranque del workspace (Turborepo y presets instalados), `apps/api` NestJS con `/v1`, `apps/web` Next.js, contrato Zod → OpenAPI → cliente, `problem+json`, correlación y logs JSON, configuración validada, Prisma con la migración de roles y cuentas, *runner* de semillas, `GET /v1/health`, Docker con las apps reales y CI (calidad y seguridad) | `pnpm dev`, `pnpm test`, `pnpm lint` y `pnpm typecheck` en verde desde la raíz; `/v1/health` en 200/503; CI en verde |
| **2 — Autenticación (API)** ⚠️ revisión humana | Contrato auth, hash argon2id, semilla de `HaroldAdmin`, sesión en servidor, guards (sesión, rol, CSRF), límite de peticiones, bloqueo tras 5 fallos y `POST /v1/auth/login` | Login, sesión y cierre funcionando por API con pruebas de integración de los CA y CB de la spec |
| **3 — Interfaz web** | Tokens de marca, componentes accesibles que usa la pantalla (Button, TextField, PasswordField, Link, Alert), cabeceras y CSP de la web, pantalla de login según el mockup, panel «Próximamente» protegido y cierre de sesión | Flujo completo en el navegador |
| **4 — E2E y cierre** | Playwright con Page Objects del login y del panel, un E2E por escenario Gherkin, accesibilidad automática, job `e2e` en CI, medición de rendimiento y registro de componentes | Suite E2E en verde en la CI; informe HTML por escenario |

**Principios:** lo mínimo que cumple la spec y la DoD. Sin servicios nuevos en Docker (no hay Redis). HTML nativo en lugar de librerías de componentes. Un único lenguaje de esquemas (Zod) para la validación, la configuración y el contrato.

> **Versiones:** Context7 no estaba disponible para este subagente al diseñar. Las versiones citadas (Next.js 16, NestJS 11, Prisma 7, Zod 4, `@nestjs/throttler` 6, pino) son las esperadas a octubre de 2026 y **se verifican con Context7 en la primera tarea de cada hito**. Si una API difiere (p. ej. `proxy.ts` frente a `middleware.ts` en Next.js, o la firma de `ThrottlerStorage`), se adapta el archivo afectado sin cambiar el diseño.

## Requisitos técnicos de base (RT-xxx)
No son requisitos de producto: son las condiciones técnicas que el login y la Definition of Done necesitan. Cada uno tiene su verificación y su origen.

| ID | Requisito técnico | Cómo se verifica | Origen |
|----|-------------------|------------------|--------|
| RT-001 | **Comandos únicos** desde la raíz: `dev`, `build`, `test`, `lint`, `typecheck`, `db:migrate`, `db:migrate:deploy`, `db:seed`, `contract:generate`, `contract:check` y `test:e2e`, ejecutados vía Turborepo en cada app y paquete que los define | Cada comando termina con 0 en un repo limpio tras `pnpm install --frozen-lockfile`; hoy `pnpm test` falla con «turbo not found» | ADR-001; CLAUDE.md (Comandos) |
| RT-002 | **TypeScript estricto** (`strict`, `noUncheckedIndexedAccess`) y **ESLint** (`typescript-eslint` `strictTypeChecked`, `jsx-a11y` en la web, `no-explicit-any`, reglas de capas hexagonales con `no-restricted-imports`) | Un error de tipos o de lint de muestra hace fallar el comando con archivo y línea; `domain/` que importa `@nestjs/*` falla | DoD (sin `any`, sin violar capas) |
| RT-003 | **Cobertura ≥ 80 % de líneas** por paquete (Vitest + `@vitest/coverage-v8`), con exclusiones documentadas (código generado, `*.config.*`, `main.ts`, `*.module.ts`, migraciones) | Una cobertura de muestra por debajo del umbral hace fallar `test` nombrando el paquete y el porcentaje | DoD (pruebas); decisión del dueño del 15-10-2026 |
| RT-004 | **Contrato primero:** los esquemas viven una sola vez en Zod en `packages/contracts`; se genera `openapi/v1.json` (versionado) y el cliente tipado `packages/api-client`; la web solo llama a la API con ese cliente | `contract:check` falla si el cliente o el documento no están al día; pruebas de contrato con Ajv validan las respuestas reales; una ruta de Nest sin entrada en el documento falla. **Excepción acotada (ADR-012):** ver «Excepción a RT-004: esquemas de navegador» | ADR-006 (API), ADR-008, ADR-012 |
| RT-005 | **API versionada y errores uniformes:** todas las rutas bajo `/v1`; todo error es `application/problem+json` con `type`, `title`, `status`, `detail` y `correlationId`; los 500 no revelan detalles internos | Integración: ruta fuera de `/v1` → 404 `problem+json`; cuerpo inválido → 400 con `errors[]`; error no controlado → 500 sin traza (que sí aparece en el log) | ADR-006 (API); DoD |
| RT-006 | **Correlación y logs JSON:** id de correlación por petición (se reutiliza si es válido, `^[A-Za-z0-9._-]{1,128}$`), cabecera `X-Correlation-Id`, logs pino de una línea con nivel, mensaje y `correlationId`; contraseñas, cookies, tokens y `Authorization` ocultos | Integración capturando stdout: mismo id en cabecera y logs; la contraseña de prueba y la cookie no aparecen; `LOG_LEVEL=warn` sin líneas `info` | DoD (logs); RNF Seguridad («las contraseñas nunca se registran») |
| RT-007 | **Configuración validada al arrancar** (API y servidor web) con Zod: si falta o es inválida una variable, el proceso sale con código ≠ 0 y nombra la variable sin mostrar su valor | Unitarias del esquema: falta `DATABASE_URL`, URL mal formada, `SESSION_TTL_HOURS` = 0, negativo o texto | DoD (secretos solo en variables de entorno); ADR-008 |
| RT-008 | **Prisma y migraciones versionadas:** una migración por cambio; `db:migrate:deploy` es idempotente; una migración fusionada en `main` no se modifica | `db:migrate:deploy` dos veces sobre BD vacía → la segunda no aplica nada; la CI falla si un PR modifica una migración de `main` o hay deriva esquema/migraciones | ADR-006 (API); RF-018 |
| RT-009 | **Semilla idempotente y transaccional** que lee los valores sensibles solo del entorno y valida todas las variables antes de escribir | Dos ejecuciones crean los datos una vez; sin la variable sale con ≠ 0, la nombra y no deja datos parciales; la salida no contiene valores sensibles | Spec «Datos iniciales»; RF-019 |
| RT-010 | **Hash argon2id** con parámetros ≥ OWASP (`m=19456 KiB, t=10, p=1`, calibrados en el hito 2; ver «Calibración de argon2id»), NFC antes de hashear, máximo 128 caracteres, `verifyDummy()` para igualar tiempos, rehash si los parámetros guardados son inferiores | Unitarias: dos hashes distintos, verificación sensible a mayúsculas, parámetros por debajo del mínimo → configuración inválida; `bench:hash` entre 100 y 500 ms (mediana) en el hardware donde se ejecuta; se repite en el hardware de producción antes del primer despliegue | RF-018; ADR-007; RNF Rendimiento (≤ 1 s p95) |
| RT-011 | **Sesión en servidor** con cookie opaca (`HttpOnly; SameSite=Strict; Path=/; Secure` fuera de local), token de 256 bits guardado solo como SHA-256, caducidad absoluta `SESSION_TTL_HOURS` (8) desde `createdAt`, revocación inmediata, identificador nuevo en cada login | Integración con `Clock` controlado: 7 h 59 min válida, 8 h 00 min → 401 `auth/session-expired`; tras logout la copia de la cookie da 401 | RF-012, RF-020; ADR-007 |
| RT-012 | **CSRF y CORS:** métodos no seguros con sesión exigen `X-CSRF-Token` (sincronizador); todo método no seguro con `Origin` no permitido → 403; CORS solo con `CORS_ALLOWED_ORIGINS` y credenciales | Integración: logout sin token → 403 sin cambios; login con `Origin` ajeno → 403 | ADR-007; RNF Seguridad |
| RT-013 | **Privado por defecto y rol leído de la BD:** guards globales `ThrottlerGuard` → `SessionGuard` (`@Public()` lo exime) → `RolesGuard` (`@Roles('admin')` contra `role.code`) → `CsrfGuard` | Integración: ruta sin declarar → 401; cambiar el rol en BD cambia el resultado sin abrir sesión nueva; la lista de rutas `@Public` coincide con una lista blanca | RF-011, RF-023; RNF Permisos |
| RT-014 | **Límite de peticiones:** 100/min por IP global y 10/min por IP adicional en las rutas de auth (`@StrictRateLimit()`); almacén PostgreSQL (sobrevive a reinicios); 429 `problem+json` con `Retry-After`; `/v1/health` exento. **La IP que cuenta es la del cliente final** en los dos caminos (navegador → API y navegador → web → API), resuelta según RT-022 | Integración con límites reducidos: N+1 → 429; otra IP sigue atendida; el contador persiste tras recrear la app; agotar el cubo de una IP de cliente a través de la web no afecta a otra IP de cliente que llega por la web (RT-022) | ADR-006 (API); ADR-008; ADR-011 |
| RT-015 | **Cabeceras de seguridad:** API con helmet (`CSP default-src 'none'`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS en producción, sin `X-Powered-By`, `Cache-Control: no-store`); web con CSP con nonce y cabeceras equivalentes | Integración (API) y unitaria (web): cabeceras presentes; la pantalla de login carga sin violaciones de CSP | RNF Seguridad («conexión cifrada»); OWASP A05 |
| RT-016 | **Healthcheck** `GET /v1/health` público y sin límite: 200 con BD disponible, 503 `problem+json` en ≤ 3 s sin detalles internos; la API arranca sin BD y se recupera sin reiniciar | Integración: 200 / 503 con un *probe* a un puerto cerrado; Docker marca `api` como `unhealthy` con postgres parado | ADR-003; ADR-006 |
| RT-017 | **Docker con las apps reales:** perfil `apps` con `api` y `web` en `healthy` y recarga en caliente; etapa `prod` construible y sin root | `docker compose --profile apps up -d` → `healthy`; `whoami` ≠ `root` en `prod` | ADR-003 |
| RT-018 | **Design system accesible:** tokens de `packages/ui-tokens` como única fuente de estilo (Stylelint lo exige), pares de contraste recalculados en una prueba, y los componentes que usa el login con pruebas unitarias y axe en cada estado | Unitarias + `vitest-axe` sin violaciones; un hex literal en un `.module.css` hace fallar `lint`; un par con contraste insuficiente hace fallar `test` | ADR-009; RNF Accesibilidad; DoD Web |
| RT-019 | **E2E con Playwright:** un E2E por escenario Gherkin nombrado con su `CA-xxx`/`CB-xxx`, Page Objects, `data-testid` o roles, datos en `fixtures/`, máximo 1 reintento solo en CI y prueba que pasa al reintentar reportada como «inestable», informe HTML | `pnpm test:e2e` en verde; el informe agrupa por ID | ADR-006 (E2E); DoD |
| RT-020 | **CI** en GitHub Actions en cada PR a `main` y en cada push a `main`: instalación congelada, lint, typecheck, pruebas con cobertura (con PostgreSQL), build, `contract:check`, migraciones inmutables y sobre BD vacía, gitleaks sobre todos los commits del PR, `pnpm audit --audit-level high` y E2E | Pipeline en verde en el PR; un paso fallido marca el PR en rojo con el nombre del paso | CLAUDE.md (Seguridad: escaneo en CI); ADR-008 |
| RT-021 | **Presupuesto web de la pantalla de login:** LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1, JS inicial ≤ 200 KB gzip; respuesta del login ≤ 1 s (p95) | Lighthouse (perfil móvil) anotado en el PR; prueba de integración que mide la duración del login con los parámetros de producción del hash | RNF Rendimiento; ADR-006 (Web) |
| RT-022 | **IP del cliente no suplantable y confianza web → API** (ADR-011): (a) la web **nunca** reenvía el `X-Forwarded-For` que recibe; resuelve la IP del cliente con `WEB_TRUST_PROXY_HOPS` (la entrada `n`-ésima por la derecha de `X-Forwarded-For`, con la misma semántica que `trust proxy` de Express) y, si `WEB_TRUST_PROXY_HOPS = 0` o la cabecera falta o no es una IP válida, no envía IP; (b) la web la manda en `X-Perchados-Client-Ip` junto con `X-Perchados-Internal-Token` = `INTERNAL_API_SECRET`; (c) la API solo usa `X-Perchados-Client-Ip` como rastreador del límite si el token coincide (comparación en tiempo constante) y el valor es una IP válida; en cualquier otro caso usa `req.ip` (según `TRUST_PROXY`) e ignora la cabecera; (d) la API no confía en la web por red: `TRUST_PROXY` solo describe el proxy de borde que hay delante de la API; (e) con `APP_ENV=production`, `TRUST_PROXY ≠ false` y `WEB_TRUST_PROXY_HOPS ≥ 1` son obligatorias; (f) `X-Perchados-Internal-Token` se oculta en los logs y no se documenta en OpenAPI | **API, integración:** sin token o con token incorrecto, `X-Perchados-Client-Ip` se ignora (el cubo es el de `req.ip`); con token válido, IP A agota su cubo (N+1 → 429) y IP B, por el mismo socket, sigue en 200; valor no IP con token válido → se usa `req.ip`; el token no aparece en stdout. **API, unitarias de configuración:** falta `INTERNAL_API_SECRET` o < 32 caracteres → inválida; `production` con `TRUST_PROXY=false` → inválida. **Web, unitarias:** `resolveClientIp` con saltos 0, 1 y 2 y cabeceras ausentes, vacías, con espacios o no IP; `createServerApiClient` no reenvía `X-Forwarded-For`, envía las dos cabeceras solo con IP resuelta y siempre el token; la configuración de la web rechaza `production` con `WEB_TRUST_PROXY_HOPS=0`; el módulo es `server-only` (el secreto no llega al *bundle* del navegador) | Revisión etapa 6 (DoS del panel); ADR-006 (API: límite por IP); OWASP A04/A05 |

## Cobertura de requisitos
| RF / CB | Cómo se resuelve | Hito |
|---------|------------------|------|
| RF-001 | `POST /v1/auth/login` con `LoginRequest {username, password}` → caso de uso `LogIn` (ver «Flujo de login»). Abre la sesión con `OpenSession` y fija las cookies | 2 |
| RF-002 | Tras un 200, la web hace `router.replace('/panel')`. `app/panel/page.tsx` muestra «Próximamente, estamos trabajando» (`data-testid="panel-coming-soon"`) | 3 |
| RF-003 | Validación en el cliente con `loginRequestSchema` de `packages/contracts` (mensajes en español) antes de enviar; error junto al campo con `TextField`/`PasswordField` (`aria-invalid`, `aria-describedby`, región `polite`). El foco va al primer campo con error. La API repite la validación (400 `validation-error`) | 3 (cliente), 2 (API) |
| RF-004 | Un único `type` `auth/invalid-credentials` (401) para usuario inexistente, contraseña incorrecta, cuenta desactivada y cuenta sin rol `admin`. La web lo muestra como `Alert` error «Usuario o contraseña incorrectos». Tiempos igualados con `verifyDummy()` | 2, 3 |
| RF-005 | `PasswordField` (oculto por defecto; botón «Mostrar contraseña» / «Ocultar contraseña») | 3 |
| RF-006 | `LoginForm` lee `event.getModifierState('CapsLock')` en `keydown`/`keyup` del campo contraseña y pasa el aviso «Bloq Mayús está activado» a `PasswordField.notice` (región `polite`) | 3 |
| RF-007 | Botón-enlace «¿Olvidaste tu contraseña?» (`<button aria-expanded aria-controls>`) que despliega un `Alert` info: «Escribe al responsable de la tienda a <correo>» con `Link` `mailto:`. El correo sale de `ADMIN_CONTACT_EMAIL` (configuración validada del servidor web), leído en el Server Component de la página. Sin campos ni envíos | 3 |
| RF-008 | Contador atómico en `account.failed_attempts`; al llegar a 5 fija `locked_until = now() + 30 min` (hora de la BD). Mientras dure: 423 `auth/account-locked` con `lockedMinutesRemaining`. La web muestra «Demasiados intentos. Vuelve a intentarlo en N minutos» (N = 30 en el quinto fallo, CA-007) | 2, 3 |
| RF-009 | Un login correcto pone `failed_attempts = 0` y `locked_until = NULL` en la misma transacción que abre la sesión | 2 |
| RF-010 | La pantalla no tiene ningún enlace ni ruta de registro; la API no expone creación de cuentas | 3 |
| RF-011 | Defensa doble: `proxy.ts` redirige `/panel/**` a `/login` si no hay cookie de sesión (optimista); `requireAdminSession()` en `app/panel/layout.tsx` y en cada página llama a `GET /v1/auth/session` desde el servidor y redirige a `/login` ante 401/403. La API protege todo por defecto (RT-013) | 3 |
| RF-012 | Botón «Cerrar sesión» en el panel → `POST /v1/auth/logout` (con `X-CSRF-Token`) → `window.location.replace('/login')`. Las páginas del panel se sirven con `Cache-Control: no-store` y un `SessionWatcher` revalida en `pageshow` (bfcache) | 2, 3 |
| RF-014 | `Button loading` (`aria-busy`, `aria-disabled`, anuncio «Verificando…») + un `ref` de envío en curso que descarta envíos repetidos | 3 |
| RF-015 | `usernameSchema`: `trim` → NFC → `^\p{L}+$` (Unicode, flag `u`); mensaje «El usuario solo puede tener letras». Vacío → «Escribe tu usuario». Máximo técnico de 64 caracteres (ver «Preguntas para el dueño») | 2 (contrato), 3 |
| RF-016 | `loginPasswordSchema`: mínimo 8 («La contraseña debe tener al menos 8 caracteres»), vacío → «Escribe tu contraseña», máximo 128 (ADR-007). Sin `trim` | 2 (contrato), 3 |
| RF-017 | Si `locked_until ≤ now()` al llegar un intento, el bloqueo se considera vencido: un fallo empieza un contador nuevo (`failed_attempts = 1`, `locked_until = NULL`) y un acierto entra y deja el contador en 0 | 2 |
| RF-018 | `Account.passwordHash` con argon2id (RT-010). Ninguna columna guarda la contraseña | 2 |
| RF-019 | Migración `roles_y_cuentas` inserta el rol `admin`/«administrador». Paso de semilla `admin-inicial`: lee `ADMIN_INITIAL_PASSWORD` (≥ 8 caracteres, si no, error que nombra la variable), crea `HaroldAdmin` con rol `admin` solo si no existe (`ON CONFLICT (username_key) DO NOTHING`): no duplica ni sobrescribe una contraseña cambiada | 1 (rol), 2 (cuenta) |
| RF-020 | `expiresAt = createdAt + SESSION_TTL_HOURS` (RT-011). 401 `auth/session-expired` → la web redirige a `/login?motivo=sesion-caducada`, que muestra `Alert` «Tu sesión ha caducado. Vuelve a iniciar sesión» | 2, 3 |
| RF-021 | Texto informativo del mockup bajo un separador, con icono de información `aria-hidden`: «Esta pantalla solo permite iniciar sesión. Las cuentas de administrador se crean fuera del panel y no hay registro público.» | 3 |
| RF-022 | El recuadro «Prueba el prototipo con…» del mockup no se implementa. Una prueba unitaria y un E2E comprueban que la página no contiene `admin`/`perchados2026` ni el usuario de la semilla. El *placeholder* del usuario es «Tu usuario» (no «ej. admin») | 3 |
| RF-023 | `RolesGuard` y `LogIn` leen `role.code` de la BD en cada petición; nada de roles fijos en el código salvo la constante del código de rol `admin` usada en `@Roles('admin')` | 2 |
| CB-001 | `usernameSchema` hace `trim`; la contraseña no se toca | 2 |
| CB-002 | Columna `username_key = lower(NFC(username))` única; la búsqueda usa la clave. La contraseña se compara tal cual | 2 |
| CB-003 | Mismo 401 `auth/invalid-credentials` y `verifyDummy()` | 2 |
| CB-004 | Tabla `login_attempt_unknown` (clave = `username_key`) que imita el contador y el bloqueo para usuarios inexistentes, sin crear cuentas: la respuesta (401 o 423) es indistinguible de la de una cuenta real (ver «Decisiones técnicas») | 2 |
| CB-005 | Con la cuenta bloqueada se ejecuta igualmente `verify` (tiempo constante) pero no se actualiza ninguna columna: el bloqueo no se alarga y responde 423 | 2 |
| CB-006 | El contador vive en la BD y se incrementa con un `UPDATE … RETURNING` atómico: todas las pestañas y dispositivos comparten contador | 2 |
| CB-007 | Error de red o *timeout* del cliente (10 s, `AbortSignal.timeout`) → `Alert` «No hay conexión, inténtalo de nuevo». La petición no llegó o no se completó: no se cuenta en la web; en la API un intento solo se cuenta si se procesó. El usuario escrito se conserva | 3 |
| CB-008 | `autoComplete="username"` / `current-password`, `name` estables, sin bloquear pegar | 3 |
| CB-009 | El aviso se evalúa en cada `keydown`/`keyup` del campo contraseña, así que aparece al empezar a escribir aunque Bloq Mayús se activara antes | 3 |
| CB-011 | `app/login/page.tsx` (servidor) consulta `GET /v1/auth/session`; con sesión de administrador válida → `redirect('/panel')` | 3 |
| CB-012 | `ValidateSession` lee `account.status`: `DISABLED` → 401 `auth/unauthenticated` → la web vuelve al login. La desactivación la hace el responsable fuera del panel (directamente en BD) | 2, 3 |
| CB-013 | Igual que RF-017 | 2 |
| CB-014 | `\p{L}` acepta tildes y ñ («Ñandú», «José») | 2 |
| CB-015 | Mínimo inclusivo: 8 caracteres se aceptan | 2 |
| CB-016 | La única regla es la longitud (8–128); espacios y símbolos se aceptan | 2 |
| CB-017 | La caducidad es de la fila de sesión (no del navegador): todas las pestañas reciben 401 en su siguiente petición; `SessionWatcher` revalida al volver a la pestaña (`visibilitychange`) | 2, 3 |
| CB-018 | El logout revoca la fila; las demás pestañas reciben 401 en su siguiente petición o al volver a ser visibles | 2, 3 |

**RNF de la spec:**
- **Seguridad:** RT-005, RT-006, RT-010 a RT-015; «intentos y bloqueos registrados para el responsable» → eventos de log de auditoría (ver «Seguridad y privacidad»).
- **Rendimiento:** RT-021 y RT-010.
- **Accesibilidad:** RT-018 y E2E con axe.
- **Sin conexión:** CB-007.
- **Permisos:** RT-013 y CA-019.
- **Responsive:** ver «Pantalla de login».

## Componentes

### Estructura de carpetas (sobre la base existente)
```
apps/api/
├── prisma.config.ts
├── prisma/{schema.prisma, migrations/, seed/{runner.ts, steps/{index.ts, admin-inicial.step.ts}}}
├── src/
│   ├── main.ts, app.module.ts
│   ├── shared/
│   │   ├── config/        env.schema.ts, load-config.ts, config.module.ts (AppConfig)
│   │   ├── correlation/   correlation-id.middleware.ts
│   │   ├── logging/       logger.module.ts (nestjs-pino), sanitize.ts
│   │   ├── errors/        problem.exception.ts, problem-details.filter.ts, mappers/
│   │   ├── validation/    zod-validation.pipe.ts, zod-body.decorator.ts
│   │   ├── database/      prisma.service.ts, database.module.ts
│   │   ├── http/          security-headers.ts, cors.ts, no-store.interceptor.ts
│   │   ├── rate-limit/    rate-limit.module.ts, postgres-throttler.storage.ts, strict-rate-limit.decorator.ts
│   │   └── time/          clock.port.ts, system.clock.ts
│   └── modules/
│       ├── health/        application/{check-health.use-case.ts, ports/database-probe.ts}
│       │                  infrastructure/prisma-database.probe.ts · interface/health.controller.ts
│       ├── users/         domain/{account.ts, login-lock.ts, account-status.ts}
│       │                  application/ports/{account.repository.ts, unknown-login-attempts.repository.ts}
│       │                  infrastructure/{prisma-account.repository.ts, prisma-unknown-login-attempts.repository.ts}
│       └── auth/          domain/session.ts
│                          application/ports/{password-hasher.ts, session.repository.ts, token-generator.ts}
│                          application/{log-in, open-session, validate-session, revoke-session}.use-case.ts
│                          infrastructure/{argon2id-password-hasher.ts, prisma-session.repository.ts, crypto-token-generator.ts}
│                          interface/{auth.controller.ts, session-cookie.ts,
│                                     guards/{session, roles, csrf}.guard.ts,
│                                     decorators/{public, roles, current-session}.ts}
└── test/{helpers/{test-app.factory.ts, db.ts, test-routes.controller.ts}, integration/, contract/}

apps/web/
├── playwright.config.ts
├── e2e/{pages/{BasePage.ts, LoginPage.ts, PanelPage.ts}, fixtures/{test.ts, accounts.ts, db.ts},
│        tests/{login.spec.ts, panel.spec.ts, login-a11y.spec.ts}, reporters/flaky-summary.ts}
└── src/
    ├── instrumentation.ts            Validación de la configuración al arrancar
    ├── proxy.ts                      CSP con nonce, cabeceras y redirección optimista de /panel
    ├── app/
    │   ├── layout.tsx                Fuentes, tokens.css, ApiConfigProvider
    │   ├── page.tsx                  redirect('/panel')
    │   ├── not-found.tsx, healthz/route.ts
    │   ├── login/{page.tsx, page.module.css}
    │   └── panel/{layout.tsx, page.tsx, page.module.css}
    ├── shared/config/server-env.ts   (server-only)
    ├── shared/api/{server-client.ts, browser-client.ts, api-config-provider.tsx}
    ├── shared/auth/{require-admin-session.ts, get-session.ts}   (server-only)
    └── features/
        ├── auth-login/   {LoginForm.tsx, LoginForm.module.css, LoginForm.test.tsx, BrandShowcase.tsx,
        │                  ForgotPasswordDisclosure.tsx, use-caps-lock.ts, login-messages.ts}
        └── admin-panel/  {ComingSoon.tsx, LogoutButton.tsx, SessionWatcher.tsx}

packages/
├── config/      Presets: eslint/, tsconfig/, vitest/, stylelint/
├── contracts/   src/{common/{problem.ts, problem-types.ts, password.ts}, health/, auth/{login.schemas.ts,
│                     session.schemas.ts, username.ts}, v1/registry.ts, index.ts}
│                scripts/generate-openapi.ts → openapi/v1.json (versionado)
├── api-client/  src/{generated/v1.ts (versionado), client.ts, middleware/{csrf.ts, correlation.ts}}
├── ui-tokens/   src/{tokens.ts, contrast.ts, contrast-pairs.ts}, scripts/build-css.ts → dist/tokens.css
└── ui-web/      src/{Button, TextField, PasswordField, Link, Alert, internal/{VisuallyHidden, Spinner}}/

.github/workflows/ci.yml · scripts/ci/check-migrations-immutable.mjs
```
- **Build de paquetes:** `contracts`, `api-client` y `ui-tokens` con `tsup` (ESM + CJS + `.d.ts`), porque los consume NestJS (CJS). `ui-web` se publica como fuente TS y Next.js la transpila (`transpilePackages`).
- **Nombres:** scope `@perchados/*` en todo el monorepo (`@perchados/api`, `@perchados/web`, `@perchados/contracts`, `@perchados/api-client`, `@perchados/ui-tokens`, `@perchados/ui-web`, `@perchados/config`), con dependencias internas `workspace:*`. Sustituye al provisional `@repo/*` de los README de `packages/*`.

### Reutilización
El registro de componentes está vacío: no hay nada que reutilizar. Lo siguiente se **registra** en `specs/02-memoria/registro-componentes.md` en la tarea que lo crea:
- **API:** `ProblemException`, `ProblemDetailsFilter`, `ZodValidationPipe`/`@ZodBody`, `PrismaService`, `Clock`, `PasswordHasher`, `OpenSession`/`ValidateSession`/`RevokeSession`, `@Public`, `@Roles`, `@CurrentSession`, `@StrictRateLimit`, `resolveTrackerIp` (RT-022), el *runner* de semillas y `createTestApp`.
- **Web (servidor):** `resolveClientIp` y `createServerApiClient` (RT-022).
- **Paquetes:** `problemSchema`, `PROBLEM_TYPES`, `usernameSchema`, `passwordInputSchema`, `createApiClient`.
- **UI y pruebas:** `Button`, `TextField`, `PasswordField`, `Link`, `Alert`, `BasePage`, `LoginPage`, `PanelPage` y el fixture `test` con `accounts`.

### Topología web ↔ API y sesión (ADR-007)
- **Navegador → API directo** (`API_PUBLIC_URL`, CORS con credenciales). La API obtiene la IP del cliente con `TRUST_PROXY` (el proxy de borde que tenga delante).
- **Servidor Next → API** por `API_INTERNAL_URL` (red privada), reenviando `Cookie` y `X-Correlation-Id` (si es válido) y añadiendo `X-Perchados-Internal-Token` y, si se resolvió, `X-Perchados-Client-Ip` (RT-022). **Nunca** reenvía el `X-Forwarded-For` recibido.
- `API_PUBLIC_URL` se lee en tiempo de ejecución en `layout.tsx` y se pasa al cliente con `ApiConfigProvider` (sin `NEXT_PUBLIC_*`).
- **Cookies:** `perchados_sid` (HttpOnly) y `perchados_csrf` (legible por JS), ambas `SameSite=Strict`. En local `localhost:3000` y `localhost:3001` comparten cookies. En producción web y API comparten dominio registrable (`SESSION_COOKIE_DOMAIN`) y las cookies llevan el prefijo `__Secure-`. Los nombres (`SESSION_COOKIE_NAME`, `CSRF_COOKIE_NAME`, `SECURE_COOKIE_PREFIX` y los compuestos `SECURE_*`) se exportan desde `packages/contracts` (`auth/cookie-names.ts`) y ni la API ni la web los repiten.

### IP del cliente y límite de peticiones en las llamadas SSR (ADR-011)
**Problema (revisión de la etapa 6):** el servidor Next reenviaba el `X-Forwarded-For` del cliente tal cual. Con `TRUST_PROXY=false` todas las llamadas SSR (`getSession`/`requireAdminSession`, una por carga de `/login` y de `/panel`) caían en el cubo global de la IP del servidor web: unas 100 cargas/min de `/login` por cualquiera daban 429 al panel y expulsaban al administrador. Confiar en la cabecera sin más dejaría que el atacante eligiera su IP.

**Hechos que condicionan la solución:**
- Next.js (servidor Node) rellena `x-forwarded-for` con la dirección del socket **solo si no viene** (`??=`); si el cliente la envía, se conserva. Y `NextRequest` ya no expone `ip`. Por tanto, **sin un proxy de borde que escriba la cabecera, la web no puede conocer la IP real** cuando el cliente manda una falsa. Se verifica con Context7 en la tarea de implementación.
- La API no puede distinguir por red a la web del navegador en todos los entornos (en Docker Desktop el tráfico publicado llega desde la pasarela de la red de Docker, la misma subred que la web).

**Solución:**
1. **Web:** `resolveClientIp(xff, WEB_TRUST_PROXY_HOPS)` en `apps/web/src/shared/api/client-ip.ts` (`server-only`). Con `n ≥ 1` saltos de confianza delante de la web, la IP del cliente es la entrada `n`-ésima por la derecha de `X-Forwarded-For` (la que escribió el borde); con `n = 0`, o si la entrada no existe o no es IP (`net.isIP`), no hay IP.
2. **Web → API:** `createServerApiClient` envía `X-Perchados-Internal-Token: <INTERNAL_API_SECRET>` siempre y `X-Perchados-Client-Ip: <ip>` solo si se resolvió. Deja de reenviar `X-Forwarded-For`.
3. **API:** `RateLimitGuard.getTracker()` usa `resolveTrackerIp(req)` (`apps/api/src/shared/rate-limit/client-ip.ts`): si el token coincide (`timingSafeEqual` sobre SHA-256 de ambos valores) **y** `X-Perchados-Client-Ip` es una IP válida, la usa; en otro caso, `req.ip`. Se mantiene la agrupación IPv6 por /64. El token no da ningún otro privilegio: no exime de límites, ni de sesión, ni de CSRF.
4. **Cubo:** las llamadas SSR cuentan en el **cubo global de la IP del cliente final**, el mismo que sus llamadas directas del navegador. No hay exención ni cubo especial: quien recarga `/login` en bucle agota su propio cubo, no el del administrador.
5. **Sin IP resuelta** (solo posible con `WEB_TRUST_PROXY_HOPS = 0`, que la configuración prohíbe en producción): la API usa `req.ip` (la IP de la web), como hasta ahora. Es aceptable en local, Docker y CI, donde no hay atacantes externos.

**Configuración coherente por entorno:**

| Entorno | Delante de la web | `WEB_TRUST_PROXY_HOPS` | Delante de la API | `TRUST_PROXY` | IP que cuenta en SSR |
|---------|-------------------|------------------------|-------------------|---------------|----------------------|
| Local (`pnpm dev`) | Nada | `0` | Nada | `false` | La de la web (`127.0.0.1`) |
| Docker (perfil `apps`, puertos en `127.0.0.1`) | Nada | `0` | Nada | `false` | La del contenedor `web` |
| CI (`APP_ENV=ci`) | Nada | `0` | Nada | `false` | La de la web; los saltos ≥ 1 se prueban en unitarias e integración |
| Producción | Proxy de borde con TLS (1 salto) que **añade** la dirección del par TCP a `X-Forwarded-For` | `1` (o los saltos reales) | El mismo borde | `1` o el CIDR del borde | La del cliente final |

**Condiciones del despliegue en producción** (el despliegue está `[POR ACLARAR]` en `stack.md`; quedan como restricción para la futura CD, igual que el dominio registrable de ADR-007): web y API solo alcanzables a través del borde (sus puertos no se publican fuera de la red privada); `API_INTERNAL_URL` apunta a la red privada; `INTERNAL_API_SECRET` aleatorio de ≥ 32 caracteres, igual en web y API, solo en el entorno; rotarlo exige reiniciar ambas.

### Excepción a RT-004: esquemas de navegador (ADR-012)
RT-004 dice que los esquemas viven una sola vez. `packages/contracts` mantiene **dos juegos** de esquemas de las credenciales:
- **Zod clásico** (`@perchados/contracts`): API, validación de entrada y OpenAPI.
- **zod/mini** (`@perchados/contracts/client`, `login.client-schemas.ts`): solo para el navegador, por el presupuesto de JS de RT-021 (el JS inicial de `/login` bajó de 239,5 a unos 162 KB gzip).

Condiciones de la excepción (todas obligatorias; el `revisor` las comprueba):
1. **Fuente única de reglas y mensajes:** longitudes, patrón y textos solo en `auth/login.rules.ts` (`USERNAME_MAX_LENGTH`, `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`, `USERNAME_PATTERN_SOURCE`, `CREDENTIAL_MESSAGES`); ninguno de los dos juegos declara literales propios.
2. **Prueba de paridad obligatoria** (`login.client-schemas.spec.ts`): cada esquema de `/client` da el mismo resultado (éxito, valor normalizado y mensajes de error) que su homólogo clásico sobre el mismo conjunto de casos, incluidos los bordes. Un esquema nuevo en `/client` sin su caso de paridad no se acepta.
3. **El código de navegador solo importa `@perchados/contracts/client`.** Regla simple y comprobable: todo `apps/web/src/**` importa solo `/client` (hoy ya es así) y un `no-restricted-imports` en `apps/web/eslint.config.mjs` hace fallar `lint` si importa la entrada principal; las pruebas E2E (`apps/web/e2e/**`, Node) y la API pueden usar la entrada principal.
4. `/client` solo contiene lo que el navegador necesita (esquemas de formularios, nombres de cookies y de cabeceras, tipos); nunca el registro OpenAPI.

### Calibración de argon2id (ADR-007)
ADR-007 fijó `t=4` como valor inicial y pidió calibrar en el hito 2 para que una verificación tarde entre 100 y 500 ms. Calibración del 2026-10 en el equipo de desarrollo: **`m=19456 KiB, t=10, p=1`** → `bench:hash` mediana ≈ 160–210 ms; login completo mediana ≈ 213–225 ms y p95 ≈ 336–499 ms (dentro del ≤ 1 s p95 de RT-021). Son los valores por defecto de `env.schema.ts` y de `.env.example`. **Se recalibra con `bench:hash` en el hardware de producción** antes del primer despliegue (ajustando solo `PASSWORD_HASH_ITERATIONS`, nunca por debajo de la tabla mínima de ADR-007); los hashes existentes se rehashean solos tras un login correcto si los nuevos parámetros son superiores.

### Flujo de login (`LogIn`, API)
1. Validar `LoginRequest` (contrato). Inválido → 400, **sin contar intento**.
2. Buscar la cuenta por `username_key` con su rol.
3. **Sin cuenta:** `verifyDummy()`; aplicar el contador y el bloqueo en `login_attempt_unknown` con las mismas reglas que abajo; responder 401 o 423 igual que con una cuenta real.
4. **Cuenta bloqueada** (`locked_until > now()`): `verify` (para igualar tiempos) sin actualizar nada → 423 con los minutos restantes (CB-005).
5. `verify(password, hash)`:
   - **Falla:** `UPDATE account SET failed_attempts = CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1 ELSE failed_attempts + 1 END, locked_until = CASE … WHEN (nuevo contador) >= 5 THEN now() + interval '30 minutes' ELSE NULL END WHERE id = $1 RETURNING failed_attempts, locked_until` (atómico, hora de la BD). Si quedó bloqueada → 423 (30 min); si no → 401.
   - **Acierta pero la cuenta está `DISABLED` o su rol no es `admin`:** 401 `auth/invalid-credentials`, sin tocar el contador (CA-019, CB-012).
   - **Acierta:** en una transacción, `failed_attempts = 0`, `locked_until = NULL`, revocar la sesión que traiga la petición (CB-014 de ADR-007) y crear la nueva. Rehash si los parámetros quedaron por debajo de los vigentes. 200 + cookies.
6. Registrar el evento de auditoría (ver «Seguridad y privacidad»).

Los umbrales (`LOGIN_MAX_FAILED_ATTEMPTS` = 5, `LOGIN_LOCK_MINUTES` = 30) son constantes de dominio en `users/domain/login-lock.ts`, no configuración: los fija la spec. Las pruebas usan un `Clock` falso o mueven `locked_until` en la BD.

### Pantalla de login (`/login`, `apps/web`)
Composición según [`mockup-login.png`](mockup-login.png), con las exclusiones de la spec:

| Zona | Contenido | Notas de implementación |
|------|-----------|-------------------------|
| Panel de marca (`BrandShowcase`, Server Component) | Logo «perchados.», etiqueta «PANEL DE ADMINISTRACIÓN», mosaico de 5 prendas con chips de estado («Como nueva», «Vintage»…), titular «Cada prenda merece una segunda vida.» y subtítulo | Ilustraciones como SVG estáticos en `public/brand/` con `alt=""` (decorativas) y `width`/`height` declarados; el mosaico va en un `<aside aria-label="Perchados">`. Sin JS |
| Formulario (`LoginForm`, Client Component) | Etiqueta «ACCESO DE ADMINISTRADOR», `<h1>` «Hola de nuevo», texto «Inicia sesión con tu usuario y contraseña de administrador.», `TextField` «Nombre de usuario» (icono de usuario), `PasswordField` «Contraseña» (icono de candado), botón-enlace «¿Olvidaste tu contraseña?», `Button` primario «Entrar al panel» con flecha, `Alert` de errores generales y aviso de sesión caducada | `<form noValidate>` con `<main>`; los `Alert` aparecen sobre el botón. Se excluyen «Recordar mi usuario» y el recuadro de credenciales de prueba (RF-022) |
| Pie informativo | Texto de RF-021 con icono de información | Párrafo con icono `aria-hidden` |

- **Responsive (mobile-first):** por debajo de 960 px el formulario va primero y el panel de marca pasa detrás, reducido (solo logo y titular; el mosaico se oculta con CSS por debajo de 600 px). De 360 px a escritorio, sin desplazamiento horizontal.
- **Estados:** inicial; errores de campo; enviando (botón en carga); credenciales incorrectas; bloqueada; sin conexión; límite de peticiones (429); sesión caducada (al llegar desde el panel); error inesperado (500).
- **Textos de error de la web** (centralizados en `login-messages.ts`): los de la spec, más dos técnicos no definidos en ella: 429 → «Demasiados intentos desde este equipo. Espera un momento y vuelve a intentarlo» y 5xx → «No pudimos verificar tus datos. Inténtalo de nuevo en unos minutos» (ver «Preguntas para el dueño»).

### Panel (`/panel`, `apps/web`)
- `app/panel/layout.tsx` (servidor): `requireAdminSession()`; cabecera con el logo y `LogoutButton`; `dynamic = 'force-dynamic'` y `Cache-Control: no-store` (vía `proxy.ts`).
- `app/panel/page.tsx`: `requireAdminSession()` (patrón DAL: la comprobación también en la página) y `ComingSoon` con `<h1>` «Próximamente, estamos trabajando».
- `requireAdminSession()`: `GET /v1/auth/session` con la cookie reenviada. 200 con `role = admin` → continúa; 401 `auth/session-expired` → `redirect('/login?motivo=sesion-caducada')`; otro 401 o 403 → `redirect('/login')`.
- `SessionWatcher` (cliente, ~1 KB): en `pageshow` con `persisted` y en `visibilitychange` a visible, consulta la sesión y, si es 401, navega con `location.replace` al login (CA-011, CB-017, CB-018).
- `LogoutButton`: `Button` secundario «Cerrar sesión» con estado de carga; tras 204 (o 401, idempotente) → `location.replace('/login')`.
- **`/` (raíz):** `redirect('/panel')` (no hay tienda pública todavía).

### Componentes web (`packages/ui-web`, ADR-009)
Solo los que usa esta funcionalidad. HTML nativo, CSS Modules y variables de `ui-tokens`; iconos de `lucide-react` con `aria-hidden`.

| Componente | API (props clave) | Accesibilidad y estados |
|------------|-------------------|-------------------------|
| **Button** | `variant: 'primary' \| 'secondary'`, `loading`, `disabled`, `iconEnd`, `fullWidth`, `type` (por defecto `button`), `loadingLabel` | En carga: `aria-disabled="true"` (sigue enfocable), `aria-busy="true"`, `onClick` con `preventDefault()` (anula también el envío con Enter); texto con `opacity:0` (conserva ancho y nombre), spinner `aria-hidden` y un `role="status"` oculto que anuncia `loadingLabel`. Altura mínima 48 px. Con `prefers-reduced-motion`, pulso lento en lugar de giro |
| **TextField** | `label` (obligatoria en el tipo), `icon?`, `help?`, `error?`, props de `input` | `<label htmlFor>` + `useId`; `aria-invalid`; `aria-describedby` = ayuda + error; contenedor del error `aria-live="polite"` siempre presente; icono `aria-hidden`; etiqueta vacía → error en desarrollo |
| **PasswordField** | Lo de TextField + `notice?` y `autoComplete` (por defecto `current-password`) | Botón `type="button"` «Mostrar contraseña» / «Ocultar contraseña»; el foco no se mueve; `role="status"` oculto anuncia «Contraseña visible / oculta»; no bloquea pegar ni el autocompletado; `notice` asociado con `aria-describedby` en región `polite` |
| **Link** | `href`, `external?`, `newTab?` | `next/link` para rutas internas, `<a>` para el resto (incluido `mailto:`); subrayado por defecto; foco con `outline` de 2 px |
| **Alert** | `variant: 'info' \| 'success' \| 'warning' \| 'error'`, `title?`, `children` | `error`/`warning` → `role="alert"`; `info`/`success` → `role="status"`; icono y prefijo oculto por variante (no solo color) |

- **Foco global:** `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px }`; visible en `forced-colors`.
- `VisuallyHidden` y `Spinner` son internos de `ui-web`.

### Tokens de marca (extraídos del mockup; validados por el dueño el 15-10-2026)
| Token | Valor | Uso |
|-------|-------|-----|
| `color.primary` | `#2E2CF5` | Botón primario, enlaces, etiquetas mono, panel de marca |
| `color.primary-hover` | `#2321C8` | Hover y activo |
| `color.primary-subtle` | `#EEEEFF` | Fondo de `Alert info` |
| `color.on-primary` / `on-primary-muted` | `#FFFFFF` / `#D5D5FF` | Texto sobre el primario |
| `color.accent-orange` · `accent-teal` · `accent-pink` | `#FF7A1A` · `#3DDBB0` · `#FF8FCB` | Decorativos (mosaico); texto encima solo en `ink` |
| `color.ink` | `#14142B` | Títulos y texto principal |
| `color.text-muted` / `text-placeholder` | `#5E5E7A` / `#6E6E8A` | Texto secundario y *placeholder* |
| `color.border-control` / `border-subtle` | `#8A8AA3` / `#E4E4EE` | Borde de campos (≥ 3:1) / separadores |
| `color.surface` / `surface-subtle` | `#FFFFFF` / `#F4F4F8` | Fondos |
| `color.error` / `error-subtle` | `#C0262D` / `#FDECEC` | Error |
| `color.success` / `success-subtle` | `#166B40` / `#E8F6EE` | Éxito |
| `color.warning` / `warning-subtle` | `#8A4B00` / `#FFF4E5` | Aviso (Bloq Mayús) |
| `color.focus` | `#2E2CF5` (`#FFFFFF` sobre el primario) | Anillo de foco |
| `font.sans` | Plus Jakarta Sans (800 títulos, 400/500 cuerpo, 700 botones) | Títulos y cuerpo |
| `font.mono` | IBM Plex Mono 500, mayúsculas, `letter-spacing: 0.12em` | Etiquetas |
| `radius` | `sm 8` · `md 12` · `lg 16` · `xl 28` · `full 9999` | |
| `space` | Escala de 4 px | |
| `font-size` | `rem`: 0.75 · 0.875 · 1 · 1.125 · 1.5 · 2 · 3 | Zoom del 200 % |

Fuentes con `next/font/google` (autoalojadas en el build, `display: swap`, subconjunto `latin`). Los pares de contraste (`on-primary`/`primary` 7,5:1; `ink`/`surface` 18:1; `text-placeholder`/`surface` 4,9:1; `border-control`/`surface` 3,4:1; `error`/`error-subtle` 5,1:1; `warning`/`warning-subtle` 6,3:1; `ink` sobre los acentos ≥ 6,9:1…) viven en `ui-tokens/src/contrast-pairs.ts` y una prueba los recalcula. **Prohibido:** blanco sobre los acentos. Stylelint (`declaration-strict-value`) obliga a usar `var(--…)` en los CSS Modules de `ui-web` y `apps/web`.

## Contratos de API
Esquemas en `packages/contracts` (objetos estrictos), registrados en `v1/registry.ts` y publicados en `openapi/v1.json`.

| Método y ruta | Acceso | Petición | Respuestas | Hito |
|---------------|--------|----------|------------|------|
| `GET /v1/health` | Público, sin límite | — | 200 `{status:"ok", checks:{database:"up"}}` · 503 `health/unavailable` + `checks:{database:"down"}` | 1 |
| `POST /v1/auth/login` | Público; `@StrictRateLimit()`; `Origin` permitido | `LoginRequest {username: usernameSchema, password: loginPasswordSchema}` | 200 `SessionInfo` + `Set-Cookie` (`perchados_sid`, `perchados_csrf`) · 400 `validation-error` · 401 `auth/invalid-credentials` · 403 `auth/csrf-invalid` (Origin) · 423 `auth/account-locked` + `lockedMinutesRemaining` · 429 | 2 |
| `GET /v1/auth/session` | Con sesión | — | 200 `SessionInfo {role: "admin", expiresAt: ISO-8601}` · 401 `auth/unauthenticated` \| `auth/session-expired` | 2 |
| `POST /v1/auth/logout` | Público con sesión opcional; CSRF si hay sesión válida | — | 204 + `Set-Cookie` que borra ambas cookies · 403 `auth/csrf-invalid` | 2 |

**Esquemas compartidos (web y API):**
- `usernameSchema`: `string` → `trim` → `normalize('NFC')` → no vacío («Escribe tu usuario») → `^\p{L}+$`u («El usuario solo puede tener letras») → máximo 64.
- `loginPasswordSchema`: no vacío («Escribe tu contraseña») → mínimo 8 («La contraseña debe tener al menos 8 caracteres») → `passwordInputSchema` (máximo 128).
- `SessionInfo.role` es `z.string()` en el contrato (el rol es un dato de la BD, RF-023); la web compara con `'admin'`.

**Error común (`problemSchema`, RFC 9457):** `{ type, title, status, detail, correlationId, errors? }` con `Content-Type: application/problem+json`; `errors[] = { path, message, code }`.

**Catálogo `PROBLEM_TYPES`:**

| `type` | Estado | Cuándo |
|--------|--------|--------|
| `validation-error` | 400 | El esquema rechaza la entrada |
| `malformed-request` | 400 | JSON inválido |
| `auth/invalid-credentials` | 401 | Login: usuario inexistente, contraseña incorrecta, cuenta desactivada o sin rol `admin` |
| `auth/unauthenticated` | 401 | Sin cookie, o cookie inválida, revocada o de cuenta desactivada |
| `auth/session-expired` | 401 | `now ≥ expiresAt` |
| `auth/forbidden` | 403 | Rol insuficiente |
| `auth/csrf-invalid` | 403 | Falta el token CSRF, no coincide u `Origin` no permitido |
| `not-found` | 404 | Ruta inexistente (incluida cualquier ruta fuera de `/v1`) |
| `payload-too-large` | 413 | Cuerpo > `BODY_LIMIT_KB` (100) |
| `request-rejected` | 4xx (el de la excepción; 400 por defecto) | `HttpException` 4xx sin tipo propio (405, 406, 415…); título y detalle genéricos del catálogo, nunca el mensaje original; log `warn` |
| `auth/account-locked` | 423 | Cuenta (o usuario inexistente imitado) bloqueada; extensión `lockedMinutesRemaining` (entero ≥ 1) |
| `rate-limit-exceeded` | 429 | Límite superado (+ `Retry-After`) |
| `internal-error` | 500 | Error no controlado; `detail` genérico |
| `health/unavailable` | 503 | La BD no responde |

**Cuerpos:** la API solo acepta JSON: se registra únicamente el parser JSON (`bodyParser: false` + `json({ limit })`, sin `urlencoded`), porque no consume formularios.

**Cabeceras:** petición `X-Correlation-Id` (opcional) y `X-CSRF-Token`; internas web → API `X-Perchados-Internal-Token` y `X-Perchados-Client-Ip` (RT-022; no forman parte del contrato público ni de OpenAPI, y la API las ignora sin el token correcto); respuesta `X-Correlation-Id`, `Retry-After` (429) y `Cache-Control: no-store`. CORS expone `X-Correlation-Id` y `Retry-After`.

## Modelo de datos
```prisma
enum AccountStatus { ACTIVE DISABLED  @@map("account_status") }

model Role {
  id        String    @id @default(uuid(7)) @db.Uuid
  code      String    @unique @db.VarChar(32)   // "admin"
  name      String    @db.VarChar(64)           // "administrador"
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  accounts  Account[]
  @@map("role")
}

model Account {
  id             String        @id @default(uuid(7)) @db.Uuid
  username       String        @db.VarChar(64)                         // tal como se creó: "HaroldAdmin"
  usernameKey    String        @unique @map("username_key") @db.VarChar(64) // lower(NFC(trim(username)))
  roleId         String        @map("role_id") @db.Uuid
  role           Role          @relation(fields: [roleId], references: [id], onDelete: Restrict)
  status         AccountStatus @default(ACTIVE)
  passwordHash   String        @map("password_hash")
  failedAttempts Int           @default(0) @map("failed_attempts")
  lockedUntil    DateTime?     @map("locked_until") @db.Timestamptz(3)
  createdAt      DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime      @updatedAt @map("updated_at") @db.Timestamptz(3)
  sessions       Session[]
  @@index([roleId])
  @@map("account")
}

model LoginAttemptUnknown {
  usernameKey    String    @id @map("username_key") @db.VarChar(64)
  failedAttempts Int       @map("failed_attempts")
  lockedUntil    DateTime? @map("locked_until") @db.Timestamptz(3)
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
  @@index([updatedAt])
  @@map("login_attempt_unknown")
}

model Session {
  id            String    @id @default(uuid(7)) @db.Uuid
  tokenHash     String    @unique @map("token_hash") @db.Char(64)
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

**Migraciones (en orden):**
1. **Hito 1 — `…_roles_y_cuentas`:** `Role`, `Account` (con `username`, `username_key`, `failed_attempts`, `locked_until`) e `INSERT` del rol `admin`/«administrador» con `ON CONFLICT (code) DO NOTHING`. El rol es un dato de referencia que toda BD necesita: va en la migración, no en la semilla. No se crea el rol «comprador» (no lo pide la spec); las pruebas de CA-019 crean su propio rol de prueba.
2. **Hito 2 — `…_sesiones`:** `Session`.
3. **Hito 2 — `…_limite_peticiones_y_bloqueo`:** `RateLimitCounter` y `LoginAttemptUnknown`.

**Semilla (`db:seed`):** un único paso de producción, `admin-inicial` (hito 2): rol `admin` + `HaroldAdmin` con hash argon2id de `ADMIN_INITIAL_PASSWORD`, solo si `username_key = 'haroldadmin'` no existe.

**Limpieza oportunista:** filas caducadas de `rate_limit_counter` y de `login_attempt_unknown` (sin bloqueo vigente y `updated_at` > 24 h) se borran en el 1 % de las escrituras. Las sesiones caducadas se conservan (para responder `session-expired`); su purga queda fuera de alcance.

## Configuración (`.env.example`)
**Ya existen y se reutilizan:** `POSTGRES_*`, `STORAGE_*`, `MAILPIT_*`, `API_PORT=3001`, `WEB_PORT=3000`, `DATABASE_URL`, `SESSION_TTL_HOURS=8`, `ADMIN_INITIAL_PASSWORD` (semilla) y `ADMIN_CONTACT_EMAIL` (web, RF-007).

**Se añaden:**

| Variable | App | Por defecto / validación |
|----------|-----|--------------------------|
| `APP_ENV` | api, web | `development \| test \| ci \| production`; gobierna los interruptores de seguridad |
| `LOG_LEVEL` | api | `fatal…trace`, por defecto `info` |
| `CORS_ALLOWED_ORIGINS` | api | Lista de URLs; obligatoria |
| `TRUST_PROXY` | api | `false` \| número de saltos \| lista de CIDR; por defecto `false`. Describe **solo** el proxy de borde delante de la API, nunca la web. Con `APP_ENV=production`, `false` → inválida (RT-022) |
| `WEB_TRUST_PROXY_HOPS` | web | Entero ≥ 0, por defecto `0`; saltos de confianza delante de la web. Con `APP_ENV=production`, `0` → inválida (RT-022) |
| `INTERNAL_API_SECRET` | api, web | Obligatoria, ≥ 32 caracteres, mismo valor en ambas; sin valor por defecto (`.env.example` lo deja vacío e indica generarlo con `openssl rand -base64 32`); la CI genera uno por ejecución. Se oculta en los logs (RT-006) |
| `BODY_LIMIT_KB` | api | 100 |
| `SESSION_COOKIE_DOMAIN` | api | Opcional; obligatoria con `APP_ENV=production` |
| `RATE_LIMIT_GLOBAL_PER_MIN`, `RATE_LIMIT_AUTH_PER_MIN` | api | 100 / 10; enteros > 0 |
| `PASSWORD_HASH_MEMORY_KIB`, `PASSWORD_HASH_ITERATIONS`, `PASSWORD_HASH_PARALLELISM` | api | 19456 / 10 / 1 (calibrados; ver «Calibración de argon2id»); por debajo del mínimo OWASP → inválida |
| `HEALTH_DB_TIMEOUT_MS` | api | 2000 (≤ 2500) |
| `API_INTERNAL_URL`, `API_PUBLIC_URL` | web | URLs obligatorias |

Validaciones de las existentes: `SESSION_TTL_HOURS` positivo con decimales y ≥ 1/60; `ADMIN_CONTACT_EMAIL` correo válido, obligatorio en la web; `ADMIN_INITIAL_PASSWORD` solo la exige la semilla (≥ 8 caracteres). No hay secreto de sesión (ADR-007).

## Integración continua (`.github/workflows/ci.yml`)
Disparadores: `pull_request` hacia `main` y `push` a `main`; `concurrency` por rama con cancelación; Node desde `.nvmrc`; pnpm por `packageManager`; caché del *store* de pnpm y de `.turbo`. Se ejecuta también en PR solo de `specs/` (sin `paths-ignore`).

| Job | Pasos (nombres en español) | Depende de |
|-----|-----------------------------|------------|
| `calidad` | Instalar (`--frozen-lockfile`) → Lint → Typecheck → Pruebas con cobertura (*service* `postgres`) → Build → Verificar contrato → Migraciones inmutables → Migraciones sobre BD vacía (`db:migrate:deploy` dos veces + `migrate diff --exit-code`) | — |
| `seguridad` | gitleaks (`fetch-depth: 0`, `--redact`, todos los commits del PR) → `pnpm audit --audit-level high` | — |
| `e2e` | Build → API + web con `APP_ENV=ci` y BD migrada → Playwright (chromium escritorio + 360 px) → informe HTML como artefacto | `calidad` |

**Excepciones del audit (2026-10-16):** el job `seguridad` ejecuta `pnpm audit --audit-level high`. Excepción GHSA-vfj7-8cjw-p6xm (`braces`, solo dev, sin parche) aprobada por Harold el 2026-10-16, a revisar el 2026-11-16 (ver `.github/audit-exceptions.md`). Parches forzados con `pnpm.overrides`: `deepmerge-ts` 8.0.0 y `mysql2` 3.22.0.

Protección de rama (la configura el dueño en GitHub): `calidad`, `seguridad` y `e2e` obligatorios.

## Impacto en lo existente
| Elemento | Cambio | Riesgo |
|----------|--------|--------|
| `package.json` raíz | Se añaden `turbo`, `typescript` y la configuración compartida como `devDependencies` y los scripts `db:*`, `contract:*` y `test:e2e`. Se genera `pnpm-lock.yaml` | Bajo. Hoy `pnpm test` falla con «turbo not found»: lo corrige T-01 |
| `turbo.json` | Tareas `contract:generate` (con `outputs`), `contract:check`, `db:*` y `test:e2e` (sin caché) | Bajo |
| `tsconfig.base.json` | `noUncheckedIndexedAccess` y banderas estrictas | Bajo: aún no hay código |
| `docker-compose.yml` y Dockerfiles | Healthchecks de api/web, `depends_on: postgres (healthy)`, volumen con nombre para `node_modules`, *polling* para Windows, `prisma generate` en el build, `output: 'standalone'` | Medio: es la primera vez que se construyen con apps reales |
| `.env.example` | Se añaden las variables de la tabla anterior, sin quitar ninguna | Bajo |
| `apps/api/src/modules/*` | Se usan `users`; se añaden `auth` y `health`; `shared/` se llena. `catalog`, `payments`… quedan intactos | Ninguno |
| `apps/web/src/{app,features,shared}` | Se llenan según la estructura anterior | Ninguno |
| `packages/*/README.md` | De `@repo/*` a `@perchados/*` | Ninguno |
| `packages/ui-web` | **Paquete nuevo** (no estaba en la base); los componentes React necesitan su propio paquete (ADR-009) | Bajo |
| `specs/02-memoria/registro-componentes.md` | Altas de lo listado en «Reutilización» | Ninguno |
| Skills (ADR-004) | Se crean `api-rest-conventions` y `prisma-datos` | Ninguno |
| `CLAUDE.md` raíz | Propuesta de comandos (BD, contrato, E2E) para que la aplique el orquestador | Ninguno |
| Specs `000-estructura-monorepo` y `002-fundaciones` | Sustituidas por esta funcionalidad; el orquestador las elimina (respaldo en 84c8856) | Ninguno |
| **Revisión de la etapa 6 (2026-10-18)** — `apps/web/src/shared/api/server-client.ts` | Deja de reenviar `X-Forwarded-For`; añade `X-Perchados-Internal-Token` y `X-Perchados-Client-Ip` con el nuevo `client-ip.ts` (RT-022). Se actualiza su prueba | Medio: toca la sesión del panel (revisión humana) |
| `apps/api/src/shared/rate-limit/` | `RateLimitGuard.getTracker()` con `resolveTrackerIp`; nuevas integraciones de RT-022. Las pruebas existentes de `TRUST_PROXY` (`rate-limit.integration.spec.ts`, `rate-limit.trust-proxy.integration.spec.ts`) siguen válidas | Medio: límite de peticiones (revisión humana) |
| `apps/api/src/shared/config/env.schema.ts`, `apps/web/src/shared/config/server-env.ts` | `INTERNAL_API_SECRET`, `WEB_TRUST_PROXY_HOPS` y las reglas de producción | Bajo: un entorno sin el secreto deja de arrancar (falla rápido y nombra la variable) |
| `apps/api/src/shared/logging/sanitize.ts` | Oculta `x-perchados-internal-token` | Bajo |
| `packages/contracts` (`/client`) | Constantes de los nombres de las dos cabeceras internas | Bajo |
| `apps/web/eslint.config.mjs` | `no-restricted-imports` de la entrada principal de `@perchados/contracts` en `src/**` (ADR-012) | Bajo: hoy ningún archivo de `src` la importa |
| `.env.example`, `docker-compose.yml`, `.github/workflows/ci.yml`, `apps/api/test/helpers/test-app.factory.ts` | Las dos variables nuevas; compose las pasa a `api` y `web` (el secreto con `${INTERNAL_API_SECRET:?…}`); la CI genera el secreto en el job `e2e`; `createTestApp` usa un secreto de prueba | Bajo: el desarrollador debe poner el secreto en su `.env` una vez |
| `.claude/skills/api-rest-conventions/SKILL.md` | La nota de `TRUST_PROXY` pasa a enlazar ADR-011 (lo aplica el orquestador) | Ninguno |

No hay código de aplicación previo: no hay riesgo de regresión funcional. **Esta funcionalidad sí crea infraestructura:** es la excepción explícita del dueño a la regla de «una rebanada no crea infraestructura» (ADR-010). Las funcionalidades siguientes vuelven a reutilizarla sin crear infraestructura nueva.

## Decisiones técnicas
- **ADR-007 (aceptada):** sesión en servidor con cookie opaca, argon2id, CSRF sincronizador + `Origin`, topología de cookies.
- **ADR-008 (aceptada):** pino, configuración con Zod, `zod-to-openapi` + `openapi-typescript` + `openapi-fetch`, Vitest, `@nestjs/throttler` con almacén PostgreSQL, gitleaks y `pnpm audit`.
- **ADR-009 (aceptada):** `ui-tokens` → variables CSS, CSS Modules, HTML nativo, Plus Jakarta Sans e IBM Plex Mono, axe en Vitest y en Playwright. Aquí solo se construyen los 5 componentes que usa el login.
- **ADR-010 (aceptada):** la base técnica forma parte de la primera funcionalidad; se deroga la regla de capas horizontales como funcionalidades separadas.
- **ADR-011 (propuesta, nueva):** IP del cliente resuelta en el borde, web → API con secreto interno y sin confianza por red; las SSR cuentan en el cubo del cliente.
- **ADR-012 (propuesta, nueva):** esquemas de navegador con zod/mini en `@perchados/contracts/client` como excepción acotada a «los esquemas viven una sola vez».
- **Calibración de argon2id (`t=10`):** aplica lo que ADR-007 ya preveía (calibrar en el hito 2); no necesita ADR.
- **Decisiones locales (sin ADR):**
  - **Imitación del bloqueo para usuarios inexistentes** (`login_attempt_unknown`): RF-008 exige avisar del bloqueo y CB-004 exige no revelar que un usuario no existe. Sin imitación, 5 fallos con un nombre distinguirían una cuenta real («bloqueada») de una inexistente (seguiría «incorrectos»). La tabla no es una cuenta: no se puede iniciar sesión con ella.
  - **423 `auth/account-locked`** en lugar de 429, para no confundirlo con el límite de peticiones por IP.
  - **Umbrales del bloqueo como constantes de dominio** (los fija la spec), no como variables de entorno.
  - **Rol `buyer` no se crea:** la spec solo pide «administrador».
  - **`/` redirige a `/panel`.**

## Requisitos por plataforma (ADR-006)
**Web**
- Solo componentes de `ui-web`; nada de estilos ad hoc fuera de los tokens.
- **WCAG 2.2 AA:** `<main>`, `<h1>` único, `<aside>` decorativo; etiquetas visibles; errores asociados y anunciados; aviso de Bloq Mayús y carga anunciados; control mostrar/ocultar con nombre; foco visible; contraste calculado; pegar y gestores de contraseñas permitidos (3.3.8); área táctil ≥ 24 px.
- **Responsive:** 360 px → escritorio, mobile-first, formulario primero en pantallas estrechas.
- **Presupuesto (RT-021):** la pantalla de login es un Server Component con una única isla cliente (`LoginForm`); el panel de marca son SVG estáticos con tamaño declarado (sin CLS); fuentes autoalojadas con `size-adjust`; sin librerías de UI ni CSS-in-JS; `openapi-fetch` ≈ 6 KB; esquemas del formulario con zod/mini (ADR-012). **Medido: ≈ 162 KB gzip** (de 239,5 antes de zod/mini), dentro del límite de 200 KB de RT-021, que es el que obliga.
- **CSP con nonce** en `proxy.ts`: `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' <API_PUBLIC_URL>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` (`'unsafe-eval'` solo en desarrollo). Más HSTS, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

**API**
- Contrato en `packages/contracts` → `openapi/v1.json`; rutas `/v1`; errores del catálogo anterior.
- **Migraciones:** las 3 descritas.
- **Rate limits:** 100/min por IP global; 10/min por IP adicional en `POST /v1/auth/login` (y `logout`); `/v1/health` exento. La protección por cuenta es el bloqueo de 5 fallos/30 min. La IP es la del cliente final también en las llamadas SSR de la web (RT-022, ADR-011).
- Cabeceras con helmet (RT-015).

**Móvil:** no aplica (el panel es solo web).

**Integraciones:** no aplica. La única dependencia en tiempo de ejecución es PostgreSQL: tiempo máximo de conexión de 2 s en el *pool* y `HEALTH_DB_TIMEOUT_MS`. Alertas aplazadas (decisión del dueño); los errores se registran en nivel `error` con `correlationId`.

## Seguridad y privacidad
- **A01:** todo privado por defecto; `@Public` solo en `health`, `auth/login` y `auth/logout`, con una prueba de lista blanca. Toda ruta privada lleva `@Roles(...)` salvo una segunda lista blanca (hoy solo `GET /v1/auth/session`, que cualquier sesión válida puede consultar y cuya respuesta la web compara con `admin`), también con su prueba. El panel se comprueba en el servidor de Next y en la API.
- **A04/A05 — IP del cliente (RT-022):** ninguna cabecera del cliente decide la IP salvo la que escribe un proxy de borde de confianza; la web solo transmite la IP con el secreto interno, que no concede otro privilegio.
- **A02:** argon2id ≥ OWASP; token de sesión de 256 bits guardado como SHA-256; cookies `Secure` fuera de local; HSTS.
- **A03:** Zod en el borde; Prisma parametrizado; el SQL crudo (contador atómico y UPSERT del limitador) con plantillas etiquetadas de `$executeRaw`/`$queryRaw`.
- **A05:** CORS cerrado, cabeceras de seguridad, errores sin trazas.
- **A07:** mensaje genérico; `verifyDummy`; imitación del bloqueo; bloqueo de 5 fallos/30 min; 10/min por IP; rotación del identificador de sesión en cada login; caducidad absoluta de 8 h; revocación inmediata; comparaciones en tiempo constante.
- **A09 — Auditoría** (RNF «intentos fallidos y bloqueos registrados para el responsable»): eventos de log JSON `auth.login.succeeded` (`info`), `auth.login.failed` (`warn`, con `reason: invalid-password | unknown-user | not-admin | disabled`), `auth.login.locked` (`warn`) y `auth.logout` (`info`), con `accountId` cuando existe y `correlationId`. **Nunca** se registra el usuario tecleado (podría ser una contraseña escrita en el campo equivocado) ni la contraseña. Ver «Preguntas para el dueño».
- **Secretos:** solo en el entorno; gitleaks en la CI; la semilla no imprime valores; la configuración inválida nombra la variable, nunca el valor. Ningún agente lee ni escribe el valor de `ADMIN_INITIAL_PASSWORD`.
- **Datos personales:** la sesión no guarda IP ni *user agent* (minimización).
- ⚠️ **Revisión humana obligatoria** en el hito 2 y en el PR completo: `apps/api/src/modules/auth/**`, `apps/api/src/modules/users/**`, `apps/api/src/shared/{rate-limit,http}/**`, `apps/web/src/shared/auth/**`, `apps/web/src/shared/api/**` y `apps/web/src/proxy.ts`.

## Estrategia de pruebas
| Nivel | Herramienta | Qué cubre |
|-------|-------------|-----------|
| Unitarias API | Vitest (+ `unplugin-swc`) | `sanitize()`, validación del id de correlación, `env.schema`, mapeo de problemas, `Session.isExpired` con `Clock` falso (CA-018), `Argon2idPasswordHasher` (RF-018), `LoginLock` (contador, bloqueo en el 5.º fallo, vencimiento y contador nuevo: CA-007, CA-008, CA-016, CB-005, CB-013), `LogIn` con repositorios en memoria (CA-001, CA-003, CA-019, CB-003, CB-004, CB-012), *runner* de semillas |
| Contrato (esquemas) | Vitest | `usernameSchema` y `loginPasswordSchema`: CA-002, CA-014, CA-015, CB-001, CB-014, CB-015, CB-016 |
| Integración API | Vitest + `createTestApp` + supertest + PostgreSQL real (`perchados_test`, truncado entre pruebas, secuencial) | Login, sesión y logout de punta a punta: CA-001, CA-003, CA-007, CA-008, CA-011 (API), CA-016, CA-017 (semilla), CA-018, CA-019, CB-002 a CB-006, CB-012, CB-013, CB-017, CB-018; RT-005, RT-006, RT-008, RT-011 a RT-014, RT-016; la duración del login con los parámetros de producción (RT-021) |
| Contrato (respuestas) | Ajv + `v1.json` | Respuestas de `health`, `login`, `session` y `logout`; cobertura de rutas; `contract:check` |
| Unitarias UI | Vitest + Testing Library + `user-event` + `vitest-axe` | Los 5 componentes en cada estado; `LoginForm`: CA-002, CA-004, CA-005, CA-006, CA-009, CA-013, CA-014, CA-015, CB-007, CB-008, CB-009; `use-caps-lock`; textos sin credenciales (RF-022) |
| Tokens | Vitest + Stylelint | Pares de contraste; solo tokens |
| E2E | Playwright + `@axe-core/playwright` | Un test por escenario Gherkin de la spec (CA-001 a CA-019, nombrados con su ID) y CB-001, CB-002, CB-007, CB-011, CB-017, CB-018; axe en `/login` (todos sus estados) y `/panel`; 360 px, zoom del 200 % y `forcedColors` |
| RT-022 (revisión etapa 6) | Vitest (API: integración con `createTestApp`; web: unitarias) | API: token ausente/incorrecto → cabecera ignorada; token válido → cubos independientes por `X-Perchados-Client-Ip` (A agota con N+1 → 429, B sigue en 200 por el mismo socket); valor no IP → `req.ip`; token oculto en stdout; configuración (`INTERNAL_API_SECRET`, `production` + `TRUST_PROXY=false`). Web: `resolveClientIp` (0/1/2 saltos, ausente, vacío, espacios, no IP, IPv6); `createServerApiClient` sin `X-Forwarded-For` y con las cabeceras internas; `server-env` (`production` + `WEB_TRUST_PROXY_HOPS=0`). Nombrar las pruebas `RT-022` |
| ADR-012 | Vitest + ESLint | Paridad `/client` ↔ clásico (ya existe; obligatoria para todo esquema nuevo de `/client`); un archivo de muestra en `apps/web/src` que importa la entrada principal hace fallar `lint` |
| Docker y CI (comprobación manual en el PR del hito 1) | Docker y GitHub Actions | RT-017 y RT-020 (PR de demostración con error de tipos, secreto de prueba y migración alterada, cerrados sin fusionar) |

- **Datos de prueba:** cuentas de prueba (p. ej. «lucia», un usuario sin rol `admin`) creadas por factories en `apps/api/test/helpers/db.ts` y `apps/web/e2e/fixtures/accounts.ts`, con contraseñas de prueba definidas en el fixture (no son secretos). Para CA-016 y CA-018 los fixtures mueven `locked_until` y `expires_at` en la BD de prueba; no se espera tiempo real.
- **Cobertura:** 80 % de líneas por paquete; los E2E no cuentan.

## Riesgos
| Riesgo | Mitigación |
|--------|------------|
| Versiones distintas de las previstas (Next 16 `proxy.ts`, Prisma 7 + `adapter-pg`, Zod 4 con `zod-to-openapi`, throttler 6) | Verificar con Context7 en la primera tarea de cada hito; los cambios son locales a un archivo |
| Tamaño del PR: es la funcionalidad que levanta toda la base | 4 hitos con PR propio; tareas pequeñas; un commit por tarea |
| Recarga en caliente lenta en Windows con Docker | *Polling* en compose; `node_modules` en volumen con nombre; recomendar WSL2 |
| Binario nativo de `@node-rs/argon2` para el sistema equivocado | Paquetes precompilados por plataforma; instalación dentro del contenedor |
| bfcache de los navegadores muestra el panel al pulsar «Atrás» (CA-011) | `Cache-Control: no-store` + `SessionWatcher` en `pageshow`; E2E específico |
| `\p{L}` admite letras de cualquier alfabeto (no solo latino) | Cumple «solo letras» de RF-015; si el dueño quiere solo alfabeto latino se cambia el esquema (una línea) |
| Escritura en PostgreSQL por petición limitada e intentos de usuarios inexistentes | Volumen del MVP bajo; 10/min por IP en auth; limpieza oportunista |
| Web y API en dominios registrables distintos romperían `SameSite=Strict` | Restricción documentada en ADR-007; el despliegue queda fuera de alcance |
| La contraseña inicial se compartió por chat | Se lee solo del entorno; la spec exige cambiarla antes de producción |
| El proxy de borde de producción no añade `X-Forwarded-For` o la API/web quedan publicadas sin pasar por él (IP suplantable o cubo compartido) | Condiciones del despliegue en «IP del cliente…»; la configuración de producción exige `TRUST_PROXY ≠ false` y `WEB_TRUST_PROXY_HOPS ≥ 1`; queda como restricción para la CD |
| Fuga de `INTERNAL_API_SECRET` | Solo permite elegir la IP del límite (no da sesión, rol ni exención); módulo `server-only`, oculto en logs, rotación reiniciando web y API |
| Deriva entre los esquemas zod y zod/mini | Fuente única `login.rules.ts` + prueba de paridad + regla de lint (ADR-012) |
| Los parámetros de argon2id calibrados en desarrollo son lentos o rápidos en producción | Recalibrar con `bench:hash` en el hardware de producción antes del primer despliegue |

## Fuera de alcance de esta funcionalidad
Recortado de las antiguas 000 y 002 por no aportar al login ni a la DoD:
- **Componente `Checkbox`:** solo lo usaba «Recordar mi usuario», excluido por la spec.
- **Catálogo de componentes `/dev/componentes`** y su variable `WEB_DEV_TOOLS_ENABLED`: la accesibilidad se prueba con `vitest-axe` por componente y con axe sobre las pantallas reales del login y del panel.
- **`DocsModule`** (`/v1/openapi.json` y visor `/v1/docs`) y `API_DOCS_ENABLED`: el contrato queda versionado en `packages/contracts/openapi/v1.json`.
- **Caso de uso `DeactivateAccount`** (revocación de todas las sesiones al desactivar): no hay interfaz para desactivar; CB-012 se cumple porque cada petición comprueba `account.status`.
- **Rol «comprador»** en la migración y el `403` de comprador: las pruebas de CA-019 usan un rol de prueba.
- **Página inicial provisional con el estado de la API (`ApiStatus`)** y su Page Object `HomePage`: `/` redirige al panel.
- **Excepciones del escaneo de dependencias con caducidad** (`security/audit-exceptions.yaml` y su script): si hiciera falta una excepción, se decidirá en su momento con el dueño.
- **Job `imagenes` de la CI** (build de la etapa `prod` en CI): la etapa `prod` se valida en local en la tarea de Docker.
- **Reintento de muestra que falla a propósito** para demostrar el reporte de inestables en un job manual: el reporter se prueba con una prueba unitaria.
- La app móvil, Maestro, el almacenamiento de imágenes, la pasarela de pagos, el despliegue (CD), las alertas, la purga de sesiones caducadas, el MCP de PostgreSQL y las pruebas visuales de regresión.
- Todo lo listado en «Fuera de alcance» de la spec.

## Ajustes aplicados en la revisión de la etapa 6 (2026-10-18)
No cambian requisitos; se dejan constancia y su encaje en el diseño:
- **`request-rejected`** como tipo de problema para los 4xx no mapeados: añadido al catálogo `PROBLEM_TYPES`. Amplía el catálogo, no lo contradice.
- **API solo JSON** (sin `urlencoded`): anotado en «Contratos de API». Coherente con «Zod en el borde».
- **`@Roles` en toda ruta privada salvo lista blanca** (`GET /v1/auth/session`): anotado en A01. Refuerza RT-013 con una segunda lista blanca y su prueba.
- **Evento `auth.logout`**: ya figuraba en A09; el código no lo emitía. Sin contradicción.
- **Nombres de cookie exportados desde contracts:** anotado en «Topología web ↔ API». Sin contradicción.
- **Puertos de Docker en `127.0.0.1`:** todos los puertos publicados de compose (postgres, storage, mailpit, api y web) se enlazan solo a `127.0.0.1`. Sin contradicción con ADR-003; además impide que otro equipo de la red local llegue a la API sin pasar por el navegador del desarrollador.
- **Contradicciones encontradas en el diseño anterior y corregidas aquí:** (1) «Topología» decía que el servidor Next reenvía `X-Forwarded-For` (causa del hallazgo de DoS) → sustituido por RT-022; (2) RT-010 y «Configuración» decían `t=4` → `t=10` calibrado; (3) el objetivo interno «< 120 KB gzip» de `/login` no se cumple (≈ 162 KB) → se deja constancia; el límite que obliga es el de 200 KB de RT-021.

## Preguntas para el dueño (no bloquean el diseño)
- **Proxy de borde de producción (resuelto 2026-10-18):** el dueño acepta como restricción para la futura CD un borde con TLS que añade `X-Forwarded-For` y deja web y API alcanzables solo a través de él (RT-022, ADR-011).
- **Objetivo de JS de `/login` (resuelto 2026-10-18):** el dueño retira el objetivo interno de < 120 KB gzip; obliga el límite de 200 KB de RT-021 (medido ≈ 162 KB).
- **Textos no definidos en la spec:** 429 (límite por IP) y error inesperado (5xx). Se proponen los de «Pantalla de login».
- **Longitud máxima del usuario:** se propone 64 letras como límite técnico; la spec no fija un máximo.
- **Registro de intentos para el responsable:** se resuelve con eventos de log de auditoría (sin el usuario tecleado). Si el responsable necesita consultarlos desde una pantalla o recibirlos por otro medio, sería otra funcionalidad.
- **Mensaje del bloqueo con minutos restantes:** en el quinto fallo dice «30 minutos» (CA-007); en intentos posteriores durante el bloqueo dice los minutos que quedan (CB-005).
- `[POR ACLARAR]` heredado de la spec: dirección de `ADMIN_CONTACT_EMAIL` para producción.
