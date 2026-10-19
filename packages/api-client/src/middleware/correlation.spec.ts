import { describe, expect, it } from 'vitest';

import { isValidCorrelationId } from './correlation';

describe('isValidCorrelationId', () => {
  it.each(['abc', 'a.b_c-1', 'x'.repeat(128)])('acepta %s', (value) => {
    expect(isValidCorrelationId(value)).toBe(true);
  });

  it.each([null, undefined, '', 'con espacio', 'x'.repeat(129), 'ñandú'])('rechaza %s', (value) => {
    expect(isValidCorrelationId(value)).toBe(false);
  });
});
