import type { SeedStep } from '../seed-step';

import { adminInicialStep } from './admin-inicial.step';

/** Pasos de semilla de producción, en orden de ejecución. */
export const SEED_STEPS: readonly SeedStep[] = [adminInicialStep];
