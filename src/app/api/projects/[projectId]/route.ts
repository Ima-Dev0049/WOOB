import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { deleteProject, getProjectDetails, updateProjectSettings } from '@/server/services/projects';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    return noStore(NextResponse.json(await getProjectDetails(auth.user.id, (await context.params).projectId)));
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    return noStore(NextResponse.json({ project: await updateProjectSettings(auth.user.id, (await context.params).projectId, await request.json()) }));
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    await deleteProject(auth.user.id, (await context.params).projectId);
    return noStore(NextResponse.json({ ok: true }));
  });
}
