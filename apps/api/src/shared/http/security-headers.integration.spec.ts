import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../../../test/helpers/test-app.factory';

const STRICT_LIMIT = 1;

function expectSecurityHeaders(response: request.Response): void {
  expect(response.headers['content-security-policy']).toBe("default-src 'none';frame-ancestors 'none'");
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['referrer-policy']).toBe('no-referrer');
  expect(response.headers['x-frame-options']).toBe('DENY');
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['x-powered-by']).toBeUndefined();
  expect(response.headers['strict-transport-security']).toBeUndefined();
}

describe('cabeceras de seguridad en la API real (RT-015)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp({ env: { RATE_LIMIT_AUTH_PER_MIN: String(STRICT_LIMIT) } });
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('200: GET /v1/health', async () => {
    const response = await request(ctx.server).get('/v1/health');

    expect(response.status).toBe(200);
    expectSecurityHeaders(response);
  });

  it('401 problem+json: GET /v1/auth/session sin sesión', async () => {
    const response = await request(ctx.server).get('/v1/auth/session');

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
    expectSecurityHeaders(response);
  });

  it('404: ruta inexistente', async () => {
    const response = await request(ctx.server).get('/v1/no-existe');

    expect(response.status).toBe(404);
    expectSecurityHeaders(response);
  });

  it('429: límite estricto de login', async () => {
    const attempt = (): request.Test =>
      request(ctx.server).post('/v1/auth/login').send({ username: 'nadie', password: 'Clave-equivocada-1' });
    await attempt();

    const limited = await attempt();

    expect(limited.status).toBe(429);
    expectSecurityHeaders(limited);
  });
});
