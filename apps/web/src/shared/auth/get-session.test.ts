import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClient = vi.fn<() => Promise<unknown>>();
vi.mock('../api/server-client', () => ({ getServerApiClient: (): Promise<unknown> => getClient() }));

import { getSession } from './get-session';

function clientReturning(result: { data?: unknown; ok: boolean }) {
  return { GET: vi.fn().mockResolvedValue({ data: result.data, response: { ok: result.ok } }) };
}

describe('getSession', () => {
  beforeEach(() => getClient.mockReset());

  it('devuelve rol y caducidad con sesión vigente', async () => {
    const client = clientReturning({ ok: true, data: { role: 'admin', expiresAt: '2026-10-16T10:00:00Z' } });
    getClient.mockResolvedValue(client);
    await expect(getSession()).resolves.toEqual({ role: 'admin', expiresAt: '2026-10-16T10:00:00Z' });
    expect(client.GET).toHaveBeenCalledWith('/v1/auth/session');
  });

  it('devuelve null con 401', async () => {
    getClient.mockResolvedValue(clientReturning({ ok: false }));
    await expect(getSession()).resolves.toBeNull();
  });

  it('devuelve null si la respuesta no trae datos', async () => {
    getClient.mockResolvedValue(clientReturning({ ok: true }));
    await expect(getSession()).resolves.toBeNull();
  });

  it('devuelve null si la API es inalcanzable', async () => {
    getClient.mockResolvedValue({ GET: vi.fn().mockRejectedValue(new TypeError('fetch failed')) });
    await expect(getSession()).resolves.toBeNull();
  });
});
