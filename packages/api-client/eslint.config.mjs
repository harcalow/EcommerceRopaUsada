import { createBaseConfig } from '@perchados/config/eslint';
import { globalIgnores } from 'eslint/config';

export default [
  globalIgnores(['src/generated/**']),
  ...createBaseConfig(import.meta.dirname),
];
