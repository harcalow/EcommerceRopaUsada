---
name: prisma-datos
description: Convenciones de datos de apps/api verificadas en la 001: Prisma 7 con adapter-pg y PrismaService, migraciones versionadas e inmutables (ci:migrations), scripts db:*, TransactionRunner y tx? opcional en repositorios (sin derivar hashes dentro de la transacción), contadores atómicos con la hora de la BD, semillas idempotentes (runSeed y SeedStep), BD de pruebas por ejecución (globalSetup) y createTestApp. Úsala al tocar el esquema, un repositorio, una semilla o pruebas de integración con BD.
user-invocable: false
---

# Datos con Prisma 7 en `apps/api`

Complementa `nestjs-hexagonal` y `docker-dev`. Los ejemplos son documentación, no código del repositorio.

## 1. Cliente y esquema
- Esquema: `apps/api/prisma/schema.prisma`; generador `prisma-client` con salida en `src/shared/database/generated/` (ignorado por Git: `pnpm --filter @perchados/api db:generate`). Configuración en `prisma.config.ts` (`DATABASE_URL`).
- `PrismaService` (`shared/database`) extiende `PrismaClient` con `@prisma/adapter-pg`, conexión **perezosa** (la API arranca sin PostgreSQL), timeout de conexión de 5 s y errores de pool registrados sin datos sensibles. Se inyecta **solo en `infrastructure/`**; dominio y aplicación jamás ven Prisma (reglas ESLint de capas).
- SQL a mano solo con plantillas parametrizadas (`$queryRaw`/`$executeRaw` con `Prisma.sql`); nunca concatenes valores.

```ts
// ❌ Prisma en un caso de uso y SQL concatenado
constructor(private readonly prisma: PrismaService) {}
await this.prisma.$queryRawUnsafe(`SELECT * FROM account WHERE username_key = '${name}'`);
// ✅ Puerto en application; adaptador en infrastructure con plantilla parametrizada
await this.prisma.$queryRaw`SELECT id FROM account WHERE username_key = ${usernameKey}`;
```

## 2. Migraciones
- Una migración por cambio de esquema: `pnpm db:migrate` (`prisma migrate dev`, solo en local) crea `prisma/migrations/AAAAMMDDHHMMSS_nombre/`. En CI y entornos: `pnpm db:migrate:deploy`.
- **Una migración fusionada no se edita, borra ni renombra** nunca; se corrige con una migración nueva. `pnpm ci:migrations --base <sha>` (`scripts/ci/check-migrations-immutable.mjs`, job `calidad`) falla si se toca una existente; su prueba es `pnpm test:scripts`.
- Cambios destructivos en dos pasos (expandir y luego contraer) para no romper una versión desplegada.
- Con Docker en WSL, `DATABASE_URL` apunta a `localhost:${POSTGRES_PORT}`; la BD de E2E es `perchados_e2e` (ver `docker-dev`).

```text
❌ editar prisma/migrations/20261016000000_sesiones/migration.sql
✅ crear prisma/migrations/2026xxxxxxxxxx_corrige_x/ con el cambio
```

## 3. Repositorios y transacciones
- Los repositorios implementan puertos de `application/ports/` y devuelven objetos de dominio o instantáneas, no modelos de Prisma.
- Unidad de trabajo entre módulos: `TransactionRunner` (token `TRANSACTION_RUNNER`, provisto por `DatabaseModule`). `run(tx => ...)` entrega un `TransactionContext` **opaco**; cada método de repositorio que deba participar acepta `tx?: TransactionContext` como **último parámetro opcional** y elige el cliente con `clientFor(this.prisma, tx)`.
- La transacción tiene `maxWait` 2 s y `timeout` 5 s: solo escrituras cortas. **Nunca derives un hash (argon2id) ni llames a un servicio externo dentro de la transacción**: se calcula antes (ver `LogIn.complete`: `needsRehash` → `hash` fuera; dentro solo `resetLoginAttempts`, `updatePasswordHash` y `OpenSession`).
- Una sesión nueva y la revocación de la previa ocurren en la misma transacción.

```ts
// ❌ Hash dentro de la transacción: retiene la conexión cientos de ms
await this.transactions.run(async (tx) => {
  const hash = await this.hasher.hash(password);
  await this.accounts.updatePasswordHash(id, hash, tx);
});
// ✅ Se calcula fuera; la transacción solo escribe
const hash = await this.hasher.hash(password);
await this.transactions.run((tx) => this.accounts.updatePasswordHash(id, hash, tx));
```

## 4. Concurrencia y contadores atómicos
- Nada de leer y luego escribir sin condición. Los contadores (intentos fallidos, límite de peticiones) son **una sola sentencia** `UPDATE`/`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, con la **hora de la BD** (`date_trunc('milliseconds', now())`), nunca la del proceso: así varias instancias y relojes desfasados no alteran el resultado.
- Ejemplos reales: `PrismaAccountRepository.registerFailedAttempt` (bloqueo vigente no se alarga; el vencido reinicia en 1; devuelve `observedAt` de la BD) y `PostgresThrottlerStorage` (contador acotado a límite+1, limpieza en el 1 % de las escrituras).
- Las reglas de negocio viven en el dominio (`LoginLock`) y el SQL replica solo lo imprescindible; ambas se prueban con las mismas tablas de casos.
- Los tiempos en pruebas: `Clock` inyectable en casos de uso; en repositorios, mover columnas en la BD (no `sleep`).

```ts
// ❌ Condición de carrera y reloj del proceso
const a = await prisma.account.findUnique({ where: { id } });
await prisma.account.update({ where: { id }, data: { failedAttempts: a.failedAttempts + 1, lockedUntil: new Date(Date.now() + 1.8e6) } });
// ✅ Una sentencia atómica con now() de la BD
await prisma.$queryRaw`UPDATE account SET failed_attempts = CASE WHEN ... END WHERE id = ${id} RETURNING failed_attempts, locked_until`;
```

## 5. Semillas idempotentes
- `pnpm db:seed` ejecuta `dist/prisma/seed/main.js` (Turborepo compila antes). `runSeed` (`prisma/seed/runner.ts`): valida las variables de **todos** los pasos antes de escribir; ejecuta los pasos en **una transacción** (rollback total si uno falla); registra logs JSON por paso tras confirmar, sin mensajes de error ni valores; sale con código 1 nombrando la variable, nunca su valor.
- Paso nuevo: implementar `SeedStep` (`name`, `prepare(env)` valida y devuelve `SeedExecutor` `(tx) => 'created' | 'skipped'`) y registrarlo en `prisma/seed/steps/index.ts`.
- Idempotente: re-ejecutar no cambia nada (`ON CONFLICT DO NOTHING`/`skipDuplicates`; si existe el `username_key`, no se toca). Los secretos llegan por entorno (`ADMIN_INITIAL_PASSWORD`), nunca en el código. Comparte parámetros con la API (`passwordHashFields`).
- Claves de unicidad con la fuente única: `toUsernameKey` de `@perchados/contracts`.

## 6. Pruebas con BD
- `vitest.config.mts` declara `globalSetup: test/helpers/global-setup.ts`: cada ejecución clona una plantilla migrada (`<prefijo>_tpl_<huella>_test`, bajo `pg_advisory_lock`) en su propia BD `*_test` y la borra al terminar; las huérfanas de más de 1 h se limpian y se rechaza cualquier BD sin sufijo `_test`. Ejecuciones simultáneas no se pisan. Si PostgreSQL no está accesible, las unitarias siguen y las de integración fallan con un mensaje claro.
- Los archivos corren en serie (`fileParallelism: false`) porque comparten esa BD.
- `createTestApp({ env?, controllers? })`: la app real (`AppModule`) con logs capturados, `t.reset()` (vacía cuentas, contadores y roles de prueba, conserva el rol `admin`), `t.prisma`, `t.server`, `t.close()`. **Una app por archivo.**
- Pruebas unitarias de casos de uso con dobles en `test/helpers/` (`InMemory*`, `Fake*`) y el dominio real; sin BD.
- Nunca apuntes las pruebas a la BD de desarrollo ni a una de producción.

```ts
// ❌ Una app por prueba y BD fija compartida
beforeEach(async () => { app = await bootstrapWithDevDatabase(); });
// ✅ Una app por archivo, BD propia de la ejecución, reset entre pruebas
const t = await createTestApp();
beforeEach(t.reset);
afterAll(t.close);
```

## Checklist de un cambio de datos
1. Esquema Prisma + migración nueva (nunca editar una existente) + `pnpm db:generate`.
2. Puerto en `application`, adaptador Prisma en `infrastructure`, `tx?` si participa en una transacción.
3. Contadores y estados concurrentes en una sola sentencia con la hora de la BD.
4. Semilla idempotente si hay datos de referencia.
5. Prueba de integración con `createTestApp`; `pnpm ci:migrations` limpio.
