import { randomUUID } from 'node:crypto';

import { CORRELATION_ID_HEADER, correlationIdSchema } from '@perchados/contracts';
import type { NextFunction, Request, Response } from 'express';

export function isValidCorrelationId(value: unknown): value is string {
  return correlationIdSchema.safeParse(value).success;
}

/** Reutiliza el id entrante si es válido; en otro caso genera uno nuevo. */
export function resolveCorrelationId(incoming: unknown): string {
  return isValidCorrelationId(incoming) ? incoming : randomUUID();
}

/**
 * Fija el id de correlación en `req.id` (que `pino-http` reutiliza) y lo devuelve en la
 * cabecera de la respuesta, también en errores y rutas inexistentes.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = resolveCorrelationId(req.header(CORRELATION_ID_HEADER));
  req.id = id;
  res.setHeader(CORRELATION_ID_HEADER, id);
  next();
}
