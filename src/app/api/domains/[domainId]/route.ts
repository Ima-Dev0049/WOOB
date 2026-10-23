import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { deleteDomain } from '@/server/services/domains';
export async function DELETE(request: Request, context: { params: Promise<{ domainId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); await deleteDomain(auth.user.id, (await context.params).domainId); return noStore(NextResponse.json({ ok: true })); }); }
