import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { createProject, listProjects } from '@/server/services/projects';

export async function GET(_request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    const { workspaceId } = await context.params;
    return noStore(NextResponse.json({ projects: await listProjects(auth.user.id, workspaceId) }));
  });
}

export async function POST(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const { workspaceId } = await context.params;
    const result = await createProject(auth.user.id, workspaceId, await request.json());
    return noStore(NextResponse.json(result, { status: 201 }));
  });
}
