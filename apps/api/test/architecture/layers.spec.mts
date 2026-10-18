import { join } from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { createLayerRules, listModules } from '../../eslint.layers.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const MODULES = ['catalog', 'users'] as const;

const eslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: createLayerRules(MODULES),
});

async function violations(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, filePath) });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === 'no-restricted-imports')
    .map((message) => message.message);
}

describe('reglas de capas hexagonales (RT-002)', () => {
  describe('domain', () => {
    const file = 'src/modules/catalog/domain/garment.ts';

    it.each([
      ["import { Injectable } from '@nestjs/common';", 'frameworks'],
      ["import { PrismaClient } from '@prisma/client';", 'ORM'],
      ["import { z } from 'zod';", 'Zod'],
      ["import { loginSchema } from '@perchados/contracts';", 'contratos'],
      ["import { Repo } from '../infrastructure/prisma-garment.repository';", 'infraestructura'],
      ["import { Repo } from '../../catalog/infrastructure';", 'carpeta de infraestructura'],
      ["import { UseCase } from '../application/reserve.use-case';", 'aplicación'],
      ["import { Controller } from '../interface/garments.controller';", 'interfaz'],
    ])('rechaza %s (%s)', async (code) => {
      expect(await violations(file, code)).toHaveLength(1);
    });

    it('permite importar su propio dominio y librerías puras', async () => {
      const code = [
        "import { GarmentStatus } from './garment-status';",
        "import { Money } from '../../../shared/money';",
        "import { randomUUID } from 'node:crypto';",
      ].join('\n');

      expect(await violations(file, code)).toEqual([]);
    });
  });

  describe('application', () => {
    const file = 'src/modules/catalog/application/reserve-garment.use-case.ts';

    it('permite @nestjs/common y el dominio', async () => {
      const code = [
        "import { Inject, Injectable } from '@nestjs/common';",
        "import { Garment } from '../domain/garment';",
      ].join('\n');

      expect(await violations(file, code)).toEqual([]);
    });

    it.each([
      "import { NestFactory } from '@nestjs/core';",
      "import { PrismaClient } from '@prisma/client';",
      "import { Repo } from '../infrastructure/prisma-garment.repository';",
      "import { Controller } from '../interface/garments.controller';",
    ])('rechaza %s', async (code) => {
      expect(await violations(file, code)).toHaveLength(1);
    });
  });

  describe('infrastructure e interface', () => {
    it('la infraestructura puede implementar puertos pero no usar la interfaz', async () => {
      const file = 'src/modules/catalog/infrastructure/prisma-garment.repository.ts';

      expect(await violations(file, "import { PrismaClient } from '@prisma/client';")).toEqual([]);
      expect(await violations(file, "import { C } from '../interface/garments.controller';")).toHaveLength(1);
    });

    it('la interfaz puede usar casos de uso y contratos pero no adaptadores ni el ORM', async () => {
      const file = 'src/modules/catalog/interface/garments.controller.ts';
      const allowed = [
        "import { Controller } from '@nestjs/common';",
        "import { createSchema } from '@perchados/contracts';",
        "import { UseCase } from '../application/reserve.use-case';",
      ].join('\n');

      expect(await violations(file, allowed)).toEqual([]);
      expect(await violations(file, "import { R } from '../infrastructure/repo';")).toHaveLength(1);
      expect(await violations(file, "import { PrismaClient } from '@prisma/client';")).toHaveLength(1);
    });
  });

  describe('entre módulos', () => {
    const file = 'src/modules/catalog/application/list-garments.use-case.ts';

    it('rechaza las capas internas de otro módulo', async () => {
      for (const layer of ['domain', 'infrastructure', 'interface']) {
        const code = `import { X } from '../../users/${layer}/x';`;

        expect(await violations(file, code)).toContainEqual(expect.stringContaining('users'));
      }
    });

    it('permite el caso de uso o el puerto de otro módulo y las capas del propio', async () => {
      const code = [
        "import { FindAccount } from '../../users/application/find-account.use-case';",
        "import { Garment } from '../domain/garment';",
      ].join('\n');

      expect(await violations(file, code)).toEqual([]);
    });
  });

  describe('shared', () => {
    it('no depende de ningún módulo', async () => {
      const file = 'src/shared/errors/problem.exception.ts';

      expect(await violations(file, "import { X } from '../../modules/users/application/x';")).toHaveLength(1);
      expect(await violations(file, "import { Y } from './other';")).toEqual([]);
    });
  });

  it('descubre los módulos existentes en src/modules', () => {
    expect(listModules(ROOT)).toEqual(
      expect.arrayContaining(['catalog', 'inventory', 'cart', 'orders', 'users', 'media', 'payments']),
    );
  });
});
