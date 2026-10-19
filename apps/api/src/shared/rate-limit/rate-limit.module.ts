import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/load-config';
import { PrismaService } from '../database/prisma.service';

import { PostgresThrottlerStorage } from './postgres-throttler.storage';
import { buildThrottlerOptions } from './throttler-options';

/**
 * Límite de peticiones (RT-014): contadores en PostgreSQL y dos throttlers, `global` y `strict`.
 * El guard se registra en `AuthModule` para fijar su orden (el primero de los guards globales).
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG, PrismaService],
      useFactory: (config: Pick<AppConfig, 'rateLimit'>, prisma: PrismaService) =>
        buildThrottlerOptions(config.rateLimit, new PostgresThrottlerStorage(prisma)),
    }),
  ],
})
export class RateLimitModule {}
