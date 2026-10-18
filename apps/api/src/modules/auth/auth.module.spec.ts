import { APP_GUARD } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { RateLimitGuard } from '../../shared/rate-limit';

import { AuthModule } from './auth.module';
import { CsrfGuard } from './interface/guards/csrf.guard';
import { RolesGuard } from './interface/guards/roles.guard';
import { SessionGuard } from './interface/guards/session.guard';

interface GuardProvider {
  readonly provide: unknown;
  readonly useClass?: unknown;
}

describe('Orden de los guards globales (RT-013)', () => {
  it('registra RateLimitGuard, SessionGuard, RolesGuard y CsrfGuard en ese orden', () => {
    const providers = Reflect.getMetadata('providers', AuthModule) as GuardProvider[];

    const guards = providers
      .filter((provider) => provider.provide === APP_GUARD)
      .map((provider) => provider.useClass);

    expect(guards).toEqual([RateLimitGuard, SessionGuard, RolesGuard, CsrfGuard]);
  });
});
