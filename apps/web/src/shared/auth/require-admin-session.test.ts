import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClient = vi.fn<() => Promise<unknown>>();
vi.mock('../api/server-client', () => ({ getServerApiClient: (): Promise<unknown> => getClient() }));
const redirect = vi.fn((path: string): never => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock('next/navigation', () => ({ redirect: (path: string): never => redirect(path) }));

import { requireAdminSession } from './require-admin-session';

function clientReturning(result: { ok: boolean; data?: unknown; error?: unknown }) {
  return {
    GET: vi.fn().mockResolvedValue({ data: result.data, error: result.error, response: { ok: result.ok } }),
  };
}

describe('requireAdminSession', () => {
  beforeEach(() => {
    getClient.mockReset();
    redirect.mockClear();
  });

  it('con sesión de administrador devuelve la sesión y no redirige (CA-001)', async () => {
    const session = { role: 'admin', expiresAt: '2026-10-16T10:00:00Z' };
    getClient.mockResolvedValue(clientReturning({ ok: true, data: session }));
    await expect(requireAdminSession()).resolves.toEqual(session);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('401 session-expired redirige al login con el aviso de caducidad (CA-018)', async () => {
    getClient.mockResolvedValue(clientReturning({ ok: false, error: { type: 'auth/session-expired' } }));
    await expect(requireAdminSession()).rejects.toThrow('NEXT_REDIRECT:/login?motivo=sesion-caducada');
  });

  it('otro 401 o 403 redirige al login sin aviso (CA-010, CB-012)', async () => {
    getClient.mockResolvedValue(clientReturning({ ok: false, error: { type: 'auth/unauthenticated' } }));
    await expect(requireAdminSession()).rejects.toThrow('NEXT_REDIRECT:/login');
    getClient.mockResolvedValue(clientReturning({ ok: false, error: { type: 'auth/forbidden' } }));
    await expect(requireAdminSession()).rejects.toThrow('NEXT_REDIRECT:/login');
    getClient.mockResolvedValue(clientReturning({ ok: false }));
    await expect(requireAdminSession()).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  it('un rol distinto de admin redirige al login (CA-010)', async () => {
    getClient.mockResolvedValue(clientReturning({ ok: true, data: { role: 'buyer', expiresAt: 'x' } }));
    await expect(requireAdminSession()).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  it('con la API inalcanzable redirige al login', async () => {
    getClient.mockResolvedValue({ GET: vi.fn().mockRejectedValue(new TypeError('fetch failed')) });
    await expect(requireAdminSession()).rejects.toThrow('NEXT_REDIRECT:/login');
  });
});
