import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Lee una hoja de estilos del paquete (ruta relativa a `src`) para comprobar sus reglas; Vitest no procesa el CSS. */
export function readCss(relativePath: string): string {
  return readFileSync(join(process.cwd(), 'src', relativePath), 'utf8');
}
