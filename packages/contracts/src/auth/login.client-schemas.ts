import * as z from 'zod/mini';

import {
  CREDENTIAL_MESSAGES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_REGEX,
} from './login.rules';

/**
 * Versión ligera (zod/mini) de `loginRequestSchema` para el navegador: mismas reglas, mensajes y orden de
 * comprobación, sin el registro OpenAPI. Una prueba de paridad la compara con el esquema completo.
 */
const usernameClientSchema = z
  .string({ error: CREDENTIAL_MESSAGES.usernameRequired })
  .check(
    z.trim(),
    z.normalize('NFC'),
    z.minLength(1, { error: CREDENTIAL_MESSAGES.usernameRequired, abort: true }),
    z.regex(USERNAME_REGEX, { error: CREDENTIAL_MESSAGES.usernameLettersOnly }),
    z.maxLength(USERNAME_MAX_LENGTH, { error: CREDENTIAL_MESSAGES.usernameTooLong }),
  );

const passwordClientSchema = z
  .string({ error: CREDENTIAL_MESSAGES.passwordRequired })
  .check(
    z.maxLength(PASSWORD_MAX_LENGTH, { error: CREDENTIAL_MESSAGES.passwordTooLong }),
    z.minLength(1, { error: CREDENTIAL_MESSAGES.passwordRequired, abort: true }),
    z.minLength(PASSWORD_MIN_LENGTH, { error: CREDENTIAL_MESSAGES.passwordTooShort }),
  );

export const loginRequestClientSchema = z.strictObject({
  username: usernameClientSchema,
  password: passwordClientSchema,
});

/** Versión ligera de `accountLockedSchema` (423): misma forma que el problema base más los minutos restantes. */
export const accountLockedClientSchema = z.strictObject({
  type: z.literal('auth/account-locked'),
  title: z.string().check(z.minLength(1)),
  status: z.literal(423),
  detail: z.string(),
  correlationId: z.string().check(z.minLength(1)),
  errors: z.optional(
    z.array(z.strictObject({ path: z.string(), message: z.string(), code: z.string() })),
  ),
  lockedMinutesRemaining: z.int().check(z.gte(1)),
});

