import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoggerLoginAudit } from './logger-login-audit';

describe('LoggerLoginAudit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('el acierto se registra en nivel info con el nombre del evento y el accountId', () => {
    const info = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    new LoggerLoginAudit().record({ name: 'auth.login.succeeded', accountId: 'a-1' });

    expect(info).toHaveBeenCalledWith({
      message: 'auth.login.succeeded',
      event: 'auth.login.succeeded',
      accountId: 'a-1',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('el logout se registra en nivel info con el accountId', () => {
    const info = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    new LoggerLoginAudit().record({ name: 'auth.logout', accountId: 'a-1' });

    expect(info).toHaveBeenCalledWith({
      message: 'auth.logout',
      event: 'auth.logout',
      accountId: 'a-1',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: 'auth.login.failed', reason: 'unknown-user' } as const],
    [{ name: 'auth.login.locked', accountId: 'a-1' } as const],
  ])('los fallos y bloqueos se registran en nivel warn', (event) => {
    const info = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    new LoggerLoginAudit().record(event);

    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: event.name }));
    expect(info).not.toHaveBeenCalled();
  });
});
