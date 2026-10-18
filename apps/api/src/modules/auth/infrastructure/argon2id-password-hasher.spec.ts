import { hash as rawHash, parseOptions } from '@node-rs/argon2';
import { PASSWORD_MAX_LENGTH } from '@perchados/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Argon2idPasswordHasher, type Argon2idParams } from './argon2id-password-hasher';

/** Mínimo OWASP permitido por la configuración con t = 2: rápido y válido para pruebas. */
const FAST: Argon2idParams = {
  memoryKib: 19456,
  iterations: 2,
  parallelism: 1,
};
const CURRENT: Argon2idParams = {
  memoryKib: 19456,
  iterations: 4,
  parallelism: 1,
};
const ARGON2I = 1;
const ARGON2ID = 2;
const PASSWORD = 'Perch@ 2026';
const DUMMY_RATIO = 4;
const SAMPLES = 3;

async function elapsedMs(action: () => Promise<unknown>): Promise<number> {
  const started = performance.now();
  await action();
  return performance.now() - started;
}

async function medianMs(action: () => Promise<unknown>): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    samples.push(await elapsedMs(action));
  }
  return samples.sort((a, b) => a - b)[Math.floor(SAMPLES / 2)] ?? 0;
}

describe('Argon2idPasswordHasher (RF-018, RT-010)', () => {
  const hasher = new Argon2idPasswordHasher(FAST);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('genera un hash argon2id con los parámetros configurados que no contiene la contraseña', async () => {
    const stored = await hasher.hash(PASSWORD);
    const options = parseOptions(stored);

    expect(stored.startsWith('$argon2id$v=19$')).toBe(true);
    expect(options).toMatchObject({
      algorithm: ARGON2ID,
      memoryCost: FAST.memoryKib,
      timeCost: FAST.iterations,
      parallelism: FAST.parallelism,
    });
    expect(stored).not.toContain(PASSWORD);
  });

  it('usa sal aleatoria: dos hashes de la misma contraseña difieren y ambos verifican', async () => {
    const first = await hasher.hash(PASSWORD);
    const second = await hasher.hash(PASSWORD);

    expect(first).not.toBe(second);
    await expect(hasher.verify(first, PASSWORD)).resolves.toBe(true);
    await expect(hasher.verify(second, PASSWORD)).resolves.toBe(true);
  });

  it('verifica la contraseña correcta y rechaza la incorrecta, sensible a mayúsculas', async () => {
    const stored = await hasher.hash(PASSWORD);

    await expect(hasher.verify(stored, PASSWORD)).resolves.toBe(true);
    await expect(hasher.verify(stored, 'perch@ 2026')).resolves.toBe(false);
    await expect(hasher.verify(stored, `${PASSWORD} `)).resolves.toBe(false);
  });

  it('normaliza a NFC: «é» compuesta y descompuesta verifican igual', async () => {
    const composed = 'Café 2026!';
    const decomposed = 'Café 2026!';
    const fromComposed = await hasher.hash(composed);
    const fromDecomposed = await hasher.hash(decomposed);

    await expect(hasher.verify(fromComposed, decomposed)).resolves.toBe(true);
    await expect(hasher.verify(fromDecomposed, composed)).resolves.toBe(true);
  });

  it('acepta emojis y el máximo de 128 caracteres', async () => {
    const emoji = 'clave-\u{1F9E5}\u{1F457}-segura';
    const longest = 'a'.repeat(PASSWORD_MAX_LENGTH);

    await expect(hasher.verify(await hasher.hash(emoji), emoji)).resolves.toBe(true);
    await expect(hasher.verify(await hasher.hash(longest), longest)).resolves.toBe(true);
  });

  it('rechaza hashear más de 128 caracteres y no verifica un texto así', async () => {
    const tooLong = 'a'.repeat(PASSWORD_MAX_LENGTH + 1);
    const stored = await hasher.hash(PASSWORD);

    await expect(hasher.hash(tooLong)).rejects.toThrow(RangeError);
    await expect(hasher.verify(stored, tooLong)).resolves.toBe(false);
  });

  it('el error por exceso de longitud no revela la contraseña', async () => {
    const tooLong = 'secreto-'.repeat(20);

    const error = await hasher.hash(tooLong).catch((caught: unknown) => caught);

    expect(String(error)).not.toContain('secreto');
  });

  it('un hash corrupto o vacío no verifica y no lanza', async () => {
    await expect(hasher.verify('no-es-un-hash', PASSWORD)).resolves.toBe(false);
    await expect(hasher.verify('', PASSWORD)).resolves.toBe(false);
  });

  it('no escribe nada en la salida estándar al hashear ni verificar', async () => {
    const out = vi.spyOn(process.stdout, 'write');
    const err = vi.spyOn(process.stderr, 'write');
    const logged = vi.spyOn(console, 'log');

    await hasher.verify(await hasher.hash(PASSWORD), PASSWORD);
    await hasher.verifyDummy(PASSWORD);

    expect(out).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });

  describe('needsRehash', () => {
    const current = new Argon2idPasswordHasher(CURRENT);

    it('es falso con los parámetros vigentes', async () => {
      expect(current.needsRehash(await current.hash(PASSWORD))).toBe(false);
    });

    it('es verdadero si las iteraciones guardadas son inferiores', async () => {
      expect(current.needsRehash(await hasher.hash(PASSWORD))).toBe(true);
    });

    it('es verdadero si la memoria guardada es inferior', async () => {
      const older = await rawHash(PASSWORD, {
        algorithm: ARGON2ID,
        memoryCost: 9216,
        timeCost: 4,
        parallelism: 1,
      });

      expect(current.needsRehash(older)).toBe(true);
    });

    it('es verdadero si el paralelismo guardado es inferior', async () => {
      const parallel = new Argon2idPasswordHasher({
        ...CURRENT,
        parallelism: 2,
      });

      expect(parallel.needsRehash(await current.hash(PASSWORD))).toBe(true);
    });

    it('es falso si el hash guardado supera los parámetros vigentes', async () => {
      expect(hasher.needsRehash(await current.hash(PASSWORD))).toBe(false);
    });

    it('es verdadero para un algoritmo distinto de argon2id', async () => {
      const argon2i = await rawHash(PASSWORD, {
        algorithm: ARGON2I,
        memoryCost: 19456,
        timeCost: 4,
      });

      expect(current.needsRehash(argon2i)).toBe(true);
    });

    it('es verdadero para un valor que no es un hash', () => {
      expect(current.needsRehash('basura')).toBe(true);
    });
  });

  describe('verifyDummy (CB-003, CB-004)', () => {
    it('tarda del mismo orden que un verify real', async () => {
      const stored = await hasher.hash(PASSWORD);
      await hasher.verifyDummy(PASSWORD);

      const real = await medianMs(() => hasher.verify(stored, 'otra-contraseña'));
      const dummy = await medianMs(() => hasher.verifyDummy('otra-contraseña'));

      expect(dummy).toBeGreaterThan(real / DUMMY_RATIO);
      expect(dummy).toBeLessThan(real * DUMMY_RATIO);
    });

    it('no devuelve nada y no lanza con una contraseña demasiado larga', async () => {
      await expect(
        hasher.verifyDummy('a'.repeat(PASSWORD_MAX_LENGTH + 1)),
      ).resolves.toBeUndefined();
    });

    it('calcula el hash ficticio una sola vez, también al arrancar', async () => {
      const fresh = new Argon2idPasswordHasher(FAST);
      const spy = vi.spyOn(fresh, 'hash');

      await fresh.onModuleInit();
      await fresh.verifyDummy(PASSWORD);
      await fresh.verifyDummy(PASSWORD);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
