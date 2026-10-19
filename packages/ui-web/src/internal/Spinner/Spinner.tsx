import type { SVGAttributes } from 'react';

import styles from './Spinner.module.css';

export type SpinnerProps = Omit<SVGAttributes<SVGSVGElement>, 'children' | 'aria-hidden'>;

/**
 * Indicador de carga decorativo (`aria-hidden`): hereda el color del texto (`currentColor`).
 * El anuncio del estado lo da quien lo usa con una región `role="status"` (p. ej. Button).
 */
export function Spinner({ className, ...rest }: SpinnerProps) {
  const classes = className ? `${styles.root ?? ''} ${className}` : (styles.root ?? '');
  return (
    <svg {...rest} className={classes} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
