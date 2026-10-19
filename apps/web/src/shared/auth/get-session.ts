import 'server-only';

import { fetchSession, type AdminSessionView } from './fetch-session';

export type { AdminSessionView };

/** Sesión vigente de la petición o `null` si no la hay o no se pudo comprobar. */
export async function getSession(): Promise<AdminSessionView | null> {
  const result = await fetchSession();
  return result.kind === 'valid' ? result.session : null;
}
