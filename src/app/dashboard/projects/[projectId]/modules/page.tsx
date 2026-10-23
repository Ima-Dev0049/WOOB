import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentAuth } from '@/server/auth';
import { getBusinessData } from '@/server/services/business';
import { BusinessManager } from '@/components/app/BusinessManager';
import { ApiError } from '@/server/http';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modules métier' };
export default async function ModulesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const auth = await getCurrentAuth(); if (!auth) redirect('/login');
  let data;
  try { data = await getBusinessData(auth.user.id, (await params).projectId); } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  return <div className="project-dashboard"><header className="project-breadcrumb"><Link href="/dashboard">Projets</Link><span>/</span><Link href={`/dashboard/projects/${data.project.id}`}>{data.project.name}</Link><span>/</span><span>Modules</span></header><div className="app-page-header"><div><span className="eyebrow">Données et activité</span><h1>Modules métier</h1><p>Traitez les demandes réelles et préparez le contenu de la prochaine publication.</p></div><Link className="button secondary" href={`/dashboard/projects/${data.project.id}`}>Retour au projet</Link></div><BusinessManager projectId={data.project.id} data={{ modules: data.modules, messages: data.messages, reservations: data.reservations, orders: data.orders, products: data.products, posts: data.posts }} /></div>;
}
