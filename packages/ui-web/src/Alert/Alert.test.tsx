import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoA11yViolations } from '../test/a11y';
import { readCss } from '../test/read-css';
import { Alert } from './Alert';
import type { AlertVariant } from './Alert';

const css = readCss('Alert/Alert.module.css');

const CASES: readonly (readonly [AlertVariant, 'alert' | 'status', string])[] = [
  ['error', 'alert', 'Error: '],
  ['warning', 'alert', 'Aviso: '],
  ['info', 'status', 'Información: '],
  ['success', 'status', 'Éxito: '],
];

describe('Alert', () => {
  it.each(CASES)('variante %s: rol %s, prefijo oculto y sin violaciones', async (variant, role, prefix) => {
    const { container } = render(
      <Alert variant={variant} data-testid="alert">
        Usuario o contraseña incorrectos
      </Alert>,
    );
    const alert = screen.getByRole(role);
    expect(alert.getAttribute('data-testid')).toBe('alert');
    expect(alert.className).toContain(variant);
    expect(alert.textContent).toBe(`${prefix}Usuario o contraseña incorrectos`);
    expect(screen.getByText(prefix.trim(), { exact: false }).textContent).toBe(prefix);
    await expectNoA11yViolations(container);
  });

  it('el icono es decorativo (aria-hidden) y no se expone como imagen', () => {
    const { container } = render(<Alert variant="info">Aviso</Alert>);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('muestra el título opcional junto al mensaje', async () => {
    const { container } = render(
      <Alert variant="warning" title="Bloq Mayús activado">
        Revisa las mayúsculas.
      </Alert>,
    );
    expect(screen.getByText('Bloq Mayús activado')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Revisa las mayúsculas.');
    await expectNoA11yViolations(container);
  });

  it('admite className y admite contenido enriquecido', () => {
    render(
      <Alert variant="info" className="extra">
        Escribe a <a href="mailto:tienda@example.com">tienda@example.com</a>
      </Alert>,
    );
    expect(screen.getByRole('status').className).toContain('extra');
    expect(screen.getByRole('link', { name: 'tienda@example.com' })).toBeTruthy();
  });

  it('al cambiar el contenido el rol se mantiene y el nuevo texto queda en la región', () => {
    const { rerender } = render(<Alert variant="error">Primer mensaje</Alert>);
    rerender(<Alert variant="error">Segundo mensaje</Alert>);
    expect(screen.getByRole('alert').textContent).toBe('Error: Segundo mensaje');
  });

  it('aparece en el DOM con su rol al montarse (se anuncia al aparecer)', () => {
    const { rerender } = render(<div />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<Alert variant="error">Tu sesión ha caducado. Vuelve a iniciar sesión</Alert>);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('las variantes usan tokens de color, sin colores literales', () => {
    for (const token of ['error', 'success', 'warning', 'primary']) {
      expect(css).toContain(`var(--color-${token}`);
    }
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).toContain('var(--color-ink)');
  });
});
