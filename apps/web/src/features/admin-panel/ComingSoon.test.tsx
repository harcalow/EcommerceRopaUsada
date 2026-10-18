// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { expectNoA11yViolations } from '../../../test/a11y';

import { ComingSoon } from './ComingSoon';

afterEach(cleanup);

describe('ComingSoon', () => {
  it('muestra el mensaje con un único h1 (CA-001)', async () => {
    const { container } = render(
      <main>
        <ComingSoon />
      </main>,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Próximamente, estamos trabajando' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});
