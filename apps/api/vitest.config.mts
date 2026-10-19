import { createVitestConfig } from '@perchados/config/vitest';
import swc from 'unplugin-swc';

export default createVitestConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    // Cada ejecución crea su propia BD (clon de una plantilla migrada) y la borra al terminar
    globalSetup: ['./test/helpers/global-setup.ts'],
    // Los archivos de integración de una ejecución comparten esa BD: secuenciales (diseño)
    fileParallelism: false,
    // Holgura para la carga con varias ejecuciones y CLI de migraciones simultáneas
    hookTimeout: 60_000,
    include: ['src/**/*.spec.ts', 'prisma/seed/**/*.spec.ts', 'test/**/*.spec.ts', 'test/**/*.spec.mts'],
  },
}, ['src/**/*.ts', 'prisma/seed/**/*.ts']);
