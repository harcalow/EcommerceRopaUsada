import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = 'apps/api/prisma/migrations';

/**
 * Convierte la salida de `git diff --name-status --no-renames` en entradas `{ status, path }`.
 * @param {string} output
 * @returns {{ status: string, path: string }[]}
 */
export function parseNameStatus(output) {
  return output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [status = '', ...rest] = line.split('\t');
      return { status: status.trim(), path: rest.join('\t').trim() };
    });
}

/**
 * Una migración ya fusionada no se edita, borra ni renombra: solo se permite añadir carpetas nuevas.
 * @param {{ status: string, path: string }[]} entries cambios respecto a la base (sin detección de renombrados)
 * @param {(directory: string) => boolean} existsInBase indica si la carpeta de migración ya existía en la base
 * @returns {string[]} descripción de cada infracción
 */
export function findViolations(entries, existsInBase) {
  const violations = [];
  for (const { status, path } of entries) {
    if (!path.startsWith(`${MIGRATIONS_DIR}/`)) continue;
    if (status !== 'A') {
      violations.push(`${path}: cambio no permitido (${status}); las migraciones fusionadas son inmutables`);
      continue;
    }
    const relative = posix.relative(MIGRATIONS_DIR, path);
    const [folder = ''] = relative.split('/');
    const isFolderFile = relative.includes('/');
    if (isFolderFile && existsInBase(`${MIGRATIONS_DIR}/${folder}`)) {
      violations.push(`${path}: se añade un archivo a una migración que ya existía en la base`);
    } else if (!isFolderFile) {
      violations.push(`${path}: archivo nuevo fuera de una carpeta de migración`);
    }
  }
  return violations;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function parseBase(argv) {
  const index = argv.indexOf('--base');
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (value === undefined || value === '' || /^0+$/.test(value) || value.startsWith('-')) {
    throw new Error('Uso: check-migrations-immutable.mjs --base <ref-o-sha> (la base no puede estar vacía)');
  }
  return value;
}

function main() {
  const base = parseBase(process.argv.slice(2));
  const mergeBase = git(['merge-base', base, 'HEAD']).trim();
  const output = git(['diff', '--name-status', '--no-renames', mergeBase, 'HEAD', '--', MIGRATIONS_DIR]);
  const existsInBase = (directory) => git(['ls-tree', '-d', mergeBase, '--', directory]).trim() !== '';
  const violations = findViolations(parseNameStatus(output), existsInBase);
  if (violations.length > 0) {
    process.stderr.write(`Migraciones alteradas respecto a ${base}:\n${violations.map((v) => `- ${v}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('Migraciones inmutables: solo hay migraciones nuevas o ningún cambio.\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'error desconocido'}\n`);
    process.exit(2);
  }
}
