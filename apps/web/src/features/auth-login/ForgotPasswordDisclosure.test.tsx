// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../test/a11y';
import { ForgotPasswordDisclosure } from './ForgotPasswordDisclosure';

afterEach(cleanup);

const EMAIL = 'responsable@perchados.test';

function toggle() {
  return screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' });
}

describe('ForgotPasswordDisclosure (RF-007, CA-006)', () => {
  it('empieza contraído y anuncia el estado expandido al abrirlo y cerrarlo', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ForgotPasswordDisclosure contactEmail={EMAIL} />);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('login-forgot-panel')).toBeNull();
    await user.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    await user.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('login-forgot-panel')).toBeNull();
  });

  it('se opera con Enter y Espacio, y aria-controls apunta al panel', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ForgotPasswordDisclosure contactEmail={EMAIL} />);
    await user.tab();
    expect(document.activeElement).toBe(toggle());
    await user.keyboard('{Enter}');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    await user.keyboard(' ');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle().getAttribute('aria-controls') ?? '')).not.toBeNull();
  });

  it('al abrirlo muestra el texto y el correo como enlace mailto', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ForgotPasswordDisclosure contactEmail={EMAIL} />);
    await user.click(toggle());
    const panel = screen.getByTestId('login-forgot-panel');
    expect(panel.textContent).toContain('Escribe al responsable de la tienda a');
    const link = screen.getByRole('link', { name: EMAIL });
    expect(link.getAttribute('href')).toBe(`mailto:${EMAIL}`);
  });

  it('no pide correo ni envía nada', async () => {
    const user = userEvent.setup({ delay: null });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ForgotPasswordDisclosure contactEmail={EMAIL} />);
    await user.click(toggle());
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.querySelector('form, input')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('no es un botón de envío: no interfiere con el formulario', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <ForgotPasswordDisclosure contactEmail={EMAIL} />
      </form>,
    );
    expect(toggle().getAttribute('type')).toBe('button');
    await user.click(toggle());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('no tiene violaciones de accesibilidad abierto ni cerrado', async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<ForgotPasswordDisclosure contactEmail={EMAIL} />);
    await expectNoA11yViolations(container);
    await user.click(toggle());
    await expectNoA11yViolations(container);
  });

  it('el correo no se expone con una variable pública del cliente', () => {
    const source = ['page.tsx'].map((file) => readFileSync(join(process.cwd(), 'src', 'app', 'login', file), 'utf8'));
    expect(source.join('')).toContain('getServerEnv().adminContactEmail');
    const component = readFileSync(join(process.cwd(), 'src', 'features', 'auth-login', 'ForgotPasswordDisclosure.tsx'), 'utf8');
    expect(component).not.toMatch(/NEXT_PUBLIC|process\.env/);
  });
});
