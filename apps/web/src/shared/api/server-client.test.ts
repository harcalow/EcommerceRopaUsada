import {
  CLIENT_IP_HEADER,
  CORRELATION_ID_HEADER,
  INTERNAL_TOKEN_HEADER,
} from '@perchados/contracts/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres';

const nextHeaders = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock('next/headers', () => nextHeaders);
vi.mock('../config/server-env', () => ({
  getServerEnv: () => ({
    apiInternalUrl: 'http://api:3001',
    internalApiSecret: 'secreto-de-prueba-con-mas-de-32-caracteres',
    trustProxyHops: 1,
  }),
}));

import { createServerApiClient, getServerApiClient } from './server-client';

function fakeFetch() {
  return vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ status: 'ok' })));
}

function requestOf(fetchMock: ReturnType<typeof fakeFetch>): Request {
  const request = fetchMock.mock.calls[0]?.[0];
  if (!(request instanceof Request)) {
    throw new Error('expected a Request');
  }
  return request;
}

async function send(incoming: Record<string, string>, trustProxyHops: number): Promise<Request> {
  const fetchMock = fakeFetch();
  const client = createServerApiClient({
    baseUrl: 'http://api:3001',
    internalSecret: SECRET,
    trustProxyHops,
    fetch: fetchMock,
    incoming: new Headers(incoming),
  });
  await client.GET('/v1/health');
  return requestOf(fetchMock);
}

describe('createServerApiClient', () => {
  it('llama a la URL interna y reenvía Cookie y X-Correlation-Id', async () => {
    const request = await send({ cookie: 'perchados_sid=abc', [CORRELATION_ID_HEADER]: 'corr-123' }, 0);

    expect(request.url).toBe('http://api:3001/v1/health');
    expect(request.headers.get('cookie')).toBe('perchados_sid=abc');
    expect(request.headers.get(CORRELATION_ID_HEADER)).toBe('corr-123');
  });

  it('RT-022: nunca reenvía X-Forwarded-For, con o sin saltos de confianza', async () => {
    for (const hops of [0, 1]) {
      const request = await send({ 'x-forwarded-for': '203.0.113.7' }, hops);
      expect(request.headers.get('x-forwarded-for')).toBeNull();
    }
  });

  it('RT-022: envía siempre el token interno', async () => {
    const request = await send({}, 0);

    expect(request.headers.get(INTERNAL_TOKEN_HEADER)).toBe(SECRET);
  });

  it('RT-022: con saltos de confianza y cabecera válida envía la IP resuelta de la derecha', async () => {
    const request = await send({ 'x-forwarded-for': '10.9.9.9, 203.0.113.7' }, 1);

    expect(request.headers.get(CLIENT_IP_HEADER)).toBe('203.0.113.7');
    expect(request.headers.get(INTERNAL_TOKEN_HEADER)).toBe(SECRET);
  });

  it('RT-022: con 0 saltos no envía la IP aunque llegue X-Forwarded-For', async () => {
    const request = await send({ 'x-forwarded-for': '203.0.113.7' }, 0);

    expect(request.headers.get(CLIENT_IP_HEADER)).toBeNull();
  });

  it('RT-022: con una entrada que no es una IP no envía la IP', async () => {
    const request = await send({ 'x-forwarded-for': 'no-es-una-ip' }, 1);

    expect(request.headers.get(CLIENT_IP_HEADER)).toBeNull();
    expect(request.headers.get(INTERNAL_TOKEN_HEADER)).toBe(SECRET);
  });

  it('genera un id de correlación si el entrante es inválido y no inventa cookie', async () => {
    const request = await send({ [CORRELATION_ID_HEADER]: 'no valido!' }, 0);

    const id = request.headers.get(CORRELATION_ID_HEADER);
    expect(id).toBeTruthy();
    expect(id).not.toBe('no valido!');
    expect(request.headers.get('cookie')).toBeNull();
  });
});

describe('getServerApiClient', () => {
  beforeEach(() => {
    nextHeaders.headers.mockResolvedValue(
      new Headers({ cookie: 'perchados_sid=xyz', 'x-forwarded-for': '198.51.100.4' }),
    );
  });

  it('usa la URL, el secreto y los saltos del entorno con las cabeceras de la petición en curso', async () => {
    const fetchMock = fakeFetch();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const client = await getServerApiClient();
      await client.GET('/v1/health');
    } finally {
      vi.unstubAllGlobals();
    }

    const request = requestOf(fetchMock);
    expect(request.url).toBe('http://api:3001/v1/health');
    expect(request.headers.get('cookie')).toBe('perchados_sid=xyz');
    expect(request.headers.get(INTERNAL_TOKEN_HEADER)).toBe(SECRET);
    expect(request.headers.get(CLIENT_IP_HEADER)).toBe('198.51.100.4');
  });
});
