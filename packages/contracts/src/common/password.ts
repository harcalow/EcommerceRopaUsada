import './zod-openapi';
import { z } from 'zod';

import { CREDENTIAL_MESSAGES, PASSWORD_MAX_LENGTH } from '../auth/login.rules';

export { PASSWORD_MAX_LENGTH } from '../auth/login.rules';

/** Contraseña tal como llega: sin trim ni otras reglas de composición; solo un máximo técnico. */
export const passwordInputSchema = z
  .string({ error: CREDENTIAL_MESSAGES.passwordRequired })
  .max(PASSWORD_MAX_LENGTH, { error: CREDENTIAL_MESSAGES.passwordTooLong });
