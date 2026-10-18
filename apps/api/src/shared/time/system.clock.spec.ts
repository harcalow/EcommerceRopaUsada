import { describe, expect, it } from 'vitest';

import { SystemClock } from './system.clock';

describe('SystemClock', () => {
  it('devuelve la hora actual del sistema', () => {
    const before = Date.now();
    const value = new SystemClock().now().getTime();
    const after = Date.now();

    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(after);
  });

  it('devuelve una instancia nueva en cada llamada para que nadie mute la anterior', () => {
    const clock = new SystemClock();

    expect(clock.now()).not.toBe(clock.now());
  });
});
