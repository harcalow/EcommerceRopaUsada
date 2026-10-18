import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../test/a11y';
import { readCss } from '../test/read-css';
import { Link } from './Link';

const css = readCss('Link/Link.module.css');

function FakeRouterLink({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a {...props} data-router="true">
      {children}
    </a>
  );
}

describe('Link', () => {
  it('es un enlace con nombre accesible, href y data-testid, sin violaciones', async () => {
    const { container } = render(
      <Link href="/login" data-testid="lnk">
        Ir al acceso
      </Link>,
    );
    const link = screen.getByRole('link', { name: 'Ir al acceso' });
    expect(link.getAttribute('href')).toBe('/login');
    expect(link.getAttribute('data-testid')).toBe('lnk');
    expect(link.getAttribute('target')).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('mailto: usa un <a> nativo aunque haya linkComponent', async () => {
    const { container } = render(
      <Link href="mailto:tienda@example.com" linkComponent={FakeRouterLink}>
        tienda@example.com
      </Link>,
    );
    const link = screen.getByRole('link', { name: 'tienda@example.com' });
    expect(link.getAttribute('href')).toBe('mailto:tienda@example.com');
    expect(link.getAttribute('data-router')).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('las rutas internas usan el linkComponent recibido', () => {
    render(
      <Link href="/panel" linkComponent={FakeRouterLink}>
        Panel
      </Link>,
    );
    expect(screen.getByRole('link', { name: 'Panel' }).getAttribute('data-router')).toBe('true');
  });

  it('external fuerza el <a> nativo y rutas con esquema o // se tratan como externas', () => {
    render(
      <>
        <Link href="/x" external linkComponent={FakeRouterLink}>
          Forzado
        </Link>
        <Link href="https://example.com" linkComponent={FakeRouterLink}>
          Absoluto
        </Link>
        <Link href="//example.com" linkComponent={FakeRouterLink}>
          Relativo al protocolo
        </Link>
      </>,
    );
    for (const name of ['Forzado', 'Absoluto', 'Relativo al protocolo']) {
      expect(screen.getByRole('link', { name }).getAttribute('data-router')).toBeNull();
    }
  });

  it('newTab añade target, rel seguro y un anuncio para lectores de pantalla', async () => {
    const { container } = render(
      <Link href="https://example.com" newTab>
        Ayuda
      </Link>,
    );
    const link = screen.getByRole('link', { name: 'Ayuda (se abre en una pestaña nueva)' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    await expectNoA11yViolations(container);
  });

  it('respeta newTabLabel, className y reenvía ref y clics', async () => {
    const onClick = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault();
    });
    const ref = { current: null as HTMLAnchorElement | null };
    render(
      <Link href="#a" newTab newTabLabel="(nueva pestaña)" className="extra" onClick={onClick} ref={ref}>
        Ver
      </Link>,
    );
    const link = screen.getByRole('link', { name: 'Ver (nueva pestaña)' });
    expect(link.className).toContain('extra');
    expect(ref.current).toBe(link);
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('se alcanza con el teclado', async () => {
    render(<Link href="/a">Uno</Link>);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Uno' }));
  });

  it('el estilo subraya siempre, no solo por color, y no quita el contorno de foco', () => {
    expect(css).toMatch(/text-decoration:\s*underline/);
    expect(css).toMatch(/min-height:\s*1\.5rem/);
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });
});
