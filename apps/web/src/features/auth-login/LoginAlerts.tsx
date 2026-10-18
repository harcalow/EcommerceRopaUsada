import { Alert } from '@perchados/ui-web';

import styles from './LoginForm.module.css';
import { LOGIN_MESSAGES } from './login-messages';

export interface LoginAlertsProps {
  formError: string | null;
  sessionExpired: boolean;
}

/** Avisos del formulario: sesión caducada (CA-018) y error de la última petición. */
export function LoginAlerts({ formError, sessionExpired }: LoginAlertsProps) {
  if (!formError && !sessionExpired) {
    return null;
  }
  return (
    <div className={styles.alerts}>
      {sessionExpired ? (
        <Alert variant="warning" data-testid="login-session-expired">
          {LOGIN_MESSAGES.sessionExpired}
        </Alert>
      ) : null}
      {formError ? (
        <Alert variant="error" data-testid="login-error">
          {formError}
        </Alert>
      ) : null}
    </div>
  );
}
