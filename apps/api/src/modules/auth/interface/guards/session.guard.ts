import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PROBLEM_TYPES } from '@perchados/contracts';

import { ProblemException } from '../../../../shared/errors/problem.exception';
import { ValidateSession } from '../../application/validate-session.use-case';
import type { AuthenticatedRequest } from '../authenticated-request';
import { IS_PUBLIC_KEY } from '../../../../shared/http/public.decorator';
import { SessionCookies } from '../session-cookie';

/**
 * Guard global: toda ruta exige una sesión válida salvo las marcadas con `@Public()` (RT-013).
 * Adjunta la sesión (con el rol leído de la BD) a la petición; un fallo siempre es 401, nunca 500.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly validateSession: ValidateSession,
    private readonly cookies: SessionCookies,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const result = await this.validateSession.execute(this.cookies.readSessionToken(request));
    if (result.status === 'valid') {
      request.authSession = result.session;
      return true;
    }
    throw new ProblemException({
      type:
        result.status === 'expired' ? PROBLEM_TYPES.sessionExpired : PROBLEM_TYPES.unauthenticated,
    });
  }
}
