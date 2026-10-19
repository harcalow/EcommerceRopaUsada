import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Ajv, type AnySchemaObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = Record<string, Json>;

const SCHEMA_ID_PREFIX = 'schema:';
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

/** Respuesta HTTP real a comprobar; compatible con la de supertest. */
export interface ContractResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, unknown>>;
  readonly body: unknown;
}

export interface ContractCheck {
  readonly method: HttpMethod;
  /** Plantilla de la ruta tal como figura en el documento, p. ej. `/v1/health`. */
  readonly path: string;
  readonly response: ContractResponse;
}

export interface ContractDocument {
  readonly openapi: string;
  readonly paths: Readonly<Record<string, Json>>;
  /** Documento completo, para resolver punteros a esquemas. */
  readonly root: Json;
}

export interface DocumentedRoute {
  readonly method: HttpMethod;
  readonly path: string;
}

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function child(node: Json | undefined, key: string): Json | undefined {
  return isObject(node) ? node[key] : undefined;
}

/** Escapa un segmento para un puntero JSON (RFC 6901). */
function pointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function hasBody(body: unknown): boolean {
  if (body === undefined || body === null || body === '') return false;
  return !(typeof body === 'object' && Object.keys(body).length === 0);
}

const SCHEMA_REF_PREFIX = '#/components/schemas/';

/** Los `$ref` a `#/components/schemas/X` pasan a ids de esquema registrados por nombre. */
function rewriteRefs(node: Json | undefined): AnySchemaObject {
  const text = JSON.stringify(node).replaceAll(`"$ref":"${SCHEMA_REF_PREFIX}`, `"$ref":"${SCHEMA_ID_PREFIX}`);
  return JSON.parse(text) as AnySchemaObject;
}

/** Sigue un puntero JSON (RFC 6901) dentro del documento. */
function resolvePointer(root: Json | undefined, pointer: string): Json | undefined {
  return pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce<Json | undefined>((node, segment) => child(node, segment), root);
}

/** Carga `packages/contracts/openapi/v1.json` (las pruebas se ejecutan con la raíz en `apps/api`). */
export function loadContractDocument(): ContractDocument {
  const file = join(process.cwd(), '..', '..', 'packages', 'contracts', 'openapi', 'v1.json');
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Json;
  if (!isObject(parsed) || typeof parsed.openapi !== 'string' || !isObject(parsed.paths)) {
    throw new Error('El documento OpenAPI v1.json no tiene el formato esperado');
  }
  return { openapi: parsed.openapi, paths: parsed.paths, root: parsed };
}

/** Rutas y métodos que declara el documento. */
export function listDocumentedRoutes(document: ContractDocument): DocumentedRoute[] {
  return Object.entries(document.paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((method) => isObject(child(item, method))).map((method) => ({ method, path })),
  );
}

/**
 * Valida respuestas reales contra `openapi/v1.json` con Ajv: código de estado documentado,
 * tipo de contenido, cuerpo (con `$ref`) y cabeceras documentadas. Sirve para toda ruta
 * nueva sin tocarlo: basta con que el documento la describa.
 */
export class ContractMatcher {
  private readonly ajv: Ajv;
  private readonly compiled = new Map<string, ValidateFunction>();

  constructor(private readonly document: ContractDocument = loadContractDocument()) {
    // strict desactivado: el documento OpenAPI lleva palabras clave ajenas a JSON Schema
    this.ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(this.ajv);
    const schemas = child(child(this.document.root, 'components'), 'schemas');
    for (const [name, schema] of Object.entries(isObject(schemas) ? schemas : {})) {
      this.ajv.addSchema(rewriteRefs(schema), `${SCHEMA_ID_PREFIX}${name}`);
    }
  }

  /** Devuelve los incumplimientos del contrato; vacío si la respuesta es válida. */
  check(input: ContractCheck): string[] {
    const { method, path, response } = input;
    const responses = child(child(this.document.paths[path], method), 'responses');
    const spec = child(responses, String(response.status));
    if (!isObject(spec)) {
      return [`${method.toUpperCase()} ${path}: el estado ${String(response.status)} no está documentado`];
    }
    const base = `/paths/${pointerSegment(path)}/${method}/responses/${String(response.status)}`;
    return [...this.checkHeaders(spec, response, base), ...this.checkBody(spec, response, base)];
  }

  /** Lanza un error con todos los incumplimientos si la respuesta no cumple el contrato. */
  assert(input: ContractCheck): void {
    const errors = this.check(input);
    if (errors.length > 0) {
      throw new Error(`La respuesta incumple el contrato:\n- ${errors.join('\n- ')}`);
    }
  }

  private checkHeaders(spec: JsonObject, response: ContractResponse, base: string): string[] {
    const headers = child(spec, 'headers');
    if (!isObject(headers)) return [];
    return Object.entries(headers).flatMap(([name, header]) => {
      const value = response.headers[name.toLowerCase()];
      if (value === undefined) {
        return child(header, 'required') === true ? [`falta la cabecera ${name}`] : [];
      }
      const schemaPointer = `${base}/headers/${pointerSegment(name)}/schema`;
      return this.validate(schemaPointer, value).map((error) => `cabecera ${name} ${error}`);
    });
  }

  private checkBody(spec: JsonObject, response: ContractResponse, base: string): string[] {
    const content = child(spec, 'content');
    if (!isObject(content)) {
      return hasBody(response.body) ? ['la respuesta lleva cuerpo y el contrato no declara contenido'] : [];
    }
    const rawType = response.headers['content-type'];
    const contentType = (typeof rawType === 'string' ? rawType : '').split(';')[0]?.trim().toLowerCase();
    const mediaType = Object.keys(content).find((candidate) => candidate.toLowerCase() === contentType);
    if (mediaType === undefined) {
      return [`content-type "${contentType ?? ''}" no documentado (${Object.keys(content).join(', ')})`];
    }
    const schemaPointer = `${base}/content/${pointerSegment(mediaType)}/schema`;
    return this.validate(schemaPointer, response.body).map((error) => `cuerpo ${error}`);
  }

  private validate(pointer: string, value: unknown): string[] {
    const validator = this.validatorFor(pointer);
    if (validator(value)) return [];
    return (validator.errors ?? []).map(
      (error) => `${error.instancePath === '' ? '/' : error.instancePath} ${error.message ?? 'no válido'}`,
    );
  }

  private validatorFor(pointer: string): ValidateFunction {
    const cached = this.compiled.get(pointer);
    if (cached !== undefined) return cached;
    const schema = resolvePointer(this.document.root, pointer);
    if (!isObject(schema)) throw new Error(`No hay esquema en ${pointer}`);
    const validator = this.ajv.compile(rewriteRefs(schema));
    this.compiled.set(pointer, validator);
    return validator;
  }
}
