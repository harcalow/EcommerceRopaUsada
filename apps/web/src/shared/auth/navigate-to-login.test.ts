// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { navigateToLogin } from './navigate-to-login';

afterEach(() => vi.unstubAllGlobals());

describe('navigateToLogin', () => {
  it('reemplaza la entrada del historial por /login', () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { replace });
    navigateToLogin();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('con sesión caducada añade el motivo', () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { replace });
    navigateToLogin({ sessionExpired: true });
    expect(replace).toHaveBeenCalledWith('/login?motivo=sesion-caducada');
  });
});
