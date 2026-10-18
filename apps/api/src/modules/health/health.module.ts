import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../../shared/config/config.module';
import type { AppConfig } from '../../shared/config/load-config';
import { TimeModule } from '../../shared/time/time.module';

import {
  CheckHealthUseCase,
  HEALTH_OPTIONS,
  type HealthOptions,
} from './application/check-health.use-case';
import { DATABASE_PROBE } from './application/ports/database-probe';
import { PrismaDatabaseProbe } from './infrastructure/prisma-database.probe';
import { HealthController } from './interface/health.controller';

/** Tiempo durante el que se reutiliza el último resultado del healthcheck. */
export const HEALTH_CACHE_TTL_MS = 2000;

@Module({
  imports: [TimeModule],
  controllers: [HealthController],
  providers: [
    CheckHealthUseCase,
    { provide: DATABASE_PROBE, useClass: PrismaDatabaseProbe },
    {
      provide: HEALTH_OPTIONS,
      inject: [APP_CONFIG],
      useFactory: (config: Pick<AppConfig, 'healthDbTimeoutMs'>): HealthOptions => ({
        timeoutMs: config.healthDbTimeoutMs,
        cacheTtlMs: HEALTH_CACHE_TTL_MS,
      }),
    },
  ],
})
export class HealthModule {}
