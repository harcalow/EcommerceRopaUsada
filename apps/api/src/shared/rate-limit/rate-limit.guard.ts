import { type ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { PROBLEM_TYPES } from '@perchados/contracts';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';

import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/load-config';
import { ProblemException } from '../errors/problem.exception';

import { resolveTrackerIp, type TrackerRequest } from './client-ip';

/**
 * Guard global de límite de peticiones (RT-013: el primero de la cadena). Al superar un límite
 * responde 429 `rate-limit-exceeded` (problem+json) con `Retry-After` en segundos hasta el fin de
 * la ventana. El log no incluye la IP ni la clave del contador. El rastreador es la IP del cliente
 * que declara la web con el secreto interno o, si no, `req.ip` (RT-022, ADR-011).
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private readonly rateLimitLogger = new Logger(RateLimitGuard.name);

  @Inject(APP_CONFIG)
  private readonly appConfig!: Pick<AppConfig, 'internalApiSecret'>;

  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const tracker = resolveTrackerIp(req as unknown as TrackerRequest, this.appConfig.internalApiSecret);
    return Promise.resolve(tracker ?? '');
  }

  protected override throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Retry-After', String(Math.max(1, detail.timeToBlockExpire)));
    this.rateLimitLogger.warn({
      message: 'rate limit exceeded',
      route: `${context.getClass().name}.${context.getHandler().name}`,
      limit: detail.limit,
    });
    return Promise.reject(new ProblemException({ type: PROBLEM_TYPES.rateLimitExceeded }));
  }
}
