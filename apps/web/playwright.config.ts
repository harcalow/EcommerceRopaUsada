import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

import { CONTACT_EMAIL } from './e2e/fixtures/accounts';

const isCi = Boolean(process.env.CI);
// Entorno de las apps bajo prueba: la CI usa ci (cookies Secure, T-20); en local test (sin Secure)
const appEnv = process.env.E2E_APP_ENV ?? 'test';
const webPort = process.env.E2E_WEB_PORT ?? '3100';
const apiPort = process.env.E2E_API_PORT ?? '3101';
const webUrl = `http://localhost:${webPort}`;
const apiUrl = `http://localhost:${apiPort}`;
const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgresql://perchados:perchados_dev_password@localhost:5432/perchados_e2e';

const E2E_INTERNAL_API_SECRET = 'e2e-internal-api-secret-for-tests-only-0123456789';

/** La web real (`next start`, requiere `next build` previo: lo hace Turborepo antes de `test:e2e`). */
const webServer: NonNullable<PlaywrightTestConfig['webServer']> = [
  {
    command: 'node scripts/run-next.mjs start',
    url: `${webUrl}/healthz`,
    timeout: 120_000,
    reuseExistingServer: !isCi,
    env: {
      WEB_PORT: webPort,
      APP_ENV: appEnv,
      API_INTERNAL_URL: apiUrl,
      API_PUBLIC_URL: apiUrl,
      ADMIN_CONTACT_EMAIL: CONTACT_EMAIL,
      // RT-022: valores de prueba (no es un secreto real); la web de E2E no está detrás de ningún proxy
      INTERNAL_API_SECRET: E2E_INTERNAL_API_SECRET,
      WEB_TRUST_PROXY_HOPS: '0',
    },
  },
];

// La API se arranca solo con E2E_WITH_API=1 (requiere `apps/api` compilada y la BD de E2E migrada y semillada)
if (process.env.E2E_WITH_API === '1') {
  webServer.unshift({
    command: 'node ../api/dist/src/main.js',
    url: `${apiUrl}/v1/health`,
    timeout: 120_000,
    reuseExistingServer: !isCi,
    env: {
      API_PORT: apiPort,
      APP_ENV: appEnv,
      DATABASE_URL: e2eDatabaseUrl,
      CORS_ALLOWED_ORIGINS: webUrl,
      INTERNAL_API_SECRET: E2E_INTERNAL_API_SECRET,
      // El límite estricto (10/min por IP) se agotaría con tantas pruebas desde 127.0.0.1; su verificación es de la API
      RATE_LIMIT_AUTH_PER_MIN: '10000',
      RATE_LIMIT_GLOBAL_PER_MIN: '100000',
      // Mismo coste que los hashes de las cuentas de prueba (mínimo OWASP): el login no tarda segundos por intento
      PASSWORD_HASH_ITERATIONS: '2',
    },
  });
}

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './test-results',
  fullyParallel: true,
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: isCi,
  // El login verifica argon2id y el arranque en frío de la web es lento en equipos modestos
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Máximo 1 reintento y solo en CI; lo que pasa al reintentar se reporta como inestable (RT-019)
  retries: isCi ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['./e2e/reporters/flaky-summary.ts'],
  ],
  use: {
    baseURL: webUrl,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Sin vídeo: grabarlo ralentiza tanto el equipo que el login supera el límite de 5 s de la transacción de la API
    video: 'off',
  },
  projects: [
    { name: 'chromium-escritorio', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-360',
      // Los dos proyectos comparten la BD de E2E (CA-017 siembra HaroldAdmin): se ejecutan uno tras otro
      dependencies: ['chromium-escritorio'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer,
});
