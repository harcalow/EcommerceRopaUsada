import { SetMetadata } from '@nestjs/common';

/** Clave de metadatos con los códigos de rol admitidos por una ruta. */
export const ROLES_KEY = 'auth:roles';

/** Exige que el rol leído de la BD en esta petición sea uno de los indicados (RF-023, RT-013). */
export const Roles = (...roles: readonly [string, ...string[]]): ClassDecorator & MethodDecorator =>
  SetMetadata(ROLES_KEY, roles);
