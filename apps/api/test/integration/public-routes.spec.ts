import { ModulesContainer } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ROLES_KEY } from '../../src/modules/auth/interface/decorators/roles';
import { IS_PUBLIC_KEY } from '../../src/shared/http/public.decorator';
import { createTestApp, type TestApp } from '../helpers/test-app.factory';

/** Única lista blanca de rutas sin sesión (RT-013, OWASP A01): ampliarla exige decisión de diseño. */
const EXPECTED_PUBLIC_ROUTES = ['AuthController.login', 'AuthController.logout', 'HealthController.get'];

/**
 * Rutas privadas que sirven a cualquier sesión válida sin exigir un rol concreto (decisión de diseño):
 * cada una aparece aquí a propósito. El resto de rutas privadas debe declarar `@Roles(...)`.
 */
const PRIVATE_ROUTES_WITHOUT_ROLES = ['AuthController.session'];

interface RouteInfo {
  readonly name: string;
  readonly isPublic: boolean;
  readonly hasRoles: boolean;
}

function listRoutes(ctx: TestApp): RouteInfo[] {
  const controllers = [...ctx.app.get(ModulesContainer).values()].flatMap((module) => [
    ...module.controllers.values(),
  ]);
  return controllers.flatMap((wrapper) => {
    const instance = wrapper.instance as object | null;
    if (instance === null || !(wrapper.metatype instanceof Function)) {
      return [];
    }
    const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;
    const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, wrapper.metatype) === true;
    const classRoles = Reflect.getMetadata(ROLES_KEY, wrapper.metatype) !== undefined;
    return Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor' && typeof proto[name] === 'function')
      .map((name) => ({
        name: `${wrapper.metatype?.name ?? ''}.${name}`,
        isPublic:
          classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, proto[name] as object) === true,
        hasRoles: classRoles || Reflect.getMetadata(ROLES_KEY, proto[name] as object) !== undefined,
      }));
  });
}

describe('lista blanca de rutas @Public (RT-013)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('las rutas @Public son exactamente health, auth/login y auth/logout', () => {
    const publicRoutes = listRoutes(ctx)
      .filter((route) => route.isPublic)
      .map((route) => route.name)
      .sort();

    expect(publicRoutes).toEqual(EXPECTED_PUBLIC_ROUTES);
  });

  it('toda ruta privada declara @Roles(...) salvo la lista blanca justificada (OWASP A01)', () => {
    const withoutRoles = listRoutes(ctx)
      .filter((route) => !route.isPublic && !route.hasRoles)
      .map((route) => route.name)
      .sort();

    expect(withoutRoles).toEqual(PRIVATE_ROUTES_WITHOUT_ROLES);
  });
});
