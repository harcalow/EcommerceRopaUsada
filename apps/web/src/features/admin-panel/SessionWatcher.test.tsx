// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiConfigProvider } from '@/shared/api/api-config-provider';

const navigateToLogin = vi.fn<(options?: { sessionExpired?: boolean }) => void>();
vi.mock('@/shared/auth/navigate-to-login', () => ({
  navigateToLogin: (options?: { sessionExpired?: boolean }) => { navigateToLogin(options); },
}));

import { SessionWatcher } from './SessionWatcher';

const fetchMock = vi.fn<(request: Request) => Promise<Response>>();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function mount() {
  return render(
    <ApiConfigProvider apiPublicUrl="http://api.test">
      <SessionWatcher />
    </ApiConfigProvider>,
  );
}

function pageShow(persisted: boolean) {
  window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  fetchMock.mockReset();
  navigateToLogin.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SessionWatcher', () => {
  it('no consulta nada al montar', () => {
    mount();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('en pageshow desde bfcache con 401 lleva al login (CA-011, CB-018)', async () => {
    fetchMock.mockResolvedValue(json(401, { type: 'auth/unauthenticated' }));
    mount();
    pageShow(true);
    await waitFor(() => { expect(navigateToLogin).toHaveBeenCalledWith({ sessionExpired: false }); });
    expect(fetchMock.mock.calls[0]?.[0].url).toBe('http://api.test/v1/auth/session');
  });

  it('un pageshow que no viene de bfcache no consulta', () => {
    mount();
    pageShow(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('al volver a la pestaña con la sesión caducada lleva al login con aviso (CB-017)', async () => {
    fetchMock.mockResolvedValue(json(401, { type: 'auth/session-expired' }));
    mount();
    setVisibility('visible');
    await waitFor(() => { expect(navigateToLogin).toHaveBeenCalledWith({ sessionExpired: true }); });
  });

  it('al ocultar la pestaña no consulta', () => {
    mount();
    setVisibility('hidden');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con sesión válida de administrador no navega', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(200, { role: 'admin', expiresAt: '2026-10-16T10:00:00Z' })));
    mount();
    setVisibility('visible');
    await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); });
    await Promise.resolve();
    expect(navigateToLogin).not.toHaveBeenCalled();
  });

  it('con una sesión de otro rol (cuenta cambiada, CB-012) lleva al login', async () => {
    fetchMock.mockResolvedValue(json(200, { role: 'buyer', expiresAt: '2026-10-16T10:00:00Z' }));
    mount();
    setVisibility('visible');
    await waitFor(() => { expect(navigateToLogin).toHaveBeenCalledWith(undefined); });
  });

  it('sin conexión no navega', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    mount();
    setVisibility('visible');
    await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); });
    await Promise.resolve();
    expect(navigateToLogin).not.toHaveBeenCalled();
  });

  it('al desmontar deja de escuchar', () => {
    const { unmount } = mount();
    unmount();
    pageShow(true);
    setVisibility('visible');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
