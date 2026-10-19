import type { LoginLock } from '../../domain/login-lock';

/**
 * Estado del bloqueo junto con el instante de la BD en que se leyó o se modificó. Interpretar el
 * bloqueo con `observedAt` (y no con el reloj de la API) evita desfases entre procesos (RF-008).
 */
export interface LoginLockSnapshot {
  readonly lock: LoginLock;
  readonly observedAt: Date;
}
