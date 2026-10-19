import { Prisma } from './generated/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_ROLE_CODE, migrateDeploy, prepareTestDatabase } from '../../../test/helpers/db';
import { createTestApp, type TestApp } from '../../../test/helpers/test-app.factory';

const MIGRATE_DEPLOY_TIMEOUT_MS = 60_000;

describe('Base de datos (migración roles_y_cuentas)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await testApp.reset();
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function createAccount(usernameKey: string, username = usernameKey) {
    const role = await testApp.prisma.role.findUniqueOrThrow({ where: { code: ADMIN_ROLE_CODE } });
    return testApp.prisma.account.create({
      data: { username, usernameKey, roleId: role.id, passwordHash: '$argon2id$hash-de-prueba' },
    });
  }

  it('RF-019: la migración inserta el rol admin / administrador', async () => {
    const role = await testApp.prisma.role.findUniqueOrThrow({ where: { code: ADMIN_ROLE_CODE } });

    expect(role.name).toBe('administrador');
  });

  it('RF-018: una cuenta nueva queda ACTIVE, con 0 intentos fallidos, sin bloqueo y solo un hash', async () => {
    const account = await createAccount('haroldadmin', 'HaroldAdmin');

    expect(account).toMatchObject({
      username: 'HaroldAdmin',
      usernameKey: 'haroldadmin',
      status: 'ACTIVE',
      failedAttempts: 0,
      lockedUntil: null,
      passwordHash: '$argon2id$hash-de-prueba',
    });
    expect(Object.keys(account)).not.toContain('password');
  });

  it('CB-002: dos cuentas con el mismo username_key violan la unicidad', async () => {
    await createAccount('haroldadmin', 'HaroldAdmin');

    const duplicate = createAccount('haroldadmin', 'HAROLDADMIN');

    await expect(duplicate).rejects.toMatchObject({
      code: 'P2002',
      constructor: Prisma.PrismaClientKnownRequestError,
    });
  });

  it('reset conserva el rol de referencia admin y borra cuentas y roles de prueba', async () => {
    await createAccount('otra');
    await testApp.prisma.role.create({ data: { code: 'tester', name: 'tester' } });

    await testApp.reset();

    expect(await testApp.prisma.account.count()).toBe(0);
    expect(await testApp.prisma.role.findMany({ select: { code: true } })).toEqual([
      { code: ADMIN_ROLE_CODE },
    ]);
  });

  // Lanza la CLI de Prisma como proceso hijo (lenta, más con la máquina cargada): timeout propio
  it(
    'RT-008: db:migrate:deploy repetido no aplica nada',
    async () => {
      const output = migrateDeploy((await prepareTestDatabase()).url);

      expect(output).toContain('No pending migrations to apply');
    },
    MIGRATE_DEPLOY_TIMEOUT_MS,
  );
});
