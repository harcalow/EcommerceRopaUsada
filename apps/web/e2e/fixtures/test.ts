import { expect, test as base } from '@playwright/test';

import { LoginPage } from '../pages/LoginPage';
import { PanelPage } from '../pages/PanelPage';

import { TEST_ACCOUNTS, uniqueLetters, type TestAccountName, type TestAccountSpec } from './accounts';
import { E2eDatabase } from './db';

/** Cuentas de prueba de una prueba: se crean al pedirlas y se limpian al terminar. */
export interface Accounts {
  readonly db: E2eDatabase;
  /** Crea la cuenta con hash real y devuelve sus datos; el usuario lleva un sufijo de letras único por prueba. */
  create(name: TestAccountName): Promise<TestAccountSpec>;
}

interface Fixtures {
  accounts: Accounts;
  loginPage: LoginPage;
  panelPage: PanelPage;
  /** Administrador que ya inició sesión por la interfaz y está en `/panel`. */
  signedInAdmin: TestAccountSpec;
}

/**
 * `test` del proyecto. El `Pool` de `pg` conecta de forma perezosa: las pruebas que no piden
 * `accounts` (p. ej. la de humo) no tocan la BD.
 */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright exige desestructurar el primer argumento del fixture
  accounts: async ({}, use) => {
    const db = new E2eDatabase();
    try {
      await use({
        db,
        create: async (name) => {
          const base = TEST_ACCOUNTS[name];
          const spec: TestAccountSpec = { ...base, username: `${base.username}${uniqueLetters()}` };
          await db.createAccount(spec);
          return spec;
        },
      });
    } finally {
      await db.cleanup();
      await db.close();
    }
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  panelPage: async ({ page }, use) => {
    await use(new PanelPage(page));
  },
  signedInAdmin: async ({ accounts, loginPage, panelPage }, use) => {
    const admin = await accounts.create('admin');
    await loginPage.goto();
    await loginPage.logIn(admin.username, admin.password);
    await expect(panelPage.comingSoon).toBeVisible();
    await use(admin);
  },
});

export { expect };
