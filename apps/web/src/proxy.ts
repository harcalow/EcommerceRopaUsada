import { NextResponse, type NextRequest } from 'next/server';

import { PANEL_PATH } from '@/shared/auth/auth-constants';
import { LOGIN_PATH } from '@/shared/auth/login-paths';
import { buildCsp, buildSecurityHeaders, generateNonce, hasSessionCookie } from '@/shared/security/headers';

const PANEL_PREFIX = PANEL_PATH;

function isPanelPath(pathname: string): boolean {
  return pathname === PANEL_PREFIX || pathname.startsWith(`${PANEL_PREFIX}/`);
}

/**
 * Barrera de experiencia y cabeceras de seguridad (RF-011, RT-015, ADR-007).
 * La autorización real la hace la API en cada petición y `requireAdminSession()` en el panel.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const panel = isPanelPath(pathname);
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    apiPublicUrl: process.env.API_PUBLIC_URL,
    isDevelopment: process.env.NODE_ENV === 'development',
  });

  // Next.js lee la CSP de la petición para añadir el nonce a sus scripts
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response =
    panel && !hasSessionCookie(request.cookies)
      ? NextResponse.redirect(new URL(LOGIN_PATH, request.url))
      : NextResponse.next({ request: { headers: requestHeaders } });

  const headers = buildSecurityHeaders({
    csp,
    noStore: panel,
    hsts: process.env.APP_ENV === 'production',
  });
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Fuera: /healthz, los recursos de Next y los archivos estáticos (con extensión)
  matcher: ['/((?!healthz|_next/static|_next/image|favicon\\.ico|brand/).*)'],
};
