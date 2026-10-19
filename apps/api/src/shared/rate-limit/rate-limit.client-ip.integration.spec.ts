import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_INTERNAL_API_SECRET } from '../../../test/helpers/internal-secret';
import { createTestApp, type TestApp } from '../../../test/helpers/test-app.factory';
import { Public } from '../http/public.decorator';

import { CLIENT_IP_HEADER, INTERNAL_TOKEN_HEADER } from './client-ip';

@Controller('client-ip-probe')
class ClientIpProbeController {
  @Public()
  @Get('plain')
  plain(): { ok: true } {
    return { ok: true };
  }

  /** Sin `@Public`: el token interno no exime de la sesión. */
  @Get('private')
  private(): { ok: true } {
    return { ok: true };
  }
}

const GLOBAL_LIMIT = 4;
const STRICT_LIMIT = 3;
const PLAIN = '/v1/client-ip-probe/plain';
const LOGIN = '/v1/auth/login';

const IP_A = '203.0.113.7';
const IP_B = '203.0.113.8';

describe('IP del cliente en el límite de peticiones (RT-022, RT-014)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp({
      controllers: [ClientIpProbeController],
      env: {
        RATE_LIMIT_GLOBAL_PER_MIN: String(GLOBAL_LIMIT),
        RATE_LIMIT_AUTH_PER_MIN: String(STRICT_LIMIT),
      },
    });
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const plain = (headers: Record<string, string>) =>
    request(ctx.server).get(PLAIN).set(headers);

  const withToken = (clientIp: string): Record<string, string> => ({
    [INTERNAL_TOKEN_HEADER]: TEST_INTERNAL_API_SECRET,
    [CLIENT_IP_HEADER]: clientIp,
  });

  const loginAs = (headers: Record<string, string>) =>
    request(ctx.server)
      .post(LOGIN)
      .set(headers)
      .send({ username: 'nadie', password: 'Clave-equivocada-1' });

  const counterKeys = async (): Promise<string[]> =>
    (await ctx.prisma.rateLimitCounter.findMany()).map((row) => row.key);

  it('sin token, variar X-Perchados-Client-Ip no cambia el cubo: la cabecera se ignora', async () => {
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await plain({ [CLIENT_IP_HEADER]: `198.51.100.${String(i + 1)}` }).expect(200);
    }

    await plain({ [CLIENT_IP_HEADER]: '198.51.100.99' }).expect(429);
    expect(await counterKeys()).toHaveLength(1);
  });

  it('con un token erróneo, variar la cabecera de IP tampoco cambia el cubo', async () => {
    const wrong = (clientIp: string) => ({
      [INTERNAL_TOKEN_HEADER]: `${TEST_INTERNAL_API_SECRET}-distinto`,
      [CLIENT_IP_HEADER]: clientIp,
    });
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await plain(wrong(`198.51.100.${String(i + 1)}`)).expect(200);
    }

    await plain(wrong('198.51.100.99')).expect(429);
    expect(await counterKeys()).toHaveLength(1);
  });

  it('con token válido, la IP A agota su cubo (429 con Retry-After) y la IP B sigue en 200', async () => {
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await plain(withToken(IP_A)).expect(200);
    }

    const blocked = await plain(withToken(IP_A)).expect(429);

    expect(blocked.headers['retry-after']).toMatch(/^\d+$/);
    await plain(withToken(IP_B)).expect(200);
    expect((await counterKeys()).sort()).toEqual([`global:${IP_A}`, `global:${IP_B}`]);
  });

  it('con token válido, el límite estricto de POST /v1/auth/login también es por IP del cliente', async () => {
    for (let i = 0; i < STRICT_LIMIT; i += 1) {
      expect((await loginAs(withToken(IP_A))).status).toBe(401);
    }

    const blocked = await loginAs(withToken(IP_A));

    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toMatch(/^\d+$/);
    expect((await loginAs(withToken(IP_B))).status).toBe(401);
  });

  it('con token válido y un valor que no es IP, se cuenta en el cubo de req.ip', async () => {
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await plain(withToken(['abc', '1.2.3.4, 5.6.7.8', '999.1.1.1', 'abc'][i] ?? 'abc')).expect(
        200,
      );
    }

    await plain({}).expect(429);
    expect(await counterKeys()).toHaveLength(1);
    expect(await counterKeys()).not.toContain(`global:${IP_A}`);
  });

  it('el token no exime de la sesión: una ruta privada sin cookie responde 401', async () => {
    const response = await request(ctx.server)
      .get('/v1/client-ip-probe/private')
      .set(withToken(IP_A));

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ type: 'auth/unauthenticated' });
  });

  it('el token no exime de los límites: la IP del cliente sigue sujeta al cubo global', async () => {
    for (let i = 0; i <= GLOBAL_LIMIT; i += 1) {
      await plain(withToken(IP_A));
    }

    await plain(withToken(IP_A)).expect(429);
  });

  it('el valor del token no aparece en ninguna línea de log ni en stdout, ni con 429 ni con 401', async () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      written.push(String(chunk));
      return true;
    });
    for (let i = 0; i <= GLOBAL_LIMIT; i += 1) {
      await plain(withToken(IP_A));
    }
    await loginAs(withToken(IP_B));

    const output = [...ctx.lines, ...written].join('\n');

    expect(ctx.lines.length).toBeGreaterThan(0);
    expect(output).not.toContain(TEST_INTERNAL_API_SECRET);
  });
});
