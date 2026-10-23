import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { addDomain, listDomains } from '@/server/services/domains';
export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) { return api(async () => { const auth = await requireUser(); return noStore(NextResponse.json({ domains: await listDomains(auth.user.id, (await context.params).projectId) })); }); }
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const result = await addDomain(auth.user.id, (await context.params).projectId, await request.json()); return noStore(NextResponse.json(result, { status: 201 })); }); }
