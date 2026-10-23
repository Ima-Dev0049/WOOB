import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { generateAiProposal } from '@/server/services/ai';
import { rateLimit, requestIp } from '@/server/security/rate-limit';
export async function POST(request: Request, context: { params: Promise<{ pageId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); rateLimit(`${requestIp(request)}:ai`, { max: 20, windowMs: 3600_000 }); const result = await generateAiProposal(auth.user.id, (await context.params).pageId, await request.json()); return noStore(NextResponse.json(result, { status: 201 })); }); }
