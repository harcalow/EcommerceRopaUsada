import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseServerEnv, ServerEnvError } from './server-env';

const valid = {
  APP_ENV: 'test',
  API_INTERNAL_URL: 'http://api:3001',
  API_PUBLIC_URL: 'http://localhost:3001',
  ADMIN_CONTACT_EMAIL: 'duena@perchados.example',
  INTERNAL_API_SECRET: 'x'.repeat(32),
};

function without(env: Record<string, string>, key: string): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([name]) => name !== key));
}

function failure(env: Record<string, string | undefined>): ServerEnvError {
  try {
    parseServerEnv(env);
  } catch (error) {
    if (error instanceof ServerEnvError) {
      return error;
    }
    throw error;
  }
  throw new Error('parseServerEnv should have thrown');
}

describe('parseServerEnv', () => {
  it('devuelve la configuración tipada', () => {
    expect(parseServerEnv(valid)).toEqual({
      appEnv: 'test',
      apiInternalUrl: 'http://api:3001',
      apiPublicUrl: 'http://localhost:3001',
      adminContactEmail: 'duena@perchados.example',
      internalApiSecret: 'x'.repeat(32),
      trustProxyHops: 0,
    });
  });

  it('usa development si falta APP_ENV', () => {
    const rest = without(valid, 'APP_ENV');
    expect(parseServerEnv(rest).appEnv).toBe('development');
  });

  it('falta API_INTERNAL_URL: nombra la variable', () => {
    const rest = without(valid, 'API_INTERNAL_URL');
    const error = failure(rest);
    expect(error.variables).toEqual(['API_INTERNAL_URL']);
    expect(error.message).toContain('API_INTERNAL_URL is required');
  });

  it('una variable vacía cuenta como ausente', () => {
    expect(failure({ ...valid, ADMIN_CONTACT_EMAIL: '' }).variables).toEqual(['ADMIN_CONTACT_EMAIL']);
  });

  it.each(['no-es-una-url', 'ftp://api:3001', 'http://'])('rechaza la URL %s sin mostrarla', (value) => {
    const error = failure({ ...valid, API_PUBLIC_URL: value });
    expect(error.variables).toEqual(['API_PUBLIC_URL']);
    expect(error.message).toContain('API_PUBLIC_URL must be a valid http(s) URL');
    expect(error.message).not.toContain(value);
  });

  it.each(['sin-arroba', 'a@b', 'con espacio@x.com', 'a@@x.com'])(
    'rechaza ADMIN_CONTACT_EMAIL %s sin mostrarlo',
    (value) => {
      const error = failure({ ...valid, ADMIN_CONTACT_EMAIL: value });
      expect(error.variables).toEqual(['ADMIN_CONTACT_EMAIL']);
      expect(error.message).toContain('ADMIN_CONTACT_EMAIL must be a valid email address');
      expect(error.message).not.toContain(value);
    },
  );

  it('rechaza un APP_ENV desconocido sin mostrarlo', () => {
    const error = failure({ ...valid, APP_ENV: 'staging' });
    expect(error.variables).toEqual(['APP_ENV']);
    expect(error.message).not.toContain('staging');
  });

  it('agrupa todas las variables inválidas', () => {
    const error = failure({});
    expect(error.variables).toEqual([
      'API_INTERNAL_URL',
      'API_PUBLIC_URL',
      'ADMIN_CONTACT_EMAIL',
      'INTERNAL_API_SECRET',
    ]);
  });
});

describe('RT-022: INTERNAL_API_SECRET', () => {
  it('RT-022: falta: inválida y nombra la variable', () => {
    const error = failure(without(valid, 'INTERNAL_API_SECRET'));
    expect(error.variables).toEqual(['INTERNAL_API_SECRET']);
    expect(error.message).toContain('INTERNAL_API_SECRET is required');
  });

  it('RT-022: con menos de 32 caracteres es inválida y no muestra el valor', () => {
    const short = 'secreto-corto-de-prueba';
    const error = failure({ ...valid, INTERNAL_API_SECRET: short });
    expect(error.variables).toEqual(['INTERNAL_API_SECRET']);
    expect(error.message).toContain('INTERNAL_API_SECRET must be at least 32 characters');
    expect(error.message).not.toContain(short);
  });

  it('RT-022: con 31 caracteres es inválida y con 32 es válida', () => {
    expect(failure({ ...valid, INTERNAL_API_SECRET: 'y'.repeat(31) }).variables).toEqual(['INTERNAL_API_SECRET']);
    expect(parseServerEnv({ ...valid, INTERNAL_API_SECRET: 'y'.repeat(32) }).internalApiSecret).toBe('y'.repeat(32));
  });
});

describe('RT-022: WEB_TRUST_PROXY_HOPS', () => {
  it('RT-022: ausente vale 0', () => {
    expect(parseServerEnv(valid).trustProxyHops).toBe(0);
  });

  it.each([['0', 0], ['1', 1], ['3', 3]])('RT-022: %s es un entero válido', (value, expected) => {
    expect(parseServerEnv({ ...valid, WEB_TRUST_PROXY_HOPS: value }).trustProxyHops).toBe(expected);
  });

  it.each(['-1', '1.5', 'dos', ' 1', '99999999999999999999'])('RT-022: rechaza %s sin mostrarlo', (value) => {
    const error = failure({ ...valid, WEB_TRUST_PROXY_HOPS: value });
    expect(error.variables).toEqual(['WEB_TRUST_PROXY_HOPS']);
    expect(error.message).toContain('WEB_TRUST_PROXY_HOPS must be an integer greater than or equal to 0');
    expect(error.message).not.toContain(value);
  });

  it('RT-022: production con 0 (o ausente) es inválida', () => {
    for (const env of [{ ...valid, APP_ENV: 'production' }, { ...valid, APP_ENV: 'production', WEB_TRUST_PROXY_HOPS: '0' }]) {
      const error = failure(env);
      expect(error.variables).toEqual(['WEB_TRUST_PROXY_HOPS']);
      expect(error.message).toContain('WEB_TRUST_PROXY_HOPS must be at least 1 when APP_ENV is production');
    }
  });

  it('RT-022: production con 1 es válida', () => {
    const env = parseServerEnv({ ...valid, APP_ENV: 'production', WEB_TRUST_PROXY_HOPS: '1' });
    expect(env.trustProxyHops).toBe(1);
  });
});

describe('server-only', () => {
  it('RT-022: el módulo importa server-only', () => {
    const source = readFileSync(fileURLToPath(new URL('./server-env.ts', import.meta.url)), 'utf8');
    expect(source).toMatch(/^import 'server-only';/m);
  });
});

describe('getServerEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('lee process.env una sola vez y reutiliza el resultado', async () => {
    for (const [key, value] of Object.entries(valid)) {
      vi.stubEnv(key, value);
    }
    const { getServerEnv: fresh } = await import('./server-env');
    const first = fresh();
    vi.stubEnv('API_PUBLIC_URL', 'no-es-una-url');
    expect(fresh()).toBe(first);
  });
});
