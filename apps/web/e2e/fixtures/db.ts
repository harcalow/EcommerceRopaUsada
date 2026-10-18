import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { hash } from '@node-rs/argon2';
import { toUsernameKey } from '@perchados/contracts';
import { Pool } from 'pg';

import type { TestAccountSpec } from './accounts';

/** BD propia de E2E, distinta de `perchados` y de `perchados_test` (pruebas aisladas). */
export const DEFAULT_E2E_DATABASE_URL =
  'postgresql://perchados:perchados_dev_password@localhost:5432/perchados_e2e';

const execFileAsync = promisify(execFile);
// `playwright test` se ejecuta con `apps/web` como directorio de trabajo
const SEED_ENTRY = resolve(process.cwd(), '../api/dist/prisma/seed/main.js');
const E2E_USER_ROLE_CODE = 'e2e-user';
// argon2id con el mínimo OWASP (19 MiB, 2 iteraciones, 1 hilo); la API verifica con los parámetros del propio hash
const ARGON2ID = 2;
const HASH_OPTIONS = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 };

/** Acceso mínimo a la BD de E2E: crea y limpia cuentas y mueve fechas sin esperar tiempo real. */
export class E2eDatabase {
  private readonly pool: Pool;
  private readonly createdKeys = new Set<string>();

  constructor(private readonly connectionString: string = process.env.E2E_DATABASE_URL ?? DEFAULT_E2E_DATABASE_URL) {
    this.pool = new Pool({ connectionString, max: 2 });
  }

  /** Crea (o restablece) la cuenta con un hash argon2id real; la elimina `cleanup()`. */
  async createAccount(spec: TestAccountSpec): Promise<void> {
    const key = toUsernameKey(spec.username);
    const roleCode = spec.role === 'admin' ? 'admin' : E2E_USER_ROLE_CODE;
    const passwordHash = await hash(spec.password.normalize('NFC'), HASH_OPTIONS);
    if (roleCode === E2E_USER_ROLE_CODE) {
      await this.pool.query(
        `INSERT INTO "role" ("id", "code", "name") VALUES (gen_random_uuid(), $1, 'usuario de pruebas')
         ON CONFLICT ("code") DO NOTHING`,
        [E2E_USER_ROLE_CODE],
      );
    }
    this.createdKeys.add(key);
    await this.pool.query(
      `INSERT INTO "account" ("id", "username", "username_key", "role_id", "password_hash", "updated_at")
       SELECT gen_random_uuid(), $1, $2, "id", $4, now() FROM "role" WHERE "code" = $3
       ON CONFLICT ("username_key") DO UPDATE
         SET "password_hash" = EXCLUDED."password_hash", "role_id" = EXCLUDED."role_id",
             "failed_attempts" = 0, "locked_until" = NULL, "status" = 'ACTIVE'`,
      [spec.username, key, roleCode, passwordHash],
    );
  }

  /** Fija `locked_until` (CA-016: el bloqueo vence sin esperar). `null` lo quita. */
  async setLockedUntil(username: string, lockedUntil: Date | null): Promise<void> {
    await this.pool.query(`UPDATE "account" SET "locked_until" = $2 WHERE "username_key" = $1`, [
      toUsernameKey(username),
      lockedUntil,
    ]);
  }

  /** Fija `expires_at` de las sesiones de la cuenta (CA-018: la sesión caduca sin esperar). */
  async setSessionsExpiry(username: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `UPDATE "session" SET "expires_at" = $2
       WHERE "account_id" IN (SELECT "id" FROM "account" WHERE "username_key" = $1)`,
      [toUsernameKey(username), expiresAt],
    );
  }

  /** Fija el contador de intentos fallidos de la cuenta (CA-007: parte de 4 sin repetir 4 intentos lentos). */
  async setFailedAttempts(username: string, attempts: number): Promise<void> {
    await this.pool.query(`UPDATE "account" SET "failed_attempts" = $2 WHERE "username_key" = $1`, [
      toUsernameKey(username),
      attempts,
    ]);
  }

  /** Estado de bloqueo de la cuenta (CA-008, CA-016, CB-007). */
  async getLockState(username: string): Promise<{ failedAttempts: number; lockedUntil: Date | null }> {
    const result = await this.pool.query<{ failed_attempts: number; locked_until: Date | null }>(
      `SELECT "failed_attempts", "locked_until" FROM "account" WHERE "username_key" = $1`,
      [toUsernameKey(username)],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`La cuenta ${username} no existe en la BD de E2E`);
    }
    return { failedAttempts: row.failed_attempts, lockedUntil: row.locked_until };
  }

  /** Cuenta con el código de su rol y su hash (CA-017: consulta directa a la BD). */
  async getAccountRecord(username: string): Promise<{ username: string; roleCode: string; passwordHash: string } | null> {
    const result = await this.pool.query<{ username: string; code: string; password_hash: string }>(
      `SELECT a."username", r."code", a."password_hash"
       FROM "account" a JOIN "role" r ON r."id" = a."role_id" WHERE a."username_key" = $1`,
      [toUsernameKey(username)],
    );
    const row = result.rows[0];
    return row ? { username: row.username, roleCode: row.code, passwordHash: row.password_hash } : null;
  }

  /** Códigos de los roles que existen en la BD. */
  async getRoleCodes(): Promise<string[]> {
    const result = await this.pool.query<{ code: string }>(`SELECT "code" FROM "role" ORDER BY "code"`);
    return result.rows.map((row) => row.code);
  }

  /** Ejecuta la carga inicial real de la API (`db:seed`) contra la BD de E2E (CA-017); la cuenta se limpia con `cleanup()`. */
  async seedInitialAdmin(account: { username: string; password: string }): Promise<void> {
    this.createdKeys.add(toUsernameKey(account.username));
    await execFileAsync(process.execPath, [SEED_ENTRY], {
      env: {
        ...process.env,
        DATABASE_URL: this.connectionString,
        ADMIN_INITIAL_PASSWORD: account.password,
        LOG_LEVEL: 'error',
      },
    });
  }

  /** Elimina las cuentas creadas por este objeto (las sesiones caen en cascada). */
  async cleanup(): Promise<void> {
    // Los intentos con usuarios inexistentes (CA-003) también se acumulan y bloquean: no deben sobrevivir a la prueba
    await this.pool.query(`DELETE FROM "login_attempt_unknown" WHERE "username_key" LIKE 'inexistente%'`);
    if (this.createdKeys.size > 0) {
      await this.pool.query(`DELETE FROM "account" WHERE "username_key" = ANY($1::text[])`, [
        [...this.createdKeys],
      ]);
      this.createdKeys.clear();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
