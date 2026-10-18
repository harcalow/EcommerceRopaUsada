import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoA11yViolations } from '../../test/a11y';
import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('mantiene el texto en el árbol de accesibilidad', () => {
    render(<VisuallyHidden>Error: </VisuallyHidden>);
    const el = screen.getByText('Error:');
    expect(el.tagName).toBe('SPAN');
    expect(el.getAttribute('aria-hidden')).toBeNull();
    expect(el.className).not.toBe('');
  });

  it('admite role, aria-live, id, data-testid y clases adicionales', () => {
    const { container } = render(
      <VisuallyHidden role="status" aria-live="polite" id="estado" data-testid="estado" className="extra">
        Cargando
      </VisuallyHidden>,
    );
    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.id).toBe('estado');
    expect(el.dataset.testid).toBe('estado');
    expect(el.className).toContain('extra');
    expect(container.firstElementChild).toBe(el);
  });

  it('no produce violaciones de accesibilidad', async () => {
    const { container } = render(
      <main>
        <h1>Título</h1>
        <p>
          <VisuallyHidden>Aviso: </VisuallyHidden>texto visible
        </p>
        <VisuallyHidden role="status">Cargando</VisuallyHidden>
      </main>,
    );
    await expectNoA11yViolations(container);
  });
});
