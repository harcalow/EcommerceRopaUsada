import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';

import { CLEANUP_PROBABILITY } from '../database/cleanup-probability';
import type { PrismaService } from '../database/prisma.service';

/** Registro que devuelve el almacén (el paquete no exporta el tipo). */
type StorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const MS_PER_SECOND = 1000;

interface CounterRow {
  readonly hits: number;
  readonly ttl_seconds: number;
}

/**
 * Almacén de `@nestjs/throttler` en PostgreSQL (ADR-008): sobrevive a reinicios y lo comparten
 * varias instancias. Ventana fija por clave; el incremento es una única sentencia atómica
 * (`INSERT ... ON CONFLICT DO UPDATE`) con la hora de la BD, así que las peticiones concurrentes
 * no pueden saltarse el límite ni depender de relojes distintos.
 */
export class PostgresThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(PostgresThrottlerStorage.name);

  constructor(
    private readonly prisma: Pick<PrismaService, '$queryRaw' | '$executeRaw'>,
    private readonly random: () => number = Math.random,
  ) {}

  /** `ttl` en milisegundos; `blockDuration` se ignora: se bloquea hasta que acaba la ventana. */
  async increment(key: string, ttl: number, limit: number): Promise<StorageRecord> {
    const ttlSeconds = ttl / MS_PER_SECOND;
    const cap = limit + 1;
    const rows = await this.prisma.$queryRaw<CounterRow[]>`
      INSERT INTO "rate_limit_counter" AS c ("key", "hits", "expires_at")
      VALUES (${key}, 1, now() + make_interval(secs => ${ttlSeconds}::double precision))
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN c."expires_at" <= now() THEN 1 ELSE LEAST(c."hits" + 1, ${cap}::int) END,
        "expires_at" = CASE WHEN c."expires_at" <= now() THEN EXCLUDED."expires_at" ELSE c."expires_at" END
      RETURNING c."hits" AS "hits",
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (c."expires_at" - now()))))::int AS "ttl_seconds"`;
    const row = rows[0];
    if (row === undefined) {
      throw new Error('rate_limit_counter upsert returned no row');
    }
    await this.cleanupSometimes();
    const isBlocked = row.hits > limit;
    return {
      totalHits: row.hits,
      timeToExpire: row.ttl_seconds,
      isBlocked,
      timeToBlockExpire: isBlocked ? row.ttl_seconds : 0,
    };
  }

  /** Borra contadores caducados en una fracción de las escrituras; un fallo no afecta a la petición. */
  private async cleanupSometimes(): Promise<void> {
    if (this.random() >= CLEANUP_PROBABILITY) {
      return;
    }
    try {
      await this.prisma.$executeRaw`DELETE FROM "rate_limit_counter" WHERE "expires_at" <= now()`;
    } catch (error) {
      this.logger.warn({
        message: 'rate limit cleanup failed',
        errorName: error instanceof Error ? error.name : typeof error,
      });
    }
  }
}
