import { Info, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { BrandShowcase } from './BrandShowcase';
import styles from './LoginShell.module.css';

export interface LoginShellProps {
  /** Zona del formulario (`LoginForm`, T-36), entre el encabezado y el pie informativo. */
  children?: ReactNode;
}

/** Composición de la pantalla de login: formulario primero en el DOM, panel de marca detrás (mobile-first). */
export function LoginShell({ children }: LoginShellProps) {
  return (
    <div className={styles.root} data-testid="login-screen">
      <main className={styles.main}>
        <div className={styles.content}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>
              <ShieldCheck aria-hidden="true" size={18} />
              <span>Acceso de administrador</span>
            </p>
            <h1 className={styles.title}>Hola de nuevo</h1>
            <p className={styles.lead}>Inicia sesión con tu usuario y contraseña de administrador.</p>
          </header>

          {children}

          <p className={styles.note} data-testid="login-info-note">
            <Info aria-hidden="true" size={20} className={styles.noteIcon} />
            <span>
              Esta pantalla solo permite iniciar sesión. Las cuentas de administrador se crean fuera del panel y no
              hay registro público.
            </span>
          </p>
        </div>
      </main>
      <BrandShowcase />
    </div>
  );
}
