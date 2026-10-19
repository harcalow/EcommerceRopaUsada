import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';

import { migrateDeploy, type TestDatabase } from './db';

/** Antigüedad a partir de la cual una BD de ejecución se considera huérfana (ms). */
export const STALE_RUN_DATABASE_MS = 60 * 60 * 1000;

/** Clave del bloqueo consultivo que serializa la creación de plantillas y clones entre procesos. */
const PROVISION_LOCK_KEY = 726_150_001;

/** Holgura de conexión: con la máquina cargada, conectar a PostgreSQL puede tardar segundos. */
const CONNECT_TIMEOUT_MS = 60_000;

const TEMPLATE_HASH_LENGTH = 12;
const RUN_SUFFIX = /^[0-9a-z]+_[0-9a-f]{6}_test$/;

export interface RunDatabase {
  readonly database: TestDatabase;
  /** Borra la BD de esta ejecución. */
  readonly drop: () => Promise<void>;
}

/** Prefijo común de las BD derivadas: el nombre base sin el sufijo `_test`. */
export function databasePrefix(baseName: string): string {
  return baseName.replace(/_test$/, '');
}

export function templateDatabaseName(prefix: string, migrationsHash: string): string {
  return `${prefix}_tpl_${migrationsHash.slice(0, TEMPLATE_HASH_LENGTH)}_test`;
}

export function buildingTemplateName(prefix: string): string {
  return `${prefix}_tplwip_test`;
}

export function runDatabaseName(prefix: string, now: number, random: string): string {
  return `${prefix}_run_${now.toString(36)}_${random}_test`;
}

function isTemplateName(prefix: string, name: string): boolean {
  return name.startsWith(`${prefix}_tpl_`) && /^[0-9a-f]+_test$/.test(name.slice(`${prefix}_tpl_`.length));
}

/** Una BD de ejecución es huérfana si su marca de tiempo supera la antigüedad máxima. */
export function isStaleRunDatabase(
  prefix: string,
  name: string,
  now: number,
  maxAgeMs: number = STALE_RUN_DATABASE_MS,
): boolean {
  const head = `${prefix}_run_`;
  if (!name.startsWith(head)) return false;
  const rest = name.slice(head.length);
  if (!RUN_SUFFIX.test(rest)) return false;
  const created = Number.parseInt(rest.split('_')[0] ?? '', 36);
  return Number.isFinite(created) && now - created > maxAgeMs;
}

/** Huella del contenido de las migraciones: una plantilla vieja nunca se reutiliza con migraciones nuevas. */
export function hashMigrations(migrationsDir: string): string {
  const hash = createHash('sha256');
  const entries = readdirSync(migrationsDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  for (const file of entries) {
    hash.update(file.slice(migrationsDir.length));
    hash.update(readFileSync(file));
  }
  return hash.digest('hex');
}

function withDatabase(url: string, name: string): string {
  const next = new URL(url);
  next.pathname = `/${name}`;
  return next.toString();
}

async function listDatabases(client: pg.Client, like: string): Promise<string[]> {
  const result = await client.query<{ datname: string }>(
    'SELECT datname FROM pg_database WHERE datname LIKE $1',
    [like],
  );
  return result.rows.map((row) => row.datname);
}

async function dropDatabase(client: pg.Client, name: string): Promise<void> {
  await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
}

async function ensureTemplate(
  client: pg.Client,
  base: TestDatabase,
  prefix: string,
  template: string,
): Promise<void> {
  const existing = await listDatabases(client, `${prefix}\\_tpl%`);
  for (const name of existing) {
    if (name !== template && isTemplateName(prefix, name)) await dropDatabase(client, name);
  }
  if (existing.includes(template)) return;

  const building = buildingTemplateName(prefix);
  await dropDatabase(client, building);
  await client.query(`CREATE DATABASE "${building}"`);
  try {
    migrateDeploy(withDatabase(base.url, building));
  } catch (error) {
    await dropDatabase(client, building);
    throw error;
  }
  await client.query(`ALTER DATABASE "${building}" RENAME TO "${template}"`);
}

/**
 * Crea una BD de pruebas propia de esta ejecución, clonada de una plantilla ya migrada
 * (`<prefijo>_tpl_<huella>_test`). La creación de plantilla y clon se serializa entre procesos con
 * un bloqueo consultivo de PostgreSQL, y se limpian las BD de ejecución huérfanas.
 */
export async function provisionRunDatabase(base: TestDatabase, migrationsDir: string): Promise<RunDatabase> {
  const prefix = databasePrefix(base.name);
  const template = templateDatabaseName(prefix, hashMigrations(migrationsDir));
  const name = runDatabaseName(prefix, Date.now(), randomBytes(3).toString('hex'));
  const adminUrl = withDatabase(base.url, 'postgres');

  const client = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [PROVISION_LOCK_KEY]);
    try {
      const now = Date.now();
      for (const stale of await listDatabases(client, `${prefix}\\_run\\_%`)) {
        if (isStaleRunDatabase(prefix, stale, now)) await dropDatabase(client, stale);
      }
      await ensureTemplate(client, base, prefix, template);
      await client.query(`CREATE DATABASE "${name}" TEMPLATE "${template}"`);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [PROVISION_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }

  return {
    database: { name, url: withDatabase(base.url, name) },
    drop: async () => {
      const dropper = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
      await dropper.connect();
      try {
        await dropDatabase(dropper, name);
      } finally {
        await dropper.end();
      }
    },
  };
}
