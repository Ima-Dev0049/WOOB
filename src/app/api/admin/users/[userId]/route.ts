import { NextResponse } from 'next/server';
import { assertCsrf, requireUser } from '@/server/auth';
import { api, noStore } from '@/server/http';
import { rateLimit } from '@/server/security/rate-limit';
import { administerUser } from '@/server/services/admin';

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    rateLimit(`admin:write:${auth.user.id}`, { max: 60 });
    const { userId } = await context.params;
    await administerUser(auth.user.id, userId, await request.json());
    return noStore(NextResponse.json({ ok: true }));
  });
}
