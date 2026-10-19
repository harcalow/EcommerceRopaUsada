import { CONTACT_EMAIL, INITIAL_ADMIN, uniqueLetters } from '../fixtures/accounts';
import { expect, test } from '../fixtures/test';

const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos';
const PANEL_MESSAGE = 'Próximamente, estamos trabajando';
const ANY_VALID_PASSWORD = 'Contrasena-valida-1';

test.describe('Login de administrador: escenarios (RT-019)', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('CA-001 inicio de sesión correcto muestra el panel con «Próximamente, estamos trabajando»', async ({
    accounts,
    loginPage,
    panelPage,
    page,
  }) => {
    const admin = await accounts.create('admin');

    const response = await loginPage.logInAndWaitForResponse(admin.username, admin.password);
    expect(response.status()).toBe(200);

    await expect(page).toHaveURL(/\/panel$/);
    await expect(panelPage.comingSoon).toContainText(PANEL_MESSAGE);
    expect(loginPage.problems).toEqual([]);
  });

  test('CA-002 campos vacíos: errores junto a cada campo y ningún intento enviado', async ({ loginPage }) => {
    await loginPage.submit.click();

    await expect(loginPage.usernameError).toHaveText('Escribe tu usuario');
    await expect(loginPage.passwordError).toHaveText('Escribe tu contraseña');
    expect(loginPage.loginRequests).toBe(0);
  });

  for (const username of ['Harold1', 'Harold_Admin', 'Harold Admin']) {
    test(`CA-014 usuario con caracteres no permitidos «${username}»: error junto al campo y ningún intento enviado`, async ({
      loginPage,
    }) => {
      await loginPage.logIn(username, ANY_VALID_PASSWORD);

      await expect(loginPage.usernameError).toHaveText('El usuario solo puede tener letras');
      expect(loginPage.loginRequests).toBe(0);
    });
  }

  test('CA-015 contraseña de 7 caracteres: error junto al campo y ningún intento enviado', async ({ loginPage }) => {
    await loginPage.logIn('lucia', 'Abcdef1');

    await expect(loginPage.passwordError).toHaveText('La contraseña debe tener al menos 8 caracteres');
    expect(loginPage.loginRequests).toBe(0);
  });

  test('CA-003 credenciales incorrectas: mismo mensaje con contraseña errónea y con usuario inexistente', async ({
    accounts,
    loginPage,
  }) => {
    const admin = await accounts.create('admin');

    const wrongPassword = await loginPage.logInAndWaitForResponse(admin.username, 'Contrasena-incorrecta-1');
    expect(wrongPassword.status()).toBe(401);
    await expect(loginPage.error).toContainText(INVALID_CREDENTIALS);
    const wrongPasswordMessage = await loginPage.error.innerText();

    const unknownUser = await loginPage.logInAndWaitForResponse(`inexistente${uniqueLetters()}`, ANY_VALID_PASSWORD);
    expect(unknownUser.status()).toBe(401);
    await expect(loginPage.error).toContainText(INVALID_CREDENTIALS);
    expect(await loginPage.error.innerText()).toBe(wrongPasswordMessage);
  });

  test('CA-004 mostrar y ocultar la contraseña', async ({ loginPage }) => {
    await loginPage.password.fill(ANY_VALID_PASSWORD);
    await expect(loginPage.password).toHaveAttribute('type', 'password');

    await loginPage.passwordToggle.click();
    await expect(loginPage.password).toHaveAttribute('type', 'text');
    await expect(loginPage.password).toHaveValue(ANY_VALID_PASSWORD);

    await loginPage.passwordToggle.click();
    await expect(loginPage.password).toHaveAttribute('type', 'password');
  });

  test('CA-005 aviso de Bloq Mayús mientras se escribe y desaparece al desactivarlo', async ({ loginPage }) => {
    await expect(loginPage.capsLockNotice).toHaveCount(0);

    await loginPage.pressKeyWithCapsLock(true);
    await expect(loginPage.capsLockNotice).toHaveText('Bloq Mayús está activado');

    await loginPage.pressKeyWithCapsLock(false);
    await expect(loginPage.capsLockNotice).toHaveCount(0);
  });

  test('CA-006 «¿Olvidaste tu contraseña?» indica escribir al responsable y muestra su correo, sin pedir correo', async ({
    loginPage,
  }) => {
    await loginPage.forgotToggle.click();

    await expect(loginPage.forgotPanel).toContainText('Escribe al responsable de la tienda');
    await expect(loginPage.forgotEmail).toHaveText(CONTACT_EMAIL);
    await expect(loginPage.forgotEmail).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    await expect(loginPage.form.getByRole('textbox', { name: /correo/i })).toHaveCount(0);
    expect(loginPage.loginRequests).toBe(0);
  });

  test('CA-007 el quinto intento fallido bloquea la cuenta 30 minutos aunque luego se use la contraseña correcta', async ({
    accounts,
    loginPage,
    page,
  }) => {
    const admin = await accounts.create('admin');
    await accounts.db.setFailedAttempts(admin.username, 4);

    const fifth = await loginPage.logInAndWaitForResponse(admin.username, 'Contrasena-incorrecta-1');
    expect(fifth.status()).toBe(423);
    expect(await fifth.json()).toMatchObject({ type: 'auth/account-locked', lockedMinutesRemaining: 30 });
    await expect(loginPage.error).toContainText('Demasiados intentos. Vuelve a intentarlo en 30 minutos');

    const sixth = await loginPage.logInAndWaitForResponse(admin.username, admin.password);
    expect(sixth.status()).toBe(423);
    expect(await sixth.json()).toMatchObject({ type: 'auth/account-locked' });
    await expect(loginPage.error).toContainText('Demasiados intentos. Vuelve a intentarlo en');
    await expect(page).toHaveURL(/\/login$/);
    const state = await accounts.db.getLockState(admin.username);
    expect(state.lockedUntil).not.toBeNull();
  });

  test('CA-016 desbloqueo automático: pasado el bloqueo entra y el contador queda en 0', async ({
    accounts,
    loginPage,
    panelPage,
  }) => {
    const admin = await accounts.create('admin');
    await accounts.db.setFailedAttempts(admin.username, 5);
    await accounts.db.setLockedUntil(admin.username, new Date(Date.now() - 1000));

    const response = await loginPage.logInAndWaitForResponse(admin.username, admin.password);
    expect(response.status()).toBe(200);

    await expect(panelPage.comingSoon).toBeVisible();
    expect(await accounts.db.getLockState(admin.username)).toEqual({ failedAttempts: 0, lockedUntil: null });
  });

  test('CA-008 el contador de intentos fallidos se reinicia al iniciar sesión', async ({
    accounts,
    loginPage,
    panelPage,
  }) => {
    const admin = await accounts.create('admin');
    await accounts.db.setFailedAttempts(admin.username, 3);

    const response = await loginPage.logInAndWaitForResponse(admin.username, admin.password);
    expect(response.status()).toBe(200);

    await expect(panelPage.comingSoon).toBeVisible();
    expect((await accounts.db.getLockState(admin.username)).failedAttempts).toBe(0);
  });

  test('CA-009 sin registro ni credenciales visibles', async ({ loginPage, page }) => {
    await expect(loginPage.infoNote).toContainText('Las cuentas de administrador se crean fuera del panel');
    await expect(page.getByRole('link', { name: /crear|registr/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /crear|registr/i })).toHaveCount(0);
    await expect(loginPage.username).toHaveValue('');
    await expect(loginPage.password).toHaveValue('');
    await expect(loginPage.screen).not.toContainText(/usuario de prueba|contraseña de prueba|ejemplo/i);
  });

  test('CA-013 el botón muestra estado de carga y no admite envíos repetidos mientras se verifica', async ({
    accounts,
    loginPage,
    panelPage,
    page,
  }) => {
    const admin = await accounts.create('admin');
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/v1/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        await released;
      }
      await route.continue();
    });

    await loginPage.fill(admin.username, admin.password);
    await loginPage.submit.click();
    await expect(loginPage.submit).toHaveAttribute('aria-busy', 'true');
    await loginPage.submit.click({ force: true });
    await loginPage.submit.click({ force: true });
    release();

    await expect(panelPage.comingSoon).toBeVisible();
    expect(loginPage.loginRequests).toBe(1);
  });

  test('CA-017 HaroldAdmin existe con rol administrador, hash y puede iniciar sesión con su contraseña inicial', async ({
    accounts,
    loginPage,
    panelPage,
  }) => {
    await accounts.db.seedInitialAdmin(INITIAL_ADMIN);

    expect(await accounts.db.getRoleCodes()).toContain('admin');
    const record = await accounts.db.getAccountRecord(INITIAL_ADMIN.username);
    expect(record?.roleCode).toBe('admin');
    expect(record?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(record?.passwordHash).not.toContain(INITIAL_ADMIN.password);

    const response = await loginPage.logInAndWaitForResponse(INITIAL_ADMIN.username, INITIAL_ADMIN.password);
    expect(response.status()).toBe(200);
    await expect(panelPage.comingSoon).toBeVisible();
  });

  test('CA-019 una cuenta con credenciales válidas pero sin el rol administrador no entra al panel', async ({
    accounts,
    loginPage,
    page,
  }) => {
    const nonAdmin = await accounts.create('lucia');

    const response = await loginPage.logInAndWaitForResponse(nonAdmin.username, nonAdmin.password);
    expect(response.status()).toBe(401);

    await expect(loginPage.error).toContainText(INVALID_CREDENTIALS);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('CB-001 los espacios al inicio y al final del usuario se ignoran', async ({
    accounts,
    loginPage,
    panelPage,
  }) => {
    const admin = await accounts.create('admin');

    const response = await loginPage.logInAndWaitForResponse(`  ${admin.username}  `, admin.password);
    expect(response.status()).toBe(200);

    await expect(panelPage.comingSoon).toBeVisible();
  });

  test('CB-002 el usuario no distingue mayúsculas y la contraseña sí', async ({
    accounts,
    loginPage,
    panelPage,
    page,
  }) => {
    const admin = await accounts.create('admin');

    const wrongCase = await loginPage.logInAndWaitForResponse(admin.username.toUpperCase(), admin.password.toUpperCase());
    expect(wrongCase.status()).toBe(401);
    await expect(loginPage.error).toContainText(INVALID_CREDENTIALS);

    const rightCase = await loginPage.logInAndWaitForResponse(admin.username.toUpperCase(), admin.password);
    expect(rightCase.status()).toBe(200);
    await expect(panelPage.comingSoon).toBeVisible();
    await expect(page).toHaveURL(/\/panel$/);
  });

  test('CB-007 sin conexión al entrar: muestra «No hay conexión, inténtalo de nuevo» y no cuenta como intento fallido', async ({
    accounts,
    loginPage,
    page,
  }) => {
    const admin = await accounts.create('admin');
    await page.route('**/v1/auth/login', (route) => route.abort('internetdisconnected'));

    await loginPage.logIn(admin.username, admin.password);

    await expect(loginPage.error).toContainText('No hay conexión, inténtalo de nuevo');
    expect((await accounts.db.getLockState(admin.username)).failedAttempts).toBe(0);
  });

  test('CB-011 un administrador ya autenticado que abre el login va directo al panel', async ({
    signedInAdmin,
    loginPage,
    panelPage,
    page,
  }) => {
    expect(signedInAdmin.username).not.toBe('');

    await loginPage.goto();

    await expect(page).toHaveURL(/\/panel$/);
    await expect(panelPage.comingSoon).toBeVisible();
  });
});
