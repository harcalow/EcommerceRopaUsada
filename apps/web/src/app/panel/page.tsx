import { ComingSoon } from '@/features/admin-panel/ComingSoon';
import { requireAdminSession } from '@/shared/auth/require-admin-session';

export default async function PanelPage() {
  await requireAdminSession();
  return <ComingSoon />;
}
