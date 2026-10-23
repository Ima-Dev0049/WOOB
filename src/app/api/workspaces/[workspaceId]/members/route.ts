import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { addExistingMember, listMembers } from '@/server/services/members';
export async function GET(_request: Request, context: { params: Promise<{ workspaceId: string }> }) { return api(async () => { const auth = await requireUser(); return noStore(NextResponse.json(await listMembers(auth.user.id, (await context.params).workspaceId))); }); }
export async function POST(request: Request, context: { params: Promise<{ workspaceId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const member = await addExistingMember(auth.user.id, (await context.params).workspaceId, await request.json()); return noStore(NextResponse.json({ member }, { status: 201 })); }); }
