import { Module, type DynamicModule } from '@nestjs/common';
import type { DestinationStream } from 'pino';

import { ConfigModule } from './shared/config/config.module';
import type { AppConfig } from './shared/config/load-config';
import { DatabaseModule } from './shared/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { createLoggingModule } from './shared/logging/logger.module';
import { RateLimitModule } from './shared/rate-limit/rate-limit.module';
import { TimeModule } from './shared/time/time.module';

export interface AppModuleOptions {
  /** Destino de los logs; por defecto la salida estándar. Se sustituye en pruebas. */
  readonly logDestination?: DestinationStream;
}

@Module({})
export class AppModule {
  static forRoot(config: AppConfig, options: AppModuleOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        createLoggingModule(config, options.logDestination),
        TimeModule,
        DatabaseModule,
        RateLimitModule,
        AuthModule,
        HealthModule,
      ],
    };
  }
}
