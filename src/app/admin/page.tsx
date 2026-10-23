import { notFound, redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { normalizeUiLocale } from '@/lib/i18n';
import { getCurrentAuth } from '@/server/auth';
import { isPlatformAdmin } from '@/server/auth/platform';
import { getAdminDashboard } from '@/server/services/admin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/login');
  if (!isPlatformAdmin(auth.user)) notFound();
  const data = await getAdminDashboard(auth.user.id);
  return <AdminDashboard initialData={data} actorId={auth.user.id} locale={normalizeUiLocale(auth.user.uiLocale)} />;
}
