// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../../test/a11y';

const requireAdminSession = vi.fn<() => Promise<unknown>>();
vi.mock('@/shared/auth/require-admin-session', () => ({ requireAdminSession: () => requireAdminSession() }));
vi.mock('@/features/admin-panel/LogoutButton', () => ({
  LogoutButton: () => <button type="button">Cerrar sesión</button>,
}));
vi.mock('@/features/admin-panel/SessionWatcher', () => ({ SessionWatcher: () => null }));

import PanelLayout, { dynamic, metadata } from './layout';
import PanelPage from './page';

beforeEach(() => {
  requireAdminSession.mockReset();
});
afterEach(cleanup);

describe('/panel', () => {
  it('con sesión admin muestra cabecera, cierre de sesión y el mensaje (CA-001)', async () => {
    requireAdminSession.mockResolvedValue({ role: 'admin', expiresAt: 'x' });
    const layout = await PanelLayout({ children: await PanelPage() });
    const { container } = render(layout);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Próximamente, estamos trabajando' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(dynamic).toBe('force-dynamic');
    expect(metadata.title).toBe('Panel');
    await expectNoA11yViolations(container);
  });

  it('el layout y la página redirigen al login sin sesión de administrador (CA-010)', async () => {
    requireAdminSession.mockRejectedValue(new Error('NEXT_REDIRECT:/login'));
    await expect(PanelLayout({ children: null })).rejects.toThrow('NEXT_REDIRECT:/login');
    await expect(PanelPage()).rejects.toThrow('NEXT_REDIRECT:/login');
  });
});
