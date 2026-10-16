import { describe, expect, it } from 'vitest';

import { problemSchema } from './problem';
import { PROBLEM_TYPES, PROBLEM_TYPE_VALUES } from './problem-types';

const validProblem = {
  type: 'auth/invalid-credentials',
  title: 'Credenciales inválidas',
  status: 401,
  detail: 'Usuario o contraseña incorrectos',
  correlationId: 'c0ffee00-0000-4000-8000-000000000001',
};

describe('problemSchema (RT-005)', () => {
  it('acepta un problema válido con y sin errors[]', () => {
    expect(problemSchema.safeParse(validProblem).success).toBe(true);
    expect(
      problemSchema.safeParse({
        ...validProblem,
        type: 'validation-error',
        status: 400,
        errors: [{ path: 'username', message: 'Escribe tu usuario', code: 'too_small' }],
      }).success,
    ).toBe(true);
  });

  it('rechaza un campo extra, también dentro de errors[]', () => {
    expect(problemSchema.safeParse({ ...validProblem, stack: 'traza' }).success).toBe(false);
    expect(
      problemSchema.safeParse({
        ...validProblem,
        errors: [{ path: 'a', message: 'b', code: 'c', extra: 1 }],
      }).success,
    ).toBe(false);
  });

  it('rechaza tipos fuera del catálogo y estados que no son de error', () => {
    expect(problemSchema.safeParse({ ...validProblem, type: 'otro' }).success).toBe(false);
    expect(problemSchema.safeParse({ ...validProblem, status: 200 }).success).toBe(false);
    expect(problemSchema.safeParse({ ...validProblem, status: 401.5 }).success).toBe(false);
  });

  it('exige correlationId y detail', () => {
    expect(problemSchema.safeParse({ ...validProblem, correlationId: undefined }).success).toBe(false);
    expect(problemSchema.safeParse({ ...validProblem, detail: undefined }).success).toBe(false);
  });
});

describe('PROBLEM_TYPES', () => {
  it('contiene los 13 tipos del catálogo sin duplicados', () => {
    expect(PROBLEM_TYPE_VALUES).toHaveLength(13);
    expect(new Set(PROBLEM_TYPE_VALUES).size).toBe(13);
    expect(PROBLEM_TYPES.accountLocked).toBe('auth/account-locked');
    expect(PROBLEM_TYPES.healthUnavailable).toBe('health/unavailable');
  });
});
