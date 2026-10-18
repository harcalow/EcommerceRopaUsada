import { describe, expect, it } from 'vitest';

import { CORRELATION_ID_HEADER, CORRELATION_ID_PATTERN, correlationIdSchema } from './correlation';

describe('correlation id', () => {
  it('expone la cabecera estándar', () => {
    expect(CORRELATION_ID_HEADER).toBe('X-Correlation-Id');
  });

  it.each(['abc', 'A.b_c-1', 'a'.repeat(128)])('acepta %s', (id) => {
    expect(CORRELATION_ID_PATTERN.test(id)).toBe(true);
    expect(correlationIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(['', 'a'.repeat(129), 'con espacio', 'a/b'])('rechaza %j', (id) => {
    expect(correlationIdSchema.safeParse(id).success).toBe(false);
  });
});
