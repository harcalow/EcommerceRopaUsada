import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ApiConfigProvider, useApiClient, useApiConfig } from './api-config-provider';

function ShowUrl() {
  return <p>{useApiConfig().apiPublicUrl}</p>;
}

function ShowClient() {
  return <p>{typeof useApiClient().GET}</p>;
}

describe('ApiConfigProvider', () => {
  it('entrega la URL pública a los descendientes', () => {
    const html = renderToStaticMarkup(
      <ApiConfigProvider apiPublicUrl="http://localhost:3001">
        <ShowUrl />
      </ApiConfigProvider>,
    );
    expect(html).toBe('<p>http://localhost:3001</p>');
  });

  it('useApiClient devuelve un cliente tipado', () => {
    const html = renderToStaticMarkup(
      <ApiConfigProvider apiPublicUrl="http://localhost:3001">
        <ShowClient />
      </ApiConfigProvider>,
    );
    expect(html).toBe('<p>function</p>');
  });

  it('falla con un mensaje claro fuera del proveedor', () => {
    expect(() => renderToStaticMarkup(<ShowUrl />)).toThrow(/inside ApiConfigProvider/);
  });
});
