import { describe, expect, it } from 'vitest';

import {
  buildCsp,
  buildSecurityHeaders,
  generateNonce,
  hasSessionCookie,
} from '@/shared/security/headers';

const jar = (...names: string[]) => ({ has: (name: string) => names.includes(name) });

describe('hasSessionCookie', () => {
  it('acepta perchados_sid y la variante con prefijo __Secure-', () => {
    expect(hasSessionCookie(jar('perchados_sid'))).toBe(true);
    expect(hasSessionCookie(jar('__Secure-perchados_sid'))).toBe(true);
  });

  it('rechaza su ausencia y otras cookies (la de CSRF no cuenta)', () => {
    expect(hasSessionCookie(jar())).toBe(false);
    expect(hasSessionCookie(jar('perchados_csrf', 'otra'))).toBe(false);
  });
});

describe('generateNonce', () => {
  it('es distinto en cada llamada', () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });
});

describe('buildCsp', () => {
  const base = { nonce: 'abc', apiPublicUrl: 'http://localhost:3001/v1', isDevelopment: false };

  it('fija las directivas del diseño con el nonce', () => {
    const csp = buildCsp(base);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('incluye solo el origen de API_PUBLIC_URL en connect-src', () => {
    expect(buildCsp(base)).toContain("connect-src 'self' http://localhost:3001;");
  });

  it('sin API_PUBLIC_URL válida deja connect-src en self', () => {
    expect(buildCsp({ ...base, apiPublicUrl: undefined })).toContain("connect-src 'self';");
    expect(buildCsp({ ...base, apiPublicUrl: 'no es una url' })).toContain("connect-src 'self';");
    expect(buildCsp({ ...base, apiPublicUrl: '' })).toContain("connect-src 'self';");
  });

  it('unsafe-eval solo en desarrollo', () => {
    expect(buildCsp(base)).not.toContain('unsafe-eval');
    expect(buildCsp({ ...base, isDevelopment: true })).toContain("'unsafe-eval'");
  });
});

describe('buildSecurityHeaders', () => {
  it('incluye las cabeceras comunes', () => {
    const headers = buildSecurityHeaders({ csp: 'x', noStore: false, hsts: false });
    expect(headers).toMatchObject({
      'Content-Security-Policy': 'x',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'X-Frame-Options': 'DENY',
    });
    expect(headers).not.toHaveProperty('Strict-Transport-Security');
    expect(headers).not.toHaveProperty('Cache-Control');
  });

  it('añade HSTS y no-store cuando se piden', () => {
    const headers = buildSecurityHeaders({ csp: 'x', noStore: true, hsts: true });
    expect(headers['Strict-Transport-Security']).toContain('max-age=');
    expect(headers['Cache-Control']).toBe('no-store');
  });
});
