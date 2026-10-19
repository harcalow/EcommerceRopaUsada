import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Capas de cada módulo (skill nestjs-hexagonal). */
export const LAYERS = ['domain', 'application', 'infrastructure', 'interface'];

/** Patrones de una carpeta de capa: cubre `../x/layer`, `../x/layer/y` y rutas con alias. */
function layerGroup(layer, message) {
  return { group: [`**/${layer}`, `**/${layer}/**`], message };
}

/** Sentido único: interface -> application -> domain e infrastructure -> application/domain. */
const LAYER_PATTERNS = {
  domain: [
    {
      group: ['@nestjs/*', '@prisma/*', 'zod', '@perchados/contracts'],
      message: 'El dominio es puro: no importa frameworks, ORM, Zod ni contratos.',
    },
    layerGroup('application', 'El dominio no depende de la aplicación.'),
    layerGroup('infrastructure', 'El dominio no depende de la infraestructura.'),
    layerGroup('interface', 'El dominio no depende de la interfaz.'),
  ],
  application: [
    {
      group: ['@nestjs/*', '!@nestjs/common', '@prisma/*'],
      message: 'La aplicación solo usa @nestjs/common (inyección); nada de ORM ni del resto del framework.',
    },
    layerGroup('infrastructure', 'La aplicación depende de puertos, no de la infraestructura.'),
    layerGroup('interface', 'La aplicación no depende de la interfaz.'),
  ],
  infrastructure: [layerGroup('interface', 'La infraestructura no depende de la interfaz.')],
  interface: [
    { group: ['@prisma/*'], message: 'La interfaz no accede al ORM: usa casos de uso.' },
    layerGroup('infrastructure', 'La interfaz llama casos de uso, no adaptadores.'),
  ],
};

/** Lista las carpetas de `src/modules`. */
export function listModules(rootDir) {
  return readdirSync(join(rootDir, 'src', 'modules'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** De otro módulo solo se usa su caso de uso público o un puerto (application), nunca sus capas internas. */
function crossModulePatterns(current, modules) {
  return modules
    .filter((name) => name !== current)
    .map((other) => ({
      group: ['domain', 'infrastructure', 'interface'].map((layer) => `**/${other}/${layer}/**`),
      message: `El módulo ${current} no importa las capas internas de ${other}: usa su caso de uso o su puerto.`,
    }));
}

function restrict(files, patterns) {
  return { files, rules: { 'no-restricted-imports': ['error', { patterns }] } };
}

/**
 * Reglas de capas hexagonales con `no-restricted-imports` (RT-002).
 * Cada archivo recibe un solo bloque con todas sus restricciones, porque ESLint no fusiona
 * las opciones de una misma regla entre bloques.
 * @param {readonly string[]} modules nombres de los módulos de `src/modules`.
 */
export function createLayerRules(modules) {
  const perLayer = modules.flatMap((name) =>
    LAYERS.map((layer) =>
      restrict(
        [`src/modules/${name}/${layer}/**/*.ts`],
        [...LAYER_PATTERNS[layer], ...crossModulePatterns(name, modules)],
      ),
    ),
  );
  const shared = restrict(
    ['src/shared/**/*.ts'],
    [{ group: ['**/modules/**'], message: 'shared es transversal: no depende de ningún módulo.' }],
  );
  return [...perLayer, shared];
}
