import {
  loginPasswordSchema,
  PASSWORD_MAX_LENGTH,
  toUsernameKey,
  usernameSchema,
} from '@perchados/contracts';
import { z } from 'zod';

import type { PasswordHasher } from '../../../src/modules/auth/application/ports/password-hasher';
import { Argon2idPasswordHasher } from '../../../src/modules/auth/infrastructure/argon2id-password-hasher';
import { ADMIN_ROLE_CODE } from '../../../src/shared/auth/admin-role';
import { minimumMemoryKib, passwordHashFields } from '../../../src/shared/config/env.schema';
import { SeedConfigError, type SeedConfigIssue, type SeedExecutor, type SeedStep } from '../seed-step';

export const INITIAL_ADMIN_USERNAME = 'HaroldAdmin';
export const ADMIN_PASSWORD_VARIABLE = 'ADMIN_INITIAL_PASSWORD';

const hashParamsSchema = z.object(passwordHashFields);

const MEMORY_BELOW_MINIMUM = 'is below the OWASP minimum for the configured iterations';

/** Crea un hasher con los mismos parámetros que la API, o lanza las incidencias de configuración. */
function createHasher(env: NodeJS.ProcessEnv): PasswordHasher {
  const parsed = hashParamsSchema.safeParse(env);
  if (!parsed.success) {
    throw new SeedConfigError(
      parsed.error.issues.map((issue) => ({ variable: String(issue.path[0]), reason: issue.message })),
    );
  }
  const { PASSWORD_HASH_MEMORY_KIB, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_PARALLELISM } = parsed.data;
  if (PASSWORD_HASH_MEMORY_KIB < minimumMemoryKib(PASSWORD_HASH_ITERATIONS)) {
    throw new SeedConfigError([{ variable: 'PASSWORD_HASH_MEMORY_KIB', reason: MEMORY_BELOW_MINIMUM }]);
  }
  return new Argon2idPasswordHasher({
    memoryKib: PASSWORD_HASH_MEMORY_KIB,
    iterations: PASSWORD_HASH_ITERATIONS,
    parallelism: PASSWORD_HASH_PARALLELISM,
  });
}

/** La razón nunca incluye el valor de la contraseña. */
function passwordIssue(password: string | undefined): SeedConfigIssue | undefined {
  if (password === undefined) {
    return { variable: ADMIN_PASSWORD_VARIABLE, reason: 'is required' };
  }
  if (!loginPasswordSchema.safeParse(password).success) {
    return {
      variable: ADMIN_PASSWORD_VARIABLE,
      reason: `must have between 8 and ${String(PASSWORD_MAX_LENGTH)} characters`,
    };
  }
  return undefined;
}

/**
 * Paso `admin-inicial` (RF-018, RF-019): crea la cuenta `HaroldAdmin` con el rol `admin` y el hash
 * argon2id de `ADMIN_INITIAL_PASSWORD`. Si la cuenta ya existe no se toca (ni su contraseña).
 */
export const adminInicialStep: SeedStep = {
  name: 'admin-inicial',
  prepare: (env) => {
    const issue = passwordIssue(env[ADMIN_PASSWORD_VARIABLE]);
    if (issue !== undefined) {
      throw new SeedConfigError([issue]);
    }
    const password = env[ADMIN_PASSWORD_VARIABLE] ?? '';
    const hasher = createHasher(env);
    const username = usernameSchema.parse(INITIAL_ADMIN_USERNAME);
    const usernameKey = toUsernameKey(username);

    // El argon2id se calcula antes de abrir la transacción (RT-021): dentro solo van escrituras cortas.
    return hasher.hash(password).then((passwordHash): SeedExecutor => async (tx) => {
      if ((await tx.account.count({ where: { usernameKey } })) > 0) {
        return 'skipped';
      }
      const role = await tx.role.findUniqueOrThrow({ where: { code: ADMIN_ROLE_CODE } });
      const { count } = await tx.account.createMany({
        data: [{ username, usernameKey, roleId: role.id, passwordHash }],
        skipDuplicates: true,
      });
      return count === 0 ? 'skipped' : 'created';
    });
  },
};
