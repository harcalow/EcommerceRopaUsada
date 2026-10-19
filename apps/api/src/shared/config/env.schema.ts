import { isIP } from 'node:net';

import { z } from 'zod';

export const APP_ENVS = ['development', 'test', 'ci', 'production'] as const;
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

/** Mínimos de memoria (KiB) de argon2id según las iteraciones (OWASP Password Storage Cheat Sheet). */
const ARGON2_MIN_MEMORY_KIB: ReadonlyMap<number, number> = new Map([
  [1, 47104],
  [2, 19456],
  [3, 12288],
  [4, 9216],
]);
const ARGON2_MIN_MEMORY_KIB_FROM_5_ITERATIONS = 7168;

const MIN_SESSION_TTL_HOURS = 1 / 60;
const MAX_HEALTH_DB_TIMEOUT_MS = 2500;
export const MIN_INTERNAL_API_SECRET_LENGTH = 32;

const text = z.string({ error: 'is required' });

const integer = (rule: string) =>
  text.regex(/^\d+$/, { error: `must be ${rule}` }).transform((value) => Number(value));

const positiveInteger = integer('a positive integer').refine((value) => value > 0, {
  error: 'must be a positive integer',
});

function isIpOrCidr(value: string): boolean {
  const [address = '', prefix, ...rest] = value.split('/');
  const version = isIP(address);
  if (version === 0 || rest.length > 0) {
    return false;
  }
  if (prefix === undefined) {
    return true;
  }
  return /^\d{1,3}$/.test(prefix) && Number(prefix) <= (version === 4 ? 32 : 128);
}

const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

export const databaseUrl = text.refine(
  (value) => {
    try {
      const { protocol, hostname } = new URL(value);
      return (protocol === 'postgresql:' || protocol === 'postgres:') && hostname !== '';
    } catch {
      return false;
    }
  },
  { error: 'must be a valid postgresql:// URL' },
);

function toOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

const allowedOrigins = text.transform((value, ctx) => {
  const origins = splitList(value).map(toOrigin);
  if (origins.length === 0 || origins.includes(undefined)) {
    ctx.addIssue({
      code: 'custom',
      message: 'must be a comma-separated list of http(s) URLs',
    });
    return z.NEVER;
  }
  return [...new Set(origins as string[])];
});

const trustProxy = text.transform((value, ctx): boolean | number | string[] => {
  if (value === 'false') {
    return false;
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  const entries = splitList(value);
  if (entries.length === 0 || !entries.every(isIpOrCidr)) {
    ctx.addIssue({
      code: 'custom',
      message: 'must be "false", a number of hops or a list of IPs/CIDRs',
    });
    return z.NEVER;
  }
  return entries;
});

const internalApiSecret = text.min(MIN_INTERNAL_API_SECRET_LENGTH, {
  error: `must be at least ${String(MIN_INTERNAL_API_SECRET_LENGTH)} characters`,
});

const sessionTtlHours = text
  .regex(/^\d+(\.\d+)?$/, { error: 'must be a positive number of hours' })
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value) && value >= MIN_SESSION_TTL_HOURS, {
    error: 'must be at least 1/60 hours (one minute)',
  });

const port = integer('an integer between 1 and 65535').refine(
  (value) => value >= 1 && value <= 65535,
  { error: 'must be an integer between 1 and 65535' },
);

const healthDbTimeoutMs = positiveInteger.refine((value) => value <= MAX_HEALTH_DB_TIMEOUT_MS, {
  error: `must be at most ${String(MAX_HEALTH_DB_TIMEOUT_MS)}`,
});

/** Parámetros de argon2id (ADR-007); los comparten la API y la semilla. */
export const passwordHashFields = {
  PASSWORD_HASH_MEMORY_KIB: positiveInteger.default(19456),
  PASSWORD_HASH_ITERATIONS: positiveInteger.default(10),
  PASSWORD_HASH_PARALLELISM: positiveInteger.default(1),
};

const envObject = z.object({
  APP_ENV: z
    .enum(APP_ENVS, { error: `must be one of ${APP_ENVS.join(', ')}` })
    .default('development'),
  API_PORT: port.default(3001),
  LOG_LEVEL: z
    .enum(LOG_LEVELS, { error: `must be one of ${LOG_LEVELS.join(', ')}` })
    .default('info'),
  DATABASE_URL: databaseUrl,
  CORS_ALLOWED_ORIGINS: allowedOrigins,
  TRUST_PROXY: trustProxy.default(false),
  INTERNAL_API_SECRET: internalApiSecret,
  BODY_LIMIT_KB: positiveInteger.default(100),
  SESSION_TTL_HOURS: sessionTtlHours.default(8),
  SESSION_COOKIE_DOMAIN: text.optional(),
  RATE_LIMIT_GLOBAL_PER_MIN: positiveInteger.default(100),
  RATE_LIMIT_AUTH_PER_MIN: positiveInteger.default(10),
  ...passwordHashFields,
  HEALTH_DB_TIMEOUT_MS: healthDbTimeoutMs.default(2000),
});

export function minimumMemoryKib(iterations: number): number {
  return ARGON2_MIN_MEMORY_KIB.get(iterations) ?? ARGON2_MIN_MEMORY_KIB_FROM_5_ITERATIONS;
}

/** Valida y transforma las variables de entorno en la configuración tipada de la API (RT-007). */
export const envSchema = envObject
  .superRefine((env, ctx) => {
    if (env.APP_ENV === 'production' && env.SESSION_COOKIE_DOMAIN === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_COOKIE_DOMAIN'],
        message: 'is required when APP_ENV is production',
      });
    }
    if (env.APP_ENV === 'production' && env.TRUST_PROXY === false) {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUST_PROXY'],
        message: 'must not be false when APP_ENV is production (trust the edge proxy)',
      });
    }
    if (env.PASSWORD_HASH_MEMORY_KIB < minimumMemoryKib(env.PASSWORD_HASH_ITERATIONS)) {
      ctx.addIssue({
        code: 'custom',
        path: ['PASSWORD_HASH_MEMORY_KIB'],
        message: 'is below the OWASP minimum for the configured iterations',
      });
    }
  })
  .transform((env) => ({
    env: env.APP_ENV,
    port: env.API_PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    cors: { allowedOrigins: env.CORS_ALLOWED_ORIGINS },
    trustProxy: env.TRUST_PROXY,
    internalApiSecret: env.INTERNAL_API_SECRET,
    bodyLimitKb: env.BODY_LIMIT_KB,
    session: { ttlHours: env.SESSION_TTL_HOURS, cookieDomain: env.SESSION_COOKIE_DOMAIN },
    rateLimit: {
      globalPerMin: env.RATE_LIMIT_GLOBAL_PER_MIN,
      authPerMin: env.RATE_LIMIT_AUTH_PER_MIN,
    },
    passwordHash: {
      memoryKib: env.PASSWORD_HASH_MEMORY_KIB,
      iterations: env.PASSWORD_HASH_ITERATIONS,
      parallelism: env.PASSWORD_HASH_PARALLELISM,
    },
    healthDbTimeoutMs: env.HEALTH_DB_TIMEOUT_MS,
  }));

export type AppConfig = z.output<typeof envSchema>;
