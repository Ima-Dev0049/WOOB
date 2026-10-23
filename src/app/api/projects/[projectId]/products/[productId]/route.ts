import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { updateProduct } from '@/server/services/business';
export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; productId: string }> }) { return api(async () => { const auth = await requireUser(); await assertCsrf(request); const { projectId, productId } = await context.params; const product = await updateProduct(auth.user.id, projectId, productId, await request.json()); return noStore(NextResponse.json({ product })); }); }
