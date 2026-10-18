import { SkipThrottle } from '@nestjs/throttler';

import { GLOBAL_THROTTLER, STRICT_THROTTLER } from './throttler-options';

/** Exime una ruta o controlador de todos los límites de peticiones (p. ej. `/v1/health`, RT-016). */
export const SkipRateLimit = (): ClassDecorator & MethodDecorator =>
  SkipThrottle({ [GLOBAL_THROTTLER]: true, [STRICT_THROTTLER]: true });
