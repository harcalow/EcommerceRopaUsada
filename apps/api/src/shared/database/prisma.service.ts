import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/load-config';

import { PrismaClient } from './generated/client';

/** Tiempo máximo para obtener una conexión del pool antes de fallar la consulta. */
export const CONNECTION_TIMEOUT_MS = 5000;

/**
 * Cliente de base de datos. La conexión es perezosa: el pool no abre nada hasta la primera
 * consulta, así que la API arranca aunque PostgreSQL esté detenido y se recupera sola.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: Pick<AppConfig, 'databaseUrl'>) {
    super({
      adapter: new PrismaPg(
        { connectionString: config.databaseUrl, connectionTimeoutMillis: CONNECTION_TIMEOUT_MS },
        {
          onPoolError: (error) => {
            PrismaService.reportPoolError(error);
          },
        },
      ),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private static reportPoolError(error: Error): void {
    new Logger(PrismaService.name).error({
      message: 'database pool error',
      integration: 'postgres',
      errorName: error.name,
    });
  }
}
