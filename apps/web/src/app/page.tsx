import { redirect } from 'next/navigation';

import { PANEL_PATH } from '@/shared/auth/auth-constants';

/** Todavía no hay tienda pública: la raíz lleva al panel (el proxy y `requireAdminSession` deciden el resto). */
export default function HomePage() {
  redirect(PANEL_PATH);
}
