import { Sparkles } from 'lucide-react';

import styles from './ComingSoon.module.css';

/** Contenido provisional del panel (CA-001): el único `h1` de la página. */
export function ComingSoon() {
  return (
    <section className={styles.root} data-testid="panel-coming-soon">
      <Sparkles aria-hidden="true" size={32} className={styles.icon} />
      <h1 className={styles.title}>Próximamente, estamos trabajando</h1>
      <p className={styles.lead}>El panel de administración estará disponible muy pronto.</p>
    </section>
  );
}
