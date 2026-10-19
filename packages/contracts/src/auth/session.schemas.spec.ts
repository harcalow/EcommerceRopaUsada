import { describe, expect, it } from 'vitest';

import { sessionInfoSchema } from './session.schemas';

describe('sessionInfoSchema', () => {
  it('acepta rol y fecha ISO-8601', () => {
    expect(sessionInfoSchema.safeParse({ role: 'admin', expiresAt: '2026-10-16T12:00:00.000Z' }).success).toBe(true);
  });

  it('rechaza fechas inválidas, rol vacío y campos extra', () => {
    expect(sessionInfoSchema.safeParse({ role: 'admin', expiresAt: 'mañana' }).success).toBe(false);
    expect(sessionInfoSchema.safeParse({ role: '', expiresAt: '2026-10-16T12:00:00Z' }).success).toBe(false);
    expect(sessionInfoSchema.safeParse({ role: 'admin', expiresAt: '2026-10-16T12:00:00Z', id: 1 }).success).toBe(false);
  });
});
