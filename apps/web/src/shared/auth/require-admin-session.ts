import 'server-only';

import { redirect } from 'next/navigation';

import { ADMIN_ROLE } from './auth-constants';
import { fetchSession, type AdminSessionView } from './fetch-session';
import { LOGIN_PATH, SESSION_EXPIRED_LOGIN_PATH } from './login-paths';

export type AdminSession = AdminSessionView;

/**
 * Barrera del servidor del panel (RF-011, patrón DAL): pregunta a la API por la sesión de la petición
 * y redirige al login si no hay sesión de administrador. Se llama en el layout y en cada página.
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const result = await fetchSession();
  if (result.kind === 'valid' && result.session.role === ADMIN_ROLE) {
    return result.session;
  }
  return redirect(result.kind === 'expired' ? SESSION_EXPIRED_LOGIN_PATH : LOGIN_PATH);
}
