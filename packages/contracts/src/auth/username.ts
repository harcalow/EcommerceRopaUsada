import '../common/zod-openapi';
import { z } from 'zod';

import { CREDENTIAL_MESSAGES, USERNAME_MAX_LENGTH, USERNAME_PATTERN_SOURCE, USERNAME_REGEX } from './login.rules';

export { USERNAME_MAX_LENGTH } from './login.rules';

/** Usuario: recorta, normaliza a NFC, exige solo letras Unicode y un máximo técnico. */
export const usernameSchema = z
  .string({ error: CREDENTIAL_MESSAGES.usernameRequired })
  .trim()
  .normalize('NFC')
  .min(1, { error: CREDENTIAL_MESSAGES.usernameRequired, abort: true })
  .regex(USERNAME_REGEX, { error: CREDENTIAL_MESSAGES.usernameLettersOnly })
  .max(USERNAME_MAX_LENGTH, { error: CREDENTIAL_MESSAGES.usernameTooLong })
  .openapi({ pattern: USERNAME_PATTERN_SOURCE });

/**
 * Minúscula de un solo carácter que nunca alarga la clave: si la minúscula ocupa más de un punto de
 * código (p. ej. `İ` -> `i` + U+0307) se conserva el original. Así la clave nunca supera la longitud
 * del usuario validado (máx. 64) y cabe siempre en `VARCHAR(64)`; además es independiente del
 * contexto (la sigma final no cambia según su posición).
 */
function lowerWithoutExpanding(character: string): string {
  const lower = character.toLowerCase();
  return Array.from(lower).length === 1 ? lower : character;
}

/**
 * Clave de unicidad de un usuario (RF-015, CB-002): la misma normalización de `usernameSchema`
 * (recorte y NFC) más minúsculas sin expansión. Su longitud nunca excede la del usuario. Fuente
 * única para la API y las pruebas E2E.
 */
export function toUsernameKey(username: string): string {
  return Array.from(username.trim().normalize('NFC'), lowerWithoutExpanding).join('');
}
