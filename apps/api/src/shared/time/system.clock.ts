import { Injectable } from '@nestjs/common';

import type { Clock } from './clock.port';

/** Reloj real del sistema. */
@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
