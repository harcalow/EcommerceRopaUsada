import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'];
const ALLOWED_HEADERS = ['Content-Type', 'Accept', 'X-CSRF-Token', 'X-Correlation-Id'];
const EXPOSED_HEADERS = ['X-Correlation-Id', 'Retry-After'];
/** Segundos que el navegador puede cachear el preflight. */
const PREFLIGHT_MAX_AGE_SECONDS = 600;

/**
 * CORS con lista cerrada y credenciales (RT-012): solo los orígenes de `CORS_ALLOWED_ORIGINS`
 * reciben cabeceras `Access-Control-*`; nunca un comodín.
 */
export function buildCorsOptions(allowedOrigins: readonly string[]): CorsOptions {
  return {
    origin: [...allowedOrigins],
    credentials: true,
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: EXPOSED_HEADERS,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
    optionsSuccessStatus: 204,
  };
}
