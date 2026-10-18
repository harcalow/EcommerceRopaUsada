import type { Reporter, TestCase } from '@playwright/test/reporter';

/** Resumen de las pruebas inestables (pasaron solo al reintentar; RT-019). Vacío si no hay ninguna. */
export function formatFlakySummary(titles: readonly string[]): string {
  if (titles.length === 0) {
    return '';
  }
  const lines = titles.map((title) => `  - inestable: ${title}`);
  return [`Pruebas inestables (${String(titles.length)}): abrir una tarea para corregirlas`, ...lines].join('\n');
}

/** Reporter que imprime las pruebas inestables al final de la ejecución. */
export default class FlakySummaryReporter implements Reporter {
  private readonly flaky: string[] = [];

  onTestEnd(test: TestCase): void {
    if (test.outcome() === 'flaky' && !this.flaky.includes(test.title)) {
      this.flaky.push(test.title);
    }
  }

  onEnd(): void {
    const summary = formatFlakySummary(this.flaky);
    if (summary !== '') {
      process.stdout.write(`\n${summary}\n`);
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}
