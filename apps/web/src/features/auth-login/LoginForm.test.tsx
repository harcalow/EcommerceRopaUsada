// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../test/a11y';
import { ApiConfigProvider } from '@/shared/api/api-config-provider';

const replace = vi.fn<(path: string) => void>();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

import { LoginForm } from './LoginForm';

const fetchMock = vi.fn<(request: Request) => Promise<Response>>();

function problem(status: number, type: string, extra: Record<string, unknown> = {}): Response {
  const body = { type, title: 'x', status, detail: 'x', correlationId: 'c-1', ...extra };
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/problem+json' } });
}

function sessionOk(): Response {
  return new Response(JSON.stringify({ role: 'admin', expiresAt: '2026-10-16T10:00:00Z' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function renderForm() {
  return render(
    <ApiConfigProvider apiPublicUrl="http://api.test">
      <LoginForm contactEmail="responsable@perchados.test" />
    </ApiConfigProvider>,
  );
}

async function fill(user: ReturnType<typeof userEvent.setup>, username: string, password: string) {
  if (username) await user.type(screen.getByLabelText('Nombre de usuario'), username);
  if (password) await user.type(screen.getByLabelText('Contraseña'), password);
}

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LoginForm: validación', () => {
  it('con los campos vacíos muestra los dos errores junto a cada campo, enfoca el primero y no envía (CA-002)', async () => {
    const user = userEvent.setup({ delay: null });
    renderForm();
    await user.click(screen.getByTestId('login-submit'));

    expect(screen.getByTestId('login-username-error').textContent).toBe('Escribe tu usuario');
    expect(screen.getByTestId('login-password-error').textContent).toBe('Escribe tu contraseña');
    expect(screen.getByLabelText('Nombre de usuario').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre de usuario'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enfoca la contraseña si solo ella tiene error', async () => {
    const user = userEvent.setup({ delay: null });
    renderForm();
    await fill(user, 'lucia', '');
    await user.click(screen.getByTestId('login-submit'));
    expect(screen.queryByTestId('login-username-error')).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Contraseña'));
  });

  it.each(['Harold1', 'Harold_Admin', 'Harold Admin'])('rechaza el usuario «%s» sin enviar (CA-014)', async (name) => {
    const user = userEvent.setup({ delay: null });
    renderForm();
    await fill(user, name, 'contraseña-larga');
    await user.click(screen.getByTestId('login-submit'));
    expect(screen.getByTestId('login-username-error').textContent).toBe('El usuario solo puede tener letras');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña de 7 caracteres sin enviar (CA-015)', async () => {
    const user = userEvent.setup({ delay: null });
    renderForm();
    await fill(user, 'Harold', '1234567');
    await user.click(screen.getByTestId('login-submit'));
    expect(screen.getByTestId('login-password-error').textContent).toBe(
      'La contraseña debe tener al menos 8 caracteres',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('acepta tildes, ñ y mayúsculas en el usuario (CB-014, CB-015, CB-016)', async () => {
    for (const name of ['José', 'Peña', 'HAROLD']) {
      fetchMock.mockResolvedValueOnce(sessionOk());
      const user = userEvent.setup({ delay: null });
      const { unmount } = renderForm();
      await fill(user, name, 'contraseña-larga');
      await user.click(screen.getByTestId('login-submit'));
      expect(screen.queryByTestId('login-username-error')).toBeNull();
      await waitFor(() => {
        expect(replace).toHaveBeenCalled();
      });
      replace.mockReset();
      unmount();
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('borra el error de un campo al editarlo', async () => {
    const user = userEvent.setup({ delay: null });
    renderForm();
    await user.click(screen.getByTestId('login-submit'));
    await user.type(screen.getByLabelText('Nombre de usuario'), 'a');
    expect(screen.queryByTestId('login-username-error')).toBeNull();
    expect(screen.getByTestId('login-password-error')).toBeTruthy();
  });
});

describe('LoginForm: envío', () => {
  it('recorta los espacios del usuario y envía la contraseña tal cual (CB-001) y navega al panel con 200', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValue(sessionOk());
    renderForm();
    await fill(user, '  Harold  ', ' clave segura ');
    await user.click(screen.getByTestId('login-submit'));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/panel');
    });
    const request = fetchMock.mock.calls[0]?.[0];
    expect(request?.url).toBe('http://api.test/v1/auth/login');
    expect(request?.method).toBe('POST');
    expect(request?.credentials).toBe('include');
    expect(await request?.json()).toEqual({ username: 'Harold', password: ' clave segura ' });
  });

  it('401 muestra el mensaje genérico (CA-003) y devuelve el botón a su estado normal', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValue(problem(401, 'auth/invalid-credentials'));
    renderForm();
    await fill(user, 'lucia', 'incorrecta-1');
    await user.click(screen.getByTestId('login-submit'));

    const alert = await screen.findByTestId('login-error');
    expect(alert.textContent).toContain('Usuario o contraseña incorrectos');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('login-submit').getAttribute('aria-busy')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('423 muestra el bloqueo con los minutos restantes (CA-007)', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValue(problem(423, 'auth/account-locked', { lockedMinutesRemaining: 30 }));
    renderForm();
    await fill(user, 'lucia', 'correcta-123');
    await user.click(screen.getByTestId('login-submit'));
    expect((await screen.findByTestId('login-error')).textContent).toContain(
      'Demasiados intentos. Vuelve a intentarlo en 30 minutos',
    );
  });

  it('423 con un minuto usa el singular y sin dato usa 30 minutos', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValueOnce(problem(423, 'auth/account-locked', { lockedMinutesRemaining: 1 }));
    renderForm();
    await fill(user, 'lucia', 'correcta-123');
    await user.click(screen.getByTestId('login-submit'));
    expect((await screen.findByTestId('login-error')).textContent).toContain('en 1 minuto');

    fetchMock.mockResolvedValueOnce(problem(423, 'auth/account-locked'));
    await user.click(screen.getByTestId('login-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('login-error').textContent).toContain('en 30 minutos');
    });
  });

  it('429 muestra el mensaje de límite de peticiones', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValue(problem(429, 'rate-limit-exceeded'));
    renderForm();
    await fill(user, 'lucia', 'correcta-123');
    await user.click(screen.getByTestId('login-submit'));
    expect((await screen.findByTestId('login-error')).textContent).toContain(
      'Demasiados intentos desde este equipo. Espera un momento y vuelve a intentarlo',
    );
  });

  it.each([500, 400, 403])('%i muestra el error inesperado', async (status) => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValue(problem(status, 'internal-error'));
    renderForm();
    await fill(user, 'lucia', 'correcta-123');
    await user.click(screen.getByTestId('login-submit'));
    expect((await screen.findByTestId('login-error')).textContent).toContain(
      'No pudimos verificar tus datos. Inténtalo de nuevo en unos minutos',
    );
  });

  it('un fallo de red muestra «No hay conexión» y conserva lo escrito (CB-007)', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderForm();
    await fill(user, 'lucia', 'correcta-123');
    await user.click(screen.getByTestId('login-submit'));

    expect((await screen.findByTestId('login-error')).textContent).toContain('No hay conexión, inténtalo de nuevo');
    expect((screen.getByLabelText<HTMLInputElement>('Nombre de usuario')).value).toBe('lucia');
    expect((screen.getByLabelText<HTMLInputElement>('Contraseña')).value).toBe('correcta-123');
    expect(replace).not.toHaveBeenCalled();
  });

  it('un nuevo envío limpia el error anterior', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValueOnce(problem(401, 'auth/invalid-credentials'));
    fetchMock.mockResolvedValueOnce(sessionOk());
    renderForm();
    await fill(user, 'lucia', 'correcta-123');
    await user.click(screen.getByTestId('login-submit'));
    await screen.findByTestId('login-error');
    await user.click(screen.getByTestId('login-submit'));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/panel');
    });
    expect(screen.queryByTestId('login-error')).toBeNull();
  });

  it('el doble clic envía una sola vez y el botón queda en carga (CA-013)', async () => {
    const user = userEvent.setup({ delay: null });
    let resolve: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    renderForm();
    await fill(user, 'lucia', 'correcta-123');
    const submit = screen.getByTestId('login-submit');
    await user.dblClick(submit);
    fireEvent.submit(screen.getByTestId('login-form'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(submit.getAttribute('aria-busy')).toBe('true');
    resolve(problem(401, 'auth/invalid-credentials'));
    await screen.findByTestId('login-error');
    expect(submit.getAttribute('aria-busy')).toBeNull();
  });
});

describe('LoginForm: Bloq Mayús', () => {
  it('muestra el aviso aunque estuviera activo antes de enfocar y lo quita al desactivarlo (CA-005, CB-009)', () => {
    renderForm();
    const field = screen.getByLabelText('Contraseña');
    fireEvent.keyDown(field, { key: 'A', modifierCapsLock: true });
    expect(screen.getByTestId('login-password-notice').textContent).toBe('Bloq Mayús está activado');
    expect(field.getAttribute('aria-describedby')).toContain('-notice');

    fireEvent.keyUp(field, { key: 'CapsLock', modifierCapsLock: false });
    expect(screen.queryByTestId('login-password-notice')).toBeNull();
  });

  it('oculta el aviso al salir del campo', () => {
    renderForm();
    const field = screen.getByLabelText('Contraseña');
    fireEvent.keyUp(field, { key: 'a', modifierCapsLock: true });
    expect(screen.getByTestId('login-password-notice')).toBeTruthy();
    fireEvent.blur(field);
    expect(screen.queryByTestId('login-password-notice')).toBeNull();
  });
});

describe('LoginForm: accesibilidad', () => {
  it('no tiene violaciones de axe en reposo ni con errores', async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = renderForm();
    await expectNoA11yViolations(container);
    await user.click(screen.getByTestId('login-submit'));
    await expectNoA11yViolations(container);
  });

  it('el error general se anuncia con role alert y el formulario tiene nombre', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValue(problem(401, 'auth/invalid-credentials'));
    const { container } = renderForm();
    expect(screen.getByRole('form', { name: 'Acceso de administrador' })).toBeTruthy();
    await fill(user, 'lucia', 'incorrecta-1');
    await user.click(screen.getByTestId('login-submit'));
    await screen.findByRole('alert');
    await expectNoA11yViolations(container);
  });

  it('se envía con Enter desde un campo', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValue(sessionOk());
    renderForm();
    await fill(user, 'lucia', 'correcta-123');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/panel');
    });
  });
});

describe('LoginForm: ¿Olvidaste tu contraseña? (RF-007)', () => {
  it('muestra el correo del responsable sin enviar el formulario', async () => {
    const user = userEvent.setup({ delay: null });
    renderForm();
    await user.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    expect(screen.getByRole('link', { name: 'responsable@perchados.test' }).getAttribute('href')).toBe(
      'mailto:responsable@perchados.test',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Nombre de usuario es obligatorio')).toBeNull();
  });
});
