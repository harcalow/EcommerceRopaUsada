import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

import { normalizeIp } from '@nestjs/throttler';
import {
  CLIENT_IP_HEADER as CLIENT_IP_HEADER_NAME,
  INTERNAL_TOKEN_HEADER as INTERNAL_TOKEN_HEADER_NAME,
} from '@perchados/contracts';

/** Nombre en minúsculas (como lo entrega Node) de la cabecera con el token interno (RT-022, ADR-011). */
export const INTERNAL_TOKEN_HEADER = INTERNAL_TOKEN_HEADER_NAME.toLowerCase();

/** Nombre en minúsculas de la cabecera con la IP del cliente; solo se atiende con el token. */
export const CLIENT_IP_HEADER = CLIENT_IP_HEADER_NAME.toLowerCase();

/** Lo mínimo que necesita la resolución de la IP: las cabeceras y la IP que resolvió Express. */
export interface TrackerRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly ip?: string | undefined;
}

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Comparación en tiempo constante: se comparan los SHA-256 para igualar longitudes. */
function matchesSecret(candidate: string, secret: string): boolean {
  return secret !== '' && timingSafeEqual(sha256(candidate), sha256(secret));
}

/** Una cabecera repetida llega unida con comas (o como lista): no se acepta ninguna de las dos. */
function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * IP por la que se cuenta el límite de peticiones (RT-014, RT-022).
 *
 * Usa `X-Perchados-Client-Ip` solo si `X-Perchados-Internal-Token` coincide con el secreto y el
 * valor es exactamente una dirección IP; en cualquier otro caso, la `req.ip` de Express (que ya
 * respeta `TRUST_PROXY`). El resultado agrupa IPv6 por /64. El token no concede ningún otro privilegio.
 */
export function resolveTrackerIp(request: TrackerRequest, internalSecret: string): string | undefined {
  const token = singleValue(request.headers[INTERNAL_TOKEN_HEADER]);
  const claimed = singleValue(request.headers[CLIENT_IP_HEADER]);
  const trusted =
    token !== undefined &&
    claimed !== undefined &&
    matchesSecret(token, internalSecret) &&
    isIP(claimed) !== 0;
  const ip = trusted ? claimed : request.ip;
  return ip === undefined ? undefined : normalizeIp(ip);
}
