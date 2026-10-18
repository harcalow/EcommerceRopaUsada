import type { Locator, Page } from '@playwright/test';

/**
 * Base de los Page Objects: navegación y registro de problemas del navegador
 * (errores de consola, excepciones y violaciones de la CSP, que Chromium emite como errores de consola).
 */
export abstract class BasePage {
  /** Ruta de la página, relativa al `baseURL`. */
  abstract readonly path: string;

  private readonly collected: string[] = [];

  constructor(readonly page: Page) {
    page.on('console', (message) => {
      if (message.type() === 'error') {
        this.collected.push(`console: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      this.collected.push(`pageerror: ${error.message}`);
    });
  }

  /** Errores de consola y excepciones vistos hasta ahora. */
  get problems(): readonly string[] {
    return [...this.collected];
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }

  protected byTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }
}
