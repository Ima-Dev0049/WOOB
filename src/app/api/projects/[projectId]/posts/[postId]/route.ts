import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { updatePost } from '@/server/services/business';
export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; postId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const { projectId, postId } = await context.params; const post = await updatePost(auth.user.id, projectId, postId, await request.json()); return noStore(NextResponse.json({ post })); }); }
