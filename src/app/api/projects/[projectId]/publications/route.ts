import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { listPublications, rollbackPublication } from '@/server/services/publishing';
import { z } from 'zod';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    return noStore(NextResponse.json({ publications: await listPublications(auth.user.id, (await context.params).projectId) }));
  });
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const body = z.object({ publicationId: z.string().uuid() }).parse(await request.json());
    return noStore(NextResponse.json(await rollbackPublication(auth.user.id, (await context.params).projectId, body.publicationId), { status: 201 }));
  });
}
