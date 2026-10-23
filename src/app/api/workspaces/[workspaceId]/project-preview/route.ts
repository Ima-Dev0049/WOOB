import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { generateProjectPreview } from '@/server/services/project-generation';
import { rateLimit, requestIp } from '@/server/security/rate-limit';

export async function POST(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    rateLimit(`${requestIp(request)}:project-ai`, { max: 20, windowMs: 3600_000 });
    const { workspaceId } = await context.params;
    const result = await generateProjectPreview(auth.user.id, workspaceId, await request.json());
    return noStore(NextResponse.json(result, { status: 201 }));
  });
}
