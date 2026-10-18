import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderTypes } from '../src/contract/render-types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, '../contracts/openapi/v1.json');
const target = resolve(root, 'src/generated/v1.ts');

const document: unknown = JSON.parse(readFileSync(source, 'utf8'));
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, await renderTypes(document));
process.stdout.write(`Tipos del cliente generados en ${target}\n`);
