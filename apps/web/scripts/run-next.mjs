import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Lanza `next <comando>` con el puerto de WEB_PORT y el .env de la raíz (sin pisar variables ya definidas)
const [command] = process.argv.slice(2);
const rootEnvFile = resolve(import.meta.dirname, '../../../.env');
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}
const port = process.env.WEB_PORT || '3000';
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, command, '--port', port], { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
