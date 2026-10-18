import { Controller, Get } from '@nestjs/common';
import { PROBLEM_TYPES, type HealthOk } from '@perchados/contracts';

import { ProblemException } from '../../../shared/errors/problem.exception';
import { Public } from '../../../shared/http/public.decorator';
import { SkipRateLimit } from '../../../shared/rate-limit';
import { CheckHealthUseCase } from '../application/check-health.use-case';

/** `GET /v1/health`: público y sin límite de peticiones (RT-016). */
@Public()
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(private readonly checkHealth: CheckHealthUseCase) {}

  @Get()
  async get(): Promise<HealthOk> {
    const { database } = await this.checkHealth.execute();
    if (database === 'down') {
      throw new ProblemException({
        type: PROBLEM_TYPES.healthUnavailable,
        detail: 'La base de datos no responde.',
        extensions: { checks: { database } },
      });
    }
    return { status: 'ok', checks: { database } };
  }
}
