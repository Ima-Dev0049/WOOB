'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { normalizeUiLocale, uiLocaleTag, type UiLocale } from '@/lib/i18n';
import type { AdminDashboardData } from '@/server/services/admin';

const copy = {
  fr: {
    eyebrow: 'Contrôle plateforme', title: 'Administration Woob', subtitle: 'Une vue globale et des actions réelles sur les comptes, espaces, projets et offres.',
    refresh: 'Actualiser les données', refreshing: 'Actualisation…', generated: 'Données SQL actualisées le', search: 'Rechercher un compte, un espace ou un projet', searchPlaceholder: 'Nom, email ou identifiant…',
    users: 'Utilisateurs', workspaces: 'Espaces de travail', projects: 'Projets', orders: 'Commandes', active: 'actifs', published: 'publiés', suspended: 'suspendus', draft: 'brouillon', namedAdmins: 'administrateurs nommés', persistedRoles: 'rôles persistés', unpaidWarning: 'Valeur des commandes, pas chiffre d’affaires encaissé.',
    activity: 'Activité sur 14 jours', activitySubtitle: 'Créations de comptes et de projets, jours sans activité inclus.', signups: 'Inscriptions', projectCreations: 'Projets créés',
    operations: 'Activité et ressources', pages: 'Pages', reservations: 'Réservations', leads: 'Prospects', ai: 'Générations IA', storage: 'Stockage', domains: 'Domaines', dnsVerified: 'DNS vérifiés',
    orderValues: 'Valeurs par devise', markedPaid: 'marquées payées', notPaid: 'non payées', noOrders: 'Aucune commande enregistrée.', paymentTruth: 'Ces montants décrivent les commandes et leurs statuts. Ils ne prouvent aucun encaissement bancaire ou Stripe.',
    userRegistry: 'Comptes utilisateurs', workspaceRegistry: 'Espaces et abonnements', projectRegistry: 'Modération des projets', latest100: '100 entrées les plus récentes · les compteurs ci-dessus restent globaux.',
    account: 'Compte', state: 'État', access: 'Accès plateforme', joined: 'Inscription', actions: 'Actions', owner: 'Propriétaire', plan: 'Offre', updated: 'Dernière modification', site: 'Projet', workspace: 'Espace',
    admin: 'Admin plateforme', userRole: 'Utilisateur', workspaceCount: 'espaces', projectCount: 'projets', externalSubscription: 'Abonnement externe : changement manuel bloqué.', noPlan: 'Aucune offre', applyPlan: 'Appliquer l’offre', planFor: 'Offre de', confirmPlan: 'Attribuer manuellement cette offre ? Aucun paiement ne sera créé et les quotas de la nouvelle offre s’appliqueront.',
    suspend: 'Suspendre', reactivate: 'Réactiver', makeAdmin: 'Nommer administrateur', removeAdmin: 'Retirer le rôle admin', yourAccount: 'Votre compte',
    confirmUserSuspend: 'Suspendre ce compte ? Toutes ses sessions seront révoquées et il ne pourra plus se connecter.', confirmUserReactivate: 'Réactiver ce compte ? Il pourra de nouveau se connecter.',
    confirmWorkspaceSuspend: 'Suspendre cet espace ? Ses membres perdront l’accès et ses sites publics seront bloqués.', confirmWorkspaceReactivate: 'Réactiver cet espace et ses accès membres ?',
    confirmProjectSuspend: 'Suspendre ce projet ? Son back-office et son site public seront bloqués.', confirmProjectReactivate: 'Réactiver ce projet ? Son état publié sera restauré seulement si une publication active existe.',
    confirmMakeAdmin: 'Donner à ce compte le contrôle complet de la plateforme ?', confirmRemoveAdmin: 'Retirer le rôle administrateur persisté de ce compte ? Une allowlist de sécurité peut encore lui donner accès.',
    saved: 'Modification enregistrée et journalisée.', offers: 'Offres et répartition', offersSubtitle: 'Abonnements actifs par offre. Les changements manuels ne créent aucune transaction.', subscribers: 'abonnés', free: 'Gratuit', perMonth: '/ mois', custom: 'Sur devis',
    audit: 'Journal d’audit', auditSubtitle: '50 dernières actions d’administration, avec acteur, cible et horodatage.', actor: 'Acteur', action: 'Action', target: 'Cible', date: 'Date', details: 'Détails', empty: 'Aucune entrée.', noResult: 'Aucun résultat pour cette recherche.',
  },
  en: {
    eyebrow: 'Platform control', title: 'Woob administration', subtitle: 'A global view and real actions across accounts, workspaces, projects and plans.',
    refresh: 'Refresh data', refreshing: 'Refreshing…', generated: 'SQL data refreshed on', search: 'Search an account, workspace or project', searchPlaceholder: 'Name, email or identifier…',
    users: 'Users', workspaces: 'Workspaces', projects: 'Projects', orders: 'Orders', active: 'active', published: 'published', suspended: 'suspended', draft: 'draft', namedAdmins: 'named administrators', persistedRoles: 'persisted roles', unpaidWarning: 'Order value, not collected revenue.',
    activity: '14-day activity', activitySubtitle: 'Account and project creations, including days without activity.', signups: 'Sign-ups', projectCreations: 'Projects created',
    operations: 'Activity and resources', pages: 'Pages', reservations: 'Reservations', leads: 'Leads', ai: 'AI generations', storage: 'Storage', domains: 'Domains', dnsVerified: 'DNS verified',
    orderValues: 'Values by currency', markedPaid: 'marked paid', notPaid: 'unpaid', noOrders: 'No orders recorded.', paymentTruth: 'These amounts describe orders and their statuses. They do not prove any bank or Stripe collection.',
    userRegistry: 'User accounts', workspaceRegistry: 'Workspaces and subscriptions', projectRegistry: 'Project moderation', latest100: '100 most recent entries · counters above remain global.',
    account: 'Account', state: 'Status', access: 'Platform access', joined: 'Joined', actions: 'Actions', owner: 'Owner', plan: 'Plan', updated: 'Last updated', site: 'Project', workspace: 'Workspace',
    admin: 'Platform admin', userRole: 'User', workspaceCount: 'workspaces', projectCount: 'projects', externalSubscription: 'External subscription: manual change blocked.', noPlan: 'No plan', applyPlan: 'Apply plan', planFor: 'Plan for', confirmPlan: 'Assign this plan manually? No payment will be created and the new plan quotas will apply.',
    suspend: 'Suspend', reactivate: 'Reactivate', makeAdmin: 'Make administrator', removeAdmin: 'Remove admin role', yourAccount: 'Your account',
    confirmUserSuspend: 'Suspend this account? All sessions will be revoked and the user will no longer be able to sign in.', confirmUserReactivate: 'Reactivate this account? The user will be able to sign in again.',
    confirmWorkspaceSuspend: 'Suspend this workspace? Members will lose access and its public sites will be blocked.', confirmWorkspaceReactivate: 'Reactivate this workspace and member access?',
    confirmProjectSuspend: 'Suspend this project? Its back office and public site will be blocked.', confirmProjectReactivate: 'Reactivate this project? Published status will only be restored if an active publication exists.',
    confirmMakeAdmin: 'Give this account full platform control?', confirmRemoveAdmin: 'Remove this account’s persisted admin role? A security allowlist may still grant access.',
    saved: 'Change saved and audited.', offers: 'Plans and distribution', offersSubtitle: 'Active subscriptions by plan. Manual changes create no transaction.', subscribers: 'subscribers', free: 'Free', perMonth: '/ month', custom: 'Custom quote',
    audit: 'Audit log', auditSubtitle: 'Last 50 administration actions, with actor, target and timestamp.', actor: 'Actor', action: 'Action', target: 'Target', date: 'Date', details: 'Details', empty: 'No entries.', noResult: 'No result for this search.',
  },
};

function money(cents: number, currency: string, locale: UiLocale): string {
  try { return new Intl.NumberFormat(uiLocaleTag(locale), { style: 'currency', currency }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}

function PlanControl({ workspace, plans, locale, pending, onApply }: { workspace: AdminDashboardData['workspaces'][number]; plans: AdminDashboardData['plans']; locale: UiLocale; pending: boolean; onApply: (planId: string) => void }) {
  const dict = copy[locale];
  const [planId, setPlanId] = useState(workspace.planId || plans[0]?.id || '');
  if (workspace.hasProviderSubscription) return <span className="admin-external-note">{dict.externalSubscription}</span>;
  return <div className="admin-plan-control"><select aria-label={`${dict.planFor} ${workspace.name}`} value={planId} onChange={(event) => setPlanId(event.target.value)} disabled={pending}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><button className="button secondary small" aria-label={`${dict.applyPlan} ${workspace.name}`} disabled={pending || !planId || planId === workspace.planId} onClick={() => onApply(planId)}>{dict.applyPlan}</button></div>;
}

export function AdminDashboard({ initialData, actorId, locale: inputLocale }: { initialData: AdminDashboardData; actorId: string; locale: UiLocale }) {
  const locale = normalizeUiLocale(inputLocale);
  const dict = copy[locale];
  const dateLocale = uiLocaleTag(locale);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const data = initialData;
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (...values: (string | null)[]) => !normalizedQuery || values.some((value) => value?.toLowerCase().includes(normalizedQuery));
  const users = data.users.filter((user) => matches(user.name, user.email, user.id));
  const workspaces = data.workspaces.filter((workspace) => matches(workspace.name, workspace.ownerName, workspace.ownerEmail, workspace.id));
  const projects = data.projects.filter((project) => matches(project.name, project.slug, project.workspaceName, project.id));
  const chartMaximum = Math.max(1, ...data.activity.flatMap((day) => [day.users, day.projects]));
  const date = (value: string) => new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
  const dateTime = (value: string) => new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
  const number = (value: number) => new Intl.NumberFormat(dateLocale).format(value);

  async function mutate(key: string, path: string, body: object, confirmation: string) {
    if (!window.confirm(confirmation)) return;
    setPending(key); setMessage(''); setError(false);
    try {
      await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
      setMessage(dict.saved);
      startTransition(() => router.refresh());
    } catch (cause) { setError(true); setMessage(errorMessage(cause)); }
    finally { setPending(null); }
  }

  return <div className="admin-page">
    <header className="admin-page-header"><div><span className="eyebrow">{dict.eyebrow}</span><h1>{dict.title}</h1><p>{dict.subtitle}</p></div><button className="button secondary small" onClick={() => startTransition(() => router.refresh())} disabled={isRefreshing}>{isRefreshing ? dict.refreshing : dict.refresh}</button></header>
    <div className="admin-toolbar"><label><span>{dict.search}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={dict.searchPlaceholder} /></label><small>{dict.generated} {dateTime(data.generatedAt)} UTC</small></div>
    {message && <p className={`form-status ${error ? 'error' : 'success'}`} role="status">{message}</p>}

    <section id="overview" className="admin-section" aria-labelledby="admin-overview"><h2 id="admin-overview" className="sr-only">{dict.eyebrow}</h2><div className="admin-metrics">
      <article><span>{dict.users}</span><strong>{number(data.metrics.users.total)}</strong><small>{number(data.metrics.users.active)} {dict.active} · {number(data.metrics.users.admins)} {dict.namedAdmins}</small></article>
      <article><span>{dict.workspaces}</span><strong>{number(data.metrics.workspaces.total)}</strong><small>{number(data.metrics.workspaces.active)} {dict.active}</small></article>
      <article><span>{dict.projects}</span><strong>{number(data.metrics.projects.total)}</strong><small>{number(data.metrics.projects.published)} {dict.published} · {number(data.metrics.projects.suspended)} {dict.suspended}</small></article>
      <article><span>{dict.orders}</span><strong>{number(data.metrics.orders)}</strong><small>{dict.unpaidWarning}</small></article>
    </div></section>

    <div className="admin-insight-grid"><section className="admin-panel admin-activity" aria-labelledby="admin-activity"><header><div><h2 id="admin-activity">{dict.activity}</h2><p>{dict.activitySubtitle}</p></div><div className="admin-legend"><span><i className="users" />{dict.signups}</span><span><i className="projects" />{dict.projectCreations}</span></div></header><div className="admin-chart">{data.activity.map((day) => <div className="admin-chart-day" key={day.date} aria-label={`${date(day.date)}: ${day.users} ${dict.signups}, ${day.projects} ${dict.projectCreations}`}><div className="admin-chart-bars" aria-hidden="true"><i className="users" style={{ height: `${Math.max(day.users ? 8 : 2, day.users / chartMaximum * 100)}%` }} /><i className="projects" style={{ height: `${Math.max(day.projects ? 8 : 2, day.projects / chartMaximum * 100)}%` }} /></div><span>{new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`))}</span><span className="sr-only">{day.users} {dict.signups}, {day.projects} {dict.projectCreations}</span></div>)}</div></section>
      <section className="admin-panel" aria-labelledby="admin-operations"><header><h2 id="admin-operations">{dict.operations}</h2></header><div className="admin-operation-grid">{[[dict.pages, data.metrics.pages], [dict.reservations, data.metrics.reservations], [dict.leads, data.metrics.leads], [dict.ai, data.metrics.aiGenerations], [dict.storage, `${(data.metrics.storageBytes / 1024 / 1024).toFixed(1)} MB`], [`${dict.domains} · ${dict.dnsVerified}`, `${data.metrics.domains.total} · ${data.metrics.domains.verified}`]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{typeof value === 'number' ? number(value) : value}</strong></div>)}</div></section></div>

    <section className="admin-panel admin-order-values" aria-labelledby="admin-order-values"><header><div><h2 id="admin-order-values">{dict.orderValues}</h2><p>{dict.paymentTruth}</p></div></header>{data.metrics.orderValues.length ? <div>{data.metrics.orderValues.map((row) => <article key={row.currency}><strong>{money(row.totalCents, row.currency, locale)}</strong><span>{row.currency} · {money(row.paidCents, row.currency, locale)} {dict.markedPaid} · {money(row.unpaidCents, row.currency, locale)} {dict.notPaid}</span></article>)}</div> : <p className="muted">{dict.noOrders}</p>}</section>

    <section id="users" className="admin-panel admin-registry" aria-labelledby="admin-users"><header><div><h2 id="admin-users">{dict.userRegistry}</h2><p>{dict.latest100}</p></div><span className="status-pill">{users.length} / {data.users.length}</span></header><div className="admin-table-wrap"><table><thead><tr><th>{dict.account}</th><th>{dict.state}</th><th>{dict.access}</th><th>{dict.joined}</th><th>{dict.actions}</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small><small>{user.workspaceCount} {dict.workspaceCount}</small></td><td><span className={`status-pill ${user.status === 'active' ? 'published' : 'danger'}`}>{user.status === 'active' ? dict.active : dict.suspended}</span></td><td><span className={`status-pill ${user.platformAdmin ? 'admin' : ''}`}>{user.platformAdmin ? dict.admin : dict.userRole}</span>{user.platformRole === 'admin' && <small>{dict.persistedRoles}</small>}</td><td>{date(user.createdAt)}</td><td><div className="admin-row-actions">{!(actorId === user.id && user.platformRole === 'admin') && <button className="button secondary small" aria-label={`${user.platformRole === 'admin' ? dict.removeAdmin : dict.makeAdmin} ${user.name}`} disabled={pending !== null} onClick={() => mutate(`role:${user.id}`, `/api/admin/users/${user.id}`, { action: 'set_role', role: user.platformRole === 'admin' ? 'user' : 'admin' }, user.platformRole === 'admin' ? dict.confirmRemoveAdmin : dict.confirmMakeAdmin)}>{user.platformRole === 'admin' ? dict.removeAdmin : dict.makeAdmin}</button>}{actorId === user.id ? <small>{dict.yourAccount}</small> : <button className={`button small ${user.status === 'active' ? 'danger' : 'secondary'}`} aria-label={`${user.status === 'active' ? dict.suspend : dict.reactivate} ${user.name}`} disabled={pending !== null} onClick={() => mutate(`status:${user.id}`, `/api/admin/users/${user.id}`, { action: 'set_status', status: user.status === 'active' ? 'suspended' : 'active' }, user.status === 'active' ? dict.confirmUserSuspend : dict.confirmUserReactivate)}>{user.status === 'active' ? dict.suspend : dict.reactivate}</button>}</div></td></tr>)}{!users.length && <tr><td colSpan={5}>{dict.noResult}</td></tr>}</tbody></table></div></section>

    <section id="workspaces" className="admin-panel admin-registry" aria-labelledby="admin-workspaces"><header><div><h2 id="admin-workspaces">{dict.workspaceRegistry}</h2><p>{dict.latest100}</p></div><span className="status-pill">{workspaces.length} / {data.workspaces.length}</span></header><div className="admin-table-wrap"><table><thead><tr><th>{dict.workspace}</th><th>{dict.owner}</th><th>{dict.state}</th><th>{dict.plan}</th><th>{dict.actions}</th></tr></thead><tbody>{workspaces.map((workspace) => <tr key={workspace.id}><td><strong>{workspace.name}</strong><small>{workspace.projectCount} {dict.projectCount}</small></td><td><strong>{workspace.ownerName}</strong><small>{workspace.ownerEmail}</small></td><td><span className={`status-pill ${workspace.status === 'active' ? 'published' : 'danger'}`}>{workspace.status === 'active' ? dict.active : dict.suspended}</span></td><td><PlanControl key={`${workspace.id}:${workspace.planId}`} workspace={workspace} plans={data.plans} locale={locale} pending={pending !== null} onApply={(planId) => mutate(`plan:${workspace.id}`, `/api/admin/workspaces/${workspace.id}`, { action: 'set_plan', planId }, dict.confirmPlan)} /></td><td><button className={`button small ${workspace.status === 'active' ? 'danger' : 'secondary'}`} aria-label={`${workspace.status === 'active' ? dict.suspend : dict.reactivate} ${workspace.name}`} disabled={pending !== null} onClick={() => mutate(`workspace:${workspace.id}`, `/api/admin/workspaces/${workspace.id}`, { action: 'set_status', status: workspace.status === 'active' ? 'suspended' : 'active' }, workspace.status === 'active' ? dict.confirmWorkspaceSuspend : dict.confirmWorkspaceReactivate)}>{workspace.status === 'active' ? dict.suspend : dict.reactivate}</button></td></tr>)}{!workspaces.length && <tr><td colSpan={5}>{dict.noResult}</td></tr>}</tbody></table></div></section>

    <section id="projects" className="admin-panel admin-registry" aria-labelledby="admin-projects"><header><div><h2 id="admin-projects">{dict.projectRegistry}</h2><p>{dict.latest100}</p></div><span className="status-pill">{projects.length} / {data.projects.length}</span></header><div className="admin-table-wrap"><table><thead><tr><th>{dict.site}</th><th>{dict.workspace}</th><th>{dict.state}</th><th>{dict.updated}</th><th>{dict.actions}</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td><strong>{project.name}</strong><small>/s/{project.slug}</small></td><td>{project.workspaceName}</td><td><span className={`status-pill ${project.status === 'published' ? 'published' : project.status === 'suspended' ? 'danger' : ''}`}>{project.status === 'published' ? dict.published : project.status === 'suspended' ? dict.suspended : dict.draft}</span></td><td>{dateTime(project.updatedAt)} UTC</td><td><button className={`button small ${project.status === 'suspended' ? 'secondary' : 'danger'}`} aria-label={`${project.status === 'suspended' ? dict.reactivate : dict.suspend} ${project.name}`} disabled={pending !== null} onClick={() => mutate(`project:${project.id}`, `/api/admin/projects/${project.id}`, { action: project.status === 'suspended' ? 'reactivate' : 'suspend' }, project.status === 'suspended' ? dict.confirmProjectReactivate : dict.confirmProjectSuspend)}>{project.status === 'suspended' ? dict.reactivate : dict.suspend}</button></td></tr>)}{!projects.length && <tr><td colSpan={5}>{dict.noResult}</td></tr>}</tbody></table></div></section>

    <section id="offers" className="admin-panel" aria-labelledby="admin-offers"><header><div><h2 id="admin-offers">{dict.offers}</h2><p>{dict.offersSubtitle}</p></div></header><div className="admin-plan-grid">{data.plans.map((plan) => <article key={plan.id}><span className="plan-code">{plan.code}</span><h3>{plan.name}</h3><strong>{plan.monthlyPriceCents === null ? dict.custom : plan.monthlyPriceCents === 0 ? dict.free : `${money(plan.monthlyPriceCents, plan.currency, locale)} ${dict.perMonth}`}</strong><p>{number(plan.subscribers)} {dict.subscribers}</p></article>)}</div></section>

    <section id="audit" className="admin-panel admin-registry" aria-labelledby="admin-audit"><header><div><h2 id="admin-audit">{dict.audit}</h2><p>{dict.auditSubtitle}</p></div></header><div className="admin-table-wrap"><table><thead><tr><th>{dict.actor}</th><th>{dict.action}</th><th>{dict.target}</th><th>{dict.date}</th><th>{dict.details}</th></tr></thead><tbody>{data.audit.map((entry) => <tr key={entry.id}><td><strong>{entry.actorName}</strong><small>{entry.actorEmail}</small></td><td><code>{entry.action}</code></td><td><span>{entry.targetType}</span><small>{entry.targetId}</small></td><td>{dateTime(entry.createdAt)} UTC</td><td><code className="admin-audit-details">{JSON.stringify(entry.details)}</code></td></tr>)}{!data.audit.length && <tr><td colSpan={5}>{dict.empty}</td></tr>}</tbody></table></div></section>
  </div>;
}
