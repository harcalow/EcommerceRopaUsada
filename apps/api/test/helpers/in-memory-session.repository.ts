import type {
  NewSession,
  SessionRepository,
  SessionWithAccount,
} from '../../src/modules/auth/application/ports/session.repository';
import { Session } from '../../src/modules/auth/domain/session';

export interface FakeAccount {
  active: boolean;
  roleCode: string;
}

type StoredSession = Session & { readonly tokenHash: string };

/** Repositorio de sesiones en memoria para pruebas unitarias de los casos de uso. */
export class InMemorySessionRepository implements SessionRepository {
  readonly rows = new Map<string, StoredSession>();
  private readonly accounts = new Map<string, FakeAccount>();
  private sequence = 0;

  addAccount(accountId: string, account: FakeAccount = { active: true, roleCode: 'admin' }): void {
    this.accounts.set(accountId, account);
  }

  create(session: NewSession, replacingTokenHash?: string): Promise<Session> {
    if (replacingTokenHash !== undefined) {
      this.revokeSync(replacingTokenHash, session.createdAt);
    }
    this.sequence += 1;
    const created = Object.assign(
      new Session({
        id: `session-${String(this.sequence)}`,
        accountId: session.accountId,
        csrfTokenHash: session.csrfTokenHash,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        revokedAt: null,
      }),
      { tokenHash: session.tokenHash },
    );
    this.rows.set(session.tokenHash, created);
    return Promise.resolve(created);
  }

  findByTokenHash(tokenHash: string): Promise<SessionWithAccount | null> {
    const session = this.rows.get(tokenHash);
    const account = session === undefined ? undefined : this.accounts.get(session.accountId);
    if (session === undefined || account === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      session,
      accountActive: account.active,
      roleCode: account.roleCode,
    });
  }

  revokeByTokenHash(tokenHash: string, at: Date): Promise<string | null> {
    return Promise.resolve(this.revokeSync(tokenHash, at));
  }

  private revokeSync(tokenHash: string, at: Date): string | null {
    const found = this.rows.get(tokenHash);
    if (found !== undefined && !found.isRevoked()) {
      this.rows.set(
        tokenHash,
        Object.assign(
          new Session({
            id: found.id,
            accountId: found.accountId,
            csrfTokenHash: found.csrfTokenHash,
            createdAt: found.createdAt,
            expiresAt: found.expiresAt,
            revokedAt: at,
          }),
          { tokenHash },
        ),
      );
      return found.accountId;
    }
    return null;
  }
}
