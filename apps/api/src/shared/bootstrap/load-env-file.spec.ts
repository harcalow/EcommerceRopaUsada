import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadEnvFileIfPresent } from './load-env-file';

const NEW_VAR = 'T05_ENV_FILE_NEW_VARIABLE';
const EXISTING_VAR = 'T05_ENV_FILE_EXISTING_VARIABLE';

describe('loadEnvFileIfPresent', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'env-file-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    Reflect.deleteProperty(process.env, NEW_VAR);
    Reflect.deleteProperty(process.env, EXISTING_VAR);
  });

  it('devuelve false y no falla si el archivo no existe', () => {
    expect(loadEnvFileIfPresent(join(dir, 'no-existe'))).toBe(false);
  });

  it('carga las variables del archivo sin pisar las ya definidas', () => {
    process.env[EXISTING_VAR] = 'del-entorno';
    const file = join(dir, 'archivo-entorno');
    writeFileSync(file, `${NEW_VAR}=del-archivo\n${EXISTING_VAR}=del-archivo\n`);

    expect(loadEnvFileIfPresent(file)).toBe(true);
    expect(process.env[NEW_VAR]).toBe('del-archivo');
    expect(process.env[EXISTING_VAR]).toBe('del-entorno');
  });
});
