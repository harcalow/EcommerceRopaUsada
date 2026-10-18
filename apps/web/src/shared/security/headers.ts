import { SECURE_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from '@perchados/contracts/client';

/** Nombres de la cookie de sesión: con `Secure` lleva el prefijo `__Secure-` (ADR-007). */
export const SESSION_COOKIE_NAMES = [SESSION_COOKIE_NAME, SECURE_SESSION_COOKIE_NAME] as const;

interface CookieReader { has(name: string): boolean }

/** Comprobación optimista: solo presencia, nunca validez (la API valida). */
export function hasSessionCookie(cookies: CookieReader): boolean {
  return SESSION_COOKIE_NAMES.some((name) => cookies.has(name));
}

/** Nonce de 128 bits, distinto en cada petición. */
export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}

function originOf(url: string | undefined): string | undefined {
  if (url === undefined || url === '') return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export interface CspOptions {
  nonce: string;
  apiPublicUrl: string | undefined;
  isDevelopment: boolean;
}

/** CSP del diseño: scripts con nonce y `strict-dynamic`; `unsafe-eval` solo en desarrollo. */
export function buildCsp({ nonce, apiPublicUrl, isDevelopment }: CspOptions): string {
  const apiOrigin = originOf(apiPublicUrl);
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDevelopment) scriptSrc.push("'unsafe-eval'");
  const connectSrc = apiOrigin === undefined ? ["'self'"] : ["'self'", apiOrigin];
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export interface SecurityHeadersOptions { csp: string; noStore: boolean; hsts: boolean }

/** Cabeceras de seguridad de toda respuesta de la web (RT-015). */
export function buildSecurityHeaders({
  csp,
  noStore,
  hsts,
}: SecurityHeadersOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options': 'DENY',
  };
  if (hsts) headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains';
  if (noStore) headers['Cache-Control'] = 'no-store';
  return headers;
}
