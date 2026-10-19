import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

import { VisuallyHidden } from '../internal/VisuallyHidden';
import styles from './Alert.module.css';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'title'> {
  variant: AlertVariant;
  /** Título visible opcional, en negrita sobre el contenido. */
  title?: string;
  children: ReactNode;
  /** Selector estable de pruebas. */
  'data-testid'?: string;
}

/** Prefijo de texto oculto por variante: el significado no depende solo del color ni del icono. */
const PREFIX: Record<AlertVariant, string> = {
  info: 'Información: ',
  success: 'Éxito: ',
  warning: 'Aviso: ',
  error: 'Error: ',
};

/** Los errores y avisos interrumpen (`alert`); la información y el éxito se anuncian con cortesía (`status`). */
const ROLE: Record<AlertVariant, 'alert' | 'status'> = {
  info: 'status',
  success: 'status',
  warning: 'alert',
  error: 'alert',
};

const ICONS: Record<AlertVariant, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

function AlertIcon({ variant }: { variant: AlertVariant }) {
  const Icon = ICONS[variant];
  return <Icon className={styles.icon} size={20} aria-hidden="true" focusable="false" />;
}

/**
 * Mensaje de estado del sistema de diseño (RF-004, RF-008, RF-020): `error` y `warning` usan `role="alert"`;
 * `info` y `success`, `role="status"`. El icono es decorativo y un prefijo oculto transmite la variante.
 */
export function Alert({ variant, title, children, className, ...rest }: AlertProps) {
  const classes = [styles.root, styles[variant], className ?? ''].filter(Boolean).join(' ');

  return (
    <div {...rest} role={ROLE[variant]} className={classes}>
      <AlertIcon variant={variant} />
      <div className={styles.body}>
        {title ? <p className={styles.title}>{title}</p> : null}
        <div className={styles.message}>
          <VisuallyHidden>{PREFIX[variant]}</VisuallyHidden>
          {children}
        </div>
      </div>
    </div>
  );
}
