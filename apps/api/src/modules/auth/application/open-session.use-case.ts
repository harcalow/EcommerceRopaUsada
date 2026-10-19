import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '../../../shared/time/clock.port';
import type { TransactionContext } from '../../../shared/transaction/transaction.port';
import { Session } from '../domain/session';

import { SESSION_REPOSITORY, type SessionRepository } from './ports/session.repository';
import { TOKEN_GENERATOR, type TokenGenerator } from './ports/token-generator';

/** Token de inyección del TTL de sesión en horas (`SESSION_TTL_HOURS`). */
export const SESSION_TTL_HOURS = Symbol('SESSION_TTL_HOURS');

export interface OpenSessionInput {
  readonly accountId: string;
  /** Token de la sesión que traía la petición; se revoca al abrir la nueva (fijación de sesión). */
  readonly previousToken?: string;
  /** Transacción en la que debe crearse la sesión (el login la comparte con el reinicio del contador). */
  readonly transaction?: TransactionContext;
}

export interface OpenedSession {
  /** Token opaco en claro: solo para la cookie; nunca se registra ni se vuelve a leer. */
  readonly token: string;
  /** Token CSRF en claro: solo para su cookie. */
  readonly csrfToken: string;
  readonly expiresAt: Date;
}

/** Abre una sesión nueva con token y token CSRF aleatorios de 256 bits (RF-020, RT-011). */
@Injectable()
export class OpenSession {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokens: TokenGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SESSION_TTL_HOURS) private readonly ttlHours: number,
  ) {}

  async execute(input: OpenSessionInput): Promise<OpenedSession> {
    const token = this.tokens.generate();
    const csrfToken = this.tokens.generate();
    const createdAt = this.clock.now();
    const expiresAt = Session.expiryFor(createdAt, this.ttlHours);
    const previous = input.previousToken;
    const replacing =
      previous !== undefined && this.tokens.isWellFormed(previous)
        ? this.tokens.hash(previous)
        : undefined;
    await this.sessions.create(
      {
        tokenHash: this.tokens.hash(token),
        csrfTokenHash: this.tokens.hash(csrfToken),
        accountId: input.accountId,
        createdAt,
        expiresAt,
      },
      replacing,
      input.transaction,
    );
    return { token, csrfToken, expiresAt };
  }
}
