import './zod-openapi';
import { z } from 'zod';

import { PROBLEM_TYPE_VALUES } from './problem-types';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const problemFieldErrorSchema = z
  .strictObject({
    path: z.string(),
    message: z.string(),
    code: z.string(),
  })
  ;

export const problemShape = {
  type: z.enum(PROBLEM_TYPE_VALUES),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string(),
  correlationId: z.string().min(1),
  errors: z.array(problemFieldErrorSchema).optional(),
};

export const problemSchema = z.strictObject(problemShape);

export type Problem = z.infer<typeof problemSchema>;
export type ProblemFieldError = z.infer<typeof problemFieldErrorSchema>;
