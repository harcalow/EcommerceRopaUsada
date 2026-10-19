import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import {
  CORRELATION_ID_HEADER,
  PROBLEM_CONTENT_TYPE,
  PROBLEM_TYPES,
  type Problem,
} from '@perchados/contracts';
import type { Request, Response } from 'express';

import { resolveCorrelationId } from '../correlation/correlation-id.middleware';

import { toProblemSpec } from './mappers/exception.mapper';
import type { ProblemSpec } from './mappers/problem-catalog';

const SERVER_ERROR_STATUS = 500;

/**
 * Filtro global: toda excepción (incluidas las del body-parser y las rutas inexistentes)
 * sale como `application/problem+json` con `correlationId`. Los errores 5xx se registran
 * con su traza; la respuesta nunca la incluye.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const correlationId = resolveCorrelationId(req.id);
    const spec = toProblemSpec(exception);

    if (spec.status >= SERVER_ERROR_STATUS) {
      this.logServerError(exception, spec, correlationId);
    } else if (spec.type === PROBLEM_TYPES.requestRejected) {
      this.logger.warn({ message: 'Rejected request', correlationId, status: spec.status });
    }
    if (res.headersSent) {
      return;
    }
    res
      .status(spec.status)
      .setHeader(CORRELATION_ID_HEADER, correlationId)
      .setHeader('Cache-Control', 'no-store')
      .setHeader('Content-Type', PROBLEM_CONTENT_TYPE)
      .send(JSON.stringify(toProblem(spec, correlationId)));
  }

  private logServerError(exception: unknown, spec: ProblemSpec, correlationId: string): void {
    const error = exception instanceof Error ? exception : undefined;
    this.logger.error(
      {
        message: 'Unhandled error',
        correlationId,
        status: spec.status,
        errorName: error?.name ?? typeof exception,
        errorMessage: error?.message,
      },
      error?.stack,
    );
  }
}

function toProblem(spec: ProblemSpec, correlationId: string): Problem & Record<string, unknown> {
  const { type, title, status, detail, errors, extensions } = spec;
  return {
    ...extensions,
    type,
    title,
    status,
    detail,
    correlationId,
    ...(errors === undefined ? {} : { errors: [...errors] }),
  };
}
