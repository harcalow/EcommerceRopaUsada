import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CORRELATION_ID_HEADER } from '@perchados/contracts/client';
import { describe, expect, it, vi } from 'vitest';

import { createBrowserApiClient } from './browser-client';

const read = (file: string): string =>
  readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

describe('createBrowserApiClient', () => {
  it('llama a la URL pública con credenciales y cabecera de correlación', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ status: 'ok' })));
    const client = createBrowserApiClient({ baseUrl: 'http://localhost:3001', fetch: fetchMock });

    await client.GET('/v1/health');

    const request = fetchMock.mock.calls[0]?.[0];
    if (!(request instanceof Request)) {
      throw new Error('expected a Request');
    }
    expect(request.url).toBe('http://localhost:3001/v1/health');
    expect(request.credentials).toBe('include');
    expect(request.headers.get(CORRELATION_ID_HEADER)).toBeTruthy();
  });

  it('el código del navegador no importa la configuración del servidor', () => {
    for (const file of ['./browser-client.ts', './api-config-provider.tsx']) {
      expect(read(file)).not.toMatch(/server-env|server-only|process\.env|API_INTERNAL_URL/);
    }
  });
});
