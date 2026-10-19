import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  loginRequestSchema,
  PROBLEM_TYPES,
  type LoginRequest,
  type SessionInfo,
} from '@perchados/contracts';
import type { Request, Response } from 'express';

import { ProblemException } from '../../../shared/errors/problem.exception';
import { Public } from '../../../shared/http/public.decorator';
import { StrictRateLimit } from '../../../shared/rate-limit';
import { ZodBody } from '../../../shared/validation/zod-body.decorator';
import { LogIn } from '../application/log-in.use-case';
import { RevokeSession } from '../application/revoke-session.use-case';
import type { ValidSession } from '../application/validate-session.use-case';

import { CurrentSession } from './decorators/current-session';
import { OriginOnly } from './decorators/origin-only';
import { SessionCookies } from './session-cookie';

/** `POST /v1/auth/login`, `GET /v1/auth/session` y `POST /v1/auth/logout` (RF-001, RF-011, RF-012). */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly cookies: SessionCookies,
    private readonly logIn: LogIn,
    private readonly revokeSession: RevokeSession,
  ) {}

  /**
   * Público: aún no hay sesión. Solo exige un `Origin` permitido (sin token CSRF) y el límite
   * estricto por IP. Las credenciales incorrectas, la cuenta desactivada y la que no es
   * administradora responden lo mismo (CA-003, CA-019); el bloqueo, 423 con los minutos (CA-007).
   */
  @Public()
  @OriginOnly()
  @StrictRateLimit()
  @Post('login')
  @HttpCode(200)
  async login(
    @ZodBody(loginRequestSchema) body: LoginRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionInfo> {
    const previousToken = this.cookies.readSessionToken(request);
    const result = await this.logIn.execute({
      username: body.username,
      password: body.password,
      ...(previousToken === undefined ? {} : { previousToken }),
    });
    if (result.status === 'locked') {
      throw new ProblemException({
        type: PROBLEM_TYPES.accountLocked,
        extensions: { lockedMinutesRemaining: result.minutesRemaining },
      });
    }
    if (result.status === 'invalid-credentials') {
      throw new ProblemException({ type: PROBLEM_TYPES.invalidCredentials });
    }
    this.cookies.write(response, result.session);
    return { role: result.role, expiresAt: result.session.expiresAt.toISOString() };
  }

  @Get('session')
  session(@CurrentSession() session: ValidSession): SessionInfo {
    return { role: session.role, expiresAt: session.expiresAt.toISOString() };
  }

  /**
   * Público con sesión opcional: el `CsrfGuard` exige el token cuando hay una sesión vigente; sin
   * sesión, caducada o inventada es idempotente y solo borra las cookies (CB-018).
   */
  @Public()
  @StrictRateLimit()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.revokeSession.execute(this.cookies.readSessionToken(request));
    this.cookies.clear(response);
  }
}
