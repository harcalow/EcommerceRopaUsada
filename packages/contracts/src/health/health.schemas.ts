import '../common/zod-openapi';
import { z } from 'zod';

import { problemShape } from '../common/problem';

export const healthOkSchema = z
  .strictObject({
    status: z.literal('ok'),
    checks: z.strictObject({ database: z.literal('up') }),
  })
  ;

export const healthUnavailableSchema = z
  .strictObject({
    ...problemShape,
    type: z.literal('health/unavailable'),
    status: z.literal(503),
    checks: z.strictObject({ database: z.literal('down') }),
  })
  ;

export type HealthOk = z.infer<typeof healthOkSchema>;
export type HealthUnavailable = z.infer<typeof healthUnavailableSchema>;
