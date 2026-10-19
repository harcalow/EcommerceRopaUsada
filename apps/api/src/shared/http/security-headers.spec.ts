import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { configureApp } from './configure-app';

@Controller('ping')
class PingController {
  @Get()
  ping(): { pong: true } {
    return { pong: true };
  }
}

@Module({ controllers: [PingController] })
class PingModule {}

async function startApp(hsts: boolean | undefined): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [PingModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, { bodyLimitKb: 100, corsAllowedOrigins: [], ...(hsts === undefined ? {} : { hsts }) });
  await app.init();
  return app;
}

describe('cabeceras de seguridad (RT-015)', () => {
  const apps: NestExpressApplication[] = [];

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  async function get(hsts: boolean | undefined, path: string): Promise<request.Response> {
    const app = await startApp(hsts);
    apps.push(app);
    return request(app.getHttpServer()).get(path);
  }

  it('lleva CSP restrictiva, nosniff, no-referrer, marcos denegados y Cross-Origin-*', async () => {
    const response = await get(false, '/v1/ping');

    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('emite HSTS solo cuando se activa (producción)', async () => {
    const on = await get(true, '/v1/ping');
    const off = await get(false, '/v1/ping');
    const unset = await get(undefined, '/v1/ping');

    expect(on.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(off.headers['strict-transport-security']).toBeUndefined();
    expect(unset.headers['strict-transport-security']).toBeUndefined();
  });

  it('también las respuestas 404 llevan las cabeceras', async () => {
    const response = await get(true, '/v1/no-existe');

    expect(response.status).toBe(404);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
