import { join } from 'node:path';

import { loadEnvFileIfPresent } from '../../src/shared/bootstrap/load-env-file';

import { RUN_DATABASE_URL_ENV, resolveTestDatabase } from './db';
import { provisionRunDatabase } from './run-database';

/**
 * `globalSetup` de Vitest: crea una BD de pruebas propia de esta ejecución y la borra al terminar.
 * Si PostgreSQL no está disponible no falla: las pruebas unitarias siguen corriendo y las de
 * integración fallan con un mensaje claro desde `prepareTestDatabase`.
 */
export default async function setup(): Promise<(() => Promise<void>) | undefined> {
  loadEnvFileIfPresent();
  try {
    const run = await provisionRunDatabase(
      resolveTestDatabase(),
      join(process.cwd(), 'prisma', 'migrations'),
    );
    process.env[RUN_DATABASE_URL_ENV] = run.database.url;
    return async () => {
      try {
        await run.drop();
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        process.stderr.write(`[test-db] could not drop ${run.database.name}: ${reason}\n`);
      }
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    process.stderr.write(`[test-db] could not provision the run database: ${reason}\n`);
    return undefined;
  }
}
