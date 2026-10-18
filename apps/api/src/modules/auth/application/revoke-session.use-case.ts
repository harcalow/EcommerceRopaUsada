import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '../../../shared/time/clock.port';

import { LOGIN_AUDIT, type LoginAudit } from './ports/login-audit';
import { SESSION_REPOSITORY, type SessionRepository } from './ports/session.repository';
import { TOKEN_GENERATOR, type TokenGenerator } from './ports/token-generator';

/**
 * Revoca la sesión de un token (cierre de sesión); idempotente y silencioso ante tokens inválidos
 * (CB-018). Audita `auth.logout` solo cuando revoca una sesión vigente, con el id de la cuenta y sin
 * el token (A09).
 */
@Injectable()
export class RevokeSession {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokens: TokenGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(LOGIN_AUDIT) private readonly audit: LoginAudit,
  ) {}

  async execute(token: string | undefined): Promise<void> {
    if (token === undefined || !this.tokens.isWellFormed(token)) {
      return;
    }
    const accountId = await this.sessions.revokeByTokenHash(this.tokens.hash(token), this.clock.now());
    if (accountId !== null) {
      this.audit.record({ name: 'auth.logout', accountId });
    }
  }
}
