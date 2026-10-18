import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  databasePrefix,
  hashMigrations,
  isStaleRunDatabase,
  runDatabaseName,
  STALE_RUN_DATABASE_MS,
  templateDatabaseName,
} from './run-database';

describe('nombres de las BD de pruebas', () => {
  it('quita el sufijo _test para formar el prefijo', () => {
    expect(databasePrefix('perchados_test')).toBe('perchados');
  });

  it('la plantilla y la ejecución terminan siempre en _test', () => {
    expect(templateDatabaseName('perchados', 'abcdef0123456789')).toBe('perchados_tpl_abcdef012345_test');
    expect(runDatabaseName('perchados', 1_000_000, 'a1b2c3')).toMatch(/^perchados_run_[0-9a-z]+_a1b2c3_test$/);
  });
});

describe('isStaleRunDatabase', () => {
  const now = Date.now();

  it('detecta como huérfana una BD de ejecución antigua', () => {
    const old = runDatabaseName('perchados', now - STALE_RUN_DATABASE_MS - 1_000, 'a1b2c3');

    expect(isStaleRunDatabase('perchados', old, now)).toBe(true);
  });

  it('conserva una BD de ejecución reciente', () => {
    const recent = runDatabaseName('perchados', now - 1_000, 'a1b2c3');

    expect(isStaleRunDatabase('perchados', recent, now)).toBe(false);
  });

  it.each(['perchados', 'perchados_test', 'perchados_tpl_abcdef012345_test', 'perchados_run_xx_test', 'otra_run_0_a1b2c3_test'])(
    'nunca marca como huérfana %s',
    (name) => {
      expect(isStaleRunDatabase('perchados', name, now + 10 * STALE_RUN_DATABASE_MS)).toBe(false);
    },
  );
});

describe('hashMigrations', () => {
  function migrationsWith(sql: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
    mkdirSync(join(dir, '20260101000000_uno'));
    writeFileSync(join(dir, '20260101000000_uno', 'migration.sql'), sql);
    return dir;
  }

  it('es estable para el mismo contenido y cambia si cambia una migración', () => {
    expect(hashMigrations(migrationsWith('SELECT 1;'))).toBe(hashMigrations(migrationsWith('SELECT 1;')));
    expect(hashMigrations(migrationsWith('SELECT 1;'))).not.toBe(hashMigrations(migrationsWith('SELECT 2;')));
  });
});
