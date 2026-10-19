import { randomUUID } from 'node:crypto';

import pino, { type DestinationStream } from 'pino';
import { z } from 'zod';

import { databaseUrl, LOG_LEVELS } from '../../src/shared/config/env.schema';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { buildPinoOptions } from '../../src/shared/logging/logger.module';

import { runSeed, type SeedDatabase } from './runner';
import { SeedConfigError, type SeedStep } from './seed-step';

const seedEnvSchema = z.object({
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: z
    .enum(LOG_LEVELS, { error: `must be one of ${LOG_LEVELS.join(', ')}` })
    .default('info'),
});

type ManagedDatabase = SeedDatabase & { $disconnect(): Promise<void> };

export interface SeedCliOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly steps: readonly SeedStep[];
  /** Destino de los logs (por defecto la salida estándar); lo usan las pruebas. */
  readonly destination?: DestinationStream;
  /** Fábrica de la conexión; por defecto `PrismaService` (la conexión se abre al primer uso). */
  readonly createDatabase?: (databaseUrl: string) => ManagedDatabase;
}

const createPrismaDatabase = (url: string): ManagedDatabase =>
  new PrismaService({ databaseUrl: url });

/** Las variables vacías (`VAR=`) cuentan como ausentes, igual que en la configuración de la API. */
function withoutEmpty(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
}

/**
 * Punto de entrada de `db:seed`: valida el entorno, ejecuta la semilla y devuelve el código de
 * salida (0 correcto, 1 error). Los errores se registran como JSON sin valores sensibles.
 */
export async function runSeedCli(options: SeedCliOptions): Promise<number> {
  const env = withoutEmpty(options.env);
  const parsed = seedEnvSchema.safeParse(env);
  const level = parsed.success ? parsed.data.LOG_LEVEL : 'info';
  const logger = pino(buildPinoOptions(level), options.destination).child({
    context: 'Seed',
    correlationId: randomUUID(),
  });

  if (!parsed.success) {
    const error = new SeedConfigError(
      parsed.error.issues.map((issue) => ({
        variable: String(issue.path[0] ?? 'environment'),
        reason: issue.message,
      })),
    );
    logger.error({ variables: error.variables }, error.message);
    return 1;
  }

  const database = (options.createDatabase ?? createPrismaDatabase)(parsed.data.DATABASE_URL);
  try {
    await runSeed(database, options.steps, env, logger);
    return 0;
  } catch (error) {
    if (error instanceof SeedConfigError) {
      logger.error({ variables: error.variables }, error.message);
    }
    return 1;
  } finally {
    await database.$disconnect();
  }
}
