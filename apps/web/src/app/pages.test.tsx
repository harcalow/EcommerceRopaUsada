import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Plus_Jakarta_Sans: () => ({ variable: 'font-jakarta-var' }),
  IBM_Plex_Mono: () => ({ variable: 'font-plex-var' }),
}));
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/shared/config/server-env', () => ({
  getServerEnv: () => ({ apiPublicUrl: 'http://localhost:3001' }),
}));

import RootLayout, { metadata, viewport } from './layout';
import NotFound, { metadata as notFoundMetadata } from './not-found';
import HomePage from './page';

describe('app shell', () => {
  it('el layout declara el idioma y envuelve el contenido', async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <p>contenido</p> }));
    expect(html).toContain('<html lang="es" class="font-jakarta-var font-plex-var">');
    expect(html).toContain('<p>contenido</p>');
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(viewport.initialScale).toBe(1);
  });

  it('la raíz redirige al panel', () => {
    expect(() => {
      HomePage();
    }).toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/panel');
  });

  it('not-found ofrece volver al inicio', () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain('Página no encontrada');
    expect(html).toContain('href="/"');
    expect(html).toContain('data-testid="not-found-home"');
    expect(notFoundMetadata.title).toBe('Página no encontrada');
  });
});
