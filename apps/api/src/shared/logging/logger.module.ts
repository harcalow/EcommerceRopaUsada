import type { DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream, LoggerOptions } from 'pino';

import type { AppConfig } from '../config/load-config';

import { sanitize } from './sanitize';

interface ReqWithId {
  id?: unknown;
}

/**
 * Opciones de pino para toda la API: una línea JSON por evento con `level` (etiqueta),
 * `time` ISO, `msg` y `correlationId` en los logs de petición; todo campo sensible pasa
 * por `sanitize()` antes de escribirse.
 */
export function buildPinoOptions(level: AppConfig['logLevel']): LoggerOptions {
  return {
    level,
    base: { service: 'api' },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    serializers: { req: sanitize, res: sanitize },
    formatters: {
      level: (label) => ({ level: label }),
      log: (object) => sanitize(object),
    },
  };
}

/** Módulo de logs JSON con id de correlación (RT-006). `destination` permite capturar la salida en pruebas. */
export function createLoggingModule(
  config: Pick<AppConfig, 'logLevel'>,
  destination?: DestinationStream,
): DynamicModule {
  const options = {
    ...buildPinoOptions(config.logLevel),
    customProps: (req: ReqWithId) => ({ correlationId: req.id }),
  };
  return LoggerModule.forRoot({ pinoHttp: destination ? [options, destination] : options });
}
