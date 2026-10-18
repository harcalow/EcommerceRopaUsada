import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { config, proxy } from '@/proxy';

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

beforeEach(() => {
  vi.stubEnv('API_PUBLIC_URL', 'http://localhost:3001');
  vi.stubEnv('APP_ENV', 'development');
});
afterEach(() => vi.unstubAllEnvs());

describe('proxy: cabeceras', () => {
  it('cada respuesta lleva la CSP con un nonce distinto por petición', () => {
    const first = proxy(request('/')).headers.get('content-security-policy');
    const second = proxy(request('/')).headers.get('content-security-policy');
    const nonce = (csp: string | null) => /'nonce-([^']+)'/.exec(csp ?? '')?.[1];
    expect(nonce(first)).toBeTruthy();
    expect(nonce(first)).not.toBe(nonce(second));
  });

  it('connect-src incluye API_PUBLIC_URL y frame-ancestors es none', () => {
    const csp = proxy(request('/')).headers.get('content-security-policy');
    expect(csp).toContain("connect-src 'self' http://localhost:3001");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('añade el resto de cabeceras de seguridad', () => {
    const { headers } = proxy(request('/'));
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers.get('x-frame-options')).toBe('DENY');
  });

  it('HSTS solo en producción', () => {
    expect(proxy(request('/')).headers.get('strict-transport-security')).toBeNull();
    vi.stubEnv('APP_ENV', 'production');
    expect(proxy(request('/')).headers.get('strict-transport-security')).toContain('max-age=');
  });

  it('reenvía el nonce y la CSP a Next.js en la petición', () => {
    const { headers } = proxy(request('/'));
    const overridden = headers.get('x-middleware-override-headers') ?? '';
    expect(overridden).toContain('x-nonce');
    expect(overridden).toContain('content-security-policy');
  });
});

describe('proxy: /panel', () => {
  it.each(['/panel', '/panel/x'])('%s sin cookie redirige a /login con no-store', (path) => {
    const response = proxy(request(path));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/login');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toContain('nonce-');
  });

  it('/panel/x.json sin cookie también redirige y lleva cabeceras de seguridad', () => {
    const response = proxy(request('/panel/x.json'));
    expect(response.status).toBe(307);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it.each(['perchados_sid=abc', '__Secure-perchados_sid=abc'])('con %s deja pasar', (cookie) => {
    const response = proxy(request('/panel/x', cookie));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('la cookie de CSRF sola no cuenta como sesión', () => {
    expect(proxy(request('/panel', 'perchados_csrf=abc')).status).toBe(307);
  });

  it('otras rutas no llevan no-store ni se redirigen', () => {
    const response = proxy(request('/login'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBeNull();
  });

  it('/panelx no se trata como /panel', () => {
    expect(proxy(request('/panelx')).status).toBe(200);
  });
});

describe('proxy: matcher', () => {
  const pattern = config.matcher[0] ?? '';
  const matches = (path: string) => new RegExp(`^${pattern}$`).test(path);

  it('incluye páginas y el panel', () => {
    for (const path of ['/', '/login', '/panel', '/panel/x']) expect(matches(path)).toBe(true);
  });

  it('excluye /healthz, los estáticos de Next, el favicon y /brand', () => {
    for (const path of ['/healthz', '/_next/static/a.js', '/_next/image', '/favicon.ico', '/brand/logo.svg']) {
      expect(matches(path)).toBe(false);
    }
  });

  it('no excluye rutas con extensión fuera de los estáticos conocidos', () => {
    for (const path of ['/panel/x.json', '/login.php', '/otra/archivo.svg']) expect(matches(path)).toBe(true);
  });
});
