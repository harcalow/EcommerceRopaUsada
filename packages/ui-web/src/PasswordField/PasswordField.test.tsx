import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../test/a11y';
import { PasswordField } from './PasswordField';

/** Imita la detección de Bloq Mayús que hará `LoginForm` (RF-006) sobre `keydown` y `keyup`. */
function WithCapsLock() {
  const [caps, setCaps] = useState(false);
  const read = (event: SyntheticEvent<HTMLInputElement>) => {
    const native = event.nativeEvent;
    if (native instanceof KeyboardEvent) setCaps(native.getModifierState('CapsLock'));
  };
  return (
    <PasswordField
      label="Contraseña"
      data-testid="pw"
      {...(caps ? { notice: 'Bloq Mayús está activado' } : {})}
      onKeyDown={read}
      onKeyUp={read}
    />
  );
}

describe('PasswordField', () => {
  it('está oculta por defecto, con autocomplete correcto, icono decorativo y sin violaciones', async () => {
    const { container } = render(<PasswordField label="Contraseña" placeholder="Tu contraseña" data-testid="pw" />);
    const input = screen.getByLabelText('Contraseña');
    expect(input.getAttribute('type')).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('current-password');
    expect(container.querySelector('svg')?.closest('[aria-hidden="true"]')).not.toBeNull();
    await expectNoA11yViolations(container);
  });

  it('respeta un autocomplete recibido', () => {
    render(<PasswordField label="Contraseña" autoComplete="new-password" />);
    expect(screen.getByLabelText('Contraseña').getAttribute('autocomplete')).toBe('new-password');
  });

  it('Mostrar la hace legible y Ocultar la enmascara, anunciando el estado y conservando el valor', async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordField label="Contraseña" data-testid="pw" />);
    const input = screen.getByLabelText<HTMLInputElement>('Contraseña');
    await user.type(input, 'secreto');

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input.getAttribute('type')).toBe('text');
    expect(input.value).toBe('secreto');
    expect(screen.getByRole('status').textContent).toBe('Contraseña visible');
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input.getAttribute('type')).toBe('password');
    expect(input.value).toBe('secreto');
    expect(screen.getByRole('status').textContent).toBe('Contraseña oculta');
  });

  it('el conmutador es un botón que no envía el formulario, se opera con teclado y conserva el foco', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: SyntheticEvent) => { event.preventDefault(); });
    render(
      <form onSubmit={onSubmit}>
        <PasswordField label="Contraseña" data-testid="pw" />
      </form>,
    );
    const toggle = screen.getByTestId('pw-toggle');
    expect(toggle.getAttribute('type')).toBe('button');
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('text');
    await user.keyboard(' ');
    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('password');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(toggle);
  });

  it('permite pegar y acepta el valor de un gestor de contraseñas (CB-008)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordField label="Contraseña" onChange={onChange} />);
    const input = screen.getByLabelText<HTMLInputElement>('Contraseña');
    await user.click(input);
    await user.paste('Clave-Larga-Pegada-1!');
    expect(input.value).toBe('Clave-Larga-Pegada-1!');
    expect(onChange).toHaveBeenCalled();
  });

  it('el aviso de Bloq Mayús aparece al escribir con la tecla activa y desaparece al desactivarla (CB-009)', () => {
    render(<WithCapsLock />);
    const input = screen.getByLabelText('Contraseña');
    expect(screen.queryByText('Bloq Mayús está activado')).toBeNull();

    fireEvent.keyDown(input, { key: 'A', modifierCapsLock: true });
    const notice = screen.getByText('Bloq Mayús está activado');
    expect(notice.closest('[aria-live="polite"]')).not.toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe(notice.id);

    fireEvent.keyUp(input, { key: 'CapsLock', modifierCapsLock: false });
    expect(screen.queryByText('Bloq Mayús está activado')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('notice y error conviven en aria-describedby junto al valor externo, sin violaciones', async () => {
    const { container } = render(
      <PasswordField
        label="Contraseña"
        aria-describedby="externo"
        notice="Bloq Mayús está activado"
        error="Introduce tu contraseña"
        data-testid="pw"
      />,
    );
    const input = screen.getByLabelText('Contraseña');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids[0]).toBe('externo');
    expect(ids).toContain(screen.getByTestId('pw-notice').id);
    expect(ids).toContain(screen.getByTestId('pw-error').id);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await expectNoA11yViolations(container);
  });

  it('un icono propio sustituye al candado y sin testid no se generan testids derivados', () => {
    render(<PasswordField label="Contraseña" icon={<span data-testid="mi-icono" />} />);
    expect(screen.getByTestId('mi-icono')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' }).getAttribute('data-testid')).toBeNull();
  });
});
