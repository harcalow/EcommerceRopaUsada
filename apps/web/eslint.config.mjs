import nextPlugin from '@next/eslint-plugin-next';
import { createBaseConfig } from '@perchados/config/eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**', 'blob-report/**'] },
  ...createBaseConfig(import.meta.dirname),
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...nextPlugin.configs['core-web-vitals'],
  },
  {
    // ADR-012: el código de src/** solo importa el subpath del navegador; e2e/** no se restringe
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@perchados/contracts',
              message: 'ADR-012: en apps/web/src importa de @perchados/contracts/client, no de la entrada principal.',
            },
          ],
          patterns: [
            {
              group: ['@perchados/contracts/*', '!@perchados/contracts/client'],
              message: 'ADR-012: en apps/web/src solo se permite @perchados/contracts/client.',
            },
          ],
        },
      ],
    },
  },
  {
    // RT-004: la API solo se llama con el cliente tipado de shared/api
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/api/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Llama a la API con el cliente de shared/api, no con fetch directo.' },
      ],
      'no-restricted-properties': [
        'error',
        ...['window', 'globalThis', 'self'].map((object) => ({
          object,
          property: 'fetch',
          message: 'Llama a la API con el cliente de shared/api, no con fetch directo.',
        })),
      ],
    },
  },
];
