import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../../../shared/config/load-config';

import { readCookie, SessionCookies } from './session-cookie';

const TTL_HOURS = 8;
const OPENED = {
  token: 'T'.repeat(43),
  csrfToken: 'C'.repeat(43),
  expiresAt: new Date('2026-10-16T16:00:00.000Z'),
};

function cookiesFor(env: AppConfig['env'], cookieDomain?: string): SessionCookies {
  return new SessionCookies({ env, session: { ttlHours: TTL_HOURS, cookieDomain } });
}

function writeTo(cookies: SessionCookies, action: 'write' | 'clear'): string[] {
  const headers: string[] = [];
  const response = {
    append: (_name: string, value: string) => headers.push(value),
  } as unknown as Response;
  if (action === 'write') {
    cookies.write(response, OPENED);
  } else {
    cookies.clear(response);
  }
  return headers;
}

describe('readCookie', () => {
  it.each([
    ['a=1; b=2', 'b', '2'],
    ['a=1;b=2', 'a', '1'],
    ['a=1; a=2', 'a', '1'],
    ['a=1', 'b', undefined],
    ['=x; a=1', 'a', '1'],
    [undefined, 'a', undefined],
  ])('lee %j buscando %s', (header, name, expected) => {
    expect(readCookie(header, name)).toBe(expected);
  });

  it('no confunde un nombre con otro que lo contiene', () => {
    expect(readCookie('xperchados_sid=1', 'perchados_sid')).toBeUndefined();
  });
});

describe('SessionCookies (ADR-007)', () => {
  it.each(['development', 'test'] as const)(
    'en %s fija las cookies sin Secure ni prefijo',
    (env) => {
      const [sid, csrf] = writeTo(cookiesFor(env), 'write');

      expect(sid).toBe(
        `perchados_sid=${OPENED.token}; Max-Age=115200; Path=/; HttpOnly; SameSite=Strict`,
      );
      expect(csrf).toBe(
        `perchados_csrf=${OPENED.csrfToken}; Max-Age=115200; Path=/; SameSite=Strict`,
      );
    },
  );

  it.each(['ci', 'production'] as const)(
    'en %s usa Secure y el prefijo __Secure-; solo la de sesión es HttpOnly',
    (env) => {
      const [sid, csrf] = writeTo(cookiesFor(env, 'perchados.com'), 'write');

      expect(sid).toBe(
        `__Secure-perchados_sid=${OPENED.token}; Max-Age=115200; Path=/; Domain=perchados.com; HttpOnly; Secure; SameSite=Strict`,
      );
      expect(csrf).toBe(
        `__Secure-perchados_csrf=${OPENED.csrfToken}; Max-Age=115200; Path=/; Domain=perchados.com; Secure; SameSite=Strict`,
      );
    },
  );

  it('la cookie de sesión no contiene id, rol ni contraseña, solo el token opaco', () => {
    const [sid] = writeTo(cookiesFor('test'), 'write');

    expect(sid?.split(';')[0]).toBe(`perchados_sid=${OPENED.token}`);
  });

  it('borra ambas cookies con Max-Age=0 y los mismos Path, Domain y Secure', () => {
    const [sid, csrf] = writeTo(cookiesFor('production', 'perchados.com'), 'clear');

    expect(sid).toMatch(
      /^__Secure-perchados_sid=; Max-Age=0; Expires=.*GMT; Path=\/; Domain=perchados\.com; HttpOnly; Secure; SameSite=Strict$/,
    );
    expect(csrf).toMatch(
      /^__Secure-perchados_csrf=; Max-Age=0; Expires=.*GMT; Path=\/; Domain=perchados\.com; Secure; SameSite=Strict$/,
    );
  });

  it('lee el token con el nombre que corresponde al entorno', () => {
    const request = {
      headers: { cookie: `perchados_sid=${OPENED.token}; __Secure-perchados_sid=otro` },
    } as unknown as Request;

    expect(cookiesFor('test').readSessionToken(request)).toBe(OPENED.token);
    expect(cookiesFor('production', 'perchados.com').readSessionToken(request)).toBe('otro');
  });
});
