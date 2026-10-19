import { expect, test } from '../fixtures/test';

// Prueba de humo de la base E2E (T-39): solo lo que la web resuelve sin la API de login.
test.describe('Humo E2E (RT-019)', () => {
  test('SMOKE-001 /login carga sin errores de consola ni violaciones de CSP', async ({ loginPage }) => {
    const response = await loginPage.page.goto(loginPage.path);

    expect(response?.status()).toBe(200);
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    await expect(loginPage.screen).toBeVisible();
    await expect(loginPage.form).toBeVisible();
    await expect(loginPage.username).toBeEditable();
    await expect(loginPage.password).toBeEditable();
    await expect(loginPage.submit).toBeVisible();
    await expect(loginPage.infoNote).toBeVisible();
    await loginPage.forgotToggle.click();
    await expect(loginPage.forgotPanel).toBeVisible();
    expect(loginPage.problems).toEqual([]);
  });

  test('SMOKE-002 /panel sin sesión redirige a /login', async ({ panelPage, page }) => {
    await panelPage.goto();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-screen')).toBeVisible();
  });

  test('SMOKE-003 /healthz responde', async ({ request }) => {
    const response = await request.get('/healthz');

    expect(response.ok()).toBe(true);
  });
});
