import { Argon2idPasswordHasher } from '../../src/modules/auth/infrastructure/argon2id-password-hasher';

/** Hash argon2id con parámetros por debajo de los vigentes, para probar el rehash al entrar. */
export function weakPasswordHash(password: string): Promise<string> {
  return new Argon2idPasswordHasher({ memoryKib: 8192, iterations: 1, parallelism: 1 }).hash(password);
}
