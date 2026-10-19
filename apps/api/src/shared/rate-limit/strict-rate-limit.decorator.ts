import { SetMetadata } from '@nestjs/common';

/** Clave de metadatos que activa el límite estricto en una ruta. */
export const STRICT_RATE_LIMIT_KEY = 'rateLimit:strict';

/**
 * Añade el límite estricto por IP (`RATE_LIMIT_AUTH_PER_MIN`) a una ruta o controlador, además del
 * global. Se usa en las rutas de autenticación (RT-014).
 */
export const StrictRateLimit = (): ClassDecorator & MethodDecorator =>
  SetMetadata(STRICT_RATE_LIMIT_KEY, true);
