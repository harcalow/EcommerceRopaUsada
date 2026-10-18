import { Controller, Get } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TestRoutesController } from '../helpers/test-routes.controller';
import { createTestApp, type TestApp } from '../helpers/test-app.factory';

import { listDocumentedRoutes, loadContractDocument } from './contract-matcher';
import { compareRoutes, listImplementedRoutes, toRouteKey } from './route-coverage';

/**
 * Rutas ya contratadas (T-16) cuya implementación llega en un hito posterior. Lista temporal:
 * cada tarea elimina sus entradas al implementar la ruta. Una ruta pendiente que ya existe en
 * Nest hace fallar la prueba, así que la lista no puede quedarse obsoleta.
 */
const PENDING_ROUTES: Readonly<Record<string, string>> = {};

const allDocumented = listDocumentedRoutes(loadContractDocument()).map(toRouteKey);
const documented = allDocumented.filter((route) => !(route in PENDING_ROUTES));

@Controller('undocumented')
class UndocumentedController {
  @Get()
  list(): string[] {
    return [];
  }
}

describe('cobertura de rutas: Nest frente a openapi/v1.json (RT-004)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('toda ruta de Nest está documentada y toda ruta documentada está implementada', () => {
    const differences = compareRoutes(listImplementedRoutes(ctx.app), documented);

    expect(differences).toEqual({ undocumented: [], unimplemented: [] });
  });

  it('el inventario incluye las rutas reales de la API', () => {
    expect(listImplementedRoutes(ctx.app)).toContain('GET /v1/health');
  });
});

describe('rutas pendientes de implementar', () => {
  it('todas figuran en el documento y ninguna está ya implementada', async () => {
    const ctx = await createTestApp();
    try {
      const implemented = listImplementedRoutes(ctx.app);

      for (const route of Object.keys(PENDING_ROUTES)) {
        expect(allDocumented).toContain(route);
        expect(implemented).not.toContain(route);
      }
    } finally {
      await ctx.close();
    }
  });
});

describe('detección de diferencias de rutas', () => {
  it('una ruta de Nest sin entrada en el documento queda como no documentada', async () => {
    const ctx = await createTestApp({ controllers: [UndocumentedController, TestRoutesController] });
    try {
      const differences = compareRoutes(listImplementedRoutes(ctx.app), documented);

      expect(differences.undocumented).toContain('GET /v1/undocumented');
      expect(differences.undocumented).toContain('POST /v1/test-routes/items');
      expect(differences.unimplemented).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

  it('una ruta documentada sin implementar queda como no implementada', () => {
    const differences = compareRoutes(['GET /v1/health'], ['GET /v1/health', 'POST /v1/auth/pendiente']);

    expect(differences).toEqual({ undocumented: [], unimplemented: ['POST /v1/auth/pendiente'] });
  });

  it('los parámetros de Express coinciden con los del documento', () => {
    const differences = compareRoutes(['GET /v1/items/{id}'], ['GET /v1/items/{id}']);

    expect(differences).toEqual({ undocumented: [], unimplemented: [] });
  });
});
