import { describe, expect, it, vi } from 'vitest';

import { SeedConfigError, type SeedTransaction } from '../seed-step';

import { adminInicialStep } from './admin-inicial.step';

const PASSWORD = 'clave-de-prueba-unitaria';
const FAST_HASH = {
  PASSWORD_HASH_MEMORY_KIB: '19456',
  PASSWORD_HASH_ITERATIONS: '2',
  PASSWORD_HASH_PARALLELISM: '1',
};

function fakeTx(existing: number, created = 1) {
  const account = {
    count: vi.fn().mockResolvedValue(existing),
    createMany: vi.fn().mockResolvedValue({ count: created }),
  };
  const role = { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'role-id' }) };
  return { tx: { account, role } as unknown as SeedTransaction, account, role };
}

function configError(env: NodeJS.ProcessEnv): SeedConfigError {
  try {
    void adminInicialStep.prepare(env);
  } catch (error) {
    if (error instanceof SeedConfigError) {
      return error;
    }
  }
  throw new Error('prepare should have thrown SeedConfigError');
}

describe('paso admin-inicial (unitario)', () => {
  it('sin ADMIN_INITIAL_PASSWORD lanza un error que nombra la variable', () => {
    const error = configError({ ...FAST_HASH });

    expect(error.variables).toEqual(['ADMIN_INITIAL_PASSWORD']);
    expect(error.message).toContain('ADMIN_INITIAL_PASSWORD');
  });

  it('con menos de 8 caracteres falla sin incluir el valor en el mensaje', () => {
    const short = 'abc1234';
    const error = configError({ ...FAST_HASH, ADMIN_INITIAL_PASSWORD: short });

    expect(error.variables).toEqual(['ADMIN_INITIAL_PASSWORD']);
    expect(error.message).not.toContain(short);
  });

  it('con más de 128 caracteres falla', () => {
    const error = configError({ ...FAST_HASH, ADMIN_INITIAL_PASSWORD: 'a'.repeat(129) });

    expect(error.variables).toEqual(['ADMIN_INITIAL_PASSWORD']);
  });

  it('con exactamente 8 caracteres es válida (CB-015)', async () => {
    await expect(
      Promise.resolve(adminInicialStep.prepare({ ...FAST_HASH, ADMIN_INITIAL_PASSWORD: 'abcd1234' })),
    ).resolves.toBeTypeOf('function');
  });

  it('parámetros de hash por debajo del mínimo OWASP se rechazan nombrando la variable', () => {
    const error = configError({
      ADMIN_INITIAL_PASSWORD: PASSWORD,
      PASSWORD_HASH_MEMORY_KIB: '1024',
      PASSWORD_HASH_ITERATIONS: '2',
    });

    expect(error.variables).toEqual(['PASSWORD_HASH_MEMORY_KIB']);
  });

  it('parámetros de hash no numéricos se rechazan nombrando la variable', () => {
    const error = configError({ ADMIN_INITIAL_PASSWORD: PASSWORD, PASSWORD_HASH_ITERATIONS: 'x' });

    expect(error.variables).toEqual(['PASSWORD_HASH_ITERATIONS']);
    expect(error.message).not.toContain(PASSWORD);
  });

  it('si la cuenta ya existe se omite sin hashear ni escribir', async () => {
    const { tx, account, role } = fakeTx(1);

    const outcome = await (await adminInicialStep.prepare({ ...FAST_HASH, ADMIN_INITIAL_PASSWORD: PASSWORD }))(tx);

    expect(outcome).toBe('skipped');
    expect(account.count).toHaveBeenCalledWith({ where: { usernameKey: 'haroldadmin' } });
    expect(account.createMany).not.toHaveBeenCalled();
    expect(role.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('si no existe crea HaroldAdmin con el rol admin y solo el hash argon2id', async () => {
    const { tx, account, role } = fakeTx(0);

    const outcome = await (await adminInicialStep.prepare({ ...FAST_HASH, ADMIN_INITIAL_PASSWORD: PASSWORD }))(tx);

    expect(outcome).toBe('created');
    expect(role.findUniqueOrThrow).toHaveBeenCalledWith({ where: { code: 'admin' } });
    const [call] = account.createMany.mock.calls as [[{ data: { passwordHash: string }[] }]];
    const [row] = call[0].data;
    expect(row).toMatchObject({ username: 'HaroldAdmin', usernameKey: 'haroldadmin', roleId: 'role-id' });
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row?.passwordHash).not.toContain(PASSWORD);
  });

  it('RT-021: el hash se calcula en prepare, antes de tocar la transacción', async () => {
    const { tx, account } = fakeTx(0);

    const executor = await adminInicialStep.prepare({ ...FAST_HASH, ADMIN_INITIAL_PASSWORD: PASSWORD });

    expect(account.count).not.toHaveBeenCalled();
    expect(account.createMany).not.toHaveBeenCalled();
    await executor(tx);
    expect(account.createMany).toHaveBeenCalledTimes(1);
  });

  it('si otra ejecución creó la cuenta en paralelo (createMany devuelve 0) se considera omitida', async () => {
    const { tx } = fakeTx(0, 0);

    const outcome = await (await adminInicialStep.prepare({ ...FAST_HASH, ADMIN_INITIAL_PASSWORD: PASSWORD }))(tx);

    expect(outcome).toBe('skipped');
  });
});
