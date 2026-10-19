import type { Request } from 'express';

import type { ValidSession } from '../application/validate-session.use-case';

/** Petición a la que el `SessionGuard` adjunta la sesión ya validada. */
export interface AuthenticatedRequest extends Request {
  authSession?: ValidSession;
}
