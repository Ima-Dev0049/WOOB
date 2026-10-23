import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, getActiveWorkspace, requireUser } from '@/server/auth';
import { createCheckout } from '@/server/services/billing';
export async function POST(request: Request) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const workspace = await getActiveWorkspace(auth.user.id); if (!workspace) throw new Error('Workspace absent'); const url = await createCheckout(auth.user.id, workspace.id, await request.json()); return noStore(NextResponse.json({ url })); }); }
