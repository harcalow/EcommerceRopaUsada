import type { AnchorHTMLAttributes, ComponentType, Ref } from 'react';

import { VisuallyHidden } from '../internal/VisuallyHidden';
import styles from './Link.module.css';

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  /** Destino fuera de la aplicación (`https:`, `mailto:`…): siempre un `<a>` nativo. */
  external?: boolean;
  /** Abre en una pestaña nueva con `rel` seguro y lo anuncia a lectores de pantalla. */
  newTab?: boolean;
  /** Componente para rutas internas (p. ej. `next/link`); evita acoplar `ui-web` a Next.js. Por defecto, `<a>`. */
  linkComponent?: ComponentType<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; ref?: Ref<HTMLAnchorElement> | undefined }>;
  /** Texto oculto anunciado cuando `newTab` es verdadero. */
  newTabLabel?: string;
  ref?: Ref<HTMLAnchorElement>;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Enlace del sistema de diseño (RF-007): subrayado siempre visible (no depende solo del color) y foco global visible. */
export function Link({
  href,
  external,
  newTab = false,
  linkComponent,
  newTabLabel = '(se abre en una pestaña nueva)',
  className,
  children,
  ref,
  ...rest
}: LinkProps) {
  const isExternal = external ?? (SCHEME.test(href) || href.startsWith('//'));
  const Component = !isExternal && linkComponent ? linkComponent : 'a';
  const classes = [styles.root, className ?? ''].filter(Boolean).join(' ');

  return (
    <Component
      {...rest}
      ref={ref}
      href={href}
      className={classes}
      target={newTab ? '_blank' : rest.target}
      rel={newTab ? 'noopener noreferrer' : rest.rel}
    >
      {children}
      {newTab ? (
        <>
          {' '}
          <VisuallyHidden>{newTabLabel}</VisuallyHidden>
        </>
      ) : null}
    </Component>
  );
}
