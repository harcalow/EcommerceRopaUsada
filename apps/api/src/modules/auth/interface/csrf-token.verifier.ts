import { timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { TOKEN_GENERATOR, type TokenGenerator } from '../application/ports/token-generator';

/** Cabecera en la que el cliente devuelve el token CSRF leído de su cookie. */
export const CSRF_HEADER = 'x-csrf-token';

/** Compara el token CSRF presentado con el hash guardado en la sesión, en tiempo constante (RT-012). */
@Injectable()
export class CsrfTokenVerifier {
  constructor(@Inject(TOKEN_GENERATOR) private readonly tokens: TokenGenerator) {}

  matches(presented: string | undefined, expectedHash: string): boolean {
    if (presented === undefined || !this.tokens.isWellFormed(presented)) {
      return false;
    }
    const actual = Buffer.from(this.tokens.hash(presented), 'utf8');
    const expected = Buffer.from(expectedHash, 'utf8');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
