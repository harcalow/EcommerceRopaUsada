import type { Logger } from 'pino';

import {
  SeedConfigError,
  SeedStepError,
  type SeedConfigIssue,
  type SeedExecutor,
  type SeedOutcome,
  type SeedStep,
  type SeedTransaction,
} from './seed-step';

/** Tiempo máximo de la transacción de la semilla (los pasos pueden calcular hashes costosos). */
export const SEED_TRANSACTION_TIMEOUT_MS = 30_000;

/** Lo mínimo que el runner necesita de la base de datos (lo cumple `PrismaService`). */
export interface SeedDatabase {
  $transaction<T>(
    fn: (tx: SeedTransaction) => Promise<T>,
    options?: { timeout?: number },
  ): Promise<T>;
}

export interface SeedStepResult {
  readonly step: string;
  readonly outcome: SeedOutcome;
}

interface PreparedStep {
  readonly name: string;
  readonly execute: SeedExecutor;
}

/** Valida las variables de TODOS los pasos antes de escribir y reúne todos los problemas. */
async function prepareSteps(
  steps: readonly SeedStep[],
  env: NodeJS.ProcessEnv,
): Promise<PreparedStep[]> {
  const issues: SeedConfigIssue[] = [];
  const prepared: PreparedStep[] = [];
  for (const step of steps) {
    try {
      prepared.push({ name: step.name, execute: await step.prepare(env) });
    } catch (error) {
      if (!(error instanceof SeedConfigError)) {
        throw error;
      }
      issues.push(...error.issues);
    }
  }
  if (issues.length > 0) {
    throw new SeedConfigError(issues);
  }
  return prepared;
}

async function executeAll(
  db: SeedDatabase,
  steps: readonly PreparedStep[],
): Promise<SeedStepResult[]> {
  return db.$transaction(
    async (tx) => {
      const results: SeedStepResult[] = [];
      for (const { name, execute } of steps) {
        try {
          results.push({ step: name, outcome: await execute(tx) });
        } catch (error) {
          throw new SeedStepError(name, error);
        }
      }
      return results;
    },
    { timeout: SEED_TRANSACTION_TIMEOUT_MS },
  );
}

/**
 * Ejecuta los pasos en orden dentro de UNA transacción: si uno falla se revierte todo. Es
 * idempotente si lo son sus pasos. Registra un log JSON por paso solo después de confirmar
 * (nunca hay un "creado" de algo revertido) y jamás el mensaje del error ni valores del
 * entorno: solo el nombre del paso y la clase del error.
 */
export async function runSeed(
  db: SeedDatabase,
  steps: readonly SeedStep[],
  env: NodeJS.ProcessEnv,
  logger: Logger,
): Promise<SeedStepResult[]> {
  const prepared = await prepareSteps(steps, env);
  try {
    const results = await executeAll(db, prepared);
    for (const { step, outcome } of results) {
      logger.info({ step, outcome }, 'seed step applied');
    }
    logger.info({ steps: results.length }, 'seed finished');
    return results;
  } catch (error) {
    const failedStep = error instanceof SeedStepError ? error.step : undefined;
    const cause = error instanceof SeedStepError ? error.cause : error;
    logger.error(
      {
        step: failedStep,
        errorName: cause instanceof Error ? cause.name : 'UnknownError',
        rolledBack: true,
      },
      'seed failed; transaction rolled back',
    );
    throw error;
  }
}
