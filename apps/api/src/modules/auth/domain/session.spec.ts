import { describe, expect, it } from 'vitest';

import { Session } from './session';

const CREATED = new Date('2026-10-16T08:00:00.000Z');
const HOUR_MS = 3_600_000;

function sessionOf(ttlHours: number, revokedAt: Date | null = null): Session {
  return new Session({
    id: 's1',
    accountId: 'a1',
    csrfTokenHash: 'c'.repeat(64),
    createdAt: CREATED,
    expiresAt: Session.expiryFor(CREATED, ttlHours),
    revokedAt,
  });
}

describe('Session', () => {
  it('RT-011: expiryFor suma el TTL en horas (con decimales) a createdAt', () => {
    expect(Session.expiryFor(CREATED, 8).getTime()).toBe(CREATED.getTime() + 8 * HOUR_MS);
    expect(Session.expiryFor(CREATED, 0.5).getTime()).toBe(CREATED.getTime() + HOUR_MS / 2);
  });

  it('CA-018: a las 7 h 59 min es válida y a las 8 h 00 min está caducada', () => {
    const session = sessionOf(8);

    expect(session.isExpired(new Date(CREATED.getTime() + 8 * HOUR_MS - 60_000))).toBe(false);
    expect(session.isExpired(new Date(CREATED.getTime() + 8 * HOUR_MS))).toBe(true);
    expect(session.isExpired(new Date(CREATED.getTime() + 9 * HOUR_MS))).toBe(true);
  });

  it('isRevoked refleja revokedAt', () => {
    expect(sessionOf(8).isRevoked()).toBe(false);
    expect(sessionOf(8, CREATED).isRevoked()).toBe(true);
  });
});
