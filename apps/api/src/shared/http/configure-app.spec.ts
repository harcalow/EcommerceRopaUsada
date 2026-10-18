import type { Server } from 'node:http';

import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configureApp } from './configure-app';

@Controller('ping')
class PingController {
  @Get()
  ping(): { pong: true } {
    return { pong: true };
  }
}

@Controller({ path: 'ping', version: '2' })
class PingV2Controller {
  @Get()
  ping(): { pong: 2 } {
    return { pong: 2 };
  }
}

@Module({ controllers: [PingController, PingV2Controller] })
class PingModule {}

describe('configureApp (versionado /v1, RT-005)', () => {
  let app: NestExpressApplication;
  const server = (): Server => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PingModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, { bodyLimitKb: 100, corsAllowedOrigins: [] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('publica las rutas sin versión explícita bajo /v1', async () => {
    const response = await request(server()).get('/v1/ping').expect(200);

    expect(response.body).toEqual({ pong: true });
  });

  it('no responde fuera de /v1', async () => {
    await request(server()).get('/ping').expect(404);
  });

  it('permite que /v2 conviva con /v1', async () => {
    const response = await request(server()).get('/v2/ping').expect(200);

    expect(response.body).toEqual({ pong: 2 });
  });
});
