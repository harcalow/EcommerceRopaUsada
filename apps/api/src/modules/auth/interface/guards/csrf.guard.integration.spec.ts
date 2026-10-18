import { Controller, Delete, Get, Post, Put } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_ROLE_CODE } from '../../../../../test/helpers/db';
import { createTestApp, type TestApp } from '../../../../../test/helpers/test-app.factory';
import { Public } from '../../../../shared/http/public.decorator';
import { OpenSession, type OpenedSession } from '../../application/open-session.use-case';
import { CSRF_HEADER } from '../csrf-token.verifier';
import { OriginOnly } from '../decorators/origin-only';

@Controller('csrf-probe')
class CsrfProbeController {
  @Get()
  read(): { ok: true } {
    return { ok: true };
  }

  @Put()
  replace(): { ok: true } {
    return { ok: true };
  }

  @Delete()
  remove(): { ok: true } {
    return { ok: true };
  }

  @Public()
  @OriginOnly()
  @Post('origin-only')
  originOnly(): { ok: true } {
    return { ok: true };
  }

  @Public()
  @Post('public')
  publicWithSession(): { ok: true } {
    return { ok: true };
  }
}

const ALLOWED = 'http://localhost:3000';
const FOREIGN = 'https://evil.example.com';
const HOUR_MS = 3_600_000;

describe('CsrfGuard y CORS (RT-012)', () => {
  let ctx: TestApp;
  let open: OpenSession;

  beforeAll(async () => {
    ctx = await createTestApp({
      controllers: [CsrfProbeController],
      env: { CORS_ALLOWED_ORIGINS: `${ALLOWED}, http://127.0.0.1:3000` },
    });
    open = ctx.app.get(OpenSession);
  });

  beforeEach(async () => {
    await ctx.reset();
    ctx.clear();
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function openSession(): Promise<OpenedSession & { cookie: string }> {
    const role = await ctx.prisma.role.findUniqueOrThrow({ where: { code: ADMIN_ROLE_CODE } });
    const account = await ctx.prisma.account.create({
      data: { username: 'lucia', usernameKey: 'lucia', roleId: role.id, passwordHash: '$argon2id$x' },
    });
    const opened = await open.execute({ accountId: account.id });
    return { ...opened, cookie: `perchados_sid=${opened.token}` };
  }

  describe('métodos no seguros con sesión', () => {
    it.each(['put', 'delete'] as const)(
      '%s con Origin permitido y token correcto pasa',
      async (method) => {
        const s = await openSession();

        const agent = request(ctx.server);
        const call = method === 'put' ? agent.put('/v1/csrf-probe') : agent.delete('/v1/csrf-probe');
        const response = await call
          .set('Cookie', s.cookie)
          .set('Origin', ALLOWED)
          .set(CSRF_HEADER, s.csrfToken);

        expect(response.status).toBe(200);
      },
    );

    it.each([
      ['ausente', undefined],
      ['erróneo', 'b'.repeat(43)],
      ['con forma inválida', 'corto'],
    ])('con token %s responde 403 auth/csrf-invalid', async (_n, token) => {
      const s = await openSession();
      const call = request(ctx.server)
        .put('/v1/csrf-probe')
        .set('Cookie', s.cookie)
        .set('Origin', ALLOWED);

      const response = await (token === undefined ? call : call.set(CSRF_HEADER, token));

      expect(response.status).toBe(403);
      expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(response.body).toMatchObject({ type: 'auth/csrf-invalid', status: 403 });
    });

    it('con Origin ajeno responde 403 aunque el token sea correcto, y sin cabeceras CORS', async () => {
      const s = await openSession();

      const response = await request(ctx.server)
        .put('/v1/csrf-probe')
        .set('Cookie', s.cookie)
        .set('Origin', FOREIGN)
        .set(CSRF_HEADER, s.csrfToken);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ type: 'auth/csrf-invalid' });
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('ruta pública con Origin ajeno y sin sesión responde 403', async () => {
      const response = await request(ctx.server).post('/v1/csrf-probe/origin-only').set('Origin', FOREIGN);

      expect(response.status).toBe(403);
    });

it('orden de guards: ruta privada con Origin ajeno y sin sesión responde 401 (SessionGuard antes que CsrfGuard)', async () => {      const response = await request(ctx.server).put('/v1/csrf-probe').set('Origin', FOREIGN);      expect(response.status).toBe(401);    });
    it('con Origin "null" responde 403', async () => {
      const response = await request(ctx.server).post('/v1/csrf-probe/origin-only').set('Origin', 'null');

      expect(response.status).toBe(403);
    });

    it('un Origin que solo comparte prefijo con uno permitido responde 403', async () => {
      const response = await request(ctx.server)
        .post('/v1/csrf-probe/origin-only')
        .set('Origin', `${ALLOWED}.evil.example.com`);

      expect(response.status).toBe(403);
    });

    it('sin Origin pero con token correcto pasa (cliente que no es un navegador)', async () => {
      const s = await openSession();

      const response = await request(ctx.server)
        .put('/v1/csrf-probe')
        .set('Cookie', s.cookie)
        .set(CSRF_HEADER, s.csrfToken);

      expect(response.status).toBe(200);
    });

    it('sin Origin y sin token con sesión responde 403', async () => {
      const s = await openSession();

      const response = await request(ctx.server).put('/v1/csrf-probe').set('Cookie', s.cookie);

      expect(response.status).toBe(403);
    });

    it('el Referer no sustituye al token ni al Origin', async () => {
      const s = await openSession();

      const response = await request(ctx.server)
        .put('/v1/csrf-probe')
        .set('Cookie', s.cookie)
        .set('Referer', `${ALLOWED}/panel`);

      expect(response.status).toBe(403);
    });

    it('sin sesión en ruta privada responde 401, no 403', async () => {
      const response = await request(ctx.server).put('/v1/csrf-probe').set('Origin', ALLOWED);

      expect(response.status).toBe(401);
    });

    it('con sesión caducada y token ausente responde 401 session-expired, no 403', async () => {
      const s = await openSession();
      await ctx.prisma.session.updateMany({
        data: {
          createdAt: new Date(Date.now() - 9 * HOUR_MS),
          expiresAt: new Date(Date.now() - HOUR_MS),
        },
      });

      const response = await request(ctx.server).put('/v1/csrf-probe').set('Cookie', s.cookie);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ type: 'auth/session-expired' });
    });
  });

  describe('métodos seguros', () => {
    it('GET no exige token ni Origin', async () => {
      const s = await openSession();

      const response = await request(ctx.server).get('/v1/csrf-probe').set('Cookie', s.cookie);

      expect(response.status).toBe(200);
    });

    it('GET con Origin ajeno se atiende pero sin cabeceras CORS', async () => {
      const s = await openSession();

      const response = await request(ctx.server)
        .get('/v1/csrf-probe')
        .set('Cookie', s.cookie)
        .set('Origin', FOREIGN);

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('HEAD no exige token', async () => {
      const s = await openSession();

      await request(ctx.server).head('/v1/csrf-probe').set('Cookie', s.cookie).expect(200);
    });
  });

  describe('rutas públicas', () => {
    it('@OriginOnly: sin token pasa con Origin permitido o ausente', async () => {
      await request(ctx.server).post('/v1/csrf-probe/origin-only').set('Origin', ALLOWED).expect(201);
      await request(ctx.server).post('/v1/csrf-probe/origin-only').expect(201);
    });

    it('@OriginOnly: con Origin ajeno responde 403 auth/csrf-invalid', async () => {
      const response = await request(ctx.server)
        .post('/v1/csrf-probe/origin-only')
        .set('Origin', FOREIGN);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ type: 'auth/csrf-invalid' });
    });

    it('@OriginOnly: no exige token aunque exista una sesión vigente', async () => {
      const s = await openSession();

      await request(ctx.server)
        .post('/v1/csrf-probe/origin-only')
        .set('Cookie', s.cookie)
        .set('Origin', ALLOWED)
        .expect(201);
    });

    it('pública sin @OriginOnly: con sesión vigente exige token; sin sesión pasa', async () => {
      const s = await openSession();

      await request(ctx.server).post('/v1/csrf-probe/public').set('Cookie', s.cookie).expect(403);
      await request(ctx.server)
        .post('/v1/csrf-probe/public')
        .set('Cookie', s.cookie)
        .set(CSRF_HEADER, s.csrfToken)
        .expect(201);
      await request(ctx.server).post('/v1/csrf-probe/public').expect(201);
    });
  });

  describe('CORS', () => {
    it('el preflight desde un origen permitido devuelve las cabeceras con credenciales', async () => {
      const response = await request(ctx.server)
        .options('/v1/auth/logout')
        .set('Origin', ALLOWED)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'x-csrf-token,x-correlation-id,content-type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toBe(
        'GET,HEAD,POST,PUT,PATCH,DELETE',
      );
      expect(response.headers['access-control-allow-headers']).toBe(
        'Content-Type,Accept,X-CSRF-Token,X-Correlation-Id',
      );
      expect(response.headers['access-control-max-age']).toBe('600');
      expect(response.headers.vary).toMatch(/Origin/);
    });

    it('el preflight desde un origen no permitido no devuelve cabeceras CORS', async () => {
      const response = await request(ctx.server)
        .options('/v1/auth/logout')
        .set('Origin', FOREIGN)
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('una respuesta real al origen permitido expone X-Correlation-Id y Retry-After', async () => {
      const response = await request(ctx.server).get('/v1/health').set('Origin', ALLOWED);

      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-expose-headers']).toBe(
        'X-Correlation-Id,Retry-After',
      );
    });

    it('nunca devuelve un comodín', async () => {
      const response = await request(ctx.server).get('/v1/health').set('Origin', FOREIGN);

      expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });
  });
});
