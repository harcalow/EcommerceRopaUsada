import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  buildRateLimitKey,
  buildThrottlerOptions,
  GLOBAL_THROTTLER,
  STRICT_THROTTLER,
  WINDOW_MS,
} from './throttler-options';

function SampleController(): void {
  return undefined;
}

function login(): void {
  return undefined;
}

const context = {
  getClass: () => SampleController,
  getHandler: () => login,
} as unknown as ExecutionContext;

describe('buildRateLimitKey', () => {
  it('el límite global usa solo la IP', () => {
    expect(buildRateLimitKey(context, '203.0.113.1', GLOBAL_THROTTLER)).toBe('global:203.0.113.1');
  });

  it('el límite estricto añade la ruta', () => {
    expect(buildRateLimitKey(context, '203.0.113.1', STRICT_THROTTLER)).toBe(
      'strict:203.0.113.1:SampleController.login',
    );
  });

  it('sin IP resoluble comparte un único cubo (falla hacia más estricto)', () => {
    expect(buildRateLimitKey(context, undefined, GLOBAL_THROTTLER)).toBe('global:unknown');
    expect(buildRateLimitKey(context, '', GLOBAL_THROTTLER)).toBe('global:unknown');
  });
});

describe('buildThrottlerOptions', () => {
  const storage = { increment: () => Promise.reject(new Error('unused')) };
  const options = buildThrottlerOptions({ globalPerMin: 100, authPerMin: 10 }, storage);

  it('define los límites global y estricto en ventanas de un minuto', () => {
    if (Array.isArray(options)) {
      throw new Error('options must be an object');
    }
    expect(options.throttlers).toMatchObject([
      { name: GLOBAL_THROTTLER, limit: 100, ttl: WINDOW_MS },
      { name: STRICT_THROTTLER, limit: 10, ttl: WINDOW_MS },
    ]);
    expect(options.setHeaders).toBe(false);
    expect(options.storage).toBe(storage);
  });
});
