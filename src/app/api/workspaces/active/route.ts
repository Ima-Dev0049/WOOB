import { NextResponse } from 'next/server';
import { z } from 'zod';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { requireMembership } from '@/server/auth/tenancy';
export async function POST(request: Request) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const { workspaceId } = z.object({ workspaceId: z.uuid() }).parse(await request.json()); await requireMembership(auth.user.id, workspaceId, 'read'); const response = noStore(NextResponse.json({ ok: true })); response.cookies.set('woob_workspace', workspaceId, { httpOnly: true, sameSite: 'lax', secure: process.env.APP_ENV === 'production' || (process.env.APP_URL || '').startsWith('https://'), path: '/', maxAge: 365 * 86400 }); return response; }); }
