import type { LoginLockSnapshot } from '../application/ports/login-lock-snapshot';
import { LoginLock } from '../domain/login-lock';

/** Fila devuelta por las sentencias de bloqueo: el estado y la hora de la BD (ya truncada a ms). */
export interface LoginLockRow {
  readonly failed_attempts: number;
  readonly locked_until: Date | null;
  readonly observed_at: Date;
}

export function toLoginLockSnapshot(row: LoginLockRow): LoginLockSnapshot {
  return {
    lock: new LoginLock({ failedAttempts: row.failed_attempts, lockedUntil: row.locked_until }),
    observedAt: row.observed_at,
  };
}
