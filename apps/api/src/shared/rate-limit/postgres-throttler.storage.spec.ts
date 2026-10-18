import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PostgresThrottlerStorage } from './postgres-throttler.storage';

const TTL_MS = 60_000;
const LIMIT = 5;

function fakePrisma(options: { rows: { hits: number; ttl_seconds: number }[]; cleanupFails?: boolean }) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(options.rows),
    $executeRaw: vi
      .fn()
      .mockImplementation(() =>
        options.cleanupFails === true ? Promise.reject(new Error('db down')) : Promise.resolve(1),
      ),
  };
}

describe('PostgresThrottlerStorage (unidad)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falla de forma cerrada si la BD no devuelve fila', async () => {
    const storage = new PostgresThrottlerStorage(fakePrisma({ rows: [] }), () => 1);

    await expect(storage.increment('k', TTL_MS, LIMIT)).rejects.toThrow(/returned no row/);
  });

  it('un fallo de la limpieza no afecta a la petición y se registra sin datos sensibles', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const prisma = fakePrisma({ rows: [{ hits: 1, ttl_seconds: 60 }], cleanupFails: true });
    const storage = new PostgresThrottlerStorage(prisma, () => 0);

    const record = await storage.increment('secret-key', TTL_MS, LIMIT);

    expect(record).toMatchObject({ totalHits: 1, isBlocked: false });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith({
      message: 'rate limit cleanup failed',
      errorName: 'Error',
    });
  });

  it('no limpia cuando el azar no cae en el 1 %', async () => {
    const prisma = fakePrisma({ rows: [{ hits: 1, ttl_seconds: 60 }] });

    await new PostgresThrottlerStorage(prisma, () => 0.5).increment('k', TTL_MS, LIMIT);

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
