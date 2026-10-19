import { describe, expect, it } from 'vitest';

import { toUsernameKey, usernameSchema } from './username';

const messages = (value: unknown): string[] => {
  const result = usernameSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('usernameSchema (RF-015)', () => {
  it.each(['', '   ', undefined, null])('CA-002: %j se rechaza con «Escribe tu usuario»', (value) => {
    expect(messages(value)).toEqual(['Escribe tu usuario']);
  });

  it.each(['Harold1', 'Harold_Admin', 'Harold Admin'])(
    'CA-014: %j se rechaza con «El usuario solo puede tener letras»',
    (value) => {
      expect(messages(value)).toEqual(['El usuario solo puede tener letras']);
    },
  );

  it.each(['Ñandú', 'José', 'HaroldAdmin'])('CB-014: %s se acepta', (value) => {
    expect(usernameSchema.parse(value)).toBe(value);
  });

  it('CB-001: recorta los espacios del inicio y del final', () => {
    expect(usernameSchema.parse('  lucia  ')).toBe('lucia');
  });

  it('normaliza a NFC', () => {
    expect(usernameSchema.parse('Jose\u0301')).toBe('Jos\u00e9');
  });

  it('acepta 64 letras y rechaza 65', () => {
    expect(usernameSchema.safeParse('a'.repeat(64)).success).toBe(true);
    expect(messages('a'.repeat(65))).toEqual(['El usuario no puede superar 64 caracteres']);
  });
});

describe('toUsernameKey (RF-015, CB-002)', () => {
  it('recorta y pasa a minúsculas', () => {
    expect(toUsernameKey('  HaroldAdmin ')).toBe('haroldadmin');
  });

  it('CB-002: una forma descompuesta y una compuesta dan la misma clave', () => {
    expect(toUsernameKey('Jose\u0301')).toBe(toUsernameKey('Jos\u00e9'));
  });

  it('CB-002: nunca alarga la clave (İ se conserva) y 64 İ caben en 64 caracteres', () => {
    const username = 'İ'.repeat(64);
    expect(usernameSchema.safeParse(username).success).toBe(true);
    expect(Array.from(toUsernameKey(username))).toHaveLength(64);
    expect(toUsernameKey('İstanbul')).toBe('İstanbul');
  });

  it.each(['HaroldAdmin', 'José', 'Ñandú', 'ΑΘΗΝΑΣ', 'İİ', 'Abİc'])(
    'la clave de %s no es más larga que el usuario y es idempotente',
    (username) => {
      const key = toUsernameKey(username);
      expect(Array.from(key).length).toBeLessThanOrEqual(Array.from(username).length);
      expect(toUsernameKey(key)).toBe(key);
    },
  );

  it('la sigma mayúscula final no depende del contexto', () => {
    expect(toUsernameKey('ΑΣ')).toBe('ασ');
  });

  it('coincide con la normalización de usernameSchema salvo las minúsculas', () => {
    const parsed = usernameSchema.parse('  Jose\u0301 ');
    expect(toUsernameKey('  Jose\u0301 ')).toBe(parsed.toLowerCase());
  });
});
