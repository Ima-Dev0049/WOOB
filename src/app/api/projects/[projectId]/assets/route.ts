import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { listAssets, uploadAsset } from '@/server/services/assets';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => { const auth = await requireUser(); return noStore(NextResponse.json({ assets: await listAssets(auth.user.id, (await context.params).projectId) })); });
}
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => {
    const auth = await requireUser(); await assertCsrf(request);
    const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File)) return noStore(NextResponse.json({ error: { code: 'FILE_REQUIRED', message: 'Sélectionnez une image.' } }, { status: 422 }));
    const asset = await uploadAsset(auth.user.id, (await context.params).projectId, file, form.get('alt'));
    return noStore(NextResponse.json({ asset }, { status: 201 }));
  });
}
