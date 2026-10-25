import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApplicationManager } from '@/components/app/ApplicationManager';
import { getCurrentAuth } from '@/server/auth';
import { ApiError } from '@/server/http';
import { getApplicationDashboard } from '@/server/services/application';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modèle d’application' };

export default async function ApplicationPage({ params }: { params: Promise<{ projectId: string }> }) {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/login');
  let data;
  try { data = await getApplicationDashboard(auth.user.id, (await params).projectId); } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  return <div className="project-dashboard application-dashboard">
    <header className="project-breadcrumb"><Link href="/dashboard">Projets</Link><span>/</span><Link href={`/dashboard/projects/${data.project.id}`}>{data.project.name}</Link><span>/</span><span>Application gérée</span></header>
    <div className="app-page-header"><div><span className="eyebrow">Modèle d’application</span><h1>{data.model?.name ?? 'Application gérée'}</h1><p>{data.model?.description || 'Un modèle structuré, exécuté par le serveur commun WOOB.'}</p></div><Link className="button secondary" href={`/dashboard/projects/${data.project.id}`}>Retour au projet</Link></div>
    <ApplicationManager
      key={`${data.project.id}-${data.version}`}
      projectId={data.project.id}
      model={data.model}
      version={data.version}
      role={data.role}
      canManage={data.canManage}
      initialSummary={data.summary}
      initialObjects={data.objects.map((item) => ({
        object: item.object,
        total: item.total,
        records: item.records.map((record) => ({ ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() })),
      }))}
    />
  </div>;
}
