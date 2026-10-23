import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentAuth } from '@/server/auth';
import { getProjectDetails } from '@/server/services/projects';
import { listPublications } from '@/server/services/publishing';
import { ApiError } from '@/server/http';
import { PublicationPanel } from '@/components/app/PublicationPanel';
import { ProjectSettingsForm } from '@/components/app/ProjectSettingsForm';
import { CreatePageButton } from '@/components/app/CreatePageButton';

export const dynamic = 'force-dynamic';
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const auth = await getCurrentAuth(); if (!auth) redirect('/login');
  let details;
  try { details = await getProjectDetails(auth.user.id, (await params).projectId); } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  const publications = await listPublications(auth.user.id, details.project.id);
  return <div className="project-dashboard"><header className="project-breadcrumb"><Link href="/dashboard">Projets</Link><span>/</span><span>{details.project.name}</span></header><div className="app-page-header"><div><span className={`status-pill ${details.project.status}`}>{details.project.status === 'published' ? '● Site en ligne' : '○ Brouillon'}</span><h1>{details.project.name}</h1><p>{details.project.description || 'Donnez forme à votre projet, page par page.'}</p></div><div className="button-row"><a className="button secondary" href={`/preview/${details.project.id}`} target="_blank">Aperçu ↗</a>{details.pages[0] && <Link className="button coral" href={`/dashboard/projects/${details.project.id}/editor/${details.pages[0].id}`}>Ouvrir l’éditeur →</Link>}</div></div><div className="project-overview-grid"><section className="project-pages-panel"><header><div><h2>Pages du site</h2><p>{details.pages.length} page{details.pages.length > 1 ? 's' : ''} dans le brouillon</p></div><CreatePageButton projectId={details.project.id} /></header><div className="page-list">{details.pages.map((page) => <article key={page.id}><div className="page-icon">{page.path === '/' ? '⌂' : '▤'}</div><div><strong>{page.name}</strong><code>{page.path}</code></div><span>Révision {page.draftRevision}</span><a href={`/preview/${details.project.id}${page.path === '/' ? '' : page.path}`} target="_blank" className="icon-button" aria-label={`Aperçu de ${page.name}`}>◉</a><Link className="button secondary small" href={`/dashboard/projects/${details.project.id}/editor/${page.id}`}>Modifier</Link></article>)}</div></section><aside className="project-summary"><h2>Contenu du projet</h2><div><span>Modules actifs</span><strong>{details.modules.filter((module) => module.enabled).length}</strong></div><div><span>Produits au catalogue</span><strong>{details.products.length}</strong></div><div><span>Articles</span><strong>{details.posts.length}</strong></div><p>Les modules de données sont accessibles ci-dessous et inclus dans le prochain snapshot publié.</p><Link href={`/dashboard/projects/${details.project.id}/modules`} className="text-link">Gérer les modules →</Link><Link href={`/dashboard/projects/${details.project.id}/domains`} className="text-link">Configurer les domaines →</Link></aside></div><PublicationPanel projectId={details.project.id} slug={details.project.slug} status={details.project.status} publications={publications.map((publication) => ({ ...publication, createdAt: publication.createdAt.toISOString() }))} /><ProjectSettingsForm project={details.project} /></div>;
}
