import { CORRELATION_ID_HEADER, CORRELATION_ID_PATTERN } from '@perchados/contracts/client';
import type { Middleware } from 'openapi-fetch';

export type CorrelationIdFactory = () => string;

export function isValidCorrelationId(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && CORRELATION_ID_PATTERN.test(value);
}

/**
 * Añade `X-Correlation-Id` a cada petición. Respeta un id ya presente y válido
 * (p. ej. el que el servidor de Next reenvía) y genera uno nuevo en otro caso.
 */
export function createCorrelationMiddleware(
  generateId: CorrelationIdFactory = () => crypto.randomUUID(),
): Middleware {
  return {
    onRequest({ request }) {
      if (!isValidCorrelationId(request.headers.get(CORRELATION_ID_HEADER))) {
        request.headers.set(CORRELATION_ID_HEADER, generateId());
      }
      return request;
    },
  };
}
