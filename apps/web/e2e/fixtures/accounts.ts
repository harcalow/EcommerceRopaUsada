/** Cuenta de prueba. Las contraseñas no son secretos: solo existen en la BD de E2E. */
export interface TestAccountSpec {
  readonly username: string;
  readonly password: string;
  /** `admin` o el rol sin privilegios de las pruebas. */
  readonly role: 'admin' | 'user';
}

/** Cuentas de prueba (datos fuera de las pruebas, RT-019). El usuario es la base: cada prueba añade un sufijo único. */
export const TEST_ACCOUNTS = {
  admin: { username: 'testadmin', password: 'E2e-admin-pass-2026!', role: 'admin' },
  lucia: { username: 'lucia', password: 'E2e-lucia-pass-2026!', role: 'user' },
} as const satisfies Record<string, TestAccountSpec>;

export type TestAccountName = keyof typeof TEST_ACCOUNTS;

/**
 * Cuenta inicial de la carga inicial (RF-019). La contraseña de prueba es la del entorno de CI
 * (`E2E_ADMIN_INITIAL_PASSWORD`); el valor por defecto solo existe en la BD de E2E.
 */
export const INITIAL_ADMIN = {
  username: 'HaroldAdmin',
  password: process.env.E2E_ADMIN_INITIAL_PASSWORD ?? 'E2e-initial-pass-2026!',
} as const;

const SUFFIX_LENGTH = 10;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Sufijo solo de letras (el usuario no admite números, RF-015) para aislar las cuentas de cada prueba. */
export function uniqueLetters(length: number = SUFFIX_LENGTH): string {
  return Array.from({ length }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
}

/** Correo del responsable que muestra «¿Olvidaste tu contraseña?» (RF-007); la web lo recibe como `ADMIN_CONTACT_EMAIL`. */
export const CONTACT_EMAIL = process.env.ADMIN_CONTACT_EMAIL ?? 'admin-e2e@example.com';
