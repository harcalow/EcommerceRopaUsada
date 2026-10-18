'use client';

import { PROBLEM_TYPES } from '@perchados/contracts/client';
import { useEffect } from 'react';

import { useApiClient } from '@/shared/api/api-config-provider';
import { ADMIN_ROLE } from '@/shared/auth/auth-constants';
import { navigateToLogin } from '@/shared/auth/navigate-to-login';

const UNAUTHENTICATED = 401;

/**
 * Revalida la sesión al volver a la pestaña (`visibilitychange`) y al restaurar la página desde la
 * caché de ida y vuelta (`pageshow`), para que «Atrás» tras cerrar sesión no muestre el panel
 * (CA-011, CB-012, CB-017, CB-018). No pinta nada.
 */
export function SessionWatcher() {
  const client = useApiClient();

  useEffect(() => {
    let active = true;

    const revalidate = async () => {
      try {
        const { data, error, response } = await client.GET('/v1/auth/session', { cache: 'no-store' });
        if (!active) {
          return;
        }
        if (response.status === UNAUTHENTICATED) {
          navigateToLogin({ sessionExpired: error?.type === PROBLEM_TYPES.sessionExpired });
        } else if (response.ok && data?.role !== ADMIN_ROLE) {
          navigateToLogin();
        }
      } catch {
        // Sin conexión: no se puede saber; la API rechazará la siguiente acción si la sesión no vale
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void revalidate();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void revalidate();
      }
    };

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [client]);

  return null;
}
