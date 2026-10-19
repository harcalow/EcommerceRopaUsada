import { afterEach, describe, expect, it, vi } from 'vitest';

import { register } from './instrumentation';

const validEnv = {
  NEXT_RUNTIME: 'nodejs',
  API_INTERNAL_URL: 'http://api:3001',
  API_PUBLIC_URL: 'http://localhost:3001',
  ADMIN_CONTACT_EMAIL: 'duena@perchados.example',
  INTERNAL_API_SECRET: 'x'.repeat(32),
};

function stubEnv(overrides: Record<string, string> = {}): void {
  for (const [key, value] of Object.entries({ ...validEnv, ...overrides })) {
    vi.stubEnv(key, value);
  }
}

describe('register', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('arranca con la configuración válida', async () => {
    stubEnv();
    await expect(register()).resolves.toBeUndefined();
  });

  it('falla nombrando ADMIN_CONTACT_EMAIL cuando es inválido, sin mostrar su valor', async () => {
    stubEnv({ ADMIN_CONTACT_EMAIL: 'valor-invalido-xyz' });
    const failure = register().then(
      () => '',
      (error: unknown) => (error instanceof Error ? error.message : ''),
    );
    const message = await failure;
    expect(message).toContain('ADMIN_CONTACT_EMAIL must be a valid email address');
    expect(message).not.toContain('valor-invalido-xyz');
  });

  it('falla si falta ADMIN_CONTACT_EMAIL', async () => {
    stubEnv({ ADMIN_CONTACT_EMAIL: '' });
    await expect(register()).rejects.toThrow(/ADMIN_CONTACT_EMAIL is required/);
  });

  it('no valida fuera del runtime de Node.js', async () => {
    stubEnv({ NEXT_RUNTIME: 'edge', ADMIN_CONTACT_EMAIL: '' });
    await expect(register()).resolves.toBeUndefined();
  });
});
