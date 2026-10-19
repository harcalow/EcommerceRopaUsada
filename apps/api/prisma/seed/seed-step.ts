import type { Prisma } from '../../src/shared/database/generated/client';

/** Resultado de un paso: creó datos o los encontró ya creados y no tocó nada. */
export type SeedOutcome = 'created' | 'skipped';

/** Cliente transaccional que reciben los pasos: todo lo que escriban se revierte junto si uno falla. */
export type SeedTransaction = Prisma.TransactionClient;

/** Escritura de un paso, ya con sus variables de entorno validadas. Debe ser idempotente. */
export type SeedExecutor = (tx: SeedTransaction) => Promise<SeedOutcome>;

/**
 * Paso de semilla. `prepare` lee y valida SOLO las variables que necesita (sin escribir nada) y
 * lanza `SeedConfigError` (de forma síncrona) si alguna falta o es inválida; devuelve la escritura a
 * ejecutar. Puede devolverla como promesa para calcular antes (p. ej. un hash) lo que no debe
 * hacerse dentro de la transacción.
 */
export interface SeedStep {
  readonly name: string;
  prepare(env: NodeJS.ProcessEnv): SeedExecutor | Promise<SeedExecutor>;
}

export interface SeedConfigIssue {
  readonly variable: string;
  readonly reason: string;
}

/** Variable de entorno de un paso ausente o inválida: nombra la variable y nunca incluye su valor. */
export class SeedConfigError extends Error {
  readonly variables: readonly string[];

  constructor(readonly issues: readonly SeedConfigIssue[]) {
    super(
      `Invalid seed configuration: ${issues.map(({ variable, reason }) => `${variable} ${reason}`).join('; ')}`,
    );
    this.name = 'SeedConfigError';
    this.variables = [...new Set(issues.map(({ variable }) => variable))];
  }
}

/** Un paso falló al escribir; la transacción completa se revirtió. Conserva el error original como `cause`. */
export class SeedStepError extends Error {
  constructor(
    readonly step: string,
    cause: unknown,
  ) {
    super(`Seed step "${step}" failed`, { cause });
    this.name = 'SeedStepError';
  }
}
