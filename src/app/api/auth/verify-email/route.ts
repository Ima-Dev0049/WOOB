import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { verifyEmail } from '@/server/auth';

export async function POST(request: Request) {
  return api(async () => {
    const body = await request.json() as { token?: string };
    await verifyEmail(body.token || '');
    return noStore(NextResponse.json({ ok: true }));
  });
}
