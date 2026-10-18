import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ContractMatcher } from '../../../../test/contract/contract-matcher';
import { createTestApp, type TestApp } from '../../../../test/helpers/test-app.factory';

const STRICT_LIMIT = 3;

describe('POST /v1/auth/login con el límite estricto (RT-014)', () => {
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

  it('el intento siguiente al límite responde 429 con Retry-After y cumple el contrato', async () => {
    const attempt = (): request.Test =>
      request(ctx.server).post('/v1/auth/login').send({ username: 'nadie', password: 'Clave-equivocada-1' });
    for (let i = 0; i < STRICT_LIMIT; i += 1) {
      expect((await attempt()).status).toBe(401);
    }

    const limited = await attempt();

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toMatch(/^\d+$/);
    expect(limited.body).toMatchObject({ type: 'rate-limit-exceeded' });
    expect(
      new ContractMatcher().check({
        method: 'post',
        path: '/v1/auth/login',
        response: { status: 429, headers: limited.headers, body: limited.body },
      }),
    ).toEqual([]);
  });
});
