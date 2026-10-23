import { NextResponse } from 'next/server';
import { assertCsrf, requireUser } from '@/server/auth';
import { api, noStore } from '@/server/http';
import { rateLimit } from '@/server/security/rate-limit';
import { administerWorkspace } from '@/server/services/admin';

export async function PATCH(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    rateLimit(`admin:write:${auth.user.id}`, { max: 60 });
    const { workspaceId } = await context.params;
    await administerWorkspace(auth.user.id, workspaceId, await request.json());
    return noStore(NextResponse.json({ ok: true }));
  });
}
