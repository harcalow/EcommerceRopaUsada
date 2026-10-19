import createClient, { type ClientOptions } from 'openapi-fetch';

import type { paths } from './generated/v1';
import { createCorrelationMiddleware, type CorrelationIdFactory } from './middleware/correlation';

export interface ApiClientOptions {
  /** URL base de la API (sin `/v1`; las rutas del contrato ya lo incluyen). */
  baseUrl: string;
  /** `fetch` a usar; por defecto el global. Útil para pruebas y para el servidor de Next. */
  fetch?: NonNullable<ClientOptions['fetch']>;
  /** Cabeceras comunes (p. ej. `Cookie` reenviada desde el servidor). */
  headers?: NonNullable<ClientOptions['headers']>;
  /** `credentials` de fetch; en el navegador se usa `include` para enviar la cookie de sesión. */
  credentials?: NonNullable<RequestInit['credentials']>;
  /** Generador del id de correlación; por defecto `crypto.randomUUID`. */
  correlationId?: CorrelationIdFactory;
}

/** Cliente tipado de la API v1: único medio por el que las apps la llaman. */
export function createApiClient(options: ApiClientOptions) {
  const { correlationId, ...clientOptions } = options;
  const client = createClient<paths>(clientOptions);
  client.use(createCorrelationMiddleware(correlationId));
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
