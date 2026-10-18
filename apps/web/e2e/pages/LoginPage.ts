import type { Locator, Page, Response } from '@playwright/test';

import { BasePage } from './BasePage';

/** Pantalla `/login`. Solo selectores `data-testid` del diseño. */
export class LoginPage extends BasePage {
  readonly path = '/login';

  private sent = 0;

  constructor(page: Page) {
    super(page);
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/v1/auth/login') {
        this.sent += 1;
      }
    });
  }

  get screen(): Locator {
    return this.byTestId('login-screen');
  }

  get form(): Locator {
    return this.byTestId('login-form');
  }

  get username(): Locator {
    return this.byTestId('login-username');
  }

  get password(): Locator {
    return this.byTestId('login-password');
  }

  get submit(): Locator {
    return this.byTestId('login-submit');
  }

  get error(): Locator {
    return this.byTestId('login-error');
  }

  get usernameError(): Locator {
    return this.byTestId('login-username-error');
  }

  get passwordError(): Locator {
    return this.byTestId('login-password-error');
  }

  get passwordToggle(): Locator {
    return this.byTestId('login-password-toggle');
  }

  get capsLockNotice(): Locator {
    return this.byTestId('login-password-notice');
  }

  /** Peticiones `POST /v1/auth/login` enviadas desde esta página (CA-002, CA-014, CA-015: «no se envía ningún intento»). */
  get loginRequests(): number {
    return this.sent;
  }

  get sessionExpired(): Locator {
    return this.byTestId('login-session-expired');
  }

  get infoNote(): Locator {
    return this.byTestId('login-info-note');
  }

  get forgotToggle(): Locator {
    return this.byTestId('login-forgot-toggle');
  }

  get forgotPanel(): Locator {
    return this.byTestId('login-forgot-panel');
  }

  get forgotEmail(): Locator {
    return this.byTestId('login-forgot-email');
  }

  /** Emite una pulsación en la contraseña con Bloq Mayús activado o no (el navegador no deja conmutarlo; CA-005). */
  async pressKeyWithCapsLock(capsLockOn: boolean): Promise<void> {
    await this.password.focus();
    await this.password.evaluate((input, capsLock) => {
      for (const type of ['keydown', 'keyup']) {
        input.dispatchEvent(new KeyboardEvent(type, { key: 'a', bubbles: true, modifierCapsLock: capsLock }));
      }
    }, capsLockOn);
  }

  async fill(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
  }

  async logIn(username: string, password: string): Promise<void> {
    await this.fill(username, password);
    await this.submit.click();
  }

  /**
   * Envía el formulario y espera la respuesta de `POST /v1/auth/login` de ESE envío. Evita aserciones sobre un
   * aviso que ya estaba en pantalla del intento anterior (seguía montado hasta que llega la respuesta).
   */
  async logInAndWaitForResponse(username: string, password: string): Promise<Response> {
    await this.fill(username, password);
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) => candidate.request().method() === 'POST' && new URL(candidate.url()).pathname === '/v1/auth/login',
      ),
      this.submit.click(),
    ]);
    return response;
  }
}
