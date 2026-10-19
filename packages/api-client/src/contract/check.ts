import { readFileSync } from 'node:fs';

import { renderTypes } from './render-types';

export interface ContractCheckInput {
  /** Documento OpenAPI construido ahora mismo desde los esquemas Zod. */
  currentDocument: object;
  /** Ruta de `openapi/v1.json` (versionado). */
  openapiPath: string;
  /** Ruta de `src/generated/v1.ts` (versionado). */
  generatedPath: string;
}

const normalize = (text: string): string => text.replace(/\r\n/g, '\n');

/** Devuelve los problemas de sincronía del contrato; vacío si todo está al día. */
export async function checkContract(input: ContractCheckInput): Promise<string[]> {
  const problems: string[] = [];
  const expectedJson = `${JSON.stringify(input.currentDocument, null, 2)}\n`;
  const storedJson = normalize(readFileSync(input.openapiPath, 'utf8'));
  if (storedJson !== expectedJson) {
    problems.push(
      'packages/contracts/openapi/v1.json no coincide con los esquemas de packages/contracts.',
    );
  }
  const expectedTypes = await renderTypes(input.currentDocument);
  const storedTypes = normalize(readFileSync(input.generatedPath, 'utf8'));
  if (storedTypes !== expectedTypes) {
    problems.push('packages/api-client/src/generated/v1.ts no coincide con el contrato actual.');
  }
  return problems;
}

export const CONTRACT_OUT_OF_DATE_HINT =
  'El contrato está desactualizado. Ejecuta `pnpm contract:generate` y versiona los archivos generados.';
