import { NextResponse } from 'next/server';
import { assertCsrf, requireUser } from '@/server/auth';
import { requireProject } from '@/server/auth/tenancy';
import { api, noStore } from '@/server/http';
import { savePublicIntake } from '@/server/services/site-portal';

export async function PUT(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const { projectId } = await context.params;
    const intake = await savePublicIntake(auth.user.id, projectId, await request.json());
    const project = await requireProject(auth.user.id, projectId);
    return noStore(NextResponse.json({ intake, portalPath: `/portail/${project.slug}` }));
  });
}
