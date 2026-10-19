'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { ApiClient } from '@perchados/api-client';

import { createBrowserApiClient } from './browser-client';

interface ApiConfig {
  apiPublicUrl: string;
}

const ApiConfigContext = createContext<ApiConfig | null>(null);

export function ApiConfigProvider({
  apiPublicUrl,
  children,
}: Readonly<{ apiPublicUrl: string; children: ReactNode }>) {
  const value = useMemo(() => ({ apiPublicUrl }), [apiPublicUrl]);
  return <ApiConfigContext.Provider value={value}>{children}</ApiConfigContext.Provider>;
}

export function useApiConfig(): ApiConfig {
  const config = useContext(ApiConfigContext);
  if (!config) {
    throw new Error('useApiConfig must be used inside ApiConfigProvider');
  }
  return config;
}

/** Cliente de la API para componentes cliente (un único objeto por URL pública). */
export function useApiClient(): ApiClient {
  const { apiPublicUrl } = useApiConfig();
  return useMemo(() => createBrowserApiClient({ baseUrl: apiPublicUrl }), [apiPublicUrl]);
}
