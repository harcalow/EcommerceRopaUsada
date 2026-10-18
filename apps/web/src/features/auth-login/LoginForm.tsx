'use client';

import { Button, PasswordField, TextField } from '@perchados/ui-web';
import { ArrowRight, User } from 'lucide-react';

import { ForgotPasswordDisclosure } from './ForgotPasswordDisclosure';
import { LoginAlerts } from './LoginAlerts';
import styles from './LoginForm.module.css';
import { LOGIN_MESSAGES } from './login-messages';
import { useCapsLock } from './use-caps-lock';
import { useLoginForm } from './use-login-form';

/** Formulario de acceso del administrador: valida la forma, envía con el cliente y traduce los errores de la API. */
export interface LoginFormProps {
  /** Correo del responsable (RF-007); llega del servidor, nunca de una variable pública. */
  contactEmail: string;
  /** Llegó desde el panel con la sesión caducada (RF-020, CA-018). */
  sessionExpired?: boolean;
}

export function LoginForm({ contactEmail, sessionExpired = false }: LoginFormProps) {
  const caps = useCapsLock();
  const { username, password, fieldErrors, formError, submitting, bindUsername, bindPassword, onUsernameChange, onPasswordChange, onSubmit } =
    useLoginForm();

  return (
    <form noValidate className={styles.form} aria-label="Acceso de administrador" onSubmit={onSubmit} data-testid="login-form">
      <TextField
        ref={bindUsername}
        label="Nombre de usuario"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        icon={<User size={20} aria-hidden="true" focusable="false" />}
        value={username}
        onChange={onUsernameChange}
        {...(fieldErrors.username ? { error: fieldErrors.username } : {})}
        data-testid="login-username"
      />
      <PasswordField
        ref={bindPassword}
        label="Contraseña"
        name="password"
        value={password}
        onChange={onPasswordChange}
        onKeyDown={caps.onKeyDown}
        onKeyUp={caps.onKeyUp}
        onBlur={caps.onBlur}
        {...(caps.capsLockOn ? { notice: LOGIN_MESSAGES.capsLock } : {})}
        {...(fieldErrors.password ? { error: fieldErrors.password } : {})}
        data-testid="login-password"
      />
      <ForgotPasswordDisclosure contactEmail={contactEmail} />
      <LoginAlerts formError={formError} sessionExpired={sessionExpired} />
      <Button
        type="submit"
        fullWidth
        loading={submitting}
        loadingLabel="Verificando tus datos…"
        iconEnd={<ArrowRight size={20} aria-hidden="true" focusable="false" />}
        data-testid="login-submit"
      >
        Entrar al panel
      </Button>
    </form>
  );
}
