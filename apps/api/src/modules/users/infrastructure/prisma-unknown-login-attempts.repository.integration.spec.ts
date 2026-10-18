import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prepareTestDatabase, resetDatabase } from '../../../../test/helpers/db';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { LoginLockSnapshot } from '../application/ports/login-lock-snapshot';
import { LOGIN_LOCK_MINUTES } from '../domain/login-lock';

import { PrismaAccountRepository } from './prisma-account.repository';
import { PrismaUnknownLoginAttemptsRepository } from './prisma-unknown-login-attempts.repository';

const MS_PER_MINUTE = 60_000;

describe('PrismaUnknownLoginAttemptsRepository contra PostgreSQL real (CB-004)', () => {
  let prisma: PrismaService;
  let repository: PrismaUnknownLoginAttemptsRepository;
  let accounts: PrismaAccountRepository;

  beforeAll(async () => {
    const database = await prepareTestDatabase();
    prisma = new PrismaService({ databaseUrl: database.url });
    repository = new PrismaUnknownLoginAttemptsRepository(prisma, () => 1);
    accounts = new PrismaAccountRepository(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  async function readRow(
    key: string,
  ): Promise<{ failedAttempts: number; lockedUntil: Date | null } | null> {
    return prisma.loginAttemptUnknown.findUnique({
      where: { usernameKey: key },
      select: { failedAttempts: true, lockedUntil: true },
    });
  }

  async function fail(key: string, times: number): Promise<void> {
    for (let i = 0; i < times; i += 1) {
      await repository.registerFailedAttempt(key);
    }
  }

  async function expireLock(key: string, minutes: number): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "login_attempt_unknown" SET "locked_until" = now() + make_interval(mins => ${minutes}::int)
      WHERE "username_key" = ${key}`;
  }

  it('el primer fallo crea la fila con contador 1 y sin bloqueo', async () => {
    const snapshot = await repository.registerFailedAttempt('fantasma');

    expect(snapshot.lock.failedAttempts).toBe(1);
    expect(snapshot.lock.isLocked(snapshot.observedAt)).toBe(false);
    expect(await readRow('fantasma')).toEqual({ failedAttempts: 1, lockedUntil: null });
  });

  it('5 fallos con un usuario inexistente producen el mismo resultado observable que con una cuenta real y no crean filas en account (CB-004)', async () => {
    const role = await prisma.role.findFirstOrThrow();
    const real = await prisma.account.create({
      data: { username: 'real', usernameKey: 'real', roleId: role.id, passwordHash: '$argon2id$x' },
    });
    const accountsBefore = await prisma.account.count();

    const realResults: LoginLockSnapshot[] = [];
    const unknownResults: LoginLockSnapshot[] = [];
    for (let i = 0; i < 5; i += 1) {
      realResults.push(await accounts.registerFailedAttempt(real.id));
      unknownResults.push(await repository.registerFailedAttempt('fantasma'));
    }

    const observe = (s: LoginLockSnapshot): [number, boolean, number] => [
      s.lock.failedAttempts,
      s.lock.isLocked(s.observedAt),
      s.lock.minutesRemaining(s.observedAt),
    ];
    expect(unknownResults.map(observe)).toEqual(realResults.map(observe));
    expect(unknownResults.map(observe)[3]).toEqual([4, false, 0]);
    expect(unknownResults.map(observe)[4]).toEqual([5, true, LOGIN_LOCK_MINUTES]);
    expect(await prisma.account.count()).toBe(accountsBefore);
    expect(await prisma.account.findUnique({ where: { usernameKey: 'fantasma' } })).toBeNull();
  });

  it('un fallo con el bloqueo vigente no cambia el contador ni alarga el bloqueo (CB-005)', async () => {
    await fail('fantasma', 5);
    const before = await readRow('fantasma');

    const again = await repository.registerFailedAttempt('fantasma');

    expect(again.lock.failedAttempts).toBe(5);
    expect(again.lock.lockedUntil).toEqual(before?.lockedUntil);
    expect(await readRow('fantasma')).toEqual(before);
  });

  it('con el bloqueo vencido empieza un contador nuevo y hacen falta 5 fallos nuevos (CB-013)', async () => {
    await fail('fantasma', 5);
    await expireLock('fantasma', -1);

    const first = await repository.registerFailedAttempt('fantasma');
    expect(first.lock.failedAttempts).toBe(1);
    expect(first.lock.lockedUntil).toBeNull();

    await fail('fantasma', 3);
    expect(await readRow('fantasma')).toEqual({ failedAttempts: 4, lockedUntil: null });
    const fifth = await repository.registerFailedAttempt('fantasma');
    expect(fifth.lock.isLocked(fifth.observedAt)).toBe(true);
  });

  it('el bloqueo se fija con la hora de la BD: 30 minutos exactos', async () => {
    await fail('fantasma', 4);

    const fifth = await repository.registerFailedAttempt('fantasma');

    expect(fifth.lock.lockedUntil?.getTime()).toBe(fifth.observedAt.getTime() + 30 * MS_PER_MINUTE);
  });

  it('fallos concurrentes sobre un usuario nuevo cuentan exactamente N (CB-006)', async () => {
    await Promise.all([1, 2, 3, 4].map(() => repository.registerFailedAttempt('fantasma')));

    expect(await readRow('fantasma')).toEqual({ failedAttempts: 4, lockedUntil: null });
  });

  it('10 fallos concurrentes dejan contador coherente y un único bloqueo (CB-006)', async () => {
    const snapshots = await Promise.all(
      Array.from({ length: 10 }, () => repository.registerFailedAttempt('fantasma')),
    );

    const stored = await readRow('fantasma');
    expect(stored?.failedAttempts).toBe(5);
    const lockedUntils = new Set(snapshots.map((s) => s.lock.lockedUntil?.getTime()));
    lockedUntils.delete(undefined);
    expect(lockedUntils.size).toBe(1);
    expect([...lockedUntils][0]).toBe(stored?.lockedUntil?.getTime());
    expect(await prisma.loginAttemptUnknown.count()).toBe(1);
  });

  it('cada nombre tiene su propio contador y la clave se trata como dato', async () => {
    await fail('uno', 5);
    const injected = await repository.registerFailedAttempt("x'; DROP TABLE account; --");

    expect(await readRow('dos')).toBeNull();
    expect(injected.lock.failedAttempts).toBe(1);
    expect(await prisma.account.count()).toBeGreaterThanOrEqual(0);
  });

  describe('limpieza oportunista', () => {
    it('borra filas sin bloqueo vigente y sin actividad en 24 h, y conserva las demás', async () => {
      await fail('vieja', 2);
      await fail('bloqueada', 5);
      await fail('reciente', 1);
      await prisma.$executeRaw`
        UPDATE "login_attempt_unknown" SET "updated_at" = now() - interval '25 hours'
        WHERE "username_key" IN ('vieja', 'bloqueada')`;

      await new PrismaUnknownLoginAttemptsRepository(prisma, () => 0).registerFailedAttempt('otra');

      expect(await readRow('vieja')).toBeNull();
      expect(await readRow('bloqueada')).not.toBeNull();
      expect(await readRow('reciente')).not.toBeNull();
      expect(await readRow('otra')).not.toBeNull();
    });

    it('no limpia cuando el azar no cae dentro del 1 %', async () => {
      const noCleanup = new PrismaUnknownLoginAttemptsRepository(prisma, () => 0.5);
      await fail('vieja', 2);
      await prisma.$executeRaw`
        UPDATE "login_attempt_unknown" SET "updated_at" = now() - interval '25 hours'
        WHERE "username_key" = 'vieja'`;

      await noCleanup.registerFailedAttempt('otra');

      expect(await readRow('vieja')).not.toBeNull();
    });

    it('un fallo al limpiar no afecta al registro del intento', async () => {
      const failing = new PrismaUnknownLoginAttemptsRepository(
        {
          $queryRaw: prisma.$queryRaw.bind(prisma),
          $executeRaw: () => Promise.reject(new Error('boom')),
        } as unknown as PrismaService,
        () => 0,
      );

      const snapshot = await failing.registerFailedAttempt('otra');

      expect(snapshot.lock.failedAttempts).toBe(1);
    });
  });
});
