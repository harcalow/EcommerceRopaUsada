import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { PROBLEM_TYPES } from '@perchados/contracts';

import { ProblemException } from '../../../../shared/errors/problem.exception';
import type { ValidSession } from '../../application/validate-session.use-case';
import type { AuthenticatedRequest } from '../authenticated-request';

/** Sesión validada por el `SessionGuard`; en una ruta pública no existe y responde 401. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ValidSession => {
    const { authSession } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (authSession === undefined) {
      throw new ProblemException({ type: PROBLEM_TYPES.unauthenticated });
    }
    return authSession;
  },
);
