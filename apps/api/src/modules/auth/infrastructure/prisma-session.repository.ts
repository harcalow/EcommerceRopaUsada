import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../shared/database/generated/client';
import { clientFor } from '../../../shared/database/prisma-transaction';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { TransactionContext } from '../../../shared/transaction/transaction.port';
import type {
  NewSession,
  SessionRepository,
  SessionWithAccount,
} from '../application/ports/session.repository';
import { Session } from '../domain/session';

interface SessionRow {
  readonly id: string;
  readonly accountId: string;
  readonly csrfTokenHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

function toSession(row: SessionRow): Session {
  return new Session({
    id: row.id,
    accountId: row.accountId,
    csrfTokenHash: row.csrfTokenHash,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  });
}

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    session: NewSession,
    replacingTokenHash?: string,
    tx?: TransactionContext,
  ): Promise<Session> {
    if (tx === undefined) {
      const row = await this.prisma.$transaction((client) =>
        this.insert(client, session, replacingTokenHash),
      );
      return toSession(row);
    }
    return toSession(await this.insert(clientFor(this.prisma, tx), session, replacingTokenHash));
  }

  private async insert(
    client: Prisma.TransactionClient,
    session: NewSession,
    replacingTokenHash: string | undefined,
  ): Promise<SessionRow> {
    if (replacingTokenHash !== undefined) {
      await client.session.updateMany({
        where: { tokenHash: replacingTokenHash, revokedAt: null },
        data: { revokedAt: session.createdAt },
      });
    }
    return client.session.create({ data: session });
  }

  async findByTokenHash(tokenHash: string): Promise<SessionWithAccount | null> {
    const row = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        account: { select: { status: true, role: { select: { code: true } } } },
      },
    });
    if (row === null) {
      return null;
    }
    return {
      session: toSession(row),
      accountActive: row.account.status === 'ACTIVE',
      roleCode: row.account.role.code,
    };
  }

  async revokeByTokenHash(tokenHash: string, at: Date): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ account_id: string }[]>`
      UPDATE "session" SET "revoked_at" = ${at}::timestamptz
      WHERE "token_hash" = ${tokenHash} AND "revoked_at" IS NULL
      RETURNING "account_id"`;
    return rows[0]?.account_id ?? null;
  }
}
