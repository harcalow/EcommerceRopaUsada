import type { HTMLAttributes } from 'react';

import styles from './VisuallyHidden.module.css';

export type VisuallyHiddenProps = HTMLAttributes<HTMLSpanElement>;

/**
 * Texto accesible que no se ve (prefijos de alertas, anuncios de estado, etiquetas de iconos).
 * Admite `role`, `aria-live`, `id` y `data-testid` para componer regiones de estado.
 */
export function VisuallyHidden({ className, ...rest }: VisuallyHiddenProps) {
  const classes = className ? `${styles.root ?? ''} ${className}` : (styles.root ?? '');
  return <span {...rest} className={classes} />;
}
