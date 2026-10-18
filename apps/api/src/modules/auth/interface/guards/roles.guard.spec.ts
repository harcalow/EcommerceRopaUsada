import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { ProblemException } from '../../../../shared/errors/problem.exception';
import { IS_PUBLIC_KEY } from '../../../../shared/http/public.decorator';
import type { ValidSession } from '../../application/validate-session.use-case';
import type { AuthenticatedRequest } from '../authenticated-request';
import { ROLES_KEY } from '../decorators/roles';

import { RolesGuard } from './roles.guard';

function session(role: string): ValidSession {
  return { sessionId: 's', accountId: 'a', role, expiresAt: new Date(0), csrfTokenHash: 'h' };
}

function build(
  metadata: Record<string, unknown>,
  authSession?: ValidSession,
): { guard: RolesGuard; context: ExecutionContext } {
  const reflector = {
    getAllAndOverride: (key: string): unknown => metadata[key],
  } as unknown as Reflector;
  const request = { authSession } as AuthenticatedRequest;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(reflector), context };
}

function statusOf(run: () => unknown): number {
  try {
    run();
  } catch (error) {
    if (error instanceof ProblemException) {
      return error.getStatus();
    }
  }
  throw new Error('se esperaba una ProblemException');
}

describe('RolesGuard', () => {
  it('deja pasar una ruta sin @Roles', () => {
    const { guard, context } = build({}, session('buyer'));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deja pasar una ruta @Public aunque declare @Roles', () => {
    const { guard, context } = build({ [IS_PUBLIC_KEY]: true, [ROLES_KEY]: ['admin'] });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite el rol exigido', () => {
    const { guard, context } = build({ [ROLES_KEY]: ['admin'] }, session('admin'));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rechaza otro rol con 403', () => {
    const { guard, context } = build({ [ROLES_KEY]: ['admin'] }, session('buyer'));

    expect(statusOf(() => guard.canActivate(context))).toBe(403);
  });

  it('falla cerrado: con @Roles y sin sesión adjunta responde 401', () => {
    const { guard, context } = build({ [ROLES_KEY]: ['admin'] });

    expect(statusOf(() => guard.canActivate(context))).toBe(401);
  });

  it('compara exactamente el código del rol', () => {
    const { guard, context } = build({ [ROLES_KEY]: ['admin'] }, session('Admin'));

    expect(statusOf(() => guard.canActivate(context))).toBe(403);
  });
});
