import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentAuth } from '@/server/auth';
import { requireProject } from '@/server/auth/tenancy';
import { buildProjectSnapshot } from '@/server/services/publishing';
import { getDb } from '@/server/db';
import { createId } from '@/lib/id';
import { SitePage } from '@/components/renderer/SitePage';

export const metadata: Metadata = { title: 'Aperçu privé · Woob', robots: { index: false, follow: false } };
function pagePath(parts?: string[]): string { return parts?.length ? `/${parts.join('/')}` : '/'; }

export default async function PreviewPage({ params }: { params: Promise<{ projectId: string; path?: string[] }> }) {
  const { projectId, path } = await params;
  const auth = await getCurrentAuth();
  if (!auth) redirect('/login');
  const db = await getDb();
  const project = await requireProject(auth.user.id, projectId, 'read', db);
  const snapshot = await buildProjectSnapshot(project, createId('preview'), db);
  const currentPath = pagePath(path);
  if (!snapshot.pages.some((page) => page.path === currentPath)) notFound();
  return <><div className="preview-banner">Aperçu privé du brouillon — modifications non publiques.</div><SitePage site={snapshot} path={currentPath} mode="preview" /></>;
}
