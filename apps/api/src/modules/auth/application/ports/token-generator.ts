/** Token de inyección del puerto `TokenGenerator`. */
export const TOKEN_GENERATOR = Symbol('TOKEN_GENERATOR');

/** Generación y hash de los tokens de sesión y CSRF (ADR-007). */
export interface TokenGenerator {
  /** Token aleatorio criptográfico de 256 bits en base64url (43 caracteres). */
  generate(): string;
  /** SHA-256 en hexadecimal (64 caracteres): lo único que se guarda del token. */
  hash(token: string): string;
  /** Indica si el texto tiene la forma de un token generado, para descartar basura sin consultar la BD. */
  isWellFormed(token: string): boolean;
}
