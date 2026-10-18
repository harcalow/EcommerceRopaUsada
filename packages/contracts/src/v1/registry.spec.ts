import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Validator } from '@seriousme/openapi-schema-validator';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from './registry';

describe('buildOpenApiDocument (RT-004, RT-016)', () => {
  const document = buildOpenApiDocument();

  it('genera un documento OpenAPI 3.x válido según el validador oficial', async () => {
    const spec = JSON.parse(JSON.stringify(document)) as Record<string, unknown>;
    const result = await new Validator().validate(spec);

    expect(result.errors).toBeUndefined();
    expect(result.valid).toBe(true);
  });

  it('declara GET /v1/health con 200 JSON y 503 problem+json', () => {
    const responses = document.paths['/v1/health']?.get?.responses ?? {};

    expect(Object.keys(responses).sort()).toEqual(['200', '503']);
    expect(JSON.stringify(responses['200'])).toContain('#/components/schemas/HealthOk');
    expect(JSON.stringify(responses['503'])).toContain('application/problem+json');
    expect(JSON.stringify(responses['503'])).toContain('#/components/schemas/HealthUnavailable');
  });

  it('publica el esquema Problem como objeto estricto', () => {
    const problem = document.components?.schemas?.Problem;

    expect(problem).toMatchObject({ type: 'object', additionalProperties: false });
  });

  it('mantiene openapi/v1.json al día con los esquemas (ejecuta pnpm contract:generate)', () => {
    const committed: unknown = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../openapi/v1.json'), 'utf8'),
    );

    expect(committed).toEqual(JSON.parse(JSON.stringify(document)));
  });
});

describe('rutas auth (RF-001, RF-012, RT-004)', () => {
  const document = buildOpenApiDocument();
  const statuses = (path: string, method: 'get' | 'post'): string[] =>
    Object.keys(document.paths[path]?.[method]?.responses ?? {}).sort();

  it('declara login con sus respuestas', () => {
    expect(statuses('/v1/auth/login', 'post')).toEqual(['200', '400', '401', '403', '423', '429']);
    expect(JSON.stringify(document.paths['/v1/auth/login']?.post)).toContain('#/components/schemas/LoginRequest');
  });

  it('declara session y logout con sus respuestas', () => {
    expect(statuses('/v1/auth/session', 'get')).toEqual(['200', '401']);
    expect(statuses('/v1/auth/logout', 'post')).toEqual(['204', '403', '429']);
  });
});
