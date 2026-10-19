import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** Etiquetas WCAG 2.2 AA que el diseño exige (RNF Accesibilidad). */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

export interface AxeViolationSummary {
  readonly rule: string;
  readonly impact: string | null | undefined;
  readonly targets: readonly string[];
}

/** Analiza la página con axe y devuelve las violaciones resumidas (vacío = cumple). */
export async function scanWcag(page: Page): Promise<AxeViolationSummary[]> {
  const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target.join(' ')),
  }));
}
