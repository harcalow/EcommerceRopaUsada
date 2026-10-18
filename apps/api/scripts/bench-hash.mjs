// Mide el coste de hashear y verificar con los parámetros vigentes (PASSWORD_HASH_*, RT-010, RT-021).
// Uso: pnpm --filter @perchados/api bench:hash. Objetivo de calibración: 100–500 ms por verificación.
import { performance } from 'node:perf_hooks';

import { Argon2idPasswordHasher } from '../dist/src/modules/auth/infrastructure/argon2id-password-hasher.js';
import { loadEnvFileIfPresent } from '../dist/src/shared/bootstrap/load-env-file.js';
import { loadConfig } from '../dist/src/shared/config/load-config.js';

const RUNS = 10;
const TARGET_MIN_MS = 100;
const TARGET_MAX_MS = 500;
const BENCH_PASSWORD = 'bench-password-not-a-real-secret';

async function measure(action) {
  const started = performance.now();
  await action();
  return performance.now() - started;
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

loadEnvFileIfPresent();
const { passwordHash } = loadConfig(process.env);
const hasher = new Argon2idPasswordHasher(passwordHash);
const stored = await hasher.hash(BENCH_PASSWORD);

const samples = [];
for (let run = 0; run < RUNS; run += 1) {
  samples.push(await measure(() => hasher.verify(stored, BENCH_PASSWORD)));
}
samples.sort((a, b) => a - b);

const median = percentile(samples, 0.5);
const inRange = median >= TARGET_MIN_MS && median <= TARGET_MAX_MS;
console.log(
  JSON.stringify({
    parameters: passwordHash,
    runs: RUNS,
    medianMs: Math.round(median),
    p95Ms: Math.round(percentile(samples, 0.95)),
    maxMs: Math.round(samples[samples.length - 1]),
    target: `${String(TARGET_MIN_MS)}-${String(TARGET_MAX_MS)} ms`,
    withinTarget: inRange,
  }),
);
