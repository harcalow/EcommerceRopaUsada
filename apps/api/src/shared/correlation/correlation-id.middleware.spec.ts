import { CORRELATION_ID_HEADER } from '@perchados/contracts';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  correlationIdMiddleware,
  isValidCorrelationId,
  resolveCorrelationId,
} from './correlation-id.middleware';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('isValidCorrelationId', () => {
  it.each(['abc', 'A.b_c-1', 'a'.repeat(128)])('acepta %s', (id) => {
    expect(isValidCorrelationId(id)).toBe(true);
  });

  it.each(['', 'a'.repeat(129), 'con espacio', 'ñandú', 'a/b', 'a\nb', undefined, 42])(
    'rechaza %s',
    (id) => {
      expect(isValidCorrelationId(id)).toBe(false);
    },
  );
});

describe('resolveCorrelationId', () => {
  it('reutiliza un id válido', () => {
    expect(resolveCorrelationId('req-123')).toBe('req-123');
  });

  it.each(['a'.repeat(129), 'mal id!', undefined])('genera un id nuevo ante %s', (incoming) => {
    expect(resolveCorrelationId(incoming)).toMatch(UUID);
  });
});

describe('correlationIdMiddleware', () => {
  function run(incoming: string | undefined) {
    const req = { id: undefined, header: () => incoming } as unknown as Request;
    const setHeader = vi.fn();
    const res = { setHeader } as unknown as Response;
    const next = vi.fn<(error?: unknown) => void>();
    correlationIdMiddleware(req, res, next as NextFunction);
    return { req, setHeader, next };
  }

  it('fija req.id, devuelve la cabecera y continúa', () => {
    const { req, setHeader, next } = run('abc-1');

    expect(req.id).toBe('abc-1');
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'abc-1');
    expect(next).toHaveBeenCalledOnce();
  });

  it('sustituye un id inválido por uno nuevo', () => {
    const { req, setHeader } = run('no válido');

    expect(req.id).toMatch(UUID);
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, req.id);
  });
});
