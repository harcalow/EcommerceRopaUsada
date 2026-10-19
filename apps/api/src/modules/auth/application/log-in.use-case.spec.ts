import { beforeEach, describe, expect, it } from 'vitest';

import { CounterTokenGenerator } from '../../../../test/helpers/counter-token-generator';
import {
  fakeHash,
  FakePasswordHasher,
  FakeTransactionRunner,
  InMemoryAccountRepository,
  InMemoryUnknownAttempts,
  RecordingLoginAudit,
} from '../../../../test/helpers/in-memory-login';
import { InMemorySessionRepository } from '../../../../test/helpers/in-memory-session.repository';
import type { Clock } from '../../../shared/time/clock.port';

import { LogIn, type LogInResult } from './log-in.use-case';
import { OpenSession } from './open-session.use-case';

const START = Date.parse('2026-10-16T08:00:00.000Z');
const MINUTE_MS = 60_000;
const PASSWORD = 'Perch@ 2026';
const ACCOUNT_ID = 'account-lucia';

describe('LogIn (RF-001, RF-004, RF-008, RF-009, RF-017, RF-023)', () => {
  let nowMs: number;
  let accounts: InMemoryAccountRepository;
  let unknown: InMemoryUnknownAttempts;
  let hasher: FakePasswordHasher;
  let sessions: InMemorySessionRepository;
  let transactions: FakeTransactionRunner;
  let audit: RecordingLoginAudit;
  let logIn: LogIn;
  const tokens = new CounterTokenGenerator();

  beforeEach(() => {
    nowMs = START;
    const now = (): Date => new Date(nowMs);
    const clock: Clock = { now };
    accounts = new InMemoryAccountRepository(now);
    unknown = new InMemoryUnknownAttempts(now);
    hasher = new FakePasswordHasher();
    sessions = new InMemorySessionRepository();
    transactions = new FakeTransactionRunner();
    audit = new RecordingLoginAudit();
    accounts.add({
      id: ACCOUNT_ID,
      username: 'Lucia',
      usernameKey: 'lucia',
      roleCode: 'admin',
      status: 'ACTIVE',
      passwordHash: fakeHash(PASSWORD),
    });
    sessions.addAccount(ACCOUNT_ID);
    logIn = new LogIn(
      accounts,
      unknown,
      hasher,
      transactions,
      audit,
      new OpenSession(sessions, tokens, clock, 8),
    );
  });

  function attempt(username: string, password: string, previousToken?: string): Promise<LogInResult> {
    return logIn.execute({ username, password, ...(previousToken === undefined ? {} : { previousToken }) });
  }

  async function failTimes(count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      await attempt('lucia', 'wrong-password');
    }
  }

  it('credenciales correctas abren la sesión con el rol de la cuenta (CA-001)', async () => {
    const result = await attempt('lucia', PASSWORD);

    expect(result).toMatchObject({ status: 'success', role: 'admin' });
    expect(sessions.rows.size).toBe(1);
    expect(audit.events).toEqual([{ name: 'auth.login.succeeded', accountId: ACCOUNT_ID }]);
  });

  it('el usuario se compara sin distinguir mayúsculas y la contraseña sí las distingue (CB-002)', async () => {
    expect((await attempt('LUCIA', PASSWORD)).status).toBe('success');
    expect((await attempt('lucia', PASSWORD.toLowerCase())).status).toBe('invalid-credentials');
  });

  it('un usuario inexistente gasta verifyDummy y no verify (CB-003)', async () => {
    const result = await attempt('nadie', PASSWORD);

    expect(result).toEqual({ status: 'invalid-credentials' });
    expect(hasher.dummyCalls).toHaveLength(1);
    expect(hasher.verifyCalls).toHaveLength(0);
    expect(audit.events).toEqual([{ name: 'auth.login.failed', reason: 'unknown-user' }]);
  });

  it('una contraseña incorrecta da el mismo resultado que un usuario inexistente (CA-003)', async () => {
    const wrong = await attempt('lucia', 'otra-clave-1');
    const missing = await attempt('nadie', 'otra-clave-1');

    expect(wrong).toEqual(missing);
    expect(hasher.dummyCalls).toHaveLength(1);
    expect(hasher.verifyCalls).toHaveLength(1);
  });

  it('el quinto fallo bloquea 30 minutos y responde 423 (CA-007)', async () => {
    await failTimes(4);

    const fifth = await attempt('lucia', 'wrong-password');

    expect(fifth).toEqual({ status: 'locked', minutesRemaining: 30 });
    expect(audit.events.filter((event) => event.name === 'auth.login.locked')).toEqual([
      { name: 'auth.login.locked', accountId: ACCOUNT_ID },
    ]);
  });

  it('con el bloqueo vigente la contraseña correcta no entra, no alarga el bloqueo y verifica igual (CB-005)', async () => {
    await failTimes(5);
    const lockedUntil = accounts.get('lucia').lock.lockedUntil;
    nowMs += 10 * MINUTE_MS;
    hasher.verifyCalls.length = 0;

    const result = await attempt('lucia', PASSWORD);

    expect(result).toEqual({ status: 'locked', minutesRemaining: 20 });
    expect(hasher.verifyCalls).toHaveLength(1);
    expect(accounts.get('lucia').lock.lockedUntil).toEqual(lockedUntil);
    expect(sessions.rows.size).toBe(0);
  });

  it('un fallo durante el bloqueo no cambia el contador ni el instante de desbloqueo (CB-005)', async () => {
    await failTimes(5);
    const before = accounts.get('lucia').lock;
    nowMs += MINUTE_MS;

    const result = await attempt('lucia', 'wrong-password');

    expect(result.status).toBe('locked');
    expect(accounts.get('lucia').lock).toEqual(before);
  });

  it('a los 30 minutos entra y el contador queda a 0 (CA-016)', async () => {
    await failTimes(5);
    nowMs += 30 * MINUTE_MS;

    const result = await attempt('lucia', PASSWORD);

    expect(result.status).toBe('success');
    expect(accounts.get('lucia').lock).toMatchObject({ failedAttempts: 0, lockedUntil: null });
  });

  it('tras el desbloqueo hacen falta otros cinco fallos para volver a bloquear (CB-013)', async () => {
    await failTimes(5);
    nowMs += 30 * MINUTE_MS;

    for (let i = 0; i < 4; i += 1) {
      expect((await attempt('lucia', 'wrong-password')).status).toBe('invalid-credentials');
    }
    expect((await attempt('lucia', 'wrong-password')).status).toBe('locked');
  });

  it('entrar con fallos previos reinicia el contador (CA-008)', async () => {
    await failTimes(3);

    await attempt('lucia', PASSWORD);

    expect(accounts.get('lucia').lock.failedAttempts).toBe(0);
  });

  it('el reinicio del contador y la sesión comparten la misma transacción (RF-009)', async () => {
    await attempt('lucia', PASSWORD);

    expect(transactions.runs).toBe(1);
    expect(accounts.transactionsSeen).toEqual([transactions.context]);
  });

  it('ninguna derivación de hash ocurre con la transacción abierta (RT-021)', async () => {
    hasher.inTransaction = () => transactions.active;
    hasher.outdatedHashes.add(fakeHash(PASSWORD));

    await attempt('lucia', PASSWORD);
    await attempt('lucia', 'otra clave');
    await attempt('nadie', PASSWORD);

    expect(transactions.runs).toBe(1);
    expect(hasher.hashCalls).toEqual([PASSWORD]);
    expect(hasher.callsInsideTransaction).toEqual([]);
  });

  it('un usuario inexistente se bloquea como una cuenta real y nunca crea cuentas (CB-004)', async () => {
    for (let i = 0; i < 4; i += 1) {
      expect(await attempt('fantasma', PASSWORD)).toEqual({ status: 'invalid-credentials' });
    }

    expect(await attempt('fantasma', PASSWORD)).toEqual({ status: 'locked', minutesRemaining: 30 });
    expect(await attempt('fantasma', PASSWORD)).toEqual({ status: 'locked', minutesRemaining: 30 });
    expect(unknown.count()).toBe(1);
    expect(sessions.rows.size).toBe(0);
  });

  it.each([
    ['desactivada', { status: 'DISABLED' as const, roleCode: 'admin' }, 'disabled'],
    ['sin rol admin', { status: 'ACTIVE' as const, roleCode: 'auditor' }, 'not-admin'],
  ])('una cuenta %s con la contraseña correcta recibe el 401 genérico sin tocar el contador (CA-019, CB-012)', async (_n, change, reason) => {
    accounts.add({
      id: 'account-other',
      username: 'Otra',
      usernameKey: 'otra',
      passwordHash: fakeHash(PASSWORD),
      ...change,
    });

    const result = await attempt('otra', PASSWORD);

    expect(result).toEqual({ status: 'invalid-credentials' });
    expect(accounts.get('otra').lock).toMatchObject({ failedAttempts: 0, lockedUntil: null });
    expect(sessions.rows.size).toBe(0);
    expect(audit.events).toEqual([{ name: 'auth.login.failed', reason, accountId: 'account-other' }]);
  });

  it('revoca la sesión previa de la petición al abrir la nueva (ADR-007)', async () => {
    const first = await attempt('lucia', PASSWORD);
    if (first.status !== 'success') throw new Error('expected success');

    await attempt('lucia', PASSWORD, first.session.token);

    const old = sessions.rows.get(tokens.hash(first.session.token));
    expect(old?.isRevoked()).toBe(true);
    expect(sessions.rows.size).toBe(2);
  });

  it('rehashea la contraseña cuando los parámetros quedaron por debajo de los vigentes', async () => {
    hasher.outdatedHashes.add(fakeHash(PASSWORD));

    await attempt('lucia', PASSWORD);

    expect(hasher.hashCalls).toEqual([PASSWORD]);
    expect(accounts.get('lucia').passwordHash).toBe(`new:${PASSWORD}`);
  });

  it('no rehashea si el hash está al día', async () => {
    await attempt('lucia', PASSWORD);

    expect(hasher.hashCalls).toHaveLength(0);
    expect(accounts.get('lucia').passwordHash).toBe(fakeHash(PASSWORD));
  });

  it('la auditoría nunca contiene el usuario tecleado ni la contraseña', async () => {
    await attempt('Nadie', 'una-clave-secreta');
    await attempt('lucia', 'otra-clave-secreta');
    await failTimes(5);
    await attempt('lucia', PASSWORD);

    const text = JSON.stringify(audit.events).toLowerCase();
    expect(audit.events.length).toBeGreaterThan(0);
    expect(text).not.toContain('nadie');
    expect(text).not.toContain('secreta');
    expect(text).not.toContain(PASSWORD.toLowerCase());
  });
});
