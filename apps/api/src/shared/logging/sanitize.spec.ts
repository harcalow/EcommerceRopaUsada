import { describe, expect, it } from 'vitest';

import { REDACTED, isSensitiveKey, sanitize } from './sanitize';

describe('sanitize', () => {
  it('oculta contraseñas, tokens, cookies y Authorization sin importar mayúsculas', () => {
    const result = sanitize({
      Password: 'a',
      newPassword: 'b',
      TOKEN: 'c',
      refreshToken: 'd',
      Authorization: 'Bearer e',
      cookie: 'sid=f',
      'Set-Cookie': 'sid=g',
      user: 'ana',
    });

    expect(result).toEqual({
      Password: REDACTED,
      newPassword: REDACTED,
      TOKEN: REDACTED,
      refreshToken: REDACTED,
      Authorization: REDACTED,
      cookie: REDACTED,
      'Set-Cookie': REDACTED,
      user: 'ana',
    });
  });

  it('RT-022: oculta la cabecera interna X-Perchados-Internal-Token con cualquier capitalización', () => {
    const result = sanitize({
      req: {
        headers: {
          'x-perchados-internal-token': 'secreto-a',
          'X-Perchados-Internal-Token': 'secreto-b',
          'X-PERCHADOS-INTERNAL-TOKEN': 'secreto-c',
          host: 'h',
        },
      },
    });

    expect(result).toEqual({
      req: {
        headers: {
          'x-perchados-internal-token': REDACTED,
          'X-Perchados-Internal-Token': REDACTED,
          'X-PERCHADOS-INTERNAL-TOKEN': REDACTED,
          host: 'h',
        },
      },
    });
  });

  it('actúa a cualquier profundidad, también dentro de arrays', () => {
    const result = sanitize({
      req: { headers: { authorization: 'x', host: 'h' } },
      list: [{ password: 'p' }],
    });

    expect(result).toEqual({
      req: { headers: { authorization: REDACTED, host: 'h' } },
      list: [{ password: REDACTED }],
    });
  });

  it('no muta la entrada y conserva primitivos, nulos y errores', () => {
    const input = { nested: { password: 'p' }, error: new Error('boom'), none: null, count: 3 };

    const result = sanitize(input);

    expect(input.nested.password).toBe('p');
    expect(result.error).toBe(input.error);
    expect(result.none).toBeNull();
    expect(result.count).toBe(3);
    expect(sanitize('texto')).toBe('texto');
  });

  it('recorre también instancias de clase', () => {
    class Carrier {
      authorization = 'Bearer x';
      host = 'h';
    }

    expect(sanitize({ req: new Carrier() })).toEqual({
      req: { authorization: REDACTED, host: 'h' },
    });
  });

  it('resuelve referencias circulares sin desbordar la pila', () => {
    const input: Record<string, unknown> = { name: 'loop' };
    input.self = input;

    expect(sanitize(input)).toEqual({ name: 'loop', self: '[Circular]' });
  });

  it('identifica claves sensibles y deja pasar las que no lo son', () => {
    expect(isSensitiveKey('x-api-key')).toBe(true);
    expect(isSensitiveKey('username')).toBe(false);
  });
});
