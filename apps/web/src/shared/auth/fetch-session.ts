import 'server-only';

import { PROBLEM_TYPES } from '@perchados/contracts/client';

import { getServerApiClient } from '../api/server-client';

export interface AdminSessionView {
  role: string;
  expiresAt: string;
}

export type SessionResult =
  | { kind: 'valid'; session: AdminSessionView }
  | { kind: 'expired' }
  | { kind: 'none' }
  | { kind: 'error' };

/**
 * Única consulta de `GET /v1/auth/session` desde el servidor (cookie reenviada a la API).
 * La web no decide: solo pregunta a la API (ADR-007).
 */
export async function fetchSession(): Promise<SessionResult> {
  try {
    const client = await getServerApiClient();
    const { data, error, response } = await client.GET('/v1/auth/session');
    if (response.ok && data) {
      return { kind: 'valid', session: { role: data.role, expiresAt: data.expiresAt } };
    }
    return error?.type === PROBLEM_TYPES.sessionExpired ? { kind: 'expired' } : { kind: 'none' };
  } catch {
    // API inalcanzable: la barrera real es la API en cada petición
    return { kind: 'error' };
  }
}
