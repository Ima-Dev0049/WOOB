import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { createPage } from '@/server/services/projects';

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const page = await createPage(auth.user.id, (await context.params).projectId, await request.json());
    return noStore(NextResponse.json({ page }, { status: 201 }));
  });
}
