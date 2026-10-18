import { CORRELATION_ID_HEADER } from '@perchados/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from './client';

const healthBody = { status: 'ok', checks: { database: 'up' } };

function fakeFetch(status = 200, body: unknown = healthBody) {
  return vi.fn<(request: Request) => Promise<Response>>(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': status === 200 ? 'application/json' : 'application/problem+json' },
      }),
    ),
  );
}

describe('createApiClient', () => {
  it('llama a la ruta del contrato bajo la URL base', async () => {
    const fetch = fakeFetch();
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const { response } = await client.GET('/v1/health');

    const request = fetch.mock.calls[0]?.[0];
    expect(request?.method).toBe('GET');
    expect(request?.url).toBe('http://api.test/v1/health');
    expect(response.status).toBe(200);
  });

  it('añade X-Correlation-Id generado a cada petición', async () => {
    const fetch = fakeFetch();
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await client.GET('/v1/health');

    expect(fetch.mock.calls[0]?.[0].headers.get(CORRELATION_ID_HEADER)).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
  });

  it('usa el generador de id inyectado', async () => {
    const fetch = fakeFetch();
    const client = createApiClient({ baseUrl: 'http://api.test', fetch, correlationId: () => 'abc-123' });

    await client.GET('/v1/health');

    expect(fetch.mock.calls[0]?.[0].headers.get(CORRELATION_ID_HEADER)).toBe('abc-123');
  });

  it('respeta un id de correlación válido ya presente', async () => {
    const fetch = fakeFetch();
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch,
      headers: { [CORRELATION_ID_HEADER]: 'from-server.1' },
      correlationId: () => 'nuevo',
    });

    await client.GET('/v1/health');

    expect(fetch.mock.calls[0]?.[0].headers.get(CORRELATION_ID_HEADER)).toBe('from-server.1');
  });

  it('reemplaza un id de correlación inválido', async () => {
    const fetch = fakeFetch();
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch,
      headers: { [CORRELATION_ID_HEADER]: 'no válido!' },
      correlationId: () => 'nuevo',
    });

    await client.GET('/v1/health');

    expect(fetch.mock.calls[0]?.[0].headers.get(CORRELATION_ID_HEADER)).toBe('nuevo');
  });

  it('expone el error problem+json de un 503', async () => {
    const problem = {
      type: 'health/unavailable',
      title: 'No disponible',
      status: 503,
      detail: 'Base de datos caída',
      correlationId: 'abc',
    };
    const client = createApiClient({ baseUrl: 'http://api.test', fetch: fakeFetch(503, problem) });

    const { data, error, response } = await client.GET('/v1/health');

    expect(response.status).toBe(503);
    expect(data).toBeUndefined();
    expect(error).toEqual(problem);
  });
});
