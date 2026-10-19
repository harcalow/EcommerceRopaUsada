import type { Page } from '@playwright/test';

import { scanWcag } from '../fixtures/axe';
import { expect, test } from '../fixtures/test';
import type { LoginPage } from '../pages/LoginPage';
import { measurePerformance } from '../fixtures/web-vitals';

const EXPIRED_LOGIN_PATH = '/login?motivo=sesion-caducada';
const FOCUS_MIN_WIDTH_PX = 2;

/** Anchos de los dispositivos y del zoom (1280 px a 200 % = 640 CSS px; a 400 % = 320 CSS px, el reflow de WCAG 1.4.10). */
const REFLOW_VIEWPORTS = [
  { name: '320 px (zoom 400 %)', width: 320, height: 256 },
  { name: '360 px', width: 360, height: 740 },
  { name: '640 px (zoom 200 % sobre 1280)', width: 640, height: 360 },
  { name: '959 px', width: 959, height: 700 },
  { name: '1280 px', width: 1280, height: 720 },
] as const;

/** El contorno de foco está en el propio control o en su contenedor inmediato (el campo envuelve al `input`). */
function hasVisibleFocusRing(element: Element, minWidth: number): boolean {
  const candidates = [element, element.parentElement, element.parentElement?.parentElement];
  return candidates.some((candidate) => {
    if (!candidate) {
      return false;
    }
    const style = getComputedStyle(candidate);
    return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= minWidth;
  });
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Pares de controles visibles cuyos rectángulos se solapan. */
async function overlappingControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="login-form"] :is(input, button, a)'),
    ).filter((element) => element.getClientRects().length > 0);
    const overlaps: string[] = [];
    controls.forEach((first, index) => {
      controls.slice(index + 1).forEach((second) => {
        const a = first.getBoundingClientRect();
        const b = second.getBoundingClientRect();
        const intersects = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        if (intersects && !first.contains(second) && !second.contains(first)) {
          overlaps.push(`${first.dataset.testid ?? first.tagName} / ${second.dataset.testid ?? second.tagName}`);
        }
      });
    });
    return overlaps;
  });
}

test.describe('RNF Accesibilidad: axe (WCAG 2.2 AA) en /login', () => {
  test('estado inicial sin violaciones', async ({ loginPage, page }) => {
    await loginPage.goto();
    await expect(loginPage.form).toBeVisible();
    expect(await scanWcag(page)).toEqual([]);
  });

  test('con errores de validación de campo sin violaciones', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.submit.click();
    await expect(loginPage.usernameError).toBeVisible();
    await expect(loginPage.passwordError).toBeVisible();
    expect(await scanWcag(page)).toEqual([]);
  });

  test('con error de credenciales sin violaciones', async ({ loginPage, accounts, page }) => {
    const admin = await accounts.create('admin');
    await loginPage.goto();
    await loginPage.logIn(admin.username, 'Contrasena-incorrecta-1');
    await expect(loginPage.error).toBeVisible();
    expect(await scanWcag(page)).toEqual([]);
  });

  test('con el aviso de bloqueo sin violaciones', async ({ loginPage, accounts, page }) => {
    const admin = await accounts.create('admin');
    await accounts.db.setFailedAttempts(admin.username, 4);
    await loginPage.goto();
    await loginPage.logIn(admin.username, 'Contrasena-incorrecta-1');
    await expect(loginPage.error).toContainText('Demasiados intentos');
    expect(await scanWcag(page)).toEqual([]);
  });

  test('con el aviso de Bloq Mayús sin violaciones', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.pressKeyWithCapsLock(true);
    await expect(loginPage.capsLockNotice).toBeVisible();
    expect(await scanWcag(page)).toEqual([]);
  });

  test('con el desplegable «¿Olvidaste tu contraseña?» abierto sin violaciones', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.forgotToggle.click();
    await expect(loginPage.forgotPanel).toBeVisible();
    expect(await scanWcag(page)).toEqual([]);
  });

  test('con el aviso de sesión caducada sin violaciones', async ({ loginPage, page }) => {
    await page.goto(EXPIRED_LOGIN_PATH);
    await expect(loginPage.sessionExpired).toBeVisible();
    expect(await scanWcag(page)).toEqual([]);
  });

  test('con la contraseña visible sin violaciones', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.password.fill('Una-contrasena-1');
    await loginPage.passwordToggle.click();
    await expect(loginPage.password).toHaveAttribute('type', 'text');
    expect(await scanWcag(page)).toEqual([]);
  });
});

test.describe('RNF Accesibilidad: axe (WCAG 2.2 AA) en /panel', () => {
  test('panel con sesión iniciada sin violaciones', async ({ signedInAdmin, panelPage, page }) => {
    expect(signedInAdmin.username).not.toBe('');
    await expect(panelPage.comingSoon).toBeVisible();
    expect(await scanWcag(page)).toEqual([]);
  });
});

test.describe('RNF Accesibilidad: teclado', () => {
  test('el formulario completo se recorre y se envía solo con Tab, Espacio y Enter', async ({
    loginPage,
    panelPage,
    accounts,
    page,
  }) => {
    const admin = await accounts.create('admin');
    await loginPage.goto();

    await page.keyboard.press('Tab');
    await expect(loginPage.username).toBeFocused();
    await page.keyboard.type(admin.username);

    await page.keyboard.press('Tab');
    await expect(loginPage.password).toBeFocused();
    await page.keyboard.type(admin.password);

    await page.keyboard.press('Tab');
    await expect(loginPage.passwordToggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(loginPage.password).toHaveAttribute('type', 'text');
    await page.keyboard.press('Space');
    await expect(loginPage.password).toHaveAttribute('type', 'password');

    await page.keyboard.press('Tab');
    await expect(loginPage.forgotToggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(loginPage.forgotPanel).toBeVisible();
    await expect(loginPage.forgotToggle).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Tab');
    await expect(loginPage.forgotEmail).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(loginPage.submit).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(panelPage.comingSoon).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(panelPage.logout).toBeFocused();
  });

  test('un envío vacío con Enter lleva el foco al primer campo con error', async ({ loginPage, page }) => {
    await loginPage.goto();
    await page.keyboard.press('Tab');
    await expect(loginPage.username).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(loginPage.usernameError).toBeVisible();
    await expect(loginPage.username).toBeFocused();
    await expect(loginPage.username).toHaveAttribute('aria-invalid', 'true');
  });

  test('cada control enfocado muestra un contorno visible de al menos 2 px', async ({ loginPage, page }) => {
    await loginPage.goto();
    const stops = [loginPage.username, loginPage.password, loginPage.passwordToggle, loginPage.forgotToggle, loginPage.submit];
    for (const control of stops) {
      await page.keyboard.press('Tab');
      await expect(control).toBeFocused();
      expect(await control.evaluate(hasVisibleFocusRing, FOCUS_MIN_WIDTH_PX)).toBe(true);
    }
  });
});

test.describe('RNF Responsive: sin desplazamiento horizontal ni solapes', () => {
  for (const viewport of REFLOW_VIEWPORTS) {
    test(`/login a ${viewport.name}`, async ({ loginPage, page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginPage.goto();
      await loginPage.submit.click();
      await expect(loginPage.usernameError).toBeVisible();
      await loginPage.forgotToggle.click();
      await expect(loginPage.forgotPanel).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      expect(await overlappingControls(page)).toEqual([]);
    });
  }

  test('/panel a 320 px no se desplaza en horizontal', async ({ signedInAdmin, panelPage, page }) => {
    expect(signedInAdmin.username).not.toBe('');
    await page.setViewportSize({ width: 320, height: 256 });
    await expect(panelPage.comingSoon).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('el formulario va antes que el panel de marca por debajo de 960 px y el mosaico se oculta por debajo de 600 px', async ({
    loginPage,
    page,
  }) => {
    const showcase = page.getByTestId('brand-showcase');
    const mosaic = page.getByTestId('brand-mosaic');

    await page.setViewportSize({ width: 599, height: 740 });
    await loginPage.goto();
    await expect(mosaic).toBeHidden();
    const narrowForm = await loginPage.form.boundingBox();
    const narrowShowcase = await showcase.boundingBox();
    expect(narrowForm?.y ?? Infinity).toBeLessThan(narrowShowcase?.y ?? -1);

    await page.setViewportSize({ width: 800, height: 740 });
    await expect(mosaic).toBeVisible();
    const midForm = await loginPage.form.boundingBox();
    const midShowcase = await showcase.boundingBox();
    expect(midForm?.y ?? Infinity).toBeLessThan(midShowcase?.y ?? -1);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(showcase).toBeVisible();
    const wideForm = await loginPage.form.boundingBox();
    const wideShowcase = await showcase.boundingBox();
    // En escritorio el panel de marca va a la izquierda y el formulario a la derecha, sin solaparse
    expect((wideShowcase?.x ?? Infinity) + (wideShowcase?.width ?? 0)).toBeLessThanOrEqual((wideForm?.x ?? -1) + 1);
  });
});

test.describe('RNF Accesibilidad: modo de colores forzados', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
  });

  test('los campos y el botón conservan borde y el foco sigue visible', async ({ loginPage, page }) => {
    await loginPage.goto();
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    for (const control of [loginPage.username, loginPage.password, loginPage.submit]) {
      await expect(control).toBeVisible();
    }
    const shapes = await page.evaluate(() => {
      const border = (testId: string) => {
        const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
        const target =
          testId === 'login-submit' ? element : (element?.closest('div') ?? element);
        const style = target ? getComputedStyle(target) : null;
        const boxed = style !== null && style.borderTopStyle !== 'none' && parseFloat(style.borderTopWidth) > 0;
        const outlined = style !== null && style.outlineStyle !== 'none';
        return boxed || outlined;
      };
      return { username: border('login-username'), password: border('login-password'), submit: border('login-submit') };
    });
    expect(shapes).toEqual({ username: true, password: true, submit: true });

    await page.keyboard.press('Tab');
    await expect(loginPage.username).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(loginPage.passwordToggle).toBeFocused();
    expect(await loginPage.passwordToggle.evaluate(hasVisibleFocusRing, FOCUS_MIN_WIDTH_PX)).toBe(true);
  });

  test('los errores se transmiten con texto y rol, no solo con color', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.submit.click();
    await expect(loginPage.usernameError).toBeVisible();
    await expect(loginPage.usernameError).not.toHaveText('');
    await expect(loginPage.username).toHaveAttribute('aria-invalid', 'true');
    await expect(loginPage.username).toHaveAttribute('aria-describedby', /.+/);
  });

  test('el panel muestra su mensaje y el botón de salir', async ({ signedInAdmin, panelPage }) => {
    expect(signedInAdmin.username).not.toBe('');
    await expect(panelPage.comingSoon).toBeVisible();
    await expect(panelPage.logout).toBeVisible();
  });
});

test.describe('RT-021 presupuesto de rendimiento de /login', () => {
  async function measureLogin(page: Page, loginPage: LoginPage) {
    return measurePerformance(page, loginPage.path, async () => {
      await loginPage.username.click();
      await page.keyboard.type('Administrador');
      await loginPage.passwordToggle.click();
      await loginPage.submit.click();
      await expect(loginPage.passwordError).toBeVisible();
    });
  }

  test('LCP, CLS e INP dentro del presupuesto', async ({ loginPage, page }, testInfo) => {
    const sample = await measureLogin(page, loginPage);
    await testInfo.attach('rt-021-metricas.json', {
      body: JSON.stringify({ project: testInfo.project.name, ...sample }, null, 2),
      contentType: 'application/json',
    });
    // Línea de consola que se anota en la tabla del PR
    process.stdout.write(`RT-021 ${testInfo.project.name}: ${JSON.stringify(sample)}
`);

    expect(sample.lcpMs).toBeGreaterThan(0);
    expect(sample.lcpMs).toBeLessThanOrEqual(2500);
    expect(sample.cls).toBeLessThanOrEqual(0.1);
    expect(sample.inpMs).toBeLessThanOrEqual(200);
  });

  test('JS inicial ≤ 200 KB gzip', async ({ loginPage, page }) => {
    const sample = await measureLogin(page, loginPage);
    expect(sample.initialJsGzipKb).toBeGreaterThan(0);
    expect(sample.initialJsGzipKb).toBeLessThanOrEqual(200);
  });
});
