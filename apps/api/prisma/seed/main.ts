import { loadEnvFileIfPresent } from '../../src/shared/bootstrap/load-env-file';
import { runSeedCli } from './cli';
import { SEED_STEPS } from './steps';

loadEnvFileIfPresent();
void runSeedCli({ env: process.env, steps: SEED_STEPS }).then((code) => {
  process.exitCode = code;
});
