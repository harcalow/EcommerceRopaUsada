import type { Server } from 'node:http';

import { Module, type Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger as PinoNestLogger } from 'nestjs-pino';

import { AppModule } from '../../src/app.module';
import { loadConfig, type AppConfig } from '../../src/shared/config/load-config';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { configureApp } from '../../src/shared/http/configure-app';

import { prepareTestDatabase, resetDatabase } from './db';
import { TEST_INTERNAL_API_SECRET } from './internal-secret';
import { createLogCapture, type LogCapture } from './logged-app';

export { TEST_INTERNAL_API_SECRET };

export interface TestAppOptions {
  /** Controladores adicionales (rutas de prueba) junto al módulo real. */
  readonly controllers?: Type[];
  /** Variables de entorno adicionales que se validan con `loadConfig`. */
  readonly env?: Record<string, string>;
}

export interface TestApp extends LogCapture {
  readonly app: NestExpressApplication;
  readonly server: Server;
  readonly config: AppConfig;
  readonly prisma: PrismaService;
  /** Vacía los datos de la BD de pruebas (conserva el rol `admin`); llamar entre pruebas. */
  readonly reset: () => Promise<void>;
  readonly close: () => Promise<void>;
}

/**
 * Levanta la app real (`AppModule`) contra la BD de pruebas `*_test` (se crea y migra si falta)
 * con los logs capturados en memoria. Una sola app por archivo de prueba (logger raíz de pino).
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const database = await prepareTestDatabase();
  const capture = createLogCapture();
  const config = loadConfig({
    APP_ENV: 'test',
    DATABASE_URL: database.url,
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    INTERNAL_API_SECRET: TEST_INTERNAL_API_SECRET,
    RATE_LIMIT_GLOBAL_PER_MIN: '10000',
    RATE_LIMIT_AUTH_PER_MIN: '1000',
    ...options.env,
  });

  @Module({
    imports: [AppModule.forRoot(config, { logDestination: capture.destination })],
    controllers: options.controllers ?? [],
  })
  class TestRootModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [TestRootModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(PinoNestLogger));
  configureApp(app, {
    bodyLimitKb: config.bodyLimitKb,
    corsAllowedOrigins: config.cors.allowedOrigins,
    trustProxy: config.trustProxy,
    hsts: config.env === 'production',
  });
  await app.init();

  const prisma = app.get(PrismaService);
  await resetDatabase(prisma);

  return {
    ...capture,
    app,
    server: app.getHttpServer(),
    config,
    prisma,
    reset: () => resetDatabase(prisma),
    close: () => app.close(),
  };
}
