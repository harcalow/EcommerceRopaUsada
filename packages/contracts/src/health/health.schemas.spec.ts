import { describe, expect, it } from 'vitest';

import { healthOkSchema, healthUnavailableSchema } from './health.schemas';

const unavailable = {
  type: 'health/unavailable',
  title: 'Servicio no disponible',
  status: 503,
  detail: 'La base de datos no responde',
  correlationId: 'c0ffee00-0000-4000-8000-000000000002',
  checks: { database: 'down' },
};

describe('healthOkSchema (RT-016)', () => {
  it('acepta la respuesta 200 y rechaza campos extra o estados distintos', () => {
    const ok = { status: 'ok', checks: { database: 'up' } };

    expect(healthOkSchema.safeParse(ok).success).toBe(true);
    expect(healthOkSchema.safeParse({ ...ok, version: '1' }).success).toBe(false);
    expect(healthOkSchema.safeParse({ ...ok, checks: { database: 'up', redis: 'up' } }).success).toBe(
      false,
    );
    expect(healthOkSchema.safeParse({ ...ok, status: 'degraded' }).success).toBe(false);
  });
});

describe('healthUnavailableSchema (RT-016)', () => {
  it('acepta el problema 503 con checks.database down', () => {
    expect(healthUnavailableSchema.safeParse(unavailable).success).toBe(true);
  });

  it('rechaza otro tipo, otro estado, campos extra y checks ausentes', () => {
    expect(healthUnavailableSchema.safeParse({ ...unavailable, status: 500 }).success).toBe(false);
    expect(healthUnavailableSchema.safeParse({ ...unavailable, type: 'internal-error' }).success).toBe(
      false,
    );
    expect(healthUnavailableSchema.safeParse({ ...unavailable, extra: true }).success).toBe(false);
    expect(healthUnavailableSchema.safeParse({ ...unavailable, checks: undefined }).success).toBe(false);
  });
});
