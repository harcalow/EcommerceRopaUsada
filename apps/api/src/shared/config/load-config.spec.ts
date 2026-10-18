import { describe, expect, it } from 'vitest';

import { TEST_INTERNAL_API_SECRET } from '../../../test/helpers/internal-secret';

import { ConfigError, loadConfig } from './load-config';

const SECRET_MARKER = 'valor-secreto-no-debe-aparecer';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  INTERNAL_API_SECRET: TEST_INTERNAL_API_SECRET,
};

function failure(env: NodeJS.ProcessEnv): ConfigError {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return error as ConfigError;
  }
  throw new Error('loadConfig should have thrown');
}

describe('loadConfig', () => {
  it('aplica los valores por defecto del diseño con solo las variables obligatorias', () => {
    const config = loadConfig(validEnv);

    expect(config).toEqual({
      env: 'development',
      port: 3001,
      logLevel: 'info',
      databaseUrl: validEnv.DATABASE_URL,
      cors: { allowedOrigins: ['http://localhost:3000'] },
      trustProxy: false,
      internalApiSecret: TEST_INTERNAL_API_SECRET,
      bodyLimitKb: 100,
      session: { ttlHours: 8, cookieDomain: undefined },
      rateLimit: { globalPerMin: 100, authPerMin: 10 },
      passwordHash: { memoryKib: 19456, iterations: 10, parallelism: 1 },
      healthDbTimeoutMs: 2000,
    });
  });

  it('trata las variables vacías como ausentes', () => {
    expect(loadConfig({ ...validEnv, API_PORT: '', LOG_LEVEL: '' }).port).toBe(3001);
    expect(failure({ ...validEnv, DATABASE_URL: '' }).variables).toEqual(['DATABASE_URL']);
  });

  it('lee todas las variables informadas', () => {
    const config = loadConfig({
      ...validEnv,
      APP_ENV: 'production',
      API_PORT: '4010',
      LOG_LEVEL: 'warn',
      CORS_ALLOWED_ORIGINS: 'https://a.example.com/, http://localhost:3000, https://a.example.com',
      TRUST_PROXY: '2',
      INTERNAL_API_SECRET: 'x'.repeat(32),
      BODY_LIMIT_KB: '50',
      SESSION_TTL_HOURS: '0.5',
      SESSION_COOKIE_DOMAIN: 'example.com',
      RATE_LIMIT_GLOBAL_PER_MIN: '200',
      RATE_LIMIT_AUTH_PER_MIN: '5',
      PASSWORD_HASH_MEMORY_KIB: '12288',
      PASSWORD_HASH_ITERATIONS: '3',
      PASSWORD_HASH_PARALLELISM: '2',
      HEALTH_DB_TIMEOUT_MS: '2500',
    });

    expect(config.env).toBe('production');
    expect(config.port).toBe(4010);
    expect(config.logLevel).toBe('warn');
    expect(config.cors.allowedOrigins).toEqual(['https://a.example.com', 'http://localhost:3000']);
    expect(config.trustProxy).toBe(2);
    expect(config.session).toEqual({ ttlHours: 0.5, cookieDomain: 'example.com' });
    expect(config.passwordHash).toEqual({ memoryKib: 12288, iterations: 3, parallelism: 2 });
    expect(config.healthDbTimeoutMs).toBe(2500);
  });

  describe('DATABASE_URL', () => {
    it('ausente: nombra la variable', () => {
      const error = failure({ ...validEnv, DATABASE_URL: undefined });
      expect(error.variables).toEqual(['DATABASE_URL']);
      expect(error.message).toContain('DATABASE_URL');
    });

    it.each(['not-a-url', 'mysql://user@localhost/db', 'postgresql://'])(
      'mal formada (%s): nombra la variable',
      (url) => {
        expect(failure({ ...validEnv, DATABASE_URL: url }).variables).toEqual(['DATABASE_URL']);
      },
    );

    it('no revela el valor, aunque contenga una contraseña', () => {
      const error = failure({
        ...validEnv,
        DATABASE_URL: `mysql://user:${SECRET_MARKER}@localhost/db`,
      });
      expect(error.message).toContain('DATABASE_URL');
      expect(error.message).not.toContain(SECRET_MARKER);
    });
  });

  describe('SESSION_TTL_HOURS', () => {
    it.each(['0', '-1', 'ocho', '8h', '0.001'])('rechaza %s nombrando la variable', (raw) => {
      const error = failure({ ...validEnv, SESSION_TTL_HOURS: raw });
      expect(error.variables).toEqual(['SESSION_TTL_HOURS']);
      expect(error.message).not.toContain(`${raw};`);
    });

    it('acepta decimales y el mínimo de un minuto', () => {
      expect(loadConfig({ ...validEnv, SESSION_TTL_HOURS: '1.5' }).session.ttlHours).toBe(1.5);
      expect(loadConfig({ ...validEnv, SESSION_TTL_HOURS: String(1 / 60) }).session.ttlHours).toBe(
        1 / 60,
      );
    });
  });

  describe('CORS_ALLOWED_ORIGINS', () => {
    it('ausente: nombra la variable', () => {
      expect(failure({ ...validEnv, CORS_ALLOWED_ORIGINS: undefined }).variables).toEqual([
        'CORS_ALLOWED_ORIGINS',
      ]);
    });

    it.each(['localhost:3000', 'ftp://example.com', 'http://ok.com,basura', ' , '])(
      'rechaza %s',
      (raw) => {
        expect(failure({ ...validEnv, CORS_ALLOWED_ORIGINS: raw }).variables).toEqual([
          'CORS_ALLOWED_ORIGINS',
        ]);
      },
    );
  });

  describe('TRUST_PROXY', () => {
    it('acepta false, saltos y listas de IP/CIDR', () => {
      expect(loadConfig({ ...validEnv, TRUST_PROXY: 'false' }).trustProxy).toBe(false);
      expect(loadConfig({ ...validEnv, TRUST_PROXY: '1' }).trustProxy).toBe(1);
      expect(
        loadConfig({ ...validEnv, TRUST_PROXY: '10.0.0.0/8, ::1, fd00::/8' }).trustProxy,
      ).toEqual(['10.0.0.0/8', '::1', 'fd00::/8']);
    });

    it.each(['true', 'cualquiera', '10.0.0.0/33', '10.0.0.0/8/1', '::1/129', ','])(
      'rechaza %s',
      (raw) => {
        expect(failure({ ...validEnv, TRUST_PROXY: raw }).variables).toEqual(['TRUST_PROXY']);
      },
    );
  });

  describe('enteros positivos', () => {
    it.each([
      'API_PORT',
      'BODY_LIMIT_KB',
      'RATE_LIMIT_GLOBAL_PER_MIN',
      'RATE_LIMIT_AUTH_PER_MIN',
      'HEALTH_DB_TIMEOUT_MS',
      'PASSWORD_HASH_PARALLELISM',
    ])('%s rechaza 0, negativos y texto', (name) => {
      for (const raw of ['0', '-1', 'x', '1.5']) {
        expect(failure({ ...validEnv, [name]: raw }).variables).toEqual([name]);
      }
    });

    it('API_PORT rechaza puertos fuera de rango', () => {
      expect(failure({ ...validEnv, API_PORT: '65536' }).variables).toEqual(['API_PORT']);
    });

    it('HEALTH_DB_TIMEOUT_MS no puede superar 2500', () => {
      expect(failure({ ...validEnv, HEALTH_DB_TIMEOUT_MS: '2501' }).variables).toEqual([
        'HEALTH_DB_TIMEOUT_MS',
      ]);
    });
  });

  describe('INTERNAL_API_SECRET (RT-022)', () => {
    const withoutSecret = { ...validEnv, INTERNAL_API_SECRET: undefined };

    it('ausente o vacía: es inválida y nombra la variable', () => {
      const error = failure(withoutSecret);
      expect(error.variables).toEqual(['INTERNAL_API_SECRET']);
      expect(failure({ ...validEnv, INTERNAL_API_SECRET: '' }).variables).toEqual([
        'INTERNAL_API_SECRET',
      ]);
    });

    it('31 caracteres es inválida y el error no contiene el valor', () => {
      const short = 's'.repeat(31);
      const error = failure({ ...validEnv, INTERNAL_API_SECRET: short });

      expect(error.variables).toEqual(['INTERNAL_API_SECRET']);
      expect(error.message).toContain('INTERNAL_API_SECRET');
      expect(error.message).not.toContain(short);
    });

    it('32 caracteres es válida', () => {
      const secret = 's'.repeat(32);
      expect(loadConfig({ ...validEnv, INTERNAL_API_SECRET: secret }).internalApiSecret).toBe(secret);
    });
  });

  describe('enumeraciones', () => {
    it('APP_ENV y LOG_LEVEL rechazan valores desconocidos', () => {
      expect(failure({ ...validEnv, APP_ENV: 'staging' }).variables).toEqual(['APP_ENV']);
      expect(failure({ ...validEnv, LOG_LEVEL: 'verbose' }).variables).toEqual(['LOG_LEVEL']);
    });
  });

  describe('reglas cruzadas', () => {
    it('SESSION_COOKIE_DOMAIN es obligatoria con APP_ENV=production', () => {
      const error = failure({ ...validEnv, APP_ENV: 'production', TRUST_PROXY: '1' });
      expect(error.variables).toEqual(['SESSION_COOKIE_DOMAIN']);
    });

    it('RT-022: APP_ENV=production con TRUST_PROXY=false (o ausente) es inválida', () => {
      const production = { ...validEnv, APP_ENV: 'production', SESSION_COOKIE_DOMAIN: 'example.com' };

      expect(failure({ ...production, TRUST_PROXY: 'false' }).variables).toEqual(['TRUST_PROXY']);
      expect(failure(production).variables).toEqual(['TRUST_PROXY']);
    });

    it('RT-022: production con TRUST_PROXY=1 o una lista de CIDR es válida', () => {
      const production = { ...validEnv, APP_ENV: 'production', SESSION_COOKIE_DOMAIN: 'example.com' };

      expect(loadConfig({ ...production, TRUST_PROXY: '1' }).trustProxy).toBe(1);
      expect(loadConfig({ ...production, TRUST_PROXY: '10.0.0.0/8' }).trustProxy).toEqual(['10.0.0.0/8']);
    });

    it.each(['development', 'test', 'ci'])(
      'RT-022: %s admite TRUST_PROXY=false',
      (appEnv) => {
        expect(loadConfig({ ...validEnv, APP_ENV: appEnv, TRUST_PROXY: 'false' }).trustProxy).toBe(false);
      },
    );

    it('rechaza parámetros de argon2id por debajo del mínimo OWASP', () => {
      expect(
        failure({ ...validEnv, PASSWORD_HASH_MEMORY_KIB: '4096' }).variables,
      ).toEqual(['PASSWORD_HASH_MEMORY_KIB']);
      expect(
        failure({
          ...validEnv,
          PASSWORD_HASH_ITERATIONS: '1',
          PASSWORD_HASH_MEMORY_KIB: '19456',
        }).variables,
      ).toEqual(['PASSWORD_HASH_MEMORY_KIB']);
      expect(
        loadConfig({ ...validEnv, PASSWORD_HASH_ITERATIONS: '6', PASSWORD_HASH_MEMORY_KIB: '7168' })
          .passwordHash.memoryKib,
      ).toBe(7168);
    });

    it.each([
      [1, 47104],
      [2, 19456],
      [3, 12288],
      [4, 9216],
      [5, 7168],
    ])('con %i iteraciones acepta el mínimo OWASP de %i KiB y rechaza uno menos', (iterations, minimum) => {
      const base = { ...validEnv, PASSWORD_HASH_ITERATIONS: String(iterations) };

      expect(
        loadConfig({ ...base, PASSWORD_HASH_MEMORY_KIB: String(minimum) }).passwordHash.memoryKib,
      ).toBe(minimum);
      expect(
        failure({ ...base, PASSWORD_HASH_MEMORY_KIB: String(minimum - 1) }).variables,
      ).toEqual(['PASSWORD_HASH_MEMORY_KIB']);
    });
  });

  it('informa todas las variables inválidas a la vez, sin repetir', () => {
    const error = failure({ SESSION_TTL_HOURS: '0', API_PORT: 'x' });
    expect([...error.variables].sort()).toEqual([
      'API_PORT',
      'CORS_ALLOWED_ORIGINS',
      'DATABASE_URL',
      'INTERNAL_API_SECRET',
      'SESSION_TTL_HOURS',
    ]);
  });
});
