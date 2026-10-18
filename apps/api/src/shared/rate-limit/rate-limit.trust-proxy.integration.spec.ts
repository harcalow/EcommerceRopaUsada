import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../../../test/helpers/test-app.factory';
import { Public } from '../http/public.decorator';

@Controller('proxy-probe')
class ProxyProbeController {
  @Public()
  @Get()
  plain(): { ok: true } {
    return { ok: true };
  }
}

const GLOBAL_LIMIT = 3;

describe('Límite de peticiones con TRUST_PROXY=1 (RT-014)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp({
      controllers: [ProxyProbeController],
      env: { TRUST_PROXY: '1', RATE_LIMIT_GLOBAL_PER_MIN: String(GLOBAL_LIMIT) },
    });
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const hitAs = (forwardedFor: string) =>
    request(ctx.server).get('/v1/proxy-probe').set('X-Forwarded-For', forwardedFor);

  it('cuenta por la IP que informa el proxy: otra IP sigue atendida tras el límite', async () => {
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await hitAs('203.0.113.7').expect(200);
    }

    await hitAs('203.0.113.7').expect(429);
    await hitAs('203.0.113.8').expect(200);
  });

  it('solo confía en el último salto: prefijos inventados por el cliente no cambian la IP', async () => {
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await hitAs(`10.0.0.${String(i + 1)}, 198.51.100.5`).expect(200);
    }

    await hitAs('10.9.9.9, 198.51.100.5').expect(429);
    const keys = (await ctx.prisma.rateLimitCounter.findMany()).map((row) => row.key);
    expect(keys).toEqual(['global:198.51.100.5']);
  });

  it('agrupa las direcciones IPv6 por su prefijo /64', async () => {
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await hitAs(`2001:db8:1:2::${String(i + 1)}`).expect(200);
    }

    await hitAs('2001:db8:1:2:ffff::9').expect(429);
    await hitAs('2001:db8:1:3::1').expect(200);
  });
});
