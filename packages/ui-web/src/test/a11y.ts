import { axe } from 'vitest-axe';
import { expect } from 'vitest';

/** Falla con la lista de violaciones de axe-core (WCAG 2.2 AA) si el elemento no es accesible. */
export async function expectNoA11yViolations(element: Element): Promise<void> {
  const results = await axe(element, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
