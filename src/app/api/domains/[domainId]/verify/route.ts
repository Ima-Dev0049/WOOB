import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { verifyDomain } from '@/server/services/domains';
export async function POST(request: Request, context: { params: Promise<{ domainId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const domain = await verifyDomain(auth.user.id, (await context.params).domainId); return noStore(NextResponse.json({ domain })); }); }
