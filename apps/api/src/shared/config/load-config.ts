import { envSchema, type AppConfig } from './env.schema';

export type { AppConfig } from './env.schema';

/** Error de configuración: nombra las variables inválidas y nunca incluye sus valores. */
export class ConfigError extends Error {
  constructor(
    readonly variables: readonly string[],
    message: string,
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Las variables vacías (p. ej. `VAR=` en un archivo de entorno) cuentan como ausentes. */
function withoutEmpty(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
}

/**
 * Valida el entorno y devuelve la configuración tipada.
 * @throws ConfigError con el nombre de cada variable inválida y el motivo, sin valores.
 */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(withoutEmpty(env));
  if (result.success) {
    return result.data;
  }
  const problems = result.error.issues.map((issue) => ({
    variable: String(issue.path[0] ?? 'environment'),
    reason: issue.message,
  }));
  const detail = problems.map(({ variable, reason }) => `${variable} ${reason}`).join('; ');
  throw new ConfigError(
    [...new Set(problems.map(({ variable }) => variable))],
    `Invalid configuration: ${detail}`,
  );
}
