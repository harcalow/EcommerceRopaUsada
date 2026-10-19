import type { TransactionContext } from '../../../../shared/transaction/transaction.port';
import type { Account } from '../../domain/account';

import type { LoginLockSnapshot } from './login-lock-snapshot';

/** Token de inyección del puerto `AccountRepository`. */
export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

/** Cuenta con la hora de la BD a la que se leyó, para interpretar su bloqueo. */
export interface AccountWithObservedAt {
  readonly account: Account;
  readonly observedAt: Date;
}

export interface AccountRepository {
  /** Busca por `username_key` (ya normalizada) con su rol; `null` si no existe. */
  findByUsernameKey(usernameKey: string): Promise<AccountWithObservedAt | null>;
  /**
   * Registra un fallo de forma atómica con la hora de la BD (RF-008, RF-017). Con el bloqueo
   * vigente no cambia nada (CB-005); con el vencido empieza un contador nuevo (CB-013). Varias
   * llamadas concurrentes se serializan: el contador es exacto y el bloqueo se fija una sola vez.
   */
  registerFailedAttempt(accountId: string): Promise<LoginLockSnapshot>;
  /** Pone `failed_attempts = 0` y `locked_until = NULL` (RF-009); con `tx` participa en esa transacción. */
  resetLoginAttempts(accountId: string, tx?: TransactionContext): Promise<void>;
  /** Sustituye el hash guardado (rehash con los parámetros vigentes); con `tx` participa en esa transacción. */
  updatePasswordHash(accountId: string, passwordHash: string, tx?: TransactionContext): Promise<void>;
}
