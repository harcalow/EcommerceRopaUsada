import { createBaseConfig } from '@perchados/config/eslint';

import { createLayerRules, listModules } from './eslint.layers.mjs';

export default [
  { ignores: ['src/shared/database/generated/**'] },
  ...createBaseConfig(import.meta.dirname),
  {
    rules: {
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  ...createLayerRules(listModules(import.meta.dirname)),
];
