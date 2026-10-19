import type { PipeTransform } from '@nestjs/common';
import { PROBLEM_TYPES, type ProblemFieldError } from '@perchados/contracts';
import type { z } from 'zod';

import { ProblemException } from '../errors/problem.exception';

/** Convierte las incidencias de Zod en `errors[]` por campo (`path` con puntos, sin valores). */
export function toFieldErrors(issues: readonly z.core.$ZodIssue[]): ProblemFieldError[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/** Valida la entrada con un esquema Zod de `@perchados/contracts`; si falla, 400 `validation-error`. */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<unknown> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throw new ProblemException({
      type: PROBLEM_TYPES.validationError,
      errors: toFieldErrors(result.error.issues),
    });
  }
}
