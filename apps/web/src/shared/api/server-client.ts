import 'server-only';

import { CLIENT_IP_HEADER, CORRELATION_ID_HEADER, INTERNAL_TOKEN_HEADER } from '@perchados/contracts/client';
import { createApiClient, isValidCorrelationId, type ApiClient } from '@perchados/api-client';
import { headers } from 'next/headers';

import { getServerEnv } from '../config/server-env';
import { resolveClientIp } from './client-ip';

const COOKIE_HEADER = 'cookie';
const FORWARDED_FOR_HEADER = 'x-forwarded-for';

export interface ServerApiClientInput {
  /** `API_INTERNAL_URL`. */
  baseUrl: string;
  /** `INTERNAL_API_SECRET`: demuestra a la API que la IP del cliente la resolvió la web (RT-022). */
  internalSecret: string;
  /** `WEB_TRUST_PROXY_HOPS`: saltos de confianza sobre `X-Forwarded-For`. */
  trustProxyHops: number;
  /** Cabeceras de la petición entrante a la web. */
  incoming: Pick<Headers, 'get'>;
  /** `fetch` a usar; por defecto el global. */
  fetch?: typeof globalThis.fetch;
}

/**
 * Reenvía a la API `Cookie` y `X-Correlation-Id` (si es válido). Nunca reenvía `X-Forwarded-For`:
 * envía siempre el token interno y, solo si la web resuelve una IP de confianza, `X-Perchados-Client-Ip`
 * (RT-022, ADR-011).
 */
export function createServerApiClient({
  baseUrl,
  internalSecret,
  trustProxyHops,
  incoming,
  fetch,
}: ServerApiClientInput): ApiClient {
  const forwarded: Record<string, string> = { [INTERNAL_TOKEN_HEADER]: internalSecret };
  const cookie = incoming.get(COOKIE_HEADER);
  if (cookie) {
    forwarded.Cookie = cookie;
  }
  const correlationId = incoming.get(CORRELATION_ID_HEADER);
  if (isValidCorrelationId(correlationId)) {
    forwarded[CORRELATION_ID_HEADER] = correlationId;
  }
  const clientIp = resolveClientIp(incoming.get(FORWARDED_FOR_HEADER), trustProxyHops);
  if (clientIp) {
    forwarded[CLIENT_IP_HEADER] = clientIp;
  }
  return createApiClient({ baseUrl, headers: forwarded, ...(fetch ? { fetch } : {}) });
}

/** Cliente de la API para Server Components y Server Actions de la petición en curso. */
export async function getServerApiClient(): Promise<ApiClient> {
  const env = getServerEnv();
  return createServerApiClient({
    baseUrl: env.apiInternalUrl,
    internalSecret: env.internalApiSecret,
    trustProxyHops: env.trustProxyHops,
    incoming: await headers(),
  });
}
