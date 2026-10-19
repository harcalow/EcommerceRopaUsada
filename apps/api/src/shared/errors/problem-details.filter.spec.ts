import { Logger, type ArgumentsHost } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROBLEM_TYPES } from '@perchados/contracts';

import { ProblemDetailsFilter } from './problem-details.filter';
import { ProblemException } from './problem.exception';

function hostWith(res: object, req: object): ArgumentsHost {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
}

describe('ProblemDetailsFilter', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('no escribe si la respuesta ya empezó a enviarse', () => {
    const status = vi.fn();
    const res = { headersSent: true, status };

    new ProblemDetailsFilter().catch(new Error('x'), hostWith(res, { id: 'abc' }));

    expect(status).not.toHaveBeenCalled();
  });

  it('genera un correlationId si la petición no lo trae', () => {
    const send = vi.fn();
    const chain = { setHeader: vi.fn(), send };
    chain.setHeader.mockReturnValue(chain);
    const res = { headersSent: false, status: vi.fn().mockReturnValue(chain) };

    new ProblemDetailsFilter().catch(new Error('x'), hostWith(res, {}));

    const body = JSON.parse(send.mock.calls[0]?.[0] as string) as { correlationId: string };
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('añade al cuerpo los campos de extensión de la excepción sin pisar los base', () => {
    const send = vi.fn();
    const chain = { setHeader: vi.fn(), send };
    chain.setHeader.mockReturnValue(chain);
    const res = { headersSent: false, status: vi.fn().mockReturnValue(chain) };
    const exception = new ProblemException({
      type: PROBLEM_TYPES.healthUnavailable,
      extensions: { checks: { database: 'down' }, status: 200 },
    });

    new ProblemDetailsFilter().catch(exception, hostWith(res, { id: 'abc' }));

    const body = JSON.parse(send.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(body).toMatchObject({ status: 503, correlationId: 'abc', checks: { database: 'down' } });
  });
});
