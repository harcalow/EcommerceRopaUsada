import { describe, expect, it, vi } from 'vitest';

import { createLogCapture } from '../../test/helpers/logged-app';

import { runSeedCli } from './cli';
import type { SeedDatabase } from './runner';
import type { SeedStep, SeedTransaction } from './seed-step';

const DATABASE_URL = 'postgresql://user:pass-secreta@localhost:5432/db';

function createDatabase(fail = false) {
  const disconnect = vi.fn(() => Promise.resolve());
  const database: SeedDatabase & { $disconnect: typeof disconnect } = {
    $transaction: (fn) =>
      fail ? Promise.reject(new Error('conexión caída')) : fn({} as SeedTransaction),
    $disconnect: disconnect,
  };
  return { database, disconnect };
}

const step: SeedStep = { name: 'uno', prepare: () => () => Promise.resolve('created') };

describe('runSeedCli', () => {
  it('devuelve 0, usa la URL validada y cierra la conexión', async () => {
    const { database, disconnect } = createDatabase();
    const createDatabaseFn = vi.fn(() => database);
    const capture = createLogCapture();

    const code = await runSeedCli({
      env: { DATABASE_URL, LOG_LEVEL: 'debug' },
      steps: [step],
      destination: capture.destination,
      createDatabase: createDatabaseFn,
    });

    expect(code).toBe(0);
    expect(createDatabaseFn).toHaveBeenCalledWith(DATABASE_URL);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(capture.records()).toMatchObject([{ step: 'uno', outcome: 'created' }, {}]);
  });

  it.each([
    ['falta DATABASE_URL', {}],
    ['DATABASE_URL vacía', { DATABASE_URL: '' }],
    ['DATABASE_URL inválida', { DATABASE_URL: 'mysql://valor-secreto' }],
  ])('%s: sale con 1, nombra la variable y no abre la base de datos', async (_name, env) => {
    const createDatabaseFn = vi.fn();
    const capture = createLogCapture();

    const code = await runSeedCli({
      env,
      steps: [step],
      destination: capture.destination,
      createDatabase: createDatabaseFn,
    });

    expect(code).toBe(1);
    expect(createDatabaseFn).not.toHaveBeenCalled();
    expect(capture.records()).toMatchObject([{ level: 'error', variables: ['DATABASE_URL'] }]);
    expect(capture.lines.join('\n')).not.toContain('valor-secreto');
  });

  it('un LOG_LEVEL inválido también se nombra y falla', async () => {
    const capture = createLogCapture();

    const code = await runSeedCli({
      env: { DATABASE_URL, LOG_LEVEL: 'ruidoso' },
      steps: [],
      destination: capture.destination,
      createDatabase: () => createDatabase().database,
    });

    expect(code).toBe(1);
    expect(capture.records()).toMatchObject([{ variables: ['LOG_LEVEL'] }]);
  });

  it('un fallo en la base devuelve 1 y aun así cierra la conexión sin filtrar la URL', async () => {
    const { database, disconnect } = createDatabase(true);
    const capture = createLogCapture();

    const code = await runSeedCli({
      env: { DATABASE_URL },
      steps: [step],
      destination: capture.destination,
      createDatabase: () => database,
    });

    expect(code).toBe(1);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(capture.lines.join('\n')).not.toContain('pass-secreta');
  });
});
