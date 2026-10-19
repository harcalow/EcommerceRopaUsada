import { Injectable } from '@nestjs/common';

import { clientFor } from '../../../shared/database/prisma-transaction';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { TransactionContext } from '../../../shared/transaction/transaction.port';
import type {
  AccountRepository,
  AccountWithObservedAt,
} from '../application/ports/account.repository';
import type { LoginLockSnapshot } from '../application/ports/login-lock-snapshot';
import { Account } from '../domain/account';
import { isAccountStatus } from '../domain/account-status';
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_FAILED_ATTEMPTS, LoginLock } from '../domain/login-lock';

import { toLoginLockSnapshot, type LoginLockRow } from './login-lock-row';

interface AccountRow extends LoginLockRow {
  readonly id: string;
  readonly username: string;
  readonly username_key: string;
  readonly status: string;
  readonly password_hash: string;
  readonly role_code: string;
}

/**
 * Cuentas en PostgreSQL. Todas las consultas están parametrizadas y el bloqueo usa la hora de la
 * BD (`now()` truncada a milisegundos, la precisión de la columna) dentro de una única sentencia.
 */
@Injectable()
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUsernameKey(usernameKey: string): Promise<AccountWithObservedAt | null> {
    const rows = await this.prisma.$queryRaw<AccountRow[]>`
      SELECT a."id", a."username", a."username_key", a."status"::text AS "status",
        a."password_hash", a."failed_attempts", a."locked_until", r."code" AS "role_code",
        date_trunc('milliseconds', now()) AS "observed_at"
      FROM "account" a
      JOIN "role" r ON r."id" = a."role_id"
      WHERE a."username_key" = ${usernameKey}`;
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    if (!isAccountStatus(row.status)) {
      throw new Error('account has an unknown status');
    }
    return {
      account: new Account({
        id: row.id,
        username: row.username,
        usernameKey: row.username_key,
        roleCode: row.role_code,
        status: row.status,
        passwordHash: row.password_hash,
        lock: new LoginLock({
          failedAttempts: row.failed_attempts,
          lockedUntil: row.locked_until,
        }),
      }),
      observedAt: row.observed_at,
    };
  }

  /**
   * Una sola sentencia atómica: el bloqueo vigente se conserva (no se alarga, CB-005), el vencido
   * reinicia el contador en 1 (CB-013) y el quinto fallo fija `locked_until = now + 30 min`.
   * `UPDATE` bloquea la fila, así que los fallos concurrentes se serializan (CB-006).
   */
  async registerFailedAttempt(accountId: string): Promise<LoginLockSnapshot> {
    const rows = await this.prisma.$queryRaw<LoginLockRow[]>`
      WITH t AS (SELECT date_trunc('milliseconds', now()) AS "n")
      UPDATE "account" a SET
        "failed_attempts" = CASE
          WHEN a."locked_until" > t."n" THEN a."failed_attempts"
          WHEN a."locked_until" IS NOT NULL THEN 1
          ELSE a."failed_attempts" + 1
        END,
        "locked_until" = CASE
          WHEN a."locked_until" > t."n" THEN a."locked_until"
          WHEN a."locked_until" IS NULL AND a."failed_attempts" + 1 >= ${LOGIN_MAX_FAILED_ATTEMPTS}::int
            THEN t."n" + make_interval(mins => ${LOGIN_LOCK_MINUTES}::int)
          ELSE NULL
        END,
        "updated_at" = t."n"
      FROM t
      WHERE a."id" = ${accountId}::uuid
      RETURNING a."failed_attempts" AS "failed_attempts", a."locked_until" AS "locked_until",
        t."n" AS "observed_at"`;
    const row = rows[0];
    if (row === undefined) {
      throw new Error('account not found while registering a failed login attempt');
    }
    return toLoginLockSnapshot(row);
  }

  async resetLoginAttempts(accountId: string, tx?: TransactionContext): Promise<void> {
    await clientFor(this.prisma, tx).account.updateMany({
      where: { id: accountId },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  }

  async updatePasswordHash(
    accountId: string,
    passwordHash: string,
    tx?: TransactionContext,
  ): Promise<void> {
    await clientFor(this.prisma, tx).account.updateMany({
      where: { id: accountId },
      data: { passwordHash },
    });
  }
}
