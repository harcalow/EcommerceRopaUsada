import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildOpenApiDocument } from '@perchados/contracts';

import { checkContract, CONTRACT_OUT_OF_DATE_HINT } from '../src/contract/check';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const problems = await checkContract({
  currentDocument: buildOpenApiDocument(),
  openapiPath: resolve(root, '../contracts/openapi/v1.json'),
  generatedPath: resolve(root, 'src/generated/v1.ts'),
});

if (problems.length > 0) {
  process.stderr.write(`contract:check falló:\n- ${problems.join('\n- ')}\n${CONTRACT_OUT_OF_DATE_HINT}\n`);
  process.exit(1);
}
process.stdout.write('contract:check OK: openapi/v1.json y generated/v1.ts están al día.\n');
