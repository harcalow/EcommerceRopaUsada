import type { TransactionContext } from '../../../../shared/transaction/transaction.port';
import type { Session } from '../../domain/session';

/** Token de inyección del puerto `SessionRepository`. */
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

/** Datos para crear una sesión; el repositorio asigna el identificador. */
export interface NewSession {
  readonly tokenHash: string;
  readonly csrfTokenHash: string;
  readonly accountId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

/** Sesión junto con el estado y el rol de su cuenta, leídos de la BD en la misma consulta (CB-012, RF-023). */
export interface SessionWithAccount {
  readonly session: Session;
  readonly accountActive: boolean;
  readonly roleCode: string;
}

export interface SessionRepository {
  /**
   * Crea la sesión nueva y, en la misma transacción, revoca la sesión indicada por su hash
   * (rotación del identificador en cada login, ADR-007). Revocar una inexistente no falla.
   * Con `tx` se une a esa transacción en lugar de abrir la suya.
   */
  create(
    session: NewSession,
    replacingTokenHash?: string,
    tx?: TransactionContext,
  ): Promise<Session>;
  /** Busca por el hash del token, con el estado de la cuenta y el rol vigentes. */
  findByTokenHash(tokenHash: string): Promise<SessionWithAccount | null>;
  /**
   * Marca como revocada la sesión si seguía vigente; idempotente. Devuelve el id de la cuenta de la
   * sesión que acaba de revocar, o `null` si no existía o ya estaba revocada.
   */
  revokeByTokenHash(tokenHash: string, at: Date): Promise<string | null>;
}
