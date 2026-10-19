import { Eye, EyeOff, Lock } from 'lucide-react';
import { useId, useState } from 'react';

import { TextField } from '../TextField';
import type { TextFieldProps } from '../TextField';
import { VisuallyHidden } from '../internal/VisuallyHidden';
import styles from './PasswordField.module.css';

export interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'endAdornment'> {
  /** Aviso no bloqueante bajo el campo (p. ej. «Bloq Mayús está activado»): región cortés asociada al campo. */
  notice?: string;
}

/**
 * Campo de contraseña accesible (RF-005, RF-006): oculto por defecto, conmutador «Mostrar/Ocultar contraseña»
 * que no mueve el foco ni envía el formulario, y `notice` anunciado. No bloquea pegar ni el autocompletado.
 */
export function PasswordField({
  notice,
  autoComplete = 'current-password',
  icon,
  id,
  'aria-describedby': describedByProp,
  'data-testid': testId,
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const ToggleIcon = visible ? EyeOff : Eye;
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noticeId = `${inputId}-notice`;
  const describedBy = [describedByProp, notice ? noticeId : undefined].filter(Boolean).join(' ') || undefined;

  const toggle = () => {
    setAnnouncement(visible ? 'Contraseña oculta' : 'Contraseña visible');
    setVisible(!visible);
  };

  return (
    <div className={styles.root}>
      <TextField
        {...rest}
        id={inputId}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        icon={icon ?? <Lock size={20} aria-hidden="true" focusable="false" />}
        aria-describedby={describedBy}
        {...(testId ? { 'data-testid': testId } : {})}
        endAdornment={
          <button
            type="button"
            className={styles.toggle}
            onClick={toggle}
            data-testid={testId ? `${testId}-toggle` : undefined}
          >
            <span aria-hidden="true">
              <ToggleIcon size={20} aria-hidden="true" focusable="false" />
            </span>
            <VisuallyHidden>{visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}</VisuallyHidden>
          </button>
        }
      />
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
      <div aria-live="polite">
        {notice ? (
          <p id={noticeId} className={styles.notice} data-testid={testId ? `${testId}-notice` : undefined}>
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
