import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { suspendMember, updateMemberRole } from '@/server/services/members';
export async function PATCH(request: Request, context: { params: Promise<{ workspaceId: string; userId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const params = await context.params; const body = await request.json() as { role?: unknown }; await updateMemberRole(auth.user.id, params.workspaceId, params.userId, body.role); return noStore(NextResponse.json({ ok: true })); }); }
export async function DELETE(request: Request, context: { params: Promise<{ workspaceId: string; userId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const params = await context.params; await suspendMember(auth.user.id, params.workspaceId, params.userId); return noStore(NextResponse.json({ ok: true })); }); }
