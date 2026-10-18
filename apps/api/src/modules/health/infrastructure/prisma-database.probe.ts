import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../shared/database/prisma.service';
import type { DatabaseProbe } from '../application/ports/database-probe';

/** Comprueba PostgreSQL con `SELECT 1`; registra el fallo sin mensajes ni hosts. */
@Injectable()
export class PrismaDatabaseProbe implements DatabaseProbe {
  private readonly logger = new Logger(PrismaDatabaseProbe.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error({
        message: 'health check failed',
        integration: 'postgres',
        errorName: error instanceof Error ? error.name : typeof error,
      });
      throw error;
    }
  }
}
