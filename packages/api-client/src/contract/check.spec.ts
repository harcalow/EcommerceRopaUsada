import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkContract } from './check';
import { renderTypes } from './render-types';

const documentOf = (title: string) => ({
  openapi: '3.0.3',
  info: { title, version: '1.0.0' },
  paths: {
    '/v1/ping': {
      get: { operationId: 'ping', responses: { '200': { description: 'ok' } } },
    },
  },
});

describe('checkContract', () => {
  let dir: string;
  let openapiPath: string;
  let generatedPath: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'contract-check-'));
    openapiPath = join(dir, 'v1.json');
    generatedPath = join(dir, 'v1.ts');
    const doc = documentOf('API');
    writeFileSync(openapiPath, `${JSON.stringify(doc, null, 2)}\n`);
    writeFileSync(generatedPath, await renderTypes(doc));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('no reporta nada si los archivos están al día', async () => {
    expect(await checkContract({ currentDocument: documentOf('API'), openapiPath, generatedPath })).toEqual([]);
  });

  it('tolera finales de línea CRLF', async () => {
    writeFileSync(openapiPath, readFileSync(openapiPath, 'utf8').replace(/\n/g, '\r\n'));
    expect(await checkContract({ currentDocument: documentOf('API'), openapiPath, generatedPath })).toEqual([]);
  });

  it('reporta v1.json y v1.ts cuando un esquema cambió sin regenerar', async () => {
    const problems = await checkContract({
      currentDocument: {
        ...documentOf('API'),
        paths: { '/v1/otro': { get: { operationId: 'otro', responses: { '200': { description: 'ok' } } } } },
      },
      openapiPath,
      generatedPath,
    });

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('v1.json');
    expect(problems[1]).toContain('v1.ts');
  });
});
