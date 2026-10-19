'use client';

import { Alert, Button } from '@perchados/ui-web';
import { LogOut } from 'lucide-react';
import { useRef, useState } from 'react';

import { useApiClient } from '@/shared/api/api-config-provider';
import { readCsrfToken } from '@/shared/auth/csrf-token';
import { navigateToLogin } from '@/shared/auth/navigate-to-login';

import styles from './LogoutButton.module.css';

const REQUEST_TIMEOUT_MS = 10_000;
const UNAUTHENTICATED = 401;
const LOGOUT_ERROR = 'No pudimos cerrar la sesión. Inténtalo de nuevo';

/** Cierra la sesión (RF-012): `POST /v1/auth/logout` con `X-CSRF-Token`; 204 o 401 (idempotente) llevan al login. */
export function LogoutButton() {
  const client = useApiClient();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const logout = async () => {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const csrf = readCsrfToken();
      const { response } = await client.POST('/v1/auth/logout', {
        params: { header: csrf ? { 'X-CSRF-Token': csrf } : {} },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok || response.status === UNAUTHENTICATED) {
        navigateToLogin();
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    busy.current = false;
    setLoading(false);
  };

  return (
    <div className={styles.root}>
      <Button
        variant="secondary"
        loading={loading}
        loadingLabel="Cerrando sesión…"
        iconEnd={<LogOut size={18} aria-hidden="true" focusable="false" />}
        onClick={() => {
          void logout();
        }}
        data-testid="logout-button"
      >
        Cerrar sesión
      </Button>
      {failed ? (
        <Alert variant="error" data-testid="logout-error">
          {LOGOUT_ERROR}
        </Alert>
      ) : null}
    </div>
  );
}
