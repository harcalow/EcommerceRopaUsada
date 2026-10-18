// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { readCsrfToken } from './csrf-token';

afterEach(() => {
  document.cookie = 'perchados_csrf=; max-age=0';
});

describe('readCsrfToken', () => {
  it('lee la cookie CSRF entre otras', () => {
    expect(readCsrfToken('a=1; perchados_csrf=tok%2B1; b=2')).toBe('tok+1');
  });

  it('prefiere la cookie con prefijo __Secure-', () => {
    expect(readCsrfToken('perchados_csrf=plain; __Secure-perchados_csrf=secure')).toBe('secure');
  });

  it('devuelve undefined si no hay cookie CSRF', () => {
    expect(readCsrfToken('a=1')).toBeUndefined();
    expect(readCsrfToken('')).toBeUndefined();
  });

  it('usa document.cookie por defecto', () => {
    document.cookie = 'perchados_csrf=desdeDocumento';
    expect(readCsrfToken()).toBe('desdeDocumento');
  });
});
