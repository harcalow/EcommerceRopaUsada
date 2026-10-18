import { SetMetadata } from '@nestjs/common';

/** Clave de metadatos que marca una ruta como pública. */
export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Exime una ruta (o un controlador) del `SessionGuard`: la API es privada por defecto (RT-013). */
export const Public = (): ClassDecorator & MethodDecorator => SetMetadata(IS_PUBLIC_KEY, true);
