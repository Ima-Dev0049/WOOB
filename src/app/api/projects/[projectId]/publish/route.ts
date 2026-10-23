import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { publishProject } from '@/server/services/publishing';

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    return noStore(NextResponse.json(await publishProject(auth.user.id, (await context.params).projectId), { status: 201 }));
  });
}
