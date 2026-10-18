import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';

import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children' | 'size'> {
  /** Etiqueta visible y obligatoria: es el nombre accesible del campo. */
  label: string;
  /** Icono decorativo a la izquierda (se oculta a lectores de pantalla). */
  icon?: ReactNode;
  /** Elemento al final del control (p. ej. el conmutador de `PasswordField`). */
  endAdornment?: ReactNode;
  /** Texto de ayuda asociado con `aria-describedby`. */
  help?: string;
  /** Mensaje de error junto al campo: marca `aria-invalid` y se anuncia de forma cortés. */
  error?: string;
  /** Selector estable de pruebas; el mensaje de error recibe `<valor>-error`. */
  'data-testid'?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de texto accesible (RF-003): etiqueta visible, ayuda y error vinculados, icono decorativo. */
export function TextField({
  label,
  icon,
  endAdornment,
  help,
  error,
  id,
  className,
  type = 'text',
  'aria-describedby': describedByProp,
  'data-testid': testId,
  ref,
  ...rest
}: TextFieldProps) {
  const generatedId = useId();
  if (process.env.NODE_ENV !== 'production' && label.trim() === '') {
    throw new Error('TextField: la etiqueta (label) es obligatoria y no puede estar vacía.');
  }

  const inputId = id ?? generatedId;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [describedByProp, help ? helpId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  const controlClasses = [styles.control, error ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={styles.root}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={controlClasses}>
        {icon ? (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type={type}
          className={styles.input}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          data-testid={testId}
        />
        {endAdornment ? <span className={styles.end}>{endAdornment}</span> : null}
      </div>
      {help ? (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      ) : null}
      <div aria-live="polite">
        {error ? (
          <p id={errorId} className={styles.error} data-testid={testId ? `${testId}-error` : undefined}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
