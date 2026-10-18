import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findViolations, parseNameStatus } from './check-migrations-immutable.mjs';

const dir = 'apps/api/prisma/migrations';
const nothingExists = () => false;

test('parsea la salida de git diff --name-status', () => {
  assert.deepEqual(parseNameStatus(`A\t${dir}/2026_x/migration.sql\nM\tREADME.md\n`), [
    { status: 'A', path: `${dir}/2026_x/migration.sql` },
    { status: 'M', path: 'README.md' },
  ]);
});

test('sin cambios en migraciones no hay infracciones', () => {
  assert.deepEqual(findViolations([{ status: 'M', path: 'README.md' }], nothingExists), []);
});

test('una migración nueva está permitida', () => {
  const entries = [{ status: 'A', path: `${dir}/20261018000000_nueva/migration.sql` }];
  assert.deepEqual(findViolations(entries, nothingExists), []);
});

test('una migración modificada falla', () => {
  const entries = [{ status: 'M', path: `${dir}/20261015000000_roles_y_cuentas/migration.sql` }];
  assert.equal(findViolations(entries, nothingExists).length, 1);
});

test('una migración borrada falla', () => {
  const entries = [{ status: 'D', path: `${dir}/20261015000000_roles_y_cuentas/migration.sql` }];
  assert.equal(findViolations(entries, nothingExists).length, 1);
});

test('una migración renombrada (borrado + alta) falla', () => {
  const entries = [
    { status: 'D', path: `${dir}/20261015000000_roles_y_cuentas/migration.sql` },
    { status: 'A', path: `${dir}/20261015000000_otro_nombre/migration.sql` },
  ];
  assert.equal(findViolations(entries, nothingExists).length, 1);
});

test('añadir un archivo a una migración ya existente falla', () => {
  const entries = [{ status: 'A', path: `${dir}/20261015000000_roles_y_cuentas/extra.sql` }];
  assert.equal(findViolations(entries, () => true).length, 1);
});

test('modificar migration_lock.toml falla', () => {
  assert.equal(findViolations([{ status: 'M', path: `${dir}/migration_lock.toml` }], nothingExists).length, 1);
});
