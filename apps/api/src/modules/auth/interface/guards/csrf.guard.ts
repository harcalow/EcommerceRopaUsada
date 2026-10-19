import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PROBLEM_TYPES } from '@perchados/contracts';
import type { Request } from 'express';

import { APP_CONFIG } from '../../../../shared/config/config.module';
import type { AppConfig } from '../../../../shared/config/load-config';
import { ProblemException } from '../../../../shared/errors/problem.exception';
import { ValidateSession, type ValidSession } from '../../application/validate-session.use-case';
import type { AuthenticatedRequest } from '../authenticated-request';
import { CSRF_HEADER, CsrfTokenVerifier } from '../csrf-token.verifier';
import { ORIGIN_ONLY_KEY } from '../decorators/origin-only';
import { SessionCookies } from '../session-cookie';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guard global posterior a `SessionGuard` y `RolesGuard` (RT-013, RT-012, ADR-007). En métodos
 * no seguros:
 * 1. un `Origin` presente que no esté en `CORS_ALLOWED_ORIGINS` es 403 (también el login);
 * 2. salvo en rutas `@OriginOnly()`, una sesión vigente exige `X-CSRF-Token` (tiempo constante).
 * La sesión es la que adjuntó el `SessionGuard`; en rutas públicas se valida aquí. Sin sesión
 * vigente no hay token que comprobar (logout idempotente). Un `Origin` ausente no es una
 * petición cruzada de navegador.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(
    private readonly reflector: Reflector,
    private readonly validateSession: ValidateSession,
    private readonly cookies: SessionCookies,
    private readonly verifier: CsrfTokenVerifier,
    @Inject(APP_CONFIG) config: Pick<AppConfig, 'cors'>,
  ) {
    this.allowedOrigins = new Set(config.cors.allowedOrigins);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }
    const origin = request.header('origin');
    if (origin !== undefined && !this.allowedOrigins.has(origin)) {
      throw new ProblemException({ type: PROBLEM_TYPES.csrfInvalid });
    }
    const originOnly = this.reflector.getAllAndOverride<boolean | undefined>(ORIGIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (originOnly === true) {
      return true;
    }
    const session = request.authSession ?? (await this.publicRouteSession(request));
    if (
      session !== undefined &&
      !this.verifier.matches(request.header(CSRF_HEADER), session.csrfTokenHash)
    ) {
      throw new ProblemException({ type: PROBLEM_TYPES.csrfInvalid });
    }
    return true;
  }

  private async publicRouteSession(request: Request): Promise<ValidSession | undefined> {
    const result = await this.validateSession.execute(this.cookies.readSessionToken(request));
    return result.status === 'valid' ? result.session : undefined;
  }
}
