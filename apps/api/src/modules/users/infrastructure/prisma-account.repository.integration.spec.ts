import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_ROLE_CODE, prepareTestDatabase, resetDatabase } from '../../../../test/helpers/db';
import { PrismaTransactionRunner } from '../../../shared/database/prisma-transaction';
import { PrismaService } from '../../../shared/database/prisma.service';

import { PrismaAccountRepository } from './prisma-account.repository';

const MS_PER_MINUTE = 60_000;
const MISSING_ACCOUNT_ID = '0196a0b0-0000-7000-8000-000000000000';

describe('PrismaAccountRepository contra PostgreSQL real (RF-008, RF-009, RF-017)', () => {
  let prisma: PrismaService;
  let repository: PrismaAccountRepository;

  beforeAll(async () => {
    const database = await prepareTestDatabase();
    prisma = new PrismaService({ databaseUrl: database.url });
    repository = new PrismaAccountRepository(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  async function createAccount(
    usernameKey = 'lucia',
    status: 'ACTIVE' | 'DISABLED' = 'ACTIVE',
  ): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: ADMIN_ROLE_CODE } });
    const account = await prisma.account.create({
      data: {
        username: usernameKey,
        usernameKey,
        roleId: role.id,
        status,
        passwordHash: '$argon2id$x',
      },
    });
    return account.id;
  }

  async function readLock(id: string): Promise<{ failedAttempts: number; lockedUntil: Date | null }> {
    const row = await prisma.account.findUniqueOrThrow({
      where: { id },
      select: { failedAttempts: true, lockedUntil: true },
    });
    return row;
  }

  async function fail(id: string, times: number): Promise<void> {
    for (let i = 0; i < times; i += 1) {
      await repository.registerFailedAttempt(id);
    }
  }

  async function setLockedUntilOffset(id: string, minutes: number): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "account" SET "locked_until" = now() + make_interval(mins => ${minutes}::int)
      WHERE "id" = ${id}::uuid`;
  }

  describe('findByUsernameKey', () => {
    it('devuelve la cuenta con su rol, estado y bloqueo, y la hora de la BD', async () => {
      const id = await createAccount('lucia');

      const found = await repository.findByUsernameKey('lucia');

      expect(found).not.toBeNull();
      expect(found?.account.id).toBe(id);
      expect(found?.account.roleCode).toBe(ADMIN_ROLE_CODE);
      expect(found?.account.isActive()).toBe(true);
      expect(found?.account.passwordHash).toBe('$argon2id$x');
      expect(found?.account.lock.failedAttempts).toBe(0);
      expect(found?.account.lock.lockedUntil).toBeNull();
      expect(Math.abs((found?.observedAt.getTime() ?? 0) - Date.now())).toBeLessThan(60_000);
    });

    it('devuelve null si no existe y la cuenta DISABLED con su estado', async () => {
      await createAccount('inactiva', 'DISABLED');

      expect(await repository.findByUsernameKey('nadie')).toBeNull();
      const disabled = await repository.findByUsernameKey('inactiva');
      expect(disabled?.account.isActive()).toBe(false);
    });

    it('trata la clave como dato: un intento de inyección no encuentra nada', async () => {
      await createAccount('lucia');

      expect(await repository.findByUsernameKey("lucia' OR '1'='1")).toBeNull();
    });
  });

  describe('registerFailedAttempt', () => {
    it('4 fallos no bloquean; el 5.º bloquea 30 minutos con la hora de la BD (CA-007)', async () => {
      const id = await createAccount();

      await fail(id, 4);
      expect(await readLock(id)).toEqual({ failedAttempts: 4, lockedUntil: null });

      const fifth = await repository.registerFailedAttempt(id);

      expect(fifth.lock.failedAttempts).toBe(5);
      expect(fifth.lock.isLocked(fifth.observedAt)).toBe(true);
      expect(fifth.lock.minutesRemaining(fifth.observedAt)).toBe(30);
      expect(fifth.lock.lockedUntil?.getTime()).toBe(fifth.observedAt.getTime() + 30 * MS_PER_MINUTE);
      const stored = await readLock(id);
      expect(stored.failedAttempts).toBe(5);
      expect(stored.lockedUntil).toEqual(fifth.lock.lockedUntil);
    });

    it('un fallo con la cuenta bloqueada no cambia el contador ni alarga el bloqueo (CB-005)', async () => {
      const id = await createAccount();
      await fail(id, 5);
      const before = await readLock(id);

      const again = await repository.registerFailedAttempt(id);

      expect(again.lock.failedAttempts).toBe(5);
      expect(again.lock.lockedUntil).toEqual(before.lockedUntil);
      expect(await readLock(id)).toEqual(before);
    });

    it('con el bloqueo vencido un fallo empieza un contador nuevo en 1 (CB-013, RF-017)', async () => {
      const id = await createAccount();
      await fail(id, 5);
      await setLockedUntilOffset(id, -1);

      const snapshot = await repository.registerFailedAttempt(id);

      expect(snapshot.lock.failedAttempts).toBe(1);
      expect(snapshot.lock.lockedUntil).toBeNull();
      expect(await readLock(id)).toEqual({ failedAttempts: 1, lockedUntil: null });
    });

    it('tras el desbloqueo hacen falta 5 fallos nuevos para volver a bloquear (CB-013)', async () => {
      const id = await createAccount();
      await fail(id, 5);
      await setLockedUntilOffset(id, -1);

      await fail(id, 4);
      expect(await readLock(id)).toEqual({ failedAttempts: 4, lockedUntil: null });

      const fifth = await repository.registerFailedAttempt(id);
      expect(fifth.lock.isLocked(fifth.observedAt)).toBe(true);
    });

    it('el bloqueo que vence exactamente ahora cuenta como vencido', async () => {
      const id = await createAccount();
      await fail(id, 5);
      await prisma.$executeRaw`UPDATE "account" SET "locked_until" = now() WHERE "id" = ${id}::uuid`;

      const snapshot = await repository.registerFailedAttempt(id);

      expect(snapshot.lock.failedAttempts).toBe(1);
      expect(snapshot.lock.lockedUntil).toBeNull();
    });

    it('3 fallos concurrentes cuentan exactamente 3 (CB-006)', async () => {
      const id = await createAccount();

      await Promise.all([1, 2, 3].map(() => repository.registerFailedAttempt(id)));

      expect(await readLock(id)).toEqual({ failedAttempts: 3, lockedUntil: null });
    });

    it('10 fallos concurrentes dejan contador coherente y un único bloqueo (CB-006)', async () => {
      const id = await createAccount();

      const snapshots = await Promise.all(
        Array.from({ length: 10 }, () => repository.registerFailedAttempt(id)),
      );

      const stored = await readLock(id);
      expect(stored.failedAttempts).toBe(5);
      expect(stored.lockedUntil).not.toBeNull();
      const lockedUntils = new Set(snapshots.map((s) => s.lock.lockedUntil?.getTime()));
      lockedUntils.delete(undefined);
      expect(lockedUntils.size).toBe(1);
      expect([...lockedUntils][0]).toBe(stored.lockedUntil?.getTime());
      const counts = snapshots.map((s) => s.lock.failedAttempts).sort((a, b) => a - b);
      expect(counts).toEqual([1, 2, 3, 4, 5, 5, 5, 5, 5, 5]);
    });

    it('no afecta a otras cuentas', async () => {
      const id = await createAccount('lucia');
      const other = await createAccount('marta');

      await fail(id, 5);

      expect(await readLock(other)).toEqual({ failedAttempts: 0, lockedUntil: null });
    });

    it('falla con un error si la cuenta no existe', async () => {
      await expect(repository.registerFailedAttempt(MISSING_ACCOUNT_ID)).rejects.toThrow(
        'account not found',
      );
    });
  });

  describe('resetLoginAttempts', () => {
    it('pone el contador a 0 y limpia el bloqueo tras un acierto (RF-009, CA-008)', async () => {
      const id = await createAccount();
      await fail(id, 3);

      await repository.resetLoginAttempts(id);

      expect(await readLock(id)).toEqual({ failedAttempts: 0, lockedUntil: null });
    });

    it('limpia también un bloqueo ya vencido (CA-016)', async () => {
      const id = await createAccount();
      await fail(id, 5);
      await setLockedUntilOffset(id, -5);

      await repository.resetLoginAttempts(id);

      expect(await readLock(id)).toEqual({ failedAttempts: 0, lockedUntil: null });
    });
  });

  describe('con transacción', () => {
    it('reset y cambio de hash se revierten juntos si la transacción falla', async () => {
      const id = await createAccount();
      await fail(id, 3);
      const runner = new PrismaTransactionRunner(prisma);

      await expect(
        runner.run(async (tx) => {
          await repository.resetLoginAttempts(id, tx);
          await repository.updatePasswordHash(id, '$argon2id$new', tx);
          throw new Error('abort');
        }),
      ).rejects.toThrow('abort');

      expect(await readLock(id)).toMatchObject({ failedAttempts: 3 });
      expect((await prisma.account.findUniqueOrThrow({ where: { id } })).passwordHash).toBe('$argon2id$x');
    });

    it('reset y cambio de hash se confirman juntos si la transacción termina', async () => {
      const id = await createAccount();
      await fail(id, 3);
      const runner = new PrismaTransactionRunner(prisma);

      await runner.run(async (tx) => {
        await repository.resetLoginAttempts(id, tx);
        await repository.updatePasswordHash(id, '$argon2id$new', tx);
      });

      expect(await readLock(id)).toEqual({ failedAttempts: 0, lockedUntil: null });
      expect((await prisma.account.findUniqueOrThrow({ where: { id } })).passwordHash).toBe('$argon2id$new');
    });
  });

  describe('updatePasswordHash', () => {
    it('sustituye el hash sin transacción y no toca otras cuentas', async () => {
      const id = await createAccount();
      const other = await createAccount('maria');

      await repository.updatePasswordHash(id, '$argon2id$new');

      expect((await prisma.account.findUniqueOrThrow({ where: { id } })).passwordHash).toBe('$argon2id$new');
      expect((await prisma.account.findUniqueOrThrow({ where: { id: other } })).passwordHash).toBe('$argon2id$x');
    });
  });
});
