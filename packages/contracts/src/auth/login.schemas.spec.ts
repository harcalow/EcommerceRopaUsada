import { describe, expect, it } from 'vitest';

import { accountLockedSchema, loginPasswordSchema, loginRequestSchema } from './login.schemas';

const messages = (value: unknown): string[] => {
  const result = loginPasswordSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('loginPasswordSchema (RF-016)', () => {
  it.each(['', undefined])('CA-002: %j se rechaza con «Escribe tu contraseña»', (value) => {
    expect(messages(value)).toEqual(['Escribe tu contraseña']);
  });

  it('CA-015: 7 caracteres se rechazan', () => {
    expect(messages('1234567')).toEqual(['La contraseña debe tener al menos 8 caracteres']);
  });

  it('CB-015: 8 caracteres se aceptan', () => {
    expect(loginPasswordSchema.parse('12345678')).toBe('12345678');
  });

  it('CB-016: acepta espacios y símbolos sin tocarlos', () => {
    expect(loginPasswordSchema.parse('Perch@ 2026')).toBe('Perch@ 2026');
    expect(loginPasswordSchema.parse('  espacios  ')).toBe('  espacios  ');
  });

  it('acepta 128 caracteres y rechaza 129', () => {
    expect(loginPasswordSchema.safeParse('a'.repeat(128)).success).toBe(true);
    expect(messages('a'.repeat(129))).toEqual(['La contraseña no puede superar 128 caracteres']);
  });
});

describe('loginRequestSchema', () => {
  it('acepta y normaliza una petición válida', () => {
    expect(loginRequestSchema.parse({ username: ' Harold ', password: 'Perch@ 2026' })).toEqual({
      username: 'Harold',
      password: 'Perch@ 2026',
    });
  });

  it('rechaza campos extra y campos ausentes', () => {
    expect(loginRequestSchema.safeParse({ username: 'a', password: '12345678', role: 'admin' }).success).toBe(false);
    const missing = loginRequestSchema.safeParse({});
    expect(missing.success ? [] : missing.error.issues.map((i) => i.message)).toEqual([
      'Escribe tu usuario',
      'Escribe tu contraseña',
    ]);
  });
});

describe('accountLockedSchema', () => {
  const base = {
    type: 'auth/account-locked',
    title: 'Cuenta bloqueada',
    status: 423,
    detail: 'Intenta de nuevo más tarde',
    correlationId: 'c0ffee00-0000-4000-8000-000000000003',
  };

  it('exige lockedMinutesRemaining entero >= 1', () => {
    expect(accountLockedSchema.safeParse({ ...base, lockedMinutesRemaining: 30 }).success).toBe(true);
    expect(accountLockedSchema.safeParse({ ...base, lockedMinutesRemaining: 0 }).success).toBe(false);
    expect(accountLockedSchema.safeParse(base).success).toBe(false);
  });
});
