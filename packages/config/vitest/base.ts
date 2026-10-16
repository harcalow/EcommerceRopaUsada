import { defineConfig, mergeConfig, type ViteUserConfig } from 'vitest/config';

/** Umbral mínimo de cobertura de líneas por paquete (RT-003). */
export const COVERAGE_LINES_THRESHOLD = 80;

/** Exclusiones documentadas de la cobertura (RT-003). */
export const COVERAGE_EXCLUDE: readonly string[] = [
  '**/*.d.ts',
  '**/*.config.*',
  '**/*.spec.*',
  '**/*.test.*',
  '**/*.e2e-spec.*',
  '**/generated/**',
  '**/main.ts',
  '**/*.module.ts',
  '**/migrations/**',
];

/**
 * Preset de Vitest compartido: cobertura v8 con umbral de líneas.
 * `include` indica qué carpetas cuentan para la cobertura (por defecto `src`).
 */
export function createVitestConfig(
  overrides: ViteUserConfig = {},
  include: readonly string[] = ['src/**/*.ts'],
): ViteUserConfig {
  return mergeConfig(
    defineConfig({
      test: {
        passWithNoTests: true,
        coverage: {
          provider: 'v8',
          reporter: ['text', 'lcov'],
          include: [...include],
          exclude: [...COVERAGE_EXCLUDE],
          thresholds: { lines: COVERAGE_LINES_THRESHOLD },
        },
      },
    }),
    overrides,
  );
}
