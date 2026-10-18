import { CORRELATION_ID_HEADER, PROBLEM_CONTENT_TYPE, problemSchema } from '@perchados/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  INTERNAL_DETAIL,
  TestRoutesController,
} from '../../../test/helpers/test-routes.controller';
import { createLoggedApp, type LoggedApp } from '../../../test/helpers/logged-app';

const CORRELATION_ID = 'req-problem-123';

function expectProblem(
  response: request.Response,
  expected: { status: number; type: string },
): void {
  expect(response.status).toBe(expected.status);
  expect(String(response.headers['content-type']).startsWith(PROBLEM_CONTENT_TYPE)).toBe(true);
  expect(response.headers['cache-control']).toBe('no-store');
  const problem = problemSchema.parse(response.body);
  expect(problem.type).toBe(expected.type);
  expect(problem.status).toBe(expected.status);
  expect(problem.correlationId).toBe(response.headers[CORRELATION_ID_HEADER.toLowerCase()]);
}

describe('errores problem+json (RT-005)', () => {
  let ctx: LoggedApp;

  beforeAll(async () => {
    ctx = await createLoggedApp(undefined, {
      controllers: [TestRoutesController],
      env: { BODY_LIMIT_KB: '1' },
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.clear();
    TestRoutesController.itemsCreated = 0;
  });

  it('responde 404 problem+json en una ruta inexistente de /v1', async () => {
    const response = await request(ctx.server).get('/v1/does-not-exist');

    expectProblem(response, { status: 404, type: 'not-found' });
  });

  it('responde 404 problem+json en una ruta fuera de /v1', async () => {
    const response = await request(ctx.server).get('/health');

    expectProblem(response, { status: 404, type: 'not-found' });
  });

  it('reutiliza el X-Correlation-Id recibido en cabecera y cuerpo', async () => {
    const response = await request(ctx.server)
      .get('/nada')
      .set(CORRELATION_ID_HEADER, CORRELATION_ID);

    expectProblem(response, { status: 404, type: 'not-found' });
    expect(response.body).toMatchObject({ correlationId: CORRELATION_ID });
    expect(response.headers[CORRELATION_ID_HEADER.toLowerCase()]).toBe(CORRELATION_ID);
  });

  it('responde 400 malformed-request con JSON inválido y correlationId', async () => {
    const response = await request(ctx.server)
      .post('/v1/test-routes/items')
      .set(CORRELATION_ID_HEADER, CORRELATION_ID)
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expectProblem(response, { status: 400, type: 'malformed-request' });
    expect(response.body).toMatchObject({ correlationId: CORRELATION_ID });
    expect(TestRoutesController.itemsCreated).toBe(0);
  });

  it('responde 400 validation-error con errors[] por campo sin ejecutar el controlador', async () => {
    const response = await request(ctx.server)
      .post('/v1/test-routes/items')
      .send({ address: {} });

    expectProblem(response, { status: 400, type: 'validation-error' });
    expect(response.body).toMatchObject({
      errors: [
        { path: 'name', message: 'Escribe el nombre', code: 'invalid_type' },
        { path: 'address.city', message: 'Escribe la ciudad', code: 'invalid_type' },
      ],
    });
    expect(TestRoutesController.itemsCreated).toBe(0);
  });

  it('responde 400 validation-error si no hay cuerpo', async () => {
    const response = await request(ctx.server).post('/v1/test-routes/items');

    expectProblem(response, { status: 400, type: 'validation-error' });
  });

  it('acepta un cuerpo válido y ejecuta el controlador con no-store', async () => {
    const body = { name: 'camisa', address: { city: 'Lima' } };

    const response = await request(ctx.server).post('/v1/test-routes/items').send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(body);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(TestRoutesController.itemsCreated).toBe(1);
  });

  it('responde 413 payload-too-large con un cuerpo mayor que BODY_LIMIT_KB', async () => {
    const response = await request(ctx.server)
      .post('/v1/test-routes/items')
      .set(CORRELATION_ID_HEADER, CORRELATION_ID)
      .send({ name: 'x'.repeat(2048) });

    expectProblem(response, { status: 413, type: 'payload-too-large' });
    expect(response.body).toMatchObject({ correlationId: CORRELATION_ID });
  });

  it('traduce una ProblemException con su tipo y detalle', async () => {
    const response = await request(ctx.server).get('/v1/test-routes/problem');

    expectProblem(response, { status: 403, type: 'auth/forbidden' });
    expect(response.body).toMatchObject({ detail: 'Sin permiso.' });
  });

  it('una HttpException 4xx no catalogada da un problem+json 4xx genérico, sin su mensaje y con log warn', async () => {
    const response = await request(ctx.server).get('/v1/test-routes/teapot');

    expectProblem(response, { status: 418, type: 'request-rejected' });
    expect(response.text).not.toContain(INTERNAL_DETAIL);
    const levels = ctx.records().map((record) => record.level);
    expect(levels).toContain('warn');
    expect(levels).not.toContain('error');
  });

  it.each([
    ['application/x-www-form-urlencoded', 'name=camisa&address[city]=Lima'],
    ['text/plain', 'name=camisa'],
  ])('un cuerpo %s no se interpreta: 400 problem+json y no ejecuta el controlador', async (type, body) => {
    const response = await request(ctx.server)
      .post('/v1/test-routes/items')
      .set('Content-Type', type)
      .send(body);

    expectProblem(response, { status: 400, type: 'validation-error' });
    expect(TestRoutesController.itemsCreated).toBe(0);
  });

  it('responde 500 sin filtrar detalles ni traza y la registra en el log error', async () => {
    const response = await request(ctx.server)
      .get('/v1/test-routes/boom')
      .set(CORRELATION_ID_HEADER, CORRELATION_ID);

    expectProblem(response, { status: 500, type: 'internal-error' });
    expect(response.text).not.toContain(INTERNAL_DETAIL);
    expect(response.text).not.toMatch(/\bat \S+ \(|\.ts:\d+|stack/i);
    const logged = ctx.records().filter((record) => record.level === 'error');
    expect(logged).toHaveLength(1);
    const serialized = JSON.stringify(logged[0]);
    expect(serialized).toContain(INTERNAL_DETAIL);
    expect(serialized).toContain('boom');
    expect(logged[0]).toMatchObject({ correlationId: CORRELATION_ID });
  });

  it('añade Cache-Control: no-store a las respuestas correctas', async () => {
    const response = await request(ctx.server).get('/v1/test-routes/ok');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
