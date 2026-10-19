import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveClientIp } from './client-ip';

describe('RT-022: resolveClientIp', () => {
  it('con 0 saltos no devuelve IP aunque haya cabecera', () => {
    expect(resolveClientIp('203.0.113.7', 0)).toBeUndefined();
  });

  it('con 1 salto toma la última entrada', () => {
    expect(resolveClientIp('198.51.100.1, 203.0.113.7', 1)).toBe('203.0.113.7');
  });

  it('con 2 saltos toma la penúltima entrada', () => {
    expect(resolveClientIp('198.51.100.1, 203.0.113.7, 192.0.2.9', 2)).toBe('203.0.113.7');
  });

  it('con más saltos que entradas no devuelve IP', () => {
    expect(resolveClientIp('203.0.113.7', 2)).toBeUndefined();
  });

  it.each([undefined, null, '', '   '])('cabecera %j: sin IP', (header) => {
    expect(resolveClientIp(header, 1)).toBeUndefined();
  });

  it('recorta los espacios de la entrada', () => {
    expect(resolveClientIp('198.51.100.1 ,   203.0.113.7  ', 1)).toBe('203.0.113.7');
  });

  it.each(['no-es-una-ip', '999.1.1.1', '203.0.113.7:8080', 'a, ', '203.0.113.7,'])(
    'entrada que no es IP (%s): sin IP',
    (header) => {
      expect(resolveClientIp(header, 1)).toBeUndefined();
    },
  );

  it('acepta una IPv6 válida', () => {
    expect(resolveClientIp('198.51.100.1, 2001:db8::1', 1)).toBe('2001:db8::1');
  });

  it.each([-1, 1.5, Number.NaN])('saltos inválidos (%s): sin IP', (hops) => {
    expect(resolveClientIp('203.0.113.7', hops)).toBeUndefined();
  });

  it('importa server-only', () => {
    const source = readFileSync(fileURLToPath(new URL('./client-ip.ts', import.meta.url)), 'utf8');
    expect(source).toMatch(/^import 'server-only';/m);
  });
});
