import { Body } from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe';

/** Parámetro `@ZodBody(schema)`: el cuerpo ya validado y tipado; el controlador no se ejecuta si falla. */
export const ZodBody = (schema: z.ZodType): ParameterDecorator =>
  Body(new ZodValidationPipe(schema));
