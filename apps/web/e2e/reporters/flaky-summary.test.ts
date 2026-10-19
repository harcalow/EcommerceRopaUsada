import type { TestCase } from '@playwright/test/reporter';
import { describe, expect, it, vi } from 'vitest';

import FlakySummaryReporter, { formatFlakySummary } from './flaky-summary';

function fakeTest(title: string, outcome: ReturnType<TestCase['outcome']>): TestCase {
  return { title, outcome: () => outcome } as unknown as TestCase;
}

describe('formatFlakySummary', () => {
  it('no devuelve nada si no hay pruebas inestables', () => {
    expect(formatFlakySummary([])).toBe('');
  });

  it('marca como inestable cada prueba con su ID', () => {
    const summary = formatFlakySummary(['CA-001 entra al panel', 'CB-002 usuario con mayúsculas']);
    expect(summary).toContain('Pruebas inestables (2)');
    expect(summary).toContain('inestable: CA-001 entra al panel');
    expect(summary).toContain('inestable: CB-002 usuario con mayúsculas');
  });
});

describe('FlakySummaryReporter', () => {
  it('imprime solo las pruebas cuyo resultado es flaky', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const reporter = new FlakySummaryReporter();
    reporter.onTestEnd(fakeTest('CA-003 estable', 'expected'));
    reporter.onTestEnd(fakeTest('CA-004 intermitente', 'flaky'));
    reporter.onEnd();

    const output = write.mock.calls.map(([chunk]) => String(chunk)).join('');
    write.mockRestore();
    expect(output).toContain('inestable: CA-004 intermitente');
    expect(output).not.toContain('CA-003');
  });

  it('no imprime nada si ninguna prueba es inestable', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const reporter = new FlakySummaryReporter();
    reporter.onTestEnd(fakeTest('CA-003 estable', 'expected'));
    reporter.onEnd();
    const calls = write.mock.calls.length;
    write.mockRestore();
    expect(calls).toBe(0);
  });
});
