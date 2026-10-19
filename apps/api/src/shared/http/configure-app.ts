import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { correlationIdMiddleware } from '../correlation/correlation-id.middleware';
import { ProblemDetailsFilter } from '../errors/problem-details.filter';

import { buildCorsOptions } from './cors';
import { NoStoreInterceptor } from './no-store.interceptor';
import { securityHeaders } from './security-headers';

/** Versión por defecto de la API: todas las rutas cuelgan de `/v1` (RT-005). */
export const DEFAULT_API_VERSION = '1';

const BYTES_PER_KB = 1024;

export interface ConfigureAppOptions {
  /** Tamaño máximo del cuerpo en KiB (`BODY_LIMIT_KB`); por encima, 413 `payload-too-large`. */
  readonly bodyLimitKb: number;
  /** Orígenes permitidos por CORS (`CORS_ALLOWED_ORIGINS`); lista vacía = ninguno. */
  readonly corsAllowedOrigins: readonly string[];
  /**
   * `TRUST_PROXY`: `false` (por defecto, ignora `X-Forwarded-For`), número de saltos o lista de
   * IP/CIDR de proxies fiables. Determina `request.ip`, que usa el límite de peticiones.
   */
  readonly trustProxy?: boolean | number | readonly string[];
  /** Emite HSTS; solo `true` en `production` (RT-015). */
  readonly hsts?: boolean;
}

/**
 * Configuración HTTP común a la API real y a la de las pruebas. La aplicación debe crearse con
 * `bodyParser: false`: aquí se registra solo el parser JSON (la API no consume formularios).
 */
export function configureApp(app: NestExpressApplication, options: ConfigureAppOptions): void {
  const limit = options.bodyLimitKb * BYTES_PER_KB;
  const { trustProxy = false } = options;
  app.disable('x-powered-by');
  app.set('trust proxy', typeof trustProxy === 'object' ? [...trustProxy] : trustProxy);
  app.use(securityHeaders({ hsts: options.hsts ?? false }));
  app.use(correlationIdMiddleware);
  app.enableCors(buildCorsOptions(options.corsAllowedOrigins));
  app.useBodyParser('json', { limit });
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalInterceptors(new NoStoreInterceptor());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: DEFAULT_API_VERSION });
}
