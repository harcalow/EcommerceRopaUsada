import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { ProblemException } from '../errors/problem.exception';

import { toFieldErrors, ZodValidationPipe } from './zod-validation.pipe';

const schema = z.strictObject({
  name: z.string().trim().min(1, { error: 'Escribe el nombre' }),
  tags: z.array(z.string()),
});

function catchError(run: () => unknown): ProblemException {
  try {
    run();
  } catch (error) {
    if (error instanceof ProblemException) {
      return error;
    }
    throw error;
  }
  throw new Error('No se lanzó ningún error');
}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('devuelve el valor transformado por el esquema', () => {
    expect(pipe.transform({ name: '  ana ', tags: [] })).toEqual({ name: 'ana', tags: [] });
  });

  it('lanza 400 validation-error con una entrada por campo', () => {
    const error = catchError(() => pipe.transform({ name: '', tags: [1] }));

    expect(error.spec).toMatchObject({ type: 'validation-error', status: 400 });
    expect(error.spec.errors).toEqual([
      { path: 'name', message: 'Escribe el nombre', code: 'too_small' },
      { path: 'tags.0', message: expect.any(String) as string, code: 'invalid_type' },
    ]);
  });

  it('no incluye los valores recibidos en la respuesta', () => {
    const error = catchError(() => pipe.transform({ name: 'ok', tags: [], extra: 'valor-secreto' }));

    expect(JSON.stringify(error.spec)).not.toContain('valor-secreto');
  });

  it('usa path vacío para un fallo en la raíz', () => {
    const error = catchError(() => pipe.transform(undefined));

    expect(error.spec.errors?.[0]).toMatchObject({ path: '', code: 'invalid_type' });
  });
});

describe('toFieldErrors', () => {
  it('une las rutas anidadas con puntos', () => {
    const result = z.object({ a: z.object({ b: z.string() }) }).safeParse({ a: {} });

    expect(result.success ? [] : toFieldErrors(result.error.issues)).toMatchObject([
      { path: 'a.b' },
    ]);
  });
});
