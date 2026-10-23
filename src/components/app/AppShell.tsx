import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { getDictionary, normalizeUiLocale } from '@/lib/i18n';
import { LogoutButton } from './LogoutButton';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import type { User, Workspace } from '@/server/db/schema';
import { isPlatformAdmin } from '@/server/auth/platform';

export function AppShell({ user, workspaces, activeWorkspaceId, children }: { user: User; workspaces: Workspace[]; activeWorkspaceId: string; children: React.ReactNode }) {
  const locale = normalizeUiLocale(user.uiLocale);
  const dict = getDictionary(locale);
  return <div className="app-layout" lang={locale}><aside className="app-sidebar"><div className="app-sidebar-logo"><Logo href="/dashboard" /></div><WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} locale={locale} /><nav className="app-nav" aria-label={dict.nav.workspaceAria}><Link href="/dashboard"><span aria-hidden="true">▦</span>{dict.nav.overview}</Link><Link href="/dashboard#projects"><span aria-hidden="true">◫</span>{dict.nav.projects}</Link><Link href="/dashboard/billing"><span aria-hidden="true">◈</span>{dict.nav.billing}</Link><Link href="/dashboard/settings"><span aria-hidden="true">⚙</span>{dict.nav.settings}</Link>{isPlatformAdmin(user) && <Link href="/admin" className="admin-nav-link"><span aria-hidden="true">✦</span>{dict.nav.admin}</Link>}</nav><div className="sidebar-spacer" /><div className="sidebar-help"><span>✦</span><strong>{dict.nav.helpTitle}</strong><p>{dict.nav.helpBody}</p></div><div className="sidebar-user"><span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><LogoutButton locale={locale} /></div></aside><main className="app-main">{children}</main></div>;
}
