/** Valor que sustituye a todo dato sensible antes de escribirlo en un log. */
export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY =
  /password|passwd|token|secret|authorization|cookie|api[-_]?key|credential|session/i;

/** Indica si el nombre de un campo (sin distinguir mayúsculas) debe ocultarse. */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

const OPAQUE_TYPES = [Error, Date, RegExp, Map, Set, Promise, ArrayBuffer];

/** Objetos con estructura propia que se registran tal cual (errores, fechas, búferes...). */
function isOpaque(value: object): boolean {
  return OPAQUE_TYPES.some((type) => value instanceof type) || ArrayBuffer.isView(value);
}

/** Objeto recorrible: plano o instancia de clase (p. ej. la petición serializada por pino). */
function isTraversable(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isOpaque(value);
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }
  if (!isTraversable(value)) {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? REDACTED : sanitizeValue(item, seen);
  }
  seen.delete(value);
  return result;
}

/**
 * Devuelve una copia de `value` con los campos sensibles ocultos a cualquier profundidad
 * (contraseñas, tokens, cookies, `Authorization`, secretos). No muta la entrada y deja
 * intactos errores, fechas y búferes.
 */
export function sanitize<T>(value: T): T {
  return sanitizeValue(value, new WeakSet()) as T;
}
