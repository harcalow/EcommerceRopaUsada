import 'server-only';

import { z } from 'zod';

export const APP_ENVS = ['development', 'test', 'ci', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const text = z.string({ error: 'is required' });

/** URL absoluta http(s). El mensaje nunca incluye el valor recibido. */
const httpUrl = text.refine(
  (value) => {
    try {
      const { protocol, hostname } = new URL(value);
      return (protocol === 'http:' || protocol === 'https:') && hostname !== '';
    } catch {
      return false;
    }
  },
  { error: 'must be a valid http(s) URL' },
);

/** Correo con forma `usuario@dominio.tld`, sin espacios (RF-007: se muestra como enlace `mailto:`). */
const EMAIL_PATTERN = /^[^\s@<>"',;:()[\]\\]+@[^\s@<>"',;:()[\]\\.]+(\.[^\s@<>"',;:()[\]\\.]+)+$/;
const email = text.regex(EMAIL_PATTERN, { error: 'must be a valid email address' });

/** Secreto compartido web-API (RT-022): al menos 32 caracteres. El mensaje nunca incluye el valor. */
const internalApiSecret = text.min(32, { error: 'must be at least 32 characters' });

/** Saltos de proxy de confianza delante de la web (RT-022): entero >= 0, por defecto 0. */
const trustProxyHops = z
  .string()
  .regex(/^\d+$/, { error: 'must be an integer greater than or equal to 0' })
  .transform(Number)
  .refine(Number.isSafeInteger, { error: 'must be an integer greater than or equal to 0' })
  .optional()
  .transform((hops) => hops ?? 0);

const serverEnvSchema = z
  .object({
    APP_ENV: z
      .enum(APP_ENVS, { error: `must be one of ${APP_ENVS.join(', ')}` })
      .default('development'),
    API_INTERNAL_URL: httpUrl,
    API_PUBLIC_URL: httpUrl,
    ADMIN_CONTACT_EMAIL: email,
    INTERNAL_API_SECRET: internalApiSecret,
    WEB_TRUST_PROXY_HOPS: trustProxyHops,
  })
  .refine((env) => env.APP_ENV !== 'production' || env.WEB_TRUST_PROXY_HOPS >= 1, {
    path: ['WEB_TRUST_PROXY_HOPS'],
    error: 'must be at least 1 when APP_ENV is production',
  })
  .transform((env) => ({
    appEnv: env.APP_ENV,
    apiInternalUrl: env.API_INTERNAL_URL,
    apiPublicUrl: env.API_PUBLIC_URL,
    adminContactEmail: env.ADMIN_CONTACT_EMAIL,
    internalApiSecret: env.INTERNAL_API_SECRET,
    trustProxyHops: env.WEB_TRUST_PROXY_HOPS,
  }));

export type ServerEnv = z.output<typeof serverEnvSchema>;

/** Origen de variables de entorno (`process.env` o un objeto de prueba). */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Error de configuración: nombra las variables inválidas y nunca incluye sus valores. */
export class ServerEnvError extends Error {
  constructor(
    readonly variables: readonly string[],
    message: string,
  ) {
    super(message);
    this.name = 'ServerEnvError';
  }
}

/** Las variables vacías (p. ej. `VAR=` en un archivo de entorno) cuentan como ausentes. */
function withoutEmpty(env: EnvSource): EnvSource {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
}

/**
 * Valida el entorno del servidor web (RT-007).
 * @throws ServerEnvError con el nombre de cada variable inválida y el motivo, sin valores.
 */
export function parseServerEnv(env: EnvSource): ServerEnv {
  const result = serverEnvSchema.safeParse(withoutEmpty(env));
  if (result.success) {
    return result.data;
  }
  const problems = result.error.issues.map((issue) => ({
    variable: String(issue.path[0] ?? 'environment'),
    reason: issue.message,
  }));
  const detail = problems.map(({ variable, reason }) => `${variable} ${reason}`).join('; ');
  throw new ServerEnvError(
    [...new Set(problems.map(({ variable }) => variable))],
    `Invalid web server configuration: ${detail}`,
  );
}

let cached: ServerEnv | undefined;

/** Configuración validada del proceso actual (se valida una sola vez). */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
