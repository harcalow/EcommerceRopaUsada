import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_ROLE_CODE } from '../../../../../test/helpers/db';
import { createTestApp, type TestApp } from '../../../../../test/helpers/test-app.factory';
import { Public } from '../../../../shared/http/public.decorator';
import { OpenSession, type OpenedSession } from '../../application/open-session.use-case';
import { Roles } from '../decorators/roles';

@Controller('roles-probe')
class RolesProbeController {
  @Roles(ADMIN_ROLE_CODE)
  @Get('admin')
  admin(): { ok: true } {
    return { ok: true };
  }

  @Get('any')
  any(): { ok: true } {
    return { ok: true };
  }

  @Public()
  @Roles(ADMIN_ROLE_CODE)
  @Get('public')
  open(): { ok: true } {
    return { ok: true };
  }
}

const OTHER_ROLE = 'buyer-test';

describe('RolesGuard con rol leído de la BD (RF-023, RT-013)', () => {
  let ctx: TestApp;
  let open: OpenSession;

  beforeAll(async () => {
    ctx = await createTestApp({ controllers: [RolesProbeController] });
    open = ctx.app.get(OpenSession);
  });

  beforeEach(async () => {
    await ctx.reset();
    ctx.clear();
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function openWithRole(code: string): Promise<{ opened: OpenedSession; accountId: string }> {
    const role = await ctx.prisma.role.upsert({ where: { code }, update: {},
      create: { code, name: code },
    });
    const account = await ctx.prisma.account.create({
      data: {
        username: 'lucia',
        usernameKey: 'lucia',
        roleId: role.id,
        passwordHash: '$argon2id$x',
        status: 'ACTIVE',
      },
    });
    return { opened: await open.execute({ accountId: account.id }), accountId: account.id };
  }

  const cookie = (opened: OpenedSession): string => `perchados_sid=${opened.token}`;

  it('sin sesión responde 401 auth/unauthenticated (lo resuelve SessionGuard)', async () => {
    const response = await request(ctx.server).get('/v1/roles-probe/admin');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ type: 'auth/unauthenticated' });
  });

  it('rol admin responde 200', async () => {
    const { opened } = await openWithRole(ADMIN_ROLE_CODE);

    const response = await request(ctx.server)
      .get('/v1/roles-probe/admin')
      .set('Cookie', cookie(opened));

    expect(response.status).toBe(200);
  });

  it('otro rol responde 403 problem+json auth/forbidden sin filtrar el rol', async () => {
    const { opened } = await openWithRole(OTHER_ROLE);

    const response = await request(ctx.server)
      .get('/v1/roles-probe/admin')
      .set('Cookie', cookie(opened));

    expect(response.status).toBe(403);
    expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(response.body).toMatchObject({ type: 'auth/forbidden', status: 403 });
    expect(JSON.stringify(response.body)).not.toContain(OTHER_ROLE);
  });

  it('cambiar el rol en la BD cambia la respuesta sin abrir sesión nueva', async () => {
    const { opened, accountId } = await openWithRole(OTHER_ROLE);
    const admin = await ctx.prisma.role.findUniqueOrThrow({ where: { code: ADMIN_ROLE_CODE } });
    const other = await ctx.prisma.role.findUniqueOrThrow({ where: { code: OTHER_ROLE } });
    const probe = async (): Promise<number> =>
      (await request(ctx.server).get('/v1/roles-probe/admin').set('Cookie', cookie(opened))).status;

    const before = await probe();
    await ctx.prisma.account.update({ where: { id: accountId }, data: { roleId: admin.id } });
    const promoted = await probe();
    await ctx.prisma.account.update({ where: { id: accountId }, data: { roleId: other.id } });
    const demoted = await probe();

    expect([before, promoted, demoted]).toEqual([403, 200, 403]);
  });

  it('una ruta sin @Roles admite cualquier sesión válida', async () => {
    const { opened } = await openWithRole(OTHER_ROLE);

    const response = await request(ctx.server)
      .get('/v1/roles-probe/any')
      .set('Cookie', cookie(opened));

    expect(response.status).toBe(200);
  });

  it('@Public ignora ambos guards', async () => {
    const response = await request(ctx.server).get('/v1/roles-probe/public');

    expect(response.status).toBe(200);
  });
});
