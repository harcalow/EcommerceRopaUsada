import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { PROBLEM_CONTENT_TYPE, problemFieldErrorSchema, problemSchema } from '../common/problem';
import { accountLockedSchema, loginRequestSchema } from '../auth/login.schemas';
import { sessionInfoSchema } from '../auth/session.schemas';
import { healthOkSchema, healthUnavailableSchema } from '../health/health.schemas';

const problemContent = (schema: z.ZodType) => ({ [PROBLEM_CONTENT_TYPE]: { schema } });

const setCookieHeaders = z.object({
  'X-Correlation-Id': z.string(),
  'Set-Cookie': z.string().openapi({
    description: 'Cookies perchados_sid (HttpOnly) y perchados_csrf (legible por JS), ambas SameSite=Strict',
  }),
});

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

  registerAuthPaths(registry);

  return registry;
}

function registerAuthPaths(registry: OpenAPIRegistry): void {
  const loginRequest = registry.register('LoginRequest', loginRequestSchema);
  const sessionInfo = registry.register('SessionInfo', sessionInfoSchema);
  const accountLocked = registry.register('AccountLocked', accountLockedSchema);
  const problem = (description: string) => ({
    description,
    headers: correlationHeaders,
    content: problemContent(problemSchema),
  });
  const csrfHeader = z.object({
    'X-CSRF-Token': z.string().optional().openapi({ description: 'Token CSRF (cookie perchados_csrf)' }),
  });
  const tooManyRequests = {
    description: 'Límite de peticiones superado',
    headers: correlationHeaders.extend({ 'Retry-After': z.string().openapi({ description: 'Segundos de espera' }) }),
    content: problemContent(problemSchema),
  };

  registry.registerPath({
    method: 'post',
    path: '/v1/auth/login',
    operationId: 'login',
    summary: 'Inicia sesión como administrador',
    tags: ['auth'],
    request: { body: { required: true, content: { 'application/json': { schema: loginRequest } } } },
    responses: {
      200: {
        description: 'Sesión abierta; fija las cookies de sesión y CSRF',
        headers: setCookieHeaders,
        content: { 'application/json': { schema: sessionInfo } },
      },
      400: problem('Entrada inválida (validation-error)'),
      401: problem('Credenciales incorrectas (auth/invalid-credentials)'),
      403: problem('Origin no permitido (auth/csrf-invalid)'),
      423: {
        description: 'Cuenta bloqueada (auth/account-locked)',
        headers: correlationHeaders,
        content: problemContent(accountLocked),
      },
      429: tooManyRequests,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/v1/auth/session',
    operationId: 'getSession',
    summary: 'Datos de la sesión vigente',
    tags: ['auth'],
    responses: {
      200: { description: 'Sesión válida', headers: correlationHeaders, content: { 'application/json': { schema: sessionInfo } } },
      401: problem('Sin sesión o caducada (auth/unauthenticated | auth/session-expired)'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/v1/auth/logout',
    operationId: 'logout',
    summary: 'Cierra la sesión y borra las cookies',
    tags: ['auth'],
    request: { headers: csrfHeader },
    responses: {
      204: { description: 'Sesión cerrada; las cookies se borran', headers: setCookieHeaders },
      403: problem('Token CSRF u Origin inválidos (auth/csrf-invalid)'),
      429: tooManyRequests,
    },
  });
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
