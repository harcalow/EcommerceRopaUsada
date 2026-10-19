import type { Locator } from '@playwright/test';

import { BasePage } from './BasePage';

/** Pantalla `/panel` (zona protegida). */
export class PanelPage extends BasePage {
  readonly path = '/panel';

  get comingSoon(): Locator {
    return this.byTestId('panel-coming-soon');
  }

  get logout(): Locator {
    return this.byTestId('logout-button');
  }

  get logoutError(): Locator {
    return this.byTestId('logout-error');
  }

  /** Simula volver a la pestaña: el `SessionWatcher` revalida la sesión (CB-017, CB-018). */
  async returnToTab(): Promise<void> {
    await this.page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  async logOut(): Promise<void> {
    await this.logout.click();
  }
}
