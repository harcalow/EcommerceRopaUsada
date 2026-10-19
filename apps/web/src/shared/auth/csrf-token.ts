import { CSRF_COOKIE_NAME, SECURE_CSRF_COOKIE_NAME } from '@perchados/contracts/client';

/** Nombres de la cookie CSRF legible por JS: con `Secure` lleva el prefijo `__Secure-` (ADR-007). */
export const CSRF_COOKIE_NAMES = [SECURE_CSRF_COOKIE_NAME, CSRF_COOKIE_NAME] as const;

/** Lee el token CSRF (patrón sincronizador) de las cookies del documento, o `undefined` si no hay. */
export function readCsrfToken(cookieString: string = document.cookie): string | undefined {
  const pairs = cookieString.split(';').map((part) => part.trim());
  for (const name of CSRF_COOKIE_NAMES) {
    const pair = pairs.find((candidate) => candidate.startsWith(`${name}=`));
    if (pair) {
      return decodeURIComponent(pair.slice(name.length + 1));
    }
  }
  return undefined;
}
