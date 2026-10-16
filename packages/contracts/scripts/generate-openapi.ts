import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildOpenApiDocument } from '../src/v1/registry';

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../openapi/v1.json');

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
process.stdout.write(`OpenAPI generado en ${target}\n`);
