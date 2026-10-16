import { describe, expect, it } from 'vitest';

import { COVERAGE_EXCLUDE, COVERAGE_LINES_THRESHOLD, createVitestConfig } from './base.ts';

describe('createVitestConfig (RT-003)', () => {
  it('exige al menos 80 % de cobertura de líneas con el proveedor v8', () => {
    const coverage = createVitestConfig().test?.coverage;

    expect(COVERAGE_LINES_THRESHOLD).toBe(80);
    expect(coverage?.thresholds).toEqual({ lines: 80 });
    expect(coverage?.provider).toBe('v8');
  });

  it('excluye código generado, configuración, main.ts, módulos y migraciones', () => {
    const exclude = createVitestConfig().test?.coverage?.exclude ?? [];

    for (const pattern of [
      '**/*.config.*',
      '**/generated/**',
      '**/main.ts',
      '**/*.module.ts',
      '**/migrations/**',
    ]) {
      expect(exclude).toContain(pattern);
    }
    expect(exclude).toEqual([...COVERAGE_EXCLUDE]);
  });

  it('mide por defecto la carpeta src y admite otra', () => {
    expect(createVitestConfig().test?.coverage?.include).toEqual(['src/**/*.ts']);
    expect(createVitestConfig({}, ['lib/**/*.ts']).test?.coverage?.include).toEqual([
      'lib/**/*.ts',
    ]);
  });

  it('conserva los ajustes propios del paquete', () => {
    const config = createVitestConfig({ test: { testTimeout: 1234 } });

    expect(config.test?.testTimeout).toBe(1234);
    expect(config.test?.coverage?.thresholds).toEqual({ lines: 80 });
  });
});
