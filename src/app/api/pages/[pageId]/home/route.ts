import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { setHomePage } from '@/server/services/projects';

export async function POST(request: Request, context: { params: Promise<{ pageId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    return noStore(NextResponse.json({ page: await setHomePage(auth.user.id, (await context.params).pageId) }));
  });
}
