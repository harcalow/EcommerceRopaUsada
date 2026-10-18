import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prepareTestDatabase, resetDatabase } from '../../../../test/helpers/db';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { LoginLockSnapshot } from '../application/ports/login-lock-snapshot';
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_FAILED_ATTEMPTS, LoginLock } from '../domain/login-lock';

import { PrismaAccountRepository } from './prisma-account.repository';
import { PrismaUnknownLoginAttemptsRepository } from './prisma-unknown-login-attempts.repository';

const MS_PER_MINUTE = 60_000;
const EXPIRED_MINUTES = 31;
const START = '2026-10-18T10:00:00.000Z';

/** Lo que cada implementación de la regla del bloqueo debe poder hacer para pasar los mismos casos. */
interface LockHarness {
  readonly name: string;
  prepare(): Promise<void>;
  fail(): Promise<LoginLockSnapshot>;
  /** Deja vencido el bloqueo vigente. */
  expireLock(): Promise<void>;
  /** Un acierto; el usuario inexistente no tiene acierto y no lo define. */
  success?(): Promise<void>;
}

class DomainHarness implements LockHarness {
  readonly name = 'dominio (LoginLock)';
  private lock = LoginLock.none();
  private now = new Date(START);

  prepare(): Promise<void> {
    this.lock = LoginLock.none();
    this.now = new Date(START);
    return Promise.resolve();
  }

  fail(): Promise<LoginLockSnapshot> {
    this.lock = this.lock.recordFailure(this.now);
    return Promise.resolve({ lock: this.lock, observedAt: this.now });
  }

  expireLock(): Promise<void> {
    this.now = new Date(this.now.getTime() + EXPIRED_MINUTES * MS_PER_MINUTE);
    return Promise.resolve();
  }

  success(): Promise<void> {
    this.lock = this.lock.recordSuccess();
    return Promise.resolve();
  }
}

class AccountHarness implements LockHarness {
  readonly name = 'PrismaAccountRepository';
  private accountId = '';

  constructor(
    private readonly prisma: () => PrismaService,
    private readonly repository: () => PrismaAccountRepository,
  ) {}

  async prepare(): Promise<void> {
    const role = await this.prisma().role.findFirstOrThrow();
    const account = await this.prisma().account.create({
      data: { username: 'lucia', usernameKey: 'lucia', roleId: role.id, passwordHash: '$argon2id$x' },
    });
    this.accountId = account.id;
  }

  fail(): Promise<LoginLockSnapshot> {
    return this.repository().registerFailedAttempt(this.accountId);
  }

  async expireLock(): Promise<void> {
    await this.prisma().$executeRaw`
      UPDATE "account" SET "locked_until" = now() - make_interval(mins => ${EXPIRED_MINUTES}::int)
      WHERE "id" = ${this.accountId}::uuid`;
  }

  success(): Promise<void> {
    return this.repository().resetLoginAttempts(this.accountId);
  }
}

class UnknownHarness implements LockHarness {
  readonly name = 'PrismaUnknownLoginAttemptsRepository';

  constructor(
    private readonly prisma: () => PrismaService,
    private readonly repository: () => PrismaUnknownLoginAttemptsRepository,
  ) {}

  prepare(): Promise<void> {
    return Promise.resolve();
  }

  fail(): Promise<LoginLockSnapshot> {
    return this.repository().registerFailedAttempt('fantasma');
  }

  async expireLock(): Promise<void> {
    await this.prisma().$executeRaw`
      UPDATE "login_attempt_unknown"
      SET "locked_until" = now() - make_interval(mins => ${EXPIRED_MINUTES}::int)
      WHERE "username_key" = 'fantasma'`;
  }
}

function lockedUntilOf(snapshot: LoginLockSnapshot): number {
  const { lockedUntil } = snapshot.lock;
  if (lockedUntil === null) {
    throw new Error('expected a lock');
  }
  return lockedUntil.getTime();
}

async function failUntilLocked(harness: LockHarness): Promise<LoginLockSnapshot> {
  let last = await harness.fail();
  for (let attempt = 1; attempt < LOGIN_MAX_FAILED_ATTEMPTS; attempt += 1) {
    last = await harness.fail();
  }
  return last;
}

/**
 * Prueba de contrato de la regla del bloqueo (RF-008, RF-009, CB-005, CB-013): el dominio y los dos
 * SQL atómicos (cuenta real y usuario inexistente) deben dar exactamente los mismos resultados.
 */
describe('contrato de la regla del bloqueo de inicio de sesión', () => {
  let prisma: PrismaService;
  let accounts: PrismaAccountRepository;
  let unknown: PrismaUnknownLoginAttemptsRepository;

  beforeAll(async () => {
    const database = await prepareTestDatabase();
    prisma = new PrismaService({ databaseUrl: database.url });
    accounts = new PrismaAccountRepository(prisma);
    unknown = new PrismaUnknownLoginAttemptsRepository(prisma, () => 1);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  const harnesses: readonly LockHarness[] = [
    new DomainHarness(),
    new AccountHarness(
      () => prisma,
      () => accounts,
    ),
    new UnknownHarness(
      () => prisma,
      () => unknown,
    ),
  ];

  describe.each(harnesses.map((harness) => [harness.name, harness] as const))('%s', (_name, harness) => {
    beforeEach(async () => {
      await harness.prepare();
    });

    it('los fallos 1 a 4 cuentan sin bloquear y el 5.º bloquea 30 minutos desde la hora observada', async () => {
      for (let attempt = 1; attempt < LOGIN_MAX_FAILED_ATTEMPTS; attempt += 1) {
        const snapshot = await harness.fail();
        expect(snapshot.lock.failedAttempts).toBe(attempt);
        expect(snapshot.lock.lockedUntil).toBeNull();
        expect(snapshot.lock.isLocked(snapshot.observedAt)).toBe(false);
      }

      const fifth = await harness.fail();

      expect(fifth.lock.failedAttempts).toBe(LOGIN_MAX_FAILED_ATTEMPTS);
      expect(fifth.lock.isLocked(fifth.observedAt)).toBe(true);
      expect(lockedUntilOf(fifth) - fifth.observedAt.getTime()).toBe(LOGIN_LOCK_MINUTES * MS_PER_MINUTE);
      expect(fifth.lock.minutesRemaining(fifth.observedAt)).toBe(LOGIN_LOCK_MINUTES);
    });

    it('un fallo con el bloqueo vigente no cambia el contador ni alarga el bloqueo (CB-005)', async () => {
      const locked = await failUntilLocked(harness);

      const sixth = await harness.fail();

      expect(sixth.lock.failedAttempts).toBe(LOGIN_MAX_FAILED_ATTEMPTS);
      expect(lockedUntilOf(sixth)).toBe(lockedUntilOf(locked));
      expect(sixth.lock.isLocked(sixth.observedAt)).toBe(true);
    });

    it('con el bloqueo vencido el siguiente fallo empieza de nuevo en 1 y sin bloqueo (CB-013)', async () => {
      await failUntilLocked(harness);
      await harness.expireLock();

      const afterExpiry = await harness.fail();

      expect(afterExpiry.lock.failedAttempts).toBe(1);
      expect(afterExpiry.lock.lockedUntil).toBeNull();
      expect(afterExpiry.lock.isLocked(afterExpiry.observedAt)).toBe(false);
    });

    it('tras un vencimiento se vuelve a bloquear con otros 5 fallos', async () => {
      await failUntilLocked(harness);
      await harness.expireLock();

      const relocked = await failUntilLocked(harness);

      expect(relocked.lock.failedAttempts).toBe(LOGIN_MAX_FAILED_ATTEMPTS);
      expect(relocked.lock.isLocked(relocked.observedAt)).toBe(true);
    });

    it('un acierto reinicia el contador (RF-009)', async (context) => {
      if (harness.success === undefined) {
        context.skip();
        return;
      }
      await harness.fail();
      await harness.fail();
      await harness.fail();

      await harness.success();
      const next = await harness.fail();

      expect(next.lock.failedAttempts).toBe(1);
      expect(next.lock.lockedUntil).toBeNull();
    });
  });
});
