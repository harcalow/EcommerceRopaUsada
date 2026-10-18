import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prepareTestDatabase } from '../../../test/helpers/db';
import { createLogCapture } from '../../../test/helpers/logged-app';
import { Argon2idPasswordHasher } from '../../../src/modules/auth/infrastructure/argon2id-password-hasher';
import { PrismaService } from '../../../src/shared/database/prisma.service';
import { runSeedCli } from '../cli';

import { SEED_STEPS } from './index';

const TEST_PASSWORD = 'Contrasena-De-Prueba-9';
const FAST_HASH = {
  PASSWORD_HASH_MEMORY_KIB: '19456',
  PASSWORD_HASH_ITERATIONS: '2',
  PASSWORD_HASH_PARALLELISM: '1',
};
const hasher = new Argon2idPasswordHasher({ memoryKib: 19456, iterations: 2, parallelism: 1 });

describe('semilla admin-inicial contra PostgreSQL real (RF-018, RF-019, CA-017)', () => {
  let databaseUrl: string;
  let prisma: PrismaService;

  beforeAll(async () => {
    databaseUrl = (await prepareTestDatabase()).url;
    prisma = new PrismaService({ databaseUrl });
  });

  beforeEach(async () => {
    await prisma.account.deleteMany();
  });

  afterAll(async () => {
    await prisma.account.deleteMany();
    await prisma.$disconnect();
  });

  async function seed(env: Record<string, string>) {
    const capture = createLogCapture();
    const code = await runSeedCli({
      env: { DATABASE_URL: databaseUrl, ...FAST_HASH, ...env },
      steps: SEED_STEPS,
      destination: capture.destination,
    });
    return { code, capture };
  }

  it('CA-017: crea HaroldAdmin con rol admin y un hash argon2id que verifica y no contiene la contraseña', async () => {
    const { code, capture } = await seed({ ADMIN_INITIAL_PASSWORD: TEST_PASSWORD });

    expect(code).toBe(0);
    const accounts = await prisma.account.findMany({ include: { role: true } });
    expect(accounts).toHaveLength(1);
    const [account] = accounts;
    expect(account).toMatchObject({
      username: 'HaroldAdmin',
      usernameKey: 'haroldadmin',
      status: 'ACTIVE',
      failedAttempts: 0,
      lockedUntil: null,
      role: { code: 'admin' },
    });
    expect(account?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(account?.passwordHash).not.toContain(TEST_PASSWORD);
    expect(await hasher.verify(account?.passwordHash ?? '', TEST_PASSWORD)).toBe(true);
    expect(await hasher.verify(account?.passwordHash ?? '', 'otra-contrasena')).toBe(false);
    expect(capture.lines.join('\n')).not.toContain(TEST_PASSWORD);
  });

  it('ejecutarla dos veces no duplica nada y no sobrescribe un hash cambiado a mano', async () => {
    await seed({ ADMIN_INITIAL_PASSWORD: TEST_PASSWORD });
    await prisma.account.updateMany({ data: { passwordHash: '$argon2id$cambiado-a-mano' } });

    const second = await seed({ ADMIN_INITIAL_PASSWORD: 'Otra-Contrasena-123' });

    expect(second.code).toBe(0);
    expect(second.capture.records().filter((r) => r.msg === 'seed step applied')).toMatchObject([
      { step: 'admin-inicial', outcome: 'skipped' },
    ]);
    const accounts = await prisma.account.findMany();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.passwordHash).toBe('$argon2id$cambiado-a-mano');
  });

  it('una cuenta existente con otra capitalización también cuenta como existente', async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'admin' } });
    await prisma.account.create({
      data: { username: 'HAROLDADMIN', usernameKey: 'haroldadmin', roleId: role.id, passwordHash: 'x' },
    });

    const result = await seed({ ADMIN_INITIAL_PASSWORD: TEST_PASSWORD });

    expect(result.code).toBe(0);
    expect(await prisma.account.count()).toBe(1);
  });

  it('sin ADMIN_INITIAL_PASSWORD sale con 1, nombra la variable y no crea datos', async () => {
    const { code, capture } = await seed({});

    expect(code).toBe(1);
    expect(await prisma.account.count()).toBe(0);
    expect(capture.records()[0]).toMatchObject({ level: 'error', variables: ['ADMIN_INITIAL_PASSWORD'] });
  });

  it('con 7 caracteres sale con 1, nombra la variable, no crea datos y no imprime el valor', async () => {
    const short = 'abc1234';
    const { code, capture } = await seed({ ADMIN_INITIAL_PASSWORD: short });

    expect(code).toBe(1);
    expect(await prisma.account.count()).toBe(0);
    expect(capture.records()[0]).toMatchObject({ level: 'error', variables: ['ADMIN_INITIAL_PASSWORD'] });
    expect(capture.lines.join('\n')).not.toContain(short);
  });
});
