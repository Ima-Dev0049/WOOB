import { getActiveWorkspace, getCurrentAuth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { ProfileSettings } from '@/components/app/ProfileSettings';
import { getUsageSummary } from '@/server/services/quotas';
import { listMembers } from '@/server/services/members';
import { WorkspaceMembers } from '@/components/app/WorkspaceMembers';
import { getDictionary, normalizeUiLocale, uiLocaleTag } from '@/lib/i18n';

export const metadata = { title: 'Paramètres' };
export default async function SettingsPage() {
  const auth = await getCurrentAuth(); if (!auth) redirect('/login');
  const workspace = await getActiveWorkspace(auth.user.id); if (!workspace) redirect('/login');
  const locale = normalizeUiLocale(auth.user.uiLocale);
  const dict = getDictionary(locale);
  const numberLocale = uiLocaleTag(locale);
  const [usage, directory] = await Promise.all([getUsageSummary(workspace.id), listMembers(auth.user.id, workspace.id)]);
  const actorRole = directory.members.find((member) => member.userId === auth.user.id)?.role || 'viewer';
  return <div className="settings-page"><header className="app-page-header"><div><span className="eyebrow">{dict.settings.eyebrow}</span><h1>{dict.settings.title}</h1><p>{dict.settings.subtitle}</p></div></header><ProfileSettings user={auth.user} /><WorkspaceMembers workspaceId={workspace.id} ownerId={directory.ownerId} actorId={auth.user.id} actorRole={actorRole} members={directory.members} locale={locale} /><section className="settings-card"><header><h2>{dict.settings.usageTitle}</h2><p>{dict.settings.usageSubtitle}</p></header><div className="usage-list"><div><span>{dict.settings.currentPlan}</span><strong>{usage.plan.name}</strong></div><div><span>{dict.settings.projects}</span><strong>{usage.projects.used} / {Number.isFinite(usage.projects.limit) ? usage.projects.limit : '∞'}</strong></div><div><span>{dict.settings.storage}</span><strong>{(usage.storage.used / 1048576).toFixed(1)} {dict.dashboard.megabyte} / {(usage.storage.limit / 1048576).toLocaleString(numberLocale, { maximumFractionDigits: 0 })} {dict.dashboard.megabyte}</strong></div><div><span>{dict.settings.aiThisMonth}</span><strong>{usage.ai.used} / {usage.ai.limit}</strong></div></div></section></div>;
}
