import { Global, Module } from '@nestjs/common';

import { CLOCK } from './clock.port';
import { SystemClock } from './system.clock';

/** Provee el reloj del sistema a toda la aplicación. */
@Global()
@Module({
  providers: [{ provide: CLOCK, useClass: SystemClock }],
  exports: [CLOCK],
})
export class TimeModule {}
