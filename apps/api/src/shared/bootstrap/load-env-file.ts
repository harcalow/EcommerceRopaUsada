import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Archivo de entorno local de la raíz del monorepo (el cwd de `pnpm dev` es `apps/api`). */
export const ROOT_ENV_FILE = resolve(process.cwd(), '../../.env');

/**
 * Carga el archivo de entorno si existe. No pisa las variables ya definidas
 * (Docker, CI y la shell mandan sobre el archivo).
 */
export function loadEnvFileIfPresent(path: string = ROOT_ENV_FILE): boolean {
  if (!existsSync(path)) {
    return false;
  }
  process.loadEnvFile(path);
  return true;
}
