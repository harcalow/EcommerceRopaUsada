import '../common/zod-openapi';
import { z } from 'zod';

import { passwordInputSchema } from '../common/password';
import { problemShape } from '../common/problem';

import { CREDENTIAL_MESSAGES, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './login.rules';
import { usernameSchema } from './username';

export { PASSWORD_MIN_LENGTH } from './login.rules';

export const loginPasswordSchema = passwordInputSchema
  .min(1, { error: CREDENTIAL_MESSAGES.passwordRequired, abort: true })
  .min(PASSWORD_MIN_LENGTH, { error: CREDENTIAL_MESSAGES.passwordTooShort })
  .openapi({ maxLength: PASSWORD_MAX_LENGTH });

export const loginRequestSchema = z.strictObject({
  username: usernameSchema,
  password: loginPasswordSchema,
});

export const accountLockedSchema = z.strictObject({
  ...problemShape,
  type: z.literal('auth/account-locked'),
  status: z.literal(423),
  lockedMinutesRemaining: z.number().int().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AccountLocked = z.infer<typeof accountLockedSchema>;
