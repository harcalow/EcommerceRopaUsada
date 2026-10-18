import { HttpException } from '@nestjs/common';
import { PROBLEM_TYPES, type ProblemType } from '@perchados/contracts';

import { ProblemException } from '../problem.exception';

import { buildProblemSpec, type ProblemSpec } from './problem-catalog';

const TYPE_BY_STATUS: ReadonlyMap<number, ProblemType> = new Map([
  [400, PROBLEM_TYPES.malformedRequest],
  [401, PROBLEM_TYPES.unauthenticated],
  [403, PROBLEM_TYPES.forbidden],
  [404, PROBLEM_TYPES.notFound],
  [413, PROBLEM_TYPES.payloadTooLarge],
  [429, PROBLEM_TYPES.rateLimitExceeded],
]);

const CLIENT_ERROR_MIN = 400;
const SERVER_ERROR_MIN = 500;
const ENTITY_TOO_LARGE = 'entity.too.large';

interface BodyParserError {
  readonly status: number;
  readonly type: string;
}

/** Error de `body-parser`/`http-errors`: lleva `status` (4xx) y un `type` textual. */
function isBodyParserError(error: unknown): error is BodyParserError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { status, type } = error as Partial<BodyParserError>;
  return typeof status === 'number' && status >= 400 && status < 500 && typeof type === 'string';
}

/**
 * Traduce cualquier excepción a un `ProblemSpec` sin exponer su mensaje original:
 * título y detalle salen siempre del catálogo, salvo en `ProblemException`. Una `HttpException` 4xx
 * sin tipo propio (405, 406, 415…) conserva su estado con el tipo genérico `request-rejected`.
 */
export function toProblemSpec(exception: unknown): ProblemSpec {
  if (exception instanceof ProblemException) {
    return exception.spec;
  }
  if (isBodyParserError(exception)) {
    return buildProblemSpec(
      exception.type === ENTITY_TOO_LARGE
        ? PROBLEM_TYPES.payloadTooLarge
        : PROBLEM_TYPES.malformedRequest,
    );
  }
  if (exception instanceof HttpException) {
    const type = TYPE_BY_STATUS.get(exception.getStatus());
    if (type !== undefined) {
      return buildProblemSpec(type);
    }
    const status = exception.getStatus();
    if (status >= CLIENT_ERROR_MIN && status < SERVER_ERROR_MIN) {
      return buildProblemSpec(PROBLEM_TYPES.requestRejected, { status });
    }
  }
  return buildProblemSpec(PROBLEM_TYPES.internalError);
}
