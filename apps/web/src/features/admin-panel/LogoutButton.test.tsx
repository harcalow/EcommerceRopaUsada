// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../test/a11y';
import { ApiConfigProvider } from '@/shared/api/api-config-provider';

const navigateToLogin = vi.fn<() => void>();
vi.mock('@/shared/auth/navigate-to-login', () => ({ navigateToLogin: (): void => { navigateToLogin(); } }));

import { LogoutButton } from './LogoutButton';

const fetchMock = vi.fn<(request: Request) => Promise<Response>>();

function renderButton() {
  return render(
    <ApiConfigProvider apiPublicUrl="http://api.test">
      <LogoutButton />
    </ApiConfigProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  navigateToLogin.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  document.cookie = 'perchados_csrf=csrf-123';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = 'perchados_csrf=; max-age=0';
});

describe('LogoutButton', () => {
  it('envía el token CSRF, muestra la carga y tras 204 navega al login (CA-011)', async () => {
    let finish: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup({ delay: null });
    renderButton();

    await user.click(screen.getByTestId('logout-button'));
    expect(screen.getByTestId('logout-button').getAttribute('aria-busy')).toBe('true');
    finish(new Response(null, { status: 204 }));

    await waitFor(() => { expect(navigateToLogin).toHaveBeenCalledTimes(1); });
    const request = fetchMock.mock.calls[0]?.[0];
    expect(request?.url).toBe('http://api.test/v1/auth/logout');
    expect(request?.method).toBe('POST');
    expect(request?.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(request?.credentials).toBe('include');
  });

  it('un 401 también cierra (idempotente) y navega al login', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    renderButton();
    await userEvent.setup({ delay: null }).click(screen.getByTestId('logout-button'));
    await waitFor(() => { expect(navigateToLogin).toHaveBeenCalledTimes(1); });
  });

  it('sin cookie CSRF envía la petición sin cabecera', async () => {
    document.cookie = 'perchados_csrf=; max-age=0';
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    renderButton();
    await userEvent.setup({ delay: null }).click(screen.getByTestId('logout-button'));
    await waitFor(() => { expect(navigateToLogin).toHaveBeenCalled(); });
    expect(fetchMock.mock.calls[0]?.[0].headers.has('X-CSRF-Token')).toBe(false);
  });

  it('un 403 muestra el error, no navega y permite reintentar', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const user = userEvent.setup({ delay: null });
    const { container } = renderButton();
    await user.click(screen.getByTestId('logout-button'));

    const alert = await screen.findByTestId('logout-error');
    expect(alert.textContent).toContain('No pudimos cerrar la sesión. Inténtalo de nuevo');
    expect(navigateToLogin).not.toHaveBeenCalled();
    expect(screen.getByTestId('logout-button').getAttribute('aria-busy')).not.toBe('true');
    await expectNoA11yViolations(container);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await user.click(screen.getByTestId('logout-button'));
    await waitFor(() => { expect(navigateToLogin).toHaveBeenCalledTimes(1); });
    expect(screen.queryByTestId('logout-error')).toBeNull();
  });

  it('un fallo de red muestra el error', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    renderButton();
    await userEvent.setup({ delay: null }).click(screen.getByTestId('logout-button'));
    expect(await screen.findByTestId('logout-error')).toBeTruthy();
    expect(navigateToLogin).not.toHaveBeenCalled();
  });

  it('ignora clics repetidos mientras envía', async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
    const user = userEvent.setup({ delay: null });
    renderButton();
    await user.click(screen.getByTestId('logout-button'));
    await user.click(screen.getByTestId('logout-button'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
