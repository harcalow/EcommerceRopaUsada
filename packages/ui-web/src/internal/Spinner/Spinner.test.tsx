import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoA11yViolations } from '../../test/a11y';
import { readCss } from '../../test/read-css';
import { VisuallyHidden } from '../VisuallyHidden';
import { Spinner } from './Spinner';

const css = readCss('internal/Spinner/Spinner.module.css');

describe('Spinner', () => {
  it('es decorativo: oculto para lectores de pantalla y no enfocable', () => {
    const { container } = render(<Spinner data-testid="spinner" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hereda el color del texto y admite clases adicionales', () => {
    const { container } = render(<Spinner className="extra" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('extra');
    expect(container.querySelector('[stroke="currentColor"]')).not.toBeNull();
  });

  it('con prefers-reduced-motion sustituye el giro por un pulso lento', () => {
    expect(css).toMatch(/animation:\s*spin/);
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\{[^}]*animation:\s*pulse[^}]*\}/.exec(css);
    expect(reduced).not.toBeNull();
  });

  it('junto a una región de estado oculta, la carga se anuncia sin violaciones de accesibilidad', async () => {
    const { container } = render(
      <div>
        <Spinner />
        <VisuallyHidden role="status">Iniciando sesión</VisuallyHidden>
      </div>,
    );
    expect(screen.getByRole('status').textContent).toBe('Iniciando sesión');
    await expectNoA11yViolations(container);
  });
});
