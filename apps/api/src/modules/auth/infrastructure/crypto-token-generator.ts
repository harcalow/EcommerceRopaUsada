import { createHash, randomBytes } from 'node:crypto';

import type { TokenGenerator } from '../application/ports/token-generator';

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Tokens de 256 bits con `crypto.randomBytes` y SHA-256 (ADR-007). */
export class CryptoTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  isWellFormed(token: string): boolean {
    return TOKEN_PATTERN.test(token);
  }
}
