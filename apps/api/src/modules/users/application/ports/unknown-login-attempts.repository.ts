import type { LoginLockSnapshot } from './login-lock-snapshot';

/** Token de inyección del puerto `UnknownLoginAttemptsRepository`. */
export const UNKNOWN_LOGIN_ATTEMPTS_REPOSITORY = Symbol('UNKNOWN_LOGIN_ATTEMPTS_REPOSITORY');

/**
 * Imita el contador y el bloqueo de una cuenta para nombres de usuario que no existen, de modo
 * que la respuesta sea indistinguible de la de una cuenta real (CB-004). Nunca crea cuentas.
 */
export interface UnknownLoginAttemptsRepository {
  /** Mismas reglas y atomicidad que `AccountRepository.registerFailedAttempt`, por `username_key`. */
  registerFailedAttempt(usernameKey: string): Promise<LoginLockSnapshot>;
}
