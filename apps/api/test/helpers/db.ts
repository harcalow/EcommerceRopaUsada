import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { ADMIN_ROLE_CODE } from '../../src/shared/auth/admin-role';
import type { PrismaService } from '../../src/shared/database/prisma.service';

/** Código del rol de referencia que inserta la migración `roles_y_cuentas`. */
export { ADMIN_ROLE_CODE };

const TEST_DATABASE_NAME = /^[a-z][a-z0-9_]*_test$/;

export interface TestDatabase {
  readonly url: string;
  readonly name: string;
}

/**
 * Resuelve la BD de pruebas: `TEST_DATABASE_URL` o, si no existe, `DATABASE_URL` con el nombre
 * de la base terminado en `_test` (p. ej. `perchados_test`). Nunca devuelve una base que no
 * termine en `_test`, para no truncar datos de desarrollo.
 */
export function resolveTestDatabase(env: NodeJS.ProcessEnv = process.env): TestDatabase {
  const explicit = env.TEST_DATABASE_URL;
  const base = explicit ?? env.DATABASE_URL;
  if (base === undefined || base === '') {
    throw new Error('DATABASE_URL (or TEST_DATABASE_URL) is required to run integration tests');
  }
  const url = new URL(base);
  const current = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const name = explicit === undefined && !current.endsWith('_test') ? `${current}_test` : current;
  if (!TEST_DATABASE_NAME.test(name)) {
    throw new Error('The test database name must match ^[a-z][a-z0-9_]*_test$');
  }
  url.pathname = `/${name}`;
  return { url: url.toString(), name };
}

const MIGRATE_ATTEMPTS = 3;

function migrateDeployOnce(databaseUrl: string): string {
  const prismaCli = join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
  return execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

/**
 * Ejecuta `prisma migrate deploy` contra la URL dada y devuelve su salida estándar. Reintenta si
 * el servidor no responde (P1001), que ocurre de forma esporádica con la máquina cargada.
 */
export function migrateDeploy(databaseUrl: string): string {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return migrateDeployOnce(databaseUrl);
    } catch (error) {
      const unreachable = error instanceof Error && error.message.includes('P1001');
      if (!unreachable || attempt >= MIGRATE_ATTEMPTS) throw error;
    }
  }
}

/**
 * Variable con la URL de la BD de esta ejecución de pruebas. La fija el `globalSetup` de Vitest
 * (una BD por ejecución, clonada de una plantilla migrada) para que ejecuciones simultáneas no
 * se pisen.
 */
export const RUN_DATABASE_URL_ENV = 'TEST_RUN_DATABASE_URL';

/** Devuelve la BD de pruebas de esta ejecución; solo acepta nombres con el sufijo `_test`. */
export function prepareTestDatabase(env: NodeJS.ProcessEnv = process.env): Promise<TestDatabase> {
  const raw = env[RUN_DATABASE_URL_ENV];
  if (raw === undefined || raw === '') {
    return Promise.reject(
      new Error(
        `${RUN_DATABASE_URL_ENV} is not set: the integration tests need the Vitest globalSetup (is PostgreSQL reachable?)`,
      ),
    );
  }
  const url = new URL(raw);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!TEST_DATABASE_NAME.test(name)) {
    return Promise.reject(new Error('The test database name must match ^[a-z][a-z0-9_]*_test$'));
  }
  return Promise.resolve({ url: url.toString(), name });
}

/** Vacía los datos de las pruebas y conserva el rol de referencia `admin`. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.rateLimitCounter.deleteMany();
  await prisma.loginAttemptUnknown.deleteMany();
  await prisma.account.deleteMany();
  await prisma.role.deleteMany({ where: { code: { not: ADMIN_ROLE_CODE } } });
}
