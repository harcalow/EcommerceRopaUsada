import { describe, expect, it } from 'vitest';

import { CLIENT_IP_HEADER, INTERNAL_TOKEN_HEADER, resolveTrackerIp } from './client-ip';

const SECRET = 'unit-test-internal-secret-0123456789-abcdef';
const SOCKET_IP = '172.18.0.5';

function request(
  headers: Record<string, string | string[] | undefined>,
  ...socketIp: [] | [string | undefined]
) {
  return { headers, ip: socketIp.length === 0 ? SOCKET_IP : socketIp[0] };
}

const withToken = (clientIp: string | string[] | undefined) =>
  request({ [INTERNAL_TOKEN_HEADER]: SECRET, [CLIENT_IP_HEADER]: clientIp });

describe('resolveTrackerIp (RT-022)', () => {
  it('con el token correcto usa la IPv4 del cliente', () => {
    expect(resolveTrackerIp(withToken('203.0.113.7'), SECRET)).toBe('203.0.113.7');
  });

  it('con el token correcto usa la IPv6 del cliente agrupada por /64', () => {
    expect(resolveTrackerIp(withToken('2001:DB8:1:2::1'), SECRET)).toBe('2001:db8:1:2::/64');
    expect(resolveTrackerIp(withToken('2001:db8:1:2:ffff::9'), SECRET)).toBe('2001:db8:1:2::/64');
  });

  it('sin la cabecera de IP usa req.ip', () => {
    expect(resolveTrackerIp(request({ [INTERNAL_TOKEN_HEADER]: SECRET }), SECRET)).toBe(SOCKET_IP);
  });

  it('agrupa por /64 también la req.ip IPv6', () => {
    expect(resolveTrackerIp(request({}, '2001:db8:9:9::5'), SECRET)).toBe('2001:db8:9:9::/64');
  });

  it.each([
    ['ausente', undefined],
    ['vacío', ''],
    ['de otra longitud', 'corto'],
    ['de más longitud', `${SECRET}extra`],
    ['erróneo con la misma longitud', 'x'.repeat(SECRET.length)],
    ['repetido (lista)', [SECRET, SECRET]],
    ['repetido (unido por comas)', `${SECRET}, ${SECRET}`],
  ])('token %s: ignora la cabecera de IP y usa req.ip', (_name, token) => {
    const result = resolveTrackerIp(
      request({ [INTERNAL_TOKEN_HEADER]: token, [CLIENT_IP_HEADER]: '203.0.113.7' }),
      SECRET,
    );

    expect(result).toBe(SOCKET_IP);
  });

  it.each([
    ['texto', 'abc'],
    ['vacío', ''],
    ['lista con coma', '203.0.113.7, 203.0.113.8'],
    ['con espacios', ' 203.0.113.7 '],
    ['con puerto', '203.0.113.7:80'],
    ['repetido (lista)', ['203.0.113.7', '203.0.113.8']],
  ])('token correcto y valor %s: usa req.ip', (_name, value) => {
    expect(resolveTrackerIp(withToken(value), SECRET)).toBe(SOCKET_IP);
  });

  it('con un secreto configurado vacío nunca confía en la cabecera', () => {
    const result = resolveTrackerIp(
      request({ [INTERNAL_TOKEN_HEADER]: '', [CLIENT_IP_HEADER]: '203.0.113.7' }),
      '',
    );

    expect(result).toBe(SOCKET_IP);
  });

  it('sin token y sin req.ip devuelve undefined', () => {
    expect(resolveTrackerIp(request({}, undefined), SECRET)).toBeUndefined();
  });
});
