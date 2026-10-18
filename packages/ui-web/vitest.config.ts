import { createVitestConfig } from '@perchados/config/vitest';

export default createVitestConfig(
  {
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./vitest.setup.ts'],
    },
  },
  ['src/**/*.{ts,tsx}'],
);
