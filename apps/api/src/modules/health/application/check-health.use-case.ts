import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '../../../shared/time/clock.port';

import { DATABASE_PROBE, type DatabaseProbe } from './ports/database-probe';

export type DatabaseStatus = 'up' | 'down';

export interface HealthReport {
  readonly database: DatabaseStatus;
}

export interface HealthOptions {
  /** Tiempo máximo de espera de la comprobación (`HEALTH_DB_TIMEOUT_MS`). */
  readonly timeoutMs: number;
  /** Tiempo durante el que se reutiliza el último resultado. */
  readonly cacheTtlMs: number;
}

export const HEALTH_OPTIONS = Symbol('HEALTH_OPTIONS');

interface CacheEntry {
  readonly expiresAt: number;
  readonly report: Promise<HealthReport>;
}

/**
 * Comprueba la base de datos con un tiempo máximo y una caché breve (RT-016): llamadas seguidas
 * comparten una sola consulta, también las simultáneas. No guarda el motivo del fallo.
 */
@Injectable()
export class CheckHealthUseCase {
  private cache: CacheEntry | undefined;

  constructor(
    @Inject(DATABASE_PROBE) private readonly probe: DatabaseProbe,
    @Inject(HEALTH_OPTIONS) private readonly options: HealthOptions,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(): Promise<HealthReport> {
    const now = this.clock.now().getTime();
    if (this.cache !== undefined && now < this.cache.expiresAt) {
      return this.cache.report;
    }
    const report = this.probeWithTimeout();
    this.cache = { expiresAt: now + this.options.cacheTtlMs, report };
    return report;
  }

  private probeWithTimeout(): Promise<HealthReport> {
    return new Promise<HealthReport>((resolve) => {
      const timer = setTimeout(() => {
        resolve({ database: 'down' });
      }, this.options.timeoutMs);
      this.probe.check().then(
        () => {
          clearTimeout(timer);
          resolve({ database: 'up' });
        },
        () => {
          clearTimeout(timer);
          resolve({ database: 'down' });
        },
      );
    });
  }
}
