import { LOGIN_PATH, SESSION_EXPIRED_LOGIN_PATH } from './login-paths';

/** Lleva al login reemplazando la entrada del historial, para que «Atrás» no vuelva al panel (CA-011). */
export function navigateToLogin(options: { sessionExpired?: boolean } = {}): void {
  window.location.replace(options.sessionExpired ? SESSION_EXPIRED_LOGIN_PATH : LOGIN_PATH);
}
