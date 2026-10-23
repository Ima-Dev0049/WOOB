import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { requireUser } from '@/server/auth';
import { getProjectPublicationPreflight } from '@/server/services/publishing';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    return noStore(NextResponse.json(await getProjectPublicationPreflight(auth.user.id, (await context.params).projectId)));
  });
}
