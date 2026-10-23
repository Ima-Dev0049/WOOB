import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { requireUser } from '@/server/auth';
import { listPageVersions } from '@/server/services/projects';
export async function GET(_request: Request, context: { params: Promise<{ pageId: string }> }) { return api(async () => { const auth = await requireUser(); const versions = await listPageVersions(auth.user.id, (await context.params).pageId); return noStore(NextResponse.json({ versions })); }); }
