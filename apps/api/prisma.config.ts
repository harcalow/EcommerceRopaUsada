import { defineConfig } from 'prisma/config';

import { loadEnvFileIfPresent } from './src/shared/bootstrap/load-env-file';

loadEnvFileIfPresent();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
