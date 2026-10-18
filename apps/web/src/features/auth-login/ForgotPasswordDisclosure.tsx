'use client';

import { Alert, Link } from '@perchados/ui-web';
import { useId, useState } from 'react';

import styles from './ForgotPasswordDisclosure.module.css';
import { LOGIN_MESSAGES } from './login-messages';

export interface ForgotPasswordDisclosureProps {
  /** Correo del responsable de la tienda (`ADMIN_CONTACT_EMAIL`), leído en el servidor (RF-007). */
  contactEmail: string;
}

/** «¿Olvidaste tu contraseña?»: no recupera nada, solo indica a quién escribir (RF-007, CA-006). */
export function ForgotPasswordDisclosure({ contactEmail }: ForgotPasswordDisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        data-testid="login-forgot-toggle"
      >
        {LOGIN_MESSAGES.forgotPassword}
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        {open ? (
          <Alert variant="info" data-testid="login-forgot-panel">
            {LOGIN_MESSAGES.forgotPasswordContact}{' '}
            <Link href={`mailto:${contactEmail}`} data-testid="login-forgot-email">
              {contactEmail}
            </Link>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
