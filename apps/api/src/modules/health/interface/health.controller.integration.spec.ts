import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  CORRELATION_ID_HEADER,
  healthOkSchema,
  healthUnavailableSchema,
  PROBLEM_CONTENT_TYPE,
} from '@perchados/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_INTERNAL_API_SECRET } from '../../../../test/helpers/internal-secret';
import { createTestApp, type TestApp } from '../../../../test/helpers/test-app.factory';
import { ConfigModule } from '../../../shared/config/config.module';
import { loadConfig } from '../../../shared/config/load-config';
import { DatabaseModule } from '../../../shared/database/database.module';
import { configureApp } from '../../../shared/http/configure-app';
import { HealthModule } from '../health.module';

const CORRELATION_ID = 'req-health-123';
const HEADER = CORRELATION_ID_HEADER.toLowerCase();

describe('GET /v1/health con la base de datos disponible (RT-016)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('responde 200 público con un cuerpo válido según healthOkSchema', async () => {
    const response = await request(ctx.server).get('/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(healthOkSchema.parse(response.body)).toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
  });

  it('devuelve no-store y el id de correlación recibido', async () => {
    const response = await request(ctx.server)
      .get('/v1/health')
      .set(CORRELATION_ID_HEADER, CORRELATION_ID);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers[HEADER]).toBe(CORRELATION_ID);
  });

  it('genera un id de correlación si la petición no lo trae', async () => {
    const response = await request(ctx.server).get('/v1/health');

    expect(response.headers[HEADER]).toBeTruthy();
  });
});

describe('GET /v1/health con la base de datos caída (RT-016)', () => {
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

  it('responde 503 problem+json válido según healthUnavailableSchema, sin detalles internos', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/health')
      .set(CORRELATION_ID_HEADER, CORRELATION_ID);

    expect(response.status).toBe(503);
    expect(String(response.headers['content-type']).startsWith(PROBLEM_CONTENT_TYPE)).toBe(true);
    expect(response.headers['cache-control']).toBe('no-store');
    const problem = healthUnavailableSchema.parse(response.body);
    expect(problem.type).toBe('health/unavailable');
    expect(problem.correlationId).toBe(CORRELATION_ID);
    expect(problem.checks).toEqual({ database: 'down' });
    expect(response.text).not.toMatch(/127\.0\.0\.1|secret-pass|ECONN/);
  });
});
