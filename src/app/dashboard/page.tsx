import Link from 'next/link';
import { getActiveWorkspace, getCurrentAuth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { listProjects } from '@/server/services/projects';
import { getUsageSummary } from '@/server/services/quotas';
import { CreateProjectDialog } from '@/components/app/CreateProjectDialog';
import { getDictionary, normalizeUiLocale, uiLocaleTag } from '@/lib/i18n';

export const metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/login');
  const workspace = await getActiveWorkspace(auth.user.id);
  if (!workspace) redirect('/login');
  const locale = normalizeUiLocale(auth.user.uiLocale);
  const dict = getDictionary(locale);
  const dateLocale = uiLocaleTag(locale);
  const [projects, usage] = await Promise.all([listProjects(auth.user.id, workspace.id), getUsageSummary(workspace.id)]);
  const published = projects.filter((project) => project.status === 'published').length;
  const projectLimit = Number.isFinite(usage.projects.limit) ? usage.projects.limit : '∞';
  const storageLimit = (usage.storage.limit / 1024 / 1024).toLocaleString(dateLocale);
  return <div className="dashboard-page"><header className="app-page-header"><div><span className="eyebrow">{dict.dashboard.eyebrow}</span><h1>{dict.dashboard.greeting}, {auth.user.name.split(' ')[0]}.</h1><p>{dict.dashboard.subtitle}</p></div><CreateProjectDialog workspaceId={workspace.id} locale={locale} compact /></header><section className="dashboard-stats"><article><span>{dict.dashboard.activeProjects}</span><strong>{projects.length}</strong><small>{dict.dashboard.projectLimit(projectLimit, usage.plan.name)}</small></article><article><span>{dict.dashboard.onlineSites}</span><strong>{published}</strong><small>{dict.dashboard.drafts(projects.length - published)}</small></article><article><span>{dict.dashboard.storageUsed}</span><strong>{(usage.storage.used / 1024 / 1024).toFixed(1)}<i> {dict.dashboard.megabyte}</i></strong><small>{dict.dashboard.storageLimit(storageLimit)}</small></article><article><span>{dict.dashboard.aiGenerations}</span><strong>{usage.ai.used}</strong><small>{dict.dashboard.aiCaption}</small></article></section><section className="dashboard-projects" id="projects"><header><div><h2>{dict.dashboard.yourProjects}</h2><p>{dict.dashboard.projectsSubtitle}</p></div><span>{dict.dashboard.projectCount(projects.length)}</span></header>{projects.length ? <div className="project-grid">{projects.map((project, index) => <article className="project-card" key={project.id}><Link href={`/dashboard/projects/${project.id}`} className={`project-cover cover-${index % 4}`}><div className="project-cover-nav"><span>{project.name.slice(0, 1)}</span><i /><i /><i /></div><div className="project-cover-content"><small>{project.defaultLocale === 'fr' ? 'SITE PROFESSIONNEL' : 'PROFESSIONAL WEBSITE'}</small><strong>{project.name}</strong><span /></div><span className={`project-status ${project.status}`}>{project.status === 'published' ? dict.dashboard.online : dict.dashboard.draft}</span></Link><div className="project-card-info"><div><h3><Link href={`/dashboard/projects/${project.id}`}>{project.name}</Link></h3><p>{project.description || dict.dashboard.noDescription}</p></div><Link className="icon-button" href={`/dashboard/projects/${project.id}`} aria-label={dict.dashboard.openProject(project.name)}>↗</Link></div><footer><span>{dict.dashboard.modified(project.updatedAt.toLocaleDateString(dateLocale))}</span>{project.status === 'published' && <a href={`/s/${project.slug}`} target="_blank">{dict.dashboard.viewSite}</a>}</footer></article>)}</div> : <div className="empty-state"><div className="empty-illustration"><span>✦</span><i /><i /></div><h2>{dict.dashboard.emptyTitle}</h2><p>{dict.dashboard.emptyBody}</p><CreateProjectDialog workspaceId={workspace.id} locale={locale} /></div>}</section></div>;
}
