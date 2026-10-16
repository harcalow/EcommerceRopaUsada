import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { PROBLEM_CONTENT_TYPE, problemFieldErrorSchema, problemSchema } from '../common/problem';
import { healthOkSchema, healthUnavailableSchema } from '../health/health.schemas';

const correlationHeaders = z.object({
  'X-Correlation-Id': z.string().openapi({ description: 'Identificador de correlación' }),
});

export function createV1Registry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  registry.register('ProblemFieldError', problemFieldErrorSchema);
  registry.register('Problem', problemSchema);
  const healthOk = registry.register('HealthOk', healthOkSchema);
  const healthUnavailable = registry.register('HealthUnavailable', healthUnavailableSchema);

  registry.registerPath({
    method: 'get',
    path: '/v1/health',
    operationId: 'getHealth',
    summary: 'Estado de la API y de la base de datos',
    tags: ['health'],
    responses: {
      200: {
        description: 'API y base de datos disponibles',
        headers: correlationHeaders,
        content: { 'application/json': { schema: healthOk } },
      },
      503: {
        description: 'La base de datos no responde',
        headers: correlationHeaders,
        content: { [PROBLEM_CONTENT_TYPE]: { schema: healthUnavailable } },
      },
    },
  });

  return registry;
}

export type OpenApiDocument = ReturnType<OpenApiGeneratorV3['generateDocument']>;

export function buildOpenApiDocument(): OpenApiDocument {
  const generator = new OpenApiGeneratorV3(createV1Registry().definitions);

  return generator.generateDocument({
    openapi: '3.0.3',
    info: { title: 'Perchados API', version: '1.0.0' },
    servers: [{ url: '/' }],
  });
}
