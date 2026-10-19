import 'server-only';

import { isIP } from 'node:net';

/**
 * IP del cliente final a partir de `X-Forwarded-For` (RT-022, ADR-011).
 * Con `hops` saltos de confianza toma la entrada `hops` contando desde la derecha, que es la que
 * añadió el primer proxy de confianza; las de la izquierda las puede falsificar el cliente.
 * Devuelve `undefined` con 0 saltos, sin cabecera, con menos entradas que saltos o si la entrada no es una IP.
 */
export function resolveClientIp(xForwardedFor: string | null | undefined, hops: number): string | undefined {
  if (!Number.isInteger(hops) || hops < 1 || !xForwardedFor) {
    return undefined;
  }
  const entries = xForwardedFor.split(',');
  const entry = entries[entries.length - hops]?.trim();
  return entry !== undefined && isIP(entry) !== 0 ? entry : undefined;
}
