import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentAuth } from '@/server/auth';
import { requireMembership, requireProject } from '@/server/auth/tenancy';
import { listDomains } from '@/server/services/domains';
import { DomainManager } from '@/components/app/DomainManager';
import { ApiError } from '@/server/http';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Domaines' };
export default async function DomainsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const auth = await getCurrentAuth(); if (!auth) redirect('/login');
  let project;
  try { project = await requireProject(auth.user.id, (await params).projectId, 'read'); } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  const [domains, membership] = await Promise.all([listDomains(auth.user.id, project.id), requireMembership(auth.user.id, project.workspaceId, 'read')]);
  const canManage = membership.role === 'owner' || membership.role === 'admin';
  return <div className="project-dashboard"><header className="project-breadcrumb"><Link href="/dashboard">Projets</Link><span>/</span><Link href={`/dashboard/projects/${project.id}`}>{project.name}</Link><span>/</span><span>Domaines</span></header><div className="app-page-header"><div><span className="eyebrow">Routage et DNS</span><h1>Domaines</h1><p>Gérez les intentions de configuration sans masquer les dépendances externes.</p></div><Link className="button secondary" href={`/dashboard/projects/${project.id}`}>Retour au projet</Link></div><DomainManager projectId={project.id} slug={project.slug} canManage={canManage} domains={domains} /></div>;
}
