import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { PROBLEM_TYPES } from '@perchados/contracts';
import { describe, expect, it } from 'vitest';

import { ProblemException } from '../problem.exception';

import { toProblemSpec } from './exception.mapper';
import { PROBLEM_DEFAULTS } from './problem-catalog';

describe('PROBLEM_DEFAULTS', () => {
  it.each(Object.values(PROBLEM_TYPES))('define estado, título y detalle para %s', (type) => {
    const defaults = PROBLEM_DEFAULTS[type];

    expect(defaults.status).toBeGreaterThanOrEqual(400);
    expect(defaults.title).not.toBe('');
    expect(defaults.detail).not.toBe('');
  });
});

describe('ProblemException', () => {
  it('toma estado, título y detalle por defecto del tipo', () => {
    const exception = new ProblemException({ type: PROBLEM_TYPES.accountLocked });

    expect(exception.spec).toMatchObject({ type: 'auth/account-locked', status: 423 });
    expect(exception.getStatus()).toBe(423);
  });

  it('respeta los campos indicados', () => {
    const errors = [{ path: 'name', message: 'm', code: 'c' }];
    const exception = new ProblemException({
      type: PROBLEM_TYPES.validationError,
      status: 422,
      title: 'T',
      detail: 'D',
      errors,
    });

    expect(exception.spec).toEqual({
      type: 'validation-error',
      status: 422,
      title: 'T',
      detail: 'D',
      errors,
    });
  });
});

describe('toProblemSpec', () => {
  it('devuelve la spec de una ProblemException', () => {
    const exception = new ProblemException({ type: PROBLEM_TYPES.forbidden });

    expect(toProblemSpec(exception)).toBe(exception.spec);
  });

  it('mapea el 413 de body-parser a payload-too-large', () => {
    const spec = toProblemSpec({ status: 413, type: 'entity.too.large', message: 'secreto' });

    expect(spec).toMatchObject({ type: 'payload-too-large', status: 413 });
  });

  it('mapea otro error de body-parser a malformed-request', () => {
    const spec = toProblemSpec({ status: 415, type: 'charset.unsupported' });

    expect(spec).toMatchObject({ type: 'malformed-request', status: 400 });
  });

  it('mapea una HttpException por su estado sin exponer el mensaje', () => {
    expect(toProblemSpec(new NotFoundException('Cannot GET /x'))).toMatchObject({
      type: 'not-found',
      status: 404,
    });
    const badRequest = toProblemSpec(new BadRequestException('Unexpected token {'));
    expect(badRequest).toMatchObject({ type: 'malformed-request' });
    expect(JSON.stringify(badRequest)).not.toContain('Unexpected');
  });

  it.each([405, 406, 415, 418])(
    'una HttpException %i sin tipo propio da request-rejected con su estado y sin exponer el mensaje',
    (status) => {
      const spec = toProblemSpec(new HttpException('detalle-interno', status));

      expect(spec).toMatchObject({ type: 'request-rejected', status });
      expect(JSON.stringify(spec)).not.toContain('detalle-interno');
    },
  );

  it.each([new HttpException('x', 503), new Error('boom'), 'texto', null, { status: 500 }])(
    'responde internal-error ante %s',
    (exception) => {
      expect(toProblemSpec(exception)).toMatchObject({ type: 'internal-error', status: 500 });
    },
  );
});
