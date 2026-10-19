import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SECRETS, createLoggedApp, type LoggedApp } from '../../../test/helpers/logged-app';

const UUID_PATTERN = /^[0-9a-f-]{36}$/;

describe('logs JSON con correlación (RT-006)', () => {
  let logged: LoggedApp;

  beforeAll(async () => {
    logged = await createLoggedApp();
  });

  beforeEach(() => {
    logged.clear();
  });

  afterAll(async () => {
    await logged.app.close();
  });

  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  it('devuelve el id en la cabecera y lo repite, con nivel, en todas las líneas de la petición', async () => {
    const response = await request(logged.server).get('/v1/demo').expect(200);
    await flush();

    const id = response.header['x-correlation-id'];
    expect(id).toMatch(UUID_PATTERN);
    const records = logged.records();
    expect(records.length).toBeGreaterThanOrEqual(2);
    expect(records.every((record) => record.correlationId === id)).toBe(true);
    expect(records.every((record) => typeof record.level === 'string')).toBe(true);
  });

  it('reutiliza un id entrante válido', async () => {
    const response = await request(logged.server)
      .get('/v1/demo')
      .set('X-Correlation-Id', 'web-abc.1')
      .expect(200);
    await flush();

    expect(response.header['x-correlation-id']).toBe('web-abc.1');
    expect(logged.records().every((record) => record.correlationId === 'web-abc.1')).toBe(true);
  });

  it('descarta un id inválido y genera uno nuevo', async () => {
    const response = await request(logged.server)
      .get('/v1/demo')
      .set('X-Correlation-Id', 'a'.repeat(129))
      .expect(200);

    expect(response.header['x-correlation-id']).toMatch(UUID_PATTERN);
  });

  it('devuelve la cabecera también en rutas inexistentes', async () => {
    const response = await request(logged.server).get('/no-existe').expect(404);

    expect(response.header['x-correlation-id']).toBeDefined();
  });

  it('no escribe contraseñas, cookies ni Authorization en stdout', async () => {
    await request(logged.server)
      .post('/v1/demo')
      .set('Cookie', SECRETS.cookie)
      .set('Authorization', SECRETS.bearer)
      .send({ password: SECRETS.password })
      .expect(201);
    await flush();

    const output = logged.lines.join('\n');
    expect(output).toContain('login attempt');
    expect(output).toContain('[REDACTED]');
    for (const secret of [SECRETS.password, 'cookie-secret-value', 'bearer-secret-value', SECRETS.token]) {
      expect(output).not.toContain(secret);
    }
  });
});
