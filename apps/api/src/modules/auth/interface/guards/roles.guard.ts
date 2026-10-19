import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PROBLEM_TYPES } from '@perchados/contracts';

import { ProblemException } from '../../../../shared/errors/problem.exception';
import { IS_PUBLIC_KEY } from '../../../../shared/http/public.decorator';
import type { AuthenticatedRequest } from '../authenticated-request';
import { ROLES_KEY } from '../decorators/roles';

/**
 * Guard global, posterior al `SessionGuard`: si la ruta declara `@Roles(...)`, compara con el rol
 * que `ValidateSession` leyó de la BD en esta petición (RF-023, RT-013). Falla cerrado: sin sesión
 * adjunta responde 401 y con otro rol, 403. Las rutas `@Public` y las que no declaran roles pasan.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets) === true) {
      return true;
    }
    const required = this.reflector.getAllAndOverride<readonly string[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (required === undefined) {
      return true;
    }
    const { authSession } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (authSession === undefined) {
      throw new ProblemException({ type: PROBLEM_TYPES.unauthenticated });
    }
    if (!required.includes(authSession.role)) {
      throw new ProblemException({ type: PROBLEM_TYPES.forbidden });
    }
    return true;
  }
}
