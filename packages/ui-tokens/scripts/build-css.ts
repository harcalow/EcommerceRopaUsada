import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTokensCss } from '../src/css';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = renderTokensCss();

// src/tokens.css se versiona (la prueba detecta si está desactualizado); dist/tokens.css es el que se publica.
for (const target of [resolve(root, 'src/tokens.css'), resolve(root, 'dist/tokens.css')]) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, css);
}
