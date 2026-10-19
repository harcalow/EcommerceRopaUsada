import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { LogoutButton } from '@/features/admin-panel/LogoutButton';
import { SessionWatcher } from '@/features/admin-panel/SessionWatcher';
import { requireAdminSession } from '@/shared/auth/require-admin-session';

import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Panel' };

export default async function PanelLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAdminSession();
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <p className={styles.brand}>
          perchados<span className={styles.dot}>.</span>
        </p>
        <LogoutButton />
      </header>
      <main className={styles.main}>{children}</main>
      <SessionWatcher />
    </div>
  );
}
