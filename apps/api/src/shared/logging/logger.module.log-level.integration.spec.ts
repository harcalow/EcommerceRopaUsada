import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLoggedApp, type LoggedApp } from '../../../test/helpers/logged-app';

describe('LOG_LEVEL (RT-006)', () => {
  let logged: LoggedApp;

  beforeAll(async () => {
    logged = await createLoggedApp('warn');
  });

  afterAll(async () => {
    await logged.app.close();
  });

  it('con LOG_LEVEL=warn no emite líneas de nivel info', async () => {
    await request(logged.server).get('/v1/demo').expect(200);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(logged.records().filter((record) => record.level === 'info')).toEqual([]);
  });
});
