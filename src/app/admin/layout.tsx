import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { LogoutButton } from '@/components/app/LogoutButton';
import { normalizeUiLocale } from '@/lib/i18n';
import { getActiveWorkspace, getCurrentAuth } from '@/server/auth';
import { isPlatformAdmin } from '@/server/auth/platform';

export const metadata = { title: 'Administration plateforme' };
export const dynamic = 'force-dynamic';

const nav = {
  fr: { label: 'Console plateforme', navigation: 'Administration plateforme', overview: 'Vue globale', users: 'Utilisateurs', workspaces: 'Espaces', projects: 'Projets', offers: 'Offres', audit: 'Audit', dashboard: 'Retour à mes projets', skip: 'Aller au contenu' },
  en: { label: 'Platform console', navigation: 'Platform administration', overview: 'Overview', users: 'Users', workspaces: 'Workspaces', projects: 'Projects', offers: 'Plans', audit: 'Audit', dashboard: 'Back to my projects', skip: 'Skip to content' },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/login');
  if (!isPlatformAdmin(auth.user)) notFound();
  const locale = normalizeUiLocale(auth.user.uiLocale);
  const dict = nav[locale];
  const workspace = await getActiveWorkspace(auth.user.id);
  return <div className="admin-layout" lang={locale}>
    <a className="admin-skip-link" href="#admin-main">{dict.skip}</a>
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand"><Logo href="/admin" inverse /><span>{dict.label}</span></div>
      <nav aria-label={dict.navigation}><a href="/admin#overview"><span aria-hidden="true">▦</span>{dict.overview}</a><a href="/admin#users"><span aria-hidden="true">♙</span>{dict.users}</a><a href="/admin#workspaces"><span aria-hidden="true">▣</span>{dict.workspaces}</a><a href="/admin#projects"><span aria-hidden="true">◫</span>{dict.projects}</a><a href="/admin#offers"><span aria-hidden="true">◇</span>{dict.offers}</a><a href="/admin#audit"><span aria-hidden="true">≡</span>{dict.audit}</a></nav>
      <div className="admin-sidebar-bottom">{workspace && <Link href="/dashboard">← {dict.dashboard}</Link>}<div className="admin-identity"><span>{auth.user.name.slice(0, 1).toUpperCase()}</span><div><strong>{auth.user.name}</strong><small>{auth.user.email}</small></div><LogoutButton locale={locale} /></div></div>
    </aside>
    <main className="admin-main" id="admin-main">{children}</main>
  </div>;
}
