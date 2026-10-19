import { Injectable, Logger } from '@nestjs/common';

import { CLEANUP_PROBABILITY } from '../../../shared/database/cleanup-probability';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { LoginLockSnapshot } from '../application/ports/login-lock-snapshot';
import type { UnknownLoginAttemptsRepository } from '../application/ports/unknown-login-attempts.repository';
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_FAILED_ATTEMPTS } from '../domain/login-lock';

import { toLoginLockSnapshot, type LoginLockRow } from './login-lock-row';

/** Fuente de azar de la limpieza oportunista; se sustituye en las pruebas. */
export type RandomSource = () => number;

/**
 * Contador y bloqueo para usuarios inexistentes (CB-004), con exactamente las mismas reglas que
 * `PrismaAccountRepository.registerFailedAttempt`. La tabla no es una cuenta: no se puede entrar con ella.
 */
@Injectable()
export class PrismaUnknownLoginAttemptsRepository implements UnknownLoginAttemptsRepository {
  private readonly logger = new Logger(PrismaUnknownLoginAttemptsRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly random: RandomSource = Math.random,
  ) {}

  async registerFailedAttempt(usernameKey: string): Promise<LoginLockSnapshot> {
    const rows = await this.prisma.$queryRaw<LoginLockRow[]>`
      INSERT INTO "login_attempt_unknown" AS u ("username_key", "failed_attempts", "locked_until", "updated_at")
      SELECT ${usernameKey}, 1,
        CASE WHEN 1 >= ${LOGIN_MAX_FAILED_ATTEMPTS}::int
          THEN s."n" + make_interval(mins => ${LOGIN_LOCK_MINUTES}::int) END,
        s."n"
      FROM (SELECT date_trunc('milliseconds', now()) AS "n") s
      ON CONFLICT ("username_key") DO UPDATE SET
        "failed_attempts" = CASE
          WHEN u."locked_until" > EXCLUDED."updated_at" THEN u."failed_attempts"
          WHEN u."locked_until" IS NOT NULL THEN 1
          ELSE u."failed_attempts" + 1
        END,
        "locked_until" = CASE
          WHEN u."locked_until" > EXCLUDED."updated_at" THEN u."locked_until"
          WHEN u."locked_until" IS NULL AND u."failed_attempts" + 1 >= ${LOGIN_MAX_FAILED_ATTEMPTS}::int
            THEN EXCLUDED."updated_at" + make_interval(mins => ${LOGIN_LOCK_MINUTES}::int)
          ELSE NULL
        END,
        "updated_at" = EXCLUDED."updated_at"
      RETURNING u."failed_attempts" AS "failed_attempts", u."locked_until" AS "locked_until",
        u."updated_at" AS "observed_at"`;
    const row = rows[0];
    if (row === undefined) {
      throw new Error('login_attempt_unknown upsert returned no row');
    }
    await this.cleanupSometimes();
    return toLoginLockSnapshot(row);
  }

  /** Borra filas sin bloqueo vigente y sin actividad en 24 h en una fracción de las escrituras. */
  private async cleanupSometimes(): Promise<void> {
    if (this.random() >= CLEANUP_PROBABILITY) {
      return;
    }
    try {
      await this.prisma.$executeRaw`
        DELETE FROM "login_attempt_unknown"
        WHERE ("locked_until" IS NULL OR "locked_until" <= now())
          AND "updated_at" < now() - interval '24 hours'`;
    } catch (error) {
      this.logger.warn({
        message: 'login attempts cleanup failed',
        errorName: error instanceof Error ? error.name : typeof error,
      });
    }
  }
}
