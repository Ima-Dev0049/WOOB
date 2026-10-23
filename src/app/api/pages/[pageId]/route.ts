import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { deletePage, updatePageMetadata } from '@/server/services/projects';

export async function PATCH(request: Request, context: { params: Promise<{ pageId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const page = await updatePageMetadata(auth.user.id, (await context.params).pageId, await request.json());
    return noStore(NextResponse.json({ page }));
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ pageId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    await deletePage(auth.user.id, (await context.params).pageId);
    return noStore(NextResponse.json({ ok: true }));
  });
}
