import { redirect } from 'next/navigation';
import { getActiveWorkspace, getCurrentAuth, getUserWorkspaces } from '@/server/auth';
import { AppShell } from '@/components/app/AppShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/login');
  const [workspaces, activeWorkspace] = await Promise.all([getUserWorkspaces(auth.user.id), getActiveWorkspace(auth.user.id)]);
  if (!workspaces.length || !activeWorkspace) redirect('/login');
  return <AppShell user={auth.user} workspaces={workspaces} activeWorkspaceId={activeWorkspace.id}>{children}</AppShell>;
}
