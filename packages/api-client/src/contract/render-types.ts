import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';

/** Renderiza los tipos de `paths`, `components` y `operations` desde un documento OpenAPI. */
export async function renderTypes(document: unknown): Promise<string> {
  const ast = await openapiTS(document as Parameters<typeof openapiTS>[0]);
  return `${COMMENT_HEADER}${astToString(ast)}`;
}
