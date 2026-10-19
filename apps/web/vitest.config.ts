import { fileURLToPath } from 'node:url';

import { createVitestConfig } from '@perchados/config/vitest';

const fromHere = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default createVitestConfig(
  {
    resolve: {
      alias: {
        '@': fromHere('./src'),
        // `server-only` lanza fuera de un Server Component; en las pruebas se sustituye por un módulo vacío
        'server-only': fromHere('./test/server-only.stub.ts'),
      },
    },
    test: { include: ['src/**/*.test.{ts,tsx}', 'e2e/**/*.test.ts'] },
  },
  ['src/**/*.{ts,tsx}'],
);
