/**
 * Entrada ligera de `@perchados/contracts` para el navegador: constantes y esquemas zod/mini, sin el registro
 * OpenAPI ni `zod-to-openapi`. La fuente única de las reglas sigue siendo `src/auth/login.rules.ts`.
 */
export * from './auth/cookie-names';
export * from './auth/login.client-schemas';
export * from './auth/login.rules';
export * from './common/correlation-constants';
export * from './common/internal-headers';
export * from './common/problem-types';
