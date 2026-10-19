import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_ONLY_MODULES = [
  resolve(SRC, 'shared/api/server-client'),
  resolve(SRC, 'shared/api/client-ip'),
  resolve(SRC, 'shared/config/server-env'),
];
const EXTENSIONS = ['.ts', '.tsx'];
const posix = (path: string): string => path.split(sep).join('/');
const relativeToSrc = (file: string): string => posix(relative(SRC, file));
const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return EXTENSIONS.some((ext) => name.endsWith(ext)) && !/\.(test|spec)\./.test(name) ? [path] : [];
  });
}

function resolveLocal(from: string, specifier: string): string | undefined {
  const base = specifier.startsWith('@/')
    ? resolve(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : undefined;
  if (base === undefined) {
    return undefined;
  }
  const candidates = [base, ...EXTENSIONS.map((ext) => base + ext), ...EXTENSIONS.map((ext) => join(base, `index${ext}`))];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

/** Módulos de servidor alcanzables desde un archivo, siguiendo solo imports locales. */
function reachableServerModules(entry: string): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const pending = [entry];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(IMPORT_PATTERN)) {
      const target = resolveLocal(file, match[1] ?? '');
      if (target === undefined) {
        continue;
      }
      if (SERVER_ONLY_MODULES.some((mod) => posix(target).startsWith(posix(mod)))) {
        found.push(target);
      } else {
        pending.push(target);
      }
    }
  }
  return found;
}

describe('RT-022: el secreto interno no llega al navegador', () => {
  const clientEntries = sourceFiles(SRC).filter((file) => /^\s*['"]use client['"]/.test(readFileSync(file, 'utf8')));

  it('hay archivos de cliente que comprobar', () => {
    expect(clientEntries.length).toBeGreaterThan(0);
  });

  it.each(clientEntries.map((file) => [relativeToSrc(file), file] as const))(
    '%s no importa server-client, client-ip ni server-env (ni transitivamente)',
    (_name, file) => {
      expect(reachableServerModules(file)).toEqual([]);
    },
  );

  it('solo los módulos de servidor mencionan INTERNAL_API_SECRET o internalApiSecret', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => /INTERNAL_API_SECRET|internalApiSecret/.test(readFileSync(file, 'utf8')))
      .map((file) => relativeToSrc(file));
    expect(offenders.sort()).toEqual(['shared/api/server-client.ts', 'shared/config/server-env.ts']);
  });
});
