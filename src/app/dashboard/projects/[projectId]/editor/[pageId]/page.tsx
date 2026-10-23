import { notFound, redirect } from 'next/navigation';
import { getCurrentAuth } from '@/server/auth';
import { getProjectDetails } from '@/server/services/projects';
import { buildProjectSnapshot } from '@/server/services/publishing';
import { getDb } from '@/server/db';
import { createId } from '@/lib/id';
import { EditorWorkspace } from '@/components/editor/EditorWorkspace';
import { ApiError } from '@/server/http';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Éditeur visuel' };
export default async function EditorPage({ params }: { params: Promise<{ projectId: string; pageId: string }> }) {
  const auth = await getCurrentAuth(); if (!auth) redirect('/login');
  const { projectId, pageId } = await params;
  let details;
  try { details = await getProjectDetails(auth.user.id, projectId); } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  const page = details.pages.find((candidate) => candidate.id === pageId);
  if (!page) notFound();
  const site = await buildProjectSnapshot(details.project, createId('editor'), await getDb());
  return <EditorWorkspace project={details.project} pages={details.pages.map((item) => ({ id: item.id, name: item.name, path: item.path, kind: item.kind, draftRevision: item.draftRevision }))} initialPage={page} initialSite={site} />;
}
