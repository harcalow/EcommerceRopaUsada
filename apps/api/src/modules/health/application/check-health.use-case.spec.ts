import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckHealthUseCase, type HealthOptions } from './check-health.use-case';
import type { DatabaseProbe } from './ports/database-probe';

const TIMEOUT_MS = 2000;
const TTL_MS = 2000;

class FakeProbe implements DatabaseProbe {
  calls = 0;
  behavior: () => Promise<void> = () => Promise.resolve();

  check(): Promise<void> {
    this.calls += 1;
    return this.behavior();
  }
}

describe('CheckHealthUseCase (RT-016)', () => {
  let clockMs: number;
  let probe: FakeProbe;
  let useCase: CheckHealthUseCase;

  beforeEach(() => {
    vi.useFakeTimers();
    clockMs = 1_000_000;
    probe = new FakeProbe();
    const options: HealthOptions = { timeoutMs: TIMEOUT_MS, cacheTtlMs: TTL_MS };
    useCase = new CheckHealthUseCase(probe, options, { now: () => new Date(clockMs) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('informa database up cuando la comprobación responde', async () => {
    await expect(useCase.execute()).resolves.toEqual({ database: 'up' });
  });

  it('informa database down si la comprobación falla, sin propagar el error', async () => {
    probe.behavior = () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

    await expect(useCase.execute()).resolves.toEqual({ database: 'down' });
  });

  it('informa database down al superar el tiempo máximo y no antes', async () => {
    probe.behavior = () => new Promise<void>(() => undefined);
    let settled = false;
    const pending = useCase.execute().then((report) => {
      settled = true;
      return report;
    });

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ database: 'down' });
  });

  it('no deja temporizadores pendientes cuando la comprobación responde a tiempo', async () => {
    await useCase.execute();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('dos llamadas seguidas hacen una sola consulta', async () => {
    await useCase.execute();
    clockMs += TTL_MS - 1;
    await useCase.execute();

    expect(probe.calls).toBe(1);
  });

  it('las llamadas simultáneas comparten la misma consulta', async () => {
    const results = await Promise.all([useCase.execute(), useCase.execute(), useCase.execute()]);

    expect(probe.calls).toBe(1);
    expect(results).toEqual([{ database: 'up' }, { database: 'up' }, { database: 'up' }]);
  });

  it('pasados 2 s vuelve a consultar y se recupera sin reiniciar', async () => {
    probe.behavior = () => Promise.reject(new Error('down'));
    await expect(useCase.execute()).resolves.toEqual({ database: 'down' });

    probe.behavior = () => Promise.resolve();
    clockMs += TTL_MS;

    await expect(useCase.execute()).resolves.toEqual({ database: 'up' });
    expect(probe.calls).toBe(2);
  });

  it('también guarda en caché el resultado down durante 2 s', async () => {
    probe.behavior = () => Promise.reject(new Error('down'));
    await useCase.execute();
    probe.behavior = () => Promise.resolve();
    clockMs += TTL_MS - 1;

    await expect(useCase.execute()).resolves.toEqual({ database: 'down' });
    expect(probe.calls).toBe(1);
  });
});
