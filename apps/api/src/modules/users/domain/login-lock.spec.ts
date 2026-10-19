import { describe, expect, it } from 'vitest';

import type { Clock } from '../../../shared/time/clock.port';

import { Account } from './account';
import { isAccountStatus } from './account-status';
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_FAILED_ATTEMPTS, LoginLock } from './login-lock';

const MS_PER_MINUTE = 60_000;

class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * MS_PER_MINUTE);
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

function failTimes(lock: LoginLock, clock: Clock, times: number): LoginLock {
  let result = lock;
  for (let i = 0; i < times; i += 1) {
    result = result.recordFailure(clock.now());
  }
  return result;
}

describe('LoginLock (RF-008, RF-009, RF-017)', () => {
  const start = new Date('2026-10-16T10:00:00.000Z');

  it('usa los umbrales de la spec: 5 fallos y 30 minutos', () => {
    expect(LOGIN_MAX_FAILED_ATTEMPTS).toBe(5);
    expect(LOGIN_LOCK_MINUTES).toBe(30);
  });

  it('4 fallos no bloquean (CA-007)', () => {
    const clock = new FakeClock(start);
    const lock = failTimes(LoginLock.none(), clock, 4);

    expect(lock.failedAttempts).toBe(4);
    expect(lock.isLocked(clock.now())).toBe(false);
    expect(lock.lockedUntil).toBeNull();
    expect(lock.minutesRemaining(clock.now())).toBe(0);
  });

  it('el 5.º fallo bloquea 30 minutos (CA-007)', () => {
    const clock = new FakeClock(start);
    const lock = failTimes(LoginLock.none(), clock, 5);

    expect(lock.failedAttempts).toBe(5);
    expect(lock.isLocked(clock.now())).toBe(true);
    expect(lock.lockedUntil).toEqual(new Date(start.getTime() + 30 * MS_PER_MINUTE));
    expect(lock.minutesRemaining(clock.now())).toBe(30);
  });

  it('un acierto reinicia el contador y limpia el bloqueo (CA-008, RF-009)', () => {
    const clock = new FakeClock(start);
    const lock = failTimes(LoginLock.none(), clock, 3).recordSuccess();

    expect(lock.failedAttempts).toBe(0);
    expect(lock.lockedUntil).toBeNull();
  });

  it('durante el bloqueo un fallo no cambia el estado ni alarga el bloqueo (CB-005)', () => {
    const clock = new FakeClock(start);
    const locked = failTimes(LoginLock.none(), clock, 5);
    clock.advanceMinutes(10);

    const after = locked.recordFailure(clock.now());

    expect(after).toBe(locked);
    expect(after.failedAttempts).toBe(5);
    expect(after.lockedUntil).toEqual(locked.lockedUntil);
    expect(after.minutesRemaining(clock.now())).toBe(20);
  });

  it('a los 30 minutos exactos el bloqueo está vencido (CA-016, RF-017)', () => {
    const clock = new FakeClock(start);
    const locked = failTimes(LoginLock.none(), clock, 5);
    clock.advanceMinutes(30);

    expect(locked.isLocked(clock.now())).toBe(false);
    expect(locked.minutesRemaining(clock.now())).toBe(0);
  });

  it('tras el desbloqueo un fallo empieza un contador nuevo y hacen falta 5 fallos nuevos (CB-013)', () => {
    const clock = new FakeClock(start);
    const locked = failTimes(LoginLock.none(), clock, 5);
    clock.advanceMinutes(31);

    const first = locked.recordFailure(clock.now());
    expect(first.failedAttempts).toBe(1);
    expect(first.lockedUntil).toBeNull();

    const fourth = failTimes(first, clock, 3);
    expect(fourth.failedAttempts).toBe(4);
    expect(fourth.isLocked(clock.now())).toBe(false);

    const fifth = fourth.recordFailure(clock.now());
    expect(fifth.isLocked(clock.now())).toBe(true);
    expect(fifth.minutesRemaining(clock.now())).toBe(30);
  });

  it('con el bloqueo vencido un acierto deja el contador en 0 (RF-017)', () => {
    const clock = new FakeClock(start);
    const locked = failTimes(LoginLock.none(), clock, 5);
    clock.advanceMinutes(45);

    const lock = locked.recordSuccess();

    expect(lock.failedAttempts).toBe(0);
    expect(lock.isLocked(clock.now())).toBe(false);
  });

  it('redondea hacia arriba los minutos restantes y nunca devuelve 0 si sigue bloqueada', () => {
    const clock = new FakeClock(start);
    const locked = failTimes(LoginLock.none(), clock, 5);

    clock.advanceMs(1);
    expect(locked.minutesRemaining(clock.now())).toBe(30);

    clock.advanceMinutes(28);
    expect(locked.minutesRemaining(clock.now())).toBe(2);

    clock.advanceMs(MS_PER_MINUTE);
    expect(locked.isLocked(clock.now())).toBe(true);
    expect(locked.minutesRemaining(clock.now())).toBe(1);
  });
});

describe('Account y AccountStatus', () => {
  const account = new Account({
    id: '0196a0b0-0000-7000-8000-000000000001',
    username: 'Lucia',
    usernameKey: 'lucia',
    roleCode: 'admin',
    status: 'ACTIVE',
    passwordHash: '$argon2id$x',
    lock: LoginLock.none(),
  });

  it('informa de si está activa y de su rol', () => {
    expect(account.isActive()).toBe(true);
    expect(account.hasRole('admin')).toBe(true);
    expect(account.hasRole('buyer')).toBe(false);
  });

  it('una cuenta DISABLED no está activa', () => {
    const disabled = new Account({
      id: account.id,
      username: account.username,
      usernameKey: account.usernameKey,
      roleCode: account.roleCode,
      status: 'DISABLED',
      passwordHash: account.passwordHash,
      lock: account.lock,
    });

    expect(disabled.isActive()).toBe(false);
  });

  it('solo reconoce los estados definidos', () => {
    expect(isAccountStatus('ACTIVE')).toBe(true);
    expect(isAccountStatus('DISABLED')).toBe(true);
    expect(isAccountStatus('active')).toBe(false);
    expect(isAccountStatus('')).toBe(false);
  });
});
