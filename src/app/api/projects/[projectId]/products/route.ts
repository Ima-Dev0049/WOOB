import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { createProduct } from '@/server/services/business';
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const product = await createProduct(auth.user.id, (await context.params).projectId, await request.json()); return noStore(NextResponse.json({ product }, { status: 201 })); }); }
