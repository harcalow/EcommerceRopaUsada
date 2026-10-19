import { Inject, Injectable } from '@nestjs/common';
import { toUsernameKey } from '@perchados/contracts';

import { ADMIN_ROLE_CODE } from '../../../shared/auth/admin-role';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/transaction/transaction.port';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
  type AccountWithObservedAt,
} from '../../users/application/ports/account.repository';
import type { LoginLockSnapshot } from '../../users/application/ports/login-lock-snapshot';
import {
  UNKNOWN_LOGIN_ATTEMPTS_REPOSITORY,
  type UnknownLoginAttemptsRepository,
} from '../../users/application/ports/unknown-login-attempts.repository';

import { OpenSession, type OpenedSession } from './open-session.use-case';
import { LOGIN_AUDIT, type LoginAudit, type LoginFailureReason } from './ports/login-audit';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher';

export interface LogInInput {
  /** Usuario tal como llegó validado del contrato; aquí se reduce a su `username_key`. */
  readonly username: string;
  /** Contraseña en claro: solo se pasa al hasher; nunca se registra. */
  readonly password: string;
  /** Token de la sesión que traía la petición; se revoca al abrir la nueva (CB-014 de ADR-007). */
  readonly previousToken?: string;
}

/**
 * Resultado del login. `invalid-credentials` es único para usuario inexistente, contraseña
 * incorrecta, cuenta desactivada o sin rol `admin`: el motivo solo va a la auditoría (CA-003, CA-019).
 */
export type LogInResult =
  | { readonly status: 'success'; readonly role: string; readonly session: OpenedSession }
  | { readonly status: 'invalid-credentials' }
  | { readonly status: 'locked'; readonly minutesRemaining: number };

/**
 * Inicio de sesión del administrador (RF-001, RF-004, RF-008, RF-009, RF-017, RF-023). Todas las
 * ramas fallidas gastan un hash completo (`verify` o `verifyDummy`) para que los tiempos no
 * delaten si el usuario existe, está bloqueado o es administrador.
 */
@Injectable()
export class LogIn {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(UNKNOWN_LOGIN_ATTEMPTS_REPOSITORY)
    private readonly unknownAttempts: UnknownLoginAttemptsRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    @Inject(LOGIN_AUDIT) private readonly audit: LoginAudit,
    private readonly openSession: OpenSession,
  ) {}

  async execute(input: LogInInput): Promise<LogInResult> {
    const usernameKey = toUsernameKey(input.username);
    const found = await this.accounts.findByUsernameKey(usernameKey);
    if (found === null) {
      return this.rejectUnknownUser(usernameKey, input.password);
    }
    const { account, observedAt } = found;
    if (account.lock.isLocked(observedAt)) {
      // El resultado se descarta: se verifica solo para igualar el tiempo con un intento normal (CB-005).
      await this.hasher.verify(account.passwordHash, input.password);
      this.audit.record({ name: 'auth.login.locked', accountId: account.id });
      return { status: 'locked', minutesRemaining: account.lock.minutesRemaining(observedAt) };
    }
    if (!(await this.hasher.verify(account.passwordHash, input.password))) {
      return this.rejectWrongPassword(found);
    }
    const denial = this.denialReason(found);
    if (denial !== null) {
      this.audit.record({ name: 'auth.login.failed', reason: denial, accountId: account.id });
      return { status: 'invalid-credentials' };
    }
    return this.complete(found, input);
  }

  private async rejectUnknownUser(usernameKey: string, password: string): Promise<LogInResult> {
    await this.hasher.verifyDummy(password);
    const snapshot = await this.unknownAttempts.registerFailedAttempt(usernameKey);
    this.audit.record({ name: 'auth.login.failed', reason: 'unknown-user' });
    return this.afterFailure(snapshot);
  }

  private async rejectWrongPassword({ account }: AccountWithObservedAt): Promise<LogInResult> {
    const snapshot = await this.accounts.registerFailedAttempt(account.id);
    this.audit.record({
      name: 'auth.login.failed',
      reason: 'invalid-password',
      accountId: account.id,
    });
    return this.afterFailure(snapshot, account.id);
  }

  /** Tras un fallo, el 5.º (o uno con bloqueo vigente) responde 423; el resto, el 401 genérico. */
  private afterFailure(snapshot: LoginLockSnapshot, accountId?: string): LogInResult {
    if (!snapshot.lock.isLocked(snapshot.observedAt)) {
      return { status: 'invalid-credentials' };
    }
    this.audit.record({
      name: 'auth.login.locked',
      ...(accountId === undefined ? {} : { accountId }),
    });
    return {
      status: 'locked',
      minutesRemaining: snapshot.lock.minutesRemaining(snapshot.observedAt),
    };
  }

  /** Contraseña correcta pero cuenta que no puede entrar: no toca el contador (CA-019, CB-012). */
  private denialReason({ account }: AccountWithObservedAt): LoginFailureReason | null {
    if (!account.isActive()) {
      return 'disabled';
    }
    return account.hasRole(ADMIN_ROLE_CODE) ? null : 'not-admin';
  }

  /**
   * Reinicio del contador (RF-009), rehash opcional y apertura de la sesión en una sola
   * transacción: si la sesión no se puede crear, el contador conserva sus fallos. El hash nuevo se
   * calcula antes: dentro solo van escrituras cortas, nunca `verify`, `verifyDummy` ni `hash`
   * (RT-021; un argon2 bajo carga agotaba el timeout de la transacción).
   *
   * Carrera aceptada: entre `verify` y la transacción la cuenta puede bloquearse o desactivarse.
   * No se revalida porque la contraseña ya fue demostrada en este mismo intento, un fallo
   * concurrente solo pudo ser de otro intento, y una cuenta desactivada o sin rol no conserva
   * acceso: cada petición revalida estado y rol de la cuenta al leer la sesión.
   */
  private async complete(
    { account }: AccountWithObservedAt,
    input: LogInInput,
  ): Promise<LogInResult> {
    const rehashed = this.hasher.needsRehash(account.passwordHash)
      ? await this.hasher.hash(input.password)
      : undefined;
    const session = await this.transactions.run(async (tx) => {
      await this.accounts.resetLoginAttempts(account.id, tx);
      if (rehashed !== undefined) {
        await this.accounts.updatePasswordHash(account.id, rehashed, tx);
      }
      return this.openSession.execute({
        accountId: account.id,
        transaction: tx,
        ...(input.previousToken === undefined ? {} : { previousToken: input.previousToken }),
      });
    });
    this.audit.record({ name: 'auth.login.succeeded', accountId: account.id });
    return { status: 'success', role: account.roleCode, session };
  }
}
