/** Token de inyección del puerto `LoginAudit`. */
export const LOGIN_AUDIT = Symbol('LOGIN_AUDIT');

/** Motivo interno de un intento fallido; nunca se devuelve al cliente (CA-003, CA-019). */
export type LoginFailureReason = 'invalid-password' | 'unknown-user' | 'not-admin' | 'disabled';

/**
 * Evento de auditoría de autenticación (RNF «intentos fallidos y bloqueos registrados»; A09: el
 * cierre de sesión también). Por diseño no lleva el usuario tecleado, la contraseña ni el token de
 * sesión: solo el id de la cuenta cuando existe.
 */
export type LoginAuditEvent =
  | { readonly name: 'auth.login.succeeded'; readonly accountId: string }
  | {
      readonly name: 'auth.login.failed';
      readonly reason: LoginFailureReason;
      readonly accountId?: string;
    }
  | { readonly name: 'auth.login.locked'; readonly accountId?: string }
  | { readonly name: 'auth.logout'; readonly accountId: string };

export interface LoginAudit {
  record(event: LoginAuditEvent): void;
}
