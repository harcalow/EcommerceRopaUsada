import { describe, expect, it } from 'vitest';

import { CounterTokenGenerator } from '../../../../test/helpers/counter-token-generator';

import { CsrfTokenVerifier } from './csrf-token.verifier';

describe('CsrfTokenVerifier (RT-012)', () => {
  const tokens = new CounterTokenGenerator();
  const verifier = new CsrfTokenVerifier(tokens);
  const issued = tokens.generate();
  const hash = tokens.hash(issued);

  it('acepta el token cuyo hash coincide', () => {
    expect(verifier.matches(issued, hash)).toBe(true);
  });

  it.each([
    ['ausente', undefined],
    ['distinto', tokens.generate()],
    ['con forma inválida', 'corto'],
    ['vacío', ''],
  ])('rechaza un token %s', (_name, presented) => {
    expect(verifier.matches(presented, hash)).toBe(false);
  });

  it('rechaza si el hash esperado tiene otra longitud', () => {
    expect(verifier.matches(issued, 'abc')).toBe(false);
  });
});
