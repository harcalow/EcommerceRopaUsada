import { createHash } from 'node:crypto';

import type { TokenGenerator } from '../../src/modules/auth/application/ports/token-generator';

const TOKEN_LENGTH = 43;

/** Generador de tokens de prueba: únicos y con la forma de un token real, sin aleatoriedad. */
export class CounterTokenGenerator implements TokenGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return String(this.counter).padStart(TOKEN_LENGTH, 'T');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  isWellFormed(token: string): boolean {
    return /^[A-Za-z0-9_-]{43}$/.test(token);
  }
}
