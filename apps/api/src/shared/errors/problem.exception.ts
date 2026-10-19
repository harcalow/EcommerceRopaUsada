import { HttpException } from '@nestjs/common';
import type { ProblemFieldError, ProblemType } from '@perchados/contracts';

import { buildProblemSpec, type ProblemSpec } from './mappers/problem-catalog';

export interface ProblemExceptionInit {
  readonly type: ProblemType;
  readonly status?: number;
  readonly title?: string;
  readonly detail?: string;
  readonly errors?: readonly ProblemFieldError[];
  readonly extensions?: Readonly<Record<string, unknown>>;
}

/**
 * Error de negocio o de entrada que el filtro global responde como `application/problem+json`.
 * Los campos omitidos toman el valor por defecto de su tipo en `PROBLEM_DEFAULTS`.
 */
export class ProblemException extends HttpException {
  readonly spec: ProblemSpec;

  constructor(init: ProblemExceptionInit) {
    const { type, status, title, detail, errors, extensions } = init;
    const spec = buildProblemSpec(type, {
      ...(status === undefined ? {} : { status }),
      ...(title === undefined ? {} : { title }),
      ...(detail === undefined ? {} : { detail }),
      ...(errors === undefined ? {} : { errors }),
      ...(extensions === undefined ? {} : { extensions }),
    });
    super(spec.title, spec.status);
    this.spec = spec;
  }
}
