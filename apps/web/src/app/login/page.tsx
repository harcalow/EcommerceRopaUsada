import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/features/auth-login/LoginForm';
import { LoginShell } from '@/features/auth-login/LoginShell';
import { ADMIN_ROLE, PANEL_PATH } from '@/shared/auth/auth-constants';
import { getSession } from '@/shared/auth/get-session';
import { SESSION_EXPIRED_REASON } from '@/shared/auth/login-paths';
import { getServerEnv } from '@/shared/config/server-env';

export const metadata: Metadata = { title: 'Iniciar sesión' };

/** Ruta fina: un administrador con sesión vigente va directo al panel (CB-011); si no, se muestra el login. */
export default async function LoginPage({ searchParams }: Readonly<{ searchParams: Promise<{ motivo?: string | string[] }> }>) {
  const session = await getSession();
  if (session?.role === ADMIN_ROLE) {
    redirect(PANEL_PATH);
  }
  const { motivo } = await searchParams;
  return (
    <LoginShell>
      <LoginForm contactEmail={getServerEnv().adminContactEmail} sessionExpired={motivo === SESSION_EXPIRED_REASON} />
    </LoginShell>
  );
}
