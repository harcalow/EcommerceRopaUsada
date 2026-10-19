import { describe, expect, it } from 'vitest';

import * as client from '../client';
import { accountLockedSchema, loginRequestSchema } from './login.schemas';

const credentialCases: unknown[] = [
  { username: 'ana', password: 'secreta123' },
  { username: '  Ánë  ', password: 'secreta123' },
  { username: 'e\u0301', password: 'secreta123' },
  { username: '', password: '' },
  { username: '   ', password: 'x' },
  { username: 'ana1', password: 'corta' },
  { username: 'a'.repeat(65), password: 'p'.repeat(129) },
  { username: 'ana', password: '' },
  { username: 'ana', password: 'p'.repeat(128) },
  { username: 123, password: null },
  { username: 'ana' },
  { username: 'ana', password: 'secreta123', extra: true },
  'no es un objeto',
  null,
];

const lockedBase = {
  type: 'auth/account-locked',
  title: 'Cuenta bloqueada',
  status: 423,
  detail: 'Cuenta bloqueada temporalmente',
  correlationId: 'abc-123',
  lockedMinutesRemaining: 5,
};

const lockedCases: unknown[] = [
  lockedBase,
  { ...lockedBase, errors: [{ path: 'username', message: 'x', code: 'invalid' }] },
  { ...lockedBase, lockedMinutesRemaining: 0 },
  { ...lockedBase, lockedMinutesRemaining: 1.5 },
  { ...lockedBase, status: 401 },
  { ...lockedBase, type: 'auth/otro' },
  { ...lockedBase, title: '' },
  { ...lockedBase, correlationId: '' },
  { ...lockedBase, extra: 1 },
  { ...lockedBase, errors: [{ path: 'a' }] },
  {},
  undefined,
];

function summarize(result: { success: boolean; data?: unknown; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, issues: (result.error?.issues ?? []).map((i) => ({ path: i.path, message: i.message })) };
}

describe('esquemas ligeros del navegador (paridad con el contrato)', () => {
  it.each(credentialCases.map((input, index) => [index, input] as const))(
    'loginRequestClientSchema coincide con loginRequestSchema (caso %i)',
    (_index, input) => {
      expect(summarize(client.loginRequestClientSchema.safeParse(input))).toEqual(
        summarize(loginRequestSchema.safeParse(input)),
      );
    },
  );

  it.each(lockedCases.map((input, index) => [index, input] as const))(
    'accountLockedClientSchema coincide con accountLockedSchema (caso %i)',
    (_index, input) => {
      expect(client.accountLockedClientSchema.safeParse(input).success).toBe(accountLockedSchema.safeParse(input).success);
    },
  );

  it('expone las constantes que usan la web y el api-client', () => {
    expect(client.CORRELATION_ID_HEADER).toBe('X-Correlation-Id');
    expect(client.PROBLEM_TYPES.accountLocked).toBe('auth/account-locked');
  });
});
