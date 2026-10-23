import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { setModuleEnabled } from '@/server/services/business';
export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); await setModuleEnabled(auth.user.id, (await context.params).projectId, await request.json()); return noStore(NextResponse.json({ ok: true })); }); }
