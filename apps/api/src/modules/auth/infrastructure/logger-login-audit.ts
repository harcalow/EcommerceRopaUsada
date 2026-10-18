import { Injectable, Logger } from '@nestjs/common';

import type { LoginAudit, LoginAuditEvent } from '../application/ports/login-audit';

/** Escribe los eventos de auditoría como logs JSON: `info` el acierto del login y el logout, `warn` los fallos y bloqueos. */
@Injectable()
export class LoggerLoginAudit implements LoginAudit {
  private readonly logger = new Logger(LoggerLoginAudit.name);

  record(event: LoginAuditEvent): void {
    const { name, ...fields } = event;
    const entry = { message: name, event: name, ...fields };
    if (event.name === 'auth.login.succeeded' || event.name === 'auth.logout') {
      this.logger.log(entry);
    } else {
      this.logger.warn(entry);
    }
  }
}
