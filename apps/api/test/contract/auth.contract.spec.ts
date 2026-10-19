import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../helpers/test-app.factory';

import { ContractMatcher } from './contract-matcher';

const STRICT_LIMIT = 2;

/**
 * Complementa las pruebas de contrato de login (200/400/401/403/423/429), session y logout
 * (204/403) que viven junto a sus controladores: aquí, el 429 de `logout`, el otro endpoint
 * sujeto al límite estricto (RT-004, RT-014).
 */
describe('contrato de las rutas auth (RT-004)', () => {
  let ctx: TestApp;
  const matcher = new ContractMatcher();

  beforeAll(async () => {
    ctx = await createTestApp({ env: { RATE_LIMIT_AUTH_PER_MIN: String(STRICT_LIMIT) } });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('POST /v1/auth/logout superado el límite estricto responde 429 conforme al contrato', async () => {
    for (let i = 0; i < STRICT_LIMIT; i += 1) {
      expect((await request(ctx.server).post('/v1/auth/logout')).status).toBe(204);
    }

    const limited = await request(ctx.server).post('/v1/auth/logout');

    expect(limited.status).toBe(429);
    expect(
      matcher.check({
        method: 'post',
        path: '/v1/auth/logout',
        response: { status: 429, headers: limited.headers, body: limited.body },
      }),
    ).toEqual([]);
  });
});
