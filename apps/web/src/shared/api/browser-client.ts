import { createApiClient, type ApiClient } from '@perchados/api-client';

export interface BrowserApiClientInput {
  /** `API_PUBLIC_URL`, entregada por `ApiConfigProvider`. */
  baseUrl: string;
  /** `fetch` a usar; por defecto el global. */
  fetch?: typeof globalThis.fetch;
}

/** Cliente de la API para el navegador: llama directo a la URL pública y envía las cookies de sesión. */
export function createBrowserApiClient({ baseUrl, fetch }: BrowserApiClientInput): ApiClient {
  return createApiClient({ baseUrl, credentials: 'include', ...(fetch ? { fetch } : {}) });
}
