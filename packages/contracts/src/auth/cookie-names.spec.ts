import { describe, expect, it } from 'vitest';

import {
  CSRF_COOKIE_NAME,
  SECURE_CSRF_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from './cookie-names';

describe('nombres de cookies compartidos (ADR-007)', () => {
  it('exponen los cuatro nombres, con y sin prefijo __Secure-', () => {
    expect(SESSION_COOKIE_NAME).toBe('perchados_sid');
    expect(CSRF_COOKIE_NAME).toBe('perchados_csrf');
    expect(SECURE_SESSION_COOKIE_NAME).toBe('__Secure-perchados_sid');
    expect(SECURE_CSRF_COOKIE_NAME).toBe('__Secure-perchados_csrf');
  });
});
