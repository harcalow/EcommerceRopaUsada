import type { NestExpressApplication } from '@nestjs/platform-express';

import type { DocumentedRoute } from './contract-matcher';

export interface RouteDifferences {
  /** Rutas que Nest sirve y el documento no describe. */
  readonly undocumented: string[];
  /** Rutas que el documento describe y Nest no sirve. */
  readonly unimplemented: string[];
}

interface ExpressRoute {
  readonly path: string;
  readonly methods: Readonly<Record<string, boolean>>;
}

interface ExpressLayer {
  readonly route?: ExpressRoute;
}

/** Clave comparable de una ruta: `GET /v1/items/{id}` (los `:id` de Express pasan a `{id}`). */
function toKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path.replaceAll(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
}

export function toRouteKey(route: DocumentedRoute): string {
  return toKey(route.method, route.path);
}

/** Rutas registradas en el enrutador de Express de la app Nest, como `GET /v1/health`. */
export function listImplementedRoutes(app: NestExpressApplication): string[] {
  const instance = app.getHttpAdapter().getInstance() as { router?: { stack?: unknown } };
  const stack = instance.router?.stack;
  if (!Array.isArray(stack)) {
    throw new Error('No se pudo leer el enrutador de Express para inventariar las rutas');
  }
  const keys = (stack as ExpressLayer[]).flatMap(({ route }) =>
    // Los comodines (`/*splat`) son el 404 de Nest, no endpoints de la API
    route === undefined || route.path.includes('*')
      ? []
      : Object.keys(route.methods)
          .filter((method) => route.methods[method] === true)
          .map((method) => toKey(method, route.path)),
  );
  return [...new Set(keys)].sort();
}

/** Compara las rutas implementadas con las documentadas. */
export function compareRoutes(implemented: readonly string[], documented: readonly string[]): RouteDifferences {
  const documentedSet = new Set(documented);
  const implementedSet = new Set(implemented);
  return {
    undocumented: implemented.filter((route) => !documentedSet.has(route)).sort(),
    unimplemented: documented.filter((route) => !implementedSet.has(route)).sort(),
  };
}
