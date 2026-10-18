import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ContractMatcher } from '../../../../test/contract/contract-matcher';
import { ADMIN_ROLE_CODE } from '../../../../test/helpers/db';
import { createTestApp, type TestApp } from '../../../../test/helpers/test-app.factory';
import { OpenSession, type OpenedSession } from '../application/open-session.use-case';

import { CSRF_HEADER } from './csrf-token.verifier';

@Controller('probe')
class PrivateProbeController {
  @Get()
  read(): { ok: true } {
    return { ok: true };
  }
}

const matcher = new ContractMatcher();
const SID = 'perchados_sid';
const CSRF = 'perchados_csrf';

function cookieHeader(opened: Pick<OpenedSession, 'token'>): string {
  return `${SID}=${opened.token}`;
}

function setCookies(response: request.Response): string[] {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  return header === undefined ? [] : Array.isArray(header) ? header : [header];
}

describe('SessionGuard y endpoints de sesión (RF-011, RF-012, RT-011, RT-013)', () => {
  let ctx: TestApp;
  let open: OpenSession;

  beforeAll(async () => {
    ctx = await createTestApp({ controllers: [PrivateProbeController] });
    open = ctx.app.get(OpenSession);
  });

  beforeEach(async () => {
    await ctx.reset();
    ctx.clear();
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function createAccount(
    username: string,
    status: 'ACTIVE' | 'DISABLED' = 'ACTIVE',
  ): Promise<string> {
    const role = await ctx.prisma.role.findUniqueOrThrow({ where: { code: ADMIN_ROLE_CODE } });
    const account = await ctx.prisma.account.create({
      data: { username, usernameKey: username, roleId: role.id, passwordHash: '$argon2id$x', status },
    });
    return account.id;
  }

  async function openFor(username: string): Promise<OpenedSession & { accountId: string }> {
    const accountId = await createAccount(username);
    return { ...(await open.execute({ accountId })), accountId };
  }

  it('toda ruta es privada por defecto: sin @Public responde 401 auth/unauthenticated', async () => {
    const response = await request(ctx.server).get('/v1/probe');

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(response.body).toMatchObject({ type: 'auth/unauthenticated', status: 401 });
  });

  it('una ruta privada con sesión válida responde 200', async () => {
    const opened = await openFor('lucia');

    const response = await request(ctx.server).get('/v1/probe').set('Cookie', cookieHeader(opened));

    expect(response.status).toBe(200);
  });

  it('GET /v1/health sigue siendo público', async () => {
    const response = await request(ctx.server).get('/v1/health');

    expect(response.status).toBe(200);
  });

  describe('GET /v1/auth/session', () => {
    it('con cookie válida devuelve el rol y la caducidad (CA-011) y cumple el contrato', async () => {
      const opened = await openFor('lucia');

      const response = await request(ctx.server)
        .get('/v1/auth/session')
        .set('Cookie', cookieHeader(opened));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ role: 'admin', expiresAt: opened.expiresAt.toISOString() });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(
        matcher.check({
          method: 'get',
          path: '/v1/auth/session',
          response: { status: 200, headers: response.headers, body: response.body },
        }),
      ).toEqual([]);
    });

    it('sin cookie responde 401 auth/unauthenticated y cumple el contrato', async () => {
      const response = await request(ctx.server).get('/v1/auth/session');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ type: 'auth/unauthenticated' });
      expect(
        matcher.check({
          method: 'get',
          path: '/v1/auth/session',
          response: { status: 401, headers: response.headers, body: response.body },
        }),
      ).toEqual([]);
    });

    it.each([
      ['inventada con la forma de un token', `${SID}=${'a'.repeat(43)}`],
      ['basura', `${SID}=%%%not-a-token%%%`],
      ['vacía', `${SID}=`],
      ['con otro nombre', `otra=${'a'.repeat(43)}`],
    ])('una cookie %s responde 401 y nunca 500', async (_name, cookie) => {
      const response = await request(ctx.server).get('/v1/auth/session').set('Cookie', cookie);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ type: 'auth/unauthenticated' });
    });

    it('una sesión caducada responde 401 auth/session-expired (CA-018)', async () => {
      const opened = await openFor('lucia');
      const past = new Date(Date.now() - 60_000);
      await ctx.prisma.session.updateMany({
        data: { createdAt: new Date(past.getTime() - 3_600_000), expiresAt: past },
      });

      const response = await request(ctx.server)
        .get('/v1/auth/session')
        .set('Cookie', cookieHeader(opened));

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ type: 'auth/session-expired' });
    });

    it('una cuenta desactivada responde 401 aunque la sesión siga vigente (CB-012)', async () => {
      const opened = await openFor('lucia');
      await ctx.prisma.account.update({ where: { id: opened.accountId }, data: { status: 'DISABLED' } });

      const response = await request(ctx.server)
        .get('/v1/auth/session')
        .set('Cookie', cookieHeader(opened));

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ type: 'auth/unauthenticated' });
    });

    it('el rol se lee de la BD en cada petición (RF-023)', async () => {
      const opened = await openFor('lucia');
      const role = await ctx.prisma.role.create({ data: { code: 'auditor', name: 'Auditor' } });
      await ctx.prisma.account.update({ where: { id: opened.accountId }, data: { roleId: role.id } });

      const response = await request(ctx.server)
        .get('/v1/auth/session')
        .set('Cookie', cookieHeader(opened));

      expect(response.body).toMatchObject({ role: 'auditor' });
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('con CSRF válido responde 204, borra las cookies y revoca la sesión (CA-011 API)', async () => {
      const opened = await openFor('lucia');

      const response = await request(ctx.server)
        .post('/v1/auth/logout')
        .set('Cookie', cookieHeader(opened))
        .set(CSRF_HEADER, opened.csrfToken);

      expect(response.status).toBe(204);
      expect(response.headers['cache-control']).toBe('no-store');
      const cookies = setCookies(response);
      expect(cookies).toHaveLength(2);
      expect(cookies.find((c) => c.startsWith(`${SID}=;`))).toMatch(/Max-Age=0.*HttpOnly/);
      expect(cookies.find((c) => c.startsWith(`${CSRF}=;`))).toMatch(/Max-Age=0/);
      expect(
        matcher.check({
          method: 'post',
          path: '/v1/auth/logout',
          response: {
            status: 204,
            headers: { ...response.headers, 'set-cookie': cookies.join(', ') },
            body: response.body,
          },
        }),
      ).toEqual([]);

      const replay = await request(ctx.server)
        .get('/v1/auth/session')
        .set('Cookie', cookieHeader(opened));
      expect(replay.status).toBe(401);
    });

    it('audita auth.logout (info) con accountId y correlationId, una sola vez y sin el token (A09)', async () => {
      const opened = await openFor('lucia');
      ctx.clear();
      const send = (): request.Test =>
        request(ctx.server)
          .post('/v1/auth/logout')
          .set('Cookie', cookieHeader(opened))
          .set(CSRF_HEADER, opened.csrfToken);

      await send().expect(204);
      await send().expect(204);
      await request(ctx.server).post('/v1/auth/logout').expect(204);

      const events = ctx.records().filter((record) => record.event === 'auth.logout');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ level: 'info', accountId: opened.accountId });
      expect(typeof events[0]?.correlationId).toBe('string');
      const logs = ctx.lines.join('\n');
      expect(logs).not.toContain(opened.token);
      expect(logs).not.toContain(opened.csrfToken);
    });

    it.each([
      ['ausente', undefined],
      ['erróneo', 'b'.repeat(43)],
      ['con forma inválida', 'no-es-un-token'],
    ])('con CSRF %s responde 403 auth/csrf-invalid y la sesión sigue vigente', async (_n, token) => {
      const opened = await openFor('lucia');
      const call = request(ctx.server).post('/v1/auth/logout').set('Cookie', cookieHeader(opened));

      const response = await (token === undefined ? call : call.set(CSRF_HEADER, token));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ type: 'auth/csrf-invalid' });
      expect(setCookies(response)).toEqual([]);
      expect(
        matcher.check({
          method: 'post',
          path: '/v1/auth/logout',
          response: { status: 403, headers: response.headers, body: response.body },
        }),
      ).toEqual([]);
      const still = await request(ctx.server)
        .get('/v1/auth/session')
        .set('Cookie', cookieHeader(opened));
      expect(still.status).toBe(200);
    });

    it('el token CSRF de otra sesión no sirve', async () => {
      const first = await openFor('lucia');
      const second = await openFor('maria');

      const response = await request(ctx.server)
        .post('/v1/auth/logout')
        .set('Cookie', cookieHeader(first))
        .set(CSRF_HEADER, second.csrfToken);

      expect(response.status).toBe(403);
    });

    it('cerrar una sesión no afecta a otra de la misma cuenta (CB-017)', async () => {
      const first = await openFor('lucia');
      const second = await open.execute({ accountId: first.accountId });

      await request(ctx.server)
        .post('/v1/auth/logout')
        .set('Cookie', cookieHeader(first))
        .set(CSRF_HEADER, first.csrfToken)
        .expect(204);

      const response = await request(ctx.server)
        .get('/v1/auth/session')
        .set('Cookie', cookieHeader(second));
      expect(response.status).toBe(200);
    });

    it('es idempotente: sin cookie, con cookie inventada, repetido o con sesión caducada responde 204 (CB-018)', async () => {
      const opened = await openFor('lucia');
      await request(ctx.server).post('/v1/auth/logout').expect(204);
      await request(ctx.server)
        .post('/v1/auth/logout')
        .set('Cookie', `${SID}=${'c'.repeat(43)}`)
        .expect(204);
      await request(ctx.server)
        .post('/v1/auth/logout')
        .set('Cookie', cookieHeader(opened))
        .set(CSRF_HEADER, opened.csrfToken)
        .expect(204);
      const repeated = await request(ctx.server)
        .post('/v1/auth/logout')
        .set('Cookie', cookieHeader(opened))
        .set(CSRF_HEADER, opened.csrfToken);
      expect(repeated.status).toBe(204);
      expect(setCookies(repeated)).toHaveLength(2);

      const expired = await openFor('maria');
      const past = new Date(Date.now() - 60_000);
      await ctx.prisma.session.updateMany({
        where: { accountId: expired.accountId },
        data: { createdAt: new Date(past.getTime() - 3_600_000), expiresAt: past },
      });
      const afterExpiry = await request(ctx.server)
        .post('/v1/auth/logout')
        .set('Cookie', cookieHeader(expired));
      expect(afterExpiry.status).toBe(204);
    });
  });

  it('ningún token ni cookie aparece en los logs', async () => {
    const opened = await openFor('lucia');
    ctx.clear();

    await request(ctx.server).get('/v1/auth/session').set('Cookie', cookieHeader(opened));
    await request(ctx.server)
      .post('/v1/auth/logout')
      .set('Cookie', cookieHeader(opened))
      .set(CSRF_HEADER, opened.csrfToken);

    const logs = ctx.lines.join('\n');
    expect(ctx.lines.length).toBeGreaterThan(0);
    expect(logs).not.toContain(opened.token);
    expect(logs).not.toContain(opened.csrfToken);
    expect(logs).not.toContain(SID);
  });
});
