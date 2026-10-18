import type { Server } from 'node:http';
import { Writable } from 'node:stream';

import { Controller, Get, Logger, Module, Post, type Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger as PinoNestLogger } from 'nestjs-pino';

import { TEST_INTERNAL_API_SECRET } from './internal-secret';
import { loadConfig } from '../../src/shared/config/load-config';
import { configureApp } from '../../src/shared/http/configure-app';
import { createLoggingModule } from '../../src/shared/logging/logger.module';

export const SECRETS = {
  password: 'S3cret-Pass-123!',
  cookie: 'sid=cookie-secret-value',
  bearer: 'Bearer bearer-secret-value',
  token: 'tok-secret',
} as const;

@Controller('demo')
class DemoController {
  private readonly logger = new Logger('Demo');

  @Get()
  read(): { ok: true } {
    this.logger.log('handling demo');
    return { ok: true };
  }

  @Post()
  write(): { ok: true } {
    this.logger.log({
      message: 'login attempt',
      password: SECRETS.password,
      nested: { token: SECRETS.token },
    });
    return { ok: true };
  }
}

export interface LogRecord {
  level?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface LoggedAppOptions {
  /** Controladores adicionales a registrar junto al de demostración. */
  readonly controllers?: Type[];
  /** Variables de entorno adicionales (p. ej. `BODY_LIMIT_KB`). */
  readonly env?: Record<string, string>;
}

export interface LoggedApp {
  readonly app: NestExpressApplication;
  readonly server: Server;
  /** Líneas escritas al log desde la última llamada a `clear()`. */
  readonly lines: string[];
  readonly records: () => LogRecord[];
  readonly clear: () => void;
}

export interface LogCapture {
  readonly destination: Writable;
  readonly lines: string[];
  readonly records: () => LogRecord[];
  readonly clear: () => void;
}

/** Destino de logs en memoria: guarda cada línea JSON y permite parsearla. */
export function createLogCapture(): LogCapture {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(
        ...chunk
          .toString()
          .split('\n')
          .filter((line) => line !== ''),
      );
      callback();
    },
  });
  return {
    destination,
    lines,
    records: () => lines.map((line) => JSON.parse(line) as LogRecord),
    clear: () => {
      lines.length = 0;
    },
  };
}

/**
 * Levanta una app mínima con el módulo de logs real y la salida capturada en memoria.
 * `nestjs-pino` comparte un logger raíz por proceso: usa una sola app por archivo de prueba.
 */
export async function createLoggedApp(
  logLevel?: string,
  options: LoggedAppOptions = {},
): Promise<LoggedApp> {
  const capture = createLogCapture();
  const config = loadConfig({
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    INTERNAL_API_SECRET: TEST_INTERNAL_API_SECRET,
    ...(logLevel ? { LOG_LEVEL: logLevel } : {}),
    ...options.env,
  });

  @Module({
    imports: [createLoggingModule(config, capture.destination)],
    controllers: [DemoController, ...(options.controllers ?? [])],
  })
  class LoggedTestModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [LoggedTestModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(PinoNestLogger));
  configureApp(app, {
      bodyLimitKb: config.bodyLimitKb,
      corsAllowedOrigins: config.cors.allowedOrigins,
    });
  await app.init();

  return {
    app,
    server: app.getHttpServer(),
    lines: capture.lines,
    records: capture.records,
    clear: capture.clear,
  };
}
