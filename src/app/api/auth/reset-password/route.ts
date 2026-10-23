import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { resetPassword } from '@/server/auth';
import { rateLimit, requestIp } from '@/server/security/rate-limit';

export async function POST(request: Request) {
  return api(async () => {
    rateLimit(`${requestIp(request)}:reset`, { max: 8, windowMs: 3600_000 });
    const body = await request.json() as { token?: string; password?: string };
    await resetPassword(body.token || '', body.password || '');
    return noStore(NextResponse.json({ ok: true }));
  });
}
