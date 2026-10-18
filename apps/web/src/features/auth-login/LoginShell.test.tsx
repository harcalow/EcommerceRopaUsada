// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { expectNoA11yViolations } from '../../../test/a11y';
import { LoginShell } from './LoginShell';

afterEach(cleanup);

const CSS_DIR = join(process.cwd(), 'src', 'features', 'auth-login');

const FORBIDDEN_TEXT = [
  /crear cuenta/i,
  /registrarse|regístrate/i,
  /perchados2026/i,
  /HaroldAdmin/i,
  /Prueba el prototipo/i,
  /Recordar mi usuario/i,
  /admin \/ /i,
];

describe('LoginShell', () => {
  it('tiene un único h1, un main y el panel de marca como aside', () => {
    render(<LoginShell />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Hola de nuevo' })).toBeTruthy();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('complementary', { name: 'Perchados' })).toBeTruthy();
  });

  it('muestra los textos del diseño', () => {
    render(<LoginShell />);
    expect(screen.getByText('Acceso de administrador')).toBeTruthy();
    expect(screen.getByText('Inicia sesión con tu usuario y contraseña de administrador.')).toBeTruthy();
    expect(screen.getByText('Panel de administración')).toBeTruthy();
    expect(screen.getByText('Cada prenda merece una segunda vida.')).toBeTruthy();
    expect(screen.getByText(/Revisa, publica y vende ropa usada de buena calidad/)).toBeTruthy();
    for (const label of ['Como nueva', 'Vintage', 'Muy buen estado', 'Revisada', 'Como nuevo']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('informa de que solo permite iniciar sesión (RF-021)', () => {
    render(<LoginShell />);
    const note = screen.getByTestId('login-info-note');
    expect(note.textContent).toContain('Esta pantalla solo permite iniciar sesión.');
    expect(note.textContent).toContain('Las cuentas de administrador se crean fuera del panel');
  });

  it('no ofrece registro, credenciales de prueba ni «Recordar mi usuario» (CA-009, RF-010, RF-022)', () => {
    const { container } = render(<LoginShell />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    const text = container.textContent;
    for (const forbidden of FORBIDDEN_TEXT) {
      expect(text).not.toMatch(forbidden);
    }
  });

  it('las imágenes del mosaico son decorativas con tamaño declarado', () => {
    const { container } = render(<LoginShell />);
    const images = container.querySelectorAll('img');
    expect(images.length).toBe(6);
    for (const img of images) {
      expect(img.getAttribute('alt')).toBe('');
      expect(img.getAttribute('width')).toBeTruthy();
      expect(img.getAttribute('height')).toBeTruthy();
    }
    expect(within(screen.getByTestId('brand-mosaic')).getAllByRole('listitem')).toHaveLength(5);
  });

  it('el formulario va antes del panel de marca en el DOM (mobile-first)', () => {
    render(<LoginShell />);
    const main = screen.getByRole('main');
    const aside = screen.getByRole('complementary');
    expect(main.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('aloja el formulario entre el encabezado y el pie', () => {
    render(
      <LoginShell>
        <form aria-label="Entrar" data-testid="slot" />
      </LoginShell>,
    );
    expect(within(screen.getByRole('main')).getByTestId('slot')).toBeTruthy();
  });

  it('no tiene violaciones de accesibilidad (axe)', async () => {
    const { container } = render(<LoginShell />);
    await expectNoA11yViolations(container);
  });

  it('el CSS oculta el mosaico por debajo de 600 px y pasa a dos columnas desde 960 px', () => {
    const showcase = readFileSync(join(CSS_DIR, 'BrandShowcase.module.css'), 'utf8');
    expect(showcase).toMatch(/\.mosaic\s*\{\s*display:\s*none/);
    expect(showcase).toMatch(/@media \(min-width: 600px\)\s*\{\s*\.mosaic\s*\{\s*display:\s*grid/);
    const shell = readFileSync(join(CSS_DIR, 'LoginShell.module.css'), 'utf8');
    expect(shell).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(shell).toMatch(/@media \(min-width: 960px\)\s*\{\s*\.root\s*\{\s*grid-template-columns:\s*repeat\(2/);
  });
});
