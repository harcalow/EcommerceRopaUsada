import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../test/a11y';
import { TextField } from './TextField';

function Controlled({ onValue }: { onValue?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <TextField
      label="Nombre de usuario"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        onValue?.(event.target.value);
      }}
    />
  );
}

describe('TextField', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asocia la etiqueta visible al campo, la etiqueta enfoca el input y no hay violaciones', async () => {
    const user = userEvent.setup();
    const { container } = render(<TextField label="Nombre de usuario" placeholder="ej. admin" data-testid="u" />);
    const input = screen.getByLabelText('Nombre de usuario');
    expect(input.getAttribute('data-testid')).toBe('u');
    expect(input.getAttribute('type')).toBe('text');
    await user.click(screen.getByText('Nombre de usuario'));
    expect(document.activeElement).toBe(input);
    await expectNoA11yViolations(container);
  });

  it('sin error no hay aria-invalid ni aria-describedby, pero la región cortés existe', () => {
    const { container } = render(<TextField label="Usuario" />);
    const input = screen.getByLabelText('Usuario');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('con error: aria-invalid, aria-describedby al mensaje y anunciado en la región cortés', async () => {
    const { container } = render(<TextField label="Usuario" error="Introduce tu usuario" data-testid="u" />);
    const input = screen.getByLabelText('Usuario');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const message = screen.getByText('Introduce tu usuario');
    expect(input.getAttribute('aria-describedby')).toBe(message.id);
    expect(message.closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByTestId('u-error')).toBe(message);
    await expectNoA11yViolations(container);
  });

  it('combina ayuda, error y aria-describedby externo (para PasswordField)', () => {
    render(<TextField label="Clave" help="Mínimo 8" error="Muy corta" aria-describedby="extra" />);
    const input = screen.getByLabelText('Clave');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids[0]).toBe('extra');
    expect(ids).toContain(screen.getByText('Mínimo 8').id);
    expect(ids).toContain(screen.getByText('Muy corta').id);
  });

  it('el valor y onChange funcionan al escribir y al pegar', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    const input = screen.getByLabelText<HTMLInputElement>('Nombre de usuario');
    await user.type(input, 'ab');
    expect(input.value).toBe('ab');
    await user.paste('cd');
    expect(input.value).toBe('abcd');
    expect(onValue).toHaveBeenLastCalledWith('abcd');
  });

  it('pasa name, autoComplete, type y disabled al input', () => {
    render(<TextField label="Usuario" name="username" autoComplete="username" type="email" disabled />);
    const input = screen.getByLabelText<HTMLInputElement>('Usuario');
    expect(input.getAttribute('name')).toBe('username');
    expect(input.getAttribute('autocomplete')).toBe('username');
    expect(input.getAttribute('type')).toBe('email');
    expect(input.disabled).toBe(true);
  });

  it('el icono es decorativo (aria-hidden) y el adorno final se renderiza', () => {
    render(<TextField label="Usuario" icon={<svg data-testid="icon" />} endAdornment={<span data-testid="end" />} />);
    expect(screen.getByTestId('icon').parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('end')).toBeTruthy();
  });

  it('reenvía ref e id propio', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<TextField label="Usuario" id="mi-id" ref={ref} className="extra" />);
    expect(ref.current?.id).toBe('mi-id');
  });

  it('una etiqueta vacía lanza un error en desarrollo', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<TextField label="  " />)).toThrow(/etiqueta/);
  });
});
