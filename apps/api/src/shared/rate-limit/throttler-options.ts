import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';

import type { AppConfig } from '../config/load-config';

import { STRICT_RATE_LIMIT_KEY } from './strict-rate-limit.decorator';

export const GLOBAL_THROTTLER = 'global';
export const STRICT_THROTTLER = 'strict';

/** Ventana fija de los dos límites: un minuto, en milisegundos (unidad de `@nestjs/throttler`). */
export const WINDOW_MS = 60_000;

const UNKNOWN_TRACKER = 'unknown';

/**
 * Clave del contador (`rate_limit_counter.key`): `global:<ip>` y `strict:<ip>:<Controlador.método>`.
 * El rastreador es la IP que resuelve Express según `TRUST_PROXY` (IPv6 agrupada por /64).
 */
export function buildRateLimitKey(
  context: ExecutionContext,
  tracker: string | undefined,
  throttlerName: string,
): string {
  const who = tracker === undefined || tracker === '' ? UNKNOWN_TRACKER : tracker;
  if (throttlerName === GLOBAL_THROTTLER) {
    return `${GLOBAL_THROTTLER}:${who}`;
  }
  return `${throttlerName}:${who}:${context.getClass().name}.${context.getHandler().name}`;
}

/** El límite estricto solo se aplica a las rutas marcadas con `@StrictRateLimit()`. */
function isNotStrictRoute(reflector: Reflector, context: ExecutionContext): boolean {
  return (
    reflector.getAllAndOverride<boolean | undefined>(STRICT_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) !== true
  );
}

/** Opciones del throttler: límite `global` por IP y `strict` adicional en las rutas marcadas. */
export function buildThrottlerOptions(
  rateLimit: AppConfig['rateLimit'],
  storage: ThrottlerStorage,
): ThrottlerModuleOptions {
  const reflector = new Reflector();
  return {
    storage,
    setHeaders: false,
    generateKey: buildRateLimitKey,
    throttlers: [
      { name: GLOBAL_THROTTLER, limit: rateLimit.globalPerMin, ttl: WINDOW_MS },
      {
        name: STRICT_THROTTLER,
        limit: rateLimit.authPerMin,
        ttl: WINDOW_MS,
        skipIf: (context) => isNotStrictRoute(reflector, context),
      },
    ],
  };
}
