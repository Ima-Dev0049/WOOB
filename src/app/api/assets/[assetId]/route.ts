import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { deleteAsset } from '@/server/services/assets';
export async function DELETE(request: Request, context: { params: Promise<{ assetId: string }> }) {
  return api(async () => { const auth = await requireUser(); await assertCsrf(request); await deleteAsset(auth.user.id, (await context.params).assetId); return noStore(NextResponse.json({ ok: true })); });
}
