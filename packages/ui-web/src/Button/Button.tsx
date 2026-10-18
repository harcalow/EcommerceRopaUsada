import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';

import { Spinner } from '../internal/Spinner';
import { VisuallyHidden } from '../internal/VisuallyHidden';
import styles from './Button.module.css';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: 'primary' | 'secondary';
  /** En carga el botón sigue enfocable, pero no dispara `onClick` ni el envío del formulario. */
  loading?: boolean;
  /** Icono decorativo al final del texto (se oculta a lectores de pantalla). */
  iconEnd?: ReactNode;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  /** Texto anunciado mientras `loading` es verdadero. */
  loadingLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}

/** Botón nativo del sistema de diseño (RF-014): variantes, carga que evita envíos repetidos y foco visible. */
export function Button({
  variant = 'primary',
  loading = false,
  iconEnd,
  fullWidth = false,
  type = 'button',
  loadingLabel = 'Cargando…',
  className,
  children,
  onClick,
  disabled,
  ref,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const classes = [styles.root, styles[variant], fullWidth ? styles.fullWidth : '', loading ? styles.loading : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <button
        {...rest}
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled}
        aria-disabled={loading ? 'true' : undefined}
        aria-busy={loading ? 'true' : undefined}
        onClick={handleClick}
      >
        <span className={styles.content}>
          {children}
          {iconEnd ? (
            <span className={styles.icon} aria-hidden="true">
              {iconEnd}
            </span>
          ) : null}
        </span>
        {loading ? <Spinner className={styles.spinner} /> : null}
      </button>
      <VisuallyHidden role="status">{loading ? loadingLabel : ''}</VisuallyHidden>
    </>
  );
}
