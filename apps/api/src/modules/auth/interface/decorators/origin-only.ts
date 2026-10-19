import { SetMetadata } from '@nestjs/common';

/** Clave de metadatos que marca una ruta que solo comprueba `Origin`, sin token CSRF. */
export const ORIGIN_ONLY_KEY = 'auth:originOnly';

/**
 * La ruta no exige `X-CSRF-Token` pero sí un `Origin` permitido (ADR-007): el login aún no tiene
 * sesión ni token que presentar.
 */
export const OriginOnly = (): ClassDecorator & MethodDecorator => SetMetadata(ORIGIN_ONLY_KEY, true);
