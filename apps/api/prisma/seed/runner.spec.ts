import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { createLogCapture } from '../../test/helpers/logged-app';

import { runSeed, SEED_TRANSACTION_TIMEOUT_MS, type SeedDatabase } from './runner';
import {
  SeedConfigError,
  SeedStepError,
  type SeedOutcome,
  type SeedStep,
  type SeedTransaction,
} from './seed-step';

const FAKE_TX = {} as SeedTransaction;

function createFakeDatabase(): SeedDatabase & { transactions: number; options: unknown[] } {
  const database = {
    transactions: 0,
    options: [] as unknown[],
    $transaction: <T>(
      fn: (tx: SeedTransaction) => Promise<T>,
      options?: { timeout?: number },
    ): Promise<T> => {
      database.transactions += 1;
      database.options.push(options);
      return fn(FAKE_TX);
    },
  };
  return database;
}

function okStep(name: string, outcome: SeedOutcome, order: string[] = []): SeedStep {
  return {
    name,
    prepare: () => () => {
      order.push(name);
      return Promise.resolve(outcome);
    },
  };
}

function stepRequiring(name: string, variable: string): SeedStep {
  return {
    name,
    prepare: (env) => {
      if (env[variable] === undefined) {
        throw new SeedConfigError([{ variable, reason: 'is required' }]);
      }
      return () => Promise.resolve('created');
    },
  };
}

function createLogger() {
  const capture = createLogCapture();
  return { logger: pino({ base: null }, capture.destination), capture };
}

describe('runSeed (RT-009)', () => {
  it('ejecuta los pasos en orden dentro de una única transacción con timeout', async () => {
    const db = createFakeDatabase();
    const order: string[] = [];
    const { logger } = createLogger();

    const results = await runSeed(
      db,
      [okStep('uno', 'created', order), okStep('dos', 'skipped', order)],
      {},
      logger,
    );

    expect(order).toEqual(['uno', 'dos']);
    expect(results).toEqual([
      { step: 'uno', outcome: 'created' },
      { step: 'dos', outcome: 'skipped' },
    ]);
    expect(db.transactions).toBe(1);
    expect(db.options).toEqual([{ timeout: SEED_TRANSACTION_TIMEOUT_MS }]);
  });

  it('registra un log JSON por paso y un resumen, solo tras confirmar', async () => {
    const { logger, capture } = createLogger();

    await runSeed(createFakeDatabase(), [okStep('uno', 'created')], {}, logger);

    expect(capture.records()).toMatchObject([
      { step: 'uno', outcome: 'created', msg: 'seed step applied' },
      { steps: 1, msg: 'seed finished' },
    ]);
  });

  it('sin pasos termina bien y no escribe nada', async () => {
    const { logger, capture } = createLogger();

    await expect(runSeed(createFakeDatabase(), [], {}, logger)).resolves.toEqual([]);

    expect(capture.records()).toMatchObject([{ steps: 0 }]);
  });

  it('valida las variables de todos los pasos antes de abrir la transacción y nombra cada una', async () => {
    const db = createFakeDatabase();
    const executed = vi.fn();
    const { logger } = createLogger();
    const steps = [
      okStep('ok', 'created', []),
      stepRequiring('a', 'VAR_A'),
      stepRequiring('b', 'VAR_B'),
    ];
    steps[0] = { name: 'ok', prepare: () => executed };

    const result = runSeed(db, steps, {}, logger);

    await expect(result).rejects.toBeInstanceOf(SeedConfigError);
    await expect(result).rejects.toMatchObject({ variables: ['VAR_A', 'VAR_B'] });
    expect(db.transactions).toBe(0);
    expect(executed).not.toHaveBeenCalled();
  });

  it('propaga tal cual un error de preparación que no es de configuración', async () => {
    const boom = new Error('fallo inesperado');
    const step: SeedStep = {
      name: 'roto',
      prepare: () => {
        throw boom;
      },
    };

    await expect(runSeed(createFakeDatabase(), [step], {}, createLogger().logger)).rejects.toBe(
      boom,
    );
  });

  it('si un paso falla lanza SeedStepError con el paso y registra solo su nombre y la clase del error', async () => {
    const { logger, capture } = createLogger();
    const failing: SeedStep = {
      name: 'falla',
      prepare: () => () => Promise.reject(new TypeError('valor-secreto-en-el-mensaje')),
    };

    const result = runSeed(createFakeDatabase(), [okStep('antes', 'created'), failing], {}, logger);

    await expect(result).rejects.toBeInstanceOf(SeedStepError);
    await expect(result).rejects.toMatchObject({ step: 'falla' });
    expect(capture.records()).toMatchObject([
      { level: 50, step: 'falla', errorName: 'TypeError', rolledBack: true },
    ]);
    expect(capture.lines.join('\n')).not.toContain('valor-secreto-en-el-mensaje');
    expect(capture.lines.join('\n')).not.toContain('seed step applied');
  });

  it('registra UnknownError si el fallo no es un Error', async () => {
    const { logger, capture } = createLogger();
    const failing: SeedStep = {
      name: 'falla',
      prepare: () => () => {
        throw JSON.parse('"texto"');
      },
    };

    await expect(runSeed(createFakeDatabase(), [failing], {}, logger)).rejects.toBeInstanceOf(
      SeedStepError,
    );

    expect(capture.records()).toMatchObject([{ errorName: 'UnknownError' }]);
  });

  it('un fallo de la propia transacción se registra sin paso', async () => {
    const { logger, capture } = createLogger();
    const db: SeedDatabase = { $transaction: () => Promise.reject(new RangeError('x')) };

    await expect(runSeed(db, [okStep('uno', 'created')], {}, logger)).rejects.toBeInstanceOf(
      RangeError,
    );

    expect(capture.records()).toMatchObject([{ errorName: 'RangeError', rolledBack: true }]);
  });
});

describe('SeedConfigError', () => {
  it('compone el mensaje con variable y motivo, sin duplicar variables', () => {
    const error = new SeedConfigError([
      { variable: 'A', reason: 'is required' },
      { variable: 'A', reason: 'must be long' },
    ]);

    expect(error.message).toBe('Invalid seed configuration: A is required; A must be long');
    expect(error.variables).toEqual(['A']);
  });
});
