import { describe, expect, it } from 'vitest';

import { CryptoTokenGenerator } from './crypto-token-generator';

describe('CryptoTokenGenerator', () => {
  const generator = new CryptoTokenGenerator();

  it('RT-011: genera tokens base64url de 256 bits, distintos cada vez', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generator.generate()));

    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    }
  });

  it('hash es SHA-256 hexadecimal de 64 caracteres, determinista y distinto del token', () => {
    const token = generator.generate();

    expect(generator.hash(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(generator.hash(token)).toBe(generator.hash(token));
    expect(generator.hash(token)).not.toContain(token);
    expect(generator.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('isWellFormed acepta un token generado y rechaza basura, vacíos y textos largos', () => {
    expect(generator.isWellFormed(generator.generate())).toBe(true);
    for (const bad of ['', 'abc', 'a'.repeat(44), `${'a'.repeat(42)}!`, 'a'.repeat(10_000)]) {
      expect(generator.isWellFormed(bad)).toBe(false);
    }
  });
});
