import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prepareTestDatabase } from '../../test/helpers/db';
import { createLogCapture } from '../../test/helpers/logged-app';
import { PrismaService } from '../../src/shared/database/prisma.service';

import { runSeedCli } from './cli';
import { SeedConfigError, type SeedStep } from './seed-step';

const SECRET = 'valor-sensible-de-prueba-123';
const ROLE_A = 'seed-test-a';
const ROLE_B = 'seed-test-b';

/** Paso ficticio: crea un rol solo si no existe y exige una variable sensible. */
function roleStep(name: string, code: string): SeedStep {
  return {
    name,
    prepare: (env) => {
      const secret = env.SEED_TEST_SECRET;
      if (secret === undefined) {
        throw new SeedConfigError([{ variable: 'SEED_TEST_SECRET', reason: 'is required' }]);
      }
      return async (tx) => {
        const { count } = await tx.role.createMany({
          data: [{ code, name: `rol ${String(secret.length)}` }],
          skipDuplicates: true,
        });
        return count === 0 ? 'skipped' : 'created';
      };
    },
  };
}

const failingStep: SeedStep = {
  name: 'falla',
  prepare: (env) => () => Promise.reject(new Error(`no se pudo con ${env.SEED_TEST_SECRET ?? ''}`)),
};

describe('db:seed contra PostgreSQL real (RT-009)', () => {
  let databaseUrl: string;
  let prisma: PrismaService;

  beforeAll(async () => {
    databaseUrl = (await prepareTestDatabase()).url;
    prisma = new PrismaService({ databaseUrl });
  });

  beforeEach(async () => {
    await prisma.role.deleteMany({ where: { code: { in: [ROLE_A, ROLE_B] } } });
  });

  afterAll(async () => {
    await prisma.role.deleteMany({ where: { code: { in: [ROLE_A, ROLE_B] } } });
    await prisma.$disconnect();
  });

  async function run(steps: SeedStep[], env: Record<string, string>) {
    const capture = createLogCapture();
    const code = await runSeedCli({
      env: { DATABASE_URL: databaseUrl, ...env },
      steps,
      destination: capture.destination,
    });
    return { code, capture };
  }

  const seededRoles = () => prisma.role.count({ where: { code: { in: [ROLE_A, ROLE_B] } } });

  it('ejecutarla dos veces no duplica nada: la segunda omite los pasos', async () => {
    const steps = [roleStep('rol-a', ROLE_A), roleStep('rol-b', ROLE_B)];
    const env = { SEED_TEST_SECRET: SECRET };

    const first = await run(steps, env);
    const second = await run(steps, env);

    expect([first.code, second.code]).toEqual([0, 0]);
    expect(await seededRoles()).toBe(2);
    expect(first.capture.records().filter((r) => r.msg === 'seed step applied')).toMatchObject([
      { step: 'rol-a', outcome: 'created' },
      { step: 'rol-b', outcome: 'created' },
    ]);
    expect(second.capture.records().filter((r) => r.msg === 'seed step applied')).toMatchObject([
      { step: 'rol-a', outcome: 'skipped' },
      { step: 'rol-b', outcome: 'skipped' },
    ]);
  });

  it('si un paso falla se revierte todo: no queda nada a medias y el log no filtra el secreto', async () => {
    const result = await run([roleStep('rol-a', ROLE_A), failingStep], {
      SEED_TEST_SECRET: SECRET,
    });

    expect(result.code).toBe(1);
    expect(await seededRoles()).toBe(0);
    expect(result.capture.records()).toMatchObject([
      { level: 'error', step: 'falla', errorName: 'Error', rolledBack: true },
    ]);
    expect(result.capture.lines.join('\n')).not.toContain(SECRET);
  });

  it('sin la variable de un paso sale con 1, la nombra, no escribe nada y no imprime valores', async () => {
    const result = await run([roleStep('rol-a', ROLE_A)], { OTRA_VARIABLE: SECRET });

    expect(result.code).toBe(1);
    expect(await seededRoles()).toBe(0);
    const [record] = result.capture.records();
    expect(record).toMatchObject({ level: 'error', variables: ['SEED_TEST_SECRET'] });
    expect(record?.msg).toContain('SEED_TEST_SECRET');
    expect(result.capture.lines.join('\n')).not.toContain(SECRET);
  });

  it('los logs de cada paso son JSON con nivel, contexto e id de correlación y sin secretos', async () => {
    const result = await run([roleStep('rol-a', ROLE_A)], { SEED_TEST_SECRET: SECRET });

    for (const line of result.capture.lines) {
      expect(JSON.parse(line)).toMatchObject({
        level: 'info',
        context: 'Seed',
        correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
      });
    }
    expect(result.capture.lines.join('\n')).not.toContain(SECRET);
  });
});
