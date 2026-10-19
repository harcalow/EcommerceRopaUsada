import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '../../../shared/time/clock.port';

import { SESSION_REPOSITORY, type SessionRepository } from './ports/session.repository';
import { TOKEN_GENERATOR, type TokenGenerator } from './ports/token-generator';

export interface ValidSession {
  readonly sessionId: string;
  readonly accountId: string;
  /** Rol leído de la BD en esta validación (RF-023), no copiado en la sesión. */
  readonly role: string;
  readonly expiresAt: Date;
  readonly csrfTokenHash: string;
}

/**
 * Resultado de validar: `unauthenticated` (inexistente, revocada o cuenta desactivada: CB-012) y
 * `expired` (CA-018) se distinguen para responder `auth/unauthenticated` o `auth/session-expired`.
 */
export type SessionValidation =
  | { readonly status: 'valid'; readonly session: ValidSession }
  | { readonly status: 'expired' }
  | { readonly status: 'unauthenticated' };

/** Valida un token de sesión contra la BD en cada petición (RT-011, RT-013). */
@Injectable()
export class ValidateSession {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokens: TokenGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(token: string | undefined): Promise<SessionValidation> {
    if (token === undefined || !this.tokens.isWellFormed(token)) {
      return { status: 'unauthenticated' };
    }
    const found = await this.sessions.findByTokenHash(this.tokens.hash(token));
    if (found === null || found.session.isRevoked() || !found.accountActive) {
      return { status: 'unauthenticated' };
    }
    const { session, roleCode } = found;
    if (session.isExpired(this.clock.now())) {
      return { status: 'expired' };
    }
    return {
      status: 'valid',
      session: {
        sessionId: session.id,
        accountId: session.accountId,
        role: roleCode,
        expiresAt: session.expiresAt,
        csrfTokenHash: session.csrfTokenHash,
      },
    };
  }
}
