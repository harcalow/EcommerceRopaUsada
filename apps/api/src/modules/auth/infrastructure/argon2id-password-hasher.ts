import { randomBytes } from 'node:crypto';

import { hash, parseOptions, verify, type Options } from '@node-rs/argon2';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PASSWORD_MAX_LENGTH } from '@perchados/contracts';

import type { PasswordHasher } from '../application/ports/password-hasher';

/** Parámetros vigentes de argon2id (`PASSWORD_HASH_*`, ya validados contra el mínimo OWASP). */
export interface Argon2idParams {
  readonly memoryKib: number;
  readonly iterations: number;
  readonly parallelism: number;
}

const DUMMY_PASSWORD_BYTES = 32;

// `Algorithm` y `Version` son `const enum` ambientales de la librería: con isolatedModules no se pueden importar.
const ALGORITHM_ARGON2ID = 2;
const VERSION_0X13 = 1;

/** Compara el código numérico de un enum de la librería con su literal. */
function isCode(actual: number, expected: number): boolean {
  return actual === expected;
}

/** Hash de contraseñas con argon2id (`@node-rs/argon2`), NFC y sal aleatoria por hash (ADR-007). */
@Injectable()
export class Argon2idPasswordHasher implements PasswordHasher, OnModuleInit {
  private dummyHash: Promise<string> | undefined;

  constructor(private readonly params: Argon2idParams) {}

  /** Calcula el hash ficticio al arrancar para que el primer `verifyDummy` no sea más lento. */
  async onModuleInit(): Promise<void> {
    await this.getDummyHash();
  }

  async hash(password: string): Promise<string> {
    if (password.length > PASSWORD_MAX_LENGTH) {
      throw new RangeError(`Password exceeds ${String(PASSWORD_MAX_LENGTH)} characters`);
    }
    return hash(password.normalize('NFC'), this.options());
  }

  async verify(storedHash: string, password: string): Promise<boolean> {
    if (password.length > PASSWORD_MAX_LENGTH) {
      return false;
    }
    try {
      return await verify(storedHash, password.normalize('NFC'));
    } catch {
      return false;
    }
  }

  async verifyDummy(password: string): Promise<void> {
    await this.verify(await this.getDummyHash(), password);
  }

  needsRehash(storedHash: string): boolean {
    try {
      const stored = parseOptions(storedHash);
      return (
        !isCode(stored.algorithm, ALGORITHM_ARGON2ID) ||
        !isCode(stored.version, VERSION_0X13) ||
        stored.memoryCost < this.params.memoryKib ||
        stored.timeCost < this.params.iterations ||
        stored.parallelism < this.params.parallelism
      );
    } catch {
      return true;
    }
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hash(randomBytes(DUMMY_PASSWORD_BYTES).toString('base64'));
    return this.dummyHash;
  }

  private options(): Options {
    return {
      algorithm: ALGORITHM_ARGON2ID,
      version: VERSION_0X13,
      memoryCost: this.params.memoryKib,
      timeCost: this.params.iterations,
      parallelism: this.params.parallelism,
    };
  }
}
