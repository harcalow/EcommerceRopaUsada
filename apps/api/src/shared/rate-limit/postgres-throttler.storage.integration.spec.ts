import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { TEST_INTERNAL_API_SECRET } from '../../../test/helpers/internal-secret';
import { prepareTestDatabase } from '../../../test/helpers/db';
import { loadConfig } from '../config/load-config';
import { CLEANUP_PROBABILITY } from '../database/cleanup-probability';
import { PrismaService } from '../database/prisma.service';

import { PostgresThrottlerStorage } from './postgres-throttler.storage';

const TTL_MS = 60_000;
const LIMIT = 5;
const NEVER_CLEAN = (): number => 1;
const ALWAYS_CLEAN = (): number => 0;

describe('PostgresThrottlerStorage (ADR-008)', () => {
  let prisma: PrismaService;
  let storage: PostgresThrottlerStorage;

  const createPrisma = async (): Promise<PrismaService> => {
    const database = await prepareTestDatabase();
    const config = loadConfig({
      DATABASE_URL: database.url,
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      INTERNAL_API_SECRET: TEST_INTERNAL_API_SECRET,
    });
    return new PrismaService(config);
  };

  beforeAll(async () => {
    prisma = await createPrisma();
  });

  beforeEach(async () => {
    await prisma.rateLimitCounter.deleteMany();
    storage = new PostgresThrottlerStorage(prisma, NEVER_CLEAN);
  });

  afterAll(async () => {
    await prisma.rateLimitCounter.deleteMany();
    await prisma.onModuleDestroy();
  });

  it('cuenta los golpes de una clave y no bloquea hasta superar el límite', async () => {
    const first = await storage.increment('k', TTL_MS, LIMIT);
    const second = await storage.increment('k', TTL_MS, LIMIT);

    expect(first).toMatchObject({ totalHits: 1, isBlocked: false, timeToBlockExpire: 0 });
    expect(second).toMatchObject({ totalHits: 2, isBlocked: false });
    expect(second.timeToExpire).toBeGreaterThan(0);
    expect(second.timeToExpire).toBeLessThanOrEqual(TTL_MS / 1000);
  });

  it('bloquea al superar el límite con el tiempo restante de la ventana', async () => {
    let last = await storage.increment('k', TTL_MS, LIMIT);
    for (let i = 0; i < LIMIT; i += 1) {
      last = await storage.increment('k', TTL_MS, LIMIT);
    }

    expect(last.isBlocked).toBe(true);
    expect(last.totalHits).toBe(LIMIT + 1);
    expect(last.timeToBlockExpire).toBe(last.timeToExpire);
  });

  it('acota el contador a límite + 1 para que no crezca sin fin', async () => {
    for (let i = 0; i < LIMIT * 3; i += 1) {
      await storage.increment('k', TTL_MS, LIMIT);
    }

    const row = await prisma.rateLimitCounter.findUniqueOrThrow({ where: { key: 'k' } });
    expect(row.hits).toBe(LIMIT + 1);
  });

  it('no desplaza el fin de la ventana con cada golpe (ventana fija)', async () => {
    await storage.increment('k', TTL_MS, LIMIT);
    const before = await prisma.rateLimitCounter.findUniqueOrThrow({ where: { key: 'k' } });

    await storage.increment('k', TTL_MS, LIMIT);
    const after = await prisma.rateLimitCounter.findUniqueOrThrow({ where: { key: 'k' } });

    expect(after.expiresAt.getTime()).toBe(before.expiresAt.getTime());
  });

  it('reinicia la ventana cuando caduca según la hora de la BD', async () => {
    for (let i = 0; i <= LIMIT; i += 1) {
      await storage.increment('k', TTL_MS, LIMIT);
    }
    await prisma.$executeRaw`UPDATE "rate_limit_counter" SET "expires_at" = now() - interval '1 millisecond' WHERE "key" = 'k'`;

    const next = await storage.increment('k', TTL_MS, LIMIT);

    expect(next).toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('mantiene separadas las claves', async () => {
    await storage.increment('a', TTL_MS, LIMIT);
    const other = await storage.increment('b', TTL_MS, LIMIT);

    expect(other.totalHits).toBe(1);
  });

  it('es atómico: golpes concurrentes se cuentan todos y exactamente `límite` pasan', async () => {
    const total = 40;

    const records = await Promise.all(
      Array.from({ length: total }, () => storage.increment('k', TTL_MS, LIMIT)),
    );

    expect(records.filter((record) => !record.isBlocked)).toHaveLength(LIMIT);
    const passed = records.filter((record) => !record.isBlocked).map((record) => record.totalHits);
    expect(new Set(passed).size).toBe(LIMIT);
  });

  it('persiste entre instancias y conexiones (reinicio de la API)', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      await storage.increment('k', TTL_MS, LIMIT);
    }
    const restartedPrisma = await createPrisma();
    const restarted = new PostgresThrottlerStorage(restartedPrisma, NEVER_CLEAN);

    try {
      const next = await restarted.increment('k', TTL_MS, LIMIT);
      expect(next).toMatchObject({ totalHits: LIMIT + 1, isBlocked: true });
    } finally {
      await restartedPrisma.onModuleDestroy();
    }
  });

  it('limpia los contadores caducados en una fracción de las escrituras', async () => {
    await prisma.$executeRaw`INSERT INTO "rate_limit_counter" ("key", "hits", "expires_at") VALUES ('old', 3, now() - interval '1 hour')`;
    await storage.increment('fresh', TTL_MS, LIMIT);
    expect(await prisma.rateLimitCounter.count({ where: { key: 'old' } })).toBe(1);

    await new PostgresThrottlerStorage(prisma, ALWAYS_CLEAN).increment('fresh', TTL_MS, LIMIT);

    expect(await prisma.rateLimitCounter.count({ where: { key: 'old' } })).toBe(0);
    expect(await prisma.rateLimitCounter.count({ where: { key: 'fresh' } })).toBe(1);
  });

  it('la limpieza ocurre en el 1 % de las escrituras', () => {
    expect(CLEANUP_PROBABILITY).toBe(0.01);
  });
});
