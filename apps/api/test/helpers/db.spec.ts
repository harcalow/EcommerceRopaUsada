import { describe, expect, it } from 'vitest';

import { prepareTestDatabase, resolveTestDatabase } from './db';

describe('prepareTestDatabase', () => {
  it('devuelve la BD de la ejecución', async () => {
    const result = await prepareTestDatabase({
      TEST_RUN_DATABASE_URL: 'postgresql://u:p@localhost:5432/perchados_run_x_a1b2c3_test',
    });

    expect(result.name).toBe('perchados_run_x_a1b2c3_test');
  });

  it('se niega a usar una base sin sufijo _test', async () => {
    await expect(
      prepareTestDatabase({ TEST_RUN_DATABASE_URL: 'postgresql://u:p@localhost:5432/perchados' }),
    ).rejects.toThrow('_test');
  });

  it('explica que falta el globalSetup si no hay BD de ejecución', async () => {
    await expect(prepareTestDatabase({})).rejects.toThrow('globalSetup');
  });
});

describe('resolveTestDatabase', () => {
  it('deriva la base de pruebas añadiendo _test al nombre de la base de datos', () => {
    const result = resolveTestDatabase({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/perchados',
    });

    expect(result.name).toBe('perchados_test');
    expect(result.url).toBe('postgresql://u:p@localhost:5432/perchados_test');
  });

  it('no repite el sufijo si la URL ya apunta a una base _test', () => {
    const result = resolveTestDatabase({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/perchados_test',
    });

    expect(result.name).toBe('perchados_test');
  });

  it('prefiere TEST_DATABASE_URL', () => {
    const result = resolveTestDatabase({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/perchados',
      TEST_DATABASE_URL: 'postgresql://u:p@db:5432/ci_test',
    });

    expect(result.name).toBe('ci_test');
  });

  it('se niega a usar una base que no termine en _test', () => {
    expect(() =>
      resolveTestDatabase({
        TEST_DATABASE_URL: 'postgresql://u:p@localhost:5432/perchados',
      }),
    ).toThrow('_test');
  });

  it('exige una URL de base de datos', () => {
    expect(() => resolveTestDatabase({})).toThrow('DATABASE_URL');
  });
});
