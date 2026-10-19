import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import pino from 'pino';

import { AppModule } from './app.module';
import { listenOrExit } from './shared/bootstrap/listen-or-exit';
import { loadEnvFileIfPresent } from './shared/bootstrap/load-env-file';
import { ConfigError, loadConfig, type AppConfig } from './shared/config/load-config';
import { configureApp } from './shared/http/configure-app';
import { buildPinoOptions } from './shared/logging/logger.module';

function readConfigOrExit(logger: pino.Logger): AppConfig | undefined {
  try {
    loadEnvFileIfPresent();
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      logger.error(error.message);
      process.exitCode = 1;
      return undefined;
    }
    throw error;
  }
}

async function bootstrap(): Promise<void> {
  const bootstrapLogger = pino(buildPinoOptions('info'));
  const config = readConfigOrExit(bootstrapLogger);
  if (config === undefined) {
    return;
  }
  const logger = bootstrapLogger.child({ context: 'Bootstrap' });
  logger.level = config.logLevel;
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  configureApp(app, {
    bodyLimitKb: config.bodyLimitKb,
    corsAllowedOrigins: config.cors.allowedOrigins,
    trustProxy: config.trustProxy,
    hsts: config.env === 'production',
  });
  const listening = await listenOrExit(app, config.port, logger, (code) => {
    process.exitCode = code;
  });
  if (listening) {
    logger.info(`API listening on port ${String(config.port)}`);
  } else {
    await app.close();
  }
}

void bootstrap();
