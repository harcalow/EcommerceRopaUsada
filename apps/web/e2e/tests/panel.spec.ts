import { PanelPage } from '../pages/PanelPage';
import { expect, test } from '../fixtures/test';

const SESSION_EXPIRED_MESSAGE = 'Tu sesión ha caducado. Vuelve a iniciar sesión';
const LOGIN_URL = /\/login(\?.*)?$/;
const EXPIRED_LOGIN_URL = /\/login\?motivo=sesion-caducada$/;

test.describe('Panel de administración: escenarios (RT-019)', () => {
  test('CA-010 abrir el panel sin sesión lleva al login', async ({ panelPage, loginPage, page }) => {
    await panelPage.goto();

    await expect(page).toHaveURL(LOGIN_URL);
    await expect(loginPage.form).toBeVisible();
    await expect(panelPage.comingSoon).toHaveCount(0);
  });

  test('CA-011 cerrar sesión vuelve al login y «Atrás» no muestra contenido del panel', async ({
    signedInAdmin,
    panelPage,
    loginPage,
    page,
  }) => {
    expect(signedInAdmin.username).not.toBe('');
    // Una segunda entrada del historial del panel, a la que «Atrás» volvería tras cerrar sesión
    await page.goto('/panel?vista=inicio');
    await expect(panelPage.comingSoon).toBeVisible();

    await panelPage.logOut();
    await expect(page).toHaveURL(LOGIN_URL);
    await expect(loginPage.form).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(LOGIN_URL);
    await expect(loginPage.form).toBeVisible();
    await expect(panelPage.comingSoon).toHaveCount(0);
  });

  test('CA-018 la sesión caduca a las 8 horas: la siguiente acción lleva al login con el aviso', async ({
    signedInAdmin,
    accounts,
    panelPage,
    loginPage,
    page,
  }) => {
    await accounts.db.setSessionsExpiry(signedInAdmin.username, new Date(Date.now() - 1000));

    await page.reload();

    await expect(page).toHaveURL(EXPIRED_LOGIN_URL);
    await expect(loginPage.sessionExpired).toContainText(SESSION_EXPIRED_MESSAGE);
    await expect(panelPage.comingSoon).toHaveCount(0);
  });

  test('CB-017 la sesión caduca con varias pestañas del panel: todas llevan al login', async ({
    signedInAdmin,
    accounts,
    panelPage,
    page,
    context,
  }) => {
    const secondPage = await context.newPage();
    const secondPanel = new PanelPage(secondPage);
    await secondPanel.goto();
    await expect(secondPanel.comingSoon).toBeVisible();
    await accounts.db.setSessionsExpiry(signedInAdmin.username, new Date(Date.now() - 1000));

    await panelPage.returnToTab();
    await secondPanel.returnToTab();

    for (const tab of [page, secondPage]) {
      await expect(tab).toHaveURL(EXPIRED_LOGIN_URL);
      await expect(tab.getByTestId('login-session-expired')).toContainText(SESSION_EXPIRED_MESSAGE);
    }
  });

  test('CB-018 cerrar sesión en una pestaña lleva al login a las demás pestañas del panel', async ({
    signedInAdmin,
    panelPage,
    page,
    context,
  }) => {
    expect(signedInAdmin.username).not.toBe('');
    const secondPage = await context.newPage();
    const secondPanel = new PanelPage(secondPage);
    await secondPanel.goto();
    await expect(secondPanel.comingSoon).toBeVisible();

    await panelPage.logOut();
    await expect(page).toHaveURL(LOGIN_URL);
    await secondPanel.returnToTab();

    await expect(secondPage).toHaveURL(LOGIN_URL);
    await expect(secondPage.getByTestId('login-form')).toBeVisible();
    await expect(secondPanel.comingSoon).toHaveCount(0);
  });
});
