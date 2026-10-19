import { performance } from 'node:perf_hooks';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContractMatcher } from '../../../../test/contract/contract-matcher';
import { ADMIN_ROLE_CODE } from '../../../../test/helpers/db';
import { createTestApp, type TestApp } from '../../../../test/helpers/test-app.factory';
import { runSeedCli } from '../../../../prisma/seed/cli';
import { SEED_STEPS } from '../../../../prisma/seed/steps';
import { weakPasswordHash } from '../../../../test/helpers/weak-password-hash';
import { createLogCapture } from '../../../../test/helpers/logged-app';
import { PASSWORD_HASHER, type PasswordHasher } from '../application/ports/password-hasher';
import {
  TRANSACTION_MAX_WAIT_MS,
  TRANSACTION_TIMEOUT_MS,
} from '../../../shared/database/prisma-transaction';
import { SESSION_REPOSITORY } from '../application/ports/session.repository';

const matcher = new ContractMatcher();
const LOGIN_PATH = '/v1/auth/login';
const SID = 'perchados_sid';
const CSRF = 'perchados_csrf';
const PASSWORD = 'Perch@ 2026';
const WRONG = 'Clave-equivocada-1';
const ALLOWED_ORIGIN = 'http://localhost:3000';
const MINUTE_MS = 60_000;
const RT021_SAMPLES = 20;
const RT021_LIMIT_MS = 1000;

function setCookies(response: request.Response): string[] {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  return header === undefined ? [] : Array.isArray(header) ? header : [header];
}

function cookieValue(response: request.Response, name: string): string {
  const cookie = setCookies(response).find((item) => item.startsWith(`${name}=`));
  if (cookie === undefined) {
    throw new Error(`missing cookie ${name}`);
  }
  return cookie.slice(name.length + 1, cookie.indexOf(';'));
}

function withoutCorrelation(body: unknown): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([key]) => key !== 'correlationId'),
  );
}

describe('POST /v1/auth/login contra PostgreSQL real (RF-001, RF-004, RF-008, RF-009, RF-017, RF-023)', () => {
  let ctx: TestApp;
  let hasher: PasswordHasher;
  let luciaHash: string;
  let nextAccount = 0;

  beforeAll(async () => {
    ctx = await createTestApp();
    hasher = ctx.app.get<PasswordHasher>(PASSWORD_HASHER);
    luciaHash = await hasher.hash(PASSWORD);
  });

  beforeEach(async () => {
    await ctx.reset();
    ctx.clear();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.close();
  });

  interface AccountOptions {
    readonly role?: string;
    readonly status?: 'ACTIVE' | 'DISABLED';
    readonly passwordHash?: string;
  }

  async function createAccount(username: string, options: AccountOptions = {}): Promise<string> {
    nextAccount += 1;
    const roleCode = options.role ?? ADMIN_ROLE_CODE;
    const role =
      (await ctx.prisma.role.findUnique({ where: { code: roleCode } })) ??
      (await ctx.prisma.role.create({ data: { code: roleCode, name: `Rol ${String(nextAccount)}` } }));
    const account = await ctx.prisma.account.create({
      data: {
        username,
        usernameKey: username.toLowerCase(),
        roleId: role.id,
        status: options.status ?? 'ACTIVE',
        passwordHash: options.passwordHash ?? luciaHash,
      },
    });
    return account.id;
  }

  function login(username: string, password: string): request.Test {
    return request(ctx.server).post(LOGIN_PATH).send({ username, password });
  }

  function checkContract(response: request.Response): string[] {
    return matcher.check({
      method: 'post',
      path: LOGIN_PATH,
      response: {
        status: response.status,
        headers: { ...response.headers, 'set-cookie': setCookies(response).join(', ') },
        body: response.body,
      },
    });
  }

  async function counter(accountId: string): Promise<{ failedAttempts: number; lockedUntil: Date | null }> {
    const row = await ctx.prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    return { failedAttempts: row.failedAttempts, lockedUntil: row.lockedUntil };
  }

  async function failTimes(username: string, count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      await login(username, WRONG);
    }
  }

  async function expireLock(accountId: string): Promise<void> {
    await ctx.prisma.account.update({
      where: { id: accountId },
      data: { lockedUntil: new Date(Date.now() - MINUTE_MS) },
    });
  }

  describe('entrada correcta', () => {
    it('lucia entra: 200, cookies de sesión y CSRF, y GET /session con rol admin (CA-001)', async () => {
      await createAccount('lucia');

      const response = await login('lucia', PASSWORD);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ role: 'admin' });
      expect(Date.parse((response.body as { expiresAt: string }).expiresAt)).toBeGreaterThan(Date.now());
      expect(response.headers['cache-control']).toBe('no-store');
      const cookies = setCookies(response);
      expect(cookies).toHaveLength(2);
      const sid = cookies.find((item) => item.startsWith(`${SID}=`)) ?? '';
      const csrf = cookies.find((item) => item.startsWith(`${CSRF}=`)) ?? '';
      expect(sid).toMatch(/HttpOnly/);
      expect(sid).toMatch(/SameSite=Strict/);
      expect(sid).toMatch(/Path=\//);
      expect(csrf).not.toMatch(/HttpOnly/);
      expect(csrf).toMatch(/SameSite=Strict/);
      expect(sid).not.toMatch(/lucia|admin/i);
      expect(sid).not.toContain(PASSWORD);
      expect(checkContract(response)).toEqual([]);

      const session = await request(ctx.server)
        .get('/v1/auth/session')
        .set('Cookie', `${SID}=${cookieValue(response, SID)}`);
      expect(session.status).toBe(200);
      expect(session.body).toMatchObject({ role: 'admin' });
    });

    it('HaroldAdmin sembrado con la contraseña de prueba entra (CA-017)', async () => {
      const seedPassword = 'Semilla-De-Prueba-77';
      const code = await runSeedCli({
        env: {
          DATABASE_URL: ctx.config.databaseUrl,
          ADMIN_INITIAL_PASSWORD: seedPassword,
          PASSWORD_HASH_MEMORY_KIB: String(ctx.config.passwordHash.memoryKib),
          PASSWORD_HASH_ITERATIONS: String(ctx.config.passwordHash.iterations),
          PASSWORD_HASH_PARALLELISM: String(ctx.config.passwordHash.parallelism),
        },
        steps: SEED_STEPS,
        destination: createLogCapture().destination,
      });
      expect(code).toBe(0);

      const response = await login('HaroldAdmin', seedPassword);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ role: 'admin' });
    });

    it('recorta los espacios y no distingue mayúsculas en el usuario (CB-001, CB-002)', async () => {
      await createAccount('lucia');

      expect((await login('  LUCIA  ', PASSWORD)).status).toBe(200);
      expect((await login('Lucia', PASSWORD)).status).toBe(200);
    });

    it('la contraseña sí distingue mayúsculas y no se recorta (CB-002)', async () => {
      await createAccount('lucia');

      expect((await login('lucia', PASSWORD.toLowerCase())).status).toBe(401);
      expect((await login('lucia', ` ${PASSWORD}`)).status).toBe(401);
    });

    it('guarda en la BD solo el hash del token de sesión', async () => {
      await createAccount('lucia');

      const response = await login('lucia', PASSWORD);

      const stored = await ctx.prisma.session.findMany();
      expect(stored).toHaveLength(1);
      expect(stored[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored[0]?.tokenHash).not.toBe(cookieValue(response, SID));
    });

    it('revoca la sesión previa que traía la petición y emite otra distinta', async () => {
      await createAccount('lucia');
      const first = await login('lucia', PASSWORD);

      const second = await login('lucia', PASSWORD).set('Cookie', `${SID}=${cookieValue(first, SID)}`);

      expect(second.status).toBe(200);
      expect(cookieValue(second, SID)).not.toBe(cookieValue(first, SID));
      const old = await request(ctx.server)
        .get('/v1/auth/session')
        .set('Cookie', `${SID}=${cookieValue(first, SID)}`);
      expect(old.status).toBe(401);
      const current = await request(ctx.server)
        .get('/v1/auth/session')
        .set('Cookie', `${SID}=${cookieValue(second, SID)}`);
      expect(current.status).toBe(200);
    });

    it('rehashea en la misma entrada si el hash guardado usa parámetros más débiles', async () => {
      const weakHash = await weakPasswordHash(PASSWORD);
      const accountId = await createAccount('lucia', { passwordHash: weakHash });

      expect((await login('lucia', PASSWORD)).status).toBe(200);

      const stored = (await ctx.prisma.account.findUniqueOrThrow({ where: { id: accountId } })).passwordHash;
      expect(stored).not.toBe(weakHash);
      expect(hasher.needsRehash(stored)).toBe(false);
      expect((await login('lucia', PASSWORD)).status).toBe(200);
    });
  });

  describe('credenciales no válidas y cuentas sin acceso', () => {
    it('contraseña incorrecta, usuario inexistente, cuenta desactivada y sin rol admin dan la misma respuesta (CA-003, CA-019, CB-003, RF-023)', async () => {
      await createAccount('lucia');
      await createAccount('baja', { status: 'DISABLED' });
      await createAccount('invitado', { role: 'auditor' });

      const responses = await Promise.all([
        login('lucia', WRONG),
        login('nadie', WRONG),
        login('baja', PASSWORD),
        login('invitado', PASSWORD),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(401);
        expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
        expect(response.body).toMatchObject({
          type: 'auth/invalid-credentials',
          status: 401,
          detail: 'Usuario o contraseña incorrectos.',
        });
        expect(checkContract(response)).toEqual([]);
        expect(withoutCorrelation(response.body)).toEqual(withoutCorrelation(responses[0].body));
      }
    });

    it('una cuenta desactivada o sin rol admin con la contraseña correcta no cuenta intentos (CB-012)', async () => {
      const disabled = await createAccount('baja', { status: 'DISABLED' });
      const guest = await createAccount('invitado', { role: 'auditor' });

      for (let i = 0; i < 6; i += 1) {
        expect((await login('baja', PASSWORD)).status).toBe(401);
        expect((await login('invitado', PASSWORD)).status).toBe(401);
      }

      expect(await counter(disabled)).toEqual({ failedAttempts: 0, lockedUntil: null });
      expect(await counter(guest)).toEqual({ failedAttempts: 0, lockedUntil: null });
      expect(await ctx.prisma.session.count()).toBe(0);
    });

    it('un rol cambiado en la BD cambia el resultado sin tocar la cuenta (RF-023)', async () => {
      const accountId = await createAccount('lucia');
      const role = await ctx.prisma.role.create({ data: { code: 'auditor', name: 'Auditor' } });
      await ctx.prisma.account.update({ where: { id: accountId }, data: { roleId: role.id } });

      expect((await login('lucia', PASSWORD)).status).toBe(401);
    });
  });

  describe('validación de la entrada', () => {
    it.each([
      ['contraseña vacía', { username: 'lucia', password: '' }],
      ['contraseña corta', { username: 'lucia', password: 'corta' }],
      ['usuario con dígitos', { username: 'lucia99', password: PASSWORD }],
      ['usuario vacío', { username: '   ', password: PASSWORD }],
      ['campo extra', { username: 'lucia', password: PASSWORD, extra: true }],
      ['sin cuerpo', {}],
    ])('%s responde 400 con errors[] y no cuenta el intento', async (_name, body) => {
      const accountId = await createAccount('lucia');

      const response = await request(ctx.server).post(LOGIN_PATH).send(body);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ type: 'validation-error', status: 400 });
      expect(Array.isArray((response.body as { errors: unknown }).errors)).toBe(true);
      expect(checkContract(response)).toEqual([]);
      expect(await counter(accountId)).toEqual({ failedAttempts: 0, lockedUntil: null });
      expect(await ctx.prisma.loginAttemptUnknown.count()).toBe(0);
    });

    it('un JSON mal formado responde 400 malformed-request', async () => {
      const response = await request(ctx.server)
        .post(LOGIN_PATH)
        .set('Content-Type', 'application/json')
        .send('{"username":');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ type: 'malformed-request' });
    });
  });

  describe('bloqueo por intentos fallidos', () => {
    it('cuatro fallos y el quinto bloquean 30 minutos; con la contraseña correcta sigue 423 (CA-007, CB-005)', async () => {
      const accountId = await createAccount('lucia');
      await failTimes('lucia', 4);
      expect((await counter(accountId)).lockedUntil).toBeNull();

      const fifth = await login('lucia', WRONG);

      expect(fifth.status).toBe(423);
      expect(fifth.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(fifth.body).toMatchObject({
        type: 'auth/account-locked',
        status: 423,
        lockedMinutesRemaining: 30,
      });
      expect(checkContract(fifth)).toEqual([]);
      const locked = await counter(accountId);
      expect(locked.failedAttempts).toBe(5);

      const correct = await login('lucia', PASSWORD);
      expect(correct.status).toBe(423);
      expect(setCookies(correct)).toEqual([]);
      expect(await ctx.prisma.session.count()).toBe(0);
      expect(await counter(accountId)).toEqual(locked);
    });

    it('un intento durante el bloqueo no lo alarga (CB-005)', async () => {
      const accountId = await createAccount('lucia');
      await failTimes('lucia', 5);
      const before = await counter(accountId);

      await login('lucia', WRONG);
      await login('lucia', PASSWORD);

      expect(await counter(accountId)).toEqual(before);
    });

    it('los minutos restantes bajan con el tiempo y nunca son menores que 1', async () => {
      const accountId = await createAccount('lucia');
      await failTimes('lucia', 5);
      await ctx.prisma.account.update({
        where: { id: accountId },
        data: { lockedUntil: new Date(Date.now() + 10 * MINUTE_MS - 5000) },
      });

      const response = await login('lucia', PASSWORD);
      const near = await ctx.prisma.account.update({
        where: { id: accountId },
        data: { lockedUntil: new Date(Date.now() + 2000) },
      });
      const last = await login('lucia', PASSWORD);

      expect(near.lockedUntil).not.toBeNull();
      expect(response.body).toMatchObject({ lockedMinutesRemaining: 10 });
      expect(last.body).toMatchObject({ status: 423, lockedMinutesRemaining: 1 });
    });

    it('entrar con tres fallos previos reinicia el contador (CA-008)', async () => {
      const accountId = await createAccount('lucia');
      await failTimes('lucia', 3);
      expect((await counter(accountId)).failedAttempts).toBe(3);

      expect((await login('lucia', PASSWORD)).status).toBe(200);

      expect(await counter(accountId)).toEqual({ failedAttempts: 0, lockedUntil: null });
    });

    it('con locked_until en el pasado entra y el contador queda a 0 (CA-016)', async () => {
      const accountId = await createAccount('lucia');
      await failTimes('lucia', 5);
      await expireLock(accountId);

      expect((await login('lucia', PASSWORD)).status).toBe(200);

      expect(await counter(accountId)).toEqual({ failedAttempts: 0, lockedUntil: null });
    });

    it('tras el desbloqueo hacen falta otros cinco fallos para bloquear de nuevo (CB-013)', async () => {
      const accountId = await createAccount('lucia');
      await failTimes('lucia', 5);
      await expireLock(accountId);

      for (let i = 0; i < 4; i += 1) {
        expect((await login('lucia', WRONG)).status).toBe(401);
      }
      expect((await counter(accountId)).failedAttempts).toBe(4);
      expect((await login('lucia', WRONG)).status).toBe(423);
    });

    it('cinco fallos simultáneos desde varios dispositivos bloquean una sola vez (CB-006)', async () => {
      const accountId = await createAccount('lucia');

      const responses = await Promise.all(
        Array.from({ length: 5 }, (_unused, index) =>
          login('lucia', WRONG).set('User-Agent', `dispositivo-${String(index)}`),
        ),
      );

      expect(responses.filter((response) => response.status === 423)).toHaveLength(1);
      expect(responses.filter((response) => response.status === 401)).toHaveLength(4);
      const locked = await counter(accountId);
      expect(locked.failedAttempts).toBe(5);
      expect(locked.lockedUntil).not.toBeNull();

      const sixth = await login('lucia', PASSWORD);
      expect(sixth.status).toBe(423);
      expect(await counter(accountId)).toEqual(locked);

      await expireLock(accountId);
      expect((await login('lucia', PASSWORD)).status).toBe(200);
      expect(await counter(accountId)).toEqual({ failedAttempts: 0, lockedUntil: null });
    });

    it('un usuario inexistente se bloquea con la misma respuesta que una cuenta real y no crea cuentas (CB-004)', async () => {
      const accountsBefore = await ctx.prisma.account.count();
      const real = await createAccount('lucia');
      await failTimes('lucia', 4);
      const realFifth = await login('lucia', WRONG);
      for (let i = 0; i < 4; i += 1) {
        expect((await login('fantasma', WRONG)).status).toBe(401);
      }

      const ghostFifth = await login('fantasma', WRONG);
      const ghostCorrectLooking = await login('fantasma', PASSWORD);

      expect(ghostFifth.status).toBe(423);
      expect(ghostFifth.body).toMatchObject({ type: 'auth/account-locked', lockedMinutesRemaining: 30 });
      expect(withoutCorrelation(ghostFifth.body)).toEqual(withoutCorrelation(realFifth.body));
      expect(ghostCorrectLooking.status).toBe(423);
      expect(checkContract(ghostFifth)).toEqual([]);
      expect(await ctx.prisma.account.count()).toBe(accountsBefore + 1);
      expect(await ctx.prisma.loginAttemptUnknown.count()).toBe(1);
      expect((await counter(real)).failedAttempts).toBe(5);
    });

    it('64 letras que se alargan al pasar a minúsculas (İ) responden 401 y cuentan el intento como un usuario inexistente (CB-004, CB-005)', async () => {
      const longUsername = 'İ'.repeat(64);

      for (let i = 0; i < 4; i += 1) {
        const response = await login(longUsername, WRONG);
        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ type: 'auth/invalid-credentials' });
      }
      const fifth = await login(longUsername, WRONG);

      expect(fifth.status).toBe(423);
      expect(fifth.body).toMatchObject({ type: 'auth/account-locked', lockedMinutesRemaining: 30 });
      expect(await ctx.prisma.loginAttemptUnknown.count()).toBe(1);
      expect(await ctx.prisma.account.count()).toBe(0);
    });

    it('el contador del usuario inexistente no se comparte con otro usuario inexistente', async () => {
      for (let i = 0; i < 5; i += 1) {
        await login('fantasma', WRONG);
      }

      expect((await login('otrofantasma', WRONG)).status).toBe(401);
    });
  });

  describe('atomicidad del acierto (RF-009)', () => {
    it('si la sesión no se puede crear, el contador conserva sus fallos y no hay sesión', async () => {
      const accountId = await createAccount('lucia');
      await failTimes('lucia', 3);
      const sessions = ctx.app.get<{ create: (...args: unknown[]) => Promise<unknown> }>(SESSION_REPOSITORY);
      vi.spyOn(sessions, 'create').mockRejectedValueOnce(new Error('session store down'));

      const response = await login('lucia', PASSWORD);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({ type: 'internal-error' });
      expect(setCookies(response)).toEqual([]);
      expect(await counter(accountId)).toMatchObject({ failedAttempts: 3 });
      expect(await ctx.prisma.session.count()).toBe(0);

      expect((await login('lucia', PASSWORD)).status).toBe(200);
      expect(await counter(accountId)).toEqual({ failedAttempts: 0, lockedUntil: null });
    });
  });

  describe('Origin (ADR-007)', () => {
    it('un Origin no permitido responde 403 auth/csrf-invalid sin cookies ni intento contado', async () => {
      const accountId = await createAccount('lucia');

      const response = await login('lucia', PASSWORD).set('Origin', 'https://evil.example');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ type: 'auth/csrf-invalid' });
      expect(setCookies(response)).toEqual([]);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(checkContract(response)).toEqual([]);
      expect(await counter(accountId)).toEqual({ failedAttempts: 0, lockedUntil: null });
    });

    it('un Origin permitido entra sin token CSRF', async () => {
      await createAccount('lucia');

      const response = await login('lucia', PASSWORD).set('Origin', ALLOWED_ORIGIN);

      expect(response.status).toBe(200);
    });
  });

  describe('auditoría y secretos en los logs', () => {
    it('registra fallos, bloqueos y aciertos con accountId y sin usuario, contraseña ni tokens', async () => {
      const accountId = await createAccount('zqxjwk');
      const typedPassword = 'Escrita-Por-Error-42';
      ctx.clear();

      await login('Zqxjwk', typedPassword);
      await login('Fantasmazqx', typedPassword);
      await failTimes('zqxjwk', 4);
      await login('zqxjwk', PASSWORD);
      await expireLock(accountId);
      const success = await login('zqxjwk', PASSWORD);

      const records = ctx.records();
      const events = records.filter((record) => typeof record.event === 'string');
      const failed = events.filter((record) => record.event === 'auth.login.failed');
      expect(failed.map((record) => record.reason)).toContain('unknown-user');
      expect(failed.map((record) => record.reason)).toContain('invalid-password');
      expect(failed.find((record) => record.reason === 'invalid-password')).toMatchObject({
        level: 'warn',
        accountId,
      });
      expect(failed.every((record) => typeof record.correlationId === 'string')).toBe(true);
      expect(events.some((record) => record.event === 'auth.login.locked' && record.accountId === accountId)).toBe(true);
      expect(events.find((record) => record.event === 'auth.login.succeeded')).toMatchObject({
        level: 'info',
        accountId,
      });

      const logs = ctx.lines.join('\n').toLowerCase();
      for (const secret of [
        'zqxjwk',
        'fantasmazqx',
        typedPassword,
        PASSWORD,
        WRONG,
        cookieValue(success, SID),
        cookieValue(success, CSRF),
        luciaHash,
      ]) {
        expect(logs).not.toContain(secret.toLowerCase());
      }
    });
  });

  describe('la transacción solo contiene escrituras cortas (RT-021)', () => {
    it('verify y hash terminan antes de abrir la transacción, que usa un timeout explícito', async () => {
      await createAccount('lucia', { passwordHash: await weakPasswordHash(PASSWORD) });
      const events: string[] = [];
      const options: unknown[] = [];
      const realVerify = hasher.verify.bind(hasher);
      const realHash = hasher.hash.bind(hasher);
      vi.spyOn(hasher, 'verify').mockImplementation(async (hash, password) => {
        events.push('verify:start');
        const result = await realVerify(hash, password);
        events.push('verify:end');
        return result;
      });
      vi.spyOn(hasher, 'hash').mockImplementation(async (password) => {
        events.push('hash:start');
        const result = await realHash(password);
        events.push('hash:end');
        return result;
      });
      const realTransaction = ctx.prisma.$transaction.bind(ctx.prisma) as (
        ...args: unknown[]
      ) => Promise<unknown>;
      vi.spyOn(ctx.prisma, '$transaction').mockImplementation(((...args: unknown[]) => {
        events.push('transaction:open');
        options.push(args[1]);
        return realTransaction(...args);
      }));

      const response = await login('lucia', PASSWORD);

      expect(response.status).toBe(200);
      expect(events).toEqual(['verify:start', 'verify:end', 'hash:start', 'hash:end', 'transaction:open']);
      expect(options).toEqual([{ maxWait: TRANSACTION_MAX_WAIT_MS, timeout: TRANSACTION_TIMEOUT_MS }]);
    });
  });

  describe('duración del login completo (RT-021)', () => {
    it('con los parámetros reales del hash el p95 del login es de 1 s o menos', async () => {
      await createAccount('lucia');
      await login('lucia', PASSWORD);
      const samples: number[] = [];

      for (let i = 0; i < RT021_SAMPLES; i += 1) {
        const started = performance.now();
        const response = await login('lucia', PASSWORD);
        samples.push(performance.now() - started);
        expect(response.status).toBe(200);
      }

      const sorted = [...samples].sort((a, b) => a - b);
      const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1] ?? Number.POSITIVE_INFINITY;
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      process.stdout.write(
        `RT-021 login completo (m=${String(ctx.config.passwordHash.memoryKib)} KiB, t=${String(ctx.config.passwordHash.iterations)}, p=${String(ctx.config.passwordHash.parallelism)}): ` +
          `n=${String(sorted.length)} mediana=${median.toFixed(0)} ms p95=${p95.toFixed(0)} ms max=${(sorted.at(-1) ?? 0).toFixed(0)} ms\n`,
      );
      expect(p95).toBeLessThanOrEqual(RT021_LIMIT_MS);
    });
  });
});
