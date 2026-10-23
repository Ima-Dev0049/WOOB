import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { savePageDocument } from '@/server/services/projects';

export async function PUT(request: Request, context: { params: Promise<{ pageId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const page = await savePageDocument(auth.user.id, (await context.params).pageId, await request.json());
    return noStore(NextResponse.json({ page }));
  });
}
