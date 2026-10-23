import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { restorePageVersion } from '@/server/services/projects';
export async function POST(request: Request, context: { params: Promise<{ pageId: string; versionId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const params = await context.params; const result = await restorePageVersion(auth.user.id, params.pageId, params.versionId, await request.json()); return noStore(NextResponse.json(result)); }); }
