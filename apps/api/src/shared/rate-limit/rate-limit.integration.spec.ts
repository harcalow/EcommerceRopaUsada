import { Controller, Get, Post } from '@nestjs/common';
import { PROBLEM_CONTENT_TYPE, PROBLEM_TYPES, type Problem } from '@perchados/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../../../test/helpers/test-app.factory';
import { Public } from '../http/public.decorator';

import { StrictRateLimit } from './strict-rate-limit.decorator';

@Controller('limit-probe')
class LimitProbeController {
  @Public()
  @Get('plain')
  plain(): { ok: true } {
    return { ok: true };
  }

  @Public()
  @StrictRateLimit()
  @Get('strict')
  strict(): { ok: true } {
    return { ok: true };
  }

  @Public()
  @StrictRateLimit()
  @Get('strict-other')
  strictOther(): { ok: true } {
    return { ok: true };
  }

  /** Sin `@Public`: un `SessionGuard` anterior al límite daría 401 en vez de 429. */
  @Get('private')
  private(): { ok: true } {
    return { ok: true };
  }

  @Post('csrf')
  csrf(): { ok: true } {
    return { ok: true };
  }
}

const GLOBAL_LIMIT = 6;
const STRICT_LIMIT = 3;
const ALLOWED = 'http://localhost:3000';
const WINDOW_SECONDS = 60;

describe('Límite de peticiones (RT-014)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp({
      controllers: [LimitProbeController],
      env: {
        RATE_LIMIT_GLOBAL_PER_MIN: String(GLOBAL_LIMIT),
        RATE_LIMIT_AUTH_PER_MIN: String(STRICT_LIMIT),
      },
    });
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const hit = (path: string, ip?: string) => {
    const req = request(ctx.server).get(path);
    return ip === undefined ? req : req.set('X-Forwarded-For', ip);
  };

  it('atiende N peticiones y responde 429 problem+json con Retry-After a la N+1', async () => {
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await hit('/v1/limit-probe/plain').expect(200);
    }

    const blocked = await hit('/v1/limit-probe/plain').expect(429);

    expect(blocked.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
    expect(blocked.body).toMatchObject({
      type: PROBLEM_TYPES.rateLimitExceeded,
      status: 429,
    });
    expect(typeof (blocked.body as Problem).correlationId).toBe('string');
    const retryAfter = Number(blocked.headers['retry-after']);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(WINDOW_SECONDS);
  });

  it('Retry-After coincide con lo que falta de la ventana en la BD', async () => {
    for (let i = 0; i <= GLOBAL_LIMIT; i += 1) {
      await hit('/v1/limit-probe/plain');
    }
    await ctx.prisma.$executeRaw`UPDATE "rate_limit_counter" SET "expires_at" = now() + interval '17 seconds' WHERE "key" LIKE 'global:%'`;

    const blocked = await hit('/v1/limit-probe/plain').expect(429);

    expect(Number(blocked.headers['retry-after'])).toBe(17);
  });

  it('expone Retry-After a los navegadores del origen permitido (CORS)', async () => {
    for (let i = 0; i <= GLOBAL_LIMIT; i += 1) {
      await hit('/v1/limit-probe/plain');
    }

    const blocked = await hit('/v1/limit-probe/plain').set('Origin', ALLOWED).expect(429);

    expect(blocked.headers['access-control-expose-headers']).toContain('Retry-After');
    expect(blocked.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('con TRUST_PROXY=false ignora X-Forwarded-For: no se esquiva el límite cambiando de IP', async () => {
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await hit('/v1/limit-probe/plain', `203.0.113.${String(i + 1)}`).expect(200);
    }

    await hit('/v1/limit-probe/plain', '198.51.100.99').expect(429);
  });

  it('el límite estricto bloquea la ruta a la N+1 y deja libres las demás rutas', async () => {
    for (let i = 0; i < STRICT_LIMIT; i += 1) {
      await hit('/v1/limit-probe/strict').expect(200);
    }

    const blocked = await hit('/v1/limit-probe/strict').expect(429);

    expect(blocked.body).toMatchObject({ type: PROBLEM_TYPES.rateLimitExceeded });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    await hit('/v1/limit-probe/plain').expect(200);
  });

  it('el contador estricto es por ruta: otra ruta estricta tiene el suyo', async () => {
    for (let i = 0; i < STRICT_LIMIT; i += 1) {
      await hit('/v1/limit-probe/strict').expect(200);
    }

    await hit('/v1/limit-probe/strict-other').expect(200);
  });

  it('las rutas estrictas también consumen el límite global', async () => {
    for (let i = 0; i < STRICT_LIMIT; i += 1) {
      await hit('/v1/limit-probe/strict').expect(200);
    }
    for (let i = 0; i < GLOBAL_LIMIT - STRICT_LIMIT; i += 1) {
      await hit('/v1/limit-probe/plain').expect(200);
    }

    await hit('/v1/limit-probe/strict-other').expect(429);
  });

  it('/v1/health queda exento: no consume ni se ve afectado por el límite', async () => {
    for (let i = 0; i < GLOBAL_LIMIT * 3; i += 1) {
      await hit('/v1/health').expect(200);
    }

    const rows = await ctx.prisma.rateLimitCounter.count();
    expect(rows).toBe(0);
    await hit('/v1/limit-probe/plain').expect(200);
  });

  it('el contador es atómico: peticiones concurrentes no saltan el límite', async () => {
    const total = GLOBAL_LIMIT * 4;

    const responses = await Promise.all(
      Array.from({ length: total }, () => hit('/v1/limit-probe/plain')),
    );

    const ok = responses.filter((response) => response.status === 200).length;
    const limited = responses.filter((response) => response.status === 429).length;
    expect(ok).toBe(GLOBAL_LIMIT);
    expect(limited).toBe(total - GLOBAL_LIMIT);
  });

  it('la ventana se reinicia al caducar en la hora de la BD', async () => {
    for (let i = 0; i <= GLOBAL_LIMIT; i += 1) {
      await hit('/v1/limit-probe/plain');
    }
    await hit('/v1/limit-probe/plain').expect(429);

    await ctx.prisma.$executeRaw`UPDATE "rate_limit_counter" SET "expires_at" = now() - interval '1 second'`;

    await hit('/v1/limit-probe/plain').expect(200);
    const counter = await ctx.prisma.rateLimitCounter.findUniqueOrThrow({
      where: { key: 'global:127.0.0.1' },
    });
    expect(counter.hits).toBe(1);
  });

  it('el contador sobrevive en la BD y la clave no contiene datos de la petición', async () => {
    await hit('/v1/limit-probe/strict').expect(200);

    const keys = (await ctx.prisma.rateLimitCounter.findMany()).map((row) => row.key).sort();

    expect(keys).toEqual([
      'global:127.0.0.1',
      'strict:127.0.0.1:LimitProbeController.strict',
    ]);
  });

  it('RT-013: el límite va antes que la sesión y que el CSRF (429 en vez de 401 o 403)', async () => {
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await hit('/v1/limit-probe/private').expect(401);
    }

    await hit('/v1/limit-probe/private').expect(429);
    const csrf = await request(ctx.server).post('/v1/limit-probe/csrf');
    expect(csrf.status).toBe(429);
  });
});
