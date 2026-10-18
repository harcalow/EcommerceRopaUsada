import { beforeEach, describe, expect, it } from 'vitest';

import { CounterTokenGenerator } from '../../../../test/helpers/counter-token-generator';
import { RecordingLoginAudit } from '../../../../test/helpers/in-memory-login';
import { InMemorySessionRepository } from '../../../../test/helpers/in-memory-session.repository';
import type { Clock } from '../../../shared/time/clock.port';

import { OpenSession } from './open-session.use-case';
import { RevokeSession } from './revoke-session.use-case';
import { ValidateSession } from './validate-session.use-case';

const START = Date.parse('2026-10-16T08:00:00.000Z');
const MINUTE_MS = 60_000;
const TTL_HOURS = 8;
const TTL_MIN = TTL_HOURS * 60;
const ACCOUNT = 'account-1';

describe('casos de uso de sesión (RF-020, RT-011)', () => {
  let nowMs: number;
  let repository: InMemorySessionRepository;
  let open: OpenSession;
  let validate: ValidateSession;
  let revoke: RevokeSession;
  let audit: RecordingLoginAudit;
  const tokens = new CounterTokenGenerator();
  const clock: Clock = { now: () => new Date(nowMs) };

  beforeEach(() => {
    nowMs = START;
    repository = new InMemorySessionRepository();
    repository.addAccount(ACCOUNT);
    open = new OpenSession(repository, tokens, clock, TTL_HOURS);
    validate = new ValidateSession(repository, tokens, clock);
    audit = new RecordingLoginAudit();
    revoke = new RevokeSession(repository, tokens, clock, audit);
  });

  function advanceMinutes(minutes: number): void {
    nowMs = START + minutes * MINUTE_MS;
  }

  describe('OpenSession', () => {
    it('genera un token distinto en cada apertura y persiste solo su hash', async () => {
      const first = await open.execute({ accountId: ACCOUNT });
      const second = await open.execute({ accountId: ACCOUNT });

      expect(first.token).not.toBe(second.token);
      expect(first.csrfToken).not.toBe(first.token);
      const stored = [...repository.rows.values()];
      expect(stored.map((row) => row.tokenHash)).toContain(tokens.hash(first.token));
      expect(JSON.stringify(stored)).not.toContain(first.token);
      expect(JSON.stringify(stored)).not.toContain(first.csrfToken);
      expect(stored[0]?.csrfTokenHash).toBe(tokens.hash(first.csrfToken));
    });

    it('la caducidad se calcula desde createdAt: ahora + SESSION_TTL_HOURS', async () => {
      const opened = await open.execute({ accountId: ACCOUNT });

      expect(opened.expiresAt.getTime()).toBe(START + TTL_MIN * MINUTE_MS);
    });

    it('un nuevo OpenSession con el token previo revoca la sesión anterior (fijación de sesión)', async () => {
      const first = await open.execute({ accountId: ACCOUNT });
      const second = await open.execute({
        accountId: ACCOUNT,
        previousToken: first.token,
      });

      expect((await validate.execute(first.token)).status).toBe('unauthenticated');
      expect((await validate.execute(second.token)).status).toBe('valid');
    });

    it('sin token previo (o con uno mal formado) no revoca las demás sesiones', async () => {
      const first = await open.execute({ accountId: ACCOUNT });
      await open.execute({ accountId: ACCOUNT, previousToken: 'basura' });
      await open.execute({ accountId: ACCOUNT });

      expect((await validate.execute(first.token)).status).toBe('valid');
    });
  });

  describe('ValidateSession', () => {
    it('devuelve la sesión con el rol leído de la cuenta', async () => {
      const opened = await open.execute({ accountId: ACCOUNT });

      const result = await validate.execute(opened.token);

      expect(result).toMatchObject({
        status: 'valid',
        session: {
          accountId: ACCOUNT,
          role: 'admin',
          expiresAt: opened.expiresAt,
          csrfTokenHash: tokens.hash(opened.csrfToken),
        },
      });
    });

    it('RF-023: si cambia el rol de la cuenta, la misma sesión devuelve el rol nuevo', async () => {
      const opened = await open.execute({ accountId: ACCOUNT });
      repository.addAccount(ACCOUNT, { active: true, roleCode: 'buyer' });

      const result = await validate.execute(opened.token);

      expect(result).toMatchObject({
        status: 'valid',
        session: { role: 'buyer' },
      });
    });

    it('CA-018: a los 7 h 59 min es válida y a las 8 h 00 min está caducada', async () => {
      const opened = await open.execute({ accountId: ACCOUNT });

      advanceMinutes(TTL_MIN - 1);
      expect((await validate.execute(opened.token)).status).toBe('valid');
      advanceMinutes(TTL_MIN);
      expect((await validate.execute(opened.token)).status).toBe('expired');
    });

    it('un token desconocido, mal formado, vacío o ausente es no autenticado', async () => {
      for (const token of [tokens.generate(), 'basura', '', undefined]) {
        expect(await validate.execute(token)).toEqual({
          status: 'unauthenticated',
        });
      }
    });

    it('una sesión revocada es no autenticada', async () => {
      const opened = await open.execute({ accountId: ACCOUNT });
      await revoke.execute(opened.token);

      expect(await validate.execute(opened.token)).toEqual({
        status: 'unauthenticated',
      });
    });

    it('CB-012: una cuenta desactivada invalida su sesión, aunque esté caducada', async () => {
      const opened = await open.execute({ accountId: ACCOUNT });
      repository.addAccount(ACCOUNT, { active: false, roleCode: 'admin' });

      expect(await validate.execute(opened.token)).toEqual({
        status: 'unauthenticated',
      });
      advanceMinutes(TTL_MIN + 1);
      expect(await validate.execute(opened.token)).toEqual({
        status: 'unauthenticated',
      });
    });
  });

  describe('RevokeSession', () => {
    it('revoca solo la sesión indicada y es idempotente', async () => {
      const first = await open.execute({ accountId: ACCOUNT });
      const second = await open.execute({ accountId: ACCOUNT });

      await revoke.execute(first.token);
      await revoke.execute(first.token);

      expect((await validate.execute(first.token)).status).toBe('unauthenticated');
      expect((await validate.execute(second.token)).status).toBe('valid');
    });

    it('no falla con tokens ausentes, mal formados o desconocidos', async () => {
      await expect(revoke.execute(undefined)).resolves.toBeUndefined();
      await expect(revoke.execute('basura')).resolves.toBeUndefined();
      await expect(revoke.execute(tokens.generate())).resolves.toBeUndefined();
      expect(audit.events).toEqual([]);
    });

    it('audita auth.logout con el accountId solo al revocar una sesión vigente y sin el token', async () => {
      const opened = await open.execute({ accountId: ACCOUNT });

      await revoke.execute(opened.token);
      await revoke.execute(opened.token);

      expect(audit.events).toEqual([{ name: 'auth.logout', accountId: ACCOUNT }]);
      expect(JSON.stringify(audit.events)).not.toContain(opened.token);
    });
  });
});
