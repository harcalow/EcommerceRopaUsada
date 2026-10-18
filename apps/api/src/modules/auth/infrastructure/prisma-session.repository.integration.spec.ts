import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_ROLE_CODE, prepareTestDatabase, resetDatabase } from '../../../../test/helpers/db';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { NewSession } from '../application/ports/session.repository';

import { CryptoTokenGenerator } from './crypto-token-generator';
import { PrismaSessionRepository } from './prisma-session.repository';

const tokens = new CryptoTokenGenerator();
const CREATED = new Date('2026-10-16T08:00:00.000Z');
const EXPIRES = new Date('2026-10-16T16:00:00.000Z');
const REVOKED_AT = new Date('2026-10-16T09:00:00.000Z');
const MISSING_ACCOUNT_ID = '0196a0b0-0000-7000-8000-000000000000';

describe('PrismaSessionRepository contra PostgreSQL real (RT-011, CB-012)', () => {
  let prisma: PrismaService;
  let repository: PrismaSessionRepository;

  beforeAll(async () => {
    const database = await prepareTestDatabase();
    prisma = new PrismaService({ databaseUrl: database.url });
    repository = new PrismaSessionRepository(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  async function createAccountId(usernameKey = 'haroldadmin'): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: ADMIN_ROLE_CODE },
    });
    const account = await prisma.account.create({
      data: {
        username: usernameKey,
        usernameKey,
        roleId: role.id,
        passwordHash: '$argon2id$x',
      },
    });
    return account.id;
  }

  function newSession(accountId: string): { token: string; data: NewSession } {
    const token = tokens.generate();
    return {
      token,
      data: {
        tokenHash: tokens.hash(token),
        csrfTokenHash: tokens.hash(tokens.generate()),
        accountId,
        createdAt: CREATED,
        expiresAt: EXPIRES,
      },
    };
  }

  it('crea la sesión, guarda solo el hash del token y la recupera con rol y estado de la cuenta', async () => {
    const accountId = await createAccountId();
    const { token, data } = newSession(accountId);

    const created = await repository.create(data);
    const found = await repository.findByTokenHash(tokens.hash(token));

    expect(found).toMatchObject({
      accountActive: true,
      roleCode: ADMIN_ROLE_CODE,
    });
    expect(found?.session).toMatchObject({
      id: created.id,
      accountId,
      createdAt: CREATED,
      expiresAt: EXPIRES,
      revokedAt: null,
    });
    const rows = await prisma.$queryRaw<{ token_hash: string }[]>`SELECT token_hash FROM session`;
    expect(rows).toEqual([{ token_hash: tokens.hash(token) }]);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('un hash inexistente devuelve null', async () => {
    expect(await repository.findByTokenHash(tokens.hash(tokens.generate()))).toBeNull();
  });

  it('el hash del token es único', async () => {
    const { data } = newSession(await createAccountId());
    await repository.create(data);

    await expect(repository.create(data)).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('la FK con account se respeta y borrar la cuenta borra sus sesiones', async () => {
    await expect(repository.create(newSession(MISSING_ACCOUNT_ID).data)).rejects.toMatchObject({
      code: 'P2003',
    });
    const accountId = await createAccountId();
    await repository.create(newSession(accountId).data);

    await prisma.account.delete({ where: { id: accountId } });

    expect(await prisma.session.count()).toBe(0);
  });

  it('CB-012: refleja el estado y el rol actuales de la cuenta', async () => {
    const accountId = await createAccountId();
    const { token, data } = newSession(accountId);
    await repository.create(data);
    const tester = await prisma.role.create({
      data: { code: 'tester', name: 'tester' },
    });

    await prisma.account.update({
      where: { id: accountId },
      data: { status: 'DISABLED', roleId: tester.id },
    });

    expect(await repository.findByTokenHash(tokens.hash(token))).toMatchObject({
      accountActive: false,
      roleCode: 'tester',
    });
  });

  it('revokeByTokenHash marca revokedAt una sola vez y es idempotente', async () => {
    const { token, data } = newSession(await createAccountId());
    await repository.create(data);

    const first = await repository.revokeByTokenHash(tokens.hash(token), REVOKED_AT);
    const again = await repository.revokeByTokenHash(tokens.hash(token), new Date('2026-10-16T10:00:00.000Z'));
    const unknown = await repository.revokeByTokenHash(tokens.hash(tokens.generate()), REVOKED_AT);

    expect(first).toBe(data.accountId);
    expect(again).toBeNull();
    expect(unknown).toBeNull();
    const found = await repository.findByTokenHash(tokens.hash(token));
    expect(found?.session.revokedAt).toEqual(REVOKED_AT);
  });

  it('create con replacingTokenHash revoca la anterior y deja la nueva y otras cuentas intactas', async () => {
    const accountId = await createAccountId();
    const previous = newSession(accountId);
    const other = newSession(await createAccountId('otra'));
    await repository.create(previous.data);
    await repository.create(other.data);
    const next = newSession(accountId);

    await repository.create(next.data, previous.data.tokenHash);

    const revokedAt = async (hash: string) =>
      (await repository.findByTokenHash(hash))?.session.revokedAt;
    expect(await revokedAt(previous.data.tokenHash)).toEqual(CREATED);
    expect(await revokedAt(next.data.tokenHash)).toBeNull();
    expect(await revokedAt(other.data.tokenHash)).toBeNull();
  });

  it('si la creación falla, la revocación de la anterior se deshace (transacción)', async () => {
    const previous = newSession(await createAccountId());
    await repository.create(previous.data);
    const failing = newSession(MISSING_ACCOUNT_ID);

    await expect(repository.create(failing.data, previous.data.tokenHash)).rejects.toBeDefined();

    const found = await repository.findByTokenHash(previous.data.tokenHash);
    expect(found?.session.revokedAt).toBeNull();
  });
});
