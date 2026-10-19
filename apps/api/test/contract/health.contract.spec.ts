import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { CORRELATION_ID_HEADER } from '@perchados/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConfigModule } from '../../src/shared/config/config.module';
import { loadConfig } from '../../src/shared/config/load-config';
import { DatabaseModule } from '../../src/shared/database/database.module';
import { configureApp } from '../../src/shared/http/configure-app';
import { HealthModule } from '../../src/modules/health/health.module';
import { TEST_INTERNAL_API_SECRET } from '../helpers/internal-secret';
import { createTestApp, type TestApp } from '../helpers/test-app.factory';

import { ContractMatcher, type ContractResponse } from './contract-matcher';

const matcher = new ContractMatcher();
const HEALTH = { method: 'get', path: '/v1/health' } as const;

function toContractResponse(response: request.Response): ContractResponse {
  return { status: response.status, headers: response.headers, body: response.body };
}

describe('contrato de GET /v1/health con la base de datos disponible (RT-004)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('la respuesta 200 real cumple el esquema y las cabeceras documentadas', async () => {
    const response = await request(ctx.server).get('/v1/health');

    expect(response.status).toBe(200);
    expect(matcher.check({ ...HEALTH, response: toContractResponse(response) })).toEqual([]);
  });

  it('un campo extra inyectado en el cuerpo hace fallar la validación', async () => {
    const response = await request(ctx.server).get('/v1/health');
    const tampered = { ...toContractResponse(response), body: { ...(response.body as object), leaked: 1 } };

    const errors = matcher.check({ ...HEALTH, response: tampered });

    expect(errors.join()).toMatch(/must NOT have additional properties/);
    expect(() => {
      matcher.assert({ ...HEALTH, response: tampered });
    }).toThrow(/incumple el contrato/);
  });

  it('un valor fuera del enum hace fallar la validación', async () => {
    const response = await request(ctx.server).get('/v1/health');
    const tampered = { ...toContractResponse(response), body: { status: 'ok', checks: { database: 'down' } } };

    expect(matcher.check({ ...HEALTH, response: tampered }).join()).toMatch(/allowed values/);
  });

  it('la falta de la cabecera X-Correlation-Id documentada hace fallar la validación', async () => {
    const response = await request(ctx.server).get('/v1/health');
    const headers = Object.fromEntries(
      Object.entries(response.headers).filter(([name]) => name !== CORRELATION_ID_HEADER.toLowerCase()),
    );

    const errors = matcher.check({ ...HEALTH, response: { ...toContractResponse(response), headers } });

    expect(errors).toEqual([`falta la cabecera ${CORRELATION_ID_HEADER}`]);
  });

  it('un tipo de contenido o un estado no documentados hacen fallar la validación', async () => {
    const response = await request(ctx.server).get('/v1/health');
    const base = toContractResponse(response);

    const wrongType = matcher.check({ ...HEALTH, response: { ...base, headers: { ...base.headers, 'content-type': 'text/html' } } });
    const wrongStatus = matcher.check({ ...HEALTH, response: { ...base, status: 418 } });

    expect(wrongType.join()).toMatch(/no documentado/);
    expect(wrongStatus).toEqual(['GET /v1/health: el estado 418 no está documentado']);
  });
});

describe('contrato de GET /v1/health con la base de datos caída (RT-004)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const config = loadConfig({
      APP_ENV: 'test',
      DATABASE_URL: 'postgresql://user:secret-pass@127.0.0.1:1/perchados',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      INTERNAL_API_SECRET: TEST_INTERNAL_API_SECRET,
      HEALTH_DB_TIMEOUT_MS: '500',
    });
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(config), DatabaseModule, HealthModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, {
      bodyLimitKb: config.bodyLimitKb,
      corsAllowedOrigins: config.cors.allowedOrigins,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('la respuesta 503 real cumple el esquema problem+json y las cabeceras documentadas', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health');

    expect(response.status).toBe(503);
    expect(matcher.check({ ...HEALTH, response: toContractResponse(response) })).toEqual([]);
  });

  it('un 503 sin el campo checks hace fallar la validación', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health');
    const withoutChecks = Object.fromEntries(
      Object.entries(response.body as Record<string, unknown>).filter(([name]) => name !== 'checks'),
    );

    const errors = matcher.check({ ...HEALTH, response: { ...toContractResponse(response), body: withoutChecks } });

    expect(errors.join()).toMatch(/must have required property 'checks'/);
  });
});
