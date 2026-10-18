import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../../shared/database/prisma.service';

import { PrismaDatabaseProbe } from './prisma-database.probe';

function probeWith(queryRaw: () => Promise<unknown>): PrismaDatabaseProbe {
  return new PrismaDatabaseProbe({ $queryRaw: queryRaw } as unknown as PrismaService);
}

describe('PrismaDatabaseProbe', () => {
  it('resuelve cuando la consulta responde', async () => {
    const queryRaw = vi.fn(() => Promise.resolve([{ ok: 1 }]));

    await expect(probeWith(queryRaw).check()).resolves.toBeUndefined();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rechaza con el mismo error cuando la consulta falla', async () => {
    const failure = new Error('connect ECONNREFUSED');

    await expect(probeWith(() => Promise.reject(failure)).check()).rejects.toBe(failure);
  });
});
