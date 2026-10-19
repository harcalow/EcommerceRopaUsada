// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn<() => Promise<{ role: string; expiresAt: string } | null>>();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock('@/shared/auth/get-session', () => ({ getSession: () => getSession() }));
vi.mock('@/shared/config/server-env', () => ({ getServerEnv: () => ({ adminContactEmail: 'responsable@perchados.test' }) }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirect(path),
  useRouter: () => ({ replace: vi.fn() }),
}));

import { ApiConfigProvider } from '@/shared/api/api-config-provider';
import LoginPage, { metadata } from './page';

afterEach(cleanup);
beforeEach(() => {
  getSession.mockReset();
  redirect.mockClear();
});

describe('/login', () => {
  it('con sesión de administrador redirige al panel (CB-011)', async () => {
    getSession.mockResolvedValue({ role: 'admin', expiresAt: '2026-10-16T10:00:00Z' });
    await expect(LoginPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT:/panel');
    expect(redirect).toHaveBeenCalledWith('/panel');
  });

  it('sin sesión muestra la pantalla de login', async () => {
    getSession.mockResolvedValue(null);
    render(<ApiConfigProvider apiPublicUrl="http://api.test">{await LoginPage({ searchParams: Promise.resolve({}) })}</ApiConfigProvider>);
    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Hola de nuevo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar al panel' })).toBeTruthy();
    expect(metadata.title).toBe('Iniciar sesión');
  });

  it('con una sesión de otro rol no redirige', async () => {
    getSession.mockResolvedValue({ role: 'buyer', expiresAt: '2026-10-16T10:00:00Z' });
    render(<ApiConfigProvider apiPublicUrl="http://api.test">{await LoginPage({ searchParams: Promise.resolve({}) })}</ApiConfigProvider>);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('/login con motivo', () => {
  it('con motivo=sesion-caducada muestra el aviso de sesión caducada (CA-018)', async () => {
    getSession.mockResolvedValue(null);
    render(
      <ApiConfigProvider apiPublicUrl="http://api.test">
        {await LoginPage({ searchParams: Promise.resolve({ motivo: 'sesion-caducada' }) })}
      </ApiConfigProvider>,
    );
    expect(screen.getByTestId('login-session-expired').textContent).toContain(
      'Tu sesión ha caducado. Vuelve a iniciar sesión',
    );
  });

  it('con otro motivo no muestra el aviso', async () => {
    getSession.mockResolvedValue(null);
    render(
      <ApiConfigProvider apiPublicUrl="http://api.test">
        {await LoginPage({ searchParams: Promise.resolve({ motivo: 'otro' }) })}
      </ApiConfigProvider>,
    );
    expect(screen.queryByTestId('login-session-expired')).toBeNull();
  });
});
